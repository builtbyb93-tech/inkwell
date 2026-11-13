# Inkwell

Every great story starts somewhere.

Inkwell helps creators capture, organize, develop, connect, and retrieve ideas and stories across narrative formats.

Phase 0 is merged in [PR #39](https://github.com/builtbyb93-tech/inkwell/pull/39). Phase 1 adds verified accounts, password recovery, revocable sessions, one private workspace per account, persistent projects and multiple stories, a dashboard, archive/restore, optimistic edit protection, and account/privacy settings. AI remains disabled. Vault, canon, Plot Board, autosave, import/export, sharing, and offline editing arrive in later milestones.

The canonical public repository is [builtbyb93-tech/inkwell](https://github.com/builtbyb93-tech/inkwell). Planning lives on the private [Inkwell Project](https://github.com/users/builtbyb93-tech/projects/1). Main requires PRs and all five passing CI checks; the owner approved zero required GitHub reviews for solo development. Every merge still needs explicit owner approval. No collaborators are invited.

## Local development

Requires Node **24.22.1**, pnpm **11.25.0**, and Docker Compose.

```sh
pnpm install --frozen-lockfile
cp .env.example .env
# Generate a fresh NEXTAUTH_SECRET and set it in .env:
node --input-type=module -e "import fs from 'node:fs'; import {randomBytes} from 'node:crypto'; fs.writeFileSync('.env', fs.readFileSync('.env', 'utf8').replace(/^NEXTAUTH_SECRET=.*$/m, 'NEXTAUTH_SECRET='+randomBytes(32).toString('base64url')), {mode:0o600})"
docker compose -f compose.yaml -f compose.mail.yaml up -d --wait
pnpm db:migrate
pnpm db:generate
pnpm dev
```

Open `http://127.0.0.1:3000`. Root development and database scripts load `.env`. Register an account, then open the local email inbox at `http://127.0.0.1:18025` to verify it. Local mail is captured, not delivered to external recipients. Auth requires a generated secret, database, and SMTP configuration; health remains dependency-independent.

```sh
pnpm check
pnpm db:validate
pnpm test:integration
pnpm exec playwright install --no-shell chromium
pnpm test:e2e
docker build -f deploy/Dockerfile -t inkwell:phase1 .
```

For a managed network with an additional trusted certificate authority, pass its public CA file as an optional BuildKit secret: `--secret id=build_ca,src=/path/to/approved-ca.crt`. The mount exists only during dependency installation, is not copied into the runtime, and does not disable TLS verification. Do not pass credentials as build arguments.

Integration and browser tests each create, migrate, test, and remove their own unique local database. Browser tests start a production server with a fresh test-only session secret. Both need the local PostgreSQL/Mailpit services. They refuse remote hosts and unrelated database names. Separate worktrees need distinct Compose project names, ports, databases and environment files. Never use production credentials. `.env.example` contains public local-only examples; real `.env` files are ignored.

In restricted workspaces, prefix pnpm commands with writable cache settings: `XDG_DATA_HOME=/tmp/inkwell-tools/data XDG_CACHE_HOME=/tmp/inkwell-tools/cache`.

## Repository map

- `apps/web`: Next.js and REST route handlers.
- `packages/domain`, `contracts`, `db`: reusable rules, Zod DTOs, Prisma/SQL.
- `packages/mail`: server-only SMTP adapter with patched dependencies.
- `packages/ui`, `editor`, `config`: accessible controls, free Tiptap baseline, shared configuration.
- `tests`: unit, integration, browser/accessibility checks.
- `deploy`: container artifacts; no automatic deployment.

Start with [PRODUCT_SPEC](docs/product/PRODUCT_SPEC.md), [MVP_SCOPE](docs/product/MVP_SCOPE.md), [SYSTEM_DESIGN](docs/architecture/SYSTEM_DESIGN.md), and [ACCEPTANCE_CRITERIA](docs/testing/ACCEPTANCE_CRITERIA.md). Exact pins are recorded in [VERSIONS](docs/development/VERSIONS.md) and the lockfile.

One canonical repository; feature branches and isolated worktrees; main is administrative. Each milestone ends with evidence and a PR. Owner approval is required before merging. Provisioning, production migrations/deployment, destructive actions, and DNS changes have separate approval gates. No paid dependency or hosting substitution is authorized.
