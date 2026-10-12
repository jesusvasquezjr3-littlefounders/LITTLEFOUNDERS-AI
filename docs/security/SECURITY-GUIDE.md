---
title: Security guide
status: scaffold
updated: 2026-10-12
---

# Security guide

> The security baseline every change must meet.

> **Status: scaffold.** The structure is set; nothing below that is not marked as current state has been decided. Fill it in with the owner, then change the status to `draft` and, once approved, `accepted`.

## Role

The owner sets the baseline here, to the highest standard. Agents treat it as binding for every change and raise any conflict instead of working around it. Child-specific rules are in [[CHILD-SAFETY-AND-PRIVACY]].

## Read this when

- Any change that handles identity, data, input, secrets or network exposure.
- Reviewing a pull request.

## To define

- [ ] Assets, actors and the threat model, including abuse cases involving minors.
- [ ] Authentication: methods, sessions, parent verification and recovery.
- [ ] Authorization model and where it is enforced.
- [ ] Secrets: storage, rotation, and what never enters the repository.
- [ ] Input validation and output encoding.
- [x] Browser hardening: headers, content security policy, CORS, cookies. Built: see Current state.
- [ ] Encryption in transit and at rest; key management.
- [ ] Dependency and supply-chain controls: lockfiles, pinned CI actions, update policy.
- [ ] Logging rules: no personal data in logs.
- [ ] Security review checklist per change.
- [ ] Vulnerability reporting.

## Current state

What is built and in force since 2026-10-10 (decisions D-028 to D-031 in [[DECISIONS]]; the feature is [[F-001-authentication]]). The threat model and the remaining items above are still to be written with the owner.

