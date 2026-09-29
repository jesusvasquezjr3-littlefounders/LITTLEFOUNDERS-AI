# Gap-fix round 5

Audited SPEC gaps closed in the final push of the SPEC migration, one lane per
section. Implementation, local verification, acceptance and release are
separate statuses: nothing here is accepted or released.

## F5-family

Branch `codex/spec-fix5family`. Two audited gaps, both checked in the code
first and both real:

- **The three UI audits never rendered most Block D panels.** The real-app
  audits (`frontend/scripts/audit-rebuild.mjs`) measure only the states
  `frontend/scripts/audits/lanes/family.mjs` lists. Every per-child Block D
  panel on `/family` (corrections, streak pauses, Share places, the
  independence ladder, the Tutors, research, the data policy) starts closed
  and loads only when pressed, and no state pressed it; the synthetic Core
  answered none of their Tutor-side reads. On `/tasks` the reflective prompt
  (D.23), the "not yet" reason form (D.18), the child's reward ask and level
  ask were never opened; on `/family-wallet` the bonus settings (D.11) and the
  freeze confirmation were never opened, and `card()` was never frozen, so no
  frozen card (D.1/D.7) was measured for either reader.
- **Nothing scheduled the three quarterly Block D reviews.** Only the
  Appendix G recalibration had a due date and a `--strict` release check. The
  threshold log, the no-unbacked-guarantee audit and the scope-disclosure
  audit had no due date, no overdue check and no trigger; an engineering
  pre-audit row satisfied their gates.

### What was built

| # | SPEC clause | What was built | Where |
|---|---|---|---|
| 1 | Bible 02 §7 item 10, 06 §7, 03 §5; CLAUDE.md audit rule; Appendix H Part 3 Stage 4; D.1, D.2, D.5, D.7, D.11, D.14, D.17, D.18, D.21, D.22, D.23 | The synthetic Core answers every Tutor-side read these panels make, in the shapes the client validators accept (`familyHubApi`, `familyMoneyApi`, `moneyHabitsApi`, `familyAutonomyApi`, `governanceApi`, `bankingApi`): the Tutors of a child (this Tutor, a second verified Tutor, a pending second Tutor, one who stepped away), goals with provenance, corrections and goal moves, approved rewards to deliver, the chore streak with an upcoming pause, Share places and gifts (pledged and given), a level-2 ladder with the Tutor's change, the child's research answer, and the bonus framing per child (per ten for the young child, a percentage for the teen). New scenarios: `money-child-frozen` (a Tutor froze it, read by the child), `money-tutor-frozen` (the child froze it, read by the Tutor), `money-child-level2`. 21 new press-opened or frozen states: `/family@wallet-corrections`, `@goal-move`, `@streak-pauses`, `@share-destinations`, `@autonomy-ladder`, `@co-tutors`, `@co-tutors-leave`, `@research-consent`, `@data-policy`; `/tasks@queue-reflection`, `@queue-not-yet` (press "not yet", then continue to the reason form), `@reward-ask`, `@level-ask`, `@level-step-down`; `/family-wallet@bonus-settings`, `@bonus-settings-teen`, `@freeze-confirm`, `@tutor-frozen`, `@tutor-frozen-holds`, `@child-frozen`, `@child-frozen-why`. Per-child panels are pressed only after the token-bound remount (`SOCIAL.settled`); Wallet panels after the Tutor's freeze card has loaded. The child's Spend pocket now covers the cheaper reward, so the reward ask is enabled | `frontend/scripts/audits/lanes/family.mjs` |
| 2 | "Add stable hooks where a toggle has none" | `data-queue-answer` (yes / not-yet / remove) on the queue's decisions, `data-reward-ask="open"`, `data-level-control` (ask / step-down), `data-freeze-control` (ask on the Tutor's Freeze; holds on both details toggles), `data-guardian-control="leave"`, `data-goal-control="move-out"` | `frontend/src/rebuild/family/DecisionQueue.tsx`, `RewardAsk.tsx`, `MyLevel.tsx`, `CoGuardians.tsx`, `WalletCorrections.tsx`, `rebuild/banking/TutorFreeze.tsx`, `CoinAccount.tsx` |
| 3 | 06 §3.1 (first view: 25 words at 6-9, 40 adult), §4 layering, §4.4 "Why?"; D.7 | Findings fixed at the root. The frozen child card read 40 words on the first view against 25, the Tutor's 57 against 40: the hold list was always open while frozen. Now what a freeze holds is one press away in both states, for both readers; the Tutor still sees it at the confirmation (the point of action). While frozen, the child's toggle reads "Why?" (new key `whyFrozen`, young/transition/teen, three locales) and opens who froze it, what pauses, that waiting coins wait (moved from the pocket list) and, for a Tutor's freeze, that only the Tutor can lift it (`freeze.owner`). The first view keeps "Frozen" on the card and never offers Unfreeze unless the server allows it. Measured after: child 25/25 (en), 27/32 (es-MX), 27/32 (pt-BR); Tutor 36/40, 42/50, 41/50 | `frontend/src/rebuild/banking/CoinAccount.tsx`, `TutorFreeze.tsx`, `src/i18n/*/coinAccount.json` |
| 4 | D.7 (no copy implies what the system does not enforce) | Found while measuring the frozen card: the child's page said "You can spend 30 more coins for now." while the freeze holds reward requests. The spending-limit section is not shown while a freeze holds `rewards`; it returns when the freeze ends (a hold list without `rewards` keeps it) | `frontend/src/rebuild/banking/CoinAccount.tsx` |
| 5 | 03 §3 (at most three accent buttons a screen); 02 type scale | `/tasks@level-ask` and `@level-step-down` showed four accent buttons: every affordable reward's "Ask" was an accent. The ask that opens the form is now a plain button; the accent is the form's send. The Tutor ladder's level name was 22 px, off the scale: it now uses `--type-title` | `frontend/src/rebuild/family/RewardAsk.tsx`, `familyAutonomy.css` |
| 6 | Appendix H Part 1.4, Part 1.3; Part 3 Stage 7; D.7, D.11, D.12, D.17, D.20 | `agent/tools/block-d-review-cadence.mjs`: each log's table has a `Kind` column (`engineering` or `human`; only `human` counts) and a machine-read `First human review due: 2027-01-15`. The next review is due on that date until a human review is recorded, then 90 days after the latest one; the threshold log goes to 365 days after four human reviews (quarterly for the first year, then yearly). `check-block-d-thresholds.mjs`, `check-no-unbacked-guarantee.mjs` and `check-block-d-scope.mjs` report the due date, warn when overdue and fail with `--strict`; `release-readiness.sh` runs all three with `--strict`, next to the Appendix G recalibration. The existing engineering rows are marked `engineering` | `agent/tools/block-d-review-cadence.mjs`, the three gates, `agent/tools/release-readiness.sh`, `docs/operations/BLOCK-D-THRESHOLD-LOG.md`, `NO-UNBACKED-GUARANTEE.md`, `BLOCK-D-SCOPE-STATEMENT.md`, `README.md` |
| 7 | Appendix H Parts 1.3/1.4 (calendar trigger) | `.github/workflows/block-d-reviews-quarterly.yml` (cron `0 9 1 1,4,7,10 *`, `workflow_dispatch`, `issues: write`, no production access) runs `agent/tools/block-d-reviews-quarterly.mjs`, which opens one `block-d-review` issue a quarter listing the three reviews with owner (Pedagogical Lead with Product; Pedagogical Lead with the Engineering Lead; Product with the Pedagogical Lead), last human review, next due date and state (overdue, due this quarter, not yet due). A malformed log still writes the issue and turns the run red | `.github/workflows/block-d-reviews-quarterly.yml`, `agent/tools/block-d-reviews-quarterly.mjs` |
| 8 | Tests | `block-d-review-cadence.test.mjs` (the schedule, engineering rows never count, a human review moves the date, yearly after four, overdue warns and fails under `--strict`, malformed logs, the live logs, the readiness wiring) and `block-d-reviews-quarterly.test.mjs` (the issue for the live logs, overdue and not-yet-due states, a malformed log, the workflow lint); `blockDThresholds.test.ts` pins the due line and the Kind of every history row; `CoinAccount.test.tsx` pins the frozen layering, the owner line in the "Why?" panel, the limit held back while rewards are held, and the Tutor's list shown at the confirmation and one press away while frozen. `verify-coin-account.mjs` presses "Why?" before reading the attribution; `familyAuditCore.test.ts` pins every synthetic-Core read of the new audit states against the pages' validators | `agent/tools/*.test.mjs`, `backend/src/__tests__/blockDThresholds.test.ts`, `frontend/src/rebuild/banking/CoinAccount.test.tsx`, `frontend/src/rebuild/family/familyAuditCore.test.ts`, `frontend/scripts/verify-coin-account.mjs` |

