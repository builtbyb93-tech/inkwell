# Coolify plan

## Verified pre-flight

Read-only SSH inspection on 2026-11-13 found healthy Coolify **4.7.5**, Docker **29.9.3**, one server, and three unrelated projects: Built By B93, MicroTrade AI, Useful Shortcuts. Existing environments are production. No Inkwell project, standalone PostgreSQL resource or S3 connection was found. Other containers include unrelated AI services; none belongs to Inkwell by assumption.

Observed host: 2 vCPUs, ~7.8 GiB RAM, ~4.4 GiB available, ~74 GiB free disk. This is a point-in-time inventory, not capacity certification. Do not alter existing services, shared databases, proxy, DNS, Coolify internals or credential records.

SSH inspection is available; scoped Coolify API/team deployment permissions are not verified. No provisioning or deployment is approved by Phase 0.

## Proposed hosted resources

After separate approval, create an Inkwell project with staging and production. Separate app settings, PostgreSQL instances/roles, private storage namespaces/credentials, networks, secrets and backup policies. Prefer separate resource boundaries rather than reusing unrelated services. On one VPS, CPU/disk/host failure remain shared risks; measure and set resource limits before production.

Protect staging with access controls. Only app HTTPS endpoints are public; DB/storage/admin ports stay private. Inkwell domains and public DNS changes need owner decisions. Storage choice remains ADR-002; do not provision it from this document.

## Artifacts and release

`deploy/Dockerfile` builds a non-root standalone Node runtime. It has liveness at `/api/v1/health`; readiness at `/api/v1/ready` requires DB connectivity. No startup migration and no deployment webhook is included. Production credentials are runtime-only; no secret build arguments.

Build/test immutable images in CI or an approved builder; avoid competing builds on this small shared VPS. Registry access/quota and image publication require verification before activation. Deploy an approved commit or digest manually. No feature-branch production deployment or automatic merge/deploy.

Before each hosted schema change: review SQL/data impact, backup status, lock duration, compatibility, restoration/forward-recovery steps and named release. Production execution needs explicit authorization. Use a separate migration identity/job; app credentials cannot migrate schema.

Release gates: acceptance evidence → reviewed PR → owner-approved merge → separately approved staging provisioning/deploy → staging validation → production migration/release approval. Record exact image/commit, health observations and rollback image. Code rollback cannot reverse arbitrary data changes.

## Backups and unresolved prerequisites

Choose encrypted protected off-host backup storage and retention with the owner. Back up both database and referenced assets; demonstrate restore in an isolated environment before production. No retention schedule, paid destination, public domain, SMTP provider or capacity target has been invented. Establish monitoring and redaction without sending private story content to third parties.

## Phase 1 configuration, not provisioning

Provide unique NEXTAUTH_SECRET (at least 32 characters), HTTPS NEXTAUTH_URL ending `/api/v1/auth`, dedicated DATABASE_URL, SMTP_HOST/PORT/FROM, and SMTP_USER/SMTP_PASSWORD where required. SMTP_SECURE selects implicit TLS; non-loopback delivery otherwise requires STARTTLS with certificate verification. Never reuse staging/production credentials. Configure the reverse proxy to strip incoming X-Forwarded-For before considering TRUST_PROXY=true; otherwise keep it false. CSP redirects and origin checks use configured public origin. Auth routes must not be cached. Health is dependency-independent; database readiness is not proof of SMTP deliverability or production authorization.

Mailpit is local/CI only; do not deploy its unauthenticated inbox publicly. No hosted mail resource, database, application, storage, DNS, proxy setting or production secret was created or changed in Phase 1. Staging remains access-controlled and separately approved. Production migration `20261113010000_accounts_projects` requires a reviewed backup/recovery plan and separate owner approval. Its additive schema is proven only on disposable/local databases so far. Runtime SQL credentials must not be the migration superuser.

## Phase 3 migration boundary

Story Bible adds migration `20261113030000_story_bible`, preserving legacy Character data/FKs and adding typed guards, override rows and relationship rows. Fresh and Phase 2 upgrade paths are exercised only in generated local databases. Before any hosted application: review the SQL, back up the approved environment, rehearse restore, choose an immutable release commit/image and use separate migration/runtime roles. Rollback requires an approved recovery plan that preserves any new canon/override/relationship data; do not drop tables or reverse the migration casually. No Coolify/VPS, DNS, staging visibility, storage, production migration or deployment change is authorized/performed by this milestone. Existing staging/production separation requirements remain.

