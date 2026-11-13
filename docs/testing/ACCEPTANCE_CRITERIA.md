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
