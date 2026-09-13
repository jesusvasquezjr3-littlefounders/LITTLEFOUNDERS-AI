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
| KartRush (separate repo `LittleFounders-AI/KartRush`) | KartRush | 3D kart-racer lesson game, static bundle only | 4010 | Railway (`kartrush`) | deployed, **not yet wired in** |

KartRush's row is the one forward-looking entry: the service is deployed, but **this repo does not reference it anywhere** — no iframe, no game URL, no route. "KartRush" appears in exactly one file, this README. Whoever wires it up is building that integration, not maintaining one.

All Railway services live in one project (**`littlefounders-b2c`**) and talk over Railway private networking (`<service>.railway.internal`). Only Core, Kong (Vault gateway), Depot reads, and Pulse's browser-facing surfaces are public. Internal endpoints require the `x-internal-api-key` header (one shared `INTERNAL_API_KEY`, timing-safe comparison). Core's CORS allow-list is exactly `FRONTEND_URL`.

**Stack:** TypeScript + Express (ESM, Node 24) on every service · React 18 + Vite + Tailwind · Supabase self-hosted (Postgres, GoTrue, PostgREST, Realtime, Storage, Kong) · Vitest + Supertest · Zod at every edge · i18n `en-US` / `es-MX` / `pt-BR` · 11 independent npm packages, no workspaces.

## Local development

**Prerequisites:** Docker Desktop (running — the database is a container stack), Node **24** (`.nvmrc`), and the `supabase` CLI only if you need to regenerate DB types.

**NON-NEGOTIABLE — before starting any work:** confirm your machine's actual capabilities (Node version matches `.nvmrc`, Docker is running, available RAM/CPU, which CLIs are installed) rather than assuming they match another collaborator's setup — dev machines on this project vary, and an under-resourced one doesn't fail loudly, it fails as flaky timing tests (see "the dev machine is small" under Non-obvious invariants).

### Initialize from zero

```bash
npm run setup
```

One command does the whole provisioning (`scripts/setup-dev.sh`):
1. `npm install` in all 11 npm packages, and copies each `.env.example` → `.env` (local defaults work out of the box; only paid-provider keys need real values, and only if you use those services).
2. `db:sync` — materializes the pinned `supabase/supabase` clone (`database/SUPABASE_VERSION` → `database/supabase/`, gitignored). Local and production run the **same pinned release**.
3. `db:reset` — starts the container stack from zero and applies every migration. First run generates the local secrets into `docker/.env` and flips the dev toggles (`ENABLE_EMAIL_AUTOCONFIRM=true`, `ENABLE_ANONYMOUS_USERS=true`).
4. `db:seed` + `db:seed:users` — role-stub users and a linked demo family.
5. Imports and publishes the QA smoketest course (`first-lemonade-stand`).

**Local ports:** Kong (Supabase gateway) `:8000` — both `backend/.env` (`SUPABASE_URL`) and `frontend/.env` (`VITE_SUPABASE_URL`) point there; Postgres session pooler `:54322` (**not** 5432, deliberately — dev machines often have a Postgres there already); Core `:4000`; Vite `:5173`; other services per the service map.

### Day-to-day: containers and services

```bash
npm run dev                              # Vite only (lightweight default)
DEV_PROFILE=core DEV_DB=1 npm run dev    # frontend + Core + Supabase containers
DEV_PROFILE=all  DEV_DB=1 npm run dev    # 10 watchers + containers (several GB of RAM — opt-in)
```

`DEV_DB=1` is what starts the containers; without it only the TS watchers run. Ctrl+C stops everything cleanly.

Container lifecycle, from `database/` (each wraps the pinned upstream compose via `scripts/local-stack.sh`):

| Command | Effect |
|---|---|
| `npm run db:up` | Start the stack (first run generates secrets into `docker/.env`) |
| `npm run db:down` | Stop containers, **data kept** |
| `npm run db:nuke` | Stop + delete ALL volumes (data gone; `.env` kept) |
| `npm run db:reset` | nuke → up → migrate — the from-zero gate. **Run it twice after schema changes; both must pass** |
| `npm run db:migrate` | Apply only migrations not yet in the ledger |
| `npm run db:seed` / `db:seed:users` | Dev seeds (never production) |
| `npm run db:status` | `docker compose ps` |
| `bash scripts/local-stack.sh psql …` | psql inside the db container (no npm alias) |
| `npm run db:types` | Regenerate `database/types/database.ts` from the live local schema — the shared-type hub, **never hand-edit** |

