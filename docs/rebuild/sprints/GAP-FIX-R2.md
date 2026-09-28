# Gap-fix round 2

Lane records for the second gap-fix round of the SPEC migration. Each lane
appends its own section. Statuses follow the ledger: implementation, local
verification, acceptance and release are separate, and nothing here is
accepted or released.

## Checkpoint F2-identity-site

Branch `codex/spec-fix2identity`. Three audited gaps in the identity and
public-site area. Each was checked in the code first; all three were real.

### What was built

| # | SPEC clause | Gap confirmed in code | What was built | Where |
|---|---|---|---|---|
| 1 | A.2; Appendix M 1.1 (Unconsented Analytics Event Rate, flagged sessions: target zero); Part 2.2(b) | `POST /onboarding/complete` wrote `discovery_channel` for every account, with no origin, role or analytics check; O1 always asked | One predicate, `admitsAcquisitionAnswer` (not required, not under-13 origin, a confirmed non-kid role, `allowsSelfManagedAnalytics`), now used by `attributeSignup`, the onboarding route and `/auth/me`. Onboarding stores the answer only when it holds and otherwise writes `null`, still recording `account_offer_choice` as the completion marker (a failed role read discards it too). `/auth/me` returns `discoverySurvey`; `AuthContext` exposes it and O1 drops the step (progress reads "n of 4", mentor goes straight to the account step, no channel is sent). Migration `onboarding_discovery_metrics`: scrubs earlier answers of refused populations (under-13 origin, kid, under-13 declaration, teen without opt-in, a teen promoted by birth month who said no) and adds `onboarding_discovery_metrics()` (service role, counts only). Core reads it beside `identity_metrics`; the report gains the release-gate metric `onboarding_discovery_unconsented` (share of stored answers that are admitted; met means zero unconsented rows), labelled on the staff Trust view in three locales | `backend/src/services/analyticsPreference.ts`, `routes/onboarding.ts`, `routes/auth.ts`, `services/insights.ts`, `services/identityMetrics.ts`, `database/migrations/0215_onboarding_discovery_metrics.sql`, `frontend/src/auth/AuthContext.tsx`, `rebuild/identity/OnboardingFlow.tsx`, `routes/onboarding/OnboardingPage.tsx` |
| 2 | A.1; Appendix M 1.4; owner answer H-20; Law 5 | The FAQ and the console switch promised per-child usage analytics; every optional gate drops an under-13 origin's events whatever the consent (`insights.ts`, `events.ts`), so for 6-12 the switch only ever enrolled the M-12 tween test | FAQ `analyticsToggle` rewritten (EN, es-MX, pt-BR): under 13 no usage data is ever collected; for a teen it stays off until their Tutor or the teen turns it on. `GET /family/kids` returns `under13` (`readUnder13Accounts`: the origin or an under-13 declaration). The console shows, for such a child, the one-line fact and no usage-data switch; where `dialogueExperiment` is true (a 10-12 child with a known birth date) the switch stays, relabelled "Hint-style test" with its own help line. `POST /family/kids/:kidId/analytics-consent` refuses any other under-13 grant with 403 `ANALYTICS_NOT_COLLECTED_UNDER_13`; revoking stays allowed | `backend/src/services/ageScreen.ts`, `routes/family.ts`, `frontend/src/rebuild/family/console/ChildControls.tsx`, `consoleApi.ts`, `src/i18n/*/rebuild-site.json`, `rebuild-family.json` |
| 3 | Bible 02 D3, D4, D8, rules 2 and 21; 07 §1 and §3 | `og-card.html` loaded Inter/Sora from Google Fonts, used the indigo radial gradient, a gradient rule, drop shadows, the raster logo (gradient text, stock figures) and unregistered busts; `themeColor #4f46e5`, manifest background `#0b1120`, JSON-LD logo and every icon were the legacy logo | New own asset `brand.mark` (`public/rebuild/brand/mark.svg`: flat tile in primary with its ridge, three white rising bars and a reward coin; 2 hues plus white; registered in the manifest, new review family `brand`). The asset gate accepts an asset used outside the app when its row names a `consumer` script under `scripts/` that carries the asset path (mutation-proved). `scripts/seo/render-icons.mjs` (`npm run seo:icons`) draws `favicon-48.png`, `favicon.ico` (32+48 PNG entries), `apple-touch-icon.png` (on primary), `icon-192.png` and `icon-512.png` from it; `scripts/seo/cdp.mjs` holds the server, Chrome launch (Windows paths added) and CDP client both renderers share. `og-card.html` rewritten: solid primary ground, Fredoka and Nunito from `public/fonts`, the mark beside the text wordmark, the four Mentors as `mentor.<id>.avatar.light` renders on a flat ridge band; cards re-rendered for 3 locales. `site.mjs`: `themeColor #5c55fd`, `manifestBackground #0b0d1b`, `logoPath /icon-512.png` (JSON-LD). `check-seo-surface` gains `auditBrand`: fails on a non-token theme or manifest colour or a non-mark logo (4 new gate tests). Deleted from `public/`: `logo-main.png`, `logo-main-trimmed.png`, `favicon.png` (the 2553 px legacy master), `Hero-Families.webp` and the whole unreferenced `marketing/` folder (Pexels stock, the photo atlas, busts, legacy videos and its CREDITS.md) | `frontend/public/rebuild/brand/mark.svg`, `src/rebuild/assets/manifest.json`, `scripts/check-rebuild-assets.mjs`, `scripts/seo/*`, `agent/tools/check-seo-surface.mjs` |

