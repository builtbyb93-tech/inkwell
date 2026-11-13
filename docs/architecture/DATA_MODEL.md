# Data model

Only **User** and **Workspace** are migrated in Phase 0. The following is the planned model, elaborated with each approved feature.

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
