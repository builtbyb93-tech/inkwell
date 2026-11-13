-- CreateEnum
CREATE TYPE "CanonKind" AS ENUM ('CHARACTER', 'LOCATION', 'LORE', 'EVENT', 'ORGANIZATION');

-- CreateEnum
CREATE TYPE "CanonScope" AS ENUM ('SHARED', 'STORY');

-- CreateEnum
CREATE TYPE "CanonRelationshipKind" AS ENUM ('RELATED', 'KNOWS', 'MEMBER_OF', 'LOCATED_IN', 'PART_OF', 'PRECEDES');

-- AlterTable
ALTER TABLE "Character" ADD COLUMN     "kind" "CanonKind" NOT NULL DEFAULT 'CHARACTER',
ADD COLUMN     "scope" "CanonScope" NOT NULL DEFAULT 'SHARED',
ADD COLUMN     "storyId" UUID;

-- CreateTable
CREATE TABLE "CanonOverride" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "storyId" UUID NOT NULL,
    "canonId" UUID NOT NULL,
    "hasName" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT,
    "hasContent" BOOLEAN NOT NULL DEFAULT false,
    "contentText" TEXT,
    "content" JSONB,
    "contentSchemaVersion" INTEGER NOT NULL DEFAULT 1,
    "baseVersion" INTEGER NOT NULL,
    "baseName" TEXT NOT NULL,
    "baseContent" JSONB NOT NULL,
    "baseContentSchemaVersion" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CanonOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanonRelationship" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "storyId" UUID,
    "fromId" UUID NOT NULL,
    "toId" UUID NOT NULL,
    "kind" "CanonRelationshipKind" NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CanonRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CanonOverride_workspaceId_projectId_storyId_idx" ON "CanonOverride"("workspaceId", "projectId", "storyId");

-- CreateIndex
CREATE UNIQUE INDEX "CanonOverride_canonId_storyId_key" ON "CanonOverride"("canonId", "storyId");

-- CreateIndex
CREATE INDEX "CanonRelationship_workspaceId_projectId_fromId_archivedAt_c_idx" ON "CanonRelationship"("workspaceId", "projectId", "fromId", "archivedAt", "createdAt", "id");