### Verification (local)

- Core (vitest, focused): `onboarding.test.ts` (15: six refused populations never persist the channel and still complete, an opted-in teen does, `/auth/me` discoverySurvey), `analyticsPreference.test.ts`, `staffOps.test.ts` (14: the new metric, a malformed discovery answer 502s, a flagged stored answer misses), `family.test.ts` (86: `under13` for origin, declaration and teen; 8-year-old, 9-year-old and undated under-13 grants refused and nothing stored; declaration-only refused; 11-year-old accepted; revoke allowed; unreadable age 502), `insights.test.ts`, `familyKids.test.ts`. Backend type-check and lint clean.
- Native PostgreSQL 17.6 (owned cluster, port 15800): `verify-staff-ops-postgres.py` applies every migration in order and passes 18 checks, two new: the metric counts answers from refused populations and only the service role reads it; the migration's scrub nulls the refused answers, keeps every completion marker and the admitted answer.
- Frontend (vitest, focused): `identity.test.tsx` (29, including the 4-step flow with no discovery step and a null channel), `OnboardingPage.test.tsx` (13, a flagged guest is never asked and sends no channel), `AuthContext.test.tsx`, `FamilyConsole.test.tsx` (3 new: no switch under 13, the hint-style test switch alone for a 10-12 child, the switch kept for a teen), site tests. Type-check and lint clean; i18n gate green.
- Asset gate: `check-rebuild-assets.mjs` passes with OCR (118 rasters free of text, 146 class B assets). The three new mutation cases in `assetGate.test.ts` (consumer drops the path, consumer outside `scripts/`, off-token mark colour) were proved by running the gate by hand on a copied tree; the vitest file itself timed out at 90 s per case on this machine, pre-existing cases included, because the first read of each fresh temp tree takes about 50 s here (a second run on the same tree takes 7 s). Left to the orchestrator's quiet run.
- SEO: `seo:check` green, `check-seo-surface.test.mjs` 18/18; `seo:icons` and `seo:cards` rendered; one share card (pt-BR) and the 192 px icon inspected by eye.
- Root: `spec:check` (exit 0) and `secrets:check` green.
- Not run here (orchestrator, per merge): browser matrices, `audit:rebuild`, full suites, a production build (`build-seo.mjs` runs after `vite build`).

### Decisions taken with the SPEC's conservative default (owner questions)

1. **Adult guest discovery answer.** The predicate is signup attribution's, so an adult guest's answer is kept (as before) while a guest's usage beacon stays off. Acquisition self-report from a declared adult is treated like attribution, not like product analytics.
2. **Earlier answers scrubbed.** The migration nulls stored discovery answers of refused populations instead of only measuring them, so the metric starts at zero once applied. The completion rows stay.
3. **`lf-logo-email.png` kept.** The task listed it as unreferenced, but README says it stays because account emails already delivered link to it. Deleting it breaks those messages' images, so it is kept. The staff analytics PDF no longer uses it (see the finish checkpoint).
4. **Mentor art on the card** uses the `mentor.<id>.avatar.light` renders (square, transparent), not the chooser stills (which carry the Diorama).
5. **Brand mark design** is ours and in draft: the new `brand` review family awaits the owner's first-asset style review (07 §7 item 2).

### Migrations (renumbered by the orchestrator at merge)

- `0215_onboarding_discovery_metrics.sql` (expand: a data scrub to NULL, a value every deployed reader accepts, plus a new function)

### Open items

- (Closed at the finish checkpoint) The staff analytics PDF report embedded the legacy raster wordmark.
- `database/types/database.ts` not regenerated for the new function (Core reads it untyped through `serviceRest`, as it does `identity_metrics`).
- `assetGate.test.ts` needs the orchestrator's quiet run (see verification).

## Checkpoint F2-identity-site-finish

Lane finish for identity-site. Synced with `codex/spec-migration-s02` (already
up to date, no conflicts).

### Adversarial pass and what it built

