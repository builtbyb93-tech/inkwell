# ADR-007: Concrete canon records, story scope and explicit conflict review

Status: selected within the owner-authorized Phase 3 implementation; PR review pending. No hosted migration is authorized.

## Context and options

All five canon kinds share name, versioned structured notes, archive state and ownership. Phase 2 already stores converted Characters with qualified provenance FKs. Relationships must have database-enforced endpoints; a free-form type/id pair is insufficient.

1. Five separate tables and five override/relationship families: strong per-type structure but repeats identical fields and needs many endpoint combinations before type-specific fields exist.
2. A concrete common record with a closed kind enum, scoped FKs, immutable identity and typed relationship guards: shares common behavior while the database validates every endpoint and kind combination.
3. Unchecked polymorphic references: simpler initial schema but permits dangling or incorrectly typed links; rejected.

Choose option 2. `CanonRecord` is a concrete persisted record, not an abstract ID registry. Its closed enum is CHARACTER, LOCATION, LORE, EVENT or ORGANIZATION. SQL keeps the existing `Character` table name through Prisma `@@map` to preserve Phase 2 IDs, content, FKs and conversion provenance without copying/renumbering records. Existing rows default to CHARACTER/SHARED. An ADR and migration will accompany any future specialized child fields.

## Scope and integrity

Shared and story-local canon are independent rows. Scope/type/project/workspace/story identity cannot change after creation. Shared rows have no story; local rows require a qualified Story FK. The effective story Bible includes shared rows plus only that story's local rows. Creating local canon never promotes or changes shared rows.

Overrides are physically separate `CanonOverride` rows, unique per shared record/story, with qualified source/story/project/workspace FKs and a shared-source trigger. Name and notes each have a presence flag. Absent means inherit; present with SQL NULL means explicitly clear; present with a value means custom. JSON null is not a substitute for SQL NULL. Rich-text schema versions are separate from edit versions.

`CanonRelationship` references two concrete CanonRecords through qualified FKs. Identity is immutable. A SQL trigger enforces endpoint kinds and context. Project relationships use only shared records. Story relationships can use shared or local records of that same story. No cross-project links, including within one account, are allowed. Backlinks read both directions in the authorized context. Shared relationships appear read-only within stories. Archival is versioned and preserves the endpoints; restoring revalidates active endpoints. A partial unique SQL index covers shared relationships because ordinary nullable uniqueness does not.

| Kind       | Allowed source → target                              |
| ---------- | ---------------------------------------------------- |
| RELATED    | Any two distinct canon records                       |
| KNOWS      | Character → Character                                |
| MEMBER_OF  | Character or Organization → Organization             |
| LOCATED_IN | Character, Event or Organization → Location          |
| PART_OF    | Matching Location, Lore, Event or Organization kinds |
| PRECEDES   | Event → Event                                        |

Direction and optional bounded label are explicit. Self links are rejected. Longer graph cycles are allowed; no family-tree or chronology engine is implied.

## Conflict granularity and transactions

MVP fields are name and structured notes. An override stores both shared field snapshots and base record version at save/review. A conflict exists only if an explicitly overridden field differs from its stored shared snapshot. JSON documents compare semantically, independent of object key order. Disjoint shared edits flow through inherited fields and do not flag unrelated custom fields. An explicit clear participates in review like any custom value.

Override creation requires `If-None-Match: *`; subsequent saves and reviews compare the override's own `If-Match`. Every save/review also supplies the currently observed shared `baseVersion`. Stale base or override returns 409. Relevant conflicts block ordinary override saves; the review endpoint requires KEEP or INHERIT for every changed field, with no default decision and no decisions for unchanged fields. KEEP retains the stored story value; INHERIT explicitly removes that field's override. The source row is never written.

Writes lock the active Project, then Story where applicable, before reading/updating overrides or links. Shared edits use conditional version updates. This serializes same-project mutations and source/override races with a simple modular-monolith transaction boundary. Reads spanning records and overrides use repeatable-read transactions. Broad project locking is a deliberate MVP tradeoff; measure before finer-grained locks are introduced.

## Archival, search and UI behavior

Shared archival never deletes overrides or links. An archived shared record with custom/clear story fields remains visible in that story's active Bible with an archive warning; it is also available in archived filtering. Inherit-only metadata does not keep an archived shared record active. Restore shared canon before editing overrides. Existing conflicts can still be explicitly reviewed while archived. Local archival stays independent. No permanent creative delete endpoint exists.

Canon lists have bounded kind/query/archive filters and deterministic createdAt/id cursors. Story search uses effective name/derived notes, including explicit clears. This feature-local search uses parameterized PostgreSQL ILIKE; indexed workspace full-text search is the existing Vault implementation and the later Phase 5 search milestone. Lists do not ship full documents. Backlinks and target selectors paginate. Shared/local/override names may be identical; record IDs and scope remain distinct.

The UI identifies shared, local and override contexts; editing shared data requires the explicit project-canon link. Save errors retain drafts. Refreshing comparison retains a draft and clears stale review decisions; discarding is an explicit separate action. Reviews apply to saved override values, so an unsaved draft must be explicitly discarded before reviewing those values. Forms wait for hydration and disable inputs/editors during pending writes. Route keys include context and record ID to prevent state reuse across canon navigation.

No automatic promotion, specialized type-specific editors, scene/canon joins, autosave, revision history, AI, import/export or public sharing is introduced in this phase.
