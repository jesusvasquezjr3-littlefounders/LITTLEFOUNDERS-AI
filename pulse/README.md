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

## Monitors (Uptime Kuma)

The status page is `pulse`; Core reads it through
`/api/v1/admin/health/services`. The set below is the source of truth — if it
disagrees with Kuma, one of them is wrong and it is usually this file.

| # | Monitor | Target |
|---|---|---|
| 1 | Core (backend) | `littlefounders-backend.railway.internal:4000/health` |
| 2 | Forge (coursegen) | `coursegen.railway.internal:4001/health` |
| 3 | Echo (audiogen) | `audiogen.railway.internal:4002/health` |
| 5 | Guardian (parent-id-check) | `parent-id-check.railway.internal:4004/health` |
| 6 | Courier (email-server) | `email-server.railway.internal:4005/health` |
| 7 | Depot (filebase) | `filebase.railway.internal:4006/health` |
| 8 | Plausible | pulse-plausible `/api/health` |
| 9 | Umami | pulse-umami `/api/heartbeat` |
| 10 | Prism (picturegen) | `picturegen.railway.internal:4007/health` |
| 11 | Data Intel (dataintel) | `dataintel.railway.internal:4008/health` — **Keyword** monitor, see below |

Monitor #4 is absent by design: see the retirement note below. Numbering is
Kuma's own and is never reused.

**Data Intel is a Keyword monitor, not a plain HTTP one.** Its `/health`
answers `200 status:"ok"` *while* reporting `components.duckdb: "down"` — that
is exactly how the warehouse died silently after a deploy twice (RUNBOOK,
2026-08-09 and 2026-08-13). An HTTP-200 monitor stays green through the outage
it exists to catch. The keyword is `"duckdb":"up"`, matched against the
compact JSON the service actually emits (no spaces after the colons — verify
with `curl` before changing it, since a keyword that never matches makes the
monitor permanently red and equally useless).

**A monitor is not live until it is on the status page.** Creating it in Kuma
is half the job: Core reads `/api/status-page/pulse`, so a monitor left out of
the `Services` group runs, alerts, and stays invisible to `/admin`.

**Retiring a service retires its monitor, in the same change.** Monitor #4
("Arcade / gamegen") outlived the service it watched: the Game Engine was
removed on the owner's call (`10936f3e`, schema retired in `0033`) and the
Railway service deleted, but the monitor kept resolving
`gamegen.railway.internal` every 60 seconds, failing every time, and emailing
about it for weeks. An alert for something that no longer exists trains people
to ignore alerts, which is worse than having none.

Executed 2026-08-14: monitor #4 deleted, and Prism (#10) and Data Intel (#11)
added and attached to the `Services` group. Verified through the status-page
API — ten monitors, all `UP`. The "server crashed" emails traced to #4 should
stop with it.

## Non-human traffic

Three layers, in the order a request meets them.

| Layer | What it stops | Where |
|---|---|---|
| `navigator.webdriver` | WebDriver-controlled browsers (Playwright, Selenium, Puppeteer, headless automation) — including our own browser verification runs | SPA tracker gate, before any hit is sent |
| User-agent classification | Search, SEO, AI, uptime and security crawlers, plus scripted clients (curl, python-requests, Postman) | Core: `GET /api/v1/analytics/tracking-decision` and `POST /api/v1/events` |
| Vendor filtering | Known bots, dropped before storage | Plausible CE and GA4, built in |

Plausible's own filtering is confirmed by production data: twelve months of
`visit:browser` contains Chrome, Safari, Mobile App, Firefox, Opera and Edge,
and no bot category at all. Our first-party ingest had no equivalent until
`botDetection.ts`, which made the one dataset we fully control the least
defended of the three.

The classifier's bias is deliberate: **a missed crawler inflates a number, a
misclassified human deletes a real session.** The test suite asserts that six
real browser agents are never matched, and that assertion is not to be relaxed
in order to catch one more bot.

### Datacenter and ASN filtering — assessed, deliberately NOT automatic

The data is available: AWS publishes 10,646 IPv4 and 6,108 IPv6 prefixes, GCP
and Cloudflare publish theirs, and `net.BlockList` already matches CIDRs for
the internal-traffic registry, so wiring it up would be straightforward.

It is not wired up because the false positives land on real users. Traffic from
cloud ranges is not only bots: corporate egress, VPNs and — decisively —
**iCloud Private Relay**, which routes genuine Safari sessions through partner
networks. Safari is this platform's second browser by volume. A blanket
datacenter block would silently delete a meaningful share of real iPhone
traffic, and nothing downstream could tell those sessions had ever existed.
That is a worse failure than the one it fixes.

What to do instead when a specific range is genuinely non-human: add it to the
internal-traffic registry (Analytics → Internal traffic), which already accepts
any CIDR, and label it. That keeps the decision explicit, reversible and
attributable to a person rather than to a heuristic.

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