- **Staff analytics report PDF (02 D3, D4, D8; 07 §1 and §3).** The last
  outbound document still inlined the legacy raster wordmark. `drawLogo` now
  draws `brand.mark` as pdfkit vectors from the asset's own 64-unit geometry
  beside a text wordmark; the report palette moves from the legacy
  indigo/slate set to the rebuilt light tokens; `backend/src/assets/lfLogo.ts`
  (the base64 PNG) is deleted. `analytics-report-pdf.test.ts` asserts no image
  object in the report and the mark's token fills in the uncompressed lockup.
  `lf-logo-email.png` itself stays in `public/` (delivered emails link to it).
- **FAQ copy budget.** The full frontend suite caught the rewritten en-US
  `analyticsToggle` answer at 27 words against the site body budget of 25; it
  now reads "Under 13, we never collect usage data. For a teen, it stays off
  until their Tutor or the teen turns it on." (22 words; es-MX and pt-BR were
  within their budget).
- Re-checked: all three gaps are enforced at Core (the onboarding predicate,
  the 403 on under-13 analytics grants), no legacy component in the rebuilt
  console or onboarding, new copy present in all three locales (i18n gate
  green), no remaining reference to the deleted `public/` rasters.

### Verification (local, lane finish)

- Backend: type-check and lint clean; full unit suite run once: 9 red, all in
  files this lane did not touch (admin, auth, coopGoals, learnNarrative,
  socialGovernance; 5 s timeouts while three other lanes ran suites), and all
  five files pass alone (223/223).
- Frontend: type-check and lint clean; full unit suite run once (264 files,
  3,040 tests): the copy-budget red above (fixed, `site.test.ts` 6/6);
  `StaffInsights.test.tsx` and `App.test.tsx` timeouts that pass alone;
  `assetGate.test.ts` timed out again (see the open item).
- Root: `spec:check`, `secrets:check` and the i18n gate green.

### Open items (final)

- `assetGate.test.ts` still needs a quiet-machine run; its cases time out here
  (fresh temp trees read slowly; the gate logic was proved by hand).
- `database/types/database.ts` not regenerated for
  `onboarding_discovery_metrics()` (read untyped through `serviceRest`).
- Owner first-asset style review of the new `brand` review family
  (`brand.mark`, 07 §7 item 2); the PDF lockup and icons follow it.
- Production (later, owner): migration `onboarding_discovery_metrics` plus a
  Core and frontend deploy; icons, share cards and the PDF ship with them.

### Merge integration (F2-identity-site into `codex/spec-migration-s02`)

- The merge was clean: no textual conflicts, and no integration defect was
  found on the merged tree.
- Migrations: the lane's `0215_onboarding_discovery_metrics.sql` already
  follows the integration branch's highest number (`0214`), so it kept its
  number. It is 4,476 bytes, under the 23,000-byte limit.
- Checks on the merged tree: `typecheck:all`, `lint:all`, `spec:check`
  (asset gate now lists the `brand` family as awaiting review; Wallet
  glossary and dark-pattern gates green), `secrets:check`, the i18n gate,
  backend unit tests (3,227 passed, 1 skipped), frontend unit tests (3,040
  passed) and `database` `npm test`, all green.

## F2-learning

Branch `codex/spec-fix2learning`. Twelve audited SPEC gaps in the learning
area (items 11 and 12 were one gap, KaTeX notation). Each was checked in the
code first; all were real. Built under the project leader's speed mode (27
September 2026): complete features, lean verification, full gates at merge.

### What was built

