---
title: Frontend toolkit
status: draft
updated: 2026-10-11
---

# Frontend toolkit

> Which skill, library or document to reach for in each kind of frontend job, the procedures that repeat, and how each mechanical check is run.

> **Status: draft.** Records how the work has been done since 2026-10-09. The rules it serves are in [[FRONTEND-GUIDE]]; the owner's decisions are in [[DECISIONS]].

## Role

One page that answers "what do I use for this, and how?" so no session has to rediscover it. It does not repeat the rules or the library details; it points to them.

## Read this when

- Starting any frontend task, to pick the tool.
- Doing something that repeats: adding a string, a section, a component, a color, a link.
- Checking a change before calling it done.

## 1. Pick the tool for the job

| Job | Use | Where it is explained |
|---|---|---|
| Any text a person reads (interface, errors, toasts, emails, messages to the owner about the product) | The `humanizer` skill, always, in the language it will be read in | Section 2 |
| A new page or a new section | The grid and type roles in `features/landing/type.ts`, Cojeev components, Motion for the one entrance | [[FRONTEND-GUIDE]] rule 2, [[UI-LIBRARIES]] |
| Layout, columns, gutters, spacing between sections | The grid rule; the owner can run `/layout-grid` for a review | Section 2 |
| Typography, hierarchy, copy clarity, polish, a bolder or quieter pass | The owner runs `/impeccable` with a command (`typeset`, `clarify`, `polish`, `critique`, `audit`) | Section 2 |
| A new visual direction or redesign | The owner runs `/design-taste-frontend` or one of its style variants | Section 2 |
| A button, sheet, menu, badge or other general component | Cojeev (`@cojeev`) | [[UI-LIBRARIES]] |
| A chart, ring or gauge | Bklit UI (`@bklit`) | [[UI-LIBRARIES]] |
| An animation, transition, scroll or gesture | Motion (`motion/react`) | [[UI-LIBRARIES]] |
| A message that fades | Sileo | [[UI-LIBRARIES]] |
| An icon that changes state | Morphicons with Lucide icon data | [[UI-LIBRARIES]] |
| A loading indicator | Thinking Orbs | [[UI-LIBRARIES]] |
| A rich interaction Cojeev lacks (one-time code, slide to confirm, dropzone) | A Bencho block, adapted | [[UI-LIBRARIES]] |
| An icon that identifies the product | Our own, audited (not defined yet, T-012) | [[FRONTEND-GUIDE]] rule 4 |
| A color, shape, size, reward or feedback decision | The graded evidence | [[RESEARCH-FOUNDATION]] |
| What the landing says | The messaging record | [[LANDING-MESSAGING]] |
| Anything touching sessions, permissions, uploads or a child's data | The security guide and the security reference skill | [[SECURITY-GUIDE]], [[CHILD-SAFETY-AND-PRIVACY]] |

## 2. Skills

Skills live in `.claude/skills/`. Their versions, licences and how they were taken are in [[AI-WORKFLOW]].

**Always on.**

- `humanizer`. Applies to every string a user sees and every message the agent writes about the product (rule 12 in [[CLAUDE]]). It removes the habits of machine prose while keeping the meaning: contrasts that only add weight ("not X but Y"), one-line closers that repeat the point, staged openers, forced triads, dashes used everywhere, inflated or sales language, stock words, bold labels and filler. Write the specific thing for one reader. Read the result in the language it will be shown in, and write es-MX and pt-BR as native copy, not as translations of the English.

**Manual only: used when the owner names them.** Each has `disable-model-invocation: true`; the agent does not start them on its own, and for the taste skills the tool refuses an agent call outright, so the owner types the command. None of them overrides [[UI-LIBRARIES]], the five rules or [[RESEARCH-FOUNDATION]]; if a skill pushes against one, the rule wins and the conflict is reported.

