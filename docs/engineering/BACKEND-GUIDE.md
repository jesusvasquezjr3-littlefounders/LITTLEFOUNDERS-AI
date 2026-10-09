---
title: Backend guide
status: scaffold
updated: 2026-10-09
---

# Backend guide

> The rules for building server-side logic.

> **Status: scaffold.** The structure is set; nothing below that is not marked as current state has been decided. Fill it in with the owner, then change the status to `draft` and, once approved, `accepted`.

## Role

Governs the code that will live in `backend/`: where business rules are enforced, how work is organized and how failures behave. Agents follow it for every server-side change.

## Read this when

- Any change under `backend/`.
- Adding business logic, a job or an integration.

## To define

- [ ] Language, runtime and framework choice, and why.
- [ ] Layering: transport, application, domain, persistence.
- [ ] Where authorization and business invariants are enforced.
- [ ] Transactions, idempotency and concurrency rules.
- [ ] Background jobs and queues.
- [ ] Error model and logging conventions.
- [ ] Configuration and secrets handling.
- [ ] Third-party integrations and the boundary for the AI tutor.
- [ ] What is done in the database (policies, functions) versus in the backend.

## Current state

- `backend/` is empty and reserved.

## Related

- [[ARCHITECTURE]]
- [[API-GUIDE]]
- [[DATABASE-GUIDE]]
- [[SECURITY-GUIDE]]
- [[CODE-STYLE-GUIDE]]
- [[TESTING-GUIDE]]
- [[OBSERVABILITY]]
- [[RATE-LIMITING-AND-ABUSE]]

Back to [[INDEX]].

## Update this document when

- The backend stack, layering or error model changes.
