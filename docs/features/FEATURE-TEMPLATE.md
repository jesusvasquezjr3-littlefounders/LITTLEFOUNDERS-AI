---
title: Feature requirements template
status: scaffold
updated: 2026-10-09
---

# Feature requirements template

> The template every technical requirements document starts from. Copy it to `docs/features/<FEATURE-ID>-<name>.md`.

> **Status: scaffold.** The structure is set; nothing below that is not marked as current state has been decided. Fill it in with the owner, then change the status to `draft` and, once approved, `accepted`.

## Role

Forces every feature through the same questions, including security and child safety, before any code is written.

## Read this when

- Starting a new feature.

## To define

- [ ] Summary and the product requirement it implements.
- [ ] User flows covered and the screens involved.
- [ ] Data model: tables, columns, row-level security policies, classification of each field.
- [ ] API: endpoints, request and response shapes, error cases, rate limits.
- [ ] Security and child-safety review: assets, threats, consent, data minimization.
- [ ] Locale strings and analytics events.
- [ ] Edge cases and failure behavior.
- [ ] Rollout, migration and rollback.
- [ ] Test plan and acceptance criteria.
- [ ] Tasks, linked to the build task list.

## Related

- [[TECHNICAL-REQUIREMENTS]]
- [[PRODUCT-REQUIREMENTS]]
- [[USER-FLOWS]]
- [[DATABASE-GUIDE]]
- [[API-GUIDE]]
- [[SECURITY-GUIDE]]
- [[CHILD-SAFETY-AND-PRIVACY]]
- [[TESTING-GUIDE]]
- [[BUILD-TASKS]]

Back to [[INDEX]].

## Update this document when

- The review questions every feature must answer change.
