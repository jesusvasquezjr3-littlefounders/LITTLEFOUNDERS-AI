# DEPLOYMENT.md — Platform Deployment, Isolation, Security, Scaling & Cost

> **The production contract every service follows.** Authoritative for *how*
> services ship and run in the cloud (this file), paired with the *what/where*
> in `/AGENTS.md` §1.5 (service map) and the Vault-stack specifics in
> `database/DEPLOYMENT.md`. Any production change is a BOUNDARIES action
> (`agent/core/BOUNDARIES.md`) — human sign-off first.
>
> **Last verified:** 2026-07-18 · production live, 17 services (Courier/email-server
> now live), est. ~$12/mo (Courier is a small always-warm service).

---

## §1 Topology (what runs where)

| Tier | Platform | What | Public? |
|---|---|---|---|
| Frontend (SPA) | **Vercel** (project `littlefounders-ai`, Root Directory = `frontend`) | React/Vite build | `littlefounders.ai` |
| Core (backend) | **Railway** (project `littlefounders-b2c`) | the ONLY service the SPA calls | `api-b2c.littlefounders.ai` |
| Vault gateway | **Railway** — Kong | Supabase self-hosted stack entrypoint | `auth-b2c.littlefounders.ai` |
| Media (Depot) | **Railway** — filebase | PII-free media reads; internal writes | `media-b2c.littlefounders.ai` |
| Internal services | **Railway** — coursegen, audiogen, gamegen, parent-id-check, email-server | service-to-service only | **no public domain (private networking only)** |
| Vault internals | **Railway** — db, auth, rest, realtime, storage, meta, supavisor, studio | reached only via Kong / private net | no public domain |
| Cache/limit | **Railway** — Redis | rate-limit store | no public domain |

**One Railway project holds everything** (`littlefounders-b2c`) so services talk
over Railway private networking (`<service>.railway.internal`) with zero public
hops. **Domain convention: `<service>-b2c.littlefounders.ai`** (suffix). DNS is
managed in Vercel's zone (nameservers `ns1/2.vercel-dns.com`); a Railway custom
domain emits a CNAME + a `_railway-verify` TXT to add there.

---

## §2 Deployment isolation — NON-NEGOTIABLE

Each service deploys **only its own directory**, and cross-service bleed is
prevented at two levels:

1. **Upload scoping.** `railway up <service> --path-as-root --service <name> --ci`
   uploads *only* `<service>/` as the archive root. Frontend code never reaches a
   backend build and vice-versa — the deploy command physically can't include a
   sibling directory.
2. **Per-service `.railwayignore` (every deployed service has one).**
   `--path-as-root` **re-roots the archive**, so the repo-root `.gitignore`'s
   path-prefixed rules (e.g. `audiogen/src/samples/`, `coursegen/runs/`) **stop
   matching** — from `audiogen/`'s perspective the path is `src/samples/`. Each
   service therefore carries its own `.railwayignore` (gitignore syntax, relative
   to that service) excluding `node_modules/`, `dist/`, `.env*`, `coverage/`,
   logs, plus service-specific dev-only bulk. Nixpacks reinstalls deps and
   rebuilds, so the upload only needs source + manifests.
   **Real incident this prevents:** the first `audiogen` deploy timed out
   uploading `src/samples/` (~210 MB of voice-clone reference audio) because the
   root-ignore rule didn't apply post-re-root. With `audiogen/.railwayignore`
   excluding `src/samples/`, the same deploy completes in ~40 s.
   - **KEEP (runtime-required, never exclude):** `coursegen/curriculum/` (lesson
     blueprints), `parent-id-check/*.traineddata` (OCR models),
     `.env.example` files.
   - **EXCLUDE (dev-only / rebuilt):** `node_modules/`, `dist/`, `coursegen/runs/`,
     `audiogen/src/samples/`, `filebase/data/` (prod uses the `/data` volume),
     any `.env` (secrets live in Railway variables, never in the archive).
3. **Frontend (Vercel)** is isolated by **Root Directory = `frontend`** — Vercel
   only builds that subtree and reads `frontend/vercel.json` from it. (If the Root
   Directory is ever blank, Vercel builds the repo root and the SPA rewrite is
   missed → deep-link 404s. See `RUNBOOK.md`.)

---

## §3 Networking & security posture

- **Public surface is minimal:** only Core (`api-b2c`), Kong (`auth-b2c`), and
  Depot reads (`media-b2c`) are reachable from the internet. Internal services
  (coursegen/audiogen/gamegen/parent-id-check) and all Vault internals have **no
  public domain** — they're reached only over Railway private networking.
- **Service-to-service auth:** internal endpoints require the
  `x-internal-api-key` header, compared with **`crypto.timingSafeEqual`** (length
  check first) — never a plain `===` (§1.14). One shared `INTERNAL_API_KEY`
  (24-byte hex), stored as a Railway variable per service + a GitHub secret,
  never committed.
