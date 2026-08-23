# RUNBOOK.md — Incident Response

## Deploying the AI Tutor (Oracle) — DONE 2026-08-21, and what it actually took

**Oracle is live.** `https://oracle-production-e82a.up.railway.app/health`
answers `200` with `model: up`, `moderation: up`, `voice: down` (voice is off
on purpose — see *What stays off* below). Migration `0047` is applied, the
ledger is at 47, and `railway-preflight` reports nine services RUNNING with
both shared secrets matching across Core and Oracle.

This section is written for the NEXT service, not for this one. Everything
below was learned by running it against production; none of it is theory.

### It runs on a runner, not on a laptop

`.github/workflows/tutor-deploy.yml`, dispatched by step:

```bash
gh workflow run tutor-deploy.yml --ref main -f step=inspect
```

`inspect | probe | migrate | provision | domain | verify`. Only `inspect` and
`probe` are read-only in intent; each mutating step is separate and idempotent,
so a half-finished run is resumed by re-dispatching the step that failed rather
than by starting over.

**Why not from a laptop.** The Railway credentials for this project live as
repository secrets and nowhere else, which is correct and means every
production step has to run on a runner. The `npm --prefix database run
db:railway:migrate` invocation this section used to recommend only works on a
machine that already holds a Railway token.

### The order that worked

1. **`step=migrate`, dispatched from the FEATURE BRANCH.** The migration lives
   on the branch; `main` does not have it yet. Dispatching from `main` reports
   "ledger is current" and applies nothing, truthfully and uselessly. The
   branch must therefore carry the ops workflow too — merge `main` into it
   first.
2. **`step=provision`** — creates the service and sets every variable, before
   any code that needs them is deployed.
3. **Merge the PR.** `oracle CI` → `oracle CD` gives the empty service its
   first deployment.
4. **`step=domain`** — a Railway-provided domain, and `ORACLE_PUBLIC_URL` on
   Core to match.
5. **Redeploy Core.** See the trap below.
6. **`step=verify`** — preflight, then the reachability checks.

### The trap: `--skip-deploys` means nothing has picked the variables up yet

Every variable is set with `--skip-deploys`, which is right — you do not want
five rolling restarts while a service is being configured. But it means the
RUNNING container still holds the old environment. `backend CD` fired on the
merge at 15:30 and `ORACLE_PUBLIC_URL` was set at 15:32, so Core was live for
two minutes holding the localhost default for the address it hands the browser
— which is not an error, not a warning, and not visible on any healthcheck. It
is simply the wrong address, and every learner would have received it.

Re-run the service's CD workflow (`gh run rerun <backend CD run id>`) after the
last variable lands. `railway redeploy --service <name> --yes` does the same
thing from a machine that has a token.

### Four things the tooling got wrong, all now fixed

- **GitHub runs `bash -e` no matter what the step says.** A step opening with
  `set -uo pipefail`, deliberately without `-e`, does not get its wish. The
  first `provision` dispatch created the `oracle` service, hit a non-zero exit
  on the very next line, and set none of its variables — leaving a service in
  production with no configuration. Write `set +e` explicitly, and never rely
  on `[ -n "$X" ] && cmd` as a guard.
- **`railway add` is interactive and lies about failing.** It falls back to a
  picker, reads the job's own arguments as answers to prompts, and then reported
  "Project not found" *after having created the service*. Redirect `</dev/null`
  so it cannot hang the runner, and check `railway status` for the result rather
  than trusting the exit code.
- **ssh's warning was being read as a query result.** `remote_sql` in
  `database/scripts/railway-migrate.sh` merges stderr into stdout on purpose and
  strips psql's `NOTICE|WARNING|…:` chatter. ssh writes `Warning: Permanently
  added …` — mixed case, space, no colon — which sailed through and became the
  answer to a single-row probe. The dry run reported `unexpected remote ledger
  state` with the real answer, `present|46|present`, on the next line of the
  same message. Fixed at both ends: the script filters that line, and the
  workflow sets `LogLevel ERROR`, since the host key is deliberately uncached
  and the warning therefore fires on every fresh runner forever.
- **Secrets were regenerated on every provision run.** The two shared values
  must be IDENTICAL on both services; generating fresh ones each run rotates a
  live pairing, and with `--skip-deploys` each side adopts the new value
  whenever it next redeploys. Between those two moments every session fails on
  a signature that does not verify, with both services healthy. They are now
  read first and generated only when absent or mismatched.

### The provider keys were already there

`step=inspect` found real `DEEPSEEK_API_KEY` and `QWEN_API_KEY` on `coursegen`.
Oracle wants the same two accounts Forge uses — same vendor, same billing, same
rotation — so `provision` copies them rather than asking an operator to paste
anything. What genuinely needs a human is listed at the end of that step's
output.

### What `verify` actually proves

`railway-preflight` proves the two services are CONFIGURED to find each other.
It cannot prove they can: `ORACLE_URL` points into Railway private networking,
reachable from no runner and no laptop. So `step=verify` also stands inside
Core (`railway ssh --service littlefounders-backend`) and calls
`http://oracle.railway.internal:4009/health`, reads `ORACLE_PUBLIC_URL` back
from Core rather than trusting what the workflow believes it set, rejects a
localhost value explicitly (it is the DEFAULT, so an unset variable does not
look unset — it looks like an address that resolves to the container itself),
and POSTs to the internal REST surface with no key expecting `401`.

That last check is the important one. Oracle carries a public domain as the
fourth `/AGENTS.md` §1.5 exception, granted for the learner's websocket and
nothing else. If the REST API behind that domain answered strangers, the
exception would have become an open door to a service holding children's
tutoring sessions — and every other check would still be green.

### The two shared values remain the trap

Core MINTS the browser's session token and Oracle VERIFIES it. If
`TUTOR_SESSION_SECRET` differs between them, nothing errors at boot, every
healthcheck is green, and every tutor websocket closes "bad signature" — which
reads like a client bug and is not one. Same for the service key
(`oracle/INTERNAL_API_KEY` == `littlefounders-backend/ORACLE_INTERNAL_KEY`).
The preflight compares both pairs and prints match/differ, never a value.

### `oracle` is NOT scale-to-zero

It terminates a learner's live socket; a cold start would happen in front of a
child who just pressed the button. The preflight treats a sleeping oracle as a
failure, not an expected state.

### BLOCKED ON BILLING: the DeepSeek account is out of credit

`step=verify` calls both providers from inside the Oracle container and
reports the HTTP status. As of 2026-08-21:

```
== The pedagogical model (DeepSeek) ==
   HTTP 402   the provider account is out of credit
== The moderation judge (Qwen) ==
   HTTP 200   OK
```

**Until DeepSeek is topped up, the tutor connects, greets, captions, saves and
replays — and answers every actual question with "se me enredaron las ideas un
momento".** That is `MODEL_DOWN` in `oracle/src/tutor/scripted.ts`, the honest
degraded line, working exactly as designed. Everything around the model is
verified working; the model itself has no balance to answer with.

This is an owner action (a payment), not an engineering one.

Two things worth knowing while it is open:

- **Forge probably is not showing symptoms**, because `coursegen` has
  `FORGE_DEEPSEEK_FALLBACK_TO_QWEN` and silently falls back. Same key, same
  402 — course generation may have quietly been running on the fallback model
  for a while. Worth checking against generation telemetry rather than assumed.
- **Oracle must NOT copy that fallback.** Its judge is already Qwen, and
  `/ORACLE.md` requires the judge to be INDEPENDENT of the author — "an author
  that grades its own work grades it generously". Falling back to Qwen for
  authoring would silently collapse a §1.9 compensating control into a model
  grading itself. A fallback needs a THIRD provider, or an owner decision
  recorded in `/ORACLE.md` §16.

### Still open

- **Custom domain.** Currently the Railway-provided
  `oracle-production-e82a.up.railway.app`. The convention is
  `tutor-b2c.littlefounders.ai` — add it in the dashboard, then update
  `ORACLE_PUBLIC_URL` and redeploy Core.
- **Repository secrets `CORE_URL` and `INTERNAL_API_KEY`** for the nightly
  `tutor-retention.yml` workflow.

