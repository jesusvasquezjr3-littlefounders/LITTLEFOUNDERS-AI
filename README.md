# LittleFounders

**LittleFounders** is a gamified financial-literacy and entrepreneurship learning platform for kids and families: gamified courses, an AI tutor, and parent-assigned tasks with rewards — under verified parental control.

This README is the single operational document of the repo: everything essential to work between this machine and production.

## Service map

| Service | Codename | Mission | Port | Deploy | Live domain |
|---|---|---|---|---|---|
| `database/` | Vault | Schema, migrations, RLS, seeds — Supabase self-hosted | — | Railway (Supabase stack) | `auth-b2c.littlefounders.ai` |
| `backend/` | Core | Main API: auth, roles, families, tasks, profiles — the ONLY service the SPA calls | 4000 | Railway | `api-b2c.littlefounders.ai` |
| `frontend/` | — | React SPA: learn, tutor, tasks, profile | 5173 | Vercel | `littlefounders.ai` |
| `coursegen/` | Forge | Course & lesson generation (DeepSeek + Qwen) | 4001 | Railway | internal-only |
| `audiogen/` | Echo | TTS audio for lessons (Qwen3-TTS, 3 locales) | 4002 | Railway | internal-only |
| `parent-id-check/` | Guardian | Guardian identity verification | 4004 | Railway | internal-only |
| `email-server/` | Courier | Transactional email — Haraka SMTP → Amazon SES relay | 4005 | Railway | internal-only (live) |
| `filebase/` | Depot | Media storage — lesson audio & images (Railway volume) | 4006 | Railway | `media-b2c.littlefounders.ai` |
| `picturegen/` | Prism | Image generation — Qwen `qwen-image`, cache-first | 4007 | Railway | internal-only |
| `dataintel/` | Data Intel | DuckDB analytics warehouse | 4008 | Railway | internal-only |
| `pulse/` | Pulse | Observability — Plausible CE + Umami + Uptime Kuma | — | Railway (5 services) | trackers + Kuma only |
| `oracle/` | Oracle | AI Tutor runtime — live sessions, voice (Inworld), moderation | 4009 | Railway | one websocket (`/ws/tutor`) |
| KartRush (separate repo `LittleFounders-AI/KartRush`) | KartRush | Embedded 3D kart-racer lesson game, static bundle only | 4010 | Railway (`kartrush`) | framed in an `<iframe>` |

All Railway services live in one project (**`littlefounders-b2c`**) and talk over Railway private networking (`<service>.railway.internal`). Only Core, Kong (Vault gateway), Depot reads, and Pulse's browser-facing surfaces are public. Internal endpoints require the `x-internal-api-key` header (one shared `INTERNAL_API_KEY`, timing-safe comparison). Core's CORS allow-list is exactly `FRONTEND_URL`.

**Stack:** TypeScript + Express (ESM, Node 24) on every service · React 18 + Vite + Tailwind · Supabase self-hosted (Postgres, GoTrue, PostgREST, Realtime, Storage, Kong) · Vitest + Supertest · Zod at every edge · i18n `en-US` / `es-MX` / `pt-BR` · 11 independent npm packages, no workspaces.

## Local development

Set up the whole workspace — install dependencies for all 11 npm packages, provision the local Supabase stack, load test users and QA courses:

```bash
npm run setup
npm run dev                              # Vite only (lightweight default)
DEV_PROFILE=core DEV_DB=1 npm run dev    # frontend + Core + Supabase
DEV_PROFILE=all  DEV_DB=1 npm run dev    # everything (9 watchers — heavy)
```

Database (from `database/`): `npm run db:up` / `db:reset` (run twice after schema changes — both must pass) / `db:types` (regenerate the shared TS types — never hand-edit) / `db:sync` (materialize the pinned Supabase clone at `database/SUPABASE_VERSION`). Local and production run the **same pinned Supabase release**; to upgrade, bump `SUPABASE_VERSION`, `db:sync`, prove locally, then update the Railway image tags to match.

Migrations are sequential `NNNN_description.sql`, idempotent (`IF NOT EXISTS`), and **an applied migration is never edited — write a delta**.

Secrets: only `.env.example` files are tracked. Real values live in Railway variables / Vercel env / GitHub secrets. If a secret ever lands in git: **rotate first**, then purge history.

## Gates (local + CI)

```bash
npm run typecheck:all && npm run lint:all && npm run test:all
npm run secrets:check     # no credential patterns in tracked files
npm run i18n:check        # 3-locale key parity + hardcoded-string scan
npm run tools:test        # the repo's own gate self-tests
```

`.github/workflows/repo-gates.yml` runs the repo-wide checks (secrets, i18n, marketing paths, provider/instrument/demo-step parity, tools self-tests) on every PR and push to `main`, without a `paths:` filter. Per-service CI owns type-check/lint/test/build. Before a release: `npm run release:readiness -- <course>` (all local gates + zero-spend dry-runs) and `npm run production:preflight` (read-only Railway inventory/config check — operator-only, never in CI).

## Deploying

**CD is token-based** — no GitHub App integration. Each app service has `.github/workflows/<service>-cd.yml`, triggered by that service's CI succeeding on `main` (`workflow_run`, checked out at `head_sha`). Pushing to `main` fans out CI across all services, so batch work into one push. Repo secrets: `RAILWAY_TOKEN`, `RAILWAY_SSH_PRIVATE_KEY`, `INTERNAL_API_KEY`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.

