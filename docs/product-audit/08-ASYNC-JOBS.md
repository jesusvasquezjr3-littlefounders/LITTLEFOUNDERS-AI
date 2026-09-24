# 08 — Asynchronous Jobs, Workers and Scheduled Tasks

This document lists every background job, worker, scheduled task and deferred process in the platform, grouped by trigger type. For each one it gives the trigger, the purpose and outcome, dependencies, the retry policy and failure handling.

**Platform facts relevant to all jobs**

- There is **no message queue or job broker**. Background work is performed by one of five mechanisms:
  1. scheduled automation workflows (cron) run by the CI/CD system against production;
  2. timers inside long-running services (the analytics warehouse);
  3. "fire-and-forget" continuations inside an API request;
  4. lazy "catch-up" processing triggered by reads;
  5. operator-run command-line tools.
- Scheduled production jobs have **no external paging or alerting**. A failure surfaces only as a failed automation run. For the tutor retention sweep there is additionally a watchdog job and a staff console status.
- Times are in UTC.

---

## 1. Scheduled production jobs (cron)

| # | Job | Schedule | Purpose / business outcome | Mechanism | Retry & failure handling |
|---|---|---|---|---|---|
| 1 | **Tutor retention sweep** | Daily 03:00 (also manual, with an adjustable batch size, default 500) | Keeps the **90-day promise**: deletes AI Tutor sessions whose deletion date has passed, together with their turns, activities and safety flags, and deletes the session's synthesized audio files from media storage. Shared scripted audio is retained. | Calls the Core API's internal purge operation inside the production network. Up to 10 rounds of batches; stops when a batch is not full. Each run writes an audit entry, **even when nothing was due**. | Each round is retried 3 times (20 s apart). The job fails if Core cannot be reached, or if the reply lacks a deletion count (it refuses to report a sweep that may not have happened). Audio files that fail to delete are reported as warnings and logged for retry. |
| 2 | **Tutor retention watch** | Daily 06:00 | Detects a silent failure of job 1 | Asks Core for the sweep status | Fails if the last sweep is **older than 36 hours** or has never run, if Core is unreachable after 3 attempts, or if the reply is malformed |
| 3 | **Tutor content-bridge audit** | Daily 06:50, and on changes to the knowledge graph or the content ladder | Verifies that every knowledge component mapped to a course skill still reaches a **published** lesson, so tutor activities do not fall through to paid live generation | Runs the audit with production credentials | Fails the run on any broken mapping |
| 4 | **Insights maintenance** | Daily 07:30 (also manual) | Refreshes the daily activity/users **rollups** (the last 7 days are re-computed), **prunes raw usage events older than 400 days**, deletes stale unconverted anonymous visitors, and logs the rows removed | Runs database procedures in the production database | Up to 5 attempts per step, 20 s apart. After that the job fails with "rollups are now STALE". |
| 5 | **Database drift probe** | Daily 07:30, and on any schema change pushed | Confirms production's schema history matches the platform's recorded schema changes, and that each change's declared risk class matches its content | A read-only dry run against the production migration ledger | Fails on drift or checksum mismatch. Reports the number of pending changes. |
| 6 | **Operational database backup** | Daily 08:00 (also manual) | A full backup of the production database (users, learning, family, tutor, analytics) | Dumps the database and copies the file to the media service's persistent volume. Backups older than **30 days** are pruned. | Fails if the dump is empty |
| 7 | **Analytics-stack backup** | Daily 08:30 (also manual) | Backs up the Plausible and Umami databases | Dumps both, bundles them, copies to the media volume. Prunes backups older than 30 days. | Every step retried up to 5 times, 20 s apart |
| 8 | **North Star weekly export** | Mondays 08:00 (also manual, with a number of trailing days, default 7) | Exports the raw events behind the North Star metric (`lesson_complete`, `parent_report_viewed`, `badge_generated`, `badge_shared`, `badge_link_click`) to CSV | Database export; the file is kept as a downloadable automation artifact for **14 days** | Fails on export error |
| 9 | **Tutor skill & knowledge-graph curation** | Mondays 09:20, and on changes to teaching "moves" or the graph | **Propose-only** report of what to author next: knowledge components without a teaching skill file, misconceptions without remediation. Nothing is written to the catalog. | Runs the curator with production credentials and publishes the report as the run summary | The report is published even if the curator fails, with an explanation |

