# Relationship integrity

Phase 2 implements Idea Story/Scene references and typed conversion provenance. Phase 3 adds concrete typed canon relationships and authorized backlinks; scene joins and snapshot relationships remain later milestones.

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

## Phase 3 canon graph

ADR-007 permits a concrete common CanonRecord with closed kind enum and immutable identity. Both endpoints are qualified SQL FKs; database triggers enforce the typed matrix and shared/story context. A type/id pair cannot bypass integrity. Conversion provenance still points to shared Characters only. Project graph edges are read-only in story views; story graph edges cannot reference another story's local record. Indexes cover both directions, scoped stable paging and active/archive retrieval. Archived endpoints remain visible as archived references; restoring links requires active endpoints. No scene/canon joins or graph deletion is introduced.

## Phase 4 scene graph

SceneCharacterLink/SceneLocationLink use scoped concrete FKs and SQL type/context guards. Shared or same-story-local canon can be linked; foreign project/story-local/type endpoints fail. Scene references display effective story overrides and authorized canon backlinks. Idea references reuse versioned IdeaSceneLink operations; source conversions remain immutable and retained. Scene duplication creates new edge IDs and a qualified immutable duplicatedFromId, copies current valid links (including archived endpoint labels), and does not copy IdeaConversion records. ADR-008 describes independent content/reference preconditions and archive semantics.
