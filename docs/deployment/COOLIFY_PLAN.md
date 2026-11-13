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
