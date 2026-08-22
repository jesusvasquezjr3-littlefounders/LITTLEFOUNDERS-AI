---
name: LittleFounders Liquid Glass
direction: >
  Premium glassmorphism aesthetic — confident bold type, a strong indigo CTA on
  a slate/white world, full pill buttons, big rounded cards — rendered as
  frosted liquid glass: translucent panels with backdrop-blur, subtle light
  borders, and layered soft shadows for depth and premium feel.
modes: [light, dark]              # both first-class, toggled via .dark on <html>

colors:
  # Semantic tokens only in code (rgb triplets in index.css). Raw hex prohibited.
  # ── Light ──
  base: "#f8fafc"                 # page background (slate-50)
  surface: "#ffffff"              # cards, panels
  surface-sunken: "#f1f5f9"       # wells, segmented controls (slate-100)
  band: "#eef2ff"                 # tinted full-bleed section band (indigo-50)
  content: "#0f172a"              # ink — primary text (slate-900)
  content-muted: "#475569"
  content-faint: "#94a3b8"        # captions only — below the body contrast floor
  outline: "#e2e8f0"              # hairline borders (slate-200)
  primary: "#4f46e5"              # brand indigo — links, focus, selection, info
  primary-strong: "#4338ca"
  primary-soft: "#eef2ff"
  on-primary: "#ffffff"
  secondary: "#0f172a"            # ink action (active pill tabs)
  secondary-soft: "#f1f5f9"
  on-secondary: "#ffffff"
  accent: "#4f46e5"               # indigo — THE call-to-action color
  accent-strong: "#4338ca"
  accent-soft: "#eef2ff"
  on-accent: "#ffffff"            # white text on indigo
  delight: "#8b5cf6"              # violet — celebration highlights, never actions
  delight-soft: "#ede9fe"
  on-delight: "#ffffff"
  success: "#059669"
  success-strong: "#047857"
  success-soft: "#ecfdf5"
  on-success: "#ffffff"
  warning: "#d97706"
  warning-strong: "#b45309"
  warning-soft: "#fffbeb"
  on-warning: "#ffffff"
  error: "#dc2626"
  error-strong: "#b91c1c"
  error-soft: "#fef2f2"
  on-error: "#ffffff"
  # ── Inverse band (slate) — IDENTICAL in light and dark; the brand's stage ──
  inverse: "#0f172a"              # slate-900 — hero/fact/footer band fill
  inverse-surface: "#1e293b"
  on-inverse: "#ffffff"
  on-inverse-muted: "#cbd5e1"
  # ── Dark ──
  dark-base: "#0a0e1a"
  dark-surface: "#0d1426"
  dark-surface-sunken: "#070b14"
  dark-band: "#0a0e1a"
  dark-content: "#f8fafc"
  dark-content-muted: "#cbd5e1"
  dark-content-faint: "#94a3b8"
  dark-outline: "#1e293b"
  dark-primary: "#818cf8"         # indigo-400 — lifted for contrast on dark
  dark-primary-strong: "#6366f1"
  dark-primary-soft: "#312e81"
  dark-on-primary: "#ffffff"
  dark-secondary: "#f8fafc"
  dark-secondary-soft: "#0f172a"
  dark-on-secondary: "#ffffff"
  # accent/delight/success/warning/error FILLS keep light values in dark mode;
  # only their -soft well tones darken (see index.css .dark block).

typography:
  family: "Inter"                 # the ONLY UI family; Google Fonts 400–700; Sora for display/headings
  code: "ui-monospace stack"      # `font-code` — ONLY for code CONTENT inside lessons (maker family, inline `code`); never UI chrome
  icons: "Material Symbols Outlined"    # the ONLY icon set (ligatures)
  scale:                          # CLOSED — use the lf-* classes, never ad-hoc sizes
    lf-display-xl: {size: 37px (48px ≥sm), weight: 800, tracking: -0.03em, line-height: 1.08}
    lf-display-lg: {size: 27px (32px ≥sm), weight: 800, tracking: -0.02em, line-height: 1.15}
    lf-headline:   {size: 20px, weight: 700, tracking: -0.01em, line-height: 28px}
    lf-title:      {size: 15px, weight: 700, line-height: 22px}
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

