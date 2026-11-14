# Inkwell v0.6 release candidate

Code approval and production authorization are separate. Phase 0–6 are merged; Phase 7 prepares a reviewed candidate. No hosted staging, production migration, deployment, DNS change or backup job has been activated.

## Concrete proposed staging action

After explicit owner approval and restoration of authorized infrastructure access, create one Inkwell Coolify project and a staging environment, after rechecking that neither already exists. Deploy only the final approved release commit/image. The proposal uses `deploy/compose.release.yaml` with separate staging-only values from `deploy/staging.env.example`: one app (768 MiB/0.75 CPU), PostgreSQL 17 (512 MiB/0.5 CPU) and Garage 2.5.0 (384 MiB/0.25 CPU), each with dedicated volumes. Limits are a proposed starting allocation, not measured capacity guarantees. Recheck owner-VPS headroom and unrelated service health first.

The app binds only to host loopback port 3306. Preview through an authorized SSH tunnel, with no public DNS or staging exposure. Use a staging origin matching that tunnel, or separately approve an access-controlled HTTPS hostname and proxy configuration. Production is a distinct Coolify environment, volume/credential namespace and approval, with proposed loopback port 3307; do not activate it as part of staging.

Garage's S3/admin/RPC listeners are private loopback within the app network namespace, using a protected per-environment copy of `garage.toml.example`. No S3 port is published. Initialize the one-node layout/private bucket and a read/write runtime key without owner/bucket-creation privileges. App recreation also requires recreation of Garage's network attachment. Snapshot creation can remain unavailable until storage initialization completes; no share can become READY without verification. Rehearse this lifecycle in approved staging. This profile does not provide multi-replica availability or off-host backups.

The Compose app environment is explicitly whitelisted; SQL-owner, Garage-admin and backup keys are not passed to it. Supply a dedicated `inkwell_staging_runtime_login` and separate migration owner. Apply the reviewed `runtime-grants.sql` with a securely created role/login; confirm it is not superuser/database owner, cannot create/drop schema, delete core creative rows or read `_prisma_migrations`. Apply grants after each reviewed migration as needed; future tables get no automatic runtime grant. Backup access is separate and read-only.

## Pre-deployment and migration gate

- Verify the approved PR head/merge and all five required CI checks. Select an immutable image digest built from that exact release; never a mutable latest tag or feature branch. Record build provenance, commit and image digest together. No deployment workflow holds production secrets or automatically promotes main.
- Populate the private environment through Coolify. `pnpm release:check` validates configuration without printing values or deploying; `pnpm release:compose-check` validates only synthetic Compose syntax. Neither proves connectivity, grants, TLS or approval.
- Verify real SMTP TLS/auth, a permitted sender and delivery of registration, verification and recovery messages to the owner. Mailpit remains local/CI. Coolify is a control plane, not proof that an underlying delivery service is configured.
- Verify trusted proxy header stripping before setting TRUST_PROXY=true. Test spoofed client forwarding headers, secure cookies, origin/CSRF, private cache headers and read-only share revocation. With loopback staging and no proxy, retain TRUST_PROXY=false. Configure HTTPS/HSTS for an owned public hostname without changing unrelated domains.
- Review all eight existing migration files against a fresh and restored database, including integrity/search triggers and backfills. Phase 7 adds no application schema migration. Run migrations with the owner/migration identity in a separately approved job; the runtime cannot migrate. Measure locking/disk/backfill cost on staging. Production migration requires a named backup/recovery plan and explicit authorization.
- Complete [protected backup restoration](BACKUP_RESTORE.md), including off-host recovery, separate keys and approved retention. The local encrypted restore is necessary evidence, not proof of hosted disaster recovery.

## Staging acceptance and production decision

Exercise account verification/recovery, cross-account isolation, project/story CRUD, Idea Vault capture/conversion, shared/story canon overrides, atomic Plot ordering, authorized search, autosave conflicts/device recovery, JSON round trips and selected snapshot sharing/download/revocation. Recheck mobile/keyboard/200% text/400%-equivalent reflow, actual PWA installation in the owner's browser, and supported accessibility semantics. Automated Chromium checks do not certify Safari, VoiceOver or NVDA.

Repeat the approved 10,000-record warm search gate on the VPS and record the measurement separately from local results. Review database, app and storage health, resource pressure, bounded redacted logs and the effect on unrelated projects. Use only synthetic staging content until privacy/backup controls are verified. Record actual failures, skipped checks and owner staging acceptance in issue #38.

For production, present the exact immutable image, private environment resources, owned hostname/DNS/TLS change (if any), migration SQL, verified backup/restore result and rollback plan. Obtain separate explicit owner authorization before executing production provisioning/migrations/deployment or public DNS changes. Promote only that approved release. If verification fails, stop promotion; preserve data and choose a rehearsed compatible rollback or newly authorized restore. Never automatically drop data, rewrite main, bypass protections or revive old sharing/session capabilities.

## Remaining operational gates

Infrastructure access, Inkwell-scoped Coolify resources, actual image digest, off-host destination/key recovery, SMTP delivery, proxy/TLS, VPS measurements, migration rehearsal and staging acceptance must be observed. The authorized Mac connection went offline during Phase 7 discovery; do not claim its underlying Coolify backup/email configuration was inspected successfully. No production release is complete until these gates and separate owner authorization are recorded.
