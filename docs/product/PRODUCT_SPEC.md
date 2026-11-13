# Inkwell v0.6

Source: the owner's complete master directive, supplied 2026-11-13. Phase 0 alone is approved for implementation. This specification preserves product requirements; later phases are planned.

**Inkwell** — **Every great story starts somewhere.** Canonical repository: `inkwell`.

A public-facing universal storytelling organization platform for authors, filmmakers, comic creators, video producers, animators and other creators. Capture, organize, develop, connect and retrieve ideas/stories across narrative formats. Prioritize organization over AI generation and specialized publishing tools.

## Primary systems

Creative Dashboard; Idea Vault; Projects and Stories; Shared Universe Story Bible; Story-Specific Story Bible; Plot Board and Scene Organizer; Cross-System Relationships; Search; Autosave and Recovery; Project Import/Export; Read-Only Snapshot Sharing; Account and Privacy Settings.

## Locked decisions

- Public product from day one. Individual workspaces, exactly one per account; multiple stories per project.
- Shared project canon and story-specific canon coexist. Overrides never silently modify shared canon.
- Ideas can link to multiple stories and scenes.
- Flexible plot groups and ordered scenes; at most two nesting levels; one canonical sequence per story.
- Online-first responsive web/PWA; native applications later.
- Optional AI disabled by default; generation not required. No background generation or external private-content transmission without explicit user action.
- Sharing is read-only through revocable snapshots.
- No marketplace, real-time collaborative editing, or advanced screenplay/comic/storyboard editor in MVP.

## Complete phase scope

| Phase | Required capabilities                                                                                                                                                            |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Monorepo, TypeScript/package configuration, format/lint, test infrastructure, Actions, PR/issue templates, environment templates, local Docker, application shell, documentation |
| 1     | Registration, email verification, secure sessions, recovery; individual workspace; project/story CRUD; ownership validation; dashboard shell                                     |
| 2     | Quick Capture, categories, tags, search/filtering, editing, conversion to story/character/scene, multi-target links, archive/restore                                             |
| 3     | Shared/story canon; characters, locations, lore, events, organizations; typed relationships, overrides, backlinks, conflict review                                               |
| 4     | Groups; scene cards/status/detail; board/list; ordering; drag-and-drop, keyboard and mobile movement; character/location/idea links; duplicate/archive                           |
| 5     | Workspace search/filters; autosave, revision conflicts, recovery; structured JSON export; versioned validation, transactional import, relationship remapping                     |
| 6     | Explicit snapshot selection/preview; secure tokens, expiry, revocation, download permissions; public read-only rendering and private assets                                      |
| 7     | Responsive/a11y/authorization audits; rate limits; security; backup restoration; performance; monitoring; deployment documentation; release candidate and approved staging       |

Account/privacy settings accompany identity and release review. Phase 0 shell is not a user account or feature implementation.

## Engineering requirements

Next.js/TypeScript/React; Tailwind and accessible components; PostgreSQL/Prisma; Zod; Tiptap; PostgreSQL FTS; private S3; Auth.js-compatible auth; Vitest/Playwright; pnpm workspaces; Docker/Actions; Coolify on owner VPS. Stable exact pins; prefer self-hosted/free infrastructure. No paid services or hosting substitution without approval.

Versioned REST `/api/v1`, Zod validation, authentication and per-resource authorization, safe consistent errors and native-client-ready contracts. UUIDs, UTC timestamps, FKs/indexes, optimistic concurrency, separate canon/overrides, typed relationships, archive/restore, explicit audited permanent deletion, atomic imports and deterministic order.

Professional minimal responsive UI: accessible typography, light/dark themes, hierarchy, reusable controls, mobile navigation, keyboard access, save states, empty states and useful errors. Avoid unnecessary animation/decoration.

## Security and governance

Secure auth/sessions, server authorization, rate limits, validation, private storage, workspace isolation, token protection, safe errors, secret/dependency scanning and protected backups. Never commit real credentials or private content.

One canonical repository, protected main, PR/check/owner approval before merging. At most three task worktrees, separate writable test resources, central migration coordination. No unreviewed production deployment. Forks only for external contributors, independent repository experiments or explicit owner requests; untrusted workflows receive no production secrets.

Approval is required for repository creation, scope/major architecture changes, paid dependencies, infrastructure, destructive actions, merging, production migrations/deployment and DNS. Staging/production use separate configurations, databases, storage credentials and secrets. Release uses approved commits or immutable images.
