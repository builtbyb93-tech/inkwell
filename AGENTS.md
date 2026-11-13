# Inkwell engineering instructions

The owner's v0.6 directive and explicit approvals govern. Read product, architecture, security, testing, and development documents for the area being changed.

## Scope and approvals

- Current authorization: Phase 0 foundation, local verification, and preparation of a PR.
- Never merge or enable auto-merge without explicit owner approval.
- Provisioning, production migrations/deployment, DNS, destructive actions, paid dependencies, scope/major architecture changes, and deletion of unmerged worktrees/branches require their own approval.
- Do not modify unrelated projects. Use `builtbyb93-tech/inkwell`; ordinary work uses branches/worktrees, not forks.
- AI is disabled by default. No background generation, external provider calls, or private content transmission is authorized.

## Working policy

- Never develop on main. Use descriptive approved branch prefixes and issue numbers when available.
- One task, branch and base commit per isolated worktree. Record path, resources and PR target.
- Maximum three concurrent task worktrees. Avoid concurrent file edits. Coordinate schema/migrations through one integration owner.
- Separate writable test databases and storage per worktree; never run tests against production.
- Use exact dependency pins and the pnpm lockfile. Keep contracts/domain reusable for native clients; Prisma and credentials stay server-side.
- UUIDs, UTC timestamps, FK/index integrity, scoped authorization, optimistic versions, and explicit archive/restore apply as records are introduced.
- Keep shared canon separate from overrides. Enforce one scene sequence and two plot-group levels. Never expose live private references through public snapshots.
- No auth bypasses or demo login endpoints. Do not print or commit credentials, real user content, or environment files.

## Verification and reporting

Run applicable format, lint, type, unit, integration, browser/accessibility and build checks. Add meaningful behavior tests. Unavailable remote CI is not a pass.

GitHub Issues are task truth. Search before creating duplicates. Each issue has objective, scope, dependencies, expected modules, acceptance criteria, security considerations, tests, definition of done, and assigned branch.

Milestone reports include name, issues, branch, worktree, base/final SHAs, files, completed scope, tests/results, security findings, migrations, limitations, PR, merge/deployment status, and next milestone. Preserve blocked work and evidence.

## GitHub access and current gates

The canonical private repository, Project and Phase 0 PR #39 are published. Main remains the README bootstrap; no merge/deployment is approved. GitHub rejected private branch protection with a plan-related 403. Do not buy a plan, make source public, invite collaborators, waive checks or merge to bypass this gate.

Cloud GitHub HTTP requests are authenticated as BradyBuilds even without valid Authorization headers. Those responses cannot verify a newly supplied account credential. Do not repeat the cloud device/PAT login loop. Use the linked builtbyb93-tech GitHub connector when its capabilities suffice; administrative operations use the separately authorized Mac with its locally verified builtbyb93-tech OAuth credential. Never transfer or print credentials. Keep local credential storage outside all checkouts and disclose no token values.
