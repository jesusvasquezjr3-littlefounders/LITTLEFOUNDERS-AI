# 02 · Foundations — decisions, tokens and contracts

Status: **owner-approved decisions, verified in a prototype. Version 3 (2026-09-21):** the owner decisions OD-1 to OD-15 in `13-OWNER-DECISION-LOG.md` are applied (v3 adds OD-13 copy budget, OD-14 own visual assets, OD-15 the Mentor stage and the replacement of the legacy UI). Where this file and that log disagree, the log wins. Written in English because the file feeds an AI frontend agent.
Companion files: `01-RESEARCH-FOUNDATION.md` (evidence), `03-PROPORTIONS-AND-COMPOSITION.md` and `04-MOTION.md` (the two follow-up research passes), `05-TEACHING-VISUALS.md` (charts, mathematics, logic and money visuals), `06-COPY-BUDGET.md` (how much text), `07-ICONOGRAPHY-AND-VISUAL-ASSETS.md` (system glyphs vs our own assets; the real 3D characters), `08-MENTOR-STAGE.md` (the Mentor as a 3D character on the Diorama), `../mockup/littlefounders-mockup.html` (the visual reference; the values in section 3 are what it renders) and `../mockup/KNOWN-DEVIATIONS.md` (every place where the mockup contradicts this file or the owner decisions; do not copy those).

---

## 1. Decision log (all confirmed by the owner)

| # | Decision | Notes |
|---|---|---|
| D1 | Text never truncates, clips or ends in an ellipsis. Space must be used well. | Non-negotiable. Contract in section 7. |
| D2 | Light and dark are both first-class, defined from the start. | Section 5. |
| D3 | Typeface: more character and roundness, close to the references. | **Fredoka** (display, buttons, numbers in headings) + **Nunito** (text, labels, numerals). |
| D4 | Primary indigo becomes `#5c55fd` (was `#4f46e5`). | One value works in both modes. |
| D5 | Identity colours are reinforced by icon, shape and label. | Colour is never the only channel. Section 4.3. |
| D6 | **Gamification is HIGH in feel, buttons included:** press feedback, state transitions, the scene's own elements moving. | Section 9. Fixed rule, not a variable. Revised in v2 (OD-7): "high" never means celebrating every action. |
| D7 | **Celebration is budgeted.** Confetti, XP floaters and spring overshoot happen only on a closed list of milestones: lesson complete, course complete, savings goal reached, badge earned, streak milestones at 7, 30 and 100 days. | A correct answer gets a bump, a check mark and an informational banner, never confetti or a "+XP" floater. Confirming a coin split gets a confirmation, never confetti. A routine press uses scale feedback with standard easing, never spring overshoot. Idle motion has a hard budget (section 9.4). OD-7. |
| D8 | **One design system for everything and everyone; age registers by content.** | One set of tokens, components and shapes for every surface (marketing, learner app, parent experience, staff console, emails, public badge page, teaching visuals) and every user. What varies by age band (young child, tween-teen transition, teen, with a "graduation" around ages 10–12) is only copy tone, character presence, reward framing and social mechanics. Density changes by composition only. OD-4. |
| D9 | **No lives.** | No life or heart counter of any kind, not even one showing ∞. A wrong answer costs nothing. After several consecutive misses on the same skill, the learner's Mentor character offers a guided review (an offer, never a penalty or a lock). OD-1. |
| D10 | **"Tutor" means only the verified parent. The AI is the Mentor.** | Section 1.1 and 9.7. OD-6. |
| D11 | **Copy budget: say less.** Every string does one job in the fewest words a child in that band understands at first read. | Numeric budgets per role, a first-view limit, layering for detail. `06-COPY-BUDGET.md`. OD-13. |
| D12 | **Our own visual assets.** At most 24 generic system glyphs; everything that carries meaning or identity is our own SVG, WebP or Lottie in the house style; the Mentor characters are always rendered from the real 3D models in catalogue poses. Non-negotiable, like shape and colour. | `07-ICONOGRAPHY-AND-VISUAL-ASSETS.md`. OD-14. |
| D13 | **The Mentor is a 3D character on its Diorama, not a chatbot.** The legacy Mentor chat UI and the legacy buttons are deleted and rebuilt from this bible, never restyled or ported. | `08-MENTOR-STAGE.md`. OD-15. |

Earlier fixed rules still apply: flat-tactile solid colour, no glassmorphism, warm accent beside indigo, 3D characters wherever possible, 100% responsive.

**Correction to something I said earlier:** 44 CSS px is about **7 mm** on a phone (a CSS px is about 0.16 mm), not "7–11 mm". That is exactly the size at which children aged 7–10 were reported to miss roughly 30% of targets.

### 1.1 Scope, access and naming (owner decisions OD-2, OD-3, OD-5, OD-6)

- **The mockup is a visual reference only** (OD-2). It shows how the product should look and move. It is not the v1 scope and not the information architecture. Scope comes from the product's screen inventory and requirements (`10-PRODUCT-GOLD-STANDARD-REQUIREMENTS.md` and the screen inventory it cites), all designed in this one visual language. The frontend is rebuilt from scratch; the backend is migrated.
- **Access model** (OD-3). Individual users may self-register. The advanced features (Family, Wallet/Banking, Tasks) need a verified parent and a guardian link; a self-declared role never unlocks them. Exception decided by the owner (OD-3, Option B): a self-registered teen (13–17) without a parent gets a **personal wallet** (self-logged income, Save/Spend/Share, savings goals; simulated coins; no approval step); Tasks and anything a parent approves stay guardian-only. The mockup shows both modes (control bar: "Child in a family" / "Teen, no parent"). Families only: no teacher or school roles, no classrooms, no class dashboards. Every sign-up path (email, Google, guest) captures age, and every minor safeguard follows age, not role. Login accepts **email or username**: children sign in with a username and passphrase created by their parent.
- **Pricing is parked** (OD-5). The pricing route and every "Upgrade" or "See pricing" element are out of scope for v1. Marketing copy may say "free to start", never "always free" or "forever free". If a paywall is ever designed, it may never apply to safety features, parental controls, streaks or rest days, or error forgiveness, and it is never shown or charged to a child.
- **Naming** (OD-6). "Tutor" means only the verified parent (brand line: "Become your child's Tutor"). The AI is the **Mentor**: the learner chooses one of the four existing 3D characters (Dr. Rho, Zara, Liruf, Dina). The learner's own navigation tab shows the chosen character's name and avatar; parent views, staff views and documentation say "Mentor". Never label the AI "Tutor", "bot" or "assistant".

### 1.2 Language and platforms (OD-11, OD-12)

- **Translation is done by AI from a controlled glossary** (OD-11). The glossary below is copied from the decision log (section 5), which remains the source of truth. **Recommendation, not yet confirmed by the owner:** native human review of the registration, consent and money screens before launch.

