---
name: LittleFounders Tactile
colors:
  # ── Surfaces (light) ──
  base: "#f7f9fb"                # page background
  surface: "#ffffff"             # cards, raised clay elements
  surface-sunken: "#eceef0"      # wells, equation boxes, sunken inputs
  # ── Content (light) ──
  content: "#191c1e"             # default text
  content-muted: "#464555"       # secondary text, descriptions
  content-faint: "#777587"       # captions, placeholders, disabled
  outline: "#c7c4d8"             # hairline borders (rare — shadows do the work)
  # ── Brand ──
  primary: "#3525cd"             # deep indigo — the ONE main action color
  primary-strong: "#241795"      # pressed state + chunky button bottom edge
  primary-soft: "#e2dfff"        # icon chips, active-nav pill, hint cards (light)
  on-primary: "#ffffff"
  secondary: "#0051d5"           # warm blue — links, secondary emphasis
  secondary-soft: "#dbe1ff"
  on-secondary: "#ffffff"
  accent: "#a44100"              # warm orange — streaks, energy, tertiary chips
  accent-soft: "#ffdbcc"
  on-accent: "#ffffff"
  # ── Semantic ──
  success: "#1a7f37"
  success-soft: "#d3f3dd"
  warning: "#b45309"
  warning-soft: "#fdeecd"
  error: "#ba1a1a"
  error-soft: "#ffdad6"
  # ── Surfaces & content (dark) ──
  dark-base: "#0f172a"
  dark-surface: "#1e293b"
  dark-surface-sunken: "#16203a"
  dark-content: "#eff1f3"
  dark-content-muted: "#b6b9c8"
  dark-content-faint: "#8a8a9d"
  dark-outline: "#3a3f58"
  dark-primary: "#8f88ff"        # brightened indigo for AA contrast on dark
  dark-primary-strong: "#6a5fff"
  dark-primary-soft: "#2b2758"
  dark-on-primary: "#0f0069"
  dark-secondary: "#8ab4ff"      # brightened warm blue — links stay readable on dark surfaces
  dark-secondary-soft: "#22335e"
  dark-on-secondary: "#001a4d"
typography:
  display-xl:                    # hero page titles (landing "Learn by Playing")
    fontFamily: Quicksand
    fontSize: 48px
    fontWeight: "700"
    lineHeight: 56px
    letterSpacing: -0.02em
  display-lg:                    # page titles ("Solving Quadratic Equations"), big stat numbers
    fontFamily: Quicksand
    fontSize: 32px
    fontWeight: "700"
    lineHeight: 40px
    letterSpacing: -0.01em
  headline:                      # section headings ("Continue Learning", "Daily Quests")
    fontFamily: Quicksand
    fontSize: 24px
    fontWeight: "600"
    lineHeight: 32px
  title:                         # card titles ("Algebra II"), nav items
    fontFamily: Quicksand
    fontSize: 18px
    fontWeight: "600"
    lineHeight: 26px
  body-lg:                       # lesson prose, landing subtitles
    fontFamily: Nunito Sans
    fontSize: 18px
    fontWeight: "400"
    lineHeight: 28px
  body:                          # default UI text, card descriptions
    fontFamily: Nunito Sans
    fontSize: 16px
    fontWeight: "400"
    lineHeight: 24px
  label:                         # buttons, badges, form labels, progress labels
    fontFamily: Nunito Sans
    fontSize: 14px
    fontWeight: "700"
    lineHeight: 20px
  caption:                       # footnotes, timestamps, helper text
    fontFamily: Nunito Sans
    fontSize: 12px
    fontWeight: "400"
    lineHeight: 16px
rounded:
  sm: 8px                        # tiny chips, tags
  md: 16px                       # buttons, inputs, small widgets (BASE radius)
  lg: 24px                       # standard cards
  xl: 32px                       # hero cards, lesson canvases, modals
  full: 9999px                   # pills: progress bars, nav pills, badges
spacing:
  unit: 8px
  card-padding: 24px             # minimum inside clay cards (32px on xl cards)
  gutter: 24px
  margin-mobile: 16px
  container-max: 1280px
  sidebar-width: 280px
breakpoints:
  mobile: 0px                    # <768px — single column, bottom nav, NON-NEGOTIABLE target
  tablet: 768px                  # 768–1023px — interpolation, not a separate design pass
  desktop: 1024px                # >=1024px — sidebar + multi-column, NON-NEGOTIABLE target
