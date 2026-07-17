---
template: new-endpoint
inputs:
  service: "backend | coursegen | audiogen | gamegen | parent-id-check | email-server"
  route: "e.g. /api/v1/guardian-links"
  method: "GET | POST | PATCH | DELETE"
  auth: "roles allowed, or 'internal' (INTERNAL_API_KEY) or 'public'"
---

# Task: add an endpoint

## Read first (pointers, not copies)
- `agent/core/CONVENTIONS.md` — envelope, Zod-at-the-edge, app layout, test shape
- `/AGENTS.md` §1.6 (API conventions) + §1.4 (roles matrix) if auth involves roles
- `<service>/AGENTS.md` — domain rules
- `<service>/README.md` — existing route table

## Steps
1. Zod schema(s) for body/query/params in the route file.
2. Route: parse → call ONE service function → envelope response. No business logic in the route.
3. Service function in `src/services/` — no HTTP concerns.
4. Auth: role middleware per `auth` input; internal routes verify `INTERNAL_API_KEY`.
5. Tests (Supertest vs `createApp()`): happy path + validation sad path + auth sad path (if auth ≠ public).
6. Add the route to `<service>/README.md` route table.

## Acceptance
- [ ] `npm test`, `npm run type-check`, `npm run lint` green in the service
- [ ] Error codes from the CONVENTIONS list; new codes added to frontend `errors.api.*` in 3 locales
- [ ] Stewardship (§8): README route table updated in the same commit
