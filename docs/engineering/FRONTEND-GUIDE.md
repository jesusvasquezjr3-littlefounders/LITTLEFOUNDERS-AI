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
- [ ] Theming (light and dark).
- [ ] Accessibility requirements.
- [ ] Performance budgets and bundle limits.
- [ ] Client security: XSS, content security policy, token and storage handling.
- [ ] Consent-gated analytics and 3D asset loading.

## The five non-negotiable rules

The owner set these on 2026-10-09 (D-009 in [[DECISIONS]]). They apply to every screen, every library component and every change under `frontend/`; nothing is exempt, and a change that breaks one is not done.

1. **i18n: no hardcoded text.** Every word a person can read or hear has a key in `src/i18n/en-US`, `es-MX` and `pt-BR`, and the three files carry the same keys. That includes accessible names (`aria-label`, `title`, `alt`), toasts, loading and error messages, the document title, the brand name, the contact address and the language names (each in its own language). A string literal in a component is a defect. When a library supplies a default string (a close label, a "Total", a loading name), pass ours through its prop, or do not use that part of the component; the known cases are in [[UI-LIBRARIES]]. Copy is written for the language it is read in, to the humanizer standard (rule 12 in [[CLAUDE]]); numbers and dates are formatted for the active locale.
2. **Desktop and mobile, each optimized, on clear grids.** Every page uses one grid inside the shell's container (1120 px, margins 16 px on phones and 24 px from 640 px, so the content is at most 1072 px): 4 columns below 768 px with a 16 px gutter, 8 columns from 768 px and 12 columns from 1024 px with a 24 px gutter. A section places its blocks with `col-span-*` on that grid and never invents its own columns or gutter, so column edges line up from one section to the next. Alignment: on phones (below 768 px) every block is centered on the page's axis, so the page is symmetric; from 768 px text blocks start on the container's left edge, shared by the header, the content and the footer, and no text block is inset (no padded pills or bands that move the text away from that line). A composition that is symmetric by design (the problem section: centered heading, text and scene as mirror halves) stays centered at every width. Between any two sections the space is the same: 96 px, then 128 px from 768 px. Breakpoints are Tailwind's `sm` 640, `md` 768, `lg` 1024 and `xl` 1280. Where an image and a text sit side by side they take the same number of columns and are centered on each other, measured on what is visible (a scene is cropped so the characters, not the empty frame, sit at the middle); below 1024 px they stack, text first. The constants live in `frontend/src/features/landing/type.ts` (`grid`, `section`) and move to a shared module when a second page needs them. The smallest supported width is 320 px. Layout is never done with absolute positioning. On a phone the primary action is full width and actions stack. Running text is medium weight in the soft ink color, not the muted gray, and 17 px on phones. A change is checked at 320, 360, 390, 768, 1024 and 1440 px, in light and dark, in all three languages.
3. **Text is never cut.** No ellipsis, no line clamp, no fixed-height box around text, no clipping by `overflow: hidden`, no horizontal page scroll. Labels wrap and their container grows (buttons included: the Cojeev button is made to wrap in `lf-theme.css`), long words and addresses break, and flex and grid children that hold text can shrink (`min-w-0`). Design for the longest language: es-MX and pt-BR run well past en-US.
4. **Iconography: our own for what identifies the product.** Icons that represent features, the main actions of the application, navigation and achievements are the product's own, drawn and audited in-house. Utility icons (close, chevrons, menu, theme, status marks) come from the libraries in [[UI-LIBRARIES]]: Lucide icon data through Morphicons, and Cojeev's. An icon never carries a meaning alone: it has an accessible name, and a meaning that matters (right or wrong, a status, a category) also has a word. No other icon set is added. The process for drawing and auditing our own icons (format, grid, review, registry) is not defined yet: T-012, to be settled with the owner at the first feature that needs one.
5. **Design from evidence.** Design claims about color, shape, gamification, rewards and children's motor ability are used only at the strength the literature gives them: grade A may become a rule, B a default, C a guideline with its caveat, D nothing. The evidence, the grades and what they mean for the current tokens are in [[RESEARCH-FOUNDATION]].

How the rules were last checked (2026-10-09): axe-core and a keyboard pass for accessibility, and a layout pass that opens the page, the preferences sheet and the language menu at 320, 360, 390, 768 and 1440 px in the three languages and flags page-level horizontal scroll, ellipsis, line clamps, clipped text and text that spills out of its box or the viewport. A measuring pass reads the same page at 390, 768, 1024 and 1440 px and reports the left edge of every text block, the gutters and column edges, the space between sections, the characters per line of each text block, and how the text and image columns are proportioned and centered. The scripts are not part of the repository; a change runs the same kind of check before it is called done.

## Decided

- Use the seven libraries in [[UI-LIBRARIES]] before writing any component, animation, chart, toast, icon morph or loader by hand; another library needs the owner (D-007 in [[DECISIONS]]).
- Reduced motion is honored once at the root (`MotionConfig reducedMotion="user"`) and per component where a library has its own switch.
- Accessibility floor, met on the landing and kept for every screen: the skip link is the first Tab stop; every interactive target is at least 48 px; focus is always visible; a dialog traps focus and returns it to what opened it; no axe violation in light and dark in en-US, es-MX and pt-BR. How it was checked: [[UI-LIBRARIES]].
- Folders: `src/components/` (ours), `src/components/ui/` and `src/components/charts/` (copied from registries, not linted, edited only for the patches listed in [[UI-LIBRARIES]]), `src/features/<name>/` (one folder per page or feature), `src/styles/` (Tailwind entry and tokens), `src/i18n/` (copy).

## Current state

- React 19, Vite, TypeScript and Tailwind CSS v4. Locales: en-US, es-MX, pt-BR. Light and dark themes. Plausible, Umami and Google Analytics 4 load only after consent.

## Related

- [[DESIGN-SYSTEM]]
- [[UI-LIBRARIES]]
- [[RESEARCH-FOUNDATION]]
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
