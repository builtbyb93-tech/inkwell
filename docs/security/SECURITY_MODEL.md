# Security model

## Current boundary

Phase 1 now exposes verified accounts and private project/story records. Credentials/JWT transport uses stable NextAuth 4.24.15 plus a server-side registry; encrypted cookies alone do not grant access after revocation. Every private API and server-rendered account boundary checks current session expiry/revocation/authVersion/workspace. Mutations require exact configured Origin; auth transport also uses Auth.js CSRF cookies/tokens. Hosted HTTPS selects Secure + HttpOnly + SameSite=Lax cookies with __Secure- prefix; local HTTP uses HttpOnly/Lax without Secure. Sessions expire after seven days, verification after 24 hours, recovery after 30 minutes.

Passwords use Argon2id (19 MiB, two passes, parallelism one, 32-byte output), at least the current OWASP minimum. Five local hash samples were 20/11/10/26/10 ms (11 ms median); this is environment-specific, not a VPS load/security certification. Benchmark and tune on the approved target before release. Unknown-account sign-in performs a dummy hash verification. Raw passwords/tokens, private content and underlying driver/SMTP exceptions are never logged. Tokens contain 32 random bytes and store only SHA-256 hashes; account-row serialization and conditional consumption reject replay/races. Reset revokes all sessions and outstanding recovery links; registration cannot change an existing password.

Project/story/account writes validate bounded strict Zod inputs and scoped optimistic preconditions. Story/project/workspace integrity has a composite FK. Parent locks serialize story writes against project archive. DTOs explicitly allowlist fields; request-supplied ownership cannot be injected. Foreign records return 404. Archive preserves content; no permanent deletion API exists.

Dynamic HTML receives a fresh nonce CSP with strict-dynamic scripts, self-only connections, no objects/base/framing and self-only forms. Inline styles are allowed for framework/components; eval is enabled only for development. Private HTML/API/auth responses are no-store; no service worker caches private content. Referrers are disabled. Verification/recovery tokens arrive in fragments and are cleared before explicit POST. Theme is the only browser-persisted preference.

PostgreSQL rate buckets use HMAC identifiers and atomic upserts; raw emails/IPs are not stored. Defaults: global auth 600/min, operation/IP 60/min, operation/email 5/min, private API 180/min/account. Expired buckets are cleaned after 24 hours. Proxy IP headers are ignored by default; TRUST_PROXY=true is safe only when a controlled reverse proxy strips client-supplied forwarding headers. Production proxy setup and thresholds must be reviewed before exposure. Identical recovery/registration acknowledgements limit enumeration; Recovery account lookup and SMTP delivery run after the generic response, so SMTP latency is not an account-existence signal in that response.

Mail is app-owned through packages/mail (Nodemailer 10.5.0), without NextAuth's unused optional vulnerable email-provider peer. TLS is required for non-loopback SMTP; file/URL/raw-message sources are not exposed. Local Mailpit is loopback-only. Hosted sender/SMTP delivery and runtime-role grants remain deployment prerequisites. No external AI provider, object storage resource or hosted monitoring service is configured.

## Required feature controls