shadows:
  clay: "16px 16px 32px rgba(53,37,205,0.06), inset 4px 4px 8px rgba(255,255,255,1), inset -6px -6px 12px rgba(0,0,0,0.04)"
  clay-sm: "6px 6px 12px rgba(53,37,205,0.08), inset 2px 2px 4px rgba(255,255,255,0.9), inset -3px -3px 6px rgba(0,0,0,0.04)"
  clay-pressed: "2px 2px 6px rgba(53,37,205,0.10), inset 4px 4px 8px rgba(0,0,0,0.12), inset -2px -2px 4px rgba(255,255,255,0.2)"
  clay-sunken: "inset 4px 4px 8px rgba(0,0,0,0.08), inset -4px -4px 8px rgba(255,255,255,0.9)"
  clay-dark: "16px 16px 32px rgba(0,0,0,0.35), inset 4px 4px 8px rgba(255,255,255,0.05), inset -6px -6px 12px rgba(0,0,0,0.35)"
  clay-sm-dark: "6px 6px 12px rgba(0,0,0,0.30), inset 2px 2px 4px rgba(255,255,255,0.04), inset -3px -3px 6px rgba(0,0,0,0.30)"
  clay-pressed-dark: "2px 2px 6px rgba(0,0,0,0.35), inset 4px 4px 8px rgba(0,0,0,0.45), inset -2px -2px 4px rgba(255,255,255,0.03)"
  clay-sunken-dark: "inset 4px 4px 8px rgba(0,0,0,0.45), inset -4px -4px 8px rgba(255,255,255,0.03)"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: 12px 24px
  button-primary-pressed:
    backgroundColor: "{colors.primary-strong}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: 12px 24px
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "{spacing.card-padding}"
  card-hero:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: 32px
  stat-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: 24px
  icon-chip:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    size: 48px
  input:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.content}"
    rounded: "{rounded.md}"
    padding: 12px 16px
  progress-track:
    backgroundColor: "{colors.surface-sunken}"
    rounded: "{rounded.full}"
    height: 8px
  progress-fill:
    backgroundColor: "{colors.primary}"
    rounded: "{rounded.full}"
  badge:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.content-muted}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: 4px 12px
  nav-pill-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: 12px 16px
---

# DESIGN.md — LittleFounders Tactile Design System

