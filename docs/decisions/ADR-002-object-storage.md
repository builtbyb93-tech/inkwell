# ADR-002: private S3-compatible storage

Status: proposed; no hosted resource provisioned.

Constraint: private S3 API, self-hosted/free where sufficient, separate environments, snapshot asset revocation, backup/restore.

Options: Garage v2.5.0 (small self-hosted S3 deployment), SeaweedFS (broader storage surface), existing owner-approved S3 (none verified). Minimize operational burden and avoid adding a paid provider.

Recommendation: evaluate Garage v2.5.0 locally before asset features. Registry tag/digest exists, but SDK operations, authorization, bounded uploads, restore, resource usage and packaging must be proven before accepting production use. Do not assume bucket policies, versioning or multipart behavior without tests.

Phase 0 records the interface/environment plan; private assets arrive in later approved features. Public sharing proxies authorization on every request and cannot hand out object URLs that outlive revocation. PostgreSQL/S3 publication uses staged manifests and cleanup, not a claimed cross-system transaction.