elevation:                        # liquid glass — Apple-refined. Depth through layered light.
  glass-blur: 20px                  # standard backdrop blur
  glass-blur-deep: 28px             # deep blur on inverse bands
  glass-saturate: 1.6               # color pop through glass
  glass-brightness: 1.04            # subtle light lift
  glass-bg-opacity: 0.78            # light-mode panel fill
  shadow-glass: "5-layer atmospheric 0.03—0.06 alpha, 32px max"
  shadow-glass-sm: "3-layer atmospheric 0.03—0.05 alpha, 8px max"
  shadow-pop: "5-layer atmospheric 0.04—0.12 alpha, 64px max"
  lf-glass: "surface/78% + blur(20px) + mesh + rim-light(inset) + 0.5px edge + depth"
  lf-glass-deep: "white/6% + caustic + mesh + blur(28px) + rim-light + edge + depth"

layout:
  container-max: 1200px           # mx-auto max-w-container px-5 md:px-8
  section-rhythm: "py-20 sm:py-28"
  sidebar-width: 280px            # future app shell
  spacing-unit: 8px
  breakpoints:
    mobile: "<768px"              # single column, 20px margins (px-5)
    tablet: "768–1023px"          # interpolation only, never a separate design
    desktop: ">=1024px"           # multi-column, deliberate use of width
  immersive:                      # CLOSED — the full-bleed layer only (Lesson Player, Tutor stage)
    stage: "fixed inset-0"        # own layer over everything; NEVER inside container-max
    hud-inset: 24px               # desktop gap from a floating plate to the viewport edge
    hud-inset-mobile: 16px        # matches margin-mobile; a thumb needs the same room
    plate-max: 420px              # widest a floating HUD plate may be
    plate-max-height: 62vh        # it FLOATS: scene stays visible above AND below it
    sheet-detents: {peek: 88px, half: 45vh, full: 88vh}   # mobile bottom sheet
    orb: {mobile: 96px, desktop: 112px}   # the primary in-scene control

motion:                           # CLOSED 5-recipe system
  ease: cubic-bezier(0.22, 1, 0.36, 1)
  durations: {fast: 150ms, base: 200ms, slow: 300ms, page: 350ms, reveal: 550ms}
---

# LittleFounders Liquid Glass — Design System

> **AUTHORITATIVE** for all frontend visual work (root AGENTS.md §1.1 rank 4).
> The tokens above are CLOSED sets — implemented 1:1 in
> `frontend/tailwind.config.js` + `frontend/src/index.css`. Never invent values
> those files don't define. **Last updated:** 2026-08-21 (Tutor screen recipe).

## §0 Composition Fidelity — PRIME RULE

Build screens from **§Screen Recipes** below. They are the distilled
compositions in our token vocabulary. Deviating from a recipe without human
sign-off is a design bug. If a recipe is ambiguous, fix the recipe in the same
commit that builds the screen.

## Overview

LittleFounders Liquid Glass reads like a premium glassmorphism platform: calm
slate pages, one confident indigo CTA, bold clean headlines, everything pill- or
big-radius-rounded, and floating chrome rendered as **liquid glass** — frosted
translucent panels with backdrop-blur, subtle light borders, and layered soft
shadows that let the page glow through. It is minimal by default: color is spent
on meaning (actions, states, celebration), never decoration.

## Colors

- **Semantic tokens only.** Components use `bg-accent`, `text-content-muted`,
  etc. Raw hex anywhere in a component is a bug.
- **Action Color Contract — NON-NEGOTIABLE.** A button's color is chosen by
  what the action DOES:
  - `primary`/`accent` variant → **indigo** (`accent`): the ONE main CTA per view.
  - `secondary` variant → outlined: alternative / lower emphasis.
  - `success` → positive completion. `danger` (`error`) → destructive.
  - Blue/indigo (`primary` token) colors links, focus rings, selection, progress
    and info. `delight` (violet) and `warning` are decorative / status only —
    never button fills.
- **Section bands.** Pages are composed of full-bleed horizontal bands:
  `base` (default) · `band` (tinted) ·   `inverse` (slate). The inverse band is
  identical in both themes — it's the brand's stage. Never nest bands.