Migrations are sequential `NNNN_description.sql`, idempotent (`IF NOT EXISTS`), and **an applied migration is never edited — write a delta**. After any schema change: `db:reset` twice, then `db:types` and commit the regenerated types.

To upgrade Supabase: bump `database/SUPABASE_VERSION`, `db:sync`, prove locally (`db:reset` twice + tests + auth smoke), then update the Railway image tags to match in the same change.

Secrets: only `.env.example` files are tracked. Real values live in Railway variables / Vercel env / GitHub secrets. If a secret ever lands in git: **rotate first**, then purge history.

## Mandatory testing — before every commit

**NON-NEGOTIABLE:** CD is chained to CI, so a push to `main` deploys every service it touched — a red push can ship a broken deploy, and one touching `database/migrations/` applies those migrations to production (see "Production database" below). Run these locally first, before every commit and again before every push — they are the same checks CI runs, and passing locally is required, not optional on the assumption CI will catch it.

**Always (any change):**

```bash
npm run typecheck:all && npm run lint:all && npm run test:all
npm run secrets:check     # no credential patterns in tracked files
npm run tools:test        # the repo's own gate self-tests + repo consistency
```

In the service(s) you touched, `npm run build` must also pass. Two caveats worth knowing before you trust a green: `database/` defines only `test`, so `run-all.sh` prints "no 'build' script, skipping" and the aggregates structurally exclude it; and only `frontend-ci.yml` and `oracle-ci.yml` actually run a build in CI, so for the other eight a broken build is caught by you or by the deploy, not by CI.

**Conditional, by area touched** (each catches a class of silent drift that no per-service test can see).
**The `cwd` column is not decoration** — the first block runs at the repo root, the second only inside that service. Same `npm run …` syntax, different directory: run a service gate from the root and you get `Missing script`, which reads like a broken repo rather than a wrong `cd`.

| If you touched… | Run (repo root) |
|---|---|
| `frontend/` (anything user-facing) | `npm run i18n:check` — 3-locale key parity + hardcoded-string scan |
| Public pages, titles, share copy, `site.mjs` | `npm run seo:check` + `npm run paths:check` |
| DeepSeek/Qwen config in `coursegen/` or `oracle/` | `npm run provider:check` |
| Tutor whiteboard / segment / demonstrate shapes | `npm run instruments:check`, `npm run preferred-types:check`, `npm run demo-step:check` |
| Roleplay scenes or their voices | `npm run roleplay-voices:check` |
| Any UI | Check in-browser at ~375px AND ~1280px — mobile and desktop both ship |

| If you touched… | Run (**`cd` into the service first**) |
|---|---|
| Tutor runtime, prompts or safety | `oracle/` → `npm run verify:tutor` (context rejects unlisted fields + injection canaries) |
| Tutor pedagogy/controller | `oracle/` → `npm run verify:pedagogy` + `npm run gym:pedagogy` (free — no network, no model) |
| Lesson Engine or character layer | `frontend/` → `npm run verify:lesson-engine` — real pointer events, hit-testing |
| Tutor HUD/layout | `frontend/` → `npm run verify:tutor-ui` + `npm run verify:tutor-a11y` (captions/phases) |
| 3D clips/rigs or island placement | `frontend/` → `npm run verify:rig` / `npm run verify:placement` |
| Migrations | `database/` → `npm run db:reset` twice (both green) + regenerate types (`npm run db:types`) |
| The KC graph / tutor content bridge | `backend/` → `npm run seed:kc`, then `npm run audit:content-bridge` — **`seed:kc` is a required rollout step, not an optional seed.** No migration inserts KC rows (`0052_kc_graph.sql` only creates the schema), so without it every activity falls through to paid live generation. |

`.github/workflows/repo-gates.yml` re-runs the repo-wide set (secrets, i18n, marketing paths, provider/instrument/preferred-types/demo-step parity, tools self-tests) on every PR and push, without a `paths:` filter — but CI is the backstop, not the gate. Commit locally as you go and **push once, at the end, when everything is green together.**