- **CORS (Core):** single-origin allow-list = `FRONTEND_URL`
  (`https://littlefounders.ai` in prod). No wildcard, no cookies (auth rides the
  `Authorization` header), mismatched origins get `403`.
- **Secrets:** only `.env.example` (placeholders) is tracked; real values live in
  Railway variables / Vercel env / GitHub secrets. `npm run secrets:check` gates
  every commit. A leaked secret → rotate first (RUNBOOK.md).
- **Data:** RLS enabled on every user table before merge; `audit_logs`
  append-only; `superadmin` DB-gated to `@littlefounders.ai`; no minor PII to
  third-party AI (§1.9).
- **Transport:** Railway and Vercel both issue/renew TLS automatically for every
  custom domain.
- **Admin surface:** Studio (Supabase dashboard) has **no public domain** and is
  scaled-to-zero — reachable only through Kong's basic-auth catch-all or
  `railway ssh`.
- **Rate limiting:** every Core endpoint is rate-limited; prod uses the Redis
  store, tests fall back to `MemoryStore` (§1.14).

- **Transactional email (Courier):** GoTrue → `email-server.railway.internal:587`
  (Haraka) → Amazon SES over TLS + SMTP AUTH. The internal hop (GoTrue → Haraka)
  is plaintext-with-private-IP-trust (`relay_internal` grants only Railway's
  private net — it is NOT an open relay); the sensitive hop (Haraka → SES) is
  always TLS + AUTH. `GOTRUE_MAILER_AUTOCONFIRM=false` — signups are verified
  against real mailbox ownership. Domain auth in the Vercel DNS zone: SES DKIM
  (3 CNAMEs) + custom MAIL FROM (`mail.littlefounders.ai`) SPF/MX + `_dmarc`
  (`p=none`, ramping to `quarantine`).

**Known hardening opportunities (not vulnerabilities, tracked):**
- Core reaches PostgREST/GoTrue via the *public* Kong domain
  (`SUPABASE_URL=https://auth-b2c…`); could be switched to Kong's private domain
  to keep that traffic entirely inside Railway.
- Courier's internal hop is IP-trust plaintext (Haraka advertises SMTP AUTH only
  after STARTTLS, and GoTrue doesn't reliably accept a self-signed internal cert);
  move it to AUTH over a trusted internal cert once GoTrue's SMTP TLS handling is
  verified (`email-server/AGENTS.md` "Hardening follow-up").

---

## §4 Build & runtime config (the parameters)

