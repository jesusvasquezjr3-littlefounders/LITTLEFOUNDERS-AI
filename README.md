# LittleFounders

**LittleFounders** helps children and teenagers learn about money.

The product is being rebuilt feature by feature (owner decision, 8 October 2026). The parent console, tasks and rewards, the family wallet and the teen wallet were removed, together with the test suites, the repo gates, the product specification and the historical documentation. What a feature is and how it works is decided when that feature is rebuilt; nothing that survives in the code is a requirement. The state before the removal is the tag `archive/pre-clean-slate-2026-10-08`.

This README is the operational reference: how to run the repo and how it reaches production.

## What exists today

| Area | State |
|---|---|
| Public site | Landing (hero and problem sections), legal pages, the shared badge page |
| Accounts | Sign-up, sign-in, guest sessions, recovery, age screen, onboarding, parent ID verification, account deletion. Under discussion |
| Learning | Courses, lessons, placement, journal, rhythm, teen cooperative goals. To be rebuilt from zero |
| Mentor | The AI Mentor stage (`/tutor`) and Oracle. To be redesigned |
| Profile and social | Profile, avatar, settings, follows, blocks, reports |
| Staff console | `/admin` |
| Games | KartRush is embedded at `/learn/play/kartrush`; its code lives in the separate `LittleFounders-AI/KartRush` repo and `docs/games/KRV1-CONTRACT.md` is the wire contract |
| Content pipeline | Forge (`coursegen/`) is to be rebuilt from zero; Echo (`audiogen/`) and Prism (`picturegen/`) are to be reworked |

## Service map

| Service | Codename | Mission | Port | Deploy | Live domain |
|---|---|---|---|---|---|
| `database/` | Vault | Schema, migrations, RLS, seeds: Supabase self-hosted | n/a | Railway (Supabase stack) | `auth-b2c.littlefounders.ai` |
| `backend/` | Core | Main API, the only service the SPA calls | 4000 | Railway | `api-b2c.littlefounders.ai` |
| `frontend/` | n/a | React SPA | 5173 | Vercel | `littlefounders.ai` |
| `coursegen/` | Forge | Course and lesson authoring (DeepSeek + Qwen) | 4001 | Railway | internal-only |
| `audiogen/` | Echo | Lesson narration (Qwen3-TTS, 3 locales) | 4002 | Railway | internal-only |
| `parent-id-check/` | Guardian | Parent identity verification (OCR) | 4004 | Railway | internal-only |
| `email-server/` | Courier | Transactional email: Haraka SMTP to Amazon SES | 4005 | Railway | internal-only |
| `filebase/` | Depot | Media storage on a Railway volume | 4006 | Railway | `media-b2c.littlefounders.ai` |
| `picturegen/` | Prism | Image generation (Qwen), cache-first | 4007 | Railway | internal-only |
| `dataintel/` | Data Intel | DuckDB analytics warehouse | 4008 | Railway | internal-only |
| `pulse/` | Pulse | Observability: Plausible CE, Umami, Uptime Kuma | n/a | Railway (5 services) | trackers and Kuma only |
| `oracle/` | Oracle | AI Mentor runtime: live sessions, voice (Inworld), moderation | 4009 | Railway | one websocket (`/ws/tutor`) |

All Railway services live in one project (`littlefounders-b2c`) and talk over Railway private networking (`<service>.railway.internal`). Only Core, Kong (the Vault gateway), Depot reads and Pulse's browser-facing surfaces are public. Internal endpoints require the `x-internal-api-key` header. Core's CORS allow-list is exactly `FRONTEND_URL`.

**Stack:** TypeScript + Express (ESM, Node 24) on every service, React 18 + Vite + Tailwind, Supabase self-hosted (Postgres, GoTrue, PostgREST, Realtime, Storage, Kong), Zod at every edge, i18n in `en-US`, `es-MX` and `pt-BR`. Eleven independent npm packages, no workspaces, no shared types: a wire shape used by two services is written in both.

## Local development

**Prerequisites:** Node 24 (`.nvmrc`), Docker Desktop running (the database is a container stack), and the `supabase` CLI only to regenerate DB types.

```bash
npm run setup                            # from zero: installs all packages, resets the DB, seeds. DESTRUCTIVE to a local DB
npm run dev                              # Vite only
DEV_PROFILE=core DEV_DB=1 npm run dev    # frontend + Core + Supabase containers
DEV_PROFILE=all  DEV_DB=1 npm run dev    # every service + containers (several GB of RAM)
```

`npm run setup` calls `db:reset`, which deletes every container volume. On a checkout that only lacks dependencies, run `npm install` in the packages you touch instead.

**Local ports:** Kong `:8000`, Postgres session pooler `:54322`, Core `:4000`, Vite `:5173`, other services per the service map.

Database commands, from `database/`:

