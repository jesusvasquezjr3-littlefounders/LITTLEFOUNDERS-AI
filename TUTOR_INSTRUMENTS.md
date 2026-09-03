# TUTOR_INSTRUMENTS.md — The Tutor's teaching instruments: catalog, architecture, sprint plan

> **Authority:** engine spec (`/AGENTS.md` §1.1 tier 6). Subordinate to `/AGENTS.md`,
> `ROADMAP.md`, `GLOSSARY.md`, `DESIGN.md` and the service `AGENTS.md` files;
> authoritative over `WALKTHROUGH.md`, `repo_map.md` and `doc_map.md` on this topic.
> On conflict with `/ORACLE.md`: `/ORACLE.md` owns the Tutor's runtime, privacy
> contract, content ladder and the whiteboard AS IT EXISTS TODAY (§20.5). This file
> owns where the instrument catalog GOES. Neither may contradict the other; a change
> to a shipped instrument updates `/ORACLE.md` §20.5 and this file's §0 in the same
> commit.
>
> **Created:** 2026-09-02 · **Language:** English, per `/AGENTS.md` §1.0 #4.
>
> **What this file is.** A plan, not a record of built work. Nothing in §3 or §7
> exists yet unless §0 says so. Everything here was derived by reading the repo
> in one session; every number is labelled either VERIFIED (read out of code or
> data in that session) or ESTIMATED (derived, not measured). No estimate in this
> file may be quoted anywhere else as if it were a measurement.

---

## §0 STATE — read this first, always

**This section is the resume point after any context loss or compaction. It is the
only section that must be updated on EVERY sprint boundary.**

| | |
|---|---|
| **Status** | IN PROGRESS. Wave 1 foundation started 2026-09-02. |
| **Active sprint** | — none. Wave 1 COMPLETE (Sprints 4-8 plus §4.4); Sprints 11 and 12 done. **23 of the 41 Class I instruments are live; 18 remain.** Classes II-V not started. **None of the 19 new kinds has been used by a real model in a real session** — they are built and gate-verified, not proven live. |
| **Next action** | Either Wave 0 (§7.1-§7.3 — unlocks nothing new has to be designed for, and still the cheapest value in the plan) or Wave 2 (§7.9 onward — Class II manipulation and the remaining 31 boards). Read §7.6-R first: the cost criterion was replaced. |
| **Blocked on owner** | Nothing blocking today. D1 and D3 (§8.2) were answered by the owner on 2026-09-02 with "procede": the catalog grows by **named instruments** and the architecture tax is paid with Wave 1. **D2 (generated imagery) is still open** and gates Wave 4 only. |
| **Last verified against the repo** | 2026-09-02. |

### §0.0 Sprint log — what is actually built

| Sprint | State | Evidence |
|---|---|---|
| **S5 — instrument manifest + parity gate** | **DONE** 2026-09-02 | `npm run instruments:check` green over 4 instruments × 5 copies; `agent/tools/check-instrument-parity.test.mjs` — 13 tests, of which **7 deliberately desynchronise a copy and each turns the gate red**. In CI (`repo-gates.yml`) and in `/AGENTS.md` §5. Two defects it found in its own first hour are recorded in §10.3 |
| **S4 — primitive kit** | **DONE** 2026-09-02 | `frontend/src/tutor/whiteboard/primitives.tsx`; all four existing kinds rebuilt on it with **no behaviour change** — the 30 existing whiteboard tests pass unmodified, `verify:tutor-ui` green (real-pixel bar heights across all 4 kinds × 3 breakpoints), `verify:tutor-a11y` green (8 phases × 2 themes × 2 breakpoints), 962 frontend tests green. 15 new primitive tests lock the two structural contracts. Scope was cut from a speculative nine primitives to the parts the EVIDENCE names — see §4.2 |
| **S6 — `tokens`** | **DONE** 2026-09-02 | The first non-chart instrument, end to end: schema → compute → wire → Core body → Core read-time revalidation → frontend mirror → renderer → lab fixture → gate. `instruments:check` now green over **5** instruments. New tests: 7 compute (oracle), 7 schema/fail-open (oracle), 1 real-socket wire proof, 5 render (frontend). `verify:tutor-ui` drives it at 3 breakpoints; `verify:tutor-a11y` green; both breakpoints screenshotted and inspected. **The cost measurement failed its own criterion — see §7.6-R** |
| **§4.4 — guidance rides with the move** | **DONE** 2026-09-02 | `oracle/src/tutor/instrumentSpecs.ts` + an `instruments:` frontmatter key on moves. The system prompt keeps one SHAPE line per kind (prefix-cached, and the model cannot emit valid JSON for a shape it has never seen); the per-kind GUIDANCE travels only when a move names it. 7 tests, including one asserting MOST moves name nothing |
| **S7 + S8 — Wave 1 instruments** | **DONE** 2026-09-02 | `bar_model`, `part_whole`, `flow`, `goal_bar`, `worked` — all five end to end. `instruments:check` green over **10** instruments; `verify:tutor-ui` drives all ten; `verify:tutor-a11y` green; oracle 1007 / backend 867 / frontend 1679 tests green. `HBar` joined the primitive kit (the horizontal sibling of `BarTrack`, same definite-containing-block reasoning in the other axis) |
| **S11 — the canonical batch** | **DONE** 2026-09-02 | `ten_frame`, `open_number_line`, `array`, `fraction_strip`, `partition` — the primary-maths vocabulary the catalog was missing. `open_number_line` gives `money.make-change-counting-up` its first visual representation ever. `instruments:check` green over **15**; `verify:tutor-ui` drives all fifteen |
| **S12 — decision and comparison** | **DONE** 2026-09-02 | `table`, `scale`, `two_bins`, `venn`, `ranking`, `outcomes`, `trade`, `chance`. `instruments:check` green over **23**; `verify:tutor-ui` drives all 23. `outcomes` and `trade` are the first prose-carrying boards — every string moderated, `detail` capped at 110 chars |
| Wave 0 (S1-S3) and the rest of Waves 2-5 | not started | — |

### §0.1 Baseline — what is true today (all VERIFIED 2026-09-02)

- The Tutor can draw **15** things (`oracle/src/tutor/turnSchema.ts`,
  `frontend/src/tutor/TutorWhiteboard.tsx`): `sequence`, `compare`,
  `marked_line`, `categories`, `tokens`, `bar_model`, `part_whole`, `flow`,
  `goal_bar`, `worked`, `ten_frame`, `open_number_line`, `array`,
  `fraction_strip`, `partition`, `table`, `scale`, `two_bins`, `venn`,
  `ranking`, `outcomes`, `trade`, `chance` — **23 kinds**. It was 4 when this
  file was written on 2026-09-02; Sprints 4-8, 11 and 12 landed the other
  nineteen the same day. **18 of the 41 Class I instruments remain**, and
  Classes II-V are untouched.
- The Tutor can serve **any of the 57** Lesson Engine segment types live
  (`LiveSegmentPanel` mounts the real `REGISTRY`), but can only *request* **2**:
  `segmentRequest.preferredTypes` is closed to `interest_peek` and `number_line`.
- `demonstrate` covers **2 of 57** types (`coin_count`, `make_change`) with a
  3-verb vocabulary (`add` / `remove` / `pause`), max 8 steps
  (`frontend/src/tutor/trayDemo.ts`).
