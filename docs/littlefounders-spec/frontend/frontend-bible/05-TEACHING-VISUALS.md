# 05 · Teaching visuals ("Pizarrón") — charts, mathematics, logic and money

Status: **owner-directed (OD-4, 2026-09-20); specification. Three board demos are built in the v2.1 mockup (`board` route); the rest of the catalogue is not.** Board labels and prompts follow the Copy Budget (`06`); the Mentor beside the board follows `08` §2. Companion to `02-FOUNDATIONS.md`. Written in English because the file feeds an AI frontend agent. Evidence, the full catalogue and the grading contract live in the Product package: `10-APPENDIX-A-INTERACTIVE-VISUAL-CATALOG.md` (charts, diagrams, 16 interaction primitives) and `10-APPENDIX-P-TEACHING-VISUALS-MATH-LOGIC-MONEY.md` (mathematical representations M1–M20, logic L1–L13, money manipulables $1–$12). This file only states how those look and behave inside the one design system. It adds no new style: every colour, type style, radius, spacing value, target size and duration below is a token from `02`; the stroke widths and handle geometry in the `viz` block are new tokens defined here.

---

## 1. Decisions

| # | Decision | Why |
|---|---|---|
| V1 | Teaching visuals are built in-house on SVG, with a separate HTML layer for controls, labels and descriptions, and a pure TypeScript model and scorer shared with the server. | No library covers these widgets with the accessibility, localisation and grading needed; PhET (CC BY-NC for versions released from 29 March 2026) and GeoGebra (non-commercial only) cannot be embedded without a licence (Appendix P, Part 6). |
| V2 | Every visual sits on a **board**: a neutral surface inside the lesson's full-bleed screen. | Marks and labels need a neutral ground to reach contrast and to keep reserved hues meaningful. This is the one explicit exception to `02` §4.5's full-bleed rule, written into §4.5 itself. |
| V3 | Nothing decorative inside the board. The Mentor character, confetti, sparkles and theme art stay outside it. | Seductive details reduce learning (Appendix P, Part 1 notes). |
| V4 | Every drag has a tap alternative and a keyboard alternative. | WCAG 2.5.7: keyboard support alone does not satisfy it. |
| V5 | No celebration inside the board. A correct interaction gets the informational response from `02` §9.2; celebration happens only on the milestone list (`02` D7). | OD-7. |
| V6 | Default renderer is SVG. Canvas only for simulations with hundreds of marks, always with an HTML fallback. No WebGL or Skia on the web. | Screen-reader exposure; low-end Android (Appendix P, Part 6). |

---

## 2. Tokens (extension to the `02` YAML)

```yaml
viz:
  board:        { background: "{colors.surface}", dark-background: "{colors.dark-surface}", rounded: "{rounded.lg}", padding: "{spacing.4}" }   # 16 px inner padding; board never carries a border (02 §4.4)
  gridline:     { color: "{colors.outline}", dark-color: "{colors.dark-outline}", width: 1px }     # decorative only, never needed to read a value
  axis:         { color: "{colors.edge}", dark-color: "{colors.dark-edge}", width: 2px }           # >= 3:1 against the board (WCAG 1.4.11)
  mark:         { stroke: 3px, point-radius: 6px }
  series:       ["{colors.sky-strong}", "{colors.mint-strong}", "{colors.berry-strong}"]   # dark mode: the dark-*-strong values; order is fixed; primary is NOT a series (it means selection and focus, 02 §4.2)
  series-fill:  ["{colors.sky}", "{colors.mint}", "{colors.berry}"]           # bars and areas; text on them uses the matching on-* token
  series-pattern: [solid, diagonal, dots]                                                        # second channel, always applied from the second series on
  series-overflow: { color: "{colors.content-muted}", pattern: crosshatch, labels: direct }       # a fourth or later series: neutral marks with direct labels, one series highlighted at a time
  handle:       { visual: 32px, hit: "{target.lg}" }                                              # 64 px hit area: a handle is an answer surface (02 §8)
  snap-tick:    { length: 12px, active-color: "{colors.primary-strong}" }
  label:        "{typography.caption}"                                                            # 14 px floor; numerals in Nunito (fixed-width digits)
  value-label:  "{typography.label}"
  state:
    correct:    { color: "{colors.success-strong}", mark: check }
    try-again:  { color: "{colors.content}", mark: cross }                                        # inside the board: neutral cross + the word; the warning hue is used only by the lesson-foot banner, because warning = reward = coins (02 §3)
    selected:   { color: "{colors.primary-strong}", ring: 3px }
```

