---
title: Frontend guide
status: scaffold
updated: 2026-10-09
---

# Frontend guide

> The rules for building the web client.

> **Status: scaffold.** The structure is set; nothing below that is not marked as current state has been decided. Fill it in with the owner, then change the status to `draft` and, once approved, `accepted`.

## Role

The owner defines the new frontend rules here. Agents follow them for every change under `frontend/`. Visual rules live in [[DESIGN-SYSTEM]]; language-level rules in [[CODE-STYLE-GUIDE]].

## Read this when

- Any change under `frontend/`.
- Adding a route, state, data call or form.

## To define

- [ ] Folder structure and where each kind of file lives.
- [ ] Routing and code splitting.
- [ ] State management and server-state rules.
- [ ] Data fetching, caching and error handling against the API contract.
- [ ] Forms and validation at the boundary.
- [ ] Internationalization: every user-visible string lives in a locale file, in en-US, es-MX and pt-BR.
- [ ] Theming (light and dark) and responsive behavior.
- [ ] Accessibility requirements.
- [ ] Performance budgets and bundle limits.
- [ ] Client security: XSS, content security policy, token and storage handling.
- [ ] Consent-gated analytics and 3D asset loading.

## Decided

- Use the seven libraries in [[UI-LIBRARIES]] before writing any component, animation, chart, toast, icon morph or loader by hand; another library needs the owner (D-007 in [[DECISIONS]]).
- Reduced motion is honored once at the root (`MotionConfig reducedMotion="user"`) and per component where a library has its own switch.
- Folders: `src/components/` (ours), `src/components/ui/` and `src/components/charts/` (copied from registries, not edited and not linted), `src/features/<name>/` (one folder per page or feature), `src/styles/` (Tailwind entry and tokens), `src/i18n/` (copy).

## Current state

- React 19, Vite, TypeScript and Tailwind CSS v4. Locales: en-US, es-MX, pt-BR. Light and dark themes. Plausible, Umami and Google Analytics 4 load only after consent.

## Related

- [[DESIGN-SYSTEM]]
- [[UI-LIBRARIES]]
- [[CODE-STYLE-GUIDE]]
- [[API-GUIDE]]
- [[SECURITY-GUIDE]]
- [[TESTING-GUIDE]]
- [[PERFORMANCE-AND-SCALING]]
- [[USER-FLOWS]]
- [[OBSERVABILITY]]

Back to [[INDEX]].

## Update this document when

- The owner changes a frontend rule.
- The structure, routing or data layer changes.