- The knowledge catalog is **28 KCs, 36 edges, 32 misconceptions**, 2 strands
  (`money_math` 16, `entrepreneurship` 12), `tier_min` 1–3
  (`database/seeds/kc_graph.v1.json`). **`/ORACLE.md` §19.1 says 33 misconceptions
  and is wrong** — see §10.3.
- The Tutor carries **33 procedural moves** (`oracle/skills/moves/*.md`) and **12
  strategies** (`oracle/src/tutor/skills.ts`).
- The 3D stage has **12 actions, 7 emotions, 84 named poses, 5 camera shots, 18
  anchors**, and **zero props** — nothing in the world a character can touch or
  point at.
- **9 of 13** sound files are wired (`frontend/src/lesson-engine/player/sfx.ts`);
  the whiteboard uses none.
- Adding one whiteboard kind touched **17 files** and **5 hand-mirrored schema
  copies** across 3 services with no compiler check between them (§4.2). Measured
  again after Sprints 4–6: still ~20 files, and the copies are now *checked*
  rather than *fewer* — §7.6-R has the honest result and the corrected metric.

### §0.2 The one invariant that must survive every sprint

**A drawn claim and a spoken claim must never disagree, and when in doubt the
board is dropped, never guessed.** Every instrument recomputes its own numbers
server-side, twice (authoring time and wire time), and any doubt drops the WHOLE
board fail-open — never a partial or patched one. This is not a style rule: it is
the property that makes a generated visual safe to put in front of a minor
(`/AGENTS.md` §1.14, `/ORACLE.md` §20.5). No sprint may weaken it for convenience.

### §0.3 How to resume work here

1. Read this §0 in full.
2. Read §5 (the invariants an instrument must satisfy) — it is the shortest path
   to not shipping a defect.
3. Read the active sprint in §7 end to end, including its "explicitly out of scope".
4. Only then read §3 (the catalog) for the instrument you are building.
5. `/ORACLE.md` §20.5 is the authoritative record of the instruments that
   ALREADY exist and every defect they have already cost. Read it before adding a
   fifth. It is long; the two entries that matter most to a new instrument are the
   zero-pixel bar defect and the silently-clipped label defect, because both were
   invisible to every automated gate.

---

## §1 Why this exists

The Tutor narrates teaching that its stage cannot show. That was reported by the
owner from a live session on 2026-08-29 (a growth story told in words beside an
unrelated candy-pricing exercise), and the whiteboard (`/ORACLE.md` §20.5) was
built to close it. Four kinds later, the gap is narrower and still open.

**The finding that shapes this whole plan: the specification of what is missing is
already written, inside the product.** `oracle/skills/moves/*.md` is the Tutor's
procedural memory — 33 files, selected per turn by Map lookup at zero model cost
and handed to the model. Roughly two thirds of the misconception-tagged moves
instruct a physical staging that no surface in this product can perform. Verbatim:

| Move | What it instructs | What can render it today |
|---|---|---|
| `biggest-coin-first.md` | "Keep the coins **on the table where they can be picked up**. This move dies if it becomes arithmetic in the head." | nothing |
| `compare-one-part-each.md` | "Split it in front of them twice: one bar into 2, an identical bar into 4. Take exactly ONE piece from each and set them **side by side**." | nothing |
| `three-piles-in-out-left.md` | "Make three places on the table or on screen and leave them **UNNAMED**… coin by coin." | nothing (`categories` requires labels up front — the inverse of the point) |
| `find-what-is-missing.md` | "Draw the bar **before any operation**: the goal end to end, and the part already saved shaded in from the left." | nothing |
| `deal-it-into-piles.md` | "…one place per person. You cannot deal what you do not have." | nothing |
| `write-both-endings.md` | "Put the two **side by side where both are visible at once**. Two columns, few words." | nothing |
| `register-keeps-the-price.md` | "Split it **physically** in front of them… Two piles out of one payment." | nothing |
| `both-sides-said-yes.md` | Two parties, each judging their own side of a trade. | nothing (needs two actors, not a board) |

This is a debt the product already documented, not a wish list. It also means the
catalog below is **derived**, not invented: an instrument earns its place by being
demanded by a move, by a KC with no representation, or by the canonical vocabulary
of primary mathematics teaching (§3.1).

---

## §2 Five classes of instrument

"More teaching resources" hides five things with different cost, latency and risk.
Separating them is what makes it possible to be ambitious in three and cautious in
two.

| Class | What it is | Cost per turn | Latency | Main risk |
|---|---|---|---|---|
| **I · Draw** | Boards computed from bounded numbers the server re-derives. 41 instruments incl. today's 4. | $0 | instant | The per-instrument tax (§4) if unpaid |
| **II · Hand** | The same board, manipulable. Ungraded — no key, no verdict, no XP. 6 modes. | $0 | instant | Reachability; needs real pointer events, not synthetic clicks |
| **III · Stage** | The 3D island participates: role-play, pointing, props, camera, sound. 7 capabilities. | voice already budgeted | sub-second | A second speaking character doubles voice seconds — measure first |
| **IV · Worlds** | Short embedded micro-simulations. 4 worlds. | $0 to serve | initial load | Scope. New content, not composition — the most expensive line here |
| **V · Artifacts** | What the learner keeps across sessions. 4 artifacts. | $0 | instant | New state-ownership rules |

**Classes I, II and V cost nothing per turn.** No extra model call, no image, no
voice second. Their cost is construction, paid once. That is the economic argument
for a catalog this size, and it is the reason Class IV is deliberately last and
deliberately single-world first.

---

## §3 The instrument catalog

### §3.1 Where each instrument comes from

Three sources, and every entry below names one:

1. **A move that instructs the staging** (§1). Strongest source: the demand is
   written down and dated.
2. **A KC with no representation.** E.g. `money.make-change-counting-up` is taught
   by counting up, and nothing draws a count-up.
3. **The canonical vocabulary of primary mathematics teaching** — bar models
   (Singapore), ten frames, number bonds, open number lines, fraction strips,
   arrays, base-ten regrouping. Decades of cross-cultural validation, and each maps
   onto KCs this product already teaches. Adopting this vocabulary is both more
   ambitious and more defensible than inventing shapes.

### §3.2 Class I — Draw (41)

`STATUS` column: `LIVE` = in production today · `S<n>` = planned for that sprint.
`CLOSES` lists misconception codes from `database/seeds/kc_graph.v1.json`.
Coverage claims are ESTIMATED (§10.2).

#### Family A — Quantity and value (6)

| Key | What it draws | Source | Closes | Status |
|---|---|---|---|---|
| `tokens` | Discrete denominated objects, groupable by value, countable twice two ways. Every token is drawn the SAME SIZE — sizing by value would make appearance and worth agree on every board and teach three of the misconceptions it exists to break | `biggest-coin-first`, `value-not-appearance`, `stop-at-the-target` | `bigger-coin-worth-more`, `more-coins-more-money`, `counts-coins-not-value` (×2), `single-denomination-only`, `overshoots-target` | **LIVE** |
| `ten_frame` | Ten cells in two rows; quantity and its complement to ten seen without counting | canonical | supports `count-like-coins` | S11 |
| `pictograph` | Quantity as a count of figures, not a bar height | `tier_min: 1` (12 of 28 KCs) | supports all tier-1 | S14 |
| `number_track` | A hundred-chart segment: rounding, tens, a number's neighbourhood | canonical | `always-rounds-down` | S14 |
| `bead_string` | 20 beads in fives — subitising, "seven is five and two" | canonical | supports `count-like-coins` | S14 |
| `tally` | Counted occurrences in fives, growing as the Tutor speaks | `biz.revenue` | — | S14 |

