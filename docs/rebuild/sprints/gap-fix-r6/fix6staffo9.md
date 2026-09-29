# Gap-fix round 6: staff-ops lane (fix6staffo9)

Branch `codex/spec-fix6staffo9`. Two audited gaps, both verified real in the code before they were fixed. Status for both: **implemented and locally verified; not accepted.**

## 1. Staff lesson review plays v2 lessons in the learner's rebuilt view

**SPEC:** Bible 02 rule 23 and D13; 08 §0 item 2; OD-24 (the v1 player only for the v1 catalog); Appendix C Part 3 Stage 3; Product 10 G.2 ("no lesson reaches a child without human approval"); inventory S2 ("preview a lesson rendered in each language").

**The gap, as verified.** `app-routes/staffConsole.tsx` rendered every preview in the legacy v1 `LessonPlayer`, inside the legacy global sheet, whatever the schema. A v2 document showed "Update the app" on every step. The Live updates `VersionSheet` released or rejected a pending v2 version after showing metadata only, and Core had no route that returned that version's document. The review detail also read only `lesson_documents`, while learners are served the activated v2 version when one exists.

**Built.**
- Core `services/staffLessonPreview.ts`. It builds the document a learner is served: answerless, the authored `mentor_stage` projected beside it (catalog default character `rho`), narration resolved, and `playable` (whether Core would deliver it at all). It also checks a preview answer with the learner's scorer (`gradeV2Visual`) and records nothing.
- `getReviewLessonDetail` reads `getEffectiveLessonDocumentLocales`, the learner's selection rule. That rule moved from `routes/learn.ts` into `supabaseRest.ts` and learner delivery uses it unchanged.
- New Core routes behind `/content`, so they need `manage_content`:
  - `GET /admin/content/lessons/:lessonId/versions/:versionId` returns the pending version's document.
  - `POST /admin/content/lessons/:lessonId/preview-grade` takes `{locale, document_version_id?, segment_id, answer}` (strict) and answers `{verdict, recorded: false}`.
  - The refusals: 400 for a malformed body or an answer the scorer refuses, 404 for another lesson or locale, 422 for v1 or unplayable, and 502 when a read fails.
- Rebuilt `rebuild/staff/console/StaffLessonPreview.tsx`. It is a full-viewport modal layer from the shared layer stack: the page behind is inert, scroll is locked, focus is trapped, and Escape closes it (DP-03). It has a staff bar ("Nothing is saved") and the learner's own `LessonLayer` + `LessonDocumentView` in the document's locale and age band, with Core's stage projection. There is no `onView` and no `onComplete`, and every grader calls Core's preview-grade route. It restores the console's title and `lang` on close.
- `renderLessonPreview` in `staffConsole.tsx` branches on `schemaVersion`:
  - 2 loads the rebuilt preview, lazily.
  - 1 keeps the scoped legacy player (OD-24).
  - Any other schema has no preview.
- `StaffContent` and `VersionSheet`:
  - Both hand the renderer the schema, the stage, the narration and a Core-bound grader.
  - The v2 help copy is its own string.
  - A document Core would refuse is flagged.
  - The `VersionSheet` reads the version document and offers the same Preview before Release/Reject. A failed read is its own state and the decision stays available.
- `check-product-spec.mjs` has a new `legacyPlayerFailures` check. The legacy player may be imported only by the lesson engine and its two adapters. `ScopedLessonPlayer` may be mounted only by `staffConsole.tsx`, inside its `schemaVersion === 1` branch. `LegacyLessonIsland` may be mounted only by `LessonRoute.tsx`, behind `isLegacyLessonDocument`.
- Audit lane `frontend/scripts/audits/lanes/staff.mjs` has four new states: `@lesson-v2-preview`, `@updates`, `@version` and `@version-preview`. The lane now also answers `lesson-versions`, `bypass-checks` and the version document. `audit-rebuild.mjs` gained `openReady`, which waits for what the last press opens, such as a lazy chunk. The preview entry fixtures (`staffConsoleFixtures.ts`, `staffSectionFixtures.json`) answer the same routes: the second review lesson is v2, and each version has its document.
- New copy in EN, es-MX and pt-BR (`rebuild-staff.json`), within the Copy Budget:
  - `content.heading.preview`
  - `content.body.previewHelpV2`
  - `content.body.previewBar`
  - `content.body.notPlayable`
  - `content.action.closePreview`

## 2. Warehouse alerts reach a human or fail the watchdog

**SPEC:** H.3 ("connect the alert-trigger mechanism to an actual notification channel"); Block H standard ("no alert ... may be built to record without a real consumer"); Appendix O 1.3 Alert-to-Notification Delivery Rate (100%) and 2.1(2).