| Skill | What it is for | Notes |
|---|---|---|
| `/impeccable` | Design work on an existing interface through commands: `shape`, `critique`, `audit`, `polish`, `typeset`, `layout`, `clarify`, `adapt`, `harden`, `distill`, `bolder`, `quieter`, `colorize`, `animate`, `delight`, `extract`, `document` | Its launcher downloads an engine binary from the project's GitHub releases on first use. The agent does not run it without the owner's explicit approval and reads the project context directly instead, as the skill allows. Its hooks were not installed |
| `/design-taste-frontend` | An anti-template direction for landing pages, portfolios and redesigns | Run by the owner |
| `/redesign-existing-projects` | Audit an existing interface for generic patterns and raise it | Run by the owner |
| `/high-end-visual-design`, `/minimalist-ui`, `/industrial-brutalist-ui` | Three style variants | Run by the owner; a different visual world than the current one |
| `/full-output-enforcement` | Stops truncated or placeholder output on large tasks | Run by the owner |
| `/stitch-design-taste` | A design-system file for Google Stitch | Run by the owner |
| `/layout-grid` | Define and review a responsive grid: columns, gutters, margins, breakpoints, rhythm | Run by the owner. Give it the grid rule in [[FRONTEND-GUIDE]] as the baseline |

When a task would benefit from one of these, the agent says which command and why, and does the part it can without it. Other skills in the folder are the anti-slop installer and the Strix security skills and reference; see [[ai-pentesting]] and [[SECURITY-GUIDE]].

## 3. Procedures

**Add or change a string.**

1. Pick the namespace (`core.json` for the shell, `site.json` for the landing, a new `<feature>.json` for a new feature) and add the key to all three locale folders with the same name.
2. Write each language for its reader, to the humanizer standard.
3. Register a new namespace in `src/i18n/copy.ts` and add its hook in `src/i18n/useCopy.ts`.
4. Read it in the component through the hook. A key missing in one locale is a type error.
5. Check the longest language at 320 px (rule 3).

**Add a section to a page.**

1. Read the page's `type.ts` and one existing section.
2. Place the blocks on the page grid with `col-span-*`; use the `section` padding; start text on the shared left edge, centered on phones.
3. Use the type roles; no raw hex, no inline pixel values.
4. One authored entrance at most (Motion), from an already visible state, with reduced motion honored.
5. Mirror the work into the prerendered shell in `scripts/seo/build-seo.mjs` if the section holds content a crawler should read.
6. Run the checks in section 5 and update [[LANDING-MESSAGING]] if the words changed.

**Add a registry component (`npx shadcn@latest add @cojeev/<name>` or `@bklit/<chart>`).**

1. Run it in the background with `CI=1` and input from `/dev/null`; in a pipe the CLI hangs.
2. Afterwards follow the clean-up list in [[UI-LIBRARIES]] ("After every `npx shadcn@latest add`"): remove the font import and files it brings back, keep `lf-theme.css` as the last import, keep our `cn()`.
3. Re-apply the local patches listed in [[UI-LIBRARIES]] if the CLI overwrote a patched file.
4. Stop and restart the dev server, then look at the component in light and dark.
5. Pass our strings through its props; list any hardcoded library string it carries in [[UI-LIBRARIES]].
6. Audit its accessibility on first use (T-011 covers a real screen reader).

**Adopt a Bencho block.** Follow the procedure and the licence terms in [[UI-LIBRARIES]]: read the block from its Code pane in the Chrome of the computer you are on, put it under `src/components/bencho/` with its notice, switch it to `motion/react`, move its strings to the locale files and its colors to tokens, add keyboard and reduced motion.

**Add or change a color.** Add it to `src/styles/lf-theme.css` for light and dark; choose its label color by measuring contrast on it (section 5); check the pairs it sits next to under color-vision simulation; update the tables in [[RESEARCH-FOUNDATION]] section 9.

**Show a message or a loading state.** A toast is `sileo.<kind>({ title })` with a locale string and never carries a minor's personal data. A page that is loading shows `PageSkeleton` (it is already the Suspense fallback in the shell); work that takes a moment ("the Mentor is thinking") is a `ThinkingOrb` inside a `role="status"` container, named through its `aria-label`.

**Fill a footer link.** Put the address in `src/lib/footerLinks.ts` (T-016); a social mark or legal entry with an address becomes a link on its own.