- Hash passwords with a maintained Argon2id implementation and measured parameters. Never log passwords/reset URLs. Verification/reset tokens are random, hashed, expiring and single-use. Bound enumeration and rate abuse; invalidate sessions on recovery.
- Secure HttpOnly cookies, appropriate SameSite/CSRF/origin checks, server-checked revocation, login/session lifetime policy and explicit logout. Auth implementation follows ADR-001.
- Authenticate every private operation, authorize each resource/linked ID, and scope queries and transactional writes. Tests use two accounts with valid foreign IDs; UUID secrecy is not isolation.
- Runtime DB role has least privilege; migration credentials are separate. FK/scope integrity, version preconditions and transaction guarantees supplement service checks.
- Validate/bound all input, rich-text nodes/link schemes, files/import size and archive depth. Sanitize rendering; defend against stored XSS, SSRF, path traversal and decompression bombs.
- Private S3 buckets and least-privilege per-environment credentials. Use private manifests, safe MIME/disposition, and authorization at download time.
- Sharing copies selected content only. Store cryptographic token hashes, check expiry/revocation/download permissions for every request, redact tokens from logs, use no-referrer/noindex/no-store, and avoid direct URLs that outlive revocation.
- Durable rate limits across app replicas for auth, shares, search and imports; PostgreSQL-backed coordination is sufficient initially. Do not reuse Coolify's Redis or unrelated applications' services.
- Account/privacy and permanent deletion require explicit auditable workflows with approved recovery/retention. Do not silently retain sensitive content in generic logs, backups or recovery caches.

## Secrets, supply chain and operations

Environment files are ignored. Example credentials are local-only. Credential setup files remain outside the repository with restricted filesystem permissions. Never print credential contents or connection URLs.

Exact dependency pins, frozen install, approved dependency build scripts, checksummed scanner binaries, SHA-pinned Actions, secret scanning, dependency audit and reviewed lockfile updates form the baseline. Untrusted PRs have no deployment secrets and use pull_request, not privileged pull_request_target execution of untrusted code.

Separate staging/production databases, networks, storage credentials and secrets. Protect staging access. Backups are encrypted/access-controlled with an approved off-host destination and restoration test. Production migrations/deployment, DNS and provisioning need separate owner approval. No production authorization has been given.

## Verification gates

Authorization regressions, concurrent-write/transaction tests, import rollback/round trips, share revocation/private traversal checks, browser accessibility, dependency/secret scans and backup restoration are required as relevant features arrive. Findings and skipped checks stay visible; do not certify the application from a shell audit.

## Phase 0 dependency finding

Audit on 2026-11-13 reports one moderate development-only advisory: [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), minimatch 10.2.6 glob-parts amplification, pulled through lint tooling. The reported fix is 11.0.1, outside those dependencies' current major range. Do not silently force a major transitive replacement or ignore the advisory. There are no reported high/critical findings at this check; production dependency audit is recorded separately in the milestone report. Lint patterns are repository-controlled and CI jobs have time limits. Review an upstream-compatible fix before release; this is not a production security sign-off.

## Phase 2 private content boundary

Portable structured-text validation bounds grammar, depth, nodes, bytes and text length, rejects unknown nodes/attrs and executable URL schemes, and renders escaped text without raw HTML. No images/uploads or external provider content requests are enabled. Document schema version is stored and checked before rendering/conversion. Category/tag and target FKs include workspace; every supplied destination chain is checked transactionally. Indexed FTS is parameterized and always scoped; paging reads use one repeatable-read snapshot. Conversion keys are workspace-bound with canonical request hashes; replays cannot advance an editor past unseen revisions. Source snapshots remain private immutable domain records, not log payloads. No production access, migration or hosted service change occurred.

## Phase 3 canon boundary

Every source, story, project, override and relationship endpoint is workspace-qualified; same-account cross-project and cross-story-local links fail. Fixed-scope identities and SQL trigger/FK guards prevent type/id drift or converted-character retargeting. Overrides are separate persisted rows, with base/own concurrency preconditions, explicit clears and explicit review decisions. Private comparison snapshots are authorized DTO data, never logs. Pending form fields/editors disable input; stale saves retain browser drafts, and refresh does not silently discard them. Local migration-upgrade testing verifies old Character/provenance survival. No permanent delete, public snapshot exposure, external content provider, hosted migration or deployment is included.

## Phase 4 plot boundary

