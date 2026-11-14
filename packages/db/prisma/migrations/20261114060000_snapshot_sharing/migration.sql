-- CreateEnum
CREATE TYPE "SnapshotStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "Snapshot" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "storyId" UUID,
    "title" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "recordCount" INTEGER NOT NULL,
    "payloadVersion" INTEGER NOT NULL DEFAULT 1,
    "status" "SnapshotStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareLink" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "snapshotId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "allowDownload" BOOLEAN NOT NULL DEFAULT false,
    "revokedAt" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Snapshot_objectKey_key" ON "Snapshot"("objectKey");

-- CreateIndex
CREATE INDEX "Snapshot_workspaceId_projectId_status_createdAt_id_idx" ON "Snapshot"("workspaceId", "projectId", "status", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Snapshot_id_workspaceId_key" ON "Snapshot"("id", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "ShareLink_tokenHash_key" ON "ShareLink"("tokenHash");

-- CreateIndex
CREATE INDEX "ShareLink_workspaceId_snapshotId_createdAt_id_idx" ON "ShareLink"("workspaceId", "snapshotId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "ShareLink_expiresAt_idx" ON "ShareLink"("expiresAt");

-- AddForeignKey
ALTER TABLE "Snapshot" ADD CONSTRAINT "Snapshot_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Snapshot" ADD CONSTRAINT "Snapshot_projectId_workspaceId_fkey" FOREIGN KEY ("projectId", "workspaceId") REFERENCES "Project"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Snapshot" ADD CONSTRAINT "Snapshot_storyId_projectId_workspaceId_fkey" FOREIGN KEY ("storyId", "projectId", "workspaceId") REFERENCES "Story"("id", "projectId", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_snapshotId_workspaceId_fkey" FOREIGN KEY ("snapshotId", "workspaceId") REFERENCES "Snapshot"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Immutable payload identity; only PENDING can transition to READY or FAILED.
ALTER TABLE "Snapshot" ADD CONSTRAINT "Snapshot_payload_check" CHECK ("contentHash" ~ '^[a-f0-9]{64}$' AND "byteSize">0 AND "byteSize"<=8388608 AND "recordCount">0 AND "recordCount"<=1000 AND "payloadVersion"=1 AND "objectKey"='workspaces/'||"workspaceId"::text||'/snapshots/'||id::text||'.json');
CREATE FUNCTION inkwell_snapshot_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.id,NEW."workspaceId",NEW."projectId",NEW."storyId",NEW.title,NEW."objectKey",NEW."contentHash",NEW."byteSize",NEW."recordCount",NEW."payloadVersion",NEW."createdAt") IS DISTINCT FROM (OLD.id,OLD."workspaceId",OLD."projectId",OLD."storyId",OLD.title,OLD."objectKey",OLD."contentHash",OLD."byteSize",OLD."recordCount",OLD."payloadVersion",OLD."createdAt") THEN RAISE EXCEPTION 'Snapshot payload identity is immutable' USING ERRCODE='23514'; END IF;
 IF NEW.status<>OLD.status AND NOT (OLD.status='PENDING' AND NEW.status IN ('READY','FAILED')) THEN RAISE EXCEPTION 'Invalid snapshot transition' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "Snapshot_immutable_guard" BEFORE UPDATE ON "Snapshot" FOR EACH ROW EXECUTE FUNCTION inkwell_snapshot_guard();
ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_policy_check" CHECK ("tokenHash" ~ '^[a-f0-9]{64}$' AND "expiresAt">"createdAt" AND version>0);
CREATE FUNCTION inkwell_share_link_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND ((NEW.id,NEW."workspaceId",NEW."snapshotId",NEW."tokenHash",NEW."expiresAt",NEW."allowDownload",NEW."createdAt") IS DISTINCT FROM (OLD.id,OLD."workspaceId",OLD."snapshotId",OLD."tokenHash",OLD."expiresAt",OLD."allowDownload",OLD."createdAt") OR (OLD."revokedAt" IS NOT NULL AND NEW."revokedAt" IS DISTINCT FROM OLD."revokedAt")) THEN RAISE EXCEPTION 'Share policy is immutable and revocation is terminal' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM "Snapshot" WHERE id=NEW."snapshotId" AND "workspaceId"=NEW."workspaceId" AND status='READY') THEN RAISE EXCEPTION 'Only ready snapshots can be shared' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "ShareLink_policy_guard" BEFORE INSERT OR UPDATE ON "ShareLink" FOR EACH ROW EXECUTE FUNCTION inkwell_share_link_guard();
