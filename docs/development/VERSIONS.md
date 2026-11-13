# Exact versions

Registry metadata checked 2026-11-13. package.json and pnpm-lock.yaml are authoritative for installed dependencies; this table distinguishes installed foundations from future recommendations.

| Component                        | Exact version         | Status                                                                           |
| -------------------------------- | --------------------- | -------------------------------------------------------------------------------- |
| Node                             | 24.22.1               | Required runtime; Docker image pinned by digest                                  |
| pnpm                             | 11.25.0               | Required; packageManager pin                                                     |
| TypeScript                       | 5.9.3                 | Installed; supported by selected lint parser                                     |
| Next.js                          | 16.4.6                | Installed                                                                        |
| React / React DOM                | 19.3.1                | Installed                                                                        |
| Tailwind / PostCSS integration   | 4.3.5                 | Installed                                                                        |
| Prisma / Client / PG adapter     | 7.10.1                | Installed, matched versions; reject Prisma latest RC                             |
| PostgreSQL                       | 17.12-bookworm        | CI image digest 40865bc877a289da75963d97d72b59633f639fc5af7a4e856bfa3714cae5b536 |
| pg / types                       | 8.23.1                | Installed                                                                        |
| Zod                              | 4.6.7                 | Installed                                                                        |
| Tiptap core/pm/react/starter-kit | 3.33.1                | Installed free extensions; authoring not exposed                                 |
| Accessible controls              | Native semantic React | Equivalent baseline, no unused component library                                 |
| ESLint / @eslint/js              | 10.14.0 / 10.0.1      | Installed                                                                        |
| typescript-eslint                | 8.72.2                | Installed; supports ESLint 10 and TypeScript below 6.1                           |
| Next lint plugin                 | 16.4.6                | Installed                                                                        |
| Prettier                         | 3.10.1                | Installed                                                                        |
| Vitest                           | 5.1.0                 | Installed                                                                        |
| Playwright                       | 1.65.0                | Installed                                                                        |
| axe Playwright                   | 4.14.0                | Installed                                                                        |
| Gitleaks                         | 8.30.1                | Checksummed Linux x64 scanner bootstrap                                          |
| NextAuth                         | 4.24.15               | Installed Credentials/JWT; app session registry, no Prisma adapter               |
| AWS S3 client                    | 3.1168.0              | Candidate for storage work; not installed                                        |
| Garage                           | v2.5.0                | ADR candidate; not provisioned                                                   |
| Coolify                          | 4.7.5                 | Observed existing VPS; not changed                                               |

The broad Next ESLint preset pulled plugins whose peers exclude ESLint 10. The foundation uses maintained ESLint 10, typescript-eslint and the Next plugin directly, with browser axe checks. It does not suppress incompatible peers or retain deprecated ESLint 9. pnpm allowBuilds explicitly permits the two required Prisma installation scripts.

Node image: `node:24.22.1-bookworm-slim@sha256:be8204d4bd327363357f532187b752ff62759c31bedf98e9e18fc08c9cbd605c`. Workflow actions use verified commit SHAs with version comments. Recheck advisories and compatibility during updates; metadata is not test evidence.

Phase 1 installed additions: @node-rs/argon2 **2.2.2**, Nodemailer **10.5.0** (packages/mail only; bundled types), Vite **8.3.8**, Mailpit **v1.33.1** at digest `aef2aacc11f075ec0fb6874275ee4a421e688e11a96ebb296134d1735c7761ce`. Local PostgreSQL stays **17.12**, using the Alpine variant digest `34261f594522cf41dfcb76aefd42b9d201098b0e6b23c9c68733f169e4218b6f` to fit the managed workspace's VFS storage. CI retains the pinned Bookworm variant. No VPS version was changed. Automatic peer installation is disabled; all required peers are explicit and checked. NextAuth's unused optional Nodemailer 7 peer is absent, not overridden. Audit evidence is recorded in the Phase 1 report.
