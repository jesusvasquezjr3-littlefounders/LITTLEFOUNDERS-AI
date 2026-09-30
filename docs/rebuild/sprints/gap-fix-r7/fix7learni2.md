# Gap-fix round 7, learning lane (fix7learni2)

Branch `codex/spec-fix7learni2`. Status: **implemented and locally verified; not accepted.** Both audited gaps were real and are closed at their enforcing boundary. The human gate-effectiveness reviews themselves, the owner's visual review of the boards and every browser gate (UI audit, matrices) are outside this lane: the orchestrator runs the browser gates once, at the end.

## Gap 1: a defect escape asked nobody why the gate missed it

**It was real.** `content_defect_escapes` (0218) held only the lesson, the gate, the kind, the reporter and the report time. `record_content_defect_escape` inserted a row and an audit entry, and `content_defect_escape_rate` counted the rows. Nothing opened, owned or closed a review. A grep for "gate.effectiveness" across backend, frontend, database, agent and docs/rebuild found nothing.

SPEC clauses:

- Appendix C Part 1.3, Defect Escape Rate: "any non-zero count triggers a gate-effectiveness review, not only a content fix".
- Appendix C Part 3 Stage 6: the Pedagogical Lead owns recalibration, on the cadence of the Threshold Recalibration Log.
- Appendix C Part 2.1, criterion 4 ("Reviewed"): a named role signs off against the specific finding.

### What was built, and where

**Database.** One migration, `database/migrations/0252_gate_effectiveness_reviews.sql` (expand, 14 KB). The orchestrator renumbers it at merge.

- **Gate owners.** `forge_release_gates.owner_role` is either `pedagogical_lead` or `content_engineering`.
  - Content engineering owns the six pipeline-completeness checks: lessons, locales, illustration style, visual coverage, distinct scenes and orphaned progress.
  - The Pedagogical Lead owns every content gate, and any gate added later defaults to that owner.
- **Reviews.** `gate_effectiveness_reviews` holds one review per escape (`escape_id` UNIQUE, FK RESTRICT). Each review records the gate and the owner copied when it opened.
  - An AFTER INSERT trigger on `content_defect_escapes` opens the review in the same transaction, whichever path wrote the escape. The trigger writes the audit entry `admin.content.gate_review.opened`.
  - Escapes recorded before the migration are backfilled as open reviews, dated at their report time.
- **Closed outcomes.** A review resolves once, with one of three outcomes and a note of 10 to 600 characters:
  - `gate_changed`, which requires the commit or gate version that changed the gate;
  - `lexicon_extended`;
  - `accepted_limitation`.
- **Backstops.** A table CHECK refuses a resolved row without an outcome, note or time, and a reference on any outcome other than `gate_changed`.
- **Append-only.** A trigger keeps a resolved review unchanged and refuses every delete. An account erasure can only null `resolved_by`.
- **Writers.** `record_content_defect_escape` now re-checks the actor through `content_release_actor_allowed` (superadmin, or admin with manage_content). Core already sends only that actor, so no running call is refused. `resolve_gate_effectiveness_review(actor, review, outcome, note, ref)` is the one writer that closes a review.
  - Its refusals are named: FORBIDDEN, NOT_FOUND, ALREADY_RESOLVED, INVALID_OUTCOME, NOTE_REQUIRED, CHANGE_REF_REQUIRED and CHANGE_REF_UNEXPECTED.
  - A resolution writes the audit entry `admin.content.gate_review.resolved`, which records the outcome, the reference, the owner and the days the review was open.
- **Reading.** `gate_effectiveness_reviews_open(now)` lists the open reviews with their age in days. It is service-role only, and RLS is on with no policy.

**Core.** In `backend/src/services/learningQaSignals.ts` and `backend/src/routes/admin.ts`:

- The learning-quality report carries `qaSignals.gateReviews`. It lists each open review's gate, description, owner, kind and age. A review is marked overdue past `GATE_REVIEW_MAX_OPEN_DAYS` (90 days).
  - The field is null before the migration, and the rest of the report still loads.
