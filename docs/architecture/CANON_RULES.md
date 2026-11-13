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

## Phase 3 implementation

ADR-007 defines name/notes conflict granularity, explicit INHERIT/CUSTOM/CLEAR contracts, base revision and override preconditions, and explicit KEEP/INHERIT review. Shared and local records occupy independent fixed-scope rows; overrides occupy their own table. Relevant shared edits flag review while inherited fields follow current shared values. Disjoint edits do not destroy private story values. Shared archival preserves overrides and backlinks; custom story values remain discoverable with an archive warning. Editing an override requires restoring its shared base; reviewing existing conflicts remains an explicit permitted action. Promotion and permanent deletion are not implemented.
