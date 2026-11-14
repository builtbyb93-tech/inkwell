# ADR-009 — Authorized workspace search

Status: accepted within approved Phase 5 (#26). Owner selected 10,000 mixed records and warm p95 ≤250 ms locally on 2026-11-14. VPS measurement remains a Phase 7 release gate.

Use PostgreSQL `simple` dictionary full-text search, generated weighted title/name (A) and body (B) tsvectors with GIN indexes. This avoids external search infrastructure and language-specific stemming assumptions for creator names. Vault's existing generated vector is preserved. Project, Story, CanonRecord, CanonOverride, Scene and PlotGroup are additive indexes.

Override search materializes effective name/text through database triggers. Shared edits refresh inherited search text without changing override versions, base snapshots, custom values or timestamps. Story searches return effective overrides instead of overridden-away shared fields; workspace searches can show shared and distinct story variants. Cleared values do not match their former shared text.

Every branch scopes workspace and qualified parents. Project/story/type/canon-type/archive filters apply before ranking and pagination. Archived parents hide descendants from active results. Ideas remain workspace records even when a linked destination is archived. A custom/clear override survives shared archival with an archive warning, as defined in ADR-007. Results use plain escaped excerpts and authorized application links; no HTML highlighting or private traversal.

Sort by rank descending, then kind and result UUID ascending. Bounded cursors bind the workspace and exact query/filter/limit via a hash; they do not grant access. Concurrent edits can change ranked result membership; this is online search, not a persistent snapshot. Project/story selectors paginate authorized records.

The integration gate creates exactly 10,000 mixed searchable records: 100 projects, 500 stories, 3,000 ideas, 3,000 canon records, 3,000 scenes, 300 groups and 100 overrides. After warmup, 36 service queries cover common/rare/missing terms and project/story/kind filters. Require p95 ≤250 ms and a selective GIN plan. This excludes HTTP/auth overhead and is not a production SLA.
