# REST contracts

Base `/api/v1`. Zod schemas and portable DTOs live in `packages/contracts`. Every reply is `{data: ...}` or `{error: {code, message, requestId}}`, with `Cache-Control: no-store`. Private HTML is also dynamic/no-store. DTOs never include hashes, session IDs, auth versions, or raw ORM rows.

## Phase 1 endpoints

| Method and path                                          | Input and behavior                                                                                                      |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| GET `/health`                                            | Public, dependency-independent liveness; `status: ok`, version                                                          |
| GET `/ready`                                             | Public, safe dependency readiness; 503 without internal details                                                         |
| POST `/auth/register`                                    | Strict `{email,password,displayName}`; atomic account + one workspace; 202 generic delivery acknowledgement             |
| POST `/auth/resend-verification`                         | `{email}`; 202 generic acknowledgement; replaces previous verification link                                             |
| POST `/auth/verify-email`                                | `{token}`; single-use 24-hour verification                                                                              |
| POST `/auth/forgot-password`                             | `{email}`; 202 generic acknowledgement for eligible/unknown accounts and delivery failure                               |
| POST `/auth/reset-password`                              | `{token,password}`; single-use 30-minute recovery; revokes existing sessions and recovery links                         |
| GET `/auth/csrf`                                         | `{data:{csrfToken}}` and Auth.js CSRF cookie                                                                            |
| POST `/auth/callback/credentials`                        | URL-encoded `email,password,csrfToken,callbackUrl,json=true`; verified accounts only; encrypted HttpOnly session cookie |
| POST `/auth/signout`                                     | URL-encoded `csrfToken,callbackUrl,json=true`; server revocation + cookie removal                                       |
| GET `/auth/session`                                      | Current allowlisted account DTO; 401 for expired/revoked sessions                                                       |
| GET/PATCH `/account`                                     | Account DTO / strict `{displayName}`; PATCH version precondition                                                        |
| POST `/account/sessions/revoke`                          | Revoke every session including caller; sign in again                                                                    |
| GET `/dashboard`                                         | Owned active project/story counts and five recently touched projects                                                    |
| GET/POST `/projects`                                     | Cursor list / `{title,description?}`                                                                                    |
| GET/PATCH/DELETE `/projects/:projectId`                  | Read / `{title?,description?,archived?}` / archive                                                                      |
| GET/POST `/projects/:projectId/stories`                  | Cursor list / `{title,synopsis?,format?}`                                                                               |
| GET/PATCH/DELETE `/projects/:projectId/stories/:storyId` | Read / `{title?,synopsis?,format?,archived?}` / archive                                                                 |

All private routes authenticate against the session registry and authorize each ID with workspace scope. Foreign/mismatched resources return 404; unauthenticated requests return 401. Story/project/workspace scope is also enforced by foreign keys. Project archive preserves children; restore the project before changing stories. DELETE archives; permanent deletion is not exposed.

Every unsafe cookie request requires an exact configured `Origin`. Auth.js transport additionally checks its double-submit CSRF token. Non-browser first-party clients must follow the same documented Origin/transport contract; a later native-token flow is not claimed implemented. No GET mutates user data except bounded operational rate-limit accounting.

PATCH/DELETE require `If-Match: "<version>"`. Missing preconditions return 428; invalid ones 400; stale ones 409. Responses include the new integer `version` and ETag. Atomic conditional writes never overwrite a newer edit. The UI retains unsaved edits after conflicts and provides an explicit discard/reload action.

Lists accept only `archived=true|false` (default false), `limit=1..50` (default 20), and opaque `cursor`. Order is descending `(createdAt,id)`; output is `{data:{items,nextCursor}}`. Every page independently filters workspace/parent; cursor possession grants no access. Format is optional free text (80 characters), not a restricted narrative taxonomy. Titles are 1–120 trimmed characters; descriptions/synopses are plain text capped at 10,000 characters. Passwords are 12–128 characters, not trimmed. JSON bodies are capped at 32 KiB; auth forms at 8 KiB.

