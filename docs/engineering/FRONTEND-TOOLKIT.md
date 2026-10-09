---
title: Frontend toolkit
status: draft
updated: 2026-10-09
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

**Show a message or a loading state.** A toast is `sileo.<kind>({ title })` with a locale string and never carries a minor's personal data; a loading state is a `ThinkingOrb` inside a `role="status"` container, named through its `aria-label`.

**Fill a footer link.** Put the address in `src/lib/footerLinks.ts` (T-016); a social mark or legal entry with an address becomes a link on its own.

**Add a page or a feature.** Create `src/features/<name>/` with its own `type.ts` or move the shared constants to a common module when the second page needs them; add the route in `App.tsx`; add its entry to the page table in `scripts/seo/site.mjs`; write the feature document from `docs/features/FEATURE-TEMPLATE.md` with the owner first. Routing, state and data are open decisions in [[FRONTEND-GUIDE]].

## 4. Known traps

- The dev server must be restarted after a Vite config change or a Tailwind or shadcn install, or the page renders unstyled.
- `npx shadcn add` rewrites `src/styles/app.css`: brand values still win because `lf-theme.css` uses a more specific selector for the semantic roles; do not move them.
- Registry code does not satisfy `noUncheckedIndexedAccess`; that flag is off for the project.
- `oxlint --fix` also rewrites files you did not touch (the older findings of T-001); revert those so a change stays focused.
- On Windows, shell here-documents with backticks or quotes inside scripts are fragile: write script files with the editor tool and run them.
- A headless or background browser tab does not run WebGL; the landing's videos are unaffected, but any interactive 3D check needs a visible window.

## 5. How the mechanical checks are run

All run against the dev server (`http://localhost:5173`) in headless Chrome driven over its DevTools protocol (Chrome with `--headless=new --use-angle=swiftshader --enable-unsafe-swiftshader`), with the theme, language and consent set before the page loads: `localStorage` keys `lf-theme` (`light` or `dark`) and `i18nextLng` (`en-US`, `es-MX`, `pt-BR`), and the consent cookie `lf_cc` set to `denied` to hide the banner. The scripts used so far are not in the repository (T-017 asks whether they should be).

| Check | How | Pass |
|---|---|---|
| Accessibility | Inject axe-core (from npm, outside the repo) with the tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` and `best-practice`; run on the page, with the preferences sheet open and with the language menu open | No violations on the page and the sheet. The menu reports `aria-hidden-focus`, `landmark-one-main`, `page-has-heading-one` and `region` only because Radix hides the page while a modal menu is open |
| Keyboard | Send real key events: Tab through the page, Enter and arrows in the menu, Enter to open the sheet, Escape to close | The skip link is first; focus is visible (an outline or ring) on every stop; the sheet traps focus and Escape returns it to the opener; every target is at least 48 px |
| Layout (rules 2 and 3) | At 320, 360, 390, 768, 1024 and 1440 px, in three languages and with the page, the sheet and the menu: flag page-level horizontal scroll, `text-overflow: ellipsis`, `-webkit-line-clamp`, clipped text (`scrollWidth` over `clientWidth` with overflow not visible) and text rectangles outside their box or the viewport | No findings, except visually hidden text such as the skip link and the step labels |
| Measuring (rule 2) | Read the bounding boxes: container and left edge of every text block, gutters between columns, the space between the visible content of consecutive sections, characters per line of each text block, and for each image and text pair their width ratio and vertical and horizontal centers | One left edge; one gutter; equal space between sections; running text between 45 and 75 characters per line; image and text centers within a few pixels |
| Scene framing | Draw each poster to a canvas and find the box of pixels that differ from the page ground | The visible scene is centered in its frame (the hero is at 50 %, the problem scene is cropped to match) |
| Color (rule 5) | WCAG relative luminance for every fill with white and with the ink color, and Machado et al. (2009) protan, deutan and tritan simulation with CIELAB ΔE76 for the pairs that sit together | Labels at least 4.5:1; pairs below about 15 in the worst case never carry meaning by hue alone |

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