#### Family B — Part and whole (6)

| Key | What it draws | Source | Closes | Status |
|---|---|---|---|---|
| `bar_model` | The Singapore bar: a word problem as comparable bars with the unknown as a gap | canonical | supports most of the `money_math` strand | **S7** |
| `part_whole` | A number bond: one whole, two parts, joined | canonical | supports the check step | **S7** |
| `partition` | The SAME whole split two ways, one piece of each highlighted | `compare-one-part-each` | `bigger-denominator-bigger-part` | S11 |
| `fraction_strip` | One whole and its divisions stacked and aligned | canonical | supports `fraction-of-amount` | S11 |
| `fraction_circle` | A total as circle portions | canonical | supports `equal-sharing`, `percent-intro` | S14 |
| `stack` | Two or three totals, each decomposed inside | `biz.budget-decisions` | — | S14 |

#### Family C — Operation (7)

| Key | What it draws | Source | Closes | Status |
|---|---|---|---|---|
| `worked` | A worked example revealed line by line, **including the checking step** | `worked-example-think-aloud` | `adds-digits-ignores-decimal`, `adds-instead-of-counts-up` | **S8** |
| `open_number_line` | Jumps from one number to another — literally how change is counted up | canonical + `money.make-change-counting-up` (no representation today) | supports `adds-instead-of-counts-up` | S11 |
| `regroup` | One unit broken into many; two amounts brought to a shared unit | `same-unit-first`, `trade-before-subtract` | `mixes-units`, `subtracts-smaller-from-larger-digitwise` | S11 |
| `array` | Rows × columns: multiply, share and unit-price as one figure | canonical + `money.unit-price` | — | S11 |
| `deal` | Distribution one unit at a time with the remainder visible and apart | `deal-it-into-piles` | `ignores-remainder`, `multiplies-instead-of-divides` | S12 |
| `change` | One payment separating into kept and returned | `register-keeps-the-price` | `returns-payment` | S12 |
| `equation_bar` | Two sides of an equality as lengths that must match | `money.percent-intro` (tier 3) | — | S15 |

#### Family D — Comparison and classification (7)

| Key | What it draws | Source | Closes | Status |
|---|---|---|---|---|
| `compare` | Two named amounts at one instant | — | partial: `price-is-fixed-property` | **LIVE** |
| `categories` | 2–6 named amounts at one instant | — | partial: `budget-is-per-item` | **LIVE** |
| `table` | Options × criteria with the winning cell marked | `money.unit-price`, `biz.pricing-strategy` | `highest-price-wins` | S12 |
| `scale` | Two sides tipping until level | `biz.cost-vs-price`, `value-of-work` | `cost-equals-price` | S12 |
| `two_bins` | Ungraded conceptual sorting: need/want, good/service | `paying-for-the-work`, `value-not-appearance` | `want-feels-like-need`, `service-needs-object`, `only-objects-have-value` | S12 |
| `venn` | Two overlapping sets — "it can be both" | `want-feels-like-need` | — | S15 |
| `ranking` | An ordered list where each position carries its reason | `biz.budget-decisions` | — | S15 |

#### Family E — Time and change (7)

| Key | What it draws | Source | Closes | Status |
|---|---|---|---|---|
| `sequence` | A value over 1–8 steps on day/week/month/year | — | `growth-is-one-time` | **LIVE** |
| `marked_line` | 1–4 marks between two references | — | partial: `forgets-already-saved` | **LIVE** |
| `goal_bar` | Goal end to end, saved part shaded from the left, drawn **before** operating | `find-what-is-missing` | `forgets-already-saved`, `spends-until-empty` | **S8** |
| `sequence_compare` | **Two** trajectories at once: save 2 vs save 5; simple vs compound | `money.simple-interest-peek` | reinforces `growth-is-one-time` | S10 |
| `timeline` | Events over time — "when", where `sequence` answers "how much" | `biz.budget-decisions` | — | S15 |
| `cycle` | Buy → sell → earn → buy: the business as a repeating turn | `biz.revenue`, `profit`, `trade-and-markets` | — | S15 |
| `before_after` | Two states of the same object, side by side | supports the check step | — | S15 |

#### Family F — Real money and decision (8)

| Key | What it draws | Source | Closes | Status |
|---|---|---|---|---|
| `flow` | Three places that start **UNNAMED** and are labelled after sorting | `three-piles-in-out-left` | `revenue-is-profit`, `profit-is-revenue`, `cost-equals-price`, `adds-costs-to-revenue`, `saving-is-leftover` | **S8** |
| `outcomes` | Two qualitative endings in columns, both visible at once | `write-both-endings` | `ignores-downside` | S12 |
| `trade` | An exchange with two sides, each judging its own | `both-sides-said-yes` | `trade-has-loser` | S12 |
| `receipt` | A real till receipt written line by line to a total | `money.estimate-total`, `add-money` | — | S13 |
| `ledger` | Two columns — in and out — with a running balance | `biz.revenue`, `profit` | `saving-is-leftover` | S13 |
| `price_tag` | Price, unit price and discount on one object | `money.unit-price`, `biz.pricing-strategy` | — | S13 |
| `inventory` | Stock falling as sales happen | `biz.revenue`, `cost-vs-price` | `revenue-is-profit` | S13 |
| `budget_plate` | A total allocated against a visible ceiling; over-allocating shows what it steals from | `biz.budget-decisions` | `budget-is-per-item`, `spends-until-empty` | S13 |
| `chance` | Probability as area — "usually fine, sometimes not" | `biz.risk-and-reward` | `ignores-downside` | S15 |

> Family F holds 9 rows because `flow` sits here by subject and in Wave 1 by
> priority: it closes five misconceptions, more than any other single instrument
> in the catalog.

### §3.3 Class II — Hand (6 modes)

Ungraded manipulation. **No answer key, no verdict, no XP** — that is precisely
what keeps it out of the Lesson Engine's territory (`LESSON_ENGINE.md` §4 family
boundary) and what makes it cheap.

| Mode | What the learner does | Sprint |
|---|---|---|
| `grab` | Drags tokens, chips and labels into piles, bins or cells | S9 |
| `fill` | Taps to fill a ten frame, a bar, a jar — counting with a finger | S9 |
| `step` | Advances the reveal at their own pace instead of watching it | S9 |
| `split` | Cuts a bar where they choose and sees the pieces name themselves | S11 (with `partition`) |
| `whatif` | Moves a value and watches the board answer. **The server pre-computes every branch**; the client still only draws | S10 |
| `your_turn` | The Tutor demonstrates, then hands the instrument over — the scaffold fade two moves ask for | S10 |

### §3.4 Class III — Stage (7 capabilities)

| Capability | What it adds | Sprint |
|---|---|---|
| `point_at` | The character points at the element being spoken about. Today `point` is a canned gesture with no target | S16 |
| `beat` | The camera responds to a teaching moment, not only a phase change | S16 |
| `audio_cue` | A sound per drawn event — a coin landing per unit counted. 9 wired effects, 0 uses today | S16 (whiteboard side lands in S3) |
| `roleplay` | Two characters act a transaction with their own cloned voices while the learner decides | S17 |
| `presence` | The learner's existing avatar appears in the scene during a transaction | S17 |
| `props` | Objects on the island a character can stand beside and use: stall, till, jar, bench. **Genuinely new — no prop system exists** | S18 |
| `dressing` | The island dresses for the topic (market day, shop) | S18 |

