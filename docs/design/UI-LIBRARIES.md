---
title: UI libraries
status: accepted
updated: 2026-10-09
---

# UI libraries

> The seven libraries the LittleFounders interface is built with, what each one is for, how it is installed and wired here, and the rules for using it.

> **Status: accepted** (2026-10-09). The owner decided that these seven libraries are mandatory ([[DECISIONS]] D-007) and approved the roles and wiring below. Items marked **unverified** are still open.

## Role

Names the only building blocks of the interface, so no agent reaches for another component library, writes a hand-made equivalent, or revives the old CSS system. Tokens: [[DESIGN-SYSTEM]]. Code rules: [[FRONTEND-GUIDE]].

## Read this when

- Building or changing anything a person sees.
- Choosing how to animate, notify, chart, change an icon, or show a loading state.
- Adding a dependency to `frontend/`.

## The rule

1. **Use these seven first.** If one covers a need, it is used. A hand-written replacement is a defect.
2. **No other component, chart, toast, animation or icon-morph library** without the owner and a new entry in [[DECISIONS]].
3. **Everything goes through the tokens.** Libraries are themed from `frontend/src/styles/lf-theme.css`; no library default color, radius, font or shadow reaches the screen.
4. **Every motion honors reduced motion, and every string is a locale key.**
5. **Nothing calls a third-party host at runtime.** All seven run from our bundle; children's data never goes to a library's service.

## The libraries

| Library | Role | Arrives as | Where it is used now |
|---|---|---|---|
| Motion | All animation | npm `motion`, import from `motion/react` | Hero and section reveals, the cookie banner, `MotionConfig reducedMotion="user"` in `App.tsx`; Cojeev and Bklit are built on it |
| 000h by Cojeev | General components | shadcn registry `@cojeev` | Button, Sheet, Dropdown menu, Badge, Alert (`src/components/ui/`) |
| Bklit UI | Charts | shadcn registry `@bklit` | Ring chart for the "4 in 10" figure (`src/components/charts/`) |
| Sileo | Toasts | npm `sileo` + `sileo/styles.css` | Cookie choice confirmation; `<Toaster>` in `App.tsx` |
| Morphicons | Icons that change state | npm `morphicons` + `lucide` icon data | Sun/moon theme toggle |
| Thinking Orbs | Loading | npm `thinking-orbs` | Page-loading fallback in `App.tsx` |
| Bencho | Interaction blocks to copy | Copied from the site | None yet (see below) |

## How it is wired

- **Stack:** React 19, Tailwind CSS v4 (`@tailwindcss/vite`), shadcn config in `frontend/components.json` with the registries `@bklit` and `@cojeev`. The old hand-written design system (`src/rebuild/`) is deleted.
- **One stylesheet entry:** `src/styles/app.css` imports Tailwind, `lf-fonts.css`, Cojeev's CSS and, last, `lf-theme.css`. `main.tsx` imports it and `sileo/styles.css`.
- **Tokens:** Cojeev's components read `--v-*` variables, shadcn and Bklit read `--primary`, `--background`, `--chart-1..5` and friends. `lf-theme.css` re-points all of them at the LittleFounders palette (indigo primary, orange call to action, sky, gold, mint) in light and dark, and sets 48/56/64/72 px control heights for children. Cojeev's slots keep their names but hold our hues (`--v-pink` is our orange).
- **Theme switch:** `ThemeProvider` sets both `html.dark` and `html[data-mode]`; the inline boot script in `index.html` does the same before first paint. Cojeev reads `data-mode`, Tailwind's `dark:` and Thinking Orbs read the class.
- **Typeface:** Plus Jakarta Sans, self-hosted. Cojeev's DM Sans and Bricolage Grotesque (410 KB of inline base64) are not used and are removed.
- **Vendored code:** what the registries copy into `src/components/ui/`, `src/components/charts/`, `src/lib/cojeev/` and `src/lib/cojeev-motion/` is theirs. It is excluded from ESLint and `lint:slop`, and `noUncheckedIndexedAccess` is off in `tsconfig.json` because their code does not satisfy it. Our own files are linted.

### After every `npx shadcn@latest add ...`

The CLI rewrites files that are ours. Always check, then fix, before committing:

1. `src/styles/app.css`: it re-adds the `cojeev-fonts.css` import and appends the new component's CSS imports. Remove the fonts import and keep `lf-theme.css` as the last import. It also rewrites a `:root, :root[data-mode]` block; `lf-theme.css` beats it with `html:root[data-mode]`, so do not move the brand variables.
2. It re-creates `src/scripts/cojeev-materialize-fonts.mjs`, `src/styles/cojeev-fonts.css` and `src/styles/fonts/`: delete them.
3. It overwrites `src/lib/utils.ts` with an equivalent `cn()`; keep it.
4. Run `type-check`, `build`, and look at the page in light and dark.
5. Run it in the background with `CI=1` and input from `/dev/null`; in a pipe it hangs.

## Per library

### Motion
`motion/react`: `motion.*`, `AnimatePresence`, `useScroll`, `layout`, `variants` with `stagger`, springs. `MotionConfig reducedMotion="user"` at the root removes transform and layout animation and keeps opacity; use `useReducedMotion()` for custom cases. Motion+ (paid) is not used. Rule: no hand-written CSS keyframes or timers for animation Motion can express.

### 000h by Cojeev
Default source for any component that is not a chart, toast, icon morph or loader (172 components; its own chart and toast components are not used because Bklit and Sileo own those). Install with `npx shadcn@latest add @cojeev/<name>`. Variants are props (`<Button variant="accent" size="lg">`). The CTA is `accent`; secondary is `outline`. MIT, keep the notices in `src/lib/cojeev/NOTICES.txt`. Its components bring a lot of CSS and a lazy icon data chunk (about 354 KB), tracked as T-010. **Unverified:** accessibility of each component; audit on first use.

