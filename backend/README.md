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
| GET | /health | — | Service health envelope |
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
| POST | /api/v1/learn/lessons/:id/complete | Bearer | Body `{seconds_spent, local_date?}` (legacy `minutes_spent` accepted; `local_date` = the learner's local YYYY-MM-DD, the day-streak anchor). Recomputes the lesson score from recorded attempts (never trusts a client score; no graded weight = 100/passed), upserts `lesson_progress`, applies the XP/time/streak delta to `learning_stats`, and returns day-streak facts (`streak_days`/`streak_extended`/`first_today`) for the celebration screen |
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

**Social login (Google) is code-complete** — Core brokers the GoTrue provider flow through the two `/oauth` routes above (the browser only ever talks to Core, §1.5); the frontend `/auth/callback` route consumes the returned token fragment. Going live needs only the OAuth credentials on GoTrue: `GOTRUE_EXTERNAL_GOOGLE_ENABLED=true` + `CLIENT_ID` + `SECRET` (the redirect URI is pre-staged). `/oauth/providers` returns `[]` until then, so the button auto-hides. Adding Discord/Facebook later = extend the `OAUTH_PROVIDERS` allow-list; no shape changes.

## Notes

- JWTs are verified locally (HS256, `SUPABASE_JWT_SECRET`) — no per-request GoTrue round-trip.
- Service-role PostgREST writes are reserved for what RLS deliberately closes to clients: role grants, `parent_verifications`, `audit_logs`, follower/following/blocked list hydration (reading OTHER users' profiles/avatars/roles).
- The ID photo is forwarded in memory to Guardian and never persisted here either.
- `learning_stats` (xp/minutes/lessons/streak) is system-written only — the ONLY route that mutates it is `POST /api/v1/learn/lessons/:id/complete`, and only by an XP delta / minutes / a newly-passed lesson increment it computes itself.
- Lesson grading is SERVER-AUTHORITATIVE: `backend/src/lesson-contract/` is a parity-checked copy (`npm run contract:check`) of the frontend's pure grading validators (`frontend/src/lesson-engine/{core/scoring.ts,core/types.ts (trimmed),families/*/grade.ts}`) — no workspaces (/AGENTS.md §1.2), so Core cannot import them directly. `lesson_documents.answer_keys` never leaves the service-role boundary; `POST /grade` re-attaches the server-only answer key to the client-safe segment and grades with the SAME validators the frontend ships, so scores can never be forged client-side.
- The course/lesson unlock rule (locked/available/current/passed) is computed in exactly one place: `backend/src/services/unlockRules.ts` + `courseTree.ts`, consumed by all four `/learn` content routes. The client never re-derives it (COURSE_ENGINE.md §2).
