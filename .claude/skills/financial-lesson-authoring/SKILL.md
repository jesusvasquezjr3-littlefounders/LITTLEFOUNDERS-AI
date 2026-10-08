---
name: financial-lesson-authoring
description: Author and review LittleFounders financial education lessons directly with a coding agent, using the existing v2 Lesson Engine. Use for curriculum sequencing, lesson writing, or pedagogical recovery; not for paid Forge generation or automatic publication.
---

# Financial lesson authoring

Read the repository README and binding product specification first. Follow `docs/content/COURSE-AUTHORING-WORKFLOW.md`; use `docs/content/FINANCIAL-EDUCATION-RECOVERY.md` for the failure evidence. The owner has rejected the previous catalog; its passing checks are not a quality reference.

## Design before writing

Choose one observable financial decision, its prerequisite skills, the misconception to expose and a fresh transfer task. Age changes the situation and language, not the assumption that the learner already knows finance. An adult starting from zero does not automatically know percentages, payroll deductions or investing. Never describe learners by presumed intelligence.

Use researched competency frameworks for coverage, then order by actual prerequisites and everyday usefulness. A competency checklist is not a teaching sequence. Distinguish an authored lesson, a technically verified lesson, a pedagogically reviewed lesson and a released lesson.

Write an ordinary-language storyboard before choosing engine types. Demonstrate the reasoning explicitly, let the learner finish a supported step, remove support, then test the same skill in a different situation. Make every required datum visible on the current board. Optional audio must not carry essential information. A worked example shows why each action is taken, not just the answer.

Use 3–5 minutes and 6–10 exercises as design targets, measured with a learner, not guarantees or padding quotas. Use a visual when its manipulation represents the financial relationship. Do not add four interaction types merely to meet a variety quota. Do not force a graded baseline before teaching a complete novice; check the current measurement specification before claiming pre/post learning gain.

## Authoring and verification

Author the JSON yourself. Do not call `v2:author`, model APIs, TTS or image services. Existing emitter and Core checks may be used as deterministic compilers/validators; this is not paid Forge authoring. Use `coursegen/src/v2/plan.ts` and the real Core schemas, not invented fields. Keep drafts outside the rejected canonical catalog until replacement is reviewed.

For every exercise, write the expected action and reason, then derive the key independently. Recompute arithmetic from the displayed inputs with code. A solvable exercise can still have the wrong key. Check every distractor against the full scenario; do not declare one moral preference universally correct. Vary correct-choice positions. Accept all answers that the stated constraints make valid.

Inspect what the actual scorer checks before writing feedback. `reasoning.decide-justify.v2` currently passes on choice alone: do not claim it verifies the reason. Minimum-saving boards cannot enforce an exact allocation. A displayed target or an earlier solved instance must not become the independent assessment. Transfers must change more than names; examples and transfer must still test the same skill.

Run scoped v2 emission with `--require-lesson-design`, followed by Core's strict contract and behavior checks. Keep all failures and review items. Passing these checks is engineering evidence only. Inspect the actual rendered lesson, with wrong and right answers, help, keyboard, small-screen fit and feedback before release. Never replace this with a generic fixture-only browser pass.

Review each market's amounts, notation and meaning; distinguish invented examples from current legal facts. Do not assume a salaried job, bank account, spare income or compulsory saving percentage. Local financial claims need authoritative dated sources. Preserve the controlled glossary and Copy Budget without deleting essential context.

## Stop conditions

Do not produce a large catalog by repeating a template with new numbers or names. Author the complete requested scope while separately recording actual-player and novice evidence; missing novice evidence must not be presented as successful acceptance. Technical checks, an agent review and user acceptance are separate. Publication, spending and deletion use the user's explicit authorization and the repository release/backup procedures; this skill adds none.

## Calibration before mass generation

The current 36 Financial Education lessons are calibration material, not the production course. Keep their blueprint marked `publication_intent: calibration-only`; live publication and attestation must reject it. Use owner review and actual-player findings to improve shared authoring instructions, validators and regression cases, rather than only polishing those 36 files. After calibration, design a separate broad introductory financial curriculum of hundreds of coherent lessons, with explicit boundaries for specialist courses. Generate in bounded batches with the same instructional, mathematical, localization and player checks, then recheck cross-batch prerequisites, retrieval and duplication. Do not equate passing the calibration corpus with completion of that production curriculum.
