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
