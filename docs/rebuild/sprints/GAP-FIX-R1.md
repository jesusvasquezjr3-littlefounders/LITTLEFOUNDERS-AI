# Gap-fix round 1

Lane records for the first gap-fix round of the SPEC migration. Each lane appends its own section. Statuses follow the ledger: implemented and locally verified is not accepted and not released.

## Mentor lane

Branch `codex/spec-fix1mentor`, checkpoint F1-mentor. Binding sources: product C.8, C.12, C.13, C.24, B.7; OD-6, OD-13; Frontend Bible 05 §2, 06, 07 §4, 08 §2, §8, §10.

### F1-mentor part A: the Mentor runtime and its measurements

What was built:

- **OD-6, glossary (item 7).** The live system prompt now opens "You are the learner's Mentor, one of the LittleFounders characters." It tells the model to call itself by its character name or "your Mentor", never a tutor, teacher-bot, bot or assistant, and that "Tutor" is the learner's parent. The unknown-persona fallback is "a friendly Mentor character". `selfNamingViolation` (prompt.ts, beside `TIER_FORBIDDEN`) catches self-naming in the three locales ("I'm your tutor", "soy tu tutor", "sou seu tutor", "I'm just a bot", "soy un asistente"). It only catches the Mentor naming itself, so "ask your tutor to approve it" and "the shop assistant" in a story pass. A hit is a shape failure with one retry. A survival is delivered, counted and flagged.
- **OD-13, Copy Budget (item 8).** The prompt asks for "1-2 short sentences, at most 20 words (12 for ages 6-9), and at most one question", and the length section states the same budget. `mentorTurnBudget(say, tier, locale)` mirrors `frontend/src/rebuild/design/copyBudget.ts`: same word regex, same sentence rule (honorifics and decimals are not boundaries), ×1.25 for es-MX and pt-BR, and 12 words for tiers 1 and 2 (ages 6-9). An overflow gets one retry that names the limit. It is the lowest-priority repair: when a higher fault takes the retry, that correction carries the budget too. A survival is delivered, counted and flagged (the M-13 pattern).
- **C.8/C.12 (item 2).** Spoken (`voice_result`) and verified conversational answers now pass C.9's onset-based reply latency to `observeGraded()`, with their channel. `SessionEndSignal` keeps one latency baseline per channel (typed, spoken, activity). Each baseline holds the first four latencies of its own channel, and a window's SD of ln(latency) is only compared with the baseline of the same channel. Older snapshots restore, defaulting to the activity channel.
- **C.24 and the tell invariant (item 5).** The C.24 dashboard now reads the sources that already existed: B.28 session efficiency and Mentor resolution (the `engagementHealth.ts` RPCs, with their trend rule and direction; a regression is a breach), the B.9 decision journal and B.13 bridge conversion (`learning_narrative_metrics`), B.21 rest-day use (`learning_rest_day_utilization`) and B.24 autonomy adoption (`learning_autonomy_adoption`). An unreachable RPC fails closed as `unavailable`, with an urgent flag for engineering. For `rubric.tell_honored`, Oracle now counts, per session, the explicit "just tell me" requests, the answer turns that carried the tell rung, and the requests that were withdrawn (the learner cut in, or a safety response replaced the turn). These counts are stored on `tutor_dialogue_calibration` (migration `0193_mentor_tell_budget_self_naming_counts.sql`, which also stores the budget and self-naming counts). Rubric v2 rule-scores `tell_honored` as a hard invariant, and the judge still scores it too.