### What stays off, and why — corrected 2026-08-23

**`VOICE_PROVIDER=inworld` in production, and the cast is enrolled.** This
paragraph used to say `none`; that was true when it was written and stopped
being true on 2026-08-21, when the twelve cloned voices went in and
`speaks:verify` walked the whole chain — enrolled, synthesized in their own
voice, stored in Depot, fetched back over plain HTTP. Verified again against
the deployed service on 2026-08-23.

**`TUTOR_VOICE_FOR_MINORS=false`, and that is the one that matters**, until a
data-processing agreement covering minors' audio exists
(`/LEGAL/AI_TUTOR_LEGAL_REVIEW.md` §6). Adults may speak; no child's microphone
opens. The tutor is complete without it for everyone: captioned, typed, graded,
replayable. Flipping it is an owner decision to record in `/ORACLE.md` §16.

Since 2026-08-23 the flag also gates COLLECTION, not just use: the guardian
consent control reads the policy and states the real reason instead of offering
a switch, and `POST /api/v1/tutor/consent` answers `409 POLICY_BLOCKED`. So the
placeholder consent wording awaiting counsel cannot reach a guardian or a
database row. Revocation is gated by neither.

Re-enrolling the cast (`npm run voices:clone`) needs `audiogen/src/samples/`,
which is gitignored and owner-held.

### Two ways to break Oracle by changing nothing in the code

Both were found by the 2026-08-23 security audit
(`/SECURITY_AUDIT_2026-08-23.md`). Neither is a bug today; both are one
dashboard click away from being one, and neither announces itself.

**1. Scaling Oracle past ONE replica silently breaks single-use tokens.**
The `jti` ledger that burns a session token after its first use is
**in-process**. On two replicas a token burned on instance A is still fresh on
instance B, so the one property that makes the browser's direct websocket
acceptable under §1.5 quietly stops holding. Nothing logs, nothing fails, no
test catches it — the tokens still work, they just work more than once.

*If you need to scale Oracle:* move the ledger to the Redis that is already
there for the rate limiter and the speech cache (`oracle/src/lib/redis.ts`),
**then** raise the replica count. Not the other way round. Until then Oracle
stays at one replica, and that is recorded as an unticked gate in
`/ORACLE.md` §16.

**2. Pointing the judge at the author collapses two safety controls at once.**
If `JUDGE_API_BASE`/`JUDGE_MODEL_NAME` ever come to match
`MODEL_API_BASE`/`MODEL_NAME`, moderation and the tier-3 content judge keep
returning verdicts — generous ones, because a model grading its own work grades
it generously. Every gate stays green. `check-provider-parity.mjs` will not
catch it: it pins Oracle against Forge, not the judge against the author.

Since 2026-08-23 the service **warns at startup** when the two match, naming
the variables. It is a warning and not a refusal on purpose — refusing to boot
turns a misconfiguration into an outage — so it is only useful if somebody reads
the deploy log. Current production values, confirmed 2026-08-23:
`deepseek-v4-flash` at `api.deepseek.com` authoring, `qwen3-max` at DashScope
judging. Different vendor, different key, different model.

---

## `npm test` in `database/` could never pass on Windows — and the failure looked like a migration defect (fixed 2026-08-23)

**Symptom.** `database/npm test` fails at the `confirm-apply` scenario with
`FAIL: apply 0023_learning_insights.sql: success sentinel missing from remote
output (transport exit codes are untrustworthy); refusing to continue`, after
dumping several kilobytes of base64 to stderr. It reads exactly like the
production transport bug the runner was hardened against, on a real migration,
and it appears on a clean checkout with nothing modified under `database/`.

**Cause — the test harness, not the runner.** The fake `railway` executable in
`scripts/railway-migrate.test.mjs` executed the remote command with
`spawnSync('sh', ['-c', command])`. On Windows, MSYS `sh.exe` spawned by a
NATIVE process (node) **silently truncates its command line at 8191 characters
and still exits 0.** The payload is a base64 blob of a whole migration — 13 KB
for `0023`, 31 KB for `0025` — so `echo <b64> | base64 -d | psql` lost its own
pipeline mid-string and ran only the truncated `echo`. The runner then refused
a reply carrying no sentinel, which is exactly what it is supposed to do.

Measured, because the cut is silent and exact: a command line of **8163**
characters round-trips correctly; **8193** comes back as the raw echo argument,
status 0, stderr empty.

**Fix.** The fake writes the command to a script FILE and runs `sh <file>`. A
script file has no command-line length, so the fake behaves identically on
every OS. The contract the scenarios exist to pin is untouched — the remote
command still arrives as one positional argument and the remote exit status is
still discarded.

**Why it matters beyond Windows.** This gate protects the ONLY approved path to
production Vault, and it could not be run at all on the machine the owner
develops on. A gate that only runs in CI is a gate nobody uses before pushing.

**If you see it again:** check whether anything is invoking a Git-Bash tool
with a multi-kilobyte argument from a native Windows process. The failure mode
is silent truncation plus exit 0 — never an error.

## Certifying the Tutor by LOOKING at it (recipe, 2026-08-23)

Every browser window opened by an agent on this machine is one the OS never
shows, so `document.visibilityState` is `"hidden"` and `SceneCanvas` correctly
refuses to draw. **Headless Chrome over CDP is visible to itself** and is the
only way to photograph the 3D stage here.

```
cd frontend && npx vite --port 5190 --strictPort      # a dedicated server
chrome --headless=new --remote-debugging-port=NNNN        --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader        --force-device-scale-factor=1 --hide-scrollbars
```

Then drive `/dev/tutor-lab`, which mounts the REAL `StageShell` behind fixtures
and has switches for phase, locale, cast and activity. Four things learned the
hard way:

- **Capture with `Page.captureScreenshot`, never `canvas.toDataURL()` or
  `drawImage(canvas)`.** A WebGL canvas without `preserveDrawingBuffer` returns
  stale or blank pixels outside the frame; the compositor screenshot is always
  correct. A canvas colour census taken with `drawImage` produced confident,
  wrong "the scene went dark" readings all session.
- **`getComputedStyle` cannot answer "is this visible".** On a descendant of a
  `display:none` ancestor it returns the descendant's OWN display. Use
  `Element.checkVisibility()`, or better, press Tab for real and look at
  `document.activeElement`.
- **A control inside a scroller is not "below the fold".** A naive rect test
  reported six reachable replay rows as unreachable; measuring the scroll
  container (`scrollHeight 650, clientHeight 192`) showed every row reachable.
- **Subtract the instrument.** Everything in `/dev/tutor-lab`'s own panel is
  marked `[data-lab-chrome]`; a measurement that counts it is measuring the
  ruler.

## Rollback to v1 (historical — v2 is in production as of 2026-07-17)

v1 is no longer live and no longer on `main` (superseded by the `feat: total v2 rewrite` squash commit, 2026-07-17). To inspect or resurrect it: `git log main --diff-filter=D` finds the squash commit; v1's actual last state is the parent of that commit. There is no automatic rollback — reverting to v1 in production would mean redeploying its old Render/Railway/Vercel config from that commit by hand, which no longer matches the current Railway project (`littlefounders-b2c`) or Vercel project settings (Root Directory now `frontend`). Treat this as "possible but non-trivial," not a one-command undo.

For a v2 production incident, prefer **rolling forward** (fix + redeploy via CD, or `railway redeploy`/`vercel deploy --prebuilt --prod` to the last known-good build) over reaching for v1.

## Secrets leak (a credential landed in git)

1. **ROTATE the credential immediately** — at the provider (Supabase, Railway, DeepSeek, Qwen…). Rotation is the containment; history rewriting is not.
2. Purge from history (`git filter-repo`) only after rotation, coordinate force-push with the team (BOUNDARIES action).
3. Verify `npm run secrets:check` catches the pattern; if it didn't, add the pattern to `agent/tools/check-secrets.sh`.
4. Record the incident + fix here.

## CI red on littlefounders_v2 / main

