# Inkwell

Every great story starts somewhere.

Inkwell helps creators capture, organize, develop, connect, and retrieve ideas and stories across narrative formats.

Phase 0 engineering foundation. The responsive shell, themes, operational endpoints, local database foundation, and test/build tooling are implemented. Authentication and creative tools are not implemented. No private or fabricated user data is shown. No service worker or offline editing is enabled.

The canonical private repository is [builtbyb93-tech/inkwell](https://github.com/builtbyb93-tech/inkwell). [Draft PR #39](https://github.com/builtbyb93-tech/inkwell/pull/39) contains the foundation. Planning is published on the [Inkwell Project](https://github.com/users/builtbyb93-tech/projects/1). Protected main is blocked by the current GitHub plan; see [setup status](docs/development/SETUP_STATUS.md).

## Local development

Requires Node **24.22.1**, pnpm **11.25.0**, and Docker Compose.

```sh
pnpm install --frozen-lockfile
cp .env.example .env
docker compose up -d --wait postgres
pnpm db:migrate
pnpm db:generate
pnpm dev
```

Open `http://127.0.0.1:3000`. Root development and database scripts load `.env`. The shell also runs without database configuration; readiness then returns 503.

```sh
pnpm check
pnpm db:validate
pnpm test:integration
pnpm exec playwright install --no-shell chromium
pnpm test:e2e
docker build -f deploy/Dockerfile -t inkwell:phase0 .
```

For a managed network with an additional trusted certificate authority, pass its public CA file as an optional BuildKit secret: `--secret id=build_ca,src=/path/to/approved-ca.crt`. The mount exists only during dependency installation, is not copied into the runtime, and does not disable TLS verification. Do not pass credentials as build arguments.

Integration tests create, migrate, test, and remove a unique local database. They refuse remote hosts and unrelated database names. Separate worktrees need distinct Compose project names, ports, databases and environment files. Never use production credentials. `.env.example` contains public local-only examples; real `.env` files are ignored.

In restricted workspaces, prefix pnpm commands with writable cache settings: `XDG_DATA_HOME=/tmp/inkwell-tools/data XDG_CACHE_HOME=/tmp/inkwell-tools/cache`.

## Repository map

- `apps/web`: Next.js and REST route handlers.
- `packages/domain`, `contracts`, `db`: reusable rules, Zod DTOs, Prisma/SQL.
- `packages/ui`, `editor`, `config`: accessible controls, free Tiptap baseline, shared configuration.
- `tests`: unit, integration, browser/accessibility checks.
- `deploy`: container artifacts; no automatic deployment.

Start with [PRODUCT_SPEC](docs/product/PRODUCT_SPEC.md), [MVP_SCOPE](docs/product/MVP_SCOPE.md), [SYSTEM_DESIGN](docs/architecture/SYSTEM_DESIGN.md), and [ACCEPTANCE_CRITERIA](docs/testing/ACCEPTANCE_CRITERIA.md). Exact pins are recorded in [VERSIONS](docs/development/VERSIONS.md) and the lockfile.

One canonical repository; feature branches and isolated worktrees; main is administrative. Each milestone ends with evidence and a PR. Owner approval is required before merging. Provisioning, production migrations/deployment, destructive actions, and DNS changes have separate approval gates. No paid dependency or hosting substitution is authorized.
