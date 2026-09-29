# Gap-fix round 4

Lane records for the fourth gap-fix round of the SPEC migration. Each lane
appends its own section. Statuses follow the ledger: implementation, local
verification, acceptance and release are separate. Nothing here is
accepted or released.

## Checkpoint F4-mentor

Branch `codex/spec-fix4mentor`. One audited gap: the Extended Mastery
Engine's Stage 7 kill switch.

### The gap, checked in the code first

The gap is real. Appendix F Part 3 Stage 7 gives the Extended Mastery Engine
an explicit rollback condition: the Mastery Declaration Reversal Rate over 8%,
or the Corroborating-Evidence Compliance Rate below 100%. The response is to
revert to single-observation BKT thresholds for the affected KCs until the
cause is found. Appendix F §1.3 lists the engine in the Kill-Switch Trigger
Log. Before this checkpoint:

- `summarizeMasteryEvidence` (`backend/src/services/pedagogy/mentorIntegrity.ts`)
  computed one aggregate reversal rate. It only printed "roll affected KCs back
  only through the logged operator procedure". There was no per-KC rate to
  decide which KCs to roll back.
- The only rollback was the Oracle env var `TUTOR_CORROBORATION_ROLLBACK_KC_KEYS`,
  read once at boot. `grep` found no `mentor.kill_switch.mastery.*` action in
  `backend/src` and no logging of the variable in `oracle/src`, although the
  `env.ts` comment said "Every use is logged in the Kill-Switch Trigger Log".
- The C.24 `kill_switch.open` signal (which reads `audit_logs mentor.kill_switch.*`)
  could not show a mastery-engine trip. The Behavioral Telemetry Layer, the
  Alliance Controller, the spaced-review router and the live-content judge
  already had Core-evaluated, audit-logged rollbacks.

### What was built

| # | SPEC clause | What was built | Where |
|---|---|---|---|
| 1 | Appendix F Part 3 Stage 7 ("for affected knowledge components"); §1.1; C.10 | `summarizeMasteryEvidence` now returns `byKc` (per KC: triggers, compliance misses, compliance rate, `underRollback`, declarations, reversals, reversal rate and status), with the 20-declaration floor applied to each KC. It also returns `unattributedMisses` (compliance misses on a move with no KC). A per-KC defect line is added for each KC over the ceiling. The aggregate numbers are unchanged. | `backend/src/services/pedagogy/mentorIntegrity.ts` |
| 2 | Stage 7 ("every new real-time component carries an explicit, pre-defined automatic-rollback condition"); §1.3 Kill-Switch Trigger Log | `evaluateMasteryKillSwitch` (pure) trips a KC whose own reversal rate is over 8%, or that has any compliance miss in the trailing 14-day window. `getMasteryKillSwitch` works like `killSwitchCacheMs` and caches its result for 10 minutes per process. It reads the audit trail, re-evaluates over rows after the latest resolution (at most the 90-day reversal window), maps KC ids to `kc.key`, and writes `mentor.kill_switch.mastery.triggered` with the kc keys, causes and per-KC numbers (no learner ids, no text). The trip holds until `mentor.kill_switch.mastery.resolved`. While it is open, a newly tripping KC is added with another trigger row, and a KC already in force is not logged again. A failed read trips nothing, is not cached, and keeps KCs already in force. `resolveMasteryKillSwitch`, `masteryTripInForce` and `masteryKillSwitchLog` are also new. | `mentorIntegrity.ts` |
| 3 | Stage 7; the Oracle context contract | New negotiated context field `corroborationRollbackKcKeys`: added to Core's and Oracle's `CONTEXT_OPTIONAL_FIELDS` (kept in parity by `telemetry:check`) and to Oracle's strict `SessionContextSchema` (at most 200 `kc.key`-shaped strings). It is sent only to an Oracle that announces it, and it is server-side only: it is not one of the 14 model-context fields. | `backend/src/routes/tutor.ts`, `services/pedagogy/behavioralTelemetry.ts`, `oracle/src/core/client.ts` |
| 4 | Stage 7 rollback applied; C.10 | `corroborationRollback(envKeys, coreKeys, plan)` builds the union of Core's keys and the env override. The orchestrator passes the union to the controller and logs one line per session when a rolled-back KC is in the plan, with its source (`core`, `env`, `core+env`). | `oracle/src/tutor/controller.ts`, `oracle/src/tutor/orchestrator.ts` |
| 5 | §1.3 Kill-Switch Trigger Log; C.24 | `tutor:integrity-report` gains `--resolve="<root cause>"` (same as `telemetry-report`). It also prints the per-KC table of KCs that meet the condition and the engine's Kill-Switch Trigger Log with resolution times (in `--json` too), and it counts an unattributed compliance miss as a defect. The dashboard's `kill_switch.open` reading already parses every `mentor.kill_switch.<component>.*` action, so a mastery trip shows as `component:mastery` until it is resolved. This is now pinned by a test. | `backend/src/scripts/mentor-integrity-report.ts`, `backend/src/__tests__/mentorQuality.test.ts` |
| 6 | C.22 Tier 1 change record | New rows for `mentor.non_negotiables` and `measurement.stage7_and_thresholds` (origin human, both sign-offs pending). No threshold value changed. | `docs/rebuild/mentor/governance/tier1-change-record.json` |
| 7 | Documentation | MENTOR-INTEGRITY-POLICY §3.3 rewritten for the automatic rollback, the operator override and `--resolve`. THRESHOLD-RECALIBRATION-LOG gains a row for the operating defaults (14 days, 10 minutes, 20,000 rows, 200 keys) and its Kill-Switch Trigger Log note. The `env.ts` comment and `oracle/.env.example` now state the truth: the env list is an override, applied as a union, logged once per session to stdout, and recorded in the log by hand. | `docs/rebuild/mentor/*.md`, `oracle/src/env.ts`, `oracle/.env.example` |

