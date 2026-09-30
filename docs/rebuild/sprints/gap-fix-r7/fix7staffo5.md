# Gap-fix round 7: staff-ops (fix7staffo5)

Branch `codex/spec-fix7staffo5`. Status: **implemented and locally verified; not accepted.**

## Gap (verified in code first)

Appendix N Part 3 Stage 6 and Appendix O Part 3 Stage 6 (Post-Launch Recalibration, quarterly, "consistent with Appendices H, J, L and M"), 13-OWNER-DECISION-LOG section 8 (the G.2 30-day window and the G.4 quarterly cadence "are recalibrated through each block's threshold log"), and Appendix O 1.3 (the simulated job-failure drill runs "quarterly otherwise").

The gap was real. Before this lane:

- `docs/operations/` had threshold logs for Blocks A, B and D and the Mentor, but none for G or H;
- `agent/tools/` had no staff or ops cadence checker;
- `release-readiness.sh` ran no Block G/H recalibration check;
- `GOVERNANCE.md` never mentioned recalibration;
- `access-review-quarterly.yml` opens only the per-grant G.4 access review.

The Block G/H constants lived only in code, with no owner or review:

- `ACCESS_REVIEW_CADENCE_DAYS = 90`;
- `content_retro_check_days()` = 30 (0222) and `RETRO_CHECK_DAYS = 30`;
- `OPS_JOB_STALE_HOURS` (36) and `DELETION_STEP_FAILURE_HOURS = 24`;
- `POLICY_MIN_AGE`.

`ops:drill` had no quarterly trigger.

## Built (Block A pattern)

- `docs/operations/STAFF-OPS-RECALIBRATION-LOG.md`, which holds:
  - two owners: the Platform Lead (Block G) and the Data/Privacy Lead (Block H);
  - a quarterly cadence per block, with the first human review due 2026-12-31;
  - "What a recalibration looks at";
  - a threshold table with 24 rows, one per Appendix N (10) and Appendix O (14) Part 1 metric, each with kind (release gate, diagnostic or documentation), target and code source;
  - a calibration table:
    - G.2: 30 days;
    - G.4: 90 days;
    - H.3: 36 h undelivered-alert window;
    - H.4: 36 h stale window and 24 h stalled erasure;
    - H.7: `adults_only 18, od26_c17 10`;
  - the Stage 6 rollback rule for the five named metrics;
  - a review history (kinds `human` and `engineering`; Block `G`, `H` or `G+H`).
- `agent/tools/staff-ops-review-cadence.mjs`. It fails when:
  - a threshold row drifts from the known metric list (id, block, part, requirement or kind), or its Source cell drops its citation;
  - a metric's code source disappears (for example, a `trackInsight('tutor_open'` emitter or the drill script);
  - the retired export-job route returns;
  - a calibration value differs from any place that enforces it: the constant, every `OPS_JOB_STALE_HOURS` entry, `RETENTION_STALE_HOURS`, or the latest migration that defines `content_retro_check_days()` or the `staff_access_review_status` default;
  - the rollback rule stops naming its five release gates.

  Due dates are computed per block. An overdue review warns, and fails under `--strict`. `--issue-file`/`--title-file` write the quarterly issue.
- Test: `agent/tools/staff-ops-review-cadence.test.mjs`, 10 tests. They cover every refusal above, the per-block due dates, the issue, the CLI on a scratch repo, and the pins on the workflow and the wiring.
- `.github/workflows/staff-ops-recalibration-quarterly.yml` (cron `0 9 1 1,4,7,10 *`) opens or comments on the quarter's `staff-ops-review` issue for both leads. The issue lists:
  - every release-gate metric of each block;
  - the calibration values;
  - the rollback rule;
  - the simulated job-failure drill (`npm --prefix backend run ops:drill`).
- The gate runs in these places:
  - `npm run spec:check`;
  - a named step in `repo-gates.yml`;
  - `release-readiness.sh`, with `--strict`.
- Docs: `GOVERNANCE.md` section 7 (post-launch recalibration), a README scheduled-workflow row, and `REQUIREMENTS.md` rows G.1, G.2, G.4, H.3, H.4, H.6 and H.7.

No migration, no UI and no copy change.

## Verified (local)

- `node --test agent/tools/staff-ops-review-cadence.test.mjs`: 10 pass.
- `node agent/tools/staff-ops-review-cadence.mjs`: OK. With `--now 2027-01-02 --strict` it fails for both blocks, as intended.
- Root `npm run spec:check` and `npm run secrets:check`: see the final report of the lane.
- No backend, frontend or dataintel code changed, so no service type-check is needed. The i18n gate does not apply.

## Open

- The first human reviews (Platform Lead, Data/Privacy Lead) are due by 2026-12-31. The first scheduled issue runs once the workflow is on `main`. A drill against the deployed Core is the ops owner's (OD-23: nothing here contacts production).
- No owner question needs an answer before work continues. The SPEC's own values apply as written (OD log section 8). Default taken: one log with a per-block schedule, and a `G+H` row counts for both leads when they review together. The owner may confirm the names behind the two roles.
