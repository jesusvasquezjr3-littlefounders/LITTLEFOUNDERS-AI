# pulse/AGENTS.md — Domain rules for Pulse (observability stack)

> **Codename:** Pulse · **Mission:** platform analytics + system health, fully
> self-hosted. Like Vault, Pulse is a *pinned third-party stack*, not a TS
> service — there is no `npm test` here; the gates are pins, configs, and docs.
>
> **Last updated:** 2026-07-20 · All documentation in English (/AGENTS.md §1.0.4).

---

## What Pulse is

Five Railway services in `littlefounders-b2c`, defined under `pulse/railway/`:

| Railway service | Upstream (pinned in the Dockerfile) | Role | Exposure |
|---|---|---|---|
| `pulse-plausible` | `ghcr.io/plausible/community-edition:v3.2.1` | Web analytics (cookieless KPIs, GA4 import, Stats API v2) | Public (tracker + GA OAuth callback) |
| `pulse-clickhouse` | `clickhouse/clickhouse-server:24.12-alpine` | Plausible's event store | **Private only** |
| `pulse-db` | `postgres:16-alpine` | Shared Postgres — logical DBs `plausible` + `umami` | **Private only** |
| `pulse-umami` | `ghcr.io/umami-software/umami:3.2.0` | Behavioral analytics (funnels, heatmaps, session replay) | Public (tracker) |
| `pulse-kuma` | `louislam/uptime-kuma:2.4.0` | Continuous `/health` uptime + latency + status page + alerting | Public (own auth + 2FA) |

## Non-negotiables

1. **Version pins live in the Dockerfiles' `FROM` lines — nowhere else.** No
   floating tags (`latest`, `v3`, major-only) ever. Dependabot watches these
   files and auto-opens bump PRs (patch bumps automerge after CI; minor/major
   need human review — they can carry schema migrations). Never configure
   Railway's dashboard-side "Image Auto Updates": the pin must stay in git.
2. **Registry discipline:** Plausible pulls from **ghcr.io only**. The old
   Docker Hub `plausible/community-edition` is frozen at v2.1.4 and misses
   every v3.x security patch (incl. the CVE-2026-8467 RCE fix in v3.2.1 —
   the permanent security floor for this pin).
3. **ClickHouse and Plausible upgrade together.** The ClickHouse tag mirrors
   the one Plausible CE's own compose.yml ships for that release. Never bump
   it independently.
4. **§1.9 boundary (child safety):** Umami's replay/heatmap recorder is NEVER
   loaded on kid-role or `/admin/*` sessions. Behavioral capture is restricted
   to marketing + signed-in parent product surfaces; enforcement lives in the
   frontend gate (see `frontend/src/lib/analytics.tsx`). Plausible is
   cookieless/no-PII by design, but is intentionally restricted to consented
   public marketing acquisition: it does not observe product, OAuth, or admin
   routes.
5. **Internal traffic is excluded at the tracker, never at Plausible.**
   Plausible CE has no ingestion IP blocklist. The exclusion registry lives in
   Vault (`analytics_ip_exclusions`, migration 0045) and is enforced in two
   places we own: the SPA asks Core before mounting ANY tracker
   (`GET /api/v1/analytics/tracking-decision`), and Core drops first-party
   event batches from excluded networks. Exclusion is forward-only — it never
   rewrites history, and no document or UI may imply otherwise.
6. **Browser never talks to Pulse for data.** Admin dashboards read analytics
   and health exclusively through Core (`/api/v1/admin/*`), which holds the
   Plausible/Umami/Kuma API tokens server-side (§1.5 pattern). The ONLY
   browser-facing Pulse surfaces are the two tracker scripts and Plausible's
   GA OAuth callback.
7. **A monitor's lifetime is its service's lifetime, and a monitor is not live
   until it is on the status page.** Adding a service adds a Kuma monitor AND
   attaches it to the status page's `Services` group — Core reads
   `/api/status-page/pulse`, so a monitor that exists but is not on the page
   runs and alerts while staying invisible to `/admin`. RETIRING a service
   removes its monitor in the same change.
   The set is documented in `pulse/README.md` and must match Kuma. A monitor
   left pointing at a deleted service fails forever and emails forever — that
   is what happened to `gamegen` after the Game Engine was removed, and the
   noise was indistinguishable from a real outage until someone read the logs.
8. **A health endpoint that degrades inside a 200 needs a Keyword monitor.**
   `dataintel` answers `200 status:"ok"` while reporting
   `components.duckdb: "down"`; an HTTP-200 monitor is green throughout the
   outage it exists to catch. Match the compact JSON the service really emits
   (`"duckdb":"up"`) — confirm with `curl` first, because a keyword that never
   matches is a permanently red monitor, which is the same failure wearing the
   opposite colour. Any service whose `/health` can report a dead dependency
   without changing its status code gets the same treatment.
9. **State needs volumes.** `pulse-db` (PGDATA), `pulse-clickhouse`
   (/var/lib/clickhouse), `pulse-kuma` (/app/data). A Kuma redeploy without
   its volume wipes every monitor. Daily `pg_dump` of pulse-db runs via
   `.github/workflows/pulse-backup.yml` (Vault-backup pattern).
10. **Private networking is IPv6.** Every listener binds `::` (Plausible
   `LISTEN_IP`, Umami `HOSTNAME`, ClickHouse `listen_host`). A service that
   binds 0.0.0.0 is silently unreachable at `*.railway.internal`.
11. **Secrets only in Railway variables.** `pulse/.env.example` is the
   placeholder contract; `npm run secrets:check` gates every commit.

## Upgrade protocol

1. Dependabot opens the bump PR (or you edit the `FROM` line by hand).
2. Patch bump → CI green → automerge → `pulse-cd.yml` redeploys. Done.
3. Minor/major bump → read the upstream release notes for migration steps
   (Plausible majors have required data migrations), check the matching
   ClickHouse tag in that release's compose.yml, approve manually, watch the
   deploy logs, verify `/api/health` (Plausible), `/api/heartbeat` (Umami),
   and the Kuma dashboard afterwards.
4. Incidents & rollback: RUNBOOK.md § Pulse.

## Related docs

- `pulse/README.md` — service/env/endpoint tables, GA4 import runbook.
- `/CLAUDE.md` §1.2 (stack), §1.5 (service map), §1.9 (child safety).
- `backend/AGENTS.md` — the Core proxy endpoints that read from Pulse.
- `RUNBOOK.md` — backup/restore + incident procedures.


## Tracker capture mode — both vendors, non-negotiable

Plausible and Umami each auto-capture SPA navigations by default: on load they hook `history.pushState` and report every route change themselves. Mounting and ejecting the `<script>` tag does NOT control this — ejecting removes the node, not the hook the script already installed. On 2026-08-14 both were found recording `/admin/*` and product routes in production despite correct-looking route gates (RUNBOOK: "Plausible records `/admin/*` and product routes").

Therefore, in `frontend/src/lib/analytics.tsx`:

- Plausible mounts with `init({ autoCapturePageviews: false })` and the effect calls `trackPlausiblePageview()` per approved navigation.
- Umami mounts with `data-auto-track="false"` and the effect calls `trackUmamiPageview()`, which binds to the script's `load` event on first mount because the tracker is deferred.

The rule: **the predicate that authorises the mount must be the only thing that can emit an event.** Any tracker added here is mounted with automatic capture off and driven explicitly, or the vendor — not this document — defines the §1.9 boundary. Both options are covered by A/B-verified tests in `analytics.test.tsx`; reverting either makes its test fail.

Reads of stored history are scoped at query time — see the RUNBOOK entry for what that does and does not reach per tool.
