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

## Phase 2 vault foundation

Migrations `20261113020000_idea_vault` and `20261113020100_rich_text_versions` add Idea/Category/Tag/assignment, typed Story/Scene links, minimal shared Character/ordered Scene, immutable typed conversion provenance and document-format versions. Idea is workspace-wide; every destination has a qualified project/story chain enforced by composite FKs. The conversion CHECK enforces exactly one target, with a parent Story required for Scene. Scope/FK/backlink indexes and generated tsvector/GIN support authorized retrieval. Generated search SQL is migration-owned; do not replace it with a plain default during later schema work.

Rich-text format version, optimistic record version and sequenceVersion are separate. Every write validates/derives the document and plain text; snapshots remain independent of later source changes. References and conversion snapshots survive archival. All new creation/conversion paths are transactional. Parent locks serialize appends; unknown future document versions fail safely. No permanent creative deletion, full canon/override or Plot Board management is introduced. ADR-005/006 specify the boundary and retry semantics.

## Phase 3 concrete canon

Migration `20261113030000_story_bible` extends the existing Character SQL table into Prisma CanonRecord with closed five-kind enum, immutable SHARED/STORY scope, qualified nullable story FK and scope CHECK. Existing Character IDs, content and provenance remain in place. Separate CanonOverride rows track field presence, clear/custom values, base versions and snapshots. Separate CanonRelationship rows use concrete qualified endpoints, typed/context triggers, archive versions, forward/backlink indexes and shared partial uniqueness. Conversion guards permit only shared Characters as IdeaConversion character targets. ADR-007 records alternatives and the integrity safeguards.

Shared/local rows coexist independently; override writes never alter shared canon. Name/notes are the MVP conflict fields. Same-project writes serialize on the active Project; local/story operations also lock the active Story. Effective reads use a consistent snapshot. Archive/restore preserves graph/override state; no permanent creative deletion exists. SQL guards, partial indexes and generated Vault FTS remain migration-owned. New migration is local/disposable only; deployment requires approved migration/recovery and owner authorization.

## Phase 4 plot integrity

Migration `20261113040000_plot_board` adds PlotGroup, SceneStatus, scoped Scene.groupId and immutable Scene.duplicatedFromId, plus explicit SceneCharacterLink/SceneLocationLink. Qualified FKs and SQL triggers enforce root/child depth, acyclic parentage, same-story groups and typed applicable canon endpoints. Existing scenes retain IDs/content/positions/source links. The existing scene order uniqueness becomes a deferred-capable constraint using its original index; deferrability is migration-owned and must not be lost in later Prisma diffs.

ADR-008 defines the one canonical sequence, archived-row retention, conditional sequence versions, content-vs-structural versions, batched atomic permutation writes and non-destructive archive/restore semantics. New link/copy IDs never duplicate conversion history. Groups and references paginate; no permanent creative delete is implemented. Fresh and prior-scene upgrade paths are tested only in isolated local databases. No hosted migration is authorized.
