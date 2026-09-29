# Block A identity recalibration log

Appendix M Part 3 Stage 6 ("Post-Launch Recalibration") asks the Trust/Identity Lead to review Block A on a quarterly cadence, consistent with Appendices H, J and L: real production data (origin-flag coverage, age-screen completion, bypass-attempt rate, undated-account backlog) feeds back into this Block's thresholds. This file is that log. It is not a specification: the SPEC (`docs/littlefounders-spec/`, Appendix M) and the owner decision log win when they disagree with it.

**Enforced, not only written.** `agent/tools/identity-review-cadence.mjs` reads the threshold table below and fails when it drifts from the metrics Core actually reports (`backend/src/services/identityMetrics.ts`: every `metric(...)` and every `IDENTITY_ADVERSARIAL` entry must have exactly one row here, with the same kind). It runs unfiltered in the repo gates.

Owner of the review: the Trust/Identity Lead (Appendix M Part 3 Stage 6), a distinct role from the Engineering Lead who scoped or built a Block A change (Stage 3). Cadence: quarterly.

**First human review due: 2026-12-31** (one quarter after this log was created, 29 September 2026; the Trust/Identity Lead may bring it earlier, never later). The due date is machine-read: only a row of kind `human` counts as the review; a row of kind `engineering` records what a lane did and never does. After a human review the next is due 90 days later. `identity-review-cadence.mjs` warns when the review is overdue and fails with `--strict` (release readiness); `.github/workflows/identity-recalibration-quarterly.yml` opens the quarter's review issue on the first day of each calendar quarter, listing every release-gate metric and, when the staff console's identity report is attached to the run, the ones that read `missed` or `no data`.

## What a recalibration looks at

1. The staff console identity report (Analytics, Identity; `GET /api/v1/admin/analytics/identity?days=90`) over the last quarter: every release-gate metric at its target, every diagnostic's trend.
2. A release-gate metric that reads `missed` is a regression, not a threshold to relax. Appendix M Stage 6: a regression in an age/identity-boundary adversarial metric triggers an immediate rollback rather than a patch under pressure.
3. The undated-account backlog (a diagnostic) and whether the re-prompt flows are shrinking it.
4. The adversarial suites still prove what the table says (`npm run identity:db-verify`, and the Core suites named in the Source column).
5. Any change of a target or a new metric: update Appendix M first (or record the owner decision), then Core, then this table, in one change.

## Thresholds

| Metric | Part | Requirement | Kind | Target | Source |
|---|---|---|---|---|---|
| `guest_origin_flag_coverage` | 1.1 | A.2 | release gate | 100% | `identity_metrics` guestOrigin, `services/identityMetrics.ts` |
| `onboarding_discovery_unconsented` | 1.1 | A.2 | release gate | 100% admitted (zero unconsented) | `onboarding_discovery_metrics`, `services/identityMetrics.ts` |
| `flag_persistence_through_upgrade` | 1.1 | A.2 | release gate | 100% | `identity_metrics` flagPersistence |
| `post_callback_age_screen_completion` | 1.1 | A.3 | release gate | 100% | `identity_metrics` googleAgeScreen |
| `under13_google_reclassification` | 1.1 | A.3 | release gate | 100% | `identity_metrics` googleUnder13 |
| `entry_path_age_capture` | 1.1 | A.4 | release gate | 100% for new accounts | `identity_metrics` entryCapture |
| `undated_account_backlog` | 1.1 | A.4 | diagnostic | trend to zero | `identity_metrics` undatedBacklog |
| `verification_status_differentiation` | 1.2 | A.5 | release gate | 100% | `identity_metrics` parentTags |
| `tutor_adult_age_record` | 1.2 | A.2, A.5 | release gate | 100% | `list_minor_record_tutors` |
| `staff_grant_justification_completeness` | 1.2 | A.5 | release gate | 100% | `identity_metrics` staffGrantJustification |
| `revocation_path_utilization` | 1.2 | A.5 | diagnostic | path exists and exercised | `identity_metrics` revocation; `verify-tutor-revocation-postgres.py` |
| `kid_email_change_restriction` | 1.3 | A.6 | release gate | 100% | `identity_metrics` kidEmail |
| `faq_claim_parity` | 1.4 | A.1 | release gate | 100% | `identity_metrics` faqCapabilities |
| `schema_field_utilization` | 1.4 | A.2, A.5 | release gate | 100% | `identity_metrics` schemaFields |
| `flagged_session_microphone` | 1.1 | A.2 | adversarial | zero successful access, every release | `backend/src/__tests__/tutor.test.ts` |
| `flagged_session_fail_closed` | 1.1 | A.2 | adversarial | 100% fail-closed, every release | `backend/src/__tests__/tutor.test.ts` |
| `flagged_session_unconsented_analytics` | 1.1 | A.2 | adversarial | zero events, every release | `ageUpgradeChain.test.ts`; `npm run identity:db-verify` |
| `age_screen_bypass` | 1.1 | A.3 | adversarial | zero bypasses, every release | `backend/src/__tests__/ageScreen.test.ts` |
| `kid_email_change_unauthorized` | 1.3 | A.6 | adversarial | zero changes, every release | `verificationAdmin.test.ts`; `npm run identity:db-verify` |

## Review history

| Date | Kind | Metrics | Decision | By |
|---|---|---|---|---|
| 2026-09-29 | engineering | All rows | Initial record (GAP-FIX-R6 identity-site). Targets are Appendix M's as written; no production data exists yet (the product runs locally), so no metric has been recalibrated. The staff console fixture shows how a `missed` gate reads (post-callback age screen 211 of 214); the quarterly issue lists such gates for the Trust/Identity Lead. | Engineering (fix6identi7 lane) |
