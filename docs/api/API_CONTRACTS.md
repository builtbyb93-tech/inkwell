# REST contracts

Base `/api/v1`; Zod DTOs in `packages/contracts`. Only health/readiness exist in Phase 0.

| Endpoint      | Behavior                                                                                                          |
| ------------- | ----------------------------------------------------------------------------------------------------------------- |
| GET `/health` | Public 200 `{ "data": { "status": "ok", "version": "0.6.0" } }`; dependency-independent                           |
| GET `/ready`  | Public 200 with `status: ready` when DB connectivity works; otherwise safe 503 envelope; no infrastructure detail |

Both disable caching. Schema-dependent feature readiness expands when those features arrive.

## Planned families

`/auth/*`, `/account`, `/workspace`, `/projects`, project stories; `/ideas` plus links/conversions; project/story `/canon/*` plus overrides/typed relationships; story groups/scenes/sequence; `/search`; revision/recovery; project export/import; `/snapshots` plus selection/preview/revoke and isolated public read-only token routes. Exact resource contracts are written before each feature, not claimed implemented here.

Private requests authenticate and authorize each resource/linked ID. SSR uses the same checks. Strict bounded Zod input validation; no raw ORM models. Cookie mutations need CSRF/origin protection. Use cursor pagination/stable order, durable rate limits and explicit retry/idempotency semantics for conversion/import.

Success is `{data, meta?}`; meta contains pagination/version when relevant. Error is `{error: {code, message, requestId}}`, never raw exceptions or echoed secrets. Codes/statuses: VALIDATION_ERROR/400, UNAUTHENTICATED/401, FORBIDDEN/403, NOT_FOUND/404, REVISION_CONFLICT/409, RATE_LIMITED/429, SERVICE_UNAVAILABLE/503, INTERNAL_ERROR/500. Define consistent existence-hiding rules.

Writes require a documented expected version/If-Match convention; sequence writes also compare sequenceVersion. Return the new version; stale writes never overwrite. Endpoint detail must select one update convention before implementation.

Public snapshots expose immutable allowlisted DTOs only. Recheck hashed-token expiry/revocation/download policy for every content/asset request. No long-lived redirects or cached URLs that bypass revocation; no live private traversal.
