# Acceptance criteria

Phases 0 and 1 have implementations. Evidence must be read from their milestone reports; later gates are required tests, not current passes.

| Phase | Required evidence                                                                                                                                                                                                                                   |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Fresh frozen install; lint/format/type checks; unit and local SQL integration; development startup; production build/container health; responsive keyboard/theme/a11y smoke; secret/dependency checks; remote CI success or explicit blocked status |
| 1     | Register/verify/login/recover/logout; atomic single workspace; persistent project/story CRUD; two-account resource and linked-ID rejection; cookie/CSRF/session revocation checks                                                                   |
| 2     | Fast capture, category/tag/filter/edit/archive/restore; all three conversions preserve source; multi-story/scene links; authorized-only search and stale-edit rejection                                                                             |
| 3     | All five canon types; shared reuse; local/override independence; clear/inherit semantics; conflicts/backlinks; cross-project rejection; no silent loss on shared changes                                                                            |
| 4     | Persisted atomic reorder; concurrent moves fail/retry safely; max two levels/no cycles; one canonical sequence; keyboard/mobile operation; link/duplicate/archive behavior                                                                          |
| 5     | Authorized workspace search; visible autosave states and recoverable interrupted edits where supported; versioned archive rejection; content/link round trip; remapping; rollback on any import failure                                             |
| 6     | Explicit selection/preview; immutable content; secure tokens; expiry/revocation; download policy; selected-only assets; no private reference traversal or edit access; revocation defeats caching                                                   |
| 7     | Critical suites green; accessibility/mobile review; security blockers resolved; rate/load tests against approved targets; protected backup restored; monitoring/redaction verified; approved staging; separately authorized production              |

