# Inkwell engineering instructions

The owner's v0.6 directive and explicit approvals govern. Read product, architecture, security, testing, and development documents for the area being changed.

## Scope and approvals

- Current authorization: Phases 0–3 are merged. The owner authorized continuation into Phase 4 Plot Board (#21–#25) and approved all in-scope Inkwell PR merges after required checks and review. Do not ask again for that merge authorization. Never enable auto-merge or bypass protection. Deployment, hosted migrations/infrastructure, DNS, destructive actions, paid dependencies and scope/major architecture changes remain separately gated.
- Standing owner approval covers reviewed, tested, in-scope PR merges. Do not enable auto-merge.
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

The owner explicitly approved public source visibility on 2026-11-13. The canonical repository is public; the Project remains private. Main protection is verified: all five CI checks, zero required GitHub reviews, stale-review dismissal, conversation resolution and admin enforcement; force pushes/deletion are blocked. Auto-merge is disabled. Do not weaken these controls, invite collaborators, merge or deploy without the relevant owner authorization. No paid plan was purchased. Phase 0 PR #39 merged at `9ca76167ec8a0c0ff58a914592715a21e64c7de1`. Phase 1 work uses `feature/7-account-project-foundation` in `/workspace/inkwell-worktrees/phase-1`, based on that merge; target main. Keep Phase 0 worktree/branch intact.

Cloud GitHub HTTP requests are authenticated as BradyBuilds even without valid Authorization headers. Those responses cannot verify a newly supplied account credential. Do not repeat the cloud device/PAT login loop. Use the linked builtbyb93-tech GitHub connector when its capabilities suffice; administrative operations use the separately authorized Mac with its locally verified builtbyb93-tech OAuth credential. Never transfer or print credentials. Keep local credential storage outside all checkouts and disclose no token values.

Owner approval update: zero required GitHub reviews is the approved solo-owner policy. Required PRs, five strict CI checks, admin enforcement, conversation resolution and explicit owner approval for every merge remain. No invitations or review requests may be sent.