| # | SPEC clause | Gap confirmed in code | What was built | Where |
|---|---|---|---|---|
| 1 | B.7 part 3; Appendix P Part 1 (ages), Part 8; OD-16 | Core and the browser pinned the ratio table, waffle, donut and M3/M6/M7/M8/M9-10/M13/M15/L2/M19/M20/ledger to single pilot values and narrow ages; M5 accepted only totals 10-29 | One shared age-scope policy (`V2_AGE_SCOPE`, `v2AgeScopeProblem`, `v2PayloadScopeProblem` in the synced families module) that both contracts call: each kind open across its Appendix P range, the adult pathway where the money use applies (M9/M10, M14, $6, M15, M19, M20, ledger, donut, rule builder). Generic parameters: waffle totals that divide 100, donuts up to 40 wedges, local currency only for adults. M5 gains a three-place compose form and subtraction with borrows ($1.00 - $0.37), replayed in the canonical scorer and the board (hundreds as berry flats); L2 at 8-9 is a single IF | `backend/src/services/v2SegmentFamilies.ts`, `v2LessonDocument.ts`, `v2VisualScorer.ts`, `frontend/src/rebuild/learning/lessonDocument.ts`, `placeValueModel.ts`, `PlaceValueBoard.tsx`; fixtures 26-29 |
| 2 | B.7 part 1; Appendix A Part 1 | `SITUATIONAL_CHART_KINDS` lacked 13 learner-facing kinds | Candlestick, Marimekko, treemap, sunburst, icicle, box plot, connected scatter, bump, org chart, swimlane, Venn (counted), Ishikawa and mind map: data rules, Show-as-table rows, accessible facts, Appendix A subject/age gates and in-house SVG renderers (hue plus pattern) | `v2ChartModel.ts` (+ generated copy), `charts/TeachingChart.tsx`; fixtures 38-40 |
| 3 | Appendix C Stage 2; B.22, B.26, B.27; G.2 | v2 ran only gates 11-16; the 0209 manifest never required 17 or 18; gates 2-4 were v1-only | `carriedGates.ts` runs gates 2 (tier vocabulary, accent-aware), 3 (facts.yaml denominations for real-currency trays), 4 (worked steps and keys re-executed, change and unit prices), 17 and 18 (the v1 measurement code over the raw v2 document) inside `runV2DocumentGates`; `V2_MANIFEST_GATES` lists them; migration 0217 moves the v2 required gates into `forge_v2_manifest_gates` rows read by `publish_v2_lesson_version`, and the gate-parity tool keeps both lists equal | `coursegen/src/v2/carriedGates.ts`, `gates.ts`, `release.ts`, `agent/tools/check-forge-release-gate-parity.mjs`, red-team plans |
| 4 | Appendix P M8, $4, $8 | Payload income/spending only; rubric `schema: 'change'`; compare a dead distractor | Schema-neutral payload (two quantities, the unknown's label); private rubric names one of change/group/compare/ratio and the slot of each quantity; scorer grades schema (structure), slots (structure vs value) and an answer that must be a relation of the quantities; four-way picker and slot row (shared `SchemaSlotsVisual`) | `v2SegmentFamilies.ts`, `v2VisualScorer.ts`, `SchemaDiagramBoard.tsx`, `pizarron/visuals.tsx`; fixtures 09, 30 |
| 5 | Appendix P L2, L6, $9, Part 4.6 | Fixed AND/OR choice; flowcharts walk-only | `logic.rule-builder.v2`: condition/action tiles, IF-THEN-ELSE, levels single/connective/nested by age, graded by behaviour on 5-10 hidden scenarios. Flowchart and spend-decision build mode (13+): the learner places question and outcome nodes; Core evaluates the tree on hidden cases (`operation.build-flowchart.v1`) | families, scorer, `buildBoards.tsx`; fixtures 32-35 |
| 6 | Appendix P $6, M14 | No comparator | `money.unit-price.v2`: 2-3 offers on the shared ratio lines, the unit always shown, exact rational unit prices within half a hundredth and the strictly cheapest offer | families, scorer, `buildBoards.tsx`; fixture 31 |
| 7 | Appendix P M1, Part 4.4 | Every run started at concrete | `cpaEntryStage` from primary-KC mastery and the last first-unaided stage; pinned on the run (`lesson_v2_runs.cpa_entry_stage`, 0216); skipped stages restore like attempted ones, are never graded (`CPA_STAGE_SKIPPED`); `entry_stage` rides the receipt | `courseLessonEvidence.ts`, `learn.ts`, `v2LessonDocument.ts` |
| 8 | Appendix P Part 8; Appendix C 1.4 | No parity, coverage, pre/post or A/B | Grade route takes the browser scorer's advisory verdict (never graded with) and stores `client_agree`; the browser reads answers with the canonical scorer on the one synced semantic payload (`v2ScorerPayload.ts`); `item_phase` and `variant` segment fields; a committed tap/locale coverage snapshot (`teaching-visual-coverage.mjs`, in spec:check); 0216 aggregates; staff panel section | `v2ScorerPayload.ts`, `learningQaSignals.ts`, `LearningQaSignals.tsx`, `LessonRoute.tsx` |
| 9 | Appendix C 1.3 | No B.1/B.2/B.4 signals, no defect escapes | Server-only events (placement commit ok/failed, prerequisite refused/passed, lesson update required, scorer parity miss), 0218 event CHECK and practice mapping, `learning_qa_rates`, `content_defect_escapes` with an audited recorder and a rate; staff entry form | `insights.ts`, `learn.ts`, `placement.ts`, `admin.ts`, 0218 |
| 10 | Appendix P M2, $2, L12 | No count-on, no count-up sequence, no cue ticks | Count-on hops on the whole-number line (graded as a hop sequence); making change records the count said after each coin, with `count_from_zero` diagnosed; message lists carry cues and Core stores cue hits beside d-prime | scorer, `NumberLineBoard.tsx`, `familyBoards.tsx`; fixtures 36-37 |
| 11-12 | Bible 05 §5; Appendix P Parts 5-6 | No KaTeX | katex 0.18.9 (MIT, pinned), loaded lazily by the shared `MathExpression`; worked steps may carry whitelisted TeX notation and a function machine may declare notation for the learner's rule (`visual.math-notation.v1` in all three copies); spokenText is the accessible name, pt-BR decimals render as `{,}`; the fraction-and-exponent worked example is the audit state (`workedexample?notation=1`) | `pizarron/MathExpression.tsx`, `WorkedExampleBoard.tsx`, `FunctionMachineBoard.tsx` |

### Verification (local)

- Native PostgreSQL 17.6 (owned cluster, port 15810): `database/scripts/verify-learning-r2-postgres.py` applies all 218 migrations (217 before the merge renumbering) and passes 8 checks (widened receipt CHECK accepts and refuses; entry-stage column; the five 0216 aggregates; QA events and rates; audited defect escapes; the v2 manifest gate rows and function body).
- Core: `forge-v2:check` 120 rows, 210/210 graded segments pass the behaviour gate; focused vitest (lesson document, age scope, scorers, build scorers, chart model, learn route incl. parity and CPA entry, learning QA signals, placement, insights, quality); full `eslint .` clean; type-check clean.
- Forge: v2 emit, carried gates, release tests; every red-team plan blocks on its own gate; lint and type-check clean.
- Frontend: focused vitest (contracts, boards, charts, notation, lesson route, staff panel); lint of `src/rebuild` and the lesson route clean; type-check clean.
- Root: `spec:check`, `secrets:check`, i18n gate, `instruments:check`, gate-parity tool and its test.
- Not run here (orchestrator, per merge): browser matrices, `audit:rebuild`, full suites.

### Decisions taken with the SPEC's conservative default (owner questions)

1. **Adult reach per kind.** The adult pathway opens only where Appendix P's money use applies to adults (listed above); fraction, place-value, bar-model, schema and function-machine representations stay child-only.
2. **Unit-price tolerance.** A typed unit price meets within half a hundredth of the exact rational value (a rounded cent); the key stores the exact rational.
3. **Count from zero is a review.** Right coins counted from zero are graded review with `count_from_zero` (the rule is to count up from the price).
4. **M1 entry thresholds.** pKnown < 0.6 concrete, < 0.85 pictorial, otherwise abstract; the last first-unaided stage can only raise the entry. Concrete when either read fails.
5. **Carried gate 3.** Only the market currency's facts.yaml denominations are accepted for real-currency trays; USD and BRL trays block until their facts are recorded.
6. **Gate 17 red team.** A v2 plan cannot carry a reward field, so the blocking case is proven on a raw document in a unit test; plans exercise its review path.
7. **KaTeX pre-render.** Forge does not pre-render TeX server-side (katex is a frontend dependency only); the browser renders lazily with the plain expression as fallback.
8. **QA events and consent.** The B.1/B.2/B.4 events ride the existing learning-quality practice and consent gate, so rates exclude learners without analytics consent.

### Migrations (renumbered by the orchestrator at merge)

- `0216_v2_learning_signals_r2.sql` (contract by classifier, widening in fact: apply before this Core release)
- `0217_v2_manifest_carried_gates.sql` (contract: after the Forge release that attests the carried gates)
- `0218_learning_qa_events.sql` (contract by classifier, widening in fact: apply before this Core release)

### What remains

- Browser matrices and `audit:rebuild` (text-fit, proportion and copy-budget over the new boards, charts and the notation state) at merge.
- Screenshots of the new boards were not taken in the lane.
- USD and BRL denomination facts for real-currency trays (gate 3).

### F2-learning-finish (lane close)

- Synced with `codex/spec-migration-s02` (already up to date, no conflicts).
- Adversarial pass over the 12 gaps: rebuilt UI imports only shared controls (no legacy component), every new component declares `data-copy-role`, new copy exists in en-US, es-MX and pt-BR, and the new admin routes sit behind `requireRole(admin)` plus `manage_content`.
- The full unit suites found two lane defects, now fixed: three class names without a stylesheet rule (`lf-chart-box--step`, `lf-math-katex`, `lf-math-fallback`; design-classes test) and a test helper typed too narrowly for the M8 slots answer (backend `type-check`).
- Final local gates: type-check, lint and full unit suite green in backend (3238 passed, 1 skipped), frontend (3065 passed) and coursegen (830 passed); database `npm test` 48 passed; root `spec:check`, `secrets:check`, `tools:test` and the i18n gate green.
- Status of every lane row: implemented and locally verified, not accepted, not released, not pushed.

### F2-learning merge integration

- Merged into `codex/spec-migration-s02` after the identity-site lane. The
  only conflict was this record (both lanes added it); both sections are kept.
- Migrations renumbered by one to follow the identity-site lane's `0215`:
  `0215_v2_learning_signals_r2` -> `0216`, `0216_v2_manifest_carried_gates`
  -> `0217`, `0217_learning_qa_events` -> `0218`. File references and bare
  number mentions (Core and browser report comments, REQUIREMENTS B.7 and
  B.22, this section) were rewritten. All three stay under 23,000 bytes.
  No SQL object overlaps with `0215_onboarding_discovery_metrics`, so no
  reconciling migration was needed.
- Integration defect: the main checkout's `frontend/node_modules` did not
  contain `katex` (the lane's worktree had its own), so the frontend
  type-check failed on `MathExpression.tsx`. Fixed by `npm install` from the
  merged lockfile; `package.json` and `package-lock.json` are unchanged.
- Checks on the merged tree: `typecheck:all`, `lint:all`, `spec:check`,
  `secrets:check`, the i18n gate, `tools:test` (389 passed), backend (3,257
  passed, 1 skipped), frontend (3,071 passed), coursegen (830 passed) and
  `database` `npm test` (48 passed), all green. Browser matrices and
  `audit:rebuild` on the new boards remain open, as recorded above.

## F2-mentor

Branch `codex/spec-fix2mentor`. Four audited SPEC gaps in the Mentor area.
Each was checked in the code first; all four were real.

### What was built

| # | SPEC clause | Gap confirmed in code | What was built | Where |
|---|---|---|---|---|
| 1 | C.4 (memory-note system: learner note and pedagogy note); OD-18 | `PUT /tutor/internal/learner-memory` sent only the learner store to review; the pedagogy note ("what teaching works with this child") was written straight away for every linked child and independent teen, and no surface showed it | Both stores go through review whenever the reviewer is not `adult-direct`; `hold` still refuses both. Migration `memory_proposal_store` adds `store` ('learner' / 'pedagogy'), store-aware caps (1,400 / 2,200) and redefines `decide_learner_memory_proposal` to apply an approved note to its own store through `write_learner_memory_checked`. `parkLearnerMemoryProposal` parks one row per store in a single insert. Both queue routes return each proposal's `store` and `current.learner` / `current.pedagogy`; the decision route reports the store it applied. Oracle parses `pending` as the closed store set. The Family console (`ChildMentorTalks`) and the teen card in rebuilt Settings show both notes ("Who they are" / "How they learn best"), each with its current note and approve/delete per proposal | `database/migrations/0219_memory_proposal_store.sql`, `backend/src/routes/tutor.ts`, `backend/src/services/tutorData.ts`, `oracle/src/core/client.ts`, `frontend/src/rebuild/family/console/ChildMentorTalks.tsx`, `frontend/src/rebuild/memory/MemorySelfReview.tsx`, `frontend/src/routes/app/profile/TeenMemoryReviewSetting.tsx` |
| 2 | Bible 08 §2 layer 5, §4, §9; C.13, C.14 | `TutorTurnSchema` had no suggested replies; chips were only board / hint / tell / explain, so a 6-9 learner without a microphone typed every answer | Optional `replies` on the turn. Oracle keeps at most three within the `option` Copy Budget (5 words for tiers 1-2, 8 for tier 3, x1.25 es/pt, one sentence), drops answer statements, moderates them in the same call as `say`, and asks Core's new `POST /tutor/internal/segments/:id/reveal-check` (`revealsAnswerKey`) whenever an activity is open; a revealing chip is dropped, a failed check drops every chip, nothing is retried. C.14 scaffolded prompts carry system-written sentence stems per concept family. The turn frame and the resume redraw forward `replies`; `TutorTurnState.replies` feeds `MentorScreen`, which renders them after the board chip and before hint/tell, capped at three, sent as the learner's own words (chips before the field for 6-12). `honesty:check` now pins the chip cap, the option budget and the Core route | `oracle/src/tutor/turnSchema.ts`, `feedbackHonesty.ts`, `orchestrator.ts`, `prompt.ts`, `scripted.ts`, `selfExplanation.ts`, `oracle/src/ws/*`, `backend/src/routes/tutor.ts`, `frontend/src/rebuild/mentor/session/useTutorSocket.ts`, `frontend/src/rebuild/mentor/screen/MentorScreen.tsx`, `agent/tools/check-mentor-honesty-parity.mjs` |
| 3 | Block C Real-Time Interaction Standard; Appendix D §2.6; C.10 | No guardian route or surface exposed mastery / remediation decisions or their evidence; the controller did not record discounted answers | The controller records, per KC and session, whether a correct answer was set aside as too fast or hint-assisted and attaches it to every consequential decision (snapshot-safe). Migration `trajectory_discounted_evidence` adds `evidence_discounted` (kept only with the evidence; a trigger fires after the OD-9 consent trigger). `GET /tutor/kids/:kidUserId/mastery` (verified guardian) and `GET /tutor/mastery` (learner) return per skill the displayed state (`not_yet` / `provisional_mastered` / `recheck_due`, the map's own rule), the latest mastery / remediation / rescue / withdrawal decision with observations, requirement, what did not count and the date, and the next re-check; numbers and closed labels only. "What the Mentor decided" card in the Family console child page and, read-only, in the learner's learning map sheet, as templated sentences in EN / es-MX / pt-BR | `oracle/src/tutor/controller.ts`, `database/migrations/0220_trajectory_discounted_evidence.sql`, `backend/src/services/pedagogy/masteryEvidence.ts`, `backend/src/routes/tutor.ts`, `frontend/src/rebuild/mentor/MentorDecisions.tsx`, `ChildMentorTalks.tsx`, `MentorViews.tsx` |
| 4 | Bible 08 §7, §11; 07 §4; B.8; 02 rule 21 | Band stills existed for Dina only (one pose); Rho, Zara and Liruf fell back to the avatar head crop; the `acknowledging` poses had no stage still | `scripts/render-mentor-lesson-stills.mjs` (zero spend): `MentorStage` compact on `diorama-a`, closeup-wide, held pose, virtual clock; young 343:110, teen 343:80 and square bands x light/dark x every compact-state pose of each register, for all four characters (168 stills, drafts in the manifest). `findStageStills` selects by pose, then the band's idle still; the Dina-only branch is gone. `feedback.correct.quiet` and `greet.nod` stage stills for all four characters (16). The stage preview accepts `size=compact` | `frontend/scripts/render-mentor-lesson-stills.mjs`, `render-mentor-stage-stills.mjs`, `frontend/src/rebuild/mentor/stageStills.ts`, `frontend/src/rebuild/assets/manifest.json`, `frontend/public/rebuild/mentor-stills/`, `mentor-stage/` |

### Verification (local)

- Native PostgreSQL 17.6 (owned cluster, port 15820): `database/scripts/verify-mentor-f2-postgres.py` applies all 216 migrations (220 after the merge renumbering) and passes: older proposals read as learner; store-aware caps and the closed store set; an approved pedagogy proposal writes the pedagogy store with its ledger row; reject moves nothing; a stale proposal stays pending; a learner proposal still writes the learner store; browser roles cannot decide; the E.10 messaging scan stays clean; the discounted label follows the evidence, an unknown label is refused; both migrations replay without changing rows.
- Core (vitest, focused): `tutor.test.ts` (336, including kid, linked child, linked teen, independent teen, hold and adult for both stores over real HTTP through the Express app, and the mastery routes' guardian gate, 502s and projection), `pedagogy-routes.test.ts` (reveal-check), `masteryEvidence.test.ts`; type-check and lint of touched files.
- Oracle (vitest, focused): `coreClient`, `controller`, `snapshotFence`, `orchestrator` (reply chips screened, judged with `say`, key-checked, dropped on a failed check, none on non-asking or blocked turns), `feedbackHonesty` (budget, parity with the frontend Copy Budget, C.14 stems within budget in 3 locales), `prompt`, alliance, live-session, hardening, session, park-store and admission suites; type-check and lint.
- Frontend (vitest, focused): family console, memory self-review, teen setting, Mentor screen (chips first for 6-9, field first for 13+, three-chip cap), socket parsing, map sheet decisions, `MentorDecisions`, stage stills, copy budget, asset gate (OCR test timeout raised for 302 rasters); type-check and lint.
- Root: `spec:check`, `secrets:check`, `honesty:check` (+ its node tests), `governance:check` (two Tier 1 change rows recorded, sign-offs pending), i18n gate, `check-migrations`, migration phase check.
- `check-rebuild-assets` passes (329 class B assets, 302 rasters text-free by OCR). `verify-compact-stage` passes all 10 configurations after the script's answer-control selector was updated (`.lf-learning-control` was renamed by another lane; the stage checks themselves were unchanged).
- Not run here (orchestrator, per merge): browser matrices, `audit:rebuild`, full suites, the disposable-stack GoTrue/PostgREST real-HTTP run.

### Decisions taken with the SPEC's conservative default (owner questions)

1. **Pedagogy-note review for linked teens.** A linked teen's pedagogy note goes to the verified guardian (the same reviewer as the learner note), not to the teen.
2. **Parent evidence and analytics consent.** Decision evidence is recorded only where the OD-9 `analytics.mentor_integrity_evidence` practice applies (the existing trigger). Without it the card shows the state and the "N correct in a row" streak from the answer ledger, but no logged decision.
3. **Chip order.** The board chip keeps first place (08 §2), then the Mentor's likely answers, then hint / tell / another way, capped at three. Revised at F2-mentor-finish: C.13 mandates an explicit "just tell me" escape hatch, so while the hint ladder applies the tell chip always keeps its place and the chips cut to fit are the last ones that are not it (three likely answers show as two answers plus "just tell me").
4. **Band still fallback.** When a pose has no band still, the band shows the same character's idle band still, never the avatar head crop. Dina's first single-pose capture remains as her last fallback.

### Remaining

- Owner visual review of the 184 new character renders (07 §7, OD-14); all are drafts.
- Tier 1 change-record rows need both leads' sign-offs before release.
- Disposable-stack real-HTTP evidence (GoTrue, PostgREST) for the pedagogy-note gate and the mastery routes; regenerated `database/types/database.ts` for the two new columns (`db:types`).
- Live Mentor evidence that the model offers useful replies (OD-23: no paid run here).

## F2-mentor-finish

Final summary of the mentor lane (branch `codex/spec-fix2mentor`). The four audited gaps are built: pedagogy-note review (C.4, OD-18), reply chips (Bible 08 §2, §4, §9; C.13, C.14), the evidence behind each Mentor decision (C.10, Appendix D §2.6) and band stills for every Mentor in every compact pose (Bible 08 §7, §11; 07 §4; B.8). Migrations: `0219_memory_proposal_store.sql`, `0220_trajectory_discounted_evidence.sql` (numbers are this worktree's; the orchestrator renumbers at merge).

- **Sync.** `codex/spec-migration-s02` had not moved past this lane's base (`9463d3c2`); the merge was a no-op.
- **Adversarial pass.** Authorization stays at the server: the queue and decision routes, `GET /tutor/kids/:kidUserId/mastery` (verified guardian only, refused before any evidence read) and the internal reveal-check route (internal key, own session's segment only) each have refusal tests. The rebuilt surfaces import only shared controls; the two `routes/app` files touched are the thin route wrappers that mount rebuilt components. Copy exists in EN, es-MX and pt-BR (i18n gate green). One gap found and fixed: three likely answers used to push the C.13 "just tell me" chip off the screen; the tell chip now always keeps its place while the ladder applies (MentorScreen, with a test).
- **Fixes from the full suites.** Three Oracle test fixtures and one Core test helper did not type-check against the lane's new fields (`evidenceDiscounted`, `discountedCorrect`, the reveal-check body); fixed. The asset gate's first case runs OCR over all 302 live rasters (about 80-90 s alone), so its timeout is raised to 300 s like the OCR case.
- **Verification (full unit suites, once).** Core: type-check, lint, 139 files / 3,221 tests green. Oracle: type-check and lint green; 62 of 65 files green in the parallel run, and the 3 reds (`hardening`, `live-session`, `boot-skills`: boot hooks timing out while three service suites ran at once) pass alone (6 files, 117 tests, together with the fixed fixtures). Frontend: type-check and lint green; 264 of 265 files / 3,055 tests green, and the one red (the asset gate's OCR timeout) passes alone after the timeout change; the Mentor screen folder (8 files, 156 tests) is green after the escape-hatch change. Root: `spec:check`, `secrets:check`, `honesty:check`, the i18n gate and `database` `npm test` green.
- **Still open.** Owner visual review of the 184 draft renders (07 §7, OD-14); both leads' sign-offs on the two Tier 1 change rows; disposable-stack GoTrue/PostgREST evidence for the pedagogy-note gate and the mastery routes; `db:types` for the two new columns; live evidence that the model offers useful replies (paid run, OD-23 reserves it for the owner). None of C.4, C.10, C.13, C.14 or B.8 is closed: implementation and local verification only.

### F2-mentor merge integration

- Merged into `codex/spec-migration-s02` after the identity-site and learning
  lanes. Migrations renumbered by four to follow the learning lane's `0218`:
  `0215_memory_proposal_store` -> `0219`, `0216_trajectory_discounted_evidence`
  -> `0220`; no other migration redefines `decide_learner_memory_proposal` or
  touches `tutor_trajectory_step`, so no reconciling migration was needed.
- Defect found at merge: `0219_memory_proposal_store` declared
  `@phase: expand` while it drops the two inline 0068 caps and adds the
  store-aware CHECK, which `check-migration-phase` classifies as a narrowing,
  so `database` `npm test` failed (the lane's record reported it green). It is
  now declared `@phase: contract` with an `@after-release: none` line saying
  why no running write is refused (learner proposals keep exactly 1,400) and
  that it is applied by hand before the Core release that parks pedagogy
  proposals. The SQL is unchanged.
- Conflicts: the asset manifest (the identity-site lane's `brand.mark` and this
  lane's acknowledging stage stills, both kept: 330 class B assets), this
  record (sections kept side by side) and the B.7 / B.8 rows of
  REQUIREMENTS (B.7 from the learning lane, B.8 from this lane).
- Checks on the merged tree: `typecheck:all`, `lint:all`, `spec:check`,
  `secrets:check`, the i18n gate, `honesty:check`, `governance:check`,
  `tools:test` (393 passed), backend (3,270 passed, 1 skipped), Oracle
  (1,738 passed), frontend (3,094 passed) and the `database` migration,
  phase and node-test gates (48 passed), all green. `railway-migrate.test.mjs`
  (fake Railway transport, one bash spawn per migration) was still running
  after 30 minutes on this Windows machine and is not counted here.
