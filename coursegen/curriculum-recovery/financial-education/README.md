# Financial Education recovery

## Calibration corpus — not the production course

`blueprint.json`, `course-plans/` and `authoring/` contain a 36-lesson **calibration corpus**: 27 draft skills, eight units, 216 distinct graded exercises and three locales. The owner clarified that these lessons exist to improve Forge and the shared Codex/Claude authoring system before mass generation. They are not the Financial Education course to publish. The intended production course requires hundreds of coherent introductory lessons covering the financial domain, with boundaries for separate specialist courses.

The blueprint declares `publication_intent: calibration-only`. Live publication and release attestation reject calibration-only and unclassified blueprints; offline compilation, local review and dry-run publication remain available. Passing this corpus is evidence about the calibration set, not completion of the mass-generation objective. Use the [shared authoring workflow](../../../docs/content/COURSE-AUTHORING-WORKFLOW.md) for commands. Nothing in this directory has been published.

The original three lessons under `plans/` and their checks below remain as historical pilot evidence. They are not the current full-course source.

## Historical pilot

These are three directly agent-authored adult-beginner lessons, six exercises each, in en-US, es-MX and pt-BR. They are a **draft opening sequence**, not a complete catalog or a released replacement. They deliberately live outside the rejected `curriculum-v2` directory.

1. Money entering and leaving: follow the person receiving or making a payment.
2. Received versus promised: distinguish money available today from expected income.
3. Protect committed money: compare a new purchase with the remainder after an upcoming expense.

The [recovery analysis](../../../docs/content/FINANCIAL-EDUCATION-RECOVERY.md) is at repository path `docs/content/FINANCIAL-EDUCATION-RECOVERY.md`. It contains the research, proposed full sequence, engine findings and release limits. The authoring skill is mirrored at `.github/skills/financial-lesson-authoring/SKILL.md` and `.claude/skills/financial-lesson-authoring/SKILL.md`.

From the repository root, compile and verify without generation or network calls:

```sh
npm --prefix coursegen run v2:emit -- --plans curriculum-recovery/financial-education/plans --out runs/recovery-2026-10-05 --run-id recovery-2026-10-05 --require-lesson-design
npm --prefix backend run forge-v2:check -- ../coursegen/runs/recovery-2026-10-05/documents.json
node coursegen/curriculum-recovery/financial-education/verify-arithmetic.mjs
```

The initial technical checks pass: nine localized documents, 54 graded localized exercises and 135 scored states. The arithmetic check derives chart keys from the visible quantities and verifies the stated purchase examples. It does not claim to prove the truth of arbitrary prose.

Actual-player diagnostics retain 18 full light-theme journeys and two additional es-MX dark-theme journeys. They found and corrected invisible chart choices and one English first-view overflow. Final baseline measurements have no text-fit, proportion or copy-budget findings; chart answer contrast exceeds 4.5:1. These local-adapter checks are not authenticated completion or learner acceptance. Full evidence and limits are recorded in `docs/rebuild/sprints/S05-FINANCIAL-EDUCATION-RECOVERY.md`.

Four emitter review findings remain open: market-neutral review for lessons 1 and 2; the fictional due-today scenario in lesson 2 needs its urgency wording reviewed; market adaptation for lesson 3. No previous course's signatures or acknowledgements apply. No forced graded pretest is used, and no pre/post gain is claimed.

Before release: validate the sequence with actual beginners; review the three markets; check the real authenticated grading/completion route and the complete mandatory release gates; map each objective to the shared KC graph without declaring an entire broad KC mastered from a narrow exercise; add the remaining course-level coverage, including the required Mentor misjudgment/recovery episode. Do not publish these three lessons as a complete course.
