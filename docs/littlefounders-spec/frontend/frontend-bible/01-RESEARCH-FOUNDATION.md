# LittleFounders — Frontend Design Research Foundation

**Scope:** Frontend only. No product description. This document is the evidence base
for the rule set in `02-FOUNDATIONS.md` (which carries the `DESIGN.md` tokens). It is NOT the `DESIGN.md`.
**Language:** English (all project documentation).
**Status:** Final (v2, 2026-09-20). This is the evidence base behind the rules in
`02-FOUNDATIONS.md`, `03-PROPORTIONS-AND-COMPOSITION.md` and `04-MOTION.md`. It holds
findings and their grades, not tokens or rules; where a finding became a rule, the rule
lives in `02`–`04`, and the owner decisions in `13-OWNER-DECISION-LOG.md` take precedence.

---

## 0. How to read this document

### 0.1 Evidence grades

Every claim carries a grade. The design system may only turn a claim into a hard rule
if the grade allows it.

| Grade | Meaning | May become |
|---|---|---|
| **A** | Meta-analysis, large replicated study, or binding standard (WCAG) | Hard rule (MUST / MUST NOT) |
| **B** | Single strong study, or converging qualitative evidence | Strong default (SHOULD) |
| **C** | Contested, mixed replication, or expert consensus without controlled data | Guideline with stated caveat |
| **D** | Practitioner folklore, blog-level, or a claim we could not verify | NOT a rule. Do not encode |

### 0.2 Why this matters

The single largest risk in this project is **bias laundered as principle**. Design
writing is full of confident statements ("blue builds trust", "round shapes feel safe")
that are either context-dependent or fail replication. An AI agent given such a
statement as a rule will apply it rigidly everywhere. Section 2 and 3 exist to prevent
that.

### 0.3 Project decisions already fixed by the owner

These are inputs, not findings. They are not up for re-litigation in later phases.

1. **One visual language for every user.** No per-audience skins. Uniformity is the point.
   Density differences are solved by composition (how much content fits), never by a
   different style.
   *Clarified by the owner on 2026-09-20 (OD-4):* one design system for every surface and
   user; what varies by age band is only copy tone, character presence, reward framing and
   social mechanics (`02` D8).
2. **No glassmorphism.** Base style is flat-tactile with solid colour.
3. **"Absolute" colours** (one solid, saturated hue per meaning) carry achievements,
   categories and states, as in the reference set.
4. **A warm contrast accent** is introduced (coral/orange family) alongside the brand
   indigo.
5. **Characters are 3D** wherever possible.

---

## 1. The reference set — what the style actually is

Twelve reference screens were supplied. Palettes were extracted programmatically and
each screen was read individually. The recurring structure (appears in 8+ of 12):

| # | Pattern | Evidence in references |
|---|---|---|
| 1 | One brand colour + one warm contrast accent | Indigo/violet + coral or yellow in refs 2, 3, 5, 10, 11 |
| 2 | Large, fully rounded surfaces (20–32 px), capsule buttons, circular icon holders | All 12; no square corners anywhere |
| 3 | Character or illustration is the protagonist, not decoration | 30–50% of welcome screens (refs 2, 3, 10, 11, 12) |
| 4 | Hierarchy by weight, not size or colour | Extra-bold titles, regular body |
| 5 | One primary action per screen, label legible on its fill | All welcome and result screens |
| 6 | Progress always visible (thin bars, rings, dots, counters) | Refs 1, 2, 4, 7, 10, 12 |
| 7 | Colour-by-category cards | Refs 1, 4, 7, 8 |
| 8 | Simple bottom navigation, 4–5 items | Refs 1, 2, 3, 7, 8, 10 |
| 9 | Generous white space; density only in the adult dashboard | Refs 4, 6 |

**Contrast finding that directly affects the "absolute colour" decision.** The saturated
fills used in the references were measured against white and dark ink text (WCAG relative
luminance, computed, not estimated):

