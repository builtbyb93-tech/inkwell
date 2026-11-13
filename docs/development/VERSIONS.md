# Exact versions

Registry metadata checked 2026-11-13. package.json and pnpm-lock.yaml are authoritative for installed dependencies; this table distinguishes installed foundations from future recommendations.

| Component                        | Exact version         | Status                                                                                 |
| -------------------------------- | --------------------- | -------------------------------------------------------------------------------------- |
| Node                             | 24.22.1               | Required runtime; Docker image pinned by digest                                        |
| pnpm                             | 11.25.0               | Required; packageManager pin                                                           |
| TypeScript                       | 5.9.3                 | Installed; supported by selected lint parser                                           |
| Next.js                          | 16.4.6                | Installed                                                                              |
| React / React DOM                | 19.3.1                | Installed                                                                              |
| Tailwind / PostCSS integration   | 4.3.5                 | Installed                                                                              |
| Prisma / Client / PG adapter     | 7.10.1                | Installed, matched versions; reject Prisma latest RC                                   |
| PostgreSQL                       | 17.12-bookworm        | Local/CI image digest 40865bc877a289da75963d97d72b59633f639fc5af7a4e856bfa3714cae5b536 |
| pg / types                       | 8.23.1                | Installed                                                                              |
| Zod                              | 4.6.7                 | Installed                                                                              |
| Tiptap core/pm/react/starter-kit | 3.33.1                | Installed free extensions; authoring not exposed                                       |
| Accessible controls              | Native semantic React | Equivalent baseline, no unused component library                                       |
| ESLint / @eslint/js              | 10.14.0 / 10.0.1      | Installed                                                                              |
| typescript-eslint                | 8.72.2                | Installed; supports ESLint 10 and TypeScript below 6.1                                 |
| Next lint plugin                 | 16.4.6                | Installed                                                                              |
| Prettier                         | 3.10.1                | Installed                                                                              |
| Vitest                           | 5.1.0                 | Installed                                                                              |
| Playwright                       | 1.65.0                | Installed                                                                              |
| axe Playwright                   | 4.14.0                | Installed                                                                              |
| Gitleaks                         | 8.30.1                | Checksummed Linux x64 scanner bootstrap                                                |
| NextAuth / Prisma auth adapter   | 4.24.15 / 1.0.7       | Recommended Phase 1; not installed; ADR proof required                                 |
| AWS S3 client                    | 3.1168.0              | Candidate for storage work; not installed                                              |
| Garage                           | v2.5.0                | ADR candidate; not provisioned                                                         |
| Coolify                          | 4.7.5                 | Observed existing VPS; not changed                                                     |

The broad Next ESLint preset pulled plugins whose peers exclude ESLint 10. The foundation uses maintained ESLint 10, typescript-eslint and the Next plugin directly, with browser axe checks. It does not suppress incompatible peers or retain deprecated ESLint 9. pnpm allowBuilds explicitly permits the two required Prisma installation scripts.

Node image: `node:24.22.1-bookworm-slim@sha256:be8204d4bd327363357f532187b752ff62759c31bedf98e9e18fc08c9cbd605c`. Workflow actions use verified commit SHAs with version comments. Recheck advisories and compatibility during updates; metadata is not test evidence.
