---
title: Frontend guide
status: draft
updated: 2026-10-10
---

# Frontend guide

> How the web client is built: the stack, the structure, the five non-negotiable rules, the conventions, how a change is checked, and what is still open.

> **Status: draft.** The five rules and the library decisions are the owner's and in force ([[DECISIONS]] D-007, D-008, D-009). The stack, structure and conventions below record what is built and how it is done today; the open decisions at the end are marked as such and are not guessed.

## Role

Agents and humans follow this for every change under `frontend/`. Which skill or library to reach for, and the step-by-step procedures, are in [[FRONTEND-TOOLKIT]]. Visual rules live in [[DESIGN-SYSTEM]]; the library roles and wiring in [[UI-LIBRARIES]]; the evidence behind color, shape and children's ergonomics in [[RESEARCH-FOUNDATION]]; language-level rules in [[CODE-STYLE-GUIDE]].

## Read this when

- Any change under `frontend/`.
- Adding a page, a section, a component, a string, a token or a dependency.
- Adding a route, state, data call or form (the open decisions at the end apply first).

## The five non-negotiable rules

The owner set these on 2026-10-09 (D-009 in [[DECISIONS]]). They apply to every screen, every library component and every change under `frontend/`; nothing is exempt, and a change that breaks one is not done.

1. **i18n: no hardcoded text.** Every word a person can read or hear has a key in `src/i18n/en-US`, `es-MX` and `pt-BR`, and the three files carry the same keys. That includes accessible names (`aria-label`, `title`, `alt`), toasts, loading and error messages, the document title, the brand name, the contact address and the language names (each in its own language). A string literal in a component is a defect. When a library supplies a default string (a close label, a "Total", a loading name), pass ours through its prop, or do not use that part of the component; the known cases are in [[UI-LIBRARIES]]. Copy is written for the language it is read in, to the humanizer standard (rule 12 in [[CLAUDE]]); numbers and dates are formatted for the active locale.
2. **Desktop and mobile, each optimized, on clear grids.** Every page uses one grid inside the shell's container (1120 px, margins 16 px on phones and 24 px from 640 px, so the content is at most 1072 px): 4 columns below 768 px with a 16 px gutter, 8 columns from 768 px and 12 columns from 1024 px with a 24 px gutter. A section places its blocks with `col-span-*` on that grid and never invents its own columns or gutter, so column edges line up from one section to the next. Alignment: on phones (below 768 px) every block is centered on the page's axis, so the page is symmetric; from 768 px text blocks start on the container's left edge, shared by the header, the content and the footer, and no text block is inset (no padded pills or bands that move the text away from that line). A composition that is symmetric by design (the problem section: centered heading, text and scene as mirror halves) stays centered at every width. Between any two sections the space is the same: 96 px, then 128 px from 768 px. Breakpoints are Tailwind's `sm` 640, `md` 768, `lg` 1024 and `xl` 1280. Where an image and a text sit side by side they take the same number of columns and are centered on each other, measured on what is visible (a scene is cropped so the characters, not the empty frame, sit at the middle); below 1024 px they stack, text first. The constants live in `frontend/src/features/landing/type.ts` (`grid`, `section`) and move to a shared module when a second page needs them. The smallest supported width is 320 px. Layout is never done with absolute positioning. On a phone the primary action is full width and actions stack. Running text is medium weight in the soft ink color, not the muted gray, and 17 px on phones. A change is checked at 320, 360, 390, 768, 1024 and 1440 px, in light and dark, in all three languages.
3. **Text is never cut.** No ellipsis, no line clamp, no fixed-height box around text, no clipping by `overflow: hidden`, no horizontal page scroll. Labels wrap and their container grows (buttons included: the Cojeev button is made to wrap in `lf-theme.css`), long words and addresses break, and flex and grid children that hold text can shrink (`min-w-0`). Design for the longest language: es-MX and pt-BR run well past en-US.
4. **Iconography: our own for what identifies the product.** Icons that represent features, the main actions of the application, navigation and achievements are the product's own, drawn and audited in-house. Utility icons (close, chevrons, menu, theme, status marks) come from the libraries in [[UI-LIBRARIES]]: Lucide icon data through Morphicons, and Cojeev's. An icon never carries a meaning alone: it has an accessible name, and a meaning that matters (right or wrong, a status, a category) also has a word. No other icon set is added. The process for drawing and auditing our own icons (format, grid, review, registry) is not defined yet: T-012, to be settled with the owner at the first feature that needs one.
5. **Design from evidence.** Design claims about color, shape, gamification, rewards and children's motor ability are used only at the strength the literature gives them: grade A may become a rule, B a default, C a guideline with its caveat, D nothing. The evidence, the grades and what they mean for the current tokens are in [[RESEARCH-FOUNDATION]].

