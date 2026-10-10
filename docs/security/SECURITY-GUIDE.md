---
title: Security guide
status: scaffold
updated: 2026-10-10
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
- [ ] Browser hardening: headers, content security policy, CORS, cookies.
- [ ] Encryption in transit and at rest; key management.
- [ ] Dependency and supply-chain controls: lockfiles, pinned CI actions, update policy.
- [ ] Logging rules: no personal data in logs.
- [ ] Security review checklist per change.
- [ ] Vulnerability reporting.

## Current state

What is built and in force since 2026-10-10 (decisions D-028 to D-031 in [[DECISIONS]]; the feature is [[F-001-authentication]]). The threat model and the remaining items above are still to be written with the owner.

- **One door.** The browser calls Core (`backend/`) and nothing else. The Supabase gateway accepts the service key alone on its auth, REST, GraphQL and Realtime routes (`database/railway/kong/kong.yml`): the public anon key opens nothing. What stays open without a key is what a Google sign-in needs to pass through the browser (`/auth/v1/authorize`, `/auth/v1/callback`) and the public signing keys. The local stack mounts the same gateway file, so it is closed the same way.
- **Authentication.** No passwords. A one-time code by email (six digits, 15 minutes, used once) or Google with PKCE. The authentication service issues and checks the codes and signs the tokens; Core stores neither. A code passes through Core once, in memory, on its way into the email, and is never logged.
- **Sessions.** Two cookies, `HttpOnly`, `SameSite=Strict`, and in production `Secure` with the `__Host-` prefix. No token is ever in JavaScript, in browser storage or in a URL. An access token is checked with the algorithm pinned to HS256 and with its issuer, audience, expiry and role; then the database is asked, on every request, whether that session is alive and the account usable, so signing out, a ban or a deletion takes effect at once. Refresh tokens are used once.
- **Cross-site requests.** A request that changes something must carry our `Origin`, must not be marked cross-site by the browser, and must have a JSON body (`backend/src/middleware/security.ts`). Two routes are for callers that are not browsers and are let in before that check, each with its own proof: the authentication service's "send email" hook (a signature over the body, refused when missing, wrong or older than five minutes) and a mail program's one-click unsubscribe (a signed token that can only switch one account's optional emails) ([[F-002-emails]]).
- **Authorization.** The user types are read from the database on every request, never from the token. The identity tables have row-level security with no policy and no privilege for any API role; Core can only run the `core_*` functions, and the database re-checks every rule (types agree with the age record, who may grant what) whoever writes. No handler takes a user id from the request except the two superadmin routes.
- **Input.** Every request body and every answer from another service is parsed with a strict schema at the boundary; an unknown field is refused.
- **Secrets.** Only `.env.example` files are tracked. Core reads its secrets from the environment and crashes at boot on a bad value. The service key never leaves Core and is never the bearer of a call made on behalf of a person.
- **Logs.** Core logs the method, the route pattern, the status and the kind of a failure. Never an address, a username, a code, a token or a cookie. Rate-limit keys are digests.
- **Headers.** Core answers JSON and redirects only: `Content-Security-Policy: default-src 'none'`, no framing, no sniffing, no referrer, no caching, and HSTS in production.
- **The first superadmin** is not granted through the product. A person with database access runs, once, as the database owner: `INSERT INTO public.user_roles (user_id, role) SELECT id, 'superadmin' FROM auth.users WHERE email = '<address>@littlefounders.ai';`. The database refuses it unless the address is confirmed, ends in `@littlefounders.ai` and the account is `universal`; the grant is written to `audit_log`. After that, `admin` and `parent` are granted by a superadmin through Core.
- **Limits** are in [[RATE-LIMITING-AND-ABUSE]].
- **How a change is reviewed.** Before and after building anything that touches identity, data or input, read the matching checklists in `.claude/skills/strix-security-reference/` as the attacker would, and record what stops each threat in the feature's document.
- `scripts/check-secrets.sh` scans tracked files for credentials. The vendored anti-slop rules reject unparsed input and unjustified type assertions. Security skills for agents and the rules for any AI pentest run are in [[ai-pentesting]].

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
