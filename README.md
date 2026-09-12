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

**NON-NEGOTIABLE:** a red push to `main` wastes a full CI fan-out across all services and can ship a broken deploy through CD. Run these locally first, before every commit and again before every push — they are the same checks CI runs, and passing locally is required, not optional on the assumption CI will catch it.

**Always (any change):**

```bash
npm run typecheck:all && npm run lint:all && npm run test:all
npm run secrets:check     # no credential patterns in tracked files
npm run tools:test        # the repo's own gate self-tests + repo consistency
```

In the service(s) you touched, `npm run build` must also pass — CD only deploys after that service's CI (type-check, lint, test, build) is green on `main`.

**Conditional, by area touched** (each catches a class of silent drift that no per-service test can see):

| If you touched… | Run |
|---|---|
| `frontend/` (anything user-facing) | `npm run i18n:check` — 3-locale key parity + hardcoded-string scan |
| Public pages, titles, share copy, `site.mjs` | `npm run seo:check` + `npm run paths:check` |
| DeepSeek/Qwen config in `coursegen/` or `oracle/` | `npm run provider:check` |
| Tutor whiteboard / segment / demonstrate shapes | `npm run instruments:check`, `npm run preferred-types:check`, `npm run demo-step:check` |
| Roleplay scenes or their voices | `npm run roleplay-voices:check` |
| Tutor runtime, prompts or safety (`oracle/`) | `npm run verify:tutor` (context rejects unlisted fields + injection canaries) |
| Tutor pedagogy/controller (`oracle/`) | `npm run verify:pedagogy` + `npm run gym:pedagogy` (free — no network, no model) |
| Lesson Engine or character layer (`frontend/`) | `npm run verify:lesson-engine` — real pointer events, hit-testing |
| Tutor HUD/layout (`frontend/`) | `npm run verify:tutor-ui` (+ `verify:tutor-a11y` for captions/phases) |
| 3D clips/rigs or island placement (`frontend/`) | `npm run verify:rig` / `npm run verify:placement` |
| Migrations (`database/`) | `npm run db:reset` twice (both green) + regenerate types (`db:types`) |
| Any UI | Check in-browser at ~375px AND ~1280px — mobile and desktop both ship |

`.github/workflows/repo-gates.yml` re-runs the repo-wide set (secrets, i18n, marketing paths, provider/instrument/demo-step parity, tools self-tests) on every PR and push, without a `paths:` filter — but CI is the backstop, not the gate. Commit locally as you go; **push once, at the end, when everything is green together** (every push to `main` fans out CI+CD across all services).

**The four `verify:*` gates now run in `frontend-ci.yml`, and that is new.** They were honour-system until 2026-09-11, which is how a wrong `to=` in the /learn chapter list put every lesson behind a blank page for seven days with type-check, lint, 1,800 unit tests and the build all green — none of them opens the app and presses anything. `verify:rig` and `verify:placement` are asset checks and ride in the fast job; `verify:lesson-engine` and `verify:tutor-ui` drive real headless Chrome and live in a `browser-gates` job that `needs: ci`, so a push that fails type-check does not also pay for ~30 minutes of runner. **Still run them locally first** — a browser gate that only ever fails in CI costs a round trip per defect, and the whole reason this one was worth wiring is that it catches things nothing else can.

## Mandatory before production

```bash
npm run release:readiness -- <course>   # ALL local gates + zero-spend course/audio dry-runs
npm run production:preflight            # read-only Railway inventory/config check (operator-only, never CI)
```

`release:readiness` requires a clean tree and never deploys, migrates, publishes or calls a paid provider. `production:preflight` must pass before any migration/deploy handoff and before authorizing paid generation. For Tutor prompt/strategy changes, the paid conversation gate `gh workflow run tutor-deploy.yml -f step=converse` (~$0.03) is the only check that answers "was that a good lesson" — deliberately not in CI so a flaky provider can't block a deploy. After a frontend deploy that touches the public surface: `npm run seo:live` (prove the CDN served it) and `npm run seo:indexnow`.

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

## Non-obvious invariants & traps

Things a fresh session cannot derive from the code, each learned the expensive way. Deep history (incident post-mortems, the old rulebook) is recoverable from git history before commit `77b55596`.

