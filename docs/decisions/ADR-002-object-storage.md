# ADR-002: private S3-compatible storage

Status: proposed; no hosted resource provisioned.

Constraint: private S3 API, self-hosted/free where sufficient, separate environments, snapshot asset revocation, backup/restore.

Options: Garage v2.5.0 (small self-hosted S3 deployment), SeaweedFS (broader storage surface), existing owner-approved S3 (none verified). Minimize operational burden and avoid adding a paid provider.

Recommendation: evaluate Garage v2.5.0 locally before asset features. Registry tag/digest exists, but SDK operations, authorization, bounded uploads, restore, resource usage and packaging must be proven before accepting production use. Do not assume bucket policies, versioning or multipart behavior without tests.

Phase 0 records the interface/environment plan; private assets arrive in later approved features. Public sharing proxies authorization on every request and cannot hand out object URLs that outlive revocation. PostgreSQL/S3 publication uses staged manifests and cleanup, not a claimed cross-system transaction.

## Phase 6 local evaluation

Garage 2.5.0 is pinned at `sha256:677e5b758e4425a325b811c425c026bf35a4bf42f7ddbaa773de3f4fd779a5a5`; AWS SDK S3 3.1168.0 is pinned in the reusable storage package. Dedicated local put/get/delete, scoped key denial of bucket creation, anonymous access denial, bounded reads and payload verification are exercised. Conditional PutObject overwrite prevention was not honored; ADR-012 records the database reservation/immutable identity/checksum protocol and its limits. Runtime keys have bucket read/write, not owner permissions. RPC/admin ports are not published. `.local` credentials/configuration are ignored by Git and Docker build contexts. No production storage or remote credentials are used by test runners, which require loopback endpoints and test bucket names.
