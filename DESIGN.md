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
    # ── immersive layer only (Tutor stage). See §Lumen → Type. ──
    lf-speech:     {size: 19px (21px >=sm), weight: 500, tracking: -0.006em, line-height: 26px (29px >=sm)}
    lf-action:     {size: 15px, weight: 600, tracking: -0.004em, line-height: 20px}
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

lumen:                            # CLOSED — the immersive layer's ONE material (§Lumen)
  alpha: 0.68                     # chrome. THE contrast bound; one ink only
  alpha-reading: 0.86             # the one paragraph surface per phase; may use content-muted
  blur: 24px                      # backdrop blur — removes detail, not just softness
  chroma: 0.45                    # backdrop saturate(): keep luminance, drop hue
  tint: 6%                        # how far the fill leans toward the scene's sky
  atmosphere: [--lf-sky, --lf-key, --lf-ground, --lf-sun-height]   # published per backdrop
  radius: {chip: full, plate: md, orb: full, sheet: md}   # capsules — reversed 2026-09-05
  tap-floor: 44px rendered / 48px authored

answer-surfaces:                  # CLOSED — the lesson engine's THREE objects (§Answer surfaces)
  objects: [lf-well, lf-slab, lf-answer]   # recessed / resting / tappable. No fourth.
  states: [idle, selected, correct, wrong, dimmed]  # + hover, focus-visible, disabled
  lift: 7%                        # how much more key light an object catches than its pane
  edge: "ink 11% (19% hover)"     # ink, not shade — darkens light, lightens dark
  rim: "key light, half the Lumen ramp"
  seat: "one drop, same sun as Lumen, ~1/3 the throw"
  wash: "the theme's own -soft token; ring + mark carry the state"
  second-channel: "AnswerMark — empty ring / filled check / filled cross + sr-only word"
  tap-floor: 48px                 # the control a child mis-taps most

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
    plate-max-height: calc(100vh - 200px)   # a BAND of island above it, not a fraction
    plate-island-band: 176px      # what the line above buys: island over the plate, any screen
    sheet-detents: {peek: 88px, half: 45vh, full: 88vh}   # mobile bottom sheet
    orb: {mobile: 96px, desktop: 112px}   # the primary in-scene control

motion:                           # CLOSED 5-recipe system
  ease: cubic-bezier(0.22, 1, 0.36, 1)
  durations: {fast: 150ms, base: 200ms, slow: 300ms, page: 350ms, reveal: 550ms, atmosphere: 600ms}
  settle: "lf-settle — opacity + scale(0.965) + blur(4px), slow, backwards (§Lumen → Motion)"
---

# LittleFounders Liquid Glass — Design System

> **AUTHORITATIVE** for all frontend visual work (root AGENTS.md §1.1 rank 4).
> The tokens above are CLOSED sets — implemented 1:1 in
> `frontend/tailwind.config.js` + `frontend/src/index.css`. Never invent values
> those files don't define. **Last updated:** 2026-08-24 (§Screen Recipes —
> *Learn*, the recipe the four learn routes were built without; 2026-08-23 —
> §Answer surfaces — "the tap
> floor has two sides" and "a broken-glyph check must measure the GLYPH", after
> looking at all 57 exercise renderers; 2026-08-22 — the lesson engine's three
> objects, shared by the Lesson Player and the Tutor, plus "a shape is a PROP,
> never a `className`"; and §Lumen — the Tutor's material, type, motion and
> light).

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
- **Text over a live render — SUPERSEDED 2026-08-22 by §Lumen.** From
  2026-08-21 this section carried an OPAQUE FLOOR rule: body text over the
  Tutor's canvas had to sit on an opaque `bg-surface` token, because the
  contrast floor above is a ratio against a KNOWN background and a translucent
  plate over an orbiting camera has no known background. That premise was half
  right, and the half that was wrong cost the whole route its material: there
  is no single background, but **alpha puts a FLOOR under the composite**, so
  the ratio a moving render cannot give you as a measurement it still gives you
  as a BOUND. §Lumen states the bound, and `HudPlate.test.tsx` re-derives it
  from the shipped stylesheet for every backdrop in both themes. The rule that
  survives unchanged is the one that mattered: **no ad-hoc alpha.** The
  material's two densities are the closed set on that layer, and a surface that
  needs a third needs a design decision, not a slash.

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

### The propagation (2026-09-07) — what "standardized" now means

The study's composition was applied to every product surface except marketing,
which the owner deliberately excluded so `site.mjs`, the sitemap and the share
cards stay valid. What landed, and what it is safe to assume from now on:

- **Shape is settled everywhere.** 82 panels at 32px moved to the study's 16px;
  `Card` went hero 32→24 and ordinary 24→16; admin's remaining 24px panels and
  two bare `rounded` (which compiles to nothing) went to 16px; icon buttons that
  were soft rectangles became circles. Buttons were already capsules in the
  shared primitive, which is why that half of the decision reached every screen
  for free.
- **`SectionHeading` exists** (`components/ui`), so the study's lockup is a
  component rather than something each surface re-invents. Its `tone` is
  REQUIRED: a lockup whose colour never changes has stopped saying anything,
  and the hue is what keys the controls beneath it.
- **`OptionGroup` is a pick-card group.** It is the platform's only generic
  "choose one of N", so recomposing it reached onboarding as well as the
  surfaces that called it directly.
- **Onboarding and placement introduce the cast in 3D.** Both share
  `GuidedStage`, so the swap happened once. It uses `CharacterStage` ("one
  character, no world"), lazily imported because it pulls three.js onto the
  FIRST screen a guest sees, with the real 2D actor rendering underneath while
  the chunk arrives and standing in permanently where there is no WebGL —
  `SceneCanvas`'s honest "this device cannot show 3D" message is right on the
  Tutor's route, where the island IS the product, and would be a regression on
  a first-run screen where a flat character already worked.

**Where the composition was deliberately NOT applied, and why it is not an
omission:** admin's filter and search bars (a lockup there costs 40px above the
first data row and names what the field labels already name), tables (none was
wrapped in a decorative card), a chart's own filter checkbox (a settings row
above a 260px chart costs more height than it earns), and single-field screens
like Forgot Password (a lockup names a GROUP; one field is not one). Readability
of a data tool beats decoration — that is a rule, not a compromise.

## Shape — the radius scale is CLOSED (NON-NEGOTIABLE)

`tailwind.config.js` REPLACES Tailwind's radius scale rather than extending it.
These six are the whole set, and a utility naming anything else **compiles to
nothing and renders as a square corner** — silently, with the class still
sitting in the markup saying otherwise.

| Token | Value | What wears it |
|---|---|---|
| `rounded-none` | 0 | full-bleed surfaces only |
| `rounded-sm` | 10px | inline marks: a term, a small tag |
| `rounded-md` | 16px | **every card, panel, sheet and dialog body** |
| `rounded-lg` | 24px | the largest furniture: a modal shell |
| `rounded-xl` | 32px | reserved; nothing should need it below a hero |
| `rounded-full` | 9999px | **every button, chip, badge, pill and orb** |

**Two shapes carry the product's whole silhouette:** `full` for anything you
press, `md` for anything you read on. A screen built from those two reads as
the study; a screen with a third radius in it reads as an accident.

**Where those two rules meet — a card you press — the CARD wins.** An answer
option, a `.lf-pick-card`, a course tile and a lesson row are all tapped and
all stay at `md`: they carry content you read before you choose, and a capsule
around a paragraph is a lozenge, not a button. `full` is for controls whose
whole body is a label or a glyph. The test is not "does it respond to a tap",
it is "would you read this if it did nothing".

**Two things that look like buttons and are not.** A text link keeps its small
radius, which exists only to shape its focus ring — a capsule around underlined
prose is a badge. And a text input stays at `md` for the reason above: a
capsule moves the caret off the field's own left edge and reads as a search box
wherever it is not one.

**`2xl`, `3xl` and `xs` DO NOT EXIST HERE.** Tailwind's stock `2xl` is 16px,
which this scale calls `md` — so the rename is exact, never an approximation.
On 2026-09-06 fifteen call sites were asking for `rounded-2xl`, including the
Tutor's floating panel and its speech card, and every one of them was measured
in a real browser at `border-radius: 0px`. `designClasses.test.ts` now fails on
any radius outside this table; that guard shipped broken first (its regex
reached the file with two backspace characters where `` was meant) and was
only trusted after a violation was deliberately re-injected and watched to
fail.

## The study's component set — what a recomposed surface is made of

Every surface in the platform is composed from these. They are defined once in
`index.css` and named here so a screen can be reviewed against a list rather
than against somebody's memory of a screenshot.

| Class | What it is | Where it belongs |
|---|---|---|
| `.lf-tile` | A small square well at 12px carrying an icon: an 18%-fill and a 34%-border of `currentColor`, so one class serves every hue and a caller only names a colour | Beside a section heading, at the head of a card, in a settings row |
| `.lf-pick-card` (+ `-on`, `-check`) | A choosable card. Selection is signalled FOUR ways at once — solid fill, 2px border at full strength where the resting card has 1px at a tenth, an outer coloured glow, and a corner check disc | Any grid where one of N is chosen: a tutor, a world, a plan, an avatar |
| `.lf-config-row` | The settings-row skeleton: icon, two lines of label, a control pinned right | Preference rows, toggles, segmented controls |
| `.lf-switch` (+ `-on`, `-knob`) | 44x24, the knob sunk into the track by an inset shadow, ON expressed as a flex alignment rather than a transform | Any boolean a learner owns |
| `.lf-config-dialog` / `-scrim` / `-head` / `-foot` | The modal shell at 24px over a BLURRED scrim — never an opaque veil, because what is behind it is the product still running | Any full-screen dialog |
| `.lf-rail-bare` | Stops a positioned column from painting, so the cards inside it become the surfaces and the background shows through the gaps | A rail of separate cards over a scene |
| `.lf-eyebrow` | Wide-tracked small caps. Paired with a `.lf-tile` in the section's own hue, this is the study's strongest typographic signature | Above every group of controls |

**The section heading is a lockup, not a heading.** Icon tile in the section's
hue, `.lf-eyebrow` label, and an optional meta note pinned right. The hue then
KEYS the cards below it, so a glance at the icon says which set you are
choosing from — that is the whole reason it is coloured, and why a section
whose cards select in indigo must not have a cyan icon.

**Three tiers of action, in this order, left to right:** ghost (no surface,
muted ink) → glass (the material, ordinary ink) → primary (solid accent, a
coloured ambient glow of its OWN hue, a lighter rim, and a press). A row with
two primaries has no primary.

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
5. **Over a live canvas** (the Tutor stage): NOT this system. That layer has
   its own material, `.lf-lumen` (§Lumen), which takes its fill, its edge, its
   specular lip and its shadow from the scene's own light rather than from these
   tokens. Depth there comes from ONE shadow that agrees with the sun instead of
   five atmospheric layers that agree with nothing. **Exactly two z-bands, and
   no third:** world-anchored chrome
   (chips, caption, runes) below, viewport-anchored chrome (the mic orb, the
   lesson plate, the way out) above. A third band is how a control ends up
   rendered underneath the thing it controls — and on a stage where everything
   moves, nobody can tell that from a bug in the projection. The loading veil
   is not a band: it covers the whole stage and lifts, and the way out is the
   one control that outranks it, because a stage that never reports a first
   frame is the state a learner most needs to leave.
6. Never stack glass on glass; `@supports` fallback to near-opaque surface.

## Lumen — the immersive layer's material (added 2026-08-22)

> **Scope.** Everything in this section applies to the two immersive surfaces
> and nowhere else (`layout.immersive`, today the Tutor stage). The rest of the
> product is Liquid Glass and stays Liquid Glass. Two materials is not
> inconsistency — a page holds still and an island does not, and a material that
> ignores that difference is what produced the look this section replaces.

**What was wrong, stated plainly, because every rule below is an answer to it.**
Driven through all seven phases at 375x812 and 1280x800 in both themes, the
Tutor read as *a warm claymation diorama with white rounded pills on top of it*.
Charming, childlike, and not premium. Four causes, all measurable:

1. **Every control was opaque.** `HudPlate` was a `.lf-glass` frame around an
   opaque `bg-surface` core, so the only translucency on screen was a 2 px ring
   around each plate — which is precisely the silhouette of a sticker. The
   island could not be seen through anything.
2. **Every control was a pill**, and a capsule over a photographic frame reads
   as something applied to the picture rather than something in it.
3. **The world had no atmosphere.** The canvas is `alpha: true` and everything
   it did not paint was one flat `bg-base`. In `arriving` at 375x812 the canvas
   paints 50.8% of the viewport, so the other 49% was one unchanging token with
   three small plates on it. An island on a blank page is clip art.
4. **There was no type hierarchy at all.** Counted across `tutor/` and
   `tutor-scene/`: 70 uses of `lf-caption` (12 px) and 30 of `lf-body` against
   ONE `lf-display-lg`. The dominant voice on a cinematic stage was the smallest
   token in the system, and control labels were `lf-label` — 14 px at weight
   700, the voice of a dashboard toolbar.

### Material — one surface, and it is a lens

`.lf-lumen` is the only material on this layer. Chip, plate, orb, sheet and the
composer are all made of it; `HudPlate` is where it is applied once instead of
remembered fourteen times.

| Property | Value | Why |
|---|---|---|
| fill | `surface` mixed `6%` toward `--lf-sky`, at `--lf-lumen-alpha` | it belongs to the hour the island is standing in |
| backdrop | `blur(24px) saturate(0.45)` | detail behind text is REMOVED, and what comes through keeps its luminance and loses its hue, so the plate never picks up a colour that competes with the words |
| lip | `inset 0 1px 0` in `--lf-key`, alpha ramped by sun height | a specular edge in the scene's own light — never a white hairline |
| edge | `inset 0 0 0 1px` in `--lf-lumen-shade` at 9% | the scene's shade, not a lighter ring |
| shadow | one drop, made of the ground's colour, length/diffusion/darkness ramped by sun height | it agrees with the light behind it instead of with the stylesheet |
| radius | chip `full`, plate `md`, orb `full`, sheet `md` | capsules and 16px cards — reversed 2026-09-05 by owner direction to match the design study, which makes every chip, badge and small button a capsule and every card 16px. The superseded rule ("panes, not pills") argued a capsule over a photographic frame reads as a sticker; it lost to the study, three times over, in front of the owner |

**Two densities, and the density is decided by how much text the surface
carries, never by taste.**

- **`.lf-lumen` — chrome, `alpha 0.68`.** Labels, chips, captions, the orb, the
  way out. A third of the island comes through. **ONE INK:** `content`.
- **`.lf-lumen-reading` — `alpha 0.86`.** The ONE surface per phase that carries
  paragraphs: the lesson plate, the transcript sheet, the composer. It may use
  `content-muted`, and it pays for that in opacity. The densest surface on
  screen being the one the eye is meant to settle on is not a compromise, it is
  the hierarchy.

**THE CONTRAST CONTRACT, and it is arithmetic rather than taste.** The old rule
put text on an opaque floor because a translucent plate over an orbiting camera
has no known background. True — and alpha still puts a FLOOR under the
composite, so the ratio exists as a BOUND. The worst case a 3D render can
produce is pure black behind a light-mode plate and pure white behind a dark one;
nothing can be outside that. At the chrome alpha, `content` measures **7.2:1 in
light and 5.4:1 in dark** against those two extremes. At the reading alpha,
`content-muted` measures **4.96:1 and 7.2:1**. `content-muted` on CHROME measures
3.6:1, which is why the one-ink rule is a rule and not a preference — and the
material enforces it rather than trusting call sites: inside `.lf-lumen` a
`text-content-muted` or `text-content-faint` utility is neutralised to full ink
by the stylesheet.

`HudPlate.test.tsx` re-derives all of it from `index.css` itself, for every one
of the five backdrops, in both themes, on every run. Lowering either alpha turns
those cases red. **This replaces the opaque-floor rule; it does not relax it.**

**No third density, no second glass, no `.lf-glass` on this layer.** A surface
that seems to need one needs a design decision. And the material owns
SELECTION — `.lf-lumen-selected`, not Tailwind's `ring-*`, because `ring-2`
writes `box-shadow` and utilities outrank components, so a chosen plate used to
lose its edge, its lip and its shadow at the exact moment it was meant to look
more present.

**Tap targets are a property of the MATERIAL here, not of the stylesheet.** An
anchored control is multiplied by its distance from the camera, so `min-h-11`
was 44 px of layout and 33 px of glass: six controls measured under the floor at
375x812, on a rule /AGENTS.md §1.11 calls non-negotiable. Two halves close it —
`HudPlate` authors interactive plates at **48 px**, and `ScreenAnchor` clamps the
depth scale so the **smallest control inside an anchored node** never renders
under **44 px**. The extra 4 px is what leaves the depth cue any room to exist
in; a control authored at exactly 44 pins its whole cluster to full size. As of
2026-08-22 the count under the floor is **0** in all seven phases, at both
breakpoints, in both themes.

### The blur, profiled — what the material's one expensive property costs

Until this pass, `backdrop-filter` was the only thing in §Lumen carried on an
argument instead of a number, and the debt list below said so in those words:
*reasoned rather than profiled on the target hardware*. It is profiled now, and
the answer is short — **on everything that could be measured it is cheap, and it
still comes off the `low` tier, for reasons the profile itself supplies.**

