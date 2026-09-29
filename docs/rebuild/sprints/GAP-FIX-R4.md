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