| Fill | White text | Ink text | Usable label colour |
|---|---:|---:|---|
| Indigo `#4f46e5` | 6.29 | 2.84 | white |
| Violet `#8977eb` | 3.56 | 5.02 | ink |
| Coral `#ed7353` | 2.93 | 6.10 | ink |
| Orange (ref 1) | 2.54 | 7.02 | ink |
| Green `#5fdc7a` | 1.75 | 10.21 | ink |
| Green `#57bc7b` | 2.36 | 7.55 | ink |
| Yellow (ref 5) | 1.67 | 10.69 | ink |
| Sky blue (ref 1) | 2.87 | 6.23 | ink |
| `success` in current pseudo-doc `#059669` | **3.77** | 4.74 | ink (white **fails AA**) |

**Consequence (grade A, derived from WCAG 1.4.3):** in this style, *only deep fills take
white text*. Bright "absolute" fills take **dark ink text**. This is a token-level rule:
every fill token must ship with its own `on-*` token chosen by measurement, never by
habit. The current pseudo-doc violates this with `on-success: #ffffff`.

---

## 2. Colour psychology — what is and is not established

### 2.1 What the science actually supports

**Colour-in-Context theory** (Elliot & Maier, 2012, 2014) is the leading framework. Its
six propositions (as summarised in later literature): colour carries meaning; it can
influence behaviour; responses can be automatic; associations arise from learning and
biology; the relation is reciprocal; and **the effect of a colour is context-specific**.

**Grade A finding, stated carefully:** the same colour produces *different or opposite*
effects in different psychological contexts. Meier et al. (2012) found red made people
walk *faster* to a dating interview and *slower* to an intelligence interview. There is
no context-free "meaning of red".

### 2.2 What fails or is unstable

**Red and achievement.** Elliot et al. (2007) reported that brief exposure to red before a
test impaired performance. Later replications are mixed:

- Four replication attempts on the *word* "red" (Collabra, 2020; N = 69, 104, 103, 1,149)
  found effects near zero (Cohen's d = 0.04, −0.23, 0.19, 0.01). The authors conclude the
  effect, if real, is small enough to need very large samples.
- A separate replication (2019) supported the original on evaluation and failure focus.

**Grade C.** The honest position: red-in-achievement is *plausible, possibly small,
not settled*. The field's own review says it is "at a nascent stage" and asks for
"patience and prudence" before real-world application.

### 2.3 Decisions this supports

- **Do not encode "blue = trust", "green = calm", "red = danger" as universal rules.**
  (Grade D as universals.) They may be used as *conventions of this product* — a
  convention is a promise the product keeps, not a fact about brains.
- **Keep "no red for a wrong answer".** The pseudo-doc already does this. The defensible
  reason is *not* "red harms performance" (unsettled). It is: **(a)** red carries a
  "marked wrong on school papers" association for children (a learned association,
  Grade C); **(b)** the cost of avoiding red is zero; **(c)** amber plus a shape mark
  carries the meaning without it. Cheap, low-risk, reversible. Grade C, kept as a
  guideline.
- **Semantic colour must be a system convention, defined once, applied uniformly.**
  The value of an "absolute colour" is *consistency of meaning across the product*, not
  any innate meaning of the hue.

---

## 3. Shape psychology — what is and is not established

### 3.1 The famous claim

Bar & Neta (2006, *Psychological Science*) reported people prefer curved to sharp-angled
objects and proposed a threat-avoidance explanation. It is widely repeated as
"round = safe and friendly".

### 3.2 What the meta-analysis found

Chuquichambi et al. (2022, *Annals of the NY Academy of Sciences*; 61 records) reviewed the
field and concluded:

> preference for visual curvature is "a reliable but not universal phenomenon", moderated
> by **presentation time, stimulus type, expertise and task**.

A follow-up reading of the same dataset found the effect **small to non-significant for
spatial-design stimuli** (rooms, buildings) versus larger effects for meaningless shapes
and real objects, and a negative relation between curvature preference and how many
*affordances* an object has.

**Grade A for "reliable but not universal". Grade C for any mechanism (threat, etc.).**

### 3.3 Decisions this supports

- **Do not justify the rounded style with "round shapes feel safe".** That is the
  overreach. The style is justified by **(a)** the owner's reference set and brand
  direction and **(b)** the functional benefits below.
- **Functional, verifiable reasons for large radii and capsule controls:**
  - A capsule reads as *pressable* because it is a *closed, self-contained hit region*
    (affordance). This is an interface claim, testable by tap-accuracy, not a claim
    about emotion.
  - A consistent radius scale makes *hierarchy* legible (control vs. surface).
- **Impeccable's catalogue flags "extreme border-radius on cards" (44 px on a small
  card) as a design-review smell.** The cure there is *proportion to size*, not
  abolition. Our rule: radius scales with the element's shortest side; a small card
  must not use a hero radius.
