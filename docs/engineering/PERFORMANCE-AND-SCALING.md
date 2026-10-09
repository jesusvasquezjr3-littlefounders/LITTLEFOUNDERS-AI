---
title: Performance and scaling
status: scaffold
updated: 2026-10-09
---

# Performance and scaling

> Performance budgets, caching, CDN behavior and how the system grows.

> **Status: scaffold.** The structure is set; nothing below that is not marked as current state has been decided. Fill it in with the owner, then change the status to `draft` and, once approved, `accepted`.

## Role

Gives agents numeric targets to meet and a plan for growth, so performance is designed rather than patched.

## Read this when

- Adding assets, queries, caching or a heavy screen.
- Planning capacity or cost.

## To define

- [ ] Budgets: web vitals, bundle size, API latency percentiles, 3D asset weight.
- [ ] Caching layers: browser, CDN, edge, application, database; keys and invalidation.
- [ ] CDN configuration and static asset strategy.
- [ ] Database scaling: pooling, replicas, partitioning, when each is triggered.
- [ ] Horizontal scaling and queues.
- [ ] Load-testing plan.
- [ ] Cost model and the signals that trigger a scaling step.

## Current state

- Cache headers for the frontend are set in `frontend/vercel.json`.

## Related

- [[SYSTEM-DESIGN]]
- [[INFRASTRUCTURE]]
- [[DATABASE-GUIDE]]
- [[FRONTEND-GUIDE]]
- [[OBSERVABILITY]]
- [[RATE-LIMITING-AND-ABUSE]]
- [[DESIGN-SYSTEM]]

Back to [[INDEX]].

## Update this document when

- A budget, cache rule or scaling trigger changes.