**What was emulated, stated first, because a number off an unthrottled desktop
is worse than no number: it gets believed.** Headless Chrome over CDP against
`/dev/tutor-lab`, in `conversing` and `adapting` — the two phases carrying the
most Lumen surfaces — at **375x812 CSS with `deviceScaleFactor: 3`**, which is a
budget Android's actual pixel count (1125x2436), with `mobile: true`, touch
emulation on so the scene's own probe sees a coarse pointer and starts where a
phone starts, and a Moto-G user agent. CPU throttled with
`Emulation.setCPUThrottlingRate` at **1x, 4x and 6x**. The GPU is a real one —
`ANGLE (Intel, Intel(R) UHD Graphics (0x0000A7A8), D3D11)`, the same target
Intel UHD the debt named — and deliberately **not** SwiftShader, because the
question is what a compositor costs and a software rasterizer is not one. Each
cell loads the page once, settles 12 s so the quality governor has latched, then
A/Bs the SAME live page `on → blur(8px) → off → on`, so the only thing that
changes between windows is the filter and tier drift would show as a discrepancy
between the two `on` windows rather than as a bias. It never did: every cell held
the `high` tier throughout. Frames are counted two ways — `requestAnimationFrame`
gaps (what the learner is actually presented) and the GPU process's own trace
(`Display::DrawAndSwap`, `DirectRenderer::DrawRenderPass`,
`DirectRenderer::DrawFrame`).

**How faithful that is, stated just as plainly.** `setCPUThrottlingRate` slows
the renderer's MAIN THREAD and nothing else — and this measurement is what
proves that matters here: at 6x the main thread goes from 150 ms to 900 ms of
busy time per wall second and the blur's cost does not move at all. It is not
CPU work. So the emulation is faithful about the pixel count, about the tier a
phone starts on and about the main-thread budget, and it is **silent about a
phone's GPU**, in two ways that are named rather than smoothed over. An Intel
UHD has several times the fill rate of an Adreno 610-class part; and it is an
immediate-mode renderer, where a phone's is tile-based and pays for every extra
render pass by resolving the tile buffer out to memory and reading it back
again. That second one is the actual reason `backdrop-filter` has the reputation
it has on mobile, and no desktop emulation reproduces it. Which is why the
render-PASS COUNT is reported beside the milliseconds: the milliseconds are this
machine's, the pass count is the number that transfers.

**Measured**, 375x812 at dsf 3, light theme, `on` averaged over the two windows
either side of `off` (dark theme cross-checked at 1x: 0.81 ms vs 0.13 ms of
compositor draw, identical — the cost has no theme):

| | conversing | adapting |
|---|---|---|
| Lumen surfaces painted | 7 | 8 |
| blurred backdrop | 97.7k CSS px² (0.88 Mpx at dsf 3) | 81.6k CSS px² (0.73 Mpx) |
| compositor render passes / frame, blur **on** | **4** | **2** |
| … blur **off** | **1** | **1** |
| `DirectRenderer::DrawFrame`, blur on → off | 0.78 → 0.13 ms | 0.79 → 0.13 ms |
| … with `blur(8px)` instead of 24px | 0.60 ms | 0.60 ms |
| presented fps, on → off, **1x** CPU | 103 → 107 (+0.4 ms/frame) | 118 → 124 (+0.4 ms) |
| … **4x** | 103 → 109 (+0.5 ms) | 110 → 120 (+0.8 ms) |
| … **6x** | 76 → 82 (+1.1 ms) | 64 → 66 (+0.4 ms) |

**Four things follow, and every one of them is load-bearing.**

1. **The blur costs about half a millisecond of presented frame time** — 0.4 ms
   typical, 1.1 ms worst measured — and 3-8% of throughput. On anything with a
   desktop-class GPU it is cheap. Stop worrying about it there.
2. **The cost is the RENDER PASS, not the radius, and not the pixels.** Dropping
   24px to 8px — which would gut the material, since removing detail behind text
   is what the blur is FOR — recovers only 0.18 of the 0.65 ms. And the same
   scene measured at `deviceScaleFactor` 1, 2 and 3 blurs 0.098, 0.39 and
   0.88 Mpx of backdrop for a compositor draw cost of 0.70, 0.63 and 0.65 ms:
   **flat**. Nine times the blurred pixels, the same cost. So the expense is the
   three extra passes existing at all, which means the graduated "cheaper blur
   on weaker devices" that looks like the obvious answer would pay almost the
   whole price for none of the look. **The only lever worth having is on/off.**
3. **CPU throttling does not touch it**, per the paragraph above. A device is
   not demoted for being slow at JavaScript and then charged for the blur; the
   two costs live on different sides of the process boundary.
4. **On a rasterizer that IS the bottleneck it is still under a tenth of the
   frame.** The pessimistic bracket — the same page under SwiftShader, where
   every pixel is drawn on the CPU and the governor duly falls to `low` — runs
   at 11.7 fps with the blur and 12.9 without at 1x, and 11.4 against 12.5 at
   4x. That is **+7.6 ms, or 9% of a frame**, in a regime roughly eight times
   slower than the iGPU. It is not a phone GPU and is not offered as one; it is
   the floor, and the floor says the blur is not what breaks a weak device.

**The decision: the blur comes off `low`, and off nothing else.**
`QualitySettings.lumenBlur` sits beside `maxPixelRatio`, `shadows` and
`ambientMotion` in `tutor-scene/quality.ts`, false only on `low`; `StageShell`
publishes it on the stage root as `data-lumen-blur="off"`, and three inherited
custom properties carry it down to every plate. Three reasons, in order of
weight:

- **`low` is the one device class this profile could not emulate.** Everything
  above is measured; nothing above is an Adreno. Wiring the switch costs one
  attribute and turns an unmeasurable risk into a defined behaviour.
- **`low` is not a guess about hardware.** It is where the governor puts a
  device that has twice failed to hold 45 fps on its own frames
  (`tutor-scene/governor.ts`) — the same evidence that already took its pixel
  ratio, its antialiasing, its shadows and its ambient motion away. The device
  that loses the blur is the device that has demonstrated it cannot pay for it.
- **On that tier the blur is buying the least.** At `low` the pixel ratio is
  already 1 and the scene behind the plate is at its coarsest; 9% of a frame
  that is already missing its budget is being spent softening a backdrop the
  device is barely drawing.

**What it degrades TO is the form the stylesheet already had.** The backdrop
token set to `none`, and both alphas raised to `--lf-lumen-alpha-flat` **0.97** —
byte-identical to what a browser with no `backdrop-filter` gets, because there
should be exactly one blur-less Lumen and one place its value is written. No
blur means the island comes through SHARP behind the words, and removing that
detail is what the blur was for, so the plate **closes** rather than merely
defrosting. It keeps the sky-leaning fill, the key light's lip, the
ground-coloured shadow and the pane radius: Lumen with the window shut, not the
opaque-floor era coming back, and not a fourth material. The contrast bound can
only improve — 0.97 is denser than either published density — which
`HudPlate.test.tsx` asserts rather than assumes, and the swap rides the
material's existing 300 ms `background-color` transition, so a device demoted
mid-session closes its plates rather than snapping them.

And the switch was then measured through ITSELF rather than through the CDP
override that produced the table — `conversing`, dsf 3, 1x: **4 render passes →
1, 0.78 → 0.14 ms of compositor draw, 102.4 → 108.4 fps**. Looked at, too, at
375 and 1280 in both themes: the flat plate reads as the same material with the
window shut, which is the whole test a graceful degradation has to pass.

### Type — one confident line

Two additions to the closed scale, both fenced to this layer:

- **`lf-speech`** — the tutor speaking. 19 px / 500 / 26 px, `-0.006em`,
  balanced; 21 px from `sm:`. It is the largest type on the stage after the
  character. There was no token between `lf-body` (16/400) and `lf-headline`
  (20/700), so the tutor's own voice was being set in body copy inside a bubble.
- **`lf-action`** — a control in the world. 15 px / 600 / 20 px, `-0.004em`.
  Bigger and LIGHTER than `lf-label`, because confidence over a picture comes
  from size and air; 700 in a small box reads as shouting.

**`lf-caption` is prohibited on world-anchored chrome, AND THE MATERIAL ENFORCES
IT** (added 2026-08-22, the applying pass). 12 px over a moving render at arm's
length is not a size, it is an apology. Stated as a rule it was remembered
rather than guaranteed: the applying pass found 21 live `lf-caption` call sites
still sitting on chrome plates, on controls a six-year-old is meant to hit while
looking at a dinosaur. So a caption inside `.lf-lumen:not(.lf-lumen-reading)` is
rendered at `lf-action`'s metrics by the stylesheet, exactly as `content-muted`
is neutralised to full ink one rule above it — same `:where()`, same 0-2-0
specificity, no `!important`. The class still means "the quiet one" everywhere
else in the product, and it still means it inside a `reading` surface, which is
held at a fixed distance from the eye and is where a genuine secondary line
belongs.

**What the depth scale then does to it, measured rather than assumed.** An
anchored node is multiplied by its distance from the camera, and the floor under
that is the node's own font size (`ScreenAnchor` → `MIN_READABLE_PX` 12). On
`/dev/tutor-lab` the tutor's caption renders at **20.7 px at 1280x800** and
**15.7 px at 375x812** — the largest type on the stage after the character,
which is the order §Type asks for — and a world chip's label renders at
13.7 px, held there by the 44 px TAP floor rather than by the text floor. A chip
is a two-word label inside a guaranteed 44 px target; the sentence a learner
reads is the caption, and that one is never smaller than `lf-action`.

**And that last sentence is now enforced rather than observed** (corrected
2026-08-22). It was true of the two phases anybody had screenshotted and false
of a third. The projector's readability floor is 12 px for every node, which is
the right floor for a chip — and no chip ever reaches it, because the 44 px tap
floor stops it first. Nothing stopped the caption, because nobody presses a
caption: measured at 375x812 during an adaptation offer, the two-shot's
stand-off clamped the tutor's spoken line to exactly **12.0 px**, smaller than a
chip's label and smaller than the 15 px this section guarantees any chrome
caption, while the same tutor's question one plate below it was 19 px. The floor
is per-node now (`ScreenAnchor` → `AnchorOptions.minTextPx`) and the caption
asks for `lf-action`'s 15.

**One confident line, and the one-ink rule is what enforces it.** At the chrome
density there is no legible quieter ink to demote a second line into — so a line
that only works as a whisper is a line to delete. First application, in the same
commit: the audition's world plates said "Dr. Rho / Your tutor" and now say
"Dr. Rho". Nothing was lost — the chosen tutor wears the selection ring and
announces `aria-pressed`, and the panel's list still carries every candidate's
full description in a column that has room for one. It also bought back a
candidate: the two-line plate pushed Liruf's cluster off the right edge of a
375 px frame once the tap floor stopped it shrinking.

### Motion — it settles, it does not pop

`.lf-settle` — 300 ms (`slow`), `--lf-ease`, `backwards`: opacity 0→1,
`scale(0.965)`→1, `blur(4px)`→0. Stagger `.lf-settle-2` / `-3` at 80/160 ms,
the existing Reveal cadence. `.lf-settle-out` leaves in 150 ms, because leaving
faster than arriving is most of what "weight" means in motion.

Three rules keep it from fighting the stage:

1. **The entrance lives on the PLATE, never on the anchored node.**
   `ScreenAnchor` rewrites that node's whole `transform` every frame, so an
   animation declared there is erased sixty times a second. This is why the
   material animates `scale` and `filter` and never `translate`.
2. **Culling is a CUT; unmounting is a FADE.** A chip that leaves because the
   camera turned away has left the picture, and fading out something already
   off-frame animates a lie. A chip that leaves because the phase changed uses
   `.lf-settle-out`. They are already two code paths; they now look like two
   things.
3. **`backwards`, not `both`.** With `both` the final keyframe wins forever,
   which would pin every plate to `opacity: 1` and silently break the one
   control that dims itself.

**Reduced motion is a MODIFIER.** `.lf-settle` swaps to a 120 ms opacity
cross-fade with no delay. Movement is removed; the ARRIVAL is not, because "a
new thing is here" is information, and a learner who asked for less movement did
not ask to stop being told. `Reveal` is replaced by `.lf-settle` on this layer —
its 20 px rise is a position animation, which §Motion recipe 10 already forbids
here.

### Light — the HUD is lit by the scene

The island has four times of day and they genuinely relight it. Four values
describe that light and the whole layer reads them:

`--lf-sky` · `--lf-key` · `--lf-ground` · `--lf-sun-height` (0 = on the horizon,
1 = overhead).

They are **registered** custom properties (`@property`), which is what makes a
colour transitionable, and they are written **once per backdrop change** by the
stage root from the same palette `SceneLighting` points its lights with
(`tutor-scene/atmosphere.ts`). The transition is `--lf-dur-atmosphere` 600 ms —
not a design choice but the settle time of the scene's own lerp, so the HUD
arrives at the new hour exactly when the island does. `auto` publishes NOTHING
and lets the stylesheet's light/dark defaults stand, which is also why the stage
needs no theme provider to render.

What that buys, all of it free at runtime:

- The plate's fill leans toward the sky; its lip is the key light's colour; its
  shadow is made of the ground's bounce and grows long as the sun sinks.
- **`.lf-stage-ground`** replaces the flat `bg-base` behind the canvas with the
  same sky and ground, plus one glow that rides up and down with the sun. This
  is the single highest-leverage change in the pass: it is what stops the island
  reading as a cutout on a blank page, and it costs one paint.

**THE GROUND COMMITS TO THE HOUR** (corrected 2026-08-22). It used to pull each
stop most of the way back to the theme's base — 18% / 66% / 58% — on the
reasoning that a background should stay a background. Driven in the LIGHT theme
with a non-day light, that produced a screen whose top half was warm dusk and
whose bottom half was flat white, with the island floating on the seam between
two different times of day. The hedge was the bug, and the premise under it was
what was wrong: **the alpha the canvas does not paint is not page behind a
picture, it is the same air the island is hanging in, and air does not have a
theme.** This section already says the four chosen hours are honoured
identically in light and dark, because someone who picked Dusk asked for dusk;
the ground is the last surface to obey it. The mix is now 6% / 28% / 34% base —
enough that `auto` (which publishes nothing, and whose sky IS the theme's own
default) still reads as the theme, and little enough that a chosen hour reaches
the bottom of the screen. The bottom stop stays the GROUND colour rather than
the sky, because the light under a landmass is light bounced off it: the frame
darkens and warms toward the bottom exactly as it would under a real one, and
that is most of what makes the island read as floating.

**AND THE CAST TAKES THE LIGHT** (added 2026-08-22). Four times of day genuinely
relit the island and reached the characters standing on it not at all, which is
half a feature. Every character `.glb` ships two export defaults —
`metallicFactor: 1` with no metalness map, and its own base-colour texture in
the emissive slot at full white — and together those mean no diffuse term plus
the albedo added back as EMISSION. What reached the screen was the flat texture,
self-illuminated, with a rough metallic sheen on it: a decal of a character,
with no form and no relationship to the sun. It produced two different symptoms
and only one of them ever got reported. A saturated character (Dina) survived it
and read as solid; a pale, low-contrast one (Liruf) washed out against orange
sand and read to a reviewer as **"renders SEMI-TRANSPARENT"** — which he does
not: with the camera frozen and every other mesh hidden, 87.6% of his silhouette
is pixel-identical to a solo render. He was unlit, not transparent, and so was
everybody else. `tutor-scene/characterMaterial.ts` turns an unlit export back
into clay at load, on the fingerprint of the export DEFAULT and never on
authored intent, so a real glowing part and both islands' per-texel metalness
are left exactly as they are. The cast now has form, contact shading, and a
highlight that follows the key light — which is what makes dawn, dusk and night
visible ON the characters and not only on the ground they stand on.

**What is deliberately NOT tracked: the shadow's DIRECTION.** The sun's
screen-space azimuth depends on the live camera, so following it means a style
write per frame — and a custom-property write invalidates style on everything
that inherits it, which here is the entire HUD. Length, diffusion and darkness
are what a viewer actually reads as an hour; direction stays straight down.
**Nothing on this layer may be written per frame except an anchored node's own
`transform`.**

### One line, one printing, two channels (added 2026-08-22)

> This supersedes the reading of *What to delete* → *the duplicated tutor line*
> that kept two full printings of one sentence. The RULE it was protecting — two
> channels, because a deaf learner needs both — is unchanged and is now
> guaranteed in one place instead of remembered in two.

**The requirement, in the owner's terms, first, because everything below is
subordinate to it.** A deaf or hard-of-hearing learner gets the tutor's words as
a CAPTION over the speaking character's head, and gets the 2D ANIMATED HEAD,
because `liruf` and `dina` have no mouth in 3D (/TUTOR_3D.md §3.1) and all four
are selectable as the tutor (/ORACLE.md §0 decision 4). Neither channel is
negotiable and neither has been removed.

**What was wrong, measured.** At 1280x800 in `conversing` the same sentence was
printed twice, 252 px apart: once in the caption over the crown at `lf-speech`,
and once in the 2D bubble at the top of the lesson plate, also at `lf-speech`.
Twenty-one spoken words became forty-two printed ones inside 142 words on
screen. And it was not only noise — the bubble was 132 px of the plate's 436 px
of usable height, on the surface where 274 px of live exercise was already
running past the bottom edge. The learner was scrolling past a second copy of a
sentence that was still on screen above them to reach the answers to it.

**The reading that produced it.** "Both channels stay" was implemented as "both
SURFACES print the whole sentence". That is one reading of the requirement and
it is the expensive one: whichever copy the learner reads, the other is noise,
and the two channels the owner asked for are *words* and *a moving mouth* —
not *words* and *words again*.

**The decision.** The two channels share ONE surface. The caption over the
speaker's crown carries the sentence AND the articulating 2D face
(`TutorFace`, inside `SpeechCaption`). Mouth and words are one glance, which is
the argument the caption's POSITION has rested on since it was written, now
applied to the mouth as well. The lesson plate carries the activity and the
conversation RECORD, and never a second copy of the live line — the log already
withheld it (`TutorTranscript` → `spokenSeq`), and now nothing else prints it
either. **At any instant the tutor's current sentence exists exactly once on
screen, and both channels are on it.**

