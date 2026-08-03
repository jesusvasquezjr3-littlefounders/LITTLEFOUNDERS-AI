# LittleFounders

**LittleFounders** is a gamified financial-literacy and entrepreneurship learning platform for kids and families. Kids learn through highly gamified courses, an AI tutor, and parent-assigned tasks with rewards — under verified parental control.

> **v2 — total platform rebuild.** `main` is the v2 monorepo and the only branch that deploys (v1's last state is reachable only via git history, see RUNBOOK.md). `littlefounders_v2` was the working branch during the rewrite and is no longer developed on.
>
> **AI agents:** read [`AGENTS.md`](AGENTS.md) before touching anything.
>
> **Production status (2026-07-20):** deployed and live — real email confirmation sends through Courier (Haraka → Amazon SES) with branded trilingual templates, and **Google social login is LIVE** (verified end-to-end: Google → GoTrue → session → dashboard). See ROADMAP.md "Day 8" and WALKTHROUGH.md "Current State" for the full rollout narrative.

## Service map

| Service | Codename | Mission | Port | Deploy | Live domain |
|---|---|---|---|---|---|
| [`database/`](database/) | Vault | Schema, migrations, RLS, seeds — Supabase self-hosted | — | Railway (Supabase stack) | `auth-b2c.littlefounders.ai` |
| [`backend/`](backend/) | Core | Main API: auth, roles, families, tasks, profiles | 4000 | Railway | `api-b2c.littlefounders.ai` |
| [`frontend/`](frontend/) | — | React SPA: learn, tutor, tasks, profile | 5173 | Vercel | `littlefounders.ai` |
| [`coursegen/`](coursegen/) | Forge | Course & lesson generation (DeepSeek + Qwen) | 4001 | Railway | — (internal-only, no public domain) |
| [`audiogen/`](audiogen/) | Echo | TTS audio for lessons (3 locales) | 4002 | Railway | — (internal-only, no public domain) |
| [`parent-id-check/`](parent-id-check/) | Guardian | Guardian identity verification (kid/bigfounder gating) | 4004 | Railway | — (internal-only, no public domain) |
| [`email-server/`](email-server/) | Courier | Transactional email — Haraka SMTP → Amazon SES relay | 4005 | Railway (internal-only) | **live** — GoTrue auth mail via SES |
| [`filebase/`](filebase/) | Depot | Media storage — lesson audio & generated images (Railway volume) | 4006 | Railway | `media-b2c.littlefounders.ai` |
| [`picturegen/`](picturegen/) | Prism | Image generation — art-director judge + Qwen `qwen-image-max`, cache-first (assets in Depot, index in Vault) | 4007 | Railway | — |
| [`dataintel/`](dataintel/) | Data Intel | DuckDB analytics warehouse — retention, lesson quality, segmentation, forecasting, anomalies and experiments | 4008 | Railway | — (internal-only, no public domain) |
| [`pulse/`](pulse/) | Pulse | Observability — analytics (Plausible CE + Umami) & health (Uptime Kuma), pinned stack | — | Railway (5 services) | trackers + Kuma only |

All Railway services live in one project (`littlefounders-b2c`). Internal services have no public domain by design (AGENTS.md §1.5) — only Core, Vault's Kong gateway, Depot, and Pulse's browser-facing surfaces (the two tracker scripts, Plausible's GA OAuth callback, Kuma's own-auth UI) are reachable from outside Railway's private network; all analytics/health DATA is read through Core.

## Stack

TypeScript + Express (ESM, Node 24) on every service · React 18 + Vite + Tailwind frontend · Supabase (self-hosted on Railway): Postgres, Auth, Storage, Realtime · Vitest + Supertest · Zod · i18n: `en-US`, `es-MX`, `pt-BR` · light/dark mode.

## Quickstart (Automated Local Setup)

To set up the entire workspace, install dependencies for all 10 npm packages (every service plus the frontend), provision the Supabase database, and load the test users and QA courses, run:

```bash
npm run setup
```

After setup is complete, start all services simultaneously with a single command:

```bash
npm run dev
```
*(This streams all backend, frontend, and generation services into one unified terminal. Press `Ctrl+C` to cleanly stop all of them.)*

> **Advanced Database Management**: If you need to manage Supabase manually (e.g., generate new TS types, run raw migrations, or export a course), see the detailed commands in [`database/README.md`](database/README.md).

Repo-wide gates (from root):

```bash
npm run typecheck:all && npm run lint:all && npm run test:all
npm run docs:check     # AGENTS.md == CLAUDE.md
npm run secrets:check  # no committed secrets
npm run i18n:check     # 3-locale key parity + hardcoded-string scan
npm run release:readiness -- financial-education  # all local gates + course/audio dry-runs; zero spend
npm run production:preflight                         # Railway production inventory/config; read-only
npm run production:preflight:test                    # fake-Railway regression test; no remote access
```

`release:readiness` is the final local handoff check. It never deploys, runs
production migrations, publishes content, or calls a paid provider; it leaves
the dry-run reports under `coursegen/runs/` for inspection.

`production:preflight` is operator-only and read-only. It checks the Railway
service inventory, active `RUNNING` instances, and required provider/service
variables without printing secret values; it must pass before the
migration/deploy handoff.

Those last three also run in CI via [`.github/workflows/repo-gates.yml`](.github/workflows/repo-gates.yml) — on every pull request and every push to `main`/`littlefounders_v2`, deliberately **without** a `paths:` filter, because a secret hardcoded in `backend/` or an unmirrored `AGENTS.md` edit touches no path a per-service workflow watches. Per-service CI still owns type-check/lint/test.

## Documentation entry points

1. [`AGENTS.md`](AGENTS.md) — operating rules for AI agents (identical to `CLAUDE.md`)
2. [`doc_map.md`](doc_map.md) — topic → document routing index
3. [`ROADMAP.md`](ROADMAP.md) — sprint plan and architecture decisions
4. [`GLOSSARY.md`](GLOSSARY.md) — canonical terminology
5. [`DESIGN.md`](DESIGN.md) — frontend design system (authoritative; desktop+mobile responsiveness is non-negotiable)
6. [`DEPLOYMENT.md`](DEPLOYMENT.md) — how services ship & run in production: deployment isolation, security posture, scaling, cost right-sizing, and the **new-microservice checklist** (§8)
7. [`agent/`](agent/) — prompt templates, workflows, and tools for AI-agent sessions

## License

Proprietary — all rights reserved. Third-party skills under `.github/skills/` retain their original licenses (see each skill's `_SOURCE.md`/`LICENSE`).