- `POST /admin/content/learning-quality/gate-reviews/:reviewId/resolve` is behind `/content`, so it needs manage_content.
  - The body is strict. `gate_changed` requires a `gateChangeRef` and every other outcome refuses one.
  - Every SQL refusal maps to its own status: 403, 404, 409 REVIEW_RESOLVED, 400 or 502.

**Staff panel.** The rebuilt `LearningQaSignals` section of the Content page's learning-quality view (`frontend/src/rebuild/learning/LearningQaSignals.tsx`) gains a Gate reviews block:

- Each open review shows its gate, its age ("open 106 days"), its owner and an overdue line past the cadence (accent edge).
- The close form uses a SegmentedControl for the outcome, a TextField for the commit or version (only when "Gate fixed" is chosen) and a TextAreaField for "Why the gate missed it".
- The copy exists in EN, es-MX and pt-BR, and every element has `data-copy-role`. The layout uses tokens only.
- The console wires the form to the route (`StaffContent.tsx`). The preview fixture (`learningQualityFixtures.ts`, `/preview` staff registry) now carries the QA block with one overdue review and one fresh review, so the UI audit covers the new state.

**Release readiness.**

- The cadence tool `agent/tools/block-b-review-cadence.mjs` gains two functions:
  - `checkGateEffectivenessReviews` warns about a review open longer than the cadence, and fails under `--strict`.
  - `loadOpenGateReviews` reads the open reviews from `--gate-reviews=<export.json>`, or through the service-role RPC when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set. That call only reads.
- `check-block-b-thresholds.mjs --strict`, which release readiness already runs, applies the check.
  - A named source that cannot be read fails under `--strict`.
  - With no source at all, the tool warns that the check did not run. A clean repo gate has no database.
- The value is logged as `gate_effectiveness.review_max_open_days = 90` in `docs/operations/BLOCK-B-THRESHOLD-LOG.md`. The gate checks it against both constants, and Core's twin test pins it too.

### Verified

- Native PostgreSQL 17.6, on this lane's cluster (port 16220), with the new `database/scripts/verify-gate-effectiveness-reviews-postgres.py`, which joins `learning:db-verify`. It passes 9 checks over all 252 migrations:
  - the backfill;
  - the owners;
  - an escape always opens exactly one review, through the recorder or a direct insert;
  - a learner, an analytics-only admin and a missing actor are refused on both writers;
  - a review never closes without an outcome and a note, and a `gate_changed` outcome never closes without its reference, even when the owner writes the table directly;
  - resolution and its audit entry;
  - append-only behaviour and erasure;
  - no browser access.
- `verify-learning-r2-postgres.py` now records its escape as a staff actor, and it passes.
- A runner pass of `learning:db-verify` under the shared machine's load reported r2 and r3 red with an empty reason. Each passed when rerun alone, r2 through the runner.
- Core: `gateEffectivenessReviews.test.ts` (6 tests) covers every refused population before the database is asked, every malformed body, the actor and body sent, and the mapping of every SQL code. It also passes with `learningQaSignals`, `learningQualityS053d` and `blockBThresholds`.
- Frontend: the `LearningQaSignals` and `LearningQualityPanel` tests cover the list, the overdue flag, disabled Close until the outcome and note are valid, the reference only for "Gate fixed", the conflict message and the Copy Budget in 3 locales with the forms shown.
- Tools: `check-block-b-thresholds.test.mjs` passes 21 tests, including overdue warns and strict fails at 91 days but not 90, a malformed list fails, file / RPC / unread loading, and a `--strict` CLI run failing on an exported overdue review.

## Gap 2: the v2 player refused lessons Core accepts

**It was real.** Every document is already checked against the shared `V2_AGE_SCOPE` by `loadLessonClientDocument` (the same `v2AgeScopeProblem` Core runs). Even so, the board switch in `LessonDocumentView.tsx` kept pilot guards:

