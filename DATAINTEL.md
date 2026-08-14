# DATAINTEL.md — Data Intelligence Service

> Authority level: engine spec (/AGENTS.md §1.1 #6). Owns the contract for
> the analytics warehouse: DuckDB, segmentation, forecasting, anomaly
> detection, churn prediction, path analysis, experiments, and the admin
> intelligence console.
>
> Status: SHIPPED 2026-07-29; production handoff contract completed 2026-08-02.
> Service `dataintel/` (port 4008), DuckDB in-process, sync pipeline, 40
> analytical endpoints, 9-tab admin console. Railway deployment still requires
> the operator to create/verify the service and set its internal variables;
> local preflight intentionally reports that external state until reconciled.

## 1. Why this exists

INSIGHTS.md solved the COLLECTION problem: closed-vocabulary first-party
telemetry with guardian consent. DATAINTEL.md solves the INTELLIGENCE
problem: turning that stream into answers, predictions, and alerts —
without a separate infrastructure stack.

The platform records a child's learning journey at unprecedented granularity
(32 event types, segment-level timing, hint depth, attempt patterns). Answering
"is it working?" from that data requires an OLAP engine, not a transactional
database. DuckDB provides columnar analytics in-process — zero new services,
zero new infrastructure, zero data leaving the platform.

Postgres row-store is the right tool for recording events one row at a time
with ACID guarantees and RLS enforcement. But the questions an analytics team
asks — "across all 30,000 learners, what is the median time-to-value segmented
by locale and device?" — are columnar workloads. DuckDB runs the same queries
100–1000× faster on the same hardware, with no separate deployment and no ETL
pipeline to a remote warehouse.

## 2. Architecture

```
Vault (Postgres) ─── sync worker (5min) ──► DuckDB (in-process, columnar)
learning_events                              fact_events
lesson_segment_attempts                      fact_segment_attempts
anon_visitors (adult links only)             dim_anon_conversions
analytics_consents                           dim_users / dim_lessons / dim_sessions
user_roles                                   agg_daily_activity / agg_daily_users
lessons / lesson_progress / learning_stats   segments / experiments / alerts / anomalies
                                                     │
                                          Core proxy (/admin/intel/*) ◄── browser
                                                     │
                                          AdminIntelPage (recharts)
```

The sync worker pulls from Vault's PostgREST API incrementally: it tracks a
`last_sync_cursor` per table and fetches only rows modified since the last
successful run. DuckDB tables are rebuilt from the incremental deltas on every
cycle. The sync is READ-ONLY — DuckDB is a derived analytical copy, never a
writer back to Vault.

Core proxies every request. The browser never calls dataintel directly.
Core's `/api/v1/admin/intel/*` endpoints receive the admin's JWT, verify the
`admin`/`superadmin` role, attach the internal API key, forward the request to
dataintel, validate the response shape with Zod, and return the envelope. This
is the same pattern as `/api/v1/admin/emails/*` and `/api/v1/admin/insights/*`.

Redis sits between Core and dataintel as a query-result cache. Cache keys are
ETags derived from the query parameters and the sync cursor; TTL equals the
sync interval. A cache miss re-runs the DuckDB query; a hit returns the
previous result. The cache fails open — a Redis outage means queries run
against DuckDB on every request, never that the dashboard shows an error.

## 3. Service map

| Concern | Detail |
|---|---|
| Service | `dataintel/` — Express + TypeScript |
| Port | 4008 |
| OLAP engine | DuckDB (embedded, in-process, `duckdb` npm) |
| Sync | Incremental pull from Vault PostgREST every SYNC_INTERVAL_MS (5 min) |
| Cache | Redis — ETag-based, 5 min TTL, fail-open |
| Auth | Internal `x-internal-api-key` (SHA-256 digest comparison) |
| Frontend | AdminIntelPage — unified decision console, recharts-powered |
| Proxy | Core `/api/v1/admin/intel/*` — JWT role gate + internal-key forward |

## 4. Endpoints (40)

All routes are internal-key-gated except `/health`. Grouped by analytical
domain:

| Category | Method | Path | Description |
|---|---|---|---|
| Core Metrics | GET | `/intel/metrics/summary?days=30` | KPI bundle |
| Core Metrics | GET | `/intel/metrics/trends?metric=dau&granularity=day&days=30` | Time‑series |
| Core Metrics | GET | `/intel/metrics/compare?metric=dau&currentStart=…&currentEnd=…&previousStart=…&previousEnd=…` | Period-over-period |
| Core Metrics | GET | `/intel/engagement/leaderboard?limit=50` | Top learners |
| Core Metrics | GET | `/intel/metrics/timetovalue?limit=500` | TTV distribution |
| Lessons | GET | `/intel/lessons/dropoff?limit=25` | Highest abandon |
| Lessons | GET | `/intel/lessons/calibration?minLearners=2&limit=50` | Exercise difficulty |
| Sessions | GET | `/intel/sessions/depth?days=30&limit=200` | Deepest sessions |
| Funnels | GET | `/intel/funnels/activation` | Standard activation |
| Funnels | POST | `/intel/funnels/custom` | Custom funnel |
| Retention | GET | `/intel/retention/cohorts?weeks=12` | Cohort matrix |
| Retention | POST | `/intel/retention/curves` | Overlay curves |
| Segments | POST | `/intel/segments` | Create |
| Segments | GET | `/intel/segments` | List |
| Segments | GET | `/intel/segments/:id/metrics` | Metrics |
| Segments | POST | `/intel/segments/compare` | Compare |
| Segments | DELETE | `/intel/segments/:id` | Delete |
| Exports | POST | `/intel/export/jobs` | Create job |
| Exports | GET | `/intel/export/jobs` | List |
| Exports | GET | `/intel/export/jobs/:jobId` | Status |
| Exports | POST | `/intel/export/events` | Direct export |
| Anomalies | GET | `/intel/anomalies?metric=dau&days=30&threshold=2` | Detect |
| Anomalies | GET | `/intel/anomalies/active` | Unresolved |
| Anomalies | POST | `/intel/anomalies/:date/resolve?metric=dau` | Resolve |
| Anomalies | GET | `/intel/anomalies/history?limit=50` | History |
| Churn | GET | `/intel/churn/risk?limit=100` | Risk scores |
| Churn | GET | `/intel/churn/factors` | Factors |
| Forecasting | GET | `/intel/forecast?metric=dau&daysHistory=90&daysForecast=30` | Projection |
| Paths | GET | `/intel/paths/top?fromEvent=lesson_start&limit=10` | Top transitions |
| Paths | POST | `/intel/paths/sankey` | Sankey data |
| Experiments | POST | `/intel/experiments` | Create |
| Experiments | GET | `/intel/experiments` | List |
| Experiments | POST | `/intel/experiments/:id/start` | Start |
| Experiments | GET | `/intel/experiments/:id/results` | Results |
| Experiments | POST | `/intel/experiments/:id/conclude` | Conclude |
| Learning state | GET | `/intel/learning/states/:userId` | Derived learner skill states (Core only) |
| Learning state | GET | `/intel/learning/recommendation/:userId` | Highest-priority explainable next action (Core only) |
| Content health | GET | `/intel/learning/content-health` | Aggregated instructional priorities, no learner identity |
| Learning command center | GET | `/intel/learning/overview?days=30&limit=100` | Course, lesson, learner and daily evidence summaries, without learner PII |
| Learner learning detail | GET | `/intel/learning/learners/:userId?days=30&limit=100` | Staff-brokered learning detail, course/lesson feedback and explainable skill states |
| Data quality | GET | `/intel/quality` | Sync freshness and context/coverage checks |
| Experiment runtime | POST | `/intel/runtime/experiments/assignments` | Sticky surface assignment (Core only) |
| Experiment runtime | POST | `/intel/runtime/experiments/exposure` | Rendered-treatment exposure (Core only) |
| Alerts | POST | `/intel/alerts` | Create |
| Alerts | GET | `/intel/alerts` | List |
| Alerts | PATCH | `/intel/alerts/:id` | Update status |
| Alerts | DELETE | `/intel/alerts/:id` | Delete |
| Alerts | GET | `/intel/alerts/:id/history` | Firing history |

`POST /intel/export/events` returns a paginated JSON envelope with `truncated`
and `nextOffset`. Its allowlisted filters are dimensions only; it omits
event and identity IDs (`event_id`, `user_id`, `anon_id`), and turns `session_id` into a newly salted
`session_ref` for every response so exports cannot be joined longitudinally.

**Flat time-series metrics are deliberately narrow.** Trends, comparisons,
anomalies, forecasts, alerts and experiments accept only `events`, `dau`,
`users` and `sessions`: each has an exact event-fact definition. Retention,
activation and completions use different cohorts or denominators and are
answered only by their dedicated endpoints; the service rejects a false
relabeling with `400 VALIDATION_ERROR` rather than presenting an approximation
as a precise statistic.

## 4b. Data boundaries (staff exclusion and time windows)

Two contracts govern every number this service produces.

**Staff traffic is excluded before any metric is computed.** Measured against
production on 2026-08-13: 3,502 of 3,869 first-party events (90.5%) were
`superadmin`, produced by 2 accounts, and 24 of 24 `lesson_segment_attempts`
were staff-owned. Every DAU, funnel, cohort, churn score, time-to-value and
lesson-calibration figure was therefore describing the platform team.

The exclusion is structural rather than a filter each query must remember:

| Name | What it is |
|---|---|
| `fact_events_raw`, `fact_segment_attempts_raw`, `dim_sessions_raw`, `dim_users_raw` | physical tables, written only by the sync worker |
| `fact_events`, `fact_segment_attempts`, `dim_sessions`, `dim_users` | staff-free VIEWS, read by every analytical query |
| `v_staff_users` | `dim_users_raw` where `is_staff` |

`is_staff` comes from Vault migration 0046 (`dataintel_users_sync`) as an
EXISTS over the whole role set. The views also test the event-time role stamp,
because a superadmin who is also a parent stamps `parent`, and
`dim_users.role` is only the most recently granted role. Anonymous rows
(no `user_id`) are KEPT: they are the pre-signup funnel and cannot be
staff-attributed.

`GET /api/v1/intel/quality/staff-exclusion` reports how much was removed, and
the console shows it: a filter that silently stopped looks exactly like one
that is working.

**Every analytical query is bounded by a window.** `AnalyticsWindow` accepts a
trailing `days` count or an explicit `from`/`to` pair (the same contract as the
Pulse analytics routes, so one selection drives both consoles). A
half-specified range raises rather than falling back. Ten queries previously
had no bound at all — the console's period selector reached 4 of 17 requests.

## 5. DuckDB star schema

DuckDB stores a star schema optimized for analytical queries:

### Fact table

**`fact_events`** — one row per learning event, denormalized for fast scans:
- `event_id` (BIGINT, PK)
- `client_event_id` (UUID, nullable, retry-safe source identifier)
- `event_version` and `occurred_at` (schema/freshness observability)
- `user_id` (UUID, nullable)
- `anon_id` (UUID, nullable)
- `session_id` (UUID, nullable)
- `lesson_id` (UUID, nullable)
- `course_id`, `experiment_id`, `experiment_variant` (nullable closed context)
- `segment_id` (VARCHAR, nullable)
- `event_type` (VARCHAR NOT NULL — one of the closed-enum event names)
- `role` (VARCHAR, nullable)
- `route_class` (VARCHAR, nullable)
- `device` (VARCHAR, nullable)
- `locale` (VARCHAR, nullable)
- `referrer_class` (VARCHAR, nullable)
- `ordinal` (INTEGER, nullable)
- `value` (DOUBLE, nullable — numeric payload: score, attempt number, hint depth, seconds)
- `created_at` (TIMESTAMP NOT NULL)
- `ingested_at` (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)

**`fact_segment_attempts`** — authoritative Core attempt records, not browser
telemetry. It contains `attempt_id`, `user_id`, lesson/course/topic and closed
skill context, `segment_id`, `attempt_number`, `score`, `hints_used`, bounded
attempt time, lesson-document timestamp, diagnostic code and `created_at`.
Calibration uses this fact so a missing browser beacon never becomes a
fabricated zero score, hint rate or first-attempt result.

**`learner_skill_states`** — a recomputed, explainable Beta-posterior state
per learner and skill. It stores only derived mastery probability, uncertainty,
evidence count, review due time and a closed recommended action. Core exposes a
learner only their own state, which leaves a safe, first-party contract ready
for the future Tutor without granting it raw DuckDB or behavioral history.

### Tutor integration boundary (future)

The future Tutor must consume learning intelligence through Core's
caller-only `GET /api/v1/learn/personalization` route. Core authenticates the
learner, calls Data Intel with the internal service key, validates the
response, and returns only that learner's derived skill states plus the
highest-priority explainable recommendation. The Tutor must never call Data
Intel or DuckDB directly and must never receive raw `fact_events`, raw
`fact_segment_attempts`, another learner's state, or free-text analytics.

The safe Tutor context is assembled by Core from the learner's role/age band,
locale, current published curriculum context, relevant skill state,
uncertainty, evidence count, review timing, and closed learner intent. A high
uncertainty or low-evidence state is a request for a diagnostic check, not a
claim that the learner has failed. An unavailable warehouse is a degraded
dependency, not zero mastery; Core must return an explicit failure or use a
generic Tutor fallback.

The intelligence loop is deliberately one-way at the service boundary:
authoritative learning writes enter Vault, Data Intel derives explainable
states, and Core brokers the minimum context to the future Tutor. Any new
Tutor telemetry requires a closed event/migration contract and the existing
consent gate. For the full pedagogical, privacy, moderation, and production
acceptance contract, see `/ORACLE.md`.

### Dimension tables

**`dim_users`** — one row per user:
- `user_id` (UUID, PK)
- `role` (VARCHAR, nullable)
- `created_at` (TIMESTAMP, nullable)
- `locale` (VARCHAR, nullable)
- `xp_points` (DOUBLE, nullable)
- `lessons_completed` (INTEGER, nullable)
- `streak_days` (INTEGER, nullable)
- `longest_streak` (INTEGER, nullable)

**`dim_sessions`** — one row per session:
- `session_id` (UUID, PK)
- `user_id` (UUID, nullable)
- `started_at` (TIMESTAMP, nullable)
- `ended_at` (TIMESTAMP, nullable)
- `device` (VARCHAR, nullable)
- `locale` (VARCHAR, nullable)
- `referrer_class` (VARCHAR, nullable)
- `events_count` (INTEGER, nullable)
- `surfaces` (INTEGER, nullable)
- `lessons_started` (INTEGER, nullable)
- `duration_sec` (DOUBLE, nullable)

**`dim_lessons`** — one row per lesson:
- `lesson_id` (UUID, PK)
- `slug` (VARCHAR, nullable)
- `title_en` (VARCHAR, nullable)
- `title_es` (VARCHAR, nullable)
- `title_pt` (VARCHAR, nullable)
- `course_id` (UUID, nullable)
- `segment_count` (INTEGER, nullable)

**`dim_time`** — generated calendar:
- `date` (DATE, PK)
- `year` (INTEGER, nullable)
- `month` (INTEGER, nullable)
- `week` (INTEGER, nullable)
- `day_of_week` (INTEGER, nullable)
- `hour` (INTEGER, nullable)
- `is_weekend` (BOOLEAN, nullable)

**`dim_anon_conversions`** — minimal first-party adult acquisition link:
`anon_id`, `user_id`, `converted_at`. Its Vault view excludes every kid role;
it only lets the activation funnel join an adult's permitted marketing visit
to a later account conversion. It must never be used to create a child
behavioural profile.

### Aggregate tables (materialized by the sync worker)

**`agg_daily_activity`** — one row per (day, role, event_type, route_class, device, locale):
- `day` (DATE, PK part), `role`, `event_type`, `route_class`, `device`, `locale`
- `events` (BIGINT NOT NULL DEFAULT 0)
- `users` (BIGINT NOT NULL DEFAULT 0)
- `sessions` (BIGINT NOT NULL DEFAULT 0)
- `total_value` (DOUBLE, nullable)

**`agg_daily_users`** — distinct-user counters per (day, role):
- `day` (DATE, PK part), `role`
- `users` (BIGINT NOT NULL DEFAULT 0)
- `sessions` (BIGINT NOT NULL DEFAULT 0)

The trailing seven days are recomputed directly at reporting grain on every
sync. Distinct users and sessions are never summed from lower-grain event
groups, which would over-count the same person. Older rows are retained as
historical aggregates after the raw-event window expires.

## 6. Workers

Two background workers run on independent intervals (a third, `src/workers/
churn.ts`, was removed 2026-07-30: churn scoring is answered live from DuckDB
on every `/churn/risk` request, and a daily ticker with no body — reserved
for future result caching that was never built — is dead code, not a
placeholder worth keeping around; add it back if/when caching is actually
implemented):

- **sync worker** (`src/workers/sync.ts`): Incremental pull from Vault →
  DuckDB fact/dimension tables, then refreshes the aggregate tables. Runs every
  `SYNC_INTERVAL_MS` (default 5 min). Tracks a `last_sync_cursor` per table so
  only new/modified rows are fetched. On first run (cold start), performs a
  full seed load. Sync failures are logged and retried on the next interval;
  they never crash the server.

- **alert worker** (`src/workers/alerts.ts`): Evaluates anomaly thresholds
  every 5 min, respecting per-metric cooldown periods (an alert that fired 30
  minutes ago does not re-fire). Thresholds are defined in the anomaly config:
  DAU drop >2σ below the 30-day mean, completion rate drop >20% day-over-day,
  churn risk spike >50% week-over-week. Fired alerts are written to the
  `alerts` table (DuckDB) and surfaced through the anomaly endpoints. Guards
  against overlapping ticks (a `running` flag, matching the sync worker) so a
  slow evaluation pass can't double-fire an alert against the same cooldown
  window.

## 7. Frontend — AdminIntelPage

The unified admin intelligence console lives at `/admin/intel` (gated behind
`admin`/`superadmin` via `<RequireRole role={STAFF}>`). Existing
`/admin/insights` bookmarks redirect to the learning evidence tab. It exposes
only decision-ready surfaces:

| Tab | Description |
|---|---|
| Home | KPI cards, consent coverage and feature adoption breakdown |
| Trends | Exact event, DAU, user and session time series |
| Funnels | First-party adult acquisition funnel and learner activation steps |
| Learning | Course, lesson and learner evidence directory; catalog context stays visible before evidence arrives, while evidence thresholds prevent early signals from being mistaken for a content decision |
| Retention | Weekly cohort retention matrix with heatmap |
| People | Top learners engagement leaderboard + churn risk table |
| Experiments | Active/completed experiments list with control vs variant results |
| Alerts | Alert rules CRUD with firing history |

The page polls dataintel's endpoints through Core's proxy on a 60-second
interval (dashboard cards) and on tab switch (detail views).

The Learning command center deliberately combines two truths. Published
catalog metadata is useful on day one, so courses and lessons remain browsable
before a learner creates evidence. Pedagogical recommendations, however, are
only labelled `sufficient` after at least 20 attempts from five independent
learners. Earlier data remains visible as `limited`; a missing attempt stream
is `awaiting_evidence`, never a zero score or a healthy-content claim. The
warehouse returns UUID-only learner profiles. Core applies the staff role gate,
and the frontend resolves an existing staff-authorized display name only for
that administrative session.

## 8. What this must never become

- A replacement for the consent gate — kid behavioural events reach DuckDB
  only after Core has passed the active guardian-consent gate. A revocation
  stops subsequent browser telemetry at both client and Core; DuckDB is never
  an authorization decision point.
- A third-party data pipeline — DuckDB runs in-process, never sends data
  outside the platform. No cloud warehouse, no ETL service, no external API.
- A free-text analytics channel — all queries are parameterized SQL against
  closed-enum columns. No user-supplied SQL, no arbitrary filter expressions.
- A per-child PII surface — the churn at-risk endpoint returns user IDs
  only; Core applies its own role-based access controls before rendering
  names. No child name, email, or location leaves dataintel.
- A fake predictive model — mastery is an interpretable posterior and churn is
  a deterministic re-engagement prioritization until we have labeled outcomes,
  adequate sample size and a separately validated/calibrated model.
- A replacement for INSIGHTS.md — INSIGHTS owns the COLLECTION contract
  (what is recorded, under which consent); DATAINTEL owns the INTELLIGENCE
  contract (what is learned from it).

## 9. Relationship to INSIGHTS.md

INSIGHTS.md owns the COLLECTION contract (what is recorded, under which
consent). DATAINTEL.md owns the INTELLIGENCE contract (what is learned from
it). The boundary is the PostgREST API: INSIGHTS writes to Vault; DATAINTEL
reads from it.

The split is structural:

| Concern | Owner | Why |
|---|---|---|
| Event vocabulary (32 closed-enum types) | INSIGHTS.md §4 | What can be recorded at all |
| Consent lifecycle (grant/revoke, append-only ledger) | INSIGHTS.md §5 | Who said yes, and when |
| Retention & pruning (nightly rollup + delete) | INSIGHTS.md §6 | Raw data lifecycle |
| Acquisition & attribution (first-party cookie, UTM) | INSIGHTS.md §7 | Where users come from |
| Star schema (fact/dimension tables in DuckDB) | DATAINTEL.md §5 | How it is organized for analysis |
| Sync pipeline (Vault → DuckDB, 5-min interval) | DATAINTEL.md §2, §6 | How it gets into the warehouse |
| Segmentation, forecasting, anomalies, churn | DATAINTEL.md §4 | What is learned from it |
| Experiment framework (control/treatment, p-values) | DATAINTEL.md §4 | What changes are tested |
| Admin console (9 tabs, recharts) | DATAINTEL.md §7 | How it is presented to staff |

INSIGHTS.md and DATAINTEL.md are complementary engine specs at the same
authority level (level 6 in /AGENTS.md §1.1). Neither outranks the other; a
change to one that affects the other's contract must update both in the same
commit.
