---
title: User flows
status: scaffold
updated: 2026-10-09
---

# User flows

> How each kind of user moves through the product, screen by screen and state by state.

> **Status: scaffold.** The structure is set; nothing below that is not marked as current state has been decided. Fill it in with the owner, then change the status to `draft` and, once approved, `accepted`.

## Role

Turns the personas and features into journeys an agent can build and test against. This single document covers both the per-persona journeys and the application-level flow (screen map, navigation, permissions per role), so the two never drift apart.

## Read this when

- Designing or building any screen or multi-step interaction.
- Writing acceptance criteria and end-to-end checks.
- Reviewing who may see or do what.

## To define

- [ ] One journey per persona and goal, written as numbered steps, with diagrams where useful.
- [ ] Screen map and navigation structure.
- [ ] For every screen: empty, loading, error, offline and success states.
- [ ] Permissions per role for every action.
- [ ] Consent and parental-approval steps wherever a minor is involved.
- [ ] Edge cases and abuse cases for each flow.
- [ ] Which locale strings and analytics events each step needs.

## Related

- [[PRODUCT-REQUIREMENTS]]
- [[DESIGN-SYSTEM]]
- [[FRONTEND-GUIDE]]
- [[API-GUIDE]]
- [[CHILD-SAFETY-AND-PRIVACY]]
- [[GLOSSARY]]

Back to [[INDEX]].

## Update this document when

- A flow, screen, role or permission changes.
- A feature is added to or removed from the catalog.