| Command | Effect |
|---|---|
| `npm run db:up` / `db:down` | Start or stop the stack, data kept |
| `npm run db:nuke` | Stop and delete all volumes |
| `npm run db:reset` | nuke, up, migrate |
| `npm run db:migrate` | Apply migrations not yet in the ledger |
| `npm run db:seed` / `db:seed:users` | Dev seeds, never production |
| `npm run db:types` | Regenerate `database/types/database.ts` from the local schema; never hand-edit it |

Migrations are sequential `NNNN_description.sql`. An applied migration is never edited; write a new one.

### Checking work

There are no test suites for now; they return per feature as each one is rebuilt. Until then a change is checked by:

```bash
cd <service> && npm run type-check && npm run lint && npm run build
```

and, for anything a person sees, by running it and looking at it in light and dark and in the three languages. Root aggregates: `npm run typecheck:all`, `npm run lint:all`, `npm run build:all` (Git Bash; in PowerShell `bash` is WSL and cannot see these paths). `npm run secrets:check` scans for committed secrets.

### Frontend layout

- `frontend/src/app-routes/`: the route tables, one module per area (`site`, `learn`, `mentor`, `profile`, `staff`, `core`).
- `frontend/src/app-shell/`: the signed-in and public shells and the navigation.
- `frontend/src/rebuild/design/`: the design system. `tokens.css` is the source of the design tokens.
- `frontend/src/i18n/<locale>/`: every user-visible string, in three locale files that keep identical keys. No user-visible text is written in a component.
- `frontend/rebuild.html`: a development-only preview entry (`?screen=`). The landing videos are rendered from it by `scripts/render-hero-video.mjs` and `scripts/render-problem-video.mjs`.
- `frontend/scripts/seo/site.mjs`: the one declaration of what search engines and AI crawlers are told. Keep it equal to the pages that exist.

## Deploying

Work is committed locally and pushed only when the owner decides, because **a push to `main` is a deploy.** Each service has `.github/workflows/<service>-ci.yml` (install, type-check, lint, build; `paths:`-filtered) and `<service>-cd.yml`, which deploys that service when its CI goes green on `main`. `database-cd.yml` also applies additive migrations to production automatically.

`main` has a ruleset that requires a pull request and the status check "Mentor self-improvement governance (C.22)". The workflow that produced that check was removed with the gates, so the ruleset must be changed before the next merge (`docs/operations/BRANCH-PROTECTION.md`).

Repo secrets: `RAILWAY_TOKEN`, `RAILWAY_SSH_PRIVATE_KEY`, `INTERNAL_API_KEY`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.

**Railway, one service by hand:**

```bash
railway up <service> --path-as-root --service <name> --ci
```

- `--path-as-root` re-roots the archive, so the root `.gitignore` stops matching; every service carries its own `.railwayignore`.
- Railway sets `NODE_ENV=production`, which makes `npm ci` omit devDependencies; `NPM_CONFIG_INCLUDE=dev` is required on any service that builds from source.
- Every service's `railway.json` uses Nixpacks, `npm run start` and a `/health` healthcheck that gates the deploy.
- Vault internals (db, kong) are not in CD; they build from `database/railway/{db,kong}/` and are deployed by hand.
- `railway redeploy --service <name> --yes` makes a container pick up an env var whose value did not change.
- The Railway CLI and `railway ssh` do not propagate remote exit codes: read the output.

**Frontend (Vercel):** project `littlefounders-ai`, Root Directory `frontend`. The SPA rewrite targets `/app-shell.html` (a `noindex` shell); `index.html` is the prerendered home page. A push does not prove a deploy: confirm the Vercel build happened.

**New service:** `bash agent/tools/new-service.sh`, then `railway add --service <name>` in `littlefounders-b2c`, set variables, give it a public domain only if a browser calls it, deploy, check `/health`, add `<service>-cd.yml`.

## Production database

Production's migration ledger is `public.schema_migrations`. There are two paths.

**Automatic, additive migrations only.** `database-cd.yml` applies pending migrations when `database/scripts/gate-auto-apply.mjs` judges every one of them purely additive. So pushing an additive migration to `main` applies it to production.

**By hand, for anything that removes or narrows** (a dropped table or column, a tightened constraint):

```bash
npm run production:preflight                       # read-only check
RAILWAY_TOKEN=… RAILWAY_SSH_KEY_PATH=~/.ssh/id_ed25519 \
  npm --prefix database run db:railway:migrate -- --dry-run
RAILWAY_TOKEN=… RAILWAY_SSH_KEY_PATH=~/.ssh/id_ed25519 \
  npm --prefix database run db:railway:migrate -- --confirm-production
```

Deploy the code that stops using a table before the migration that drops it. Take and verify a fresh Vault backup first. `database`'s `npm test` refuses a migration over 23,000 bytes (each travels as one command-line argument): split it.