> **AUTHORITATIVE** for all frontend visual work (authority: /AGENTS.md §1.1 #4). Derived from the approved mockup in `template/` (7 screens). Implementation lives in `frontend/tailwind.config.js` + `frontend/src/index.css` — those files map 1:1 to the tokens above and must never contain values that aren't here.

## §0 Composition fidelity — THE PRIME RULE

**When a screen in `template/` covers what you're building, you REPLICATE its composition — you do not invent an alternative layout.** The mockup's `code.html` + `screen.png` govern structure, section order, rhythm, component shapes, and interaction treatments; this file's tokens govern the exact values (colors, sizes, shadows). Build order for any mockup-covered surface:

1. Open the matching `template/<screen>/code.html` and `screen.png`. Study both.
2. Reproduce the composition section by section with our tokens and UI kit.
3. Adapt only CONTENT (copy, real product features, honest claims — e.g., no fabricated trust logos), never the visual recipe.
4. If a mockup treatment conflicts with a rule in this file, **the mockup wins** — amend this file in the same commit, don't silently deviate.

Deviating from an existing mockup screen without explicit human sign-off is a design bug, no matter how good the alternative looks.

**Deprecation path for `template/`:** every mockup screen is distilled into §Screen Recipes below, in our token vocabulary. Build new surfaces from the RECIPE first; open the raw mockup only if a recipe feels ambiguous — and when it does, fix the recipe in the same commit. Once all recipes have shipped (or been deliberately superseded with sign-off), `template/` gets deleted and this file becomes the sole design authority.

## Overview

**Reference: the mockup in `template/` — think Brilliant.org's minimalism molded in soft clay.** The system is *Tactile Gamification*: a claymorphic aesthetic that makes learning feel physical, toy-like, and safe, while staying ruthlessly minimalist. Every screen has generous whitespace, a single dominant action, and at most a handful of soft "clay" surfaces floating on a near-white base.

Minimalism and gamification are not in tension here — the discipline is: **simple elements, zero noise, high reward**. Gamification lives in the *content* (XP, streaks, quests, progress) and in *micro-physics* (press compression, lift on hover), never in visual clutter. If a screen needs decoration to feel fun, it's wrong; if a tap doesn't feel squishy, it's also wrong.

Audience: kids under parental control plus their parents. The UI must evoke optimism, playfulness, and safety — readable at kid sizes, calm at parent sizes.

## Colors

**Everything is a token. Raw hex values outside this file are prohibited.**

- **`base`** — the page. Near-white cool gray that lets clay shadows breathe. Never place text directly on saturated color fields other than `primary`/`secondary` buttons.
- **`surface`** — pure white cards. The workhorse. All content lives on `surface` islands over `base`.
- **`surface-sunken`** — wells: equation boxes, inputs, progress tracks, empty drop zones. Concave counterpart to raised cards.
- **`primary` (deep indigo)** — THE action color. Primary buttons, active nav, progress fills, links in nav context. One primary action per view. `primary-strong` is the pressed shade and the "chunky" bottom edge of buttons. `primary-soft` backs icon chips and hint cards.
- **`secondary` (warm blue)** — inline links, secondary emphasis (e.g., "Resume Lesson" on an already-primary screen), highlighted lesson variables. Never for the main CTA when `primary` is present.
- **`accent` (warm orange)** — the energy color: streaks, flames, celebration chips. Sparingly — one accent element per card maximum.
- **Semantic** — `success`/`warning`/`error` (+ their `-soft` fills) are reserved for feedback: correct/incorrect answers, quest completion, destructive confirmations. Never decorative.
- **Dark mode** — `dark-*` tokens swap in via the `.dark` class. Deep navy base, slate surfaces; `dark-primary` is a brightened indigo (AA on dark). Clay highlights switch from white to low-opacity light (see Elevation) — never harsh glare.

Contrast floor: WCAG 2.1 AA in both modes; kid-facing body text targets AAA where feasible.

## Typography

Two families, loaded via Google Fonts (`Quicksand` 600/700, `Nunito Sans` 400/700), fallback `system-ui`:

- **Quicksand** — everything structural: `display-xl` (hero), `display-lg` (page titles + big stat numbers), `headline` (section headings), `title` (card titles, nav). Its rounded terminals mirror the clay radii.
- **Nunito Sans** — everything read: `body-lg` (lesson prose), `body` (default), `label` (buttons/badges/forms), `caption` (footnotes).

Rules:
- The scale above is **closed**. Composing ad-hoc sizes with Tailwind utilities (`text-[17px]`, `text-sm font-semibold` as a pseudo-title…) is prohibited — use `text-display-xl` … `text-caption` utilities only.
- Headings get `text-balance`; body/prose gets `text-pretty`; dynamic numbers (XP, streaks, %) get `tabular-nums`.
- Key lesson terms may be bolded and colored with `secondary` or `accent` to aid memorization — at most a couple per paragraph.
- Locale tolerance: es-MX/pt-BR run ~35% longer than en-US; components must wrap, never truncate meaning.

## Layout

- **Mobile-first.** Base classes target mobile; `md:`/`lg:` add up. Breakpoints: <768 mobile (sidebar collapses to bottom nav), 768–1024 tablet, >1024 desktop.
- **8px rhythm.** All spacing in multiples of the 8px unit. Card padding ≥24px (32px on `xl` cards) — clay's thick inner shadows squeeze content, so err generous.
- **Container max 1280px**, gutter 24px, mobile margin 16px.
- **App shell:** fixed 280px left sidebar on desktop (profile block on top, nav pills, streak widget pinned bottom); content area on `base`. Marketing/landing pages are single-column, centered, airy.
- Density: one idea per card, one section heading per screen region. When in doubt, remove.

### Responsive Adaptation — NON-NEGOTIABLE

The platform **MUST** render correctly and feel intentional on both **Desktop (≥1024px)** and **Mobile (<768px)**. This is a product requirement, not a styling preference — see `/AGENTS.md` §1.11, which gives it the same weight as a schema invariant. It cannot be relaxed by a task description that doesn't mention it.

- **Breakpoints** (tokens above): mobile <768px, tablet 768–1023px (the interpolation — never its own design pass), desktop ≥1024px.
- **Space discipline, not identical layouts.** Mobile is single-column, full-bleed within `margin-mobile`, sidebar collapsed to a bottom nav. Desktop deliberately uses the freed width — multi-column grids, the fixed 280px sidebar, multi-card rows — inside `container-max`, centered.
  - ❌ **Wrong:** a desktop view that is the mobile column simply stretched wide, with dead whitespace on both sides.
  - ❌ **Wrong:** a mobile view that crams desktop density (multi-column grids, the full sidebar) into a 375px viewport.
  - ✅ **Right:** each breakpoint re-composes the same content to fit how much space it actually has.
- **No fixed pixel widths for layout structure** outside `container-max` / `sidebar-width`. Everything else reflows: `%`, `flex`, `grid`, `min()`/`max()`/`clamp()`.
- **No hover-only affordances.** Anything revealed on hover needs a tap-accessible equivalent — mobile has no hover.
- **Verification is mandatory, not implied.** No frontend change is "done" until checked in the browser preview at ~375px (mobile) AND ~1280px (desktop) — screenshot both, every time, however small the change looks. A component checked at only one breakpoint has not been verified.

## Elevation & Depth

Flat elevation is replaced by the **three-layer clay system** — exactly four shadow tokens per mode, no others:

| Token | Use |
|---|---|
| `clay` | Standard raised card (outer indigo-tinted glow + white top-left inset + dark bottom-right inset) |
| `clay-sm` | Small widgets, chips, secondary buttons |
| `clay-pressed` | Active/pressed state: outer shadow shrinks, insets deepen — physical compression |
| `clay-sunken` | Inputs, wells, tracks: no outer shadow, inverted insets |

Dark mode uses the `-dark` variants (white insets drop to ≤5% opacity; outer shadow deepens). Interaction physics: hover = lift (`clay-sm`→`clay`, `translate-y` −2px); press = `clay-pressed` + `translate-y` +2px + `scale(0.98)`. Transitions animate `transform`, `box-shadow`, `background-color` only — never `transition: all`. `prefers-reduced-motion` disables lifts and compressions (state changes remain instant).

## Motion

Motion makes the clay feel physical and navigation feel organic — it is a **closed system** like the type scale. Tokens (implemented as CSS vars in `frontend/src/index.css`):

| Token | Value | Use |
|---|---|---|
| `--lf-ease` | `cubic-bezier(0.22, 1, 0.36, 1)` | THE easing ("clay ease-out") — every transition/animation uses it |
| `--lf-dur-fast` | 150ms | Pop-ins (dropdown panels, menus), color/hover feedback |
| `--lf-dur-base` | 200ms | Button press/lift physics, icon nudges |
| `--lf-dur-slow` | 300ms | Card hover scale |
| `--lf-dur-page` | 350ms | Route transitions |
| `--lf-dur-reveal` | 550ms | Scroll reveals |

The five motion recipes — **use these, don't invent new ones**:

1. **Page transition** (`.lf-page-enter`) — `<main>` is keyed by `location.pathname`; on route change the new page fades in and rises 12px. Applied once at the layout level, never per-page.
2. **Scroll reveal** (`<Reveal>` / `.lf-reveal`) — below-the-fold sections rise 20px + fade as they enter the viewport (IntersectionObserver, fires once). Grids stagger children with `delay` — **≤3 steps of 80ms**; longer chains feel like waiting, not delight. Above-the-fold content never uses reveal (the page transition covers it).
3. **Pop-in** (`.lf-pop`) — floating panels (Dropdown list, mobile menu): scale 0.96→1 + fade, 150ms, transform-origin at the trigger corner.
4. **Press physics** — Button/nav: hover `scale(1.02)` or lift; press `translate-y` + bottom-border collapse + `clay-pressed` (see Elevation).
5. **Icon nudge** — an icon inside a hovered CTA may translate ≤4px in its pointing direction (`motion-safe:group-hover:translate-x-1`); arrows only.

Ambient motion: `.lf-float` (hero illustration soft bounce) is the ONLY infinite animation permitted; anything looping elsewhere needs human sign-off.

Hard rules: everything above is disabled or instant under `prefers-reduced-motion` (already wired in `index.css`). Never animate layout properties (`width/height/top/left/margin`). Never `transition: all`. `::selection` uses `primary-soft`/`primary-strong`; `scroll-behavior: smooth` (auto under reduced motion).

## Shapes

**Hyper-rounded. Sharp corners are prohibited** — they break the clay metaphor.

- `md` **16px** is the base radius (buttons, inputs, icon chips).
- `lg` **24px** for standard cards; `xl` **32px** for hero cards, lesson canvases, modals.
- **Pill (`full`)** for progress bars, badges, chips, toggles, and round icon buttons. **Buttons are NOT pills** — they use `rounded-md` chunky blocks (see Components; corrected 2026-07-11 to match the mockup code).
- Nested elements use concentric radius: inner radius = outer radius − gap.

## Components

The reusable kit lives in `frontend/src/components/ui/`. **Build with these; do not restyle per-view.**

- **Button (primary)** — chunky block, **`rounded-md` (16px), NOT a pill** (mockup: `clay-button-primary`): `primary` fill, `label` type, **4px bottom border in `primary-strong`**. Hover: `scale(1.02)`. Press: `translate-y(4px)` + bottom border collapses to 0 + inset shadow — the physical "push". Generous padding (`px-8 py-4` on CTAs). Secondary variant: `surface` fill, `primary` text, 4px bottom border in `surface-sunken`. Minimum hit area 44×44px. Buttons may carry a Material Symbol beside the label.
- **Card** — `surface` + `clay` + **1px white border** (`border-white`, dark: `white/10` — part of the clay illusion, the one border exception) + `rounded-lg` + ≥24px padding. Hero/lesson variant: `rounded-xl`, 32px padding. Feature-card hover: `scale(1.02)`.
- **FeatureCard** (landing/marketing grids) — clay card, 56×56px icon tile (`rounded-lg`) filled with a rotating `-soft` tone, filled Material Symbol inside, `headline`-adjacent title, `body` copy in `content-muted`. 3-col desktop / 1-col mobile.
- **Hero recipe** (landing, from the mockup): badge pill (clay surface, `secondary` text, star symbol) → `display-xl` headline where the second line is **gradient text `from-primary to-secondary`** (the ONE permitted gradient) → `body-lg` subtitle → primary CTA with arrow + secondary CTA with play symbol → illustration floating free (no card frame): soft-bounce animation + `primary/5` radial blur glow + drop shadow. Bounce disabled under `prefers-reduced-motion`.
- **StatCard** — square-ish card: icon chip top, `display-lg` number (`tabular-nums`), `caption` label. Icon chip color rotates `primary-soft`/`accent-soft`/`secondary-soft` by stat kind (XP=primary, streak=accent, accuracy=secondary).
- **IconChip** — 48px `rounded-md` square, `-soft` fill, solid-color icon. The only place decorative color is allowed.
- **ProgressBar** — pill track in `surface-sunken`, fill in `primary` (or `accent` for streak-quests). Always paired with a `label` value.
- **Input** — sunken: `surface-sunken` + `clay-sunken`, `rounded-md`, no outer shadow. Focus: 2px `primary` ring (visible, never removed).
- **Badge** — pill, `surface-sunken` fill, `caption` type ("Intermediate", "Beginner").
- **Sidebar nav item** — pill row: inactive = transparent + `content-muted`; active = `primary` fill + `on-primary` + `clay-sm`.
- **QuestItem** — row: icon chip + `title` + thin progress pill + status icon.
- **HintCard** — `primary-soft` fill (`dark-primary-soft` in dark), `rounded-lg`, `secondary`-tinted text; for lesson hints only.
- **Characters** — Dina, Dino, Dr. Rho, Zara Vex (`frontend/src/components/characters/`) are the canonical mascots; avatars are DiceBear `avataaars`. Characters appear on `surface` cards, never floating on raw `base`.
- **Dropdown** — our own listbox, **never a native `<select>`/browser-default picker**: clay-sunken trigger (icon/flag + label + chevron) → clay floating panel (`surface`, white border, `rounded-md`) on open, options highlight `surface-sunken` on hover and `primary-soft`/`primary` when selected. Closes on outside click, Escape, or selection. Used for the language switcher: each option is a country flag (see exception below) + the language's name **localized into the current UI language** (e.g. under es-MX: "🇺🇸 Inglés"), never a raw locale code like `es-MX`.
- **ThemeToggle** — 3-way segmented pill (`auto` / `light` / `dark`), `surface-sunken` track, active segment gets `primary` fill + `clay-sm`. Icons: `brightness_auto`, `light_mode`, `dark_mode`. `auto` follows the OS scheme live (listens for `prefers-color-scheme` changes) and is the default until the user picks explicitly.

## Screen Recipes

> The permanent distillation of the 7 approved mockup screens. Vocabulary is OURS (tokens above, kit components); the mockup's Material-style names are translated (`primary-fixed`→`primary-soft`, `surface-container-*`→`surface-sunken`, `tertiary`→`accent`, `rounded-2xl/3xl`→`rounded-lg/xl`). **These recipes — not `template/` — are the build reference.** When every recipe here has shipped or been superseded, `template/` may be deleted (human sign-off; see §0).

### Recurring patterns (define once, reuse everywhere)

- **App sidebar** — fixed `sidebar-width` (280px) on desktop, `surface` raised: avatar/brand block (clay avatar 80px `rounded-lg` + name + "Level N" subtitle) → XP ProgressBar (`h-3`) → nav items (active = `primary` fill + `on-primary` + pressed inset; inactive = `content-muted`, hover `surface-sunken` + `scale(1.02)`) → `mt-auto` footer: streak StatCard-row + settings. **Mobile: collapses to a sticky top bar (logo + status icons + avatar) and a fixed bottom nav (4–5 icon+label items)**; profile/store screens raise the center item into a floating `primary` circle (notched nav).
- **Icon tile** — IconChip (48/56px, `-soft` fill + role-colored filled symbol). Gradient medallion variant (`bg-gradient-to-br` role→role, white symbol, `group-hover:scale-110`) reserved for game/course covers only.
- **Stat card** — vertical (icon tile → `display-lg` `lf-number` → `caption` label) or horizontal (tile left, label+value right; profile bar).
- **Progress bar** — sunken pill track + role fill; heights by prominence: `h-1.5` (lesson header) / `h-2` (quest rows) / `h-3` (sidebar XP) / `h-4` (course cards, inset-padded).
- **Pills** — filters/tabs: horizontal-scroll row, active = `primary` clay, inactive = `surface-sunken`; status badges (NEW/POPULAR/FEATURED) = small `error`/`secondary`/`accent` pills on card corners.
- **Sunken well** — `surface-sunken` + `clay-sunken`: inputs, search bars, drop zones, reward tiles, slider tracks, equation boxes.

### 1. Dashboard (app home)

Sidebar + content (`container-max`, `space-y-8`): greeting (`display-lg` in `primary` + `body` subtitle) → stats grid (2-col mobile / 4-col desktop; XP=primary, lessons=secondary, streak=accent, accuracy=secondary tones) → split `lg:2/3 + 1/3`: **Continue Learning** (course cards: icon tile + difficulty Badge → `title` + subtitle → progress row + `h-4` bar → full-width Button, `primary` "Resume" / secondary "Start") beside **Daily Quests** card (rows: icon tile + `title` over `h-2` mini-bar + trailing check/counter; hover `surface-sunken`).

### 2. Lesson interface

No sidebar — focused `flex-col`: sticky top header (back + breadcrumb + **step dots**: done=solid `primary`, current=ringed larger, upcoming=sunken + `h-1.5` progress bar) → content (`lg:8/4` split): main clay card with interactive canvas (grid-lined area, draggable elements, floating hint chip) + equation well + inline input (`clay-sunken` box + `primary` Check button); second card for drag-drop steps (dashed sunken drop zones + draggable chip buttons `cursor-grab`) → aside **HintCard** → sticky footer: secondary "Previous" / primary "Continue". Completion modal: backdrop blur, clay card, trophy medallion, 2-col reward wells (XP/coins/streak), full-width primary CTA.

### 3. Games hub

Sidebar + content: page header → filter pills row → `lg:2/3` **featured game** bento (large `rounded-xl` card, blurred color blobs behind, gradient medallion, FEATURED pill, `check_circle` bullet list, role-gradient CTA) + game-card grid (centered: corner status pill, 80px gradient medallion `group-hover:scale-110`, `title` + `body`, bottom Button) + `1/3` **Leaderboard** card (ranked rows: rank + avatar + name/XP + trend icon; top row sunken highlight; "You" row `primary/5` + `primary` border).

### 4. Profile

Sidebar + content: **profile hero** (`rounded-xl` card: cover gradient band `primary→secondary→accent` with radial glows → overlapping `-mt-16` row: 128–160px clay avatar circle + "Lvl N" corner badge, `display-xl` name + handle/joined meta, secondary "Edit Profile") → horizontal stat bar (4 stat cards) → underline tab bar (active = `primary` text + 4px `primary` bottom border) → bento: `2/3` Current Focus (course mini-cards) + Recent Activity timeline (central gradient spine, role-colored nodes, zig-zag on desktop) · `1/3` Top Badges (circular tiles, `group-hover:scale-110`) + Friends list (avatar rows, online dot / grayscale offline).

### 5. Course catalog

Sidebar + content + right filter rail (`w-72`, sticky, desktop-only): header + clay search bar → category pills → course grid (1/2/3-col): **course card** = pastel gradient thumbnail band (`h-32`, white circle medallion, difficulty pill) → `title` (hover→`primary`) + 2-line clamped `body` → instructor row (avatar, name, ★ rating, students) → footer over hairline: price (`primary` bold + struck original) + Enroll Button; card hover `-translate-y-1`. Filter rail: checkbox group (20px `rounded-sm`, checked = `primary` fill + check), sunken price slider (`primary` fill + white knob), rating pills.

### 6. Assessment / quiz

Chrome suppressed — centered `max-w-[800px]`, vertically centered: status row (clay timer tile with live mm:ss + "Question N of M" `headline`) → **stepper dots** (16px: answered=`primary-soft`, current=`primary` + `scale-1.2` glow, flagged=`accent-soft`, rest sunken; clickable) → question card (`p-8/12`, blurred `primary-soft` corner blob, `display-lg` question with color-coded terms, corner flag button) → **options grid** (1/2-col option cards: raised clay, hover `-translate-y-2`; selected = `primary-soft` fill + `primary` border + pressed inset + trailing `check_circle`; letter badge circle) → footer: secondary Previous / primary Next.

### 7. Landing (marketing)

Shipped — see `frontend/src/routes/marketing/` (the living reference): sticky h-20 header (trimmed logo, plain nav links, Dropdown + ThemeToggle + chunky CTA) → hero (two-line headline w/ gradient second line, icon CTAs, floating illustration + glow) → problem/solution cards → 6-feature grid → fact band → motivation split → final CTA card → white bordered footer (legal + contact).

## Do's and Don'ts

**Do**
- Use tokens for every color, radius, shadow, and type style — no exceptions.
- Keep one primary action per view; one accent element per card.
- Style light AND dark at write time; test both before commit.
- Give every interactive element the press-compression physics and a visible focus ring.
- Route all strings through i18n ×3 locales (/AGENTS.md §1.8).
- **Verify every UI change at mobile (~375px) AND desktop (~1280px) before commit — screenshot both.** Non-negotiable (/AGENTS.md §1.11).
- Use ONLY the five motion recipes (§Motion) with the `--lf-ease`/`--lf-dur-*` tokens; new pages get the transition for free via the layout.

**Don't**
- ❌ Raw hex/rgb/arbitrary values (`text-[#3525cd]`, `rounded-[13px]`) — if a value isn't tokenized here, propose a DESIGN.md change first.
- ❌ Ad-hoc type compositions — the closed scale only.
- ❌ Sharp corners, 1px-border-defined cards, or flat Material shadows — clay tokens only.
- ❌ `transition: all`, animated `width/height/top/left`, `will-change` outside `transform/opacity/filter`.
- ❌ Ad-hoc easings/durations, infinite animations beyond `.lf-float`, reveal-staggers longer than 3×80ms, or reveals on above-the-fold content.
- ❌ Glassmorphism, gradients-as-decoration (sole exception: the hero headline gradient text, per the mockup), or more than one shadow style per element.
- ❌ New mascots, new icon sets (**Material Symbols Outlined only** — what the mockup code uses; corrected from the draft's "Lucide" note), emojis as UI icons, or text baked into images. **Exception:** country flag emoji are permitted specifically as the language-identity label in the language switcher (no Material Symbol equivalent exists) — never as a general-purpose icon substitute elsewhere.
- ❌ **Native `<select>`, `<input type="date">`, or any other browser-default picker** as the primary choice control — use the `Dropdown` component (or a purpose-built equivalent like `ThemeToggle`) so styling and interaction stay on-system everywhere.
- ❌ Noise: decorative borders, double outlines around images, backgrounds behind backgrounds. When a screen feels empty, that's the design working.
- ❌ Shipping a component checked at only one breakpoint.
- ❌ A desktop layout that's a stretched mobile column with dead side whitespace, or a mobile layout that crams desktop density into a narrow viewport.
- ❌ Fixed pixel widths for layout structure outside `container-max`/`sidebar-width`.
- ❌ Hover-only interactions with no mobile equivalent.