**Add a page or a feature.** Read "Interaction, motion and page furniture" in [[FRONTEND-GUIDE]] first: the page gets a breadcrumb trail (`Breadcrumbs`), names itself with `usePageTitle`, reveals its blocks with `reveal` from `lib/motionPresets.ts`, and inherits the skeleton, the page transition, back to top and the phone sign-in bar from the shell. Create `src/features/<name>/` with its own `type.ts` or move the shared constants to a common module when the second page needs them; add the route in `App.tsx`; add its entry to the page table in `scripts/seo/site.mjs`; write the feature document from `docs/features/FEATURE-TEMPLATE.md` with the owner first. Routing, state and data are open decisions in [[FRONTEND-GUIDE]].

## 4. Known traps

- The dev server must be restarted after a Vite config change or a Tailwind or shadcn install, or the page renders unstyled.
- `npx shadcn add` rewrites `src/styles/app.css`: brand values still win because `lf-theme.css` uses a more specific selector for the semantic roles; do not move them.
- Registry code does not satisfy `noUncheckedIndexedAccess`; that flag is off for the project.
- `oxlint --fix` also rewrites files you did not touch (the older findings of T-001); revert those so a change stays focused.
- A selector that does not find its target stops a tool with an error instead of passing: the audit tools open the preferences sheet through any button whose text mentions preferences (any of the three languages), so keep that word in the cookie button of every language.
- On Windows, shell here-documents with backticks or quotes inside scripts are fragile: write script files with the editor tool and run them.
- A headless or background browser tab does not run WebGL; the landing's videos are unaffected, but any interactive 3D check needs a visible window.

## 5. The audit tools

Developer tools in `frontend/tools/audit/`, one per check, run from `frontend/` with the dev server up (`npm run dev`) and Chrome installed (set `CHROME_PATH` if it is somewhere unusual). They open the page in headless Chrome over its DevTools protocol, with the theme, language and consent set before it loads (`localStorage` keys `lf-theme` and `i18nextLng`, and the consent cookie `lf_cc`), and print measurements. They are **not a CI gate and not a test suite** (D-010 in [[DECISIONS]]): nothing runs them automatically, and a finding is something to look at. The one dependency they add is `axe-core`, a development dependency. Output files go to `frontend/audit-out/`, which is not tracked.

Every tool takes `--theme light|dark`, `--lang en-US|es-MX|pt-BR`, `--width <px>` (defaults: light, en-US, 1440), `--url`, and `--consent denied|granted|unset` (denied hides the banner; unset shows it). `--matrix` runs 320, 390, 768, 1024 and 1440 px across the three languages, alternating light and dark; add `--themes light,dark` for both everywhere. A tool exits with 1 when it reports anything, so it can be chained in a shell, which is its only use as a check.

