---
name: brain-lift
description: >
  NASA Task Load Index (NASA-TLX) reference for measuring and estimating the
  cognitive load of a learning activity across six dimensions (mental, physical,
  temporal demand, performance, effort, frustration). Use when estimating or
  measuring how mentally demanding or frustrating a LittleFounders lesson
  activity is for a given age band, and for flagging overload/frustration.
source: https://github.com/nitrotap/brain-lift
license: "All rights reserved — © 2023 Kartik Jevaji (no OSS license file in repo). NASA-TLX itself is a public-domain instrument from NASA Ames Research Center. See source repo."
fetched: 2026-06-19
---

# Brain Lift — NASA-TLX for Cognitive Load

## (a) What it is

**Brain Lift** is an archived (read-only since 2024-03-10) cognitive-load tracking
app by Kartik Jevaji. Stack: Angular/Ionic frontend, PHP + MySQL backend. It lets
a user log a task and rate its mental workload using the **NASA Task Load Index
(NASA-TLX)**, then track that workload over time across different learning tasks.
The app's `measure` component presents the six TLX subscales and combines them into
a global workload score.

For LittleFounders we don't use the app itself — we use **the NASA-TLX instrument
it implements** as a structured rubric for estimating and measuring the cognitive
load of lesson activities.

## (b) NASA-TLX explained

NASA-TLX is a validated, multidimensional self-report scale of perceived mental
workload (Hart & Staveland, 1988; NASA Ames). It decomposes "how hard was this?"
into **six subscales**, each rated on a **0 (very low) to 100 (very high)** line
(20 increments of 5 in the classic paper form).

| # | Subscale | Question it answers | Direction |
|---|----------|---------------------|-----------|
| 1 | **Mental Demand** | How much thinking, deciding, remembering, calculating, searching was required? | Higher = harder |
| 2 | **Physical Demand** | How much physical activity (clicking, dragging, typing, manipulating)? | Higher = harder |
| 3 | **Temporal Demand** | How much time pressure / pace was felt? Rushed vs. relaxed. | Higher = harder |
| 4 | **Performance** | How successful was the person at the task? *(Reverse-keyed: "good/perfect" = 0, "poor/failure" = 100.)* | Higher = worse |
| 5 | **Effort** | How hard did they have to work (mentally + physically) to reach their level of performance? | Higher = harder |
| 6 | **Frustration** | How insecure, discouraged, irritated, stressed, or annoyed did they feel? | Higher = worse |

### How to score

**Raw TLX (RTLX) — simple, recommended for our use:**
- Collect the six 0–100 ratings.
- Average them: `RTLX = (sum of 6 subscales) / 6`.
- Result is a single 0–100 workload score. Widely used and correlates strongly
  with the weighted version, so it's the pragmatic default.

**Weighted TLX — the full original procedure:**
1. **Pairwise comparisons.** Present all **15 pairs** of the 6 subscales
   (6 choose 2). For each pair, the rater picks which dimension contributed *more*
   to the workload of that task.
2. **Weights.** Count how many times each subscale was chosen → a weight of **0–5**
   for each. The 6 weights sum to 15.
3. **Weighted score.**
   `Weighted TLX = Σ (subscale_rating × subscale_weight) / 15`.
   Still on a 0–100 scale, but dimensions the rater deemed most important count more.

Both versions produce one global 0–100 number; individual subscales should also be
inspected (e.g., a moderate overall score can still hide a spiked Frustration).

## (c) How Brain Lift applies it

- The `measure` page exposes the six subscales as 0–100 inputs and stores each
  task's ratings in MySQL via the PHP backend.
- Subscales can be **used separately or combined into a global workload score** for
  "a comprehensive view of overall workload."
- Stated purpose: help users/designers **identify tasks that are too demanding** or
  aspects of a task that could be **redesigned to reduce workload**, and track this
  over time. (Supporting `education` / `strategies` pages frame load-reduction tips.)

## (d) How to apply to LittleFounders

**Goal:** estimate (at authoring time) and measure (from playtests) the cognitive
load of a lesson activity for ages **5–18**, and flag overload or frustration before
shipping.

### Estimating during lesson generation (no children needed)
For each activity, the agent self-rates the 6 subscales **0–100 from the perspective
of the target age band**, then computes RTLX:

- **Mental Demand** — count of distinct concepts, steps to hold in working memory,
  reading level, arithmetic load. (Working memory is small for ages 5–8; keep this low.)
- **Physical Demand** — drag-drop precision, typing, rapid clicking; high for young
  motor skills.
- **Temporal Demand** — timers, countdowns, fast pacing. A timed mini-game raises
  this sharply for younger learners.
- **Performance** — likelihood the child can succeed unaided (reverse: estimate
  failure risk).
- **Effort** — total work to reach success given the band's skills.
- **Frustration** — ambiguity, harsh fail states, repeated retries, unclear goals.

Compute `RTLX = mean of the six`. Treat it as a **per-age-band budget**.

### Suggested thresholds (per activity, RTLX 0–100)

| Age band | Target RTLX | Flag for review | Hard stop |
|----------|-------------|-----------------|-----------|
| 5–8      | ≤ 35        | 35–50           | > 50      |
| 9–12     | ≤ 45        | 45–60           | > 60      |
| 13–18    | ≤ 60        | 60–75           | > 75      |

### Flagging rules (subscale-level — don't rely on the average alone)
- **Frustration ≥ 50** at any age → flag, regardless of overall score (a child who
  feels stupid disengages even when the task is "easy").
- **Temporal Demand high + Mental Demand high together** → overload; remove the timer
  or cut concepts.
- **Performance high (= high predicted failure)** → scaffold: add hints, examples,
  or split into smaller steps.
- A spike in any single subscale > 75 → redesign that dimension specifically.

### Measuring from real playtests
After a child completes an activity, collect a **kid-friendly RTLX**: replace the
six abstract scales with simple faces/emoji 1–5 sliders mapped to 0–100
("How much thinking?", "How rushed?", "How well did you do?", "How hard did you try?",
"How annoyed did you feel?"; drop or simplify Physical Demand for very young users).
Average to RTLX, apply the same thresholds, and compare against the authoring-time
estimate to calibrate future generation. Skip the 15-pair weighting step with
children — RTLX is sufficient and far less burdensome.
