# ADR-010 — Acknowledged saves and optional device recovery

Status: accepted within approved Phase 5 (#27–#28). Owner selected seven-day device retention and clearing on sign-out on 2026-11-14.

Existing project/story, Idea, canon, scene and group editors debounce saves and serialize requests. Typing remains available while an autosave is in flight. A response acknowledges only the fields actually submitted and their applied version; newer local typing stays dirty. New records are created explicitly. Canon INHERIT/CUSTOM/CLEAR decisions and shared-conflict review remain explicit operations.

A validated `/api/v1/draft-saves` command reuses existing scoped transactional writers. Each target has one content-free latest receipt (request UUID, canonical payload hash, applied version). An exact retry returns the original acknowledgement even if someone later changed the record. Changed payload/key reuse and stale new writes conflict. Once another autosave replaces the receipt, an old request safely conflicts rather than replaying a newer version. Receipts are not revision history or creative-content retention. The target advisory lock and existing parent locks serialize saves; editable version checks remain authoritative.

Transport/server failures expose Retry with the same immutable request body/key. A 409 halts autosave. Compare reads the current server fields without adopting their version; the owner must explicitly choose “Use current version as base and keep my draft.” Discard/reload is also explicit. Recovery never automatically overwrites saved content. Editor instances are keyed by record/context to prevent navigation carrying a draft into a different record.

IndexedDB stores at most one unsaved buffer per account/workspace/record on this browser, up to 50 slots and 64 KiB per slot. New-record forms have their own slots. Repeated device edits replace that record's buffer; this is not a revision history or multi-device sync. Each edit renews expiry to seven days. Expired drafts cannot be restored and are pruned on resume/access/write. A closed or suspended browser cannot run timed physical cleanup. Browser eviction, private mode and unsupported storage can prevent recovery; visible warnings preserve online saving.

Buffers use AES-GCM with fresh IVs, owner/slot-associated data and a browser-stored nonextractable CryptoKey. This reduces accidental plaintext storage, but same-origin scripts and the browser profile can access the key; it is not protection against XSS or an untrusted device. No private content is placed in localStorage or sent to external providers. LocalStorage/BroadcastChannel carry only invalidation metadata.

Authenticated layout supplies account/workspace scope and an HMAC session partition tag, never a raw session identifier or bearer credential. A newer verified session clears the old partition; older session contexts cannot reopen it. Settings clear/disable and sign-out increment a persistent generation and remove buffers. Every write checks that lease inside its final IndexedDB transaction, after encryption, so pending older-tab work cannot resurrect purged data. All-device sign-out clears this device too; other devices clear when they detect session expiry. API 401 invalidates recovery. If browser storage is inaccessible, server sign-out still proceeds.

Alternatives: localStorage lacks transactional purge guards and stores readable content; server revisions introduce an unresolved retention system. Neither is needed for this online-first milestone. No offline editing promise, background synchronization or service-worker caching of private content is introduced.

Quick Capture uses the same optional device-recovery store and explicit creation boundary. Successful creation/discard/unchanged-save acknowledgement invalidates pending buffer tasks before clearing; queued or in-flight local encryption cannot leave a stale “new record” draft after its successful capture.

Restore re-reads and validates the stored buffer at the explicit action boundary, including expiry after tab suspension. An expired/cleared candidate is discarded; a replaced buffer is offered for another explicit restore rather than silently applying a cached copy. Cached candidate fields cannot renew an already-expired buffer.

Expiry is measured from the last field edit, rather than the eventual storage-write time. A debounce/encryption operation delayed by suspension cannot refresh an unedited seven-day-old buffer. Online persistence and the visible live editor remain independent of recovery availability.
