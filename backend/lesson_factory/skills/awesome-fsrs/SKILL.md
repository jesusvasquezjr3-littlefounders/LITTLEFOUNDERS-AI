---
name: awesome-fsrs
description: >-
  FSRS (Free Spaced Repetition Scheduler) — the DSR memory model (Difficulty,
  Stability, Retrievability), its core math, the Again/Hard/Good/Easy rating
  scale, and how to schedule the next review of a lesson/concept just before the
  learner is predicted to forget it. Use when designing review scheduling,
  spaced repetition, or memory-retention features for the guided-learning
  platform.
source: https://github.com/open-spaced-repetition/awesome-fsrs
license: CC0 1.0 Universal (public domain dedication)
fetched: 2026-06-19
---

# FSRS — Free Spaced Repetition Scheduler

## (a) What FSRS is + the DSR memory model

FSRS is a modern spaced-repetition scheduling algorithm (the default in Anki,
used by dozens of learning apps). It models a learner's memory of a single item
and predicts the exact moment recall probability drops to a target threshold,
so a review can be scheduled *just before forgetting*. It learns its parameters
from review-history data (Bayesian / maximum-likelihood fitting on logs), but
the scheduling math below works with sensible default parameters out of the box.

It represents the memory of each item with three variables — the **DSR model**:

- **R — Retrievability**: the probability the learner can recall the item *right
  now*, given how long it's been since the last review. Decays over time. Range
  (0, 1]. This is what you schedule against (e.g. "review when R falls to 0.9").
- **S — Stability**: memory strength, expressed as the number of **days** it
  takes for retrievability to decay from 100% down to 90%. Higher S = the memory
  lasts longer = longer intervals between reviews. Grows with each successful
  review.
- **D — Difficulty**: how intrinsically hard the item is for this learner. Range
  **[1, 10]**. Higher D = stability grows more slowly. Adjusted up on lapses,
  down on easy recalls.

Key intuition: **R is a function of elapsed time and S**; each review updates
**S and D**; the next interval is chosen so that R will equal your desired
retention when the item next comes due.

## (b) Core formulas (FSRS-4.5 / v6 — implementable)

Constants: `DECAY = -0.5`, `FACTOR = 19/81 ≈ 0.2346`.

### Retrievability (forgetting curve)
Given `t` = days since last review and stability `S`:

```
R(t, S) = (1 + FACTOR * (t / S)) ^ DECAY
        = (1 + (19/81) * (t / S)) ^ (-0.5)
```

(Older FSRS-3 used the simpler `R = 0.9 ^ (t/S)`; v4.5+ uses the power curve
above, which fits real data better.)

### Optimal interval for a target retention `r`
Solve R(t, S) = r for t. The next interval in days:

```
I(r, S) = (S / FACTOR) * (r ^ (1/DECAY) - 1)
        = (S / FACTOR) * (r ^ (-2) - 1)
```

For the common default `r = 0.90`, `I ≈ S` (by definition of S). Lower the target
retention → longer intervals (fewer, harder reviews); raise it → shorter
intervals (more reviews, higher retention). Clamp to `>= 1` day and round.

### Initial state (first review of a new item)
Grade `G ∈ {1,2,3,4}` = Again/Hard/Good/Easy.

```
S0(G) = w[G-1]            # one of the first four learned params
D0(G) = w4 - exp(w5 * (G-1)) + 1   # FSRS-6 form; clamp to [1, 10]
```

### Difficulty update after a review
```
ΔD   = -w6 * (G - 3)                       # G=3 (Good) → no change
D'   = D + ΔD * (10 - D) / 9               # "linear damping" toward bounds
D''  = w7 * D0(4) + (1 - w7) * D'          # mean reversion toward easy-init
clamp D'' to [1, 10]
```

### Stability after a SUCCESSFUL review (G ≥ 2), given current R
```
S' = S * (1 + exp(w8)
            * (11 - D)
            * S ^ (-w9)
            * (exp(w10 * (1 - R)) - 1)
            * hard_penalty           # = w15 if G==2 (Hard) else 1
            * easy_bonus)            # = w16 if G==4 (Easy) else 1
```
Lower R at review time → bigger stability gain (the "spacing effect": reviewing
when you *almost* forgot strengthens memory more).

### Stability after a LAPSE (G == 1, forgot)
```
S_f = w11 * D ^ (-w12) * ((S + 1) ^ w13 - 1) * exp(w14 * (1 - R))
```
(In FSRS-6, capped so it does not exceed the prior stability.)