- **Affordance beats aesthetic.** Curved-preference research finds *lower* preference for
  curvature in objects with many affordances. For us: **do not make a control less
  legible as a control in order to look soft.**

---

## 4. Gamification — effect, and how it goes wrong

### 4.1 Does it work?

Sailer & Homner (2020, *Educational Psychology Review*): significant **small** effects on
cognitive (g = 0.49), motivational (g = 0.36) and behavioural (g = 0.25) outcomes
(k = 9–19 per outcome). The cognitive effect was stable in high-rigour subsets; the
**motivational and behavioural effects were less stable**. Heterogeneity was high
(other syntheses report I² ≈ 92%).

Moderators that mattered:
- **Game fiction** (a story/world wrapper) — helped behavioural outcomes.
- **Competition combined with collaboration** — helped; competition alone did not.

**Grade A** for "small positive, heterogeneous". **Grade B** for the two moderators.

Implication: this platform's *story-driven* framing (a character, a world, missions) is the
best-supported gamification element. Leaderboard-style pure competition is the
least-supported.

### 4.2 The reward trap (overjustification)

Deci, Koestner & Ryan (1999, *Psychological Bulletin*; 128 experiments):

- Engagement-, completion- and performance-contingent **tangible** rewards significantly
  **undermined** free-choice intrinsic motivation (d = −0.40, −0.36, −0.28).
- **Positive informational feedback enhanced** it (d = +0.33 free-choice; +0.31 interest).
- **Tangible rewards tended to be more detrimental for children than for college
  students.** Verbal/informational rewards were *less* enhancing for children.

**Grade A.** This is the strongest single finding for our design and it is directly
about our audience.

Design consequences (all derived, none invented):

| Principle | Reason | Applies to |
|---|---|---|
| Feedback must be **informational** ("you split the fraction correctly"), not controlling ("you MUST keep your streak!") | DKR 1999: informational feedback enhances; controlling erodes | All feedback copy and states |
| Rewards must not be the *point* of the screen | Completion-contingent tangible rewards undermine interest, worse in children | XP/coin displays are secondary chrome, never the hero |
| Celebrations mark a **real** milestone, not a click | Engagement-contingent rewards undermine most (d = −0.40) | Confetti/burst budgets |

*Caveat:* the "overjustification effect" is contested in language-learning contexts
specifically (Grade C for that sub-domain). The meta-analytic evidence above is general
and stronger.

### 4.3 Loss aversion and streak harms

Loss aversion ("a loss weighs roughly twice a gain") is well known (Kahneman & Tversky).
Applied to streaks it produces retention **and** anxiety. Evidence quality here is
**mixed**:

- A qualitative case study of a language-learning app (arXiv 2203.16175) documents users
  reporting **apprehension** and **self-recrimination** driven by gamification misuse
  (e.g., stress over leagues; gamification becoming "another chore"). **Grade B**
  (qualitative, real users, single app).
- Parent-facing blogs and Medium posts report anxiety in children. **Grade D** as
  evidence. Consistent, but not a study. Not cited as proof.
- Commentary that streak mechanics "monetize anxiety" (paid streak repair) is
  **Grade D** as science but is a legitimate **design-ethics warning**.

