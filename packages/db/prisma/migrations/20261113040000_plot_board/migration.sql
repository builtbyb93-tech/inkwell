-- CreateEnum
CREATE TYPE "SceneStatus" AS ENUM ('PLANNED', 'DRAFT', 'REVIEW', 'COMPLETE');

-- AlterTable
ALTER TABLE "Scene" ADD COLUMN     "duplicatedFromId" UUID,
ADD COLUMN     "groupId" UUID,
ADD COLUMN     "status" "SceneStatus" NOT NULL DEFAULT 'PLANNED';

-- CreateTable
CREATE TABLE "PlotGroup" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "storyId" UUID NOT NULL,
    "parentId" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PlotGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SceneCharacterLink" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "storyId" UUID NOT NULL,
    "sceneId" UUID NOT NULL,
    "canonId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SceneCharacterLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SceneLocationLink" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "storyId" UUID NOT NULL,
    "sceneId" UUID NOT NULL,
    "canonId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SceneLocationLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlotGroup_workspaceId_projectId_storyId_parentId_archivedAt_idx" ON "PlotGroup"("workspaceId", "projectId", "storyId", "parentId", "archivedAt", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "PlotGroup_id_storyId_projectId_workspaceId_key" ON "PlotGroup"("id", "storyId", "projectId", "workspaceId");

-- CreateIndex
CREATE INDEX "SceneCharacterLink_workspaceId_projectId_canonId_createdAt__idx" ON "SceneCharacterLink"("workspaceId", "projectId", "canonId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "SceneCharacterLink_workspaceId_storyId_sceneId_idx" ON "SceneCharacterLink"("workspaceId", "storyId", "sceneId");

-- CreateIndex
CREATE UNIQUE INDEX "SceneCharacterLink_sceneId_canonId_key" ON "SceneCharacterLink"("sceneId", "canonId");

-- CreateIndex
CREATE INDEX "SceneLocationLink_workspaceId_projectId_canonId_createdAt_i_idx" ON "SceneLocationLink"("workspaceId", "projectId", "canonId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "SceneLocationLink_workspaceId_storyId_sceneId_idx" ON "SceneLocationLink"("workspaceId", "storyId", "sceneId");

-- CreateIndex
CREATE UNIQUE INDEX "SceneLocationLink_sceneId_canonId_key" ON "SceneLocationLink"("sceneId", "canonId");

-- CreateIndex
CREATE INDEX "Scene_workspaceId_projectId_storyId_groupId_archivedAt_posi_idx" ON "Scene"("workspaceId", "projectId", "storyId", "groupId", "archivedAt", "position");

-- CreateIndex
CREATE INDEX "Scene_duplicatedFromId_storyId_projectId_workspaceId_idx" ON "Scene"("duplicatedFromId", "storyId", "projectId", "workspaceId");

-- AddForeignKey
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_groupId_storyId_projectId_workspaceId_fkey" FOREIGN KEY ("groupId", "storyId", "projectId", "workspaceId") REFERENCES "PlotGroup"("id", "storyId", "projectId", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_duplicatedFromId_storyId_projectId_workspaceId_fkey" FOREIGN KEY ("duplicatedFromId", "storyId", "projectId", "workspaceId") REFERENCES "Scene"("id", "storyId", "projectId", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlotGroup" ADD CONSTRAINT "PlotGroup_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlotGroup" ADD CONSTRAINT "PlotGroup_projectId_workspaceId_fkey" FOREIGN KEY ("projectId", "workspaceId") REFERENCES "Project"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlotGroup" ADD CONSTRAINT "PlotGroup_storyId_projectId_workspaceId_fkey" FOREIGN KEY ("storyId", "projectId", "workspaceId") REFERENCES "Story"("id", "projectId", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlotGroup" ADD CONSTRAINT "PlotGroup_parentId_storyId_projectId_workspaceId_fkey" FOREIGN KEY ("parentId", "storyId", "projectId", "workspaceId") REFERENCES "PlotGroup"("id", "storyId", "projectId", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SceneCharacterLink" ADD CONSTRAINT "SceneCharacterLink_sceneId_storyId_projectId_workspaceId_fkey" FOREIGN KEY ("sceneId", "storyId", "projectId", "workspaceId") REFERENCES "Scene"("id", "storyId", "projectId", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SceneCharacterLink" ADD CONSTRAINT "SceneCharacterLink_canonId_projectId_workspaceId_fkey" FOREIGN KEY ("canonId", "projectId", "workspaceId") REFERENCES "Character"("id", "projectId", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SceneLocationLink" ADD CONSTRAINT "SceneLocationLink_sceneId_storyId_projectId_workspaceId_fkey" FOREIGN KEY ("sceneId", "storyId", "projectId", "workspaceId") REFERENCES "Scene"("id", "storyId", "projectId", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SceneLocationLink" ADD CONSTRAINT "SceneLocationLink_canonId_projectId_workspaceId_fkey" FOREIGN KEY ("canonId", "projectId", "workspaceId") REFERENCES "Character"("id", "projectId", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Migration-owned deferred order uniqueness enables atomic position replacement.
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_storyId_position_key" UNIQUE USING INDEX "Scene_storyId_position_key" DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE "PlotGroup" ADD CONSTRAINT "PlotGroup_self_check" CHECK ("parentId" IS DISTINCT FROM id AND version>0);
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_copy_self_check" CHECK ("duplicatedFromId" IS DISTINCT FROM id);
CREATE FUNCTION inkwell_plot_group_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PlotGroup"%ROWTYPE;
BEGIN
 IF TG_OP='UPDATE' AND (NEW.id,NEW."workspaceId",NEW."projectId",NEW."storyId") IS DISTINCT FROM (OLD.id,OLD."workspaceId",OLD."projectId",OLD."storyId") THEN RAISE EXCEPTION 'Group identity is immutable' USING ERRCODE='23514'; END IF;
 -- Serializes concurrent reparent/archive operations before cross-row inspection.
 PERFORM 1 FROM "Story" WHERE id=NEW."storyId" AND "projectId"=NEW."projectId" AND "workspaceId"=NEW."workspaceId" FOR UPDATE;
 IF NEW."parentId" IS NOT NULL THEN
  SELECT * INTO p FROM "PlotGroup" WHERE id=NEW."parentId" AND "storyId"=NEW."storyId" AND "projectId"=NEW."projectId" AND "workspaceId"=NEW."workspaceId";
  IF p.id IS NULL THEN RAISE EXCEPTION 'Invalid parent' USING ERRCODE='23503'; END IF;
  IF p."parentId" IS NOT NULL OR p.id=NEW.id OR EXISTS(SELECT 1 FROM "PlotGroup" WHERE "parentId"=NEW.id AND "workspaceId"=NEW."workspaceId" AND "projectId"=NEW."projectId" AND "storyId"=NEW."storyId") THEN RAISE EXCEPTION 'Groups allow only root and child levels' USING ERRCODE='23514'; END IF;
  IF NEW."archivedAt" IS NULL AND p."archivedAt" IS NOT NULL THEN RAISE EXCEPTION 'Restore parent first' USING ERRCODE='23514'; END IF;
 END IF;
 IF NEW."archivedAt" IS NOT NULL AND (EXISTS(SELECT 1 FROM "PlotGroup" WHERE "parentId"=NEW.id AND "workspaceId"=NEW."workspaceId" AND "projectId"=NEW."projectId" AND "storyId"=NEW."storyId" AND "archivedAt" IS NULL) OR EXISTS(SELECT 1 FROM "Scene" WHERE "groupId"=NEW.id AND "workspaceId"=NEW."workspaceId" AND "projectId"=NEW."projectId" AND "storyId"=NEW."storyId" AND "archivedAt" IS NULL)) THEN RAISE EXCEPTION 'Move or archive active children first' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "PlotGroup_tree_guard" BEFORE INSERT OR UPDATE ON "PlotGroup" FOR EACH ROW EXECUTE FUNCTION inkwell_plot_group_guard();
CREATE FUNCTION inkwell_plot_scene_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.id,NEW."workspaceId",NEW."projectId",NEW."storyId",NEW."duplicatedFromId") IS DISTINCT FROM (OLD.id,OLD."workspaceId",OLD."projectId",OLD."storyId",OLD."duplicatedFromId") THEN RAISE EXCEPTION 'Scene identity/provenance is immutable' USING ERRCODE='23514'; END IF;
 IF NEW."groupId" IS NOT NULL AND NEW."archivedAt" IS NULL THEN
  PERFORM 1 FROM "Story" WHERE id=NEW."storyId" AND "projectId"=NEW."projectId" AND "workspaceId"=NEW."workspaceId" FOR UPDATE;
  IF NOT EXISTS(SELECT 1 FROM "PlotGroup" WHERE id=NEW."groupId" AND "storyId"=NEW."storyId" AND "projectId"=NEW."projectId" AND "workspaceId"=NEW."workspaceId" AND "archivedAt" IS NULL) THEN RAISE EXCEPTION 'Invalid active group' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "Scene_plot_scope_guard" BEFORE INSERT OR UPDATE ON "Scene" FOR EACH ROW EXECUTE FUNCTION inkwell_plot_scene_guard();
CREATE FUNCTION inkwell_scene_canon_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected "CanonKind";
BEGIN
 expected=CASE TG_TABLE_NAME WHEN 'SceneCharacterLink' THEN 'CHARACTER'::"CanonKind" ELSE 'LOCATION'::"CanonKind" END;
 IF NOT EXISTS(SELECT 1 FROM "Character" WHERE id=NEW."canonId" AND "projectId"=NEW."projectId" AND "workspaceId"=NEW."workspaceId" AND kind=expected AND (scope='SHARED' OR "storyId"=NEW."storyId")) THEN RAISE EXCEPTION 'Invalid scene canon type or scope' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "SceneCharacterLink_type_guard" BEFORE INSERT OR UPDATE ON "SceneCharacterLink" FOR EACH ROW EXECUTE FUNCTION inkwell_scene_canon_guard();
CREATE TRIGGER "SceneLocationLink_type_guard" BEFORE INSERT OR UPDATE ON "SceneLocationLink" FOR EACH ROW EXECUTE FUNCTION inkwell_scene_canon_guard();
