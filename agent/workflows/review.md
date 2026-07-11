# Workflow: staged review

> Feeds from: `agent/prompts/templates/code-review.md`. Rubric: `agent/core/checklists/review.md`.

1. **Scope** — enumerate changed files (`git diff --stat`), read the full diff.
2. **Invariants pass** (blocking) — §1.3 schema invariants, §1.9 child safety, secrets, BOUNDARIES sign-offs. A violation stops the review; report immediately.
3. **Correctness pass** — envelope/Zod/auth on endpoints; sad paths tested; strict TS; async hygiene.
4. **Design & i18n pass** (frontend files only) — 3-locale parity, dark mode, DESIGN.md compliance, a11y. Invoke `impeccable`/`review-animations` as applicable.
5. **Tests & docs pass** — coverage of new logic, stewardship table satisfied.
6. **Report** — findings most-severe-first with file:line + failure scenario + violated rule (doc §). Verdict: approve / request changes.