**What that cost and bought, measured on `/dev/tutor-lab`:**

| | before | after |
|---|---|---|
| printings of the live line, 1280x800 | 2, 252 px apart | 1 |
| words on screen for 21 spoken (en-US) | 142 | 121 |
| the 2D mouth's rendered size | ~5 px, inside a 64 px whole-body figure | a cropped face filling a 44–56 px box |
| plate height freed | — | 132 px |

**And the mouth is now a mouth.** The bubble mounted a whole standing figure in
a 64 px box: Dr Rho's head group measures 196x183 of a 750x750 viewBox, so his
head landed at about 17 px and his mouth at about five. Five pixels of mouth is
not an articulation channel; it is a thumbnail of a character standing up, and
the requirement was being honoured in the component tree and nowhere on the
screen. `TutorFace` crops to the head, and it does it by MEASURING the artwork
rather than by tabulating four sets of magic numbers: the four characters are
four independent SVGs with four viewBoxes and four head transforms, but every
one of them has a head group (they need it for their own look-at rigs), so the
component reads that group's rendered rectangle and solves for the transform
that seats it in the box. If it cannot measure — no head group, no layout, a
test environment — it leaves the figure alone, which is the old behaviour: a
smaller picture, never a wrong one.

**One defect it produced, recorded because it only showed on half the cast.**
The first version computed the crop offsets from `getBoundingClientRect`, which
reports SCREEN pixels — and the caption is an anchored node whose whole
transform is multiplied by the speaker's distance from the camera every frame.
The SCALE is a ratio of two screen measurements and survives that untouched;
the two OFFSETS do not, and get multiplied a second time. Dr Rho's shot happens
to sit at an anchor scale of 1.00 and his crop was perfect; Dina's stands off at
0.71 and her head sat against the right edge of the box with her jaw cut off.
The fix is one division by `offsetWidth / getBoundingClientRect().width`. The
general shape: **a transform written in an element's own space may never be
computed from a measurement taken in screen space.**

**What is deliberately NOT claimed.** A cartoon mouth is not lip-readable and
this document does not pretend otherwise. What the face gives a learner who
cannot hear is *who is speaking*, *that speech is happening*, and *when it
stops* — beside the words, at a size where all three are visible. That is the
channel the owner asked for, and it is now doing more than it did.

### What to delete

Premium is mostly subtraction. Each of these exists because a space looked
empty, and each is measurable on `/dev/tutor-lab`. **The list is closed as of
the applying pass, 2026-08-22**; what each deletion cost and bought is recorded
beside it, because a subtraction with no measurement is a preference.

- ✅ **The quiet second line on a world plate.** "Dr. Rho / Your tutor",
  "Liruf / With you". Deleted; see §Type.
- ✅ **The lighter ring around every control** — the frame-plus-core sandwich
  that made each plate look pasted on. Gone with the single-surface material.
- ✅ **The label plate under the microphone** — "Start talking", "Hold to talk",
  "Ready when the conversation starts." A 96 px orb plus a separate plate naming
  it was two surfaces for one control, in five of the seven phases. The name is
  the orb's ACCESSIBLE NAME now and the glyph is what a learner reads; nothing is
  printed while the microphone can be used. Where there IS something to say —
  blocked by policy, blocked by the phase, or refused by the browser — the orb
  becomes ONE plate that CONTAINS the ring and the sentence, rather than a
  second plate beside it (§Components → MicOrb). It took 36 px off the dock in
  every phase and deleted a whole surface from three more: the browser-refusal
  plate the shell used to publish next to an orb that still looked usable.
- ✅ **The second line on an offer chip.** "Practise / Ahorro con meta" is one
  line now, and the SUBJECT moved up into it rather than being deleted with the
  whisper — `offers.weakSkill.title` interpolates the topic, because "Practise"
  on its own is a chip that names an action and nothing to practise, which is
  the failure /AGENTS.md §1.14 records under "verified for subject". It costs
  17 px at 375x812 (the chip wraps to three lines in the fixture locale, and
  `auto-rows-fr` spends the difference making the four a 2×2 block rather than
  two mismatched rows).
- ✅ **The duplicated tutor line at 1280 px — CLOSED PROPERLY 2026-08-22.**
  This entry first deleted the THIRD copy (the transcript's latest turn, a log
  catching up with the present — `TutorTranscript` → `spokenSeq`) and ruled that
  the caption and the 2D bubble both stay. The rule was right about the
  CHANNELS and wrong about the surfaces: two printings of one sentence 252 px
  apart is not two channels, it is one channel twice. The caption now carries
  the words AND the articulating face, the plate carries neither, and the live
  line exists exactly once on screen. See §Lumen → *One line, one printing, two
  channels* above for the measurement and the reasoning.
- ✅ **"TRY THIS"** above the exercise, the only uppercase label on the route.
  `practice only` survived it — that one is a fact rather than a heading — and
  moved down beside the check control, where the answer is actually given.
- ⚠️ **`Finish`, twice** — NOT REPRODUCED, and the honest thing is to say so
  rather than to tick it. Measured on `/dev/tutor-lab` at 375x812 there is
  exactly one: at PEEK a single control at (252, 727, 99, 50), at HALF the same
  one at (252, 439, 99, 50). What WAS true is that one word cost 99 px of a
  343 px row, because it was the design system's `Button` — a `rounded-full`
  pill wearing `lf-gaming-btn`, which is Liquid Glass grammar and a sticker
  silhouette here. It is a HudPlate chip now, 76 px.
- ✅ **"Conversation" on the sheet's peek row.** The row says nothing when
  nothing has happened; the chevron over the grab bar says that it opens, in
  every locale, without a word. When an activity arrives the row says that
  instead, which is the only news it has ever carried.
- ✅ **`More` in the audition** — the WORD, not the control, and the difference
  is reachability. The chip opens the panel's LIST, and that list is the
  guaranteed twin of every world chip on the phase: a candidate the placement
  solver cannot seat, a chip the camera has culled, and a device with no WebGL
  each take a choice away, and the list is the only path that survives all three
  (§Components → WorldChip). Deleting it would delete the nickname field with
  it. So what went is the overflow-menu framing: an overflow menu is a place
  things are hidden, a list is a thing you can ask for, and the chip now says
  which one it is ("Show the list" / "Hide the list").

Two more went in the same pass, found while applying rather than while
designing, and both were the page's material leaking onto this layer: the
**replay list's `Card` rows** (Liquid Glass, `blur(20px)`, a five-layer shadow,
mounted inside a Lumen sheet — glass on glass, which §Elevation rule 6 forbids
outright) are hairline-divided rows now; and every remaining `Button` on the
route — `Finish`, `Check`, `I'm ready`, `Start again` — is a HudPlate, so an
indigo action on this layer is `.lf-lumen-solid` at the pane radius and never a
capsule.

### The reconciling pass — four defects the two applying passes left between them

Added 2026-08-22, after the material and the restyle were driven together
through all seven phases at both breakpoints in both themes and then WALKED as a
learner: arrive, choose a tutor by looking at them, invite a companion, change
the island, change the light, set a nickname, start, hear the greeting, pick an
offer, open the activity, answer an adaptation, reach the goodbye, replay.

Every one of the four was invisible to both passes for the same reason, and it
is worth naming once: **a rule enforced in one place and copied by hand into a
second is a rule with a hole in it**, and the hole is always in the copy.

1. **The tutor's own voice shrank to the size this section calls an apology.**
   `ScreenAnchor`'s readability floor is 12 px, which is right for a two-word
   chip — and every chip is held far above it by the 44 px TAP floor, because a
   finger has to hit it. Nobody presses a caption, so on the caption 12 was not
   a backstop but the operating point: measured at 375x812 with an adaptation
   question up, the two-shot's stand-off clamped it to exactly **12.0 px**,
   below the 13.7 px a world chip's label gets, while the same tutor's question
   one plate below it was 19 px. One speaker, two voices, and the primary one
   was the whisper — on the deaf learner's only channel. The floor is now
   per-node (`AnchorOptions.minTextPx`) and the caption asks for `lf-action`'s
   15 px. Re-measured: 15.0 px at 375, unchanged at 15.7 / 20.7 elsewhere.
2. **The caption came back to rest ON the way out**, which is one of the three
   collisions the "no two HUD surfaces may claim the same pixels" rule was
   written to close. The order was the bug: the chrome escape runs on the
   position the camera asks for, and at a close-up that position is off the top
   of the frame entirely — so it overlapped nothing and correctly did nothing,
   and the frame clamp then parked the plate exactly where the way out stands.
   Measured at 375x812 in `conversing` with the ambient orbit STOPPED: the
   caption at (55, 8, 265, 112) against a way out at (16, 16, 48, 48). A moving
   camera had been hiding it. `hudSpace.ts` → `clampThenEscape` now runs the
   escape AFTER the clamp; it cannot undo the clamp, because the escape refuses
   any candidate that leaves the frame, so all it can do is slide the plate
   along the edge — 17 px, here.
3. **The adaptation moment was off-centre by 240 px at 1280**, standing aside
   for a plate that was not there. The dock stepped out of the bottom-right
   corner on `phase === 'conversing'`, and an offer is still `conversing` with
   the lesson plate standing down: the question, its two answers and the
   microphone were all centred on x = 400 against a viewport centre of 640, on
   the one screen this document calls "one character putting a question to
   another in front of the learner". The corner claim is PUBLISHED by whichever
   plate is holding it now (`StageDockValue.setCornerPlate`), which is the only
   thing that can see the two facts a phase never could — desktop form, and
   stood down. `StageShell` no longer takes a `phase` prop at all.
4. **The audition's name plates did not hide under the risen microphone**, and
   then did not hide when they were told to. Opening the personalization list at
   375 px pushes the dock up into the island, and two separate things were
   wrong. First, the dock is measured by a `ResizeObserver`, and riding above a
   bottom surface changes its POSITION and not its size — so the published
   rectangle stayed at the bottom of the screen, the camera composed around a
   microphone that was no longer there, and nothing could tell it was covering
   anything. Second, the candidate cluster is deliberately not a `WorldChip` (a
   candidate needs two controls), so it copied the projector contract by hand
   and left out the half that answers this document's arbitration rule. Measured
   at 375x812 with the list open and the orbit stopped: the dock at
   (15, 223, 345, 156) with Dina (101, 291), Zara Vex (215, 285) and Dr. Rho
   (8, 208) underneath it, clipped, pressable and in the tab order — while the
   island chip and the sun beside them, which ARE `WorldChip`s, hid correctly.
   And the first fix for the second half LOOKED right and painted anyway:
   `[hidden] { display: none }` is a 0-1-0 attribute rule that the cluster's own
   `flex` class beats outright, so the node reported `hidden === true` to every
   script that asked. Hiding now writes `display` as well as the attribute
   (`WorldChip` → `setHiddenReally`), which is the same correction
   `ScreenAnchor` had already made for the cull one layer up.

Nothing is lost by the last one: the panel that covers a candidate IS the
guaranteed twin of every world control on the phase, and every candidate is a
row in it.

### What this layer still owes

Named rather than quietly left, because a list is the only thing that survives a
hand-off.

- ✅ **The exercise option cards** were outlined `surface` boxes that read as
  form fields rather than as anything on this layer. **Paid 2026-08-22**, and
  paid where the debt actually was: in `lesson-engine/core/primitives.tsx`,
  which is shared with the Lesson Player and with all 57 renderers. See
  §Answer surfaces below — it is its own section because what came out of it is
  a third material with its own rules, not a patch to this one.
- ✅ **The lesson plate at 1280 px running past the bottom of the frame.** This
  entry said the defect did NOT reproduce, and that was true of the PLATE and
  false of what was inside it — which is worth keeping as a worked example of a
  measurement answering a question nobody asked. The plate is where the recipe
  says: (836, 280, 420, 496) at 1280x800, exactly `plate-max` wide, bottom edge
  at 776 with 24 px of `hud-inset` island under it. The learner's problem was
  one level in: **274 px of live exercise below the fold of the plate's own
  scroller** (353 px at 1280x720, 303 px in es-MX), with the `Check` control
  clipped or off-plate. The screenshots that cleared it were taken with
  `--hide-scrollbars`, so the one visual cue that the panel scrolled was not in
  the picture. **Paid 2026-08-22** — see §Lumen → *Room to answer in* below.
- ✅ **`backdrop-filter` cost was reasoned rather than profiled** on the target
  hardware. **Paid 2026-08-22** — see §Lumen → *The blur, profiled* above, which
  carries the emulation, its honest limits, and the numbers. Short version: 4
  compositor render passes against 1, about half a millisecond of presented
  frame time, 3-8% of throughput on the target Intel UHD at a phone's pixel
  count, and flat against CPU throttling, blur radius and blurred area alike. It
  stays everywhere except the `low` tier, which now switches it off through
  `QualitySettings.lumenBlur` — because that tier is precisely the device class
  the profile could not emulate.

### Room to answer in — the plate, the fold, and what actually scrolls (added 2026-08-22)

**The defect, in a sentence a customer would recognise: a child was asked a
question and had to discover that a panel scrolled in order to reach the
answers.** Measured on `/dev/tutor-lab` at 1280x800 in `conversing`, with the
plate holding the scripted `quiz_mcq` — very close to the SHORTEST thing it ever
carries — the plate's single scroller showed 436 px of 710 px of content: 274 px
hidden, 303 px in es-MX, 353 px at 1280x720, and in two of those the `Check`
control was past the bottom edge.

**Three causes, and all three were composition rather than styling.**

1. **The plate was carrying a duplicate of the tutor's live line** — 132 px of
   the 436, on the surface with least to spare. Deleted; see *One line, one
   printing, two channels* above.
2. **`plate-max-height` was a FRACTION of the viewport.** `62vh` reserved 38% of
   the screen above the plate: 280 px of empty island at 1280x800 and 250 px at
   1280x720 — most reserved exactly where there was least to give. The four gaps
   around the plate are the design, and a gap is a DISTANCE. The ceiling is
   `calc(100vh - 200px)` now, which puts the plate's top edge at 176 px of
   island on every screen, and gives the body 540 px at 1280x800 instead of 436.
3. **The prompt, the answers, the action and the conversation log were one tall
   strip in one scroller.** So reaching the last option scrolled the question
   off the top, and on a tall exercise it scrolled the `Check` control off the
   bottom as well.

**The rule, and it is a shape rather than a number: the question is pinned, the
action is pinned, and what moves is the answers between them.** The plate's body
is a flex COLUMN that does not scroll (`LessonPlate` → `bodyLayout="column"`);
exactly one child owns the free height and scrolls, and everything else is
`shrink-0`. Inside the exercise that child is the ANSWERS
(`LiveSegmentPanel`): the header carrying the tutor's framing and the prompt sits
above it and never moves, the verdict and the check control sit below it and
never move. With no exercise up, the child that takes the height is the
conversation log, because then the conversation IS the plate.

**The log yields, and it yields FIRST.** While an activity is live the log is
capped to two rows and carries an enormous `flex-shrink`, so a shortfall comes
out of the log before it comes out of the answers — with the ordinary factor of
1 a 96 px log beside a 550 px exercise absorbed a seventh of the squeeze and six
activity types that fitted whole were scrolling by 15-41 px because of it. It is
capped, never unmounted: it is a live region and the only place a learner ever
sees what the microphone actually heard.

**And a box that continues below the fold SAYS SO.** `.lf-scroll-edge` — a soft
ink gradient at whichever edge has content beyond it, written imperatively by
`useScrollEdges` and visible at rest on a phone with no hover and no pointer.
It is made of INK rather than of the plate's fill, for the same reason the
answer objects' edge is (§Answer surfaces): ink darkens a light theme and
lightens a dark one, which is the direction "there is more underneath" runs in
each, and a fade to the surface colour would have to know what the surface
composites to over a live island, which nothing does. Overlay scrollbars appear
only once a learner is already scrolling, which is after the moment they needed
to be told — and the screenshots that cleared this defect the first time were
taken with `--hide-scrollbars`, which is the same blindness with a flag on it.

**Measured across ALL 57 engine fixtures, on the plate, at both breakpoints.**
The Tutor can serve any graded type a published lesson holds (`serveFromCatalog`
filters on having a GRADER, not on a shape; the `LIVE_TYPE_ALLOWLIST` constrains
tier-3 GENERATION and nothing else), so "the tallest families" is not a
hypothetical — `read_chart` wants 834 px of prompt-plus-answers in a 420 px-wide
plate. Driven through the activity switch on `/dev/tutor-lab`. Two of the 57 are
`content` types that report themselves finished on mount (`key_ideas`,
`story_scene`), so the panel is gone before it can be measured and 55 are
counted:

| | 1280x800 (plate body 540 px) | 375x812, sheet at FULL (body 456 px) |
|---|---|---|
| the plate's own scroller ever scrolls | **never** — 0 px hidden, all 55 | **never** |
| prompt visible without scrolling | **all 55** | **all 55** |
| `Check` on screen without scrolling | **all 43 `input` types** | **all 43** |
| whole exercise visible, nothing scrolls | 30 | 19 |
| answers scroll, worst case | `read_chart`, 406 px | `read_chart`, 471 px |

