---
title: Architecture
status: scaffold
updated: 2026-10-12
---

# Architecture

> The structure of the system: components, boundaries, dependencies and the stack.

> **Status: scaffold.** The structure is set; nothing below that is not marked as current state has been decided. Fill it in with the owner, then change the status to `draft` and, once approved, `accepted`.

## Role

The map an agent consults before adding code, so each piece goes in the right place and no boundary is crossed by accident. It describes what exists and the rules between parts; the reasoning lives in [[SYSTEM-DESIGN]] and [[DECISIONS]].

## Read this when

- Adding a module, service, dependency or integration.
- Deciding where code or data belongs.
- Onboarding.

## To define

- [ ] System context diagram: users, product, third parties.
- [ ] Component diagram and the responsibility of each component.
- [ ] Repository layout and dependency rules between packages.
- [ ] Trust boundaries and where untrusted input enters.
- [ ] Main data flows, synchronous and asynchronous.
- [ ] Technology inventory with pinned versions and the reason for each.
- [ ] Extension points and conventions for adding a new feature end to end.

## Current state

- Independent packages in one repository: `frontend/` (React 19, Vite, TypeScript, Tailwind CSS v4), `database/` (pinned self-hosted Supabase and local-stack scripts), `backend/` (Core: the only server the browser calls; Node 24, TypeScript, Express 5 and Zod; today it holds sign-in, sessions, the account's age and username, and staff grants of user types: [[F-001-authentication]]), `pulse/` (observability: Plausible CE, ClickHouse, PostgreSQL, Umami, Uptime Kuma), `email-server/` (Courier, outgoing mail: an Express HTTP API with a Haraka SMTP relay to Brevo's SMTP relay, D-060; Core calls its HTTP API with an internal key, and the relay listens on its own machine only; the authentication service hands its emails to Core, signed).

- Request path: browser -> Core (`/api/v1`, cookies) -> the Supabase gateway (Kong, service key) -> the authentication service (`/auth/v1`) or the database's functions (`/rest/v1/rpc`). The browser never reaches the gateway, except for the two redirects of a Google sign-in. Core holds no database connection of its own and no privilege on any table (D-028 in [[DECISIONS]]).
- Trust boundaries: everything the browser sends is untrusted and parsed in Core; everything another service answers is parsed in Core too; the database re-checks the identity rules whoever writes.

## Related

- [[F-001-authentication]]

- [[SYSTEM-DESIGN]]
- [[FRONTEND-GUIDE]]
- [[BACKEND-GUIDE]]
- [[DATABASE-GUIDE]]
- [[API-GUIDE]]
- [[INFRASTRUCTURE]]
- [[SECURITY-GUIDE]]
- [[DECISIONS]]

Back to [[INDEX]].

## Update this document when

- A package, service, boundary or major dependency is added, moved or removed.
