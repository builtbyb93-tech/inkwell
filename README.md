# Inkwell

Every great story starts somewhere.

Inkwell helps creators capture, organize, develop, connect, and retrieve ideas and stories across narrative formats.

Phase 0 is merged in [PR #39](https://github.com/builtbyb93-tech/inkwell/pull/39). [Phase 1 PR #40](https://github.com/builtbyb93-tech/inkwell/pull/40) is merged and adds verified accounts, password recovery, revocable sessions, one private workspace per account, persistent projects and multiple stories, a dashboard, archive/restore, optimistic edit protection, and account/privacy settings. AI remains disabled. Phase 2 adds Idea Vault capture, structured editing, categories/tags, indexed search, multi-target references and source-preserving conversions. Phase 3 adds shared/story-specific Story Bibles, five canon kinds, typed relationships/backlinks and separate explicit overrides/conflict review. Phase 4 adds Plot Board groups, linked scene editing/status, one atomic scene sequence, responsive board/list movement and source-preserving duplication/archive. Autosave, import/export, sharing and offline editing arrive in later milestones.

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

Open `http://127.0.0.1:3003`. Root development and database scripts load `.env`. Register an account, then open the local email inbox at `http://127.0.0.1:18028` to verify it. Local mail is captured, not delivered to external recipients. Auth requires a generated secret, database, and SMTP configuration; health remains dependency-independent.

```sh
pnpm check
pnpm db:validate
pnpm test:integration
pnpm exec playwright install --no-shell chromium
pnpm test:e2e
docker build -f deploy/Dockerfile -t inkwell:phase4 .
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

Open Story Bible from the navigation to choose a shared project Bible, or open a story and choose its Story Bible. Shared edits require project context; local records and overrides stay specific to their story. See ADR-007 for scope, typed links, explicit clears and conflict review. PR #41 (Phase 2) merged at `57bc6ba`; Phase 3 PR #42 merged at `889dc16`; standing owner approval covers subsequent in-scope PR merges after checks/review. Deployment remains separately gated.

Plot Board is available from navigation or each story. Board/list share canonical scene numbers; desktop drag and keyboard/mobile move controls use the same versioned sequence contract. Root/child groups organize views without separate orders. See ADR-008 for ordering, typed links, archive and duplicate semantics. Owner standing approval covers in-scope reviewed/tested PR merges; deployment remains separately gated.

### Phase 5 — search, recovery and portability

The workspace now has Search, project JSON export and validated separate-project import. Existing creative editors autosave with visible acknowledgement, preserved newer typing and explicit stale-edit comparison. New records and canon inheritance/review decisions remain explicit saves. Account & privacy controls optional seven-day recovery on this browser; sign-out clears its drafts. Recovery depends on browser storage and never replaces online persistence or a backup.

The private version 1 archive includes archived content, canon override bases, scene order/copy ancestry, relationships and relevant Idea sources. It excludes unrelated project links and account/session data. Limits are 8 MiB and 10,000 archive rows; imports commit transactionally with remapped IDs. See ADR-009–011 and API contracts. No hosted migration/deployment has been performed; Phase 6 snapshot sharing and Phase 7 release gates remain.

### Phase 6 — read-only snapshots

Open **Snapshot sharing** or a project's **Share selected content** action. Choose records and optional connections, create a private frozen copy, preview it, then explicitly choose link expiry and JSON download permission. Source edits stay private. Revoke links from the same preview; raw links are shown only once. Shared copies contain new IDs and no live private traversal. Revocation blocks future requests; it cannot recall content recipients already copied.

For local/CI sharing tests, run `pnpm storage:local` after configuring the worktree's local .env; it creates an isolated private Garage service and ignored credentials. Then run the normal integration/browser suites. Do not point test tooling at hosted storage. Hosted S3 configuration, backup/restore and Coolify activation remain separately approved release work. See ADR-012 and the API/security/deployment plans.