Families tested, by name, because "we tested it" is not a measurement:
**choice** (`quiz_mcq`, `true_false`, `picture_choice`, `odd_one_out`,
`best_decision`, `yes_no_cases`, `speed_tap`, `confidence_quiz`), **input**
(`type_answer`, `fill_blank`, `number_input`, `estimate_slider`,
`count_objects`, `equation_builder`), **arrange** (`match_pairs`,
`memory_flip`, `sort_buckets`, `order_steps`, `rank_choices`, `build_sentence`,
`timeline_order`, `pattern_complete`, `group_sets`, `number_line`), **money**
(`coin_count`, `make_change`, `piggy_split`, `needs_wants`, `price_compare`,
`budget_fit`, `savings_goal`, `fair_trade`, `interest_peek`), **analyze**
(`spot_error`, `cause_effect`, `compare_table`, `read_chart`, `evidence_hunt`,
`red_flags`, `fact_opinion`), **maker** (`code_order`, `robot_path`,
`debug_hunt`, `balance_scale`, `measure_read`, `machine_io`), **storyplay**
(`story_branch`, `dialogue_choice`, `flash_match`, `lightning_round`,
`would_you_rather`) and **story** (`story_dialogue`, `story_scene`,
`key_ideas`, `concept_reveal`, `checkpoint`, `eavesdrop`).

**The known limitation, stated so it can be defended rather than discovered.**
The tallest types cannot show their whole answer set inside a 420 px plate at
800 px of viewport — no arrangement of a corner plate can, since `read_chart`
alone wants more height than the frame has. For those the answers scroll,
between a question that stays and an action that stays, with the edge saying
there is more. What is guaranteed is the sentence a customer will ask about:
**the learner can always see what they were asked, and can always reach the
control that answers it, without scrolling.** The 8 `flow` types and the 6
`content` types have no plate-level `Check` at all — their controls are part of
the exercise and scroll with it, which is the renderers' own contract and not a
property of this plate; measured, the ones whose own control lands off the
visible box are `robot_path` at 1280x800, and `checkpoint`, `dialogue_choice`
and `robot_path` at 375x812.

**And one tap on "an activity is ready" now lands somewhere it can be done.**
The resting row's default is to step up one detent, which is right for a learner
opening the sheet to look and wrong for an exercise: HALF is 45% of a phone, and
after the plate's header and the pinned check control that left about 90 px for
the activity itself. A row that announces something opens far enough to act on
it (`LessonPlate` -> `peekOpensTo`), and the learner can still drag it anywhere
afterwards.

**One defect this section produced, recorded because a screenshot found it and
nothing else could have.** Laying the body out as a flex column gave it a
`display: flex` from an author stylesheet, and the PEEK detent hides that body
with the `hidden` ATTRIBUTE — a 0-1-0 user-agent rule, which `flex` beats
outright. Measured at 375x812 with the sheet resting: the whole exercise was
laid out below the fold, three option buttons at y = 925, 986 and 1047 on an
812 px phone, focusable, in the tab order, announced, and reporting
`hidden === true` to every script that asked. It is an inline `display: none`
now. That is the third surface on this route to learn the same lesson
(`ScreenAnchor`, `WorldChip`, and now the plate), which is enough repetitions to
state it as a rule: **on this layer, hiding writes `display`, never the
attribute alone.**


## Answer surfaces — the lesson engine's three objects (added 2026-08-22)

> **Scope.** `lesson-engine/core/primitives.tsx` and every renderer that builds
> from it: `OptionCard`, `TokenChip`, `BigIconTile`, `NumberPad`, `KidSlider`,
> `SunkenWell`, `GentleTimerBar`, the text fields, the drop targets and the
> feedback wells. That is the Lesson Player, all 57 exercise types, and the
> Tutor's live segment panel — one component family rendering on **both**
> layers, which is the whole reason this section exists.

**What was wrong, stated plainly.** On `conversing` at 1280 in light, the three
exercise answers were white outlined boxes sitting on a Lumen reading plate over
a live island: a web form dropped into a diorama, and the single most visible
non-Lumen thing on the route. The cause was one Tailwind recipe —
`rounded-md border-2 border-outline/70 bg-surface` — written out by hand in
about forty places across the eight families. Four sides of uniform hairline
around a flat opaque fill is the silhouette of an HTML input, and no amount of
care at the call sites was going to change that, because the recipe WAS the
design. On the ordinary lesson page the same recipe put white on slate-50 with
the entire distinction carried by a border, and a whole column of them read as a
questionnaire rather than as a question.

**Why it is a third material and not one of the existing two.** Liquid Glass
over the island is exactly the sticker §Lumen deleted. Lumen on an ordinary page
is a window onto nothing. Lumen inside a Lumen plate is glass on glass, which
§Elevation rule 6 forbids outright. So these objects are made of the one thing
both layers publish: **the light**. `--lf-sky`, `--lf-key`, `--lf-ground` and
`--lf-sun-height` are registered properties with global defaults, so the same
recipe reads as the island's own hour inside the Tutor and as neutral room light
on a page, with no conditional anywhere. Two materials was not inconsistency and
neither is three — a page holds still, an island does not, and an ANSWER is
pressed on both.

### The physical rule, from which every value follows

**The pane is glass and the object on it is opaque and lit.** That one sentence
is why an answer always reads as raised, in both themes, over any backdrop a
moving render can produce: a translucent plate composites toward whatever is
behind it and an opaque object does not, and the object additionally catches
`--lf-obj-lift` (7%) more of the key light because it is nearer to it. Nothing
here needs to know what is behind it, which is what makes it work in two places.

### Three objects, and there is no fourth

| Class | It is | Made of |
|---|---|---|
| `.lf-well` | a place something GOES — trays, banks, drop targets, the scenario a question is about | body darkens; lip moves to the BOTTOM (a hollow catches light on its far lower wall); the shadow moves INSIDE |
| `.lf-slab` | an object that CARRIES content and is not pressable — case rows, statement panels, speech bubbles, chart frames, verdict wells | body + lip + ink edge + seat |
| `.lf-answer` | an object you PRESS — options, chips, tiles, number-pad keys, text fields | `.lf-slab` + press physics + hover lift + the state modifiers |

`.lf-well-target` is the dashed variant of the well, and the dash is a real
distinction rather than a decoration: it is the only thing in this vocabulary
that means "empty ON PURPOSE, put something here", which a solid empty box
cannot say — that just looks like a component that failed to load. It has
**three** states, not two (`resting` → `.lf-well-target-ready` when a piece is
picked up → `[data-active]` when the pointer is over it), because with two a
learner who has lifted something cannot tell which box will accept it, which is
the moment they most need telling.

### The parts, and why each is what it is

| Part | Value | Why |
|---|---|---|
| body | `--lf-lumen-fill` lifted 7% toward `--lf-key` | opaque and LIT — the object is nearer the light than the pane it sits on |
| edge | ink at 11% (19% on hover), `inset 0 0 0 1px` | **ink, not the scene's shade.** A plate's edge is shade because a plate is a hole in the picture; an object's edge is where its own body ends, and ink is the only colour that darkens a light theme and lightens a dark one — which is the direction elevation runs in each. A shade edge vanishes in dark mode exactly where the drop shadow already has |
| lip | `--lf-key` at half the Lumen rim ramp | the same specular highlight, and a small object catches less of it |
| seat | one drop, same sun as Lumen, about a third of the throw | an option lies ON its pane; a plate-length shadow under a 48 px row reads as a balloon |
| state | the theme's own `-soft` token, plus a 2 px INSET ring | inset so it never changes layout and never loses the lip, the edge and the seat to a `ring-*` utility — the same correction `.lf-lumen-selected` records |
| tap floor | **48 px** | an answer option is the control a child mis-taps most; 44 is the floor, not the target |

Everything transitions on `--lf-dur-base`; the press seats the object AND
collapses its shadow with it, because a shadow that stays put while the thing
above it moves is the tell that neither is real. The hover lift is
`(hover: hover)` and reduced-motion-gated, and it is never the only channel —
there is no hover on a phone, which is where most of these are pressed.

### State is never colour alone, and a component enforces it

`correct` and `wrong` carry meaning for a child, so /AGENTS.md §1.11 and this
document both require a second channel — and requiring it produced nothing,
because the shared card had painted state in colour only since the primitives
were written. It is a COMPONENT now: `AnswerMark` prints an empty ring that
becomes a **filled check** when chosen or right and a **filled cross** when the
learner's own pick was not, with a screen-reader word on the two verdicts.
`VerdictGlyph` is its compact form for objects with no room for a leading mark
(chips, tiles, table cells). Three shapes survive colour blindness, a greyscale
print and a bright phone in sunlight; a hue does not.

The mark also says how many answers are allowed before one has been given — a
circle for a single choice, a squircle for a multi-select — and it is what turns
a full-width bar of text into something visibly pressable rather than something
visibly typeable. Renderers whose content is centred or stacked (the true/false
pad, picture tiles) pass `mark={false}` and take the corner mark instead.

**`wrong` is amber, not red, and that is a spec fix.** LESSON_ENGINE.md §1 P3 is
one sentence long — "No red WRONG" — and `optionStateClasses` had been painting
`border-error bg-error-soft` on the learner's own pick, on the most looked-at
control in the product, while the Tutor's verdict well two files away already
used a warm one for the same tier. The Lesson Player's `tryAgain` feedback
banner had the same red and lost it in the same pass. The CROSS is what says
"not this one"; the colour only agrees with it.

### One defect this section produced, recorded because it nearly shipped

The first version guarded the no-`color-mix` fallback with
`@supports not (color-mix(in srgb, red 50%, transparent))`. That reads like
"is color-mix supported"; it is actually a `<general-enclosed>`, which the spec
evaluates to UNKNOWN and Chrome resolves `not unknown` to TRUE. **The fallback
therefore applied in every browser**, and every rule above it was dead code —
measured on the live stage with `getComputedStyle`, an answer's edge was
`--lf-outline` and its shadow was the five-layer atmospheric one, not the ink
edge and the sun-agreeing seat this section specifies. It photographed
acceptably, which is exactly why it survived a screenshot review: the fallback
is a decent design, it is just not this one.

**And it had a second effect that a picture DOES show, once you know to look for
it.** The fallback block sits after the state modifiers in source order and
rewrites `box-shadow` on `.lf-slab, .lf-answer` — so it was erasing the 2 px
state ring off every stated object. The balance scale's right pan, judged wrong,
rendered as a plain white pan; with the condition fixed it renders amber-ringed
on an amber-50 fill, which is what the section says it does. The condition is a
DECLARATION now (`@supports not (background-color: color-mix(...))`), and what
found it was reading the computed style off the real page rather than looking at
a picture of it.

### What this does NOT change

- **Liquid Glass is still the page's material** and Lumen is still the
  immersive layer's. These three objects sit INSIDE either one; they never
  replace a card, a panel or a plate.
- **The type scale is untouched, and the material deliberately does not touch
  it either.** An early version of `.lf-answer` carried `font-weight: 600` so a
  call site would not have to — and it would have silently rewritten every
  button that already carries `lf-label` or `lf-title` (700), which is exactly
  the drift §Typography's closed scale exists to prevent. Weight stays at the
  call site, on the element whose type it is.
- **Grading, shuffling, scoring and every renderer's behaviour.** This pass
  moved classes and added one mark component. No answer key, no `canSubmit`, no
  grader and no payload shape was touched.

### A shape is a PROP, never a `className` (added 2026-08-22)

`cn()` in `frontend/src/lib/utils.ts` is a plain concatenator — deliberately, so
that no dependency is needed for it — and it is **not** `tailwind-merge`. So a
class passed down to a component that already sets the same property does not
win: **CSS source order** decides, and Tailwind emits `rounded-full` after
`rounded-md`, `justify-center` after `justify-start`, and `min-h-12` after
`min-h-9`.

Three call sites in the engine had been passing exactly those, and all three
were silently discarded. One of them was visible: `arrange`'s `order_steps` and
its timeline passed `justify-start rounded-md text-left` to a `TokenChip` whose
base is `justify-center rounded-full`, so a **placed** step rendered as a
centred capsule directly beside the square dashed `.lf-well-target` it had just
filled. It read as deliberate and was not; it survived review precisely because
the class *looks* like it is doing something.

The rule, therefore:

- **A shared control owns its own geometry.** `rounded-*`, `justify-*`,
  `min-h-*` and `text-left|center|right` are set by the component, from a typed
  prop, and exactly one value is ever emitted. `TokenChip`'s is `TokenShape`:
  `pill` (free in a bank — capsule, centred) or `slot` (seated in a numbered
  slot or timeline node — `rounded-md`, left-aligned, agreeing with the
  `.lf-well-target` it replaces).
- **A `className` on a shared control may only carry properties the base does
  not set** — `flex-1`, `w-full`, a responsive `md:` layout hint.
- `core/answerSurfaces.test.tsx` scans every engine source and fails the build
  on a `className` handed to `TokenChip` or `OptionCard` that names an owned
  property. Nothing else can catch this: a dead class type-checks, lints, and
  passes every behavioural test.

### The tap floor has two sides (added 2026-08-23)

`min-h-12` was on `TokenChip` from the start and `min-w` was not, which is a
floor on the object's HEIGHT rather than on the TARGET. A chip whose whole
content is one character — `5`, `+`, `×` — is 32 px of padding around a 9 px
glyph, so `equation_builder`'s operator tiles and `balance_scale`'s weights
measured **41 px across at 48 tall**: under even the 44 px minimum, on the two
exercises whose entire interaction is tapping single characters, and invisible
to a checker that only reads height. `TokenChip` now sets `min-w-12` as well,
and the scan asserts it, so no call site has to remember.

### A broken-glyph check must measure the GLYPH (added 2026-08-23)

`Icon` swaps in a neutral `help` when the ligature it was handed is not a real
Material Symbol, because the font otherwise paints the raw string as giant text
(coursegen can emit `piggy_bank`, `lemonade`). The first version measured
`el.scrollWidth` — the width of the ELEMENT, which equals the glyph's width only
while the span is shrink-to-fit, and a caller can take that away without
knowing. `fair_trade` passed `block` so its two offer icons would centre; the
span grew to the card's 322 px against a 40 px font; `322 > 40 × 1.5` was true;
and both `sell` and `toys` — valid glyphs, and the two things being traded —
rendered as a question mark on the one exercise that asks which of two things is
worth more. A checker that reports a healthy thing as broken is worse than no
checker, because the placeholder it substitutes is confidently wrong
(/AGENTS.md §1.14).

It measures a `Range` over the node's contents now: the laid-out TEXT RUN, which
reads nothing about the box around it, so the answer is the same whether the
caller made the span inline, block, a flex item or a grid cell. The secondary
signal is the number of client rects (a glyph is always one line) rather than
the run's height, because height follows `line-height` and a caller can set
that — reintroducing a caller-controlled input is exactly how the first version
went wrong. Where there is no layout at all (jsdom) it returns `null` and the
check is skipped: "cannot measure" is not "measured zero".

## Motion — closed system

System recipes, tokens only (`--lf-ease`, `--lf-dur-*` with deliberate exceptions for page/theme fades):

1. **Page transition** — `.lf-page-enter` on `<main>` keyed by route (uses a softer `ease-out` rather than the bouncy default).
2. **Scroll reveal** — `<Reveal>`; grids stagger ≤3 × 80ms.
3. **Pop** — `.lf-pop` for floating panels.
4. **Press physics** — the TACTILE press (§Tactile), product-wide since
   2026-09-05: `.lf-tactile` for anything that reads as an object,
   `.lf-press` for anything that is part of a surface. Colour-shift hover
   (`hover:bg-accent-strong`…) stays; still no scale-on-hover and no 3D
   borders — the ridge is a side, not a bevel. The previous
   `active:translate-y-px` is gone from the codebase; a new one is a
   regression, because it re-forks the duration and the reduced-motion
   handling this recipe exists to hold in one place.
5. **Arrow nudge** — CTA arrow `group-hover:translate-x-0.5`.
6. **Global theme transition (NON-NEGOTIABLE)** — Every color, background, and border change transitions smoothly when SWITCHING themes. Enforced globally in `index.css` (`.theme-transitioning`). The one exception is the FIRST apply on mount, which must not transition: recipe 11 settles the theme before the first paint, so the provider'"'"'s mount pass is a confirmation and not a change. Animating it animated a no-op — and when the two ever disagreed, cross-fading the correction is precisely what a visitor reads as "the site loaded wrong and then fixed itself".

7. **Lesson Engine motion** (`LESSON_ENGINE.md` §9) — the character rig
   (`lf-act-*` wrapper keyframes + `lf-rig-*` limb hooks in
   `components/characters/control/rig.css`) and the player's feedback/combo
   pops. All ONE-SHOT: every action auto-returns to idle; `celebrate`/`dance`
   may loop only while a celebration overlay (results screen) is up and stop
   with it. Timed exercises use the GentleTimerBar's linear width tween only.
   Reduced-motion: rig animations disable entirely (emotion change remains).
   **`.lf-burst`** is the one VFX: a ring that expands and fades ONCE behind a
   combo milestone (every third answer in a run, `core/combo.ts`). A ring and
   not confetti on purpose — confetti is a screenful of independently animated
   nodes on the mid-range phones §1.0 exists for, and this is two composited
   properties on one element that leaves nothing behind. `position: absolute`
   and `pointer-events: none`, so it can never cover a 44 px tap target. Under
   reduced motion it is not drawn at all: a ring frozen at half scale is a
   graphical artefact, not a quieter celebration.
   **A speaking character articulates** — `applySpeaking` adds a syllabic head
   cadence for the character whose line is being read (`TUTOR_3D.md` §6.4). It
   stops for `prefers-reduced-motion` and NOT for the low performance tier: it
   identifies who is talking, which is information rather than decoration.
   **Counters arrive rather than appear** — `CountUp`/`useCountTo`
   (`components/ui`). One implementation, two documented behaviours: a LIVE
   number counts from its previous value (the header XP chip) and a REVEAL
   counts from zero once (the results cards). Reduced motion lands on the final
   value immediately, as a modifier and never as a second path.
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
10. **HUD motion** (Tutor stage) — `.lf-settle` (§Lumen → Motion), on the
    existing Reveal cadence (≤ 3 × 80 ms stagger, recipe 2), and it **never
    animates its own position**. An anchored plate's position belongs to the
    camera, so a CSS transition on `transform` fights the per-frame projection
    and reads as lag rather than as easing — which is why the settle animates
    `opacity`, `scale` and `filter` on the PLATE and never `translate` on the
    anchored node above it. Also permitted: recipe 4's press physics, and the
    orb's 4 s 3% breathing loop, bounded by the IDLE state and stopping with it.
    Reduced motion is a modifier on the settle, never a second entrance.