## Phase 0 execution

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`.
- `pnpm test`: operational contract validation/readiness error boundary.
- `pnpm test:integration`: dedicated random local database; migration, UUID/timestamp persistence, ownership uniqueness, FK rejection and transaction rollback.
- `pnpm build`; `pnpm test:e2e`: production server on an isolated port, desktop/mobile, keyboard skip navigation, theme persistence, overflow, light/dark axe scans and safe operational responses.
- `pnpm security:secrets`, `pnpm audit --audit-level=high`.
- Docker build/runtime smoke; local dev startup smoke.

The integration runner creates/removes only its own `inkwell_test_<uuid>` database. No remote host is permitted. It cannot validate production permissions or hosted restoration. Every worktree has separate writable services and ports.

Automated axe checks are useful evidence, not a complete accessibility audit. Manual screen-reader/focus/zoom checks and broader browser/PWA coverage remain release gates. No snapshot tests merely mirroring markup or fabricated coverage percentages are required.

## Phase 1 verification

Unit tests cover strict portable inputs, omitted-field preservation, version preconditions and cursors. SQL tests cover verification/replay/expiry, Argon2 storage, exactly one atomic workspace, recovery/session invalidation, HTTPS cookie configuration, multi-story persistence, foreign resource/FK rejection, archive/restore, competing revisions and atomic durable limits. Browser journeys use a real production server and local SMTP with two accounts, actual Auth.js cookie/CSRF flows, password recovery, logout/replayed-cookie rejection, manual-save conflict retention, privacy settings and private-screen axe checks on desktop/mobile. Unsafe Origin, malformed input, missing preconditions and rate-limit responses are tested. Every browser run migrates and removes its own database.

No production email delivery, hosted HTTPS proxy, native-token auth, Safari/PWA install, manual screen-reader/zoom audit, hosted backup restore or release load test is claimed. These remain staging/release gates; automated axe is not a complete accessibility audit. No fabricated coverage percentage or live deployment is reported.

## Phase 2 verification

Add portable rich-text grammar/limits/scheme/ownership-contract tests; SQL checks for filtered indexed search, category/tag scope, multi-target qualified FKs, optimistic races, archive/restore, all three atomic conversions, immutable source snapshots, replay-safe keys/versions and serialized scene appends. Browser journeys use real sign-in/SMTP, capture, formatting, classification, all target kinds, multiple references, query facets, archive/restore, readonly source navigation, cross-account denial, safe literal HTML text, API replay behavior and axe checks on both desktop/mobile. Skipped or unavailable checks are never counted as passes. Full canon/Plot Board UI, autosave/recovery and release-scale performance remain later milestones.

Phase 2 additionally covers delayed classification responses (no save racing a pending tag write), explicit replay-response field whitelists, safe failure for newer stored format versions and slow client-script hydration (no draft accepted before handlers attach). Local final counts: 12 unit, 18 SQL integration and 20 browser tests. Remote CI evidence belongs to the immutable PR head.

## Phase 3 verification

Unit tests cover strict ownership/scope inputs, explicit override modes, full typed endpoint matrix and semantic field conflict comparisons. SQL integration covers all five kinds, shared reuse/local isolation, clears/inheritance, disjoint/relevant shared edits, required review choices, competing edits/override creation, cross-project/account/story rejection, backlinks/context editability, archive/restore, effective search/cursors, conversion provenance, archived parents, unsupported rich-text versions and direct SQL trigger bypass attempts. A separate generated local upgrade database seeds Phase 2 Character/conversion rows, applies the Phase 3 migration and verifies IDs/content/provenance remain unchanged.

Desktop/mobile browser journeys cover five-type creation, structured notes, relationship labels/backlinks/archive/restore, local coexistence, explicit override clear/custom/review, stale record/override draft retention, CSRF, preconditions and foreign endpoints. Automated axe/overflow checks cover canon lists and conflict review; these are not a complete manual accessibility audit. Screen captures remain outside source. The Browser skill is available but no Browser control tool/runtime is exposed in this session; the owner-specified repository Playwright suite uses isolated local services. No hosted app or deployment is claimed.

## Phase 4 verification

Portable contracts reject ownership/position/type mutation and invalid move forms. Domain tests cover active adjacency across archived rows, permutation preservation, no-op boundaries and structurally versioned cursors. SQL integration verifies group depth/cycles/scope, service and raw-SQL reparent races, content/move conflicts, deferred uniqueness rollback, multi-batch ordering, canonical paging, archive/restore chains, typed same-story canon links/backlinks/effective names, independent Idea reference versions, duplicate IDs/content/links/provenance and prior-scene migration preservation. Tests use generated local databases only.

Browser journeys cover grouped rich scenes, status persistence, delayed reference writes with disabled inputs/editor, native desktop drag, real keyboard movement/focus restoration, mobile destination controls, board/list order, stale sequence refresh, scene/group draft retention, duplication/archive/restore, backlinks and qualified API rejection. Automated axe/runtime/overflow/screenshot evidence complements existing suites; manual screen-reader, Safari/PWA, load and hosted operational review remain release gates. No hosted preview or deployment is claimed.

## Phase 5 executable gates

- `reliability.test.ts` unit: canonical payloads, strict save targets, cursor bounds and archive-version/depth rejection.
- Integration `reliability`: exact retry after unseen writes, simultaneous duplicate requests, payload/key mismatch, all scoped save targets, receipt bounds/no content, cross-workspace rejection, effective override/clear/inherit indexing, parent archival and cursor ownership.
- Integration `portability`: full archived project graph round trip, independent IDs, override conflict bases, scene copy ancestry, source snapshots/links, unrelated-project exclusion, classification reuse, malformed versions/documents/references/order/nesting/type/cycles and late-write rollback of all tables.
- Integration `search-performance`: exactly 10,000 mixed searchable records, warm 36-query local p95 ≤250 ms, selective GIN plan. Emit non-content measurement to `/tmp/inkwell-phase5-search-gate.json`. Production VPS remains unverified until release.
- Playwright `reliability`: in-flight typing, lost-response key replay and stale conflict, explicit recovery/compare/rebase, new-record interruption/expiry, suspended cached-candidate and delayed-write expiry, settings/logout/account separation, unavailable storage, pending-encryption purge race, record-navigation isolation, search filters, export download/import preview/creation, desktop/mobile axe checks.
- Preserve earlier authorization, account, canon, plot, keyboard/mobile movement, migration-upgrade and rich-text tests. Existing manual-save expectations are updated only where autosave changes the contract.
