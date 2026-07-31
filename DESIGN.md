---
name: LittleFounders Arcade
direction: >
  Brilliant.org-style gaming clarity — confident extrabold type, a warm
  papaya CTA on a deep navy/blue world, full pill buttons, big rounded
  cards — fused with liquid glass: frosted translucent panels
  (backdrop-blur + hairline light borders) for all floating chrome.
modes: [light, dark]              # both first-class, toggled via .dark on <html>

colors:
  # Semantic tokens only in code (rgb triplets in index.css). Raw hex prohibited.
  # ── Light ──
  base: "#ffffff"                 # page background
  surface: "#ffffff"              # cards, panels
  surface-sunken: "#f2f2f2"       # wells, segmented controls, pill tracks
  band: "#ecf0ff"                 # tinted full-bleed section band (blue-100)
  content: "#1e1e1e"              # ink — primary text
  content-muted: "#55555f"
  content-faint: "#82828e"        # captions only — below the body contrast floor
  outline: "#e5e5e5"              # hairline borders
  primary: "#456dff"              # brand blue — links, focus, selection, info
  primary-strong: "#375ce3"
  primary-soft: "#ecf0ff"
  on-primary: "#ffffff"
  secondary: "#1e1e1e"            # ink action (active pill tabs)
  secondary-soft: "#f2f2f2"
  on-secondary: "#ffffff"
  accent: "#ff775c"               # papaya — THE call-to-action color
  accent-strong: "#e55f45"
  accent-soft: "#fff0ed"
  on-accent: "#080f28"            # dark navy text on papaya, never white
  delight: "#d8e82e"              # pear — celebration highlights, never actions
  delight-soft: "#f7fad5"
  on-delight: "#1e1e1e"
  success: "#15b441"
  success-strong: "#109634"
  success-soft: "#dff7e6"
  on-success: "#ffffff"
  warning: "#ff8d23"
  warning-strong: "#e07412"
  warning-soft: "#ffeedc"
  on-warning: "#1e1e1e"
  error: "#ba1a1a"
  error-strong: "#8c1414"
  error-soft: "#ffdad6"
  on-error: "#ffffff"
  # ── Inverse band (navy) — IDENTICAL in light and dark; the brand's stage ──
  inverse: "#080f28"              # blue-950 — hero/fact/footer band fill
  inverse-surface: "#142563"
  on-inverse: "#ffffff"
  on-inverse-muted: "#ecf0ff"
  # ── Dark (the page becomes the navy world) ──
  dark-base: "#080f28"
  dark-surface: "#111b40"
  dark-surface-sunken: "#0c1434"
  dark-band: "#0e173a"
  dark-content: "#f0f3ff"
  dark-content-muted: "#c5ceee"
  dark-content-faint: "#949ec7"
  dark-outline: "#2b386c"
  dark-primary: "#7491ff"         # blue-400 — lifted for contrast on navy
  dark-primary-strong: "#456dff"
  dark-primary-soft: "#1a2760"
  dark-on-primary: "#080f28"
  dark-secondary: "#f0f3ff"
  dark-secondary-soft: "#182352"
  dark-on-secondary: "#080f28"
  # accent/delight/success/warning/error FILLS keep light values in dark mode;
  # only their -soft well tones darken (see index.css .dark block).

typography:
  family: "Figtree"               # the ONLY UI family; Google Fonts 400–800
  code: "ui-monospace stack"      # `font-code` — ONLY for code CONTENT inside lessons (maker family, inline `code`); never UI chrome
  icons: "Material Symbols Outlined"    # the ONLY icon set (ligatures)
  scale:                          # CLOSED — use the lf-* classes, never ad-hoc sizes
    lf-display-xl: {size: 44px (56px ≥sm), weight: 800, tracking: -0.03em, line-height: 1.08}
    lf-display-lg: {size: 32px (38px ≥sm), weight: 800, tracking: -0.02em, line-height: 1.15}
    lf-headline:   {size: 24px, weight: 700, tracking: -0.01em, line-height: 32px}
    lf-title:      {size: 18px, weight: 700, line-height: 26px}
    lf-body-lg:    {size: 18px, weight: 400, line-height: 29px}
    lf-body:       {size: 16px, weight: 400, line-height: 25px}
    lf-label:      {size: 14px, weight: 700, line-height: 20px}
    lf-caption:    {size: 12px, weight: 500, line-height: 16px}
  numbers: lf-number              # tabular-nums for stats/XP/currency

rounded:                          # CLOSED
  sm: 10px                        # small chips, focus rounding on inline links
  md: 16px                        # inputs, dropdown panels
  lg: 24px                        # cards
  xl: 32px                        # hero/banner cards
  full: 9999px                    # buttons, pills, badges, icon chips, tracks

