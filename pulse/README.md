# Pulse — self-hosted analytics & system health

**Codename:** Pulse · **Deploy:** Railway (`littlefounders-b2c`) · **Owner surface:** admin console (via Core)

Pulse is LittleFounders' observability stack: privacy-first web analytics
(Plausible CE), behavioral product analytics (Umami v3), and continuous
system-health monitoring (Uptime Kuma) — fully self-hosted, pinned like
Vault, auto-updated by Dependabot, private by default.

**Stack source:** upstream images pinned in each `pulse/railway/*/Dockerfile`
`FROM` line (the single source of truth for versions — upgrade protocol:
[AGENTS.md](AGENTS.md)).

## Services

| Railway service | Image pin | Port | Volume | Public? |
|---|---|---|---|---|
| `pulse-plausible` | `ghcr.io/plausible/community-edition:v3.2.1` | 8000 | — | ✅ tracker + GA callback |
| `pulse-clickhouse` | `clickhouse/clickhouse-server:24.12-alpine` | 8123 | `/var/lib/clickhouse` | ❌ private |
| `pulse-db` | `postgres:16-alpine` | 5432 | PGDATA | ❌ private |
| `pulse-umami` | `ghcr.io/umami-software/umami:3.2.0` | 3000 | — | ✅ tracker |
| `pulse-kuma` | `louislam/uptime-kuma:2.4.0` | 3001 | `/app/data` | ✅ own auth + 2FA |

Private networking: `pulse-*.railway.internal` (IPv6 — every listener binds `::`).

## How data reaches the admin console

```
Browser ──▶ Core /api/v1/admin/analytics/*  ──▶ Plausible Stats API v2 (Bearer, private net)
        ──▶ Core /api/v1/admin/analytics/*  ──▶ Umami API           (token,  private net)
        ──▶ Core /api/v1/admin/health/*     ──▶ Kuma status JSON            (private net)
```

The browser never calls Pulse for data (§1.5). API tokens live only in Core's
Railway variables. Core caches responses (Plausible's default limit: 600 req/h).
Core also serves per-dimension breakdowns, audience report bundles + a branded
PDF export (`/api/v1/admin/analytics/{breakdown,report,report.pdf}`), and a
read-only mirror of the analytics IP blocklist (`/analytics/exclusions` ←
Core's `PLAUSIBLE_IP_BLOCKLIST`; enforced by `IP_BLOCKLIST` on pulse-plausible).

## Environment

Variable contract per service: [.env.example](.env.example). Real values only
in Railway. Secrets generated with `openssl rand -base64 48`.

## Analytics privacy model (§1.9)

| Engine | Where it runs | Kids? |
|---|---|---|
| Plausible | Every surface | ✅ safe — cookieless, no PII, no persistent IDs, raw IP/UA never stored |
| Umami (events) | Marketing + parent/admin surfaces | ❌ not mounted on kid sessions |
| Umami (replay/heatmaps) | Marketing + parent/admin surfaces only | ❌ **NEVER** — non-negotiable |

## GA4 import (the one remaining manual step)

Plausible CE imports Google Analytics history via a bring-your-own Google
Cloud OAuth app:

1. In the existing LittleFounders GCP project, enable 4 APIs: **Google
   Analytics API**, **Analytics Reporting API**, **Analytics Admin API**,
   **Analytics Data API**.
2. Create an OAuth client (web application). Authorized redirect URI:
   `<BASE_URL>/auth/google/callback`.
3. Set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` on `pulse-plausible` in
   Railway; redeploy.
4. In Plausible: site → Settings → Imports & Exports → Google Analytics →
   pick the GA4 property → import.

Reference: plausible/community-edition wiki → "Google Integration".

## Backups & incidents

- Daily `pg_dump` of `pulse-db`: `.github/workflows/pulse-backup.yml`.
- ClickHouse events are analytics (rebuildable loss-tolerance decided in
  RUNBOOK.md § Pulse); Kuma config is volume-persisted SQLite.
- Incident/rollback procedures: RUNBOOK.md § Pulse.
