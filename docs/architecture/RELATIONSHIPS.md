# Relationship integrity

Phase 2 implements Idea Story/Scene references and typed conversion provenance. Other relationship families remain planned for their approved phases.

| Relation                   | Rules                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Idea ↔ Story/Scene         | Explicit many-to-many typed FK tables; validate workspace and target project/story chain; support multiple targets |
| Idea → conversion          | Preserve source idea and typed target provenance; do not delete source or silently unlink                          |
| Scene ↔ Character/Location | Typed joins; only applicable story-local/shared canon from the same project                                        |
| Canon ↔ Canon              | Typed endpoint/kind allowlist, scoped FKs, authorized indexed backlinks                                            |
| Story → shared override    | Separate typed override; source/story share a project and record base revision                                     |
| Snapshot → content/assets  | Immutable selected copies/manifests; never traverse live private IDs                                               |

Reject cross-project canon/scene links even within the same account. A type/id pair alone is insufficient integrity. A future common endpoint supertype requires enforced typed children/scoped FKs/type checks and an ADR.

Archival preserves provenance; restore/deletion revalidate endpoints and have tested semantics. Conversions, link changes and imports are transactional with version preconditions. Backlinks authorize source and target.

Phase 2 ideas are global to the workspace. An idea can connect to multiple owned projects through independently qualified targets; this never merges their canon. Wrong project/story/scene chains fail, including mismatches within one workspace. Separate link tables and guarded typed conversion columns provide SQL integrity. Native requests cannot inject arbitrary endpoint types or workspace ownership. Conversion links preserve provenance; manual reference removal compares the idea version. Archive/restore leaves references intact. Later canon-to-canon/scene relationships remain same-project only.