**Decision (design-ethics, not a claim of proven harm):** for a platform whose users are
children, the burden of proof is on the mechanic. We adopt **"forgiving by default"**:

- No guilt-framed copy. No sad-mascot-as-punishment.
- Loss states are **never** the most visually prominent state on a screen.
- Streaks, if used, must have a built-in grace mechanism and must never be sold back.
  (Note: the platform's product docs state no billing exists, which removes the
  monetization vector; the *visual* language must still not imitate it. Owner decision
  OD-5, 2026-09-20: the platform is free at launch and pricing is parked; if a paywall ever
  comes, streaks, rest days and error forgiveness can never be sold.)

### 4.4 "Designed to wear the user down" — the user's stated concern

The owner asked that this be handled from the start. Two distinct concerns exist and must
not be conflated:

1. **UI that wears down the end-user** (dark patterns, streak anxiety, notification
   pressure). Addressed in 4.2–4.3 and in the "Engagement ethics" rules to be derived.
2. **AI tooling that wears down the developer** (more tokens, more dialogue turns).
   Addressed in Section 6.

---

## 5. Accessibility and children's motor ability — hard limits

### 5.1 Binding standards (Grade A)

| Requirement | Value | Source |
|---|---|---|
| Normal text contrast | ≥ 4.5 : 1 | WCAG 1.4.3 (AA) |
| Large text contrast | ≥ 3 : 1 | WCAG 1.4.3 (AA) |
| UI component / graphic contrast | ≥ 3 : 1 | WCAG 1.4.11 (AA) |
| Colour not the only channel | required | WCAG 1.4.1 (A) |
| Minimum target size | 24 × 24 CSS px (or spacing exception) | WCAG 2.5.8 (AA) |
| Enhanced target size | 44 × 44 CSS px | WCAG 2.5.5 (AAA) |
| Body text (Impeccable guidance) | ≈ 16 px start | Impeccable, a tool convention (Grade C) |
| Line length | 65–75 characters | Impeccable, a tool convention (Grade C) |

### 5.2 Children are not small adults (Grade A/B)

- Children 7–10 years old **missed 7 mm targets almost 30 % of the time**; 11–17 year olds
  about **20 %** (Anthony et al., 2013, cited in a ScienceDirect study of ages 3–6).
- Nielsen Norman Group (usability studies with children aged 3–12, ~125 children across
  three rounds) recommends **at least 2 cm × 2 cm** touch targets for young children
  (four times the 1 cm × 1 cm adult recommendation), and notes fine gestures such as
  dragging are hard for young children, while tapping, swiping and large-motion gestures
  are easy.
- Target ages differ enough that NN/G distinguishes at least 3–5, 6–8 and 9–12.

**Implication for the pseudo-doc's "44 px, 48 px on answers":** 44 CSS px is roughly
**7–11 mm** on common phones depending on pixel density. That sits **inside the range
where 7–10 year-olds still err**. It satisfies WCAG AAA and adult use; it is *not*
evidence-based comfort for the youngest users. **Open decision, see Section 8.**

### 5.3 Colour-vision deficiency (Grade A for prevalence, with a caveat)

- Red–green CVD affects **up to ~8 % of males and ~0.5 % of females of Northern European
  descent**; rates are lower in Asian and African populations. The "8 % of men" figure is
  **regional, not a global average**; pooled global estimates are nearer 4.5 % (male) and
  0.4 % (female).
- The platform serves Mexico and Brazil. Precise local rates are **not established by
  the sources gathered** (do not assume 8 %). The design consequence is identical at any
  of these rates: **never use colour as the only channel.**

**Measured on our candidate palette** (Machado et al. 2009 simulation, CIELAB ΔE76;
computed, not estimated):

