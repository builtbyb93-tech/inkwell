# Phase 0 setup status

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

The owner explicitly approved making the source repository public on 2026-11-13. GitHub accepted main protection after the visibility transition completed. Verified settings require quality, integration, browser, container and security checks; strict up-to-date status; one non-author approval; dismissal of stale reviews; resolved conversations; linear history; and enforcement for administrators. Force pushes and deletion are disabled. Auto-merge remains disabled. No paid plan was purchased; the Project remains private.

A non-author reviewer with eligible repository access is still needed; the only current collaborator is the PR author/owner. No additional collaborator has been invited. No PR is merged or approved automatically. Owner approval of public visibility does not authorize merging or deployment.

CI results and actual published references are recorded in PHASE_0_REPORT.md and the owner handoff. Planning resources are real GitHub issues, not a substitute local status tracker. No issue is marked complete before verified acceptance and approved merge.

No VPS resources, production schema, deployment or DNS were changed. Local test resources remain separate from staging/production.
