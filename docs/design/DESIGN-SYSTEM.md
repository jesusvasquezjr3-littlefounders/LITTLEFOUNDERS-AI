---
title: Design system
status: scaffold
updated: 2026-10-09
---

# Design system

> The visual and interaction language: tokens, components, patterns and the rules for using them.

> **Status: scaffold.** The structure is set; nothing below that is not marked as current state has been decided. Fill it in with the owner, then change the status to `draft` and, once approved, `accepted`.

## Role

Tells an agent how the product must look and behave so every screen is consistent without being told again. It holds rules and decisions, not a copy of the CSS.

## Read this when

- Building or changing any UI.
- Adding a component, color, icon or animation.
- Using a 3D character.

## To define

- [ ] Design tokens: color, type, spacing, radius, elevation and motion, for light and dark.
- [ ] Component inventory with usage rules and states.
- [ ] Layout, responsive breakpoints and density.
- [ ] Accessibility floor (contrast, focus, motion reduction, target size).
- [ ] Voice and tone for children and teenagers, and for parents.
- [ ] Illustration, iconography and the use of the 3D characters, including how they are loaded.
- [ ] Rules for text length and layout across en-US, es-MX and pt-BR.

## Decided

- The evidence behind color, shape, feedback and target sizes is [[RESEARCH-FOUNDATION]] (rule 5 in [[FRONTEND-GUIDE]]).
- The interface is built with the libraries in [[UI-LIBRARIES]] (D-007 in [[DECISIONS]]). One token file feeds all of them.

## Current state

- Tokens live in `frontend/src/styles/lf-theme.css` (brand palette in light and dark, control sizes for children) on top of Cojeev's token system; components are in `frontend/src/components/`. Typeface: Plus Jakarta Sans. The Mentor character models are tracked with Git LFS in `glb/` (sources) and `frontend/public/scenes/` (optimized scenes).

## Related

- [[UI-LIBRARIES]]
- [[RESEARCH-FOUNDATION]]
- [[FRONTEND-GUIDE]]
- [[USER-FLOWS]]
- [[CODE-STYLE-GUIDE]]
- [[PRODUCT-REQUIREMENTS]]
- [[CHILD-SAFETY-AND-PRIVACY]]
- [[PERFORMANCE-AND-SCALING]]

Back to [[INDEX]].

## Update this document when

- A token, component or pattern is added, changed or removed.
- The owner changes a frontend or visual rule.
