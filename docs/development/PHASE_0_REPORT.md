# Phase 0 — Repository and Engineering Foundation

Status: local implementation and initial CI verified; repository/planning/PR published; public source and main protection verified; milestone awaits non-author review and owner merge approval. This is not approval to merge, provision or deploy.

## Git and issue references

- Approved canonical owner/repository: builtbyb93-tech/inkwell. Canonical public repository (owner-approved visibility) is published: https://github.com/builtbyb93-tech/inkwell.
- GitHub issue references: Phase 0 #1–#6; all 38 tasks are published as #1–#38. See GITHUB_RESOURCES.json for the mapping.
- Branch: chore/phase-0-engineering-foundation.
- Worktree: /workspace/inkwell-worktrees/phase-0.
- Administrative checkout: /workspace/inkwell.
- Base commit: f32e82185ebf637238e9f2e6e1f0e999175779dc, the approved README-only bootstrap published on main.
- Final commit: the committed branch HEAD; its exact SHA is recorded in the accompanying owner handoff and exported /workspace/INKWELL_PHASE_0_REPORT.md after this report is committed.

## Completed local scope

Modular pnpm monorepo; exact Node/TypeScript/framework/dependency pins; shared contracts/domain/db/UI/editor/config packages; formatting/linting/strict types; minimal responsive keyboard-accessible shell with light/dark/system themes and honest empty states; PWA manifest/icons; health/readiness routes with safe errors; local PostgreSQL and foundational migration; separate hosted environment templates; non-root standalone Docker runtime; unit/integration/browser/accessibility harnesses; SHA-pinned CI without deployment; secret/dependency checks; PR/issue templates and CODEOWNERS; required product/architecture/API/security/testing/deployment/development documentation and ADRs.

Planning manifest: 8 milestones, 15 required labels, 7 exact workflow statuses, 38 issue drafts. Required issue fields are present, keys are unique and dependencies are acyclic. Project: https://github.com/users/builtbyb93-tech/projects/1. Draft PR: https://github.com/builtbyb93-tech/inkwell/pull/39.

## Tests and results

| Check                                     | Result                                                                                                               |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Fresh frozen install                      | Passed in clean Docker builder and fresh host restoration                                                            |
| pnpm format:check / lint / typecheck      | Passed, including root test/config types and all packages                                                            |
| Unit                                      | 5 passed                                                                                                             |
| Database integration                      | 4 passed on a unique disposable local database                                                                       |
| Prisma schema validation                  | Passed                                                                                                               |
| Production Next build                     | Passed locally and in clean Docker build                                                                             |
| Playwright                                | 8 passed: desktop/mobile, keyboard, theme persistence and denied storage, safe API responses                         |
| axe                                       | No detected WCAG A/AA violations in desktop/mobile light/dark shell scans; not a full manual audit                   |
| Development startup                       | Shell, liveness and configured database readiness returned 200                                                       |
| Secret scan                               | Worktree snapshot and Git history clean at scan; final staged scan recorded in owner handoff                         |
| Dependency audit                          | No high/critical findings; one moderate dev-only minimatch advisory. Production-only audit: no known vulnerabilities |
| Peer dependencies                         | No issues                                                                                                            |
| Planning manifest                         | 38 drafts valid, required fields present, acyclic dependencies                                                       |
| Full Docker build                         | Passed with exact Node digest, frozen lockfile and optional trusted build CA                                         |
| Final container runtime                   | Non-root UID 1000; shell/health 200; safe readiness 503 without DB; healthy; build CA absent                         |
| GitHub Actions                            | Run 1 passed on implementation 8c4c31d; latest head checks are verified in the owner handoff                         |
| Branch protection / Project / issues / PR | Project/issues/PR published; public visibility and main protection verified; review pending                          |

Local environment required writable tool caches, a trusted managed-network CA mounted only during builds, and an ephemeral in-memory package metadata cache to fit an 8 GiB filesystem. TLS verification remains enabled. No host CA is embedded in the runtime. Test containers are local and disposable; the development database volume is retained. No VPS services were changed.

## Security findings

No production/private content or real credentials committed. Cloud identity checks were unreliable: missing and invalid Authorization headers also returned BradyBuilds. A fresh authorization initiated on the owner-authorized Mac correctly verified builtbyb93-tech; credentials stay outside source with restricted permissions. Automatic review rejected the earlier credential transfer; no such transfer occurred. A PAT appeared in terminal history during manual entry; the owner was instructed to revoke it. The Mac uses a separately issued unexposed OAuth credential.

One moderate development-only finding remains: GHSA-g3hv-75wg-m249 in minimatch 10.2.6 through lint tools. Reported fix 11.0.1 is outside their current major range; no unreviewed major override is forced. See SECURITY_MODEL for impact/mitigation. No high/critical findings or production dependency advisories were reported by the executed audits. This foundation is not a production security sign-off.

## Database migration

20261113000000_foundation creates User and Workspace with UUID primary keys, UTC timestamps, unique email, unique workspace owner FK, and restricted owner deletion. It was applied only to disposable local integration databases. No production schema was changed. Phase 1 must add atomic account/workspace creation and actual authorization/session flows; current SQL enforces at most one workspace per owner.