- **One door.** The browser calls Core (`backend/`) and nothing else. The Supabase gateway accepts the service key alone on its auth, REST, GraphQL and Realtime routes (`database/railway/kong/kong.yml`): the public anon key opens nothing. What stays open without a key is what a Google sign-in needs to pass through the browser (`/auth/v1/authorize`, `/auth/v1/callback`) and the public signing keys. The local stack mounts the same gateway file, so it is closed the same way.
- **Authentication.** No passwords. A one-time code by email (six digits, 15 minutes, used once) or Google with PKCE. The authentication service issues and checks the codes and signs the tokens; Core stores neither. A code passes through Core once, in memory, on its way into the email, and is never logged.
- **Sessions.** Two cookies, `HttpOnly`, `SameSite=Strict`, and in production `Secure` with the `__Host-` prefix. Signing out ends the session at the authentication service even when the access cookie has already expired: Core obtains a fresh token with the refresh token and ends the session with it, so a copy of the refresh token taken earlier dies with the sign-out. A third cookie of the same kind (`lf_kd`) marks a browser that has signed in to an account before: it is a keyed hash, names nobody, grants no access and survives sign-out; what it is for is in [[RATE-LIMITING-AND-ABUSE]]. No token is ever in JavaScript, in browser storage or in a URL. An access token is checked with the algorithm pinned to HS256 and with its issuer, audience, expiry and role; then the database is asked, on every request, whether that session is alive and the account usable, so signing out, a ban or a deletion takes effect at once. Refresh tokens are used once.
- **Cross-site requests.** A request that changes something must carry our `Origin`, must not be marked cross-site by the browser, and must have a JSON body (`backend/src/middleware/security.ts`). Two routes are for callers that are not browsers and are let in before that check, each with its own proof: the authentication service's "send email" hook (a signature over the body, refused when missing, wrong or older than five minutes) and a mail program's one-click unsubscribe (a signed token that can only switch one account's optional emails) ([[F-002-emails]]).
- **Authorization.** The user types are read from the database on every request, never from the token. The identity tables have row-level security with no policy and no privilege for any API role; Core can only run the `core_*` functions, and the database re-checks every rule (types agree with the age record, who may grant what) whoever writes. No handler takes a user id from the request except the two superadmin routes.
- **Input.** Every request body and every answer from another service is parsed with a strict schema at the boundary; an unknown field is refused.
- **Secrets.** Only `.env.example` files are tracked. Core reads its secrets from the environment and crashes at boot on a bad value. The service key never leaves Core and is never the bearer of a call made on behalf of a person. A service that needs the database gets a role of its own with only what it uses: the mail service has `mail_service`, which can add, read and mark lines of the delivery history and nothing else, and its key opens the gateway's REST routes only (`database/migrations/0004_mail_least_privilege.sql`, `database/scripts/mint-role-key.mjs`).
- **The environment fails closed.** Only the exact words `development` and `test` in `NODE_ENV` relax anything, in Core and in the mail service. A missing or misspelled value counts as production, so a mistake can only make a service stricter (Secure cookies, https, shared counters, a required key), never weaker.
- **Logs.** Core logs the method, the route pattern, the status and the kind of a failure. Never an address, a username, a code, a token or a cookie. Rate-limit keys are digests.
- **Headers.** Core answers JSON and redirects only: `Content-Security-Policy: default-src 'none'`, no framing, no sniffing, no referrer, no caching, and HSTS in production. The site (`frontend/vercel.json`) sends a content security policy that starts from `default-src 'none'` and allows scripts from the site itself, the one inline script of `index.html` by its hash, and the analytics hosts; no `unsafe-inline` or `unsafe-eval` for scripts; connections only to the site, Core and the analytics hosts; no framing (`frame-ancestors 'none'` and `X-Frame-Options: DENY`), `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` and a `Permissions-Policy` that switches off the device features the product does not use. Styles keep `'unsafe-inline'`, because the libraries write style elements. `npm run build` ends with `scripts/security-headers.mjs`, which fails the build when the policy no longer matches it (an inline script changed, or the build is configured with a host the policy does not allow). No cross-origin opener policy is set: it would cut the Google sign-in window off from the page that waits for it.
- **The mail relay** listens on this machine only (`127.0.0.1:2525`) and takes mail from the mail service's own HTTP API, which builds every email from its templates for a caller with the internal key. There is no SMTP listener on the private network: one would let any service there send any words from our domain without a key.
- **Deploys.** A deploy workflow runs only for a push to this repository's `main`: it checks the event and the repository of the run that triggered it, because `workflow_run` also fires for a pull request's run and matches a fork's branch by name. CI jobs have read-only permissions, a secret reaches a step as an environment variable and never as text in a script, and the Vercel CLI is pinned to a version.
- **The first superadmin** is not granted through the product. A person with database access runs, once, as the database owner: `INSERT INTO public.user_roles (user_id, role) SELECT id, 'superadmin' FROM auth.users WHERE email = '<address>@littlefounders.ai';`. The database refuses it unless the address is confirmed, ends in `@littlefounders.ai` and the account is `universal`; the grant is written to `audit_log`. After that, `admin` and `parent` are granted by a superadmin through Core.
- **Limits** are in [[RATE-LIMITING-AND-ABUSE]].
- **Security review of 2026-10-10.** A read-through of everything built so far against the Strix checklists found no critical defect in the new code and ten things to fix, all fixed the same day: the deploy workflows, the relay's network listener, the mail service's vulnerable packages, an account that a stranger could lock out, an age carried over to another person on a shared computer, the service key held by the mail service, the missing headers of the site, an unsubscribe token sent to analytics, an environment that failed open, and a sign-out that did not end the session. What was checked for each is in the feature documents; what was left for later is T-036 in [[BUILD-TASKS]].
- **Second round, the same day, by the owner's order.** What the review had left for later was fixed too, and what cannot be closed from the repository became a list that blocks any push or deployment (T-036 in [[BUILD-TASKS]]). Built: a piece of work before a code is sent and an allowance of emails reserved for existing accounts ([[RATE-LIMITING-AND-ABUSE]]); the same answer in the same time whatever was typed, because the email is always sent after the answer; no name or username for an account that has not said its age (`AGE_REQUIRED`); a signed hook call acted on once; unsubscribe tokens that stop working after 180 days; display names that cannot look like a web address or pass for staff; actions pinned by commit and approval required for every outside contributor's fork pull request; `react-router-dom` 7 (no known advisory left in any package: `npm audit --omit=dev` is clean in `backend/`, `email-server/` and `frontend/`).
- **The relay's hop to Amazon SES.** Nothing leaves over a connection that is not encrypted, and the smarthost's certificate is verified (`haraka/plugins/forward_secure.js`, `[tls] rejectUnauthorized=true`). When the smarthost does not take a message, it is deferred: the relay never delivers straight to a recipient's mail server (`haraka/plugins/no_direct_delivery.js`). The relay logs at `warn`, so no address is written, and the mail service logs the kind of a failure, never its text.
- **How a change is reviewed.** Before and after building anything that touches identity, data or input, read the matching checklists in `.claude/skills/strix-security-reference/` as the attacker would, and record what stops each threat in the feature's document.
- `scripts/check-secrets.sh` scans tracked files for credentials. The vendored anti-slop rules reject unparsed input and unjustified type assertions. Security skills for agents and the rules for any AI pentest run are in [[ai-pentesting]].

- **Found during the first deployment, 2026-10-12, and fixed before the closed gateway went live:** the gateway's start script replaces each `$NAME` of its key list with the variable's value and removes a key left empty, but a variable that is not set at all was left as its own name, and the name then worked as a key. In production `SUPABASE_SECRET_KEY` and `SUPABASE_PUBLISHABLE_KEY` are not set, so the text `$SUPABASE_SECRET_KEY` sent as the key was let through as the service consumer (checked on the live gateway before the fix: 200; after: 401). The services behind still asked for a signed token, but the closed gateway rests on that key list, and the open authentication routes would have been reachable around Core. `database/railway/kong/kong-entrypoint.sh` now removes a credential that is still a variable's name. The lesson for any template that substitutes variables: decide what an unset one becomes.

## Related

- [[F-001-authentication]]
- [[DECISIONS]]
- [[CHILD-SAFETY-AND-PRIVACY]]
- [[RATE-LIMITING-AND-ABUSE]]
- [[API-GUIDE]]
- [[DATABASE-GUIDE]]
- [[INFRASTRUCTURE]]
- [[CI-CD-AND-VERSION-CONTROL]]
- [[INCIDENT-RESPONSE]]
- [[ai-pentesting]]
- [[CODE-STYLE-GUIDE]]
- [[TESTING-GUIDE]]

Back to [[INDEX]].

## Update this document when

- The baseline changes or a control is added.
- A security-relevant dependency or service is introduced.
