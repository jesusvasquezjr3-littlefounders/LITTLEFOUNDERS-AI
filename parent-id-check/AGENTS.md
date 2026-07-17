# AGENTS.md — parent-id-check (Guardian)

> Domain rules for this service. Root rules: [/AGENTS.md](../AGENTS.md). Context: [agent/core/CONTEXT.md](../agent/core/CONTEXT.md).

## Mission

Guardian identity verification. **The ONLY path** to `parent` status, verified guardian links, and the `kid`/`bigfounder` verified states. Internal service — `INTERNAL_API_KEY` only (plus provider webhooks with signature verification).

## Engine — DECIDED (Jesús, 2026-07-12)

**Local OCR (tesseract.js, WASM, `spa+eng+por`)** — no external provider. The
ID photograph is processed entirely in memory and NEVER stored (not on disk,
not in logs, not in any response); it exists only for the duration of one
`recognize()` call. This service is **stateless**: no DB access, no keys
beyond `INTERNAL_API_KEY`. It returns `{ verified, checks }` verdicts; Core
performs every write (verification record, role grant, audit). If an external
provider is ever revisited, it's a new decision (BOUNDARIES: stack change) —
the verdict interface stays.

## Invariants that bite here

- **Strictest PII handling in the platform.** Verification documents/data:
  never logged, never stored, never sent anywhere — OCR text stays inside the
  matcher's scope; responses never echo it or the applicant data (tests gate
  this).
- **Every verification event is audit-logged** (append-only, §1.3) — written
  by Core, which owns the verdict's consequences.
- This service never grants roles directly — verdicts flow to Core.
- Failing open is forbidden: OCR/engine errors → verification stays
  unverified (`DOCUMENT_UNREADABLE`, no detail).

## Read before touching

- `/AGENTS.md` §1.3 (guardian links) + §1.9 (child safety) — both blocking here.
- `agent/core/BOUNDARIES.md` — role/permission logic requires human sign-off.
