---
name: instructional-design-toolkit
description: A Bloom's-taxonomy-driven course/lesson design toolkit (SAM + Ship-First + Kirkpatrick) for building exercises that escalate cognitive complexity from recognition to creation. Used as reference context by the LittleFounders lesson-generator agent.
source: https://github.com/DojoCodingLabs/instructional-design-toolkit
license: BSL-1.1 (Business Source License 1.1) — see source repo
fetched: 2026-06-19
---

# Instructional Design Toolkit (IDT)

## (a) What it is

A guided instructional-design toolkit (originally a Claude plugin) for producing
structured courses and 1-on-1 session plans. Its pedagogical spine is a **practical,
"builder's" application of Bloom's Taxonomy**: it forces material to climb from simple
memorization toward application, analysis, and creation, so learners *do* rather than
just *recall*. It combines four learning-science frameworks:

- **SAM (Successive Approximation Model)** — favored over ADDIE. Rapid iteration via
  small pilot cohorts (3–10 learners) instead of exhaustive upfront design. (Allen, 2012)
- **Builder's Bloom's Taxonomy** — cognitive-complexity ladder adapted for hands-on work.
- **Ship-First Design** — design backward from the final deliverable (capstone) →
  assessments → content.
- **Kirkpatrick L1–L4** — evaluate Reaction, Learning, Behavior, Results.

It also encodes a behavioral-retention rule from *Atomic Habits*: every lesson should
run a **cue → craving → response → reward** cycle. Courses that omit the **reward**
milestone typically see 60–80% abandonment between lessons 2–3.

## (b) The toolkit workflow & lesson template (captured faithfully)

### Ship-First authoring order
1. Define the **capstone deliverable** (real, shareable, deployable artifact).
2. Define **assessments** that prove the learner can produce it.
3. Only then write **content** that builds toward those assessments.

### Lesson structure: CONTEXT → CONCEPT → BUILD → SHIP → REFLECT

| Phase   | Share of lesson | Role |
|---------|-----------------|------|
| CONTEXT | 5–10%  | Emotional hook that creates urgency / "why this matters now" |
| CONCEPT | 15–25% | Direct instruction of the mental model (teach it explicitly) |
| BUILD   | 50–60% | Hands-on practice applying the concept (the bulk of the lesson) |
| SHIP    | 10–15% | Produce a tangible, shareable deliverable |
| REFLECT | 5–10%  | Lesson-specific reflection questions |

**Critical principle:** Concepts must be taught directly in CONCEPT. BUILD *applies*
that knowledge — never outsource the actual teaching/explanation to the AI or to
"figure it out yourself." Practice is most of the lesson, but it sits on top of real
instruction.

### Cognitive ramping (course-level)
Climb Bloom's levels progressively across a course:
- Early modules → Recognition / Explanation
- Core modules → Building (application)
- Advanced modules → Debugging / Evaluation
- Capstones → Deciding / Shipping (creation)

### Atomic Habits retention loop (per lesson)
**cue → craving → response → reward.** Always include an explicit reward/win at the end
of a lesson or module; missing rewards are the top driver of early drop-off.

### Kirkpatrick evaluation (L1–L4)
- **L1 Reaction** — Did the learner like it? (satisfaction; short form at module end)
- **L2 Learning** — Knowledge gained (quiz score distribution, pass rates)
- **L3 Behavior** — Real-world application ~30 days later (follow-up survey)
- **L4 Results** — Tangible outcomes (shipped artifact, measurable behavior change)

Measuring only L1 = satisfaction; L1+L2 = retention; strong programs iterate against
L3/L4. Recommended L1 fields: 1–5 usefulness rating, "key takeaway" text, "where were
you confused?" text, hidden module-ID + learner-ID fields.

### Common pitfalls to avoid
1. Too much lecture, too little practice.
2. Trivial exercises that don't reinforce the concept.
3. Teaching surface syntax/facts instead of the underlying mental model.
4. Outsourcing explanation instead of teaching directly.
5. Designing for stakeholder assumptions rather than learner needs.
6. Weak capstones (vague vs. real, deployable artifacts).
7. Unclear shipping milestones.
8. Modules with no concrete reward → low retention.

