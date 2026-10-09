---
title: System design
status: scaffold
updated: 2026-10-09
---

# System design

> The reasoning behind the system: required qualities, capacity assumptions and trade-offs.

> **Status: scaffold.** The structure is set; nothing below that is not marked as current state has been decided. Fill it in with the owner, then change the status to `draft` and, once approved, `accepted`.

## Role

The "why" that precedes [[ARCHITECTURE]]. It states what the system must achieve and which trade-offs were accepted, so an agent can judge a design against goals rather than habit.

## Read this when

- Proposing or reviewing anything that touches several components.
- Choosing between two technical approaches.
- Sizing infrastructure.

## To define

- [ ] Quality attributes in priority order (privacy, safety, availability, latency, cost, maintainability).
- [ ] Capacity assumptions: users, daily activity, data volume and growth.
- [ ] Traffic and load model, including peaks.
- [ ] Failure modes and how the system degrades.
- [ ] Build-versus-buy stance.
- [ ] Key trade-offs, each pointing to its entry in the decision log.
- [ ] Risks and unknowns.

## Related

- [[ARCHITECTURE]]
- [[PERFORMANCE-AND-SCALING]]
- [[PRODUCT-REQUIREMENTS]]
- [[SECURITY-GUIDE]]
- [[INFRASTRUCTURE]]
- [[DECISIONS]]

Back to [[INDEX]].

## Update this document when

- A quality target or capacity assumption changes.
- A trade-off is decided.
