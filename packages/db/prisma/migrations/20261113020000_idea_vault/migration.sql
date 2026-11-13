-- CreateEnum
CREATE TYPE "IdeaConversionKind" AS ENUM ('STORY', 'CHARACTER', 'SCENE');

-- AlterTable
ALTER TABLE "Story" ADD COLUMN     "sequenceVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "IdeaCategory" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "IdeaCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdeaTag" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "IdeaTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Idea" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "contentText" TEXT NOT NULL,
    "searchVector" tsvector GENERATED ALWAYS AS (
      setweight(to_tsvector('simple'::regconfig, coalesce("title", '')), 'A') ||
      setweight(to_tsvector('simple'::regconfig, coalesce("contentText", '')), 'B')
    ) STORED NOT NULL,
    "categoryId" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Idea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdeaTagAssignment" (
    "ideaId" UUID NOT NULL,
    "tagId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,

    CONSTRAINT "IdeaTagAssignment_pkey" PRIMARY KEY ("ideaId","tagId")
);

-- CreateTable
CREATE TABLE "Character" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "contentText" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scene" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "storyId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "contentText" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Scene_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdeaStoryLink" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "ideaId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "storyId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdeaStoryLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdeaSceneLink" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "ideaId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "storyId" UUID NOT NULL,
    "sceneId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdeaSceneLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdeaConversion" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "requestKey" UUID NOT NULL,
    "requestHash" TEXT NOT NULL,
    "ideaId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "parentStoryId" UUID,
    "targetStoryId" UUID,
    "targetCharacterId" UUID,
    "targetSceneId" UUID,
    "kind" "IdeaConversionKind" NOT NULL,
    "sourceVersion" INTEGER NOT NULL,
    "titleSnapshot" TEXT NOT NULL,
    "contentSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdeaConversion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IdeaCategory_workspaceId_createdAt_id_idx" ON "IdeaCategory"("workspaceId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "IdeaCategory_id_workspaceId_key" ON "IdeaCategory"("id", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "IdeaCategory_workspaceId_nameKey_key" ON "IdeaCategory"("workspaceId", "nameKey");

-- CreateIndex
CREATE INDEX "IdeaTag_workspaceId_createdAt_id_idx" ON "IdeaTag"("workspaceId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "IdeaTag_id_workspaceId_key" ON "IdeaTag"("id", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "IdeaTag_workspaceId_nameKey_key" ON "IdeaTag"("workspaceId", "nameKey");

-- CreateIndex
CREATE INDEX "Idea_workspaceId_archivedAt_createdAt_id_idx" ON "Idea"("workspaceId", "archivedAt", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Idea_workspaceId_categoryId_idx" ON "Idea"("workspaceId", "categoryId");

-- CreateIndex
CREATE INDEX "Idea_searchVector_idx" ON "Idea" USING GIN ("searchVector");

-- CreateIndex
CREATE UNIQUE INDEX "Idea_id_workspaceId_key" ON "Idea"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "IdeaTagAssignment_workspaceId_tagId_ideaId_idx" ON "IdeaTagAssignment"("workspaceId", "tagId", "ideaId");

-- CreateIndex
CREATE INDEX "Character_workspaceId_projectId_archivedAt_createdAt_id_idx" ON "Character"("workspaceId", "projectId", "archivedAt", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Character_id_projectId_workspaceId_key" ON "Character"("id", "projectId", "workspaceId");

-- CreateIndex
CREATE INDEX "Scene_workspaceId_projectId_storyId_archivedAt_createdAt_id_idx" ON "Scene"("workspaceId", "projectId", "storyId", "archivedAt", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Scene_id_storyId_projectId_workspaceId_key" ON "Scene"("id", "storyId", "projectId", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Scene_storyId_position_key" ON "Scene"("storyId", "position");

-- CreateIndex
CREATE INDEX "IdeaStoryLink_workspaceId_storyId_idx" ON "IdeaStoryLink"("workspaceId", "storyId");

-- CreateIndex
CREATE INDEX "IdeaStoryLink_ideaId_createdAt_id_idx" ON "IdeaStoryLink"("ideaId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "IdeaStoryLink_ideaId_storyId_key" ON "IdeaStoryLink"("ideaId", "storyId");

-- CreateIndex
CREATE INDEX "IdeaSceneLink_workspaceId_sceneId_idx" ON "IdeaSceneLink"("workspaceId", "sceneId");

-- CreateIndex
CREATE INDEX "IdeaSceneLink_ideaId_createdAt_id_idx" ON "IdeaSceneLink"("ideaId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "IdeaSceneLink_ideaId_sceneId_key" ON "IdeaSceneLink"("ideaId", "sceneId");

-- CreateIndex
CREATE INDEX "IdeaConversion_ideaId_createdAt_id_idx" ON "IdeaConversion"("ideaId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "IdeaConversion_workspaceId_targetStoryId_idx" ON "IdeaConversion"("workspaceId", "targetStoryId");

-- CreateIndex
CREATE INDEX "IdeaConversion_workspaceId_targetCharacterId_idx" ON "IdeaConversion"("workspaceId", "targetCharacterId");

-- CreateIndex
CREATE INDEX "IdeaConversion_workspaceId_targetSceneId_idx" ON "IdeaConversion"("workspaceId", "targetSceneId");

-- CreateIndex
CREATE INDEX "IdeaConversion_workspaceId_parentStoryId_idx" ON "IdeaConversion"("workspaceId", "parentStoryId");

-- CreateIndex
CREATE INDEX "IdeaConversion_projectId_workspaceId_idx" ON "IdeaConversion"("projectId", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "IdeaConversion_workspaceId_requestKey_key" ON "IdeaConversion"("workspaceId", "requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "Story_id_projectId_workspaceId_key" ON "Story"("id", "projectId", "workspaceId");

-- AddForeignKey
ALTER TABLE "IdeaCategory" ADD CONSTRAINT "IdeaCategory_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeaTag" ADD CONSTRAINT "IdeaTag_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Idea" ADD CONSTRAINT "Idea_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Idea" ADD CONSTRAINT "Idea_categoryId_workspaceId_fkey" FOREIGN KEY ("categoryId", "workspaceId") REFERENCES "IdeaCategory"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeaTagAssignment" ADD CONSTRAINT "IdeaTagAssignment_ideaId_workspaceId_fkey" FOREIGN KEY ("ideaId", "workspaceId") REFERENCES "Idea"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeaTagAssignment" ADD CONSTRAINT "IdeaTagAssignment_tagId_workspaceId_fkey" FOREIGN KEY ("tagId", "workspaceId") REFERENCES "IdeaTag"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_projectId_workspaceId_fkey" FOREIGN KEY ("projectId", "workspaceId") REFERENCES "Project"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_projectId_workspaceId_fkey" FOREIGN KEY ("projectId", "workspaceId") REFERENCES "Project"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_storyId_projectId_workspaceId_fkey" FOREIGN KEY ("storyId", "projectId", "workspaceId") REFERENCES "Story"("id", "projectId", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeaStoryLink" ADD CONSTRAINT "IdeaStoryLink_ideaId_workspaceId_fkey" FOREIGN KEY ("ideaId", "workspaceId") REFERENCES "Idea"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeaStoryLink" ADD CONSTRAINT "IdeaStoryLink_storyId_projectId_workspaceId_fkey" FOREIGN KEY ("storyId", "projectId", "workspaceId") REFERENCES "Story"("id", "projectId", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeaSceneLink" ADD CONSTRAINT "IdeaSceneLink_ideaId_workspaceId_fkey" FOREIGN KEY ("ideaId", "workspaceId") REFERENCES "Idea"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeaSceneLink" ADD CONSTRAINT "IdeaSceneLink_sceneId_storyId_projectId_workspaceId_fkey" FOREIGN KEY ("sceneId", "storyId", "projectId", "workspaceId") REFERENCES "Scene"("id", "storyId", "projectId", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeaConversion" ADD CONSTRAINT "IdeaConversion_ideaId_workspaceId_fkey" FOREIGN KEY ("ideaId", "workspaceId") REFERENCES "Idea"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeaConversion" ADD CONSTRAINT "IdeaConversion_projectId_workspaceId_fkey" FOREIGN KEY ("projectId", "workspaceId") REFERENCES "Project"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeaConversion" ADD CONSTRAINT "IdeaConversion_parentStoryId_projectId_workspaceId_fkey" FOREIGN KEY ("parentStoryId", "projectId", "workspaceId") REFERENCES "Story"("id", "projectId", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeaConversion" ADD CONSTRAINT "IdeaConversion_targetStoryId_projectId_workspaceId_fkey" FOREIGN KEY ("targetStoryId", "projectId", "workspaceId") REFERENCES "Story"("id", "projectId", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeaConversion" ADD CONSTRAINT "IdeaConversion_targetCharacterId_projectId_workspaceId_fkey" FOREIGN KEY ("targetCharacterId", "projectId", "workspaceId") REFERENCES "Character"("id", "projectId", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeaConversion" ADD CONSTRAINT "IdeaConversion_targetSceneId_parentStoryId_projectId_works_fkey" FOREIGN KEY ("targetSceneId", "parentStoryId", "projectId", "workspaceId") REFERENCES "Scene"("id", "storyId", "projectId", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Typed conversion targets must be complete and mutually exclusive; no unchecked type/id pairs.
ALTER TABLE "IdeaConversion" ADD CONSTRAINT "IdeaConversion_target_check" CHECK (
 ("kind"='STORY' AND "targetStoryId" IS NOT NULL AND "targetCharacterId" IS NULL AND "targetSceneId" IS NULL AND "parentStoryId" IS NULL) OR
 ("kind"='CHARACTER' AND "targetCharacterId" IS NOT NULL AND "targetStoryId" IS NULL AND "targetSceneId" IS NULL AND "parentStoryId" IS NULL) OR
 ("kind"='SCENE' AND "targetSceneId" IS NOT NULL AND "parentStoryId" IS NOT NULL AND "targetStoryId" IS NULL AND "targetCharacterId" IS NULL)
);
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_position_check" CHECK ("position">=0);
ALTER TABLE "Idea" ADD CONSTRAINT "Idea_version_check" CHECK ("version">0);
ALTER TABLE "IdeaConversion" ADD CONSTRAINT "IdeaConversion_sourceVersion_check" CHECK ("sourceVersion">0);
