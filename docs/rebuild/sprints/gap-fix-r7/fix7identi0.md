# Gap-fix round 7: identity-site (fix7identi0)

Branch `codex/spec-fix7identi0`. Status: **implemented and locally verified; not accepted.** Nothing here ran in production or against the shared Docker database.

## 1. Unconsented analytics on flagged sessions is measured from the event log (A.2; Appendix M 1.1, Part 2.1 criterion 3, Part 2.2(d), Part 3 Stage 5)

**The gap was real.** Appendix M 1.1 gives "Unconsented Analytics Event Rate (flagged sessions)" the data source "analytics event log filtered by origin flag" and a target of zero. Part 2.2(d) closes A.2 only when that metric reports zero for a release cycle. In the code it existed only as an adversarial test suite. `backend/src/services/identityMetrics.ts` said it was "never given a fabricated rate". The latest `public.identity_metrics` (0228, section 4) never read `learning_events` or `family_money_events`. The only flagged-population analytics figure was `onboarding_discovery_unconsented`, which counts onboarding survey answers only. If an admission trigger were disabled or bypassed in production, the staff Trust view could not have shown it.

**Built.**

- **Migration `0252_identity_unconsented_flagged_metric.sql`** (`expand`; the orchestrator renumbers it at merge). It keeps 0228's `identity_metrics` body unchanged and adds one object, `unconsentedFlagged`, for the window `[p_from, p_to)`:
  - `events`, `learningEvents`, `familyMoneyEvents`: rows of both streams whose `user_id` has an `account_safety_origins` row and whose `created_at` is at or after that origin's `created_at`. An event admitted before a later flag is excluded.
  - `accountsWithEvents`: distinct flagged accounts that have such a row.
  - `flaggedActive`: the denominator context. It counts flagged accounts seen in the window: flagged in it, signed in during it (`last_sign_in_at`, read dynamically), or with any analytics row in it. An account with an unconsented row therefore always counts as active.
  - `flagged`: all flagged accounts that existed before `p_to`.

  The function still returns counts only, runs `SECURITY DEFINER`, and can be executed by `service_role` only.
- **Core** (`services/identityMetrics.ts`):
  - `Counts` requires the new object. A missing or malformed answer is a 502, never zeros.
  - The new release gate `flagged_session_unconsented_events` (part 1.1, A.2) is expressed like the other gates: numerator = active flagged accounts with no stored row, denominator = `flaggedActive`.
  - The status is `missed` whenever `events > 0`, whatever the denominator says. It is `no_data` when no flagged account was active, and `met` otherwise.
  - The details carry the per-stream counts.
  - The `IDENTITY_ADVERSARIAL` entry `flagged_session_unconsented_analytics` stays as the proof of the guard itself.
- **Staff Trust view.** `IdentityMetricsCard` on the staff console's Analytics page (Trust view) labels the row "Flagged accounts with no analytics events" / "Cuentas marcadas sin eventos de analítica" / "Contas marcadas sem eventos de analytics". The console fixtures carry the row, and the gate total is now 13.
- **Recalibration log.** `docs/operations/IDENTITY-RECALIBRATION-LOG.md` lists the new release gate, so `identity-review-cadence` sees no drift.

**Verified.**

- `database/scripts/verify-origin-postgres.py` passes 16 of 16 checks over the whole 252-file chain on native PostgreSQL 17.6 (lane cluster, port 16200). The new checks prove:
  - The count is zero across the flagged accounts active in the window while the guards hold.
  - The two events admitted before a later flag (the "flagged after an admitted event" account and the flag-race account) are not counted.
  - A mutation run proves detection. With `optional_learning_event_admission` disabled, a service-role `learning_events` insert is counted. With `family_money_event_admission` disabled, an owner `family_money_events` insert is counted. `events` becomes 2, one per stream, on one account.
  - The leaked rows are counted only inside their window.
  - The triggers are re-enabled and refuse again afterwards.
  - Browser roles cannot call the function.
- `identity-db-verify.test.mjs` pins the proof with a GUARDS entry (`identity_metrics` → `verify-origin-postgres.py`, `unconsentedFlagged`).
- `verify-staff-ops-postgres.py` passes 30 of 30 checks on the replaced function.
- Also run and passing:
  - Database static gates: `check-migrations` (16,475 bytes), `check-migration-phase` and `identity-db-verify.test.mjs`.
  - Core: `staffOps.test.ts` (27 tests), with new tests for met, missed on any event, missed on an inconsistent answer, no data, and a 502 on an omitted or garbled object.
  - Console: `StaffProgramme.test.tsx` shows the row as a met release gate.
  - Backend and frontend `type-check` and lint of the touched files.
  - `spec:check`, `secrets:check`, the i18n gate, and `identity-review-cadence` with its tests.

**Open.**

- There is no production data yet. Part 2.2(d) needs the gate to read zero for a full release cycle.
- Deploy order: apply the migration before the Core release that reads it. The new Core answers 502 on the identity card against the old function. An older Core ignores the extra key.
- "Active in the window" relies on `auth.users.last_sign_in_at`, which holds only the latest sign-in. For a past window, an account that signed in again after `p_to` is counted only through its events or its flag date. The default window ends now, so the live report is exact.
- Trust review and acceptance are pending.

**Owner questions.** None blocking. The conservative default: flagged-session events count from the flag's own timestamp, so history admitted before the flag is not reported as a leak.