---

## 2. Continuous in-service workers

| Worker | Service | Trigger | Purpose | Failure handling |
|---|---|---|---|---|
| **Warehouse sync** | Analytics Warehouse | Every **5 minutes** (timer) while the service runs; the service scales to zero when idle | Incrementally copies events, attempts, users (with staff flag), sessions, lessons and adult conversions from the operational store. Recomputes learner skill states and aggregates. | Errors are recorded in the sync state. The data-quality view reports staleness after 15 minutes. Queries keep serving the last good data. |
| **Alert evaluation** | Analytics Warehouse | Every **5 minutes** (timer) | Evaluates active alerts (above / below / change %), respecting each alert's cooldown | Errors are logged. Triggers write history only (**no notification is delivered**). |
| **Narration on service start** (optional) | Lesson Audio | When the "run on start" setting is on (off by default), each time the service starts | Runs the batch narration of all lesson documents pending audio | Failures are logged. Individual lessons stay pending, and a retry reuses cached speech. |
| **Speech cache expiry** | AI Tutor Runtime + shared cache | Time-based | Cached synthesized lines expire after 180 days (default) | A cache miss triggers new synthesis |
| **Parked-session expiry** | AI Tutor Runtime | 90 s after a connection drops | A dropped conversation is kept resumable for 90 seconds, then closed as "learner left" and reviewed. When the service itself shuts down, parked and live sessions are closed as "abandoned". | — |
| **Idle timeout** | AI Tutor Runtime | 10 minutes without activity | Closes the live connection | — |
| **Daily spend window** | AI Tutor Runtime (in memory, per instance) | A rolling 24-hour window that starts when the instance starts and renews every 24 hours | Tracks model + voice spend. Stops admitting new sessions at the ceiling (USD 20 default). Logs an alert at 50%. | The window resets when the instance restarts |
| **Beacon flush and heartbeat** | Web app (per browser) | Every 60 s (30 s on marketing pages), and on tab hide | Sends queued usage events; records a heartbeat while visible | Failed sends are re-queued (the queue is bounded at 100 events) |

---

## 3. Request-triggered background work (inside API calls)

These run after, or alongside, a user action without delaying the response. A failure never fails the user's request unless noted.

