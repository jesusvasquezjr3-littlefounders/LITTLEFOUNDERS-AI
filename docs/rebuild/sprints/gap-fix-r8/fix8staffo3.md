# Gap-fix round 8: staff-ops (fix8staffo3)

Branch `codex/spec-fix8staffo3`. Status: **implemented and locally verified; not accepted.**

## Gap 1: the two Real-World Bridge metrics were never reviewed together

SPEC: Appendix H 1.1 (the Real-World Bridge Engagement Rate "should be read alongside" Appendix C's Real-World Bridge Conversion Rate and "reviewed together, not independently"); D.19; B.13.

Verified in code first: the gap was real. The engagement rate was on the staff Families card only (`/admin/family/bridge-engagement`). Its copy never mentioned conversion. The conversion rate existed only as `learning.bridge_conversion` on Mentor quality (`mentorQuality.ts`). No payload carried both. `OLDER-TEEN-GRADUATION-INITIATIVE.md` still said the conversion rate did not exist yet.

Built:

- **Core.** `readBridgeEngagement` (`backend/src/services/moneyBridge.ts`) reads `learning_narrative_metrics` beside `money_bridge_engagement`. It returns `conversion`:
  - `requirement: 'B.13'` and `metric: 'learning.bridge_conversion'`;
  - `windowDays` (the dashboard's `MENTOR_QUALITY_THRESHOLDS.windowDays`, 30);
  - `offered`, `converted` (within 7 days) and `selfCommitments`;
  - `conversionRate` (null when nothing was offered, never 0%);
  - `minSample` (20) and `sufficient`.

  This is the same source and window that Mentor quality uses. If either half cannot be read, Core answers 502: showing one half alone would be the independent review that Appendix H rules out. `mentorQuality.ts` is unchanged.
- **Staff console.** `MetricSpec` has a new `paired` field (`programmeApi.ts`): a note key and facts that Core serves in the same payload. The guard validates it, so a reply without `conversion` shows an error, never a partial card. `MetricCard` (`StaffProgramme.tsx`) renders it as a `data-paired` block, with a `data-copy-role="body"` note and the facts: conversion rate, prompts offered, done within 7 days and window in days. New copy in en-US, es-MX and pt-BR: `programme.body.bridgePaired` and four `programme.option` labels. The labels reuse Mentor quality's own name for the metric.
- **Docs.** The stale sentence in `docs/operations/OLDER-TEEN-GRADUATION-INITIATIVE.md` now describes the paired reading. It also says that engagement is cumulative and conversion covers the last 30 days.

## Gap 2: the legacy badge-image purge was outside the ops watchdog

SPEC: H.4; the Block H non-negotiable (watchdog plus notification for every job whose silent failure harms family data); H.3; Appendix O 1.3 and 2.3; F.2 under OD-20; owner answer D-08.

Verified in code first: the gap was real. `TRAIL_JOBS` had account_deletions, family_retention and social_retention. The Mentor sweep was watched separately as `tutorRetention`. Nothing read `badge_links.images_swept`. `badge-link-retirement.yml` reported per-image failures only as `::warning::`.

Built:

- **Core** (`backend/src/services/opsJobs.ts`):
  - `badge_link_retirement` is added to `TRAIL_JOBS` (so it is in `OPS_JOBS`, `getOpsJobStatus` and `anyStale`), with a 36-hour window in `OPS_JOB_STALE_HOURS`;
  - `runSucceeded` treats a page as a success only when `detail.failed === 0`;
  - `readTrail` reads the last clean page (`detail->>failed=eq.0`) and the last attempt of `BADGE_IMAGE_SWEEP_AUDIT_ACTION`;
  - a sweep that keeps failing therefore goes stale in the same way as one that stopped.
- **Watcher.** `agent/tools/ops-job-watch.mjs` adds the job to `WATCHED_JOBS`. The notice explains the consequence: a child's achievement image still resolves.
- **Drill.** `backend/src/scripts/opsJobDrill.ts` drills the realistic failure: the latest page ran today and failed, and the last clean page is stale. It has its own unit test.
- **Staff console.** The job is in `OPS_JOB_NAMES` (OpsJobsCard) and its fixtures. The label `job_badge_link_retirement` exists in all three locales.
- **Docs.**
  - `GOVERNANCE.md` section 4 now lists ten jobs, including the new row.
  - The drill paragraph now says ten jobs.
  - The `ACHIEVEMENT-SHARING.md` metric row points to the watchdog.
  - The dated-removal runbook in `ACHIEVEMENT-SHARING.md` now removes the watchdog entry together with the workflow. The job stays watched until then.

## Verified (local, zero spend)

- Backend (`vitest`): `staffOps.test.ts`, `opsJobDrill.test.ts` and `familyGovernance.test.ts`:
  - the badge trail's verdicts: fresh with a failed latest page, stale when failing, and never-ran;
  - the filter on the clean-run read;
  - `runSucceeded`;
  - the heartbeat route refuses the trail job;
  - the drill;
  - the paired payload and its window;
  - an empty population reads as no rate;
  - either read failing gives a 502;
  - non-analytics callers are refused before any read.
- Frontend: `StaffProgramme.test.tsx`. The paired facts render on the coaching group's bridge card, the copy exists in three locales, a payload without `conversion` is refused, and the badge job is listed on the OpsJobsCard.
- Tools: `node --test agent/tools/ops-job-watch.test.mjs` and the staff-ops cadence checker.
- Type-check and lint for backend and frontend, `spec:check`, `secrets:check` and the i18n gate.

## Open

- The production run of the watched sweep and a drill against the deployed Core (ops owner).
- Human visual review of the paired card.

## Owner questions

- If Mentor-quality reads fail, the Families card goes into an error state instead of showing engagement alone. This is the conservative reading of "reviewed together, not independently". The owner can relax it to a partial card with an "unavailable" conversion if preferred.
