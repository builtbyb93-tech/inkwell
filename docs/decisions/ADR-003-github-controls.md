# ADR-003: repository visibility, administration and protection

Status: accepted owner decision — public source; account access and main protection verified.

Owner: builtbyb93-tech. Canonical public repository: https://github.com/builtbyb93-tech/inkwell. The GitHub connector supports repository/issue/PR operations but lacks the required administrative creation surfaces. Administrative operations now run through the owner-authorized Mac using a locally issued OAuth credential whose identity was verified there as builtbyb93-tech with project, repo and workflow scopes.

Cloud diagnostics returned BradyBuilds for valid, missing and deliberately invalid authorization. Earlier cloud account checks were therefore unreliable. A fresh authorization initiated on the Mac resolved the issue. No existing cloud credential was copied; automatic review rejected the proposed transfer while account identity was unresolved. Do not retry cloud credential-entry loops or transfer secrets through logs. Credential files are outside source with restricted permissions.

GitHub initially required Pro or public visibility to protect main. Options were private source with an eligible paid plan, or public source with free protection. Public visibility exposes repository history, issues and source; secret scans and CI were verified before the change. The owner explicitly selected public on 2026-11-13. The visibility change and main protection are now verified; no paid upgrade occurred. The Project remains private. This decision does not publish application user content or authorize deployment.

Main requires strict passing quality/integration/browser/container/security checks and one eligible non-author review, dismisses stale approvals, resolves conversations, enforces administrators and linear history, and blocks force pushes/deletion. An eligible non-author reviewer remains an owner decision; no collaborator has been invited. No merge is permitted without the separate explicit owner approval.

The approved README-only bootstrap is published on main. Feature code is in draft PR #39. Auto-merge is disabled. Source/CI/planning publication is authorized Phase 0 work; merging and deployment remain separately gated.