| Pair | Normal vision ΔE | Worst-case CVD ΔE | Verdict |
|---|---:|---:|---|
| Indigo ↔ Violet | 14.0 | 10.5 | **Confusable even with normal vision** |
| Coral ↔ Green | 106.2 | **10.8** | **Collapses under CVD** |
| Coral ↔ Pink | 57.0 | **11.3** | **Collapses under CVD** |
| Sky ↔ Violet | 53.4 | 15.8 | Marginal |
| Green ↔ Sky | 98.0 | 16.9 | Marginal |

**Consequences (Grade A method, derived numbers):**
1. **Indigo and violet must not be used as two distinct meanings.** Either merge them or
   move violet far enough away.
2. **Coral and green — the natural "wrong / right" pair — collapse under CVD.** The
   correct/incorrect state therefore **must** carry a second channel (icon shape + word),
   and the palette must not rely on hue to separate them. This independently confirms
   the pseudo-doc's `AnswerMark` idea.
3. "Absolute colours per achievement" is compatible with accessibility **only if** every
   colour also has a **shape/icon and a text label**, and the palette is validated by
   simulation before adoption.

---

## 6. Designing for AI agents — evidence on context files, and the token-cost concern

The owner's concern: *AI use is designed to wear the user down, burn tokens and force more
dialogue turns; do it right from the start.* The evidence is directly relevant.

### 6.1 What the best available study found (Grade B, one strong preprint)

Gloaguen et al. (arXiv 2602.11988, ETH Zurich, v2 June 2026) evaluated repository context
files (AGENTS.md / CLAUDE.md) on coding agents across four models and two benchmarks
(SWE-bench Lite 300 tasks; CtxBench 138 tasks with developer-written context files).

- Context files **did not significantly improve task success**. LLM-generated files
  changed resolution by −0.5 % (SWE-bench) and −2 % (CtxBench) on average (p = 0.87, 0.37).
- They **raised cost by ~20–23 %** and increased steps (≈ +2.5 to +3.9 per task); reasoning
  tokens rose ~10–22 %.
- Agents **followed the instructions well**; that is *why* cost rose (more testing and
  exploration). It was not an instruction-following failure.
- **Codebase overviews were not helpful.** Agents did not find relevant files faster.
- Developer-written files beat LLM-generated ones by a significant margin (≈ 7 %,
  p = 0.038), but were still not significantly better than none (p = 0.21).
- Length of the file **did not** correlate with success or cost. What raised cost was
  **the number of *followed instructions***.
- Recommended content: *only* non-standard instructions the agent cannot infer from the
  repo.

**Limitations to state honestly:** Python only; software-engineering tasks (bug fixes),
**not UI-design quality**; coding agents, not design agents. It is a **strong signal about
cost and instruction-following, not proof about design outcomes.** Do not over-extend it.

### 6.2 What Impeccable's own research adds (Grade C, self-reported, credible method)

Impeccable v4 research notes (July 2026; ~30 iterations, ~200 sampled concepts, ~$2,600
in evaluations):

- Asking a model to "be creative" produced **the same concept 30 of 35 times**. Wording
  changed; the idea did not.
- The same happened after "reject your first idea": the model landed on its **second
  default**.
- **A varied shortlist still collapsed to one winner** when the model chose. Their fix:
  the model *proposes* options, a **script assigns** which to build.
- Adding many discouraging instructions made work "timid". The **biggest single quality
  jump** came from removing a safeguard and ordering the work: **commit to the concept
  first, then refine clarity.**
- A **written direction contract** compared against the rendered result by a *separate*
  reviewer caught gaps that self-review missed.
- Their own catalogue rejected glassmorphism as an AI default. **Independent
  confirmation of the owner's decision, but the source is a competitor tool, so treat as
  supporting, not decisive.**

**Caveat on this source:** the evaluations were run by the tool's authors, with the
project's design director as the human rater. Results are informative, not independent.

### 6.3 What this means for how the `DESIGN.md` must be written

Derived from 6.1 and 6.2 (Grade B/C; these shape *format*, they are not design facts):

1. **Do not describe the codebase.** Overviews are not helpful. The file must state only
   what an agent **cannot infer**: the decisions.
