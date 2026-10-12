---
title: Backend guide
status: scaffold
updated: 2026-10-10
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

- `backend/` is Core (D-028 in [[DECISIONS]]). Node 24, TypeScript in strict mode (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), Express 5, Zod 4, `jose` for tokens, `rate-limiter-flexible` with `ioredis` for counters, `helmet` for headers. The same shape as the mail service, so the two read alike.
- Commands, from `backend/`: `npm run dev` (port 4000, reads `backend/.env`), `npm run type-check`, `npm run lint`, `npm run build`, `npm start`.
- Layout: `src/config.ts` (the environment, validated once at boot), `src/app.ts` (the middleware order and the one error handler), `src/middleware/` (origin check, CORS, the session), `src/routes/` (one file per area: `auth`, `account`, `admin`, `email` for unsubscribing, `hooks` for the authentication service's signed calls), `src/services/` (one file per thing Core talks to or signs: `gotrue`, `vault`, `tokens`, `cookies`, `limits`, `mailer` for the mail service, `unsubscribe` for the links in emails; see [[F-002-emails]]), `src/lib/` (the answer shape and error codes, the logger).
- Conventions in force: a handler parses its input with a strict schema before anything else and throws an `ApiError` with a code; one handler at the end turns anything thrown into an answer; a counter is taken before the thing it protects; no handler takes a user id from the request; answers from other services are parsed; nothing personal is logged.
- What is done in the database and not in Core: every identity rule (who is a child, who may hold or grant a type, the age written once). Core calls the `core_*` functions and has no privilege on tables ([[DATABASE-GUIDE]]).
- Not decided: background jobs and queues, and the boundary for the AI tutor.

## Related

- [[F-001-authentication]]
- [[DECISIONS]]
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