elevation:                        # liquid glass — CLOSED
  shadow-glass: "0 8px 32px rgba(8,15,40,.10)"      # resting cards
  shadow-glass-sm: "0 2px 12px rgba(8,15,40,.08)"   # buttons, small chrome
  shadow-pop: "0 16px 48px rgba(8,15,40,.18)"       # floating panels
  lf-glass: "surface/72% + blur(16px) saturate(1.4) + 1px light border"
  lf-glass-deep: "white/8% + blur(16px) + white/14% border (on navy bands)"

layout:
  container-max: 1200px           # mx-auto max-w-container px-5 md:px-8
  section-rhythm: "py-20 sm:py-28"
  sidebar-width: 280px            # future app shell
  spacing-unit: 8px
  breakpoints:
    mobile: "<768px"              # single column, 20px margins (px-5)
    tablet: "768–1023px"          # interpolation only, never a separate design
    desktop: ">=1024px"           # multi-column, deliberate use of width

motion:                           # CLOSED 5-recipe system
  ease: cubic-bezier(0.22, 1, 0.36, 1)
  durations: {fast: 150ms, base: 200ms, slow: 300ms, page: 350ms, reveal: 550ms}
---

# LittleFounders Arcade — Design System

> **AUTHORITATIVE** for all frontend visual work (root AGENTS.md §1.1 rank 4).
> The tokens above are CLOSED sets — implemented 1:1 in
> `frontend/tailwind.config.js` + `frontend/src/index.css`. Never invent values
> those files don't define. **Last updated:** 2026-07-12.

## §0 Composition Fidelity — PRIME RULE

Build screens from **§Screen Recipes** below. They are the distilled
compositions in our token vocabulary. Deviating from a recipe without human
sign-off is a design bug. If a recipe is ambiguous, fix the recipe in the same
commit that builds the screen.

## Overview

LittleFounders Arcade reads like a premium learning game: calm white (or deep
navy) pages, one loud warm CTA, extrabold tight headlines, everything pill- or
big-radius-rounded, and floating chrome rendered as **liquid glass** — frosted
translucent panels that let the page glow through. It is minimal by default:
color is spent on meaning (actions, states, celebration), never decoration.

## Colors

- **Semantic tokens only.** Components use `bg-accent`, `text-content-muted`,
  etc. Raw hex anywhere in a component is a bug.
- **Action Color Contract — NON-NEGOTIABLE.** A button's color is chosen by
  what the action DOES:
  - `primary` variant → **papaya** (`accent`): the ONE main CTA per view.
  - `secondary` variant → outlined glass pill: alternative / lower emphasis.
  - `success` → positive completion. `danger` (`error`) → destructive.
  - Blue (`primary` token) colors links, focus rings, selection, progress and
    info — it is NOT the CTA fill. `delight` (pear) and `warning` are
    decorative / status only — never button fills.
- **Section bands.** Pages are composed of full-bleed horizontal bands:
  `base` (default) · `band` (tinted) · `inverse` (navy). The navy band is
  identical in both themes — it's the brand's stage. Never nest bands.