## Phase 4 migration boundary

`20261113040000_plot_board` preserves existing scene IDs/content/positions/provenance and adds scoped groups, status/copy fields and typed scene links. Order uniqueness becomes deferred-capable; SQL triggers and that constraint are migration-owned. Fresh and pre-Plot upgrade paths are exercised only in disposable local databases. Before hosting: approved backup and restore rehearsal, SQL/locking review, release image/commit, separate migration/runtime roles and a recovery plan preserving new group/link/scene data. Reverting the app alone is not permission to drop data or casually remove guards. No Coolify/VPS, staging visibility, DNS, production schema or deployment change occurs in this milestone. Standing PR merge approval is not deployment authorization.

## Phase 5 migration and recovery considerations

No deployment, hosted migration or Coolify resource change occurred during Phase 5 implementation. Before approved staging rollout, back up and verify restoration of the preceding release/database; rehearse additive migration `20261114050000_search_and_saves` on an isolated restored copy. It builds generated vectors/GIN indexes and effective override backfill/triggers, so measure table locks, build time and disk headroom on actual data. Preserve migration-owned prior FTS, canon/type/tree guards and deferred ordering constraints.

Use the approved immutable release commit/image and distinct staging secrets/database as before. Browser recovery needs a secure context (HTTPS outside loopback), accessible IndexedDB/WebCrypto, private no-store responses, and no service-worker cache of private API/editor content. Verify session expiry/sign-out, cross-tab clearing and restored-search plans on staging. The approved local 10,000-record p95 gate is not evidence of VPS performance.

If migration/release validation fails, stop promotion. Choose the rehearsed compatible application rollback or restore the verified backup under an approved recovery plan; do not drop populated creative tables or run an ad-hoc destructive reverse migration. Production migration/deployment and infrastructure/DNS remain separate owner authorization gates.

## Phase 6 private object storage and sharing

Local/CI evaluation uses pinned Garage 2.5.0, one local node, dedicated bucket/runtime key and loopback-only S3 port. RPC/admin ports are not exposed. `pnpm storage:local` prepares only that worktree's local service, writes ignored private configuration and verifies private object access; it cannot provision a VPS. App transport requires explicit S3_ENDPOINT/REGION/BUCKET/ACCESS_KEY_ID/SECRET_ACCESS_KEY, with HTTPS outside loopback and no ambient AWS credential fallback. Use separate staging/production buckets/keys and runtime read/write without bucket-owner permission. No public bucket policy or direct object URLs are permitted.

Before hosted rollout, verify TLS/private network, runtime permission bounds, anonymous object denial, bounded read/timeouts, DB+object backup restoration, storage capacity/locking and the ADR-012 activation/cleanup protocol. Rehearse migration `20261114060000_snapshot_sharing` on an isolated restored copy. Restore operations must not revive stale sessions or previously revoked sharing capabilities. The owner approved 30 daily backups once a protected off-host destination is configured; no hosted job, retention deletion or destination has been activated. Staging provisioning/deployment and all production migrations/deployment remain separate explicit gates.

## Phase 7 release candidate

The concrete gated proposal is in RELEASE_RUNBOOK.md and deploy/compose.release.yaml: separate staging/production namespaces and credentials, immutable app image, private SQL, private loopback Garage in the app namespace, proposed resource caps and loopback-only preview ports (3306 staging; 3307 production). Only public offline assets enter the PWA cache. Owner/runtime/backup identities and keys are separate; grant profiles and encrypted restoration are tested locally, with no hosted application schema change in this phase.

The owner selected Coolify again when asked about backup/email services. This does not establish that an off-host destination or SMTP service is configured for Inkwell. The authorized Mac became unavailable during attempted read-only discovery; no successful lookup or hosted activation is claimed. Complete verified code/CI/review/merge work first, then obtain approval of concrete resources and validate the actual integrations before staging acceptance or production promotion. No public DNS or unrelated service is changed.
