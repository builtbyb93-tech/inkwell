# Data model

Phase 0 migrated User/Workspace. Phase 1 adds password/verification/profile/revocation/version fields, AuthToken, AuthSession, RateLimitBucket, Project and Story through additive migration `20261113010000_accounts_projects`. The remaining aggregates below are planned.

| Aggregate   | Records/invariants                                                                                                                                               |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity    | User; Workspace.ownerId unique FK. Phase 1 adds verification/password/session/revocation/reset records and atomic account/workspace creation.                    |
| Project     | Workspace-owned Project; Project-owned Story; scope participates in child constraints.                                                                           |
| Vault       | Idea, Category, Tag, IdeaTag; explicit multi-target and conversion/provenance tables.                                                                            |
| Canon       | Typed Character, Location, Lore, Event, Organization; explicit shared/story-local scope and separate typed override rows retaining base revision/field presence. |
| Plot        | Story-owned PlotGroup and Scene; scene status, content, version, archive, canonical order; typed character/location/idea joins.                                  |
| Reliability | Version metadata, bounded recovery according to approved retention, import and private asset-staging state.                                                      |
| Sharing     | Immutable Snapshot/content/asset manifest; hashed ShareToken; expiry/revocation/download policy.                                                                 |
| Audit       | Explicit authorized deletion/import events with approved retention; no private content in generic logs.                                                          |

Use UUIDs and UTC timestamptz, FKs/indexes and scoped composite constraints where appropriate. Application IDs never replace authorization. Unique ownerId enforces at most one workspace in Phase 0; Phase 1 registration creates exactly one atomically.

Editable rows have integer versions; scoped conditional writes fail with conflict when stale. Archive/restore preserves provenance. Permanent deletion is explicit/auditable and cannot silently cascade away shared/story information. Hosted runtime roles cannot manage schema.

## Ordering and nesting

One canonical sequence per story independent of group/view. Moves coordinate on the story, compare sequenceVersion and update order in one transaction. The Plot Board ADR defines retry/collision strategy. Root groups can contain one child level only; reject cycles, third levels and mismatched stories through transaction locking and SQL integrity checks. A CHECK alone cannot validate another row's depth.

## Content and portability

Persist validated versioned Tiptap JSON plus derived safe text. Bound size/node types/URL schemes. PostgreSQL FTS uses indexed tsvectors and ownership/archive predicates; dictionary choice is explicit. Validate import version/shape/limits, allocate IDs, remap all links, check scope and commit atomically. Stage assets privately, publish only committed manifests, clean failed staging.

## Phase 1 integrity and concurrency

Registration creates the User and its sole Workspace in one nested transaction; ownerId uniqueness rejects a second workspace. Tokens store hashes and UTC expiry/consumption; sessions store authVersion plus expiry/revocation. Account-row locking serializes token issue/consume/reset and prevents stale-password sign-in races. Seven-day sessions require both valid encrypted JWT and current registry/user state.

Project belongs to Workspace. Story has its own Workspace FK and composite `(projectId,workspaceId)` FK to Project `(id,workspaceId)`; cross-workspace parents fail at the database boundary. Creative FKs restrict deletion. Every read/write includes workspace scope. Editable creative fields have integer versions; conditional writes compare version and increment atomically. Parent-row locking serializes story mutation against project archiving. Updating a child touches the parent's activity timestamp without changing the version of its editable fields.

Archive/restore preserves children and original content. No permanent creative deletion exists. Migration is additive and has only been applied to disposable/local databases. A hosted migration/recovery plan and owner approval are still required before production. Security token/session retention and hosted runtime-role grants need operational review before public release.