| Command | What it checks | Pass |
|---|---|---|
| `npm run audit:a11y` | axe-core (tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, `best-practice`) on the page, with the preferences sheet open and with the language menu open | No violations. With the menu open Radix hides the page, so `aria-hidden-focus`, `landmark-one-main`, `page-has-heading-one` and `region` appear and are not counted |
| `npm run audit:keyboard` | Real key presses: the Tab order, a focus indicator on every stop, every target at least 48 px, the language menu with Enter, ArrowDown and Escape, and the sheet trapping focus and returning it | The skip link is first; no finding |
| `npm run audit:layout` | Rules 2 and 3: horizontal page scroll, ellipsis, line clamp, clipped text, text outside its box or the viewport, on the page, the sheet and the menu | No findings; visually hidden text (boxes of 2 px or less) is skipped |
| `npm run audit:grid` | Rule 2, measured: the container, the left edge of each text block, the space between sections, the gutters, the room for characters per line, and the centers of side-by-side blocks. It scrolls once first so reveal-on-scroll content is in | One gutter; the space between sections within 40 px of each other (scenes trimmed with a negative margin explain the small difference); no left-aligned block inset from its column (list rows and text beside a figure are skipped); body text from 40 to 75 characters of room (checked from 768 px) |
| `npm run audit:scene` | Where the visible scene sits inside each poster in `public/landing` | Information: a poster marked "off center" must be cropped where it is shown (the problem scene is) |
| `npm run audit:color` | On the tokens the page uses, light and dark: the label color each fill needs, text and edge contrast, and the color-vision separation of the fills that sit together ([[RESEARCH-FOUNDATION]] section 9) | Labels at least 4.5:1; text 4.5:1; edges 3:1. Pairs under about 15 in the worst case are listed and need a second channel (icon and word), not a new color |
| `npm run audit:shot` | Full-page screenshots to look at, into `frontend/audit-out/` | Not a check; it is how the page is looked at |
| `npm run audit:onboarding` | Walks the onboarding with the keyboard only and checks every screen (axe-core, focus, target sizes, cut text, sideways scroll, the composition's video); `--walk parent`, `--matrix` for both walks at four widths in the three languages, `--account` to create an account at the end as a child of 9 (needs the whole local stack) | Screenshots in `audit-out/onboarding/` |
| `npm run audit:signin` | Walks the sign-in window end to end in a real browser (choose, email, a wrong code, the right code read from the local mail catcher, an impossible age, the permission box, the account menu, sign out), runs axe-core on each step with the rule set of `audit:a11y`, and saves a screenshot of each step into `frontend/audit-out/signin/`. Takes `--width`, `--lang`, `--theme`, `--age`. Needs the local stack, Core and the dev server running ([[ENVIRONMENT-SETUP]]); it creates one synthetic account per run | Every step reached and no axe violation; then look at the screenshots |

Typical use: `npm run audit:layout -- --matrix`, `npm run audit:a11y -- --matrix`, `npm run audit:keyboard -- --matrix --themes light,dark`, then `npm run audit:grid -- --width 390 --lang es-MX` and `npm run audit:shot -- --width 390` to see it. Run the matrix of a check after a change that could affect it. When a page or a component is added, extend the tool that would otherwise miss it (the sheet and the menu are opened by selectors in `lib.mjs`; the section structure is read from `main > div > section`).

## 6. The render tool

For a scene with the characters (hero, problem, the sign-in window, the 404 page, and the still at the top of the emails: `npm run render:email`, which writes `public/email/v1/` and needs pngquant; the onboarding's loops: `npm run render:onboarding -- --loops` (about an hour for all 22 scenes; `--scene <name>` for one), and without `--loops` a still, with `--draft` to look at it without writing it to `public/`). To look at one character alone, add `--only rho --close` (and `--cam side`) to a `--still` run. `npm run render:signin`, `npm run render:problem` and `npm run render:notfound` render a scene to `public/landing/<scene>/` as an MP4 and a WebP poster for each color mode; `--still 0,3,6` writes PNGs to `audit-out/` to look at first; `--mode` and `--frames` narrow a run. Chrome and Blender are required (`BLENDER` and `CHROME_PATH` name them if they are elsewhere), and the artist models come from `glb/`. Method, rules and the scenes that exist: [[CHARACTER-COMPOSITIONS]]. `npm run render:loading` is the exception in shape: it renders the loading window's runners (12 frames of one stride each, transparent) and builds the AVIF sprite sheets with Python and Pillow 11.3 or later; see "The loading window" in [[FRONTEND-GUIDE]]. Like the audit tools these are run by hand and are not a gate.

## 7. The avatar tools

For the 2D vector avatars ([[CHARACTER-AVATARS]]), in `frontend/tools/avatars/`, run by hand: `npm run avatars:reference` renders each bust from the source model in `glb/` into `audit-out/avatars/<character>/` (`--yaw 0,40,75,-40 --pass lit` gives turned views: look at them before drawing anything); `python tools/avatars/segment.py <Character>` writes a numbered map of its color pieces; the art spec `art/<character>.json` says which pieces or drawn paths make each named part and the `rig` (what moves); `python tools/avatars/parts.py <Character>` builds the SVG and the rig file into `src/features/avatars/assets/` (shipped) and `audit-out` (for comparing); `npm run avatars:compare` lays the avatar next to the reference with an overlay; `npm run avatars:sheet` shows the four together. To see them alive run `npm run dev` and open `/dev/avatars`. Python needs `pip install opencv-python-headless numpy`; the rest needs Chrome.

## Related

- [[FRONTEND-GUIDE]]
- [[UI-LIBRARIES]]
- [[DESIGN-SYSTEM]]
- [[RESEARCH-FOUNDATION]]
- [[LANDING-MESSAGING]]
- [[AI-WORKFLOW]]
- [[TESTING-GUIDE]]
- [[CODE-STYLE-GUIDE]]

Back to [[INDEX]].

## Update this document when

- A skill is installed, removed or changes how it is used.
- A procedure or a known trap changes.
- A check is added, removed or its method or threshold changes.
