# ADR-003: private repository administration and protection

Status: account access resolved; protected-main plan gate blocked.

Owner: builtbyb93-tech. Canonical private repository: https://github.com/builtbyb93-tech/inkwell. The GitHub connector supports repository/issue/PR operations but lacks the required administrative creation surfaces. Administrative operations now run through the owner-authorized Mac using a locally issued OAuth credential whose identity was verified there as builtbyb93-tech with project, repo and workflow scopes.

Cloud diagnostics returned BradyBuilds for valid, missing and deliberately invalid authorization. Earlier cloud account checks were therefore unreliable. A fresh authorization initiated on the Mac resolved the issue. No existing cloud credential was copied; automatic review rejected the proposed transfer while account identity was unresolved. Do not retry cloud credential-entry loops or transfer secrets through logs. Credential files are outside source with restricted permissions.

GitHub returned 403 for main protection: Upgrade to GitHub Pro or make this repository public to enable this feature. Keep the approved source repository private. An eligible plan or an explicitly approved visibility/scope change is an owner decision; no purchase or visibility change is performed automatically. No main merge is permitted while the required protection gate remains unresolved. A non-author reviewer remains required, and no collaborator has been invited.

The approved README-only bootstrap is published on main. Feature code is in draft PR #39. Auto-merge is disabled. Source/CI/planning publication is authorized Phase 0 work; merging and deployment remain separately gated.
