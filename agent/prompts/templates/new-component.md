---
template: new-component
inputs:
  section: "learn | tutor | games | tasks | profile | shared"
  component: "component name (PascalCase)"
---

# Task: add a frontend component

## Read first
- `/DESIGN.md` — tokens & rules. While skeleton: plain Tailwind defaults, flag for re-skin, DO NOT invent tokens.
- `frontend/AGENTS.md` — frontend domain rules
- `agent/core/CONVENTIONS.md` §Frontend — i18n + dark mode rules
- Skills: `impeccable` / `agave` / `emil-design-eng` apply to this task

## Steps
1. Component under `frontend/src/` in the section's dir (or `components/` if shared).
2. Every string via `t()`; keys added to `en-US.json` + `es-MX.json` + `pt-BR.json` in this commit.
3. Style light AND dark (`dark:` variants) at write time.
4. a11y: semantic elements, focus-visible, ≥44px hit areas on interactive elements.
5. Test: renders + key interaction (Testing Library).

## Acceptance
- [ ] `npm run i18n:check` (root) passes
- [ ] type-check / lint / test green in `frontend/`
- [ ] No hardcoded colors/sizes outside Tailwind classes; no invented design tokens
