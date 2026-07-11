# AGENTS.md — backend (Core)

> Domain rules for this service. Root rules: [/AGENTS.md](../AGENTS.md). Context: [agent/core/CONTEXT.md](../agent/core/CONTEXT.md).

## Mission

The main API and the **only** service the frontend calls. Owns auth session handling (against Supabase GoTrue), the 6-role model enforcement, families & guardian links, tasks & rewards, and profiles/avatars. Orchestrates internal services (Forge, Echo, Arcade, Guardian, Courier) via `INTERNAL_API_KEY` service-to-service calls.

## Owns / does not own

- **Owns:** `/api/v1/*` public API, role middleware, family/guardian-link business logic, task assignment/rewards, profile & avatar persistence, orchestration of internal services.
- **Does NOT own:** schema & RLS (→ `database/`), content generation (→ coursegen/gamegen), TTS (→ audiogen), identity verification itself (→ parent-id-check — Core only consumes its verdicts), email sending (→ email-server).

## Invariants that bite here

- Role checks server-side from the DB — never trust client-sent roles. Superadmin gate = `@littlefounders.ai` (also enforced in DB).
- A kid without ≥1 verified guardian link is a bug — creation flows must be transactional about this (/AGENTS.md §1.3).
- Envelope + /api/v1/ + Zod on every route (§1.6). Error codes → frontend `errors.api.*` keys.
- Child data: parent visibility invariant; nothing kid-identifying to third-party APIs (§1.9).
- External IO with timeouts; internal calls carry `INTERNAL_API_KEY`.

## Read before touching

- `agent/core/CONVENTIONS.md` — app layout, envelope, test shape.
- `database/types/` — generated shared types (never hand-edit).
