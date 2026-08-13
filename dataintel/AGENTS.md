# AGENTS.md — dataintel (Data Intelligence)

> Domain rules for this service. Root rules: [/AGENTS.md](../AGENTS.md). Context: [agent/core/CONTEXT.md](../agent/core/CONTEXT.md).

## Mission

Data Intelligence is the platform's first-party analytics warehouse — a
read-only, service-to-service microservice that powers dashboards,
segmentation, forecasting, anomaly detection, and experiment analysis.
It syncs structured data from Vault (Supabase) into a local DuckDB
analytical database on a configurable interval and serves pre-computed
query results through a key-gated REST API. Internal service —
`x-internal-api-key` only, constant-time compared.

## Owns / does not own

- **Owns:** DuckDB analytical database, the Vault → DuckDB sync pipeline,
  pre-canned analytics queries (dashboard cards, segmentation, forecasting,
  anomaly detection, experiments), Redis query-result cache.
- **Does NOT own:** the source-of-truth operational database (Vault/database/),
  the frontend dashboard UI (frontend/), Pulse observability stack (pulse/),
  real-time event ingestion (generation run data is polled from Vault, not
  streamed).

## Invariants

- **Read-only data source.** Dataintel reads from Vault with the Supabase
  service role key and never writes back. The operational database is the
  single source of truth — DuckDB is a derived analytical copy.
- **Sync runs on a configurable interval** (`SYNC_INTERVAL_MS`, default 5
  minutes), never on every request. Requests are served from the last
  successful sync snapshot.
- **Redis caches query results** between syncs (TTL ≤ sync interval) so
  repeated dashboard renders don't re-scan DuckDB.
- **Listener opens before any optional dependency** (Redis, DuckDB) —
  following the Core invariant: a service that cannot serve `/health` fails
  its platform healthcheck. Redis and DuckDB connect in the background.
- Envelope + Zod on every route (/AGENTS.md §1.6). Routes under `/api/v1`
  are internal-key-gated; `/health` is open.
- **Staff traffic never reaches a metric.** The plain table names
  (`fact_events`, `fact_segment_attempts`, `dim_sessions`, `dim_users`) are
  staff-free VIEWS over `*_raw` physical tables. Only `db/sync.ts` (the writer),
  `db/duckdb.ts` (the rename migration) and `services/staffAudit.ts` (the
  deliberate disclosure path) may touch a `_raw` table, and
  `__tests__/staff-exclusion.test.ts` fails the build if anything else does.
  The filter uses BOTH the authoritative `dim_users_raw.is_staff` flag (Vault
  0046, an EXISTS over all roles) and the event-time role stamp, because
  neither alone is sufficient: a superadmin who is also a parent stamps
  `parent`, and `dim_users.role` is merely the most recently granted role.
  Measured before this landed: 90.5% of production events and 100% of segment
  attempts were staff.
- **Every analytical query is bounded by a window.** `AnalyticsWindow`
  (`days`, or `days` + `from`/`to`) is threaded from the route to the SQL. Ten
  queries previously had no time bound at all while the console displayed them
  under a period label — `engagementQuery` aggregated all history and named its
  output `sessions_30d`. A half-specified range is an ERROR, never a silent
  fallback to the trailing window. Covered by `__tests__/time-window.test.ts`.
- **Child safety (§1.9):** Dataintel serves aggregated analytics. No per-child
  PII is ever exposed through its endpoints. Individual-child drill-downs
  require the caller (Core) to apply its own role-based access controls.

## Known pitfalls (found 2026-07-30, only reproducible against real data)

- **DuckDB's Node driver returns `TIMESTAMP` columns as JS `Date` objects.**
  Interpolating one into a template literal calls `Date#toString()`
  ("Wed Jul 29 2026 19:27:41 GMT-0600 (...)"), which DuckDB's own
  `TIMESTAMP` parser rejects outright. Bind it as a real parameter instead
  (`execute(sql, dateValue)`), or explicitly `new Date(value).toISOString()`
  first if it must go inline. `:memory:` unit tests won't catch this — they
  never populate a real `last_synced_at` row, so the bug only shows up once
  the sync loop has actually run once against real data.
- **`getDb()` does not create `DUCKDB_PATH`'s parent directory.** A fresh
  checkout with no `dataintel/duckdb/` folder yet fails with an opaque
  internal DuckDB assertion ("dereference unique_ptr that is NULL"), not a
  clear ENOENT. `getDb()` now `mkdirSync`s it (skipped for `:memory:`) —
  don't remove that guard.
- **A caller-supplied `metric` string must never be interpolated directly
  as a SQL column name** against a query that only computes a FIXED set of
  aggregate columns (e.g. the hourly/daily bucket rollups in
  `forecastQuery`/`anomalyQuery`/`compareQuery`). Resolve it through an
  explicit allowlist mapping first (`resolveBucketMetricColumn` in
  `db/queries.ts`) and reject anything not in that map at the Zod edge —
  `assertIdentifier()` only checks SQL-identifier *syntax*, not that the
  column actually exists in the query's result set.

## Read before touching

- `agent/core/CONVENTIONS.md` — app layout, envelope, test shape.
- `picturegen/AGENTS.md` — the sibling internal service this one mirrors
  (Zod env, typed errors, constant-time internal-key gate, injectable-dep tests).
- `/AGENTS.md` §1.14 — Software Quality & Robustness Policy (the
  READ-MODIFY-WRITE rule does not apply here since Dataintel is read-only,
  but the "failure must be distinguishable from emptiness" principle does).