Errors: VALIDATION_ERROR/400 (also bounded transport 413/415), UNAUTHENTICATED/401, FORBIDDEN/403, NOT_FOUND/404, REVISION_CONFLICT/409, PRECONDITION_REQUIRED/428, RATE_LIMITED/429 with Retry-After, SERVICE_UNAVAILABLE/503. Unknown exceptions never serialize driver/SMTP/configuration details. Registration/recovery messages do not disclose whether an email exists; recovery account lookup and SMTP delivery run in Next’s after-response lifecycle, so account existence and SMTP latency are outside that response path. Absolute timing equality is not claimed.

## Later families

Vault/conversions, typed canon/overrides, scenes/sequence, search/recovery, import/export and immutable snapshots are future milestones. Shared snapshots will use separate allowlisted DTOs and revocation checks; private live references must never be traversed publicly.

## Phase 2 — Idea Vault

All endpoints use the same private authentication/authorization, exact Origin, safe envelopes/no-store and If-Match conventions. No raw ORM/workspace IDs or idempotency hashes enter idea DTOs. Idea records expose contentSchemaVersion separately from their optimistic version.

| Endpoint                                                    | Behavior                                                                         |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------- |
| GET/POST `/ideas`                                           | Scoped paginated search / strict title + v1 content + optional categoryId/tagIds |
| GET/PATCH/DELETE `/ideas/:ideaId`                           | Read / partial title/content/categoryId/tagIds/archived / archive                |
| GET/POST `/idea-taxonomy/categories`                        | Paginated owned categories / create named category                               |
| GET/POST `/idea-taxonomy/tags`                              | Paginated owned tags / create named tag                                          |
| GET/POST `/ideas/:ideaId/links`                             | GET kind=STORY or SCENE; POST qualified typed target                             |
| DELETE `/ideas/:ideaId/links/:kind/:linkId`                 | Remove an owned manual reference; conversion provenance cannot be removed        |
| GET/POST `/ideas/:ideaId/conversions`                       | Paginated conversion metadata / atomic new STORY, CHARACTER or SCENE             |
| GET `/projects/:projectId/characters/:characterId`          | Minimal read-only shared Character and authorized source references              |
| GET `/projects/:projectId/stories/:storyId/scenes`          | Paginated minimal Scene choices                                                  |
| GET `/projects/:projectId/stories/:storyId/scenes/:sceneId` | Minimal read-only Scene and authorized source references                         |

Idea search accepts q (200 characters), categoryId, comma-separated tagIds (all selected tags), storyId/sceneId relationship filters, archived=true|false, cursor and limit. Each query is workspace-scoped. An arbitrary foreign relationship filter grants no access and returns no foreign rows. Taxonomy accepts q/cursor/limit. Links/conversions use cursor/limit; relation lists preserve archived destinations. Every page is bounded. Invalid filters return 400.

Link bodies are `{kind:'STORY',projectId,storyId}` or `{kind:'SCENE',projectId,storyId,sceneId}`. Conversion bodies are `{kind:'STORY'|'CHARACTER',projectId}` or `{kind:'SCENE',projectId,storyId}`. Qualified target chains must match even within one account. Source Idea mutations, link changes and conversions require its quoted If-Match version. An archived idea must be restored before editing/linking/converting. Archiving a destination does not silently remove existing references.

Conversions require a UUID Idempotency-Key. Fresh creation returns 201; an identical replay returns 200 with replayed=true and the original conversion metadata. The returned ideaVersion is the version produced by that conversion, including on replay; it cannot advance a stale editor beyond an unseen later edit. A reused key with other input or a stale new request returns 409. Source snapshots and typed target FKs commit atomically. Target kinds have read-only overview pages until their later management phases. Story synopsis receives complete plain text; full formatting remains in the idea/snapshot and structured Character/Scene seeds.