1. `gh run list --branch <branch>` → `gh run view <id> --log-failed`.
2. Reproduce locally: `cd <service> && npm ci && npm run type-check && npm run lint && npm test`.
3. Fix forward if < 30 min; otherwise revert the breaking commit. Never merge over red.

## Supabase self-hosted on Railway (deployed 2026-07-17 — backup/restore verified, see below)

- **Restart procedure:** `railway redeploy --service <name> --yes` (db, kong, auth, rest, realtime, storage, meta, supavisor, studio — all in Railway project `littlefounders-b2c`). Restart `db` first if the whole stack is down; the rest depend on it and will recover on their own restart-on-failure policy once `db` is healthy again. Check `railway logs --service <name>` for `FATAL`/crash-loop before assuming a redeploy will help.
- **Backup: CONFIGURED 2026-07-17.** `.github/workflows/vault-backup.yml` runs daily (08:00 UTC, plus `workflow_dispatch` for on-demand runs) — `pg_dump -Fc` inside the `db` container via `railway ssh`, piped straight to `/data/backups/vault-<UTC timestamp>.dump` on **filebase's (Depot) Railway volume** (`railway ssh --service filebase`, writing to the container filesystem directly — not through filebase's HTTP API, which only accepts audio/image/JSON mime types by design). This is deliberately NOT a dedicated backup volume: `db` already uses its one allowed Railway volume for PGDATA, and creating a new service for this was blocked by Railway's expired trial at rollout time. filebase's volume is still a genuinely separate disk on a separate service, so a `db`-volume incident doesn't take out its own backups — but **revisit this once Railway billing is resolved; a dedicated backup volume is the better long-term shape.** 30-day retention (auto-pruned by the same workflow). Auth: a dedicated SSH keypair (`vault-backup-ci`, registered via `railway ssh keys add`) stored as the `RAILWAY_SSH_PRIVATE_KEY` repo secret — separate from any personal key.
- **Restore drill: PERFORMED SUCCESSFULLY 2026-07-17.** Restored a real production dump into a scratch database (`CREATE DATABASE restore_drill_test`, `pg_restore -U supabase_admin -d restore_drill_test --no-owner --no-acl`) on the same `db` server. Row counts matched exactly against the live `postgres` database across `profiles`, `user_roles`, `courses`, `audit_logs` (1/1/0/1 both sides); `restore_drill_test` was then dropped. Repeat this drill periodically (e.g. quarterly, or after any migration) — a backup that's never been restored is unverified by definition.
- **Upgrade procedure:** bump `database/SUPABASE_VERSION` → `npm run db:sync` → local `db:reset` ×2 + tests green → update the pin table in `database/DEPLOYMENT.md` → **take a verified backup first** (see above — this is exactly the scenario backups exist for) → rebuild/redeploy `database/railway/db` and `database/railway/kong` (their Dockerfiles pin the same version) → `railway add --image <new-tag>` or update each plain-image service's source for auth/rest/realtime/storage/meta/supavisor/studio → re-apply any new migrations → verify `/health` chain + a real login before considering it done.

## Pulse (observability stack — Plausible CE + Umami + Uptime Kuma)

- **Services (Railway project `littlefounders-b2c`):** `pulse-plausible` (app), `pulse-clickhouse` (events, volume `/var/lib/clickhouse`), `pulse-db` (Postgres 16, PGDATA volume, logical DBs `plausible` + `umami`), `pulse-umami` (app), `pulse-kuma` (volume `/app/data` — its SQLite holds every monitor; **redeploying without the volume wipes the monitoring config**). Restart order if the whole stack is down: `pulse-db` → `pulse-clickhouse` → apps.
- **An outage here loses telemetry, never product.** No product service depends on Pulse; degrade gracefully and fix without urgency-pressure. The admin panel's Analytics/Health cards will show Core's upstream-unreachable envelope error meanwhile.
- **Backup:** `.github/workflows/pulse-backup.yml` daily 08:30 UTC — `pg_dump -Fc` of both logical DBs, tar'd to `/data/backups/pulse-<ts>.dump` on Depot's volume (same mechanism/keys as the Vault backup; 30-day retention). **ClickHouse events are deliberately not dumped**: accepted-loss analytics (decision 2026-07-20) — a volume incident loses history, not correctness; revisit if analytics history ever becomes a compliance artifact. First green run verified 2026-07-22 (~256 KB) after two fixes: (1) it had wrapped both `pg_dump`s + tar in one `railway ssh -- sh -c '<multi-flag script>'`, which `railway ssh` space-joins + the remote re-parses, so the script was word-split and `pg_dump` ran flag-less as OS user `root` (`FATAL: role "root" does not exist`) — every run failed in ~9s. Fix: one `railway ssh` per command with args as **distinct tokens** (never a quoted script string); (2) wrapped each `railway ssh` in a 5×/20s retry — Railway's SSH key-verification service has transient account-wide outages ("verification service was unreachable", takes down vault-backup too) that a blip-retry absorbs. Same two lessons apply if you touch vault-backup.
- **Restore:** untar the dump, `pg_restore -U postgres -d plausible --no-owner --no-acl plausible.dump` (and same for `umami`) inside `pulse-db` via `railway ssh`. Run a restore drill after first real data accumulates (same policy as Vault).
- **Upgrade / rollback:** pins live ONLY in `pulse/railway/*/Dockerfile` `FROM` lines (protocol: `pulse/AGENTS.md`). Rollback = revert the bump commit; `pulse-cd.yml` redeploys. Plausible+ClickHouse move together; Plausible < v3.2.1 is FORBIDDEN (CVE-2026-8467 RCE) and the registry must stay ghcr.io (Docker Hub is frozen at v2.1.4).
- **Automerge mechanics (no repo config needed):** `pulse-dependabot-automerge.yml` triggers on `workflow_run` of `pulse CI` — it merges a Dependabot `dependabot/docker/pulse/*` PR only when CI already SUCCEEDED on it, and only for patch-level semver bumps (parsed from the PR title; anything unparsable or minor/major is left open for human review). No branch protection or *Allow auto-merge* flag required, and non-pulse PRs are untouched.
- **Kuma admin surface:** keep 2FA on; it is the one Pulse UI with real blast radius (its release line has patched admin-RCE-class issues — the Dependabot pin keeps it current). If compromised-looking: redeploy from pin + restore `/app/data` volume snapshot, rotate its admin password.

## Service down (Railway)

1. Check `/health` of the service; check Railway logs/deploy status.
2. Redeploy last green build; if DB-related, check Vault components (Kong, GoTrue, Postgres) in order.
3. Record cause + fix in this file.

## Railway cost / right-sizing (memory is ~97% of the bill)

Railway bills almost entirely on **memory actually used** (GB-minutes) — CPU,
egress and volume are rounding errors at our scale. To diagnose cost: Project
→ Settings → Usage → *View Cost by Service*, sort by RAM. The whole
optimization game is "which services hold the most resident RAM, and do they
need to."

**Known finding + fix APPLIED (2026-07-17): Kong was ~63% of the entire memory bill.**
Kong (OpenResty) defaults `nginx worker_processes` to `auto` = one worker per
**host** core; Railway hosts expose ~50 cores, so Kong spawned ~50 workers
(each a full Lua VM + resident declarative config) → **~5.8 GB RSS, 52
processes**, alone ~$34/mo of a ~$52/mo bill. Fix: `KONG_NGINX_WORKER_PROCESSES=2`
(baked into `database/railway/kong/Dockerfile` ENV + set as a Railway variable).
Applied + redeployed 2026-07-17 → **measured live: 192 MB RSS, 6 processes**
(~97% less), ~$1.6/mo. Two workers × `worker_connections 16384` = ~32k
concurrent connections, far above our load; **this is right-sizing, not a
scalability cap** — raise the value (or set `auto`) via the ENV/variable the
moment real traffic warrants. Verified after: full signup→/me→login chain
through Kong returns 201/200/200.

**Right-sizing levers, biggest-first (all reversible) — status 2026-07-17:**
1. ✅ **Kong worker cap** (above) — APPLIED, the giant (~$32/mo saved). Always
   keep capped for low traffic.
