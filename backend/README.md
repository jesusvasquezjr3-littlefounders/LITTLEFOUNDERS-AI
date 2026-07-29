# backend (Core)

> Part of LittleFounders v2. Read [/AGENTS.md](../AGENTS.md) first; domain rules in [AGENTS.md](AGENTS.md).

**Mission:** Main API — the only service the frontend calls. Auth, roles, families, guardian links, tasks, profiles; orchestrates internal services.
**Port (dev):** 4000 · **Deploy:** Railway

```bash
npm install
cp .env.example .env   # fill values (local Supabase secrets live in database/supabase/docker/.env)
npm run dev
npm test
npm run contract:check   # lesson-contract/ vs frontend/src/lesson-engine parity gate
```

## Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /health | — | Service health envelope. Mounted above the rate limiter — it never depends on Redis and never spends the caller's request budget (AGENTS.md) |
| POST | /api/v1/auth/signup | — | Email+password signup via GoTrue; every account starts `universal` (DB trigger). Returns session or `confirmationRequired` |
| POST | /api/v1/auth/login | — | Password login → session (access/refresh tokens) |
| POST | /api/v1/auth/refresh | — | Exchange refresh token for a fresh session |
| POST | /api/v1/auth/logout | Bearer | Best-effort GoTrue sign-out |
| GET | /api/v1/auth/me | Bearer | User + profile + roles (RLS-scoped reads with the user's own token) |
| GET | /api/v1/auth/oauth/providers | — | Enabled social providers (e.g. `["google"]`, `[]` if none) — drives which social buttons the frontend shows |
| GET | /api/v1/auth/oauth/:provider | — | 302 → GoTrue `/authorize?provider=…&redirect_to=<FRONTEND_URL>/auth/callback` to start the OAuth flow. 400 `UNSUPPORTED_PROVIDER` for anything outside the allow-list |
| GET | /api/v1/learn/courses | Bearer | Published courses + rollup progress for the caller (adventureCount, lessonCount, progress) |
| GET | /api/v1/learn/courses/:slug/tree | Bearer | Full course tree (adventures → sagas → topics → lessons) with per-node unlock state + `nextLessonId` — the single source of truth (COURSE_ENGINE.md §2) |
| GET | /api/v1/learn/lessons/:id | Bearer | Lesson meta + client-safe document + Echo's narration manifest (`audio`), locale-resolved (caller locale → es-MX → any). 403 `LESSON_LOCKED` if not yet unlocked |
| POST | /api/v1/learn/lessons/:id/grade | Bearer | Server-authoritative single-segment grading via `lesson-contract/` graders. 409 `ATTEMPTS_EXHAUSTED`, 422 `UNSUPPORTED_SEGMENT` |
| POST | /api/v1/learn/lessons/:id/complete | Bearer | Body `{seconds_spent, local_date?}` (legacy `minutes_spent` accepted; `local_date` = the learner's local YYYY-MM-DD, the day-streak anchor). Recomputes the lesson score from recorded attempts (never trusts a client score; no graded weight = 100/passed), upserts `lesson_progress`, applies the XP/time/streak delta to `learning_stats`, and returns day-streak facts (`streak_days`/`streak_extended`/`first_today`) for the celebration screen. 502 if the `learning_stats` read does not answer — `lesson_progress` is already saved and the stats row is left untouched, so the client can retry (never computes the delta from assumed zeros; see AGENTS.md read-modify-write) |
| GET | /api/v1/profile | Bearer | Own profile: identity, cover, avatar options, birthDate, follow counts, learningStats |
| PATCH | /api/v1/profile | Bearer | Update displayName / @username (409 USERNAME_TAKEN) / locale (language of record) / birthDate |
| PUT | /api/v1/profile/cover | Bearer | Set cover PRESET id (token gradients only — no binary/upload path exists) |
| PUT | /api/v1/profile/avatar | Bearer | Save DiceBear Avataaars option set (strict whitelist — never an image) |
| GET | /api/v1/profile/followers | Bearer | My followers (read-only list) |
| GET | /api/v1/profile/following | Bearer | Who I follow (list; unfollow lives on `/profiles/:username/follow`) |
| GET | /api/v1/profile/blocked | Bearer | My blocked accounts |
| GET | /api/v1/profiles/:username | Bearer | Public profile (whitelisted fields + isFollowing/isTutor/learningStats); 404 if either side has blocked the other |
| GET | /api/v1/profiles/:username/followers | Bearer | That user's followers (read-only; block-gated) |
| GET | /api/v1/profiles/:username/following | Bearer | That user's following (read-only; block-gated) |
| POST | /api/v1/profiles/:username/follow | Bearer | Follow (RLS-owned write; 404 if blocked) |
| DELETE | /api/v1/profiles/:username/follow | Bearer | Unfollow |
| POST | /api/v1/profiles/:username/block | Bearer | Block: removes any existing follow edge in both directions; hides both profiles from each other (mutual 404) |
| DELETE | /api/v1/profiles/:username/block | Bearer | Unblock |
| POST | /api/v1/verification/parent | Bearer | multipart form + ID photo → Guardian OCR verdict; on verified: `parent_verifications` row + `parent` role grant. Rate-limited 5/h/user |
| GET | /api/v1/admin/analytics/overview | Bearer + admin/superadmin | Plausible KPIs (visitors/pageviews/bounce/duration) + daily timeseries, `?period=day\|7d\|30d\|month\|6mo\|12mo`, optional `?filters=` (JSON Plausible v2 filter array). Core-brokered from Pulse (tokens server-side, 60s cache). 503 `PULSE_UNCONFIGURED`, 502 `UPSTREAM_FAILED` |
| GET | /api/v1/admin/analytics/breakdown | Bearer + admin/superadmin | Top-N rows for one dimension (`?dimension=page\|source\|referrer\|channel\|country\|region\|device\|browser\|os\|entry_page\|exit_page\|utm_source\|utm_medium\|utm_campaign`, `?limit=1..50` default 8, same `?period`/`?filters`), ordered by visitors desc. Rows: `{label, visitors, pageviews, bounceRate, visitDuration}` |
| GET | /api/v1/admin/analytics/report | Bearer + admin/superadmin | Report bundle for `?audience=marketing\|sales\|frontend\|full` (default full): aggregate + timeseries + the audience's top-10 breakdowns, same `?period`/`?filters` |
| GET | /api/v1/admin/analytics/report.pdf | Bearer + admin/superadmin | **Envelope exception (documented, like Depot's file route):** success streams raw branded PDF bytes (`Content-Type: application/pdf`, attachment filename `littlefounders-analytics-<audience>-<period>-<YYYY-MM-DD>.pdf`); every error path still answers the JSON envelope (400/503/502) |
| GET | /api/v1/admin/analytics/exclusions | Bearer + admin/superadmin | Read-only mirror of the analytics IP blocklist: `{ips}` parsed from Core's `PLAUSIBLE_IP_BLOCKLIST` env. No write endpoint — enforcement lives in pulse-plausible's `IP_BLOCKLIST` (Railway variables, infra step) |
| GET | /api/v1/admin/analytics/behavior | Bearer + admin/superadmin | Umami behavioral stats (adult surfaces only, §1.9) for the same `?period` window |
| GET | /api/v1/admin/health/services | Bearer + admin/superadmin | Per-service status/latency/24h-uptime from Uptime Kuma's status page + `summary.down` rollup |
| GET | /api/v1/family/kids | Bearer + parent | The caller's VERIFIED kids (guardian_links re-checked server-side), whitelisted fields only ({userId, displayName, username}) |
| GET | /api/v1/family/kids/:kidId/courses/:slug/territory | Bearer + parent | A kid's course territory through the parent's eyes: the SAME CourseTree shape the kid sees, computed from THEIR progress (service-role post-guard), plus a stats strip (xp/lessons/streaks). 403 without a VERIFIED guardian link for that kid |
| GET | /api/v1/admin/learning/retention | Bearer + admin/superadmin | Always-on retention: first-EVER-attempt scores on spaced-review lessons bucketed by days since the learner last practiced the cited source topics, plus per-source-topic decay rows. Computed in Vault (`admin_retention_*` fns, migration 0016 — EXECUTE revoked from client roles); the platform's spaced reviews ARE the delayed test, zero extra assessments |
| GET | /api/v1/admin/generation | Bearer + admin/superadmin | Generation telemetry overview (migration 0017, written by coursegen at the end of every non-dry run): last 10 `generate:track` reports (totals, failure heatmap by stage, mop-up list, halt cause) + last 20 runs (published/failed, cost, cache-hit, images). 502 `DATA_UNAVAILABLE` when Vault does not answer |
| GET | /api/v1/admin/generation/runs/:runId | Bearer + admin/superadmin | One run's full record: RunSummary + params + per-slot outcomes (state, failure stage, salvage, duration, judge rubric, revise cycles, early-stop). `runId` validated `^[A-Za-z0-9._-]{1,200}$` → 400 `VALIDATION_ERROR`; unknown id or Vault down → 502 `DATA_UNAVAILABLE` |
| GET | /api/v1/admin/users | Bearer + admin/superadmin | All platform users with roles, locale, join date, birth date. Service-role reads profiles + user_roles for unprivileged access. 502 `DATA_UNAVAILABLE` |
| GET | /api/v1/admin/users/timeline | Bearer + admin/superadmin | Signup counts per day: `?days=7-365` (default 90, Zod-validated). Fills zero-count days. 502 `DATA_UNAVAILABLE` |
| GET | /api/v1/admin/emails/logs | Bearer + admin/superadmin | Paginated email history proxied from Courier: `?limit=1-200&offset=0+`. Core validates email-server response shape with Zod before forwarding. Zod-validated query params. 502 `DATA_UNAVAILABLE` |
| GET | /api/v1/admin/emails/summary | Bearer + admin/superadmin | Email aggregate: `{ total, statuses, templates }`. Proxied from Courier, response shape validated. 502 `DATA_UNAVAILABLE` |

**Social login (Google) is LIVE in production (2026-07-20)** — Core brokers the GoTrue provider flow through the two `/oauth` routes above (the browser only ever talks to Core, §1.5); the frontend `/auth/callback` route consumes the returned token fragment. The Google Cloud OAuth client is "LittleFounders v2 (GoTrue)" (project `littlefounders-auth`); GoTrue holds `GOTRUE_EXTERNAL_GOOGLE_ENABLED/CLIENT_ID/SECRET/REDIRECT_URI`. Verified E2E: button → Google → GoTrue → `/auth/callback` → session; OAuth users get their `display_name` from Google metadata (migration 0011) and start `universal`. The authorize URL always adds `prompt=select_account` for Google (`PROVIDER_AUTHORIZE_PARAMS` in `services/gotrue.ts`) — verified via the raw redirect header that GoTrue forwards it straight to Google, so a browser holding one Google session still shows the account chooser instead of silently reusing it. Adding Discord/Facebook later = extend the `OAUTH_PROVIDERS` allow-list + enable the provider in GoTrue + give it its own `PROVIDER_AUTHORIZE_PARAMS` entry if it needs one; no shape changes.

## Notes

- JWTs are verified locally (HS256, `SUPABASE_JWT_SECRET`) — no per-request GoTrue round-trip.
- Request bodies are capped at 64 kB (`express.json({ limit: '64kb' })`). The envelope error handler answers with the HTTP status the thrown error carries (`err.status`/`err.statusCode` — body-parser attaches one; a `MulterError` is mapped to 400 by name): 413 → `PAYLOAD_TOO_LARGE`, any other 4xx → `VALIDATION_ERROR`, everything else → 500 `INTERNAL`. It used to flatten every client mistake into 500, telling the caller "we broke" when their body was simply malformed or oversized.
- Service-role PostgREST writes are reserved for what RLS deliberately closes to clients: role grants, `parent_verifications`, `audit_logs`, follower/following/blocked list hydration (reading OTHER users' profiles/avatars/roles).
- The ID photo is forwarded in memory to Guardian and never persisted here either.
- `learning_stats` (xp/minutes/lessons/streak) is system-written only — the ONLY route that mutates it is `POST /api/v1/learn/lessons/:id/complete`, and only by an XP delta / minutes / a newly-passed lesson increment it computes itself.
- Lesson grading is SERVER-AUTHORITATIVE: `backend/src/lesson-contract/` is a parity-checked copy (`npm run contract:check`) of the frontend's pure grading validators (`frontend/src/lesson-engine/{core/scoring.ts,core/types.ts (trimmed),families/*/grade.ts}`) — no workspaces (/AGENTS.md §1.2), so Core cannot import them directly. `lesson_documents.answer_keys` never leaves the service-role boundary; `POST /grade` re-attaches the server-only answer key to the client-safe segment and grades with the SAME validators the frontend ships, so scores can never be forged client-side.
- The course/lesson unlock rule (locked/available/current/passed) is computed in exactly one place: `backend/src/services/unlockRules.ts` + `courseTree.ts`, consumed by all four `/learn` content routes. The client never re-derives it (COURSE_ENGINE.md §2).
