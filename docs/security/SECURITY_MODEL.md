# Security model

## Current boundary

Phase 0 serves a public shell and minimal operational endpoints. No authentication, user content, upload or private resource endpoint is exposed. User/Workspace tables are schema foundations only. This is not a production security sign-off.

No provider key or AI call is needed. Theme preference is the only browser-persisted value. API replies are no-store; readiness masks driver/configuration failures. Security headers deny framing and plugins and disable unused browser capabilities. The current CSP is a baseline, not a complete script policy; develop a nonce-compatible policy before private content is exposed.

## Required feature controls

- Hash passwords with a maintained Argon2id implementation and measured parameters. Never log passwords/reset URLs. Verification/reset tokens are random, hashed, expiring and single-use. Bound enumeration and rate abuse; invalidate sessions on recovery.
- Secure HttpOnly cookies, appropriate SameSite/CSRF/origin checks, server-checked revocation, login/session lifetime policy and explicit logout. Auth implementation follows ADR-001.
- Authenticate every private operation, authorize each resource/linked ID, and scope queries and transactional writes. Tests use two accounts with valid foreign IDs; UUID secrecy is not isolation.
- Runtime DB role has least privilege; migration credentials are separate. FK/scope integrity, version preconditions and transaction guarantees supplement service checks.
- Validate/bound all input, rich-text nodes/link schemes, files/import size and archive depth. Sanitize rendering; defend against stored XSS, SSRF, path traversal and decompression bombs.
- Private S3 buckets and least-privilege per-environment credentials. Use private manifests, safe MIME/disposition, and authorization at download time.
- Sharing copies selected content only. Store cryptographic token hashes, check expiry/revocation/download permissions for every request, redact tokens from logs, use no-referrer/noindex/no-store, and avoid direct URLs that outlive revocation.
- Durable rate limits across app replicas for auth, shares, search and imports; PostgreSQL-backed coordination is sufficient initially. Do not reuse Coolify's Redis or unrelated applications' services.
- Account/privacy and permanent deletion require explicit auditable workflows with approved recovery/retention. Do not silently retain sensitive content in generic logs, backups or recovery caches.

## Secrets, supply chain and operations

Environment files are ignored. Example credentials are local-only. Credential setup files remain outside the repository with restricted filesystem permissions. Never print credential contents or connection URLs.

Exact dependency pins, frozen install, approved dependency build scripts, checksummed scanner binaries, SHA-pinned Actions, secret scanning, dependency audit and reviewed lockfile updates form the baseline. Untrusted PRs have no deployment secrets and use pull_request, not privileged pull_request_target execution of untrusted code.

Separate staging/production databases, networks, storage credentials and secrets. Protect staging access. Backups are encrypted/access-controlled with an approved off-host destination and restoration test. Production migrations/deployment, DNS and provisioning need separate owner approval. No production authorization has been given.

## Verification gates

Authorization regressions, concurrent-write/transaction tests, import rollback/round trips, share revocation/private traversal checks, browser accessibility, dependency/secret scans and backup restoration are required as relevant features arrive. Findings and skipped checks stay visible; do not certify the application from a shell audit.

## Phase 0 dependency finding

Audit on 2026-11-13 reports one moderate development-only advisory: [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), minimatch 10.2.6 glob-parts amplification, pulled through lint tooling. The reported fix is 11.0.1, outside those dependencies' current major range. Do not silently force a major transitive replacement or ignore the advisory. There are no reported high/critical findings at this check; production dependency audit is recorded separately in the milestone report. Lint patterns are repository-controlled and CI jobs have time limits. Review an upstream-compatible fix before release; this is not a production security sign-off.