2. **Every instruction costs tokens because it is followed.** Each rule must earn its
   place. Prefer **few, high-leverage, enforceable** rules over long prose.
3. **Prefer machine-checkable rules over prose.** A rule that a linter can verify does not
   need to be re-read every turn. (Impeccable ships a detector that runs "in code,
   without an AI model or API key".)
4. **Put the token names and values in structured YAML;** put *why and when* in short
   prose. This matches the open `DESIGN.md` spec (below).
5. **Do not rely on the model's taste to avoid genericness.** Give it a *concrete
   direction* (this product's own visual world), not an instruction to "be creative".
6. **Do not make the file longer to feel thorough.** Length is not correlated with
   benefit; followed-instruction count correlates with cost.

### 6.4 The open `DESIGN.md` format (Grade A for the spec itself)

Google Labs' open spec (`google-labs-code/design.md`, alpha):

- YAML front matter for tokens: `colors`, `typography`, `rounded`, `spacing`, `components`.
- Token references with `{path.to.token}`.
- **Eight body sections in fixed order:** Overview, Colors, Typography, Layout,
  Elevation & Depth, Shapes, Components, Do's and Don'ts. Unknown sections are preserved.
  **Duplicate section headings are an error.**
- Recommended (non-normative) names: `primary, secondary, tertiary, neutral, surface,
  on-surface, error`; type levels `headline-*, body-*, label-*`; radii `none, sm, md, lg,
  xl, full`.
- Colour values may be hex, `rgb()`, `hsl()`, `oklch()`, etc.; all are converted to sRGB
  for WCAG checks.

Impeccable reads `DESIGN.md` plus a separate `PRODUCT.md` (users, purpose, principles).
**The owner has excluded product description from this document set**, so any
product-context content stays out; only the design system goes in.

---

## 7. Anti-pattern catalogue — what to forbid, and what not to over-forbid

Source: Impeccable's public slop catalogue (61 detector rules + 6 design-review patterns).
Treat as **Grade C**: a well-maintained practitioner list, not science. Only the entries
that touch this project's decisions are reproduced.

### 7.1 Directly relevant to the owner's decisions

| Catalogue entry | Relevance |
|---|---|
| **Glassmorphism everywhere** (design-review) | Confirms dropping glass. |
| **Bounce or elastic easing** | Conflicts with playful gamified motion. See 7.3. |
| **Extreme border-radius on cards** | Proportion rule (Section 3.3). |
| **Icon tile stacked above heading** | The pseudo-doc's `.lf-tile` lockup is exactly this pattern. Conflict. |
| **Label above a heading** ("eyebrow") | The pseudo-doc's `.lf-eyebrow` "strongest typographic signature" is flagged. Conflict. |
| **Overused font (Inter, Geist)** | Pseudo-doc uses Inter as the only UI family. Conflict. |
| **Nested cards / cards inside cards** | Relevant to dashboard composition. |
| **Identical card grids** | Relevant to course and category grids. |
| **Gradient text**, **radial-gradient halo**, **dark mode with glowing accents** | Avoid. |
| **Side-tab accent border** | Avoid; use only for a real status. |
| **Low-contrast text**, **tiny body text**, **tiny interface text** | Reinforce Section 5. |
| **Pulsing status dot**, **auto-scrolling marquee**, **images that move on hover** | Motion budget. |
| **Em-dash overuse** (copy) | Matches the owner's copy rule in the pseudo-doc. |
| **Rough SVG illustrations** | Argues for *properly made* character assets, not hand-coded ones. |
| **Cream/beige palette** | Only if it is a considered choice. |

### 7.2 Where the catalogue is a tension, not a law

The catalogue targets *marketing/product-UI defaults* and is **not calibrated for
children's gamified learning**. Three places where we should **consciously diverge**:

- **Bounce/spring easing.** Flagged as fussy for "a routine action". In a gamified
  learning product, a springy reward at a *real milestone* is part of the reference
  style (refs 1, 7, 10). Rule should be **contextual**: bounce is allowed only on
  reward/celebration moments, never on routine navigation or dialogs.
- **Large icon tiles.** Flagged as decoration outranking content. In our references, big
  illustrated tiles *are* the content (ref 5, 10). Rule: the tile must **be** the
  navigational object, not ornament above a heading.
- **Repeated similar cards.** Flagged for identical grids. Our category cards *should*
  look like a family, differentiated by their absolute colour and illustration. Rule:
  **family resemblance with per-item colour and art is intentional; identical
  icon-heading-text triplets are not.**

### 7.3 Where the catalogue itself may be biased

The catalogue is one author's taste system, tuned to detect what current models
overproduce. Its own research notes that "the catalogue has to respond as those defaults
change." **Do not treat it as timeless truth.** Adopt the *checking mechanism*
(detect → fix) more than any specific taste verdict.

---

## 8. Open decisions — must be answered before writing `DESIGN.md`

These are unresolved by the evidence and need the owner.
*Status (v2):* all eight were answered in `02` (decision log §1, and sections 4, 6, 8,
9.6 and 11). D7 (bounce policy) and D8 (age bands) were settled finally by owner decisions OD-7
and OD-4 on 2026-09-20 (`02` D7, D8).

| # | Decision | Why it is open |
|---|---|---|
| D1 | **Tap-target floor.** Keep 44/48 px, or raise (e.g. 56 px+) on answer surfaces? | 44 px ≈ 7–11 mm, inside the range where 7–10 year-olds still err ~30 % (5.2). Trade-off is screen space vs. accuracy. |
| D2 | **Palette collapse.** Merge indigo/violet? Re-space coral/green? | Measured collapse under CVD (5.3). |
| D3 | **Text-on-fill policy.** Dark ink on bright "absolute" fills (measured to pass) vs. deepen fills to allow white | Section 1 contrast table. Affects the whole colour-token set. |
| D4 | **Typeface.** Keep Inter (flagged as overused) or choose a face with more character | Conflicts with Section 7.1; also a legibility question for children. |
| D5 | **Eyebrow / icon-tile lockup.** Keep, restyle, or drop | Both flagged in the catalogue; both central to the pseudo-doc. |
| D6 | **Streak mechanic.** Include at all? If so, grace rules | Section 4.3. Ethics decision, not a research fact. |
| D7 | **Bounce policy.** Confirm "reward moments only" | Section 7.2. |
| D8 | **Age bands.** One tap-size/type scale for all, or scale up under a size setting | Owner rule is *one style*; a *size* setting is not a *style* — needs an explicit ruling. |

---

## 9. What is deliberately NOT concluded

To avoid bias, the following are **not** claimed by this document:

- That any colour has an innate emotional meaning.
- That rounded shapes are inherently safer or friendlier.
- That gamification "boosts engagement" without qualification (effects are small,
  heterogeneous, less stable for motivation and behaviour).
- That context files (`DESIGN.md` included) *improve* agent output. The best evidence
  says they mainly **change behaviour and raise cost**, and help only when they contain
  **non-inferable specifics**.
- That Impeccable's rules are correct for children. It is not built or validated for
  that audience.
- That the "8 % of men colour-blind" figure applies to this platform's markets.

---

## 10. Source list

**Colour**
- Elliot, A. J., & Maier, M. A. (2014). Color psychology: Effects of perceiving color on
  psychological functioning in humans. *Annual Review of Psychology, 65*, 95–120.
- Elliot, A. J., & Maier, M. A. (2012). Color-in-context theory. *Advances in Experimental
  Social Psychology, 45*, 61–125.
- Elliot, A. J., et al. (2007). Color and psychological functioning: The effect of red on
  performance attainment. *J. Exp. Psychol.: General, 136*, 154–168.
- Meier, B. P., D'Agostino, P. R., Elliot, A. J., Maier, M. A., & Wilkowski, B. M. (2012).
  Color in context: Psychological context moderates the influence of red on approach- and
  avoidance-motivated behavior. *PLoS ONE*.
- Four replication attempts on processing the word "red" and intellectual performance.
  *Collabra: Psychology*, 6(1), 2020.
- "The power of red: The influence of colour on evaluation and failure — A replication."
  *Acta Psychologica*, 2019.

**Shape**
- Bar, M., & Neta, M. (2006). Humans prefer curved visual objects. *Psychological
  Science, 17*(8), 645–648.
- Chuquichambi, E. G., Vartanian, O., Skov, M., Corradi, G. B., Nadal, M., Silvia, P. J., &
  Munar, E. (2022). How universal is preference for visual curvature? A systematic review
  and meta-analysis. *Annals of the NY Academy of Sciences, 1518*(1), 151–165.
- Djebbara, Z., et al. (2023). Affordances and curvature preference: The case of real
  objects and spaces. *Annals of the NY Academy of Sciences*.

**Motivation and gamification**
- Deci, E. L., Koestner, R., & Ryan, R. M. (1999). A meta-analytic review of experiments
  examining the effects of extrinsic rewards on intrinsic motivation. *Psychological
  Bulletin, 125*(6), 627–668.
- Sailer, M., & Homner, L. (2020). The gamification of learning: A meta-analysis.
  *Educational Psychology Review, 32*, 77–112.
- "When gamification spoils your learning: A qualitative case study of gamification misuse
  in a language-learning app." arXiv:2203.16175.

**Cognitive load**
- Rey, G. D. (2012). A review of research and a meta-analysis of the seductive detail
  effect. *Educational Research Review, 7*(3), 216–237.
- Sundararajan, N., & Adesope, O. (2020). Keep it coherent: A meta-analysis of the
  seductive details effect. *Educational Psychology Review*. (Overall g ≈ −0.33.)

**Accessibility and children**
- W3C. WCAG 2.2: SC 1.4.1, 1.4.3, 1.4.11, 2.5.5, 2.5.8.
- Nielsen Norman Group. *Design for Kids Based on Their Stage of Physical Development*
  (2024) and *UX Design for Children (Ages 3–12), 4th ed.*
- Anthony, L., Brown, Q., Nias, J., & Tate, B., et al. (2012–2013). Children's touch and
  gesture input on mobile devices; touch interaction for ages 3–6 (*Int. J.
  Human-Computer Studies*, 2014).
- Machado, G. M., Oliveira, M. M., & Fernandes, L. A. F. (2009). A physiologically-based
  model for simulation of color vision deficiency. *IEEE TVCG*.
- Prevalence: narrative review "A Global Perspective of Color Vision Deficiency" (MDPI
  *Healthcare*, 2025); pooled estimates cited by secondary sources (treat as Grade C).

**AI agents and design tooling**
- Gloaguen, T., Mündler, N., Müller, M., Raychev, V., & Vechev, M. (2026). Evaluating
  AGENTS.md: Are repository-level context files helpful for coding agents?
  arXiv:2602.11988 (v2, 23 Jun 2026).
- Impeccable (P. Bakaus). *The model can't roll its own dice* (research notes, July 2026),
  slop catalogue, and `document` command docs. impeccable.style.
- Google Labs. *DESIGN.md Format Specification* (alpha).
  github.com/google-labs-code/design.md

---

## 11. Method notes (for reproducibility)

- Contrast ratios: WCAG 2.x relative-luminance formula, computed in Python.
- CVD simulation: Machado et al. (2009) matrices at severity 1.0 (protan, deutan, tritan)
  applied in linear RGB; distance = CIELAB ΔE76. ΔE76 is a coarse metric and is used here
  only to rank pair separability; a threshold of "≈ 15 = collapses" is a working
  heuristic, **not a standard**.
- Reference palettes: 7-colour median-cut quantisation of each reference screenshot.
  These are *dominant on-screen values*, not the designers' source tokens; screenshots
  contain photographs and gradients, so treat percentages as indicative.
- Web sources were retrieved on 2026-09-20. Some secondary sources (blogs, Medium, parent
  guides) were read but **not** relied on for any grade A/B claim.