11. **First load — the boot dissolve** (`frontend/index.html`, released by
    `src/lib/boot.ts`). The one recipe that is not in `index.css`, and cannot
    be: it is the only styling that exists at the moment the browser paints its
    first frame, so it is inline in the `<head>` along with the script that
    settles the theme before `<body>` is parsed. A full-bleed veil in the
    theme's own ground (`--lf-boot-ground`, mirroring `--lf-base`) carries one
    soft brand bloom breathing at 2.4 s; when the app has painted, the veil
    dissolves over `--lf-boot-dissolve` (560 ms) — its `backdrop-filter` blur
    falling to zero as its opacity does, so the product arrives THROUGH a blur
    rather than appearing. It is `.lf-settle`'s gesture at the scale of the
    whole app, which is why it is longer than `--lf-dur-page`. Reduced motion
    is a modifier: the veil still covers, it simply stops breathing, stops
    blurring, and cuts at 120 ms.

    **The blur is on the VEIL and never on `#root`.** A `filter` or a
    `transform` on `#root` makes it the containing block for every
    `position: fixed` descendant in the product — the header, the cookie
    banner, the Tutor's dock — which is a worse bug than the one being fixed.
    `opacity` creates a stacking context and no containing block, so opacity is
    all `#root` is ever given, and the attribute driving it is REMOVED once the
    dissolve ends so nothing it introduced outlives it.

    **What it covers, all three photographed on 2026-09-04.** Production serves
    a prerendered SEO shell inside `#root` (§1.15), so until the entry bundle
    downloaded and mounted a visitor was looking at a full screen of raw,
    unstyled marketing text — measured on screen from 3.3 s and still there at
    12 s on fast-3G. The theme was applied in a React effect, so a dark-mode
    visitor got a fully rendered LIGHT page for ~530 ms and then recipe 6's
    500 ms cross-fade into dark — a bug with an animation drawing attention to
    it. And nothing arrived; it appeared, at whatever instant its bytes landed.

    **It must fail OPEN, and that is the part that may never regress.** The
    veil is inert markup until the inline script arms it, so a reader with no
    JavaScript — and every crawler that runs none — still gets the shell. Once
    armed it is `pointer-events: none` at all times, so even a stuck veil can
    never swallow a control (§1.14, the synthetic-click lesson). And the
    fail-open is armed against the BUNDLE, not against a clock: by `load`,
    everything the page was going to fetch has arrived or failed, so if the app
    has not released a moment later it is not coming, and the shell is revealed.
    A blind deadline was tried first and measured doing harm — at 8 s it lifted
    the veil on a perfectly healthy fast-3G boot and put the raw shell back on
    screen for 5.7 seconds, reintroducing the exact defect for the slowest
    connections. `--lf-boot-deadline` survives only as a last resort for `load`
    never firing at all, which is why it is 30 s rather than a budget.

    The veil carries **no text**, and that is forced as well as chosen: nothing
    at this point in the document can reach i18n (§1.8), and a hardcoded
    "Loading…" would be a hardcoded string in one language. `src/__tests__/bootVeil.test.ts`
    pins every value this recipe duplicates — the ground colours against
    `--lf-base`, the storage key and `auto` semantics against `ThemeProvider`,
    and the exact empty `#root` the prerenderer replaces by string.