### Default FSRS-6 parameters (21 weights, w0..w20)
```
[0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001,
 1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014,
 1.8729, 0.5425, 0.0912, 0.0658, 0.1542]
```
- w0–w3: initial stability per grade (Again/Hard/Good/Easy)
- w4–w6: difficulty parameters
- w7: difficulty mean-reversion weight
- w8–w10: successful-recall stability growth
- w11–w14: post-lapse stability
- w15–w16: Hard penalty / Easy bonus multipliers
- w17–w19: same-day review dynamics
- w20: decay exponent (advanced; defaults to the 0.5 family above)

Optimize these per-user later by fitting to review logs; ship with defaults now.

## (c) The rating scale and how grades drive scheduling

After each review the learner (or your auto-grader) assigns one grade:

| Grade | Name  | Meaning                         | Effect |
|-------|-------|---------------------------------|--------|
| 1     | Again | Forgot / wrong                  | Lapse: stability collapses (S_f), difficulty ↑, item re-enters short-term/relearning, short next interval |
| 2     | Hard  | Recalled but with struggle      | Success but stability grows less (hard_penalty w15), difficulty ↑ slightly |
| 3     | Good  | Recalled correctly (baseline)   | Normal stability growth, difficulty unchanged |
| 4     | Easy  | Recalled effortlessly           | Largest stability growth (easy_bonus w16), difficulty ↓ |

Flow per review: compute current `R` from elapsed time → update `D` → update `S`
(success or lapse branch) → compute next interval `I(r, S')` for your target
retention → set due date = now + I days.

## (d) Key links (curated)

- **Algorithm spec / math wiki:** https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm
- **"Implementing FSRS in 100 lines" (best concise tutorial):** https://borretti.me/article/implementing-fsrs-in-100-lines
- **Reference implementations:**
  - Python (scheduler + optimizer, v6): https://github.com/open-spaced-repetition/py-fsrs
  - TypeScript (scheduler, v6): https://github.com/open-spaced-repetition/ts-fsrs
  - Rust (scheduler + optimizer, v6): https://github.com/open-spaced-repetition/fsrs-rs
- **Optimizer (parameter fitting from logs):** https://github.com/open-spaced-repetition/fsrs-optimizer
- **Benchmark across SRS algorithms:** https://github.com/open-spaced-repetition/srs-benchmark
- **Open review-log datasets:** https://huggingface.co/datasets/open-spaced-repetition/anki-revlogs-10k

For our stack: **py-fsrs** in the FastAPI backend, **ts-fsrs** if scheduling
needs to run client-side. Both implement the math above; don't reimplement.

## (e) How to apply to LittleFounders (review scheduling for lessons/concepts)

Goal: after a child/teen learns a financial-literacy concept, bring it back for
review at the optimal moment — long enough to be a real challenge, soon enough
that they don't fully forget it.

1. **Unit of scheduling = a concept, not a whole lesson.** Track DSR state
   (`difficulty`, `stability`, `last_reviewed_at`, `due_at`, `reps`, `lapses`)
   per learner × concept. Store on Supabase (e.g. a `concept_reviews` table,
   one row per learner-concept). A lesson can review several due concepts in
   one session.

2. **Grade from gameplay, not self-report.** Children won't reliably press
   Again/Hard/Good/Easy. Derive the grade from in-game performance: wrong →
   **Again (1)**; correct but slow / after a hint → **Hard (2)**; correct →
   **Good (3)**; correct, fast, first try → **Easy (4)**. Map our games'
   existing success/time/hint signals to this 4-point scale.

3. **Use age-tuned target retention, not a flat 0.9.** Younger learners (5–8)
   benefit from higher retention / shorter intervals (e.g. `r = 0.92–0.95`) so
   concepts stay fresh and confidence stays high; older teens can tolerate
   longer gaps (`r = 0.85–0.90`) for efficiency. Compute the interval with the
   `I(r, S)` formula above.

4. **Run scheduling in the backend with py-fsrs.** On each completed activity,
   POST the (concept_id, grade, elapsed_days) → service updates D/S → returns
   the next `due_at`. Keep it a thin route → one service (per CLAUDE.md §3).

5. **Surface "due reviews" as a Founder's Quest.** Daily/weekly the platform
   pulls concepts where `due_at <= now`, ordered by lowest current R (most at
   risk of being forgotten), and assembles a short mixed review session styled
   in the Playful sub-standard — making the math invisible to the child.

6. **Start with defaults, optimize later.** Ship the default FSRS-6 weights.
   Once enough review logs accumulate, run fsrs-optimizer (globally first, then
   optionally per-cohort/per-learner) to fit parameters to *our* learners.