Hue rules on the board:

- Only `sky`, `mint` and `berry` may encode data series; `primary` stays reserved for selection, focus and progress (`02` §4.2). `accent` (the call to action), `reward` (coins and XP), `success` and `error` keep their reserved meanings. Coins in a money manipulable use `reward`, because that is what `reward` means.
- More than three series: the rest use `series-overflow` (neutral marks, patterns, direct labels), never another hue. Three is what the palette leaves free after the five reserved hues (`02` §4.1: eight distinguishable hues, five spoken for).
- **One board, one meaning per hue.** Within a board a hue has a single meaning. When a board combines a money manipulable with another representation, the money manipulable keeps the wallet meanings (`mint` save, `sky` spend, `berry` share) and the other representation uses neutral marks with direct labels. Coins always use `reward`, so no other element on a money board may use `reward`, `warning` included.
- **Coins on the board carry their outline.** A flat `reward` coin on a white board is about 1.8:1; the `collectible-art` outline in `reward-ridge` (`02` §3) is mandatory on the board so the coin reaches 3:1.
- A negative value (debt, a balance below zero) is shown by **position** below the zero line, a minus sign and a word, never by `error` red.
- Series meaning is always carried by colour **and** pattern or direct label (`02` rule 6).

---

## 3. Anatomy

From top to bottom inside the lesson screen:

1. **Prompt** (outside the board): the question in `typography.question`; the Mentor's avatar and name beside it, never inside the board.
2. **Board**: the workspace. Contains only the representation and its labels.
3. **Control strip** (directly under the board, HTML): the tap and keyboard alternatives (steppers, "place here" buttons, "move to…" menus), the step scrubber for replays, **Show as table** for any chart, and **Reset**. Every control meets `target.base` (56 px); primary manipulation controls meet `target.lg` (64 px).
4. **Lesson foot** (existing, `02` §9.2): the feedback banner and the Check/Continue button.

The board is the single scroll-free unit: at any width it fits without horizontal scrolling. Below 400 px container width, the board takes the full width and the control strip stacks under it; the representation reflows by container width (`02` §7 rule 9), for example a number line changes tick density, and a truth table switches from a grid to one row per card.

---

## 4. Interaction contract

| Pattern | Behaviour | Tap alternative | Keyboard |
|---|---|---|---|
| Drag a point (number line, graph) | Follows the pointer with no easing lag; snaps on release | Tap on the track to place; steppers to adjust | Arrow keys move one snap step; Page Up/Down ten steps; Home/End the bounds |
| Drag an object into a region (coins into pockets, items into bins, Euler regions) | Object lifts on pick-up (`bump`), region highlights on hover | Tap the object, then tap the destination | Enter/Space to pick up, arrows to choose a region, Enter/Space to drop; or a "Move to…" menu |
| Trade / regroup (base-ten, making change) | The traded pieces merge or split in place; the written digit changes at the same moment | "Trade 10 ones for 1 ten" button next to a column | The same button, focusable |
| Build (bar model, rule builder, flowchart, circuit) | Pieces snap into slots; the result runs on test cases when the learner asks | Slot-by-slot pickers | Tab through slots; Enter opens the picker |
| Predict, then reveal (curves, gates, tables, simulations) | The reveal is blocked until a prediction is committed; the prediction stays visible next to the result | Tap to choose or place the prediction | Same as the underlying control |
| Step replay (worked examples) | One step per `component` (250 ms), each step highlighting the cells it changes; a scrubber moves freely (`transition` stays reserved for one exercise replacing another) | Previous / next step buttons | Left/Right arrows |
| Simulation (dice, spinner) | Trials run in batches; the frequency bar grows; the learner can pause | Run 1 / Run 10 / Run 100 buttons | Same buttons |

State changes on the board use `component` (250 ms, `standard` easing). Spring overshoot is never used on the board. Under `prefers-reduced-motion: reduce`, every state still happens: points jump to their snapped position, replays switch steps with a cross-fade, simulations show the final frequencies, and highlights remain.

---

