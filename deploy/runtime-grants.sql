-- Review/apply only inside the approved dedicated Inkwell database, using its
-- migration owner. Supply psql --set=runtime_role=<dedicated NOLOGIN role>.
-- Create the separate login/group securely first; never place passwords here.
-- No default grants: each later migration must review its runtime needs.
BEGIN;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO :"runtime_role";
GRANT SELECT, INSERT, UPDATE ON
  "User", "Workspace", "AuthToken", "AuthSession", "RateLimitBucket",
  "Project", "Story", "Idea", "IdeaCategory", "IdeaTag", "IdeaTagAssignment",
  "IdeaStoryLink", "IdeaSceneLink", "IdeaConversion", "Character", "Scene",
  "CanonOverride", "CanonRelationship", "PlotGroup", "SceneCharacterLink",
  "SceneLocationLink", "SaveReceipt", "Snapshot", "ShareLink"
TO :"runtime_role";
GRANT DELETE ON "RateLimitBucket", "IdeaTagAssignment", "IdeaStoryLink",
  "IdeaSceneLink", "SceneCharacterLink", "SceneLocationLink" TO :"runtime_role";
REVOKE ALL ON "_prisma_migrations" FROM :"runtime_role";
COMMIT;