Strict portable v1 rich-text validation and limits are described in ADR-006. Unsupported future stored formats fail safely. No raw HTML nodes, attachments or automatic AI requests are accepted; HTML-like text stays escaped text. API contracts use source revision and document format version as different concepts.

## Phase 3 canon API

Root `C = /projects/:projectId/canon`. Optional `?storyId=<uuid>` selects a qualified story context; absent means project shared canon. Unsupported context/query fields fail validation. Every route uses authentication, workspace/parent checks, private rate limiting, same-origin writes and safe no-store responses.

| Method/path                                 | Contract                                                                                                                                                  |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET `C`                                     | kind, q, archived, cursor and limit (1–50, default 20); deterministic authorized summaries and nextCursor; story names/search reflect effective overrides |
| POST `C`                                    | strict `{kind,name,content}`; shared without storyId, otherwise a separate local record; 201                                                              |
| GET `C/:id`                                 | Base record, effective story fields, optional override DTO and relevant conflict field names; ETag is base record version                                 |
| PATCH `C/:id`                               | strict nonempty `{name?,content?,archived?}` and base If-Match; cannot mutate shared rows through story context; no scope/kind/parent mutation            |
| POST `C/:id/override`                       | story context and shared source; If-None-Match: * required; strict `{baseVersion,name,content}`; 201, duplicate/stale 409                                 |
| PATCH `C/:id/override`                      | same body, override If-Match required; source/base version also checked                                                                                   |
| POST `C/:id/override/review`                | override If-Match and `{baseVersion,name?:KEEP                                                                                                            | INHERIT,content?:KEEP | INHERIT}`; every relevant conflict must have a decision, unchanged fields must be absent |
| GET `C/:id/relationships`                   | storyId, archived, cursor, limit; outgoing plus incoming/backlinks, effective other-endpoint summaries and editable flag                                  |
| POST `C/:id/relationships`                  | strict `{toId,kind,label?}`; source URL is directed origin; qualified typed endpoint/context checks; duplicate 409                                        |
| PATCH `C/:id/relationships/:relationshipId` | strict nonempty `{label?,archived?}` with relationship If-Match; edge must include source record and belong to exact editable context                     |

Override name/content modes: `{mode:INHERIT}`, `{mode:CLEAR}`, or `{mode:CUSTOM,value:...}`. CUSTOM name is nonempty ≤120 chars; notes use the bounded version-1 rich-text schema. CLEAR stores presence plus SQL NULL; INHERIT stores absence. Override save/review ETag is the override version, distinct from the GET base ETag. No default overwrite or automatic review decision. Missing preconditions: 428; malformed: 400; stale/review/archived-parent conflict: 409; foreign/mismatched resources: 404. Refresh comparison preserves the browser draft; discard is explicit. Contracts live in `packages/contracts/src/canon.ts`.

Record summaries do not include rich content. Detail DTOs whitelist content and private comparison snapshots only after authorization, excluding ownership internals. Canon feature search uses parameterized effective-name/notes ILIKE; workspace FTS remains the Phase 5 expansion. No canon permanent deletion or promotion endpoint exists. ADR-007 documents archival visibility and every typed pair.

## Phase 4 Plot API

Root `P = /projects/:projectId/stories/:storyId/plot`. Every route is authenticated, workspace/parent qualified, rate limited, no-store and same-origin for mutations. DTOs whitelist content/summary fields; no raw ORM or credential data crosses the API.

