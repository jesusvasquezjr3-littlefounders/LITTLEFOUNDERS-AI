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

## Shapes

**Hyper-rounded. Sharp corners are prohibited** — they break the clay metaphor.

- `md` **16px** is the base radius (buttons, inputs, icon chips).
- `lg` **24px** for standard cards; `xl` **32px** for hero cards, lesson canvases, modals.
- **Pill (`full`)** for every interactive-progress element: buttons, progress bars, badges, toggles.
- Nested elements use concentric radius: inner radius = outer radius − gap.

## Components

The reusable kit lives in `frontend/src/components/ui/`. **Build with these; do not restyle per-view.**

- **Button (primary)** — chunky pill: `primary` fill, `label` type, 4px bottom border in `primary-strong` for the pressable look. Hover lifts, press compresses (see Elevation). One per view region. Secondary variant: `surface` + `clay-sm`, `primary` text. Minimum hit area 44×44px.
- **Card** — `surface` + `clay` + `rounded-lg` + ≥24px padding. Hero/lesson variant: `rounded-xl`, 32px padding.
- **StatCard** — square-ish card: icon chip top, `display-lg` number (`tabular-nums`), `caption` label. Icon chip color rotates `primary-soft`/`accent-soft`/`secondary-soft` by stat kind (XP=primary, streak=accent, accuracy=secondary).
- **IconChip** — 48px `rounded-md` square, `-soft` fill, solid-color icon. The only place decorative color is allowed.
- **ProgressBar** — pill track in `surface-sunken`, fill in `primary` (or `accent` for streak-quests). Always paired with a `label` value.
- **Input** — sunken: `surface-sunken` + `clay-sunken`, `rounded-md`, no outer shadow. Focus: 2px `primary` ring (visible, never removed).
- **Badge** — pill, `surface-sunken` fill, `caption` type ("Intermediate", "Beginner").
- **Sidebar nav item** — pill row: inactive = transparent + `content-muted`; active = `primary` fill + `on-primary` + `clay-sm`.
- **QuestItem** — row: icon chip + `title` + thin progress pill + status icon.
- **HintCard** — `primary-soft` fill (`dark-primary-soft` in dark), `rounded-lg`, `secondary`-tinted text; for lesson hints only.
- **Characters** — Dina, Dino, Dr. Rho, Zara Vex (`frontend/src/components/characters/`) are the canonical mascots; avatars are DiceBear `avataaars`. Characters appear on `surface` cards, never floating on raw `base`.

## Do's and Don'ts

**Do**
- Use tokens for every color, radius, shadow, and type style — no exceptions.
- Keep one primary action per view; one accent element per card.
- Style light AND dark at write time; test both before commit.
- Give every interactive element the press-compression physics and a visible focus ring.
- Route all strings through i18n ×3 locales (/AGENTS.md §1.8).
- **Verify every UI change at mobile (~375px) AND desktop (~1280px) before commit — screenshot both.** Non-negotiable (/AGENTS.md §1.11).

**Don't**
- ❌ Raw hex/rgb/arbitrary values (`text-[#3525cd]`, `rounded-[13px]`) — if a value isn't tokenized here, propose a DESIGN.md change first.
- ❌ Ad-hoc type compositions — the closed scale only.
- ❌ Sharp corners, 1px-border-defined cards, or flat Material shadows — clay tokens only.
- ❌ `transition: all`, animated `width/height/top/left`, `will-change` outside `transform/opacity/filter`.
- ❌ Glassmorphism, gradients-as-decoration, or more than one shadow style per element.
- ❌ New mascots, new icon sets (Lucide only), or text baked into images.
- ❌ Noise: decorative borders, double outlines around images, backgrounds behind backgrounds. When a screen feels empty, that's the design working.
- ❌ Shipping a component checked at only one breakpoint.
- ❌ A desktop layout that's a stretched mobile column with dead side whitespace, or a mobile layout that crams desktop density into a narrow viewport.
- ❌ Fixed pixel widths for layout structure outside `container-max`/`sidebar-width`.
- ❌ Hover-only interactions with no mobile equivalent.