2. ⏭️ **Node heap cap — SKIPPED, not warranted.** Measured backend/Core at
   steady state = ~105 MB RSS (npm 28 + node ~74); the earlier high number was
   inflated by repeated rollout redeploys, not real usage. A
   `--max-old-space-size` cap would do nothing (app is well under any cap) and
   only add OOM risk — measure before capping any Node service; only cap if
   steady-state RSS is genuinely high (>~400 MB).
3. ✅ **Scale-to-zero (Railway service → Settings → Serverless) — APPLIED** to
   the 7 services with zero live-user traffic: `studio` (admin dashboard),
   `meta` (studio-only), `storage`/`supavisor`/`realtime` (deployed but unused
   by app code), `coursegen`/`audiogen` (operator-triggered
   generation). They sleep after ~10-15 min idle and wake on first request;
   cold start is irrelevant for admin/generation and they receive no user
   traffic. Combined ~$8/mo → near-$0 while asleep.
   **NEVER sleep the hot path** — kept always-warm: `kong`, `auth` (GoTrue),
   `rest` (PostgREST — Core reads/writes the DB through it), `db`,
   `littlefounders-backend`, `Redis` (rate-limit store, hit every request),
   `filebase` (Depot serves public media + holds the backups volume),
   `parent-id-check` (user-triggered during Tutor verification — kept warm to
   avoid cold-start latency on that flow). If you later wire realtime
   subscriptions or route DB traffic through supavisor, disable Serverless on
   those two then.

Net effect: estimated bill **~$52.74/mo → ~$12/mo** (observed: the Railway estimate dropped to
$11.98 right after applying — kong ~$32 + sleeping services ~$8), no
capability removed, every change reversible as you scale.

**Note:** these all require the Railway account active — a suspended
trial/unpaid state blocks deploys/redeploys (variable edits still stage for the
next deploy). To re-apply on a fresh environment: the Kong cap is version-
controlled in its Dockerfile; the Serverless toggles are per-service dashboard
settings (not in code) — re-enable them after any service re-create.

**Pulse-era update (2026-07-22): the analytics stack raised the estimate to ~$28.81.**
Pulse's five services are **always-on by necessity** (they cannot scale-to-zero —
analytics ingestion + Kuma monitoring must stay live), so adding them pushed the
estimated bill from ~$12 back to ~$28.81 (Usage → Show Breakdown: memory = $8.62
of $9.05 ≈ **95%**, the same memory-dominated shape as before). Measured per-service
RSS (Service → Metrics → Memory, 7d): **`pulse-clickhouse` ~850 MB and climbing
toward its cap** — the single biggest consumer — and `pulse-plausible` ~500 MB (BEAM).
Applied conservative right-sizing, **no capability removed, reversible:**
1. ✅ **ClickHouse cache trim** (version-controlled in `pulse/railway/clickhouse/`):
   `max_server_memory_usage` 1.5 GiB→1 GiB + `mark_cache_size` 500 MB→256 MB
   (`config.d/pulse-railway.xml`), plus a 512 MB per-query `max_memory_usage`
   ceiling (`users.d/pulse-low-resources.xml` default profile). Our event volume is
   tiny, so these ceilings stay far above need while pulling ClickHouse's resident
   cache down. If `MEMORY_LIMIT_EXCEEDED` ever appears or the instance is resized,
   raise them (server cap + caches together).
2. ⏭️ **Node heap caps on `pulse-umami` / `pulse-kuma` — SKIPPED**, same measured
   reasoning as Core (2026-07-17): they sit well under any cap, so a
   `--max-old-space-size` cap saves nothing and only adds OOM risk.
3. ⏭️ **Plausible BEAM tuning — SKIPPED**: it is the live analytics path; the risk
   outweighs a ~100–200 MB theoretical trim.

**Deferred (aggressive, opt-in — owner chose conservative 2026-07-22):** since the
Pulse services can't sleep, the only larger cut is *consolidation* — e.g. pausing
`pulse-umami` pre-launch (Plausible already covers the headline KPIs) would save
~$3–4/mo but makes behavioral analytics dormant. Left running by choice.

## Recurring "server crashed" emails — triage, 2026-08-13

**First, establish who is sending them.** Railway and Uptime Kuma both email
about failure and the messages read alike. They mean different things and only
one of them indicates a crash.

```
railway deployment list --service <name>     # CRASHED/FAILED rows = a real crash
railway logs --service <name> --since 7d     # "Starting Container" repeated = restart loop
curl -s https://pulse-kuma-production.up.railway.app/api/status-page/heartbeat/pulse
```

A service that crashed shows a `CRASHED` deployment or repeated container
starts. A Kuma alert shows neither: the container is fine and a monitor is
unhappy.

**What it was on 2026-08-13.** Every application service was healthy — no
`CRASHED` deployment anywhere, exactly one container start each, no OOM, no
fatal, no unhandled rejection. The emails came from Kuma monitor #4
("Arcade / gamegen"), which had been failing every 60 seconds with
`getaddrinfo ENOTFOUND gamegen.railway.internal` since the Game Engine was
deleted (`10936f3e`, schema retired in `0033`). 0 of 100 heartbeats up, 0%
24-hour uptime, for weeks. **Fix: delete the monitor in Kuma.** The rule that
prevents a repeat is in `pulse/AGENTS.md` #7.

**Executed 2026-08-14.** Monitor #4 deleted; Prism (#10) and Data Intel (#11)
created and attached to the `Services` group. Verified via the status-page API:
ten monitors, all `UP`. Data Intel is deliberately a **Keyword** monitor
(`"duckdb":"up"`) — see `pulse/AGENTS.md` #8 for why a plain HTTP check would
have been decorative.

**Two findings worth keeping from the same sweep:**

- `storage`, `studio`, `meta` and `supavisor` show no active deployment because
  they are `SLEEPING` — deliberately idled since 2026-07-18 for cost. That is
  not an outage. Do not "fix" it.
- Every Node service logs three
  `express-rate-limit: async error during store initialization.
  ClientClosedError: The client is closed` stacks at boot. The limiters are
  constructed at import time, before `index.ts` connects Redis, so each
  `RedisStore.init()` runs against a closed client. It self-heals once Redis
  connects and the limiter fails open by design (`passOnStoreError: true`), so
  it is noise — but it is noise that costs time during exactly this kind of
  triage. Any fix must be exercised against a real Redis: the test suite uses
  `MemoryStore`, so the Redis path is untested and this file has already caused
  one total outage.

## DuckDB refuses to rename a warehouse table — incident 2026-08-13

**Symptom.** After a dataintel deploy, the log shows
`duckdb init failed (non-fatal): Dependency Error: Cannot alter entry
"fact_events" because there are entries that depend on it`, the service keeps
answering `/health`, and the intelligence console serves stale numbers because
sync never runs. Same shape as the 2026-08-09 incident: `initDb` catches the
error as non-fatal, so nothing restarts and nothing pages.

**Cause.** DuckDB will not rename a table that other objects depend on, and a
deployed warehouse carries every `idx_fact_events_*` index from `schema.sql`.

**Fix.** `migrateWarehouse()` (`dataintel/src/db/duckdb.ts`) drops the
dependent indexes via `duckdb_indexes()` before the rename; `schema.sql`
recreates them against the `_raw` table moments later in the same startup.

**The lesson worth keeping.** The migration test built its fixture with a bare
`CREATE TABLE` and no indexes — a shape no real warehouse ever has. It passed
while production failed. Any test covering a migration must build the fixture
the way the deployed database actually looks, indexes included; reverting the
fix must reproduce the production error in that test, or the case is assumed
rather than covered.

## Frontend CI fails with every test passing — incident 2026-08-13

**Symptom.** `frontend CI` exits 1 while reporting `476 passed`, with
`Errors 1 error` and an `Error: Network error` unhandled rejection. `frontend
CD` then skips (it gates on CI success), so the SPA silently does not deploy
while every other service does.

**Cause.** An unhandled rejection, not an assertion. `useAdminData` did
`await api(...)` with no `try`, relying on `api()` always returning an
envelope. A test that makes every call throw, plus any new component mounting
that hook, lets the rejection escape an async callback nothing awaits.