Also in force: **route paths are in English** whatever the interface language (D-011), and scenes with the characters follow [[CHARACTER-COMPOSITIONS]] (D-012).

## Stack and commands

Node 24. Everything below is run from `frontend/`.

| Piece | What is used |
|---|---|
| UI | React 19, TypeScript 5 in strict mode, React Router 6 |
| Build | Vite 6; `npm run build` type-checks, builds, then prerenders the SEO shell (`scripts/seo/`) |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`), tokens in `src/styles/lf-theme.css` on top of Cojeev's token layer |
| Components | shadcn registries `@cojeev` and `@bklit`, plus Motion, Sileo, Morphicons and Thinking Orbs: [[UI-LIBRARIES]] |
| Copy | i18next only chooses and remembers the language; the copy itself is typed JSON per locale |
| Lint | ESLint (typescript-eslint) and the vendored anti-slop Oxlint rules |

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on `http://localhost:5173`. Vite binds the IPv6 loopback: use `localhost`, not `127.0.0.1`. After changing `vite.config.ts` or installing a Tailwind or shadcn piece, stop and start it again. |
| `npm run type-check` | `tsc --noEmit`. `noUncheckedIndexedAccess` is off because the registries' copied code does not satisfy it |
| `npm run lint` | ESLint. Registry code is excluded |
| `npm run lint:slop` | Anti-slop rules on our own TypeScript: parse input at the boundary, no `unknown` parameters, no chained or unjustified type assertions. Registry code is excluded. Older files still have findings (T-001); new code should have none |
| `npm run build` | The production build, as CI runs it |
| `npm run render:signin` | Renders the sign-in window's scene to `public/landing/signin/`: a developer tool ([[CHARACTER-COMPOSITIONS]]) |
| `npm run audit:*` | The audit tools in `tools/audit/`: developer tools, not a gate ([[FRONTEND-TOOLKIT]]) |

## Where things live

```
frontend/
  components.json        shadcn: aliases and the two registries
  index.html             theme boot script and the boot veil (inline on purpose; read its comments before touching it)
  public/                brand/ (logos, color and white), landing/ (hero and problem videos and posters),
                         fonts/ (Plus Jakarta Sans), og/, scenes/ (the 3D scenes, Git LFS: never delete or overwrite)
  scripts/seo/           the page table (titles, descriptions), prerender, sitemap, llms.txt
  tools/oxlint/          the vendored anti-slop rules
  tools/render/          the scene render tools (page, renderer, encoder); see CHARACTER-COMPOSITIONS
  tools/audit/           the audit tools (a11y, keyboard, layout, grid, scene, color, shot); output goes to audit-out/, not tracked
  src/
    main.tsx  App.tsx    entry, providers, routes
    components/          ours: AppShell, SiteFooter, TopbarControls, CookieConsentBanner, CircleFlag, icons/
    components/ui/       copied from the registries (Cojeev). Not edited, not linted; see the patch list in UI-LIBRARIES
    components/charts/   copied from the registries (Bklit). Same rule
    features/<name>/     one folder per page or feature; landing/ holds the sections and type.ts
    i18n/                index.ts (language), copy.ts (typed bundles), useCopy.ts (hooks), <locale>/core.json and site.json
    lib/                 analytics, consent and visitor, boot, footerLinks, utils; cojeev/ and cojeev-motion/ are registry code
    styles/              app.css (the one entry), lf-fonts.css, lf-theme.css, cojeev/ (registry CSS)
    theme/               useTheme: light, dark or auto, sets both html.dark and html[data-mode], cross-fading the page via a View Transition (skipped for reduced motion)
```

