# Phase 1 — Authentication and Project Foundation

Implementation authorized by the owner after Phase 0. The owner approved merging Phase 1 PR #40 after review fixes and passing checks. Deployment remains unapproved. No invitations/review requests were sent.

| Field                      | Evidence/status                                                                                                                                                                                                 |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Issues                     | #7, #8, #9, #10, #11, #12                                                                                                                                                                                       |
| Branch                     | feature/7-account-project-foundation                                                                                                                                                                            |
| Worktree                   | /workspace/inkwell-worktrees/phase-1                                                                                                                                                                            |
| Base                       | 9ca76167ec8a0c0ff58a914592715a21e64c7de1 (approved Phase 0 squash merge)                                                                                                                                        |
| Target                     | main                                                                                                                                                                                                            |
| Final commit / PR          | Recorded in the published PR head and final owner handoff after verification                                                                                                                                    |
| Scope                      | Register/verify, secure sign-in/revocation/recovery, one workspace, project/story CRUD, archive/restore, dashboard, account/privacy settings                                                                    |
| Files                      | Web routes/forms/services/CSP, portable contracts/domain policies, Prisma schema/additive migration, SMTP package, isolated SQL/browser runners, CI/local services and operating docs; full list in the PR diff |
| Local checks               | Unit 8; SQL integration 9; desktop/mobile browser suite 14; format/lint/type/build/schema/peer/security checks recorded in final handoff                                                                        |
| CI                         | Required quality, integration, browser, container and security jobs; status is read from GitHub, never assumed from local checks                                                                                |
| Migration                  | 20261113010000_accounts_projects; additive identity/session/token/rate/project/story schema and scope FKs; applied only locally/disposable test DBs                                                             |
| Security                   | Argon2id; hashed single-use tokens; registry revocation; Origin/CSRF; scoped DTOs/FKs; optimistic writes; durable rate limits; no-store + nonce CSP; patched SMTP dependency isolation                          |
| Merge                      | Owner approved; final checks pending                                                                                                                                                                            |
| Deployment                 | Not deployed; no VPS, DNS, hosted database/storage/mail/proxy changes                                                                                                                                           |
| Recommended next milestone | Owner review/approval of Phase 1 merge, then Phase 2 Idea Vault under its own approved scope                                                                                                                    |

## Verified behavior

The browser journey uses real Auth.js transport and local SMTP: unverified sign-in is denied; verification succeeds; projects and multiple stories persist; a second account cannot read/change foreign records or create a child under them; competing writes return one success and one conflict; unsaved UI edits survive that conflict; archive/restore keeps content; logout rejects replayed cookies; password recovery revokes old sessions while another account remains valid; account changes stay scoped; AI stays disabled; logout-all ends access. Desktop/mobile axe checks cover private dashboard/story/settings and both landing themes.

SQL tests additionally verify UUID/UTC/FK/transaction foundations, token replay/expiry, exactly one registration workspace, cross-workspace composite FK rejection, durable concurrent rate limits, multi-story counts and Secure cookie configuration for HTTPS. Browser/SQL runners create and remove only their own UUID-named local databases.

## Security and operating limits

Nodemailer 7 initially selected by NextAuth's optional email-provider peer had high advisories. That unused peer is absent; app-owned SMTP uses stable Nodemailer 10.5.0 with bundled types, no advisory suppression or peer override. Required peers are explicit and checked. The known moderate development-only minimatch advisory GHSA-g3hv-75wg-m249 remains; production dependency audit and remote CI results are reported separately.

Recovery/verification mail lookup and delivery run through Next's after-response lifecycle, outside generic response latency. Delivery is not a durable queue; process interruption or SMTP failure can require resend. Only static failure codes are logged, never recipients/tokens/transport exceptions. Hosted SMTP/sender verification, trusted proxy header sanitization, least-privilege runtime/migration roles, HTTPS cookie/proxy testing and target-VPS password/load tuning remain prerequisites to public release. No production readiness certification is claimed.

Sessions are seven days; verification 24 hours; recovery 30 minutes. Argon2id uses 19 MiB/two passes/parallelism one. Five local samples were 20/11/10/26/10 ms; remeasure on the approved VPS. Auth-token/session retention and backup recovery require operating review before production. Local PostgreSQL 17.12 uses a pinned Alpine variant because VFS image expansion exhausted the managed workspace; CI keeps pinned Bookworm. Only Inkwell's generated dependencies/build caches/images were reclaimed; source branches/worktrees were retained.

Manual screen-reader/Safari/PWA installation testing, hosted delivery/backup restoration and release load/security audit remain later gates. Autosave/recovery buffers, rich-text authoring, Vault/canon/Plot Board/search/import/export/sharing are later phases. No native-token flow, AI provider or offline private-content caching is introduced.

## Owner-approved merge follow-up

The owner explicitly approved merging PR #40. Pre-merge review found that enabled title fields could accept edits during an in-flight save and then be replaced by the earlier response. Project/story fields and the equivalent account name field now disable editing during submission. Desktop/mobile regression checks hold real API responses open, verify the fields are disabled, release the response, verify editing resumes, and reload the story to confirm persistence. The review thread will be resolved only after verification. Required checks are rerun on the corrected head before merging. This approval does not authorize Phase 2 implementation or deployment.