**Fix.** Both admin hooks convert a throw into the envelope their callers
already branch on (`adminShared.tsx`). In a browser the same path previously
left the panel on "loading" forever with no error state.

**Watch for.** A test mock returning a fresh `getToken` identity per render
re-runs the hook's effect forever and OOMs the vitest worker rather than
failing — the stable-dependency rule in `frontend/AGENTS.md` applies to mocks
as much as to product code.

## Published content invisible to users (RLS policy silently missing) — incident 2026-07-13

**Symptom:** a fully-published course (every row `status='published'`, all counts correct via service-role/psql) renders **zero lessons** for real logged-in users. No errors anywhere — the API returns `lessons: []`.

**Cause:** a table with `ENABLE ROW LEVEL SECURITY` and **no** permissive SELECT policy denies every row to `authenticated`. On this instance, `lessons` lost its `lessons_select_published` policy because re-running `npm run db:migrate` replays `0002_content_skeleton.sql`, whose old policy references the since-removed `lessons.course_id` column — the replay aborts mid-way with `column "course_id" does not exist`, dropping the policy without recreating it. (Follow-up delta migration tracked separately.)

**Diagnose:** `bash database/scripts/local-stack.sh psql -c '\d <table>'` → look at the `Policies` section. `(none)` + "row security enabled" on a user-readable table = this incident. Compare against the policy blocks in `database/migrations/0007_course_hierarchy.sql`.

**Fix:** re-apply the exact `CREATE POLICY` block from the authoritative migration (0007 for the course hierarchy) via `local-stack.sh psql`. Then verify **as a real user in the browser** — service-role queries bypass RLS and prove nothing about visibility.

**Prevention:** until the delta migration lands, do NOT re-run `db:migrate` on an instance that is already past 0007; after any publish/RLS/schema change, the acceptance check is a real login seeing the content, never a row count.

## Frontend deep links 404 / every API call 405s — incident 2026-07-17 (first production deploy)

**Symptom A:** `littlefounders.ai` loads, but any deep link (`/signup`, `/login`, `/faq`, a refresh on any non-root route) returns Vercel's 404 page.

**Cause A:** the Vercel project's Root Directory was unset (= repo root) with a manual Build Command override (`cd frontend && npm install && npm run build`) and Output Directory override (`frontend/dist`) — a leftover pattern from before `frontend/vercel.json`'s SPA rewrite existed. Vercel only reads `vercel.json` from the configured Root Directory; with Root Directory empty, it looked for a `vercel.json` at the true repo root (deleted along with v1) and found none, so it fell back to a default static-site config with no SPA fallback (`^(?!/api).*$` → `/404.html`).

**Fix:** set Root Directory = `frontend` in Vercel Project Settings → Build and Deployment, and remove the manual Build Command/Output Directory overrides (Vite framework auto-detect now provides correct defaults from within `frontend/`). Confirm the fix by inspecting `.vercel/output/config.json` after `vercel build` — it must show `{"handle": "filesystem"}` then a catch-all rewrite to `/index.html`, not a catch-all to `/404.html`.

**Symptom B:** every frontend API call resolved to `https://littlefounders.ai/[SENSITIVE]/api/v1/...` → HTTP 405, instead of hitting the backend domain.

