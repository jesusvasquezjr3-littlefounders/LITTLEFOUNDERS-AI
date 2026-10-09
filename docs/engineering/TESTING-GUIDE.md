---
title: Testing guide
status: scaffold
updated: 2026-10-09
---

# Testing guide

> What is tested, how, and what must pass before work is called done.

> **Status: scaffold.** The structure is set; nothing below that is not marked as current state has been decided. Fill it in with the owner, then change the status to `draft` and, once approved, `accepted`.

## Role

All tests of the previous version were deleted. The strategy is designed from zero here. It defines what counts as verified, so an agent never reports "done" on the strength of code that merely compiles.

## Read this when

- Finishing any change.
- Adding test tooling or a CI check.
- Reviewing whether a feature is verified.

## To define

- [ ] Strategy: which levels of testing exist and what each is for.
- [ ] What must always be tested: authorization and row-level security, consent flows, anything that changes a balance or reward, input parsing.
- [ ] Tools and conventions.
- [ ] Synthetic test data rules.
- [ ] Visual verification: light and dark themes in en-US, es-MX and pt-BR, at phone and desktop width.
- [ ] Accessibility and performance checks.
- [ ] Security checks and their cadence.
- [ ] Definition of done.

## Current state

- Checks that exist today, run in `frontend/`: `npm run type-check`, `npm run lint`, `npm run build`. There is no test suite. How a frontend change is looked at and measured (axe, keyboard, layout and measuring passes, in light and dark, in three languages, from 320 to 1440 px) is in [[FRONTEND-GUIDE]] and [[FRONTEND-TOOLKIT]]; the scripts are the audit tools in `frontend/tools/audit/`, run by hand, not a CI gate (D-010 in [[DECISIONS]]).

## Related

- [[CODE-STYLE-GUIDE]]
- [[CI-CD-AND-VERSION-CONTROL]]
- [[SECURITY-GUIDE]]
- [[FRONTEND-GUIDE]]
- [[BACKEND-GUIDE]]
- [[DATABASE-GUIDE]]
- [[AI-WORKFLOW]]

Back to [[INDEX]].

## Update this document when

- A check is added or removed.
- The definition of done changes.