### Tests added

- `backend/src/__tests__/masteryKillSwitch.test.ts` (17): per-KC floor and
  rates; per-KC compliance and unattributed misses; `underRollback` per KC and
  in aggregate (such a decision is still compliant); a trip on one KC rolls back
  only that KC; one compliance miss trips its KC, and a legacy miss outside the
  window does not; the trip holds until resolved, and after resolution only data
  since the resolution counts; a KC already in force is not logged again, and a
  new KC joins the open trip; each failed read (audit, trajectory, kc map) trips
  nothing and is not cached; a failed trajectory read keeps KCs already in force;
  an unattributed miss opens one logged trip; the resolution row.
- `backend/src/__tests__/tutor.test.ts` (4, context route): the keys reach an
  Oracle that announced the field, and the trip is logged; a healthy window sends
  `[]`; a failed read opens the session with `[]` and no log; an Oracle that did
  not announce the field gets neither the field nor the reads.
- `backend/src/__tests__/mentorQuality.test.ts` (1): `component:mastery` stays
  open across two triggers and closes on resolution.
- `oracle/src/__tests__/controller.test.ts` (2): the union and its source per
  plan KC; Core's rolled-back KC is judged on one observation while the other
  KCs stay on the rule.
- `oracle/src/__tests__/contextFields.test.ts` (1 new, 1 updated): the field is
  announced and parsed strictly (a bad key, a non-array or 201 keys refuse the
  context).
- `oracle/src/__tests__/masteryRollbackSession.test.ts` (3): the orchestrator
  applies Core's keys and logs once with the KC and its source (no learner
  identity); a rolled-back KC outside the plan is applied but not logged;
  nothing in force means nothing is logged.

### Verification (local)

- Backend: `type-check` and `lint` green. Focused vitest green:
  `masteryKillSwitch`, `mentorIntegrity`, `mentorQuality`, and the Stage 7,
  kill-switch and mastery cases of `tutor.test.ts`.
- Oracle: `type-check` and `lint` green. Focused vitest green: `controller`,
  `contextFields`, `masteryRollbackSession`, `privacy-contract-docs`,
  `live-session`, `orchestrator`. Leftover `.boot-test-` processes were checked
  afterwards.
- Root: `telemetry:check` (context-field parity), `governance:check`,
  `spec:check` and `secrets:check` green.
- No migration: the trip lives in `audit_logs`, like the other Stage 7 switches.

### Remaining (not closed here)

- Acceptance: production data to exercise a real trip; both leads' Tier 1
  sign-offs on the two new change-record rows; owner/pedagogy review of the new
  operating defaults.
- Deploy order: Core may deploy before or after Oracle, because the field is
  negotiated. Until the new Oracle is live, only the env override applies.
- The env override itself still writes no `audit_logs` row. By policy it is
  recorded by hand, and Oracle logs it per session to stdout.

### Owner questions (conservative defaults implemented)

- M-F4-1: The SPEC sets the trigger and the per-KC response, not the operating
  values. Implemented defaults: compliance judged over a trailing 14 days (so
  legacy rows from before C.10 recorded its evidence do not trip), reversal over
  the existing 90-day window, a 10-minute cache per Core process, and one
  resolution closing the whole trip. Confirm, or set other values.
- M-F4-2: A compliance miss on a move that names no KC trips and is logged, but
  rolls nothing back, because no KC can be named. Confirm that this, plus the
  report's defect line, is the intended response.

## Checkpoint F4-mentor-finish

Lane finish for `codex/spec-fix4mentor`. The worktree was clean, and the sync
with `codex/spec-migration-s02` was already up to date (no conflicts).

### Adversarial pass: one half-built part found and built

Stage 7 says "revert to single-observation BKT thresholds for affected
knowledge components". F4-mentor applied that only in Oracle's controller.
Core's persisted side still required the C.10 corroboration (two correct
answers in a row) for the same KC, in three places:

