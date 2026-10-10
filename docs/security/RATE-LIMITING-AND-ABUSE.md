---
title: Rate limiting and abuse prevention
status: scaffold
updated: 2026-10-10
---

# Rate limiting and abuse prevention

> How the system limits use to protect availability, cost and users.

> **Status: scaffold.** The structure is set; nothing below that is not marked as current state has been decided. Fill it in with the owner, then change the status to `draft` and, once approved, `accepted`.

## Role

Defines limits and abuse defenses once, so every endpoint applies them the same way and no feature can be used to exhaust the system or the AI budget.

## Read this when

- Adding an endpoint, a form or an AI call.
- Investigating abuse or an unexpected bill.

## To define

- [ ] Limits per endpoint class, per user and per address.
- [ ] Where each limit is enforced: edge, gateway, application, database.
- [ ] Algorithm and storage for counters.
- [ ] Brute-force and credential-stuffing defenses.
- [ ] Sign-up abuse and bot defenses.
- [ ] AI tutor usage and spend caps.
- [ ] Client-facing behavior: status codes, headers and retry guidance.
- [ ] Alerts when limits are hit.

## Current state

The limits Core enforces for sign-in ([[F-001-authentication]]), in `backend/src/services/limits.ts`. The owner has not reviewed the numbers; they are the starting values.

| Limit | Counted per | Allowed | If the counter store fails |
|---|---|---|---|
| Any request | Visitor address | 300 in 15 minutes | Let through |
| Asking for a code | Visitor address | 10 in 15 minutes | Refuse |
| Asking for a code | Identifier (address or username) | 1 a minute, 5 an hour | Refuse |
| Entering a code | Visitor address | 30 in 15 minutes | Refuse |
| Entering a code | Identifier | 5 per code, 30 a day | Refuse |
| Renewing a session, starting Google | Visitor address | 120 in 15 minutes | Let through |
| Setting the age or the username | Visitor address | 30 in 15 minutes | Refuse |

- **Why the code is safe at six digits.** Its protection is the number of guesses, not its length: five per code and thirty a day per address, whoever guesses and from wherever. The attempt is counted before it is made and the count is atomic, so parallel requests cannot slip under it. A new code replaces the old one and starts a new count. Nobody can guess around Core, because the gateway refuses every other caller ([[SECURITY-GUIDE]]).
- **No oracle.** The limits a caller can see (a 429) are counted on the identifier as it was typed. The limits of the address behind a username hold silently: the code is simply wrong, or nothing new is sent. A known and an unknown identifier get the same answer in the same time.
- **Where the counters live.** Redis in production (`REDIS_URL`; Core does not boot without it there), so several instances count together; memory in development. Keys hold a digest, never an address or a username.
- **Refusals.** HTTP 429 with `RATE_LIMITED` or `TOO_MANY_ATTEMPTS`, a `Retry-After` header and `retryAfterSeconds` in the body; 503 `UNAVAILABLE` when a protecting counter cannot be read.
- **The authentication service's own limits** are a ceiling for the whole service, because every request reaches it from Core: `GOTRUE_RATE_LIMIT_EMAIL_SENT` and `GOTRUE_SMTP_MAX_FREQUENCY` ([[ENVIRONMENT-SETUP]]).
- **The two doors that are not for browsers** ([[F-002-emails]]): the authentication service's hook is not counted per address, because every call comes from that one service, and is refused without its signature; the one-click unsubscribe shares the 30 per 15 minutes of the account routes.
- **The visitor address** is read through `TRUST_PROXY_HOPS` proxies. A wrong value there makes every visitor share one counter, so it is confirmed against the real proxy chain at deployment.
- Not built: bot defenses at sign-up, alerts when a limit is hit, removal of accounts that never entered their code (T-028).

## Related

- [[F-001-authentication]]
- [[ENVIRONMENT-SETUP]]

- [[API-GUIDE]]
- [[SECURITY-GUIDE]]
- [[BACKEND-GUIDE]]
- [[INFRASTRUCTURE]]
- [[OBSERVABILITY]]
- [[PERFORMANCE-AND-SCALING]]

Back to [[INDEX]].

## Update this document when

- A limit or enforcement point changes.
