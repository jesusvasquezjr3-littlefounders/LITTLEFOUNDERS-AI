---
title: API guide
status: scaffold
updated: 2026-10-12
---

# API guide

> The contract style and rules for every interface between client and server.

> **Status: scaffold.** The structure is set; nothing below that is not marked as current state has been decided. Fill it in with the owner, then change the status to `draft` and, once approved, `accepted`.

## Role

Keeps every endpoint consistent so clients and agents can predict behavior. Each endpoint has its own entry in a feature requirements document; this guide holds the shared rules.

## Read this when

- Designing, changing or consuming an endpoint.
- Generating client types.

## To define

- [ ] API style and why it was chosen.
- [ ] Naming, versioning and deprecation.
- [ ] Request and response shapes; error format and codes.
- [ ] Pagination, filtering and sorting.
- [ ] Input parsing and validation at the boundary.
- [ ] Authentication and authorization on every endpoint.
- [ ] Idempotency keys and retries.
- [ ] Rate-limit behavior and headers.
- [ ] The machine-readable contract and how client types are generated from it.
- [ ] Webhooks, if any.

## Current state

What Core's first endpoints do ([[F-001-authentication]]); the shared rules above are still to be set with the owner, and these are the starting point.

- JSON over HTTPS under `/api/v1`. Every answer is `{ "data": ..., "error": null }` or `{ "data": null, "error": { "code": "..." } }`, the shape the mail service already used.
- An error is a code in capitals (`CODE_INVALID`, `RATE_LIMITED`, `FORBIDDEN`), with the HTTP status that fits. The server never sends a sentence for a person: the frontend maps the code to a locale string, in three languages. The codes are listed in `backend/src/lib/http.ts`.
- A request body is JSON, at most 10 KB, and is parsed with a strict schema: an unknown field is a `BAD_REQUEST`.
- A refusal by a limit is 429 with `Retry-After` and `retryAfterSeconds` ([[RATE-LIMITING-AND-ABUSE]]).
- The session travels in cookies, so the frontend sends `credentials: 'include'` and never handles a token (`frontend/src/lib/api.ts`).
- Nothing is cached: every answer carries `Cache-Control: no-store`.
- A read that belongs to the signed-in person takes no user id: it answers about the account of the session. `GET /api/v1/home` is the first one ([[F-004-application]]): the menu the account has, the composition of the day and the cards of the day, in one answer.
- `GET /api/v1/home/guest` is that read for somebody with no account (D-056). It is public on purpose and so it carries nothing of a person: a menu and a composition of the day that are the same for every guest. A public read never takes or returns anything that belongs to one.

## Related

- [[F-001-authentication]]

- [[BACKEND-GUIDE]]
- [[DATABASE-GUIDE]]
- [[SECURITY-GUIDE]]
- [[RATE-LIMITING-AND-ABUSE]]
- [[FRONTEND-GUIDE]]
- [[TESTING-GUIDE]]
- [[TECHNICAL-REQUIREMENTS]]

Back to [[INDEX]].

## Update this document when

- A shared API rule changes.
- An endpoint breaks the contract or a version is introduced.