**Backups:** `vault-backup.yml` (08:00 UTC) and `pulse-backup.yml` (08:30 UTC) write daily `pg_dump`s to Depot's Railway volume. Procedures: `docs/operations/BACKUP-RESTORE-ROLLBACK.md`.

## Scheduled production jobs

These workflows run against production on a schedule. Several are promises to users, not maintenance, and stay in force while the features they serve exist.

| Workflow | When (UTC) | What it does |
|---|---|---|
| `tutor-retention.yml` | 03:00 daily | The Mentor's 90-day data-retention sweep |
| `tutor-retention-watch.yml` | 06:00 daily | Notices when that sweep stops running |
| `badge-link-retirement.yml` | 03:30 daily | Deletes the image of every dead legacy badge link |
| `account-deletion.yml` | 03:45 daily | Erases accounts whose 14-day grace period ended and retries failed erasure steps |
| `social-retention.yml` | 04:15 daily | Expires and deletes old connection requests, reports and notices |
| `learning-retention.yml` | 04:30 daily | Trims practised days older than 400 days |
| `tutor-content-bridge.yml` | 06:50 daily | Checks that the Mentor's skill graph still reaches published content |
| `insights-maintenance.yml` | 07:30 daily | Insights rollup refresh and retention prune |
| `vault-drift.yml` | 07:30 daily | Checks that production's schema is where the repo says it is |
| `vault-backup.yml`, `pulse-backup.yml` | 08:00, 08:30 daily | Database backups |
| `ops-job-watch.yml` | 10:00 daily | Opens or comments on the `ops-watchdog` issue when a watched job is stale |
| `mentor-evaluation-loop.yml` | hourly | Scores ended Mentor sessions, zero spend |
| `mentor-bias-audit.yml`, `mentor-equity-audit.yml` | monthly | Mentor bias and equity checks, zero spend |
| `mentor-live-content-monitor.yml`, `mentor-review-routing-audit.yml` | weekly, quarterly | Mentor live-content and review-routing reports |
| `content-retro-checks.yml` | Mon 05:00 | Re-verifies courses with an open release check |
| `nsm-weekly-export.yml`, `tutor-skill-curation.yml` | Mon | Weekly exports and proposals; they write nothing to the catalogue |

## DNS and domains

DNS lives in Vercel's zone. Domain convention: `<service>-b2c.littlefounders.ai`. These records exist only in DNS, and deleting them fails silently:

| Record | Holds up | Failure mode |
|---|---|---|
| Google-issued CNAME | Search Console and Bing Webmaster ownership | Both un-verify; search data stops arriving |
| SES DKIM CNAMEs, MAIL FROM SPF/MX, `_dmarc` | Deliverability of all transactional mail | Mail lands in spam |
| `_railway-verify` TXT and service CNAMEs | Each public Railway hostname | The hostname stops resolving |

## Scaling and cost

Railway bills mostly on memory used. Four services run Serverless scale-to-zero: `coursegen`, `audiogen`, `picturegen`, `dataintel`. Everything else is always warm; Oracle in particular terminates the browser's websocket and must not cold-start in front of a learner.

Oracle's daily spend ceiling (`DAILY_SPEND_CEILING_USD`) is enforced per process: at N replicas the real ceiling is N times the configured one. Every model, image and speech call is billed; never add a retry or fallback that silently repeats paid work.

## Things the code does not tell you

- **Children's data.** No personal data of a minor reaches a third-party AI API beyond age band and first name; AI output for children passes moderation before it is shown or spoken; a minor's microphone needs a guardian's consent and is enforced server-side in Oracle. Changing any of this is an owner decision.
- **No real money.** Nothing in the product moves or represents real money.
- **Secrets.** Only `.env.example` files are tracked. If a secret lands in git, rotate it first, then purge history.
- **Dev machines differ.** This repo is worked from an 8 GB Apple M2 and from a 32 GB Windows box. Measure the machine you are on before running several servers or browsers at once.
- **Windows.** Edits can land as CRLF while the repo is LF (a small change shows as a whole-file rewrite). In PowerShell `bash` is WSL's; use Git Bash for the shell scripts.
- **`frontend/vercel.json` carries the cache policy.** `/assets/*` is content-hashed and immutable; `/fonts/*`, `/basis/*` and the stable-named media folders are cached for days, so regenerating one of those files requires renaming it.
- **Old citations.** Many source comments cite documents, requirement ids and gates that no longer exist (`ORACLE.md`, `DESIGN.md`, "Bible 02", "OD-28", `check-*.mjs`). They are history. Remove them when you touch the file; never treat them as rules.
- **English-only identifiers and documentation.** Routes, tables, files, i18n keys, comments, commit messages and docs are in English; only locale text is translated.

## License

Proprietary, all rights reserved. The third-party skill under `.github/skills/` and `.claude/skills/` (the same files, read by two tools) keeps its original license; its `_SOURCE.md` records the upstream project.