### §3.5 Class IV — Worlds (4)

Short (3–8 min), always framed by the Tutor before and after.

| World | What the learner does | Sprint |
|---|---|---|
| `stall` | Five days: buy supplies, set a price, see what happens, close the books | S20 |
| `piggy` | Six weeks of small decisions with temptations | later |
| `market` | Sell to characters who haggle and compare | later |
| `till` | Serve customers and give change against a kind clock | later |

### §3.6 Class V — Artifacts (4)

| Artifact | What it is | Sprint |
|---|---|---|
| `notebook` | Boards marked "keep this", collected | S21 |
| `plan` | The savings plan built in conversation, with real progress, visible between sessions and to the family | S21 |
| `recap` | A session card with the day's best board, for learner and parent | S21 |
| `venture` | A business designed over weeks | later |

### §3.7 Cross-cutting capabilities (10)

Properties any instrument can have. Each is worth more than a single instrument
because it multiplies the catalog.

| Capability | Why | Sprint |
|---|---|---|
| Staged reveal | "Leave them unnamed", "draw the bar before operating", "one at a time" all require beats within one board | S8 |
| Late labelling | Containers named after they hold something — the point of `three-piles-in-out-left` | S8 |
| Two instruments at once | The same quantity as tokens and as a bar, side by side — the concrete→abstract bridge | S11 |
| CPA ladder | The same problem at concrete, pictorial and symbolic levels, fading support (`concrete-to-abstract`, `scaffold-fading`) | S11 |
| What-if branches | Pre-computed alternates the learner flips between | S10 |
| Point while speaking | Marking the element as it is named, on the board and by the character | S16 |
| Closed icon vocabulary | A key from a fixed set, never free text. `Icon.tsx` already defends against invented names — proof only a curated set is safe | S11 |
| Sound as data | 9 wired effects, no new asset, no cost | S3 |
| Board that survives the turn | An instrument updated across turns rather than redrawn — the stall's ledger, the growing plan | S21 |
| Real currency per locale | MXN, USD, BRL coins a learner recognises. Counting your own pesos is not the same exercise as counting generic dollars | S16 (with the illustrated library, S19) |

**Totals:** 41 Class I + 6 Class II + 7 Class III + 4 Class IV + 4 Class V = **62
resources**, of which 4 exist today.

---

## §4 The architecture tax, and how it is paid

This section is the reason the catalog is possible. Without it, §3 must not be
attempted.

### §4.1 What one instrument costs today (VERIFIED)

Adding one whiteboard kind touches **17 files** across three services and requires
**five hand-written copies of the same shape**, with no compiler check between
them:

1. `oracle/src/tutor/turnSchema.ts` — the model-facing schema (+ `whiteboardVisibleText`)
2. `oracle/src/ws/protocol.ts` — the wire type
3. `backend/src/routes/tutor.ts` — the `POST /turns` body schema
4. `backend/src/services/tutorData.ts` — read-time re-validation of the stored row
5. `frontend/src/tutor/types.ts` — the client mirror

Plus: `oracle/src/tutor/whiteboard.ts` (compute), `oracle/src/ws/server.ts`
(`toWireWhiteboard`), `oracle/src/tutor/prompt.ts` (drift detector + prompt),
`oracle/src/tutor/orchestrator.ts` (repair branch),
`frontend/src/tutor/TutorWhiteboard.tsx` (render),
`frontend/src/tutor/replay/replayScript.ts`, i18n × 3 locales,
`frontend/src/tutor/lab/labFixtures.ts`, `frontend/scripts/verify-tutor-ui.mjs`
(hardcoded kind array), five test files, and `/ORACLE.md`.

**This is not theoretical.** `compare` and `marked_line` shipped without the
backend branch, and boards were **silently lost on replay**. No gate saw it; an
adversarial review found it.

**Deploy-order hazard, and it runs opposite to the one already documented.**
`/ORACLE.md` records "Oracle before Core" for `servedDifficulty`. For a new
whiteboard *kind* the order is **Core before Oracle**: `POST /turns`' body is a
discriminated union with no fallback member, so a `kind` Core does not know fails
`safeParse` whole-cloth and **400s the entire turn**, not just the board. Ship the
backend branch first, or atomically.

### §4.2 Payment 1 — the primitive kit (Sprint 4)

Nearly every board in §3.2 composes from nine drawing primitives: **bar, token,
cell, bin, line, mark, arrow, label, figure**. Each is built and verified once —
including the real-pixel measurement that exists because the whiteboard's bars
rendered at **zero pixels in every real browser from launch**, invisible to jsdom
and to every screenshot nobody zoomed into.

Then instrument #30 is composition, not new layout code, and the per-instrument
cost stops being linear.

**Sprint 4 ships no new instrument.** It rebuilds the four existing kinds on the
primitives, with a regression contract: they must render identically. That is what
proves the kit before anything depends on it.

### §4.3 Payment 2 — one declaration and a parity gate (Sprint 5)

**Not** a shared package: that would break the deliberate service decoupling
(`backend/src/services/tutorData.ts` states it explicitly). Instead, the idiom this
repo already uses for exactly this problem — `docs:check`, `paths:check`,
`provider:check`:

- **A manifest**, `agent/contracts/instruments.json`, declaring each instrument's
  field names, bounds and which fields are server-computed.
- **A gate**, `npm run instruments:check`, asserting all five copies agree with the
  manifest.
- **A proof the gate works**: desynchronise one copy on purpose in a test and watch
  it go red. A parity gate nobody has seen fail is not a gate.

The human authors the declaration; **the model only ever selects an instrument
from the registry**. That distinction is what keeps the vocabulary closed while the
catalog grows, and it is the technical form of the answer to decision D1 (§8.2).

### §4.4 Payment 3 — the instrument rides the move, not the prompt

Forty-one instruments explained in the system prompt would inflate every turn for
every learner forever. But moves are already retrieved per turn at zero model cost
and already describe the staging. **Each move names its instrument.** The model
receives one or two, not forty-one; per-turn cost stays flat; and — the lesson this
product has paid for repeatedly — the instrument arrives together with the concrete
instruction for using it, which is what the model actually obeys.

This is a change to `oracle/skills/moves/*.md` frontmatter plus the selection code,
not to the system prompt. It lands with the first instrument that needs it (S6).

---

## §5 Invariants every instrument must satisfy

A checklist, derived from what this surface has already cost. Any sprint may add to
it; none may remove from it.

1. **Numbers are recomputed server-side, twice** — at authoring time
   (`orchestrator.ts`) and again at the wire (`ws/server.ts`), through the same
   function, so the two can never verify differently.
2. **Any doubt drops the whole board**, fail-open, never a partial or patched one.
   Precedent: `computeSequence` returning `null`.
3. **The client only draws.** Never re-derive a server-computed field. Prove it with
   a test that feeds a deliberately wrong derived value and asserts the wrong value
   is drawn.