`.lf-float` (hero illustration) is the only UNCONDITIONALLY infinite animation
in CHROME (lesson celebration loops are bounded by their overlay, per recipe 7,
and recipe 11'"'"'s bloom is bounded by the veil and stops with it).
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

## Tactile — the third material (added 2026-09-05)

Beside glass (§Elevation) and Lumen (§Lumen), a third material with a third
claim. **Glass says "this pane floats above the page." Lumen says "this plate
is lit by the scene." Tactile says "this is an object with a side, and you can
press it."** It came from the Stitch design study *LittleFounders Liquid Glass
Gamified*, whose own token file turned out to be **this document's colours,
radii, fonts and glass values verbatim** — so this is not a new palette and
nothing below changes one. What it adds is a way for a surface to have weight.

### Where it applies

**Everywhere.** It was introduced scoped to the gamified surfaces so it could
be judged on one screen before it reached every button in the product; that
happened on 2026-09-05, and the owner promoted it. Marketing, auth, admin and
profile now press the same way `learn/` does.

**Two classes, and picking between them is the whole judgement.**

| | Use when |
|---|---|
| `.lf-tactile` | The thing reads as an OBJECT: a button, a card you press, a control pill, an option tile. It gets a side and it presses |
| `.lf-press` | The thing is PART OF A SURFACE: a sidebar row, a list row, an icon button inside chrome. It takes the travel and leaves the ridge behind |

Giving `.lf-tactile` to everything that answers a tap makes a page read as a
pile of loose keys. `.lf-press` exists because that distinction is real and
because it replaced ten hand-written `active:translate-y-px` utilities
scattered across the app, each with its own duration and its own idea of
reduced motion. One press, one duration, one modifier.

The Tutor's HUD takes `.lf-press` and never `.lf-tactile`: a plate lit by the
scene (§Lumen) has no side, and the ridge belongs to a different material.

### The ridge, which is the whole idea

The glass shadows are ATMOSPHERIC: five diffuse layers describing how far a
pane floats. Tactile makes the opposite claim in two layers — a faint ambient
diffusion for the float, then a **hard, zero-blur ridge under the bottom edge**
saying the thing has a SIDE.

```
--lf-tactile-lift: 3px;                       /* the object's own height */
--lf-shadow-tactile:        0 10px 25px -5px rgba(15,23,42,.05), 0 3px 0 0 rgba(15,23,42,.08);
--lf-shadow-tactile-accent: 0 10px 25px -5px accent/.25,        0 3px 0 0 accent-strong;
```

`--lf-tactile-lift` is declared once because the ridge's offset and the pressed
translation **must be the same number**. Press travels exactly the object's own
height and the ridge collapses to zero in the same frame, so the bottom edge
stays put and only the top face moves — which is what a key does. Translate
without collapsing the ridge and the whole object slides down the page instead:
a glitch, not a press.

**In dark mode the ridge inverts.** There is nothing left to darken against a
`#0a0e1a` ground, so it becomes a light rim — the same physical claim read off
the top of the edge rather than the shadow beneath it.

### The parts

| Class | What it is |
|---|---|
| `.lf-tactile` | The surface: ridge + press. The default for any pressable thing on a gamified screen |
| `.lf-tactile-accent` | The same, with a tonal ridge in `accent-strong`. Primary CTAs only |
| `.lf-sheen` | The polished top edge. An `::before` OVERLAY, so it composes over whatever fill the surface already has instead of replacing it — and `pointer-events: none`, because §1.14's synthetic-click lesson is that a decorative layer over a control is a control nobody can press |
| `.lf-well` | The inverse: a recess an object drops into (answer slots, coin trays). Inset shadow ONLY — a hole in the page cannot also float above it |
| `.lf-land` | Reward arrival. One-shot, like every other action in the system |
| `.lf-bubble-tail-*` | The mentor's speech tail. A drawn triangle, not a rotated square: a rotated square needs the bubble's exact background to hide its own corners and stops matching the moment the surface behind it changes |
| `.lf-scroll-x` | A horizontal scroller that keeps its gesture and loses its bar. A REAL scroll container, never `overflow: hidden` plus a transform |

### A SECOND easing, and it is the reason this is a tier rather than more utilities

```
--lf-ease-tactile: cubic-bezier(0.34, 1.56, 0.64, 1);   /* overshoots */
--lf-dur-press: 80ms;
--lf-dur-reward: 400ms;
```

`--lf-ease` decelerates into its target and never passes it — exactly right for
a panel settling, exactly wrong for a coin landing in a slot. A reward that
overshoots reads as a physical object with mass; **the same motion on a page
transition reads as a bug.** That is why they are two tokens and why nothing
outside a gamified surface may reach for the second one.

Reduced motion is a MODIFIER (§Motion): the object keeps its side and keeps
answering a press, it simply stops travelling, and a reward appears where it
would have landed. A control that gives no feedback at all is not a quieter
interface, it is a broken one.

### The answer object's side, and why it is not `.lf-tactile`

`.lf-answer` (§Answer surfaces) is made of LIGHT, not tone — a convex gradient,
a specular lip, a seat mixed from `--lf-lumen-shade` — precisely so the same
object can composite over the Tutor's moving island and over a flat page.
`.lf-tactile`'s ridge is a flat tone and would go opaque and wrong the moment
the sun moved. So the answer object gets its side in its OWN idiom: a fourth
shadow layer, zero blur, mixed from the same shade at 1.7× the seat's alpha,
offset by `--lf-obj-ridge`. The press travels that height and collapses the
side in the same frame.

**This is the general rule for the tier.** A material that already has a
physics gets the ridge expressed in its own terms; only a plain surface takes
`.lf-tactile` wholesale.

### Where the Stitch study is deliberately NOT followed

Two of the study's dark-panel values are rejected, and the reasons are already
in §Lumen:

- **`border: 1px rgba(255,255,255,.12)`** — a white lip over a warm island is
  the single loudest "sticker" cue there is. The edge stays the scene's own
  shade.
- **`backdrop-filter: saturate(1.8)`** — `--lf-lumen-chroma` is deliberately
  under 1 so what shows through keeps its luminance and loses its hue, and the
  plate never picks up a colour that competes with the words on it. This is
  half of the contrast contract, not a taste.

The study is drawn over a flat radial gradient and never had to solve either
problem. Its PRESENCE is still owed, so it is bought where this material can
afford it: a deeper, longer seat, a stronger specular lip in the key light's
own colour, and a more present edge ink (9% → 16%). Same read, no white edge,
contract intact.

**The Tutor's lesson panel stays full-height and docked** (`inset-y-0
right-0`), against the study's floating card. That geometry is what the speech
caption's `docked: 'panel'` escape is computed from — an adversarial review
(round 43) found the caption falling back to an unwinnable clamp the last time
the two disagreed — and the "rejected two-panel split" post-mortem in
`hud/LessonPlate.tsx` already argued the case. A floating panel is a change to
that contract, not a restyle.

### The gamified surface — what the study actually looks like

The study's token file was this document verbatim, so its LOOK lives entirely
in composition. These are the pieces that carry it, and the codebase had no
equivalent for any of them.

**Borders are the single biggest difference.** Glass and `.lf-answer` draw
their edges as inset hairlines mixed from the scene's shade — right over a
moving render, and almost nothing on a flat page. The study draws real,
visible 1px and 2px borders. On a gamified surface, which is a flat page and
not the island, a visible border is what makes an object look like an object.

| Class | What it is |
|---|---|
| `.lf-ambient` | Two huge blurred gradients fixed behind the page. Two composited layers that never repaint, and most of why the study's flat screens do not read as flat: the ground is never one colour twice |
| `.lf-panel` | The white card: a real border and a soft clean shadow. NOT glass — glass is a lens over something, and these sit on a page with nothing behind them to refract |
| `.lf-panel-head` | The header strip inside a panel: icon tile, what the surface IS, a readout, over a rule. Most of why the study's right column reads as a laboratory rather than as loose controls |
| `.lf-chip` (+ `-warning/-error/-accent/-success`) | A counter badge: tinted fill AND a matching border. The border is the whole difference from a flat tinted pill — it gives the chip an edge against any background |
| `.lf-term` | A marked term inside prose. CONTENT-DRIVEN: a lesson author already bolds the quantity a question turns on, so `MarkdownLite`'s `markTerms` renders emphasis the content already carries. Opt-in — a page of chips is a page of noise |
| `.lf-track` / `.lf-track-fill` | A 12px gauge with an inner gloss on its top half. A progress bar in a game is read across a room; `ProgressBar` is sized for a dashboard row |
| `.lf-coin` | An actual coin: a gradient lit from up-left, inset highlight and shade for thickness, a zero-blur gold SIDE, and a dashed milled edge |
| `.lf-slot` / `.lf-slot-tag` | The well a coin lands in. `column-reverse`, so coins stack UP from the floor the way objects dropped into a tube do |
| `.lf-summary` | The equation row under a manipulable: the learner's own numbers read back as a sentence. The difference between a board you poke and a board that tells you what you just did |
| `.lf-now` / `.lf-live-dot` | The row that is happening NOW: a three-stop gradient so it reads as lit rather than merely coloured, and a dot that breathes. A static pill says "you tapped this"; the row is trying to say "this is happening" |
| `.lf-eyebrow` | Wide-tracked small caps over a negatively-tracked display line. The tracking is the point — it is what makes the pair read as one object rather than two sentences |

**Two more were built and then removed for the same reason: `.lf-term-accent`
(a second highlight tone MarkdownLite never emits) and `.lf-wave` (a soundwave
for a mic-dock caption our orb deliberately does not print — see §Lumen). The
rule is checked by `designClasses.test.ts` in BOTH directions now: nothing may
be referenced and undefined, and nothing gamified may be defined and never
rendered.**

**The study's two-line value+unit card was built and then REMOVED.** Seven
families share `TokenChip` and not one of them offers a quantity with a unit —
every token is a word, which the pill already serves. A class nobody renders is
dead weight dressed as a deliverable, so it goes until a numeric-choice segment
type exists to render it. This is the rule for everything in this section: if
it is here, something calls it.

**A coin is drawn in CSS, not shipped as an image.** A make-change exercise can
put forty on screen, and forty requests for a 28px disc is a waterfall a
mid-range phone pays for (§1.0 #5). A BILL stays a rectangle, because it is
one — giving a banknote a milled edge invents a detail the real object does not
have, which is the cheapest way to look wrong to a child who has held the thing.

### The Tutor's stage chrome — and the white rim, resolved

§Lumen rejects a white 1px rim because "a white lip on a warm island is the
loudest sticker cue there is". **That is true of a BRIGHT island.** On the
study's dark cinematic stage the same hairline is a RIM LIGHT — what a real
edge does when the only light in the scene is behind it.

So neither extreme: the rim's strength follows `--lf-sun-height`, already a
registered, animatable property written once per backdrop change. Overhead sun
→ almost nothing, which is the old behaviour and correct. Night → the study's
visible white edge. **The plate learns the hour instead of being handed a
constant that is wrong half the day.** `saturate(1.8)` stays rejected: chroma
under 1 is half the contrast contract, not a taste.

| Class | What it is |
|---|---|
| `.lf-stage-pill` | A chip floating in FRONT of the scene: less blur, cooler base, no chroma correction. A Lumen plate is something you read THROUGH; these are not the same material and the study distinguishes them |
| `.lf-live-emerald` | An 8px dot throwing an 8px halo. The halo is the point — a flat dot on a dark plate is a pixel, and this has to read at a glance as "the microphone is actually open" |
| `.lf-wave` | Bars whose HEIGHT is the animation. Three phases so the row never pulses in unison, which is what separates "listening" from "loading" |
| `.lf-orb-ring` | The halo behind the mic orb while it listens. Bounded by the listening state, `z-index: -1` and `pointer-events: none` so it can never take a tap from the orb it surrounds |

**The house hover for glass chrome brightens the HAIRLINE, never the fill.** A
fill change on a translucent pill fights whatever is behind it and reads
differently over every part of the scene; an edge change reads the same
everywhere.

Everything here that moves is bounded by the state that renders it (§Motion
recipe 7) and has a reduced-motion modifier. The waveform collapses to a flat
line rather than freezing: a stopped waveform is a graphical artefact, a flat
one still says "audio".

### The Tutor's conversing screen, rebuilt to the study (2026-09-06)

The configuration dialog landed first; this is the screen behind it. Read
against the study's own `Tutor IA` screen rather than a summary of it, four
structural differences, all now closed:

- **THE PANEL FLOATS AGAIN.** It was `inset-y-0 right-0` — a full-height slab
  flush to the viewport edge, an owner decision from 2026-08-28 taken against a
  floating CORNER plate whose content was folded away. The study answers the
  same question a third way: a 380px card inset from the top-right, four
  rounded corners, the stage visible around and behind it. It keeps a DEFINITE
  height (`h-[calc(100vh-11rem)]`, not `max-h-`) because several boards draw
  bars with `height: N%`, which collapses to zero against a content-sized
  parent — `verify:tutor-ui` reported 3/3, 2/2 and 3/3 bars at zero the moment
  the card became content-sized, the failure /AGENTS.md §5 already names for
  `sequence` and `CategoriesBoard`.
- **THE STAGE OWNS A HEADER ROW.** `StageShell` publishes a `header` slot
  beside the two dock slots it already had; the exit chip sits in that row
  rather than positioning itself, and the session's chips portal into it. They
  used to live inside the lesson plate's own header, an inch inboard of the
  corner and only while the plate was mounted.
- **THE LIVE BADGE AND THE XP CHIP ARE REAL.** The badge burns only while
  `budget === 'running'`. The XP chip SUMS what the grader actually awarded:
  `LiveSegmentPanel` already read `xpAwarded` off each grade response to print
  it beside the verdict, and that number died there, so the session had no
  running total and the study's chip had nothing true behind it. Zero renders
  no chip.
- **THE SPEECH CARD NAMES ITS SPEAKER.** It carried a portrait and a sentence
  and nothing identifying either. The study puts the name over a lesson
  breadcrumb beside the avatar — and that breadcrumb was already on this route
  as a separate chip floating at `top-16`, a second surface for a fact that
  belongs to this one. The chip is deleted; its sentence is in the card.

**MOBILE HAD TO BE DESIGNED, NOT DERIVED** — the study says outright it has no
mobile pass for this HUD. Below `lg:` the session chips go back to the panel's
own header row (which exists there anyway, doubling as the drag handle), and
that row carries **controls only**: the badge, the minutes and the XP hide,
because with them present at 390px "Finish" — the only way to end a session —
clipped to "Finis". Every chip is `shrink-0` on purpose (a control that shrinks
stops being tappable), so the row cannot absorb overflow and something has to
leave; status is what leaves. The speech card's breadcrumb hides there too: it
wrapped to two lines and grew the caption until it overlapped the microphone
dock by 308x43px.

**Two gate findings worth keeping.** `verify:tutor-ui` caught the exit chip
hit-testing to the CANVAS on all 56 fixtures: moved into a
`pointer-events-none` row, it had not opted back in, so the only way off the
route was dead while looking perfectly normal in a screenshot. And
`verify:tutor-a11y` caught the dialog's "Active" badge as a serious contrast
failure — it used the house success chip (`bg-success-soft
text-success-strong`), tuned for a light page and dark-on-dark in dark mode; it
was the first surface to use that pairing over dark glass.

### The Tutor's configuration dialog, and the night that was never night (2026-09-06)

Three passes of material tuning were told, correctly, that the Tutor still did
not look like the study. Reading the study's own screens instead of a
second-hand summary of them found why, and neither cause was a radius or a
shadow.

**THE STAGE WAS NEVER ACTUALLY DARK.** Three separate faults, each invisible
alone, stacked into "dark mode renders as an overcast afternoon":

1. `AUTO_DARK` and `night` both put the sun at **0.78 and 0.74 of the way to the
   zenith** — noon, on the two presets whose entire job is that it is dark.
   `--lf-sun-height` is the one number every night-ward ramp in the stylesheet
   reads (the Lumen rim that only appears as the sun drops, the lengthening
   shadows, the object seat), so at 0.78 the whole "as the sun goes down" half of
   this material was unreachable in the theme it was written for.
2. The stage's sun bloom was a flat **55% of the key light across 130%×78% of
   the frame, at every hour**, including the ones with no sun in the sky. A
   violet-indigo night sky was being washed by a light-violet flood covering most
   of the screen. It is now scaled by `--lf-sun-height`: noon is byte-identical,
   night reaches black.
3. `index.css` carries a **hand-mirrored copy** of `AUTO_DARK` (its own comment
   says so) and that copy had only three of the four values — no
   `--lf-sun-height` — so dark mode inherited the light theme's noon elevation
   from `@property`'s initial value. This is the hand-mirrored-constant class
   /AGENTS.md §5 already has four gates for, one layer lower.

Plus a fourth, in the instrument rather than the product: the Tutor lab
hardcoded `backdrop: 'day'`, so **every screenshot ever taken of this route —
including the ones a redesign was judged against — showed a bright island that a
learner on the default preference never sees.** A harness that misrepresents the
product's own default reports on something nobody ships (§1.14). It follows the
theme now.

The stage also gained the study's **cinematic vignette** — one off-centre radial
fall from the violet core to near-black at the corners, tied to `--lf-sun-height`
so it contributes nothing at noon.

**AND PERSONALIZATION IS NOW THE STUDY'S DIALOG.** The in-world picker — chips
on each candidate's crown, a sun on an arc, rim pads, a corner plate — is
replaced by a centred modal, by owner decision, because it shows every axis at
once and groups them under scannable headings. `/ORACLE.md` §10 carries the
supersession and what did NOT change: every axis is still an immediate write
against the live scene, and the scrim is blurred rather than opaque so the island
visibly changes behind it. New material for it: `.lf-config-scrim`,
`.lf-config-dialog`, `.lf-config-head`/`-foot`, `.lf-tile` (the study's
three-steps-of-one-hue icon tile), `.lf-pick-card` (+ `-on`, `-check`),
`.lf-config-row` and `.lf-switch`.

Two things the build itself taught:

- **A modal has to leave the stage's tree.** The shell mounts every HUD layer
  inside `pointer-events-none absolute inset-0 z-30`, which is a stacking
  context — so the dialog could not rise above the microphone dock's `z-40`
  sibling at `z-50`, and photographed with the dock's plate punched through its
  middle at `z-[60]` too. Only `createPortal` to `document.body` actually made it
  modal.
- **Cancel has to really cancel.** The study draws Cancel beside Save on a
  surface that writes every tap, which would be a lie; the dialog snapshots
  `preferences` on mount and restores every axis on Cancel, Escape or a scrim
  press.

### The Tutor's shape reversal — chips are capsules again (2026-09-05, owner direction)

The two passes above tuned box-shadows and hairlines and were told, correctly,
that the Tutor still looked like "the same old button configuration." They
did — every fix so far had kept `HudPlate`'s own shape rule intact, and that
rule was written the OPPOSITE of the design study: "the shape is not a pill,
and that is the point" argued a capsule over a photographic frame reads as a
sticker, so every chip sat at a quiet `rounded-md`. The study disagrees on
exactly this, everywhere: its exit chip, live badge, stat pills, suggestion
chips and both 36px icon buttons are full capsules, and its cards are rounder
than `md` as well. No amount of glass tuning changes a shape, so the shape
itself was reversed:

- `HudPlate`'s `chip` shape: `rounded-md` → `rounded-full`. This is the single
  highest-leverage change in either pass, because EVERY small control on the
  Tutor route is a `HudPlate` — map, restart, "Leave the tutor", "Finish", the
  personalize list toggle, every `OfferChips` suggestion — so the reversal
  cascades to the whole surface from one token, with no per-call-site work.
  An icon-only chip (map, restart) is now a true circle because its padding is
  already near-square; a labelled chip is now a real capsule.
- `plate` and `sheet` shapes: `rounded-md` / `rounded-lg` → `rounded-2xl` (16px),
  matching the study's own card and board radius. This reaches the speech
  card, the docked lesson panel, the transcript sheet and the personalize
  panel's own sheet.
- The accent action (`.lf-lumen-solid`, `floor="accent"` on `HudPlate`) gained
  the study's "breaks the glass language" treatment: an ambient shadow tinted
  by the action's OWN colour rather than the scene's neutral ground-shade
  (`0 10px 24px -8px color-mix(accent 50%, transparent)`), a lighter accent
  rim, and a dedicated `scale(0.97)` press riding alongside the ordinary
  `.lf-press` travel. This is the "I'm ready" / "Check" / "Done" button on
  every Tutor screen.
- `.lf-lumen` gained its first hover state, ever: `@media (hover: hover)`
  brightens the edge (never the fill — a fill change on a translucent pill
  fights whatever scene is behind it) on any interactive glass control. The
  rule existed in prose already; there was no CSS behind it.
- The mic orb's fill went from flat `bg-accent` to a real two-stop gradient
  (`.lf-orb-fill`, lit from the lower-left on the same ramp as `.lf-coin` and
  the stage's own key light) — the study's one gradient BUTTON, reproduced
  with the project's own tokens rather than a second named colour.
- `PersonalizeInWorld`'s panel gained the study's strongest typographic
  signature: a `SectionHeading` helper pairing a tinted icon with
  `.lf-eyebrow` (already defined, unused for this) over each group — "YOUR
  TUTOR" (accent/`smart_toy`), "WHERE" (delight/`public`, standing in for the
  study's cyan — DESIGN.md's closed palette has no cyan token), "THE LIGHT"
  (warning/`wb_sunny`). `PlateChip`'s selected state gained an outer glow
  alongside its existing inset ring, matching the study's "solid fill + border
  + glow" selection language instead of the border alone.

`HudPlate.test.tsx`'s "is a pane, not a pill" test asserted the OLD rule by
name and was rewritten rather than deleted — it now pins the reversal itself,
so a future accidental revert fails loudly instead of silently.

**What this deliberately did NOT touch:** `PersonalizeInWorld`'s architecture
(still not a modal — see the entry above), and the ~20 lesson-engine segment
body renderers the Tutor's live board hosts (still not re-skinned per
segment — see the same entry). The shape reversal is a material-tier change;
it does not argue with either of those structural decisions.

### The mic orb prints its name again, on desktop (2026-09-06)

The owner supplied the actual Stitch export (the zip, not a description of
it) and its real screenshots settled a question this document had been
answering from a text extraction: the design study's mic dock is not a bare
orb, it is the orb with "Toca para hablar con Leo" printed beside it, always.
`MicOrb.tsx`'s own header comment records why that caption was removed on
2026-08-22 — a stacked orb-plus-plate was two surfaces for one control — and
that reasoning was never wrong; what it did not anticipate is that the study's
caption is not a SECOND surface at all, it sits beside the orb in one
conceptual dock. Restoring it plainly risked a real, previously-fixed bug: on
mobile this row is shared with the portalled composer (`StageShell.tsx`,
`attachBelow`), and `min-w-[9.5rem]` on that slot exists specifically because
a wide sentence next to the orb once starved the composer to an unusable 10px
input.

The caption is back at `lg:` only, as an `absolute`, `aria-hidden`
`.lf-stage-pill` positioned beside the orb rather than as a flex participant —
it costs the shared row nothing to lay out, on any breakpoint, so it cannot
reopen that bug, and `aria-hidden` keeps the button's own `aria-label` as the
one accessible name. Below `lg:` the orb is exactly what it was: the mockup's
own mobile screen gives its dock a full-width row with nothing sharing it,
which is not this route's layout, and forcing the caption into a row it does
not have room for would be exactly the "derived, not designed" mistake this
document exists to catch.

### The Tutor's conversing panel, photographed a second time (2026-09-05)

The first Tutor pass fixed the STAGE CHROME (the exit chip, the stage pill
material, the mic orb's ring, the rim that learns the hour). It never looked at
the docked lesson panel itself — the actual surface a learner spends a
conversation looking at. Photographed beside it, three concrete gaps, all
fixed:

- **The session-minutes rune was bare text sitting among four bordered chips.**
  Three render sites carry this string (desktop world chip, mobile HudPlate,
  and the docked panel's own header) and only two had ever been touched. The
  third — the one actually visible in the docked desktop view — is now the
  same `.lf-stage-pill`-adjacent chip as its siblings, with the same live dot,
  gated on the same `socket.budget === 'running'` truth.
- **The panel had no seam between its header and its body.** One continuous
  fill from the minutes chip to the composer, with nothing marking where
  chrome ends and conversation begins. A `border-b border-content/10` under
  the header row — ink-based, so it reads as a soft light line on this dark
  glass the same way the design study's `border-white/10` does — desktop only,
  because on mobile that row IS the drag handle and its own grip bar already
  marks the seam.
- **`.lf-answer` objects nearly merged into a READING-density Lumen plate.**
  `--lf-obj-lift` (how much more key light an object catches than the pane
  under it) was tuned at 7% against an ordinary 68%-alpha plate. Inside a
  `reading` plate — the ONE surface per phase dense enough to carry paragraphs,
  at 97% alpha — the pane's own fill is already most of the way to
  `--lf-lumen-fill`, so a 7% lift left object and pane within a couple of
  percent of each other on the Tutor's dark stage: nearly the exact "flat" read
  a lit object exists to prevent. Raised to 13%, verified against a real
  capture rather than only computed.

Also: the speaker's portrait avatar (`TutorFace`, both call sites) gained the
design study's identity-chip treatment — a tinted `accent/30` ring — in place
of a bare photo crop.

**Deliberately NOT done, and why:**

- **The mockup's coin-grouping board (icon-tile header, colored group boxes,
  gradient coins, formula chip) was drawn against ONE exercise — grouping
  coins into four lots of three.** The Tutor's live board renders whichever of
  ~20 lesson-engine segment types the conversation calls for, most of which
  carry no coins and no groups. Re-skinning one demo's specific objects onto
  every segment type would mean inventing visual meaning the content does not
  carry. The money family's own instruments already got the coin/well/summary
  treatment in the lesson engine pass; that is where it belongs.
- **The mentor's live spoken caption was not given `markTerms`.** The lesson
  player's version works because a lesson author writes `**4 monedas**` into
  authored content. The Tutor's speech is a live word-by-word typewriter over
  freeform model output with no such markup, synchronised to lip movement by
  slicing the raw string char-by-char — invented client-side "important word"
  detection on that text would be exactly the kind of decoration this
  document elsewhere forbids, and slicing through a markdown token mid-reveal
  would corrupt the very mechanism the caption depends on.
- **`PersonalizeInWorld` was not rebuilt as the mockup's floating settings
  dialog.** The owner rejected that shape twice, on the record in the
  component's own header comment, for reading as "una configuración de uso"
  rather than as a place — the file's whole architecture (in-world chips at
  the mark of the thing they change, one resting row, a guaranteed list
  behind it) is the fix for that rejection. Reverting to a modal would be
  reintroducing the exact thing already fixed.

### Layout measures

`max-w-lesson` (768px) and `max-w-board` (1140px), both deliberately under
`container` (1200px). A lesson stays narrow enough to hold one thought; a
dashboard may use the freed width. Spreading a lesson to full desktop width is
how a bite-sized exercise starts reading as a document.

### Screen recipes → Learn

**Carousel, then chapter.** Two objects in the order a learner needs them:
WHICH course, then WHICH lesson.

1. **Course carousel** — one card per course, the one in progress leading and
   badged `ACTIVE COURSE`, the rest `NEXT IN YOUR PATH`. Progress bar and a
   percentage chip when started, a quiet "not started" line when not. **It is a
   scroller, not a slideshow**: a real overflow container with CSS scroll-snap,
   so a touch drag, a trackpad swipe, a Tab to an offscreen card and a screen
   reader's own reading order all work with no JavaScript. The arrows and dots
   only call `scrollTo`. Two consequences that are easy to get wrong: the
   active dot is read off the scroller (a state variable only the arrows write
   goes out of phase the first time somebody swipes), and it is read from the
   **leading** card, not the centred one — with three cards visible, "nearest
   the middle" lights card 2 while card 1 is flush left, and it does so on the
   first paint, before anybody has scrolled.
2. **Chapter lesson list** — ONE chapter, the one the learner is inside, as a
   run of rows: a state token, the number and title, a state line, minutes, an
   XP chip. The current row takes the accent ring and a `CURRENT` badge; the
   next chapter follows as a single collapsed row. Not the whole course — a
   course is dozens of lessons and this screen answers "what do I do next",
   which is exactly one of them. **Every state is server-derived** (`LessonNode.state`
   from Core's course tree) and never recomputed here from progress numbers: a
   client that decides for itself what is unlocked is a client that can be told
   otherwise. A locked row is TEXT, not a disabled button — a disabled control
   still takes focus in some assistive technologies and promises something
   pressing will never deliver.

This replaced a hero card for one course followed by a grid of the same
courses. Two lists of the same objects, where the grid existed only to reach a
course the hero was not showing — which is what a carousel does, in the space
the hero already had.

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
- **Categorical stacked bar** (console-only) — for a count split across a SMALL
  CLOSED SET of categories over time, where the split is the question and the
  total alone would hide it. Recharts, like the interactive area chart, and
  bound by three rules. **(1) At most three series**, from `primary`,
  `success`, `warning` in that order — a fourth category folds into an "other"
  band or the chart becomes a different one. That trio is not a taste call: it
  was checked for colour-vision separation, and the obvious pairing of two
  brand hues (`primary` + `delight`) FAILS at ΔE 11.4 for normal vision, let
  alone for protanopia. **(2) Identity is never carried by colour alone** — the
  trio sits in the 6-8 CVD band, so a legend is always present and a table view
  is always available beneath the chart. **(3) Status hues are admissible here
  ONLY where the status meaning and the category meaning coincide** (a band the
  reader must discount is genuinely a `warning`); anywhere else, reduce to one
  series and use the area chart. Quiet axes, no animation — a bar that regrows
  on every poll makes a value harder to read, not easier. First built for
  `/admin/analytics` § Audience.
- **Characters** — Dina, Liruf, Dr. Rho, Zara Vex (canonical; no new mascots
  without sign-off).

The three below live in `frontend/src/tutor/hud/` rather than
`components/ui/`, because they are meaningless off the immersive layer. They
are listed HERE anyway: without them, "components/ui is the only building
blocks list" would be violated by every single control on the Tutor route, and
a rule violated everywhere stops being a rule.

- **HudPlate** (Tutor route only) — the one primitive every in-scene control
  composes from: chip, plate, orb, sheet, rune. It is where §Lumen is applied
  ONCE rather than remembered fourteen times: the material, its two densities,
  the pane radii, the 48 px authored tap target and the `.lf-settle` entrance.
  It is ONE painted surface — the inner span is layout only — because the
  frame-plus-opaque-core sandwich it replaced put a 2 px lighter ring around
  every control, which is the silhouette of a sticker. It
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
  focusable, which is the same failure wearing a sliver of glass.
  **Hiding writes `display` and not only the `hidden` ATTRIBUTE** (added
  2026-08-22): `[hidden] { display: none }` is a 0-1-0 attribute rule, any
  `display` utility on the same node is a class and beats it, and the node then
  reports `hidden === true` to every script that asks while painting perfectly
  normally. The projector had already learned this for the cull; the occlusion
  guard learned it from a `flex` cluster that measured hidden and stayed on
  screen. That cluster is the audition's candidate, which is NOT a `WorldChip` —
  a candidate needs two controls, choose and invite — so it copies the projector
  contract by hand, and it has to be handed this guard by hand as well
  (`useHudOcclusion`, exported for exactly that one caller). A chip that
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
  **It is ONE surface, always** (added 2026-08-22). While the microphone can be
  used it prints nothing at all: the name is the button's accessible name, the
  glyph is what a learner reads, and the state is carried by colour, by the
  breathing, by the meter ring and by `aria-pressed`. While it cannot — a policy
  refusal, a phase with no socket, or the browser saying no — the reason is
  printed INSIDE the orb's own plate, with the ring drawn on that plate rather
  than wearing a second one of its own, because §Elevation rule 6 forbids
  stacking glass on glass. The old arrangement was a 96 px orb with a plate
  underneath naming it, in five of the seven phases, plus a THIRD plate the
  shell published beside it when the browser refused — a separate surface saying
  the control was unusable, next to a control that still looked perfectly
  usable.
- **TutorFace** (Tutor route only) — the speaking character's 2D head,
  articulating, inside the caption plate beside the words. It is an
  ACCESSIBILITY channel and not an avatar: `liruf` and `dina` have no mouth in
  3D (/TUTOR_3D.md §3.1) and all four are selectable as the tutor, so for half
  the cast this is the only articulating mouth in the product. It is
  `aria-hidden`, because the plate around it is the live region carrying the
  sentence and a character announced on every turn is noise in front of the
  words. It crops itself to the head by MEASURING the artwork rather than by
  carrying four sets of coordinates, and when it cannot measure it shows the
  whole figure rather than a wrong crop. See §Lumen → *One line, one printing,
  two channels*.
- **`.lf-scroll-edge`** (a recipe, not a component) — the two soft ink gradients
  that appear at the top or bottom of a scrolling box when there is content
  beyond that edge. Written imperatively by `useScrollEdges` onto the box's
  FRAME (a pseudo-element inside a scroller scrolls with the content), because a
  scroll handler on this route may write an attribute and may never call
  `setState`. It is visible at rest, on a phone, before anything is touched:
  §Layout forbids hover-only affordances, and an overlay scrollbar is a
  hover-only affordance that also waits until the learner has already found the
  scroll. See §Lumen → *Room to answer in*.


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

**Learn (`/learn`, `/learn/:slug`, `/learn/:slug/territory`,
`/learn/:slug/placement`)** — added 2026-08-24, and like the Tutor entry, the
ABSENCE of this one is why it exists. §0 makes building outside a recipe a
design bug; there was no Learn recipe, so four screens were assembled out of
the Dashboard's grammar plus whatever the previous screen had done, and each
pass added a label rather than removing one. The result was a course page that
printed the learner's next lesson in three places at once and a home page where
one course occupied nine text elements. The rule this recipe encodes: **on the
learn surfaces, a fact is printed ONCE, and the largest thing on the screen is
the thing to tap.**

- **Learn home** — three blocks on `base`, nothing else. ① a quiet
  `lf-headline content-muted` greeting; ② the **resume card**, one `hero` Card:
  course title at `lf-display-lg` (the biggest type on the page — the course,
  not the salutation), ProgressBar + `passed/total` on one line, ONE indigo
  Button, and the badge medallion with Dina opposite it. Art on top and centred
  below `sm:`, beside the copy above it. ③ the **catalog**: an `lf-headline`
  line and the **Card grid** (1 / 2 / 3, `gap-4`). A course card is
  medallion · title · ProgressBar + `passed/total`, and a trophy when it is
  finished. The whole card is the link, so it carries no CTA of its own, no
  lesson-count badge (the total is already in the pair of numbers), and no
  category caption. **The track filter appears only above six courses** — four
  pills to filter three rows is furniture, and the control earns its place when
  the grid stops fitting on a screen.
- **Course path** — one column, no rail. A slim sticky row (back chevron ·
  course title · `passed/total` · territory map icon) over a full-width
  ProgressBar that IS the course progress. Then the chapters: each is an
  illustrated **adventure band** (`scenes/`, 280 px at `md:`+, the whole scene
  scaled down rather than cropped below it, because the scenes anchor their
  subject to the bottom) with one `.lf-glass-deep` strip carrying name,
  `passed/total`, and a chevron; locked is a scrim and a padlock, completed is a
  trophy — the words for both live in the accessible name. Inside an open band:
  a one-line chapter header (icon · name · count), a `lf-caption content-faint`
  topic label, and the lesson rows. **A lesson row is the button and does not
  contain one**: state tile · title · `min · XP` (under the title on mobile,
  right-aligned from `sm:` so the width a desktop row gains is width the row
  uses) · chevron. The page's ONE accent CTA is the floating pill that jumps to
  the current lesson.
- **Territory** — back link, `lf-display` title, the progress strip
  (bar + `passed/total` + a `warning` chip only when reviews are due), and a
  legend **for the states actually present on the page**. Adventure Cards hold
  saga columns (Card grid) of topic chips: state icon · name · `passed/total`,
  plus a `warning` review chip. Locked adventures stay fog-of-war — name and
  padlock, the word in the accessible name.
- **Placement** — the Auth recipe's focused single column (`max-w-md` on
  `base`), one ProgressBar and a back chevron above it, one character with one
  short line, then a Card holding **a title and the options, and nothing
  between them**. A subtitle under a title that a character has just said in
  their own voice is the same sentence three times; the step carries the
  character's line or a subtitle, never both.

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

**Character presence scale** (owner direction, 2026-08-27 — the characters were
too small to be the presence a lesson needs). Every character in a lesson is the
3D model (`LESSON_ENGINE.md` §9.1), and a call site picks what the character IS
on that screen rather than a pixel size. Four steps, each defined at BOTH
breakpoints because §1.11 makes both non-negotiable:

| step | box (mobile → desktop) | framing | used for |
|---|---|---|---|
| `inline` | 80 → 96 px | bust | a voice in a list: one transcript line, a chip |
| `talk` | 112 → 144 px | bust | the character SPEAKING: narrator strip, feedback |
| `scene` | 176 → 224 px | full body | the character IS the subject: a story beat |
| `cast` | 128×160 → 176×208 px | full body, shared stage | the company, at the open and the close |

Two rules make the scale work and both were learned by looking:

- **A small box gets a BUST, not a whole figure.** A 96 px full-body avatar
  spends seventy of those pixels on legs and leaves the face twenty-five. The
  same box holding head-and-shoulders reads as a character looking at the
  learner. Presence is mostly FRAMING and only then size — which is why the
  narrator avatar grew from 56 px to 112 px on mobile without the speech card
  losing its readable width.
- **A row shares a stage.** `cast` frames a fixed world height with the feet on
  the bottom edge, so members stand at their TRUE relative sizes on one baseline
  — 1.61 m Zara visibly shorter than 1.92 m Dina. Framing each to its own box
  makes everyone the same size, which is right for a lone avatar and throws a
  group portrait away.

The narrator strip is a `grid-cols-[auto_1fr]`: the character column is sized by
the scale and the speech card takes the rest, so the card's width is a
consequence of a stated proportion rather than of whatever was left over. The
feedback banner shows its reacting character on MOBILE too — it used to be
`hidden sm:block`, so the most emotional moment in a lesson had no character at
all on the viewport where most learners are.

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
island and the learner watches their own world blink. **Replay is a phase of
this list and not an exception to it** (2026-08-22): a saved conversation is
performed on the same continuous canvas, by the character it happened with,
carrying the emotions and gestures it originally carried, and it opens on the
island the learner is already looking at rather than loading one of its own.

**Anatomy**, from the render outward:

- **The canvas** — full-bleed, `bg-base` behind it for the first frame and for
  the no-WebGL fallback. It carries `role="img"` with a localized description
  of what is actually on screen, built from the same catalog values the picker
  uses, so the scene is described rather than simply absent for a blind
  learner.
- **World-anchored chrome** — the caption above the speaker's crown over a
  24 px gradient scrim, offer chips at the tutor's chest, rim pads on the
  island, **one sun marker on the sky arc** during personalization, recap chips
  at the places they recap, and one small rune over the
  sky for minutes-left. All WorldChip over HudPlate, each mirroring a
  pickable mesh, each hidden and inert when its anchor leaves the frame —
  and each culled against its own BOX, not against its centre point, so a chip
  is never left half off the frame and still focusable.
  **One control per axis, not one per option** (added 2026-08-22). The light
  used to be four labelled stops across `sky.mark.0..3`. Every sky mark sits at
  the same height on one circle, so an arc seen edge-on is a point: measured at
  375x812 the four were 45 px wide inside a one-pixel vertical band, spending
  most of the camera's orbit rising off each other on the stacking rule, in
  blank sky, above an island painting 12% of the viewport — four of the twelve
  surfaces on that phase. One marker shows the light that is ON and moves the
  sun along the arc when it is pressed, which is both what a sun does and one
  label instead of four. Picking a specific option directly is what the
  guaranteed list is for; the world gets the gesture, the list gets the menu.
- **The lesson plate** — the ONE surface carrying the conversation and a live
  exercise. **Desktop: a DOCKED FULL-HEIGHT PANEL** (owner sign-off 2026-08-28,
  superseding the floating corner plate of 2026-08-22, which the owner rejected
  on use: a content-fitted corner plate gave the transcript no stable home and
  the screen read as disorganised). It is `inset-y-0 right-0`, width
  `min(27.5rem, 34vw)`, square against the viewport edge and rounded toward the
  island, holding — in order — the header row (minutes · start-over · finish),
  status lines, the live activity, the "explain it another way" chip, the FULL
  conversation log (never compacted at this breakpoint), and the composer.
  What the 2026-08-21 rejection actually taught is KEPT: the material is Lumen
  over a full-bleed canvas — never an opaque slab — and the island keeps
  roughly two thirds of the width with the camera composing the character into
  it (the panel publishes its rect on the `lesson` safe-area slot; the mic dock
  steps left of the corner claim). The distinction from the rejected build is
  the MATERIAL and the stage's primacy, not the panel's absence.
  **Its body is a COLUMN and does not scroll**: the question is pinned above,
  the action is pinned below, and what moves is the answers between them
  (§Lumen → *Room to answer in*). **Mobile: a bottom sheet** with the three `sheet-detents` — PEEK
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
  to make room for itself. **Composing around it means the AIM moves and the
  SHOT does not** (clarified 2026-08-21): every shot in `/TUTOR_3D.md` §9.1 sits
  at its own distance, so switching shot when an activity arrives changes that
  height by construction. An earlier build read this bullet as permission to cut
  to a different framing and put the back of the tutor's head across a whole
  phone; the shot mapping can no longer be told a segment exists.
- **The mic orb** — MicOrb, on the bottom safe area: centred from `lg:` up, and
  below that **sharing its row with the composer**, orb first. Height is the
  scarce dimension on a phone and the orb is the hero that keeps all 96 px of
  it, so what gives up a row of its own is the text field, which needs 48 px of
  a row the orb has already paid for (192 px stacked → 136 px measured at
  375x812). With the lesson plate and the way out it is one of exactly **three**
  viewport-anchored elements on the route; everything else is anchored to the
  world. All three are viewport-anchored for the same reason: a thumb does not
  move with the camera. **It is present in every phase where speaking is
  possible, about to be possible, or is itself the thing being explained — and
  in no other** (added 2026-08-21, after the owner tested a phone). "Always
  mounted" was the fix for four phases having no microphone at all, and it was
  right for three of the four; applied to the goodbye it put a 96 px DISABLED
  orb at (139, 632) on top of the "See you soon!" plate, on top of the indigo
  "Start another session" — the one action of the phase — and on top of its own
  reason line. The decision is a field on the plan
  (`stage/micForPhase.ts` → `present`) rather than an `&&` at a call site, so a
  new phase cannot be added without making it. It is absent from exactly TWO
  phases (updated 2026-08-22): `closing`, and `replaying` — a replay is a
  recording, the learner cannot talk to it, and offering a child a microphone on
  the one screen where speaking into it can never do anything is the goodbye's
  bug in a worse form. Its absence is the phase's first and most physical
  statement about what a replay is.
  **The dock it stands in is the phase's bottom cluster whether or not the orb
  is in it** (added 2026-08-22). `closing` used to lay its own three surfaces
  against the bottom edge through a `bottom` StageLayer, and a bottom layer's
  only channel is `keepClearOf`, which moves the microphone dock — the one thing
  that is not there. So nothing told the composition solver the goodbye existed:
  measured at 1280x800, the establishing shot centres the island, the tutor
  stands in the middle of it, and "See you soon!" landed at (480, 619) across
  their chin and mouth, on the one screen whose entire job is a warm last look
  at the character. The goodbye is portalled into the dock instead
  (`tutor/ClosingInWorld.tsx`), which is measured on the `mic` safe-area slot
  and therefore a rectangle the camera already aims around. The count of
  viewport-anchored surfaces is unchanged: this IS the bottom cluster, wearing a
  different set of controls on the phases the microphone is not using it.
  **`replaying` wears a transport** (added 2026-08-22): play/pause as one 72 px
  round accent control where the orb stands, back and forward a line at 48 px
  either side, "Line 4 of 18" over a progress ribbon, and the chip that leaves.
  **Its measured rectangle may not change from beat to beat**, and that is a
  camera rule rather than a tidiness one: the dock publishes itself on the `mic`
  safe-area slot, so a row that appears on every learner turn makes the
  CHARACTER rise and sink in time with whose turn it is. Driven at 375x812 the
  learner's own line was doing exactly that. The row carrying it therefore
  contributes no height — an `h-0 relative` box with the plate positioned out of
  the top of it — and the dock measures (15, 480, 345, 216) on every beat of the
  performance. Same rule, same reason, as the lesson plate's "identical
  on-screen height with and without a segment".
  **Where a phase's OWN disclosure goes, and why `z-40` was never going to
  work** (added 2026-08-22). `StageLayer`'s wrapper is `absolute inset-0 z-30`,
  which is a positioned element with a z-index and therefore a stacking context:
  a `z-40` child of a layer is confined to the layer's 30, and the dock — also
  30, and later in the DOM — paints over it. The introduction's saved-conversation
  list was built that way, and at 375x812 the two dock chips sat across the list
  with "Play it again", the only control on the surface, half covered underneath
  them and still pressable. Anything a phase opens ON PURPOSE and closes again
  belongs in the dock's `above` slot, where the goodbye's copy of the same list
  already was.
- **The way out** — a HudPlate chip at the top-left safe area (`hud-inset`,
  16 px mobile / 24 px desktop), back arrow, first in the tab order, above the
  loading veil, and **never culled**. **The translated line rides with the arrow
  from `md:` up and is dropped below it** (added 2026-08-21), which is a
  measurement rather than a tidy-up: labelled, the chip is 155 px wide and spans
  the speech caption's only horizontal escape route, so a 266 px caption pushed
  clear of it would run off a 375 px screen and the solver's only remaining move
  is 37 px straight DOWN — the greeting laid across the tutor's forehead.
  Unlabelled it is 44 px, the escape is 22 px sideways, and nobody notices it
  happened. The tap target is unchanged (`min-h-11 min-w-11`) and `aria-label`
  carries the same sentence at every width. It went from two
  to three here, on 2026-08-21, in the commit that fixed the reason: the way
  out had been a world rune on a sky mark plus an `sr-only` button revealed by
  focus, and neither is reachable by a pointer user in a close-up — the rune is
  culled the moment the camera stops framing the sky, and a skip link is
  revealed by a key nobody on a phone presses. This route removes the sidebar
  and the tab bar, so navigation has to come back somewhere, and a third
  floating PANEL is what the count of two was protecting against, not the
  navigation the immersive exception took away. **The count is closed again at
  three**; a fourth is an owner decision.

**An adaptation offer is a MOMENT, and the screen clears for it** (added
2026-08-22). "Shall I explain that differently?" is one character putting a
question to another in front of the learner, and it has exactly two answers.
Driven at 375x812 it was a form: the island was a thin strip across the middle
and the bottom 45% held five stacked surfaces — the question, the two answers,
the orb and the composer, a status line, and the sheet's own resting row. Every
one of them worked and the composition read as a panel app with a picture in it.

For the length of the question, and for nothing else on this route:

- The **lesson sheet stands down** (`LessonPlate` → `standDown`). Hidden, never
  unmounted — a half-finished exercise keeps its state and the sheet returns at
  PEEK the instant the question is answered — and it publishes a footprint of
  zero while it is down, so the dock drops to its own resting inset instead of
  riding above a surface that is not there.
- The **composer is absent**. A closed question already has both of its answers
  on screen as chips; a text field under them is a third way to answer it, and
  it costs 56 px of the one screen this rule exists for. It is suppressed at the
  PORTAL, so whatever was typed is still there afterwards.
- The **microphone stays**, because a learner may say "yes please" out loud, and
  because it is the one control that is present in every phase where speaking is
  possible (§Components → MicOrb).

Measured on `/dev/tutor-lab`, before → after: at 375 px the island covers
35.0% → 39.3% and the surface count goes 8 → 7; at 1280 px it covers
54.0% → 60.6%, the surface count 8 → 6, and the word count **103 → 48** —
the last of those is the §Lumen duplicated-tutor-line deletion finally landing,
since the sheet carrying the transcript is the surface that was printing the
speech caption's sentence a second time. (Re-measured at the ship sweep with the
orbit stopped, and with the dock no longer stepping aside for a plate that is
not there: **44.4%** at 375 and 60.8% at 1280, 27 words at both. The table at the
end of this section is the current set; the numbers above are kept as the
before/after that justified the rule.)

**No two HUD surfaces may claim the same pixels at rest** (added 2026-08-21).
The route lays chrome out two incompatible ways — CSS against the viewport for
the three fixed elements, and the CAMERA for everything anchored to the world —
so neither system could see the other and three separate collisions shipped: the
greeting caption under the way out at 375 px, the disabled orb on the goodbye's
button, and `unavailable` printing the same sentence twice on top of itself. The
arbitration is one shared registry, not a set of tuned constants. Every
viewport-anchored surface publishes its measured rect
(`tutor-scene/SafeAreaContext.tsx` → `chromeRef`, which is a SUPERSET of the
three the camera composes around: the way out is keep-out for the HUD and
invisible to the camera, because charging a 44 px corner chip as a 60 px top
inset would push the subject down the frame in every phase).

**A REGISTRY IS ONLY WORTH WHAT ITS RECTANGLES ARE WORTH** (added 2026-08-22).
They are published by a `ResizeObserver`, and the microphone dock is the one
surface that MOVES without changing size: riding above the personalization panel
or a raised lesson sheet writes one inline `bottom` and nothing else, so the
observer stayed quiet and the published rectangle stayed at the bottom of the
screen. Both readers were then reading a lie — the camera composed the cast into
a band the microphone had left, and `WorldChip` could not tell it was being
covered. Measured at 375x812 with the personalization list open and the ambient
orbit stopped: the dock had risen to (15, 223, 345, 156) with three candidates'
name plates underneath it, clipped and still in the tab order, while the island
was squeezed into a strip of palm tops at the top of the frame. The dock
re-publishes its own rectangle from the one place the move happens
(`StageShell` → `setFootprint`), and anything that moves chrome without resizing
it owes the same.

World-anchored
chrome then answers being covered in one of exactly two ways: a WorldChip
**hides** (it mirrors a pickable mesh that is still there), and the speech
caption **moves**, by the shortest displacement that clears and stays in frame
(`tutor-scene/hudSpace.ts`), because it is the deaf learner's whole channel and
may never hide. A caption that cannot clear within a quarter of the viewport's
short side stays put rather than half-escaping. `/dev/tutor-lab` prints the live
collision count beside the phase switcher; a phase that overlaps at rest is a
bug, and one that overlaps for a frame while a sheet animates is not.

**A CANDIDATE'S NAME PLATE MAY NOT BE CULLED BY ONE PIXEL** (added
2026-08-22). The plate over a candidate's crown is the surface a learner taps to
choose them, and it was disappearing. Measured on `/dev/tutor-lab` at 375x812
with the camera held still: Liruf's cluster projected to x = 321 with a
half-width of 55, so its right edge landed at 376 against a 375 px viewport and
the ordinary box cull hid it and made it inert. The audition then showed three
candidates and a fourth character standing there unlabelled — which is the exact
failure the audition was built to fix, present at that bearing the whole time,
and invisible to a screenshot taken while the ambient orbit happened to be
somewhere else. His is the widest cluster because he is the current companion
and carries the dismiss orb; a longer name in another locale reaches the same
edge with no orb at all, so trimming the cluster only moves the failure.

So a candidate's plate **clamps** (`ScreenAnchor` → `AnchorOptions.clampToFrame`)
rather than hiding. The rule above — a chip pressed flat against the frame edge
points at nothing — is about a control naming a PLACE that has left the picture;
this one names a PERSON who is still standing fully inside it. It is the weaker
half of the caption's `keepInFrame`, and deliberately so: **behind the camera it
still culls**, because a name parked at the top of the frame for somebody nobody
can see is worse than no name at all.

**"May never hide" includes the FRAME EDGE, and for a year it did not**
(corrected 2026-08-22). The escape above only ever cleared viewport-anchored
CHROME; nothing cleared the edge of the picture, so the caption fell through to
the ordinary box cull like every other anchored node. Measured on
`/dev/tutor-lab` at 1280x800 in `conversing`: the closeup fills the frame with
the tutor's face, the crown is above the top of the screen, and the caption node
was `hidden` and `inert` for the whole conversation — the same at 1280x800 in
`introducing`. On desktop the tutor's words existed only inside the lesson
plate, and that plate rests CLOSED on a phone, so the rule that was supposed to
protect the deaf learner's only channel was the rule taking it away. The caption
now **clamps** back inside the frame (`tutor-scene/culling.ts` →
`clampIntoView`), inset by the same gap it keeps over a crown so it reads as
resting against the edge rather than cropped by it.

**And then it escapes the chrome AGAIN, because the clamp had just put it back
under it** (corrected 2026-08-22). The escape runs on the position the CAMERA
asks for, and at a close-up that position is off the top of the frame entirely —
so the plate overlapped nothing, the escape correctly did nothing, and the clamp
parked it a gap below the top edge, which is exactly where the way out stands.
Measured at 375x812 in `conversing` with the ambient orbit stopped: the caption
at (55, 8, 265, 112) against a way out at (16, 16, 48, 48). The two operations
are one function now (`tutor-scene/hudSpace.ts` → `clampThenEscape`), in that
order, and escaping second cannot undo the clamp: the escape refuses any
candidate that leaves the frame, so all it can do is slide the plate along the
edge it was just parked against — 17 px, in that case. It is a per-node opt-in
(`ScreenAnchor` → `AnchorOptions.keepInFrame`) and the caption is the only node
that has it: for everything else disappearing is correct, because a chip pressed
flat against the frame edge points at nothing.

**Colour and contrast.** Every surface on this route is made of **Lumen**
(§Lumen), which supersedes the opaque-floor rule of 2026-08-21: the plate is
translucent, its contrast is guaranteed by a proven alpha bound rather than by an
opaque token, and the layer carries ONE ink at chrome density. One indigo action
per phase still holds, and during a conversation the mic orb IS that action — so
an offer chip is a secondary, not a second CTA. An indigo action is the one thing
on the layer that is NOT glass: `.lf-lumen-solid`, a solid object keeping only the
seated shadow, because a call to action should not read as one more window onto
the island.

**Responsive.** At 375 px: the sheet detents above, the orb at 96 px, and
anchored controls that clear the 44 px minimum tap target BY CONSTRUCTION —
invisible padded pick proxies sized from the character measurements, never by
hoping the mesh happens to be big enough at that camera distance. **The scene
keeps the majority of the viewport in every phase the learner did not ask to
change**, and that is a number somebody has to measure rather than a feeling.
(True of five of the seven phases as of 2026-08-22, up from two; the exceptions
and the reason are at the end of this section.)
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

**FIXED 2026-08-22, and the fix was the fit STRATEGY rather than its
arithmetic.** An island shot no longer asks "how far back must I be to contain
this bounding box"; it asks "how close may I stand and still hold the points I
promised", and lets everything else run off the edges. On a portrait phone that
also means TILTING DOWN: the island is a floating disc on an alpha canvas, so a
camera near eye level sees it edge on with transparency above and below, and the
disc's projected height grows as `sin(elevation)` while its width does not move
at all. Half of the loss was in `composition.ts` rather than in the framing — a
fitting shot used to retreat by `viewport / free`, so the microphone dock pushed
a shot that had just been sized to fill a phone back until it filled a third of
one; the retreat is now measured against the radius the shot says it is holding,
which for a subject that deliberately bleeds is no retreat at all.

Re-counted from the canvas alpha channel, same method, same fixtures, at
375x812: **arriving 6.5% → 50.7%, closing 10.7% → 50.1%, unavailable 3.3% →
51.6%, adapting 6.9% → 34.6%, personalizing 12.6% → 30.2%**, with introducing
(72.3% → 73.9%) and conversing (69.1% → 69.1%) unchanged, as they must be —
those two hold a character at a fixed on-screen height. At 1280x800: **arriving
13.6% → 53.1%, unavailable 6.6% → 53.3%, adapting 22.3% → 47.4%, personalizing
32.6% → 48.8%, closing 25.9% → 44.7%**, introducing and conversing unchanged.
Every phase now paints at least 30% of a phone and at least 44% of a desktop.

**Deleting chrome moves the same number, which is the point of deleting it.**
Re-counted after the applying pass of 2026-08-22, same method, same fixtures, in
both themes, at 375x812: adapting **34.7% → 38.7%**, introducing 73.8% → 75.1%,
conversing 69.3% → 70.2%, unavailable 51.7%, arriving 50.7%, closing 50.2%,
personalizing 29.4% (unmoved: that phase's chrome is the plate, and the plate is
where the nickname lives). At 1280x800: adapting **46.8% → 53.8%**, introducing
**54.5% → 61.4%**, conversing 61.6% → 63.4%, arriving 53.3%, unavailable 53.2%,
personalizing 48.5%, closing 45.0%. Every measurement above is taken with the
camera given **seven seconds** to settle after the phase switch, and that number
is itself a correction: the same sweep at 2.2 s photographed a mid-travel camera
and reported a decapitated tutor at 375x812 in two phases. A critically damped
camera has not arrived when the transition duration says it has, and a
screenshot of a camera in flight is a screenshot of nothing.

**THE SHIP MEASUREMENT, and it is the one to compare against from here.** Taken
2026-08-22 after the reconciling pass, on `/dev/tutor-lab`, all 28 cells — seven
phases x 375x812 and 1280x800 x light and dark — with the camera given **seven
seconds** to settle and the **ambient orbit STOPPED**, which is both what makes
two runs comparable frame-for-frame and what a reduced-motion learner sees
permanently. Coverage from the canvas alpha channel; words counted as visible
text nodes inside `[data-tutor-stage]`, ancestors checked (a parent-only
visibility test had been counting the first-frame veil's four words in every
phase, so every published word count before this one is four too high).

| phase | cov 375 | words 375 | surfaces 375 | cov 1280 | words 1280 | surfaces 1280 |
|---|---|---|---|---|---|---|
| conversing | 75.0% | 19 | 5 | 63.1% | 58 | 5 |
| introducing | 74.0% | 21 | 9 | 61.4% | 24 | 9 |
| unavailable | 51.1% | 7 | 2 | 51.6% | 10 | 2 |
| closing | 51.1% | 14 | 4 | 51.3% | 17 | 4 |
| arriving | 50.7% | 5 | 2 | 53.3% | 8 | 2 |
| adapting | 44.4% | 27 | 7 | 60.8% | 27 | 6 |
| personalizing | 29.9% | 17 | 10 | 48.5% | 20 | 10 |

Identical in both themes to within 0.1 pp. In every one of the 28 cells:
**0 interactive controls under 44 px, 0 HUD-vs-HUD overlaps at rest, 0 surfaces
off-frame, 0 horizontal document overflow, and 0 focusable elements that are
invisible** — that last one added to the sweep in this pass, because a control
that is `hidden` to a script and painted on the glass is the failure this route
has now shipped twice (§Components → WorldChip). The tutor's caption renders at
20.7 / 21.0 px at 1280 and 15.0 / 15.6 / 15.7 px at 375, never below
`lf-action`.

The 24 stops of the learner's WALK — arrive, choose a tutor by looking at them,
send a companion away, open the list, invite a companion, change the island,
change the light, type a nickname, close the list, start, hear the greeting,
pick an offer, open the activity, raise it, answer an adaptation, reach the
goodbye, open the replay archive, close it, meet an unreachable tutor — are
clean on the same three counts. One caveat measured rather than waved away: an
ISLAND CHANGE needs longer than a phase change. It reloads a `.glb`, re-solves
the placement and refits the camera, and at 5.2 s two candidates' plates were
still 20 x 6 px into each other; at 12 s they are 8 px apart, which is the gap
the clearance pass asks for. Seven seconds is enough for a shot; twelve is what
an island costs.

The floor is a TEST now, not a screenshot: `tutor-scene/shots.test.ts` → "how
much of the frame the island actually covers" casts one ray per sample against
the island's ground disc and holds each shot to a measured floor, so a phase
that leaves a phone two-thirds empty goes red. It is a headless LOWER BOUND on
the alpha measurement — it counts no rock, no palms and no characters — which is
the right direction for a gate to be wrong in; the browser pass stays mandatory.

`personalizing` is the one phase still under half a phone, and the reason is a
product requirement rather than a framing bug: it is an AUDITION, so the whole
catalog stands on the island at once out to 0.70 of its radius with a name plate
on each crown, and holding four of them inside a 17-degree horizontal field
costs about 19 m of stand-off. Coming closer culls a candidate — measured, at a
0.62 hold Liruf's plate comes back `hidden` — and a candidate who cannot be
tapped is the bug the audition exists to fix.

**THAT PARAGRAPH WAS A DESCRIPTION OF A CONSTRAINT WE HAD PUT THERE OURSELVES**
(corrected 2026-08-22). "Holding four of them costs 19 m" was arithmetic about
an arrangement, stated as though it were arithmetic about the cast — and the
arrangement was ours: the audition spread the four candidates out to 0.70 of the
island's radius, and `approach` then framed them through a PROXY, a symmetric
ring hand-tuned to 0.68 of the radius. Neither number was the people. On
`diorama-a` the cast's real spread was 1.97 m either side of the aim while the
proxy charged the camera 2.35 m, and the frame came out 5.56 m wide against a
6.5 m island: **29.9%** of a phone on the one screen a child chooses their tutor
on, with `arriving` at 50.7% two taps earlier.

Both halves moved (`TUTOR_3D.md` §5, §9.1). The shot holds the CAST itself, so
the framing is a function of where the people are instead of a constant somebody
tuned once; and the audition separates in DEPTH rather than across the frame,
because depth satisfies the same separation floor and costs the frame's WIDTH —
the axis a portrait phone has least of — nothing at all. `approach`'s own hold
became a floor equal to `establishing`'s, which says the rule in one sentence:
**the audition is never framed further out than arrival.**

Measured on `/dev/tutor-lab` with the orbit stopped, seven phases, both
breakpoints, both themes, all three locales: `personalizing` **29.9% → 49.1%**
at 375x812 and **48.5% → 55.5%** at 1280x800, with all four candidates on
screen and facing the learner, every name legible, 0 controls under 44 px, 0
overlaps at rest, 0 surfaces off-frame and 0 invisible focusables. No other
phase moved. The gate moved with it: `shots.test.ts` now asks the audition
question directly, with a four-candidate fixture rather than the two-person one
every other shot is checked against — holding two is strictly easier than
holding four, which is why the coverage floor stayed green through the whole of
the 29.9%.

**AND THAT CLAIM WAS TRUE FOR THE BEARING IT WAS SCREENSHOTTED AT, WHICH IS NOT
THE SAME THING** (corrected 2026-08-22). It said "at 375 px all four plates are
now on screen where three were before". Re-measured with the ambient orbit
STOPPED — which is also what a reduced-motion learner sees, permanently — three
were on screen and Liruf's was `hidden` and `inert`: his cluster projected to
x = 321 with a half-width of 55, one pixel past a 375 px frame. A moving camera
had been hiding a cull behind itself. The plate CLAMPS now rather than
disappearing (see the Tutor recipe → "a candidate's name plate may not be culled
by one pixel"), so the count is four at every bearing, and the surface count on
this phase went 8 → 10 because two controls came BACK rather than because
anything was added. **Screenshot this phase with the orbit stopped.**

**FEWER WORDS IS A COUNT, NOT A FEELING** (added 2026-08-22, the owner's
"menos palabras, más claridad; menos elementos, más simplicidad"). Every phase
on this route has a word count and a surface count, both measurable on
`/dev/tutor-lab`, and a change that claims to simplify states them before and
after. Counted at 375x812 — visible text nodes inside `[data-tutor-stage]`, and
`.lf-glass`/`button`/`input` boxes that are neither culled nor nested:

| phase | words before → after | surfaces before → after |
|---|---|---|
| arriving | 13 → 7 | 3 → 3 |
| personalizing | 28 → 20 | 12 → 9 |
| introducing | 50 → 31 | 10 → 10 |
| conversing | 27 → 26 | 6 → 6 |
| adapting | 38 → 36 | 10 → 10 |
| closing | 22 → 15 | 4 → 4 |
| unavailable | 15 → 9 | 3 → 3 |
| **total** | **193 → 144** | **48 → 45** |

Two things the table is honest about. `conversing` and `adapting` barely move
because almost every word on them is the TUTOR'S OWN, in the caption and the
transcript — which is the right answer: this pass cuts chrome, never the
lesson. And at 1280 px the same counts go UP on those two phases, because the
speech caption was being culled there and is now on screen (§the frame-edge
correction above); a channel coming back is not a regression in word count, it
is the word count finally telling the truth.

The rules that produced the cut, in the order they were applied. **A label that
repeats what the picture already says is a word to delete** — the greeting used
to end with "What would you like to look at together today?", asked directly
above four chips that are that question. **A second sentence that restates the
first is a sentence to delete** — "You've used all of today's tutor time. Come
back tomorrow!" keeps both halves because they are two facts; "Turn on anything
that helps. You can change it any time, and your tutor will follow it." kept
neither, because nothing on that panel is permanent and nobody said it was.
**A promise keeps its words** — the nickname helper still says the nickname is
the only name the tutor is ever told, because that is the sentence a learner
needs in order to choose what to type. **And shorter English is not shorter
Spanish**: labels swing up to 1.86x across the three locales, so each one is
written per locale rather than trimmed in en-US and translated.

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
- ✅ On the immersive layer, every control is IN the frame, every surface is
  made of Lumen, and its density is chosen by how much text it carries (§Lumen).
- ❌ On the immersive layer: no pill silhouettes, no `.lf-glass`, no
  `lf-caption` on world-anchored chrome, no `content-muted` at chrome density,
  no Tailwind `ring-*` for selection, and nothing written per frame except an
  anchored node's own `transform`.
- ❌ No emojis as icons, with no exceptions — the language switcher's flags
  used to be the one carve-out and broke on every non-macOS platform (Windows
  ships no glyphs at all for the regional-indicator emoji pairs a flag is made
  of), so they are real SVGs (`components/ui/LocaleFlag.tsx`) instead. No new
  infinite animations — with ONE carve-out, the Tutor
  stage's ambient camera drift (§Motion), which is bounded by reduced-motion,
  by the quality governor and by the duration of any live segment. A carve-out
  with three off switches is a rule; a carve-out with none is how the next one
  gets argued for.
- ❌ Never assemble a screen out of another screen's recipe because it is the
  nearest one that exists. That is what turned the Tutor into a dashboard.
  Write the recipe first (§0), in the commit that builds the screen.