- **Naming.** Components are PascalCase files with one main export; folders and non-component files are camelCase or lowercase. A component starts with a comment that says what it is for and which rule it applies.
- **Copy namespaces.** `core.json` holds the shell (skip link, theme and language controls, footer, brand, contact); `site.json` holds the landing and the cookie choice. A key lives in exactly one namespace; `useCoreCopy()` and `useSiteCopy()` read them, and a missing key is a type error. Add a namespace per feature when a feature needs one.
- **Styling.** Tailwind classes that read tokens (`text-[var(--v-ink-soft)]`, `bg-[var(--v-beige)]`); no raw hex values in components; `cn()` from `lib/utils` merges classes. Shared layout and type roles live next to the feature that owns them (`features/landing/type.ts`). The character avatars live in `features/avatars` ([[CHARACTER-AVATARS]]): `<Avatar character expression gaze />` and `<FloatingAvatar />`, with `speak()` and `react()` on a ref; an avatar is decorative unless given a translated `label`, it never carries words, and `/dev/avatars` (dev server only) shows them alive.
- **Theming.** Light and dark are both always designed. A color is added to `lf-theme.css` for both modes, with its label color chosen by measurement ([[RESEARCH-FOUNDATION]]), never inside a component.
- **Dependencies.** A new package needs a reason a library from [[UI-LIBRARIES]] cannot give; a new UI library needs the owner.

## Accessibility floor

Met on the landing and kept for every screen: the skip link is the first Tab stop; every interactive target is at least 48 px (76 px where a young child answers or plays, [[RESEARCH-FOUNDATION]]); focus is always visible; a dialog traps focus and returns it to what opened it; text contrast is at least 4.5:1 and component edges 3:1; color is never the only channel; reduced motion is honored once at the root (`MotionConfig reducedMotion="user"`) and per component where a library has its own switch; no axe violation in light and dark in en-US, es-MX and pt-BR.

## Performance today

Measured on 2026-10-09: about 289 KB of JavaScript, compressed, for the landing (React DOM 84, the app 131, Motion 49, i18n 17, router 7, the page 10) plus a lazy 77 KB chunk of icon data. React, Motion, the router and i18n are built into their own files so a deploy that changes only our code does not invalidate them in a returning visitor's cache. No budget is set yet (open decision below); cache headers are in `frontend/vercel.json`.

## Analytics, consent and the 3D scenes

Plausible, Umami and Google Analytics 4 load only after the visitor accepts the optional cookies (`lib/analytics.tsx`, `lib/visitor.ts`, [[OBSERVABILITY]]). The hero and problem scenes are looping videos with a poster that stays for reduced motion and less data (`features/landing/LoopVideo.tsx`); the interactive 3D character files are Git LFS and are not loaded by the landing.

## How a change is checked before it is called done

1. `npm run type-check`, `npm run lint` and `npm run build` pass; new code passes `npm run lint:slop`.
2. The page is looked at, not only built: light and dark, en-US, es-MX and pt-BR, at 320, 390, 768, 1024 and 1440 px, with the cookie banner and with it dismissed, the preferences sheet and the language menu opened.
3. Mechanical checks with the audit tools (`npm run audit:a11y`, `audit:keyboard`, `audit:layout`, `audit:grid`, `audit:color`; `audit:shot` to look at the page; see [[FRONTEND-TOOLKIT]]): axe-core with no violation; the keyboard pass; the layout pass (no horizontal scroll, no ellipsis, line clamp or clipped text); the grid pass when layout changed; the color pass when a token changed. Run a check with `--matrix` after a change that could affect it.
4. Copy is in all three locale files and passes the humanizer standard.
5. Documentation is part of the change (rule 11 in [[CLAUDE]]): the affected documents, their `updated` date and [[CHANGELOG]]. The commit stays local; the owner pushes.

## Open decisions

Not decided; do not guess them. Raise each with the owner when a feature needs it.

- [ ] Routing beyond the single `/` route, and code splitting per route.
- [ ] State management and server-state rules.
- [ ] Data fetching, caching and error handling against the API contract ([[API-GUIDE]]); depends on the backend.
- [ ] Forms and validation at the boundary.
- [ ] Client security: content security policy, token and storage handling ([[SECURITY-GUIDE]]).
- [ ] Performance budgets and bundle limits ([[PERFORMANCE-AND-SCALING]]).
- [ ] The product's own icons: format, grid, review, registry (T-012).
- [ ] Which surfaces are young-child surfaces and the age bands (T-013).

## Related

- [[FRONTEND-TOOLKIT]]
- [[DESIGN-SYSTEM]]
- [[UI-LIBRARIES]]
- [[RESEARCH-FOUNDATION]]
- [[LANDING-MESSAGING]]
- [[CODE-STYLE-GUIDE]]
- [[API-GUIDE]]
- [[SECURITY-GUIDE]]
- [[TESTING-GUIDE]]
- [[PERFORMANCE-AND-SCALING]]
- [[USER-FLOWS]]
- [[OBSERVABILITY]]

Back to [[INDEX]].

## Update this document when

- The owner changes a frontend rule or settles an open decision.
- The stack, the folder structure, a command or the checking procedure changes.
- A convention is added or retired.