- the learning map (`deriveNodeState`, `buildTutorMap`),
- the session planner's frontier (`rankPlanKcs`, `buildSessionPlan`),
- the parent's mastery evidence (`displayStateOf`, `buildMasteryEvidence`).

So a KC that the live session declared mastered under the rollback still showed
"in progress" on the map and in the parent's view, and the planner kept it on
the frontier.

| SPEC clause | What was built | Where |
|---|---|---|
| Appendix F Part 3 Stage 7; C.10 | `corroborationMinFor(kcKey, rolledBack)`: the C.10 minimum, or `MASTERY_ROLLBACK_CORROBORATION_MIN = 1` (the same value Oracle's controller uses) for a rolled-back KC. Only the corroboration is lowered: the posterior bar and the 3-attempt evidence bar stay. | `backend/src/services/pedagogy/bkt.ts` |
| Stage 7; §1.14 | `getMasteryRollbackKcKeys()`: a read-only accessor that returns the `kc.key`s of the trip in force. It never evaluates the condition and never writes a trigger. It reuses a fresh `getMasteryKillSwitch` verdict, otherwise it reads `audit_logs` and caches the result for 10 minutes. A failed read returns the empty set, so the stricter C.10 rule stays in force, and that result is not cached. | `backend/src/services/pedagogy/mentorIntegrity.ts` |
| Stage 7; C.10 | The map and the parent's evidence read those keys and apply `corroborationMinFor`. The planner takes the keys as a parameter. The context route now evaluates the mastery switch before it builds the plan and passes it the same keys it sends to that Oracle. An Oracle that did not announce `corroborationRollbackKcKeys` gets a plan on the C.10 rule, which matches what it will apply. | `tutorMap.ts`, `masteryEvidence.ts`, `sessionPlan.ts`, `backend/src/routes/tutor.ts` |
| C.22 | New Tier 1 change-record rows for `mentor.non_negotiables` and `measurement.stage7_and_thresholds` (origin human, both sign-offs pending). No threshold value changed. | `docs/rebuild/mentor/governance/tier1-change-record.json` |
| Docs | MENTOR-INTEGRITY-POLICY §3.3 item 3 covers the persisted side. The REQUIREMENTS C.10 row is updated and not marked Accepted. | `docs/rebuild/mentor/MENTOR-INTEGRITY-POLICY.md`, `docs/rebuild/REQUIREMENTS.md` |

Also checked, with no change needed:

- Authorization is enforced at the server. The context route is internal-only (`x-internal-api-key`). `--resolve` is an operator CLI that uses the service role. No learner-facing surface can set or clear a trip.
- No UI and no copy changed in this lane, so there is no legacy-component or locale exposure and the i18n gate does not apply.

### Tests added

- `backend/src/__tests__/masteryRollbackPersisted.test.ts` (11): the shared rule; the map state (one correct answer counts as mastered only under the rollback, a last answer that was wrong never does, and the posterior and evidence bars still hold); the planner (only the rolled-back KC leaves the frontier); the accessor (keys in force, a resolved trip, no writes, no trajectory read, a failed read keeps C.10 and is not cached, a cache hit); the map, the parent's evidence and the plan end to end, including a failed read.
- `backend/src/__tests__/tutor.test.ts` (1): on the context route, the plan drops the rolled-back KC for an Oracle that announced the field, and keeps it on the C.10 rule for one that did not.

### Verification (local, lane finish)

- Backend: `type-check` and `lint` green. The full unit suite is green (153 files passed and 1 skipped; 3,511 tests passed and 1 skipped).
- Oracle (touched in F4-mentor): `type-check` and `lint` green. The full unit suite is green (67 files, 1,767 tests). No `.boot-test-` processes were left over.
- Root: `spec:check`, `secrets:check`, `telemetry:check` and `governance:check` green (governance after the change-record rows above).
- No migration in this lane.

### Lane summary and what remains

The lane closes the one audited gap. The Extended Mastery Engine now has an automatic, per-KC, logged Stage 7 rollback: Core evaluates it and writes it to the Kill-Switch Trigger Log, it holds until an operator resolves it, and Oracle, the map, the planner and the parent's evidence all apply it. Status: implemented and locally verified. It is not accepted and not released.

What is still open:

- Acceptance needs production data from a real trip.
- Both leads must sign the four pending Tier 1 change-record rows.
- The owner must confirm the operating defaults (M-F4-1, M-F4-2).
- The env override `TUTOR_CORROBORATION_ROLLBACK_KC_KEYS` still writes no `audit_logs` row, and Core's persisted side does not know about it. Only Core's automatic trip reaches the map and the parent's view. By policy the operator records a manual override by hand.
- Deploy order: either order works, because the field is negotiated.

Owner question added:

- M-F4-3: While a KC is rolled back, the parent's mastery view uses the single-observation baseline, following the SPEC's "revert … for affected knowledge components". The conservative alternative is to keep the parent's view on the C.10 rule during a trip. The SPEC text was implemented; confirm it.
