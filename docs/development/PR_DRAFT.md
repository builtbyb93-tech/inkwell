# Phase 0: establish Inkwell engineering foundation

Published draft: https://github.com/builtbyb93-tech/inkwell/pull/39. Tasks: #1, #2, #3, #4, #5, #6.

Inkwell needs a reproducible foundation before private creative features are introduced. This change establishes the modular pnpm/Next.js workspace, accessible responsive shell and themes, versioned operational API, Prisma/local PostgreSQL foundation, Docker runtime, CI, planning infrastructure and v0.6 documentation.

Local verification includes 17 unit/integration/browser tests, frozen installs, lint/types/format, build/container, secrets and dependency auditing. CI run 1 passed on implementation commit 8c4c31d; consult the PR for checks on the latest documentation update. One moderate development-only minimatch advisory remains documented; production dependency audit is clean.

Authentication and creative tools are later milestones. The current SQL migration creates User/Workspace foundations and was exercised only on local disposable databases. Hosted resources and deployment are not enabled.

GitHub's current plan blocks protected main for this private repository. Keep the repository private and do not merge until that gate and a non-author review are resolved and the owner explicitly approves. No upgrade, collaborator invitation or deployment is authorized automatically.
