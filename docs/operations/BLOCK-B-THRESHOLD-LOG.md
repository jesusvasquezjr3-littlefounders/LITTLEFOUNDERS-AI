# Block B threshold recalibration log

Appendix C (Part 1.3, "Threshold Recalibration Log") requires every numeric threshold of the learning pillar to be written down, owned and reviewed against real data at least once per cadence (proposed: quarterly for the first year, then per major release). Part 3 Stage 6 (Post-Launch Recalibration) runs on that cadence and feeds the recurring Age-Band Register Differentiation Audit (Part 1.3, "scheduled manual audit (quarterly, proposed)"). This file is that log for Block B. It is not a specification: the SPEC (`docs/littlefounders-spec/`) and the owner decision log win when they disagree with it, and a change here without a matching change in the code and the database is a defect.

**Enforced, not only written.** `agent/tools/check-block-b-thresholds.mjs` (repo gates) reads the table below and fails when a value differs from the Forge or Core constant that uses it or from the number a migration enforces. `backend/src/__tests__/blockBThresholds.test.ts` and `coursegen/src/__tests__/blockBThresholds.test.ts` check the same values against the live constants, including the lexicon and market counts no text match can read. To recalibrate a threshold, change this table, the constant and (where one exists) a new migration together, and record the review in the history table.

Owner of the review: the Pedagogical Lead (Appendix C Part 3 Stage 6), with Product for the Copy Budget and the register boundaries and the content / learning-design team for the lexicons and market anchors. Cadence: quarterly for the first year after release, then per major release; the gate keeps a yearly ceiling after the first year so a missed major release never leaves the log unreviewed.