**`<service>/railway.json`** (Nixpacks app services):
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": { "builder": "NIXPACKS" },
  "deploy": {
    "startCommand": "npm run start",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```
- Node **24** is pinned via each `package.json` `"engines": { "node": "24.x" }`
  (and root `.nvmrc`); Nixpacks auto-detects it — no `nixpacks.toml` needed.
- Every service exposes `GET /health` → the standard envelope
  `{ data: { service, version, status: "ok" }, error: null }` (§1.6). The
  healthcheck gates the deploy.
- Services that persist to disk (db, storage, filebase) get a **Railway volume**;
  everything else is stateless. Postgres data lives on its volume via the
  `fix-volume-entrypoint.sh` shim (see `database/DEPLOYMENT.md`).
- Vault's `db`/`kong` use the **Dockerfile** builder instead (they wrap pinned
  upstream images) — `database/railway/{db,kong}/`.

---

## §5 CD (token-based, no native Git integration)

Neither Railway nor Vercel is connected to GitHub via their App integration — by
decision, every deploy is an **upload authenticated by a token secret**:

- **One `.github/workflows/<service>-cd.yml` per app-facing service + frontend.**
  Trigger: `workflow_run` on that service's **CI succeeding on `main`**
  (`branches: [main]`, `if: conclusion == 'success'`), checked out at
  `workflow_run.head_sha`. `permissions: contents: read` only.
- App services: `railway up <service> --path-as-root --service <name> --ci` with
  `RAILWAY_TOKEN`. Frontend: `vercel pull/build --prod && vercel deploy --prebuilt
  --prod` with `VERCEL_TOKEN`/`ORG_ID`/`PROJECT_ID`.
- Vault internals (db, kong, and the plain-image services) are **not** in CD —
  they change rarely and are deployed manually (`railway up database/railway/db …`
  or `railway add --image …`). `email-server` (Courier) is **live** (deployed
  manually 2026-07-18, SES wiring complete) and HAS a CD workflow, but that
  workflow stays gated by the `EMAIL_SERVER_LIVE` repo variable — set it to `true`
  (`gh variable set EMAIL_SERVER_LIVE --body true`) to activate auto-deploy on
  future pushes.
- Repo secrets in use: `RAILWAY_TOKEN`, `RAILWAY_SSH_PRIVATE_KEY` (backups),
  `INTERNAL_API_KEY`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.

---

## §6 Scaling — how each tier grows (be honest about what's automatic)

| Tier | Scale-down (auto) | Scale-up (under load) |
|---|---|---|
| Frontend (Vercel) | ✅ automatic (CDN + serverless) | ✅ automatic |
| Idle Railway services (studio, meta, storage, supavisor, realtime, coursegen, audiogen, gamegen) | ✅ **Serverless scale-to-zero** (sleep after ~10-15 min idle, wake on request) | on request (cold start) |
| Hot-path Railway services (kong, auth, rest, db, backend, Redis, filebase, parent-id-check) | — (kept always-warm) | **manual but trivial** — see below |
| Postgres (db) | — | vertical only (bigger instance); no read-replicas/HA yet |

**"Intelligent/automatic" is honest to this extent:** cost-direction (scale-to-zero)
and the frontend are automatic; **hot-path scale-*up* is manual-but-instant**, not
load-triggered autoscaling. Levers:
- **Replicas:** `railway scale --service <name> <region>=<N>` (per region, up to 50).
- **Kong throughput:** raise `KONG_NGINX_WORKER_PROCESSES` (currently `2` — see §7);
  2 workers already handle ~32k concurrent connections.
- When real load arrives, add replicas to Core/Kong/rest first, and consider
  Postgres read-replicas / a managed HA Postgres before the single instance is a
  bottleneck. None of the cost right-sizing below caps headroom — it's all a
  one-line change to grow.

---

## §7 Cost right-sizing (memory is ~97% of the Railway bill)

Railway bills almost entirely on **memory actually used**. Diagnose via Project →
Settings → Usage → *View Cost by Service*, sort by RAM. Applied posture
(2026-07-17, took the estimate from **$52.74 → $11.98/mo**, ~77% down, nothing
removed, all reversible):

1. **Cap multi-worker servers to the real load.** Kong defaulted
   `nginx worker_processes auto` = one worker per *host* core (~50) ≈ 5.8 GB RSS,
   ~63% of the whole bill. `KONG_NGINX_WORKER_PROCESSES=2` → ~192 MB. **Any server
   that forks a worker-per-core (nginx/Kong, gunicorn, puma…) must be capped in
   prod.**
2. **Don't cap what's already small.** Node auto-sizes its heap to host RAM, but a
   small API's *actual* RSS stays low (Core ≈ 105 MB). Measure with
   `railway ssh --service <n>` before adding `NODE_OPTIONS=--max-old-space-size`;
   a cap below real need only adds OOM risk. Only cap if steady-state RSS is
   genuinely high (>~400 MB).
3. **Scale-to-zero every service off the hot path** (Settings → Serverless).
   Sleepable = admin-only (studio) + operator-only (coursegen/audiogen/gamegen) +
   deployed-but-unused (storage/supavisor/realtime/meta). **Never** sleep the hot
   path (§6 table). Combined ~$8/mo → ~$0 while asleep.

Full details + the always-warm-vs-sleepable reasoning: `RUNBOOK.md` → "Railway
cost / right-sizing".

---

## §8 Checklist — adding a NEW microservice to production

> Prereq: a new service is a stack-of-record change → **human sign-off first**
> (`agent/core/BOUNDARIES.md`). Scaffold locally per
> `agent/workflows/service-scaffold.md` (stamp, fill, CI, local-green, docs),
> then to ship it:

1. **`<service>/railway.json`** — copy the §4 block (adjust nothing unless the
   start command differs).
2. **`<service>/.railwayignore`** — copy an existing one; add any service-specific
   dev-only bulk to exclude; keep runtime-required data (§2). NON-NEGOTIABLE.
3. **`.env.example`** — declare every env var (Zod-validated at boot). Real values
   go into Railway variables, never the repo.
4. **Create the Railway service** in project `littlefounders-b2c`
   (`railway add --service <name>`), set its variables (internal URLs use
   `<dep>.railway.internal`), attach a volume only if it persists to disk.
5. **Public or internal?** Public (rare) → `railway domain <service>-b2c.littlefounders.ai --service <name> --port <p>` + add the CNAME/TXT in Vercel's DNS zone, and add CORS/allow-list if browser-facing. Internal (default) → **no domain**; enforce `x-internal-api-key` (timing-safe) on every route (§3).
6. **Deploy:** `railway up <service> --path-as-root --service <name> --ci`; confirm
   `/health` 200 and no errors in `railway logs`.
7. **CD:** add `.github/workflows/<service>-cd.yml` (copy an existing one; swap the
   CI workflow name + service name).
8. **Cost:** decide hot-path (keep warm) vs idle (enable Serverless, §7). Cap any
   worker-per-core server.
9. **Verify:** exercise the real path end-to-end (not just `/health`); for
   browser-facing changes, check mobile + desktop (§1.11).
10. **Docs (same commit):** `/AGENTS.md` §1.5 map (+ mirror `CLAUDE.md`), root
    `README.md` table, `doc_map.md`, `GLOSSARY.md` codename, this file's §1 table
    if public, `agent/core/CONTEXT.md`, `npm run repo:map`.
