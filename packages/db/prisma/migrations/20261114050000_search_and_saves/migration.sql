-- AlterTable
ALTER TABLE "CanonOverride" ADD COLUMN     "effectiveName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "effectiveText" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "SaveReceipt" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "targetKey" TEXT NOT NULL,
    "requestKey" UUID NOT NULL,
    "requestHash" TEXT NOT NULL,
    "appliedVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SaveReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SaveReceipt_workspaceId_targetKey_key" ON "SaveReceipt"("workspaceId", "targetKey");

-- CreateIndex
CREATE UNIQUE INDEX "SaveReceipt_workspaceId_requestKey_key" ON "SaveReceipt"("workspaceId", "requestKey");

-- AddForeignKey
ALTER TABLE "SaveReceipt" ADD CONSTRAINT "SaveReceipt_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Migration-owned generated search document and GIN index.
ALTER TABLE "Project" ADD COLUMN "searchVector" tsvector GENERATED ALWAYS AS (setweight(to_tsvector('simple'::regconfig,coalesce("title",'')),'A') || setweight(to_tsvector('simple'::regconfig,coalesce("description",'')),'B')) STORED;
CREATE INDEX "Project_search_gin" ON "Project" USING GIN ("searchVector");

-- Migration-owned generated search document and GIN index.
ALTER TABLE "Story" ADD COLUMN "searchVector" tsvector GENERATED ALWAYS AS (setweight(to_tsvector('simple'::regconfig,coalesce("title",'')),'A') || setweight(to_tsvector('simple'::regconfig,coalesce("synopsis",'')),'B')) STORED;
CREATE INDEX "Story_search_gin" ON "Story" USING GIN ("searchVector");

-- Migration-owned generated search document and GIN index.
ALTER TABLE "Character" ADD COLUMN "searchVector" tsvector GENERATED ALWAYS AS (setweight(to_tsvector('simple'::regconfig,coalesce("name",'')),'A') || setweight(to_tsvector('simple'::regconfig,coalesce("contentText",'')),'B')) STORED;
CREATE INDEX "Character_search_gin" ON "Character" USING GIN ("searchVector");

-- Migration-owned generated search document and GIN index.
ALTER TABLE "Scene" ADD COLUMN "searchVector" tsvector GENERATED ALWAYS AS (setweight(to_tsvector('simple'::regconfig,coalesce("title",'')),'A') || setweight(to_tsvector('simple'::regconfig,coalesce("contentText",'')),'B')) STORED;
CREATE INDEX "Scene_search_gin" ON "Scene" USING GIN ("searchVector");

-- Migration-owned generated search document and GIN index.
ALTER TABLE "PlotGroup" ADD COLUMN "searchVector" tsvector GENERATED ALWAYS AS (setweight(to_tsvector('simple'::regconfig,coalesce("title",'')),'A') || setweight(to_tsvector('simple'::regconfig,coalesce("description",'')),'B')) STORED;
CREATE INDEX "PlotGroup_search_gin" ON "PlotGroup" USING GIN ("searchVector");

-- Migration-owned generated search document and GIN index.
ALTER TABLE "CanonOverride" ADD COLUMN "searchVector" tsvector GENERATED ALWAYS AS (setweight(to_tsvector('simple'::regconfig,coalesce("effectiveName",'')),'A') || setweight(to_tsvector('simple'::regconfig,coalesce("effectiveText",'')),'B')) STORED;
CREATE INDEX "CanonOverride_search_gin" ON "CanonOverride" USING GIN ("searchVector");

-- Story overrides index effective fields, including inheritance and explicit clears.
CREATE FUNCTION inkwell_override_search() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE base "Character"%ROWTYPE;
BEGIN
 SELECT * INTO base FROM "Character" WHERE id=NEW."canonId" AND "projectId"=NEW."projectId" AND "workspaceId"=NEW."workspaceId";
 IF base.id IS NULL THEN RAISE EXCEPTION 'Invalid canon search source' USING ERRCODE='23503'; END IF;
 NEW."effectiveName"=CASE WHEN NEW."hasName" THEN coalesce(NEW.name,'') ELSE base.name END;
 NEW."effectiveText"=CASE WHEN NEW."hasContent" THEN coalesce(NEW."contentText",'') ELSE base."contentText" END;
 RETURN NEW;
END $$;
CREATE TRIGGER "CanonOverride_search_guard" BEFORE INSERT OR UPDATE ON "CanonOverride" FOR EACH ROW EXECUTE FUNCTION inkwell_override_search();
CREATE FUNCTION inkwell_shared_search_refresh() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 UPDATE "CanonOverride" SET "effectiveName"="effectiveName" WHERE "canonId"=NEW.id AND "projectId"=NEW."projectId" AND "workspaceId"=NEW."workspaceId";
 RETURN NEW;
END $$;
CREATE TRIGGER "Canon_shared_search_refresh" AFTER UPDATE OF name,"contentText" ON "Character" FOR EACH ROW WHEN (OLD.name IS DISTINCT FROM NEW.name OR OLD."contentText" IS DISTINCT FROM NEW."contentText") EXECUTE FUNCTION inkwell_shared_search_refresh();
UPDATE "CanonOverride" SET "effectiveName"="effectiveName";
ALTER TABLE "SaveReceipt" ADD CONSTRAINT "SaveReceipt_version_check" CHECK ("appliedVersion">0 AND length("requestHash")=64 AND length("targetKey")<=300);
