---
title: API guide
status: scaffold
updated: 2026-10-09
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

## Related

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
