-- AlterTable
ALTER TABLE "Idea" ADD COLUMN     "contentSchemaVersion" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Character" ADD COLUMN     "contentSchemaVersion" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Scene" ADD COLUMN     "contentSchemaVersion" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "IdeaConversion" ADD COLUMN     "sourceContentSchemaVersion" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "IdeaSceneLink_workspaceId_storyId_ideaId_idx" ON "IdeaSceneLink"("workspaceId", "storyId", "ideaId");

