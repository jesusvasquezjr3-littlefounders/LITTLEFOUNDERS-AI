---
title: F-001 Sign-in, sign-up and user types
status: draft
updated: 2026-10-11
---

# F-001 Sign-in, sign-up and user types

> How a person gets an account and a session, what kinds of account exist, and what protects all of it.

> **Status: draft.** Built on 2026-10-10 from the owner's decisions D-025, D-027 and D-028 to D-031 in [[DECISIONS]], and run end to end on a local stack. Not deployed. The open points are listed at the end; the emails are [[F-002-emails]], and the onboarding is a separate, later piece of work.

## Summary

A person signs in with a one-time code sent to their email, or with Google. There is no password anywhere in the product. Entering a code for an address nobody has used creates the account, so signing in and signing up are the same two steps. The first time an account is seen it is asked its age, once; the age decides whether it is a `child` (under 18) or a `universal` user (18 or over). `parent`, `admin` and `superadmin` are held on top of `universal`.

The browser talks to one server, Core (`backend/`). Core talks to the authentication service (Supabase's GoTrue) and to the database; the browser reaches neither.

## User flows

All of them happen in one window (`frontend/src/features/auth/`: `AuthDialog.tsx` opens it, `AuthWindow.tsx` is the window and is downloaded on first use), opened from the topbar, from the bar at the bottom of phones, or by the app itself. Route paths are in English (D-011).

| Step | What the person sees | What happens |
|---|---|---|
| choose | "Continue with Google", "Continue with email or username", "Create an account" | Nothing is sent yet |
| identifier | One field: email or username to sign in, email to create an account | `POST /api/v1/auth/code`; a six-digit code is emailed |
| code | Six boxes, a countdown to "send a new code", a way back | `POST /api/v1/auth/code/verify`; the session cookies are set |
| age | "How old are you?" and, under 13, the permission box | `POST /api/v1/account/age`; the account gets its type. Shown once per account, also after a first Google sign-in |

Google: the button opens a small window (the tab itself when the browser refuses windows) on `GET /api/v1/auth/google/start`, which sends it to Google's account chooser through the authentication service. Google's answer comes back to `GET /api/v1/auth/google/callback`, which sets the cookies and sends the window to the page `/auth/callback`; that page tells the waiting page how it went (a word over a `BroadcastChannel`, never a token) and closes.

Signed in, the topbar shows a round account button with a menu that names the account and signs out. A visitor who never signed in makes no request to Core: a flag in `localStorage` (`lf.session`, the character `1`) records that this browser signed in once, and only then is the session asked for on load.

An age outside 6 to 100 gets a friendly sentence and the button stays disabled ("250? You would be the oldest founder in history").

## Data model

`database/migrations/0001_identity.sql`. Accounts are rows of `auth.users`, written only by the authentication service; every table keys on `auth.users.id`.

| Table | Holds | Personal data |
|---|---|---|
| `profiles` | `username` (optional, unique, `^[a-z0-9_]{3,20}$`), `display_name`, `locale` | Username and display name, chosen by the person |
| `user_roles` | One row per type an account holds: `universal`, `child`, `parent`, `admin`, `superadmin` | None |
| `age_declarations` | The declared age (6 to 100), whether the permission box was ticked, when | The age of a person who may be a minor. A whole number, never a birth date |
| `audit_log` | Append-only trail of identity changes | Ids and codes only |

Rules the database enforces, whoever writes (Core, a migration, a person in psql):

- Row-level security is on for the four tables with **no policy**, and `anon`, `authenticated` and `service_role` hold no privilege on them. Nothing reads or writes a table from outside.
- Core works only through the `core_*` functions (security definer, empty `search_path`, executable by `service_role` alone): `core_session_context`, `core_declare_age`, `core_sync_base_type`, `core_email_for_username`, `core_set_username`, `core_grant_role`, `core_revoke_role`.
- An account is `child` or `universal`, never both (a partial unique index), and the type must agree with the age record (trigger `guard_user_roles`).
- The age is written once (`core_declare_age` does nothing the second time; the row cannot be updated). A correction is a staff decision, not built yet. Under 13 the row is refused without the permission flag.
- A child becomes `universal` at 18, when a session starts or is renewed (`core_sync_base_type`). The age today is the declared age plus the whole years since, so it never runs ahead of the truth.
- `superadmin` only for a confirmed `@littlefounders.ai` address; `admin` and `parent` only when granted by a superadmin; all three only on a `universal` account. A role is granted or revoked, never edited, and every grant and revocation is written to `audit_log`.

What the authentication service stores on its own in `auth.users` (email, and for Google the name and picture Google sends) is not reduced yet: see the open points.

## API

Core, base path `/api/v1`. Every answer is `{ "data": ..., "error": null }` or `{ "data": null, "error": { "code": "...", "retryAfterSeconds"?: n } }`. An error is a code; the sentence a person reads comes from the frontend's locale files.

| Method and path | Signed in | Body | Answers |
|---|---|---|---|
| `GET /auth/challenge` | no | | `{ challenge, difficulty }`: the piece of work to do before asking for a code ([[RATE-LIMITING-AND-ABUSE]]) |
| `POST /auth/code` | no | `{ identifier, locale?, challenge, solution }` | `{ sent, codeLength, expiresInSeconds, resendAfterSeconds }`. Same answer, in the same time, whether or not the identifier has an account: the email is sent after the answer. `PROOF_REQUIRED` when the work is missing, wrong, old or already used. `locale` is the language a new account starts with; the email itself is described in [[F-002-emails]] |
| `POST /auth/code/verify` | no | `{ identifier, code }` | `{ account }`, the session cookies and the known-browser cookie `lf_kd`; `CODE_INVALID`, `TOO_MANY_ATTEMPTS` |
| `GET /auth/session` | yes | | `{ account }` |
| `POST /auth/refresh` | refresh cookie | `{}` | `{ account }` and new cookies; `SESSION_EXPIRED` |
| `POST /auth/sign-out` | optional | `{}` | `{ signedOut }`; always clears the session cookies, and ends the session at the authentication service with the access token or, when that cookie has expired, through the refresh token |
| `GET /auth/providers` | no | | `{ google }` |
| `GET /auth/google/start?mode=popup\|redirect` | no | | A redirect to Google |
| `GET /auth/google/callback` | no | | Sets the cookies; a redirect to `/auth/callback?mode=&result=` |
| `POST /account/age` | yes | `{ age, guardianPermission? }` | `{ type, recorded }`; `AGE_OUT_OF_RANGE`, `PERMISSION_REQUIRED` |
| `PUT /account/username` | yes | `{ username }` | `{ username }`; `USERNAME_INVALID`, `USERNAME_TAKEN` |
| `POST /admin/roles/grant`, `/revoke` | superadmin | `{ userId, role }` with `role` = `admin` or `parent` | `{ ok }`; `FORBIDDEN`, `TARGET_NOT_ELIGIBLE` |

`account` is `{ id, email, username, displayName, locale, roles, type, needsAge }`. Bodies are parsed with strict schemas: an unknown field is a `BAD_REQUEST`, so a request cannot smuggle in a `role`.

## Security review

Read against the attacker's checklists in `.claude/skills/strix-security-reference/` (Supabase, authentication and JWT, OAuth, CSRF, mass assignment, function-level authorization, race conditions). The baseline it applies is in [[SECURITY-GUIDE]]; the numbers are in [[RATE-LIMITING-AND-ABUSE]].

| Threat | What stops it |
|---|---|
| A script injected into the page steals the session | The session is two `HttpOnly` cookies; no token is ever in JavaScript, in `localStorage` or in a URL |
| Another site makes the browser act as the user (CSRF) | Cookies are `SameSite=Strict`; a changing request must carry our `Origin` and a JSON body; in production the cookies use the `__Host-` prefix |
| Guessing a six-digit code | Five tries per code and thirty a day per address, counted before each try and atomically; a new code replaces the old one; only Core can reach the check, because the gateway refuses everybody else |
| Guessing codes against the gateway, around Core | The gateway accepts the service key alone on the auth, REST, GraphQL and Realtime routes; the public key opens nothing, and the open route `/auth/v1/verify` is removed (`database/railway/kong/kong.yml`) |
| Learning who has an account | The same answer and the same timing for a known and an unknown address or username; a username's code is sent after the answer |
| Learning which address a username belongs to | Limits a caller can see are counted per identifier as typed; the limits of the address behind it hold silently |
| A forged or altered token | HS256 pinned, issuer, audience, expiry and role checked; a token says who is asking, never what they may do |
| A stolen token used after sign-out, a ban or a deletion | Every request asks the database whether that session is alive and the account usable |
| A stolen refresh token | Refresh tokens are used once; using an old one ends the session |
| A stranger locking somebody out by guessing at their account on purpose | The counters per identifier exist twice: a browser that has signed in to the account before counts in a set nobody else can spend (`lf_kd`, D-045, [[RATE-LIMITING-AND-ABUSE]]) |
| A copy of the refresh token outliving the person's sign-out | Signing out ends the session at the authentication service even when the access cookie has expired: Core refreshes first and ends the session with the new token |
| A production service running with development settings because of a missing or misspelled `NODE_ENV` | Only the exact words `development` and `test` relax anything; anything else is production, and production does not boot without Redis, https and its secrets |
| Being signed in to somebody else's Google account by a prepared link | The sign-in is bound to the browser that started it (PKCE; the secret stays in a short-lived cookie) |
| Giving oneself a role | Types are read from the database on every request; the tables are closed; the database checks every grant again |
| Reading or changing another account | No handler takes a user id from the request, except the two superadmin routes |
| Flooding sign-in or the mail | A piece of work before each code; limits per visitor (an IPv6 visitor by its /64 network) and per mailbox; one email a minute and five an hour per address; an hourly allowance for new addresses that leaves the rest to existing accounts |
| Learning by timing which address a username belongs to, or whether an address just got a code | Core answers first and sends afterwards, whatever was typed |
| A name or a public username on an account with no age record | `PUT /account/profile` and `/username` answer `AGE_REQUIRED` until the age is declared; only the language can be set before |
| Personal data in logs | Core logs the method, the route pattern, the status and a failure's kind. Never an address, a username, a code, a token or a cookie; counter keys are digests |

For minors: no birth date is stored, only a whole-number age; under 13 the permission box is required and recorded; nothing here is shown to another user; the only third parties that receive an address are the authentication service's mail route (Courier to Amazon SES) and, for a person who chooses it, Google. What a self-declared box does and does not satisfy legally is in [[CHILD-SAFETY-AND-PRIVACY]].

## Locale strings

`auth` in `frontend/src/i18n/<locale>/core.json`, in en-US, es-MX and pt-BR, written for each language and to the humanizer standard: the four steps, the age nudges, the account menu, the callback page and one sentence per error code. No analytics event is added by this feature.

## Edge cases and failure behavior

- Wrong code: a sentence in the window, the boxes are emptied and keep the focus. After five wrong codes the code stops working and the window says to ask for a new one.
- A second request for a code inside a minute: refused with the wait in seconds; the window shows a countdown before "send a new code" appears.
- The mail cannot be sent: the person is not told (Core answers before it sends, so that the answer says nothing about the address); the failure is logged, and the person can ask for a new code after a minute.
- The counter store is unreachable: a limit that protects an account refuses the request (`UNAVAILABLE`); the capacity limit lets it through. Production does not boot without `REDIS_URL`.
- The database or the authentication service is unreachable: `UNAVAILABLE`, never a half-made session.
- The Google window is closed without choosing: the waiting page keeps offering the other ways to sign in and stops waiting after ten minutes.
- Core is unreachable when a page loads: the page shows signed out and asks again on the next load.
- An account with no age (the window was closed at the age step): the step opens again on the next visit, and the account has no type until it is answered.
- Under 6: the account stays without a type. Nothing else in the product exists yet for it to reach.

## Rollout, migration and rollback

Nothing is deployed. Before the first deployment:

1. **Authentication service** (Railway `auth`): add `GOTRUE_MAILER_OTP_EXP=900`, `GOTRUE_MAILER_OTP_LENGTH=6`, `GOTRUE_SMTP_MAX_FREQUENCY=60s`, `GOTRUE_RATE_LIMIT_EMAIL_SENT` (the ceiling for the whole service: size it to the expected sign-ins), `GOTRUE_SECURITY_REFRESH_TOKEN_ROTATION_ENABLED=true`, `GOTRUE_SECURITY_REFRESH_TOKEN_REUSE_INTERVAL=10`; set `GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED=false`; add Core's callback to `GOTRUE_URI_ALLOW_LIST` (`https://api-b2c.littlefounders.ai/api/v1/auth/google/callback`). The Google and SMTP keys are not touched.
2. **Core** (Railway `littlefounders-backend`): the existing variables are reused as they are; add `PUBLIC_API_ORIGIN=https://api-b2c.littlefounders.ai`, and make sure `NODE_ENV` is exactly `production` (any other value is treated as production too, but then Core refuses to boot without Redis, https and its secrets, which is the point). Confirm `TRUST_PROXY_HOPS` against the real proxy chain.
3. **Gateway** (Railway `kong`): deploy the closed `kong.yml`. From that moment nothing but Core can call the auth and REST routes, so it goes out together with the new Core and the new frontend, not before.
4. **Emails**: the code reaches the person in our own emails, which replace the service's templates. What that needs on each service is the rollout section of [[F-002-emails]].
5. **Data**: the production database holds the previous version's accounts. Moving them (renaming `kid` to `child`, giving minors who are `universal` today the `child` type, dropping `bigfounder`, and what to do with child accounts that have no real address) is its own piece of work: T-026.

Rollback is the previous deployment of the three services; the migration adds tables and functions and changes nothing that exists.

## How it was checked

No test suite was added (rule 5 in [[CLAUDE]]). What was run, on 2026-10-10, against the local stack with synthetic addresses:

- Core through its API, two scripted passes: origin and content-type refusals, a new address, the per-minute refusal, a wrong code, the right code, the same code twice, the session, the age rules (permission, range, written once, an extra `role` field), a reserved username, a child calling a superadmin route, refresh, sign-out, an old access token and an old refresh token replayed, a forged unsigned token, sign-in by username, a known and an unknown username answering alike, five wrong codes then the right one refused, and the same refusal invisible through the address.
- The gateway with the public key, the service key and no key: closed where it should be, open only for the Google redirects and the public signing keys.
- The window in a real browser (`npm run audit:signin`): every step, with axe-core on each one and no violation, at 1440 px (light English, dark Portuguese) and at 390 px (dark Spanish, light English), with an age of 9 and of 16, looked at as screenshots.
- `type-check` and `lint` in `backend/` and `frontend/`, `build` in `frontend/`, the anti-slop rules on the new frontend code, and the accessibility, layout and keyboard audits across the widths, languages and themes.

Not checked: Google end to end (the local stack has no Google keys; the start and the refusals were), real mail delivery, Redis as the counter store, a real screen reader, and anything in production.

## Open points

- [x] The emails that carry the code, in the three languages: [[F-002-emails]].
- [x] Onboarding: [[F-003-onboarding]]. It asks the name and gives the age to the new account, so the window's age step shows only when a permission box is owed or no onboarding was walked. Where the username is asked is still open. The window has a third way in, `join` (`useAuthDialog().open('join')`): creating an account with Google and the email code both on offer, used where the onboarding ends.
- [ ] The migration of the production accounts (T-026), including child accounts without a real address (the owner decides at migration).
- [ ] Whether the permission box appears under 13 (built) or under 18.
- [ ] A second factor for `admin` and `superadmin` (T-027).
- [ ] Removing accounts that asked for a code and never entered it (T-028).
- [ ] What the authentication service keeps from Google (name, picture): keep, or strip.
- [ ] Changing an email, closing an account, exporting its data, correcting an age: not built.
- [ ] Counsel's review of the under-13 path before production ([[CHILD-SAFETY-AND-PRIVACY]]).

## Related

- [[DECISIONS]]
- [[SECURITY-GUIDE]]
- [[CHILD-SAFETY-AND-PRIVACY]]
- [[RATE-LIMITING-AND-ABUSE]]
- [[API-GUIDE]]
- [[BACKEND-GUIDE]]
- [[DATABASE-GUIDE]]
- [[FRONTEND-GUIDE]]
- [[ENVIRONMENT-SETUP]]
- [[INFRASTRUCTURE]]
- [[TECHNICAL-REQUIREMENTS]]
- [[BUILD-TASKS]]

Back to [[INDEX]].

## Update this document when

- A step, an endpoint, a table, a limit or a rule of this feature changes.
- An open point is settled.
