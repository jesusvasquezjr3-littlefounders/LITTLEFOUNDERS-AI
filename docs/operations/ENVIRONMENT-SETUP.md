---
title: Environment setup
status: scaffold
updated: 2026-10-12
---

# Environment setup

> How to get a working development machine, and how to check it is correct.

> **Status: scaffold.** The structure is set; nothing below that is not marked as current state has been decided. Fill it in with the owner, then change the status to `draft` and, once approved, `accepted`.

## Role

An environment configured badly produces errors that look like product bugs. This is the checklist for a human or an agent to start from a known-good state.

## Read this when

- Setting up a machine.
- Something works on one machine and not another.

## To define

- [ ] Prerequisites: Node 24, Docker, Git and Git LFS, shell notes for Windows.
- [ ] Machine profiles and how to measure free memory before starting services.
- [ ] Clone, install and run commands per package.
- [ ] Environment variables: the full catalog, what each is for, where its real value comes from.
- [ ] The local database stack.
- [ ] Enabling the repository git hooks.
- [ ] A verification checklist.
- [ ] Known traps and fixes.

## Current state

- Clone with Git LFS installed. Frontend: `npm install`, `npm run dev`, `npm run type-check && npm run lint && npm run build` in `frontend/`. Database stack from `database/`: `npm run db:sync`, then `db:up`. Enable the documentation check with `git config core.hooksPath .githooks`. The frontend dev server listens on `localhost` (the IPv6 loopback, not `127.0.0.1`) and must be restarted after a change to `vite.config.ts` or after installing a Tailwind or shadcn piece; more traps in [[FRONTEND-TOOLKIT]]. The mail service reads `email-server/.env` (ignored by git; the list of variables is `email-server/.env.example`). With `EMAIL_ENGINE=noop` it sends nothing; with `smtp` it delivers to the local mail catcher; with `haraka` it relays through Brevo's SMTP relay (D-060 in [[DECISIONS]]). The frontend audit tools (`npm run audit:*`) need Chrome and the dev server running; set `CHROME_PATH` if Chrome is not in its usual place.

## Running sign-in locally

Three things, each in its own terminal, after measuring free memory (the Supabase stack takes about 4 GB):

1. `database/`: `npm run db:up` (Docker Desktop running). The first run creates `database/supabase/docker/.env` with generated secrets; every run applies the local settings (no automatic email confirmation, no anonymous or phone sign-in, the "send email" hook pointed at Core, the closed gateway) and, the first time, generates `SEND_EMAIL_HOOK_SECRET` there. `npm run db:migrate` applies the migrations; `npm run db:reset` rebuilds from zero and deletes local data.
2. `backend/`: copy `.env.example` to `.env`, fill `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_JWT_SECRET` from `ANON_KEY`, `SERVICE_ROLE_KEY` and `JWT_SECRET` in `database/supabase/docker/.env`, and `SEND_EMAIL_HOOK_SECRET` from the same file, choose any `INTERNAL_API_KEY` of 16 characters or more, then `npm install` and `npm run dev` (port 4000).
3. `email-server/`: a `.env` with `EMAIL_ENGINE=smtp`, `FRONTEND_URL=http://localhost:5173` and the same `INTERNAL_API_KEY` (and, to keep the delivery history in the database, `SUPABASE_URL` and `MAIL_SERVICE_KEY`, which `npm run db:up` generates in `database/supabase/docker/.env`; never the service key), and `NODE_ENV=development`, then `npm ci` and `npm run dev` (port 4005). It delivers to the mail catcher and no further.
4. `frontend/`: `VITE_BACKEND_URL=http://localhost:4000` in `frontend/.env`, then `npm run dev` (port 5173).