What still says `not_instrumented`, and why: `learning.transfer_success` (B.7/B.12 tagging), `learning.judgment_quality` (B.12; the existing `learning_judgment_differentiation` checks the signal's validity, not judgment quality), `engagement.streak_anxiety` (no streak-at-risk notification exists), the B.25, B.22 and B.20 audits (manual), and `engagement.parent_time_to_value` (no client timing).

Tier 1 change control: rows were recorded in `docs/rebuild/mentor/governance/tier1-change-record.json` for evaluation.rubric_and_judges, evaluation.stage2_and_bias_audit, mentor.non_negotiables, mentor.monetization_adjacent and measurement.stage7_and_thresholds. Both leads' sign-offs are pending. The rubric change record has a v2 row (EVALUATION-LOOP-AND-QUALITY-DASHBOARD-POLICY.md §2.2). The bias-audit log records a material change for `session_end.stop_reply`: the file changed, and its classifier did not. The threshold rows are dated 2026-09-27 in THRESHOLD-RECALIBRATION-LOG.md.

Deploy order (for later): Core before Oracle. The close body is strict. The new report fields are optional in Core, so an older Oracle still closes, but a newer Oracle needs a Core that knows the new fields.

Verified locally:

- Oracle: type-check and lint are clean. The full Oracle suite is green after the fixture updates: 1725 tests, with the 5 reds all fixed. The new file `mentorNamingAndBudget.test.ts` covers self-naming in both directions, the budget limits and the parity test that reads the frontend `copyBudget.ts`. `orchestrator.test.ts` has new OD-13, OD-6 and C.13 blocks: retry, survival with counting, and the one-question rule. The budget repair is switched off by default in the rest of that file, whose older fixtures pin other checks. `sessionEndSignal.test.ts` and `sessionEndGym.test.ts` cover the new personas plus two red proofs (latency dropped, channels mixed).
- Core: type-check and lint are clean. mentorQuality, the routes, transcriptEvaluation, spacedReviewCalibration, judgeCalibration and the tutor routes are green (539 + 89 + 40 tests across the runs).
- Gates: session-end:check (extended, with 10 node tests), review-calibration:check, evaluation-loop:check, telemetry:check, honesty:check, alliance:check, governance:check, spec:check and secrets:check.
- PostgreSQL 17.6 (owned cluster, port 15740): `database/scripts/verify-mentor-counts-postgres.py` applies all 193 migrations. It then checks that a legacy row keeps NULL counts, that bad counts and more tell answers than requests are refused, and that RLS still closes the table to browser roles.

Remaining for part A: `database/types/database.ts` is not regenerated (`db:types` needs the shared stack). The budget will spend a retry on many child turns, so its live cost and hit rate are unmeasured (OD-23 zero spend: no live run).

### F1-mentor part B: the board, one component set, and the chooser

What was built:

- **B.7 and Bible 05 §2 hue rules (items 1 and 3).** A shared Pizarrón visual library lives in `frontend/src/rebuild/learning/pizarron/` (`visuals.tsx`, `pizarron.css`, `index.ts` with `PIZARRON_VISUALS`). Every visual is presentation only: it draws the numbers and words it is given, and scaling a length to the board is its only computation. The lesson boards now draw with it: BarModelBoard uses the tape, FractionAreaBoard and FractionNumberLineBoard use the area model, and RatioTableBoard uses the ratio lines, with its drag handle passed as an overlay. The Mentor board (`mentor/screen/MentorBoard.tsx`) no longer has generic bars. `boardVisuals.tsx` maps each of the 45 Oracle kinds to the visual for its concept (`BOARD_RENDERERS`), for example open_number_line, marked_line and timeline to the number line; bar_model, part_whole, equation_bar, receipt, budget_plate and change to the tape; table to ratio lines; ledger to the running ledger; worked and cycle to worked steps; sequence, sequence_compare, whatif and your_turn to growth lines; categories to the allocation waffle; tokens and regroup to reward coins. The visuals added for kinds that had no lesson board are the ten frame, balance scale, Venn, array, tally, bead string and pictograph. Each board takes Oracle's server values read-only. The table view is still one press away. A your-turn board never writes a value the learner has not reached, in the picture, on the axis or in the description. `boardModel.ts` tones are now `sky | mint | berry | overflow`. Primary and accent are gone from the tones and from the CSS, and the old `lf-mentor-board-bar-*` rules were deleted. The whiteboard parity gate (`instruments:check`) now fails when a wire kind has no shared visual, or when it maps to something that is not a shared visual. One Copy Budget word was added for the unit-price board's quantity line: `mentorScreen.board.words.units` (Units / Unidades / Unidades). The dark-pattern gate now accepts the manifest key `ranking: '…Visual'`. It is the same money-item instrument as `kind: 'ranking'`, and it ranks no person.
- **Bible 08 §8 and 07 §4 (item 6).** One shared `MentorChooser` (`frontend/src/rebuild/mentor/MentorChooser.tsx`) shows the four characters standing on their Diorama (`mentor.chooserStill`), each with a name and a line of at most six words. The avatar render is used only when no Diorama still is registered. The onboarding 'mentor' step and the Mentor screen's chooser sheet both use it. Onboarding keeps its saving state (the rows stay buttons, and a press during a save does nothing), its chosen pill and its skip. The audit states gained `onboarding@mentor-saving`, and the preview takes `?saving=`.

Verified locally: frontend type-check and lint are clean. Vitest is green for rebuild/mentor, rebuild/learning, recomposition and identity. The new `boardVisuals.test.tsx` covers all kinds in three locales, copy roles, series-only fill classes, server values written as given, the table view and hidden your-turn values. `identity.test.tsx` checks that onboarding shows chooser stills and no bust avatars, and pins the saving and skip states. Gates: instruments:check (with 16 node tests), the dark-pattern tests, the i18n gate, spec:check and secrets:check. I looked at headless captures of 12 kinds (light at 1280, dark at 375). That look found and fixed uncoloured waffle and icon cells, squashed number-line points, and end labels running off the board.

Remaining for part B: the lesson boards for growth comparison, allocation, tax brackets, percent grid, place value, worked examples and the running ledger still draw their own inline pictures. Their interactive layers (predictions, sliders, fading) were not moved onto the shared visuals in this round. The board-specific audits listed in 05 §8 (no reserved hue as a series, contrast of marks) are not machine-verified yet.

### F1-mentor part C: nothing covers the Mentor's face or hands (Bible 08 §2, §10 item 3)

The gap is real, and it was measured before anything was fixed. `verify:placement` gained a stage-occlusion check. It found Dr. Rho's left hand occluded on diorama-a (close-up, phone), and Dina's right paw occluded on diorama-a (wide close-up, phone). On diorama-b it found Dina's head and paws occluded in eleven shot/viewport combinations, which is the leaf across her face.

What was built:

- **The rule.** `frontend/src/tutor-scene/occlusion.ts` (pure) projects each character's head and both hands (Dina's front paws) from every Mentor-stage camera: close-up and wide close-up, each seen from a 375 × 812 phone, a 1280 × 800 desktop and the compact lesson band. Each pose comes from `shots.ts` `poseFor`, so the cameras are the stage's own. A point is occluded when the ray from the camera meets the island before it reaches the point.
- **The fix.** Both Dioramas are one mesh with one material. The ammonite, the palms and the bushes are not separate nodes, so there is nothing to hide or fade. Instead, the placement solver (`standingSpots.ts`, new `leadCorridorClear`) refuses a lead spot whose corridor is blocked. It checks the whole band of facings the lead can be turned to (±25° around the stage bearing), because facings are solved after placement. It takes the best-scoring clear spot, which bounds the raycasts. If an island has no clear spot at all, it falls back to the best spot rather than leave the stage empty, and `verify:placement` names that case. `TutorScene.tsx` applies the gate outside an audition, and `verify:placement` applies the same gate and then re-checks the solved facings.
- **The stills.** Dr. Rho's and Dina's stage stills (`public/rebuild/mentor-stage`) and their chooser stills (`public/rebuild/mentor-chooser`) were re-rendered from the new placement with the repository's zero-spend renderers. Zara's and Liruf's placements did not change.

