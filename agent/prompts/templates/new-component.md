---
template: new-component
inputs:
  section: "learn | tutor | tasks | profile | shared"
  component: "component name (PascalCase)"
---

# Task: add a frontend component

## Read first
- `/DESIGN.md` §Screen Recipes — **COMPOSITION FIDELITY (§0)**: if a recipe covers this surface, build from the recipe. Raw `template/` files are fallback only; fix ambiguous recipes in the same commit.
- `/DESIGN.md` §Motion — the five motion recipes + tokens; new pages inherit the route transition from the layout, below-the-fold sections use `<Reveal>`.
- `/DESIGN.md` — AUTHORITATIVE tokens & rules. Closed type scale (`lf-*`), clay shadows, hyper-rounded shapes, Material Symbols only. Do not invent values outside it.
- `/DESIGN.md` §Layout → *Responsive Adaptation* — desktop+mobile is NON-NEGOTIABLE (/AGENTS.md §1.11)
- `frontend/AGENTS.md` — frontend domain rules
- `frontend/README.md` § "How the internet sees this site" — required reading before ANY public marketing surface
- `agent/core/CONVENTIONS.md` §Frontend — i18n + dark mode rules
- Skills: `impeccable` / `agave` / `emil-design-eng` apply to this task

## Steps
1. Component under `frontend/src/` in the section's dir (or `components/` if shared). Build from `frontend/src/components/ui/` primitives — no per-view restyling.
2. Every string via `t()`; keys added to `en-US.json` + `es-MX.json` + `pt-BR.json` in this commit.
3. Style light AND dark (`dark:` variants / CSS vars) at write time.
4. Layout for BOTH breakpoints at write time — not mobile-only with desktop "later." Use `container-max`/`sidebar-width` tokens for structure; everything else reflows.
5. a11y: semantic elements, focus-visible, ≥44px hit areas on interactive elements.
6. Test: renders + key interaction (Testing Library).
7. **Verify in the browser preview at ~375px (mobile) AND ~1280px (desktop).** Screenshot both. This step is not optional and not skippable for "small" components.
8. **If this is a PUBLIC page** (a new marketing route, or one leaving placeholder status): declare it in `frontend/scripts/seo/site.mjs` in the SAME commit — title, description and H1 in all three locales, `index`, `lastmod` (§1.15). Nothing breaks if you skip it; the page simply never enters search, never unfurls with a card, and stays invisible to every AI assistant, because the SPA fallback it lands on is `noindex` by design.

## Acceptance
- [ ] `npm run i18n:check` (root) passes
- [ ] type-check / lint / test green in `frontend/`
- [ ] No hardcoded colors/sizes/type outside DESIGN.md tokens and the closed `lf-*` scale
- [ ] Verified and screenshotted at mobile (~375px) AND desktop (~1280px) — neither skipped (/AGENTS.md §1.11)
- [ ] Public page? `npm run seo:check` (root) passes, and `npm run seo:live` after the deploy (/AGENTS.md §1.15)
