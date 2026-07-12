# Code-Review Rubric

Review in this order — an invariant violation ends the review immediately.

## 1. Invariants pass (blocking)
- [ ] Schema invariants intact (`/AGENTS.md` §1.3): 6 roles, superadmin domain gate, guardian links, join-table families, append-only audit, RLS present.
- [ ] Child-safety rules (§1.9): no minor PII outbound, moderation in place.
- [ ] No secrets in the diff; `.env.example` updated instead.
- [ ] Boundary actions (`agent/core/BOUNDARIES.md`) have explicit human approval.

## 2. Correctness pass
- [ ] Envelope + `/api/v1/` + Zod on every new/changed endpoint.
- [ ] Sad paths handled (validation, auth, not-found) and tested.
- [ ] No `any` without justification; strict TS holds.
- [ ] Async correctness: no floating promises, timeouts on external IO.

## 3. Design & i18n pass (frontend diffs)
- [ ] Zero hardcoded strings; keys in all 3 locales.
- [ ] Dark mode styled; tokens strictly per `/DESIGN.md` (closed `lf-*` type scale, liquid-glass elevation, no raw hex).
- [ ] a11y basics: focus states, hit areas, semantic elements.
- [ ] **Responsive verified at mobile (~375px) AND desktop (~1280px)** — screenshots present, neither skipped. Desktop uses freed width deliberately, not a stretched mobile column (/AGENTS.md §1.11, non-negotiable).

## 4. Test & docs pass
- [ ] New logic covered; tests assert behavior, not implementation.
- [ ] Stewardship table (§8) satisfied.
- [ ] Naming matches GLOSSARY + §1.7.
- [ ] Every discrete requirement in the original task instruction is addressed — none silently dropped (§1.12).
- [ ] Any claim of "tests pass" / "CI green" / "verified" in this review is backed by output actually observed this session, not assumed.