The emails arrive in the mail catcher at `http://localhost:8025`, in their real design (the images come from the frontend's dev server). `npm run preview` in `email-server/` writes every email in every language to `email-server/preview/` without sending anything ([[F-002-emails]]). `npm run audit:signin` in `frontend/` walks the whole window and saves a screenshot of each step. Google sign-in is off locally unless `GOTRUE_EXTERNAL_GOOGLE_ENABLED=true`, `GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID` and `GOTRUE_EXTERNAL_GOOGLE_SECRET` are added to `database/supabase/docker/.env` (a test client whose redirect address is `http://localhost:8000/auth/v1/callback`; never the production secret).

### Rules for the local environment

They are mandatory (rule 15 of `CLAUDE.md`): nothing a person uses is reported as working until its flow was walked under them. They exist because breaking them produced wrong diagnoses on 2026-10-11: walks that passed while the owner could not get through.

1. **Look before starting.** List what is running (`Get-CimInstance Win32_Process -Filter "Name='node.exe'"` on Windows, `pgrep -fl node` elsewhere) and what listens on 5173, 4000, 4005 and 8025. Start only what is missing.
2. **One of each.** One dev server (5173, and it refuses any other port), one Core (4000), one mail service (4005), one Supabase stack. Stop a server before starting it again; never leave an old `tsx watch` or an old dev server behind, from this copy of the repository or another.
3. **Stop what you started** when the work is done, or say plainly what was left running and on which port.
4. **A flow is tested from nothing.** Each flow runs in a browser with no cookies and nothing stored, and says so before its first step (`npm run audit:flows` does). The states that only exist with history (a guest, an account left half way, a returning person) are reached by walking to them in that same browser, not by leaving them over from another test.
5. **Test what the person does, where they do it.** Through the interface, on `http://localhost:5173`, reading the code from the mail catcher. A call to Core that answers correctly does not show that a button leads anywhere.
6. **Every ending of a flow is checked,** not only the one that creates an account: "later", closing the window half way, erasing, signing out, coming back.
7. **A failure is read before it is retried.** A walk that passes on the second run failed for a reason the first time (a limit, a slow service, two servers): find it and write it down.
8. **Say what was not run.** A report names the flows walked, the widths, the languages, and anything skipped.

### When sign-in does not work locally

Found on 2026-10-11, when the owner could not get through while every automated walk passed:

- **One of each, and no more.** Core allows one origin, `http://localhost:5173`. A second dev server used to move to 5174 without saying so: the site loaded there and no request to Core worked. The dev server now refuses any other port (`strictPort` in `frontend/vite.config.ts`). Before starting anything, look at what is already running (`Get-CimInstance Win32_Process -Filter "Name='node.exe'"` on Windows) and stop old dev servers and old `tsx watch` processes of Core.
- **The code does not come to a real inbox.** Local mail goes to the mail catcher and no further: open `http://localhost:8025` to read the code, whatever address was typed.
- **The limits are the real ones unless `RELAXED_LIMITS=true` is in `backend/.env`** (D-057). Without it: ten code requests per address of the network in 15 minutes, one per email address per minute and five per hour ([[RATE-LIMITING-AND-ABUSE]]); past the per-address ones the window still says the code was sent and none arrives, on purpose; and the audit walks ask for codes from the same machine and use up the same ten. Locally the counters are in Core's memory: restarting Core clears them. With it, the authentication service still keeps a minute between two emails to one address.
- **A cold dev server is slow once.** The first click after it starts waits for the sign-in window's code to be built.

## Environment variables

Production's names are kept (D-031 in [[DECISIONS]]): the new version reads what is already set there. The names below were read from the production services on 2026-10-10, names only. A value is never written in this repository; `.env.example` files carry placeholders.

**Core, `backend/.env`** (Railway service `littlefounders-backend`)

| Name | For | In production today |
|---|---|---|
| `PORT` | The port Core listens on (4000) | yes |
| `NODE_ENV` | `production` turns on Secure, host-bound cookies, HSTS and the Redis requirement. Only the exact words `development` and `test` relax anything: a missing or misspelled value is treated as production (the same rule in the mail service). Local `.env` files set `development` | yes |
| `FRONTEND_URL` | The one browser origin allowed to call Core | yes |
| `SUPABASE_URL` | The gateway | yes |
| `SUPABASE_ANON_KEY` | The bearer of a call made for somebody not signed in | yes |
| `SUPABASE_SERVICE_ROLE_KEY` | The key the gateway lets through, and the database functions' caller | yes |
| `SUPABASE_JWT_SECRET` | Checks the session tokens | yes |
| `REDIS_URL` | Counters for limits and code attempts. Core does not boot in production without it | yes |
| `EMAIL_SERVER_URL`, `INTERNAL_API_KEY` | The mail service and the key it expects. Core does not boot in production without them | yes |
| `SEND_EMAIL_HOOK_SECRET` | New. The secret the authentication service signs its "send email" hook with (`v1,whsec_` and a base64 key); the same value as its `GOTRUE_HOOK_SEND_EMAIL_SECRETS`. Core does not boot in production without it | to add |
| `PUBLIC_API_ORIGIN` | New. The address a browser reaches Core at: `https://api-b2c.littlefounders.ai` | to add |
| `TRUST_PROXY_HOPS` | New, optional (1). Proxies between the visitor and Core | confirm at deployment |
| `NEW_ADDRESS_CODES_PER_HOUR` | New, optional (300). Codes an hour that may go to addresses with no account yet, for the whole service. Keep it well under the authentication service's `GOTRUE_RATE_LIMIT_EMAIL_SENT` | confirm at deployment |
| `RELAXED_LIMITS` | New, development only. `true` makes the request limits a hundred times wider on a developer's machine (D-057, [[RATE-LIMITING-AND-ABUSE]]). Core refuses to start with it unless `NODE_ENV` is `development` | never |
| `SUPABASE_JWT_ISSUER` | New, optional. Unset: `SUPABASE_URL` + `/auth/v1` | no |

The production service also holds variables of features that do not exist yet in the new version (`TUTOR_SESSION_SECRET`, `LESSON_ATTEMPT_SECRET`, `ORACLE_*`, `FILEBASE_*`, `DATAINTEL_*`, `PARENT_ID_CHECK_URL`, `PLAUSIBLE_*`, `UMAMI_*`, `KUMA_*`, `COURSE_PATHWAY_ENGINE`) and a few nothing read at the restart (`ACCESS_TOKEN_EXPIRE_MINUTES`, `ALGORITHM`, `CORS_ORIGINS`, `DATABASE_*`, `SECRET_KEY`, `SUPABASE_KEY`). They stay where they are: a feature that returns reads its variable under the same name.

**Authentication service** (Railway service `auth`; locally the `auth` container, set by `database/scripts/local-stack.sh`)

| Name | For | In production today |
|---|---|---|
| `GOTRUE_EXTERNAL_GOOGLE_ENABLED`, `_CLIENT_ID`, `_SECRET`, `_REDIRECT_URI` | Google sign-in. Not touched by the new version | yes |
| `GOTRUE_SMTP_HOST`, `_PORT`, `_ADMIN_EMAIL`, `_SENDER_NAME` | How the service sent its own mail. Not used while the hook below is on; kept as the way back | yes |
| `GOTRUE_HOOK_SEND_EMAIL_ENABLED` (true), `GOTRUE_HOOK_SEND_EMAIL_URI` (`https://api-b2c.littlefounders.ai/api/v1/hooks/send-email`), `GOTRUE_HOOK_SEND_EMAIL_SECRETS` | The service hands each email to Core, signed, instead of sending it ([[F-002-emails]]) | to add |
| `GOTRUE_JWT_SECRET`, `_EXP`, `_ISSUER`, `_AUD` | Session tokens | yes |
| `GOTRUE_SITE_URL`, `GOTRUE_URI_ALLOW_LIST` | Where a browser may be sent back. Core's Google callback must be added to the list | value to extend |
| `GOTRUE_EXTERNAL_EMAIL_ENABLED`, `GOTRUE_DISABLE_SIGNUP`, `GOTRUE_MAILER_AUTOCONFIRM`, `GOTRUE_MAILER_SECURE_EMAIL_CHANGE_ENABLED`, `GOTRUE_EXTERNAL_PHONE_ENABLED` | Sign-up switches | yes |
| `GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED` | Anonymous accounts: the new version has none | set to `false` |
| `GOTRUE_MAILER_TEMPLATES_*`, `GOTRUE_MAILER_SUBJECTS_*`, `GOTRUE_MAILER_URLPATHS_*`, `GOTRUE_MAILER_EXTERNAL_HOSTS` | The previous version's emails. Not used once the hook is on | yes, can be removed |
| `GOTRUE_MAILER_OTP_EXP` (900), `GOTRUE_MAILER_OTP_LENGTH` (6) | The one-time code: 15 minutes, six digits | to add |
| `GOTRUE_SMTP_MAX_FREQUENCY` (60s), `GOTRUE_RATE_LIMIT_EMAIL_SENT` | One email a minute per address; the ceiling for the whole service | to add |
| `GOTRUE_SECURITY_REFRESH_TOKEN_ROTATION_ENABLED` (true), `GOTRUE_SECURITY_REFRESH_TOKEN_REUSE_INTERVAL` (10) | A refresh token is used once | to add |

**Gateway** (`kong`): `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY` (the service key under the gateway's own name), the new `MAIL_SERVICE_KEY` (the mail service's own key, the same value the mail service has: [[F-002-emails]]), `DASHBOARD_USERNAME`, `DASHBOARD_PASSWORD`, `KONG_*_HOST`. **Mail service** (`email-server`): `SMTP_RELAY_HOST` (`smtp-relay.brevo.com`), `SMTP_RELAY_PORT` (587), `SMTP_RELAY_USER` (the Brevo SMTP login) and `SMTP_RELAY_PASS` (the Brevo SMTP key), which replace `SES_RELAY_HOST`, `SES_RELAY_PORT`, `SES_SMTP_USER` and `SES_SMTP_PASS` since 2026-10-12 (D-060; both sets are set in production today, and the `SES_*` ones are removed once the version that reads the new names is deployed), `MAIL_FROM`, `EMAIL_ENGINE`, `HARAKA_*`, `INTERNAL_API_KEY`, `SUPABASE_URL`, the new `MAIL_SERVICE_KEY` (to add; it replaces `SUPABASE_SERVICE_ROLE_KEY`, which is removed from this service: the service key stays in Core), `NODE_ENV`, and the new, optional `FRONTEND_URL` (where the emails take their images from; default `https://littlefounders.ai`) and, for development only, `SMTP_HOST` and `SMTP_PORT` (`email-server/.env.example`). **Database** (`db`): `JWT_SECRET`, `JWT_EXP`, `POSTGRES_PASSWORD`. **REST** (`rest`): `PGRST_JWT_SECRET` and its `PGRST_*` settings.

**Frontend, `frontend/.env`** (Vercel)

| Name | For | In production today |
|---|---|---|
| `VITE_BACKEND_URL` | Core's address: `https://api-b2c.littlefounders.ai` | yes |
| `VITE_PLAUSIBLE_SRC`, `VITE_UMAMI_SRC`, `VITE_UMAMI_WEBSITE_ID`, `VITE_GA4_MEASUREMENT_ID` | Analytics, after consent | yes |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SCENE_ASSET_BASE` | Not read by the new version: the browser no longer talks to Supabase | yes, unused |

The same value has different names on different services; do not "fix" one to match another. The JWT secret is `SUPABASE_JWT_SECRET` on Core, `GOTRUE_JWT_SECRET` on `auth`, `PGRST_JWT_SECRET` on `rest`, `JWT_SECRET` on `db` and in the local `docker/.env`. The service key is `SUPABASE_SERVICE_ROLE_KEY` on Core, `SUPABASE_SERVICE_KEY` on the gateway, `SERVICE_ROLE_KEY` in the local `docker/.env`; no other service has it. The mail service's own key is `MAIL_SERVICE_KEY` on the mail service, on the gateway and in the local `docker/.env`.

## Related

- [[F-001-authentication]]
- [[DECISIONS]]

- [[README]]
- [[INFRASTRUCTURE]]
- [[DATABASE-GUIDE]]
- [[CI-CD-AND-VERSION-CONTROL]]
- [[CODE-STYLE-GUIDE]]
- [[AI-WORKFLOW]]

Back to [[INDEX]].

## Update this document when

- A prerequisite, command or environment variable changes.
