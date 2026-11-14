# MVP boundary and coverage

| System              | Delivery                                                     | Acceptance evidence                                                                                  |
| ------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Dashboard           | Phase 1 shell; real summaries with Phases 2–4                | Authorized navigation and responsive empty/populated states                                          |
| Vault               | Phase 2                                                      | Capture/edit/category/tag/filter, source-preserving conversions, multi-target links, archive/restore |
| Projects/stories    | Phase 1                                                      | Persistent CRUD; multiple stories/project; ownership rejection                                       |
| Shared/story Bibles | Phase 3                                                      | Reusable shared canon, local records, independent overrides/conflict review                          |
| Plot/scenes         | Phase 4                                                      | Two group levels, one atomic order, accessible movement, links, duplication/archive                  |
| Relationships       | Phase 2 provenance; Phase 3 typed canon; Phase 4 scene links | Scoped valid endpoints, backlinks and cross-project rejection                                        |
| Search              | Vault Phase 2; workspace Phase 5                             | Authorized filtered results, archive policy and indexed FTS                                          |
| Save/recovery       | Versions from first writer; recovery completed Phase 5       | Visible states, conflicts, retry/recovery and interrupted-edit checks                                |
| Portability         | Phase 5                                                      | Version rejection, remapping, rollback and link-preserving round trip                                |
| Sharing             | Phase 6                                                      | Selected-only snapshots, expiry/revocation, protected assets/downloads                               |
| Account/privacy     | Phase 1 settings; Phase 7 lifecycle review                   | Session controls, AI off, explicit deletion/retention decisions                                      |
| PWA                 | Manifest/shell Phase 0; final validation Phase 7             | Mobile/keyboard/theme audits, HTTPS, no private cache leakage                                        |

Phase 2 includes minimal typed Character/Scene target creation needed for conversions. Full canon management and Plot Board remain Phases 3/4. Concurrency checks accompany first writers, not only Phase 5.

Native apps, generation, marketplace, collaboration and specialized publishing editors are excluded. No deadline, pricing, retention period, load target or SLA is invented. Resolve those explicitly before dependent work ships.

Phase 5 owner decisions recorded 2026-11-14: unsaved device drafts expire after seven days and clear on sign-out; local search gate is exactly 10,000 mixed searchable records with warm p95 ≤250 ms. These are explicit approvals, not inferred retention/SLA promises. Search, acknowledged saves, optional recovery and version 1 transactional text portability are implemented in Phase 5; native/offline sync, sharing and release gates remain as scoped.
