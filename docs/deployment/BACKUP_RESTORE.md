# Protected backup and restore

The owner approved 30 daily backups. Nothing here activates a hosted schedule, creates a destination or deletes a backup. Coolify is the chosen control plane; its configured off-host destination and SMTP have not yet been verified for Inkwell.

## Verified local rehearsal

`pnpm test:backup` creates a separate disposable database, migrates it, writes synthetic story content and a private frozen snapshot, and exercises the real PostgreSQL/S3 backup/restore path. It verifies content/relationships and object checksums, source independence and invalidation of restored sessions, recovery tokens and share links. It rejects a wrong key, existing database and nonempty storage destination. The test owns and removes only its generated resources. It runs separately from the main SQL suite so other tests' fixture cleanup cannot invalidate a whole-database backup.

For operator-owned local development only, configure the isolated `.env` and generate a 32-byte key directly into a mode-0600 file outside source. Set `INKWELL_BACKUP_KEY_FILE` to that path without printing its bytes. `pnpm backup:local create` writes an encrypted `.iwb` under ignored `.local/backups` and never replaces an existing file. The key is not embedded in the archive and must be independently recoverable. `pnpm backup:local retention-plan` prints the keep/candidate lists for 30 successful UTC dates and never applies deletion.

`pnpm backup:local restore <archive>` authenticates/decrypts a trusted archive before creating a new UUID-named local database. Configure a different, empty local test bucket with a scoped credential first; using the source bucket is rejected. A failed restore can leave its isolated target for inspection; it is never published or substituted for the source. Cleanup of such a target must identify the generated database/bucket explicitly. This CLI refuses remote database/object endpoints and is a rehearsal tool, not a claim of hosted automation.

## Required hosted activation evidence

1. Identify an owner-controlled off-host S3-compatible destination through Coolify. It must survive loss of the application VPS; a volume on that VPS is insufficient. Use dedicated backup credentials and no anonymous access. Confirm encryption, access auditing, available capacity and recovery of the separate key.
2. Review the actual release/database migration and backup job before provisioning. Use PostgreSQL 17 tooling and a separate read-only backup identity (`deploy/backup-grants.sql`). Match database and object identities using one exported SQL snapshot, then verify every referenced object. Do not copy only the live database volume or only Garage's live data directory.
3. Use protected tmpfs/encrypted scratch space for plaintext SQL/extraction. Give only the backup operator access; do not pass backup or database-owner keys to the web app. Remove interrupted private scratch directories through an explicit operator procedure.
4. Upload only complete authenticated archives, verify upload/download checksums, and demonstrate full restoration to a separate isolated SQL/storage environment. Test loss of the original VPS and wrong/corrupted keys. Check ownership, canon overrides, links, ordering and source-independent snapshots, and invalidate all restored capabilities before exposure.
5. Prove destination access controls and a dry-run plan for 30 successful UTC backup dates. Activate the daily job and any retention deletion only after the concrete hosted job/destination is approved. Unknown files are not pruning candidates. Do not delete the only verified restore point.
6. Record measured backup/restore duration, archive size, recovery point and recovery time. No RPO/RTO or hosted performance figure is invented by the local rehearsal. Repeat the restore after material schema/storage changes.

For production recovery, owner approval must identify the immutable release, backup, new target resources and promotion/rollback steps. Stop writes, preserve the failed environment, restore to a new target, rotate credentials, invalidate capabilities and verify critical journeys before changing traffic. Never run the local test tooling against production or drop populated creative tables as an application rollback.