Verified locally: `npm run verify:placement` is OK on both Dioramas (every lead clear in every stage shot and viewport, still on walkable ground, inside the rim and facing the learner). `occlusion.test.ts` covers all four characters: points on open ground are clear, a post in the camera corridor is reported by shot, viewport and point, the same post behind the character is not, and the solver moves the lead out of a blocked corridor. The tutor-scene and mentor suites are green.

Limitation: the head and hand points are proportional samples of each character's measured height in the bind pose, not projected skinned bones. The exports are quantized and skinned, and the repository cannot measure them headless (see `verify-placement.ts` `characterStandIn`). A gesture that swings a hand far from its bind position is not covered.

### F1-mentor finish: lane close

The finish synced with `codex/spec-migration-s02`, which was already up to date, and then made an adversarial pass over the eight gaps.

Built in the finish:

- **B.7, one component set (the rest of items 1 and 3).** Part B left the lesson boards with their own inline pictures. The finish moved every one of them into the shared library: `learning/pizarron/lessonVisuals.tsx`, exported through `PIZARRON_VISUALS`. That covers the running ledger (balance meter), percent grid, tax brackets (stacked slices), place value (base ten), savings line, growth comparison, goal bullet, number line and fraction number line (number axis), CPA dots, savings rule (condition rule), function machine, and the allocation waffle, donut and stacked bar. The worked example now uses the shared `WorkedStepsList`, which the Mentor's `WorkedStepsVisual` also uses. Each board keeps its model, controls, table and existing selectors.
- **05 §2 violations the move exposed, now fixed.** Three second or third series were drawn without their pattern channel: the tax brackets' mint and berry slices, the place-value tens rods and the CPA second group. A fourth tax bracket had no fill at all. It now uses the neutral crosshatch overflow.
- **A static 05 §8 audit.** `learning/pizarron/oneComponentSet.test.tsx` fails if any lesson board or the Mentor board draws its own `<svg>` or chart image. It checks board mark rules in the pizarron and lesson stylesheets: no accent, warning, error or success; reward only for coins; primary only for a selected mark (the learner's prediction or marker, or the board's marked item); and a pattern on every strong mint or berry mark. It also renders the new pictures.
- **Stale tests fixed.** `OnboardingPage.test.tsx` still expected bust avatars in the onboarding chooser. It now pins the Diorama chooser stills (08 §8, from part B). `designClasses.test.ts` found two classes that part B referenced but never defined (`lf-pz-ledger-change`, `lf-pz-growth`); both are now defined. Core's `analytics.test.ts` used a fixed date that the calendar passed on 2026-09-28, so it now uses a date relative to today.

