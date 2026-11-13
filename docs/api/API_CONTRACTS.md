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
