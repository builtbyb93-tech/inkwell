# ADR-001: stable authentication and session revocation

Status: selected and implemented for Phase 1; evidence and remaining hosted checks are recorded in the Phase 1 report.

Constraint: Auth.js-compatible authentication, registration/verification/recovery, stable versions, secure revocable sessions, future native clients.

Options: (A) stable NextAuth 4.24.15 with Credentials/JWT and server-checked session registry; (B) Auth.js 5 beta; (C) another compatible adapter design after a documented compatibility proof.

Recommendation: A. Published peers include Next 16/React 19; avoid beta B. Credentials provider requires JWT sessions, so do not claim database session support simply by adding an adapter. App-owned registration/verification/recovery, hashed single-use tokens, secure cookies, CSRF/origin checks, Argon2id, per-session revocation and password-reset invalidation require end-to-end proof. An encrypted cookie alone is not immediate server revocation.

Before acceptance: verify callback/session behavior with the pinned framework, choose lifetimes and non-enumerating recovery UX, define native contract boundaries, and run two-account/revocation tests. No paid email provider is assumed.

Implementation uses option A without an adapter: app-owned AuthSession registry checked on every private request, seven-day fixed registry expiry, authVersion invalidation and explicit per-session logout. Profile and creative version counters are separate from authVersion. Reset and sign-in serialize on the account row so a stale password cannot mint a valid post-reset session. CSRF and callback URLs use the configured origin, not proxy-internal hostnames. All public error payloads are allowlisted envelopes; no Auth.js exception object is passed through. Real local SMTP/browser tests establish framework compatibility; production HTTPS/proxy/deliverability checks remain before release.