| Trigger (user action) | Background work | Failure behavior |
|---|---|---|
| Lesson completion (pass) | Records `lesson_complete`, `first_lesson_complete` and `streak_extend` events (consent-gated) | Dropped silently if the data store is unavailable |
| Signup / guest upgrade / signup or login completion event with a visitor id | **Acquisition attribution** (links the visitor to the adult account; first conversion wins) | Silent |
| Parent views a child's territory | Records `territory_view` | Logged if dropped |
| Parent creates a badge | Records `badge_generated` | Silent |
| Parent grants/revokes analytics consent | Records a consent event if the state changed | Silent |
| Any staff console request | Records the staff member's network address as a "sighting" (deduplicated in memory) for exclusion suggestions | Silent |
| Chore photo replaced | Deletes the superseded photo from media storage once nothing references it | Logged as an orphaned file if it fails |
| Chore photo upload loses a race with a parent decision | Deletes the just-uploaded orphan photo | Logged |
| Allocation to a goal | Flips the goal to "reached" when its target is met | Cosmetic delay only |
| Opening a banking account screen (parent or child) | **Catch-up processing of scheduled credits**: up to 8 overdue allowance payments become pending credits; up to 8 overdue weekly savings bonuses are credited to Save. Schedules advance, and older missed occurrences are skipped. | Best effort. A late allowance is only a delay. |
| Tutor activity graded | Updates the mastery model (probability known, spaced-repetition card, misconceptions) and records knowledge-component evidence | Logged. Never affects the score or XP. |
| Tutor turn produced | Speech synthesis continues after the text is shown ("audio pending" → a "turn audio" message follows) | Voice degrades to text |
| Tutor session closed | **Post-session review**: an AI rewrites the learner and pedagogy memory notes from the transcript (a child's learner note is parked for guardian approval). The session summary digest is stored. The cost is added to the session. | Refused writes are logged. A stale memory is never overwritten. |
| Live tutor activity verified | 15% (default) are sampled into the staff review queue | — |
| Course release by staff | Audit entry | Logged if the audit write fails (the release has already committed) |
| Placement intake flagged as unsafe | Stores a guardian-visible placement safety flag | Logged loudly if the write fails. The learner's response is unchanged. |
| Guardian creates a child | Rolls back (deletes) the child account if linking or the profile write fails; audits the rollback | The failure is reported to the parent |
| Relay delivers an email | The mail relay posts a delivery-log entry to the email service | Logged as a warning |

---

## 4. Continuous integration and deployment (event-driven)

| Pipeline | Trigger | Outcome |
|---|---|---|
| **Per-service CI** (web app, Core, AI Tutor Runtime, course generation, lesson audio, image generation, Guardian, email, media, analytics warehouse, data store, observability) | Push or pull request touching that service | Type checks, linting, tests. The web app and tutor runtime also build. The web app runs browser-based lesson-engine, tutor-UI and accessibility gates. The tutor runtime runs safety and pedagogy verification (offline). |
| **Repository-wide gates** | Every push and pull request | Secret scanning, translation parity across the 3 languages and hard-coded string checks, marketing-path and SEO checks, cross-service contract parity (AI provider settings, whiteboard instruments, preferred activity types, demonstration steps), tool self-tests |
| **Per-service CD** | That service's CI succeeding on the main branch | Deploys the service to the hosting provider (the web app to the CDN host as a production build) |
| **Database CD** | Database CI succeeding on main (also manual) | Dry-runs pending schema changes. **Automatically applies them only if every change is additive** (adds or widens). Otherwise stops for a person. Takes a pre-migration backup before applying. |
| **Observability dependency updates** | Daily automated dependency checks for the observability stack's container images | Patch-level updates are merged automatically after CI passes |

---

## 5. Manual operator workflows (on demand)

| Workflow | Steps / purpose |
|---|---|
| **AI Tutor deploy (operator)** | Choose a step: **inspect** (services, instance states, migration ledger, whether provider keys are configured, without showing values); **probe** (the credential's authority); **migrate** (a pre-migration backup, then apply); **seed-kc** (load the knowledge-component graph); **probe-models** (measure whether candidate AI models spend output on hidden reasoning); **probe-empty** / **probe-prosody** (voice checks); **converse** (a paid end-to-end tutor conversation test, about USD 0.03); **provision** (set the tutor's model and voice provider; "keep" never changes them); **domain**; **verify**. |
| **Analytics diagnose** | Checks whether events are being recorded in production, and what an ordinary visitor is told by the tracking-decision endpoint |
| **Manual runs of scheduled jobs** | Retention (with a batch size), insights maintenance, backups, North Star export (with a number of days), drift probe, curation, content-bridge audit |

---

## 6. Operator command-line tools (content and data operations)

| Tool | Service | Purpose | Safeguards / limits |
|---|---|---|---|
| **Generate course** | Course Generation | Generates lessons for a course (all, or selected lessons and languages): plan → write → judge → localize → illustrate → publish (in review status) | Dry-run mode stops before any paid stage. Per-run caps (5M tokens / USD 50) and per-lesson caps (150k tokens / USD 0.25). 3 attempts per lesson with stage-aware resume. Refuses to overwrite live lessons without an explicit choice. Concurrency 2 (max 8). |
| **Generate track** | Course Generation | Mass generation over a whole course, sharded per adventure, with a total budget and multiple passes | Resumable by track id; can skip shards |
| **Coach** | Course Generation | Offline, free diagnosis of past runs (no AI calls, no writes) | Propose-only |
| **Verify course** | Course Generation | The course acceptance check. On success, writes the **release attestation** that enables publishing. | Deterministic |
| **Authoring tools** (briefs, validate, judge, localize, publish) | Course Generation | An out-of-pipeline authoring path by an external AI author, subject to the same gates, judge and localization freeze. Publishes as "review". | Requires all 3 languages |
| **Catalog / graph / contract checks** | Course Generation | Validate curriculum blueprints, competency graphs and exercise contracts | — |
| **Images backfill / apply map** | Course Generation | Add missing illustrations to existing lessons; rewrite image addresses after a format migration | Only image fields are touched |
| **Graph backfill** | Course Generation | Fill topic prerequisites and placement questions on live content | Spending cap option; dry-run and confirm modes |
| **WebP backfill** | Image Generation | Convert stored images to WebP and produce an address map | — |
| **Narrate all** | Lesson Audio | Batch narration of lesson documents pending audio (all courses or one) | Dry-run "preflight"; optional maximum speech calls per run; concurrency 2; reuse of cached speech |
| **Register voices / trim samples** | Lesson Audio | Create cloned character voices from samples | — |
| **Clone voices / pregenerate speech / pregenerate guided voice** | AI Tutor Runtime | Prepare character voices and pre-rendered audio for fixed lines (for example onboarding narration) | — |
| **Seed knowledge graph** | Core | Loads the knowledge-component graph (idempotent; refuses cycles). A **required** step for the tutor's pedagogy features. | — |
| **Audit content bridge / curate tutor skills / audit mastery calibration / verify placement** | Core | Integrity and quality reports | Read-only or propose-only |
| **Publish course (direct)** | Data store | Publishes a course hierarchy by slug with direct updates | **Bypasses the release check** used by the staff console |
| **Import/export course fixture** | Data store | Moves a course between environments | Development / QA |
| **Migrate (dry-run / confirm)** | Data store | Applies schema changes to production, after verifying the ledger and checksums | Never seeds or drops data. Refuses checksum drift. |
| **Seed dev users** | Data store | Creates role sample accounts locally | Development only |
| **Release readiness / production preflight** | Repository | Runs all gates plus free dry-runs; a read-only production inventory check | Never deploys or spends |
| **SEO: build pages, render cards, check live, IndexNow** | Web app | Prerender multilingual public pages and social cards; confirm what production serves; notify search engines | — |

---

## 7. Dependencies between jobs

- **Retention watch (06:00)** depends on the **retention sweep (03:00)** leaving an audit entry.
- **Insights maintenance (07:30)** runs before the **database backup (08:00)**, so backups include fresh rollups.
- The **analytics-stack backup (08:30)** follows the database backup; both land on the same media volume, which also stores lesson media.
- **Course release** depends on **Verify course** (a fresh attestation), which in turn depends on **generation** and **narration/illustration** being complete.
- The **tutor's pedagogy features** depend on **Seed knowledge graph**; the **content-bridge audit** watches that link daily.
- **Learner skill states** used by the tutor depend on the **warehouse sync**.
- **Database CD** depends on **database CI**; non-additive changes wait for the manual **Migrate** tool.

---

## 8. Priorities and concurrency

There are no job priority classes. Concurrency is bounded per workload:

| Workload | Concurrency |
|---|---|
| Course generation | 2 slots (max 8) |
| Narration | 2 speech calls in parallel (max 16) |
| Image generation | 1 at a time |
| AI Tutor Runtime | 200 live sessions per instance |
| Wallet operations | Serialized per child |
| Lesson grading | Serialized per learner × lesson × exercise |
| Tutor session start | Serialized per learner (daily cap) |
| Tutor XP award | Serialized per learner (daily cap) |
| Retention sweep | Batches of up to 2,000 (default 500) |