-- CreateIndex
CREATE INDEX "CanonRelationship_workspaceId_projectId_toId_archivedAt_cre_idx" ON "CanonRelationship"("workspaceId", "projectId", "toId", "archivedAt", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "CanonRelationship_storyId_fromId_toId_kind_key" ON "CanonRelationship"("storyId", "fromId", "toId", "kind");

-- CreateIndex
CREATE INDEX "Character_workspaceId_projectId_scope_storyId_kind_archived_idx" ON "Character"("workspaceId", "projectId", "scope", "storyId", "kind", "archivedAt");

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_storyId_projectId_workspaceId_fkey" FOREIGN KEY ("storyId", "projectId", "workspaceId") REFERENCES "Story"("id", "projectId", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanonOverride" ADD CONSTRAINT "CanonOverride_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanonOverride" ADD CONSTRAINT "CanonOverride_projectId_workspaceId_fkey" FOREIGN KEY ("projectId", "workspaceId") REFERENCES "Project"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanonOverride" ADD CONSTRAINT "CanonOverride_storyId_projectId_workspaceId_fkey" FOREIGN KEY ("storyId", "projectId", "workspaceId") REFERENCES "Story"("id", "projectId", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanonOverride" ADD CONSTRAINT "CanonOverride_canonId_projectId_workspaceId_fkey" FOREIGN KEY ("canonId", "projectId", "workspaceId") REFERENCES "Character"("id", "projectId", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanonRelationship" ADD CONSTRAINT "CanonRelationship_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanonRelationship" ADD CONSTRAINT "CanonRelationship_projectId_workspaceId_fkey" FOREIGN KEY ("projectId", "workspaceId") REFERENCES "Project"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanonRelationship" ADD CONSTRAINT "CanonRelationship_storyId_projectId_workspaceId_fkey" FOREIGN KEY ("storyId", "projectId", "workspaceId") REFERENCES "Story"("id", "projectId", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanonRelationship" ADD CONSTRAINT "CanonRelationship_fromId_projectId_workspaceId_fkey" FOREIGN KEY ("fromId", "projectId", "workspaceId") REFERENCES "Character"("id", "projectId", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanonRelationship" ADD CONSTRAINT "CanonRelationship_toId_projectId_workspaceId_fkey" FOREIGN KEY ("toId", "projectId", "workspaceId") REFERENCES "Character"("id", "projectId", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- These checks/triggers and the shared partial index are migration-owned.
ALTER TABLE "Character" ADD CONSTRAINT "Canon_scope_check" CHECK ((scope='SHARED' AND "storyId" IS NULL) OR (scope='STORY' AND "storyId" IS NOT NULL));
ALTER TABLE "CanonOverride" ADD CONSTRAINT "CanonOverride_presence_check" CHECK (("hasName" OR name IS NULL) AND ("hasContent" OR (content IS NULL AND "contentText" IS NULL)) AND "baseVersion">0 AND version>0);
ALTER TABLE "CanonRelationship" ADD CONSTRAINT "CanonRelationship_self_check" CHECK ("fromId"<>"toId" AND version>0);
CREATE UNIQUE INDEX "CanonRelationship_shared_key" ON "CanonRelationship"("fromId","toId",kind) WHERE "storyId" IS NULL;
CREATE FUNCTION inkwell_canon_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.id,NEW."workspaceId",NEW."projectId",NEW.scope,NEW.kind,NEW."storyId") IS DISTINCT FROM (OLD.id,OLD."workspaceId",OLD."projectId",OLD.scope,OLD.kind,OLD."storyId") THEN
 RAISE EXCEPTION 'Canon identity is immutable' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "Canon_identity_guard" BEFORE UPDATE ON "Character" FOR EACH ROW EXECUTE FUNCTION inkwell_canon_identity();
CREATE FUNCTION inkwell_canon_override() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.id,NEW."workspaceId",NEW."projectId",NEW."storyId",NEW."canonId") IS DISTINCT FROM (OLD.id,OLD."workspaceId",OLD."projectId",OLD."storyId",OLD."canonId") THEN RAISE EXCEPTION 'Override identity is immutable' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM "Character" WHERE id=NEW."canonId" AND "projectId"=NEW."projectId" AND "workspaceId"=NEW."workspaceId" AND scope='SHARED') THEN RAISE EXCEPTION 'Override needs shared canon' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "CanonOverride_scope_guard" BEFORE INSERT OR UPDATE ON "CanonOverride" FOR EACH ROW EXECUTE FUNCTION inkwell_canon_override();
CREATE FUNCTION inkwell_canon_conversion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."targetCharacterId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "Character" WHERE id=NEW."targetCharacterId" AND "projectId"=NEW."projectId" AND "workspaceId"=NEW."workspaceId" AND scope='SHARED' AND kind='CHARACTER') THEN RAISE EXCEPTION 'Conversion requires shared character' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "IdeaConversion_character_guard" BEFORE INSERT OR UPDATE ON "IdeaConversion" FOR EACH ROW EXECUTE FUNCTION inkwell_canon_conversion();
CREATE FUNCTION inkwell_canon_relationship() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a "Character"%ROWTYPE; b "Character"%ROWTYPE; valid boolean;
BEGIN
 IF TG_OP='UPDATE' AND (NEW.id,NEW."workspaceId",NEW."projectId",NEW."storyId",NEW."fromId",NEW."toId",NEW.kind) IS DISTINCT FROM (OLD.id,OLD."workspaceId",OLD."projectId",OLD."storyId",OLD."fromId",OLD."toId",OLD.kind) THEN RAISE EXCEPTION 'Relationship identity is immutable' USING ERRCODE='23514'; END IF;
 SELECT * INTO a FROM "Character" WHERE id=NEW."fromId" AND "projectId"=NEW."projectId" AND "workspaceId"=NEW."workspaceId";
 SELECT * INTO b FROM "Character" WHERE id=NEW."toId" AND "projectId"=NEW."projectId" AND "workspaceId"=NEW."workspaceId";
 IF a.id IS NULL OR b.id IS NULL THEN RAISE EXCEPTION 'Invalid canon endpoints' USING ERRCODE='23503'; END IF;
 IF (NEW."storyId" IS NULL AND (a.scope<>'SHARED' OR b.scope<>'SHARED')) OR (NEW."storyId" IS NOT NULL AND ((a.scope='STORY' AND a."storyId"<>NEW."storyId") OR (b.scope='STORY' AND b."storyId"<>NEW."storyId"))) THEN RAISE EXCEPTION 'Invalid relationship story scope' USING ERRCODE='23514'; END IF;
 valid=CASE NEW.kind
 WHEN 'RELATED' THEN true
 WHEN 'KNOWS' THEN a.kind='CHARACTER' AND b.kind='CHARACTER'
 WHEN 'MEMBER_OF' THEN a.kind IN ('CHARACTER','ORGANIZATION') AND b.kind='ORGANIZATION'
 WHEN 'LOCATED_IN' THEN a.kind IN ('CHARACTER','EVENT','ORGANIZATION') AND b.kind='LOCATION'
 WHEN 'PART_OF' THEN a.kind=b.kind AND a.kind IN ('LOCATION','ORGANIZATION','EVENT','LORE')
 WHEN 'PRECEDES' THEN a.kind='EVENT' AND b.kind='EVENT'
 ELSE false END;
 IF NOT valid THEN RAISE EXCEPTION 'Invalid typed relationship' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "CanonRelationship_type_guard" BEFORE INSERT OR UPDATE ON "CanonRelationship" FOR EACH ROW EXECUTE FUNCTION inkwell_canon_relationship();