| Concept | EN | es-MX | pt-BR | Never use |
|---|---|---|---|---|
| Verified parent | Tutor | Tutor | Tutor | (never for the AI) |
| The AI character | Mentor (or the character's name) | Mentor | Mentor | Tutor, bot, assistant |
| In-app currency | coins | monedas | moedas | money, pesos, reais (it is a simulation) |
| Chore | task / chore | tarea | tarefa | job |
| Parent's approval | approve | aprobar | aprovar | accept |
| Savings / spending / sharing | save / spend / share | ahorrar / gastar / compartir | poupar / gastar / compartilhar | invest (for the save pocket) |
| Rest day | rest day | día de descanso | dia de descanso | streak freeze (implies a purchase) |
| Allowance (regional) | allowance | domingo / mesada (confirm regionally) | mesada | |
| The Mentor's 3D scene | Diorama | Diorama | Diorama | |
| The Mentor screen | Mentor (the character's name in the learner's UI) | Mentor | Mentor | chatbot, bot, assistant |

- **Web first; a mobile wrapper shares the web frontend** (OD-12, resolved 21 September 2026 in the owner log §9). Tokens stay platform-neutral: the YAML in section 3 holds values, not CSS. The web implementation uses the container queries, text-reflow, fixed-viewport overlays and motion rules in this Bible. The future wrapper must preserve those behaviors, accessibility, safe-area handling and reduced-motion settings. Wrapper vendor selection remains open. Apple's Kids Category and Google Play's Families Policy restrict analytics, advertising and third-party services in children's apps; check both at design time, not at submission.

---

## 2. Rules an agent can check mechanically

1. One visual language. No audience-specific themes or components. Age bands change content (copy tone, character presence, reward framing, social mechanics), never tokens, components or shapes (D8).
2. No `backdrop-filter`, no glass, no gradient text, no drop-shadow ridge, and no decorative border on any component that has its own fill colour (section 4.4). Separation between elements is a change of fill colour or, for a neutral surface, a soft elevation shadow — never an outline drawn around a shape. Simulated depth/3D is reserved for the Mentor characters and the Diorama they stand on (`07`, `08`).
3. Identity/achievement fills are solid: `background: {hue}; color: on-{hue}`. Never fade a fill with opacity to make a tint; use `{hue}-soft`.
4. Every text-bearing element obeys the Text Fit Contract (section 7).
5. Every screen is verified in light and dark. `fill`, `ridge` and `on-*` are identical in both modes.
6. Colour never carries meaning alone: pair it with an icon and a word.
7. Reserved hues (section 4.2).
8. Touch targets: 48 / 56 / 64 px by function (section 8).
9. Every pressable gives feedback through colour and scale — not simulated depth (section 9.1).
10. Characters are 3D assets in a labelled slot, or on the Mentor stage (`08`). Text never lives inside a character asset. Nothing else in the interface simulates 3D, except the Diorama and, per OD-35, the one lazy 3D solids viewer of the Horizonte Visual (F4), which reuses the tutor-scene canvas and has SVG isometric alternates.
11. Body and UI text never falls below 14 px, and every text token reaches at least 4.5:1 on the surfaces it is used on.
12. Any overlay (dialog scrim, toast, sheet) uses `position:fixed`, anchored to the real viewport — never `position:absolute` inside a scrollable ancestor. An `absolute` overlay centers on the full scrollable content, not what the user can see, and on a long page can render off-screen entirely.
13. Re-rendering the DOM in place (opening a dialog, a toast appearing, a validation error) must preserve the user's current scroll position. Only an intentional route change resets scroll to the top.
14. Motion always has a reason stated before it is added — what event does this communicate — per section 9.9 and `04-MOTION.md`. Orchestrated patterns (stagger, wave) fire only on genuine route/screen entry, never on an in-place re-render from an unrelated interaction.
15. A screen representing a single state (a lesson, a result, an onboarding step) fills its entire background with one dominant hue; a dashboard-style screen with many independent pieces of content stays a neutral page with coloured cards (section 4.5).
16. No em dash (—) anywhere in UI copy — headings, body text, button labels, error messages, empty states. It reads as a stylistic tell of AI-written text and undercuts the platform's tone. Rewrite as two sentences, or use a colon or comma depending on the relationship between the clauses.
17. Celebration effects (confetti, XP floaters, `spring` easing) fire only on the D7 milestone list. A correct answer, a coin split, a sign-up or a routine press never triggers them.
18. No lives, hearts or any counter that is spent by a wrong answer (D9).
19. Every string meets its Copy Budget (`06` §3) and every component declares `data-copy-role`; the Copy Budget audit passes (D11).
20. At most 24 system glyphs in the whole product, from one source; every other visual is a manifest-registered own asset with no text inside it (`07`, D12).
21. A Mentor character is only ever a render of the real 3D model in a catalogue pose; never a letter avatar, a generic bot icon or an image-model look-alike (`07` §4, D12).
22. The Mentor screen is the stage (`08`): the character on the Diorama is the dominant area; no chat thread as the primary view, no bubble tails, no typing dots (D13).
23. No legacy component (button, input, chat, card) from the current application is imported into the new frontend. Every control comes from this system (D13).

---

## 3. Tokens (DESIGN.md format)

Naming grammar: `{role}` = solid fill, `{role}-ridge` = a darker tone of the fill, `on-{role}` = text/icons on the fill, `{role}-strong` = coloured text or icon on a neutral surface, `{role}-soft` = pale well. `dark-` prefixes the values that change in dark mode.

**What `{role}-ridge` is still for (v2).** The system is flat: no component has a ridge edge, and the v1 `depth` tokens are gone. The ridge colours are kept because the mockup uses them for exactly two things: (1) the thin outline and inner detail strokes drawn into small illustrated collectibles (the coin, the medal, the hexagon badge; section 4.4, exception 3), and (2) coloured text on a white chip that sits on that hue's fill (the "Simulation" chip on the indigo balance card uses `primary-ridge`, 7.7:1 on white). Do not use them for anything else.

The block below is regenerated in v2 from the mockup's rendered CSS (and, for motion, from the v2 rule in D7, where the mockup is a known deviation).

```yaml
version: alpha
name: LittleFounders
description: Flat-tactile, solid-colour, highly gamified design system. One visual language for every audience. Light and dark are both first-class.
colors:
  # ---- neutrals: light values are the base names; dark values carry the dark- prefix ----
  base: "#f4f5fd"
  surface: "#ffffff"
  sunken: "#eaecf6"
  outline: "#d5d8e7"
  edge: "#83869a"
  content: "#11132a"
  content-muted: "#66697c"
  content-disabled: "#999db2"
  ink: "#11132a"            # text on bright fills, identical in both modes
  dark-base: "#0b0d1b"
  dark-surface: "#131627"
  dark-raised: "#1c1f32"
  dark-sunken: "#060713"
  dark-outline: "#2c3046"
  dark-edge: "#606376"
  dark-content: "#f5f6fe"
  dark-content-muted: "#8f92a7"
  dark-content-disabled: "#515466"
  # ---- solid hues: fill / ridge / on-* never change with the mode; strong / soft do ----
  primary: "#5c55fd"
  primary-ridge: "#4438cf"
  on-primary: "#ffffff"
  primary-strong: "#5850f8"
  primary-soft: "#eceffe"
  dark-primary-strong: "#7a84ff"
  dark-primary-soft: "#21254e"
  accent: "#eb7301"
  accent-ridge: "#be5c01"
  on-accent: "#11132a"
  accent-strong: "#ab5202"
  accent-soft: "#feece2"
  dark-accent-strong: "#e16f03"
  dark-accent-soft: "#451d00"
  reward: "#ebb806"
  reward-ridge: "#a88205"
  on-reward: "#11132a"
  reward-strong: "#856600"
  reward-soft: "#ffefc9"
  dark-reward-strong: "#b38b00"
  dark-reward-soft: "#362801"
  success: "#028048"
  success-ridge: "#005f34"
  on-success: "#ffffff"
  success-strong: "#027b45"
  success-soft: "#d2fcdf"
  dark-success-strong: "#3ea56b"
  dark-success-soft: "#01341a"
  error: "#db1b2b"
  error-ridge: "#ac001a"
  on-error: "#ffffff"
  error-strong: "#d60f26"
  error-soft: "#ffebe9"
  dark-error-strong: "#fe5150"
  dark-error-soft: "#491816"
  sky: "#4b94ff"
  sky-ridge: "#3476d4"
  on-sky: "#11132a"
  sky-strong: "#1d68ce"
  sky-soft: "#e8f1fe"
  dark-sky-strong: "#468ff9"
  dark-sky-soft: "#10294e"
  mint: "#05a893"
  mint-ridge: "#018675"
  on-mint: "#11132a"
  mint-strong: "#07796a"
  mint-soft: "#c7fef1"
  dark-mint-strong: "#06a490"
  dark-mint-soft: "#01322b"
  berry: "#cc2e72"
  berry-ridge: "#a40c56"
  on-berry: "#ffffff"
  berry-strong: "#c6266d"
  berry-soft: "#ffeaef"
  dark-berry-strong: "#f15391"
  dark-berry-soft: "#461729"
  # ---- alias: no separate amber exists (it collapsed with accent and reward under colour-vision simulation) ----
  warning: "{colors.reward}"
  warning-ridge: "{colors.reward-ridge}"
  on-warning: "{colors.on-reward}"
  warning-strong: "{colors.reward-strong}"
  warning-soft: "{colors.reward-soft}"
  dark-warning-strong: "{colors.dark-reward-strong}"
  dark-warning-soft: "{colors.dark-reward-soft}"
typography:                                          # fixed sizes, stepped by the `app` container width (<640 / 640-1119 / >=1120 px), never fluid clamp(); see 03 §3.2
  display-2xl: { fontFamily: Fredoka, fontSize: 48px,     fontWeight: 700, lineHeight: 1.04, letterSpacing: -0.015em }  # marketing H1; 56px at >=640, 72px at >=1120
  display-xl: { fontFamily: Fredoka, fontSize: 36px,      fontWeight: 700, lineHeight: 1.08, letterSpacing: -0.01em }   # 40px at >=640
  display-lg: { fontFamily: Fredoka, fontSize: 28px,      fontWeight: 700, lineHeight: 1.12, letterSpacing: -0.005em }  # in-app H1; 32px at >=640
  headline:   { fontFamily: Fredoka, fontSize: 1.5rem,    fontWeight: 600, lineHeight: 1.25 }
  title:      { fontFamily: Fredoka, fontSize: 1.25rem,   fontWeight: 600, lineHeight: 1.28 }
  button:     { fontFamily: Fredoka, fontSize: 1rem,      fontWeight: 600, lineHeight: 1.2, letterSpacing: 0.008em }
  button-lg:  { fontFamily: Fredoka, fontSize: 1.125rem,  fontWeight: 600, lineHeight: 1.2, letterSpacing: 0.008em }
  question:   { fontFamily: Nunito,  fontSize: 1.75rem,   fontWeight: 700, lineHeight: 1.35 }   # lesson question on the full-bleed lesson screen
  answer:     { fontFamily: Nunito,  fontSize: 1.125rem,  fontWeight: 800, lineHeight: 1.3 }    # answer rows and choice controls
  body-lg:    { fontFamily: Nunito,  fontSize: 1.125rem,  fontWeight: 500, lineHeight: 1.6 }
  body:       { fontFamily: Nunito,  fontSize: 1rem,      fontWeight: 500, lineHeight: 1.55, letterSpacing: 0.008em }
  label:      { fontFamily: Nunito,  fontSize: 1rem,      fontWeight: 800, lineHeight: 1.25 }
  caption:    { fontFamily: Nunito,  fontSize: 0.875rem,  fontWeight: 700, lineHeight: 1.35 }   # 14 px is the floor for ANY text
  chip:       { fontFamily: Nunito,  fontSize: 0.875rem,  fontWeight: 800, lineHeight: 1.25 }
  numeral-xl: { fontFamily: Nunito,  fontSize: 40px,      fontWeight: 900, lineHeight: 1, letterSpacing: -0.01em }      # 56px at >=640; digits are fixed-width by default in Nunito
  numeral:    { fontFamily: Nunito,  fontSize: 1.5rem,    fontWeight: 800, lineHeight: 1.1 }
rounded: { sm: 12px, md: 20px, lg: 28px, xl: 36px, full: 9999px }
spacing: { 1: 4px, 2: 8px, 3: 12px, 4: 16px, 5: 20px, 6: 24px, 8: 32px, 10: 40px, 12: 48px, 14: 56px, 16: 64px, 20: 80px, 24: 96px, 32: 128px }   # = the mockup's --s-1 ... --s-32; nothing off this scale (03 §3.1)
target: { min: 48px, base: 56px, lg: 64px }        # extension: touch-target floors, by function (never by audience)
elevation:                                          # extension: soft shadows for surfaces with no colour of their own (light mode; dark mode uses the surface step, section 5)
  card:    "0 1px 3px rgba(17,19,42,.08), 0 1px 2px rgba(17,19,42,.06)"
  control: "0 1px 3px rgba(17,19,42,.14)"           # secondary button, icon button
  float:   "0 10px 28px rgba(17,19,42,.14)"         # dialog, toast
focus: { width: 3px, offset: 3px, color: "{colors.primary-strong}" }
motion:                                             # extension; full rationale in 04-MOTION.md §2. Five duration tokens in three categories.
  duration:
    instant: 80ms          # state-layer feedback: press-in, tap acknowledgement
    micro: 150ms           # press release, toggle, small icon swap
    component: 250ms       # a component changes state in place (bump, chip appears, card flips to "done")
    transition: 380ms      # one screen or exercise replaces another
    celebration: 700ms     # a milestone on the D7 list only; once per moment, never per click
  easing:
    standard: "cubic-bezier(.4, 0, .2, 1)"         # moves within the screen; also every press and release
    enter:    "cubic-bezier(0, 0, .2, 1)"          # decelerate: arriving on screen
    exit:     "cubic-bezier(.4, 0, 1, 1)"          # accelerate: leaving the screen
    spring:   "cubic-bezier(.34, 1.56, .64, 1)"    # overshoot: ONLY the D7 milestone list, never routine UI
  press: { scale: 0.97, in: "{motion.duration.instant}", out: "{motion.duration.micro}", easing: "{motion.easing.standard}" }
  bump:  { keyframes: "scale .96 -> 1.035 -> 1", duration: "{motion.duration.component}", easing: "{motion.easing.standard}" }   # select, correct answer, armed CTA
  celebrate-on: [lesson-complete, course-complete, savings-goal-reached, badge-earned, streak-7-days, streak-30-days, streak-100-days]
  idle: { hero-float: 5s, streak-flicker: 2.4s, cta-breathe: 2.6s }   # ambient loops, deliberately not duration tokens; at most three at once (section 9.4)
components:                                         # flat: no ridge, no border on any filled component (section 4.4)
  button-accent:    { backgroundColor: "{colors.accent}",  textColor: "{colors.on-accent}",  typography: "{typography.button}",    rounded: "{rounded.full}", minHeight: "{target.base}", padding: "12px 24px" }
  button-accent-lg: { backgroundColor: "{colors.accent}",  textColor: "{colors.on-accent}",  typography: "{typography.button-lg}", rounded: "{rounded.full}", minHeight: "{target.lg}",   padding: "12px 32px" }
  button-sm:        { typography: "{typography.button}", rounded: "{rounded.full}", minHeight: "{target.min}", padding: "8px 20px" }   # any hue
  button-brand:     { backgroundColor: "{colors.primary}", textColor: "{colors.on-primary}", typography: "{typography.button}",    rounded: "{rounded.full}", minHeight: "{target.base}" }
  button-success:   { backgroundColor: "{colors.success}", textColor: "{colors.on-success}", typography: "{typography.button}",    rounded: "{rounded.full}", minHeight: "{target.base}" }   # sky, mint, berry, reward and error buttons follow the same pattern; roles in section 9.5
  button-secondary: { backgroundColor: "{colors.surface}", textColor: "{colors.content}",    typography: "{typography.button}",    rounded: "{rounded.full}", minHeight: "{target.base}", shadow: "{elevation.control}" }   # no line: surface fill + soft shadow
  button-inverse:   { backgroundColor: "{colors.surface}", textColor: "{colors.content}",    typography: "{typography.button}",    rounded: "{rounded.full}", minHeight: "{target.base}" }   # sits on a coloured band or card
  button-disabled:  { backgroundColor: "{colors.sunken}",  textColor: "{colors.content-disabled}", typography: "{typography.button}", rounded: "{rounded.full}", minHeight: "{target.base}" }
  icon-button:      { backgroundColor: "{colors.surface}", textColor: "{colors.content}",    shadow: "{elevation.control}", rounded: "{rounded.full}", width: "{target.min}", height: "{target.min}" }
  answer-idle:      { backgroundColor: "color-mix({colors.on-primary} 14%, transparent)", textColor: "{colors.on-primary}", typography: "{typography.answer}", rounded: "{rounded.md}", minHeight: "{target.lg}", padding: "16px 20px" }   # inside the full-bleed primary lesson screen
  answer-idle-neutral: { backgroundColor: "{colors.primary-soft}", textColor: "{colors.content}", typography: "{typography.answer}", rounded: "{rounded.md}", minHeight: "{target.lg}", padding: "16px 20px" }   # the same component on a neutral page
  answer-selected:  { backgroundColor: "{colors.primary}", textColor: "{colors.on-primary}", rounded: "{rounded.md}", minHeight: "{target.lg}", mark: ring-and-dot }
  answer-correct:   { backgroundColor: "{colors.success}", textColor: "{colors.on-success}", rounded: "{rounded.md}", minHeight: "{target.lg}", mark: check }
  answer-try-again: { backgroundColor: "{colors.warning}", textColor: "{colors.on-warning}", rounded: "{rounded.md}", minHeight: "{target.lg}", mark: cross }
  choice:           { backgroundColor: "{colors.surface}", textColor: "{colors.content}", shadow: "0 1px 3px rgba(17,19,42,.08)", typography: "{typography.answer}", rounded: "{rounded.md}", minHeight: "{target.lg}" }   # "choose one" on a neutral page (pager, tabs, pickers)
  banner-correct:   { backgroundColor: "{colors.success}", textColor: "{colors.on-success}", rounded: "{rounded.md}", padding: "{spacing.4}", icon: check }   # names what happened
  banner-try-again: { backgroundColor: "{colors.warning}", textColor: "{colors.on-warning}", rounded: "{rounded.md}", padding: "{spacing.4}", icon: cross }   # gives a hint; never a penalty
  identity-card:    { backgroundColor: "{colors.mint}",    textColor: "{colors.on-mint}",    rounded: "{rounded.lg}", padding: "{spacing.5}" }   # swap mint for sky, berry, reward or primary; icon + label always present
  course-card:      { backgroundColor: "{colors.primary}", textColor: "{colors.on-primary}", rounded: "{rounded.lg}", padding: "{spacing.4}", minHeight: "{target.lg}" }   # padding spacing.5 at >=840; hue by course (section 4.3)
  hero-band:        { backgroundColor: "{colors.primary}", textColor: "{colors.on-primary}", rounded: "{rounded.xl}", padding: "{spacing.6}" }   # padding spacing.8 at >=840
  card:             { backgroundColor: "{colors.surface}", textColor: "{colors.content}",    rounded: "{rounded.lg}", padding: "{spacing.5}", shadow: "{elevation.card}" }
  chip-reward:      { backgroundColor: "{colors.reward}",  textColor: "{colors.on-reward}",  typography: "{typography.chip}", rounded: "{rounded.full}", padding: "4px 12px" }
  chip-status:      { backgroundColor: "{colors.success-soft}", textColor: "{colors.success-strong}", typography: "{typography.chip}", rounded: "{rounded.full}", padding: "4px 12px" }   # soft + strong + icon + word, for success / warning / error / sky / primary
  input:            { backgroundColor: "{colors.sunken}",  textColor: "{colors.content}", rounded: "{rounded.md}", minHeight: "{target.base}", padding: "16px 20px", focus: "inset 3px {colors.primary-strong} + 5px {colors.primary-soft} halo", error: "inset 3px {colors.error-strong} + icon + message" }   # no resting line
  dialog:           { backgroundColor: "{colors.surface}", textColor: "{colors.content}", rounded: "{rounded.xl}", padding: "{spacing.6}", shadow: "{elevation.float}", position: fixed }
  collectible-art:  { fill: "{colors.reward}", outline: "{colors.reward-ridge}", outlineWidth: "about 3% of the art's size (4 units in a 120-unit viewBox)" }   # coin, medal, hexagon badge (badge uses its own hue and that hue's ridge; locked = sunken + edge). The only shapes that carry a ridge-colour line.
```

---

## 4. Colour

### 4.1 Measured record

Contrast is WCAG 2.x relative luminance. **128 checks, 0 failures** across both modes (text on fills, ridge against light surfaces, fill boundary against dark surface, strong tones on every surface and soft well, content on every soft well).

| hue | fill | on | on:fill | ridge | ridge vs white | fill vs dark surface | strong on surface (light / dark) |
|---|---|---|---|---|---|---|---|
| `primary` | `#5c55fd` | `#ffffff` | 5.0 | `#4438cf` | 7.7 | 3.6 | 5.4 / 5.6 |
| `accent` | `#eb7301` | `#11132a` | 6.1 | `#be5c01` | 4.4 | 6.0 | 5.3 / 5.5 |
| `reward` | `#ebb806` | `#11132a` | 9.9 | `#a88205` | 3.6 | 9.7 | 5.4 / 5.6 |
| `success` | `#028048` | `#ffffff` | 5.0 | `#005f34` | 7.8 | 3.6 | 5.4 / 5.8 |
| `error` | `#db1b2b` | `#ffffff` | 5.0 | `#ac001a` | 7.6 | 3.6 | 5.3 / 5.6 |
| `sky` | `#4b94ff` | `#11132a` | 6.1 | `#3476d4` | 4.5 | 6.0 | 5.4 / 5.6 |
| `mint` | `#05a893` | `#11132a` | 6.1 | `#018675` | 4.5 | 6.0 | 5.3 / 5.7 |
| `berry` | `#cc2e72` | `#ffffff` | 5.0 | `#a40c56` | 7.6 | 3.6 | 5.4 / 5.5 |

Colour-vision check (Machado 2009 simulation, worst of protan/deutan/tritan, CIEDE2000; heuristic threshold 9, not a standard):

| pair | normal | worst CVD |
|---|---|---|
| `accent` vs `error` | 25 | 12.2 |
| `success` vs `error` | 68 | 11.3 |
| `accent` vs `success` | 54 | 12.4 |
| `reward` vs `accent` | 25 | 10.5 |
| `primary` vs `sky` | 21 | 12.4 |
| `error` vs `berry` | 19 | 11.9 |
| `success` vs `mint` | 18 | 15.1 |

The ceiling is **8 mutually distinguishable solid hues**: 5 are spoken for (`primary`, `accent`, `reward`, `success`, `error`), 3 are free (`sky`, `mint`, `berry`). Adding a ninth requires removing one or accepting a documented collapse.

### 4.2 Reserved meanings

| hue | means | never used for |
|---|---|---|
| `primary` (indigo) | brand surfaces, hero bands, links, focus, progress, selection | actions, errors |
| `accent` (orange) | **the** call to action, the only "press me" colour | categories, achievements, status |
| `reward` (gold) | coins, XP, stars, streak. `warning` is an alias of it | errors, actions |
| `success` (green) | correct, approved, confirm | categories |
| `error` (red) | system errors and destructive actions only | **wrong answers** |
| `sky`, `mint`, `berry` | identity: courses, wallet pockets; `berry` also share and invite | any status |

A wrong answer is `warning` + a cross + informational copy ("Almost there. Try counting by 5s"). Red is not used because it would turn feedback into punishment. That is a convention, not a psychological fact (see 01 §2). A wrong answer also costs nothing: there are no lives (D9), so `berry` no longer has a "lives" meaning (v1 reserved it for a lives chip; that chip is gone).

### 4.3 Identity slots (answers your question 1)

Four courses and three wallet pockets share four identity hues (`primary`, `mint`, `sky`, `berry`). Each meaning is carried three ways at once: colour, icon and label. Hue reuse is scoped to a context (a course view and a wallet view never appear together), and one context never gives one hue two meanings.

| context | hue | icon |
|---|---|---|
| course: first steps | `primary` | sprout |
| course: money basics | `mint` | coin |
| course: start a business | `berry` | rocket |
| course: smart investing | `sky` | chart |
| pocket: save | `mint` | jar |
| pocket: spend | `sky` | bag |
| pocket: share | `berry` | heart |

The split bar under the pockets separates segments with gaps and always sits beside labelled steppers.

### 4.4 No decorative borders — separation is colour, not outline (revised this pass)

**Correction, flagged against the owner's reference material:** the earlier build had drifted into outlining almost everything — 69 separate `box-shadow: inset ... Npx` declarations across the stylesheet, one on nearly every card, button, avatar and control. None of the 17 reference images the owner supplied use that pattern. In every reference, one "box" is told apart from the next by a **change of fill colour**, not by a ring drawn around it. That correction is now the rule:

- **A component with its own solid fill colour never gets a border.** The colour is the boundary. This covers every `.btn`, every identity card, tile, badge, chip and avatar-on-colour.
- **A line is allowed only in three cases, all functional, not decorative:**
  1. **A control with no fill colour of its own**, where colour alone has nothing to contrast against. The mockup solves every such case without a line: text inputs get a `sunken` fill, and the `.secondary` button, the icon button and the neutral `.choice` get a `surface` fill plus a soft elevation shadow. That is the rule. Fall back to a thin (1.5–2 px, `edge`) line only where a fill or shadow would be indistinguishable from the background. (v2 correction: v1 said the secondary button keeps a 1.5 px line; the mockup never rendered one.)
  2. **A real interaction state**: keyboard focus (3 px `primary-strong` outline), a validation error (3 px inset `error-strong` ring on the input, always with an icon and a message), or "this is the one currently selected/current" (the streak strip's "today" marker, a chosen role or tab). These are signals the person needs, not decoration, so they stay.
  3. **Illustrated collectibles** (the coin, the medal, the hexagon badge) are drawn with a thin outline and inner detail in their own `{hue}-ridge` tone (about 3% of the art's size). That line is part of the drawing, for legibility at small sizes, not a border around a component; it is never applied to buttons, cards, chips or avatars.
- **A surface with no colour of its own** (a white card on a light page, a dialog, a toast, a table) is separated by a **soft elevation shadow** (`0 1px 3px rgba(17,19,42,.08)` for resting cards, `var(--shadow-float)` for floating overlays) — never by an inset outline. This is the legitimate "elevated card" pattern (Material Design's *filled* or *elevated* card types), not a contour.
- When two adjacent things need to read as clearly different and a fill/shadow difference genuinely is not enough (this should be rare), the fallback is a colour change, not a border — e.g. the featured plan on the mockup's (parked, OD-5) pricing page is a full `primary` fill rather than a card with a thicker outline.

### 4.5 Full-bleed colour screens (revised this pass)

The owner's reference set uses full-bleed colour for entire screens at specific moments — an onboarding "sun" screen, a "YOU WON" result, a "B2 Level Test" question screen — not a coloured card floating on a neutral background. That distinction had been lost: the lesson and result screens were previously a coloured card inside a white/neutral page.

**Rule:** a screen that represents a single state — a lesson in progress, a result, an onboarding step, a celebratory or congratulatory moment — fills its **entire** background with one dominant hue; every element on it (text, answer rows, feedback banners, stat tiles) is a tint or a contrasting fill of that same hue family, not a jump to a neutral white surface. A dashboard-style screen with many independent pieces of content (the app home, a data table, a settings page) is the other case, and stays a light/dark neutral page with coloured cards on it — that composition is also present in the references (the `Alysia Dermott` dashboard, the `Hi, Alysia` course tiles) and should not be forced full-bleed.

**Exception: the compact Mentor stage in the lesson player (v3, OD-15, B.8).** A lesson screen may carry the compact stage defined in `08` §11: the character on its Diorama in a band at the top (phone) or a side column (desktop), which may show the active adventure's scene inside that band. The rest of the screen keeps the single dominant hue.

**Exception: the teaching-visual board (v2, OD-4). A lesson screen that contains a teaching visual (a chart, mathematical representation, logic visual or money manipulable) places it on one neutral **board** (`surface` / `dark-surface`), specified in `05-TEACHING-VISUALS.md`. It is the only neutral surface allowed on a full-bleed screen, and it exists for a functional reason: data marks need a neutral ground to reach 3:1 contrast and to keep the reserved hues (`accent`, `reward`, `success`, `error`) from being confused with data. Everything around the board stays in the screen's hue family.

| screen | before | now |
|---|---|---|
| Lesson (question in progress) | white/neutral page, indigo question card | full indigo background; answers and feedback are tints/fills of indigo, success or warning |
| Result (lesson complete) | indigo top band, white stat sheet below | full accent-orange background; the stat sheet and "today vs best" card are translucent tints of the same orange, never white |
| App home, staff table, settings | (unchanged) | stays a neutral page with coloured cards — this is the correct pattern for a dashboard, not a screen to force full-bleed |

---

## 5. Dual mode

| changes with the mode | does not change |
|---|---|
| `base`, `surface`, `raised`, `sunken`, `outline`, `edge`, `content*` | every `{hue}` fill |
| `{hue}-strong` (light: deep, dark: light tone) | every `{hue}-ridge` |
| `{hue}-soft` (light: pale, dark: deep tint) | every `on-{hue}` |
| ambient shadow (light only) | |

- Dark elevation is a lighter surface step (`sunken` < `base` < `surface` < `raised`), never a shadow.
- Because fills are invariant, a bright fill on a dark surface has 3.6–9.7:1 boundary contrast. On a white surface there is no ridge to lean on (flat system): deep fills (`primary`, `success`, `error`, `berry`) reach 5.0:1 on their own, `accent`, `sky` and `mint` reach 3.0:1, and `reward` only 1.8:1, so a `reward` fill is never the only thing that makes an element findable; it always carries ink text or an icon (values from the mockup's system sheet).
- Focus ring: 3 px `primary-strong`, 3 px offset, on every pressable. `primary-strong` reaches 5.4:1 (light) and 5.6:1 (dark).
- `content-faint` from the old file is **removed**. A token that fails 4.5:1 will be misused as text. Use `content-disabled` for disabled states only (WCAG exempts them).
- `outline` (about 1.2:1) is a decorative divider. Any boundary a control needs to be found by uses `edge` (at least 3:1).
- Adding a hue: pick a class (`deep` = white text, luminance about 0.16; `bright` = ink text, luminance about 0.30), solve `fill`, derive `ridge` (at least 3:1 on light surfaces), then `strong` and `soft` per mode, then run the matrix. Do not hand-pick.

---

## 6. Typography

- **Fredoka** (display, headings, button labels): rounded, character, and measured about 2% narrower than Nunito at weight 700, so a button label is not wider for being playful.
- **Nunito** (text, labels, numerals): the readable workhorse. Digits are fixed-width by default, so counters do not jitter while animating (Fredoka's digits are proportional).
- Both are OFL. Self-host the Latin subset as variable woff2 (about 29 KB and 38 KB). Latin covers every Spanish and Portuguese glyph checked (`¿¡ñáéíóúüãõâêôç`).
- Not chosen: Baloo 2 (cap height 14% smaller, reads as 14 px at 16 px), Poppins (about 13% wider than Nunito at weight 700, more clipping risk). Baloo 2 stays wired as a switch in the prototype.
- Evidence note: I found no strong evidence that a display typeface improves children's reading. What is supported is size, spacing and avoiding italics and all caps. The choice rests on character and measured width, not on a legibility claim.
- Sizes are **fixed steps, not fluid `clamp()`**: display and numeral sizes change at two `app` container widths (640 and 1120 px), so the type responds to the component's width, not the window, and every size belongs to the named scale (values in the section 3 YAML; rationale in `03` §3.2). v1 said "fluid `clamp`"; the mockup never used `clamp()`.

---

## 7. Text Fit Contract (D1)

**Why it is a contract and not a guideline.** On this platform's own sample (21 UI strings) Spanish and Portuguese run wider than English by these factors:

| strings | ES mean / max | PT mean / max |
|---|---|---|
| short (12 strings, 10 characters or fewer in English) | x1.37 / x2.02 | x1.38 / x2.29 |
| longer (9 strings) | x1.19 / x1.38 | x1.25 / x1.42 |

The worst case is "Share" → "Compartilhar" (x2.29). Short labels are exactly where fixed widths break. The sample and its translations are mine and illustrative; native review is still needed.

**Rules**

1. Forbidden on system-authored text: `text-overflow: ellipsis`, `-webkit-line-clamp`, fixed `height` or `width` on anything containing text, `overflow: hidden` used to hide text.
2. Size to content: `min-height` (the touch floor) plus padding. Buttons wrap to as many lines as they need and grow.
3. Groups of buttons and chips use `flex-wrap` with `flex: 1 1 auto`, never a fixed-width grid column. `width: 100%` is only used where the container is guaranteed wider than the longest label.
4. Every button carries `min-inline-size: min-content`, so it cannot be squeezed narrower than its longest word.
5. Every flex or grid child that holds text sets `min-width: 0` **or** relies on `min-content`. Choose deliberately.
6. Rows with a label and a control use `flex-wrap`: the control drops to its own line when the label needs the room (wallet pockets). Do not rely on a breakpoint.
7. Prose: `hyphens: auto` with the right `lang` (`en-US`, `es-MX`, `pt-BR`), `overflow-wrap: break-word`, `text-wrap: pretty`. Headings: `text-wrap: balance`. Buttons and labels: `overflow-wrap: break-word` as a last resort, never as the plan.
8. User-generated tokens (names, nicknames, emails) carry `.ugc`: `overflow-wrap: anywhere; hyphens: none; min-inline-size: 0`. This rule must come **last** in the stylesheet; it lost to `.btn` during testing.
9. Reflow before crop. Layouts change shape by **container width** (`container-type: inline-size`), never by viewport, so a component in a narrow column behaves like a narrow screen. Below 400 px the hero art moves above the text; below 360 px inactive tabs become 48 px icon buttons and only the active tab shows its label (its name stays available to assistive tech).
10. New copy is a design change: any new or translated string must pass the audit below **and the Copy Budget audit (`06` §7)** before merge.

**Verification performed** (Chromium, automated). Checks per element: ellipsis, line-clamp, horizontal or vertical clipping, text outside the frame, any word wider than its box (measured with canvas), any tap target under 48 px, page-level horizontal scroll. Each matrix runs twice, the second time with the WCAG 1.4.12 overrides (letter-spacing 0.12em, word-spacing 0.16em, line-height 1.5).
- *First pass (7 screen states, 336 configurations):* four real failures found and fixed at the root, none by shrinking text: tab bar targets of 43 px at 320 px; wallet labels squeezed to 51 px; a 149 px Portuguese title in a 124 px column; and a `.btn` rule that overrode `.ugc` so a long nickname overflowed.
- *Final build, as reported by the original session:* 1,440 configurations with normal text and 1,440 with forced text spacing, across all 14 routes, 0 issues, 0 JS errors; 168 proportion/composition page states, 0 findings (`03` §5). The exact state list behind "1,440" was not delivered (14 routes × 3 languages × 2 themes × 4 widths × 2 text sizes is 672), so that figure cannot be reproduced as stated.
- *v2 re-run (2026-09-20, reproducible):* `verification-tools/text-fit-audit.reference.mjs` v2 replaces the stale v1 tool (which drove `#screen=` and `S.screen`, so it audited only the landing page and passed vacuously). It audits 16 states (the 14 routes, with the lesson in its three answer states) × 3 languages × 2 themes × 4 widths × 2 text sizes = **768 configurations per run**, and skips visually-hidden elements (the `.sr-only` / `clip: rect(0 0 0 0)` pattern). Result: **normal text, 0 issues; WCAG 1.4.12 text spacing, one real defect** (12 hits): the Portuguese course title "Investimento inteligente" on `home` at 375 and 768 px, where the word "Investimento" (145 px with the spacing overrides) is wider than its 130–139 px column and spills into the card's padding. Not fixed in the mockup (it is frozen); the rule it breaks is rule 5 above, and the fix belongs in the product build (the course grid must not make a column narrower than its longest title word; reflow to one column instead). Listed in `../mockup/KNOWN-DEVIATIONS.md`. 0 JS errors.
- *v2.1 mockup (2026-09-20, re-run independently):* the mockup now implements the owner decisions (17 routes: landing, how, families, signup, login, notfound, home, lesson, result, board, mentor, tasks, wallet, me, parent, staff, system; 41 audited states). Text fit: **1,968 configurations with normal text, 0 issues; 1,968 with WCAG 1.4.12 text spacing, 0 issues** (41 states × EN/ES/PT × light/dark × 320/375/768/1280 px × normal/+40% text). Proportion: **492 page states, 0 findings**. 0 JavaScript errors. K39 is fixed at the root (the course grid reflows before any column gets narrower than its longest title word).
- The tools are still coupled to the mockup's state hooks (`S`, `render()`); auditing the real application needs a new driver, with the same checks.

---

## 8. Touch targets

| tier | size | mm on a phone | used for |
|---|---|---|---|
| `target-min` | 48 px | about 7.5 | any interactive element, icon buttons, inactive tabs |
| `target-base` | 56 px | about 9 | buttons, nav items, list rows |
| `target-lg` | 64 px | about 10 | primary CTAs, answer options, tab bar |

Tiers follow function (how costly a miss is), never audience, so the one visual language holds.
Grade: the evidence says misses fall as targets grow for young children; it does not give a threshold. These numbers are a design judgement, not a measured optimum. Open: whether 64 px should be the global minimum.

---

## 9. Gamification of controls (D6, D7)

Gamification is high in feel (D6) and celebration is budgeted (D7). It is implemented through **colour, shape and feedback motion** — never through simulated depth, and never through celebrating every action. **This is a revision from the first version of this document**, corrected against the owner's reference material: the earlier system gave every pressable a 6px ridge, a gloss highlight and a periodic shine sweep, which read as heavier and more "3D" than the flat-tactile references call for. That treatment is now reserved for characters only (the owner's direction: "only characters are 3D, nothing else is"). Buttons, cards, tiles and badges are flat.

### 9.1 The flat button
- **Colour fill only, no border of any kind** (revised this pass, see 4.4) — the fill is the boundary. Pill radius, label in Fredoka 600. No gloss gradient, no shine sweep, no drop-shadow ridge, no inset outline.
- **Press:** the button scales to 0.97 over `--dur-instant` (80 ms) and returns over `--dur-micro` (150 ms), both with `--ease-standard`: no overshoot (D7). A soft ring ripples from the touch point. Haptic tick where supported. (The mockup presses in over a hard-coded 60 ms and releases with the spring curve; that is a known deviation.)
- **Armed:** when a disabled button becomes usable it bumps once (scale .97 → 1.02 → 1, `--dur-component`, `--ease-standard`).
- **Pulsing CTA:** the one emphasised CTA per screen gets a slow (2.6s) breathing glow around its edge — a soft outward halo in its own colour, not a moving highlight — so there is still exactly one thing drawing the eye without adding visual weight to the object itself.
- **Disabled:** flat fill in `sunken`, `content-disabled` text.
- **`.secondary`** (no fill colour of its own) is a `surface` fill with a soft elevation shadow (`elevation.control`), no line; this is what the mockup renders (v1 described a 1.5 px line that was never built). Every other variant is colour-only.
- Applies uniformly to icon buttons, answer options, course cards, row cards, identity tiles and badges: colour fill or a soft elevation shadow on a neutral surface, never an inset "3D" outline.
- Coins, medals and hexagon badges are single-layer flat shapes with a thin outline in their own `{hue}-ridge` tone for legibility at small sizes (section 4.4, exception 3: part of the drawing, not a component border). The earlier double-layer offset disc (a drop-shadow disc duplicated and shifted a few pixels down, plus a diagonal gloss stroke) is removed for the same reason.

### 9.2 Feedback grammar
| moment | response |
|---|---|
| select an answer | bump (scale .96 → 1.035 → 1, standard easing), ring-and-dot mark, "Check" arms |
| correct | green row bumps, mark becomes a check, informational `success` banner that names what happened, progress bar advances (`--dur-component`, standard easing). **No confetti, no "+XP" floater** (D7): XP is tallied and shown on the lesson-complete screen |
| not yet | wobble on the chosen row, cross mark, `warning` banner with a hint. No confetti, no red, and nothing is spent: there is no life or heart counter (D9) |
| several consecutive misses on the same skill | the learner's Mentor character offers a guided review of that skill (an offer the learner can decline; never a penalty, a lock or a lost resource). The threshold is a product parameter (proposed: 3; owned by the Pedagogical Lead, per `10` B.26) |
| confirm the coin split | a confirmation: the split settles into place and a short status message states the result (e.g. "Saved: 10 save, 5 spend, 5 share"). No confetti, no XP floater |
| lesson complete (milestone) | medal pops (`--ease-spring`, `--dur-celebration`), stat tiles rise in sequence, numbers count up (fixed-width digits so nothing reflows), bars fill. A confetti burst is permitted here |
| other milestones on the D7 list (course complete, savings goal reached, badge earned, streak at 7, 30 and 100 days) | one celebration per moment, same budget as lesson complete. Nothing else celebrates |

### 9.3 Guardrails that keep "high" from backfiring (evidence in 01 §3)
- Feedback is **informational**: it says what happened and what to try. Tangible rewards handed out for doing a task reduced intrinsic motivation in a 128-study meta-analysis, more so in children; informational feedback did not. So celebrate progress and mastery; do not dangle or take away rewards.
- No guilt copy on streaks, no "you lost" states. Streak rules: section 9.6.
- Mistakes cost nothing (D9). The product targets a 70–85% practice success band, so with a three-life mechanic a large share of lessons would end in a "no lives left" state by design (decision log, OD-1).
- Effects of gamification on learning are small on average (motivational g = 0.36, cognitive g = 0.49). The design does not depend on it to teach; it depends on it to make the practice feel good.

### 9.4 Motion budget
- **Idle motion is allowed on three things only:** the hero object (5 s float), the streak flame (2.4 s flicker), one soft breathing-glow CTA per screen (a border halo, not a moving highlight). **v3:** on a screen with the Mentor stage (`08`), the character's catalogue idle loop takes the hero object's place. It is one of the three, never a fourth.
- Everything else moves only in answer to a tap or a screen entrance (one choreographed entrance per screen).
- **Celebration budget** (D7): confetti, XP floaters and `--ease-spring` overshoot occur only on the closed milestone list, once per moment. Everything else uses the standard, enter and exit easings.
- `prefers-reduced-motion: reduce`: every state and colour change still happens; transitions, confetti, count-ups, the pulse glow, float and flicker are skipped, and bars jump to their value.

---

## 9.5 Colour and shape as taught conventions, not psychological levers

The owner asked for colour psychology and shape to inform buttons and components. I looked for evidence that a specific button hue (as opposed to contrast with its surface) measurably changes behaviour, and for evidence on children's colour associations specifically.

- **Children do associate bright, saturated colours with positive emotion and dark/muted colours (brown, black, grey) with negative emotion** (Boyatzis & Varghese 1994, 60 children aged 5–6.5). Grade **C**: one study, a small sample, and it says nothing about which specific bright hue to use for which specific action.
- **The "this button colour converts better" claims that circulate in marketing blogs are not good evidence.** The most-cited example (red outperforming green) confounded colour with contrast against the page background in the original test. What has real, repeated support is that **contrast against the surface and consistent use of a hue for one meaning** drive recognition — not the hue itself. Grade: **A for contrast/consistency mattering, D-and-below for any specific hue "meaning" something universally.**

**Decision:** hue is a **taught, in-product convention**, documented once and used consistently, not a claim that orange "means" urgency or green "means" safety to everyone who opens the app. This is stated as the operating principle in the system sheet itself so an agent extending the product does not reach for hue as a persuasion lever.

### Button colour roles (all fills verified against their `on-*` text at ≥4.5:1; ratios shown are what the prototype's system sheet computes live)

| Role | Hue token | Use | Notes |
|---|---|---|---|
| Accent | `accent` | The one primary action per view (`Start free`, `Continue`) | Reserved — see D5/section 4.2, unchanged. "Free to start" is allowed copy; "always free" is not (OD-5) |
| Success | `success` | Confirm, approve, continue after a correct answer | |
| Primary | `primary` | Brand actions, navigation to another place in the product | |
| Reward | `reward` | Claim or view coins/XP, the streak chip | Same token as `warning`/alias (section 3 of the original palette work) |
| Sky | `sky` | Get help, learn more, secondary informational actions | |
| Mint | `mint` | Save, saving-related actions | |
| Berry | `berry` | Share, invite | v1 also listed a "lives" chip; removed in v2 (no lives, D9) |
| Error | `error` | Destructive actions only (`Remove family`), always behind a confirmation dialog | Never used for "wrong answer" — that stays `warning`/wobble, no red, per D-earlier decision |
| Secondary | neutral surface + soft shadow | Cancel, back, lower-priority choice next to a coloured primary | No line (section 4.4) |
| Inverse | surface-on-colour | A button that sits on top of a coloured band or card; the white fill against the band is what makes it read as pressable | Needed once cards themselves became coloured (feature cards, the CTA band). v1 said its "ridge borrows the card's colour"; no ridge is rendered |

### Shape by object type
Shape is likewise a recognition convention, not an emotional claim, stated as such in the system sheet:

| Shape | Meaning | Component |
|---|---|---|
| Pill | Do something | `.btn` |
| Rounded rectangle | Choose one (of several) | `.answer`, `.choice` — shared component, so an answer option and a segmented choice (a pager, a picker) are visibly "the same kind of control" |
| Circle | One icon action | `.icon-btn` |
| Hexagon | Collectible | badge component, `hexBadge()` |
| Coin | Currency | the coin SVG, used only for money, never decoratively |
| Capsule | Progress | `.bar` |

---

## 9.6 Streak design (owner delegated this decision to design judgement)

No good evidence exists on streak-forgiveness mechanics specifically — what's published is almost entirely vendor blogs and growth-marketing case studies (grade **D**). The rule below leans on the one strong, relevant finding already in `01-RESEARCH-FOUNDATION.md`: controlling, contingent rewards **reduce** intrinsic motivation, more so in children (Deci, Koestner & Ryan 1999, 128 studies, grade A) — which argues directly against streak mechanics that punish or guilt a lapse.

**Rule, implemented and shown in the prototype's "How it works" page, profile page and system sheet:**
1. Two rest days a week are free and automatic — not earned, not purchased with coins.
2. Best streak and total days practiced are permanent stats and are never erased by a broken streak.
3. Parents can pause a streak for holidays from the family controls.
4. No loss-framed or guilt-framed copy, ever. A broken streak shows as "Streak resting" with the best-streak number still visible, not a "you lost your streak" state.
5. Only the 7-, 30- and 100-day milestones celebrate (D7). An ordinary practised day updates the strip without a celebration.
6. Rest days, streaks and error forgiveness can never be sold, even if a paywall is introduced later (OD-5), and are never called a "streak freeze" (glossary, section 1.2).

This is a design decision under real uncertainty, not a measured optimum — flagged as such in section 12.

---

## 9.7 3D character and image slots

**v3 (OD-14, OD-15):** the full asset rules are in `07-ICONOGRAPHY-AND-VISUAL-ASSETS.md` and the Mentor screen is specified in `08-MENTOR-STAGE.md`. Our own assets are generated by the frontend agent in the house style (`07` §3); characters are rendered from the real 3D models and the pose catalogue in the project folder (`07` §4); both pass the review gate in `07` §7. This section defines the **slot** each asset fills. **Exception:** the Mentor stage is not a slot. It is a full-bleed scene sized by `08` §2 and §6 (and the compact stage in the lesson player by `08` §11), and those sizes win over the square in-app character slot below.
- Slots are visually marked in the prototype (`Art slots` toggle in the stage bar) with a label stating exact aspect ratio and purpose, e.g. "Hero character · 4:5 · transparent."
- Every slot: transparent background, a stated aspect ratio (square for in-app character slots, 4:5 portrait for marketing hero/scene art), and the hard rule that **the asset itself never carries text** — any label, price or instruction is a separate DOM element layered by the system, never baked into the image. This keeps every string inside the Text Fit Contract and translatable.
- Placeholder art in the prototype (the coin, the medal) is vector, built from the token colours, and stands in only until real assets land in these slots — it is not a proposed final style.
- **The Mentor characters exist** (OD-6): four 3D characters, Dr. Rho, Zara, Liruf and Dina, are available as 3D assets. The learner chooses one; that character fills every Mentor slot (lesson prompt, help entry point, guided review), and the learner's navigation tab shows the chosen character's name and avatar instead of a generic label. Parent and staff views, and all documentation, say "Mentor"; the AI is never labelled "Tutor". How present the character is (size, frequency, voice) varies by age band (D8); the slot rules above do not.

---

## 9.8 Forms, tables and overlays

Added this pass, since the marketing site and staff view introduced controls the original app screens didn't need:

- **Inputs** never clip a value: a single-line text value scrolls natively inside its box; labels, hints and error messages always wrap. A field's minimum touch height matches `target-base` (56px); the visible width, not just height, of every control is included in the 48px minimum, which the mechanical audit checks directly (adjacent-target spacing, section 5 of `03-PROPORTIONS-AND-COMPOSITION.md`).
- **Errors** always pair an icon with text — never colour alone — and sit directly under the field they describe.
- **Tables** collapse into stacked cards below an 840px container width; each cell keeps its label visible (`label: value` stacked, not truncated side-by-side) and text wraps rather than clipping, including the one deliberately unbreakable stress-test name in the sample data (`Alessandro_Bartolomeo_Villanueva_Rodriguez_2014`).
- **Dialogs and toasts** sit on a scrim, always paired with a text description of the consequence (not just a colour), and a destructive action always has an explicit "keep/cancel" option offered before the destructive one.
- **z-index order**, now fixed so overlays never fight each other: sticky nav (30) → mobile menu sheet (50) → dialog scrim (65) → toast (70).

## 9.9 Motion — the full system lives in `04-MOTION.md`

A dedicated research pass (owner's explicit request: motion is a core gamification carrier and deserved its own session, not a subsection of general UI work). Summary of what an agent needs to know; see `04-MOTION.md` for the evidence, the full duration/easing token table, and the three orchestrated patterns built this pass.

- **Five duration tokens in three categories** (state-layer feedback, component state change, transition), named by what the movement represents: `--dur-instant` (80ms, state-layer feedback), `--dur-micro` (150ms, press/release), `--dur-component` (250ms, a component changes state in place), `--dur-transition` (380ms, one screen/exercise replaces another), `--dur-celebration` (700ms, a milestone on the D7 list, once per moment never per click). Easings: `--ease-standard`, `--ease-enter`, `--ease-exit`, and `--ease-spring`, which is reserved for the D7 milestones.
- **The evidence ceiling on "juice":** Kao (2020) found medium/high levels of audiovisual feedback outperform both none and extreme levels — the strongest single finding behind every rule here. Motion always has to answer "what does this communicate," never added for its own sake.
- **The scene's own elements participate**, rather than a floating element entering from nowhere: an exercise slides out as the next one slides in (not an instant swap); an approved chore is covered by a solid success-green panel that wipes away to reveal its own updated state (not a toast layered on top); a streak strip's seven days rise in a left-to-right wave matching what the component means (a completed sequence), reserved for that one component rather than applied generically.
- **Orchestration (stagger)** on collections — badges, lists — fires only on genuine route entry, never on an in-place re-render from an unrelated interaction on the same screen. This is enforced in code, not just intended: toggling an unrelated control never re-triggers a stagger or a wave.
- **`prefers-reduced-motion` is checked everywhere**, either via the `REDUCED()` JS helper (Web Animations API sequences) or an `@media (prefers-reduced-motion: no-preference)` CSS guard (so reduced-motion means the keyframe animation is absent, not present-and-skipped). Every state change still happens; only the travel is removed. Grounded in WCAG 2.3.3 and the finding that ~35% of adults over 40 have some vestibular sensitivity, and that what triggers a reaction is the size of a movement relative to the screen, not which CSS property moves.
- **Idle "alive" loops** (the hero float, the streak flame flicker, a pulsing CTA) deliberately do not use the transition-duration tokens — they are ambient rhythm, not state transitions, and forcing a 5-second float onto a 380ms scale would misrepresent what it is. The existing motion budget still caps this at three things at once (section 9.4).

---

## 10. What changed from the previous file

**v3 (2026-09-21): owner review of the v2.1 screenshots.** New decisions D11 (copy budget, OD-13), D12 (own visual assets, OD-14) and D13 (the Mentor stage and the replacement of the legacy UI, OD-15); mechanical rules 19–23; new chapters `06`, `07` and `08`; new tool `copy-budget-audit.reference.mjs`; the mockup's copy, icons and Mentor screen recorded as deviations K40–K42.

**v2 (2026-09-20): owner decisions OD-1…OD-12 applied; internal inconsistencies F1–F12 fixed** (both from `12-PRODUCT-FRONTEND-IMPORT-READINESS-REVIEW.md` and `13-OWNER-DECISION-LOG.md`). The mockup was not changed; where it now contradicts this file it is listed in `../mockup/KNOWN-DEVIATIONS.md`.
- *Owner decisions.* D6 and D7 rewritten (high feel, budgeted celebration on a closed milestone list; OD-7). D8 rewritten (one design system for every surface and user; age registers by content; OD-4). New D9 (no lives, guided review by the Mentor; OD-1) and D10 (Tutor = verified parent, the AI is the Mentor; OD-6). New sections 1.1 (mockup is a visual reference, not scope; access model; pricing parked; naming) and 1.2 (controlled glossary, AI translation, recommended native review; web first with the React Native equivalents and store policies to check). Rules 17 and 18 added. Sections 4.2, 9.1–9.7 and 9.9 updated to match.
- *F1.* YAML components regenerated from the rendered mockup: no `depth` tokens, no `ridge` on any component, secondary button without a line; new `elevation`, `focus`, `input`, `dialog`, `choice`, `banner-*`, `course-card` and `collectible-art` entries. `{hue}-ridge` colours kept, and their two remaining uses stated (section 3).
- *F2/F3.* YAML motion block replaced with the `04` tokens (80/150/250/380/700 ms; standard/enter/exit/spring). "Three tiers" corrected to "five duration tokens in three categories". Spring is milestone-only everywhere (D7, section 9.1, `04` §2).
- *F4 and F12.* Per-click celebration and the lives mechanic removed (D7, D9, section 9.2).
- *F5.* Type is fixed steps, not `clamp()`, in section 6, the YAML and `03` §3.2, with the mockup's step values.
- *F6.* YAML spacing scale now equals the mockup's `--s-1` … `--s-32` (4–128 px).
- *F7.* Borders: sections 4.4, 9.1 and this changelog agree with the mockup (no lines on filled components or the secondary button; functional lines only; the collectible-art outline stated as an explicit exception).
- *F8.* Duplicate rule 14 renumbered (rules 15 and 16 follow); open item 9 now cites the accent rule where it actually lives.
- *F9.* Section 7 verification brought up to date, including the v2 tool re-run and the one real text-spacing defect it found.
- *F10.* Stale file names replaced: `littlefounders-site-and-app.html` (header) and `tools/…` (section 7) here, and `littlefounders-prototype.html` / `/tmp/...` defaults in the tool headers. The review's "mockup comment citing `03-MOTION.md`" could not be found in the delivered mockup; see the deviations file.
- *F11.* `01` status line corrected: it is the evidence base behind these rules, and final.
- Also: section 5 no longer claims a ridge separates fills from light surfaces; the section 9.5 role table and shape table no longer rely on the pricing page or on ridges.

**v1 history** (kept as written, except where a v2 note says otherwise):

Glass, Lumen and Tactile materials removed. `accent` value is now orange (its meaning, "the call to action", is unchanged). `primary` `#4f46e5` → `#5c55fd`. `delight` (violet) removed: a violet distinct enough to count as its own hue collapsed with indigo under colour-vision simulation (ΔE 6.3 measured for a hue-318° violet). `warning` is an alias of `reward`. `content-faint` removed. `edge` added. Radii 10/16/24/32 → 12/20/28/36 (proposal, see section 11). Sora/Inter → Fredoka + Nunito. Touch 44 → 48/56/64. Minimum text 12 → 14 px. `dark-` naming kept.

**Correction this pass, flagged by the owner against the reference material:** the button/card system had drifted into a heavier "3D" treatment than the references call for — a 6px ridge, a gloss highlight and a periodic shine sweep on every pressable surface, plus a duplicated offset disc under every coin/medal/badge. The owner's direction is explicit: **3D is reserved for character assets only** (the owner's direction: "only characters are 3D, nothing else is"). Section 9.1 now specifies a flat system — colour fills with no relief (an interim build drew thin inset borders instead; all of them were removed in the border correction below, so no filled component has a line), scale-based press feedback instead of `translateY`, a soft border-glow pulse instead of a moving shine sweep. Colour, shape and motion-on-tap remain the carriers of the gamified feel; simulated depth is no longer one of them. This is exactly the kind of correction meant to happen at the mockup stage and be written back into this file, rather than discovered later in production.

**Also fixed this pass — overlay positioning (grave, reported by the owner):** dialogs and toasts used `position:absolute`, which anchors to the full scrollable content area rather than the visible viewport. On a long page, a dialog opened after scrolling down would render off-screen, appearing only if the user scrolled further. Both now use `position:fixed`, anchored to the true viewport regardless of page length. A related bug was fixed alongside it: re-rendering after a state change (opening a dialog, a toast appearing) was resetting scroll position to the top; scroll position is now preserved across in-place re-renders and only reset on an intentional route change.

**Correction this pass, flagged by the owner directly against the 17 reference images supplied:** the design still read as generic against the references in two further, more fundamental ways.
1. **Borders.** The stylesheet had 69 separate decorative border declarations — one on nearly every card, button, avatar and small control. None of the reference images use this pattern; separation between elements is consistently a change of fill colour, or for neutral surfaces a soft elevation shadow, never an outline. All decorative borders are removed (section 4.4); the handful that remain are functional (keyboard focus, form validation errors, a "this is the current/selected one" marker) and were kept deliberately, not missed.
2. **Full-bleed colour screens.** Several references (an onboarding "sun" screen, a "YOU WON" result screen, a full-screen language test) use one dominant hue across the *entire* screen for a single-state moment, not a coloured card sitting on a neutral background. The lesson and result screens were rebuilt this way (section 4.5); dashboard-style screens with many independent pieces of content correctly stay as a neutral page with coloured cards, matching the references that show that pattern instead.

Also added: rule 16 in section 2 (numbered 15 before v2) prohibits the em dash in UI copy, since it reads as a stylistic tell of AI-generated text (flagged by the owner; independently corroborated by public style guides that call out the same pattern, e.g. Home Assistant's documentation guide: "avoid excessive use of em dashes, often used by AI").

While applying the border removal, two real contrast bugs were caught and fixed: the pagination control on the staff table had unselected pages rendering nearly invisible (white text on a near-white fill) once its border was removed, and the four answer-state examples on the "How it works" marketing page inherited a colour meant only for the indigo lesson background, making the "Choose" (idle) state unreadable outside that context. Both are fixed and re-verified.

**This pass — a dedicated motion research session (owner's explicit request):** built a full duration/easing token system (the "+XP"/confetti feedback it kept on correct answers and coin splits was withdrawn in v2, D7) and three orchestrated animation patterns, documented in full in `04-MOTION.md` (section 9.9 above is the summary). The lesson screen gained a real 4-exercise sequence per language (previously one hardcoded question) with a choreographed slide transition between exercises; a chore-approval flow gained a success-wipe where a solid green panel covers and then reveals the row's own updated state; the streak strip gained a left-to-right wave entrance; badge grids gained a capped stagger reveal. Two bugs were caught mid-build and fixed: the lesson's bottom action bar was snapping to the new question's state while the old question's card was still visibly sliding out (fixed by cross-fading the foot in sync with the slide), and adding an "Approve" button to the chore row crowded the task title into an ugly wrap on narrow screens (fixed with a responsive flex layout, verified at both 375px and 768px). Re-verified against the full suite after every change: 0 issues across 1,440 normal-text and 1,440 forced-text-spacing configurations, 0 findings across 168 proportion/composition page-states, 0 JS errors across all 14 routes.

---

## 11. Open items

1. **Radii** 12/20/28/36: chosen by eye against the references, not measured. Confirm visually in the prototype.
2. **64 px as the global minimum** touch size, or keep the three tiers?
3. **Icon disc above a heading** (course cards, tiles, pockets): a pattern often flagged as generic. Here it is literal identity content and the references use it. Accepted, watched.
4. ~~**Streak mechanic**~~ — resolved this pass, section 9.6. Still a design judgement under real uncertainty, not a measured optimum.
5. **3D character assets:** slot spec is defined (section 9.7). The four Mentor characters (Dr. Rho, Zara, Liruf, Dina), the Diorama and the pose catalogue exist in the project folder (OD-6, OD-15). Hero and scene art is generated by the frontend agent in the house style under the `07` review gate (OD-14); the first asset of each family needs the owner's style approval.
6. **Sound:** haptics are wired, sound is not. In scope?
7. **Copy:** all strings in the prototype are my sample translations. Production copy is AI-translated from the controlled glossary (section 1.2, OD-11); native review of the registration, consent and money screens is recommended and not yet confirmed by the owner. The expansion factors in section 7 should be re-measured on that copy.
8. **Nav breakpoint:** the inline marketing nav needs a 1120px container to fit ES/PT labels without crowding; below that it is the hamburger menu. Confirm this threshold holds once real copy (not my sample translations) is final.
9. **"One accent per view"** (section 4.2, `accent` is "**the** call to action"; the section 9.5 role table, "the one primary action per view"; `01` §1 pattern 5) is stricter than the shipped marketing site, which allows one accent-hued CTA per section plus the persistent one in the nav. Proposal: amend the written rule to match, since the stricter version was never really followed once the site grew past a single screen.
10. **Focus management** (focus trap inside a dialog, returning focus to the trigger on close) is not implemented in the prototype. Needed before this ships as production code, not just a design reference.
11. ~~**Native export technology**~~ — closed by the owner: the mobile app uses a wrapper sharing the web frontend (OD-12 §9). Wrapper vendor, safe-area behavior and store-policy validation remain implementation tasks.
12. ~~**Self-registered teens and the wallet**~~ — resolved: OD-3 Option B (personal wallet without a parent; Tasks and approvals guardian-only), shown in the v2 mockup.
13. ~~**Teaching visuals**~~ — specified in `05-TEACHING-VISUALS.md` (board, viz tokens, interaction and accessibility contract); catalogue and evidence in the Product package's Appendices A and P. Three board demos (number line, discount predict-then-reveal, IF–THEN rule builder) are built in the v2.1 mockup's `board` route and pass the general text-fit and proportion audits; the board-specific checks in `05` §8 are still to be written, so those rules are not yet machine-verified.
14. **Pose catalogue coverage:** at import, check that the catalogue covers every Mentor state in `08` §3 (idle, listening, thinking, speaking, demonstrating, encouraging, celebrating, closing). Missing poses are added to the catalogue before the stage is built, never improvised.
15. **Mentor stage budgets** (`08` §7: first render under 2.5 s, 30 fps minimum) and asset size budgets (`07` §3.2) are design judgements. Measure them on real devices and revise.
16. **Copy budget numbers** (`06` §3) are design judgement calibrated on the mockup. Revise them only with usability evidence, never by raising a limit for one string.

## 12. What was not verified
Chromium only (no Safari, Firefox or real devices). No check against Apple's Kids Category or Google Play's Families Policy yet (section 1.2). No screen reader pass. No children in the loop. `hyphens: auto` depends on the browser's dictionaries, so it is a fallback, not a layout mechanism. Contrast and CVD checks use standard formulas; the CVD threshold of 9 is a heuristic I chose. Button-colour-drives-conversion and children's-colour-association claims are evidence-graded C/D in section 9.5 — treated as a starting convention, not a validated effect. See `03-PROPORTIONS-AND-COMPOSITION.md` §4 for the proportion/composition evidence gaps.