**Railway (manual deploy of one service):**

```bash
railway up <service> --path-as-root --service <name> --ci
```

- `--path-as-root` re-roots the archive, so the root `.gitignore` stops matching — **every service carries its own `.railwayignore`** (exclude `node_modules/`, `dist/`, `.env*`, bulk dev data like `audiogen/src/samples/`; keep runtime data like `coursegen/curriculum/` and `parent-id-check/*.traineddata`).
- Railway sets `NODE_ENV=production`, which makes `npm ci` omit devDependencies — `NPM_CONFIG_INCLUDE=dev` is load-bearing on any service that builds from source.
- Every service's `railway.json`: Nixpacks, `startCommand: npm run start`, `healthcheckPath: /health` (standard envelope `{ data: { service, version, status: "ok" }, error: null }`). The healthcheck gates the deploy — confirm `/health` 200 and clean `railway logs` after.
- Vault internals (db, kong, plain-image services) are **not in CD**; deploy manually. `db` and `kong` build from small Dockerfiles in `database/railway/{db,kong}/` that `FROM` the pinned images.
- `railway redeploy --service <name> --yes` is the reliable way to make a container pick up an env var whose value didn't change (`railway variable set` only redeploys on a value *change*; `railway service restart` has hung).

**Frontend (Vercel):** project `littlefounders-ai`, **Root Directory = `frontend`** (if blank, Vercel builds the repo root and deep links 404). The SPA rewrite targets `/app-shell.html` (`noindex` shell); `index.html` is the prerendered home page. After a frontend deploy touching the public surface: `npm run seo:live` (asserts what production actually serves a crawler) and `npm run seo:indexnow`.

**New service checklist:** copy an existing `railway.json` + `.railwayignore` + `.env.example` → `railway add --service <name>` in `littlefounders-b2c`, set variables (internal URLs use `<dep>.railway.internal`) → public domain only if browser-facing (`railway domain <service>-b2c.littlefounders.ai …` + CNAME/TXT in Vercel's DNS zone), otherwise no domain + `x-internal-api-key` on every route → deploy, verify `/health` → add `<service>-cd.yml` → decide hot-path (always-warm) vs idle (enable Serverless scale-to-zero).

## Production database (migrations)

Production's migration ledger is `public.schema_migrations` (SHA-256 receipts, one file per transaction). The only documented path:

```bash
npm run production:preflight                       # read-only inventory/config check
RAILWAY_TOKEN=… RAILWAY_SSH_KEY_PATH=~/.ssh/id_ed25519 \
  npm --prefix database run db:railway:migrate -- --dry-run            # review the plan
RAILWAY_TOKEN=… RAILWAY_SSH_KEY_PATH=~/.ssh/id_ed25519 \
  npm --prefix database run db:railway:migrate -- --confirm-production # apply
```

`railway-migrate.sh` verifies the live high-water mark with read-only signature probes before touching anything, refuses checksum drift, and never seeds or drops data. Take (and verify) a fresh Vault backup before applying. Direct ad-hoc access when needed: `railway ssh --service db -- psql -U supabase_admin -d postgres` (the CLI does **not** propagate remote exit codes — read the output, don't trust `$?`).

**Backups:** daily `pg_dump` via `.github/workflows/vault-backup.yml`, stored on filebase's Railway volume (a separate disk from `db`'s). A restore drill has been performed; re-drill after material schema changes.

## DNS & domains — records no deploy can recreate

DNS lives in **Vercel's zone** (`ns1/2.vercel-dns.com`). Domain convention: `<service>-b2c.littlefounders.ai`. These records exist **only** in DNS — deleting them breaks capabilities silently, with no error anywhere:

| Record | Holds up | Failure mode |
|---|---|---|
| Google-issued CNAME (Search Console, 2026-08-27) | Ownership of Search Console AND Bing Webmaster (imported from it) | Both consoles un-verify silently; search data just stops arriving |
| SES DKIM CNAMEs + MAIL FROM SPF/MX + `_dmarc` | Deliverability of all transactional mail | Mail lands in spam — looks like an engagement problem |
| `_railway-verify` TXT + service CNAMEs | Each public Railway service hostname | Service keeps running; its public hostname stops resolving |

## Scaling & cost

Railway bills almost entirely on **memory used** (diagnose: Project → Usage → View Cost by Service). Hot path (kong, auth, rest, db, backend, Redis, filebase, parent-id-check) stays always-warm; everything else runs Serverless scale-to-zero. Any worker-per-core server must be capped in prod (`KONG_NGINX_WORKER_PROCESSES=2` — the default was ~63% of the whole bill). Scale-up is manual but instant: `railway scale --service <name> <region>=<N>`; grow Core/Kong/rest replicas first when real load arrives.

## Legal & safety constants

- The authoritative Terms & Privacy text lives in the frontend i18n legal sections (`frontend/src/i18n/*/marketing.json`) — any edit must keep the three locales (`en-US`, `es-MX`, `pt-BR`) in structural parity in the same commit.
- No PII of minors ever reaches a third-party AI API beyond age band + first name (the Tutor's voice path is the one signed-off exception, gated by blocking guardian consent). AI output for kids passes moderation before display/speech. RLS on every user table; `audit_logs` append-only; `superadmin` only for `@littlefounders.ai`.

## License

Proprietary — all rights reserved. Third-party skills under `.github/skills/` retain their original licenses (see each skill's `_SOURCE.md`/`LICENSE`).
