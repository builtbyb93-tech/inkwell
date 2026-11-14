# Task dependencies and execution plan

The master directive is present; no pre-existing Inkwell SRS, architecture or UX source documents were found. Requirements are traced in prose to PRODUCT_SPEC/MVP_SCOPE rather than invented source IDs. Feature IDs below are stable planning keys; published issue references are mapped in GITHUB_RESOURCES.json. Do not renumber/recycle them.

## Phase 0 foundation

| Key  | Task                                                   | Depends on | Expected files                       |
| ---- | ------------------------------------------------------ | ---------- | ------------------------------------ |
| P0-A | Preserve requirements/ADRs/policies                    | Bootstrap  | README, AGENTS, docs                 |
| P0-B | Monorepo, exact pins, TS/format/lint                   | P0-A       | package manifests, config, lockfile  |
| P0-C | Responsive accessible shell/themes/PWA baseline        | P0-B       | apps/web, packages/ui                |
| P0-D | Local database, environment, editor/container baseline | P0-B       | packages/db, editor, compose, deploy |
| P0-E | Unit/integration/browser/a11y/security CI              | P0-C, P0-D | tests, scripts, .github/workflows    |
| P0-F | Verify, review, prepare PR/report                      | P0-A–E     | acceptance evidence, PR              |

One coherent worktree executes these sequentially. Real: shell → operational API → domain readiness → database connectivity, local migrations and container build. No auth/creative business operation is stubbed as working. Phase 0 completion requires verified checks; hosted deployment remains a separate approval gate.

## Full milestone sequence

| Milestone                                 | Stable feature keys/slices                                                                                                         | Depends on                             |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Phase 1 Authentication/Project Foundation | FEAT-001 verified auth/session/recovery; FEAT-002 workspace/project/story CRUD/dashboard; FEAT-003 account/privacy settings        | Approved Phase 0                       |
| Phase 2 Idea Vault                        | FEAT-004 capture/categories/tags/edit; FEAT-005 filter/search/archive/restore; FEAT-006 conversion/multi-target provenance         | Phase 1 ownership and project/story    |
| Phase 3 Story Bible                       | FEAT-007 shared/story canon, five types; FEAT-008 typed links/backlinks; FEAT-009 overrides/conflict review                        | Phase 2 typed conversion primitives    |
| Phase 4 Plot Board                        | FEAT-010 groups/scenes/status/details/links; FEAT-011 order/views/drag/keyboard/mobile; FEAT-012 duplicate/archive                 | Phase 3 canon/relationships            |
| Phase 5 Reliability/Portability           | FEAT-013 workspace FTS/filters; FEAT-014 autosave/conflicts/recovery; FEAT-015 versioned export/import/remapping                   | Phase 4 content graph                  |
| Phase 6 Sharing                           | FEAT-016 selection/snapshot/preview; FEAT-017 token/expiry/revoke/public rendering; FEAT-018 download/asset policy                 | Phase 5 graph and validation           |
| Phase 7 Release Hardening                 | FEAT-019 responsive/PWA/a11y; FEAT-020 security/authorization/rates/performance/monitoring; FEAT-021 backup/restore/RC/deploy docs | Phase 6 plus evidence from every phase |

Each feature spans the needed UI, contract, domain and data behavior. Split large feature keys into reviewable issue tasks while retaining their source key. Expected modules are web/contracts/domain/db plus editor for content and private storage adapter for assets. Acceptance is in ACCEPTANCE_CRITERIA; no feature is complete until its evidence passes.

Phase 2 adds minimal typed Character/Scene creation for conversion, without shipping Phase 3/4 management UI. Optimistic versions/ownership/security checks begin with first writers; do not defer them to hardening. Later issue details are refined before the relevant milestone, without changing locked product decisions.

## First product slice and handoffs

Immediately after the foundation: register → verify → sign in → empty private workspace (FEAT-001, with workspace creation foundation). Why: tests authentication, email integration and isolation before private creative data exists. Acceptance: single-use verification, valid sign-in, atomic one-workspace creation, logout/revocation, anonymous/cross-account rejection and useful errors.

UI-design handoff: registration, verification, sign-in and empty dashboard states. Detailed-design handoff: auth/session endpoints, User/Workspace/token records, CSRF, rate limits, revocation and server authorization. Password recovery and CRUD follow as small reviewed tasks within Phase 1.

## Board rules

