-- Separate protected backup identity. Review/apply only to the approved
-- dedicated database. Supply psql --set=backup_role=<dedicated NOLOGIN role>.
-- This identity can read private data: restrict network/login and encrypt all
-- dumps. It cannot migrate schema or update story content.
BEGIN;
GRANT USAGE ON SCHEMA public TO :"backup_role";
GRANT SELECT ON ALL TABLES IN SCHEMA public TO :"backup_role";
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO :"backup_role";
COMMIT;
