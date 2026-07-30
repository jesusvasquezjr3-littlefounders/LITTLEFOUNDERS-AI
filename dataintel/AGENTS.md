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
- **Child safety (§1.9):** Dataintel serves aggregated analytics. No per-child
  PII is ever exposed through its endpoints. Individual-child drill-downs
  require the caller (Core) to apply its own role-based access controls.

## Read before touching

- `agent/core/CONVENTIONS.md` — app layout, envelope, test shape.
- `picturegen/AGENTS.md` — the sibling internal service this one mirrors
  (Zod env, typed errors, constant-time internal-key gate, injectable-dep tests).
- `/AGENTS.md` §1.14 — Software Quality & Robustness Policy (the
  READ-MODIFY-WRITE rule does not apply here since Dataintel is read-only,
  but the "failure must be distinguishable from emptiness" principle does).
