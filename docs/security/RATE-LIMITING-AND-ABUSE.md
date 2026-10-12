---
title: Rate limiting and abuse prevention
status: scaffold
updated: 2026-10-12
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
| Asking for a code | The request itself | One solved challenge each, good for two minutes | Refuse |
| Codes to addresses with no account | The whole service | 300 an hour (`NEW_ADDRESS_CODES_PER_HOUR`) | No email is sent |
| Asking for a code | Identifier (address or username), once for strangers and once for browsers the account knows | 1 a minute, 5 an hour | Refuse |
| Entering a code | Visitor address | 30 in 15 minutes | Refuse |
| Entering a code | Identifier, once for strangers and once for browsers the account knows | 5 per code, 30 a day | Refuse |
| Renewing a session, starting Google | Visitor address | 120 in 15 minutes | Let through |
| Reading a signed-in person's own pages (the home, [[F-004-application]]) | The account | 120 in 15 minutes | Let through |
| Setting the age or the username | Visitor address | 30 in 15 minutes | Refuse |

- **Why the code is safe at six digits.** Its protection is the number of guesses, not its length: five per code and thirty a day per address, whoever guesses and from wherever. The attempt is counted before it is made and the count is atomic, so parallel requests cannot slip under it. A new code replaces the old one and starts a new count. Nobody can guess around Core, because the gateway refuses every other caller ([[SECURITY-GUIDE]]).
- **A stranger cannot lock an account out (D-045).** Counting per identifier, whoever guesses, has a cost: somebody who knows a child's username could spend the account's guesses and emails on purpose, and the child would be refused for a day without knowing why. So every counter per identifier exists twice, `stranger` and `known`. A browser that has signed in to the account before carries a cookie (`lf_kd`: `HttpOnly`, `SameSite=Strict`, a keyed hash of the address for up to five accounts, readable by nobody and made only by Core) and counts in the `known` set, which nobody else can spend. Everybody else, a forged cookie included, counts in the `stranger` set. The allowance is the same in both, so a known browser gains no extra guesses worth having: at most five per code and thirty a day more for that account. A new code resets the per-code attempts of both sets. When the stranger set of an account runs out, Core logs `auth.code.attempts_exhausted` with no identifier. What is left: on a browser that has never signed in to the account (a new device), the person is in the stranger set like anybody else, and can still be held up while somebody is guessing at their account; Google sign-in is not affected.
- **A piece of work before a code (D-049).** Asking for a code makes the product send an email to whatever address was typed. Before it does, the caller fetches a challenge (`GET /auth/challenge`) and finds a number that, hashed with it, starts with 15 zero bits: about a tenth of a second in a browser, nothing for the person to do. A challenge is signed by Core, good for two minutes and for one request. It is not a wall, and it is not a CAPTCHA: it makes asking by the thousand cost computing time, with no third party on the page. Whether sign-up needs more is open with the owner (T-036).
- **An allowance reserved for existing accounts.** Codes to addresses that have no account yet share one allowance an hour for the whole service (`NEW_ADDRESS_CODES_PER_HOUR`, 300). When it is used up, a new address gets the usual answer and no email, and Core logs `auth.code.new_address_ceiling`; people who already have an account keep getting their codes. It has to stay well under the authentication service's own ceiling.
- **Counted by network and by mailbox.** An IPv6 visitor is counted by its /64 network, because a home or a phone is handed a whole one. An address is counted by the mailbox it delivers to: `name+anything@` counts as `name@`, and Gmail's dots are ignored. The email still goes to what was typed.
- **No oracle.** Core answers before it sends, whatever was typed, so a known and an unknown identifier, and an address that just got a code and one that did not, take the same time. The price: a failure to send is logged and not told to the person, who can ask again. The limits a caller can see (a 429) are counted on the identifier as it was typed. The limits of the address behind a username hold silently: the code is simply wrong, or nothing new is sent. A known and an unknown identifier get the same answer in the same time.
- **Where the counters live.** Redis in production (`REDIS_URL`; Core does not boot without it there), so several instances count together; memory in development. Keys hold a digest, never an address or a username.
- **Refusals.** HTTP 429 with `RATE_LIMITED` or `TOO_MANY_ATTEMPTS`, a `Retry-After` header and `retryAfterSeconds` in the body; 503 `UNAVAILABLE` when a protecting counter cannot be read.
- **The authentication service's own limits** are a ceiling for the whole service, because every request reaches it from Core: `GOTRUE_RATE_LIMIT_EMAIL_SENT` and `GOTRUE_SMTP_MAX_FREQUENCY` ([[ENVIRONMENT-SETUP]]).
- **The two doors that are not for browsers** ([[F-002-emails]]): the authentication service's hook is not counted per address, because every call comes from that one service, and is refused without its signature; the one-click unsubscribe shares the 30 per 15 minutes of the account routes.
- **The visitor address** is read through `TRUST_PROXY_HOPS` proxies. A wrong value there makes every visitor share one counter, so it is confirmed against the real proxy chain at deployment.
- Not built: a wall stronger than the piece of work at sign-up (open with the owner), an alert beyond the log lines when a limit is hit, removal of accounts that never entered their code (T-028).

## In development

The numbers above are the ones a developer's machine runs with too, unless `RELAXED_LIMITS=true` is in `backend/.env` (D-057). Then the limits that count how often something is asked for are a hundred times wider: codes per network address and per email address, session, account and code-check calls per network address, reads per account, and the allowance for new addresses. The limits on guessing a code and the things that happen once are not touched. Core honors the setting only when `NODE_ENV` is exactly `development` and refuses to start with it otherwise; it logs `limits.relaxed` when it is on. It must never be set in production, and is not among the production variables.

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
