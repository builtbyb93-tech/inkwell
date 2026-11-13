# ADR-003: private repository administration and protection

Status: blocked pending verified administration access and plan support.

Approved owner: builtbyb93-tech. The connector reads its existing repositories but lacks repository/Project/label/milestone/protection creation tools. The cloud CLI and two device authorizations resolve to BradyBuilds. Do not create under that account or assume its rights apply to the selected owner.

Recommendation: obtain securely configured CLI access whose verified login is builtbyb93-tech, then create the canonical private repository and planning infrastructure. Never put tokens in chat or source. GitHub CLI storage in this workspace has no OS keyring, so credential files must stay outside the checkout with restricted permissions.

Verify private-plan branch protection support, Projects scope and an eligible non-author reviewer. If unavailable, report a blocker. Do not silently weaken controls, switch repository visibility, buy a plan, auto-merge or use forks as a workaround.

The owner approved a minimal README bootstrap on main; feature work uses a dedicated branch/worktree. No remote creation, GitHub review, CI pass or protected-main status is asserted by local preparation.