Migration tooling rejects remote hosts and unrelated database names. Integration tooling creates/removes only its own random inkwell_test_ database. No writable test database is shared between worktrees.

## Limitations and remote blockers

Authentication, creative features, rich-text authoring, storage operations, FTS, recovery, portability and sharing are later milestones. PWA installability/full browser/manual screen-reader/backup/load/release checks are future acceptance gates. Storage/auth/mail/retention decisions remain documented proposals before dependent implementation.

The connector lacks administrative creation surfaces, so the authorized Mac performed setup using its verified owner authorization. The owner approved public source after GitHub rejected private protection on the existing plan. Repository visibility is public and main protection is verified: all five strict CI checks, one non-author approval, stale-review dismissal, conversation resolution, admin enforcement and linear history; no force pushes/deletion. No paid upgrade occurred. The Project remains private. A non-author reviewer is still needed; no collaborator has been invited.

## PR, merge and deployment

PR: https://github.com/builtbyb93-tech/inkwell/pull/39 (draft). Merge status: not merged; auto-merge disabled. Deployment status: not deployed; no Coolify provisioning, production migration or DNS change.

Recommended next step: obtain eligible non-author review, verify the latest CI checks, and obtain explicit owner merge approval. Only then propose Phase 1 under a separate milestone approval.

## Files changed

The inventory below lists this foundation change relative to the approved bootstrap.

Initial implementation inventory (92 files; this publication update adds resource mapping):

- `.dockerignore`
- `.env.example`
- `.github/CODEOWNERS`
- `.github/ISSUE_TEMPLATE/bug.yml`
- `.github/ISSUE_TEMPLATE/config.yml`
- `.github/ISSUE_TEMPLATE/task.yml`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `.github/workflows/ci.yml`
- `.gitignore`
- `.gitleaks.toml`
- `.npmrc`
- `.nvmrc`
- `.prettierignore`
- `.prettierrc.json`
- `AGENTS.md`
- `README.md`
- `apps/web/next.config.ts`
- `apps/web/package.json`
- `apps/web/postcss.config.mjs`
- `apps/web/public/icon-192.png`
- `apps/web/public/icon-512.png`
- `apps/web/public/robots.txt`
- `apps/web/src/app/api/v1/health/route.ts`
- `apps/web/src/app/api/v1/ready/route.ts`
- `apps/web/src/app/globals.css`
- `apps/web/src/app/icon.svg`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/manifest.ts`
- `apps/web/src/app/page.tsx`
- `apps/web/src/components/theme-select.tsx`
- `apps/web/src/server/readiness.ts`
- `apps/web/tsconfig.json`
- `compose.yaml`
- `deploy/Dockerfile`
- `deploy/production.env.example`
- `deploy/staging.env.example`
- `docs/api/API_CONTRACTS.md`
- `docs/architecture/CANON_RULES.md`
- `docs/architecture/DATA_MODEL.md`
- `docs/architecture/RELATIONSHIPS.md`
- `docs/architecture/SYSTEM_DESIGN.md`
- `docs/decisions/ADR-001-authentication.md`
- `docs/decisions/ADR-002-object-storage.md`
- `docs/decisions/ADR-003-github-controls.md`
- `docs/deployment/COOLIFY_PLAN.md`
- `docs/development/BRANCHING_POLICY.md`
- `docs/development/PHASE_0_REPORT.md`
- `docs/development/PR_DRAFT.md`
- `docs/development/SETUP_STATUS.md`
- `docs/development/TASK_DEPENDENCIES.md`
- `docs/development/VERSIONS.md`
- `docs/development/github-plan.json`
- `docs/product/MVP_SCOPE.md`
- `docs/product/PRODUCT_SPEC.md`
- `docs/security/SECURITY_MODEL.md`
- `docs/testing/ACCEPTANCE_CRITERIA.md`
- `eslint.config.mjs`
- `package.json`
- `packages/config/package.json`
- `packages/config/tsconfig.base.json`
- `packages/contracts/package.json`
- `packages/contracts/src/index.ts`
- `packages/contracts/tsconfig.json`
- `packages/db/package.json`
- `packages/db/prisma.config.ts`
- `packages/db/prisma/migrations/20261113000000_foundation/migration.sql`
- `packages/db/prisma/migrations/migration_lock.toml`
- `packages/db/prisma/schema.prisma`
- `packages/db/src/index.ts`
- `packages/db/tsconfig.json`
- `packages/domain/package.json`
- `packages/domain/src/index.ts`
- `packages/domain/tsconfig.json`
- `packages/editor/package.json`
- `packages/editor/src/index.ts`
- `packages/editor/tsconfig.json`
- `packages/ui/package.json`
- `packages/ui/src/index.tsx`
- `packages/ui/tsconfig.json`
- `playwright.config.ts`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `scripts/database.mjs`
- `scripts/dev.mjs`
- `scripts/integration.mjs`
- `scripts/secret-scan.mjs`
- `scripts/start.mjs`
- `tests/e2e/shell.spec.ts`
- `tests/integration/database.test.ts`
- `tests/unit/readiness.test.ts`
- `tsconfig.json`
- `vitest.config.ts`
