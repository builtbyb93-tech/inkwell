# Branches, worktrees and review

Canonical repository: `builtbyb93-tech/inkwell`, public source, explicitly approved by the owner on 2026-11-13. No routine forks.

Protected branch: `main`. Allowed prefixes: `feature/`, `fix/`, `refactor/`, `test/`, `docs/`, `chore/`, `experiment/`, `release/`, `hotfix/`. Prefer `<prefix>/<issue>-description`. Start at latest approved main unless a dependency branch/integration plan is explicitly approved. Never force-push shared branches or rewrite main.

The approved bootstrap exception permits one minimal README initialization commit on main. All development follows through PRs. Verified main controls: PR required; zero required GitHub reviews; dismiss stale approvals; resolve conversations; required CI; block force-push/deletion; disable auto-merge. These rules enforce administrators and require strict up-to-date CI plus linear history. Reviewer availability remains an owner decision.

Owner approval in chat is required before merging; it does not manufacture a GitHub review or override missing protection. No production deployment from unreviewed features.

## Allocation

| Purpose                 | Branch/path                                                                  | Base and target                                   |
| ----------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------- |
| Administrative checkout | main, `/workspace/inkwell`                                                   | bootstrap only; no feature edits                  |
| Phase 0 task            | chore/phase-0-engineering-foundation, `/workspace/inkwell-worktrees/phase-0` | `f32e82185ebf637238e9f2e6e1f0e999175779dc` → main |

Repository and issues are published. Phase 0 issues #1–#6 share this cohesive foundation branch; its descriptive name is retained. The bootstrap base is published on main. Draft PR #39 targets main. The owner approved public visibility after GitHub rejected private branch protection on the current plan. The repository is now public and main protection is configured and verified. No paid upgrade occurred. The owner approved the solo-owner workflow and merging PR #39 after passing checks. No collaborator invitations or review requests are authorized.

At most three active task worktrees later, each with one branch/task, recorded base/path/PR target, independent tests and separate DB/storage/ports. Initially use one. Do not concurrently edit schema/migrations or shared files without an approved integration plan. One schema integration owner sequences migrations. Do not delete unmerged worktrees/branches without approval.

Forks are reserved for external contributors, independent repository-boundary experiments, or owner request. Untrusted fork CI receives no production secrets.

## Phase 1 execution

Phase 0 PR #39 merged at `9ca76167ec8a0c0ff58a914592715a21e64c7de1`; issues #1–#6 and milestone 1 closed after verified merge. Phase 1 issues #7–#12 share cohesive branch `feature/7-account-project-foundation`, worktree `/workspace/inkwell-worktrees/phase-1`, base that merge commit, target main. The owner approved implementation; Phase 1 merge/deployment remain unapproved. PostgreSQL uses Compose project inkwell_phase1 and loopback port 55433; SMTP/inbox use 11025/18025. Every SQL/browser run has an independent generated database. Phase 0 worktree/branch remain intact; only disposable generated dependencies/build caches were removed to recover local disk. No unrelated resources were modified.

## Phase 2 execution

The owner approved implementation/tests/PR preparation only. Issues #13–#16 share branch `feature/13-idea-vault`, worktree `/workspace/inkwell-worktrees/phase-2`, base `328e9ed0e55ebfc9303b2b1ca012193ee6684f86`, target main. This is the third task worktree; earlier branches/source are retained. Local resources use Compose project inkwell_phase2, PostgreSQL 55434, SMTP 11026, inbox 18026, app 3001 and browser 3200. Tests still create their own UUID databases. Only generated Phase 1 dependencies/build output and its local containers were reclaimed; its data volume/source remain. Phase 2 merge/deployment require separate owner approval. No forks/invitations/review requests were made.
