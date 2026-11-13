# Canon rules

1. Project shared canon is reusable across its stories.
2. Story-local records and explicit story overrides coexist with shared canon.
3. Store shared/local/override data separately. Saving an override never writes shared data.
4. Effective fields resolve explicit override → shared field. Distinguish absent override from explicitly cleared value.
5. Record the shared revision used by an override. Relevant shared edits trigger review; never discard story-specific information silently.
6. Promotion to shared canon is a separate explicit action, not a side effect of save; do not assume extra promotion tooling for MVP.
7. Validate typed relationships and same-project scope for all five record types.
8. Archive/restore preserves provenance. Shared archival cannot silently destroy local data. Permanent deletion requires explicit audited semantics.
9. Imports remap source/override relationships. Snapshots contain selected effective copies without private source traversal.

Phase 3 tests cover clear/inherit, disjoint/conflicting shared edits, stale revisions, archival, unauthorized scope and backlinks. Define field-level conflict granularity before enabling canon writes.
