---
template: bugfix
inputs:
  symptom: "what's observed"
  where: "service / route / component if known"
---

# Task: fix a bug

## Read first
- `<service>/AGENTS.md` for the affected service
- `WALKTHROUGH.md` Known Issues — is it already tracked/diagnosed?

## Steps
1. **Reproduce first** — a failing test or a concrete repro. No fix without reproduction.
2. Trace to root cause; state it in one sentence before writing the fix.
3. Minimal diff that fixes the cause (not the symptom). Resist drive-by refactors — note them for a separate task.
4. The repro becomes a **regression test** that fails before / passes after.
5. If the bug revealed a doc gap or wrong convention, fix the doc per authority hierarchy (§1.1).

## Acceptance
- [ ] Regression test in the suite; full service suite green
- [ ] Root cause stated in the commit body
- [ ] WALKTHROUGH Known Issues updated (removed or annotated)