The reason to batch is not what it used to say here. All twelve `*-ci.yml` workflows carry `paths:` filters, so a push does *not* fan CI out across all 11 services — it runs `repo-gates.yml` plus CI for the services whose files actually changed. Batching matters for a different reason: **CD is chained to CI** (`workflow_run` on that service's CI going green on `main`), so every push of a touched service is a *deploy* of it. Ten pushes are ten deploys, and any one of them can land a half-finished change in production between commits.

**Every `verify:*` gate that *can* run in CI now does, and that is recent.** Until 2026-09-11 only `verify:tutor` was invoked by any workflow; the rest were honour-system, which is how a wrong `to=` in the /learn chapter list put every lesson behind a blank page for seven days with type-check, lint, 1,800 unit tests and the build all green — none of them opens the app and presses anything. Where they run now:

- `oracle-ci.yml` — `verify:tutor`, `verify:pedagogy`, `gym:pedagogy`. All three are free by construction (no network, no model), so there was never an argument for leaving them out.
- `frontend-ci.yml`, fast `ci` job — `npm run scenes:fetch` then `verify:placement`. The fetch is required, not incidental: `public/scenes/` is gitignored, and Depot serves those same assets content-addressed, so CI verifies the bytes a learner downloads.
- **`verify:rig` is the one gate that stays local, by design.** It reads the ~173 MB of uncompressed artist exports in `/glb/`, which live outside the repo and are published nowhere a runner can reach. It was wired into CI once and could only ever fail — it refused rather than reporting an unearned pass, and took the frontend deploy with it. Run it on a workstation that has `/glb/`; `scripts/verify-rig.mjs` states this in its own header.
- `frontend-ci.yml`, `browser-gates` job (`needs: ci`, so a push that fails type-check doesn't also pay for it) — `verify:lesson-engine`, `verify:tutor-ui`, `verify:tutor-a11y`. These drive real headless Chrome and measured ~38 min together on a dev machine (~20 + ~8 + ~10); the job's timeout is 60 because a runner is slower and a timeout kill reads as a product failure rather than a slow one.

**Still run the one for your area locally first** — a browser gate that only ever fails in CI costs a round trip per defect, and the whole reason these were worth wiring is that they catch what nothing else does.

## Mandatory before production

```bash
npm run release:readiness -- <course>   # ALL local gates + zero-spend course/audio dry-runs
npm run production:preflight            # read-only Railway inventory/config check (operator-only, never CI)
```

`release:readiness` requires a clean tree and never deploys, migrates, publishes or calls a paid provider. `production:preflight` must pass before any migration/deploy handoff and before authorizing paid generation. For Tutor prompt/strategy changes, the paid conversation gate `gh workflow run tutor-deploy.yml -f step=converse` (~$0.03) is the only check that answers "was that a good lesson" — deliberately not in CI so a flaky provider can't block a deploy. After a frontend deploy that touches the public surface: `npm run seo:live` (prove the CDN served it) and `npm run seo:indexnow`.

**Operator scripts — need live credentials, never in CI:**

```bash
npm --prefix backend run seed:kc               # REQUIRED after migration 0052 — loads database/seeds/kc_graph.v1.json into Vault.
                                               # Idempotent; refuses a cyclic graph. A missing seed surfaces as "no KC is ever
                                               # available" for every learner, far from its cause. In production this runs as
                                               # tutor-deploy.yml's `seed-kc` step, where the credentials live.
npm --prefix backend run audit:content-bridge  # does every mapped kc.skill_key still reach a PUBLISHED lesson? (daily in CI too)
npm --prefix backend run placement:verify      # the real placement search over the real catalog — NOT frontend's verify:placement,
                                               # which is 3D island placement and unrelated despite the name
npm --prefix backend run curate:tutor-skills   # propose-only report: KCs with no skill file, misconceptions with no remediation
```

## Deploying

**CD is token-based** — no GitHub App integration. Each app service has `.github/workflows/<service>-cd.yml`, triggered by that service's CI succeeding on `main` (`workflow_run`, checked out at `head_sha`). CI itself is `paths:`-filtered per service, so a push runs only the CI of what it touched — but each of those that goes green then deploys, which is why work is batched into one push rather than many. Repo secrets: `RAILWAY_TOKEN`, `RAILWAY_SSH_PRIVATE_KEY`, `INTERNAL_API_KEY`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.

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

Production's migration ledger is `public.schema_migrations` (SHA-256 receipts, one file per transaction). **There are two paths, and one of them is automatic.**

**Automatic, for additive migrations only.** `database-cd.yml` fires when database CI goes green on `main` and applies pending migrations *if* `gate-auto-apply.mjs` says every one of them is purely additive — adds or widens, nothing deployed can break on it, so order relative to the code doesn't matter. It refuses on every other path: an unfinished dry-run, a file this checkout doesn't have, a missing phase header, a declared phase that disagrees with the SQL. Of the repo's 49 migrations, 38 qualify. **So pushing a migration to `main` is applying it to production** — plan the push accordingly.

**By hand, and required for anything that removes or narrows.** The other 11 take a column or table away while an older deploy may still name it, and PostgREST then rejects every write that does — the mistake made by hand on 2026-08-26. `0049` deletes stored personal data irreversibly. Those are deliberately not automated:

```bash
npm run production:preflight                       # read-only inventory/config check
RAILWAY_TOKEN=… RAILWAY_SSH_KEY_PATH=~/.ssh/id_ed25519 \
  npm --prefix database run db:railway:migrate -- --dry-run            # review the plan
RAILWAY_TOKEN=… RAILWAY_SSH_KEY_PATH=~/.ssh/id_ed25519 \
  npm --prefix database run db:railway:migrate -- --confirm-production # apply
```

`railway-migrate.sh` verifies the live high-water mark with read-only signature probes before touching anything, refuses checksum drift, and never seeds or drops data. Take (and verify) a fresh Vault backup before applying. Direct ad-hoc access when needed: `railway ssh --service db -- psql -U supabase_admin -d postgres` (the CLI does **not** propagate remote exit codes — read the output, don't trust `$?`).

**Backups:** two daily `pg_dump`s of two different databases, both landing on filebase's (Depot) Railway volume — a genuinely separate disk and service from `db`'s, so a `db`-volume incident doesn't take the dumps with it. `vault-backup.yml` (08:00 UTC) dumps the production Vault; `pulse-backup.yml` (08:30 UTC) dumps pulse-db (Plausible + Umami). Railway allows one volume per service, which is why both share Depot's rather than getting a dedicated backup disk — so that volume is the single point of failure to watch. A restore drill has been performed; re-drill after material schema changes.

## Scheduled production jobs

Nine workflows run against production on a schedule with no external alerting — a missed or failed run surfaces only as a red GitHub run, so someone has to look. Two of them are promises to users, not maintenance:

| Workflow | When (UTC) | What it holds up |
|---|---|---|
| `tutor-retention.yml` | 03:00 daily | The AI Tutor's 90-day data-retention promise. **Legally load-bearing** — this is the sweep itself |
| `tutor-retention-watch.yml` | 06:00 daily | Notices when the sweep above stops running. A silent sweep failure otherwise looks identical to a sweep with nothing to delete |
| `tutor-content-bridge.yml` | 06:50 daily | Whether the KC graph still reaches published content — a broken bridge sends every activity to paid live generation |
| `insights-maintenance.yml` | 07:30 daily | Insights rollup refresh + retention prune |
| `vault-drift.yml` | 07:30 daily | Whether production's schema is where the repo thinks it is |
| `vault-backup.yml` | 08:00 daily | Vault `pg_dump` → Depot volume |
| `pulse-backup.yml` | 08:30 daily | Pulse `pg_dump` → Depot volume |
| `nsm-weekly-export.yml` | Mon 08:00 | Raw export of the events the North Star Metric is computed from |
| `tutor-skill-curation.yml` | Mon 09:20 | Proposes what to author next from the live curriculum. Propose-only — it writes nothing to the catalogue |

## DNS & domains — records no deploy can recreate

DNS lives in **Vercel's zone** (`ns1/2.vercel-dns.com`). Domain convention: `<service>-b2c.littlefounders.ai`. These records exist **only** in DNS — deleting them breaks capabilities silently, with no error anywhere:

| Record | Holds up | Failure mode |
|---|---|---|
| Google-issued CNAME (Search Console, 2026-08-27) | Ownership of Search Console AND Bing Webmaster (imported from it) | Both consoles un-verify silently; search data just stops arriving |
| SES DKIM CNAMEs + MAIL FROM SPF/MX + `_dmarc` | Deliverability of all transactional mail | Mail lands in spam — looks like an engagement problem |
| `_railway-verify` TXT + service CNAMEs | Each public Railway service hostname | Service keeps running; its public hostname stops resolving |

## Scaling & cost

Railway bills almost entirely on **memory used** (diagnose: Project → Usage → View Cost by Service). Exactly four services run Serverless scale-to-zero — `coursegen`, `audiogen`, `picturegen`, `dataintel` (the list `railway-preflight.sh` enforces, where "no active instance" is an expected state rather than a failure). Everything else is always-warm and must be RUNNING for a handoff. **Oracle is deliberately not on that list**: it terminates the browser's websocket, so a cold start would happen in front of a learner who has just pressed the button — the one place sleeping costs more than it saves. Any worker-per-core server must be capped in prod (`KONG_NGINX_WORKER_PROCESSES=2` — the default was ~63% of the whole bill).

Scale-up is manual but instant: `railway scale --service <name> <region>=<N>`; grow Core/Kong/rest replicas first when real load arrives. **One control does not scale with you, and it is the money one:** Oracle's daily spend ceiling is enforced per process, so at N replicas the real ceiling is `DAILY_SPEND_CEILING_USD × N`. Scaling Oracle out means dividing the configured ceiling by the replica count in the same change — the breaker still stops each instance's own runaway, but the platform-wide dollar figure is only as true as that division (`oracle/src/session/spend-guard.ts` says so at the top).

## Legal & safety constants

- The authoritative Terms & Privacy text lives in the frontend i18n legal sections (`frontend/src/i18n/*/marketing.json`) — any edit must keep the three locales (`en-US`, `es-MX`, `pt-BR`) in structural parity in the same commit.
- No PII of minors ever reaches a third-party AI API beyond age band + first name (the Tutor's voice path is the one signed-off exception, gated by blocking guardian consent). AI output for kids passes moderation before display/speech. RLS on every user table; `audit_logs` append-only; `superadmin` only for `@littlefounders.ai`.

## Non-obvious invariants & traps

Things a fresh session cannot derive from the code, each learned the expensive way.

**First, about the `/ORACLE.md §16` and `/AGENTS.md §1.14` citations all over the source.** They point at a documentation regime of ~20 files that was deliberately removed in commit `77b55596` and consolidated into this README. The pointers were left behind on purpose — each records *why* a specific line exists, and rewriting the files to strip that provenance would have cost more than it returned — but nothing said so, which made them read as broken.

- **~480 tracked files** cite a removed document: `/ORACLE.md` in ~170 of them, plus `DESIGN.md`, `TUTOR_3D.md`, `LESSON_ENGINE.md`, `COURSE_ENGINE.md`, `/LEGAL/AI_TUTOR_LEGAL_REVIEW.md`.
- **~170 files** cite `AGENTS.md §N` / `CLAUDE.md §N`. These are the confusing ones: the file still exists, so you open it, find five rules and no §1.14, and conclude the docs are broken. The numbered sections lived in the *old* 376-line AGENTS.md.

All of it is readable, not dead: `git show 77b55596^:ORACLE.md` (5,274 lines), `git show 77b55596^:AGENTS.md`, same form for any of them. Treat a cited section as **history, not authority** — it tells you what was decided and why, but what still binds is what a test or a gate pins. Two consequences: some quoted facts have since moved on (several citations still say "8 independent npm packages"; it is 11), and if you find a cited rule that *nothing* pins, that gap is the finding — see "assertions in a spec decay" the hard way.

- **No shared types across the 11 packages** (no workspaces, on purpose) — wire shapes are hand-mirrored: whiteboard instruments in 5 copies, `demonstrate` steps in 6, provider config in 2. The parity gates catch drift, but they don't order deploys: when adding a whiteboard kind, deploy **Core before Oracle** — Core's body union has no fallback member, so an unknown `kind` 400s the entire turn instead of dropping the board.
- **Dev machines here differ by an order of magnitude — measure the one you are on, don't inherit someone else's limit.** This repo has been worked from an Apple M2 with 8 GB and from a Windows 11 box with 16 threads and 32 GB; a work plan paced for one is wrong on the other. What does *not* vary: a loaded machine fails as flaky timing tests, not as a loud error, so a gate run beside a subagent fleet, a second suite or several Vite servers is not evidence in either direction — re-run it quiet before believing it. And note the direction that costs more: "it was machine load" is a hypothesis a quiet green confirms, never an explanation to accept on the spot. It has been the wrong answer twice here, and each time it was hiding a real defect. (An older version of this line told you to keep exactly one dev server because `verify:tutor-*` would collide on port 5173. That is no longer true: the harnesses spawn Vite with `--host 127.0.0.1` and parse whatever port it prints, so a held 5173 just moves them to 5174. You can also point them at a server you already have with `TUTOR_LAB_URL`, which skips the spawn entirely.)
- **On Windows, two traps cost time before you notice them.** Edits land as CRLF while the repo is LF, so a 16-line change shows up as a whole-file rewrite — check `file <path>` after editing, normalize with `perl -pi -e 's/\r\n/\n/g'`, and re-run the gate afterwards, because the normalization lands after whatever you already verified. And in PowerShell `bash` resolves to **WSL's** bash, which cannot see the Windows paths these scripts use (`agent/tools/run-all.sh` dies with `execvpe(/bin/bash) failed`); use Git Bash for anything shell-based.
- **`frontend/vercel.json` carries the cache policy, and JSON takes no comments — so the reasoning lives here.** Without a `headers` block Vercel served *everything* as `public, max-age=0, must-revalidate`, so every visit paid a conditional GET (~0.4 s each, measured) for every asset including the icon font, then 2.34 MB. Four rules, and all four are load-bearing: `/assets/*` is content-hashed by Vite and is therefore `immutable`; `/fonts/*` and `/basis/*` have **stable filenames**, so they get 30 days and **regenerating one requires renaming it** or clients keep the old copy for a month; `/(lottie|sounds|scenes|course-badges|marketing|og)/*` are stable-named media on 7 days, the same rename rule applying to them. The prerendered SEO output (`index.html`, `families/`, `faq/`, `how-it-works/`, `legal/`, `sitemap.xml`, `robots.txt`, `llms*.txt`) and `app-shell.html` deliberately keep the revalidating default — a cached app shell ships a stale app. Vercel applies `headers` before the filesystem/rewrite stage, so the catch-all `/(.*) → /app-shell.html` does not shadow them; confirm after any deploy with `curl -I https://littlefounders.ai/assets/<hashed>.js`.
- **The vendored icon font is an instance, not Google's file.** `frontend/public/fonts/material-symbols-outlined.woff2` is Material Symbols with `wght` and `opsz` pinned and `FILL` left live — 2,338,884 → 457,056 bytes, because the product varies exactly one axis. Nothing is subset away by glyph on purpose: coursegen's icon contract is `z.string().regex(/^[a-z0-9_]+$/)`, so lesson content may name *any* Material Symbols icon, and one outside a subset would silently render as the `help` fallback across a 1,305-lesson corpus. Re-vendoring from Google restores the 2.34 MB file and everything still works, just slowly — which is why `frontend/src/__tests__/iconFont.test.ts` guards it and carries the re-pinning command in its failure message. If you need a second weight, re-instance with both; don't un-pin the axis.
- **Every model/image/TTS call is billed per learner, forever.** Prism caches by request hash (an identical image request never hits the paid API twice); `release:readiness` dry-runs spend $0. Never add a retry loop or fallback that silently doubles paid work.
- **Two TTS paths is deliberate, not duplication:** Echo (`audiogen/`) does batch, cached lesson narration (Qwen3-TTS); Oracle's live voice is Inworld, interim, and reachable ONLY through `oracle/src/voice/provider.ts` — nothing outside that directory imports a provider SDK. ElevenLabs is sound-effects-only and never called at runtime.
- **Inworld SPEAKS prosody tags** — `[warm]` is read aloud to the child as "corchete warm". Probe before shipping direction tags (`gh workflow run tutor-deploy.yml -f step=probe-prosody`). The tutor model must be **non-reasoning** (`deepseek-chat`); a reasoner spent 87% of latency thinking (38 s/turn). `step=probe-models` asks the provider instead of guessing.
- **Kid voice consent is enforced server-side, per audio frame,** in Oracle's websocket — not just hidden client-side — and re-checked each turn so mid-session revocation bites immediately. Without consent the session connects but stays silent-mic. A raw Supabase JWT on that socket is a bug: only Core-minted, single-use, session-scoped tokens.
- **Oracle's context schema is `.strict()` and pinned to 14 fields by test** (`oracle/src/__tests__/privacy-contract-docs.test.ts`). Widening what reaches a third-party model about a child is a reviewed decision, never a refactor.
- **Failure must be distinguishable from emptiness.** A read-modify-write helper must never default a failed upstream read to zeros — that once erased a child's XP, minutes and streaks behind a `200`. Return `null`/throw and make the caller refuse; defaulting is for display-only reads.
- **`GET /learn/courses` degrades one row, never the shelf — and never buys speed with fan-out.** A course whose tree won't assemble is dropped and logged (it is unopenable anyway) so the rest of the shelf keeps working; *every* course failing still 502s, because that is an outage rather than one sick row. It was regressed once already — a single unreadable course emptied the whole shelf. The handler also keeps **one PostgREST request in flight at a time on purpose**, and `Promise.all` is the obvious fix that is wrong: running the courses concurrently multiplies Core's outbound connections by a number *content* controls — publishing course #11 changes it with no diff and no review — against a pool whose production size lives only in Railway, on a service billed by the memory it would then hold every tree in at once. That is the shape of the 2026-08-10 incident: content-scale-dependent, 502s the whole endpoint, and reads in the logs like infrastructure.
- **Forge's gate 10 (plan fidelity) is wired at the write stage ONLY — do not add it to `run.ts`'s gate pass for symmetry.** It compares the written lesson's segment-type sequence to the approved skeleton *exactly*, so `plannedSegmentTypes` is passed from `write.ts` alone. `run.ts` appends the opt-in recap segment *before* it gates, so the document it holds is legitimately one segment longer than its plan — wiring gate 10 there fails every `recap_dialogue` lesson. Nothing pins this: the tests cover the gate, not its absence from `run.ts`. It exists because a published lesson opened on a graded `sort_buckets` naming characters it had never introduced. **It only stops NEW drift** — how many of the ~1,305 already-published lessons share the defect is unknown and can't be sampled from outside, since the learner API 403s locked lessons. Counting needs a read-only production query; fixing needs regeneration, which bills per lesson.
- **A `duckdb.Database` owns ONE implicit connection, and a transaction is connection state.** In `dataintel/`, `query`, `execute` and `exec` all share that single handle, so a failed statement — which on this driver does not reliably unwind its own transaction — poisons every later statement in the process, and fails *far* from the cause: a legitimate Catalog Error on an unsynced `fact_events` turned the next `CREATE TABLE` into "cannot start a transaction within a transaction" and the one after that into a JSON deserialization error, surfacing as a 502 from an unrelated route. It fires on every cold start, because the warehouse genuinely has no `fact_events` until the first sync finishes. Two rules follow: the shared helpers issue a best-effort `ROLLBACK` after any failure (`recoverSharedConnection`), and **every explicit `BEGIN`/`COMMIT` must run on its own connection via `withConnection`** — that is what makes the recovery ROLLBACK safe, since it can then never discard real work. `dataintel/src/__tests__/connection-recovery.test.ts` pins both; it is an app-level test because a single failing statement does not reproduce it.
- **`railway ssh` / the Railway CLI do not propagate remote exit codes** — parse the output, never trust `$?`. Piping a gate through `| tail` masks its exit code the same way.
- **Synthetic clicks don't hit-test.** `element.click()` dispatches straight at the node, so a full-viewport overlay (the character canvas) once swallowed every control while every audit stayed green. The `verify:*` suites use real pointer events + `elementFromPoint` — keep any new UI verification on that standard.
- **Families are derived from `guardian_links`** (multiple parents may point at one kid) — there is no `families` table, and a `kid` row without a verified guardian link is a bug, not a state. `superadmin` is DB-enforced to `@littlefounders.ai` emails.
- **English-only identifiers** everywhere — routes, tables, files, i18n keys. Locale text is what gets translated; code never is.

## License

Proprietary — all rights reserved. Third-party skills are tracked under **both** `.github/skills/` and `.claude/skills/` — the same files, read by two different tools — and retain their original licenses; each skill's `_SOURCE.md` records the upstream project and its terms. There is no separate `LICENSE` file in those directories, so don't prune the `.claude/` copy as a stray: it carries the same attribution obligation.
