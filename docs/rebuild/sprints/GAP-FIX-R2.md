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
