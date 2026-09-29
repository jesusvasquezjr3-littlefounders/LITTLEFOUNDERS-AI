# Gap-fix round 6, learning lane (fix6learni2)

Branch `codex/spec-fix6learni2`. Status: **implemented and locally verified; not accepted.** The human Stage 3 reviews themselves are out of scope; this lane builds the record and the release gate they need.

## Gap closed

**Appendix C Part 3 Stage 3 had no record and gated no release.** The gap was real. Every release path checked only Forge's automated Stage 2 attestation: `release_course` and `release_lesson` through `forge_release_verification_refusal`, and `release_lesson_version` through the course verification. No table, route or screen stored a Stage 3 review, and the Stage 3 flags Forge raises (gates 12, 14, 16, 17, 18 and 19) reached no recorded decision.

SPEC clauses:

- Appendix C Part 3 Stage 3: a Pedagogical Reviewer who is a distinct role from the Content Author, the six checks, the B.23, B.24, B.12 and B.11 questions, and "a pass/fail with named findings".
- Appendix C Part 2.1, criterion 4 ("Reviewed").
- The Block B Pedagogical Design Standard (the six checks).
- OD-17: generation uses Appendix C's human and automated release pipeline.
- G.2: no lesson reaches a child without human staff approval.

## What was built, and where

### Database

Three migrations. The orchestrator renumbers them at merge.

- `0247_lesson_pedagogical_reviews.sql` (expand):
  - `stage3_review_items()` defines the ten items: six checks and four questions. Only four items accept `not_applicable`: check 6 (B.28) and the B.24, B.12 and B.11 questions, because the SPEC scopes each of them ("where this lesson involves the Mentor", "where required").
  - `lesson_stage3_fingerprint(lesson)` is a digest of every v1 document and answer key (without Echo's audio stamps) and every current v2 pointer.
  - The `lesson_pedagogical_reviews` table is append-only and covers one of two subjects: a lesson's current fingerprint, or one immutable v2 version.
    - The result is derived, and `finding_count` must be greater than zero exactly when the result is `fail`.
    - A CHECK enforces reviewer ≠ author.
    - An account erasure nulls the id. Deleting the lesson removes its reviews.
  - The `lesson_stage3_review_items` table holds Forge's flags. Each flag takes one resolution (acceptable or needs change) plus a note, and cannot be edited afterwards.
  - `record_forge_stage3_items` records the flags. It is service-role only and idempotent per open flag.
  - `stage3_open_items` and `stage3_release_refusal` complete the storage layer. RLS is on and no browser role has a grant.
- `0248_lesson_pedagogical_review_writer.sql` (expand):
  - `record_lesson_pedagogical_review(actor, …)` is the one writer. It re-checks the actor (manage_content), the fingerprint the reviewer read, the author, the ten items and exactly one resolution per open flag. It then derives pass or fail and commits the review, the resolutions and `content.stage3_review.recorded` together.
  - `lesson_stage3_review_state` is what the form reads.
- `0249_stage3_review_release_gate.sql` (contract, applied after the Core and console release):
  - One trigger fires on a lesson moving to `published`, which covers `release_course`, `release_lesson` and any other writer.
  - A second trigger fires on a live v2 pointer move, which covers `release_lesson_version` and `emergency_activate_lesson_version`.
  - Both raise `STAGE3_REVIEW_REQUIRED` and roll the whole release back unless the latest review of that exact content passed and no Forge flag is open.
  - The triggers are independent of the release function bodies, so a later re-issue of `release_course` cannot drop the gate.
  - The owner alone may pass with `SET LOCAL lf.bypass_justification`, audited as `content.stage3_review_bypassed`. This follows 0222's convention.

### Core

- `backend/src/services/pedagogicalReview.ts` holds the item list (a test pins it to the migration), the strict body schema, the state mapping and the refusal map.
- `GET` and `POST /admin/content/lessons/:lessonId/pedagogical-review` live in `routes/admin.ts`, behind manage_content. Core refuses a reviewer who names themselves as author before calling Vault.
- `release_course` and `release_lesson` (in `adminData.ts`) and `release_lesson_version` (in `contentRelease.ts`) read Vault's Stage 3 refusal. Core answers it as 409 `RELEASE_STAGE3_REVIEW_REQUIRED`, never 502.

### Forge

`coursegen/src/v2/release.ts` records each published version's Stage 3 flags after its publication (`stage3ItemsFor`, `record_forge_stage3_items`). A flag without a locale applies to every market's version. If Vault cannot record the flags, the release stops. A dry run lists the flags, and the CLI prints them.

### Console

`frontend/src/rebuild/staff/console/Stage3Review.tsx` and `stage3Api.ts` add the Stage 3 panel inside the lesson review sheet and the G.2 version sheet:

- The panel shows the status chip, the latest result, its findings and the open flags.
- The form has the author select (the reviewer is excluded), the ten items, and each open flag with its resolution and note.
- It saves only a complete review, then names the saved result or the refusal.

The release refusal `releaseStage3Required` appears on the course, lesson and version sheets.

It is built from the shared controls only, with `data-copy-role` on every element. Copy is in `staffConsole.stage3` and `content.body.releaseStage3Required`, in EN, es-MX and pt-BR, within the adult copy budget. The fixture state is in `staffSectionFixtures.json`.

## Verified

- Native PostgreSQL 17.6 on the lane cluster, full chain:
  - The new `verify-stage3-review-postgres.py` passes 13 checks. It is registered in `learning-db-verify.mjs`.
  - The adapted `verify-course-publish-postgres.py` (16), `verify-content-release-postgres.py` (9) and `verify-v2-learning-postgres.py` (17) all pass. They now record a passing review before a release, or set the owner's justification for a fixture that starts live.
- Tests:
  - Backend: `pedagogicalReview.test.ts` (23 tests), plus `contentRelease` and `admin`.
  - Coursegen: `v2Release.test.ts`.
  - Frontend: `Stage3Review.test.tsx` (6 tests), `StaffSections`, `StaffConsole` and the staff copy budget.
- Gates: type-check and lint are green in backend, coursegen and frontend. `database` `npm test`, `spec:check`, `secrets:check` and the i18n gate also pass.
- Not run, per the lane rules: browser matrices, the UI audits and the full suites.

## Open

- The human Stage 3 reviews of existing review-status content must be recorded before those lessons can be released. Already-published lessons are unaffected until their content next changes.
- The v1 Forge pipeline (`coursegen/src/pipeline`) still drops its Stage 3 flags between the write and publish stages. For v1 content the reviewer runs the checks without Forge's list. The v2 path, which is the target contract under OD-17, records the flags.
- `database/types/database.ts` has not been regenerated for the new tables and functions. Core reads them untyped through PostgREST.
- Acceptance is still open.

## Owner questions

1. **Reviewer ≠ author.** Appendix C allows "the same person occasionally fills both" roles, provided the review is still treated as a separate check. The gap's fix asked for a refusal, and the conservative default was implemented: the database refuses a review whose reviewer is the author. Should a single-person team be allowed to self-review with an audited justification instead?
2. **Author identity.** Forge runs as the service role and records no author. The reviewer names the Content Author, who must hold a staff account; a v2 version with a recorded `created_by` fixes the author instead. Should Forge carry an operator identity in its manifest?
3. **Emergency activation.** The emergency activation skips the course verification (G.2) but not the Stage 3 review. This was the conservative choice: a single-version review is quick to record. Confirm.