- place value only at 6-9;
- the savings rule only at 10-12;
- ledger, growth comparison and tax brackets only at 13-17;
- ratio table, worked example, function machine and fraction line only at 10-12;
- fraction area only at 6-9.

With those guards, every adult step of `v2-adult-money` in Forge's `emitted.json` showed "This lesson cannot open." in all three locales: tax brackets, growth comparison, running ledger, worked example and ratio table.

SPEC clauses:

- Appendix P Parts 1-3, the Ages column (M9 9-17, M10 10-17, M14 10-13, M19 12-17, M20 14-17, L2 8-17, $5 9-17, $7 10-17, $8 12-17);
- OD-16: one course with pathways for children, adolescents and adults;
- B.7 part 3;
- the Appendix P Part 8 first-release list.

### What was built

- **The guards are gone.** Every per-kind `document.age_band !==` guard is deleted from `LessonDocumentView.tsx`. The handler-presence checks remain (worked example, function machine, fraction line, fraction area, CPA sequence). A comment names the shared scope as the single decision.
- **Band-specific behaviour, checked.** The savings rule's 6-9 "saved only" link already reads the document's band. Two other cases needed work:
  - `RatioTableBoard.tsx` ignored the payload's `currency`, so an adult `local` ratio table (the only band `v2PayloadScopeProblem` allows it) priced in "coins". It now formats in the market currency (USD, MXN or BRL, currency code shown), and children keep coins.
  - WorkedExampleBoard's 13-17 notation pilot now opens.

### Verified

`frontend/src/rebuild/learning/LessonDocumentView.ageScope.test.tsx` has 37 tests:

- It plays every step of every `emitted.json` document (44 lessons × 3 locales, each approach's chain) with every handler present, and asserts that no step shows the unavailable or update screen.
- The adult money boards open in all three locales.
- The learner-band check still refuses a document for another band.
- An adult local ratio table shows USD and a child one shows coins.
- A static test fails if any `age_band ===` or `!==` guard returns to the board switch.
- For every `V2_AGE_SCOPE` kind and every band its range reaches, the test takes an emitted document of that kind (its chain or progression kept), moves it into the band and checks it:
  - when the shared contract accepts it, the player must open every step;
  - at least one variant must play.

On the pre-fix renderer, 12 of the first 36 of these tests failed, among them the adult money lesson in every locale and fraction line at 6-9. Existing tests pass: `LessonDocumentView`, `WorkedExampleBoard`, `RatioTableBoard` and `AuthenticatedLessonDocument` (83 tests).

## Gates run before commit

- `type-check` and `lint` in backend and frontend.
- Focused vitest files in both.
- Root `spec:check` and `secrets:check`.
- `bash agent/tools/check-i18n.sh`.
- `check-migration-phase` (252 files, 0252 is expand), the `gate-auto-apply` and `block-b-reviews-quarterly` node tests, and the `learning-db-verify` self-test.

Per the lane rules, no browser run and no full suite ran.

## Open

- **Acceptance.** The first real gate-effectiveness reviews need the Pedagogical Lead. Release readiness reads the open reviews only where the operator provides `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` or an export. Without either, it warns that the check did not run.
- **Browser evidence** for the new panel state (preview `learningquality`) and for the adult boards: the orchestrator's UI audit.
- `database/types/database.ts` is not regenerated (`db:types` needs the Supabase stack). The new table is reached only through RPCs.

## Owner questions (conservative defaults implemented)

1. **Gate owners.** The Pedagogical Lead owns every content gate, and content engineering owns the six pipeline-completeness checks. Should a Safety/Trust owner take the wellbeing and reward-mechanic gates (17, 18)?
2. **Overdue threshold.** A review counts as overdue after 90 days, the log's quarterly cadence. Should gate-effectiveness reviews have a tighter window than threshold recalibration?
