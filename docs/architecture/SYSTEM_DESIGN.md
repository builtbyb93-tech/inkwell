# System design

## Current implementation

Phase 1 adds Auth.js-compatible Credentials/JWT transport with a server-checked session registry, app-owned registration/verification/recovery, scoped project/story REST services, an authenticated dashboard and account settings. SMTP delivery is isolated in packages/mail. No paid provider, background AI, or hosted resource is required.

## Planned modular monolith

Browser/PWA → REST `/api/v1` → authorized domain service → scoped repository → PostgreSQL/private S3. Server-rendered features call the same authorization boundary. No microservices, external search, paid AI or queue service is needed for MVP.

`apps/web` owns HTTP/session adaptation and UI. `contracts` owns Zod DTOs/errors/archive versions. `domain` owns ownership, conversion, canon, ordering, import and snapshot rules through narrow interfaces. `db` owns Prisma, SQL constraints, migrations and transactions. `ui` owns accessible controls/tokens. `editor` owns free Tiptap extensions and bounded content validation. No Prisma models/credentials cross into client bundles. Contracts/domain remain usable by native clients.

Writes authenticate → parse → authorize resource and every supplied relationship → compare version → transact records/links/search → return safe DTO/new version. Include scope/version in conditional writes and FKs to avoid authorization races. Never expose SQL/stack/token/private data in errors.

Imports validate/remap before atomic database writes. S3 staging uses private manifests and orphan cleanup; S3/PostgreSQL cannot provide a shared transaction. Snapshots copy allowlisted immutable content/assets and cannot resolve live private references.

## Online-first behavior

No offline replication. Phase 0 registers no service worker. Any later worker caches approved static assets only; exclude private HTML, API/auth and share content. Autosave uses optimistic versions from the first editor. Recovery buffers must be account/workspace scoped, bounded and cleared appropriately at logout; retention details need a decision. Theme is the only current browser-persisted preference.

FTS indexes update transactionally with content. Search always includes workspace and archive predicates. Public snapshots use a separate DTO boundary and no private search.

## Open decisions

See ADRs for stable authentication, S3 choice and private-repository protection. Mail delivery, archive/attachment limits, search dictionaries, recovery/deletion/backup retention and production load targets need decisions before dependent features. Coolify remains the approved deployment target; provisioning/deployment remain separately gated.
