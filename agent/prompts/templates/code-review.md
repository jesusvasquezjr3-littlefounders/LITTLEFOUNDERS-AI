---
template: code-review
inputs:
  diff: "branch, PR number, or 'working tree'"
---

# Task: review a change

## Read first
- `agent/core/checklists/review.md` — THE rubric; review in its order (invariants → correctness → design/i18n → tests/docs)
- `/AGENTS.md` §1.3 + §1.9 — blocking invariants
- Skills: `review-animations` if the diff touches motion code

## Steps
1. Read the full diff before judging any part.
2. Pass 1 — invariants (blocking; a violation ends the review, report immediately).
3. Pass 2 — correctness (envelope/Zod/sad paths/async).
4. Pass 3 — design & i18n (frontend diffs only).
5. Pass 4 — tests & docs stewardship.
6. Report findings most-severe-first, each with file:line and a concrete failure scenario. No style nitpicks unless they violate a documented convention.

## Acceptance
- [ ] Every finding cites the rule it violates (doc + section)
- [ ] Explicit verdict: approve / request changes