| Method/path                                           | Contract                                                                                                                                                                                                |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET `P`                                               | cursor, limit 1–100 (default 50), archived true/false and optional groupId UUID or ungrouped; canonical SceneCards, nextCursor, sequenceVersion, storyTitle and first page of active groups/groupCursor |
| GET/POST `P/groups`                                   | bounded createdAt/id group paging with archive filter / strict title, description?, parentId? (null=root); creation 201                                                                                 |
| GET/PATCH `P/groups/:id`                              | qualified group DTO / Group If-Match plus nonempty title?, description?, parentId?, archived?; scope immutable                                                                                          |
| POST `P/scenes`                                       | strict title, content, status? and groupId?; append to canonical sequence, 201                                                                                                                          |
| GET/PATCH `P/scenes/:id`                              | structured scene DTO with group/copy context and sequenceVersion / Scene If-Match with nonempty title?, content?, status?, archived?; no direct position/group/ownership patch                          |
| POST `P/scenes/:id/move`                              | Story sequence If-Match; either direction EARLIER/LATER alone, or optional beforeId/groupId with at least one present; null beforeId=end, null groupId=ungrouped; returns scene and sequenceVersion     |
| POST `P/scenes/:id/duplicate`                         | no request fields; observed Scene If-Match; returns new scene with retained original-scene provenance, 201                                                                                              |
| GET `P/scenes/:id/canon-links`                        | required kind CHARACTER/LOCATION plus cursor/limit; includes effective names and archive state                                                                                                          |
| POST/DELETE `P/scenes/:id/canon-links`                | Scene If-Match plus strict kind/canonId; incremental add/remove; returns sceneVersion                                                                                                                   |
| GET `P/scenes/:id/ideas`                              | cursor/limit; retained IdeaSceneLink summaries, Idea version and converted-source flag                                                                                                                  |
| GET `/projects/:projectId/canon/:id/scene-references` | optional qualified storyId plus cursor/limit; authorized scene backlinks with parent/archive labels                                                                                                     |

SceneStatus: PLANNED, DRAFT, REVIEW, COMPLETE. Group names and scene titles are nonempty ≤120 chars; group description ≤2,000; content uses the existing bounded rich-text format. Group/scene scope and duplicate-source identity are immutable. All foreign IDs, including same-account mismatched stories/projects, fail safely. Nested groups cannot exceed root/child. Missing quoted edit/sequence preconditions return 428, malformed input 400, stale/archive/conflict conditions 409 and foreign/mismatched resources 404. Failed transactions never expose partial reorder or copy results.

Moves compare the separate Story sequence version. Reorders/group moves do not advance Scene content versions; content patches do not replace structural fields. Scene create/duplicate/visibility/group changes update the structural revision. Canon reference mutations increment Scene.version. Idea reference add/remove reuses `/ideas/:ideaId/links` with Idea If-Match and qualified SCENE target, so scene content saves cannot replace Idea references. Reference lists retain archived sources; conversion sources cannot unlink. Duplication creates ordinary copied Idea links, not a second conversion history. Existing legacy `/stories/:storyId/scenes` and target-overview routes remain compatible. ADR-008 specifies pagination, filters, copy and restore semantics.

Root plot-group filters include their child scenes; child and ungrouped filters are exact. The displayed order is always the filtered projection of the one canonical sequence.

## Phase 5 search, save and portability

All endpoints remain private under `/api/v1`, authenticate and authorize the workspace, reject foreign origins on mutation, rate limit, and return safe errors/no-store. UUIDs in bodies never replace server scope. Project export is the documented download-envelope exception.