**First human review due: 2027-01-15** (one quarter after the first release planned to ship Block B, the same release as Block D's; move it with the release date, never past it). The date is machine-read (`agent/tools/block-b-review-cadence.mjs`) and covers both recurring reviews: the threshold review below and the Age-Band Register Differentiation Audit (dark-pattern checklist item MN-03). Only a row of kind `human` counts as a review; a row of kind `engineering` records what a lane did and never does. After a human threshold review the next is due 90 days later, and 365 days later once four human reviews (the first year) are recorded. The register audit stays quarterly; its last date is the latest of a `human` row in the register audit log below and a signed release audit in `docs/rebuild/audits/dark-pattern-audits.json` whose MN-03 result is not `open`. `check-block-b-thresholds.mjs` warns when either review is overdue and fails with `--strict` (release readiness); `.github/workflows/block-b-reviews-quarterly.yml` opens the quarter's issue for both on the first day of each calendar quarter.

## Current values

List values are in the order the Source column names. "Not stored" means the value lives only in code: Forge decides at authoring time, or Core computes over recorded events.

| Key | Value | Requirement | Source of the value | Enforced in Core or Forge | Enforced in the database |
|---|---|---|---|---|---|
| `copy_budget.heading` | 6, 1 | OD-13 | Bible 06 §3.1 (words, sentences), grade D design judgement | `COPY_BUDGETS.heading`, `coursegen/src/contentGates/budgets.ts` | Not stored |
| `copy_budget.prompt` | 20, 12, 2 | OD-13 | Bible 06 §3.1 (words, words for ages 6-9, sentences) | `COPY_BUDGETS.prompt`, `budgets.ts` | Not stored |
| `copy_budget.option` | 8, 5, 1 | OD-13 | Bible 06 §3.1 (words, words for ages 6-9, sentences) | `COPY_BUDGETS.option`, `budgets.ts` | Not stored |
| `copy_budget.mentor` | 20, 12, 2 | OD-13, B.18 | Bible 06 §3.1 (words, words for ages 6-9, sentences); also the B.18 caption limit (Frontend 08 §2/§5) | `COPY_BUDGETS.mentor`, `budgets.ts` | Not stored |
| `copy_budget.body` | 12, 2 | OD-13 | Bible 06 §3.1 (words, sentences) | `COPY_BUDGETS.body`, `budgets.ts` | Not stored |
| `copy_budget.detail` | 60 | OD-13 | Bible 06 §4.4 layered sheet (words) | `COPY_BUDGETS.detail`, `budgets.ts` | Not stored |
| `copy_budget.es_pt_factor` | 1.25 | OD-13 | Bible 06 §3 ("ES and PT get ×1.25, rounded up") | `LOCALE_FACTOR`, `budgets.ts` | Not stored |
| `copy_budget.young_max_age` | 9 | OD-13 | Bible 06 "ages 6-9"; conservative for tier2 (8-10) | `YOUNG_AUDIENCE_MAX_AGE`, `budgets.ts` | Not stored |
| `redundancy.verbatim_run_words` | 3 | B.18 | Engineering starting point | `VERBATIM_RUN_WORDS`, `coursegen/src/contentGates/redundancy.ts` | Not stored |
| `redundancy.threshold` | 0.6 | B.18 | Engineering starting point (share of a block's words verbatim in the narration) | `REDUNDANCY_THRESHOLD`, `redundancy.ts` | Not stored |
| `redundancy.script_repeat_threshold` | 0.8 | B.18 | Engineering starting point (a differentiated script that repeats the cue this much is not one) | `SCRIPT_REPEAT_THRESHOLD`, `redundancy.ts` | Not stored |
| `tone.negation_window_words` | 4 | B.14 | Calibrated on the four catalogs and the corpus (0 false blocks, 24 Sep 2026) | `NEGATION_WINDOW_WORDS`, `coursegen/src/contentGates/tone.ts` | Not stored |
| `tone.warning_cue_window_words` | 6 | B.14 | Same calibration | `WARNING_CUE_WINDOW_WORDS`, `tone.ts` | Not stored |
| `tone.lexicon_phrases` | 51, 45, 45 | B.14 | `TONE_LEXICON` phrases (en-US, es-MX, pt-BR): Law 2 wording and the B.14 example; single common words excluded by design | `TONE_LEXICON`, `tone.ts` (count checked by the Forge test) | Not stored |
| `concept_cap.6_9` | 2, 3 | B.17 | Product B.17 and Appendix B §1.2 (target, ceiling); above the target goes to Stage 3 review, above the ceiling blocks | `CONCEPT_CEILINGS['6-9']`, `coursegen/src/contentGates/conceptCap.ts` | Not stored |
| `concept_cap.10_12` | 3, 4 | B.17 | Same (target, ceiling) | `CONCEPT_CEILINGS['10-12']`, `conceptCap.ts` | Not stored |
| `concept_cap.13_plus` | 4, 6 | B.17 | Same (target, ceiling) | `CONCEPT_CEILINGS['13+']`, `conceptCap.ts` | Not stored |
| `concept_cap.band_max_ages` | 9, 12 | B.17 | The youngest age a tier serves decides (6-9 band up to, 10-12 band up to); unknown ages take 6-9; the adult register is 13+ | `WORKING_MEMORY_BAND_MAX_AGE`, `conceptCap.ts` | Not stored |
| `misjudgment.min_episodes_per_course` | 1 | B.11 | Product B.11 proposed starting point | `MIN_MISJUDGMENT_EPISODES_PER_COURSE`, `coursegen/src/contentGates/misjudgment.ts` | Not stored |
| `misjudgment.min_voiced_moments` | 2 | B.11 | One moment for the misjudgment, one for the recovery | `MIN_EPISODE_VOICED_MOMENTS`, `misjudgment.ts` | Not stored |
| `misjudgment.shame_lexicon_phrases` | 30, 30, 23 | B.11, B.26 | `SHAME_LEXICON` phrases (en-US, es-MX, pt-BR): Appendix B §1.8/§2.8 | `SHAME_LEXICON`, `misjudgment.ts` (count checked by the Forge test) | Not stored |
| `regional.scenario_copy_threshold` | 0.8 | B.16 | Engineering starting point (token Jaccard of a non-authoring brief against the es-MX brief) | `SCENARIO_COPY_THRESHOLD`, `coursegen/src/contentGates/regional.ts` | Not stored |
| `regional.market_anchors` | 5, 2, 6 | B.16 | Anchors per market in `coursegen/regional/markets.yaml` (es-MX, en-US, pt-BR), owned by the content team | `loadMarketInventory`, `regional.ts` (count checked by the Forge test) | Not stored |
| `practice_band.default` | 70, 85, 30 | B.19 | Product B.19 and Appendix B §1.7 (lower %, upper %, minimum first attempts per window) | `DEFAULT_PRACTICE_BAND`, `backend/src/services/learningQuality.ts` | Seeded default row, `practice_difficulty_calibration` migration |
| `practice_band.guard_rails` | 50, 95, 5 | B.19 | B.19's near-certain and frustration zones (lowest lower %, highest upper %, minimum width) | `PRACTICE_BAND_GUARD_RAILS`, `learningQuality.ts` | CHECK `practice_difficulty_bands_guard_rails` |
| `practice_band.review_window_days` | 28 | B.19 | Engineering proposal, pending calibration | `REVIEW_WINDOW_DAYS`, `learningQuality.ts` | Not stored: Core passes it to `sync_practice_difficulty_reviews` |
| `practice_band.review_consecutive_windows` | 2 | B.19 | Engineering proposal: two consecutive out-of-band windows, same direction | Core calls the function | `sync_practice_difficulty_reviews` compares the current and the previous window |
| `practice_band.review_cadence_days` | 90 | Appendix C 1.3 | The log's quarterly cadence, applied to the default band | `BAND_REVIEW_CADENCE_DAYS`, `learningQuality.ts` (staff panel `reviewDue`) | Not stored |
| `mentor.zpd_target` | 0.75 | B.19 | Inside the default band by construction | `ZPD_TARGET`, `backend/src/services/pedagogy/sessionPlan.ts` | Not stored |
| `judgment.divergence_floor` | 0.1 | B.12 | Appendix C "Judgment-Quality Signal Differentiation"; Engineering proposal | `JUDGMENT_DIVERGENCE_FLOOR`, `learningQuality.ts` | Not stored |
| `judgment.min_attempts` | 30 | B.12 | Engineering proposal | `JUDGMENT_MIN_ATTEMPTS`, `learningQuality.ts` | Not stored |
| `replay_notice.target` | 1 | B.5 | Appendix C "Replay Non-Regression Messaging Display Rate" (100%) | `REPLAY_NOTICE_TARGET`, `learningQuality.ts` | Not stored |
| `guided_review.miss_threshold` | 3 | B.26, OD-1 | Proposed in B.26 | `GUIDED_REVIEW_MISS_THRESHOLD`, `backend/src/services/learnerRegisterPolicy.ts` (byte-identical Forge and UI copies) | Not stored |
| `guided_review.max_tracked` | 12 | B.26 | The offer repeats at 6, 9 and 12, never on every miss | `GUIDED_REVIEW_MAX_TRACKED`, `learnerRegisterPolicy.ts` | Not stored |
| `engagement.trend_window_weeks` | 4 | B.28 | Appendix C §1.2 "hold steady or improve": the last 4 weeks against the 4 before | `TREND_WINDOW_WEEKS`, `backend/src/services/engagementHealth.ts` | Not stored |
| `engagement.trend_tolerance` | 0.1 | B.28 | Engineering proposal | `TREND_TOLERANCE`, `engagementHealth.ts` | Not stored |
| `engagement.trend_min_weekly_sample` | 20 | B.28 | Engineering proposal | `TREND_MIN_WEEKLY_SAMPLE`, `engagementHealth.ts` | Not stored |
| `engagement.history_weeks` | 12 | B.28 | The weeks the staff trend reads | `ENGAGEMENT_HEALTH_WEEKS`, `engagementHealth.ts` | Not stored |
| `register.transition_age` | 10 | B.23 | Appendix B §2.9 (directional, not hard) | `registerForAge` and `GRADUATIONS`, `learnerRegisterPolicy.ts` | Not stored |
| `register.teen_age` | 13 | B.23 | Appendix B §2.9 | `registerForAge` and `GRADUATIONS`, `learnerRegisterPolicy.ts` | Not stored |
| `register.adult_age` | 18 | B.23 | Legal adulthood | `registerForAge`, `learnerRegisterPolicy.ts` | Not stored |
| `dark_pattern.release_audit_max_age_days` | 45 | B.25 | The release audit's freshness (docs/rebuild/DARK-PATTERN-AUDIT.md) | `RELEASE_AUDIT_MAX_AGE_DAYS`, `agent/tools/check-dark-patterns.mjs` | Not stored |

The Copy Budget's v2 audience mapping (the `6-9` pathway gets the 6-9 limits; working-memory bands `6-9`, `10-12`, `13-17`/`adult` to 13+, unknown to 6-9) is a rule, not a number; it stays recorded in `docs/rebuild/sprints/S05-FORGE-CONTENT-GATES.md` and is reviewed with these rows.

## Review history

| Date | Kind | Keys | Decision | By |
|---|---|---|---|---|
| 2026-09-24 | engineering | `copy_budget.*`, `redundancy.*`, `tone.*`, `concept_cap.*`, `misjudgment.*`, `regional.*` | Initial values recorded with S05.4a and S05.4b (docs/rebuild/sprints/S05-FORGE-CONTENT-GATES.md). The Copy Budget and the concept ceilings come from the Bible and Product B.17; the redundancy, tone and scenario thresholds are Engineering starting points; the tone windows and lexicon were calibrated on the catalogs and the corpus (0 false blocks). | Engineering (S05 lane) |
| 2026-09-24 | engineering | `practice_band.*`, `mentor.zpd_target`, `judgment.*`, `replay_notice.target` | Initial values recorded with S05.3d (docs/rebuild/PRACTICE-DIFFICULTY-CALIBRATION.md). The 70-85% band is Product B.19's; the guard rails, windows and judgment floor are Engineering proposals pending calibration. | Engineering (S05 lane) |
| 2026-09-24 | engineering | `guided_review.*`, `engagement.*`, `register.*`, `dark_pattern.release_audit_max_age_days` | Initial values recorded with S05.3f (docs/rebuild/LEARNER-REGISTER-AND-WELLBEING-POLICY.md §6). The 3-miss threshold is B.26's proposal; the register ages follow Appendix B §2.9; the trend window and sample are Engineering proposals. | Engineering (S05 lane) |
| 2026-09-29 | engineering | All rows | GAP-FIX-R6: the three prose tables consolidated into this machine-checked log with a due date; no value changed. | Engineering (fix6learni1 lane) |

## Register audit log

The Age-Band Register Differentiation Audit (Appendix C Part 1.3, B.23): a human judges whether the four registers (young, transition, teen, adult) are still genuinely distinct as new content accumulates, with no drift back toward one generic register. It is checklist item MN-03 of the dark-pattern audit; a signed release audit that judges MN-03 counts as one, and an audit between releases is recorded here.

| Date | Kind | Scope | Result | By |
|---|---|---|---|---|
| 2026-09-24 | engineering | Engineering pre-audit `2026-09-24-s053f-engineering-pre-audit`: the registers are defined and enforced (policy, Forge gate 19) | MN-03 open: the first human audit is due after release | Engineering (S05 lane) |

## What a recalibration looks at

- The Copy Budget, redundancy and tone thresholds: the Forge Gate Pass Rate per gate on first submission (Appendix C Part 1.3) and the review-queue samples of `npm run content:gates`. A gate that blocks honest content argues for a narrower rule, never for switching the gate off.
- The concept ceilings: the Forge concept-cap results per course and Time-to-Mastery per KC and age band on the C.24 dashboard. Lessons that pass the cap but miss mastery argue for a lower ceiling.
- The practice band and its review trigger: the staff Learning quality view (`GET /api/v1/admin/content/learning-quality`), per lesson and exercise family, with the append-only band log.
- The judgment floor: the judgment differentiation rows of the same view (`learning_judgment_differentiation`).
- The guided review: the offer's acceptance and the skill's next attempts after it; a threshold that fires on most runs is too low.
- The engagement trend: `learning_session_efficiency` and `mentor_resolution_efficiency` (Appendix C §1.2).
- The register boundaries: the register distribution by age and the register audit's findings. A 10-12 group that finds the transition register childish argues for the audit's evidence, not for a percentage below 13 (Block D keeps the same cut-off).
- The lexicons and market anchors: the content team's review items and false blocks from `content:gates`.

None of these thresholds is presented to families as scientifically proven: each is a research-grounded starting point (Appendix C Stage 6).