Real repository issues only; source of truth is GitHub Issues. Board statuses: Backlog, Ready, In Progress, Review, Approved, Complete, Blocked. Required labels and one milestone/phase are captured in github-plan.json. Search open/closed issues and Project items before creation. Dependencies use native links when available plus explicit issue references/checklists.

Review means PR prepared; Approved requires owner/reviewer/check evidence; Complete requires verified acceptance and approved merge (or verified deployment for a deployment issue). Missing GitHub access does not justify claiming local drafts as published issues.

## Risk/coverage verification

Coverage reviewed against all twelve primary systems and all phases in MVP_SCOPE. No product system is intentionally omitted. Open implementation decisions: auth/session proof, S3 choice, retention/limits/dictionaries, hosted capacity and administration permissions. No calendar estimates or source requirement/screen IDs are fabricated. Later phases remain a dependency order subject to explicit scope/architecture approval.

## Published planning

The 38 tasks are published as repository issues #1–#38, with Phase 0 in #1–#6. Project: https://github.com/users/builtbyb93-tech/projects/1. Draft PR #39 contains the foundation. The owner approved public visibility and main protection is now verified. The owner approved a solo-owner review policy and Phase 0 merge after passing checks, recorded in #6. Phase 1 implementation is approved; no Phase 1 merge or deployment is authorized. No task is closed by local verification alone.

## Phase 3 issue execution

After verified Phase 2 merge, implement #17 shared records → #18 local records → #19 typed relationships/backlinks → #20 override/conflict review on one cohesive integration branch. One schema owner maintains migration order. Required authorization/concurrency/archive tests accompany each boundary. Issues remain In Progress until implementation and validation are published, then Review pending owner acceptance. Phase 4 depends on the approved Phase 3 merge; do not start Plot Board implementation from an unapproved feature head.

## Phase 4 issue execution

Verified approved Phase 3 merge → #21 group integrity → #22 scene details/links → #23 atomic ordering → #24 shared board/list accessible movement → #25 duplicate/archive. One schema owner and integrated feature branch coordinate these dependencies. Publish validation/PR evidence before Review; mark Complete only after verified acceptance and merge under the standing owner approval. Phase 5 Reliability/Portability follows the merged Plot Board, with autosave/recovery/global search/import/export still distinct scope.

## Phase 5 implementation allocation

#25 and Phase 4 PR #43 are merged (`2864e32f448604d633e932916398ba16b5bed16b`). #26–#30 form one cohesive reliability/portability milestone on `feature/26-recovery-portability`, `/workspace/inkwell-worktrees/phase-5`, target `main`, that base commit. #26 provides workspace search/filter/index groundwork; #27 provides acknowledged optimistic save/retry; #28 adds optional scoped device recovery using #27; #29 defines complete project archive/export; #30 depends on #29's format and earlier graph integrity for validation/remapping/rollback. Schema ownership and integration are centralized in this worktree. Historical phase worktrees are retained inactive; no shared writable test databases or concurrent source edits are used.

Owner decisions recorded 2026-11-14: seven-day device recovery, clear on sign-out; 10,000 mixed searchable records, warm local p95 ≤250 ms. Standing approval covers reviewed/tested in-scope PR merges. No auto-merge, collaborator/reviewer invitations, hosted migrations or deployment. Phase 6 snapshot sharing depends on this phase's complete authorized graph/portability and remains a distinct milestone.

## Phase 6 and remaining authorization

The owner instructed “finish all remaining phases and merge all to complete project.” Phases 6/7 implementation, validation, documentation, release-candidate preparation and reviewed/tested in-scope PR merges are authorized. Do not repeat per-file/merge approval requests. Hosted provisioning/deployment, production migrations, DNS, paid services and destructive operations retain their separate gates; operational acceptance must be observed.

Phase 6 #31–#33 form one cohesive snapshot feature on feature/31-snapshot-sharing, /workspace/inkwell-worktrees/phase-6, base bf471da347fe9cf5dc06cecd13eb6abba183e767 (Phase 5 PR #44), target main. #31 provides private immutable selection/preview; #32 adds hash-only expiring/revocable links; #33 enforces per-request download/private S3 policy. One central schema owner and dedicated PostgreSQL/Garage/SMTP resources; historical worktrees remain inactive and intact. Phase 7 #34–#38 begins from the approved Phase 6 merge. Backup policy is explicitly approved as 30 daily backups once protected off-host storage is configured; no activation/deletion is inferred.