| Endpoint                          | Contract                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /search`                     | `q` 1–200 characters; optional comma-separated `kinds` (PROJECT/STORY/IDEA/CANON/OVERRIDE/SCENE/GROUP), projectId, storyId (requires projectId), canonKind, archive active/archived/all, limit 1–50 (20 default), cursor. Returns `{data:{items,nextCursor}}`. Items include kind, IDs, title, plain excerpt, parent context, archived flag and server-generated href. Invalid query/cursor 400; inaccessible context 404. |
| `POST /draft-saves`               | Strict discriminator `kind`, UUID recordId/requestKey, expected integer version, appropriate projectId/storyId and typed editable `fields`. Version 0 is only for first override creation. No archive changes. Returns `{data:{version,replayed,requestKey}}`, ETag. Exact retry returns its original applied version; stale/key mismatch 409; invalid input 400; inaccessible target 404. Body bound remains 32 KiB.      |
| `GET /projects/:projectId/export` | Authenticated JSON attachment `inkwell-project.json`, strict `inkwell.project` version 1. Includes selected-project graph and relevant Ideas, archive state and provenance. No account/auth/workspace/protocol secrets. 5/minute/account, 8 MiB / 10,000 archive rows; oversize 413. No private caching.                                                                                                                   |
| `POST /imports/preview`           | Raw versioned JSON archive, streamed 8 MiB bound and depth/shape/graph validation. Returns title/counts/explanatory notes; performs no writes. 10/minute/account.                                                                                                                                                                                                                                                          |
| `POST /imports`                   | Same strict archive. Creates separate owned project with remapped IDs in one transaction; returns `{data:{projectId,counts}}` (201). 5/minute/account. Unknown versions/invalid graph 400; excessive body 413; transaction failures safe 503 with no partial project. Check Projects after a lost response before retrying.                                                                                                |

`packages/contracts/src/archive.ts` and `reliability.ts` are the exact reusable DTO definitions; `packages/domain/src/archive.ts` implements native-client-compatible graph validation. Archive document version (1), content schema version (1), editorial record versions and scene sequence versions are independent. Assets are an empty closed collection in this format.

## Phase 6 snapshot sharing

Private routes are scoped to `/api/v1/projects/:projectId/snapshots`, require the current account/workspace and mutation Origin, and return safe no-store envelopes. `packages/contracts/src/sharing.ts` is the exact DTO definition.

| Endpoint                                                          | Behavior                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /projects/:projectId/snapshots/options`                      | Paged owned source choices by STORY/IDEA/CANON/SCENE/GROUP, optional storyId, active/archived filter, cursor and limit ≤50. No content is published by listing.                                                                                                |
| `POST /projects/:projectId/snapshots`                             | Explicit title, optional story context and closed selection arrays/booleans; max 64 KiB request, 1,000 records / 8 MiB copied document. Creates a private immutable copy and returns `{snapshot,document}` (201). No public token is issued. 5/minute/account. |
| `GET /projects/:projectId/snapshots`                              | Ready owned copy summaries, paginated. Source/private storage metadata is omitted.                                                                                                                                                                             |
| `GET /projects/:projectId/snapshots/:snapshotId`                  | Private preview of the exact frozen document.                                                                                                                                                                                                                  |
| `POST /projects/:projectId/snapshots/:snapshotId/links`           | Explicit future expiresAt and allowDownload. Returns public link metadata plus a one-time raw token (201); only its hash is stored. 10/minute/account.                                                                                                         |
| `GET /projects/:projectId/snapshots/:snapshotId/links`            | Paged policy/revocation metadata, never raw tokens or hashes.                                                                                                                                                                                                  |
| `DELETE /projects/:projectId/snapshots/:snapshotId/links/:linkId` | `If-Match` required; terminal revocation increments version. Stale 409, foreign 404. This revokes access and does not delete source content.                                                                                                                   |
| `POST /shared/view`                                               | Anonymous read-only capability submitted in a JSON body. Validates origin and link policy, then returns the frozen document with expiry and download permission. Unknown, expired and revoked links return safe 404.                                           |
| `POST /shared/download`                                           | Same capability/policy checks plus allowDownload, returning the exact snapshot JSON attachment. Disabled 403. No GET/presigned storage bypass exists.                                                                                                          |

Public access limits are separate from authentication limits: 600 global and 60 per trusted client IP per minute. Without verified proxy sanitization, requests share a conservative fallback bucket. Configure TRUST_PROXY only after owner-approved proxy verification; never trust arbitrary forwarded headers. Public success/error/download responses all forbid caching/indexing/referrer transmission. A fragment token never authenticates a private endpoint. Check the copy/link list after a lost creation response before retrying.