- **Contrast floor (both modes) — text must never blur into its background:**
  body text ≥ 4.5:1 against its band; `content-faint` and
  `on-inverse-muted/70` are caption-only. On navy bands, text uses
  `on-inverse` / `on-inverse-muted` — never `content-*` tokens (they invert
  with the theme; the band doesn't). On papaya/pear/orange fills, text is dark
  (`on-accent`/`on-delight`/`on-warning`), never white. Every component styles
  its dark behavior at write time — semantic tokens give it free; anything
  hardcoded against a band must be eyeballed in both modes.

## Typography

Figtree everywhere, through the closed `lf-*` classes only. Headlines are
extrabold and tight (`lf-display-*`); body stays regular with relaxed leading.
Weight — not size or color — is the first hierarchy tool. Headlines balance
their lines (`text-balance`, built into the classes); never uppercase body
text.
**End-User UI Cleanliness & Copy Protocol (NON-NEGOTIABLE):** The UI must be clean, direct, clear, and designed exclusively for the END USER.
1. **Designed for End-Users:** Every title, label, hint, note, and button text must be written strictly for the end-user. NEVER include internal spec section numbers (e.g. `(§1.9)`, `(§1.3)`, `(0025)`), developer implementation notes, or system architecture citations in user-facing UI text, i18n files, or fallback states.
2. **Clean & Minimalist Typography:** NEVER add AI-characteristic text artifacts such as double dashes (`--`), em-dashes (`—`), colons as prefix dividers, or filler punctuation in UI copy or empty state fallbacks. Keep text literal, functional, and visually clean.

## Layout — Responsive Adaptation (NON-NEGOTIABLE)

- Everything lives in `mx-auto max-w-container px-5 md:px-8` inside full-bleed
  band sections (`py-20 sm:py-28`).
- **Mobile (<768px):** single column, content fills the viewport, no dead
  vertical rhythm. **Desktop (≥1024px):** deliberate multi-column grids
  (`md:grid-cols-2`, `lg:grid-cols-3`), zigzag media/text alternation. A
  stretched mobile column on desktop is a bug; crammed desktop density on
  mobile is equally a bug.
- Structural widths only via `container-max`/`sidebar` tokens; everything else
  reflows (`%`, flex, grid, `clamp()`).
- Hover-only affordances prohibited without a tap equivalent.
- **No UI change is done until verified at ~375px AND ~1280px — screenshots.**

### Grid Systems — every repeating pattern has a DEFINED grid (NON-NEGOTIABLE)

A repeating pattern (stat rows, card grids, list rows) never "wraps
whatever fits" — it declares an exact column count at each named breakpoint
(mobile <768px / tablet 768–1023px / desktop ≥1024px), chosen deliberately
for that content's density. Three closed categories; every new repeating
pattern picks one, it doesn't invent a fourth:

| Category | Mobile | Tablet (`md:`) | Desktop (`lg:`) | Used for |
|---|---|---|---|---|
| **Stat row** | 2 cols | 3 cols | 6 cols | Profile/dashboard StatCard rows |
| **Card grid** | 1 col | 2 cols | 3 cols | Course cards, feature grids |
| **List rows** | single column, full width | — (same) | — (same, centered in a `max-w-xl`/`max-w-2xl` reading column) | Followers/following/blocked rows, settings sections |
| **Data table** (staff console ONLY) | stacked card-per-row (each row renders as a compact `surface` card: primary line + caption pairs) | true `<table>` inside an `overflow-x-auto` container | — (same, full content width) | Console service-health rows, future users/audit tables |

Stat rows and card grids ALWAYS use `gap-4` (or the section's established
gap) at every breakpoint — no breakpoint-specific gap changes, which read as
accidental rather than designed. The **Data table** category (added 2026-07-20
with the staff console, owner-signed-off) is fenced to `/admin` surfaces: the
mobile answer to a wide table is NEVER horizontal body scroll — rows collapse
into stacked cards; on `md:`+ the real table scrolls inside its own
`overflow-x-auto` container, header row in `lf-caption` bold `content-muted`,
cells `lf-body-sm`, `lf-number` for figures, hairline `outline/60` row
dividers, no zebra fills. A 4th, 5th, or odd-numbered stat/card count
still uses these exact column tracks (the last row is intentionally
incomplete, never re-flowed to "fill nicely") — a designed grid with a
short last row beats an ad hoc one that's always full.

## Elevation & Depth — Liquid Glass

Depth comes from translucency and light, not skeuomorphism:

1. **Resting cards:** opaque `surface` + `border-outline/70` + `shadow-glass`.
2. **Floating chrome** (sticky header, dropdown panels, mobile menu, toasts):
   `.lf-glass` — frosted, blurred, hairline light border; `shadow-pop` when
   detached from an edge.
3. **On navy bands:** `.lf-glass-deep` — white-tinted frost with `white/14%`
   border. This is the ONLY card treatment on `inverse`.
4. Never stack glass on glass; never blur large scrolling content areas. A
   `@supports` fallback to near-opaque surface is wired in index.css.

## Motion — closed system

System recipes, tokens only (`--lf-ease`, `--lf-dur-*` with deliberate exceptions for page/theme fades):

1. **Page transition** — `.lf-page-enter` on `<main>` keyed by route (uses a softer `ease-out` rather than the bouncy default).
2. **Scroll reveal** — `<Reveal>`; grids stagger ≤3 × 80ms.
3. **Pop** — `.lf-pop` for floating panels.
4. **Press physics** — buttons/pills `active:translate-y-px` + color-shift
   hover (`hover:bg-accent-strong`…). No scale-on-hover, no 3D borders.
5. **Arrow nudge** — CTA arrow `group-hover:translate-x-0.5`.
6. **Global theme transition (NON-NEGOTIABLE)** — Every color, background, and border change transitions smoothly when switching themes. Enforced globally in `index.css`.

7. **Lesson Engine motion** (`LESSON_ENGINE.md` §9) — the character rig
   (`lf-act-*` wrapper keyframes + `lf-rig-*` limb hooks in
   `components/characters/control/rig.css`) and the player's feedback/combo
   pops. All ONE-SHOT: every action auto-returns to idle; `celebrate`/`dance`
   may loop only while a celebration overlay (results screen) is up and stop
   with it. Timed exercises use the GentleTimerBar's linear width tween only.
   Reduced-motion: rig animations disable entirely (emotion change remains).
8. **Lottie Animations** — strict usage and state conditions (Activated vs Not Activated)
   for streak, coins, time, etc., are governed exclusively by `frontend/public/lottie/README.md`.
   No new animations or visual states can be introduced without updating that document.
9. **Game canvas — the simulation carve-out** (added 2026-07-30, `GAME_ENGINE.md`).
   A mechanic's canvas is driven by its deterministic fixed-tick simulation, not by a
   CSS recipe: it animates continuously while the game runs, because the animation IS
   the content. This is the ONE documented exception to "no new infinite animations",
   and it is bounded on four sides: **(a)** the exemption covers the stage rectangle
   only — game CHROME (HUD chips, pause/interlude/results overlays, hub cards) obeys
   recipes 1–6 and adds nothing new; **(b)** it stops when the simulation stops — pause,
   interlude, results and unmount all halt the tick loop, so there is no animation
   without a running game; **(c)** `prefers-reduced-motion` disables DECORATIVE canvas
   effects (particles, screen shake, trails, flourish, camera bob) and every chrome
   animation, but NEVER the simulation itself — a reduced-motion player must still be
   able to win, so motion is never the carrier of required information; **(d)**
   pause/resume is reachable at all times and at both breakpoints (≥44px control, plus
   `Esc` on desktop). That escape hatch is what makes an unbounded animation acceptable
   at all.

`.lf-float` (hero illustration) is the only UNCONDITIONALLY infinite animation
in CHROME (lesson celebration loops are bounded by their overlay, per recipe 7;
the simulation-driven game canvas is the carve-out in recipe 9, bounded by the
game running). Everything is reduced-motion safe (wired in index.css / rig.css).

## Shapes

Pills (`rounded-full`) for everything interactive-and-small: buttons, badges,
tabs, icon chips, segmented controls, progress tracks. Big radii (`lg`/`xl`)
for containers. Sharp corners prohibited.

## Components (`frontend/src/components/ui/` — the only building blocks)

- **Button** — pill, `lf-label`, `px-7 py-3.5`, variant per the Action Color
  Contract, `active:translate-y-px`, color-shift hover.
- **Card** — `rounded-lg p-6` surface card (`hero` → `rounded-xl p-8`;
  `interactive` → `hover:-translate-y-1` lift; `onInverse` → `.lf-glass-deep`).
- **Badge** — pill, soft fill, bold caption.
- **Icon / IconChip** — Material Symbols; chip = circular soft-tinted tile.
- **Dropdown** — custom listbox (never native pickers); pill trigger,
  `.lf-glass` + `shadow-pop` panel.
- **ThemeToggle** — 3-way segmented pill (auto/light/dark).
- **ProgressBar** — pill track (`surface-sunken`), `primary`/`accent` fill.
- **StatCard** — icon chip + `lf-display-lg lf-number` + caption.
- **Reveal** — IntersectionObserver rise-in wrapper.
- **Field** — labeled text input: `rounded-md` container radius (inputs are
  containers, not pills), `surface` fill, hairline outline, `primary` focus
  ring, `error` border + caption on invalid; optional trailing slot (e.g.
  show-password toggle).
- **Checkbox** — custom square-rounded control (native appearance
  suppressed), `primary` fill when checked, label + help caption in one tap
  target.
- **FileField** — custom image picker (never the native control's look):
  dashed well on `surface-sunken`, `primary` hover/drag state, chosen-file
  summary with a replace affordance.
- **Table** (console-only) — the Data table grid category as a component:
  `<table>` on `md:`+ (own `overflow-x-auto` wrapper, `rounded-lg` `surface`
  shell), stacked card-per-row below `md:`. Status renders as a Badge
  (`success-soft`/`error-soft`), figures as `lf-number`. Never used on
  kid/parent product surfaces.
- **TrendChart** (console-only) — minimal inline SVG area/line chart for
  timeseries: `primary` stroke, `primary/10` fill, no axes chrome beyond
  first/last `lf-caption` labels; height ≤ 160px; renders from data, never a
  third-party chart lib.
- **Characters** — Dina, Liruf, Dr. Rho, Zara Vex (canonical; no new mascots
  without sign-off).

## Screen Recipes

**Marketing shell** — sticky `.lf-glass` header (h-16: logo · nav links ·
locale Dropdown · ThemeToggle · papaya CTA pill) floating over the page;
full-bleed navy footer (brand / legal / contact 3-col grid, links in
`on-inverse-muted` hover `on-inverse`).

**Landing** — band sequence: ① navy hero (2-col: extrabold headline with a
`text-accent` highlight line, `on-inverse-muted` subtitle, papaya CTA +
glass-deep ghost CTA, floating illustration over a soft `primary/20` glow) →
② white problem/solution 2-card grid → ③ tinted `band` 6-feature card grid
(circular IconChips) → ④ navy fact band with one `.lf-glass-deep` hero card
(`delight` stat numeral) → ⑤ white motivation split (photo + copy) →
⑥ final CTA banner card.

**Auth (login / signup / identity verification)** — trust surface: focused
single centered column on `base` (max-w-md; verification forms max-w-2xl with
`sm:grid-cols-2` field pairs), soft `primary/10` glow behind ONE resting card,
`lf-display-lg` title + muted subtitle above the card, one papaya submit CTA,
cross-links in `primary`. Status outcomes (success / retry guidance) replace
the card, never stack on it. Privacy notes render as a `primary-soft` inline
strip with a shield icon — before the form, not fine print. A minimal utility
row sits above the column (logo → `/`, language Dropdown, ThemeToggle) — no
nav links, no CTA button; it's an escape hatch and two settings, not a second
header.

**Dashboard (app)** — 280px fixed sidebar (desktop, COLLAPSIBLE to the
`sidebar-sm` 88px token via a minimal edge chevron; collapsed = favicon
brand, icon-only pills w/ mini lock overlay, avatar + logout stacked) /
frosted bottom tabs (mobile); white canvas; course cards `md:grid-cols-2
lg:grid-cols-3` with ProgressBars. Sidebar anatomy (top to bottom): logo →
nav pills from `routes/app/navConfig` (active = `primary-soft` pill + filled
icon; role-locked items render LOCKED with a lock chip, never hidden) →
upgrade card (`accent-soft`, one papaya CTA; only while the role is missing)
→ theme control (language is a DB setting in /profile/settings, not shell
chrome) → user card (`surface-sunken`: Avataaars thumb linking /profile,
name, @username, logout). Mobile: glass top bar (logo · theme · logout) +
glass bottom tabs (icon + caption; locked = lock icon, disabled). Adding a
section = one navConfig entry + one route.

**Profile** — public identity, shown identically everywhere: token-gradient
cover (`lib/coverPresets`, 10 presets — NEVER an uploaded image) with the
avatar (DiceBear Avataaars via `components/Avatar`, local SVG render)
overlapping `-mt-14/-mt-16` with `ring-4 ring-base`; own profile adds a
papaya pencil badge on the avatar (→ /profile/avatar) and a glass "edit
cover" chip (inline preset-swatch grid in an `.lf-pop` card). Below: display
name + Tutor badge, `primary` @username, member-since caption, secondary
Settings pill; StatCard row is the **Stat row grid** (2/3/6, §Layout → Grid
Systems: streak, lessons, XP, minutes learned, followers, following — the
last two link out to their list pages); share-to-invite card with one papaya
copy CTA (flips to `success` on copy). Avatar editor: sticky live-preview
card (desktop) + option-section cards — color swatches as `rounded-full`
chips, feature options as live Avataaars thumbnails, selected = `primary`
ring; "Surprise me" secondary + one papaya save.

**Followers / Following / Blocked (list rows)** — the **List rows** grid
(§Layout → Grid Systems): single-column rows in one resting `Card`,
centered `max-w-xl`, each row = avatar + name + @username (+ Tutor badge) +
one right-aligned action slot (Unfollow / Unblock secondary pill, or none
for read-only public lists). Empty state = centered icon + title + body in
a `hero` card, same grammar as Learn's empty state. Destructive-ish actions
that aren't truly destructive (block) use a two-step inline confirm — label
flips to a `danger`-tone confirmation for a few seconds — rather than a
modal; true modals stay reserved for nothing in this app so far.

**Lesson** — the fullscreen Lesson Player (`lesson-engine/player/`, spec:
`LESSON_ENGINE.md`). Own layer over everything (`fixed inset-0 bg-base`), no
app chrome. Anatomy: sticky `.lf-glass` header (close pill, ProgressBar,
hearts/streak/XP chips) → focused single column (max-w ~720px) with ONE
segment at a time — narrator strip (CharacterActor + speech card) above the
exercise body — → bottom `.lf-glass` action bar (hint left, papaya
Check/Continue right, thumb-reachable). Feedback replaces the action bar as a
tier-tinted banner (`success-soft`/`warning-soft`/`error-soft`) with the
reacting character, rationale, and Retry/Continue; explanations always teach,
never scold. Intro = cast + title + objectives + one papaya start CTA;
Results = score ring, XP/streak stat cards, cast celebration. Exercises build
ONLY from `lesson-engine/core/primitives.tsx` (OptionCard, TokenChip,
SunkenWell, BigIconTile, NumberPad, KidSlider, GentleTimerBar) so all 50+
types stay uniform; interactions are tap-first, ≥44px, no drag-and-drop.

**Games hub** (`/games`) — expanded 2026-07-30 with the Game Engine
(`GAME_ENGINE.md`). A section INSIDE the Dashboard shell (same sidebar / bottom
tabs as Learn), never a fullscreen layer. `lf-display-lg` page title + one
`lf-body text-content-muted` line saying what a game is FOR ("play what you
just learned"), then one section per **course → adventure**: an `lf-headline`
group header with an `lf-caption text-content-muted` count, and below it the
**Card grid** (§Layout → Grid Systems: `grid-cols-1 md:grid-cols-2
lg:grid-cols-3 gap-4` — `gap-4` at EVERY breakpoint, never a
breakpoint-specific gap). Groups stack in curriculum order and never collapse
into accordions; a short last row stays short. Mobile: one full-width card per
row inside `px-5`. Desktop: three per row inside `max-w-container px-8` — the
freed width buys a third column, never wider cards.
Poster card (`Card interactive`, `rounded-lg`, the whole card is ONE link — no
nested interactive elements): ① 16:9 media area at the top (`overflow-hidden`,
clipped to the card radius) holding the Prism `game_background` raster; with no
image it falls back to the mechanic's IconChip on an `inverse` fill — never a
broken image, never a blank rectangle. ② `lf-title` game title, clamped to 2
lines. ③ **concept chip** — a Badge in `primary-soft` naming the topic the game
reinforces; this chip is the reason the card exists and is never omitted.
④ **progress chip** — `success-soft` Badge (check + best score in `lf-number`)
once passed, `surface-sunken` Badge with the best score when played but not
passed, and NOTHING when never played (absence is the signal; a rendered `0` is
noise). ⑤ `lf-caption text-content-muted` meta row: mechanic icon + name +
estimated minutes. ⑥ exactly one action slot.
**CTA density — the resolution (Action Color Contract).** A papaya pill on
every card would put a dozen "ONE main CTA per view"s in one view, which is a
bug; dropping papaya entirely would leave the section with no forward action.
So papaya is spent **per view, not per card**: exactly ONE card in the hub —
the next/resume game — carries the papaya Play pill; every other ready card
carries the outlined glass secondary pill, and an already-passed card reads
"Play again" in that same secondary pill. This is the rule the learn path
already applies, where `bg-accent` marks only the `current` node
(`routes/app/learn/LessonPathNode.tsx`) and every other node is outline- or
done-toned.
**Locked cards — locked, NEVER hidden.** A game unlocks when its bound topic
has a passed lesson, so a locked card is the platform's clearest "learn first,
then play" signal — hiding it would hide the reason to go learn. Locked =
`surface-sunken` media area, `content-faint` text, a `lock` chip in place of
the action pill, no hover lift: the same locked grammar as the lesson path node
and the role-locked sidebar pills. The card stays reachable by tap and
keyboard, and activating it does not start a game — it reveals the one-line
unlock reason naming the topic and links to that lesson. That reason is never
carried by a hover-only tooltip (mobile has no hover). Hidden-not-locked stays
reserved for `/admin`, which is not aspirational.
**Empty state** — only when the user genuinely has no games (no published game
for any of their courses): the standard empty grammar in one `Card hero`,
centered CharacterActor + `lf-title` + `lf-body text-content-muted`, identical
to Learn's. A hub where games exist but every one is locked is NOT empty — it
renders the full locked grid plus that single guiding line.

**Game player** (`/games/:slug`) — added 2026-07-30; peer of the Lesson player
and built the same way: its own layer over everything (`fixed inset-0 bg-base`),
no app chrome, one thing on screen at a time. Anatomy: sticky `.lf-glass` HUD
bar → the stage → nothing else. HUD, one row, every figure in `lf-number`:
close pill (left) · ProgressBar (`primary` fill — round/target progress, not
score) · score · lives as heart Icons, omitted ENTIRELY in `cheer` mode where
there is no fail state (a permanently full heart row teaches a lie) · combo
chip in `delight` while a combo is live, absent otherwise. The HUD is chrome:
no palette tint. **During play the chrome carries ZERO papaya** — the papaya
budget belongs to the one forward action on the overlays (Start / Resume /
Continue), and while the simulation runs there is no forward action to offer.
Stage: a `rounded-lg overflow-hidden` rectangle filled with the palette's stage
fill (§Game visuals). Its internal logical resolution is FIXED — the simulation
runs on integer logical units at a fixed tick, so layout may never feed back
into it — and the whole stage is scaled UNIFORMLY to fit its box: letterboxed
with the stage fill, never cropped in a gameplay-relevant area, never stretched
non-uniformly. Resizing rescales; it never re-ticks and never re-lays-out the
game.
Mobile (<768px): the stage spans the column inside `px-5` and takes all height
between the HUD and the bottom safe area; the pause control is a floating
`.lf-glass` circular icon pill in the **bottom-right thumb zone** (≥44px),
because a top HUD is out of thumb reach mid-game. Desktop (≥1024px): stage
centered at `max-w-container px-8`, HUD stats spread along the bar instead of
compressing, pause lives in the HUD and `Esc` also opens it. Canvas
interactions are tap-first with ≥44px targets and every drag has a tap
equivalent; pointer and keyboard controls are ADDITIONS, never the only input.
Intro = concept recap + title + cast + the interactive tutorial in a ~720px
reading column with one papaya Start pill.
Pause overlay: a centered `.lf-glass` + `shadow-pop` panel over a scrim; the
stage holds its last frame and is NOT blurred (never blur a large content
area — §Elevation 4; the panel frosts only its own footprint). Resume is the
one papaya pill; Restart, Exit and the sound toggle are secondary. Opening
pause halts the tick loop and consumes no input.
Interlude overlay: the between-round micro-exercise (`pick_one` / `true_false`
/ `tap_all`) is CHROME, rendered in the Lesson player's answer grammar — a
resting `surface` card in the ~720px column, tap-first option tiles ≥44px, no
drag — so a kid never has to learn two answer grammars. Feedback is the same
tier-tinted banner (`success-soft` / `warning-soft`) with a rationale that
teaches and never scolds. One screen, one forward pill, tick loop stopped while
it is up.
Results: score ring + XP, then the stats row as the **Stat row grid** (2 / 3 /
6 per §Layout → Grid Systems; a short last row stays short), then **one honest
highlight line** — a single `lf-body` sentence derived from the run's real
stats, `delight`-tinted at most, never papaya, and never invented praise: with
nothing honest to celebrate it states the plain fact rather than "Amazing!".
Cast celebration uses CharacterActor under Motion recipe 7 (`celebrate`/`dance`
loop only while this overlay is up, and stop with it). Exactly one papaya pill
(Continue / Play again); back-to-hub is secondary.

**Staff sections (admin console, `/admin/*`)** — added 2026-07-20, rebuilt
2026-07-21 (owner sign-off). **INTEGRATED into the app shell, NOT a separate
back-office**: the admin surfaces render inside the normal Dashboard chrome
(same sidebar, top bar, bottom tabs as Learn/Profile). The sidebar grows a
`admin.sidebarGroup` ("Staff") label followed by the section links
(`routes/admin/adminNav.ts` registry); on mobile a `shield_person` button in
the top bar opens `/admin` and every admin page carries a horizontal
scrollable section sub-nav (`lg:hidden`). HIDDEN, not locked, for non-staff
(no nav item + `RequireRole` redirect) — the locked-chip grammar is for
aspirational upgrades, and admin is not one. Every page uses the shared
`AdminPage` shell: `lf-display-lg` title + a **role chip** (`admin` primary /
`superadmin` accent — the always-visible admin-vs-superadmin cue) + optional
actions, then content. Sections: **Overview** (dense "todo de un vistazo" —
KPI **Stat row** with `dense` StatCards, a course/lesson status **meter**,
role distribution list, system-health chip strip), **Content** (courses
**Data table** + publish/unpublish/archive `AdminAction`s), **Moderation**
(the §1.9 human publish gate — lessons in `review` with approve/reject),
**Users** (users **Data table** + role chips + search), **Analytics & Health**
(Pulse — KPI stat row, **TrendChart**, service-health **Data table**),
**Audit log** (append-only **Data table**), and **Roles & Access**
(**superadmin-only** — grant form + role-holders table with per-role revoke).
Voice is quieter than the kid product: dense tables over spacious cards, no
characters, no upsell, papaya only for a true CTA. Empty/unavailable states
use the standard empty-state grammar (icon + title + caption in a resting
card), never a blank pane. Responsive per §1.11: KPI grids go 2-col mobile →
6-col desktop, Data tables collapse to stacked cards below `md:` (Table
component), the section sub-nav is the mobile section switcher. Roles &
Access simply does not render (route + sidebar) for a plain admin.

**Assessment / Profile / Catalog** — same grammar: bands, cards, pills,
IconChips; a profile hero may use a navy band with a glass-deep identity card.

### Game visuals — the canvas/chrome boundary (NON-NEGOTIABLE)

Added 2026-07-30 with the Game Engine. Games are the only surface where
generated raster art is a first-class visual, and the rule that keeps that art
from eroding the design system is a hard geometric boundary: **the palette and
the generated art live INSIDE the stage rectangle; everything outside it is
chrome.**

**Chrome** — HUD, pause/interlude/results overlays, hub cards, every button and
chip — is built exactly like the rest of the app: closed color tokens, the
`lf-*` type scale, Material Symbols icons, the Action Color Contract, pill and
big-radius shapes, `.lf-glass` / `.lf-glass-deep` elevation, `components/ui/`
kit parts. A game never ships its own button, its own color scale or its own
card.

**Canvas** — Prism-generated raster sprites (`game_sprite` / `game_background`
purposes) plus shapes filled from the palette. Sprites are BY DEFINITION exempt
from "Material Symbols is the only icon set": a sprite is content, not an icon.
**That exemption stops at the canvas edge.** A sprite never becomes a HUD glyph,
a card icon or a button affordance. The one place canvas art appears outside the
stage is the hub poster's media area, where it is framed IMAGERY inside the card
radius — never an icon.

Rules that hold on both sides of the boundary:

- **Figtree remains the only UI family — a game must NEVER import an arcade
  display font.** This is precisely the failure v1 shipped: six v1 games each
  `@import`ed their own Google Fonts from their own per-game CSS — `Press Start
  2P` in `frontend/src/games/nam-vs-yum/nam-vs-yum.css`, plus Orbitron, Fredoka
  One, Cinzel, Nunito and Patrick Hand across chronobloom, hacker-defense,
  nectar-of-shadows, paper-coin and paper-detective — so the product had seven
  type systems and therefore none. Arcade character here comes from **weight,
  size, motion and color**: extrabold `lf-display-*` numerals, `lf-number`
  tabular figures, the palette, and the press/pop recipes. Text drawn INSIDE the
  canvas (score popups, item labels) is Figtree at `lf-*` sizes too.
- **No text baked into generated art.** `illustrate` runs on the es-MX document
  before the localize string-freeze and the sprite URLs then copy verbatim into
  en-US and pt-BR, so one image serves all three locales — any word painted into
  a sprite is a word that can never be translated. Labels render as text OVER
  the art, never as part of it.
- **Art must read at 1× on a 375px viewport.** A sprite whose meaning only
  resolves at desktop size is a bug, not a detail.
- **No raw hex anywhere** — not in a component, not in a manifest. A generated
  `GameDocument` names a palette id from the closed set below and nothing else.

#### `GAME_PALETTES` — CLOSED

A palette is a NAME for a combination of tokens that already exist; it
introduces no value. There are six ids and a manifest may name only these.

Palette tokens must be **theme-stable**, for the same reason the navy band is
identical in both modes: the readability of a simulation must not change when
the user flips the theme. So `-soft` tokens are PROHIBITED in a palette — they
invert between modes (light wells become dark wells) while the stage does not —
exactly as `content-*` tokens are prohibited on the navy band. `inverse-surface`
and `primary-strong` shift only *within* their own hue between modes
(`#142563`→`#18265c` and `#375ce3`→`#456dff` in `index.css`), which is fine.

| Palette id | Stage fill | Stage well | Canvas accent | Highlight | Ink on stage |
|---|---|---|---|---|---|
| `navy-papaya` *(default)* | `inverse` | `inverse-surface` | `accent` | `delight` | `on-inverse` / `on-inverse-muted` |
| `forest-pear` | `success-strong` | `success` | `delight` | `warning` | `on-success` |
| `ocean-blue` | `inverse-surface` | `inverse` | `accent` | `delight` | `on-inverse` / `on-inverse-muted` |
| `sunset-papaya` | `accent-strong` | `accent` | `inverse` | `delight` | `on-accent` |
| `violet-night` | `inverse` | `inverse-surface` | `primary-strong` | `delight` | `on-inverse` / `on-inverse-muted` |
| `sand-clay` | `warning-strong` | `warning` | `inverse` | `delight` | `on-warning` |

- **Highlight is `delight` in every palette but one.** Pear is the system's
  celebration color and score/combo/win moments are celebration. `forest-pear`
  is the exception: pear is already its canvas accent there, so its highlight is
  `warning`.
- **`delight` as a canvas accent is allowed; as a button fill it still is not.**
  The Action Color Contract governs chrome — a tinted game object is not a
  button.
- **Two ids are mood labels the closed set cannot name literally, and we do NOT
  add tokens to fix that.** There is no violet and no sand/clay token:
  `violet-night` is realized as the deepest navy stage with a cool
  `primary-strong` accent (its real functional value is a night canvas with no
  papaya competing against chrome), and `sand-clay` from the `warning` family,
  the closest warm earth tone the set has. Adding a hue is a token change
  requiring owner sign-off — never a manifest's decision.
- **The palette never leaves the stage.** HUD, overlays and hub cards are not
  tinted by it. That is what keeps a papaya or terracotta stage from breaking
  chrome contrast, and it is why chrome needs no per-palette variants.

## Do's and Don'ts

- ✅ One papaya CTA per view; blue for links/info; pear only to celebrate.
- ✅ Frosted glass for anything that floats; opaque cards for anything at rest.
- ✅ Verify both themes and both breakpoints before closing any task.
- ❌ No raw hex, no ad-hoc font sizes, no sharp corners, no native pickers.
- ❌ No inset-shadow stacks, no 3D bottom-border buttons, no scale-on-hover
  buttons (lift is for cards only).
- ❌ No emojis as icons (country flags in the language switcher are the one
  exception). No new infinite animations — the simulation-driven game canvas is
  the single carve-out (Motion recipe 9), and it ends when the game does.
- ❌ No per-game fonts, color scales or components. A game skins its CANVAS
  (palette + Prism sprites); it never skins the design system.