Verified at the lane close:

- Full unit suites: frontend 251 files and 2,903 tests, Oracle 65 files, Core 125 files, each with type-check and lint. The only reds were the three fixed above and the load-sensitive Oracle boot tests (hardening, live-session, boot-skills). Those passed when rerun alone (86 tests).
- Gates: instruments:check, spec:check (with the dark-pattern and wallet-glossary gates) and secrets:check.
- Database package: check-migrations and check-migration-phase pass on 193 files, and the chained node tests passed. `railway-migrate.test.mjs`, which runs against a fake Railway CLI and never contacts production, was still in its fifth scenario after about 20 minutes on this Windows machine and was stopped. The lane did not touch it. The orchestrator's merge gate should run it where process spawning is fast.
- Touched gate node tests: 38 of 38 pass (instrument, session-end and review-calibration parity).
- The copy did not change, so the i18n gate was not needed.

Still open (Mentor lane, for the orchestrator or a later round):

- `database/types/database.ts` is not regenerated for the new `tutor_dialogue_calibration` columns (migration 0193). `db:types` needs the shared stack.
- Live measurement of the OD-13 budget retry rate and its model cost (OD-23 zero spend).
- C.24 metrics still `not_instrumented`: transfer_success, judgment_quality, streak_anxiety, the B.25, B.22 and B.20 manual audits, and parent_time_to_value.
- Parts of 05 §8 are not machine-checked yet: measured contrast of marks and axes in both modes, the draggable 64 px and tap-alternative check, and the in-board animation check. The static hue audit is in place.
- Occlusion uses proportional head and hand points, not skinned bones.
- The re-rendered Rho and Dina stills are `reviewStatus: draft` and need the owner's character-render review.
- The merge-time gates still apply: test:all, browser matrices and audits (the lesson boards' DOM selectors were kept), and verify:placement with scenes:fetch.
- Deploy order for later: Core before Oracle.

### Owner questions and the defaults taken (Mentor lane)

1. **OD-13 retry cost.** The Mentor turn Copy Budget is enforced as written: 12 words for ages 6-9, 20 above, 2 sentences, one question. An overflow spends the one retry, and many real child turns overflow today, so turns cost more model calls. Default taken: enforce, lowest-priority repair, survivals delivered and counted. The retry rate should be measured before release.
2. **OD-6 self-naming scope.** Only the Mentor calling *itself* a tutor, bot or assistant is caught. "Ask your tutor" (the parent) and a story's "shop assistant" pass. Default taken: self-reference only, to avoid retrying correct sentences.
3. **C.24 `tell_honored`.** The rules scorer counts an answer turn that carried the tell rung as honoured. Whether that turn really stated the answer is still the judge's question. Default taken: a hard invariant on the runtime record, plus the judge.
4. **08 §2 occlusion points.** Head and hands are proportional samples, not skinned bones. Default taken: gate placement on them now; measure real bones when source exports are available.