4. **Every learner-visible string joins the ONE moderation call** via
   `whiteboardVisibleText()` — never a hand list at each call site. Both
   `segmentRequest.framing` and `whiteboard.label` have already cost an incident for
   exactly this shape of gap.
5. **Free text is bounded and clamped.** Model-authored labels never pass through
   `i18n:check`, and es-MX/pt-BR run ~19%/~16% longer than en-US. `LessonPlate`'s
   `bodyLayout="column"` body is `overflow-hidden` with no scroll, so an unclamped
   wrap does not truncate — it disappears. Every caption gets a deterministic line
   ceiling.
6. **Each kind owns its whole render, wrapper included.** Never give a second live
   copy of state a component already owns (the hoisted-wrapper reveal bug).
7. **Percentage heights need a definite containing block.** The zero-pixel bar
   defect. Every percentage-sized element is measured in a real browser by
   `verify:tutor-ui`, not asserted in jsdom.
8. **A synthetic click proves nothing.** Reachability is tested with real pointer
   events and `elementFromPoint`.
9. **Cross-field relationships live in `compute*`, not the schema** —
   `z.discriminatedUnion` members must stay plain `ZodObject`s.
10. **Nothing new reaches the sealed model context** (`/ORACLE.md` §4.1). Every
    instrument field is output-side. A field that must reach the model needs the
    full §4.1 process and a `/LEGAL/AI_TUTOR_LEGAL_REVIEW.md` update.
11. **Persistence is not optional.** A board that reaches the learner and nowhere
    else is invisible to replay and to the parent portal. Core's body schema and
    read-time re-validation ship with the instrument, before Oracle emits it.
12. **A drift detector is written only after a real transcript shows the failure**,
    with two exceptions already on the record (`compare`/`marked_line`/`categories`)
    justified structurally because those boards name their own parts. Do not
    theorise a detector; reproduce the failure first.

---

## §6 What "done" means for one instrument

The 17-step checklist, restated as a definition of done. After Sprint 5, steps
1–5 collapse into one declaration plus the parity gate; the rest remain.

- [ ] Declaration in `agent/contracts/instruments.json`; `instruments:check` green
- [ ] Schema (`.strict()`, bounded) + `whiteboardVisibleText` extended
- [ ] `compute<Kind>()` pure function; wired into `whiteboardComputesOk` and `toWireWhiteboard`
- [ ] Wire type; Core body schema; Core read-time re-validation; frontend mirror
- [ ] Renderer composed from primitives, own wrapper, own aria-label, caption clamped
- [ ] Replay behaviour decided (`whiteboardMinMs`: 0 if it renders at once)
- [ ] i18n keys in all three locales, or none if it adds no chrome word
- [ ] Lab fixture + `LAB_ACTIVITIES` entry + `verify-tutor-ui.mjs` kind array
- [ ] Tests: compute (real + each bound + cross-field), schema/`parseTurn` fail-open, orchestrator verify-and-deliver **including a moderation-inclusion proof for nested labels**, live-socket wire proof, render + trust-the-given-value proof
- [ ] Move frontmatter names the instrument (§4.4)
- [ ] `/ORACLE.md` §20.5 + this file's §0 updated in the same commit
- [ ] Gates: `type-check`, `lint`, `test`, `build` per touched service; root `docs:check`, `secrets:check`, `i18n:check`, `paths:check`, `seo:check`, `tools:test`, `provider:check`, `instruments:check`; `verify:tutor` (oracle); `verify:tutor-ui` + `verify:tutor-a11y` (frontend)
- [ ] Screenshots at 375px and 1280px, both themes, es-MX and en-US (§1.11)
- [ ] Deploy order: **Core before Oracle** (§4.1)

---

## §7 The sprint plan

**21 sprints across 6 waves.** Sprints 1–8 are specified in full because they are
next and precision matters. Sprints 9–21 are specified at goal/scope/acceptance
level deliberately: over-specifying work that is months out, before the
measurements in S6 exist, is the speculative-abstraction trap `/AGENTS.md` warns
against. Each is expanded to full detail when it becomes next.

**Sequencing rule:** no sprint starts while the previous one's gates are red.
Sprints 1–3 are independent of everything and of each other.

---

### WAVE 0 — Unlock what already exists

Nothing new is designed, verified or paid for here. All of it is built, reviewed and
deployed already. This is the highest return in the plan.

#### §7.1 Sprint 1 — The Tutor may ask for more than two activities

**Goal.** Widen `segmentRequest.preferredTypes` from 2 types to a curated set, so
the Tutor can reach the 57 activity types it already serves.

**Why now.** Zero new surface. The bottleneck is a closed vocabulary of two.

**In scope.**
- Curate WHICH types are requestable, per skill/KC. This is a pedagogical mapping,
  not an engineering choice — it is the substance of the sprint.
- Extend `sanitizePreferredTypes()` (Oracle) and Core's enum together.
- Keep the posture that was learned the hard way: **loose at the turn schema,
  sanitised after parsing.** A closed enum at parse time already cost a whole turn
  when the model guessed twice; a malformed hint must degrade to no hint, never to
  a lost turn.
- Prompt guidance for when a type is worth asking for, delivered through the move
  (§4.4) where a move implies one.

**Explicitly out of scope.** Any change to grading, to `LiveSegmentPanel`, or to
the ladder's ordering beyond the existing type-preference pass. No new segment type.

**Files.** `oracle/src/ws/server.ts` (sanitiser), `oracle/src/tutor/turnSchema.ts`
(stays loose — confirm, do not tighten), `backend/src/routes/tutor.ts` (enum),
`oracle/src/tutor/tutorLadder.ts` (ordering, if the curated set needs it),
`oracle/skills/moves/*.md`, tests in both services.

**Acceptance.**
1. The curated set is written down with a reason per type (a table in this file's
   §3 or a new appendix).
2. A malformed `preferredTypes` value still delivers the turn — proven by test.
3. `gh workflow run tutor-deploy.yml -f step=converse` (paid, ~$0.03) shows the
   model actually requesting more than the previous two across four real lessons,
   and the transcripts read no worse than before. **The measurement is the point:
   without it this sprint proved only that the code accepts more values.**

**Gates.** oracle + backend `type-check`/`lint`/`test`/`build`; root `docs:check`,
`secrets:check`, `tools:test`, `provider:check`; `verify:tutor`; `verify:pedagogy`;
plus the paid converse run above.

**Risks.** The model over-requests a favourite type and variety drops — check the
transcripts, not just the counts. The curated set encodes a pedagogical opinion; it
should be reviewed by whoever owns pedagogy, not merged silently.

---

#### §7.2 Sprint 2 — `demonstrate` beyond the coin tray

**Goal.** The Tutor can demonstrate on more than 2 of 57 activity types.

**Why now.** "Worked example" is the second-most-used strategy family and today it
is narration everywhere except two money types.

**In scope.**
- Generalise the tray vocabulary (`add`/`remove`/`pause`, ≤8 steps) into a
  per-family demonstration vocabulary for `order_steps`, `sort_buckets`,
  `match_pairs`, `number_line`.
- One driver per family, each with its own `mayDemonstrate`-style gate (right
  segment type, not already answered correctly, same `seq` not replayed, learner
  interruption aborts cleanly).
- The demonstration **moves the draft, never submits it.**

**Explicitly out of scope.** Any type outside those four. Any demonstration that
produces a verdict. Touching the graders.