- **Contrast floor (both modes) — text must never blur into its background:**
  body text ≥ 4.5:1 against its band; `content-faint` and
  `on-inverse-muted/70` are caption-only. On inverse bands, text uses
  `on-inverse` / `on-inverse-muted` — never `content-*` tokens (they invert
  with the theme; the band doesn't).   On indigo/violet/amber fills, text is dark (or white on saturated fills)
  (`on-accent`/`on-delight`/`on-warning`), never white. Every component styles
  its dark behavior at write time — semantic tokens give it free; anything
  hardcoded against a band must be eyeballed in both modes.
- **The OPAQUE FLOOR rule — text over a live render (added 2026-08-21).**
  Wherever body text sits over a moving 3D canvas (the Tutor stage), the
  surface carrying it uses the **opaque `bg-surface` token** as its floor.
  `.lf-glass` / `.lf-glass-deep` are for FRAMES, edges and non-text chrome
  only. **No ad-hoc alpha** — `bg-surface/88` is not a token, and the two
  glass recipes in the front matter are the closed set; a component that needs
  a third one needs a design decision, not a slash.
  The reason is arithmetic, not taste: the contrast floor above is a ratio
  against a KNOWN background, and a translucent plate over an orbiting camera
  has no known background. The same caption measures comfortably over the
  island's shadow side and then fails a second later when the lit rim drifts
  behind it — and it fails while nobody is looking, because the failing frame
  is one the reviewer's screenshot did not catch. An opaque floor makes the
  ratio computable, which is the only way the floor above can be enforced at
  all on that surface.

## Typography

Inter everywhere (display: Sora), through the closed `lf-*` classes only. Headlines are, through the closed `lf-*` classes only. Headlines are
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
- **The immersive exception (added 2026-08-21).** Exactly two surfaces sit
  OUTSIDE `mx-auto max-w-container` and outside the app shell: the **Lesson
  Player** and the **Tutor stage**. They take the whole viewport
  (`layout.immersive.stage` = `fixed inset-0`) because their subject IS the
  viewport — a 3D stage rendered inside a 1200 px reading column is a picture
  of a stage, and that is precisely what the first Tutor shipped as. Adding a
  third surface to this list is an owner decision, not a layout preference.
  Everything else in this section still binds them: no dead space at 375 px,
  the freed width used deliberately at 1280 px, no horizontal body scroll, and
  both breakpoints screenshotted before the task closes. What the exception
  changes is where the room comes from, never whether it is used on purpose.

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

**The one exemption: the in-scene HUD cluster** (Tutor route only, added
2026-08-21, owner-driven rebuild). Controls anchored to points inside a 3D
scene are placed by the WORLD, not by a column track: an offer chip sits at
the tutor's chest, a rim pad sits on the island's rim, a recap chip sits where
the thing it recaps happened. Declaring "3 columns at `lg:`" for those would
be declaring a grid the next camera move contradicts. The exemption is narrow
and it carries the obligation the grid rule exists to serve in the first
place — that somebody DECIDED how many of these there are:

- The set is closed and small (≤ 5 offers, ≤ 2 adaptation choices, 3 recap
  chips), stated in `/ORACLE.md`, never "whatever the model returned".
- Every anchored control has a guaranteed DOM twin (§Components → WorldChip),
  so keyboard order is a real, ordered list even when the visual arrangement
  is a semicircle.
- The **fallback** arrangement — no WebGL, an off-screen anchor, or the
  reduced-motion still modifier — is the ordinary **Card grid** category
  (1 / 2 / 3). In-scene placement is a PRESENTATION of a list, never an
  excuse for not having decided what the list is.

## Elevation & Depth — Liquid Glass

Depth comes from layered light, not heavy drop shadows. Every glass surface uses
multiple shadow layers at very low opacity (0.02–0.08), building atmospheric
depth that feels physical. A specular rim light (`inset 0 1px 0`) and a 0.5px
hairline edge replace traditional borders.

1. **Resting cards:** translucent `surface/78%` + `blur(20px) saturate(1.6)` +
   mesh texture + rim light + edge + 5-layer depth shadow. Hover deepens depth.
2. **Floating chrome** (sticky header, dropdowns, mobile menu, toasts):
   `.lf-glass` with the full recipe; `shadow-pop` when detached from an edge.
3. **On inverse bands:** `.lf-glass-deep` — `white/6%` + `blur(28px)` +
   caustic highlight + mesh + rim light + 5-layer depth.
4. **Buttons:** `.lf-gaming-btn` — inner glow (inset top highlight + inset
   bottom shadow) + button shadow + hover sheen sweep.
5. **Over a live canvas** (the Tutor stage, added 2026-08-21): the plate is a
   `.lf-glass` FRAME with an OPAQUE `surface` floor under any body text
   (§Colors → the opaque floor rule). Depth comes from `shadow-pop` plus a
   24 px gradient scrim beneath the plate that fades into the render, so the
   plate reads as detached without a hard border competing with the scene
   behind it. **Exactly two z-bands, and no third:** world-anchored chrome
   (chips, caption, runes) below, viewport-anchored chrome (the mic orb, the
   lesson plate, the way out) above. A third band is how a control ends up
   rendered underneath the thing it controls — and on a stage where everything
   moves, nobody can tell that from a bug in the projection. The loading veil
   is not a band: it covers the whole stage and lifts, and the way out is the
   one control that outranks it, because a stage that never reports a first
   frame is the state a learner most needs to leave.
6. Never stack glass on glass; `@supports` fallback to near-opaque surface.

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
9. **Camera motion** (Tutor stage, `/TUTOR_3D.md` §9) — the camera is the
   largest moving element in the product, so it gets a recipe rather than a
   drawer of one-off tweens. ONE framerate-independent critical damper toward
   the active shot's pose (`x += (target - x) * (1 - exp(-lambda * dt))`),
   never a duration-based tween: a shot change routinely arrives mid-transition
   and a tween restarted from a moving start SNAPS, which is exactly how the
   first version behaved. Travel reads at roughly the `page` duration, with a
   120 ms anticipation pre-roll and a 180 ms settle drift bracketing it.
   Under `prefers-reduced-motion` the travel collapses to a CUT covered by a
   120 ms scrim dip — a cut is honest motion-free feedback, whereas silently
   teleporting the viewpoint mid-sentence is disorienting for everyone. The
   reduced-motion path is a MODIFIER on this recipe, never a second camera
   system: two camera systems means the accessible one is the one nobody looks
   at.
10. **HUD motion** (Tutor stage) — in-scene chrome enters on the existing
    `Reveal` cadence (≤ 3 × 80 ms stagger, recipe 2) and **never animates its
    own position**. An anchored plate's position belongs to the camera, so a
    CSS transition on `transform` fights the per-frame projection and reads as
    lag rather than as easing. The only per-element motion permitted is opacity
    and the orb's own state: recipe 4's press physics, plus a 4 s 3% breathing
    loop that is bounded by the IDLE state and stops with it.

`.lf-float` (hero illustration) is the only UNCONDITIONALLY infinite animation
in CHROME (lesson celebration loops are bounded by their overlay, per recipe 7).
Everything is reduced-motion safe (wired in index.css / rig.css).

**The Tutor stage's ambient camera drift is a second carve-out from "no new
infinite animations", and it is deliberately not chrome.** A slow shallow orbit
is what turns a static mesh into a place; stop it and the island becomes a
photograph of an island. It earns the carve-out by having three independent off
switches that must all keep working: `prefers-reduced-motion`, the quality
governor's `ambientMotion` setting, and the duration of any live lesson segment
(reading a maths problem while the frame breathes is nausea, not atmosphere).
What the governor may NOT switch off is the shot damper in recipe 9. A locked
`low` tier that cannot transition between shots turns this whole design into a
permanently static island, and the damper costs the same single camera write
per frame either way — so gating it buys no frames and loses the product.

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
- **CourseBadgeArtwork** — the course identity medallion: semantic metal ring,
  specular highlight, violet halo and transparent course artwork. It stays
  decorative and non-interactive, uses a Material Symbols fallback when an
  asset is unavailable, and must remain legible in both themes.
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
  compact timeseries: `primary` stroke, `primary/10` fill, no axes chrome
  beyond first/last `lf-caption` labels; height ≤ 160px; renders from data.
- **Interactive area chart** (console-only) — for a continuous, high-density
  time series where an admin must inspect a value and zoom a date range in
  place. Recharts is allowed only for this interaction class: one primary
  series, `primary` stroke with a restrained `primary` area fill, quiet axes,
  a data tooltip, and a touch-capable range brush. Never add fixed range tabs
  when the brush provides direct range control.
- **Characters** — Dina, Liruf, Dr. Rho, Zara Vex (canonical; no new mascots
  without sign-off).

The three below live in `frontend/src/tutor/hud/` rather than
`components/ui/`, because they are meaningless off the immersive layer. They
are listed HERE anyway: without them, "components/ui is the only building
blocks list" would be violated by every single control on the Tutor route, and
a rule violated everywhere stops being a rule.

- **HudPlate** (Tutor route only) — the one glass primitive every in-scene
  control composes from: chip, plate, orb, sheet, rune. It is where the
  §Colors opaque-floor rule is enforced ONCE rather than remembered fourteen
  times — `.lf-glass` frame, opaque `bg-surface` floor under any body text. It
  sizes in `ch`/`clamp()` and **wraps, never truncates**: the label
  `personalize.noCompanion` measures 7 / 13 / 10 characters across
  en-US / es-MX / pt-BR, a 1.86× swing on one short string, so a fixed-width
  plate is a layout that passes review in English and breaks in the third
  locale nobody screenshotted.
- **WorldChip** (Tutor route only) — a HudPlate positioned by a named scene
  anchor, mirroring a pickable mesh and dispatching **the same handler**. The
  mesh is the delightful path, the chip is the guaranteed path, and both are
  always mounted, so the cinematic route and the keyboard route are one code
  path rather than two that drift apart at the second feature. When its anchor
  goes behind the camera, or when the chip's own BOX no longer fits the frame,
  it is hidden **and inert** — a focusable control nobody can see is worse than
  no control, because the keyboard user's focus simply vanishes, and a chip
  culled on its centre point instead of its box is half-visible and fully
  focusable, which is the same failure wearing a sliver of glass. A chip that
  is one option in a group carries `aria-pressed` whether or not it is the
  chosen one; a chip that simply does something carries none, so a button is
  never announced as a switch.
- **MicOrb** (Tutor route only) — the Tutor's primary control and the largest
  element on screen (`layout.immersive.orb`: 96 px mobile, 112 px desktop),
  viewport-anchored over the bottom safe area because a thumb does not move
  with the camera. It is **always rendered**, in all five states —
  UNAVAILABLE, IDLE, LISTENING, THINKING, SPEAKING. Unavailable is a dashed
  ring, `aria-disabled`, and one honest translated line saying why; it is never
  an absent control. Hiding it is what produced the owner's report that the
  microphone was nowhere to be found, which was true and was not a bug in the
  microphone. See `/ORACLE.md` §14.

## Screen Recipes

**Marketing shell** — sticky `.lf-glass` header (h-16: logo · nav links ·
locale Dropdown · ThemeToggle · indigo CTA pill) floating over the page;
full-bleed inverse footer (brand / legal / contact 3-col grid, links in
`on-inverse-muted` hover `on-inverse`).

**Landing** — band sequence: ① inverse hero (2-col: extrabold headline with a
`text-accent` highlight line, `on-inverse-muted` subtitle, indigo CTA +
glass-deep ghost CTA, floating illustration over a soft `primary/20` glow) →
② white problem/solution 2-card grid → ③ tinted `band` 6-feature card grid
(circular IconChips) → ④ inverse fact band with one `.lf-glass-deep` hero card
(`delight` stat numeral) → ⑤ white motivation split (photo + copy) →
⑥ final CTA banner card.

**Auth (login / signup / identity verification)** — trust surface: focused
single centered column on `base` (max-w-md; verification forms max-w-2xl with
`sm:grid-cols-2` field pairs), soft `primary/10` glow behind ONE resting card,
`lf-display-lg` title + muted subtitle above the card, one indigo submit CTA,
cross-links in `primary`. Status outcomes (success / retry guidance) replace
the card, never stack on it. Privacy notes render as a `primary-soft` inline
strip with a shield icon — before the form, not fine print. A minimal utility
row sits above the column (logo → `/`, language Dropdown, ThemeToggle) — no
nav links, no CTA button; it's an escape hatch and two settings, not a second
header.

**Dashboard (app)** — 280px fixed sidebar (desktop, COLLAPSIBLE to the
`sidebar-sm` 88px token via a minimal edge chevron; collapsed = favicon
brand, icon-only pills w/ mini lock overlay, avatar + logout stacked) /
elevated bottom tabs (mobile); white canvas; course cards `md:grid-cols-2
lg:grid-cols-3` with ProgressBars. Sidebar anatomy (top to bottom): logo →
nav pills from `routes/app/navConfig` (active = `primary-soft` pill + filled
icon; role-locked items render LOCKED with a lock chip, never hidden) →
upgrade card (`accent-soft`, one indigo CTA; only while the role is missing)
→ theme control (language is a DB setting in /profile/settings, not shell
chrome) → user card (`surface-sunken`: Avataaars thumb linking /profile,
name, @username, logout). Mobile: glass top bar (logo · theme · logout) +
glass bottom tabs (icon + caption; locked = lock icon, disabled). Adding a
section = one navConfig entry + one route.

**Profile** — public identity, shown identically everywhere: token-gradient
cover (`lib/coverPresets`, 10 presets — NEVER an uploaded image) with the
avatar (DiceBear Avataaars via `components/Avatar`, local SVG render)
overlapping `-mt-14/-mt-16` with `ring-4 ring-base`; own profile adds a
indigo pencil badge on the avatar (→ /profile/avatar) and a glass "edit
cover" chip (inline preset-swatch grid in an `.lf-pop` card). Below: display
name + Tutor badge, `primary` @username, member-since caption, secondary
Settings pill; StatCard row is the **Stat row grid** (2/3/6, §Layout → Grid
Systems: streak, lessons, XP, minutes learned, followers, following — the
last two link out to their list pages); share-to-invite card with one indigo
copy CTA (flips to `success` on copy). Avatar editor: sticky live-preview
card (desktop) + option-section cards — color swatches as `rounded-full`
chips, feature options as live Avataaars thumbnails, selected = `primary`
ring; "Surprise me" secondary + one indigo save.

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
exercise body — → bottom `.lf-glass` action bar (hint left, indigo
Check/Continue right, thumb-reachable). Feedback replaces the action bar as a
tier-tinted banner (`success-soft`/`warning-soft`/`error-soft`) with the
reacting character, rationale, and Retry/Continue; explanations always teach,
never scold. Intro = cast + title + objectives + one indigo start CTA;
Results = score ring, XP/streak stat cards, cast celebration. Exercises build
ONLY from `lesson-engine/core/primitives.tsx` (OptionCard, TokenChip,
SunkenWell, BigIconTile, NumberPad, KidSlider, GentleTimerBar) so all 50+
types stay uniform; interactions are tap-first, ≥44px, no drag-and-drop.

**Tutor (`/tutor`)** — added 2026-08-21, and the ABSENCE of this entry is why
it exists. §0 makes building outside a recipe a design bug. There was no Tutor
recipe, so the Tutor was assembled out of the nearest thing that had one —
Dashboard cards — and shipped as a dashboard of flat panels with the 3D stage
shrunk into a box in one corner of it. The owner rejected it in the strongest
terms. What follows is the recipe it should have been built from. Product
spec: `/ORACLE.md`. The stage itself: `/TUTOR_3D.md`.

**The stage IS the page.** Same own-layer precedent as the Lesson Player
(`layout.immersive.stage` = `fixed inset-0 bg-base`, no app chrome, no
`mx-auto max-w-container`, no page `<h1>`) and one step further: the canvas is
the background of EVERY phase — arrive, personalize, introduce, converse,
adapt, close, replay — mounted once and never unmounted between them. A phase
change is a camera move plus a change in what is anchored over the render. It
is never a route change and never a remount, because a remount reloads the
island and the learner watches their own world blink.

**Anatomy**, from the render outward:

- **The canvas** — full-bleed, `bg-base` behind it for the first frame and for
  the no-WebGL fallback. It carries `role="img"` with a localized description
  of what is actually on screen, built from the same catalog values the picker
  uses, so the scene is described rather than simply absent for a blind
  learner.
- **World-anchored chrome** — the caption above the speaker's crown over a
  24 px gradient scrim, offer chips at the tutor's chest, rim pads on the
  island, recap chips at the places they recap, and one small rune over the
  sky for minutes-left. All WorldChip over HudPlate, each mirroring a
  pickable mesh, each hidden and inert when its anchor leaves the frame —
  and each culled against its own BOX, not against its centre point, so a chip
  is never left half off the frame and still focusable.
- **The lesson plate** — the ONE surface carrying a live exercise. **Desktop:
  a FLOATING plate**, `plate-max` 420 px wide, height fitted to content up to
  `plate-max-height` 62vh, inset `hud-inset` 24 px from the bottom-right, with
  scene visible above, below, left and right of it. It is explicitly **not** a
  full-height edge-to-edge column, and shrinking such a column to 400 px does
  not satisfy this: the rejected version's fault was the SILHOUETTE — a
  near-opaque slab down a third of the screen — and a silhouette is a
  perceptual fact that a `getBoundingClientRect()` measurement cannot argue
  with. **Mobile: a bottom sheet** with the three `sheet-detents` — PEEK
  (88 px, **where the sheet rests**), HALF (45vh, working), FULL (88vh,
  transcript opened), with the orb riding above whichever it is at. **PEEK is a
  SUMMARY ROW, not the top 88 px of the panel** (corrected 2026-08-21, after the
  owner tested a phone): one line saying what is waiting, a chevron, and the
  finish control, with the body not mounted at all. The distinction is what
  makes resting there honest — a clipped panel tells the learner nothing, so the
  sheet has to open itself to find out, which is precisely how HALF became the
  default and 45% of a 375x812 phone became chrome. **Nothing may raise the
  sheet except the learner**: an arriving activity says so on the row, in words
  and to a screen reader, and waits. The plate publishes its rect so the camera
  composes AROUND it: the character's on-screen height must be identical with
  and without a segment, or the lesson appears to shove the tutor out of the way
  to make room for itself.
- **The mic orb** — MicOrb, on the bottom safe area: centred from `lg:` up, and
  below that **sharing its row with the composer**, orb first. Height is the
  scarce dimension on a phone and the orb is the hero that keeps all 96 px of
  it, so what gives up a row of its own is the text field, which needs 48 px of
  a row the orb has already paid for (192 px stacked → 136 px measured at
  375x812). With the lesson plate and the way out it is one of exactly **three**
  viewport-anchored elements on the route; everything else is anchored to the
  world. All three are viewport-anchored for the same reason: a thumb does not
  move with the camera.
- **The way out** — a HudPlate chip at the top-left safe area (`hud-inset`,
  16 px mobile / 24 px desktop), back arrow plus one translated line, first in
  the tab order, above the loading veil, and **never culled**. It went from two
  to three here, on 2026-08-21, in the commit that fixed the reason: the way
  out had been a world rune on a sky mark plus an `sr-only` button revealed by
  focus, and neither is reachable by a pointer user in a close-up — the rune is
  culled the moment the camera stops framing the sky, and a skip link is
  revealed by a key nobody on a phone presses. This route removes the sidebar
  and the tab bar, so navigation has to come back somewhere, and a third
  floating PANEL is what the count of two was protecting against, not the
  navigation the immersive exception took away. **The count is closed again at
  three**; a fourth is an owner decision.

**Colour and contrast.** Every plate carrying body text uses the opaque
`bg-surface` floor; glass is the frame (§Colors → the opaque floor rule). One
indigo action per phase still holds, and during a conversation the mic orb IS
that action — so an offer chip is a secondary, not a second CTA.

**Responsive.** At 375 px: the sheet detents above, the orb at 96 px, and
anchored controls that clear the 44 px minimum tap target BY CONSTRUCTION —
invisible padded pick proxies sized from the character measurements, never by
hoping the mesh happens to be big enough at that camera distance. **The scene
keeps the majority of the viewport in every phase the learner did not ask to
change**, and that is a number somebody has to measure rather than a feeling.
Measured on `/dev/tutor-lab` at 375x812, from the top of the viewport to the
first pixel of HUD: 560 px resting in a live conversation, 452 px with an
adaptation question up, 612 px while the tutor is offering openings. A change
that drops any of them below half the viewport is a regression in the one
property this route exists for. The two numbers below half are both states the
learner chose by raising the sheet — 283 px at HALF, 136 px at FULL — and that
is the difference between a composition and an accident. At 1280 px
the freed width is spent on the SCENE: a wider establishing shot and real
island around the floating plate. That is a deliberate use of the width; an
empty margin either side of a centred column is not, and neither is a second
panel invented to fill it.

**THAT METRIC IS NOT THE PROPERTY IT WAS CHOSEN TO PROVE**, corrected
2026-08-21 the first time the stage was measured in a browser that was actually
compositing frames. Two things went wrong at once, and they are the same two
things /AGENTS.md §1.14 already records under "verified for subject, not only
for form".

The FIGURE was wrong: the openings phase reads 612 px, not 664 px. 664 was
taken in a tab that never reported a first frame, so `ready` stayed false, the
offer chips never mounted, and the two secondary chips that portal into the
dock's upper slot were missing from the dock being measured. A number measured
in the fallback arrangement is not a number about the real one.

The METRIC was worse. "Distance to the first pixel of HUD" counts EMPTY
BACKGROUND as scene, and the canvas is `alpha: true`, so the pixels the scene
actually paints can be counted exactly instead of inferred. Counted that way at
375x812: introducing 70.8%, conversing 100%, personalizing 13.8%, adapting
12.0%, arriving 6.5%, closing 6.3%, unavailable 6.2%. At 1280x800: conversing
58.7%, personalizing 55.9%, introducing 49.7%, adapting 34.9%, and the three
`establishing` phases 14.5%. So the claim above — the scene keeps the majority
of the viewport in every phase the learner did not ask to change — is TRUE for
the two phases that hold a character close and FALSE for the other five, by an
order of magnitude, and the metric that was supposed to defend it reported
88% clear on the very phase that paints 6.5% of the screen. `establishing`
fits the island's bounding box to the WIDTH, so on a 375 px portrait phone a
9.5 m island lands 241x122 px in the middle of an 812 px screen. That is the
owner's original "minimizaste el escenario", still present, in the phases
nobody had ever looked at. Scene coverage is the metric; distance-to-HUD is at
best a lower bound on how much room the HUD left, and a change is measured
against BOTH.

**What this recipe forbids by name**, because each one is a mistake that has
already shipped on this route: no `Card` from `components/ui` during a live
session; no two-panel `lg:grid-cols-[1fr_1fr]` split with the stage in one
half; no 2D thumbnail grid for choosing a character, an island or a backdrop
when tapping the thing itself is available; and no control that disappears
when it is unavailable instead of saying why (§Components → MicOrb).

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
characters, no upsell, indigo only for a true CTA. Empty/unavailable states
use the standard empty-state grammar (icon + title + caption in a resting
card), never a blank pane. Responsive per §1.11: KPI grids go 2-col mobile →
6-col desktop, Data tables collapse to stacked cards below `md:` (Table
component), the section sub-nav is the mobile section switcher. Roles &
Access simply does not render (route + sidebar) for a plain admin.

**Assessment / Profile / Catalog** — same grammar: bands, cards, pills,
IconChips; a profile hero may use a inverse band with a glass-deep identity card.

## Do's and Don'ts

- ✅ One indigo CTA per view; blue for links/info; violet only to celebrate.
- ✅ Frosted glass for anything that floats; opaque cards for anything at rest.
- ✅ Verify both themes and both breakpoints before closing any task.
- ❌ No raw hex, no ad-hoc font sizes, no sharp corners, no native pickers.
- ❌ No inset-shadow stacks, no 3D bottom-border buttons, no scale-on-hover
  buttons (lift is for cards only).
- ✅ On the immersive layer, every control is IN the frame and every plate
  carrying text stands on an opaque floor.
- ❌ No emojis as icons (country flags in the language switcher are the one
  exception). No new infinite animations — with ONE carve-out, the Tutor
  stage's ambient camera drift (§Motion), which is bounded by reduced-motion,
  by the quality governor and by the duration of any live segment. A carve-out
  with three off switches is a rule; a carve-out with none is how the next one
  gets argued for.
- ❌ Never assemble a screen out of another screen's recipe because it is the
  nearest one that exists. That is what turned the Tutor into a dashboard.
  Write the recipe first (§0), in the commit that builds the screen.
