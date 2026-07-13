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
- **Lesson grading is SERVER-AUTHORITATIVE — never trust a client-reported score or XP.** `POST /learn/lessons/:id/grade` and `/complete` are the only writers of `lesson_segment_attempts` / `lesson_progress` / `learning_stats`; the client submits a raw answer and Core alone decides the score, using `lesson_documents.answer_keys` (service-role only, no client can ever read it) and the graders in `src/lesson-contract/`.
- **`src/lesson-contract/` parity is a standing invariant, not a one-time copy.** It mirrors `frontend/src/lesson-engine/{core/scoring.ts, core/types.ts (trimmed), families/*/grade.ts}` because the platform has no npm workspaces (/AGENTS.md §1.2) — Core cannot import the frontend package directly. Any edit to a frontend grading validator MUST be mirrored here in the same commit; `npm run contract:check` enforces this and is a pre-commit gate (§5) whenever either side changes.
- The course/lesson unlock rule (locked/available/current/passed, COURSE_ENGINE.md §2) is computed in exactly one place — `src/services/unlockRules.ts` + `courseTree.ts` — and never re-derived by the client.

## Read before touching

- `agent/core/CONVENTIONS.md` — app layout, envelope, test shape.
- `database/types/` — generated shared types (never hand-edit).