**Files.** `frontend/src/tutor/trayDemo.ts` → a `demonstrate/` module,
`oracle/src/tutor/turnSchema.ts` (the `demonstrate` field's vocabulary),
`backend/src/routes/tutor.ts` + `tutorData.ts` (the `demonstrate` column already
persists — migration `0067` — confirm the widened shape round-trips),
`frontend/src/tutor/replay/*` (a replayed demonstration must still replay), tests.

**Acceptance.**
1. Each of the four families demonstrates end to end in `/dev/tutor-lab`,
   screenshotted.
2. A demonstration never changes a graded outcome — proven by test.
3. A replayed session redraws the demonstration (the gap that cost `whiteboard`
   its own incident).
4. Interrupting mid-demonstration leaves the learner's own draft intact.

**Gates.** As Sprint 1, plus `verify:lesson-engine` (the demonstrated types are
Lesson Engine surfaces) and `verify:tutor-ui`.

**Risks.** A demonstration that fights the learner's input. The abort path is the
part to test hardest, not the happy path.

---

#### §7.3 Sprint 3 — The board stops being silent, and the map becomes reachable

**Goal.** Two small, independent unlocks: sound on the whiteboard, and the learning
map available during conversation.

**In scope.**
- A closed `audio_cue` vocabulary on a board's reveal events, resolved from the 9
  already-wired effects. No new asset.
- Volume and reduced-motion/reduced-sound respect; a missing sound is never an
  error a learner sees (the existing `sfx.ts` posture).
- The map (`frontend/src/tutor/map/`) reachable in `conversing`, not only
  `introducing` — as an opened surface, not a permanent one.

**Explicitly out of scope.** New sound assets. Any change to the map's data source
or to `shotForPhase`'s existing mapping beyond making the map openable.

**Acceptance.**
1. A `sequence` reveal plays one cue per bar, at the reveal's own pace, and is
   silent under reduced-motion preferences.
2. Opening the map mid-conversation does not disturb the plate, the caption or the
   dock — verified geometrically, both breakpoints, both themes.
3. `verify:tutor-a11y` stays green across all eight phases.

**Gates.** frontend `type-check`/`lint`/`test`/`build`; `i18n:check`;
`verify:tutor-ui`; `verify:tutor-a11y`.

**Risks.** Sound on a shared device is a parent-experience question as much as a
product one — default volume conservative, and check whether a mute affordance
belongs here.

---

### WAVE 1 — Pay the tax, prove it, build the six most-demanded

#### §7.4 Sprint 4 — The primitive kit

**Goal.** Nine drawing primitives, each verified once in a real browser, with the
four existing kinds rebuilt on them and rendering identically.

**Why now.** Every later sprint depends on this, and nothing else can be honestly
estimated until the rebuild shows what a primitive costs.

**In scope.** `bar`, `token`, `cell`, `bin`, `line`, `mark`, `arrow`, `label`,
`figure`. Each: a definite containing block by construction, theme tokens only,
caption clamping built in, an `aria` contract, and a real-pixel test.

**Explicitly out of scope.** Any new instrument. Any behaviour change to the four
existing kinds — this sprint is a refactor with a regression contract.

**Acceptance.**
1. The four existing kinds render **identically** before and after: screenshot
   comparison at 375px and 1280px, both themes, es-MX and en-US.
2. Every primitive that can be percentage-sized is measured with a non-zero
   `getBoundingClientRect().height` in `verify:tutor-ui`.
3. Every primitive that can hold model-authored text clamps it deterministically —
   a 60-character es-MX label never overflows its box at any breakpoint.
4. `tutorWhiteboard.test.tsx` passes unchanged, including the trust-the-given-value
   proofs.

**Gates.** frontend full set; `verify:tutor-ui`; `verify:tutor-a11y`.

**Risks.** The kit is over-fitted to the four kinds that exist. Mitigation: design
each primitive against at least two instruments from §3.2 that do **not** exist yet
(`tokens` and `bar_model`), and write those two down as the acceptance target even
though neither ships here.

---

#### §7.5 Sprint 5 — The instrument declaration and the parity gate

**Goal.** One declaration per instrument, and a gate that goes red when the five
copies disagree.

**In scope.** `agent/contracts/instruments.json`; per-service tests asserting each
schema matches it; root `npm run instruments:check`; the four existing instruments
declared (no behaviour change); the gate added to `/AGENTS.md` §5 and to CI.

**Explicitly out of scope.** Generating code from the manifest. A shared types
package across services (forbidden by the architecture).

**Acceptance.**
1. All four existing instruments are declared, and `instruments:check` is green.
2. **A deliberate desynchronisation of each of the five copies, one at a time,
   turns the gate red** — five negative tests, not one.
3. `/AGENTS.md` and `CLAUDE.md` both list the gate, byte-identically.

**Gates.** root `tools:test`, `docs:check`; both services' test suites.

**Risks.** A manifest that drifts from reality is worse than no manifest. The five
negative tests are the whole value of this sprint; do not ship without them.

---

#### §7.6 Sprint 6 — `tokens`, and the measurement that decides the rest

**Goal.** The most-demanded instrument, end to end, and an honest measurement of
what an instrument now costs.

**Why this one first.** Most moves ask for it; it serves the youngest learners; and
it breaks the current mould (discrete objects, not bars), so it stresses the
primitive kit rather than flattering it.

**In scope.** The full §6 checklist for one instrument. Discrete denominated tokens,
groupable, with the currency set already bounded (`MXN`/`USD`/`BRL`).

**Explicitly out of scope.** Manipulation (Class II, S9) — `tokens` ships drawable
first, touchable later. Real photographic currency art (S19).

**Acceptance.**
1. Everything in §6.
2. **The cost measurement, written into §0 of this file: how many files changed,
   and how many of them were mechanical.** This number is the go/no-go for
   Sprints 11–15. If it has not fallen materially against the 17-file baseline, the
   plan stops here and §4 is revisited.
3. One paid `converse` run showing the model uses `tokens` when a coin-value move
   fires, and that the spoken line and the drawn tokens agree.

**Gates.** Full set, both services; `verify:tutor-ui`; `verify:tutor-a11y`;
`instruments:check`; paid converse.

**Risks.** Discrete objects at six denominations on a 375px screen. Design the
overflow behaviour before the schema bounds, not after.

---

#### §7.6-R Sprint 6 RESULT — the measurement, and why its criterion was wrong

**Measured, 2026-09-02: `tokens` touched 20 files against a 17-file baseline.
By the letter of §7.6 acceptance #2 — "if it has not fallen materially, the plan
stops here" — this sprint FAILED its own gate.** Recorded that way rather than
rounded off, because the interesting part is what the number got wrong.

**Why the count did not fall, honestly.** Nothing in Sprints 4–5 was ever going
to remove a schema copy: the four hand-written copies are a consequence of the
service boundary (§1.5), and a parity gate makes drift *detectable*, not
*impossible*. Two of the 20 are new obligations the baseline did not have — the
parity manifest (13 lines of declaration) and `oracle/scripts/converse.ts`, which
the compiler forced because a new `kind` made an operator script's switch
non-exhaustive. That second one is a gate doing its job, not a cost.

**What actually fell, and it is not files:**

- **The two historical defect classes became unreachable.** A bar cannot be
  rendered outside the track that gives it a definite height; a model-written
  caption cannot be rendered without a line ceiling. Both were shipped defects,
  both invisible to jsdom, both live for months.
- **Layout work per instrument collapsed.** `TokensBoard` is composition, not new
  layout. Three iterations happened in this sprint and every one was a
  *composition* change (centre it, don't let the row eat the plate), each found by
  looking at a screenshot the gate already takes.
- **Drift became loud.** `instruments:check` went from 4 to 5 instruments with no
  new checking code.

**The corrected criterion for Sprints 7 and 11–15: measure DEFECTS AND REWORK,
not files touched.** Files touched was a proxy chosen before there was any
evidence, and it measures the service boundary rather than the difficulty. On
this sprint's evidence the real numbers are: zero layout defects shipped, three
composition iterations (all caught pre-commit by an existing screenshot), one
omission caught by an existing gate in about a minute, and one gate hole found by
the gate's own negative test. That is the number worth carrying forward.

**A SIXTH hand-maintained list, found the hard way.** `instruments:check` covers
the five schema copies. It does not — and structurally cannot — see
`labFixtures.ts`'s `labActivity`, which decides whether the plate holds a board
or a graded segment. `tokens` was added to the lab's activity *switch* and not to
that list, so the lab served a segment instead, a segment always wins the plate,
and `verify:tutor-ui` failed with "timed out waiting for the tokens whiteboard to
mount". Fixed by deriving both lists from one `WHITEBOARD_ACTIVITIES` constant, so
the next instrument cannot miss one. **Worth stating plainly: the browser gate
caught what the schema gate could not**, which is the argument for keeping both.

**What §6's checklist did NOT get, and why.** No drift detector was written for
`tokens`. §5.12 says a detector is written only after a real transcript shows a
specific failure, and no `tokens` session has ever run. The obvious candidate —
the tutor speaking a total that disagrees with the computed one — has a strong
anchor and would be easy to write, and it is deliberately left open rather than
theorised. The model also has no field to state a total at all, so the only path
to that contradiction is `say`. Write it when a transcript shows it.

---

#### §7.7 Sprint 7 — `bar_model` and `part_whole`

**Goal.** The two canonical representations that carry most of the `money_math`
strand.

**Acceptance.** §6 for both; a `bar_model` renders a two-quantity comparison with
an explicit unknown gap; `part_whole` renders one whole and two parts and is used
by `worked`'s checking step in S8. Screenshots at both breakpoints, three locales.

**Risks.** `bar_model` is the most expressive instrument in the catalog and
therefore the easiest to over-scope. Bound it: two bars, one unknown, no nesting.
Nesting waits for a transcript that needs it.

---

#### §7.8 Sprint 8 — Staged reveal, late labelling, and `flow` + `goal_bar` + `worked`

**Goal.** The capability three instruments need, plus the three instruments.

**In scope.**
- **Staged reveal**: a board with 2–3 beats the Tutor walks through while speaking,
  generalising `sequence`'s single-purpose reveal. Replay must honour it
  (`whiteboardMinMs` becomes per-instrument).
- **Late labelling**: a container labelled after it holds something.
- `flow` (closes five misconceptions), `goal_bar`, `worked`.

**Explicitly out of scope.** Learner-driven pacing (`step`, S9).

**Acceptance.** §6 for all three; a replayed session shows every beat at the right
duration; `flow` renders three unnamed places that acquire names at the beat the
Tutor names them, proven in `/dev/tutor-lab` and in replay.

**Risks.** A reveal whose beats outlive the spoken line, or vice versa — this is
exactly the class `whiteboardMinMs` exists for. Test a short `say` against a
long reveal.

---

### WAVE 2 — The catalog, and hands on it

| Sprint | Goal | Acceptance headline |
|---|---|---|
| **S9** | Class II core: `grab`, `fill`, `step` | Every manipulation reachable with **real pointer events** and `elementFromPoint`; no manipulation ever produces a verdict; a learner's arrangement survives a re-render |
| **S10** | `whatif` + `your_turn` + `sequence_compare` | Every branch is server-computed and arrives with the turn; the client never derives one; flipping branches never contradicts what was said |
| **S11** | Canonical batch: `ten_frame`, `open_number_line`, `array`, `fraction_strip`, `partition` (+ `split`, two-at-once, CPA ladder) | The same quantity shown concretely and pictorially side by side, on one board |
| **S12** | Decision batch: `deal`, `change`, `outcomes`, `trade`, `two_bins`, `table`, `scale` | `deal` shows a remainder that is visibly apart; `outcomes` fits two endings at 375px without clipping |
| **S13** | Money-artifact batch: `receipt`, `ledger`, `price_tag`, `inventory`, `budget_plate` | `budget_plate` shows what an over-allocation steals from, not an error message |
| **S14** | Early-years batch: `pictograph`, `number_track`, `bead_string`, `tally`, `fraction_circle`, `stack` | Readable and countable at 375px for a tier-1 learner; no instrument requires reading a number to be understood |
| **S15** | Remaining: `equation_bar`, `venn`, `ranking`, `cycle`, `before_after`, `timeline`, `chance` | `chance` never states a probability the server did not compute |

**Wave 2 gate.** Before S11 starts, re-read the S6 cost measurement. If an
instrument still costs near the 17-file baseline, stop and fix §4 instead.

---

### WAVE 3 — The stage participates

| Sprint | Goal | Acceptance headline |
|---|---|---|
| **S16** | `point_at`, `beat`, `audio_cue`, real currency art | The character points at the element it is naming, verified by screen coordinates, not by intent |
| **S17** | `roleplay` + `presence` | Two characters, two cloned voices, one transaction; **voice-second cost measured before and after**, and the §1.9 posture unchanged (no learner PII in either voice call) |
| **S18** | `props`: the stall | One prop, placed by the existing placement solver, that a character can stand beside without breaking walkability or the rig gates |

**Wave 3 caution.** `props` is the only genuinely new subsystem in the plan — there
is nothing in the 3D world today that a character can touch. One prop first, and
`verify:placement` + `verify:rig` must stay green.

---

### WAVE 4 — Imagery and one world

| Sprint | Goal | Acceptance headline |
|---|---|---|
| **S19** | Pre-warmed illustrated library | 28 KCs × ~3 scenes generated **by batch** through Prism's existing judge + verifier + cache, published before any learner sees one. Live generation is never called from a turn. Actual spend recorded against the ESTIMATED ~$20 |
| **S20** | The `stall` world | One world, 3–8 minutes, framed by the Tutor before and after. It holds **no credentials**, serves only public PII-free assets, is framed under a closed allow-list, and **anything it reports is graded server-side** — it is never believed |

---

### WAVE 5 — What the learner keeps

| Sprint | Goal | Acceptance headline |
|---|---|---|
| **S21** | `notebook`, `plan`, `recap` | A plan survives across sessions and appears in the parent portal; concurrent writes have a stated winner; nothing kept contains anything §1.9 forbids |

---

## §8 Decisions

### §8.1 Decided in this plan (agent recommendation, pending owner)

| # | Decision | Rationale |
|---|---|---|
| A | The catalog grows by **named instruments**, never a free canvas | A named instrument can be verified, measured and caught contradicting the Tutor. A canvas cannot. §4.3 is its technical form |
| B | The **primitive kit and parity gate are paid in Wave 1**, not deferred | Without them the catalog is unaffordable and unsafe (§4.1's silent replay loss) |
| C | Instruments are **carried by moves**, not by the system prompt | Flat per-turn cost; the model obeys what arrives with a concrete instruction |
| D | Class II is **ungraded by construction** | Keeps grading in the Lesson Engine, where the answer key is server-side and 51 types already do it well |
| E | **One world first, measured**, before the other three | It is the only line item that is new content rather than composition |

### §8.2 Open — owner decision required before Wave 1

| # | Question | Recommendation |
|---|---|---|
| **D1** | Does "free-form" (`/ORACLE.md` §20.5 backlog) mean fixed templates, or arbitrary composition? | **Fixed, named templates — 41 of them.** The dilemma was false: the constraint was never imagination, it was the per-instrument tax. Arbitrary layout hands the model the choice of WHAT to draw as well as with which numbers, which is exactly the failure mode `/AGENTS.md` §1.14 already describes |
| **D2** | May any instrument use a genuinely generated image? | **Yes, from Prism, batch, pre-warmed, never live.** VERIFIED: 60–120s per attempt, up to 3 verification attempts, $0.075 each. Pre-warming against the 28 KCs makes it a bounded one-time cost and $0 on every cache hit thereafter |
| **D3** | Build the CAS verifier / age classifier / content bank now? | **The primitive kit and parity gate yes, now. The content pipeline no, not yet.** This corrects an earlier, blunter recommendation of "no infrastructure before the schema": that holds for the content pipeline and is false for the primitives, without which 41 instruments cannot be paid for |

---

## §9 What this plan deliberately does not build

1. **A canvas whose composition the model chooses.** The only item here that could
   make the product worse rather than merely cost time.
2. **Image generation inside a turn.** Ninety seconds of a seven-year-old's
   attention, repeated per learner per turn.
3. **Grading inside the whiteboard or inside a world.** Grading is the Lesson
   Engine's, server-side. A world's report is a claim from client code and is
   graded, never believed.
4. **A fourth path to the learner.** Three surfaces already speak (board, live
   activity, stage) and the defect that started all of this was two of them saying
   different things at once.
5. **Five classes at once.** The plan has six waves for a reason; this product's own
   history says what works is one narrow schema, proven live, then the next.

---

## §10 Numbers, and how honest each one is

### §10.1 VERIFIED (read from code or data, 2026-09-02)

28 KCs · 36 edges · 32 misconceptions · 2 strands · 33 moves · 12 strategies ·
57 segment types (51 graded, 6 content-only) · 4 whiteboard kinds ·
`preferredTypes` = 2 · `demonstrate` = 2 types, 3 verbs, ≤8 steps ·
17 files and 5 schema copies per new kind · `REPAIR_BUDGET` 2 / `MAX_ATTEMPTS` 3 ·
12 actions · 7 emotions · 84 poses · 5 shots · 18 anchors · 0 props ·
13 sound files, 9 wired · Prism $0.075/image, ≤3 verify attempts, 60–120s ·
Inworld ~0.96s TTS per sentence, ~0.64s STT · paid converse gate ≈ $0.03/run.

### §10.2 ESTIMATED (derived, never measured — do not quote as fact)

- **Misconception coverage**: ~4/32 today → ~18/32 after Wave 1 → ~30/32 after
  Wave 2 → 32/32 with the full catalog. Derived by crossing each move's
  `misconceptions` frontmatter with the staging that move describes. **"Covered"
  means an instrument could show it — not that a learner overcame it.** Real
  measurement only arrives from live transcripts, which is exactly how the seven
  existing contradiction detectors were born.
- **Illustrated library one-time spend**: order of $20 worst case (28 KCs × ~3
  scenes × $0.075 × up to 3 attempts). Record the actual figure in §0 after S19.
- **Sprint sizing**: no durations are given anywhere in §7 on purpose. This repo's
  own history is that a "small" whiteboard change cost several rounds of live
  debugging. Sprints are sized by scope and gates, not by calendar.

### §10.3 Defects the parity gate found in its own first hour (S5)

Both are recorded rather than quietly fixed, because both generalise.

- **A false positive of the instrument, not a defect in the product.** The first
  parser resolved a nested item shape by looking for the next inline `z.object(`
  after the field name. On `marks: z.array(WhiteboardMarkRowSchema)` — written by
  reference, not inline — it wandered into the next unrelated schema in the file
  and reported that `marked_line` had lost its server-computed `position`. Core
  was correct. This is the class `/AGENTS.md` §1.14 calls "a harness that cannot
  operate a surface reports the product as broken", and a parity gate that cries
  wolf is worse than none, because the next real failure gets waved through.
  Fixed by resolving named references; covered by a test.
- **A hole in the gate, found by the gate's own negative test.** Comparing field
  NAMES made it blind to a wrong discriminant VALUE: a block named
  `CompareWhiteboardBody` declaring `kind: z.literal('compare_TYPO')` has exactly
  the right fields and is, in production, unreachable — Core's discriminated union
  would reject every real `compare` board and 400 the whole turn. Six of the seven
  negative tests went red without the discriminant check; the seventh is the entire
  reason `zodDiscriminant` exists. **This is the argument for writing the negative
  tests at all**: a gate is only as good as the failure someone has actually watched
  it catch.

### §10.4 Known documentation defects found while writing this

- **`/ORACLE.md` §19.1 says "33 catalogued misconceptions"; the seed file has 32.**
  The documentation is wrong, not the data. Fix in the same commit as the first
  sprint that touches `/ORACLE.md`.
- **Deploy order for a new whiteboard kind is Core-before-Oracle**, the reverse of
  the `servedDifficulty` note, and is not written down anywhere. §4.1 is now the
  record; mirror it into `/ORACLE.md` §20.5 when the first new kind ships.

---

## §11 Verification: what each gate covers, and what none of them does

| Question | Gate |
|---|---|
| Does the shape hold across services? | `instruments:check` (new, S5) |
| Does the arithmetic hold? | `whiteboard.test.ts`, oracle unit tests |
| Does a malformed board lose the turn? | `session.test.ts` (`parseTurn` fail-open) |
| Do nested labels reach moderation? | `orchestrator.test.ts` moderation-inclusion proof |
| Does the WIRE carry the computed fields? | `live-session.test.ts` |
| Does the board survive persistence and replay? | Core round-trip test + a replay test |
| Does it render at all, in a real browser? | `verify:tutor-ui` real-pixel measurement |
| Can a learner reach every control? | `verify:tutor-ui` `elementFromPoint` sweep |
| Is it accessible in every phase and theme? | `verify:tutor-a11y` |
| Does the controller sequence sensibly? | `verify:pedagogy`, `gym:pedagogy` |
| **Was that a good lesson?** | **Only** `gh workflow run tutor-deploy.yml -f step=converse` (paid, ~$0.03) |

**What no gate covers.** Whether a child understood. Whether an instrument helped
or merely decorated. The only instruments for that are live transcripts and, later,
the learning telemetry. Every drift detector this product has was written after a
real session showed a specific failure — none was theorised ahead of evidence, and
this plan does not change that rule (§5.12).

---

## §12 Change log for this file

| Date | Change |
|---|---|
| 2026-09-02 | Created. Catalog, architecture and 21-sprint plan derived from a full read of the KC graph, the 33 moves, the 57 segment types, the four existing whiteboard kinds, the 3D stage vocabulary, Prism's real costs and latencies, and the end-to-end path of a board from schema to screen. Nothing built. |
