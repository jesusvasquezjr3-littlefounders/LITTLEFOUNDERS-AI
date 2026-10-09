---
title: Build tasks
status: scaffold
updated: 2026-10-09
---

# Build tasks

> The working task list: what is open, in progress and done.

> **Status: scaffold.** The structure is set; nothing below that is not marked as current state has been decided. Fill it in with the owner, then change the status to `draft` and, once approved, `accepted`.

## Role

Gives agents and humans one place to see what to do next. Each task is small, has an ID, and links to its requirements document. It is not a log of past work; that is the [[CHANGELOG]].

## Read this when

- Picking the next piece of work.
- Closing a task.

## To define

- [ ] Task format: ID, title, status, links, acceptance criteria.
- [ ] Open tasks grouped by phase.

## Open tasks

| ID | Task | Status | Notes |
|---|---|---|---|
| T-001 | Clean the landing page so it passes `npm run lint:slop`, then add that check to CI | open | The owner asked to be reminded. 173 spacing findings are auto-fixable; about 36 type findings need manual changes. |
| T-002 | Adapt `database/scripts/local-stack.sh` to an empty `database/migrations/` | open | It loops over migration and seed paths that no longer exist. |
| T-003 | Restore the legal pages (terms and privacy) before any production release | open | They were removed with the restart. |
| T-004 | Decide how backups move off the `filebase` service, or keep that service running | open | The backup workflows depend on it. |
| T-005 | Fix the GitHub ruleset on `main` that requires a check which no longer exists | open |  |
| T-006 | Wire the landing calls to action once the first feature exists | open | They render and do nothing. |
| T-009 | Bring Bencho blocks into the product one at a time as screens need them | open | Procedure and licence in [[UI-LIBRARIES]]; nothing to unblock. |
| T-010 | Cut the frontend bundle further: the entry chunk is 860 KB (282 KB gzip) after sharing one Motion copy; Cojeev's icon data adds a lazy 354 KB chunk | open | Mostly React DOM, Motion, Sileo and i18n; measure before and after. See [[PERFORMANCE-AND-SCALING]]. |
| T-011 | Audit the accessibility of each Cojeev component the first time it is used | open | The Button, Sheet, Dropdown menu and Badge on the landing have not been audited yet. |
| T-007 | Define the security baseline with the owner and fill [[SECURITY-GUIDE]] and [[CHILD-SAFETY-AND-PRIVACY]] | open |  |

## Related

- [[IMPLEMENTATION-PLAN]]
- [[UI-LIBRARIES]]
- [[TECHNICAL-REQUIREMENTS]]
- [[AI-WORKFLOW]]
- [[CHANGELOG]]
- [[TESTING-GUIDE]]

Back to [[INDEX]].

## Update this document when

- A task is opened, started or finished.
