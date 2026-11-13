# ADR-008: One story sequence, bounded plot groups and scoped scene references

Status: selected within authorized Phase 4; implementation/test evidence is in the milestone report. Owner standing approval covers reviewed/tested in-scope PR merges; hosted migrations/deployment remain separately gated.

## Sequence options and decision

Options: fractional/rank keys with rebalance, sparse integer positions with collision handling, or contiguous integer positions with transactional replacement. Keep the existing integer positions and choose transactional replacement. This preserves Phase 2 scene IDs, content, source references and ordering without a separate competing sequence. Archived scenes remain in the same sequence; active/archived filters and groups are views, not independent orders.

The existing `(storyId,position)` unique index becomes a migration-owned DEFERRABLE INITIALLY IMMEDIATE unique constraint using the same index. Move transactions defer that constraint, compute one permutation and write changed positions in parameterized batches of 500, then commit atomically. Nonnegative position and qualified scope checks remain. A failure, including a deferred uniqueness violation, rolls back positions and sequence version. No negative temporary positions or partially committed reorder is used. Prisma does not model deferrability: preserve this SQL explicitly in future migrations.

All creative plot writers lock the active Project then Story, matching canon/converted-scene append operations. A structural move compares Story.sequenceVersion. Group create/edit/archive, scene create/duplicate, archive/restore and moves increment it when the structural view changes. A no-op move does not increment it. Native drag, keyboard and mobile controls call the same move endpoint. Conditional content edits use Scene.version, separately; reordering never overwrites title/notes/status or advances their edit version. Scene group assignment changes only through the move contract.

Direction EARLIER/LATER finds the adjacent active scene in the full sequence, skipping archived rows. A beforeId move inserts before an active destination, null appends to the full sequence end, and an omitted beforeId preserves sequence position for group-only moves. Root-group filters include direct and child-group scenes; child and ungrouped filters are exact. Group filters do not change the meaning of earlier/later. Moving another scene may shift archived positions, but archived rows remain in the canonical permutation and restore into that retained sequence. Canonical scene numbers are displayed in every view.

Plot pagination uses position plus sequenceVersion, bounded at 100 cards (default 50). Stale structural cursors return 409 rather than mixing sequence revisions. Metadata/content edits can appear in later reads without duplicating/missing sequence members. The board is a responsive grid in canonical order, with group labels and filtering; the list preserves that same order. Neither view invents a second column-derived sequence. Group metadata is separately paginated; target selectors offer load-more controls.

This broad per-project lock is a deliberate MVP tradeoff consistent with Phase 3. Release-scale contention/load measurements remain Phase 7 work. No unapproved infrastructure or third-party drag service is needed.

## Group integrity and archival

PlotGroup has immutable workspace/project/story identity and a qualified nullable parent FK to another PlotGroup in the same story. Root and one child level are the maximum. SQL triggers lock the Story before checking parent/root/children state, rejecting self-links, cycles, third levels, foreign stories and moving a group with children under another group. Concurrent opposing reparent tests cover both service and raw SQL paths.

Archive is non-destructive. A group must have no active direct child group or active scene before it can be archived. Archived child/scene references stay intact. Restore a parent before a child, and a group before restoring its scenes. There is no group deletion or cascading archive. Ungrouped scenes remain valid. Scene archive/restore changes visibility but retains the scene's canonical row, content, group and all references.

## Scene content and duplication

Scenes use the existing bounded version-1 structured editor and safe renderer. Status is a closed PLANNED/DRAFT/REVIEW/COMPLETE enum, an MVP organization detail rather than a specialized production workflow. Existing rows default PLANNED; notes, IDs, versions, source links and sequence positions remain unchanged on migration.

Duplication requires the observed Scene.version, allocates a new scene ID and reference IDs, copies current content/status/group and scoped character/location/Idea references, and appends to the sequence. A qualified immutable duplicatedFromId points to the original scene. It does not clone immutable IdeaConversion history or modify the source scene. Copied Idea links are ordinary references, with the original conversion retained on its source scene. Archived linked canon/ideas remain valid references with visible archive labels; new direct reference additions require active targets. Only active scenes can be duplicated. Editing a copy is independent of its original.

## Explicit relationship integrity

SceneCharacterLink and SceneLocationLink have concrete scene/canon composite FKs including workspace/project/story where applicable. SQL guards enforce CHARACTER or LOCATION kind, same project, and shared or same-story-local scope. Canon identity remains immutable from Phase 3, so endpoint kinds/scope cannot drift. Shared canon resolves to the story's effective override in reference displays. Scene links never modify shared canon or overrides. Canon detail views expose authorized scene backlinks, including archive labels and paged retrieval.

Canon reference add/remove compares and increments Scene.version. They are incremental operations, not replacement of the entire reference set. Idea references reuse the existing IdeaSceneLink and versioned Idea Vault add/remove API. Those mutations compare Idea.version; Scene content edits never replace or overwrite Idea references. Converted source links cannot be removed. Duplication copies valid reference edges without editing Idea content or rewriting its provenance. No new generic polymorphic target or cross-project canon link is introduced. Workspace-wide ideas can still reference independently qualified targets in several owned projects, as ADR-005 permits.

## UI, concurrency and boundaries

Native forms/links/buttons and visible save states work on desktop/mobile. Drag handles are desktop-only; every drag action has visible earlier/later and destination-group/insert-before alternatives. Successful moves announce the saved position and restore focus to the moved scene or status notice. Stale moves retain the displayed order and require refresh. Scene/group save conflicts preserve drafts until explicit discard/reload. Pending writes disable controls and the rich editor; reference changes require saved scene fields so they cannot erase an unsaved draft. Successful creation/duplication stays pending until navigation, preventing a second submit during route transition. Route keys include context and record ID. Movement fields render only when their disclosure opens, avoiding a destination option list for every closed scene card as boards grow.

Legacy converted-scene APIs/overview links continue to work and lead into the full Plot Board editor. Advanced screenplay/comic/storyboard editing, autosave/recovery/history, import/export, public sharing and AI remain later scope. No permanent creative deletion, group bulk-archive or alternate scene sequence is introduced.
