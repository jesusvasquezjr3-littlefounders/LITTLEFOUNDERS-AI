# backend (Core)

> Part of LittleFounders v2. Read [/AGENTS.md](../AGENTS.md) first; domain rules in [AGENTS.md](AGENTS.md).

**Mission:** Main API — the only service the frontend calls. Auth, roles, families, guardian links, tasks, profiles; orchestrates internal services.
**Port (dev):** 4000 · **Deploy:** Railway

```bash
npm install
cp .env.example .env   # fill values (local Supabase secrets live in database/supabase/docker/.env)
npm run dev
npm test
npm run contract:check         # the parity gate below (also runs as part of `npm test`)
npm run lesson-contract:check  # lesson-contract/ vs frontend/src/lesson-engine
```

## Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /health | — | Service health envelope. Mounted above the rate limiter — it never depends on Redis and never spends the caller's request budget (AGENTS.md) |
| POST | /api/v1/auth/signup | — | Email+password signup via GoTrue; every account starts `universal` (DB trigger). Returns session or `confirmationRequired` |
| POST | /api/v1/auth/login | — | Password login → session (access/refresh tokens) |
| POST | /api/v1/auth/refresh | — | Exchange refresh token for a fresh session |
| POST | /api/v1/auth/logout | Bearer | Best-effort GoTrue sign-out |
| GET | /api/v1/auth/me | Bearer | User + profile + roles (RLS-scoped reads with the user's own token), plus `analyticsEnabled` (whether the usage beacon may transmit — fail-closed for kids without active guardian consent) and `newAccount` (profile created within the last 120 s; the OAuth landing needs it to emit signup_complete vs login_complete, since GoTrue returns an identical session either way) |
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
| GET | /api/v1/admin/content | Bearer + admin/superadmin | Course moderation inventory |
| POST | /api/v1/admin/content/:courseId/status | Bearer + admin/superadmin | Change a course state. `published` is a human approval that calls Vault's atomic `release_course` RPC; a refusal maps to a distinct envelope error per cause — 404 `RELEASE_NOT_FOUND`, or 409 `RELEASE_ARCHIVED` / `RELEASE_INCOMPLETE_HIERARCHY` / `RELEASE_LESSONS_NOT_REVIEWABLE` / `RELEASE_INCOMPLETE_LOCALES` / `RELEASE_VERIFICATION_REQUIRED` (unknown RPC codes degrade to 409 `RELEASE_BLOCKED`). Other supported states remain direct status changes. |
| GET | /api/v1/admin/moderation | Bearer + admin/superadmin | Exact, unbounded review queue with lesson hierarchy, metadata, locale coverage, and total count |
| GET | /api/v1/admin/moderation/:lessonId | Bearer + admin/superadmin | Review detail with answer-stripped lesson documents for human preview |
| POST | /api/v1/admin/moderation/:lessonId/status | Bearer + admin/superadmin | Approve or return a lesson to draft |
| GET | /api/v1/admin/analytics/overview | Bearer + admin/superadmin | Plausible KPIs (visitors/pageviews/bounce/duration) + daily timeseries, `?period=day\|7d\|30d\|month\|6mo\|12mo`, optional `?filters=` (JSON Plausible v2 filter array). Core-brokered from Pulse (tokens server-side, 60s cache). 503 `PULSE_UNCONFIGURED`, 502 `UPSTREAM_FAILED` |
| GET | /api/v1/admin/analytics/breakdown | Bearer + admin/superadmin | Top-N rows for one dimension (`?dimension=page\|source\|referrer\|channel\|country\|region\|device\|browser\|os\|entry_page\|exit_page\|utm_source\|utm_medium\|utm_campaign`, `?limit=1..50` default 8, same `?period`/`?filters`), ordered by visitors desc. Rows: `{label, visitors, pageviews, bounceRate, visitDuration}` |
| GET | /api/v1/admin/analytics/report | Bearer + admin/superadmin | Report bundle for `?audience=marketing\|sales\|frontend\|full` (default full): aggregate + timeseries + the audience's top-10 breakdowns, same `?period`/`?filters` |
| GET | /api/v1/admin/analytics/report.pdf | Bearer + admin/superadmin | **Envelope exception (documented, like Depot's file route):** success streams raw branded PDF bytes (`Content-Type: application/pdf`, attachment filename `littlefounders-analytics-<audience>-<period>-<YYYY-MM-DD>.pdf`); every error path still answers the JSON envelope (400/503/502) |
| GET | /api/v1/admin/analytics/exclusions | Bearer + admin/superadmin | Read-only mirror of the analytics IP blocklist: `{ips}` parsed from Core's `PLAUSIBLE_IP_BLOCKLIST` env. No write endpoint — enforcement lives in pulse-plausible's `IP_BLOCKLIST` (Railway variables, infra step) |
| GET | /api/v1/admin/analytics/behavior | Bearer + admin/superadmin | Umami behavioral stats (adult surfaces only, §1.9) for the same `?period` window |
| GET | /api/v1/admin/health/services | Bearer + admin/superadmin | Per-service status/latency/24h-uptime from Uptime Kuma's status page + `summary.down` rollup |
| GET | /api/v1/family/kids | Bearer + parent | The caller's VERIFIED kids (guardian_links re-checked server-side), whitelisted fields only ({userId, displayName, username, analyticsConsent}) |
| POST | /api/v1/family/kids/:kidId/analytics-consent | Bearer + parent | Grant usage-insights consent for a kid (/INSIGHTS.md §5). 403 without a VERIFIED guardian link for that kid; INSERTs into the append-only analytics_consents ledger. Idempotent: re-granting an active consent is a 200 that records NO consent event (a re-tapped toggle is not a new guardian decision) |
| DELETE | /api/v1/family/kids/:kidId/analytics-consent | Bearer + parent | Revoke: collection stops immediately, the row survives with revoked_at (audit). Records a consent event only when an open consent was actually closed |
| POST | /api/v1/events | Bearer | First-party usage telemetry ingest (/INSIGHTS.md): batch of 1–25 closed-enum events. Identity/role stamped server-side; kid batches are DROPPED (202, accepted:0) unless guardian consent is active — fail-closed on a Vault failure. An optional `anonId` closes the acquisition loop: on `signup_complete`/`login_complete` the visitor is linked to the account (first conversion wins, kids never), which is what makes OAuth signups attributable at all |
| GET | /api/v1/admin/insights/calibration | Bearer + admin/superadmin | Worst-calibrated exercises from the 0023 view (query: minLearners 1-100, limit 1-200) |
| GET | /api/v1/admin/insights/activity | Bearer + admin/superadmin | Reads the accumulating rollups (query: days 1-365). Returns `entries` (per-dimension: day x role x event x surface x device x locale, capped at 20k rows, day-desc) AND `users` (distinct users/sessions per day; `role: ''` is the true all-roles count). They are separate because distinct counts are NOT additive — summing `entries[].users` counts a learner once per dimension combination |
| GET | /api/v1/admin/insights/cohorts | Bearer + admin/superadmin | Weekly cohort retention matrix (query: weeks 1-52) |
| GET | /api/v1/admin/insights/funnel | Bearer + admin/superadmin | The standard activation funnel (visited → signup_started → signed_up → opened_course → started_lesson → completed_lesson), one row per step |
| GET | /api/v1/admin/insights/velocity | Bearer + admin/superadmin | Per-learner learning velocity — lessons/week, avg score, avg attempts (query: limit 1-500) |
| GET | /api/v1/admin/insights/dropoff | Bearer + admin/superadmin | Lesson drop-off ranked by abandon rate (query: limit 1-500) |
| GET | /api/v1/admin/insights/adoption | Bearer + admin/superadmin | Feature adoption — events/users/sessions per role x surface |
| GET | /api/v1/admin/insights/sessions | Bearer + admin/superadmin | Deepest recent sessions, bounded to a rolling window (query: days 1-90, limit 1-1000) |
| GET | /api/v1/admin/insights/timetovalue | Bearer + admin/superadmin | Hours from first sight to first completed lesson, per learner (query: limit 1-500) |
| GET | /api/v1/admin/insights/engagement | Bearer + admin/superadmin | 0-100 engagement score per learner — breadth (lessons) + consistency (streak) + depth (sessions) (query: limit 1-500) |
| GET | /api/v1/admin/insights/families | Bearer + admin/superadmin | Household task engagement + kid consent coverage (query: limit 1-500) |
| GET | /api/v1/admin/insights/export | Bearer + admin/superadmin | Filtered raw-event export for internal analysis: `?format=csv\|json&days=1-365&limit=1-50000&offset=0+` plus optional role/event/routeClass/locale/device. Carries NO `user_id`/`anon_id`, and `session_id` is replaced by `session_ref` — a per-export salted hash, so within-file sequence analysis works but two files cannot be joined on it. Truncation is declared via `X-LF-Export-Rows` / `X-LF-Export-Truncated` / `X-LF-Export-Next-Offset` (and `truncated`/`nextOffset` in the JSON envelope). Every pull is written to the append-only audit log. **Envelope exception on the `format=csv` branch** (same posture as `/analytics/report.pdf` above): the body is a raw CSV so the frontend's export reader can pipe it straight into a downloadable file; the `format=json` branch and every error path still use the standard envelope |
| ANY | /api/v1/admin/intel/* | Bearer + admin/superadmin | Proxy to the `dataintel` service's 40 analytical endpoints (DATAINTEL.md §4) — segmentation, forecasting, anomaly detection, churn, experiments, alerts. Forwards the internal API key; dataintel's own `{data,error}` responses pass through unmodified |
| GET | /api/v1/family/kids/:kidId/courses/:slug/territory | Bearer + parent | A kid's course territory through the parent's eyes: the SAME CourseTree shape the kid sees, computed from THEIR progress (service-role post-guard), plus a stats strip (xp/lessons/streaks). 403 without a VERIFIED guardian link for that kid |
| GET | /api/v1/admin/learning/retention | Bearer + admin/superadmin | Always-on retention: first-EVER-attempt scores on spaced-review lessons bucketed by days since the learner last practiced the cited source topics, plus per-source-topic decay rows. Computed in Vault (`admin_retention_*` fns, migration 0016 — EXECUTE revoked from client roles); the platform's spaced reviews ARE the delayed test, zero extra assessments |
| GET | /api/v1/admin/generation | Bearer + admin/superadmin | Generation telemetry overview (migration 0017, written by coursegen at the end of every non-dry run): last 10 `generate:track` reports (totals, failure heatmap by stage, mop-up list, halt cause) + last 20 runs (published/failed, cost, cache-hit, images). 502 `DATA_UNAVAILABLE` when Vault does not answer |
| GET | /api/v1/admin/generation/runs/:runId | Bearer + admin/superadmin | One run's full record: RunSummary + params + per-slot outcomes (state, failure stage, salvage, duration, judge rubric, revise cycles, early-stop). `runId` validated `^[A-Za-z0-9._-]{1,200}$` → 400 `VALIDATION_ERROR`; unknown id or Vault down → 502 `DATA_UNAVAILABLE` |
| GET | /api/v1/admin/users | Bearer + admin/superadmin | All platform users with roles, locale, join date, birth date. Service-role reads profiles + user_roles for unprivileged access. 502 `DATA_UNAVAILABLE` |
| GET | /api/v1/admin/users/timeline | Bearer + admin/superadmin | Signup counts per day: `?days=7-365` (default 90, Zod-validated). Fills zero-count days. 502 `DATA_UNAVAILABLE` |
| GET | /api/v1/admin/emails/logs | Bearer + admin/superadmin | Paginated and filtered email history proxied from Courier: `?limit=1-200&offset=0+`, optional `q`, `status`, and `templateType`. Core validates email-server response shape with Zod before forwarding. 502 `DATA_UNAVAILABLE` |
| GET | /api/v1/admin/emails/summary | Bearer + admin/superadmin | Exact email aggregate: `{ total, statuses, templates, locales, trend }`. Proxied from Courier, response shape validated. 502 `DATA_UNAVAILABLE` |

**Social login (Google) is LIVE in production (2026-07-20)** — Core brokers the GoTrue provider flow through the two `/oauth` routes above (the browser only ever talks to Core, §1.5); the frontend `/auth/callback` route consumes the returned token fragment. The Google Cloud OAuth client is "LittleFounders v2 (GoTrue)" (project `littlefounders-auth`); GoTrue holds `GOTRUE_EXTERNAL_GOOGLE_ENABLED/CLIENT_ID/SECRET/REDIRECT_URI`. Verified E2E: button → Google → GoTrue → `/auth/callback` → session; OAuth users get their `display_name` from Google metadata (migration 0011) and start `universal`. The authorize URL always adds `prompt=select_account` for Google (`PROVIDER_AUTHORIZE_PARAMS` in `services/gotrue.ts`) — verified via the raw redirect header that GoTrue forwards it straight to Google, so a browser holding one Google session still shows the account chooser instead of silently reusing it. Adding Discord/Facebook later = extend the `OAUTH_PROVIDERS` allow-list + enable the provider in GoTrue + give it its own `PROVIDER_AUTHORIZE_PARAMS` entry if it needs one; no shape changes.

## Notes

- JWTs are verified locally (HS256, `SUPABASE_JWT_SECRET`) — no per-request GoTrue round-trip.
- Request bodies are capped at 64 kB (`express.json({ limit: '64kb' })`), with one deliberate exception that carries its OWN parser and budget: `/api/v1/events` (beacon batches, mounted above the global limiter). Raising the global cap would hand every other route the same headroom. The envelope error handler answers with the HTTP status the thrown error carries (`err.status`/`err.statusCode` — body-parser attaches one; a `MulterError` is mapped to 400 by name): 413 → `PAYLOAD_TOO_LARGE`, any other 4xx → `VALIDATION_ERROR`, everything else → 500 `INTERNAL`. It used to flatten every client mistake into 500, telling the caller "we broke" when their body was simply malformed or oversized.
- Service-role PostgREST writes are reserved for what RLS deliberately closes to clients: role grants, `parent_verifications`, `audit_logs`, follower/following/blocked list hydration (reading OTHER users' profiles/avatars/roles).
- The ID photo is forwarded in memory to Guardian and never persisted here.
- `learning_stats` (xp/minutes/lessons/streak) is system-written only — exactly ONE route mutates it, `POST /api/v1/learn/lessons/:id/complete`, and only by an XP delta / minutes / streak it computes itself from a server-derived score. `lessons_completed` is incremented there: `stats.lessons_completed === 0` is how Core asserts "first lesson ever", and it also feeds course progress, the parent dashboard and every `dataintel` funnel. The route answers 502 rather than writing when the stats read does not answer (§1.14).
- Lesson grading is SERVER-AUTHORITATIVE: `backend/src/lesson-contract/` is a parity-checked copy (`npm run contract:check`) of the frontend's pure grading validators (`frontend/src/lesson-engine/{core/scoring.ts,core/types.ts (trimmed),families/*/grade.ts}`) — no workspaces (/AGENTS.md §1.2), so Core cannot import them directly. `lesson_documents.answer_keys` never leaves the service-role boundary; `POST /grade` re-attaches the server-only answer key to the client-safe segment and grades with the SAME validators the frontend ships, so scores can never be forged client-side.
- The course/lesson unlock rule (locked/available/current/passed) is computed in exactly one place: `backend/src/services/unlockRules.ts` + `courseTree.ts`, consumed by all four `/learn` content routes. The client never re-derives it (COURSE_ENGINE.md §2).
