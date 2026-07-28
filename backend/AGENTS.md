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
- **Admin email data is proxied through Core (§1.5) — never direct browser access to email-server.** Core's `/api/v1/admin/emails/*` endpoints call email-server's `/api/v1/logs` on the internal network and validate the response shape with Zod before forwarding. All admin query params are Zod-validated at the edge. Fetch calls carry `AbortSignal.timeout(10_000)`.
- **OWNED — email server proxy:** `EMAIL_SERVER_URL` (default `http://localhost:4005`) + `INTERNAL_API_KEY` for service-to-service auth.
- **Social login is Core-brokered (§1.5) — the browser hits Core's `/api/v1/auth/oauth/*`, never GoTrue's `/authorize` directly.** `OAUTH_PROVIDERS` is the code allow-list (Google today); Core builds the GoTrue authorize URL with `redirect_to=<FRONTEND_URL>/auth/callback`. *Enabling* a provider is GoTrue config (`GOTRUE_EXTERNAL_<P>_ENABLED`/`CLIENT_ID`/`SECRET`), not a code change; `GET /oauth/providers` reflects what GoTrue reports enabled, so the frontend button self-hides until credentials exist. **`PROVIDER_AUTHORIZE_PARAMS` in `services/gotrue.ts`** adds provider-specific extra query params GoTrue forwards verbatim to the provider's own authorize URL (verified live via the raw `location` redirect header, not assumed) — Google gets `prompt=select_account` so a browser holding one Google session still gets the account chooser instead of silent auto-login; add a provider's own entry here rather than a generic default, since the equivalent param differs per provider. Route table + go-live steps: `README.md` "Social login".
- **Trust exactly one proxy hop.** `app.set('trust proxy', 1)` — Core runs behind Railway's single edge proxy, so rate limits must key on the real client IP (leftmost untrusted `X-Forwarded-For`), not the proxy address. `true` (trust-all) would let a spoofed header bypass the limiter; `0`/unset lumps every client into one bucket.
- **Lesson grading is SERVER-AUTHORITATIVE — never trust a client-reported score or XP.** `POST /learn/lessons/:id/grade` and `/complete` are the only writers of `lesson_segment_attempts` / `lesson_progress` / `learning_stats`; the client submits a raw answer and Core alone decides the score, using `lesson_documents.answer_keys` (service-role only, no client can ever read it) and the graders in `src/lesson-contract/`.
- **`src/lesson-contract/` parity is a standing invariant, not a one-time copy.** It mirrors `frontend/src/lesson-engine/{core/scoring.ts, core/types.ts (trimmed), families/*/grade.ts}` because the platform has no npm workspaces (/AGENTS.md §1.2) — Core cannot import the frontend package directly. Any edit to a frontend grading validator MUST be mirrored here in the same commit; `npm run contract:check` enforces this and is a pre-commit gate (§5) whenever either side changes.
- The course/lesson unlock rule (locked/available/current/passed, COURSE_ENGINE.md §2) is computed in exactly one place — `src/services/unlockRules.ts` + `courseTree.ts` — and never re-derived by the client.

## Read before touching

- `agent/core/CONVENTIONS.md` — app layout, envelope, test shape.
- `database/types/` — generated shared types (never hand-edit).
