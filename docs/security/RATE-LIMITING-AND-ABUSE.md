---
title: Rate limiting and abuse prevention
status: scaffold
updated: 2026-10-09
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

## Related

- [[API-GUIDE]]
- [[SECURITY-GUIDE]]
- [[BACKEND-GUIDE]]
- [[INFRASTRUCTURE]]
- [[OBSERVABILITY]]
- [[PERFORMANCE-AND-SCALING]]

Back to [[INDEX]].

## Update this document when

- A limit or enforcement point changes.