**The gap, as verified.** The two alert routes accepted any channel: `POST /alerts` created an alert whose channel had no settings, and `PATCH` could switch such an alert back on. A trigger then recorded `unconfigured` (a warn log) or `failed` (one try, no retry). Nothing but a counter on the Intel screen showed it.

**Built.**
- dataintel `services/alerts.ts` and `routes/queries.ts`:
  - `configuredChannels()`, `isChannelConfigured()` and `getAlert()`.
  - `POST /alerts` and `PATCH /alerts/:id` → `active` answer 409 `ALERT_CHANNEL_UNCONFIGURED` when the channel has no settings. `PATCH` also answers 404 for an unknown alert being switched on.
  - `GET /alerts/channels`.
  - Bounded retries: `ALERT_DELIVERY_ATTEMPTS = 3`, waits of 2 s and 8 s. A network error, a timeout, 408, 425, 429 or 5xx is retried; any other 4xx is not. Each attempt is a row in `alert_delivery_attempts`, and `alert_history.delivery_attempts` keeps the final count.
  - `undeliveredAlerts(hours)` and `GET /alerts/undelivered?hours=36` list the triggers that reached nobody: failed, unconfigured, or no outcome 15 min after the trigger.
- Core `services/warehouseAlerts.ts`. `ALERT_UNDELIVERED_WINDOW_HOURS = 36` has one home here. `getOpsJobStatus` carries `alerts: {undelivered, windowHours, alerts}` on both `/internal/ops/job-status` and `/admin/ops/job-status`. An unreadable warehouse gives `undelivered: null`, and the other jobs' verdicts are kept.
- `agent/tools/ops-job-watch.mjs`:
  - It fails on any undelivered trigger and names up to 10 of them on the ops-watchdog issue. Alert names are sanitized, so they cannot inject markdown into the issue.
  - It refuses a reply without the count.
- The drill target `alerts_undelivered` was added to `ops:drill`.
- Console:
  - The Support watchdog card shows "Data alerts", with "All delivered", "Not delivered" or "could not be read".
  - Learning intel, Experiments & alerts, shows which channels are set up.
- `docs/operations/GOVERNANCE.md` section 4 is updated.

## Verified (local)

- **Core:**
  - `type-check` and `lint` are clean.
  - Vitest files: `staffLessonPreview` (13 new tests), `admin` (116), `contentRelease`, `learn`, `learnV2Mixed`, `learnV2Approaches`, `staffOps` (1 new) and `opsJobDrill` (1 new). All green.
- **dataintel:**
  - `type-check` and `lint` are clean.
  - `alert-channel-guard` (new, real DuckDB), `alert-delivery` (5 new retry tests), `alert-delivery-rate` and `intel`: all green.
- **frontend:**
  - `tsc` and `lint` are clean.
  - `src/rebuild/staff`, `staffConsole.test.tsx` (the schema-2 row never mounts the legacy player; schema 3 has no preview), `StaffLessonPreview.test.tsx` (the real rebuilt view, Core-bound grading, Escape, title restore, fixture documents parse) and `copy-budget/staff`: all green.
- **Root:**
  - `spec:check`, `secrets:check` and `bash agent/tools/check-i18n.sh` pass.
  - `ops-job-watch` (12) and `check-product-spec` (3) tests are green.
- **No browser run.** The four new audit states are for the orchestrator's UI audit.

## Open

- The orchestrator's real-route audit of the four new staff states is not yet run.
- Production:
  - the alert channel configuration;
  - a live `ops:drill` against the deployed Core;
  - the preview routes on the deployed Core.
- A human review of the preview flow.
- Two red files that this lane did not touch, both already red on the integration base:
  - `copy-budget/learn.test.ts` and `copy-budget/site.test.ts` (their key sets are ahead of their JSON);
  - `check-mentor-governance.test.mjs` (the `safety.judge` change record).

## Owner questions (conservative defaults implemented)

1. **Preview grading.** The gap's fix text says "no graders". The rebuilt view, however, refuses to render a graded step without a grader, so a lesson would show nothing but "Update the app". The preview therefore checks each answer through Core, with the real key, recording nothing. Is this the intended reviewer experience?
2. **Mentor and fade in the preview.** The preview shows the catalog default Mentor (`rho`) and the unfaded worked examples, which is the full document. A learner sees their own Mentor and a fade by mastery.
3. **Alert retries and window.** A failed alert send gets 3 attempts in total, 2 s and then 8 s apart. The undelivered window is 36 h, the same as the daily watchdog jobs.
