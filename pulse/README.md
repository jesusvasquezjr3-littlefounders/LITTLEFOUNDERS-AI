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
Core also serves per-dimension breakdowns, audience report bundles, and the
three export formats
(`/api/v1/admin/analytics/{breakdown,report,report.pdf,report.csv,report.xlsx}`),
plus the internal-traffic exclusion registry (`/analytics/exclusions`).

## Environment

Variable contract per service: [.env.example](.env.example). Real values only
in Railway. Secrets generated with `openssl rand -base64 48`.

## Analytics privacy model (§1.9)

| Engine | Where it runs | Kids? |
|---|---|---|
| Plausible | Consented public marketing only | ✅ safe — cookieless, no PII, no persistent IDs, raw IP/UA never stored |
| Umami (events) | Marketing + signed-in parent product surfaces | ❌ not mounted on kid or admin sessions |
| Umami (replay/heatmaps) | Marketing + signed-in parent product surfaces only | ❌ **NEVER** — non-negotiable |

### Excluding internal traffic

Plausible CE v3.2.1 still has **no** ingestion-side IP blocklist, and there is
no environment setting that adds one. Never claim an IP list filters Plausible.

The enforceable boundary is tracker MOUNTING, and it is where the exclusion
registry (Vault 0045) is applied:

1. Public acquisition already excludes authenticated, OAuth, product and
   `/admin/*` routes before a pageview can be sent.
2. On top of that, the SPA asks Core
   (`GET /api/v1/analytics/tracking-decision`) once per browser session
   whether the visitor's address is excluded. If it is, **no** tracker is
   mounted — not Plausible, not Umami, not GA4 — and Plausible's and Umami's
   own localStorage opt-outs are set as a second line of defence.
3. Core's first-party ingest (`POST /api/v1/events`) drops batches from
   excluded networks, so the Insights funnel counts the same population the
   web KPIs do.

Operators manage the list from the console (Analytics → Internal traffic),
which offers one-click exclusion of the current device and of addresses staff
have actually been seen working from. Two properties to preserve:

- **Forward-only.** An exclusion stops future collection. It cannot remove
  events already stored in Plausible, Umami or GA4, and the panel says so.
- **A failed read is not an empty list.** Every reader returns "unknown"
  rather than "nothing is excluded" when Vault cannot answer; the console
  answers 502 and the browser keeps whatever exclusion it already persisted.

## Campaign attribution contract

Use all three supported tags on every external post, email, partner link, and
paid placement:

```
https://littlefounders.ai/?utm_source=instagram&utm_medium=social&utm_campaign=back_to_school_2026
```

- `utm_source`: the publisher or platform, lower-case (`instagram`,
  `newsletter`, `whatsapp`, `partner_name`).
- `utm_medium`: delivery type, lower-case (`social`, `email`, `paid_social`,
  `referral`).
- `utm_campaign`: a durable initiative name, lower-case
  (`back_to_school_2026`, `parent_webinar_august`).

Values must be stable, use only letters, numbers, dots, underscores, or
hyphens, and must never contain a person, email, phone number, or other PII.
Do not add UTMs to internal navigation or product CTAs: that turns behavior
after arrival into a fictitious acquisition campaign. The first-party
conversion layer retains exactly these three labels on consenting adult
acquisition; Plausible reports the same tags for public pageviews.

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