## (c) Bloom's cognitive-complexity ladder → exercise difficulty

IDT's "Builder's Bloom's" maps the classic six revised-Bloom levels onto a hands-on
verb ladder. Use this to set exercise difficulty deliberately.

| Classic Bloom level | Builder's verb | What the learner does | Example exercise type |
|---------------------|----------------|------------------------|------------------------|
| 1. Remember (memorize) | **Recognize** | Recall / identify a fact | Match, label, flashcard, multiple-choice ID |
| 2. Understand | **Explain** | Restate a concept in own terms | "Why does X happen?", sorting, true/false-with-reason |
| 3. Apply | **Build** | Use the concept in a new case | Worked problem, fill-in-the-blank simulation, do-the-thing |
| 4. Analyze | **Debug** | Find the flaw / compare cases | Spot-the-error, compare two options, fix-the-budget |
| 5. Evaluate | **Decide** | Judge & justify a choice | Trade-off decision, "which is better and why", scenario choice |
| 6. Create | **Ship** | Produce an original artifact | Plan / build / present a real deliverable (capstone) |

**Difficulty maps to depth, not volume:** harder ≠ more questions; harder = a higher
rung. A good lesson/exercise sequence steps *up* the ladder rather than repeating the
same rung. Each learning objective should name a single Bloom verb (avoid vague verbs
like "understand/know" as the *assessed* action — make it observable: recognize,
explain, build, debug, decide, ship).

## (d) How to apply to LittleFounders lesson generation (ages 5-18)

**1. Pick the top Bloom rung by age band, then ramp within the lesson.**
- **Ages 5–7:** mostly **Recognize** + light **Explain**. Picture-matching coins,
  "wants vs. needs" sorting, tap-the-right-answer. Concrete, visual, one concept.
- **Ages 8–11:** **Explain** + **Build**. Calculate change, build a tiny budget,
  simple saving-goal math. Introduce one "Debug" (spot-the-overspend) per lesson.
- **Ages 12–14:** **Build** + **Debug**. Compare two purchase options, fix a broken
  budget, identify a scam. Add a "Decide" trade-off.
- **Ages 15–18:** **Decide** + **Ship**. Design a savings/business plan, justify a
  financial decision, produce a shareable artifact (a budget, a pitch, a plan).

**2. Structure every generated lesson as CONTEXT → CONCEPT → BUILD → SHIP → REFLECT.**
Keep BUILD at ~50–60% of activities. Always teach the concept explicitly in CONCEPT —
do not generate lessons that say "ask the helper" instead of explaining. Honor the
existing exercise/activity schema, but assign each activity a Bloom rung and order them
ascending.

**3. Always include a reward (Atomic Habits cue→reward).**
Every lesson and module must end with a concrete win — a badge, unlocked game, coins,
celebration screen, or "you shipped X!" moment. This directly fights the 60–80%
lesson-2-to-3 drop-off. Map: CONTEXT = cue, CONCEPT/BUILD = craving+response, SHIP/REFLECT = reward.

**4. Ship-First per lesson.** Decide the small tangible output first (a labeled coin
chart, a filled budget, a saving plan), then write the activities that build to it, then
the explanation. For older bands the SHIP artifact should be genuinely shareable.

**5. Set difficulty by Bloom depth, not by adding questions.** To make a lesson harder,
move an activity up a rung (Build → Debug → Decide), don't just add more items. Within
es/en, keep the Bloom verb identical across languages so difficulty is parallel.

**6. Bake in measurable objectives + a light feedback hook.** Phrase each lesson's
objective with one observable Bloom verb. Where the platform supports it, add a tiny
L1-style reflection question (REFLECT phase: "what was your biggest takeaway?", "where
did you get stuck?") so content can later be iterated against learner data.
