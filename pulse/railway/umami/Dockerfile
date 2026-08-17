# Pulse (observability) — Umami v3, the behavioral analytics engine
# (funnels, heatmaps, session replay, revenue). MIT-licensed, single-Postgres.
# v3 dropped MySQL, so image tags are plain semver (no postgresql- prefix).
#
# §1.9 boundary (NON-NEGOTIABLE, enforced in the frontend): Umami's
# replay/heatmap recorder is NEVER loaded on kid-role sessions — behavioral
# capture runs only on marketing + parent/admin surfaces. See
# frontend/AGENTS.md and the WALKTHROUGH decision log (2026-07-20).
FROM ghcr.io/umami-software/umami:3.3.0

# Railway private networking is IPv6 — Next.js standalone binds the HOSTNAME
# env; :: makes it reachable at pulse-umami.railway.internal.
ENV HOSTNAME="::"

# PORT must be set as a Railway SERVICE VARIABLE (=3000), NOT here: Railway
# injects its own PORT (default 8080) at runtime and it wins over Dockerfile
# ENV, so an ENV PORT is silently ignored — the app would bind 8080 while
# Core/Kuma probe 3000 (verified 2026-07-21). See pulse/.env.example.

# DATABASE_URL + APP_SECRET are Railway variables — see pulse/.env.example.