**Cause B:** `VITE_BACKEND_URL` was added as a Vercel environment variable with the "Sensitive" toggle ON (the dashboard's default state for new variables). Sensitive variables are **write-only** — Vercel will never return their real value again, not via the dashboard, not via `vercel pull`, not even to the project owner. The build baked in the literal placeholder string `"[SENSITIVE]"` as the value, which Vite/the router then resolved as a relative path segment.

**Fix:** delete the Sensitive variable and re-add it with the toggle OFF. `VITE_BACKEND_URL` is not actually a secret — Vite inlines it into the public JS bundle regardless, so marking it Sensitive only broke the build without adding any real protection. Reserve "Sensitive" for values that must never appear in the dashboard UI again (e.g. server-side API keys), never for `VITE_*`/public client config.

**Prevention:** after any Vercel project settings change or new environment variable, do a real `vercel build && vercel deploy --prebuilt --prod` and click through at least one deep link and one API-calling flow (e.g. signup) in a browser before considering the deploy done — a green build does not prove routing or env vars are correct.

## Incident — db:migrate replay silently DROPPED a live RLS policy (2026-07-25)

**Symptom:** every learn surface showed `0/0` lessons for all users (tree
endpoint returned empty lesson arrays); admin console still counted 62.

**Cause:** `npm run db:migrate` replays EVERY migration with plain `psql`
(no `ON_ERROR_STOP`) and keeps going after errors. A replay that dies
mid-0007 can execute `DROP POLICY IF EXISTS lessons_select_published` and
then abort before the matching `CREATE POLICY` — leaving authenticated
users with NO SELECT policy on `lessons`. The replay is not just broken,
it is DESTRUCTIVE.

**Fix applied:** re-ran 0007's `lessons_select_published` block by hand via
`bash scripts/local-stack.sh psql`, verified with
`SELECT policyname FROM pg_policies WHERE tablename='lessons'`.

**Resolution (2026-08-01):** `database/scripts/local-stack.sh migrate` now
uses `public.schema_migrations` as an immutable filename + SHA-256 ledger. It
wraps each new migration and its receipt in one transaction, rejects modified
files, and refuses to touch a populated pre-ledger database. For such a legacy
database, first inspect its verified high-water mark, then run exactly once:
`npm run db:migrate -- --baseline NNNN`. The normal command afterwards applies
only later migrations. This closes task_8fbe050a; it does not remove the need
to audit RLS and real-user visibility after a prior failed historical replay.

## Learner stats silently RESET to zero on lesson completion (failure mode closed 2026-07-28)

**The highest-consequence entry in this file: it destroys user data, returns 200, and writes no log line.**

**Symptom:** a learner finishes a lesson, the results screen looks normal, the request succeeds, and their XP / minutes / lessons-completed / streak drop to roughly the value of that one lesson. Parents see the kid's dashboard "reset". Nothing in Core's logs, nothing in `audit_logs`, no alert.

**Cause:** `POST /api/v1/learn/lessons/:id/complete` is a read-modify-write over `learning_stats` — it reads the row, adds deltas, and PATCHes the result back as a blind overwrite (not `UPDATE ... SET x = x + n`). `getLearningStatsForUpdate` used to collapse a *failed* read into the same zeroed row it returns for "no progress yet", so one transient PostgREST failure (pooler blip, `db` restart, statement timeout) made the next PATCH write deltas-from-zero over the real totals. `backend/src/routes/learn.ts` is the only writer of `xp_points`; nothing repaired it afterwards.

**Why it was silent:** the `rest()` helper in `backend/src/services/supabaseRest.ts` returns `null` for both a transport failure and a non-2xx response, and logs neither. `learning_stats` has no `updated_at` touch trigger (the column is a `DEFAULT now()` set at INSERT, and `patchLearningStats` does not set it), so the row itself carries no evidence of the overwrite. The only trace of this bug is the data.

**Detect** — the loss leaves a signature, not a log. `learning_stats.xp_points` must equal `SUM(lesson_progress.xp_earned)` and `lessons_completed` must equal the count of passed lessons: the handler only ever adds the per-lesson delta, so any shortfall means stats were written from a zeroed base (or a PATCH failed after the `lesson_progress` upsert committed — also worth seeing).

```sql
SELECT ls.user_id, ls.xp_points, SUM(lp.xp_earned) AS xp_from_lessons,
       ls.lessons_completed, COUNT(*) FILTER (WHERE lp.passed) AS passed_lessons
FROM public.learning_stats ls
JOIN public.lesson_progress lp ON lp.user_id = ls.user_id
GROUP BY ls.user_id, ls.xp_points, ls.lessons_completed
HAVING ls.xp_points < SUM(lp.xp_earned)
    OR ls.lessons_completed < COUNT(*) FILTER (WHERE lp.passed);
```

Run it through `bash database/scripts/local-stack.sh psql` (args pass through) locally, or `railway ssh --service db` + `psql` in production. Zero rows = clean. **There is no confirmed production occurrence — but by construction this bug leaves nothing to find in logs, so run the query before concluding there wasn't one**, and after any `db`/pooler incident.

**Recoverable vs NOT.** `lesson_progress` is written *before* the stats read, so it survives the reset:
- `xp_points` → reconstructible as `SUM(lesson_progress.xp_earned)`.
- `lessons_completed` → reconstructible as `COUNT(*) WHERE passed`.
- `minutes_learned`, `streak_days`, `longest_streak`, `last_active_date` → **unrecoverable.** They exist in no other table and are derived from session timing Core never persists anywhere else. Losing them is permanent, per learner.

**No repair job exists.** If the query returns rows, the reconstruction is a hand-written `UPDATE` from those two sums; leave the minutes/streak columns alone or agree a value with the owner — inventing a streak is worse than a visible zero.

**Fix (2026-07-28):** `getLearningStatsForUpdate` now returns `LearningStatsForUpdateRow | null`, where `null` means *Vault did not answer* and is distinct from an empty result set (still legitimately zero — 0006's trigger creates a row per user). The completion route 502s on `null`; `lesson_progress` is already committed at that point, so the client just retries. Regression test in `backend/src/__tests__/learn.test.ts` faults only the `learning_stats` GET and asserts the row is untouched — it fails without the guard.

**Prevention:** a read that feeds a blind overwrite MUST be able to say "I don't know". Never let a display-time default (`ZERO_STATS` and its kind) leak into a write path — a display can afford to guess, a write cannot.

## Core deploys green but nothing is listening — healthcheck connection-refused, container never restarts (failure mode closed 2026-07-28)

**Symptom:** `littlefounders-backend` shows a running container, `/health` gives connection-refused (not a 500 — nothing is bound to `$PORT`), the deploy healthcheck fails, and the container **never restarts**. Logs stop after the last startup line: no crash, no stack trace, no exit.

**Cause:** `startServer()` awaited `redisClient.connect()` before `createApp().listen(PORT)`. node-redis applies its reconnect strategy to the INITIAL connect as well, so against an unreachable Redis that promise neither resolves nor rejects — it retries forever. `listen()` was never reached, the `catch`'s `process.exit(1)` was unreachable, and because the process stayed alive, `restartPolicyType: "ON_FAILURE"` (`backend/railway.json`) never fired. Trigger: any redeploy where the `Redis` service is still booting, or an outage on it.

**Diagnose:** service "up" + `/health` refused + last log line is the pre-Redis one. Check the `Redis` service in the same Railway project before touching Core.

**Fix (2026-07-28):** `listen()` happens FIRST; Redis connects in the background (`.then/.catch`, never awaited). A Redis outage now degrades rate limiting instead of preventing the service from serving at all.

**On a deploy older than the fix:** restart/redeploy `Redis` first, *then* `railway redeploy --service littlefounders-backend --yes`. Redeploying Core alone does nothing while Redis is still unreachable — it will hang again.

**Prevention:** nothing on the startup path may block `listen()` on a dependency the service can run degraded without. An `await` that retries forever is not error handling; it is a hang, and a hang defeats every restart policy you have.

## Core answers 500 on every route — including /health — during a Redis outage (failure mode closed 2026-07-28)

**Symptom:** every endpoint 500s, `/health` included, so Railway's healthcheck fails and Core is taken down or restart-looped — while the only broken dependency is the rate-limit store. Separately, a genuine 429 reached the SPA as an opaque network error instead of the envelope.

**Cause:** three mounting/config mistakes in `backend/src/app.ts` + `backend/src/middleware/rateLimit.ts`:
1. `express-rate-limit` defaults to fail-**closed** — a store error is forwarded to the error handler, which under our envelope handler becomes a 500. Mounted app-wide, that turns a Redis outage into a total outage.
2. `/health` sat BELOW the limiter, so it both depended on Redis and consumed the caller's 200-req/15-min budget, which the platform's continuous polling can exhaust on its own.
3. `cors` was mounted after the limiter, so the `RATE_LIMITED` envelope went out without `Access-Control-Allow-Origin` and the browser discarded it.

**Fix (2026-07-28):** `passOnStoreError: true` on both limiters (fail open); `/health` mounted above the limiter; `cors` before it. Rate limiting is an availability control, not an authorization control — auth abuse stays bounded by GoTrue's own throttling. The same file now also honours `err.status`/`err.statusCode` (400 `VALIDATION_ERROR`, 413 `PAYLOAD_TOO_LARGE`) instead of flattening every malformed body into 500, so "500s everywhere" is a real signal again rather than the default answer.

**Prevention:** `/health` must depend on nothing but the process itself — mount it above every app-wide middleware. Before adding any such middleware, answer explicitly what it does when its backing store is unreachable.

## Depot crash-loops under normal traffic (unhandled stream error / dropped promise) (failure mode closed 2026-07-28)

**Symptom:** `filebase` restarts repeatedly while learners are just playing lessons; audio and images fail mid-playback for **every** user, not only the one whose request triggered it. Railway shows repeated restarts, then — once `restartPolicyMaxRetries: 10` (`filebase/railway.json`) is spent — a service that stays down.

**Cause:** two ways a single request could kill the process:
1. `createReadStream(path).pipe(res)` with no `'error'` listener. The `stat()` before it only proves the file existed a moment ago; any later open/read failure (deleted mid-request, EACCES, EIO on the Railway volume) emits `'error'` on a listener-less stream = uncaught exception. Client aborts also leaked an open fd each.
2. `void serve(...)` / `void handleUpload(...)` dropped the handler promise, so any rejection became an unhandled rejection — which Node 24 escalates to a process exit by default.

**Diagnose:** the logs show the process dying on an `ENOENT`/`EIO` stack or an unhandled rejection, with **no** `[filebase] unhandled error:` line. That prefix means the envelope error handler caught it — i.e. it is NOT this bug.

**Fix (2026-07-28):** `streamFile()` in `filebase/src/routes/download.ts` attaches `'error'` BEFORE piping (404 while headers are unsent, `res.destroy()` once bytes have gone out — a truncated transfer is honest, a silent 200 is not) and destroys the source on client `close`. Every handler in `download.ts` and `files.ts` now uses `.catch(next)`.

**Prevention:** a stream piped to a response gets its `'error'` listener attached before the pipe, and an async Express handler is `.catch(next)` — never `void` — in every service. Both mistakes turn one bad request into a platform-wide outage, which is what makes them a rule rather than a review comment.

## Data Intel warehouse silently dead after a deploy — duckdb "down", sync never runs (failure mode closed 2026-08-09)

**Symptom:** right after a deploy that added columns to `dataintel/src/db/schema.sql`, `GET /health` on dataintel answers **200 `status: "ok"`** while reporting `components.duckdb: "down"` and `last_sync_at: null`. Nothing restart-loops, no job goes red, and CI is green — the warehouse simply stops ingesting, so every analytics surface quietly freezes at its last good state.

**Cause:** the warehouse file lives on a Railway volume (`dataintel-volume`, `DUCKDB_PATH=/app/duckdb/dataintel.db`) that **survives every deploy**, and every table in `schema.sql` is `CREATE TABLE IF NOT EXISTS`. On an existing warehouse the CREATE is skipped **whole**, so a column added to one of those definitions is never created. `schema.sql` did carry the matching `ALTER TABLE … ADD COLUMN IF NOT EXISTS` block — but at the END of the file, **after** the `CREATE INDEX` statements. `idx_fact_events_occurred ON fact_events(occurred_at)` therefore ran before the ALTER that adds `occurred_at` and raised `Binder Error: Table "fact_events" does not have a column named "occurred_at"`. `initDb` catches that as "non-fatal", which is why the process stays up and healthy-looking with the warehouse dead behind it.

**Diagnose:** `railway logs --service dataintel | grep 'duckdb init failed'`. The Binder Error names the missing column, and `information_schema.columns` on the live file confirms it is absent while `schema.sql` declares it. A 200 from `/health` proves nothing here — read `components.duckdb`.

**Fix (2026-08-09):** moved the ALTER block **above** the index statements in `dataintel/src/db/schema.sql` (it was duplicated during triage — there must be exactly one block). `src/__tests__/schema-evolution.test.ts` now applies `schema.sql` over a table shaped like the pre-existing warehouse and fails on precisely this Binder Error, so the ordering cannot silently regress.

**Prevention:** in a schema file applied to a PERSISTENT database, `CREATE TABLE IF NOT EXISTS` is not schema evolution — it is a no-op on every deploy after the first. A column added to an existing table needs an `ALTER … ADD COLUMN IF NOT EXISTS` in the same commit, and that block must precede anything referencing the new column (indexes, views, queries). More generally: a health endpoint that degrades a dead dependency to a field inside a 200 needs that field read by something — an alert or a check — or the outage is invisible.

## Plausible records `/admin/*` and product routes despite the acquisition boundary (failure mode closed 2026-08-14)

**Symptom:** the Plausible top-pages report contains `/admin/analytics`, `/admin/users`, `/learn/...` and `/signup` — routes that `pulse/AGENTS.md` and §1.9 restrict to public acquisition surfaces only. The frontend code looks correct: the effect mounts the script on marketing paths and calls `ejectScript('lf-plausible')` on every other route, and unit tests of the gate predicate pass.

**Cause:** `window.plausible.init()` was called with no options, so `autoCapturePageviews` took its default of **true**. That makes the Plausible runtime patch `history.pushState` and record every SPA navigation *by itself*, independently of our gate. Removing the `<script>` node afterwards does not undo it: the script has already executed and its History hook survives the node's removal. So any visitor who legitimately consented on a marketing page carried Plausible with them for the rest of the session — into signup, the product, and the staff console. The gate was never wrong; it was simply not the thing deciding what got recorded.

**Diagnose:** in Plausible, break down Top Pages for a single day and look for any non-marketing path. In the browser, load a marketing page, navigate into the app, and check `window.plausible.o` — if `autoCapturePageviews` is not `false`, the runtime is self-firing. The `<script id="lf-plausible">` tag being absent from the DOM is **not** evidence that tracking stopped.

**Fix (2026-08-14):** `mountPlausible()` in `frontend/src/lib/analytics.tsx` now calls `init({ autoCapturePageviews: false })`, and the effect fires `trackPlausiblePageview()` explicitly per approved navigation — so the same predicate that authorises the mount is the only thing that can emit a pageview. `analytics.test.tsx` asserts the option (stubbing `VITE_PLAUSIBLE_SRC` and re-importing the module, since the mount is a no-op without it) and was A/B verified: reverting the option fails the test.

**Prevention:** a third-party tag that offers automatic SPA capture must have it turned OFF, with our own code emitting each event — otherwise the vendor's history hook, not our consent/route logic, defines the boundary. Unmounting a script tag never revokes behaviour the script already installed on `window` or `history`.

**Umami had the identical defect (same day).** Its tracker auto-tracks by default too, so the `!isAdminPath(pathname)` gate likewise only decided whether to add the tag. Production held 88 `/admin/*` pageviews — **31.5%** of all path-level pageviews over twelve months, across all eleven admin routes. Fixed the same way: `data-auto-track="false"` plus an explicit `umami.track()` per approved navigation. The tracker is deferred, so the first call is bound to the script's `load` event — calling directly on the mount that creates the tag drops the landing pageview, which is the one acquisition reporting most needs.

**Correcting the history that was already stored.** The bad events cannot be deleted (neither vendor supports delete-by-filter), so the correction is applied at READ time and the two tools differ in how far it reaches:
- **Plausible** — `plausibleQuery()` in `backend/src/services/pulse.ts` now ANDs an always-on `ACQUISITION_SCOPE` allowlist into every request, mirroring `isMarketingPath`. It is applied at that one choke point so no call site can omit it. Verified against production: twelve months of top pages returns only `/`, `/families`, `/how-it-works`, `/faq`, `/legal/*` — zero out-of-boundary rows, GA4 imports included. Adding a marketing route means updating the frontend gate AND this list.
- **Umami** — its API has no negation filter, so the aggregate cannot be scoped. `pageviews` could be corrected by subtraction but `visits`/`bounces`/`totaltime` could not (one visitor may span both), and correcting only the summable metric would leave the payload internally inconsistent. So `getUmamiStats` reports `outOfBoundaryPageviews` alongside the totals and the caller decides. `null` means the breakdown could not be read — it is NOT zero and must never be rendered as "clean".
- **Data Intel** — needs no backfill: `is_staff` is a join against `user_roles` evaluated at query time, so every historical query is already filtered (measured over 90 days: 3,539 events excluded, 383 kept).


## Staff-IP exclusion suggestions can be VPN exit nodes — do not approve blindly (2026-08-14)

**What happened.** With the internal-traffic exclusion registry empty, the
auto-detector had collected four staff sightings across three addresses, and
the obvious next step was to approve them. A `whois` check first showed all
three belong to **CDN77 / Datacamp** — `169.150.224.129/130` is CDN77 Houston,
`84.17.44.225` is CDN77 LAX. They are consumer **VPN exit nodes**, not devices
and not an office. The tell was in our own data before the lookup: two
different staff accounts (`jesusv@`, `raul@`) appeared on the *same* address,
which a personal device cannot explain.

**Why approving them would have been wrong, in both directions.** An exclusion
on a VPN exit removes every OTHER person using that same exit server — real
users, silently, with no way to tell afterwards that they existed. And it does
not even achieve its purpose, because exit IPs rotate: the same staff member
reappears on a different node tomorrow and is counted again. It is the same
reasoning that made us refuse datacenter/ASN blocking outright — iCloud Private
Relay egresses from datacenter ranges carrying genuine Safari sessions.

**Diagnose before approving any suggestion:**

```
whois <address> | grep -iE '^(netname|descr|orgname|org-name):'
whois -h whois.ripe.net <address> | grep -iE '^(netname|descr):'   # RIPE-delegated space
```

A residential or business ISP name is a real device or office and is safe to
exclude at `/32`. A CDN, hosting, cloud or "VPN" name is not. Two distinct
staff accounts sharing one address is itself a red flag — check before acting.

**What to do instead.** Nothing, for a VPN. The residual exposure is already
small: Plausible and GA4 both require `session === null`, so a signed-in staff
member is never recorded regardless of address; the leak is only staff browsing
the public site signed OUT. Note also that setting `plausible_ignore` /
`umami.disabled` by hand does NOT work on our site — `applyVendorOptOuts()`
clears both keys whenever Core answers "allowed", by design, so that revoking
an exclusion genuinely re-enables measurement. **Built 2026-08-14:** a device-level opt-out (`lf_analytics_device_optout`,
Admin → Analytics → Internal traffic → "Exclude this browser"). It is stored
separately from the IP-derived flag ON PURPOSE — that one is cleared on every
"allowed" answer so revoking an exclusion genuinely re-enables measurement,
which is precisely why a hand-set vendor flag does not survive on this site.
The device flag is set and cleared only by an explicit human action, is
checked before the session cache and before any request, and silences
conversion goals as well as pageviews. It costs nothing, cannot affect anyone
else's data, and survives a rotating address — which is what an IP exclusion
behind a VPN cannot do. Use this rather than excluding a VPN exit.

**Prevention.** The exclusion panel is the right tool for a stable egress and
the wrong tool for a rotating one. Treat every suggestion as a claim to verify,
not a queue to clear: the cost of a wrong exclusion is invisible, permanent,
and lands on real users rather than on staff.

## Every exercise intro shows the same picture (failure mode closed 2026-08-14)

**Symptom.** Across a published course, exercise intros nearly all show one
image — for financial-education, a lemonade stand — regardless of what the
lesson is about. Exercises whose comprehension depends on the picture become
misleading rather than merely unhelpful. Coverage reports 100%, CI is green,
nothing errored.

**Cause (four layers, all required).**
1. `LF_VISUAL_IDENTITY` in `picturegen/src/judge/promptJudge.ts` ended with a
   SUBJECT — *"Cheerful lemonade-stand world…"*. That brief is injected into
   every prompt of every purpose, so it is the default subject whenever the
   label supplies none.
2. `coursegen` asked for scene anchors using the segment's `prompt_md`, which
   for the story/discussion types is a bare INSTRUCTION ("Escucha la
   conversación…"), leaving the art director with no subject at all.
3. The scene cache descriptor contained nothing identifying the lesson, so
   segments in unrelated lessons sharing a prompt were served ONE asset.
4. Neither the pixel verifier (`has_text`/`has_person` only) nor the release
   check (presence only) asks whether an image shows the right thing.

**Diagnosis query** (read-only; confirms concentration before spending
anything):

```sql
WITH seg AS (
  SELECT ld.lesson_id, s->>'image_url' AS img
  FROM public.lesson_documents ld,
       LATERAL jsonb_array_elements(ld.document->'segments') s
  WHERE ld.locale = 'es-MX' AND s->>'image_url' IS NOT NULL
)
SELECT img, count(*) AS uses, count(DISTINCT lesson_id) AS lessons
FROM seg GROUP BY img ORDER BY uses DESC LIMIT 15;
```

A healthy catalog has one lesson per scene URL. Object tiles are SUPPOSED to
repeat — that sharing is what keeps illustration affordable — so read the two
classes separately.

**Recovery.**
1. Deploy the fixed `picturegen` and `coursegen` together. Forge preflights
   Prism's `/health` `style_version` and refuses a paid pass on drift, so a
   half-deploy fails closed rather than smuggling mixed art into Vault.
2. Measure, do not guess: `npm run images:backfill -- --course <slug>
   --restyle-scenes --dry-run`. It reports stale scenes and the redraws a real
   pass would bill, with no writes and no spend.
3. Run for real without `--dry-run`. It clears stale scene art, redraws the
   authoring locale once per lesson, copies to the sibling locales free, and
   re-stamps `illustration_style_version` only where the repair completed.
4. `npm run verify:course -- <slug>` — the scene-distinctness check must pass.

**Prevention.** The rule that would have prevented all of it is one line: a
style brief describes STYLE and must never name a SUBJECT (picturegen/AGENTS.md
has the long form). The rule that would have CAUGHT it is the distinctness
check now in `verify:course`. Note which of the two is cheap to enforce
mechanically — presence checks feel like coverage and are not: every one of
those wrong images was present.

## An operator script dies with HTTP 414 walking the course hierarchy (failure mode closed 2026-08-15)

**Symptom.** A script that resolves a course slug to its lessons fails with
`vault select "/lessons?topic_id=in.(…hundreds of uuids…)" failed: HTTP 414`.
Nothing is wrong with the data; the GET request line is simply longer than Kong
will accept.

**Cause.** Every `in.(…)` hop in a hierarchy walk grows with the course. A pilot
course has a handful of topics and a real one has hundreds, so the ceiling is
invisible until the script is first pointed at production. `verifyCourse.ts` was
fixed for this on 2026-08-10 at the topics→lessons hop; `images:backfill` had
only batched its FINAL lesson_documents hop, so the same failure re-appeared one
level up on 2026-08-15 — and `verifyCourse` still had an unbatched sagas→topics
hop of its own.

**Fix / prevention.** Batch on the HELPER, never at the call site. Both scripts
now route every id list through one chunking function (`selectByIds` /
`qChunked`, 150 uuids ≈ 5.5KB), so a new hop is bounded by construction rather
than by whoever remembers. Note the two limits are different: the request LINE
bounds id-only hops, while the RESPONSE bounds document fetches — lesson
documents are therefore batched smaller (100), because 100 lessons already means
~300 full documents in one payload.

**Check before running any hierarchy-walking script against a real course:** grep
it for `in.(` and confirm each hit goes through the batching helper.

## `--dry-run` is not automatically free (near-miss 2026-08-15)

**What almost happened.** `images:backfill --restyle-scenes --dry-run` was run
against production financial-education to *measure* the repair. `--dry-run`
means "no Vault writes"; it did NOT mean "no Prism calls". Because a restyle
clears every stale scene before re-illustrating, that command was on its way to
redrawing the whole catalog's scenes at full price purely to print a count. It
was killed during the document-fetch phase and **billed nothing** — confirmed,
not assumed: `picture_assets` held 9,179 rows with **zero** created on or after
2026-08-14.

**Verifying spend after an aborted run** (read-only, from inside the service so
it uses the service's own credentials — no DB shell needed):

```
railway ssh --service coursegen "node -e '...'"   # count picture_assets by created_at
```

`Prefer: count=exact` with `Range: 0-0` returns the count in `content-range`
without transferring rows.

**Fixed.** A restyle now needs `--confirm-spend` before it may contact Prism at
all, mirroring `railway-migrate.sh --confirm-production`; without it the pass
runs measurement-only and prints that on its first line. One predicate,
`spendAllowed()`, gates both the style-version probe and every illustrate call,
so the two can never disagree about whether money is on the table.

**The general rule.** A flag named `--dry-run` must mean "no side effects", and
money is the largest side effect there is. Where a mode genuinely wants to
preview paid output (the ordinary add-only backfill does), say so LOUDLY in the
help text and the README — and give operators a guaranteed-free alternative
(`--reuse-only`). Never let "I didn't pass the scary flag" be the only thing
standing between a measurement and a four-figure bill.

## Regenerating a lesson that is already LIVE removes it from the child's path (failure mode closed 2026-08-15)

**The trap.** `publishLessonSlot` upserted `status: 'review'` unconditionally —
correct for a first publish (COURSE_ENGINE §6: a human releases kid-facing
content), catastrophic for a REGENERATION. The learner RLS policy on `lessons`
is `status = 'published' AND <published ancestor chain>`, so re-running
generation over live lessons silently deletes them from every child's course
until a human re-publishes each one. Found while planning a one-adventure
content regeneration; no learner was ever affected.

**Now.** Publish READS the slot's status before writing. If the lesson is
already `published`, the run must state a policy or the write is refused:

- `--on-existing-published keep-published` — swap the content in place; the
  lesson stays live and no path breaks. The new content ships without a fresh
  human read.
- `--on-existing-published demote-to-review` — honour the §6 human gate. The
  lesson LEAVES the learner catalog until released again. Plan the re-release
  before you use this on a live course.

Neither is a safe default, which is why there isn't one.

**Before any regeneration over a live course, ask:** how many lessons will this
touch, and am I prepared to re-publish all of them today? If the answer is no,
use `keep-published` or scope the run (`--slots`, or one adventure).

## Every image fails with `DashScope responded 400` — the account is in arrears (2026-08-15)

**Symptom.** A generation or `images:backfill` run logs, for every target:

```
images: skipping illustration for "…" — picturegen HTTP 502: DashScope responded 400
```

**Cause.** Not the prompt, not the code. DashScope answers with a body naming
the reason and the client used to discard it. Reproduced by hand:

```
{"code":"Arrearage","message":"Access denied, please make sure your account
 is in good standing."}
```

The Alibaba Cloud / Model Studio account had an overdue payment. Nothing can be
generated, and nothing is billed either, until it is settled.

**Diagnosing it in ten seconds** (the client now includes the body in its error,
so the log alone should say `Arrearage`). To confirm against the provider
directly, from inside the service so it uses the real credentials:

```
railway ssh --service picturegen "node -e '…POST /api/v1/services/aigc/multimodal-generation/generation…'"
```

Print `res.status` AND `await res.text()`. A status without a body is not a
diagnosis.

**Note the model.** Production runs `IMAGE_MODEL=qwen-image-2.0`, not the
`qwen-image-max` the style-version strings and the `COST_QWEN_IMAGE_PER_IMAGE`
default ($0.075) are named for. The model is part of the cache key so the
catalog is self-consistent, but re-check the tariff for the model actually
configured before quoting a repair or a run.

**What a run must NOT do while this is happening.** Two guards exist because a
paid repair walked straight through the outage on 2026-08-15:

- the restyle stamps `illustration_style_version` only when
  `inspectIllustrationCoverage` reports zero missing images, so a lesson can
  never be marked current with no art;
- after 3 consecutive lessons that need images and receive none, the pass
  ABORTS with "systemic failure" rather than clearing art it cannot replace.

Two lessons were stamped before the first guard existed; they were reverted by
PATCHing `illustration_style_version` back to the prior composite value.