## 5. Text on the board (Text Fit Contract, `02` §7)

- Any label that is a word or can grow in translation (axis titles, bin names, legend entries, flowchart node text, scenario cards) is **HTML**, positioned over the SVG, and wraps. SVG `<text>` is allowed only for short numerals and single symbols.
- Tick labels never overlap, rotate or truncate: when space runs out, the representation shows fewer ticks. Values the learner needs stay reachable in **Show as table**.
- Units are always visible ("per 100 g", "coins", "years").
- Numbers, currencies and plurals come from `Intl` with the full locale (`en-US`, `es-MX`, `pt-BR`). A bare "$" never appears in a lesson that involves more than one currency (in `es-MX` it means pesos).
- Number input uses `inputmode="decimal"` and a locale-aware parser, and echoes the parsed value back before submission.
- Long division has **three renderers** — US bracket, Mexican *casita*, Brazilian *método da chave* (quotient under the divisor) — selected by locale profile, each with its own step sequence (Appendix P, Part 5).
- Mathematical notation is rendered with KaTeX (server-side where possible, loaded only in lessons that need it), and every expression a child must understand carries an author-written `spokenText` per locale (MathJax has no Portuguese speech).

---

## 6. Accessibility

- **Structure:** model → SVG view (`aria-hidden="true"` when an HTML layer carries the semantics) → HTML control and description layer. Never put `role="img"` on an interactive SVG; it removes the children from the accessibility tree.
- **Roles:** a movable point is a `slider` with a localised `aria-valuetext` ("three quarters", "tres cuartos", "três quartos"); a truth table is a `grid`; bins and regions are reached through the "Move to…" menu; a static chart is `role="img"` with a name and a description following "chart type → axes → key takeaway".
- **Announcements:** state changes (a trade made, a point placed, a rule evaluated) are announced through one polite live region; correct/try-again feedback is announced through the lesson foot's existing banner.
- **Contrast:** marks, axes, handles and focus rings reach 3:1 against the board in both modes; text reaches 4.5:1 (`02` rule 11).
- **Every chart** has **Show as table**, formatted per locale.
- **Audit checklist:** Chartability (Elavsky) quick test, in addition to the `verification-tools/` audits.

---

## 7. Family notes

| Family | Visual rules specific to it |
|---|---|
| Number lines (M2–M4) | Always bounded, with both ends labelled; benchmarks (0, ½, 1) as longer ticks; the placed point shows its value only after submission when estimation is the skill. |
| Base-ten and place value (M5) | Units, rods and flats in one series hue per place (`sky` ones, `mint` tens, `berry` hundreds), each also labelled; the written number sits directly under its column. Never on the same board as a Save/Spend/Share split (one meaning per hue). |
| Fractions (M3, M6) | Area and number-line views of the same fraction are linked live; circle models only for halves, thirds, quarters and sixths (hard to split equally otherwise). |
| Bar and schema models (M7, M8) | Bars built by the learner; the unknown is a dashed segment labelled "?"; structure is checked before the arithmetic. |
| Worked examples (M9, M10) | The active step is highlighted with `primary-soft`; completed steps stay visible in `content-muted`; blanks in faded examples are input fields at `target.base`. |
| Probability and risk (M16–M18) | Icon arrays of 10 or 100, grouped in rows of 10; counts ("12 of 100") first, percentages as a second view. |
| Logic (L1–L6) | Condition text lives on the node, switch or card, never in a legend; at most 3 decision points for ages 6–9 and 2 inputs for ages 10–12 (content registers, `02` D8). |
| Money ($1–$12) | Coins are simplified, flat `reward` tokens for arithmetic (realistic artwork only in coin-recognition lessons); the save/spend/share split reuses the Wallet's own component; amounts in the child's wallet are always labelled as simulated coins. |

---

## 8. Verification

The v2.1 mockup's `board` route builds three demos (number line, discount predict-then-reveal, IF–THEN rule builder); that route passes the general text-fit and proportion audits. The board-specific rules below are not yet machine-verified. Extend `verification-tools/` with: board labels in the text-fit audit; a contrast check of marks and axes against the board in both modes; a check that no reserved hue encodes a data series; a check that every draggable has a tap alternative and a 64 px hit area; a check that no animation fires inside the board outside the allowed patterns; and the scorer parity test from Appendix P, Part 7.
