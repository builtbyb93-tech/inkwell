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

## Phase 3 Story Bible

Project and story Bible routes use the same versioned REST services and scoped transactions as future native clients. Portable Zod contracts describe record kinds, field-presence override modes, review decisions and typed relationships. Pure domain rules compare fields and validate endpoint kinds. Server-only Prisma services authorize every context/source/destination. Separate list, record, override/review and relationship components reuse Tiptap and safe rendering. No paid service, external AI or background task is required. See ADR-007.

## Phase 5

Workspace search uses qualified PostgreSQL FTS unions and effective override indexes (ADR-009). A shared client save/recovery coordinator serializes optimistic writes, keeps newer typing and exposes explicit conflict comparison. Content-free transactional receipts make retries acknowledge the original applied version; IndexedDB recovery remains optional and account/session partitioned (ADR-010). Versioned project archives use strict reusable contracts/graph validation and an all-or-nothing remapping transaction (ADR-011). No AI, paid service, asset upload, server content history or private offline cache is required.