All group/scene reads and writes authorize qualified workspace/project/story chains. SQL guards prevent cross-story groups, tree cycles/third levels, identity/provenance retargeting, wrong canon kind and foreign/local canon endpoints. Versioned content and structural preconditions remain distinct, with atomic ordering under Project→Story locking. Direct SQL scope/race and rollback tests supplement API checks. Canon reference changes are incremental and scene-versioned; Idea references retain their source-versioned API and immutable conversion protections. Pending fields/editors disable input, stale saves retain drafts, and no full reference replacement can silently drop concurrent links. Copy IDs and edges are new; original conversion history is retained. No production role, hosted schema/resource, public asset, AI, secret or deployment change is included.

## Phase 5 review boundary

Search authorizes every SQL branch and parent; excerpts are plain text escaped by React. Effective override indexes cannot reveal overridden-away fields within a story filter. Export selects allowed fields inside an owned project snapshot and never traverses unrelated project links or reads session/receipt secrets. Import bounds bytes/depth/rows/documents, validates typed graph integrity, remaps into the authenticated workspace, and rolls back every write on failure. No imported URL is fetched; assets are rejected. Heavy endpoints are independently limited.

Save receipts store hashes/metadata only, use scoped advisory locking plus existing optimistic writers, and replay original applied versions. Browser recovery follows the approved seven days, scoped account/workspace/session and explicit restore; settings purge and both sign-out controls invalidate leases. The final IndexedDB write rechecks generation after encryption to prevent resurrection by older tabs. Local encryption does not defend against same-origin XSS or browser-profile access. Storage failure never creates an auth bypass or blocks server session revocation. See ADR-010 for browser suspension/eviction limits. No external AI/content transmission or hosted infrastructure change is introduced.

## Phase 6 public capability boundary

Snapshot selection is authenticated, resource-scoped and read consistently; missing/foreign selections reject the whole copy. Public DTOs contain selected content and new IDs only, with no live lookup/backlink/asset traversal. Source changes cannot change a READY payload. Private S3, server-generated reserved keys, SQL immutable metadata and per-read hashes protect payload integrity. A runtime storage key cannot create unrelated buckets; every test runner requires a loopback test namespace and removes only its generated database's object keys.

Raw random share tokens are shown once, stored only as hashes, carried in URL fragments and bounded POST bodies, and excluded from logs. Expiry/revocation/download checks occur before and after object access. Public responses use private/no-store, noindex/noarchive, nosniff and no-referrer; no presigned URLs or auth/edit grants are issued. The public viewer clears stale rendering on failure/expiry and revalidates on return; previously copied content cannot be recalled. Owner-chosen expiry does not imply automatic snapshot deletion. Hosted storage privacy/TLS/proxy/roles remain release gates. ADR-012 documents the tested conditional-write limitation and safe activation-acknowledgement handling.

## Phase 7 hardening

The inherited development minimatch advisory is resolved with an explicit reviewed 11.0.2 override and unchanged supply-chain age policy; full dependency audit now reports no known findings. Closed error events contain only validated code/status, generated request ID and UTC time, with separate bounded per-replica logging budgets. Unknown exception/driver/request data is excluded, log sink failure cannot break safe responses, and raw debug logging must stay disabled in hosted environments. The app container whitelist does not pass DEBUG, database-owner, backup or Garage-admin credentials.

Runtime and backup grant profiles separate application mutations from migration ownership and read-only backup access. SQL tests prove core persistence while rejecting runtime DDL, permanent core deletion and migration-table access. Workspace row authorization remains enforced by server services and qualified SQL integrity; these grants are not a claim of row-level database isolation from a stolen runtime credential. Independent-client concurrent rate-limit tests verify the shared SQL window; hosted proxy sanitization must still be checked.

The PWA cache contains only three fixed public assets, never private HTML/API/auth/RSC/share content. Encrypted backup authentication, private key permissions, safe atomic publication, protected scratch handling, fresh-target restoration and capability invalidation are documented in ADR-013 and BACKUP_RESTORE.md. Hosted destinations, access controls, retention activation and disaster recovery remain unverified until separately approved and observed.