- **No shared types across the 11 packages** (no workspaces, on purpose) — wire shapes are hand-mirrored: whiteboard instruments in 5 copies, `demonstrate` steps in 6, provider config in 2. The parity gates catch drift, but they don't order deploys: when adding a whiteboard kind, deploy **Core before Oracle** — Core's body union has no fallback member, so an unknown `kind` 400s the entire turn instead of dropping the board.
- **The dev machine is small (Apple M2, 8 GB).** Parallel subagents + headless Chrome + several Vite servers make it swap, and a swapping machine doesn't fail loudly — it fails as flaky timing tests. Prefer sequential work, keep ONE dev server, and re-run any timing-sensitive failure on a quiet machine before believing it. `verify:tutor-*` spawn their own Vite on 5173 and fail with a misleading "timed out waiting for lab chrome" if the port is already held.
- **`frontend/vercel.json` carries the cache policy, and JSON takes no comments — so the reasoning lives here.** Without a `headers` block Vercel served *everything* as `public, max-age=0, must-revalidate`, so every visit paid a conditional GET (~0.4 s each, measured) for every asset including the 2.23 MB icon font. `/assets/*` is content-hashed by Vite and is therefore `immutable`; `/fonts/*` and `/basis/*` have **stable filenames**, so they get 30 days and **regenerating one requires renaming it** or clients keep the old copy for a month. The prerendered SEO output (`index.html`, `families/`, `faq/`, `how-it-works/`, `legal/`, `sitemap.xml`, `robots.txt`, `llms*.txt`) and `app-shell.html` deliberately keep the revalidating default — a cached app shell ships a stale app. Vercel applies `headers` before the filesystem/rewrite stage, so the catch-all `/(.*) → /app-shell.html` does not shadow them; confirm after any deploy with `curl -I https://littlefounders.ai/assets/<hashed>.js`.
- **Every model/image/TTS call is billed per learner, forever.** Prism caches by request hash (an identical image request never hits the paid API twice); `release:readiness` dry-runs spend $0. Never add a retry loop or fallback that silently doubles paid work.
- **Two TTS paths is deliberate, not duplication:** Echo (`audiogen/`) does batch, cached lesson narration (Qwen3-TTS); Oracle's live voice is Inworld, interim, and reachable ONLY through `oracle/src/voice/provider.ts` — nothing outside that directory imports a provider SDK. ElevenLabs is sound-effects-only and never called at runtime.
- **Inworld SPEAKS prosody tags** — `[warm]` is read aloud to the child as "corchete warm". Probe before shipping direction tags (`gh workflow run tutor-deploy.yml -f step=probe-prosody`). The tutor model must be **non-reasoning** (`deepseek-chat`); a reasoner spent 87% of latency thinking (38 s/turn). `step=probe-models` asks the provider instead of guessing.
- **Kid voice consent is enforced server-side, per audio frame,** in Oracle's websocket — not just hidden client-side — and re-checked each turn so mid-session revocation bites immediately. Without consent the session connects but stays silent-mic. A raw Supabase JWT on that socket is a bug: only Core-minted, single-use, session-scoped tokens.
- **Oracle's context schema is `.strict()` and pinned to 14 fields by test** (`oracle/src/__tests__/privacy-contract-docs.test.ts`). Widening what reaches a third-party model about a child is a reviewed decision, never a refactor.
- **Failure must be distinguishable from emptiness.** A read-modify-write helper must never default a failed upstream read to zeros — that once erased a child's XP, minutes and streaks behind a `200`. Return `null`/throw and make the caller refuse; defaulting is for display-only reads.
- **`railway ssh` / the Railway CLI do not propagate remote exit codes** — parse the output, never trust `$?`. Piping a gate through `| tail` masks its exit code the same way.
- **Synthetic clicks don't hit-test.** `element.click()` dispatches straight at the node, so a full-viewport overlay (the character canvas) once swallowed every control while every audit stayed green. The `verify:*` suites use real pointer events + `elementFromPoint` — keep any new UI verification on that standard.
- **Families are derived from `guardian_links`** (multiple parents may point at one kid) — there is no `families` table, and a `kid` row without a verified guardian link is a bug, not a state. `superadmin` is DB-enforced to `@littlefounders.ai` emails.
- **English-only identifiers** everywhere — routes, tables, files, i18n keys. Locale text is what gets translated; code never is.

## License

Proprietary — all rights reserved. Third-party skills under `.github/skills/` retain their original licenses (see each skill's `_SOURCE.md`/`LICENSE`).
