# dataintel (Data Intelligence)

> Part of LittleFounders v2. Read [/AGENTS.md](../AGENTS.md) first; domain rules in [AGENTS.md](AGENTS.md).

**Mission:** First-party analytics warehouse — a read-only microservice that syncs Vault (Supabase) data into a local DuckDB analytical database and serves pre-computed query results for dashboards, segmentation, forecasting, anomaly detection, and experiment analysis.
**Port (dev):** 4008 · **Deploy:** Railway · **Access:** internal only (`x-internal-api-key`)

```bash
npm install
cp .env.example .env   # fill in INTERNAL_API_KEY, SUPABASE_SERVICE_ROLE_KEY
npm run dev
npm test
```

## Architecture

```
┌──────────┐   poll (interval)    ┌──────────┐
│  Vault   │ ──────────────────→  │ dataintel │
│ (Supabase)│   service-role      │ (DuckDB)  │
└──────────┘                      └────┬─────┘
                                       │
                               ┌───────┴───────┐
                               │  Redis cache   │
                               │ (query results)│
                               └───────┬───────┘
                                       │
                              ┌────────┴────────┐
                              │  Core (backend)  │
                              │ /api/v1/admin/*  │
                              └────────┬────────┘
                                       │
                                  ┌───┴────┐
                                  │ SPA    │
                                  └────────┘
```

Dataintel syncs from Vault on a configurable interval (default 5 min),
stores data in DuckDB for analytical queries, and caches query results in
Redis. Core proxies admin dashboard requests to Dataintel — the browser
never calls Dataintel directly.

## Routes

Routes under `/api/v1` require `x-internal-api-key: <INTERNAL_API_KEY>`
(constant-time SHA-256 digest compared). Every response uses the
`{ data, error }` envelope (/AGENTS.md §1.6).

| Method | Path | Description | Status |
|---|---|---|---|---|
| GET | `/health` | Service health envelope | implemented |
| GET | `/api/v1/intel/metrics/summary` | KPI bundle (DAU, MAU, events, users) | implemented |
| GET | `/api/v1/intel/metrics/trends` | Time‑series for a metric | implemented |
| GET | `/api/v1/intel/metrics/compare` | Period-over-period comparison | implemented |
| GET | `/api/v1/intel/engagement/leaderboard` | Top learners by engagement | implemented |
| GET | `/api/v1/intel/metrics/timetovalue` | Time-to-value distribution | implemented |
| GET | `/api/v1/intel/lessons/dropoff` | Highest lesson abandonment | implemented |
| GET | `/api/v1/intel/lessons/calibration` | Exercise difficulty calibration | implemented |
| GET | `/api/v1/intel/sessions/depth` | Deepest sessions | implemented |
| GET | `/api/v1/intel/funnels/activation` | Standard activation funnel | implemented |
| POST | `/api/v1/intel/funnels/custom` | Custom funnel query | implemented |
| GET | `/api/v1/intel/retention/cohorts` | Weekly cohort retention matrix | implemented |
| POST | `/api/v1/intel/retention/curves` | Retention overlay curves | implemented |
| POST | `/api/v1/intel/segments` | Create segment | implemented |
| GET | `/api/v1/intel/segments` | List segments | implemented |
| GET | `/api/v1/intel/segments/:id/metrics` | Segment metrics | implemented |
| POST | `/api/v1/intel/segments/compare` | Compare two segments | implemented |
| DELETE | `/api/v1/intel/segments/:id` | Delete segment | implemented |
| POST | `/api/v1/intel/export/jobs` | Create export job | implemented |
| GET | `/api/v1/intel/export/jobs` | List export jobs | implemented |
| GET | `/api/v1/intel/export/jobs/:jobId` | Export job status | implemented |
| POST | `/api/v1/intel/export/events` | Direct event export | implemented |
| GET | `/api/v1/intel/anomalies` | Detect anomalies | implemented |
| GET | `/api/v1/intel/anomalies/active` | Unresolved anomalies | implemented |
| POST | `/api/v1/intel/anomalies/:date/resolve` | Resolve anomaly | implemented |
| GET | `/api/v1/intel/anomalies/history` | Anomaly history | implemented |
| GET | `/api/v1/intel/churn/risk` | Churn risk scores | implemented |
| GET | `/api/v1/intel/churn/factors` | Churn factors breakdown | implemented |
| GET | `/api/v1/intel/forecast` | Metric forecast projection | implemented |
| GET | `/api/v1/intel/paths/top` | Top user path transitions | implemented |
| POST | `/api/v1/intel/paths/sankey` | Sankey diagram data | implemented |
| POST/GET | `/api/v1/intel/experiments*` | Experiment CRUD + results | implemented |
| POST/GET/PATCH/DELETE | `/api/v1/intel/alerts*` | Alert rule CRUD + history | implemented |

Lesson calibration reads Core's authoritative `lesson_segment_attempts` facts,
not browser `segment_submit` telemetry. The activation funnel can join an
adult's first-party anonymous visit to a conversion through a service-only
view; kid accounts are excluded from that link by the source query.

## Env vars

| Var | Default | Notes |
|---|---|---|
| `PORT` | `4008` | |
| `INTERNAL_API_KEY` | — | Required; validates inbound `x-internal-api-key` |
| `SUPABASE_URL` | — | Required; Vault (Supabase self-hosted) |
| `SUPABASE_SERVICE_ROLE_KEY` | — | Required; service-role reads from Vault |
| `REDIS_URL` | `redis://localhost:6379` | Query result cache |
| `DUCKDB_PATH` | `./duckdb/dataintel.db` | DuckDB file path |
| `SYNC_INTERVAL_MS` | `300000` | Vault poll interval (5 minutes) |

## Deploy

Dataintel runs on Railway as a standalone service (port 4008). It depends on:
- **Vault** (Supabase on Railway) — read-only data source
- **Redis** (Railway) — query cache (optional; degrades gracefully)
- **DuckDB** — embedded analytical DB, file persisted on Railway volume

```bash
# Railway deploy (container-based; upload only dataintel/)
railway up dataintel --path-as-root --service dataintel --ci
```

Attach a 2 GB Railway volume named `dataintel-duckdb` at `/app/duckdb/` and set
`DUCKDB_PATH=/app/duckdb/dataintel.db`. The service's `railway.json` owns the
healthcheck/restart contract and `.railwayignore` excludes local DuckDB files
and secrets from the upload. The GitHub CD workflow runs this exact command
only after `dataintel CI` succeeds on `main`.

The DuckDB file is the only persistent state — everything else is derived
from Vault on the next sync.
