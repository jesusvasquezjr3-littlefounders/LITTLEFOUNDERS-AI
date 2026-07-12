# backend (Core)

> Part of LittleFounders v2. Read [/AGENTS.md](../AGENTS.md) first; domain rules in [AGENTS.md](AGENTS.md).

**Mission:** Main API — the only service the frontend calls. Auth, roles, families, guardian links, tasks, profiles; orchestrates internal services.
**Port (dev):** 4000 · **Deploy:** Railway

```bash
npm install
cp .env.example .env   # fill values (local Supabase secrets live in database/supabase/docker/.env)
npm run dev
npm test
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
| GET | /api/v1/learn/courses | Bearer | Published courses + lesson counts (RLS-scoped) |
| GET | /api/v1/profile | Bearer | Own profile: identity, cover, avatar options, follow counts |
| PATCH | /api/v1/profile | Bearer | Update displayName / @username (409 USERNAME_TAKEN) / locale (language of record) |
| PUT | /api/v1/profile/cover | Bearer | Set cover PRESET id (token gradients only — no binary/upload path exists) |
| PUT | /api/v1/profile/avatar | Bearer | Save DiceBear Avataaars option set (strict whitelist — never an image) |
| GET | /api/v1/profiles/:username | Bearer | Public profile (whitelisted fields + isFollowing/isTutor) |
| POST | /api/v1/profiles/:username/follow | Bearer | Follow (RLS-owned write) |
| DELETE | /api/v1/profiles/:username/follow | Bearer | Unfollow |
| POST | /api/v1/verification/parent | Bearer | multipart form + ID photo → Guardian OCR verdict; on verified: `parent_verifications` row + `parent` role grant. Rate-limited 5/h/user |

Social login (Google first, then Discord/Facebook…) will extend `/api/v1/auth` with the GoTrue provider flow — same envelope, no breaking changes planned.

## Notes

- JWTs are verified locally (HS256, `SUPABASE_JWT_SECRET`) — no per-request GoTrue round-trip.
- Service-role PostgREST writes are reserved for what RLS deliberately closes to clients: role grants, `parent_verifications`, `audit_logs`.
- The ID photo is forwarded in memory to Guardian and never persisted here either.
