# Gap-fix round 6: identity-site (fix6identi7)

Branch `codex/spec-fix6identi7`. Status of both items: **implemented and locally verified; not accepted.** Nothing here was run in production or against the shared Docker database.

## 1. A staff revocation ends the Tutor's powers (A.5, A.1, Appendix M 2.1 criterion 2, 1.4)

**The gap was real.** `revoke_parent_verification` (0193) only wrote the `revoked` verification row and its audit row. The adult kept the `parent` role and every verified guardian link. Every Core surface that checks only `requireRole(['parent'])` plus a verified link kept serving them: tasks, banking, family governance, and the child's Mentor transcripts and memory notes. Their children stayed linked as `verified`, so the A.1 pause never reached a child whose only Tutor was revoked. The new verifier reproduces this on the pre-migration chain before it proves the fix.

**Built.** This is enforced at the database boundary, where every Core route already reads roles and verified links on each request. Migration `0248_tutor_revocation_cascade.sql` (`contract`; the orchestrator renumbers it at merge) does the following:

- `tutor_verification_revoked(user)` checks whether the latest verification row is `revoked` (latest row wins, as in Core's `readAdultVerificationStatus`).
- `end_revoked_tutor_powers(user, actor)` is internal; no API role can call it. It does three things:
  - It revokes every verified link, with `revoked_by` set to the staff actor, so `family_state_audit` names the actor.
  - It deletes the unaccepted invites the adult issued.
  - It removes the `parent` role, and the `user_roles.delete` audit row names the staff actor through `lf.actor`.
- The existing 0150 status trigger pauses and bans each child left with no verified guardian.
- `revoke_parent_verification` keeps 0193's checks, then calls the cascade. Its audit row now carries `linksRevoked`, `invitesWithdrawn`, `parentRoleRemoved` and `childrenPaused`. If the audit write fails, the revocation, the links and the role all stay as they were.
- There is no path back:
  - `guard_guardian_link_state` (0156's body) refuses a new or reopened link, pending or verified, for a revoked adult with `GUARDIAN_LINK_TUTOR_REVOKED`. It accepts the staff revocation transition only under the function's marker.
  - `enforce_parent_role_provenance` (0235's body) refuses the parent role on every bound path, the staff grant included, with `PARENT_ROLE_REVOKED`.
  - The new `guard_parent_verification_revoked` refuses a new `verified` row with `PARENT_VERIFICATION_REVOKED`.
- `prevent_last_guardian_removal` (0117's body) now lets the staff revocation end a kid's last verified link. The child is paused rather than left supervised by a revoked adult.
- A backfill applies the same cascade to adults already revoked through the old path. It is attributed to the staff member on their latest revocation audit row and records `admin.parent_verification.powers_ended`.

**Core.**
- `services/adminData.ts` maps `PARENT_ROLE_REVOKED` to the grant outcome `revoked`.
- `POST /admin/roles/grant` answers 409 `PARENT_VERIFICATION_REVOKED` for that outcome. An older Core answers 409 `ROLE_REJECTED`.
- The comment on the revoke route now describes the cascade.

**Staff console copy (EN, es-MX, pt-BR).**
- The revoke confirmation now says the account loses verification and every Tutor link.
- The success notice says Tutor access ended and unsupervised children are paused.
- Both fit the adult body budget.

**Verified.**
- `database/scripts/verify-tutor-revocation-postgres.py` has 10 checks over the whole chain on native PostgreSQL 17.6 (lane cluster, port 16070). It is registered in `BLOCK_A` and in `identity-db-verify.test.mjs` (the GUARDS entries for the five functions).
- `npm run identity:db-verify`: 7/7 pass.
- `verify-staff-ops-postgres.py`: the `parentTags` expectation changed from holders 4 / revoked 1 to holders 3 / revoked 0, because the revoked adult no longer holds the role.
- `family:db-verify` passes 11 of 11 over the re-created guardian-link guards and the last-guardian guard.
- Core adversarial tests, all green together with their files (501 tests):
  - `tasks.test.ts`: approve returns 403 and nothing is decided.
  - `banking.test.ts`: freeze returns 403 and nothing is written.
  - `tutor.test.ts`: kids sessions and the memory decision both return 403, with a `guardian_links` stub that honours `verification_status`. This pins Core's reliance on the verified-only filter.
  - `verificationAdmin.test.ts`: a re-grant returns 409 `PARENT_VERIFICATION_REVOKED`.
- Frontend: `copy-budget/staff.test.ts` and `StaffConsole.test.tsx` are green, and so is the i18n gate.

## 2. The quarterly Block A recalibration is recorded, scheduled and flagged (Appendix M Part 3 Stage 6, Part 2.1 criterion 3)

**The gap was real.** Blocks D and E had a threshold log with a due-date gate and, for D, a quarterly issue. Block A had neither, although `identityMetrics.ts` already reports its metrics.

**Built.**
- `docs/operations/IDENTITY-RECALIBRATION-LOG.md`:
  - Every Block A metric Core reports: 14 `metric(...)` rows (release gate or diagnostic) and 5 adversarial suites, each with its Appendix M part, requirement, kind, target and source.
  - The owner is the Trust/Identity Lead.
  - What a recalibration looks at.
  - `First human review due: 2026-12-31`.
  - A review history with a `Kind` column; only `human` rows count.
- `agent/tools/identity-review-cadence.mjs` reuses Block D's cadence machinery (`block-d-review-cadence.mjs`). It has two modes:
  - **Gate.** It fails when the log is unreadable, or when the threshold table drifts from `identityMetrics.ts`: a missing row, a stale row, or a different kind, requirement or part. An overdue review warns, and fails under `--strict`.
  - **Issue.** `--issue-file`/`--title-file` write the quarter's issue: owner, last human review, next due date, every release gate, and, with `--report`, the gates of an attached staff identity report that read `missed` or `no data`.
- `.github/workflows/identity-recalibration-quarterly.yml` runs at 09:00 on the first day of January, April, July and October, plus `workflow_dispatch` with an optional `report` input. The report reaches the shell through the environment, and the issue is labelled `identity-review`.
- Wiring:
  - `release-readiness.sh` runs the gate with `--strict`.
  - `repo-gates.yml` runs it without `--strict`.
  - README documents the new schedule.
- `agent/tools/identity-review-cadence.test.mjs` (in `tools:test`) has 7 tests: due-date logic, drift, a malformed log, the issue body with missed and no-data gates, the command line, and the wiring.

**Verified.** `node --test agent/tools/identity-review-cadence.test.mjs` passes 7 of 7. The gate is green on the repository today (next due 2026-12-31) and fails `--strict` on 2027-01-02.

## Open items

- The first human recalibration is due 2026-12-31. No production data exists yet.
- Nothing reads the identity report from production automatically; a person attaches it to a manual run.
- `database/types/database.ts` has not been regenerated for the two new functions. Core does not call either directly. Regenerate with `db:types` on a provisioned stack.
- Acceptance still needs the Trust/Identity Lead's Stage 3 review of the revocation cascade and the staff copy, and a browser pass of the staff Users sheet (orchestrator UI audit).

## Owner questions

1. **Reversing a mistaken revocation.** The conservative default implemented here makes a revocation permanent on every API path: no new ID check, no staff re-grant, no new link. Only a database superuser can undo it. Should there be an audited staff reinstatement path, for example a superadmin with a mandatory reason, and who decides it?
2. **Invites issued by a revoked adult.** Invites that nobody has accepted are withdrawn at revocation, because they were issued by an adult found to be fraudulent. The default before this change was that an invite survives its issuer's account, so a second parent could still reactivate the child. Confirm the stricter rule for revocations.
