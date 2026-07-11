# DEPLOYMENT.md — Supabase Self-Hosted on Railway

> Runbook placeholder — filled in during ROADMAP Day 4–5. Deploying is a BOUNDARIES action.

## Plan

1. Deploy the Supabase stack via the Railway template (Postgres, Kong, GoTrue, PostgREST, Realtime, Storage, Studio, postgres-meta).
2. Pin component versions here (table below) — upgrades are manual and deliberate.
3. Configure GoTrue: email signups on, JWT secret generated (Railway secret, never committed), site URL = Vercel frontend.
4. Apply `migrations/` in order; run NO seeds in production.
5. Wire service env vars (backend `SUPABASE_*`) from Railway shared variables.
6. **Before any real user data:** backup schedule (`pg_dump` to external storage) + one successful restore drill, recorded in /RUNBOOK.md.

## Component versions (pin at deploy)

| Component | Version | Notes |
|---|---|---|
| postgres | TBD | |
| gotrue | TBD | |
| postgrest | TBD | |
| realtime | TBD | |
| storage-api | TBD | |
| kong | TBD | |
| studio | TBD | |

## Costs & ops (accepted trade-off, WALKTHROUGH 2026-07-11)

~7–8 containers ≈ $20–40/mo. Backups/upgrades are ours. Local dev never depends on this deployment (Supabase CLI stack instead).
