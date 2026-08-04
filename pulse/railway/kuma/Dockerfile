# Pulse (observability) — Uptime Kuma, continuous /health monitoring.
# Polls every service's GET /health envelope over Railway private networking
# ("HTTP JSON Query" monitors asserting data.status == "ok"), keeps uptime %
# and latency history, and alerts on downtime. This fills the one gap Railway
# leaves open: its Healthcheck Path only gates deploys — it does NOT monitor
# a live service afterwards, and it collects no latency/error signals.
#
# 2.4.0 is the security floor (patched an admin-surface RCE class issue);
# keep the pin fresh via Dependabot — its admin UI is the sensitive surface.
FROM louislam/uptime-kuma:2.5.0

# State (monitors, history) is SQLite under /app/data — REQUIRES the Railway
# volume mounted there, or every redeploy wipes the monitor config.
#
# PORT must be set as a Railway SERVICE VARIABLE (=3001): Kuma honours PORT,
# but Railway injects its own default (8080) which wins over any image
# default, so pin it explicitly or Core's KUMA_URL (:3001) can't reach it
# (verified 2026-07-21).