Server boundary: no Core route or migration changed. The new synthetic reads
mirror existing Core routes, which already refuse a non-guardian (the family
link checks) and, for the child, a Tutor's freeze (`canChange`).

### Verification (local)

- Frontend: `type-check`, `lint`; focused vitest over `src/rebuild/banking`,
  `src/rebuild/family`, `auditCoverage` and `auditAgeBand` (32 files, 417
  tests). New `src/rebuild/family/familyAuditCore.test.ts` loads the family
  lane's synthetic Core and runs every read the new states depend on through
  the pages' own validators, in three locales (a refused shape would make the
  audit measure an error notice instead of the panel).
- Backend: `type-check`, `lint`, `blockDThresholds.test.ts` (11 tests).
- Root: `spec:check`, `secrets:check`, `check-i18n.sh`; `node --test` over
  the Block D gate, cadence, quarterly-issue and readiness tests (66 tests);
  the three gates with `--strict` report "next review due 2027-01-15".
- UI audits: the first pass measured the frozen cards on a partial
  `audit:rebuild` run (the figures in row 3); the full family-lane matrix
  (three locales, two themes, 320/375/768/1280) did not complete on this
  shared machine and was not rerun under speed mode. The orchestrator's
  final audit run is the evidence for the 21 new states.

### Owner questions (conservative default applied)

- The first human review date of all three logs is 2027-01-15, the date the
  Appendix G recalibration already uses for "one quarter after the release
  that ships S07.3". The release date is not set; when it is, move the three
  dates (and the Appendix G one) to one quarter after it, never later.
- While frozen, who froze the card is one press away ("Why?") on the child's
  first view, because the 6-9 first-view budget (25 words) cannot hold the
  attribution as well; the card still says "Frozen" and never offers
  Unfreeze. If the owner wants the attribution on the first view, another
  first-view line has to go.

### What remains

- Acceptance: a human review of the frozen card (child and Tutor) and of
  the new audit states' screenshots; the owners' first human reviews on
  2027-01-15 or one quarter after release.
- The workflow has not run on GitHub (nothing pushed).
- The full `audit:rebuild` family-lane matrix over the 21 new states
  (orchestrator's final run); any finding it reports is fixed at the root.
