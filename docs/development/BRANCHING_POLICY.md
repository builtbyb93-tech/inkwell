# Branches, worktrees and review

Canonical repository: `builtbyb93-tech/inkwell`, public source, explicitly approved by the owner on 2026-11-13. No routine forks.

Protected branch: `main`. Allowed prefixes: `feature/`, `fix/`, `refactor/`, `test/`, `docs/`, `chore/`, `experiment/`, `release/`, `hotfix/`. Prefer `<prefix>/<issue>-description`. Start at latest approved main unless a dependency branch/integration plan is explicitly approved. Never force-push shared branches or rewrite main.

The approved bootstrap exception permits one minimal README initialization commit on main. All development follows through PRs. Verified main controls: PR required; one eligible non-author approval; dismiss stale approvals; resolve conversations; required CI; block force-push/deletion; disable auto-merge. These rules enforce administrators and require strict up-to-date CI plus linear history. Reviewer availability remains an owner decision.

Owner approval in chat is required before merging; it does not manufacture a GitHub review or override missing protection. No production deployment from unreviewed features.

## Allocation

| Purpose                 | Branch/path                                                                  | Base and target                                   |
| ----------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------- |
| Administrative checkout | main, `/workspace/inkwell`                                                   | bootstrap only; no feature edits                  |
| Phase 0 task            | chore/phase-0-engineering-foundation, `/workspace/inkwell-worktrees/phase-0` | `f32e82185ebf637238e9f2e6e1f0e999175779dc` → main |

Repository and issues are published. Phase 0 issues #1–#6 share this cohesive foundation branch; its descriptive name is retained. The bootstrap base is published on main. Draft PR #39 targets main. The owner approved public visibility after GitHub rejected private branch protection on the current plan. The repository is now public and main protection is configured and verified. No paid upgrade occurred. A non-author reviewer is still required; no collaborator has been invited and no merge is authorized.

At most three active task worktrees later, each with one branch/task, recorded base/path/PR target, independent tests and separate DB/storage/ports. Initially use one. Do not concurrently edit schema/migrations or shared files without an approved integration plan. One schema integration owner sequences migrations. Do not delete unmerged worktrees/branches without approval.

Forks are reserved for external contributors, independent repository-boundary experiments, or owner request. Untrusted fork CI receives no production secrets.
