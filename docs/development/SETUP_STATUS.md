# Phase 0 setup status

Current update: Phase 0 PR #39 merged at `9ca76167ec8a0c0ff58a914592715a21e64c7de1` after owner approval and all five passing checks on feature head `4d51b650a67535b243a9ae413222966f43640b69` (CI run 43452416799). Issues #1–#6 and milestone 1 are complete/closed. Phase 1 implementation is authorized on its isolated branch; its merge and all deployment remain gated. No invitations or review requests are authorized. The details below preserve the original setup history.

The owner approved Phase 0 on 2026-11-13 and selected builtbyb93-tech. Merging, later milestones, VPS provisioning, production migrations/deployment, destructive actions and DNS changes remain outside that authorization.

## Published resources

- Public canonical repository (owner-approved visibility): https://github.com/builtbyb93-tech/inkwell.
- Project: https://github.com/users/builtbyb93-tech/projects/1.
- Draft foundation PR: https://github.com/builtbyb93-tech/inkwell/pull/39.
- Phase 0 issues: #1 through #6. Full plan: 38 issues, 8 milestones and all 15 requested labels.
- Project statuses: Backlog, Ready, In Progress, Review, Approved, Complete, Blocked.
- Main contains only the approved README bootstrap f32e82185ebf637238e9f2e6e1f0e999175779dc.
- Feature branch: chore/phase-0-engineering-foundation; task worktree /workspace/inkwell-worktrees/phase-0; administrative checkout /workspace/inkwell.

## Verified access route

Cloud GitHub requests return BradyBuilds even with missing/invalid credentials, so those account checks could not validate the user's authorization. The owner-authorized Mac returns 401 for anonymous access and correctly verified a fresh OAuth authorization as builtbyb93-tech. Administrative operations use that Mac; supported repository/PR operations use the linked GitHub connector.

Credentials remain outside source with restricted permissions. An attempted existing-credential transfer was rejected by automatic review and was not performed. A PAT appeared in terminal history during manual entry; it was not saved by the verification helper, and the owner was instructed to revoke it. Do not use or reproduce it. The Mac uses a separately issued, unexposed OAuth credential.

A local bare publication mirror on the Mac transports the same canonical repository and commits; it is not a fork or a development worktree. Cloud development remains isolated in the approved worktree.

## Remaining gate

The owner explicitly approved making the source repository public on 2026-11-13. GitHub accepted main protection after the visibility transition completed. Verified settings require quality, integration, browser, container and security checks; strict up-to-date status; zero required GitHub reviews; dismissal of stale reviews; resolved conversations; linear history; and enforcement for administrators. Force pushes and deletion are disabled. Auto-merge remains disabled. No paid plan was purchased; the Project remains private.

The owner explicitly approved zero required GitHub reviews and merging PR #39 once checks pass. Required PRs, all CI checks, admin enforcement, conversation resolution and separate owner approval for future merges remain. No invitations, review requests or deployment are authorized.

CI results and actual published references are recorded in PHASE_0_REPORT.md and the owner handoff. Planning resources are real GitHub issues, not a substitute local status tracker. No issue is marked complete before verified acceptance and approved merge.

No VPS resources, production schema, deployment or DNS were changed. Local test resources remain separate from staging/production.