### Bklit UI
`npx shadcn@latest add @bklit/<chart>`; depends on `@visx/*` and `@number-flow/react`. Themed by `--chart-*` variables from `lf-theme.css`. SVG `fill` attributes cannot hold `var()` from a stylesheet reliably, so pass colors as the library expects (`<Ring color="var(--primary)" />` works). Candlestick, profit/loss and live-line charts exist; a child-facing product must not show real-money framing ([[CHILD-SAFETY-AND-PRIVACY]]). A chart always has a text alternative, a color-independent encoding and an empty state.

### Sileo
`import { sileo, Toaster } from 'sileo'` and `import 'sileo/styles.css'` (confirmed required). `sileo.success|error|warning|info|promise`, options `title`, `description`, `position`, `duration`, `icon`, `fill`, `styles`. `title` and `description` are locale strings; a toast never carries a minor's personal data and never is the only place a message appears. Verified from the package: it honors `prefers-reduced-motion` (animation and transition durations go to zero) and announces with `aria-live="polite"`. It depends on its own `motion`; `package.json` carries an `overrides` entry (`sileo.motion = $motion`) so it shares ours instead of bundling a second copy (this cut the entry chunk by 127 KB). Its stylesheet is injected after ours, so the state colors are set on its viewport element in `lf-theme.css`; the toast is drawn as the opposite surface of the page (`ThemedToaster` in `App.tsx`).

### Morphicons
`MorphIcon` from `morphicons/react`, icon data from `lucide` (not `lucide-react`): `<MorphIcon icon={dark ? Sun : Moon} reducedMotion="user" />`. Stroke icon sets only; one icon set for the whole product; always `reducedMotion="user"`; icons are `aria-hidden` unless a `label` is given.

### Thinking Orbs
`<ThinkingOrb state="working" size={64} />`; states `working searching solving listening connecting weaving composing breathing shaping`; sizes 64, 32, 20; props `speed`, `paused`, `theme` (`auto` default, follows the `dark` class; the documentation page says a `dark` boolean, the installed version 0.3.2 has `theme`). MIT. Rule: the surrounding element carries the status text (`role="status"`); `paused` when motion is reduced.

### Bencho
48+ interaction blocks (one-time code, slide to confirm, upload dropzone, progress, dock, particles and more).

**Licence** (read on 2026-10-09 at `bencho.dev/license`): the blocks are MIT, free for commercial use, no attribution on the interface; keep the copyright notice (`Copyright (c) 2026 Lorenzo Cabra`) with substantial copies. Not covered: the site, the name and goat mark, and the photographs inside some blocks (swap in our own art). Every dependency keeps its own licence.

**How to get a block's source.** Open `https://bencho.dev/blocks/<name>` (names are in the links on the home page, for example `one-time-code`, `confirm`, `progress`, `upload-dropzone`, `dock`, `particles`). The `<>` tab at the top left of the block's panel is the Code pane, with four collapsible sections: **Install** (the npm packages the block needs, for example `lucide-react`), **Usage**, **Code** (`tsx` and `css` tabs, each with a copy button) and **How it works**; a **Copy prompt** button hands the block to an AI assistant. The pane is readable without an account (verified 2026-10-09 in a Chrome that was not signed in; whether the copy buttons need one was not tested). The right-hand panel has the block's tunable parameters.

**Reading it with the browser tools.** Use the Chrome on the computer the agent is running on, never another connected one: check the machine first (`list_connected_browsers` marks the local one, and PowerShell's `$env:COMPUTERNAME` says which computer this is; the development machine is the Windows MSI laptop, and a Mac is also connected to the account). The owner signs in to Bencho with Google in their own Chrome and has authorised the agent to use that session at Bencho; the agent does not sign in, create accounts or approve sign-in screens itself. The page text tool does not see the Code pane: expand the section and read it from a screenshot or the accessibility tree, or have the owner press the copy button and paste.

**Rules when a block is adopted.** Put it under `src/components/bencho/` with its notice and URL in a header comment; import `motion/react` (blocks use `framer-motion`) and replace `lucide-react` with `lucide` icon data through Morphicons where an icon changes state; take strings from the locale files and colors from the tokens; add keyboard and reduced-motion behavior; swap photographs for our own art. Sounds are off by default. No block is adopted yet; they are brought in one at a time as screens need them (T-009).

## Which library for which need

| Need | Use |
|---|---|
| Any animation, transition, scroll or gesture | Motion |
| Button, sheet, menu, badge, alert, any general component | Cojeev |
| A rich interaction Cojeev lacks (OTP, slide to confirm, dropzone) | Bencho block, adapted |
| Chart, gauge, ring, heatmap | Bklit UI |
| A message that fades | Sileo |
| An icon that changes state | Morphicons |
| Loading, "the Mentor is thinking" | Thinking Orbs |
| A 3D character | Not here; see [[DESIGN-SYSTEM]] |

## Related

- [[DESIGN-SYSTEM]]
- [[FRONTEND-GUIDE]]
- [[DECISIONS]]
- [[BUILD-TASKS]]
- [[CODE-STYLE-GUIDE]]
- [[CHILD-SAFETY-AND-PRIVACY]]
- [[PERFORMANCE-AND-SCALING]]

Back to [[INDEX]].

## Update this document when

- The owner adds, removes or replaces a library.
- A library is installed or upgraded, or an **unverified** item is confirmed.
- A usage rule changes.
