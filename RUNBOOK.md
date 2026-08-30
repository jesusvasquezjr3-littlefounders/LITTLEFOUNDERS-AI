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

## `await import()` of an absolute path dies on Windows (2026-08-27)

**Symptom.** `ERR_UNSUPPORTED_ESM_URL_SCHEME: Only URLs with a scheme in:
file, data, and node are supported by the default ESM loader. On Windows,
absolute paths must be valid file:// URLs. Received protocol 'c:'`

Node's ESM loader takes a URL, and a Windows absolute path parses as the
scheme `c:`. A dynamic import written and tested on macOS or Linux works
there and fails on every Windows machine - which is the machine this project
is developed on.

**Fix.** `await import(pathToFileURL(absPath).href)`.

Hit by the three SEO tools on 2026-08-27 (`check-seo-surface.mjs`, its test,
and `check-seo-live.mjs`), which turned `seo:check` and `tools:test` red on a
fresh pull while being green on the machine that wrote them.

**Same family, already recorded:** the `fileURLToPath, never URL.pathname`
note at the top of `database/scripts/check-migrations.mjs`, and the reason
`npm test` in `database/` could not pass on Windows until 2026-08-23. When a
tool resolves a path and then hands it to something that wants a URL, convert
it explicitly.

## Regenerating `database/types/database.ts` after a migration

The file is GENERATED and must never be hand-edited. `npm run db:types` in
`database/` introspects the LOCAL stack, not production, so the canonical path
is to bring the local database up to the same migration and generate from there:

```bash
npm --prefix database run db:up      # Docker
npm --prefix database run db:reset   # applies every migration, twice-safe
npm --prefix database run db:types   # writes types/database.ts
```

Requires Docker and the Supabase CLI on PATH. Neither existed on the machine
that wrote `0049`, which is why the file sat stale from 2026-08-26 to whenever
this is next run.

**Generating from production instead** is possible but usually is not: Railway
services are private by default, so a laptop cannot reach the Postgres port
without a TCP proxy. If one exists:

```bash
npx --yes supabase gen types --lang typescript   --db-url "postgresql://postgres:<PASSWORD>@<HOST>:<PORT>/postgres"   --schema public > database/types/database.ts
```

The password and host come from the Railway `db` service variables. Note that
the CLI special-cases `127.0.0.1`/`localhost` URLs and demands its own
`supabase start` stack, which is why `local-stack.sh db-url` prints `0.0.0.0`.

**How stale types actually bite.** They do not break a build: nothing imports
the affected row type today, which is why `0049` shipped green with the file
still declaring a dropped column. They bite the first time someone writes code
against the generated shape and trusts it. Treat regeneration as part of the
migration, not as tidying afterwards.

## Pushing when `gh`'s token cannot (2026-08-27)

**Symptom, in two flavours.** An OAuth token with `repo` but not `workflow`
refuses any push whose commits touch `.github/workflows/`:

```
! [remote rejected] main -> main
  refusing to allow an OAuth App to create or update workflow
  `.github/workflows/database-cd.yml` without `workflow` scope
```

A fine-grained PAT without repository access refuses everything, with a less
helpful message: `remote: Write access to repository not granted` (403) on push,
and HTTP 404 on every `gh api` call including plain repository metadata.

**What works regardless.** `git@github.com:` over SSH, which does not involve
the `gh` token at all. `ssh -T git@github.com` answering "Hi <user>! You've
successfully authenticated" is the check worth running first - it takes a second
and tells you which half of the problem you have.

`origin` is now the SSH URL, matching what `gh auth status` already reports as
the configured protocol for git operations.

**What SSH does NOT give back: the GitHub API.** `gh run list`, `gh run view`
and everything else under `/actions` still 404 while the token lacks repository
access, so CI and CD results cannot be read from here. Verify the effects
instead - `git ls-remote` for what actually landed, the production `/health`
and a live probe of whatever the release changed - and say plainly that the
workflow results were not observed rather than assuming them from a successful
push.

**To restore full access,** the token needs repository Contents: read and write
(to push) plus Workflows: read and write (to touch `.github/workflows/`), and
Actions: read if `gh run` is wanted.

## Deploying the family/kid accounts release (prepared 2026-08-26, NOT yet deployed)

Everything below was written while building the release; none of it has been
run against production, and the order matters.

**1. Ship the CODE first, then apply migration
`0049_drop_parent_verification_address.sql`. This is the opposite of what this
section said when it was first written, and getting it backwards would have
broken parent verification in production.**

The reasoning that matters is which direction survives a window where the two
halves disagree:

  - code first: Core stops sending `address`, the column is still there and is
    `NOT NULL DEFAULT ''`, so inserts land with an empty string. Nothing breaks.
    The migration then drops a column nothing writes.
  - migration first: the column is gone while the OLD Core is still sending it,
    and PostgREST rejects an insert naming a column that is not in its schema
    cache. `insertParentVerification` returns null, the route answers 502, and
    every parent verification fails for the length of the window.

There is no rolling-deploy hazard either way here, because the migration is a
separate MANUAL step (below) rather than part of the code deploy.

It is `DROP COLUMN IF EXISTS`, idempotent, and it DESTROYS the stored home
addresses - that is the intent (they were write-only PII nothing verified), but
it is irreversible, so take the verified backup first, the same way any other
schema change here does.

**How the migration is actually applied.** There is NO database CD. It runs
through the `tutor-deploy.yml` workflow, dispatched by hand with `step: migrate`
(which does its own `--dry-run` first). A push deploys code only; nothing about
pushing applies a migration, so this step will not happen unless someone
triggers it.

**2. Regenerate `database/types/database.ts`. DONE 2026-08-27.** It is
generated, never hand-edited, and it had gone stale at `0046`: it still listed
`parent_verifications.address` and knew nothing of the Oracle tables or
`courses.in_progress`. Regenerated against a full local stack (`db:up`,
`db:reset` through `0049`, `db:types`), it grew 72,812 -> 85,267 bytes;
`parent_verifications.address` is gone and the only surviving `address` entries
are `analytics_staff_ip_sightings.address` (an `inet`) and Courier's
`to_address`, both correct.

**Two things that cost time here, so they do not cost it twice.**

`db:types` is `supabase gen types ... > types/database.ts`. The shell creates
that redirect BEFORE the command runs, so a failed generation does not leave the
old file alone - it leaves a ZERO-BYTE one. That is exactly what the machine
this was built on was carrying: the file measured 0 bytes on disk while `HEAD`
still held 72,812, an uncommitted truncation that no gate could see, because
nothing in the codebase imports these types. Generate to a temporary path and
copy it in once it is non-empty; never redirect straight onto the tracked file.

And nothing importing them is the reason this file can rot silently: the insert
shapes in `supabaseRest.ts` are hand-written, so every suite stays green against
a schema description that is a year of migrations behind. The types are a
REFERENCE for whoever writes the next query, which means the damage is deferred
to the first person who trusts them - the worst moment to find out.

**3. Smoke-test the child-account creation path against the real GoTrue, before
telling anyone the feature exists. RUN 2026-08-27 — against GoTrue `v2.189.0`,
which is the SAME BUILD production serves, but NOT against the production
instance. Read the gap at the end of this step before trusting it.**

Production runs `v2.189.0` (`GET /auth/v1/health` on `auth-b2c`); the pinned
local stack runs the identical image, and neither carries any of GoTrue's
optional email-validation or blocklist settings. That makes the `.invalid`
question — the one thing here that is about GoTrue's BINARY rather than about
our data — answerable without touching production, which is why it was answered
that way. What was run, through the real Core against the real GoTrue, with a
throwaway child that was deleted at the end:

  - **`@kids.littlefounders.invalid` is ACCEPTED.** `POST /api/v1/family/kids`
    returned `201` and `auth.users.email` reads
    `smoke_throwaway@kids.littlefounders.invalid`. No fallback domain is needed.
  - **No mail is attempted** — `confirmation_sent_at` is NULL and the
    confirmation token is empty.
  - **But `email_confirm: true` is not what prevents the mail, and this section
    used to say it was.** A control user created through the same admin endpoint
    WITHOUT `email_confirm` also sent no mail: the GoTrue admin create path never
    mails. What `email_confirm: true` actually buys is the only thing that makes
    the account usable — the control user could not sign in at all, answering
    `EMAIL_NOT_CONFIRMED`, and it never could have, because the confirmation
    would be posted to an address that by RFC 2606 can never receive it. Drop
    that flag and every child account is created permanently locked out, with a
    `201` on the way in. It is load-bearing, not hygiene.
  - **Sign-in by USERNAME works** (`smoke_throwaway`), and so does the
    `.invalid` address, so the disambiguation on `@` behaves both ways.
  - **Passphrase rotation works**, and is a real rotation: the old passphrase
    then answers `INVALID_CREDENTIALS` and the new one returns a session.
  - **The delete cascade is complete.** After `DELETE /family/kids/:id`, the
    `auth.users` row, both `user_roles` rows, the `guardian_links` row and the
    `profiles` row are all gone — `0 | 0 | 0 | 0`. A child carries `kid` AND
    `universal`, which is the normal shape (the seeded `kid` fixture matches);
    a single-row lookup on `user_roles` will throw.
  - **The audit trail is there**: `family.kid_created`,
    `family.kid_passphrase_rotated`, `family.kid_delete.requested`,
    `family.kid_deleted`.

**The gap, stated plainly.** Production has NO `parent` and NO `kid` — 31
`universal` and 2 `superadmin`, zero `guardian_links`, zero
`parent_verifications`. The only route to `parent` is
`POST /api/v1/verification/parent`, which uploads a photo of a real government
ID to Guardian, so the end-to-end run in production needs a real adult with a
real document and cannot be automated or delegated. What that leaves untested
against the production INSTANCE is production's data and configuration, not
GoTrue's behaviour: the one config difference found is `GOTRUE_MAILER_AUTOCONFIRM`
(`true` locally, `false` in production), and it does not touch the admin create
path used here. Do the run below once there is a verified parent; until then the
feature is shipped and reachable by nobody.

The original checklist, for that run:

- Create a child from `/family` and confirm the account appears. The address
  Core sends is `<username>@kids.littlefounders.invalid`. `.invalid` is reserved
  by RFC 2606 and cannot resolve, which is exactly why it was chosen - but our
  pinned GoTrue version has never been asked to accept one here. If it refuses,
  the failure surfaces as GoTrue's own message through the envelope; the fix is
  a different reserved domain, not a real one.
- Confirm NO mail is attempted for that address (check Courier's logs and the
  Haraka `log_delivery` entries). `email_confirm: true` is what should prevent
  it.
- Sign in as the child with the USERNAME on `/login`, on a phone. This is the
  path a nine-year-old walks, and it is the one with no email fallback if it
  breaks.
- Rotate the passphrase from `/family` and sign in again with the new one.
- Delete a throwaway child and confirm the cascade actually removed the profile,
  the role and the guardian link (`select` all three by that user id).

**3b. AFTER the migration succeeds, three things must move together or the
repository starts lying about production.** All three are checked by gates, so
forgetting one turns CI red rather than going unnoticed:

  - `ROADMAP.md`: the high-water mark `production at **48/48**` becomes
    `**49/49**`, and the `unapplied deltas \`0049\`-\`0049\` are PENDING`
    sentence goes. `repo-consistency.test.mjs` asserts the mark accounts for
    every migration in the repo, so leaving it stale fails `repo gates`.
  - `database/scripts/check-migration-phase.mjs`: `APPLIED_THROUGH` 48 -> 49.
    Otherwise the gate keeps reporting `0049` as a pending contraction forever,
    and `database CD` keeps refusing batches that are actually fine.
  - `database/types/database.ts`: regenerate (step 2). DONE 2026-08-27.

Do them in one commit, with the run's output pasted into the ROADMAP sentence
the way `0047` and `0048` recorded theirs.

**4. Check the age screen on the real signup. RUN 2026-08-27, and it found a
defect — fixed in the same session.** A date of birth is now required and
screened at 13; under-age answers `403 AGE_RESTRICTED`. A missing date answers
`400 VALIDATION_ERROR`, an adult completes, and a nine-year-old is refused —
all three confirmed through the real route.

**The defect.** The screen computed age as `(now - born) / (365.25 days)`. An
average year cannot express a boundary a CALENDAR defines: 365.25 days is longer
than three years in four, so the computed age lagged the real birthday and the
gate opened LATE. A child born 2013-08-27, evaluated on their thirteenth
birthday, computed as `12.999316` at 00:00 UTC and `13.000114` at 07:00 — the
same child refused in the morning and admitted after breakfast. Swept across
1460 consecutive birthdays it refused 1095 of them, 75.0%.

It never admitted an under-13; the drift ran conservative in every case checked.
That is precisely why it survived: it cost signups, not safety, and a refused
signup does not page anybody. It also had a test, which built its fixture with
`9 * 365.25 * 24 * 3600 * 1000` — the same expression the implementation divided
by. **A test written in the units of the code under test agrees with the bug by
construction**, and a nine-year-old sits four years from the boundary, so it
would have passed no matter how wrong the arithmetic was.

`yearsOld` now counts completed calendar years in UTC, and is exported so the
boundary is swept directly rather than through HTTP. Two things learned writing
those sweeps, both worth keeping: fake timers and `supertest` do not compose —
the request never settles — so a date-boundary sweep belongs in a unit test, not
an HTTP one; and `Date.UTC(y, 1, 29)` for a non-leap year SILENTLY ROLLS to
1 March instead of refusing, so a naive "thirteen years before this date" fixture
quietly asserts that someone born 1 March turns 13 on 29 February. The
implementation was right to disagree with the first draft of the test.

**What has NO rollback but is bounded.** A child account created against a
GoTrue that later rejects the domain simply cannot be created - nothing is left
half-made, because the route deletes the auth user if the guardian link fails
and refuses the username before creating anything.

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
- **Plausible** — `plausibleQuery()` in `backend/src/services/pulse.ts` now ANDs an always-on `ACQUISITION_SCOPE` allowlist into every request, mirroring `isMarketingPath`. It is applied at that one choke point so no call site can omit it. Verified against production: twelve months of top pages returns only `/`, `/families`, `/how-it-works`, `/faq`, `/legal/*` — zero out-of-boundary rows, GA4 imports included. Adding a marketing route means updating the frontend gate AND this list. **That verification measured `event:page` only, and the sentence above said "zero out-of-boundary rows" until 2026-08-27, which was false of two other dimensions — see "An analytics report is confidently wrong about its own window" below.**
- **Umami** — its API has no negation filter, so the aggregate cannot be scoped. `pageviews` could be corrected by subtraction but `visits`/`bounces`/`totaltime` could not (one visitor may span both), and correcting only the summable metric would leave the payload internally inconsistent. So `getUmamiStats` reports `outOfBoundaryPageviews` alongside the totals and the caller decides. `null` means the breakdown could not be read — it is NOT zero and must never be rendered as "clean".
- **Data Intel** — needs no backfill: `is_staff` is a join against `user_roles` evaluated at query time, so every historical query is already filtered (measured over 90 days: 3,539 events excluded, 383 kept).


## An analytics report is confidently wrong about its own window (failure mode closed 2026-08-27)

**Symptom:** a long-range report shows **zero traffic for every day of the current month** while a shorter-range report, pulled from the same console a minute later, shows real data for those same dates. A milder version of the same fault: "today" renders as a zero-traffic day on *every* range, permanently. Reported from outside as "the site has had no visitors since the 15th".

**Do not act on it as a traffic collapse.** It presents exactly like one, and the first instinct — checking whether the tracker broke — is the wrong branch. Separate the two before anything else: ask for the same window as **explicit dates** instead of a preset. If the data reappears, this is a reporting defect, not a traffic one.

**Cause:** `resolveRange()` computed its window locally, in UTC, then handed Plausible the literal preset string (`"6mo"`) and let Plausible resolve it independently, in the SITE's timezone, by different rules. Plausible reads `6mo` as the last six **complete calendar months** and stops at the end of last month; Core believed the window ran to today. `fillDailySeries()` then padded every day Core expected and Plausible never returned — turning "never asked" into a confident `0 visitors`. Measured across the whole preset set on 2026-08-27: **every preset except `day` disagreed.** `7d`/`30d` were one timezone-day out; `month`/`year` returned windows running into the future.

That is /AGENTS.md §1.14 exactly — failure collapsed into emptiness — and the irony is that `fillDailySeries` was written to prevent it. Its own comment says a flat line at zero says the true thing where a missing line says nothing. Given a range the upstream was never asked about, it does the opposite.

**Two defects travel with it.** The comparison window is derived from the same wrong start, so `6mo` compared February against a window that *began* on 1 February — the same month on both sides of its own delta. And the CSV/XLSX/PDF exports print `from`/`to` from Core's assumption, so the provenance line those files exist to provide named a window the figures had not come from.

**Diagnose** (read-only, from inside Core — Plausible is on Railway private networking and reachable from nowhere else):

```bash
railway ssh --service littlefounders-backend "sh -c 'node -e \"
  const p = await import(\\\"/app/dist/services/pulse.js\\\");
  for (const period of p.PLAUSIBLE_PERIODS)
    console.log(period, JSON.stringify(p.resolveRange({kind:\\\"preset\\\",period}).dateRange));
\"'"
```

Every line must be an explicit `["YYYY-MM-DD","YYYY-MM-DD"]` pair ending on **today in the site's timezone**. A bare preset string there is this defect returning. Then confirm the upstream agrees: `getPlausibleOverview` returns `rangeDrift`, which is `null` when Plausible echoed back the window we sent and names both windows when it did not.

**Fix (2026-08-27):** `resolveRange()` resolves every preset to explicit dates in the site's timezone (`PLAUSIBLE_SITE_TIMEZONE`, default `America/Mexico_City`, validated at parse so a bad zone fails loudly instead of throwing on every read). One system decides the window and both use it. A drift guard compares what we sent against the `query.date_range` Plausible echoes back and **reports** a mismatch on the panel rather than relabelling the chart.

**Prevention:** never pass an upstream's own shorthand through and assume it means what you mean. Agreeing with a vendor's dashboard label is worth nothing if the two of you are describing different windows. The gate that was missing: every range test used `custom` ranges — explicit dates, correct by construction — so the suite asserted only that Core agreed with itself. `backend/src/__tests__/analytics-range-integrity.test.ts` now exercises every preset.

### Two companions found in the same investigation

**A breakdown that does not add up to the headline.** Source, country, device and channel summing to 48 visitors under a headline of 1,120 is not wrong, it is **incomplete**: the always-on `event:page` allowlist cannot be applied to GA4-imported data (imports are stored pre-aggregated per dimension), so Plausible drops twelve months of imported history from every non-page breakdown — and says so, in `meta.imports_skip_reason: "unsupported_query"`, on every response. `pulse.ts` parsed `results` and discarded the rest. An outside reviewer read the exports and concluded that dimensional tracking had been switched on late, and separately that bounce/duration measurement began in March; neither happened. Imports status now travels with every payload and is stated on the affected cards and in all three export formats. **Bounce rate and visit duration are native-only at any date** — imported rows carry no session metrics, so on a long range two of the four KPIs describe a different population than the other two.

**`/admin/*` still surfacing in a "public traffic" report.** The read-time scope filters `event:page`; `visit:entry_page` and `visit:exit_page` are SESSION dimensions, and a session satisfies an event-level filter as soon as any one of its events does. So a visitor who landed on `/` and then opened the staff console reported an entry page of `/admin/analytics`. Measured over twelve months before the fix: **7 of 11 entry-page rows and 11 of 17 exit-page rows out of boundary**, `/admin/roles` and `/admin/generation` among them; zero after. The allowlist is now restated against those two dimensions from one shared definition. The lesson for the next verification: **"verified" names the thing that was measured, not the family it belongs to** — the 2026-08-14 note above generalised one dimension to fourteen and was wrong about two.

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

## Episodic recall could resurface a minor's own blocked PII to the model — incident 2026-08-29, closed the same day

**Found by an independent adversarial code review**, deliberately dispatched
to hunt the "a rule is asserted somewhere, never checked in the code that
matters" shape this project keeps finding — not by a report, not by a user.
No evidence it was ever exploited; the review is dated the same day as the
recall feature's own release (0053, 2026-08-29), so the window this was live
in production is believed to be hours, not days.

**What was wrong.** A learner's utterance classified `personal_data` (or
`self_harm`/`abuse_disclosure`/`grooming_pattern`/`injection_attempt`) is
correctly kept out of the model on the turn it happens — but the RAW turn
text is still written to `tutor_turns` regardless, because a guardian must be
able to read what their child said even when it was blocked (§1.9, a real
requirement, not the bug). `search_tutor_turns` (the FTS RPC behind episodic
recall, "¿te acuerdas de…?") had no notion that some of the rows it searches
carry that flag. A child who disclosed a home address, had that turn
correctly blocked, and later asked the tutor to recall it would have had the
address quoted VERBATIM into the next request to DeepSeek — the exact harm
the `personal_data` classifier rule exists to prevent, through a path that
never re-checked it. A second, independent gap compounded it: the recalled
excerpt was spliced into the prompt AFTER the current turn's own fence had
already closed, with a soft caption in place of the "never an instruction"
disclaimer every other piece of learner text gets — replayed history from a
DIFFERENT session, getting none of the treatment this session's own history
already receives via `conversationMessages()`.

**Why two fixes, not one.** Fencing the excerpt (oracle-side,
`orchestrator.ts`) stops the MODEL from obeying replayed text as a command.
It does NOT stop the PII from simply being present in the request body a
third party receives, which is the actual §1.9 harm. The fence is necessary
but not sufficient; the query itself had to stop returning the row.

**The fix.** Migration `0054_recall_excludes_flagged_turns.sql` adds
`AND NOT EXISTS (SELECT 1 FROM tutor_safety_flags sf WHERE sf.session_id =
tt.session_id AND sf.turn_seq = tt.seq)` to `search_tutor_turns` — a flagged
turn is no longer recallable, full stop, expand-safe either side of a code
deploy. Fixing this surfaced a THIRD, latent bug in the same call:
`persistSafetyFlag`'s `turnSeq` had been the orchestrator's internal turn
counter (`this.seq`), a completely different numbering space from
`tutor_turns.seq` (the transcript row number `ws/server.ts`'s
`nextTranscriptSeq` allocates) — so a flag and the turn it was actually FOR
could never have correlated at all. Writing the migration against the WRONG
column would have shipped a fix that looked complete and matched nothing,
silently. `ws/server.ts` now captures the real transcript seq at the point
the learner's turn is persisted and threads it through to the flag.

**How it was verified, not just reasoned about.** Against a REAL local
Postgres instance (`database/scripts/local-stack.sh psql`, wrapped in a
transaction that was rolled back afterward, no trace left): inserted one
turn classified `personal_data` and one ordinary turn matching the identical
FTS query, called `search_tutor_turns` directly, confirmed only the
unflagged turn came back. This is the standard the whole session held to
elsewhere — a claimed fix is not fixed until it is run against the real
thing, not inferred from reading the SQL.

**What this means for anyone adding a NEW way to search or replay past
turns.** `tutor_turns` is not a safe table to query blind. Any future
feature reading it (a second recall trigger, a "what have we covered"
summary, anything) must carry the same `tutor_safety_flags` exclusion this
migration added — it does not live in a view or a trigger, it lives in this
one function, and a new query written against the base table directly will
silently reopen this exact incident.

## The injection/moderation stack had two unguarded doors and a universal blind spot — incident 2026-08-29, closed the same day

**Found by the same kind of independent adversarial code review** as the
recall incident above, this time deliberately pointed at `/ORACLE.md` §5's
own layer list — not by a report, not by a user. Every finding was proven
with a throwaway test against the real function before being trusted, then
deleted; none was reasoned about without running it.

**Finding 1 (CRITICAL) — a second, unguarded door into the model.**
`classifyLearnerInput` (layer 4, "before the model") is called from exactly
one place in the whole service: `orchestrator.ts`'s `handleLearnerText`. A
spoken answer to an open checkable segment is routed through a DIFFERENT
function, `handleVoiceCheckResult` — `ws/server.ts` sends both typed and
voice-transcribed utterances there whenever a checkable segment is open,
bypassing `handleLearnerText` entirely — and that function fenced the
utterance (correctly) but never classified it, going straight to a model
call. A self-harm disclosure or a volunteered phone number said OUT LOUD
while answering an activity reached the model verbatim and received a
model-generated reply instead of the mandated scripted safety response, with
no `tutor_safety_flags` row (no guardian-visible flag) and no session stop.
This is the identical shape as the recall incident above: an invariant
stated once in a comment ("classify → BEFORE the model... a flagged
utterance must never enter a context window") and enforced on only one of
its call sites.

**Finding 2 (CRITICAL) — the universal gate itself had a one-character
bypass.** `classifyLearnerInput` matched against `text.normalize('NFC')` and
nothing else. `stripInvisible` — the function that actually removes
zero-width spaces, bidi overrides and other invisible codepoints, and this
same file's own layer-2 fence — runs strictly AFTER classification, inside
`fenceUntrusted`. A single zero-width space planted inside a trigger word (a
one-paste evasion, not a novel attack) broke every regex's word-boundary
match on the classifier, on EVERY learner turn — the primary, universal
conversation path, not a conditional branch — while the text that actually
reached the model was fully stripped and legible, since fencing happens
downstream. A test in `safety.test.ts` already proved `stripInvisible` itself
neutralizes exactly this obfuscation; it simply never asserted that
`classifyLearnerInput` used it. State computed for one purpose (the cleaned
text the model is shown) was never available to the component that was
supposed to gate on the same text.

**Finding 3 (HIGH) — a third, independent door, for real minors.**
`runPlacementIntake` (course placement, offered to the 12-14 and 15-17
bands) fences the learner's free text and sends it to the model; the only
safety pass anywhere in the function ran on the model's REPLY. Nothing ever
classified what the learner said. A disclosure or a volunteered phone number
typed into a "tell me what you already know" placement conversation reached
the model with no gate at all.

**Finding 4 (LOW, closed as part of the same class).** Output-side
deterministic moderation (`deterministicModeration`) had the identical
raw-text gap on its nonce-echo, prompt-leak and contact-detail checks — rated
lower because it requires the MODEL to emit or echo an invisible character
(a compound scenario, not directly attacker-controlled the way Findings 1-3
are), and the semantic judge pass still runs afterward for every minor
session regardless.

**The fix, all four the same shape:** classify (or moderate) the STRIPPED
text, not the raw one, and give every path that sends learner-authored free
text to the model the same gate the primary path already had.
`handleVoiceCheckResult` gained the identical classify-before-fence block
`handleLearnerText` already carried; `classifyLearnerInput` now runs against
`stripInvisible(text)`; `runPlacementIntake` classifies `learnerText` before
fencing it, falling back to the same neutral response every other refusal
reason in that function already uses; `deterministicModeration` strips
before its three regex passes.

**How it was verified.** Each finding was reproduced against the real
function: `classifyLearnerInput` called directly with a zero-width-space-
obfuscated self-harm phrase and an obfuscated injection phrase, both
returning `allow` before the fix and the correct category after;
`handleVoiceCheckResult` called directly with a self-harm disclosure,
confirmed to call `fetch` (the model) before the fix and to short-circuit
into the scripted safety response after; `runPlacementIntake` called with a
disclosure and a phone number, confirmed to reach `complete()` (the model)
before the fix and to fall back to the neutral prior, uncalled, after.
Stashing just the source fix and re-running each new test against the
unpatched code reproduced the original failure exactly, before the fix was
trusted.

**What this means for anyone adding a new way to reach the model with
learner-authored text.** `classifyLearnerInput` is not automatically applied
by fencing, sealing, or any other layer in this stack — it is one function
call that has to be made explicitly, at the top, before anything else. A new
entry point (a new turn type, a new intake flow, a new voice-adjacent
reaction) that fences without also classifying reopens Finding 1 or Finding
3's exact shape, and will not be caught by any test that only exercises the
one path it was written against.

## Resume could multiply a session into N parallel, independently-budgeted orchestrators — incident 2026-08-30, closed the same day

**Found by another independent adversarial code review**, this time pointed
at the session lifecycle, consent, and budget-enforcement layer — not by a
report, not by a user. Proven with a throwaway test against the real
WebSocket server before being trusted, then reverted.

**What was wrong.** `POST /sessions/:id/resume` (Core) mints a fresh
single-use token for any session the caller owns with `ended_at IS NULL`. It
never checked whether a socket for that session was already open — only
whether the session itself was still open in the database. Oracle's own
`ws/server.ts` had a registry of PARKED sessions (`parkedSessions`, sockets
that already dropped) but nothing tracking sockets that were still
genuinely, currently connected. So a client that simply never let its first
socket close — or called resume while still connected, deliberately or by a
buggy retry — got a second valid token for the same session, opened a second
socket, found nothing parked (there was nothing to find), and
`handleConnection` spun up a second, fully independent `TutorOrchestrator`:
its own `startedAtMs`, its own turn counter, running in parallel with the
first for as long as both stayed open.

**Why it mattered beyond "one extra socket."** Three separate harms
compounded: (1) each parallel orchestrator bought its own full session's
worth of paid model, judge and TTS calls, defeating `MAX_SESSIONS_PER_DAY` —
described in this codebase's own routes as a deliberate anti-addiction
control, not merely a cost cap; (2) `closeTutorSession` guards on `ended_at
IS NULL`, "first close wins" — so every orchestrator except the first to
close had its real, billed turn count and cost silently vanish from Core's
cost ledger, the exact "blind flight" harm CLAUDE.md §1.14 names; (3) both
sockets' `transcriptSeq` independently restarted at 0 and wrote colliding
`(session_id, seq)` rows into `tutor_turns`, which the `ignore-duplicates`
unique constraint silently resolved by dropping one side — reopening, from a
different door, the "guardian cannot read what their child actually said"
failure this project has already had to fix once before.

**The fix.** A new in-process map, `liveSessions` (`oracle/src/ws/server.ts`),
tracks every socket that is genuinely, currently connected — checked BEFORE
`takeParked`, in `handleConnection`. A session already present there refuses
the new socket outright, closing it with a new code (`4009`,
`ALREADY_CONNECTED`) rather than silently starting a second orchestrator. A
genuine resume is unaffected: it only ever reaches that check after the
ORIGINAL socket's `close` handler has already deleted its entry from
`liveSessions` (and parked its orchestrator, separately). The frontend maps
the new code to a plain, translated line — "you're already talking to me
somewhere else, check your other tab or device" — in all three locales,
rather than falling through to the generic error the owner has already
reported seeing once for an unmapped close code.

**How it was verified.** A throwaway test opened one socket, deliberately
left it open (no terminate, no close frame), minted a second fresh token for
the identical session id, and opened a second socket — against the pre-fix
code this hung forever waiting for a refusal that never came, because the
second socket connected successfully instead. The same test, kept as a
permanent regression (`live-session.test.ts` → "refuses a second socket for
a session whose first socket never actually closed"), now asserts the second
socket is closed with code `4009` and that the first socket is completely
unharmed and can still finish its own session normally.

**What this means for anyone touching resume, tokens, or session lifecycle
again.** A token being single-use and correctly scoped to one session (both
verified sound by this same review) is NOT the same guarantee as "only one
socket can ever be live for this session" — the two are independent
invariants, and this incident is what it looks like when only the first one
is enforced. Any future change to how a session is resumed, migrated between
processes, or reconnected must preserve the `liveSessions` check as the
single place that answers "is this session already live", the same way
`claimTurn` is the single place that answers "is a turn already in flight".

## The semantic moderation judge had a control that didn't exist and a fail-open on a malformed reply — incident 2026-08-30, closed the same day

**Found by a fifth independent adversarial code review**, pointed this time
at the semantic (model-based) judge half of output moderation — not by a
report, not by a user. Both findings proven with a throwaway test against
the real code before being trusted, then reverted.

**Finding 1 (CRITICAL) — tier-3 generated content never reached the safety
judge at all.** `/ORACLE.md` §7.3's own guard table stated as fact:
"Moderation | §6, same as speech." It was not. `oracle/src/content/generate.ts`
runs a QUALITY judge on a candidate segment — one loose bullet ("it contains
anything unsuitable for a child") among eight correctness/pedagogy
criteria — but never called `deterministicModeration`/`moderateTutorOutput`,
the closed harm-category gate every spoken turn goes through, on the
segment's own `prompt_md`, `explanation_md`, or any string in `payload`
(option text, rationales). A candidate that passed the quality judge cleanly
with, say, a contact detail embedded in its explanation would reach a minor
with zero exposure to the dedicated safety judge or even the free,
synchronous deterministic pass. This is content shown under the §1.9
carve-out for live generation, whose entire justification is "deterministic
gates + moderation + an independent judge instead of human publication" —
one of those three named controls was simply absent from the code.

Proven with a throwaway test: mocked the author model to return a segment
whose `explanation_md` contained an email address, mocked the quality judge
to approve it (`{pass: true}`), and confirmed `generateSegment()` returned
the segment unmodified with zero calls to moderation. The same string run
through the real `deterministicModeration()` blocks instantly — the gap was
structural, not a matter of the judge being fooled.

Fixed by moderating every learner-visible string in the candidate (never
the answer key — the learner never sees it) after the quality judge passes,
reusing the exact same `moderateTutorOutput` gate every spoken turn already
uses, with `requireModelPass` tied to the session's `isMinor`. A new local
`collectSegmentProse()` mirrors Core's own `collectProse()`
(`backend/src/services/tutorLadder.ts`) — reimplemented rather than shared,
since the two services are independent npm packages with no workspace.

**Finding 2 (CRITICAL) — a judge reply with no interpretable verdict was
silently allowed.** `modelModeration` parses the judge's JSON and checks
`parsed.safe === true` for the allow path; anything else falls into the
"refused, does it name a harm" branch built for a DIFFERENT case — a real
opinion, e.g. `{"safe": false, "category": "pedagogically_weak"}`. A reply
that is valid JSON but has no `safe` field at all — `{}`, or a field-name
mismatch such as `{"result": true}` — landed in that same branch, computed
an empty category, found it unrecognised, and returned `{ allowed: true }`.
That is the identical epistemic state as a timeout or an unconfigured
judge — this file's own rule already says a moderation service that does
not answer means the turn is not spoken — but it silently bypassed
`requireModelPass` instead. Reachable by ordinary model non-compliance with
the requested JSON shape (more likely given the judge's tight `max_tokens:
120` budget), not by an adversarial learner input.

Proven with a throwaway test: mocked the judge's reply as literally `{}`
with `requireModelPass: true` (a minor session) and got back `allowed:
true`, logged as "judge refused without a harm category (none)" — a
non-answer masquerading as a benign opinion.

Fixed by checking `typeof parsed.safe === 'boolean'` before interpreting
anything else; a response that fails that check now throws, which routes it
through the SAME retry-then-fail-closed-for-a-minor path a timeout already
takes.

**How both were verified.** Permanent regression tests added to
`generate.test.ts` (new file) and `safety.test.ts`; each confirmed to fail
against the pre-fix code (the contact-detail segment served unmodified; the
malformed-verdict test returning `allowed: true`) by stashing just the
source change and re-running.

**What this means for anyone adding a new content-generation or moderation
path.** A "judge" is not automatically a safety control — this project now
has at least three distinct judges (tier-3 quality, tier-3 safety, and the
turn-level semantic moderation pass) and conflating any two of them, or
assuming a quality pass implies a safety pass, is exactly how Finding 1
happened. And a judge's response schema must be checked for the PRESENCE
and TYPE of the field a verdict depends on, not merely parsed as JSON —
valid JSON is not the same guarantee as an interpretable answer.

## A sixth adversarial review: an incomplete resume redraw, a skill spent before it was heard, and a locale gap in the tier-1 vocabulary gate — closed 2026-08-30

**Found by a sixth independent adversarial code review**, this time pointed at
the live whiteboard, the pedagogical skill-selection system, and age/tier
vocabulary enforcement — three subsystems not yet independently reviewed this
round. Three real, reproducible defects, none of them a child-safety
exposure on their own, but each a real product/pedagogy correctness gap.
Every fix proven with a permanent regression test confirmed to fail against
the pre-fix code before being trusted.

**Finding 1 (HIGH) — resuming a dropped session never redrew the open
whiteboard or the open activity.** The resume redraw path
(`oracle/src/ws/server.ts`, the `resumed` branch) rebuilt the `turn` frame by
hand instead of routing through `deliver()` — the one function that
recomputes and attaches a whiteboard — and never re-sent a `segment` frame
at all. An ordinary reconnect (a sleeping phone, a wifi drop — precisely the
case the park/resume mechanism exists to survive) while a growth story or a
served activity was on screen left the learner staring at narration for a
board or an exercise that had simply vanished: no board, no quiz, nothing to
answer, no XP reachable, with no error either — just silence where content
used to be.

Fixed two ways: the whiteboard is now recomputed and attached in the redrawn
`turn` frame the same way `deliver()` does it on every other turn; and a new
field, `Live.lastSegmentFrame`, caches the exact last `segment` frame sent —
carried across the park exactly like `transcriptSeq` already is, cleared the
instant that segment is answered (graded, or resolved by voice-check) — and
resends it VERBATIM on resume. It is never re-served by calling
`serveSegment()` again, because that would produce a DIFFERENT exercise, not
restore the one the learner was actually looking at.

Proven with two permanent tests (`live-session.test.ts`): one drives a
whiteboard-bearing turn, drops the socket before it's answered, resumes, and
asserts the redrawn turn still carries the correct computed values; the
other serves an activity, drops the socket before it's graded, resumes,
asserts the SAME segment id is re-sent, and confirms it is still genuinely
answerable — grading it after resume reaches the model exactly as it would
have before the drop. Both confirmed to fail against the pre-fix code first.

**Finding 2 (MEDIUM) — a once-per-session skill was marked spent at
selection, not at delivery.** `oracle/src/tutor/skills.ts`'s own doc comment
defines `usedSkillNames` as skill names already DELIVERED this session, but
`orchestrator.ts`'s `strategyInstruction` added a skill to that set the
moment it was SELECTED — before the model call it feeds even started. An
interrupted turn (the learner cancels mid-production) or an exhausted retry
that falls back to a scripted line burned the skill's ONE use for the whole
session on a turn the child never actually heard, with nothing left to
retry it. Since this is the general selection-to-bookkeeping mechanism, not
specific to any one skill, it affects every current and future
`once_per_session` skill the same way.

Fixed by splitting proposal from commitment: `strategyInstruction` now
returns a proposed `skillName` alongside its instruction text, and each of
its three call sites (`handleSegmentResult`, `handleVoiceCheckResult`,
`handleLearnerText`) commits it to `usedSkillNames` only once `produce()`
resolves with `emission.source === 'model'` — a turn genuinely delivered
using the skill's real procedure, never an interrupt or a scripted
fallback.

Proven with a permanent test (`orchestrator.test.ts`): a REMEDIATE turn
diagnosing a catalogued misconception is interrupted mid-production; a later
turn re-diagnoses the identical misconception. Against the pre-fix code, the
skill was already marked spent by the interrupted attempt, so the later turn
fell back to the generic REMEDIATE instruction instead of the skill's own
procedure — confirmed directly in the request body sent to the model. Against
the fix, the real procedure (`counterexample-confront`, "CONFRONT WITH A
COUNTEREXAMPLE") is delivered.

**Finding 3 (HIGH) — the tier-1 "no decimals" filter only recognized period
decimals.** The deterministic vocabulary backstop that exists specifically to
catch advanced-notation slips before a young child sees them (built after
"10% cada año" reached a six-year-old with no gate holding an opinion) forbade
`\d+\.\d{2,}` — a period-separated decimal — for tier 1, in both
`oracle/src/tutor/prompt.ts` and its deliberate mirror,
`backend/src/services/tutorLadder.ts`. pt-BR (and es-MX prose) conventionally
writes a decimal amount with a COMMA, not a period — "3,50 reais," never
"3.50 reais." On two of the platform's three locked, shipped locales, a
decimal number sailed through this gate entirely unblocked — the exact
vocabulary class it exists to catch.

Fixed by adding a mirrored comma-decimal pattern (`\d+,\d{2,}`) to both
copies, alongside the existing period pattern. This mirrors, rather than
solves, the existing pattern's own known limitation: a period is ALSO
ambiguous with a THOUSANDS separator in es-MX/pt-BR ("1.000 pesos" means one
thousand, not the decimal 1.0), and this check has always accepted that
trade-off as the cost of a cheap, always-on, locale-agnostic pass rather
than a complete number parser.

Proven with permanent tests in both services: `oracle/src/__tests__/hardening.test.ts`
(the cross-service "the age-band vocabulary lists agree" test gained a
comma-decimal probe) and a new `backend/src/__tests__/tutorLadder.test.ts`
test verifying `verifyGeneratedSegment` refuses a tier-1 generated segment
whose prompt carries a comma-decimal number. Both confirmed to fail against
the pre-fix pattern first.

**What these three share.** None is the "one rule enforced, one path
forgotten" shape the last several incidents in this file were — they are
each a case of an EXISTING mechanism's coverage being narrower than its own
stated intent: a redraw that redraws less than a delivery does, a "spent"
flag set at the wrong lifecycle moment, and a locale-blind pattern in a
check whose whole job is catching a locale-specific notation. The common
lesson is the same one anyway: measure the mechanism against the FULL
range of real inputs and real interruption points it will actually see, not
just the path that was originally tested.

## A seventh adversarial review, this time the frontend client: a resume that tore down its own success, a message echoed as sent but never transmitted, and a duplicated transcript line — closed 2026-08-30

**Found by a seventh independent adversarial code review**, this time
pointed at the frontend client code a real learner's browser actually runs
during a live session — every prior round this session targeted Oracle's
backend/server code. Two CRITICAL findings and one MEDIUM, all in
`frontend/src/tutor/`, all proven with permanent tests against the real
hook/component and a controllable fake WebSocket, each confirmed to fail
against the pre-fix code before being trusted.

**Finding 1 (CRITICAL) — a successful resume tore down the very socket it
just opened.** `TutorExperience.tsx`'s resume-driving effect calls
`setResuming(false)` and `setSession(newUrl)` in the SAME tick once the
resume API call resolves. React batches both into one render — but
`useTutorSocket`'s own reset of `connection`/`history`/`closedReason` only
happens on ITS NEXT effect pass, triggered by the `socketUrl` change, not
synchronously within this render. So the render this batch produced still
read the OLD, already-ended socket state (`connection: 'failed'` or
similar), with `resuming` now `false` — and the SAME resume-driving effect,
re-triggered by the `resuming` dependency change, saw `ended === true` (from
the stale reading), `resuming === false`, concluded the session had ended
AGAIN, and called `setPhase('closing')`. Because `phase !== 'conversing'`
tears the socket down via `useTutorSocket`'s cleanup, the BRAND-NEW,
server-granted socket was closed before it could ever deliver `ready`.

The net effect: the resume feature (owner sign-off 2026-08-28, built
specifically to survive a sleeping phone or flaky wifi as "one quiet
repair") appeared to defeat itself every time it actually succeeded — the
learner saw the generic goodbye screen for a conversation the server was
still fully willing to continue.

Fixed by no longer clearing `resuming` inside the success branch of that
`.then()` at all; a separate effect now clears it only once the FRESH
socket's own `connection` reaches `'open'` — by which point
`useTutorSocket`'s reset has genuinely already happened, so the
resume-driving effect's re-evaluation reads accurate, non-stale state and
correctly does nothing.

Proven with a dedicated test file (`resumeRace.test.tsx`) that reproduces
the EXACT effect logic from `TutorExperience.tsx` against the real
`useTutorSocket` hook (rather than the full component, which renders the 3D
stage and a large unrelated tree): a socket delivers a turn, drops without
a farewell, a mocked `resumeSession` resolves with a fresh URL, and the test
asserts the second socket is never closed and `phase` never leaves
`'conversing'`. Reproducing the pre-fix shape inline (clearing `resuming` in
the same tick as the URL change) reliably fails this same test with
`phase === 'closing'`.

**Finding 2 (CRITICAL) — a message sent before the handshake finished was
echoed as delivered but silently never transmitted.** The composer renders
fully enabled the instant a session enters the conversing phase — the same
render that starts the WebSocket handshake — with no gate anywhere on
`connection === 'open'`. `sendText` echoes the learner's line into the
visible transcript immediately (a deliberate design choice, so typing never
feels broken on a slow connection) and then calls the shared `send()`
helper, which used to silently no-op whenever `readyState !== OPEN`. On a
slow or mobile connection, a learner who types and sends within that
CONNECTING window sees their own answer appear in their own transcript as
if delivered — the tutor never receives it and never replies, with nothing
to distinguish this from the tutor simply being slow.

Fixed with a small queue (`pendingRef`) on the shared `send()` path: a
message sent while the socket is CONNECTING is held rather than dropped,
and flushed in order the instant `onopen` fires. A socket that is CLOSING or
CLOSED is a separate, real, terminal problem already surfaced through
`connection`/`error` — queuing there would only delay the same silent loss,
so only CONNECTING is held.

Proven with a permanent test (`tutor.test.tsx`) using a `FakeSocket` variant
that starts in the real CONNECTING state rather than OPEN-from-construction
(the existing shared fixture defaults to OPEN specifically because every
other test in that file assumes an already-open socket, which is exactly
why this gap was invisible to the whole existing suite): sends a message
while connecting, confirms it is echoed locally but NOT yet transmitted,
then opens the socket and confirms it is flushed.

**Finding 3 (MEDIUM) — the redrawn turn on resume duplicated an entry the
history frame already carried.** Oracle's `history` frame on resume already
includes the on-screen tutor line (it is the turn being redrawn), and a
`turn` frame for that identical seq follows immediately after, by design —
so a fresh mount that never processed `history` still receives the active
turn. The client's `turn` handler appended unconditionally, so resuming
duplicated that one line in `history`. Invisible while
`TutorTranscript`'s `spokenSeq` filter still hid that exact seq (it hides
BOTH copies at once), the duplicate resurfaced, unfiltered, the moment the
next genuine turn changed which seq the filter hides — printing the tutor's
own sentence twice in a row in the accessible transcript right after a
network hiccup.

Fixed by skipping the append when the last entry in `history` is already
that exact `(speaker: 'tutor', seq)` pair — a no-op on the ordinary path,
where a new turn's seq never matches the previous entry's.

Proven with a permanent test (`tutor.test.tsx`) replaying the exact resume
frame sequence (a `history` frame carrying the line, then a `turn` frame
re-delivering it) and asserting exactly one match in `history`, followed by
a genuinely new turn to confirm normal appending still works.

**What this round adds to the pattern.** All three are the SAME shape as
every prior incident in this file this week — a mechanism whose coverage is
narrower than its own intent, or state read at a moment when it is stale —
but reached, for the first time this session, through the CLIENT rather
than the server. The lesson generalizes: a fix proven only against the
backend leaves the browser-side half of the same feature unaudited, and
`useTutorSocket.ts`'s own existing test suite had a fixture (`FakeSocket`
defaulting to `readyState = OPEN`) that made an entire class of real,
reachable timing bug structurally invisible to every test in that file
until this review deliberately built a socket that starts CONNECTING.

## A learner stuck below the mastery floor had no guardrail at all — found live, testing as a struggling learner, closed 2026-08-30

**Found for the first time not by an adversarial code review, but by
actually playing the Tutor** — logged into a real, authenticated account,
answered a coin-counting activity, then replied "no entiendo" and "no sé" to
two of the tutor's own follow-up questions in a row, exactly as a struggling
child would.

Both times, the tutor discarded the question it had just asked and produced
a brand-new worked example with different numbers — once even switching the
underlying skill entirely (skip-counting by 5s to reach 30, to subtracting
coins) with no acknowledgment of the switch. Reproduced twice, deliberately,
against a fresh subtraction example the second time, to rule out a one-off.

**Root cause.** `controller.ts`'s "no sé" guardrail — added 2026-08-29 after
production transcripts showed the identical loop in SOCRATIC/FLUENCY (see
the entry above dated 2026-08-29 for the strategy-controller history) —
counts turns that produced no correct answer and degrades to FADED after
three of them. But the counter only incremented while the ACTIVE strategy
was SOCRATIC or FLUENCY, which only happens at ≥ 0.65 mastery. A new or
struggling learner starts in DIRECT or WORKED (< 0.65), and a conversational
"no sé" is a `conversation_turn` event, never a graded `activity_result` or
`voice_result` — so it never touches `consecutiveFailures` either. The
result: the ONE population the mandate exists to protect — a learner who
does not understand from the start — had no path to RESCUE at all. The
model was simply handed the same "teach one worked example" instruction
every turn and, with nothing telling it otherwise, taught a fresh one.

**Fix.** The no-progress counter now watches DIRECT, WORKED and FADED as
well as SOCRATIC and FLUENCY, and a new rule in `propose()` spends it on
RESCUE — at the same three-turn threshold the questioning bands already
use — specifically for those three strategies, since they have no lower
rung to degrade to the way SOCRATIC/FLUENCY degrade to FADED. `RESCUE`
already validates the difficulty and eases the next step; it did not need
inventing, only reaching. Existing behavior for SOCRATIC/FLUENCY is
untouched — `verify:pedagogy`'s "learner who answers 'no sé' and nothing
else" profile now reads one RESCUE mid-stall in FADED where it previously
stalled in FADED indefinitely once reached, and still shows no thrash and no
repeated rescue.

Proven with two permanent tests in `controller.test.ts` (a learner seeded at
WORKED-band and DIRECT-band mastery, given three consecutive
`conversation_turn` shrugs, asserting the third decision is `RESCUE` where
the prior two held strategy) plus a third confirming a learner still
answering correctly is never rescued. Confirmed to fail against the
pre-fix controller (`WORKED`/`DIRECT` returned on the third turn instead of
`RESCUE`) via `git stash` before being trusted.

**What this incident adds to the pattern.** Every prior guardrail fix this
week was found by an adversarial code review reading the controller from the
outside. This one required actually being the learner: the gap was not a
bug in the fixed code, it was the ORIGINAL fix's scope being narrower than
the defect it was named for — "a learner answering 'no sé' is never
assessed, so nothing in the controller could see them stuck" was true of
DIRECT and WORKED the whole time, and no test caught it because every
existing test seeded a learner already at or above the mastery band the fix
covered. A guardrail closed for one band is not closed for the bands below
it, and the only way that surfaces is trying the thing at the band nobody
tested.

## An eighth adversarial review: a stale grade response could paint over, and soft-lock, the segment that replaced it — closed 2026-08-30

**Found by an eighth independent adversarial code review**, this time
pointed at the remaining Tutor stage components, one CRITICAL finding in
`frontend/src/tutor/LiveSegmentPanel.tsx`.

`submit()` awaits `gradeSegment` and then unconditionally calls
`setVerdict`/`setXpAwarded` on whatever segment is currently rendered. The
server can legitimately replace an unanswered segment while that request is
still in flight — the tutor moved on before Core answered, exactly the shape
`ws/server.ts` is built to allow. When that happens, segment A's response
lands after segment B is already on screen, and `submit`'s own closure over
`live.segmentId` cannot tell: React re-creates `submit` with a fresh closure
when the prop changes, but the call already in flight keeps evaluating the
`live` object from the render it started in, which never mutates. The stale
verdict then paints over B's UI, and — because `isSegmentLocked` reads
`verdict?.correct` — a stale CORRECT verdict soft-locks B's inputs until the
segment changes again, on an activity the learner has not touched yet.

**Fix.** A ref (`liveSegmentIdRef`) is written on every render, independent
of which `submit` closure is running, so it always reflects the segment
actually on screen. `submit` captures the segment id it was called for
(`requestedSegmentId`) and compares it against the ref immediately after the
await, before any `setState` call; a mismatch means the tutor already moved
on, and the response is silently dropped — the segment-reset effect that
runs on every `live.segmentId` change has already put the new segment in a
clean state, so there is nothing to repair.

Proven with a permanent test (`LiveSegmentPanel.test.tsx`, new file) using a
minimal test-only registry entry rather than any of the 57 real exercise
renderers, since the property under test is the panel's own staleness guard,
not any specific renderer: a controlled, still-pending `gradeSegment` promise
is left in flight while the component re-renders with a different
`live.segmentId`, then resolved with a correct verdict. Asserts the new
segment shows no verdict banner, `onGraded` is never called, and its input
control is not disabled. Confirmed to fail against the pre-fix component —
the stale "Exactly right!" banner rendered over the new segment — via
`git stash` before being trusted. A second test confirms the ordinary,
non-stale path still applies the response normally. Full suite (1401 tests
across 118 files), lint, type-check and `i18n:check` all green.

**What this incident adds to the pattern.** The same shape as the seventh
review's findings — a mechanism whose correctness depends on a moment in
time rather than on current state — but this is the first fix in this file
proven by first reproducing the exact failure LIVE, in the browser, as a
real learner (the "no sé" guardrail gap in the entry above), then continuing
into a code-level adversarial pass rather than the other order. Neither
alone would have found everything this session did: the live session found
a pedagogical gap no unit test happened to probe for, and the adversarial
review found a client-side race no amount of playing the product by hand was
likely to trigger on demand, since it requires a grade response and a new
served segment to race in a specific order.

## The Tutor's daily XP cap could be exceeded by concurrency, and drained by replaying one grade — closed 2026-08-30

**Found by a twelfth adversarial review**, this time pointed at Core's
(`backend/`) tutor session lifecycle and XP crediting — a service that had
not had a dedicated round yet this session, every prior one having targeted
Oracle or the frontend client.

**Finding 1 (CRITICAL) — the daily XP cap was enforced by a non-atomic
read-then-write.** `POST /tutor/segments/:segmentId/grade` read "XP earned
today" via a plain `SELECT`/sum over `tutor_sessions.xp_awarded`, computed
`xp = min(baseXp, cap - earnedToday)` in application code, then wrote the
result through a separate, unconditional PATCH. Two concurrent grade
requests for the same learner — a fast learner clearing two segments
back-to-back, a client retry after a flaky connection, or two open tabs —
both read the same stale total before either write landed, so both
independently believed the full remaining budget was theirs and both spent
it. Reproduced: a session at 110/120 XP, two segments worth 20 XP each
graded concurrently, both awarded the full 10 XP remaining — 20 total
against a 10 XP budget.

The fix could not be an in-process lock: Core carries no documented
single-replica constraint the way Oracle deliberately does
(`oracle/AGENTS.md`), so a Node-level mutex would not hold under horizontal
scaling, and the cap spans every `tutor_sessions` row for a learner on a
given day — a span the codebase's existing "first write wins" pattern
(`closeTutorSession`'s `ended_at=is.null` conditional PATCH) cannot express,
because that pattern guards ONE row, not a multi-row aggregate. Fixed with
`award_tutor_xp` (migration `0055_atomic_tutor_xp.sql`): the read, the cap
arithmetic and the write happen inside ONE `SECURITY DEFINER` Postgres
function, serialized with `pg_advisory_xact_lock` keyed on the learner's own
id — correct under any number of Core replicas, since the lock lives in the
database rather than in a process. Verified against a real local Postgres
instance, sequentially (a session at 110/120 correctly awarded 10 then 0 on
repeat calls) and under genuine concurrency (two simultaneous `psql`
connections racing the identical call settled at exactly 10 + 0, never
exceeding the 120 cap) — before any application code was written against it.
`backend/src/routes/tutor.ts` now trusts whatever the function reports as
actually credited rather than computing its own capped amount, proven with a
test asserting the route stores and returns the RPC's number even when it
differs from what the route would have computed on its own.

**Finding 2 (HIGH) — grading the same segment more than once paid its XP
again each time.** The same route computed `xp` fresh from the current
score on every call, with no memory of what that exact segment had already
paid. Grading one 20-XP segment three times sequentially — no concurrency
needed, just a retried request or a trivial replay — paid 20 XP three times,
ending a session's total at 60 instead of 20. Fixed by capping each call's
award at `baseXp - row.xp_awarded` (both already on hand from
`getTutorSegment`), so a segment can never earn more than its own listed
worth no matter how many times it is graded — while a genuine second
attempt that IMPROVES on the first still earns the delta, since the cap is
against the segment's remaining worth, not against "has this been graded
before". Proven with a test seeding a segment already at 15 of 20 XP paid
and asserting a fresh full-score grade earns only the remaining 5.

**What this incident adds to the pattern.** Both findings share one root
cause: XP crediting was an application-level, non-transactional
read-then-write with no idempotency key, in a codebase that already has —
and already uses, on the very same table — the correct alternative (a
single conditional database operation). The general lesson for whoever
touches this next: a cap or running total that spans more than one row
cannot be made safe by careful code on the write side alone; the atomicity
has to move into the database, because no amount of discipline in Node
closes a race across two separate network round trips.

**A near-miss observed deploying this fix itself, worth a line for whoever
ships the next migration-plus-code pair.** `database CD` and `backend CD`
are two independent workflows with no ordering dependency between them
(each triggers on its OWN service's CI succeeding); on this deploy,
`backend CD` finished and went live at 03:58:12 UTC while `database CD` did
not apply migration `0055` (creating the `award_tutor_xp` function this same
commit's Core code calls) until 04:00:29 — a roughly two-minute window
where the new code's only path to crediting XP had nothing to call. The
route fails CLOSED in that state (`502 DATA_UNAVAILABLE`, per §1.14 — never
a silent zero), so the failure mode is "an activity briefly could not be
graded," not a wrong or lost credit; a live log check afterwards found no
occurrence, most likely because no XP-earning grade request happened to
land in that window, not because the risk was not real. Unlike the row-level
migrations this file has shipped before, this one is **not** safe on both
sides of the code — old code tolerates the new function existing early,
but new code does NOT tolerate the function existing late. Whenever a
migration and the code that calls it ship in the same commit and the code
introduces a NEW call the old code never made (an RPC, a new table), that
asymmetry is the thing to say out loud before pushing, and confirming the
migration has already applied before relying on the new code path is worth
the wait when the traffic pattern makes the window matter.

## The hands-free microphone could silently discard what a child said — closed 2026-08-30

**Found by adversarial review, round 10** (voice/turn-taking UX, a surface
no prior round this session had touched), HIGH severity, and confirmed by
building a harness that wired the real `useTutorSocket` + `useMicrophone` +
`useHandsFreeTurn` together and drove it with a real `MediaRecorder`.

`useHandsFreeTurn` opens the microphone once `speaking === false` and
`awaitingReply === false`. Both looked like the right gate, but they answer
two different questions than the one that actually matters: a tutor turn's
TEXT arrives in its own `turn` frame, clearing `awaitingReply` immediately,
while its VOICE — if any — follows later in a separate `turn_audio` frame
(split delivery, `/ORACLE.md` §6); `speaking` does not become true until
that second frame lands. In the real, wall-clock gap between those two
moments — the length of TTS synthesis, which can run seconds — both flags
read false, and the microphone opened right there. The harness confirmed
the worst case directly: 4000 real bytes of audio captured and streamed
into that gap, then the effect's own cleanup tore the recorder down via a
bare `mic.stop()` whose resolved clip was never passed to `onTurn` — no
frame, no signal, the learner's answer simply discarded the moment the real
audio arrived and closed the microphone.

The wire could not fix this on the client side alone: `audioUrl: null` on
the `turn` frame means two different things — "the voice is still coming"
on ordinary delivery, and "no voice is coming, ever" on a resume redraw
(replaying a clip the learner already heard reads as a stutter, so resume
deliberately sends no `turn_audio` at all). A client watching only
`audioUrl` cannot tell those apart, and treating every `null` as "coming"
would have held hands-free listening closed forever after any resume.

Fixed by naming the difference on the wire: the `turn` frame now carries
`audioPending` (true on ordinary delivery, false on a resume redraw, set at
both of `oracle/src/ws/server.ts`'s two `type: 'turn'` send sites), and the
client clears it locally the moment a matching `turn_audio` frame arrives.
`useHandsFreeTurn` gained `audioPending` as a fourth blocking condition
alongside `speaking`/`awaitingReply`/`enabled`; an explicit learner
interrupt still overrides it, matching how an interrupt already overrides
`speaking` — a learner who just cut the tutor off is not waiting on audio
nobody will hear.

Proven with permanent tests at both ends: `oracle/src/__tests__/live-session.test.ts`
asserts each send site's `audioPending` value against a real websocket
session; `frontend/src/tutor/__tests__/useHandsFreeTurn.test.tsx` asserts
the hook stays closed while `audioPending` is true with nothing else
blocking it, and opens the instant it clears without waiting for a new
turn. All four assertions confirmed to fail against the pre-fix code before
being trusted. Full suites green: oracle (429 tests), frontend (1403 tests).

**What this incident adds to the pattern.** The same shape as several
findings this session — a boolean whose name promised more than its
implementation delivered, and a `null` used to mean two genuinely different
things with nothing to tell them apart. The fix that closed the sibling
composer-vs-microphone race in this same hook (`/ORACLE.md` §4.2b) added a
gate for a channel this one did not know about; this one adds a gate for a
TIMING window the existing flags could not express, because they were never
built to answer "is this turn's own audio question settled yet" — only "is
the tutor currently speaking" and "is a reply currently in flight". A
boolean reused for a purpose slightly adjacent to the one it was named for
is where this class of defect keeps coming from.

## A parent-facing conversation showed roughly half its real length — closed 2026-08-30

**Found by adversarial review, round 11** (the learning map and past-
conversation replay), HIGH severity, and matching exactly what live manual
testing had separately noticed earlier the same day (a session shown as "5
líneas" replayed as "línea 2 de 10") without either side yet knowing why.

`oracle/src/tutor/orchestrator.ts`'s `turnCount` getter returns `this.seq` —
a counter incremented once per MODEL-PRODUCED tutor turn. `finish()` (and
the equivalent path for a session that finalizes unclaimed after a park)
reported this value as the session's `turnCount` to Core, which persists it
as `tutor_sessions.turn_count`. But the parent-facing "N líneas" list
(`frontend/src/tutor/SessionHistory.tsx`), the guardian's own transcript
page (`frontend/src/routes/app/family/KidTutorPage.tsx`, which labels the
number "messages" and renders exactly that many bubbles), and the resume
player's "line X of N" ribbon all count `tutor_turns` rows — one per
speaker, learner and tutor alike, from `ws/server.ts`'s separate
`transcriptSeq` counter. A 3-tutor-turn conversation (a greeting, a
learner line, a reply) is 3 rows in the transcript but only 2 in
`orchestrator.turnCount`; the review reproduced the exact "5 líneas / line
2 of 10" shape with a realistic 5-tutor/5-learner fixture (10 real rows,
`turnCount` reporting 5).

Fixed at both `closeSession()` call sites in `ws/server.ts` (the ordinary
`finish()` path and `finalizeParked()`'s unclaimed-park path): each now
passes the live/parked session's own `transcriptSeq` — the transcript's
true row count — instead of `orchestrator.turnCount`. `orchestrator.turnCount`
itself is untouched and still drives the in-session budget cap
(`session/budget.ts`'s `SESSION_MAX_TURNS`) and the live "state" frames sent
to the client during a conversation; only the value PERSISTED for a closed
session's display changed, because that is the only place a mismatch
reaches a parent.

Proven with a permanent test in `live-session.test.ts`: a resumed session
with a greeting, a learner line, a reply and a farewell (4 real transcript
rows, only 3 of them tutor-produced) asserts `closeSession`'s `turnCount`
equals `journal.turns.length` — the count the fake Core actually received
one row at a time — confirmed to fail against the pre-fix code (3 vs. the
correct 4) first.

**What this incident adds to the pattern.** The exact same class of defect
this file's own `transcriptSeq` comment already names for a DIFFERENT bug
in the SAME two counters — "the model-turn seq cannot simply be reused: it
counts MODEL CALLS... so the transcript gets its own monotonic counter" —
had a second, unrelated consumer reach for the wrong one of the two months
later, for a different purpose, because both counters are plausibly named
"turn count" and only one of them is a display of what actually happened
in the conversation. Two counters that answer genuinely different
questions need names that say so, not names that differ only in which file
they live in.

## The learning map could name an already-mastered skill as the reason a node is locked — closed 2026-08-30

**Found by the same adversarial review, round 11** (learning map and
past-conversation replay), MEDIUM severity.

`frontend/src/tutor/map/MapGraph.tsx`'s `prereqTitleOf` picked the FIRST
edge in `map.edges` pointing at a locked node and named that prerequisite
in the node's accessible label ("Opens after {{title}}"). The backend's
`prereqsMet` requires ALL of a node's prerequisites to clear the mastery
threshold (`deriveNodeState`, `tutorMap.ts`), so a node can have several,
and array order carries no meaning about which one is actually unmet. A
node with one mastered prerequisite and one that is not could name the
MASTERED one as the reason it is locked — a false statement about the
child's own progress, read out through the one field that exists
specifically to explain the lock rather than just enforce it.

Fixed by naming the LOWEST-mastery candidate among all of a node's
prerequisites instead of the first one in array order — the same rule
Oracle's own controller already uses for its backward-prerequisite walk
(`oracle/src/tutor/controller.ts`'s PROBE rule). A prerequisite with no
evidence at all (`mastery: null`) reads as the weakest of all, matching
that same walk's treatment of missing evidence.

Proven with two permanent tests (`MapGraph.test.tsx`, new file, since the
component had none): a locked node with one mastered and one unmet
prerequisite — the mastered one listed FIRST on purpose — asserts the
accessible name mentions the unmet one and not the mastered one; a second
test confirms a prerequisite with no mastery data at all outranks one with
some (however low) as the named blocker. Both confirmed to fail against
the pre-fix component first. Full frontend suite green (1405 tests).

## Push-to-talk gave the full "listening" ritual for a turn that was always going to be discarded — closed 2026-08-30

**Found by adversarial review, round 10** (voice/turn-taking UX), MEDIUM
severity — the last of that round's two findings, the first (hands-free
opening in the audio-pending gap) already closed above.

`MicOrb.tsx`'s `beginHold` gated on `available` (`state !== 'unavailable'`),
which is true for `'thinking'` — the tutor's reply is already being
produced. Holding the orb there started a real recording: the mic-open
sound played, haptics fired, the ambient bed ducked, a live level meter ran,
and on release the clip was sent. Unlike `'speaking'` — deliberately
interruptible, with its own `onInterrupt` call and its own test — nothing
in this path tells the server a turn is being cut short; `ws/server.ts`'s
one-turn-at-a-time claim correctly refuses the resulting submission
(`RATE_LIMITED`). So the behavior was never wrong in a way that doubled a
bill or broke a rule — it was a dead end a child could not tell was
dead until after living through the whole ritual for it.

Fixed with one added condition in `beginHold`: `state === 'thinking'` now
refuses the hold before it starts, the same way `recording` and
`holdingRef.current` already do. `available` itself is untouched, so the
orb keeps its own distinct `'thinking'` look (a spinner, not the dashed
"unavailable" ring) — only pressing it during that state stops doing
anything.

Proven with a permanent test (`MicOrb.test.tsx`) mirroring the existing
`'speaking'` case exactly, with the opposite expectation: the orb has no
`aria-disabled` (it still LOOKS pressable) and a `pointerdown` on it does
NOT call `microphone.start`. Confirmed to fail against the pre-fix
component first. Full frontend suite green (1406 tests).

## Investigated, NOT changed: a due review can outrank an unmet prerequisite on the learning map

**Found by adversarial review, round 11** (the learning map), rated
MEDIUM by the reviewer with an explicit caveat — "I verified the code path
that makes prerequisite regression possible but did not trigger it end-to-
end through a live BKT session" — and on investigation this session judged
it a genuine product-policy question rather than a confirmed bug, so
**no code was changed**.

`deriveNodeState` (`backend/src/services/pedagogy/tutorMap.ts`) checks
`reviewDue` before `prereqsMet`: a node whose spaced-review card is due
reports `'needs_review'` even if a prerequisite has since regressed below
`MASTERY_PREREQ_THRESHOLD` (a wrong answer's BKT update can lower a
prerequisite's `p_known` after the review card was scheduled).
`MapGraph.tsx`'s `startable` treats `'needs_review'` as tappable exactly
like `'available'`, so this node stays reachable rather than reverting to
`'locked'`.

**Why this was not simply reordered to check `prereqsMet` first.** Reading
the two states' actual meaning suggests the current order may be the
pedagogically CORRECT one, not an oversight: a spaced-review card exists
because the learner already demonstrated mastery of THIS skill once, and
spaced review is specifically for catching decay before it compounds. A
child who has since gotten rusty on an unrelated prerequisite has not
un-learned the dependent skill — locking them out of reviewing it because
a DIFFERENT skill decayed could deny exactly the practice that would
reinforce both. No design document (`ROADMAP.md`, `/ORACLE.md`) states an
intended priority between these two states, and the reviewer's own
end-to-end BKT session did not reproduce a case where the CURRENT order
produces a worse outcome than the reordered one would.

Changing this without that evidence risks trading a real, working feature
(reachable spaced review) for a state that "looks more consistent" but may
not actually serve the learner better — the same mistake this file has
called out in the other direction all session, just facing the other way.
Left open for an explicit product decision rather than guessed at; if
resolved, it belongs beside `deriveNodeState`'s existing tests
(`pedagogy-routes.test.ts`, "the learning map" describe block).

## A learner's real name could reach the third-party model as their "nickname" — closed 2026-08-30

**Found by adversarial review, round 15** (consent, preferences and
adaptation routes — a surface that had not had a dedicated round yet this
session), HIGH severity.

`PUT /tutor/preferences`'s nickname validation (`/^[\p{L}\p{N}][\p{L}\p{N}
'_-]*$/u`, shared by Core's route and Oracle's own `NicknameSchema`) is a
FORMAT guard: it excludes punctuation, digits-only strings and empty
input, nothing more. It allows spaces, so a clean two-word name with no
comma or period sailed straight through untouched — including the exact
reproduction the reviewer used: `nickname: 'Ana Vasquez'`, literally the
`display_name` of the test fixture already used throughout this file's
test suite. The existing rejection test (`'Ana Vasquez, Jr.'`) only ever
proved the comma and period were excluded; nothing checked whether a
CLEAN, punctuation-free nickname was actually the learner's own real name.
`nickname` is `/ORACLE.md` §4.1's own stated exception to "everything else
is forbidden" — "the only name-shaped value that may travel" into
DeepSeek/Qwen — which makes this a direct path for a minor's real name,
and specifically their surname, to reach a third-party API in violation of
§1.9.

Fixed at `PUT /tutor/preferences`, the only place both the submitted
nickname and the caller's real profile are available at once:
`looksLikeRealName` fetches the profile and rejects a nickname sharing any
word of three or more letters with `display_name`. Word-based rather than
whole-string on purpose — it catches a bare surname on its own (§1.9's own
named example of what must never leak) exactly as it catches the full
name, without also rejecting a nickname that happens to share an unrelated
short word with the real name by coincidence.

Proven with two permanent tests alongside the existing punctuation one: a
clean `'Ana Vasquez'` and a bare `'Vasquez'`, both matching the same test
fixture's `display_name`, are rejected; a control (`'Estrella'`, sharing
nothing with the real name) is still accepted. Both rejections confirmed
to fail against the pre-fix route (200, not 400) before being trusted.
Full backend suite green (626 tests), lint, type-check.

**What this incident adds to the pattern.** A regex that rejects malformed
input is not the same claim as a check that rejects the wrong VALUE — this
one was read as covering "is this a full name" when everything it actually
covered was "is this free of certain punctuation." The two claims share a
test that happened to pass for the narrower one, which is exactly how a
gap like this survives a code review: the existing test was genuinely
green, and proved less than its own name said it did.

## A tray demonstration froze after one coin the instant anything else on screen re-rendered — closed 2026-08-30

**Found by adversarial review, round 14** (the whiteboard and the tray
demonstration — neither had a dedicated round yet this session), HIGH
severity, and about as easily triggered as a defect gets: any composer
keystroke, any mic-level update, any unrelated sibling state change during
a demo's 5+ second, up-to-8-step run.

`frontend/src/tutor/ConversationView.tsx` builds the `demo` prop handed to
`LiveSegmentPanel` as a fresh object literal on every render (`{ seq:
turn.seq, steps: turn.demonstrate }`). `LiveSegmentPanel.tsx`'s demo effect
depended on that whole object. React compares effect dependencies by
reference, so a new object with the SAME `seq` and the SAME `steps` still
counted as "changed" — the effect's cleanup fired, aborting `runTrayDemo`
mid-loop, and the fresh setup then found `lastDemoSeq.current` already
equal to this `seq` (set synchronously the FIRST time the effect ran,
before the demo had even started moving) and refused to restart. The
tutor's hands moved exactly one coin — the loop's first `setPicked` call,
which runs before its first `await` — and froze there for the rest of the
turn, while the tutor's own narration kept describing steps that were
never going to happen on screen.

Fixed in `LiveSegmentPanel.tsx` by holding `demo`, `segment` and `verdict`
in refs and depending the effect on `demo?.seq` (a stable primitive)
instead of the object. `live.segmentId` (a stable string) was added as a
genuine second dependency — deliberately, not an oversight — so that when
the SEGMENT actually changes the effect still re-runs and aborts a demo
still mid-play, rather than letting it go on writing stale tray positions
into a different segment's draft. This is the same shape as the round-8
fix to this same file (a value read via a ref, checked against the CURRENT
segment before applying), applied to a second location for the same
underlying reason: a value handed down as a fresh object every render is
not a signal that the thing it describes actually changed.

Proven with a permanent test using fake timers: mounts a tray segment
without a demo (matching the real sequencing — a demo normally arrives on
a LATER render, after the segment is already on screen, not on the very
first mount, which would also trigger the unrelated `[live.segmentId]`
reset effect on the same commit), introduces a 2-step demo, confirms step
1 applies, then re-renders with a content-IDENTICAL but reference-DIFFERENT
`demo` object before the step delay elapses — and asserts the demo still
reaches step 2. Confirmed to fail against the pre-fix component first (the
demo stayed frozen at step 1 forever). Full frontend suite green (1407
tests), lint, type-check.

**A near-miss in building this test, worth naming.** The first version
introduced the demo on the panel's very FIRST render, which also fires the
segment-reset effect on that same mount and stomps the demo's first step
regardless of this fix — a false failure that would have looked like
confirmation of a defect that was actually a test-sequencing mistake. The
corrected version mounts without a demo first, then introduces it on a
LATER render, matching how it actually happens live.

## The guardian's tutor page: severity fetched and never shown, flags in the wrong order, an open session reported as empty — closed 2026-08-30

**Found by adversarial review, round 13** (the guardian-visibility surface
— `/family/:kidId/tutor` — a page that had not had a dedicated round yet
this session), three real findings, all in `KidTutorPage.tsx`.

**Finding 1 (MEDIUM) — a safety flag's `severity` was fetched and never
rendered.** The type, the API response and the file's own header comment
("the flag carries a category and a severity") all carried it; the JSX
only read `flag.category` and `flag.created_at`. A guardian reading the
one section this product exists to make sure they see had no way to tell
a `self_harm` flag from a `model_output_blocked` one apart from the
category label alone.

**Finding 2 (MEDIUM/HIGH, same root cause) — flags rendered in raw
`created_at DESC` order, not severity order.** `/AGENTS.md` §1.9 and this
file's own comment both say safety disclosures are "surfaced FIRST" — true
of the SECTION, never of what a parent sees first INSIDE it. A HIGH-severity
flag from days ago could render below a LOW-severity one from an hour ago.

**Finding 3 (LOW/MEDIUM, different root cause) — an in-progress session
always reported "0 messages".** `tutor_sessions.turn_count` defaults to 0
and is only written by `closeTutorSession()` at close; `summarizeSession()`
reads that column verbatim for open and closed sessions alike, and the
page had no branch for "still talking." A session with real turns already
in its transcript displayed a false "0 messages" to a parent while it was
still running.

Fixed together: safety flags are now sorted by severity (high → medium →
low, then most-recent-first within a tier) before rendering, each one
labelled with a new translated severity chip (`tutor.guardian.flagSeverity.*`,
all three locales); a session whose `endedAt` is still `null` shows
`tutor.guardian.ongoing` instead of computing a message count from a
column that has not been written yet.

Proven with a new test file (`KidTutorPage.test.tsx` — the page had none):
an older HIGH flag and a newer LOW flag assert the HIGH one renders first
with its "Urgent" label, the LOW one with "Low priority" second; an
in-progress session asserts "Still talking with the tutor" appears and "0
messages" does not; a closed session with real turns still reports the
real count. All three confirmed to fail against the pre-fix page first.
Full frontend suite green (1410 tests), lint, type-check, i18n:check.

## A reworded repeat two turns back slipped past the no-repeat checker — found live, testing as a struggling learner, closed 2026-08-30

Found live, not by a background review round: the same worked example
reappeared, reworded, two tutor turns after it was first taught — with a
correctly-untouched RESCUE turn (different numbers, legitimately new
teaching) sitting between the original and the repeat.

`echoesPreviousTurn` — the checker that catches a repeat reworded rather
than restated verbatim — only ever compared a candidate turn against
`lastTutorSaid`, the single immediately-preceding tutor line. The
intervening RESCUE turn is exactly the case the checker is right to leave
alone (a new problem is good teaching), but it also resets the pairwise
comparison, so a repeat sitting one turn further back than "the last one"
passed through untouched. This is the identical shape `repeatsAnAnnouncement`
was already built to fix, for announcing sentences specifically ("both
checks either side of this one miss it") — the general fix had just never
been generalized past that one category.

Fixed with a new `echoesEarlierTurn` in `oracle/src/tutor/prompt.ts`, which
runs `echoesPreviousTurn`'s same word-overlap-plus-matching-numbers test
against every earlier tutor line in the session, not just the last one.
`orchestrator.ts`'s repeat-detection chain now tries
`repeatsEarlierSentence` → `repeatsAnAnnouncement` → `echoesEarlierTurn` in
order, dropping the `lastTutorSaid`-only special case entirely.

Proven with a new permanent test in `orchestrator.test.ts` ("repairs a
REWORDED repeat from several turns back, not just the last one"), modeled
on the file's existing single-turn-back reworded-repeat test but with a
genuinely different-numbered turn inserted between the original and its
echo. Confirmed to fail against the pre-fix checker chain, pass against the
fix. Full oracle suite green, lint, type-check (all three tsconfigs),
`verify:pedagogy`.

## An adaptation could be accepted without ever being offered — found by adversarial review, closed 2026-08-30

Found by adversarial review, round 15 (MEDIUM): `applyAdaptation` — the one
method the WS `adaptation_response` handler calls to record a learner's
acceptance — applied whatever value the client sent, with no check that
the tutor's own last turn had actually offered it, or offered anything at
all. `/ORACLE.md` §11 states the invariant in words ("offered, never
imposed"); nothing in code enforced it. A stray, replayed, or
hand-crafted `adaptation_response` frame could silently steer every
subsequent turn toward an adaptation the learner never agreed to, or
re-apply an already-consumed acceptance a second time.

Fixed by giving the orchestrator a `lastOfferedAdaptation` field, written
at the two places every tutor turn already funnels through: `produce()`
records `turn.offerAdaptation` after every model-produced turn, and
`scriptedOutcome()` clears it after every scripted one (a scripted turn
never carries a fresh offer). `applyAdaptation` now compares the accepted
value against `lastOfferedAdaptation` and is a no-op on any mismatch —
nothing offered, or a different adaptation than the one offered — and
consumes the offer on a genuine match, so a second acceptance of the same,
now-stale offer is also refused.

Proven with three new tests in `orchestrator.test.ts`: an acceptance with
nothing ever offered, an acceptance naming a different adaptation than the
one just offered, and a replayed acceptance of an offer already consumed
by an intervening turn — all three confirmed to apply the adaptation
against the pre-fix code (the actual defect) and correctly refuse it
against the fix. The pre-existing "applies an adaptation only once the
learner accepts it" test was rewritten to first let a real model-produced
turn record a genuine offer before accepting it, matching the new,
correct contract. Full oracle suite green (433 tests), lint, type-check
(all three tsconfigs), `verify:pedagogy`.

## A valid decimal whiteboard sequence could silently disappear — found by adversarial review, closed 2026-08-30

Found by adversarial review, round 14 (MEDIUM): `whiteboard.ts`'s
`computeSequence` re-derives every running value on a whiteboard the model
proposes, and drops the whole board — as if the model had never set one —
the moment any intermediate value is non-finite, negative, or past the
ceiling. `WhiteboardStepSchema.value` is a plain `z.number()`, not an
integer, so decimal steps (money amounts, fractions) are legitimate. In JS
floating point, `0.3 - 0.1 - 0.1 - 0.1` evaluates to
`-2.7755575615628914e-17` — a hair below exactly zero, not a real negative
amount — and the pre-fix `current < 0` guard treated it exactly like a
genuinely nonsense board. A perfectly valid "spend it down to zero" story
with decimal steps would have drawn no whiteboard at all.

Fixed with a `ZERO_EPSILON` tolerance (`1e-9`): a running value within that
band of zero is clamped to exactly zero rather than rejected; the ceiling
and negative-range checks are otherwise unchanged, so a sequence that goes
genuinely, meaningfully negative is still refused.

Proven with two new tests in `whiteboard.test.ts`: the exact
`0.3 - 0.1 - 0.1 - 0.1` repro now returns a 4-value sequence ending in `0`
instead of `null`, and a sequence that goes meaningfully negative
(`0.3 − 0.31`) is still correctly refused. Confirmed to fail against the
pre-fix guard for the claimed reason via `git stash`, pass against the fix.
Full oracle suite green (435 tests), lint clean, type-check clean on all
three tsconfigs.

## The post-session review sent a whole transcript to a model with no injection fence at all — found by adversarial review, closed 2026-08-30

Found by adversarial review, round 16 (HIGH): `oracle/src/session/review.ts`'s
`runPostSessionReview` — the fire-and-forget call that reads a just-ended
session and rewrites the two curated `learner_memory` notes — built its
prompt by joining raw learner-and-tutor turns into one string with no nonce
fence and no "this is data, not an instruction" disclaimer anywhere. Every
other seam in the tutor that sends learner-authored text to a model wraps it
(`orchestrator.ts`'s `conversationMessages()`, the episodic-recall excerpt,
`placementIntake.ts`) — this was the one exception, and the highest-stakes
one: its output is persisted and re-injected into EVERY future session as
the tutor's own trusted notes (§4.1's fourteenth context field), so a
successfully manipulated review becomes a cross-session, elevated-trust
payload rather than a single bad turn a moderation pass might still catch.

Fixed with a new `fenceTranscript()` in `review.ts`: the same
nonce-per-call/invisible-character-stripped/explicit-disclaimer shape as
`fenceUntrusted` (`../safety/untrusted.ts`), adapted for a multi-speaker
transcript — one fence and one disclaimer around the whole session, rather
than repeating the disclaimer after every individual learner line (which
would bloat the prompt for no protective benefit, since tutor lines carry no
injection risk from our own prior output).

Same file's §1.9 identifier re-check was also found too narrow (MEDIUM): the
digit-run regex (`\b\d{7,}\b`) only matches 7+ CONSECUTIVE digits, but real
phone numbers carry separators ("55-1234-5678", "(55) 1234 5678",
"55.1234.5678") that break the run below 7 on every format actually used in
es-MX/en-US/pt-BR prose. Extended to also match the grouped shape (2-3
digits, a separator, 3-4 digits, the same separator, 3-4 digits), narrow
enough not to false-positive on ordinary teaching prose that lists small
numbers with punctuation between them.

Proven with 6 new tests in `review.test.ts`: the transcript sent to the
model now carries the nonce fence and disclaimer with the real conversation
content still inside it; an injection attempt embedded in a learner turn is
confirmed to land INSIDE the fence rather than passing through raw; all
three phone-number-with-separator formats are confirmed dropped whole; and
a control test confirms ordinary numbered teaching prose is NOT
false-positived. All 5 fence/regex-dependent tests confirmed to fail against
the pre-fix code for the claimed reason via `git stash`, pass against the
fix. Full oracle suite green (441 tests), lint clean, type-check clean on
all three tsconfigs.

## An announced activity raised the lesson sheet while the keyboard still covered the screen — found by adversarial review, closed 2026-08-30

Found by adversarial review, round 16 (HIGH): `ConversationView.tsx`'s two
"the tutor just promised this out loud" effects — one for an announced
segment (`turn.next === 'segment'`), one for a live whiteboard turn — raised
the lesson sheet from PEEK to HALF unconditionally the moment either
arrived. An ordinary sequence broke this: a learner sends a message and the
reply announces a practice activity before they have dismissed the soft
keyboard, and the sheet rose to HALF while the keyboard was STILL covering
the bottom of the screen — exactly the overlap the file's own
keyboard-borrow mechanism (a few effects above) exists to prevent, defeated
by a sibling effect that never checked whether the keyboard's loan was still
outstanding.

Fixed by consulting `SafeAreaContext`'s `keyboardOpenRef` (already exposed,
just not read by these two effects) before raising the sheet: while the
keyboard is open, the raise is deferred into the same `borrowedDetentRef`
the keyboard-close handler already restores from, so it takes effect the
moment the keyboard actually closes rather than while it is still covering
the screen. The keyboard-open/close mechanism itself was untouched.

Proven with a new test in `ConversationView.test.tsx`: keyboard opens while
the sheet rests at PEEK, an announced segment arrives via `rerender`, the
sheet is asserted to STILL be at PEEK (88px) while the keyboard remains
open, then the keyboard closes and the sheet is asserted to have risen.
Confirmed to fail against the pre-fix effects (sheet incorrectly rose to
346px while the keyboard was still open) via `git stash`, pass against the
fix. Full frontend suite green (1411 tests), lint clean, type-check clean,
i18n:check clean.

**Not yet closed from the same review round (MEDIUM/HIGH, visual
confirmation blocked):** the desktop caption's docking condition
(`ConversationView.tsx`) only activates `docked: 'panel'` when
`socket.segment !== null || turn?.whiteboard != null` — but the desktop
lesson panel (`LessonPlate.tsx`) is a permanent fixture regardless of
content, and `SpeechCaption.tsx`'s own comment says its escape budget is
"unbeatable against a full-height docked panel" full stop, not only while
an exercise is open. On desktop with no segment/whiteboard active (ordinary
back-and-forth chat, plausibly the majority of desktop conversation time),
`docked` computes to `null` and the caption falls back to the anchored/escape
mode the same comment says cannot win against this panel. Neither the unit
suite (`window.matchMedia` is unpolyfilled in jsdom, so no test exercises
`desktop` mode at all) nor the live `verify-tutor-ui.mjs` gate (its default
lab fixture always has a segment active) covers "plain conversation, no
exercise open, desktop" — flagged for a human visual check at 1280px before
treating it as either confirmed or closed.

## A session ended by a dropped connection never got a post-session review — found by adversarial review, closed 2026-08-30

Found by adversarial review, round 16 (MEDIUM): `oracle/src/ws/server.ts`
closes a session two different ways — `finish()` for a graceful
farewell/budget/safety close, and `finalizeParked()` for a session parked
after a dropped connection whose grace window then passes with nobody
resuming (a sleeping phone, a proxy timeout, a stairwell — exactly what
parking exists to survive). Only `finish()` called
`runPostSessionReview`, the V4 fire-and-forget call that rewrites the
`learner_memory` stores from the conversation that just ended. The park
path is not an edge case for this product's actual users — plausibly a
large share of real sessions with young children on phones end exactly
this way — and every one of them silently taught the memory system
nothing: no error, no log line, indistinguishable from a session with
nothing durable to write.

Fixed by calling `runPostSessionReview` from `finalizeParked` too, the
same fire-and-forget shape `finish()` already uses. This needed a new
`sessionContext` getter on `TutorOrchestrator` (`oracle/src/tutor/
orchestrator.ts`), since a parked entry (`ParkedSession`) keeps only the
orchestrator and a few scalars, not a live `Live.session` — the same
established pattern as the file's other read-only getters
(`resumeSnapshot`, `turnCount`, `servedSegments`).

Proven with a new end-to-end test in `live-session.test.ts`: a real
WebSocket session takes two real learner turns (clearing the review's own
`learnerTurns < 2` floor), is dropped without a farewell, and once the
grace window passes, the review's own distinctive system-prompt text
("reflection pass") is confirmed present in the fake model server's
received request bodies — proof the review actually ran through the park
path, without needing Core's fake (which has no learner-memory route) to
record anything. Confirmed to fail against the pre-fix `finalizeParked`
for the claimed reason via `git stash`, pass against the fix. Full oracle
suite green (442 tests), lint clean, type-check clean on all three
tsconfigs, `verify:pedagogy` green.

## A failed repair for a REPEATED sentence delivered the repeat itself, verbatim — found live, closed 2026-08-30

Found live, testing as a struggling learner, running a fixed-and-working
local `tutor:converse` for the first time this session (moderation and the
model were both misconfigured locally before that — see the local-env
notes elsewhere in this session's work): the real conversational harness's
own transcript review flagged "turn 8 repeats turn 7 with nothing changed
(91% of its words)". A temporary debug trace inserted at the exact
repeat-check computation in `orchestrator.ts`'s `produce()` confirmed the
mechanism precisely — this was NOT a missed detection:

- Attempt 0 of the candidate that became the repeated turn was correctly
  flagged (`repeated` was non-null, an exact sentence match via
  `repeatsEarlierSentence`).
- The retry this correctly triggered (attempt 1) came back an empty
  completion — a measured, common DeepSeek failure mode this codebase has
  its own tracked history for, not a rare edge case.
- The existing fallback — "a clumsy real sentence beats a scripted
  apology," added deliberately so a failed repair costs the improvement
  rather than the whole turn — then delivered `repairable` (attempt 0's
  turn) exactly as flagged: the repeat itself, verbatim, to a child who had
  just said "ya entendí, dame otro" (I get it now, give me another).

The fallback rule is right for MOST repair reasons (a vocabulary slip, a
self-answered question, an unkept promise) because the delivered turn is
imperfect but still teaches something new. It is wrong specifically for a
repeat, because delivering the flagged original reproduces the EXACT
defect the check exists to catch, with certainty, rather than merely
degrading quality. (Also wrong for false praise/false correction — see the
later entry below; this line originally listed false praise as safe, which
turned out not to be true.)

Fixed by tracking `repairableIsRepeat` alongside `repairable` in
`orchestrator.ts`: when the repair that failed was specifically for a
repeat, the fallback now delivers the scripted line instead of the
flagged repeat. Every other repair reason is unchanged — the "clumsy real
sentence" rule still applies to them.

Proven with two tests in `orchestrator.test.ts`: the pre-existing test for
this fallback (which had asserted the OLD, now-wrong behavior) was
rewritten to use a self-answered-question repair instead of a repeat, so
it still proves the "clumsy original beats scripted apology" rule holds
for non-repeat reasons; a new test proves that when the failed repair WAS
a repeat, the outcome is now `source: 'scripted'`, never the repeated
text. Confirmed to fail against the pre-fix fallback for the claimed
reason via `git stash`, pass against the fix. Full oracle suite green
(443 tests), lint clean, type-check clean on all three tsconfigs,
`verify:pedagogy` green, and independently re-verified against the real
`tutor:converse` harness: the exact log sequence that produced the live
defect now ends in `[oracle] repair attempt for a repeated sentence
failed — scripted line instead of delivering the repeat` followed by the
scripted "Se me enredaron las ideas" line, never the repeat.

## A self-harm disclosure during placement intake was indistinguishable from Oracle simply being down — found by adversarial review, closed 2026-08-30

Found by adversarial review, round 17 (HIGH): `oracle/src/tutor/
placementIntake.ts`'s `runPlacementIntake` correctly classifies the
learner's own text before it reaches the model (a fix from 2026-08-29) and
refuses to send a flagged utterance — but the refusal landed on the exact
same neutral `PlacementIntakeResult` an ordinary Oracle outage produces:
`{priorFraction: 0.3, reflection, source: 'fallback'}`, with nothing
distinguishing "the model was unreachable" from "the learner just
disclosed self-harm." This is the FIRST exchange a learner has with the
Tutor system, precisely the moment the least is known about them, and it
produced no signal ANYWHERE — no category, no severity, nothing a caller
could log, act on, or eventually show a guardian.

Fixed by adding `PlacementIntakeResult.flagged: {category, severity} |
null`, set only when the fallback was reached via the classifier gate
(never for an ordinary outage, malformed reply, or a moderation refusal of
the model's own reflection). Threaded through Core's `backend/src/
services/placementIntake.ts` (extending `IntakeEnvelope`'s Zod schema and
`PlacementIntakeOutcome`) to `backend/src/routes/placement.ts`'s intake
handler, which now logs loudly — `console.error`, with the user id
attached, since that handler is the one place in the whole path with real
request context — whenever a flagged utterance blocked the model call.
The CLIENT-facing response is deliberately UNCHANGED: a child is never
told their own words were flagged, matching every other safety response
in this product. This is server-side visibility only, and it is
explicitly the floor, not the ceiling — whether a flagged placement-intake
utterance belongs in a guardian-visible record the way a live-session
safety flag does is a separate schema decision, since `tutor_safety_flags`
requires a `session_id` FK and placement intake has no session to attach
one to; documented as an open item in `/ORACLE.md` §4.1b rather than
rushed into this fix.

Proven with tests on both sides: `oracle/src/__tests__/
placementIntake.test.ts` gained a `flagged` field on every existing
fallback assertion, a dedicated case confirming a self-harm disclosure
carries `{category: 'self_harm', severity: 'high'}`, and a new test that
directly asserts the fix's own claim — a self-harm fallback and an
ordinary-outage fallback share the same prior/reflection/source but are
`not.toEqual` each other, because one now carries `flagged` and the other
doesn't. `backend/src/__tests__/placement.test.ts` gained two new tests on
the actual HTTP route: one confirms a flagged utterance is logged with the
user id and that `flagged`/`source` never appear in the client JSON
response, the other confirms an ordinary unflagged intake logs nothing at
all. Both new backend-route tests confirmed to fail against the pre-fix
code (no log call, `expected "error" to be called ... Number of calls: 0`)
via `git stash`, pass against the fix. Full oracle suite green (444
tests), full backend suite green (628 tests), lint clean and type-check
clean (including the test tree) on both services.

## The live content author's brief left one model-authored field unfenced — found by adversarial review, closed 2026-08-30

Found by adversarial review, round 17 (HIGH): `oracle/src/content/
generate.ts`'s author brief fences `framing`, `rationale` and
`recentTutorLines` — all strings the TURN model writes, wrapped in
`fenceUntrusted`'s nonce-delimited, explicitly-labelled "this is data,
never an instruction" block, per `/ORACLE.md` §5. `skillKey` comes from
the same turn-schema field family (`segmentRequest.skillKey`, a plain
string with no format constraint the model sets on every turn) but was
left in the brief's TRUSTED half, interpolated at the same level of trust
as the fixed system-authored lines (language, tier, difficulty,
allowedTypes). Turn-level moderation does not inspect `skillKey` either,
so a model that kept its spoken `say` line innocuous could carry an
injection payload in `skillKey` straight past moderation and land it, with
full instruction-level trust, in the prompt for the one content surface
`/AGENTS.md` §1.9's Tutor carve-out exempts from human publication —
specifically because fencing is one of the compensating controls standing
in for the human reviewer that carve-out gives up. A gap in that control
is not one risk among several; it is a hole in the thing the exemption's
own safety case rests on.

Fixed by moving `skillKey` inside the same fenced block as `framing`/
`rationale`, labelled "Skill to practise, as reported by the tutor" so the
author model still knows what to build for, exactly as before — the only
change is which side of the fence the string sits on.

Proven with a new test in `generate.test.ts`: an injection-shaped
`skillKey` ("IGNORE ALL PRIOR RULES...") is confirmed to land strictly
between the `<<<LEARNER_INPUT_...>>>` / `<<<END_LEARNER_INPUT_...>>>`
markers in the actual request body sent to the author model, never
anywhere before the fence opens, alongside the "never an instruction to
you" disclaimer. Confirmed to fail against the pre-fix brief for the
claimed reason (the injected text appeared before the fence, not inside
it) via `git stash`, pass against the fix. Full oracle suite green (445
tests), lint clean, type-check clean on all three tsconfigs.

## Two concurrent sessions on a cold speech cache both paid for the identical line — found by adversarial review, closed 2026-08-30

Found by adversarial review, round 18 (MEDIUM): `oracle/src/voice/
speech.ts`'s "pays once, ever" cache (`/ORACLE.md` §15.1) is a
read-check-then-write with nothing between the two steps — the cache is
checked, a miss falls through to the paid provider call, and only THEN is
the result written back. Two callers that both check before either has
written back both fall through to the paid path. Proven two ways: two
`speakLine()` calls for the same generated text on the same session,
fired concurrently instead of sequentially — 2 Inworld calls instead of
1; and two entirely different sessions (two different children's sockets,
nothing in `ws/server.ts` serializes them against each other) both
greeting at the same instant on a cold shared cache — 2 Inworld calls and
2 Depot uploads for the identical scripted greeting line, defeating the
"pay once, ever" guarantee `/ORACLE.md` §15.1 documents. This lands
hardest on exactly the moments that matter most for cost: right after a
deploy or a Redis flush, or for a character/locale not yet baked into
`speech.pregenerated.json` — precisely when many sessions start and greet
concurrently.

Fixed with in-flight promise coalescing in `speech.ts`: a second caller
for the identical cache key while a synthesis is already running now
AWAITS the first caller's in-flight promise instead of starting a second
paid call, and reports its own `billedChars` as zero — only the caller
that actually triggered the spend is billed for it. Scoped to match the
existing privacy split between the two caches exactly: a module-level map
for the shared/scripted cache (correct because Oracle runs as a single
replica, unlike Core, so a process-level map already covers every session
that could actually race on one instance), and a new field on
`SpeechScope` (alongside the pre-existing `memo`) for session-scoped
generated lines, so the coalescing for non-shareable text never crosses
the same session boundary the cache itself already enforces.

Also noted, not fixed here (LOW, no proven financial loss): `withTimeout`
(`oracle/src/lib/http.ts`), used by the Inworld provider's `transcribe`/
`synthesize` calls, races the caller's promise against a timeout but never
passes an `AbortSignal` into the underlying `fetch`. When our client-side
timeout wins, the outbound request to Inworld keeps running in the
background and may still complete (and potentially be billed) on the
provider's side, invisible to our own cost ledger. Flagged for a
follow-up, not rushed into this fix since verifying it as an actual
overspend would need visibility into Inworld's own billing semantics for
an abandoned response, which this codebase does not have.

Proven with two new tests in `speech.test.ts`, both firing genuinely
concurrent `speakLine()` calls via `Promise.all` rather than sequentially:
one for the same-session generated-line case, one for the cross-session
shared-cache case (reusing the existing Redis-mock harness). Both
confirmed to fail against the pre-fix code for the claimed reason (both
calls independently reported `source: 'synthesized'`, 2 TTS calls) via
`git stash`, pass against the fix. Full oracle suite green (447 tests),
lint clean, type-check clean on all three tsconfigs.

## A client-side timeout on an Inworld call did not cancel the request — found by adversarial review, closed 2026-08-30

Found by adversarial review, round 18 (LOW) and closed as a same-day
follow-up: `oracle/src/lib/http.ts`'s `withTimeout` races an
ALREADY-STARTED promise against a timer — the `fetch()` call it wraps has
already been invoked by the time `withTimeout` sees it, so on our own
timeout it can only stop WAITING on the request, not cancel it. The
underlying HTTP request to Inworld kept running in the background and
could still complete — and potentially be billed — on the provider's
side, invisible to our own cost ledger. Not provable as an actual
overspend (this codebase has no visibility into Inworld's server-side
billing semantics for an abandoned response), so it was reported and
closed as a verified code fact rather than a proven financial loss.

Fixed by passing `signal: AbortSignal.timeout(config.VOICE_TIMEOUT_MS)`
directly into the `fetch()` call at all three Inworld call sites in
`oracle/src/voice/inworld.ts` — `transcribe`, `synthesize`, and the
offline `cloneVoice` script helper (120s timeout). `withTimeout` itself is
unchanged and still provides the labeled error message
("inworld speech-to-text timed out after Xms") on the rare case its own
race wins; the `signal` is what actually cancels the request at the
network layer the moment the timeout fires.

Proven with two new tests in `voice.test.ts` (one for `transcribe`, one
for `synthesize`): both assert the `fetch` mock was called with a `signal`
that is a real `AbortSignal` instance, not merely present in the request
init but of the wrong type. Confirmed to fail against the pre-fix code for
the claimed reason (`expected undefined to be an instance of AbortSignal`
— no `signal` property was ever passed) via `git stash`, pass against the
fix. Full oracle suite green (449 tests), lint clean, type-check clean on
all three tsconfigs.

## A revoked minor's CURRENT-turn audio still reached the STT provider — found by adversarial review, closed 2026-08-30

Found by adversarial review, round 19 (HIGH): `/ORACLE.md` §4.3 promises a
guardian that revoking voice consent takes effect on the NEXT turn, backed
by a per-turn recheck (`CONSENT_RECHECK_MINOR_MIC_TURNS = 1` — every turn,
for exactly this population). That recheck lived only inside
`handleLearnerTurn`, which for a MICROPHONE turn is only ever called AFTER
`transcribe()` has already shipped the current turn's audio to the
third-party STT provider. No recheck cadence, however tight, can
retroactively un-send audio that already left — this was not the rare
race the "every turn" cadence exists to close, but a 100%-reproducible
structural gap one level up from it: a guardian revoking DURING a child's
hands-free turn had that turn's audio reach the provider EVERY TIME, with
the recheck only ever managing to close the mic for the turn AFTER.

Fixed by extracting the recheck logic into two functions —
`dueForMicConsentRecheck` (the cadence predicate, unchanged) and
`refreshMicConsent` (performs the check, mutates `live.microphone`, sends
`CONSENT_REVOKED`) — and calling `refreshMicConsent` from `handleAudioClip`
itself, BEFORE `transcribe()` is ever invoked. `handleLearnerTurn` now
accepts a `micConsentAlreadyChecked` option and skips its own check when
set, so a microphone turn still costs exactly one consent round trip to
Core, not two; a text-based turn (`micConsentAlreadyChecked` unset) is
unaffected and still gets the check exactly where it always has. A
residual race remains — consent revoked WHILE `transcribe()`'s own network
call is already in flight — but that window is now bounded by one STT
round trip rather than an entire session, and closing it further would
mean cancelling an in-flight third-party call in real time, out of scope
for this fix.

Proven with a new end-to-end test in `hardening.test.ts`, driving a real
WebSocket against fake Core/model/voice upstreams (the same harness the
2026-08-23 security-audit regressions in this file already use): one
ordinary turn establishes `turnCount > 0`, the fake Core then answers
`{active: false}` for consent, and a `learner_audio` frame is sent. The
decisive assertion is `counts.stt` — the number of times the fake STT
server was actually invoked — which must be `0`. Confirmed to fail against
the pre-fix code for the claimed reason (`expected 1 to be +0` — the STT
provider WAS called before the revocation was ever noticed) via
`git stash`, pass against the fix. Also fixed, in the same commit: a
code comment introduced by this fix named the voice provider
("Inworld") outside `oracle/src/voice/`, violating the architectural
boundary `boundaries.test.ts` enforces (`/AGENTS.md` §1.2 — the provider
is explicitly interim and nothing above the adapter may know its name);
caught immediately by the full suite and reworded to "the provider"
before committing. Full oracle suite green (450 tests), lint clean,
type-check clean on all three tsconfigs, `verify:tutor` green.

## Revoking voice consent stopped sending audio but left the browser's mic indicator lit — found by adversarial review, closed 2026-08-30

Found by adversarial review, round 20 (MEDIUM) — the frontend half of
round 19's HIGH backend finding (a revoked minor's in-flight audio still
reaching the STT provider, closed the same day). `frontend/src/tutor/
useMicrophone.ts`'s `stop()` deliberately keeps the browser's
`MediaStream` open between push-to-talk holds, so a repeated press does
not re-prompt for microphone permission — and `release()`, the only
function that actually stops the hardware tracks, used to run only on
unmount. A guardian's one-press revoke (`/ORACLE.md` §4.3, "revocation
must always be easier than granting") flips the hook's `enabled` prop
false in the SAME `TutorExperience` component instance, since the tutor
deliberately keeps running in text-and-choices mode rather than
unmounting. No audio actually leaked — `start()` already refuses any new
recording while `!enabled`, and the round-19 fix means the socket refuses
it too — but the browser's own mic-in-use indicator stayed lit for the
rest of the conversation, which breaks the trust a guardian places in
that indicator the moment they press "off."

Fixed with a second `useEffect` in `useMicrophone` that calls `release()`
whenever `enabled` transitions to false, alongside the pre-existing
release-on-unmount effect. `release()` is idempotent (`streamRef.current`
is null if nothing was ever recording), so this is safe to fire on mount
too when `enabled` starts false.

Proven with a new test in `useMicrophone.test.tsx`: `enabled` starts
`true`, a hold is started and stopped (confirming the stream is
intentionally still warm — `stoppedTracks` does NOT yet contain `'audio'`,
the precondition the test actually exercises), then `rerender({enabled:
false})` simulates the consent-revocation transition and asserts
`stoppedTracks` now DOES contain `'audio'`. Confirmed to fail against the
pre-fix hook for the claimed reason (`expected [] to include 'audio'`) via
`git stash`, pass against the fix. Full frontend suite green (1412
tests), lint clean, type-check clean, i18n:check clean.

## Ordinary counting content was blocked as a "phone number" — found live, testing as a struggling learner, closed 2026-08-30

Found live, running a fresh `tutor:converse` pass after this window's
other fixes (MEDIUM): the tutor's own reply to "¿cómo se da el cambio
contando hacia arriba?" (how do you give change counting up) — exactly
the FADED-strategy scenario built to test this — got blocked by
`deterministicModeration`'s `contact_detail` check and replaced with a
generic "let me say that differently" scripted line. The old pattern,
`\b\+?\d[\d\s().-]{8,}\b`, matches ANY 9+ characters of
digits/spaces/parens/dots/hyphens — which is exactly what a counting
sequence or a price breakdown looks like in a MONEY tutor: "Empiezas en 6
y vas sumando: 6 7 8 9 10" and "Contamos hacia atrás: 10 9 8 7 6 5 4 3 2
1" both matched, both entirely ordinary teaching content, neither
carrying any actual contact detail.

A real phone number's digits are GROUPED into 2-4-digit chunks (an area
code, an exchange, a line number); a spoken counting sequence is a run of
ISOLATED single- or double-digit numbers, and this tutor's own tier rules
already keep every number under 100 — a bare 3+ digit group essentially
never appears in legitimate content at all. Fixed by requiring the
pattern to have three groups, the middle and last each 3-4 digits
(`\b\+?\d{2,4}[\s().-]{0,3}\d{3,4}[\s().-]{0,3}\d{3,4}\b`) — the shape a
real phone number actually has and a counting sequence never does.

Ratcheted into `oracle/src/safety/canary.ts`'s `BENIGN_OUTPUT` corpus
(per the file's own header comment: "every real injection or safety miss
found in the wild gets added... and from then on it cannot come back
without turning this file red") with the exact two sentences the live run
produced and had blocked. Verified the narrower pattern loses no real
detection: the pre-existing `emits-phone` canary
("+52 55 1234 5678") and the invisible-character-defeat test (a phone
number with zero-width spaces planted between its groups, which
`stripInvisible` collapses to a bare 10-digit run before the pattern
runs) both still correctly match and remain blocked. Confirmed the two
new canary entries fail against the pre-fix pattern for the claimed
reason via `git stash`, pass against the fix. Full oracle suite green
(452 tests), lint clean, type-check clean on all three tsconfigs,
`verify:tutor` and `verify:pedagogy` green, and independently
re-verified against a fresh `tutor:converse` run: the exact scenario
that produced the live defect now delivers the real teaching turn
instead of the scripted fallback.

## The learning map went stale after the ordinary end of a session, and only the mid-conversation restart refreshed it — closed 2026-08-30

Found by adversarial review, round 21 (the learning map — a surface that
had not had a dedicated round yet this session, though `MapGraph.tsx`
carried one prior fix from round 11), HIGH severity.

`frontend/src/tutor/TutorExperience.tsx`'s mid-conversation "start over"
button (`onRestart`) explicitly refetched both `getOffers` and `getMap`
after ending a session, with its own comment explaining why: "the session
that just ended changed mastery." But the ORDINARY way a session ends —
the "Finish" button (`onExit`, which only calls `socket.endSession()` and
sets `phase = 'closing'`) followed by `ClosingInWorld`'s "Start Another"
button (`onStartAnother`), or the socket simply closing on its own and
landing on the same closing screen — never refetched anything at all.
Since `mapOpen` gates the whole map view on `phase === 'introducing'`, a
learner who just finished a session that graded activities — moving a
KC's mastery, resolving a due review, unlocking a dependent node — was
shown a map still drawn from BEFORE the session: a just-mastered node
still shown merely in-progress, a just-unlocked node still drawn locked
against a prerequisite that no longer applies, a stale review count. No
error, no warning — confidently wrong state shown to a child relying on
the map to know what to do next, and "Finish → Start Another" is the
PRIMARY loop this product is used through, not an edge case.

Fixed by extracting the refetch into a shared `refreshOffersAndMap()`
callback and calling it from BOTH `onRestart` (unchanged behavior) and
`onStartAnother` (the fix) — the natural-end path (the socket closing on
its own) already funnels into the same closing screen and the same
"Start Another" button, so one fix covers every route into `'closing'`.

Proven two ways in a new `mapRefreshAfterSession.test.tsx`: a behavioural
harness (matching the established `resumeRace.test.tsx` pattern for logic
embedded inside this one large component) proves BOTH the restart path
and the Finish→closing→"Start Another" path call `getMap` and update the
displayed state; a direct source-scan against the REAL `TutorExperience.tsx`
asserts `onStartAnother`'s own block literally contains a call to
`refreshOffersAndMap()`, since a harness alone cannot prove the actual
file is wired correctly. The source-scan test is the one that actually
proves the fix: confirmed to fail against the pre-fix file for the exact
claimed reason (`onStartAnother`'s body did not contain the call) via
`git stash`, pass against the fix. Full frontend suite green (1415
tests), lint clean, type-check clean, i18n:check clean.

## The one retry a repair gets swapped a false correction for false praise, and the fallback delivered whichever one survived — found live, closed 2026-08-30

Found live, testing as a struggling learner, in the very next
`tutor:converse` run after the map-staleness fix above: the harness's own
transcript review flagged "turn 4 praises '25' and then states the answer
is 15" — `¡Exacto! 10 más 5 es 15, y lo dijiste bien.` delivered to a child
who had just answered 25 (wrong; the right answer was 15).

The console trace showed the mechanism precisely, and it is the sibling of
the repeat defect closed earlier in this file, not a new class of bug:

- Attempt 0 said "casi" but its own arithmetic landed back on the
  learner's own number (25) — `contradictsCorrectAnswer` correctly caught
  this as `falseCorrection` (`oracle/src/tutor/prompt.ts`) and asked for a
  retry with "their answer was right, confirm it plainly, never mark a
  correct answer as almost."
- The retry (attempt 1) took that instruction literally rather than
  re-deriving the real answer, and produced a turn that congratulates 25
  as correct while STILL stating 15 as the right answer in the same
  sentence — `praiseContradictsAnswer`'s `falsePraise`, the mirror-image
  fault.
- `produce()`'s retry loop only special-cased a REPEAT surviving to
  delivery (see the entry above). Every other surviving fault, including
  `falsePraise`/`falseCorrection`, fell through to "a clumsy real sentence
  beats a scripted apology" and was delivered — logged as `[oracle] praise
  of a wrong answer SURVIVED the retry — delivered`, but delivered
  nonetheless.

That fallback rule is right for a vocabulary slip, a self-answered
question, an unkept promise: the delivered turn is imperfect but still
teaches something new. It is wrong for `falsePraise`/`falseCorrection` for
the same reason it was wrong for a repeat: telling a child they were right
and wrong about the SAME answer in the SAME sentence is not a degraded
turn, it is the exact contradiction the check exists to catch, delivered
with certainty.

Fixed by extending the repeat carve-out rather than writing a new one:
`orchestrator.ts` now tracks a `repairableIsFalseVerdict` flag alongside
`repairableIsRepeat`, set whenever `falsePraise` or `falseCorrection` is
true on the turn `repairable` captured or on the turn that survives the
retry, and routes to the same scripted-line fallback the repeat case
already uses. `oracle/AGENTS.md` item 21 previously listed "false praise"
among the repair reasons safe to deliver anyway; that line was wrong and
has been corrected there, with a new item 29 documenting this fix.

Proven with a new test in `orchestrator.test.ts`: attempt 0 is mocked to
produce the false-correction turn, the retry is mocked to produce the
false-praise turn, and the assertion is that the final delivered turn is
`source: 'scripted'`, never either self-contradicting sentence. Confirmed
to fail against the pre-fix code for the exact claimed reason
(`expected 'model' to be 'scripted'`) via `git stash`, pass against the
fix. Full oracle suite green (453 tests, up from 452), lint clean,
type-check clean on all three tsconfigs, `verify:pedagogy` and
`verify:tutor` both green, and independently re-verified against two
fresh `tutor:converse` runs: neither reproduced the contradiction again,
and the only remaining reported problems are the already-tracked
canned-fallback rate from DeepSeek's own empty-completion behavior (see
this file's empty-completions entry), not a new defect.

## Two sequence bugs in the pedagogical brain — a RESCUE turn could confront a frustrated child, and SPACED review never escalated — found by adversarial review, closed 2026-08-30

Found by adversarial review, round 22 (the pedagogical skill selector,
`oracle/src/tutor/skills.ts` and `controller.ts`), both HIGH. Same review
round, same defect class as several earlier entries in this file: a rule
that is correct in isolation is still wrong once you look at the SEQUENCE
of decisions across a whole conversation, or at how one filtering axis
interacts with another.

**1. A RESCUE turn could select a REMEDIATE-only confrontation skill.**
`selectSkill`'s dedicated-misconception path filtered a diagnosed
misconception by `misconceptions`, `tiers`, and `notSpent` — never by the
controller's chosen strategy — on the theory that "the specific procedure
beats the general one" should win outright. `controller.ts` sets
`misconceptionCode` on every misconception-tagged failure and clears it
only on leaving REMEDIATE, so a learner's SECOND consecutive wrong answer,
landing on a misconception-tagged distractor, produces `strategy: 'RESCUE'`
(rule 1, frustration first) together with a still-set `misconceptionCode`.
The selector handed back `counterexample-confront` regardless — a skill
declared `strategies: [REMEDIATE]` whose own procedure says "Never use
this on a careless slip" and walks the child through defending and testing
their own wrong rule. A child who is already frustrated (two wrong answers
running) got intellectually confronted instead of the emotional
de-escalation the controller itself had just decided was needed.

Fixed by adding the same `s.strategies.includes(query.strategy)` filter
the generic (non-dedicated) candidates path already had, in
`oracle/src/tutor/skills.ts`. Only one skill in the whole catalogue
declares `misconceptions` at all (`counterexample-confront`,
`strategies: [REMEDIATE]`), so the fix cannot regress any other
misconception match — there isn't one.

**2. A learner stuck in spaced review never escalated to RESCUE.** Item 17
elsewhere in this file (and `oracle/AGENTS.md` item 17) widened
`NO_PROGRESS_TRACKED_STRATEGIES` from SOCRATIC/FLUENCY to also cover
DIRECT/WORKED/FADED — every strategy with "no lower rung to fall back to."
SPACED has the identical shape (`baseStrategy` returns it unconditionally
for a due review, with no `stuck` check at all) and was left out. A
learner who repeatedly deflects a spaced-review question with ordinary
chat ("no sé", "olvidé eso") produces only `conversation_turn` events,
never a graded `activity_result`/`voice_result`, so `consecutiveFailures`
never moves (rule 1 can't fire) and — before this fix —
`questioningWithoutProgress` never moved either (SPACED wasn't tracked).
The controller proposed SPACED forever, with no escalation path.

Fixed by adding `'SPACED'` to `NO_PROGRESS_TRACKED_STRATEGIES` and to rule
1b's strategy check in `oracle/src/tutor/controller.ts`, alongside
DIRECT/WORKED/FADED.

Both proven with new tests reproducing the exact reported scenario:
`skills.test.ts` asserts a RESCUE-strategy query with a catalogued
misconception falls through to `frustration-rescue`, never
`counterexample-confront`; `controller.test.ts` asserts three
`conversation_turn` events in a row on a `review_due` entry escalate
`SPACED, SPACED, RESCUE` (mirroring the existing DIRECT/WORKED tests
immediately above it in that file). Both confirmed to fail against the
pre-fix code for the exact claimed reason via `git stash`, pass against
the fix. Full oracle suite green (456 tests, up from 453), lint clean,
type-check clean on all three tsconfigs, `verify:pedagogy` and
`verify:tutor` both green, root `docs:check` and `secrets:check` clean.

## A pt-BR growth story with natural phrasing never got its whiteboard, because the check couldn't recognize the sentence — found by adversarial review, closed 2026-08-30

Found by adversarial review, round 23 (the whiteboard sync system — V4
sprint 2, the most recently shipped major Tutor feature), MEDIUM.
`oracle/src/tutor/prompt.ts`'s `REPEATING_CUE` (does this turn narrate a
growth story that needs a whiteboard?) and `UNIT_WORD` (which cadence
word — day/week/month/year — did the story use?) were two independently
hand-written regex lists that both needed the identical phrase set across
all three locked locales. Both were built almost entirely around Spanish
"cada X" and English "every X," with Portuguese covered only by the
CALQUED "a cada X" — never the phrasing a Brazilian Portuguese speaker (or
the model producing pt-BR output) actually uses: "todo dia," "toda
semana," "todos os meses," "todos os anos." English "each X" (as distinct
from "every X") was missing from both lists too.

Effect on a real session: a pt-BR conversation telling a growth or
spending story with ordinary native phrasing set no `whiteboard` object,
and the repair loop that exists specifically to force the model to draw
one — shipped in V4 sprint 2 to fix exactly this failure mode for Spanish
and English — silently never fired. No warning was even logged, because
the deterministic check that is supposed to catch a missing whiteboard did
not recognize the sentence as a growth story at all. The sibling check
(`whiteboardUnitMismatch`) had the identical gap: a board mislabeled "Day
1/2/3" under a story that said "toda semana" would not be caught and
corrected either. Spanish- and English-phrased sessions got the intended
repair; naturally-phrased Portuguese sessions silently did not — a
locale-specific quality regression on a product that lists `pt-BR` as one
of three supported locales, in a feature whose entire job is making the
story's numbers visible.

Fixed by making `REPEATING_CUE` a `RegExp` derived from `UNIT_WORD`'s own
patterns instead of a separately hand-written union, so the two
structurally cannot drift apart again, and adding the missing
natural-Portuguese ("todo/toda/todos os/todas as X") and "each X" phrasings
to `UNIT_WORD` — the one place both checks now read from. See
`oracle/AGENTS.md` item 32 for the general lesson.

Proven with new tests in `contradiction.test.ts`: natural Portuguese
phrasing for all four cadence words, plus English "each day," now correctly
trigger `narratesUnshownGrowth`; a unit mismatch under natural Portuguese
phrasing ("toda semana" vs. a board labelled "day") is now caught by
`whiteboardUnitMismatch`. Both new tests confirmed to fail against the
pre-fix code for the exact claimed reason via `git stash`, pass against the
fix. Full oracle suite green (458 tests, up from 456), lint clean,
type-check clean on all three tsconfigs, `verify:pedagogy` and
`verify:tutor` both green.

The rest of round 23's review found no other reproducing defect: the
existing `ZERO_EPSILON` fix (item 28) was re-verified with a 500,000-trial
search within the schema's real bounds and holds; the whiteboard/
segmentRequest mutual exclusivity is genuinely Zod-enforced, not just
commented; the two independent server-side computations of a whiteboard's
sequence (fresh delivery and session resume) call the same pure function on
an object that is replaced, never mutated in place, so they cannot
disagree; and the "tray demonstration froze" fix from an earlier session
lives in a different file (`LiveSegmentPanel.tsx`) and does not recur in
`TutorWhiteboard.tsx`, which already keys its effects on primitives rather
than object identity.

## Three cost-ledger gaps in the highest-volume paid calls — found by adversarial review, closed 2026-08-30

Found by adversarial review, round 24 (session cost and budget
enforcement — the surface `/AGENTS.md` §1.0 rule 5 names explicitly as one
of the four ways a defect here costs this company real money). Three
findings, all in the exact call paths that fire every turn.

**1. HIGH — timed-out calls to the pedagogical model and the moderation
judge were never actually cancelled.** `lib/http.ts`'s `withTimeout` races
an already-invoked `fetch()` against a timer — on OUR timeout it stops
WAITING, but the real HTTP request keeps running server-side and can still
be billed by the provider with nothing in our own ledger to show for it.
`oracle/AGENTS.md` item 25 already fixed this exact pattern at the three
voice-provider call sites; round 24 found the SAME unfixed gap at
`model/provider.ts`'s `complete()` (the pedagogical model — the single
highest-volume paid call in the whole service, every turn),
`safety/moderation.ts`'s judge call (every model-authored turn), and
`content/generate.ts`'s tier-3 judge. On a timeout — already a measured,
recurring event in this service (empty completions, slow reasoning
models, provider 5xx) — the abandoned request could complete and bill for
real while the session's own cost accounting never saw those tokens, on
top of whatever the orchestrator's own retry then spent fresh. Fixed by
passing a real cancelling `signal` into all four remaining `fetch()` calls
(plus the model preflight probe): `AbortSignal.timeout(ms)` for the two
judges and the probe, `AbortSignal.any([callerSignal,
AbortSignal.timeout(ms)])` for `complete()`, since it already carries a
caller-provided interruption signal (a learner cutting in) that must keep
working alongside the new timeout signal.

**2. MEDIUM — the moderation judge's retry ignored real elapsed time,
unlike the model's own retry.** The model's retry loop re-checks a live
`Date.now()` against its deadline immediately before firing attempt 2.
`moderateTutorOutput`'s `allowRetry` was a boolean the caller froze ONCE,
before attempt 0 even started — so a first judge attempt that itself
consumed most or all of `MODEL_TIMEOUT_MS` (more than double the deadline
the boolean was based on) still bought a second, unconditional paid call.
Fixed by replacing the boolean with `ModerationInput.retryDeadlineMs` (the
raw deadline, passed straight through) and re-checking it live inside the
retry loop, mirroring the model's own pattern exactly.

**3. MEDIUM — a blocked turn's discarded speculative synthesis could be
permanently lost from a session's persisted cost.** A blocked turn's
speculative TTS clip is paid for and discarded (`void speculative`)
rather than awaited — its cost only reaches the ledger whenever its own
promise happens to settle, with nobody waiting on it. If that discarded
clip is slower than the scripted replacement that ships instead (ordinary
for a real second TTS call) and that same turn also ends the session,
`ws/server.ts`'s `finish()` read the total cost and persisted it to Core
before the slower clip had a chance to settle — permanently losing a
real, billed cost, since nothing ever reads that orchestrator again once
the session closes. Fixed by tracking every discarded synthesis promise
in a new `pendingDiscardedAudio` list and adding
`TutorOrchestrator.awaitPendingCosts()`, called from `finish()` right
before the session's economics are treated as final — deliberately not on
the per-turn path, where firing these speculatively exists specifically
so the learner never waits on them.

See `oracle/AGENTS.md` items 33-35 for the general lessons.

Proven with a new `timeout-cancellation.test.ts` (asserts a real
cancelling `AbortSignal` reaches `fetch()` at all four call sites plus the
probe, and that the model's caller-interruption signal still works
alongside the timeout signal), a new test in `safety.test.ts` (the retry
is skipped once the deadline passes DURING the first attempt, not only
before it started), and a new test in `orchestrator.test.ts`
(`awaitPendingCosts()` folds in a discarded clip that had not yet settled
when the delivered turn's own audio was already awaited — mirroring
exactly what `ws/server.ts`'s `deliver()` does before calling `finish()`).
All three confirmed to fail against the pre-fix code for the exact
claimed reason via `git stash`, pass against the fix. Full oracle suite
green (465 tests, up from 458), lint clean, type-check clean on all three
tsconfigs, `verify:pedagogy` and `verify:tutor` both green, and
independently re-verified against two fresh `tutor:converse` runs against
the real provider: completions and retries still behave identically post-
fix, including one fully clean run with zero problems reported.

One self-caused regression along the way: the new fix comments in
`model/provider.ts` and `safety/moderation.ts` named "Inworld" (the voice
provider) while explaining the item-25 precedent, which
`boundaries.test.ts` correctly caught — nothing outside `src/voice/` may
name the provider. Reworded to "the voice provider" before committing.

## Three session-lifecycle state bugs in the Tutor frontend — a stale resume could kill a healthy new session, and two flags never reset across a restart — found by adversarial review, closed 2026-08-30

Found by adversarial review, round 25 (`TutorExperience.tsx`'s session
lifecycle — the state machine behind starting, resuming, restarting and
ending a Tutor session). All three are a variant of the same root cause:
`oracle`'s orchestrator starts a brand-new session's turn-seq counter at
0, so several pieces of CLIENT state that assumed seq numbers (or session
identity) never repeat across a session boundary were wrong.

**1. CRITICAL — a stale, refused resume for an abandoned session could
force-close an unrelated, healthy new session.** The resume-driving
effect's SUCCESS branch was already hardened (an earlier fix this
session, see the "successful resume tore itself down" entry above) to
check the resumed session is still the active one before touching state.
Its FAILURE branch never got the same guard: `setPhase('closing')` ran
unconditionally whenever a resume call resolved refused. Scenario: a
session drops, the auto-resume call goes out, and BEFORE it resolves the
learner presses Restart (or Exit → "Start Another") into a brand-new,
healthy, currently-conversing session. If the original, now-abandoned
resume call later resolves refused (park expired, token rejected), its
failure branch ran anyway and slammed the brand-new session to the
closing screen — for a reason that had nothing to do with it. Fixed with
a `sessionRef` that mirrors the current `session` (for reading it from
inside a closure that captured an older one) and a captured
`resumeTargetId`: the failure branch now only closes the phase when the
session that resume call was FOR is still the active one, mirroring the
success branch's own already-proven pattern.

**2. HIGH — an interrupted turn in one session could permanently mute
every future session's first turn.** `interruptedSeq` is set once when
the learner interrupts the tutor and compared directly against the
current turn's `seq` — by design, so the NEXT turn in the same session
plays normally. But it is never RESET, and a session's first turn is
always `seq: 1` regardless of which session it is. A learner who ever
interrupted an earlier session's opening line left `interruptedSeq: 1`
set for the rest of the browser tab's visit: every later session's own,
real, un-interrupted greeting (also `seq: 1`) silently played no audio at
all, with no error and no warning.

**3. MEDIUM — a stale "reply timed out" timer from an abandoned session
could fire into a brand-new one.** `awaitingReply`/`replyTimedOut`'s
reset effect is keyed on `[turnSeq]`, which does not change (stays 0) if
a learner restarts before EITHER the old or the new session has received
its first turn yet. A learner who triggered `awaitingReply` and then
immediately restarted left the original 25-second timeout timer running
against the OLD session; when it fired, it set `replyTimedOut` into the
NEW session, showing a "reply timed out" caption for a message the new
session never sent.

Fixed by resetting all three (`interruptedSeq`, `awaitingReply`,
`replyTimedOut`) explicitly inside `begin()`'s success branch — the one
place a genuinely new session (and its own fresh seq counter) is
established, whether reached via the first start, a mid-conversation
restart, or "Start Another."

Proven with a new `sessionLifecycleReset.test.tsx`: three behavioural
harnesses (matching this codebase's established pattern — copying the
exact logic slice from `TutorExperience.tsx` against the real
`useTutorSocket` hook, rather than rendering the full component and its
3D stage) reproduce all three scenarios end-to-end, plus three source-scan
tests that assert the REAL file contains the actual fix (a harness alone
cannot prove the real component is wired correctly). All three source-scan
tests confirmed to fail against the pre-fix file for the exact claimed
reason via `git stash`, pass against the fix. Full frontend suite green
(1421 tests, up from 1415), lint clean, type-check clean, root
`i18n:check` clean.

## The composer could fire twice while a reply was pending, and a rephrase could rewind the conversation mid-activity — found by adversarial review, closed 2026-08-30

Found by adversarial review, round 26 (`ConversationView.tsx` — the
component a child actually looks at and types into every turn). Both
HIGH, both in the composer's submit path (`submitTyped`).

**1. No "a reply is already pending" guard, unlike every other input path
in this file.** `MicOrb` refuses to start a new recording while a reply is
pending (`state === 'thinking'`); the "explain differently" chip is gated
on `!awaitingReply`. The text composer — "the ONLY channel" when no voice
provider is configured, per this file's own comment — had no such guard
at all: the Send button and Enter key stayed fully live while
`awaitingReply` was true, so a learner who typed again while waiting
(impatient, or thinking they mistyped) could fire a second, billed turn
before the first reply had even landed.

**2. An in-progress rephrase could still rewind the conversation once an
activity opened.** The transcript's own edit affordance refuses to START
a rephrase while `socket.segment !== null || turn?.whiteboard != null`
(its own comment: "mid-activity, rewinding the conversation is not a flow
we honour"), but `submitTyped` never re-checked that same condition at
SEND time — only the affordance checked it at click time. A learner who
tapped "Rephrase," then had a segment or whiteboard arrive before
pressing Send, could still fire `socket.editLast(...)` — a server-side
conversation rewind — while an activity was on screen, the exact flow
the product says it does not honour.

Fixed with one reactive effect plus one guard, both in
`ConversationView.tsx`: an effect resets `editing` to `false` whenever
`turnSeq`, `socket.segment`, or `turn?.whiteboard` changes (an edit stops
being valid the instant the message it targets stops being "the last
message" — a new turn arrived, or an activity opened), and `submitTyped`
now refuses to submit at all while `awaitingReply` is true and carries a
defence-in-depth check against the same segment/whiteboard condition
right before calling `editLast`. The learner's typed text is deliberately
NOT discarded when an edit is abandoned this way — it is sent as an
ordinary new message instead, so nothing they typed is lost, only the
rewind intent.

Proven with three new tests in `conversationView.test.tsx`: the Send
button is disabled and Enter does nothing while `awaitingReply` is true;
a rephrase interrupted by an arriving segment sends the same text as a
fresh `sendText` call, never `editLast`. Confirmed to fail against the
pre-fix code for the exact claimed reason via `git stash` (the third test
fails on a `getByPlaceholderText` lookup, because pre-fix the composer is
still showing "Rephrase your message…" — direct evidence `editing` never
reset), pass against the fix. Full frontend suite green (1424 tests, up
from 1421), lint clean, type-check clean, root `i18n:check` clean.

## The "Past conversations" toggle could silently do nothing, and "I'm ready" had no busy guard — found by adversarial review, closed 2026-08-30

Found by adversarial review, round 27 (`OfferChips.tsx` and
`PersonalizeInWorld.tsx` — the very first screen a learner sees, before a
Tutor session starts).

**1. MEDIUM — the archive toggle could flip its own visible state while
the list it opens never appeared anywhere.** `OfferChips.tsx`'s `archive`
(the "Past conversations" list) used to render ONLY inside the dock's
portal (`{chipsIn && dockAbove ? createPortal(<>{archive}{secondary}</>,
dockAbove) : null}`) — with no fallback for `!dockAbove`, unlike its
sibling `secondary`, which already had one (`{chipsIn && !dockAbove &&
secondary}`). The component's own comment says the dock "is absent... in
a unit test" — meaning `ready && !dockAbove` is not a hypothetical, it is
the exact combination the existing test suite already runs under with no
`StageDockContext` provider. In that combination, tapping "Past
conversations" still flips its own `aria-expanded` and its label from
"Past conversations" to "Hide" — every outward sign says it worked — but
the list itself never rendered anywhere on screen. Exactly the shape
`oracle/AGENTS.md`'s own catalogue names repeatedly this session: a
surface that opts something out of its layout without checking whether
the fallback layout has it either. No live caller currently hits this
combination in production (the dock's portal target mounts before the
reveal delay elapses), but nothing enforces that, and the existing tests
never covered it.

Fixed by adding the same fallback the sibling `secondary` already has:
`{chipsIn && !dockAbove && archive}`, right beside it.

**2. LOW — "I'm ready" had no busy guard, unlike every session-starting
control in the sibling `OfferChips`.** Every control there that can
trigger `onStart` carries `disabled={disabled}`; the personalize screen's
"I'm ready" (Done) button had none. In production `onDone` runs
`persistPreferences({})`, which sets `saving` true synchronously before
its network call — the identical guard shape `begin()` already uses for
`starting` — so two fast clicks fired a second, wholly redundant `PUT
/tutor/preferences` with an empty body. Fixed with `disabled={saving}`.

Proven with a new test in `offerChips.test.tsx` (toggling the archive
with no stage dock present now actually shows "Your past conversations")
and a new test in `personalizeInWorld.test.tsx` (a second click while
`saving` is true does not re-fire `onDone`). Both confirmed to fail
against the pre-fix code for the exact claimed reason via `git stash`,
pass against the fix. Full frontend suite green (1426 tests, up from
1424), lint clean, type-check clean, root `i18n:check` clean.

## A curated cross-session memory write could be silently lost or could silently erase real memory on a transient read failure — found by adversarial review, closed 2026-08-30

Found by adversarial review, round 28 (`oracle/src/core/client.ts` — every
HTTP call Oracle makes to Core, the only way Oracle reads or writes
anything about a learner). Both HIGH, both in the V4 curated-memory
(`learner_memory`) read/write path — the single highest-stakes data flow
in the codebase to get wrong, since a mistake here corrupts what the tutor
believes about a real child across every future session, permanently.

**1. `updateLearnerMemory` reported success on a genuine per-store write
failure.** Core answers `PUT /learner-memory` with an ordinary 200 even
when one store fails to persist — `{ written: { learner: false, pedagogy:
true } }` is not an error envelope, just a partial result. This function
checked only that the envelope parsed and `data !== null`, true in BOTH a
full success and a partial failure, unlike every sibling write function in
the same file (`persistTurn`, `persistSafetyFlag`, `closeSession`), which
all check the real boolean. The function's own doc comment promises "a
false return means did not land," which `session/review.ts` relies on to
let the next session's review retry — silently returning true instead
meant a memory write could fail with no retry and no warning, forever.

**2. A transient read failure could look identical to "this learner has no
memory yet," and the difference mattered because the caller WRITES based
on it.** `backend/services/tutorData.ts`'s `getLearnerMemory` collapsed a
failed read and a genuinely empty one into the identical `{ learner: null,
pedagogy: null }` shape, labeled in its own comment as safe because the
read is "Display-only (§1.14)." That labeling was wrong for its actual
consumer: `session/review.ts` treats an empty brief as "this learner never
had memory" and has the model write a note "from scratch" — which then
REPLACES whatever real, accumulated memory existed from every prior
session. A transient Core hiccup on session N+1 could silently and
permanently erase everything sessions 1..N had written, the exact
failure-must-be-distinguishable-from-emptiness shape this file's own
header already names for `getLearningStatsForUpdate`. `intelDegraded`
already makes this distinction for the `skillStates` read; nothing
equivalent existed for `learnerBrief`.

Fixed end to end. `updateLearnerMemory` now requires `written[store] ===
true` for every store actually proposed (a `null` store was never
requested and correctly never appears in `written`). `getLearnerMemory`
now returns `null` specifically when the read fails — the signal
(`serviceRest` returning `null` on failure vs. a real `[]`) already
existed and was simply being thrown away via `rows ?? []`. Core's route
threads a new `learnerBriefDegraded` flag alongside the unchanged
`learnerBrief` field, the same way `intelDegraded` rides beside
`skillStates`, and `runPostSessionReview` now refuses to run at all when
`learnerBriefDegraded` is true, rather than trusting an empty brief it
cannot tell from a failed one. See `oracle/AGENTS.md` items 36-37 for the
general lessons.

Proven with new tests: `backend/src/__tests__/tutorData.test.ts` (a failed
read returns `null`, a real empty result returns the object, real content
comes through unchanged); `oracle/src/__tests__/coreClient.test.ts` (a
partial or total per-store failure returns `false`, a full success returns
`true`, a store that was never proposed is not required to appear); and
two new cases in `oracle/src/__tests__/review.test.ts` (the review skips
entirely when `learnerBriefDegraded` is true, and still runs normally when
the brief is merely absent and NOT flagged as degraded). All confirmed to
fail against the pre-fix code for the exact claimed reason via `git
stash`, pass against the fix. Full oracle suite green (471 tests, up from
465), full backend suite green (631 tests, up from 628), lint clean on
both services, type-check clean on all tsconfigs in both services
(backend's own + oracle's three), `verify:pedagogy` and `verify:tutor`
both green, root `docs:check`, `secrets:check` and `provider:check` clean.

## A blocked turn's own safety flag could silently fail to persist, letting migration 0054's recall exclusion be defeated — found by adversarial review, closed 2026-08-30

Found by adversarial review, round 29 (episodic recall — the "¿te acuerdas
de…?" literal-excerpt feature), CRITICAL.

A child typing something identifier-shaped (an address, phone, email) is
correctly classified `personal_data` and BLOCKED before it ever reaches
the model — the session keeps going with a scripted line, it does not
stop — and Oracle writes a `tutor_safety_flags` row so migration 0054's
episodic-recall search can exclude that turn from ever being excerpted
back to the model later. That write (`ws/server.ts`'s call to
`persistSafetyFlag`) used to be a bare fire-and-forget: no retry, no
failure counter, unlike every transcript write in the same file. A
systematically failing write (a Core hiccup, exactly as plausible here as
for a transcript write) meant the blocked turn's own PII sat in
`tutor_turns` with no flag marking it — indistinguishable from an
ordinary safe turn — ready to resurface verbatim to the model the next
time a "¿te acuerdas cuando te dije...?" recall matched it. This is the
missing other half of migration 0054's own fix: the query-side exclusion
was hardened, but the write that populates the thing it excludes on was
never given the same failure discipline the ordinary transcript writes
already have.

**The first fix attempt was wrong, and the regression test is what caught
it.** Chaining `persistSafetyFlag` through `notePersist` — the SAME
counter `persistTurn` already uses — looked like the obvious fix and
compiled clean, but the new live-session test kept timing out waiting for
the session to close. Root cause: a blocked turn ALSO writes the
learner's raw text via the ordinary `persistTurn` call one line above,
which succeeds against a healthy Core even when the flag write is the one
failing — so that success reset the shared counter to zero every single
turn, and it could never accumulate five consecutive FLAG failures no
matter how many actually occurred. Fixed with a dedicated sibling,
`noteFlagPersist`, carrying its own counter (`flagPersistFailures`),
never shared with `persistFailures`. See `oracle/AGENTS.md` item 38 for
the general lesson — a shared "N failures closes the session" counter is
only safe when nothing else on the same turn can reset it for an
unrelated reason.

Proven with a new test in `live-session.test.ts`: a real websocket session
sends five consecutive `personal_data`-shaped messages against a fake
Core that always refuses the flag write (but always accepts the ordinary
transcript write); the first four are answered normally and the session
stays open after each; the fifth crosses the dedicated threshold and the
session closes. Confirmed to fail against the pre-fix code for the exact
claimed reason (the socket never closes within the test's timeout) via
`git stash`, pass against the fix. Full oracle suite green (472 tests, up
from 471), lint clean, type-check clean on all three tsconfigs,
`verify:pedagogy` and `verify:tutor` both green.

Round 29 also found a second, HIGH-severity defect in the same feature —
episodic recall's full-text search hardcodes the Spanish Postgres text-
search configuration regardless of the session's actual locale, silently
degrading or breaking recall for `en-US` and `pt-BR` sessions. That is a
schema-level fix (a new migration) and is tracked and closed separately;
see the entry below.

## Episodic recall was unpredictably broken, not merely degraded, for two of the platform's three locales — found by adversarial review, closed 2026-08-30

Found by adversarial review, round 29 (episodic recall), HIGH.
`database/migrations/0053_learner_memory.sql` hardcoded the Spanish
Postgres text-search configuration for both `tutor_turns.text_tsv` (a
GENERATED column) and `search_tutor_turns()`'s query parsing, with an
explicit design comment accepting the trade-off: "for en-US/pt-BR content
the match degrades to stemless term matching, which is still useful and
still indexed." Measured against a real local Postgres, that assumption
does not hold: `to_tsvector('spanish', 'remember')` produces the stem
`rememb`, but `to_tsvector('spanish', 'remembered')` produces the stem
`remember` — two DIFFERENT stems for the SAME English root depending on
inflection, because the Spanish snowball stemmer actively mistransforms
English (and Portuguese) words rather than merely leaving them unstemmed.
A query built from one inflection cannot find text stored in another,
even though both ran under the identical config. Recall for `en-US`/
`pt-BR` sessions was not degraded, it was unpredictably broken — and
invisible in production, because a failed or empty recall degrades to
"the turn we already had," exactly the behavior a genuinely-empty result
also produces. On a platform whose recall trigger phrase list
(`RECALL_TRIGGER`, `oracle/src/tutor/orchestrator.ts`) is deliberately
trilingual, this silently defeated the feature for two of three locales.

**The fix: `database/migrations/0056_recall_locale_aware_fts.sql`.**
`text_tsv` cannot stay a GENERATED column — the correct config depends on
`tutor_sessions.locale`, a sibling table a generated expression cannot
read — so it converts to a plain, trigger-maintained column via `ALTER
COLUMN ... DROP EXPRESSION`, which keeps the column, its stored data and
its GIN index in place with no drop/recreate; only the "how is this
computed" rule changes, from an expression to a `BEFORE INSERT OR UPDATE`
trigger that looks up the row's own session's locale. Existing rows are
backfilled once (their stored vectors were computed under the old
always-Spanish rule). `search_tutor_turns()` gains a `p_locale` parameter,
defaulted to `es-MX` so an un-updated caller keeps today's behavior, and a
new `tutor_fts_config(locale)` helper maps all three locked locales
(`en-US`→english, `es-MX`→spanish, `pt-BR`→portuguese) so both the
storage side and the query side read from one mapping instead of two that
could drift. `locale` is threaded end to end: `orchestrator.ts`'s
`recallOwnHistory` call now passes `this.session.locale`, Core's `GET
/tutor/recall` route accepts an optional `locale` query param, and
`searchOwnTurns` forwards it to the RPC as `p_locale`.

**Expand-safe either side of the code**, the same contract 0053/0054
already use: a caller still sending only 3 arguments resolves via the
new parameter's default; a caller sending 4 arguments against a database
that has not yet run this migration gets an RPC failure that
`recallOwnHistory`/`searchOwnTurns` already treat as "degrade to empty,"
never a crash a learner could see.

**Verified against a real local Postgres instance**, `npm run db:reset`
succeeding twice: the exact round-29 repro (English text "I remembered
the cookie problem..." against the query "remember cookie problem," with
`locale: 'en-US'`) now returns the match it should; the equivalent es-MX
case still matches (no regression); a fresh Portuguese case matches too;
and a bare 3-argument call (no locale) still resolves via the default.
Also confirmed directly: `text_tsv`'s `pg_attribute.attgenerated` is now
empty (no longer a generated column) and `idx_tutor_turns_text_tsv`
survived the conversion untouched.

Proven at the application-code level with new tests in
`oracle/src/__tests__/coreClient.test.ts` (each of the three locales
reaches `recallOwnHistory`'s query string) and
`backend/src/__tests__/tutorData.test.ts` (each locale reaches
`searchOwnTurns`'s RPC body as `p_locale`, and an omitted locale defaults
to `es-MX`) — these prove the WIRING; the SQL-level stemming behavior
itself was proven directly against Postgres as described above, since
this codebase's test suites intentionally never touch a real database.
Both new test files confirmed to fail against the pre-fix code for the
exact claimed reason via `git stash`, pass against the fix. Full oracle
suite green (475 tests, up from 472), full backend suite green (635
tests, up from 631), lint clean on both services, type-check clean on
all tsconfigs in both, `verify:pedagogy` and `verify:tutor` both green,
root `docs:check`/`secrets:check`/`provider:check` clean, and the root
`tools:test` migration-ledger gate green after updating ROADMAP.md's
declared pending-delta range to `0054`–`0056`. See `oracle/AGENTS.md`
item 39 for the general lesson.

## Three real defects in the guardian voice-consent grant/revoke flow — found by adversarial review, closed 2026-08-30

Found by adversarial review, round 30 (guardian voice consent — one of
the platform's most safety-critical flows, the compensating control
`/AGENTS.md` §1.9's Tutor voice carve-out is conditioned on).

**1. MEDIUM — `VoiceConsentControl` could show "never granted" right after
a grant that had actually succeeded.** `grant()`'s flow was: POST
`/consent` (succeeds) → `await load()` (a GET refresh, purely to confirm).
If that refresh failed for any transient reason — unrelated to the grant,
which had already committed server-side — `load()` collapsed the whole
control to `{ status: 'error' }`, which renders IDENTICALLY to "never
granted": the Grant button reappears, the status line says the
microphone is off. A guardian who had just completed the deliberate
two-step confirmation (required specifically so the stored consent
record reflects what they actually read) would see their own action
apparently undone. The sibling direction (revoke succeeds, refresh
fails) had the same root cause, masked because "inactive" and "error"
happen to render the identical button — the decisive difference was an
error banner claiming a revoke that had, in fact, worked had failed.

Fixed with two changes in `VoiceConsentControl.tsx`: `grant()`/`revoke()`
now update `state` OPTIMISTICALLY from the write's own response the
instant it succeeds, before the confirmation `load()` even runs; and
`load()` itself no longer regresses an already-`'ready'` state to
`'error'` on a failed refresh — only the very first load, with nothing
confirmed yet, has nowhere else to fall back to.

**2. LOW-MEDIUM — the mic-blocked reason shown to a child went stale the
instant a guardian revoked consent mid-session.** `TutorExperience.tsx`
computed the displayed reason from `session.microphoneBlockedBy`, a
value fixed once at session creation and never updated afterward.
`useTutorSocket.ts` correctly closed the microphone on a live
`CONSENT_REVOKED` frame, but the transient error banner naming the
reason is cleared by the tutor's own very next turn — so for the rest of
the session the child saw the generic "Talking out loud isn't available"
instead of "A grown-up needs to turn the microphone on for you," the
exact "unfalsifiable absent control" shape `/ORACLE.md` §14.1 exists to
prevent. Does not affect actual mic gating (already correctly closed),
communication only.

Fixed with a new persistent `micRevoked` field on `useTutorSocket`'s
returned state — unlike `error`, it survives past the next turn, set on
`CONSENT_REVOKED` and reset only by a genuinely fresh `ready` frame (a
new session, or a resume, where a still-active revocation is promptly
re-observed by the existing per-turn consent recheck anyway).
`TutorExperience.tsx`'s `blockedBy` computation now prefers it over the
stale session-creation-time value once observed.

**3. LOW — the loser of a grant/grant race was told a false failure.**
`grantVoiceConsent` is check-then-insert across two round trips, not one
transaction. The database's own partial unique index
(`idx_tutor_voice_consent_live`, migration 0047) makes two
simultaneously-active consent rows for the same child impossible
regardless — data integrity was never at risk — but two devices (or a
double-tap) granting at once could both pass the pre-insert check before
either write lands, and the SECOND insert is refused by the DB's own
constraint, which collapses to `null` indistinguishably from a genuine
outage. The race loser was told `DATA_UNAVAILABLE` even though an active
consent row for that exact child now existed, written by the winner an
instant earlier.

Fixed by re-checking `getActiveVoiceConsent` when the insert fails,
before concluding failure — a live row found at that point means someone
else won the race, and the caller returns it as success rather than
`null`.

Proven with new tests: `frontend/src/tutor/__tests__/voiceConsentControl.test.tsx`
(a grant/revoke that lands, followed by a refresh that fails, still
shows the correct final state, not an error); `frontend/src/tutor/__tests__/micRevoked.test.tsx`
(a real `useTutorSocket` instance sets `micRevoked` on `CONSENT_REVOKED`
and it survives the next turn, resets on a fresh `ready`, plus a
source-scan proving `TutorExperience.tsx` actually reads it) and
`backend/src/__tests__/tutorData.test.ts` (a race loser's insert failure
now resolves to the winner's row; a genuine failure with no row ever
appearing still returns `null`). All confirmed to fail against the
pre-fix code for the exact claimed reason via `git stash`, pass against
the fix. Full frontend suite green (1432 tests, up from 1426), full
backend suite green (637 tests, up from 635), lint clean on both, type-
check clean, root `i18n:check` clean.

## A parent switching between two children's Tutor histories on one page could see the OUTGOING child's safety flags under the new child's URL — found by adversarial review, closed 2026-08-30

Found by adversarial review, round 31 (the guardian transcript viewer —
the surface `/AGENTS.md` §1.9's parent-visibility invariant becomes for
a real human).

`KidTutorPage.tsx` (route `family/:kidId/tutor`) fetched a child's
sessions and safety flags in a `useEffect` keyed on `[kidId, getToken]`,
but only ever initialized `state` to `{ status: 'loading' }` once, in
`useState`'s own initializer — the effect itself never reset it back to
`loading` when `kidId` changed. The route in `App.tsx` carries no
`key={kidId}`, so React Router reuses the SAME `KidTutorPage` instance
across a `:kidId` change rather than remounting it (confirmed by reading
the route definition directly). The result: for as long as the new
child's fetch takes to resolve, the page kept rendering the OUTGOING
child's data — including safety flags in categories `self_harm` and
`abuse_disclosure` — under a URL that already named a different child.

Not reachable through today's shipped navigation: the only link into
this route is `FamilyPage.tsx`, and every path between two different
kids' `/tutor` pages transits `/family` first, which is a different
component and does force a real unmount. But it is a real defect in the
component itself, invisible on any normal first visit (which is exactly
why no existing test caught it), and it would silently reactivate the
moment any future feature adds a direct kid-to-kid navigation on this
route — a "switch kid" control, a "next child" button, a deep link from
a notification. Given what leaks (safety-flag categories that exist
specifically because a parent must find out), this was fixed now rather
than left for the day it becomes reachable.

Fixed by resetting `state` to `{ status: 'loading' }` and `openId` to
`null` synchronously at the top of the effect, before the async fetch
even starts — so a `kidId` change shows the loading screen immediately,
never a stale render of the previous child's data.

Proven with a new test in `frontend/src/routes/app/family/__tests__/KidTutorPage.test.tsx`:
render at kid A's page (kid A has a HIGH `self_harm` flag), click a
control that navigates to kid B's page without unmounting (kid B's
fetch left deliberately pending), and assert kid A's flag text is gone
and the loading state is showing before kid B's data ever arrives.
Confirmed to fail against the pre-fix code for the exact claimed
reason via `git stash` (kid A's flag text was still on screen), passes
against the fix. One test-authoring pitfall hit and fixed along the way,
worth recording since it's easy to repeat: the test's `AuthContext` mock
originally created a brand-new `getToken` function on every render
(`useAuth: () => ({ getToken: vi.fn()... })`), unlike the real
`AuthContext`, which memoizes `getToken` with `useCallback` — with an
unstable mock, the effect's `[kidId, getToken]` dependency array looks
"changed" on every render even when `kidId` hasn't moved, and each
resolution re-triggers the effect, which creates a new mock function,
which re-triggers it again; holding a fetch pending across an assertion
(exactly what proving this bug requires) turned that into an unbounded
microtask storm that OOM'd the test worker. Fixed by hoisting the mock's
`getToken` to a single module-level `vi.fn()`, matching the real
component's actual stability guarantee. Full frontend suite green (1434
tests, up from 1432), lint clean, type-check clean, root `i18n:check`
clean.

## The Oracle session-token mint/verify boundary held up under adversarial review — one doc line corrected, no code defect — closed 2026-08-30

Round 32 targeted the single highest-leverage security boundary not yet
reviewed this session: the Core-minted, single-use, session-scoped
token that lets the browser open a WebSocket directly to `oracle/`
(`/AGENTS.md` §1.5's Oracle exception, four constraints). Adversarially
tested against the real code — session binding under payload tampering,
`.strict()` schema rejecting a smuggled extra field, single-use atomicity
under simulated simultaneous connections, Supabase-JWT rejection through
a real socket, server-side expiry, and live (not token-baked) consent
freshness re-checked before every turn's audio — all held. No code
defect found; every throwaway test proving this was deleted afterward.

One inaccuracy found and fixed: `/AGENTS.md` §1.5 said the socket "is
refused outright for a `kid` without an active guardian voice consent."
The real, deliberately better-designed behavior (`/ORACLE.md` §4.3) is
that the socket still connects — a working, silent session, never a
session that quietly opens a microphone — while only the MICROPHONE is
refused, server-side, on every `learner_audio*` frame, and re-checked
before each turn so a mid-session revocation takes effect immediately.
The underlying child-safety property already held; only the doc's
one-sentence summary overstated a full connection refusal. Corrected in
both `AGENTS.md` and `CLAUDE.md` in the same commit.

One already-known, already-documented risk reconfirmed rather than
newly found: `NonceLedger`'s single-use guarantee is in-process, and
`/ORACLE.md` §16's "Oracle runs as a SINGLE Railway replica" checklist
item is still unchecked, with nothing in code or Railway config
preventing a scale-out that would silently defeat it. Not a regression
and not new information — left as the standing, tracked item it already
was.

## Two HIGH grace-turn bugs and one child-safety-adjacent UI gap — found by adversarial review, closed 2026-08-30

Round 33 targeted the grace-turn mechanism (`oracle/src/tutor/orchestrator.ts`
— "never end a session mid-question") and the mic-orb/closing-screen UI, two
surfaces this session's earlier rounds had not yet reached.

**1. HIGH — the one-time grace ticket was spent at GRANT time, not at
DELIVERY time.** `this.closeGraceUsed = true` was set the instant the grace
turn was computed eligible — before the model call that attempts it even
started. A learner who interrupted that one attempt (the same ordinary
interrupt path every turn allows) burned the ticket on a turn that delivered
nothing, and the very next attempt at the exact same open thread got the
abrupt scripted close with zero chance to try again — reproducing the "ended
mid-question" defect the mechanism exists to prevent, just delayed by one
turn. The exact "checked also means checked at the right moment" class this
file already fixed once for `usedSkillNames` (`oracle/AGENTS.md` item 33
area), recurring in different state because that fix was never generalized
into a rule (now item 40).

**2. HIGH — `handleSegmentResult` and `handleVoiceCheckResult` never granted
the grace turn at all**, even though the mechanism's own `openThread`
condition names "an activity still on screen" as half of what qualifies —
both functions grade the activity (XP, mastery estimate) before reacting to
it, so a budget that ended exactly as a graded widget or a spoken answer came
back fell straight into `produce()`'s unconditional scripted close: scored
and never acknowledged, the "promised something and abandoned" shape
`handleSegmentUnavailable`'s own doc comment already names for a different
cause.

Fixed by extracting `graceTurnFor`/`commitGraceTurn` as shared helpers used
by all three call sites (`handleLearnerText`, `handleSegmentResult`,
`handleVoiceCheckResult`), and by moving the ticket-spend to AFTER `produce()`
resolves, gated on `outcome !== null` — mirroring `commitSkillUse`'s own
`emission.source === 'model'` gate. Proven with three new tests in
`oracle/src/__tests__/orchestrator.test.ts`: an interrupted first grace
attempt is followed by a second, successful one, then the ticket is truly
spent; `handleSegmentResult` and `handleVoiceCheckResult` each get one grace
turn when the budget ends exactly as their result comes back. All three
confirmed to fail against the pre-fix code for the exact claimed reason via
`git stash`, pass against the fix. Full oracle suite green (478 tests), lint
clean, type-check clean (all three tsconfigs), `verify:tutor` and
`verify:pedagogy` both green.

**3. MEDIUM/HIGH (UX, child-safety-adjacent) — `ClosingInWorld.tsx` collapsed
every close reason into one generic, cheerful screen.** The component ignored
`useTutorSocket`'s `closedReason` entirely, so a session the safety
classifier stopped — the tutor's own scripted line had just told the child
"I am stopping our lesson here so you can [go tell a grown-up]" — was
followed on the very next screen by the IDENTICAL "See you soon! Saved. You
can listen again any time." as an ordinary satisfied completion, with the
same prominent "Start Another" CTA and "Past conversations" replay archive.
The §1.14 "failure indistinguishable from emptiness" pattern, applied to the
one close reason where the mismatch matters most. No test file existed for
this component before this fix.

Fixed by threading `closedReason` from `TutorExperience.tsx`'s socket into
`ClosingInWorld`, which now shows calmer, minimal wording — "We stopped
here" / "Go find that grown-up now." (new i18n keys
`tutor.page.sessionStoppedTitle`/`sessionStoppedBody`, all three locales) —
specifically for `closedReason === 'safety_stop'`, echoing the tutor's own
spoken instruction rather than contradicting it; every other close reason
(`completed`, `hard_budget`, `consent_revoked`, `error`, or none yet) keeps
the original cheerful copy unchanged. **The exact wording is a first pass,
not a final word** — this is child-safety-adjacent text invented to close a
proven defect, not copy that came from an existing spec (`/ORACLE.md` §9.5
covers only the ordinary soft/hard close performance, not a safety stop), and
it deserves a human product/legal read before being treated as settled. The
functional actions (start another session, browse past conversations) were
deliberately left unchanged — hiding them was a bigger, more speculative
product decision this fix does not make.

Proven with a new test file, `frontend/src/tutor/__tests__/closingInWorldReason.test.tsx`
(4 tests: the safety-stop wording shows and the cheerful wording is absent;
the cheerful wording still shows for `completed`, `hard_budget`, and no
reason yet). Confirmed to fail against the pre-fix code for the exact
claimed reason via `git stash`, passes against the fix. Verified visually
in-browser at both breakpoints via `/dev/tutor-lab` (temporarily forcing the
lab's `closedReason` prop to reach the new screen, reverted before
committing) — both mobile (375px) and desktop render cleanly, no overlap or
truncation, since the fix only swaps which two i18n keys are read and
touches no layout. Full frontend suite green (1437 tests, up from 1433),
lint clean, type-check clean, root `i18n:check` clean (3-locale parity).

## The daily session cap could be defeated by a race, its day boundary was systematically wrong for most users, and a stale adaptation offer looked like it worked when it silently didn't — found by adversarial review, closed 2026-08-30

Round 34 targeted two surfaces: the daily session-cap enforcement
(`POST /tutor/sessions`) and the frontend side of the adaptation-offer
flow (`/ORACLE.md` §11, "offered, never imposed" — the orchestrator-side
authorization was already correct from earlier work).

**1. HIGH — the daily session cap (2/day) was enforced by a non-atomic
read-then-write, so it was not actually a cap.** The exact race shape this
migration series already closed once for the daily XP cap
(`0055_atomic_tutor_xp.sql`) and once, with a compensating unique index, for
voice consent — but never applied to session creation. `tutor_sessions`
carries no per-day database constraint at all, so this was not a mislabeled
error under a race, it was a real defeat of the cap: two concurrent
`POST /tutor/sessions` requests both observing count=1 (one below the cap
of 2) both succeeded, landing 3 sessions against a cap of 2.

**2. MEDIUM-HIGH, systematic — the cap's day boundary was the server's UTC
calendar day, not the learner's.** `startOfTodayIso()` used `Date.UTC(...)`
midnight while its own doc comment falsely claimed "in their own local
date." UTC midnight falls in the afternoon or evening local time for all
three of this platform's locales (roughly 13:00-21:00 depending on locale
and DST), so an entirely ordinary morning session and evening session on
the SAME local calendar day were treated as two different cap windows —
reachable through completely ordinary use, every day, for the large
majority of the real user base, not a rare edge case near a boundary.

Fixed together: `start_tutor_session_checked` (migration `0057`) moves the
count, the cap comparison and the insert into one `SECURITY DEFINER`
Postgres function serialized with `pg_advisory_xact_lock` keyed on the
learner (a different lock salt than `award_tutor_xp`'s, so the two never
wait on each other); staff exemption stays in application code, which
passes an effectively unlimited cap for staff rather than a second,
unchecked insert path. `startOfTodayIso()` became `startOfLocalDayIso`,
mapping the session's locale to one representative IANA timezone
(`America/Mexico_City`, `America/Sao_Paulo`, `America/New_York`) — an
approximation for `en-US`, which spans several US timezones since there is
no stored per-user timezone, but still strictly more correct than a UTC
boundary for the other two locales, and no worse than UTC was for the one
it cannot represent precisely. `countSessionsSince` and `createTutorSession`
were deleted (their one call site each was the code being replaced), not
left as dead code.

Proven with: a unit test suite for `startOfLocalDayIso` (a morning and an
evening session in Mexico City land in the SAME window; the window rolls
over only when Mexico City itself crosses midnight, not when UTC does; the
two locales genuinely disagree on the calendar day for the same instant); a
route-level test confirming `POST /tutor/sessions` now delegates to the one
atomic RPC rather than a separate count-then-create; and, most decisively,
a direct test against a REAL local Postgres instance — two genuinely
concurrent `psql` connections racing `start_tutor_session_checked` with one
cap slot remaining settled at exactly one created session and one
cap-reached empty result, never exceeding the cap, with `npm run db:reset`
succeeding twice. All confirmed to fail against the pre-fix code for the
exact claimed reason via `git stash` (the atomic-call test failed cleanly;
several others failed as collateral of the mock contract changing
entirely, expected when a mechanism is replaced rather than patched). Full
backend suite green (641 tests, up from 637), lint clean, type-check clean,
root `i18n:check`/`docs:check`/`secrets:check`/`paths:check`/`seo:check`/
`provider:check`/`tools:test` all clean, database types regenerated.

**3. HIGH — a stale adaptation offer could silently fail when accepted,
with nothing telling the learner it didn't work.** An `adaptation_offer`
frame is only ever sent when that turn's `offerAdaptation` is truthy — there
is no explicit "the offer is gone now" frame — and the orchestrator's own
notion of the currently valid offer moves on with every produced turn.
`useTutorSocket.ts`'s `case 'turn'` never touched `adaptationOffer`, so the
client's copy could go stale: an offer from an earlier turn stayed on
screen — hiding the composer, per `ConversationView.tsx`'s `standDown` — even
after the tutor had already moved the conversation forward with an ordinary
turn that offered nothing. Tapping the stale card cleared it optimistically
(looked like it worked) while the orchestrator correctly refused it
server-side and the tutor never remarked either way — a silent failure.

Fixed by clearing `adaptationOffer` unconditionally in `case 'turn'`. Safe
because the server always sends the `turn` frame BEFORE any
`adaptation_offer` for the same emission (`ws/server.ts`'s `deliver()`), so
a fresh offer for that exact turn arrives immediately after and re-sets it
via its own case. Proven with a new test file,
`frontend/src/tutor/__tests__/adaptationOfferStale.test.tsx` (an offer is
cleared once an ordinary next turn arrives without re-offering it; a FRESH
offer for the same turn is not clobbered by the clear). Confirmed to fail
against the pre-fix code for the exact claimed reason via `git stash`,
passes against the fix. Full frontend suite green (1439 tests, up from
1437), lint clean, type-check clean.

## The V4 whiteboard reached a learner's screen and nowhere else — invisible on replay and to a guardian — found by adversarial review, closed 2026-08-30

Round 35 reviewed the session-replay flow ("Past conversations") end to
end for the first time this campaign — a surface directly adjacent to
round 33's `ClosingInWorld` fix but never itself audited.

**HIGH — the whiteboard had no path into persistence at all.** The V4
live sequence board (`oracle/src/tutor/turnSchema.ts`'s `WhiteboardSchema`,
computed server-side and sent over the live socket) reached the
learner's own screen and stopped there: `tutor_turns` had no column for
it, Oracle's `PersistTurnInput` had no field for it, and none of its
three `persistTurn` call sites passed one. `oracle/src/tutor/prompt.ts`'s
`narratesUnshownGrowth` check actively forces a repair loop whenever the
model narrates a growth story without drawing a board, so this is not a
rare feature — any savings/growth-sequence lesson is steered toward
using it. The result: every session that used the whiteboard lost it,
silently, on replay AND on the guardian transcript viewer, which
`/ORACLE.md` §12's own table claimed (inaccurately, until this fix)
shows "the segments alongside how the learner did on them."

Fixed across all four layers, each verified independently:

- **Oracle**: the SAME server-computed wire object (`wireBoard` in
  `ws/server.ts`'s `deliver()`) is now captured once and threaded to both
  the wire `send()` and `persistTurn()` — never recomputed a second time
  for storage. `WireWhiteboard` extracted as a named, exported type in
  `ws/protocol.ts` so `core/client.ts`'s `PersistTurnInput` shares the
  exact shape rather than a second, driftable one.
- **Database**: migration `0058` adds one additive, nullable `jsonb`
  column to `tutor_turns`. NULL for every row written before this
  migration, exactly as a replay of an old session already shows today.
- **Backend**: `TutorTurnRow`/`InsertTurnInput` gain `whiteboard`;
  `insertTutorTurn` writes it, `listTutorTurns`'s SELECT names the
  column, and the internal `/turns` route's Zod schema validates a
  closed, `.strict()` shape at the edge before it ever reaches storage.
- **Frontend**: `TranscriptTurn`/`ReplayBeat` gain `whiteboard`;
  `buildReplayScript` carries it through to the tutor beat that drew it
  (null on every other beat kind, since nothing else ever performs one);
  `ReplayInWorld.tsx` renders it with the SAME `TutorWhiteboard`
  component the live view already uses — no new render logic invented,
  because the shape it draws is exactly the shape now stored.

Proven with a real, end-to-end chain of tests, one per layer: a real
live-socket test (`oracle/src/__tests__/live-session.test.ts`) proving
the persisted transcript row carries the same values sent over the wire;
a service-level test (`backend/src/__tests__/tutorData.test.ts`) proving
`insertTutorTurn` sends the board exactly as given and `listTutorTurns`
selects it back; and two frontend tests (`replayScript.test.ts`,
`replayInWorld.test.tsx`) proving a stored board reaches its beat and
actually renders, while a beat with none draws nothing. Every one of the
five confirmed to fail against the pre-fix code for the exact claimed
reason via `git stash`, passes against the fix. `/ORACLE.md` §12's own
table corrected in the same commit. Full oracle suite green (479 tests,
up from 478), full backend suite green (644 tests, up from 641), full
frontend suite green (1443 tests, up from 1439), lint and type-check
clean on all three, `npm run db:reset` succeeding twice locally, database
types regenerated, root `tools:test`/`docs:check`/`secrets:check`/
`provider:check`/`i18n:check` all clean, `verify:tutor-ui` green.

**MEDIUM, coverage gap, not a proven defect** — `frontend/scripts/verify-tutor-ui.mjs`
(the real-pointer-event hit-testing gate built after the §1.14
synthetic-click incident) only ever drives the `conversing` phase, never
`replaying`. Structural reasoning suggests the replay transport is safe
(it portals into the SAME dock container the conversing phase's controls
already use and already get hit-tested, and the 3D canvas paints below
it under normal stacking with no competing z-index) — but that is
reasoning from the CSS, not a real-pointer-event measurement, and this
codebase's own §1.14 lesson is precisely that this kind of reasoning
previously shipped a fully unclickable surface. Left as a noted gap
rather than a fix in this round: extending the gate to a second phase is
a separate, larger task than the confirmed defect above, and no evidence
of an actual reachability problem exists — only an absence of the proof
that would rule one out.

## Five real defects in segment grading and preferences — a score could regress, a crash could poison the mastery model, and a companion could become itself — found by adversarial review, closed 2026-08-30

Round 36 reviewed `POST /tutor/segments/:segmentId/grade` and
`PUT /tutor/preferences` end to end for the first time this campaign —
everything on the grading route BEYOND the two issues already closed
earlier today (XP could never exceed a segment's own worth; the daily
XP cap is now atomic).

**1. HIGH — the stored score could go DOWN.** `recordSegmentResult`
overwrote `tutor_segments.score` unconditionally on every grade call,
with no comparison against what was already recorded. A client retry, a
double-tap, or a learner tapping back into an already-passed segment and
answering worse the second time could flip a correct result to
incorrect in both the guardian-visible session replay
(`GET /sessions/:id`) and the cross-session memory digest's
`gradedCorrect` count, which reads `score >= PASS_THRESHOLD`.

**2. LOW/MEDIUM — `attempts` was the client's claim, not a server count.**
The stored `attempts` column, and the ordinal fed into FSRS review
scheduling (`ratingFromScore`), came straight from the client-supplied
`attemptNumber` — a client could always claim 1 regardless of real retry
count, and two submissions of the same ordinal recorded indistinguishable
evidence twice.

**3. MEDIUM — a crashing grader was invisible AND poisoned the mastery
model.** `catch { outcome = { score: 0 }; }` swallowed the exception with
no logging at all, and (for a KC-mapped segment) fed the forced
`score: 0` into `recordAttempt` as if it were a genuine wrong answer —
proven live: with the fix reverted, a crashing grader produced a real,
signed pedagogy echo with `correct: false` and an updated `pKnownAfter`,
corrupting BKT/misconception tracking with a false negative caused by a
code bug, not the learner's understanding. A content/grader defect looked
exactly like a learner who keeps failing, with zero server-side signal
(§1.14 "blind flight").

**4. MEDIUM/HIGH — the "companion can't be the tutor" invariant was
checked against the wrong thing.** `PUT /tutor/preferences` compared
`companion`/`character` only when BOTH were present in the same request
body — so a two-step sequence (a PUT that sets `character`, then a later
PUT that sets only `companion`) never tripped it, because the second
request's body never mentioned `character` at all. The invariant is
about the PERSISTED state, not one request body.

Fixed:

- `recordSegmentResult`'s `score` argument is now `Math.max(row.score ?? score, score)` —
  the VERDICT returned to the learner still reflects what they just did
  (honest immediate feedback); only the persisted record floors at the
  best result ever seen for that segment.
- `attempts` (both the stored column and the ordinal passed to
  `recordAttempt`) is now derived from `row.attempts + 1`, capped at 3,
  never from the client's `attemptNumber`. This does not by itself detect
  a true network-level duplicate request (that needs a client-supplied
  idempotency key, a larger change this round does not make), but it
  closes the specific client-trust gap and gives every recorded attempt a
  distinct, correctly ordered number.
- A grader crash now logs `console.error` with the segment type and id,
  and `recordAttempt` is skipped entirely when the grader threw
  (`!graderCrashed` gate) — the learner still gets a safe, scored
  response, but nothing reaches the mastery model on a turn that carried
  no real evidence.
- `PUT /tutor/preferences` now reads the learner's CURRENT stored
  preferences first and validates the companion/character invariant
  against the MERGED result (this patch applied on top of what is
  already saved), exactly what `upsertTutorPreferences` is about to
  write.

Proven with five new tests in `backend/src/__tests__/tutor.test.ts`, one
per finding, including a "sanity check" test proving the grader-crash
fixture is genuinely capable of reaching `recordAttempt`'s `kc_attempt`
insert when nothing crashes — so the negative result in the crash test
means what it claims, not merely "the KC fixture was incomplete." All
five confirmed to fail against the pre-fix code for the exact claimed
reason via `git stash` (the pedagogy-poisoning test's pre-fix failure
output shows the actual corrupted echo: `correct: false`, a real
`pKnownAfter`, a validly signed token — not a hypothetical). Full backend
suite green (650 tests, up from 644), lint clean, type-check clean, root
`docs:check`/`secrets:check`/`i18n:check` all clean.

**Verified sound in the same review, not re-fixed:** segment-creation
IDOR (a browser has no path to fabricate a gradable segment — creation
is internal-key-only); malformed/adversarial `answer` payloads (all
seven grader families are defensively type-guarded, no `eval`/dynamic
regex, body size capped globally at 64kb); rate limiting (the grading
route is covered by the standard app-wide limiter, nothing exempts it);
the closed vocabularies on `character`/`companion`/`diorama`/`backdrop`/`adaptations`
(Zod-enum-validated against the same constants Core defines, rejected
before ever reaching storage or Oracle); nickname moderation (already
fixed earlier today, reconfirmed still in place by reading).

## A redundant fetch could double-count as failure, and the whiteboard's own schema never told the model it existed — found by adversarial review, closed 2026-08-30

Round 37 reviewed the whiteboard's server-side arithmetic
(`oracle/src/tutor/whiteboard.ts`'s `computeSequence`, the feature round
35 just gave a persistence path) and the V3 learning-map route
(`backend/src/services/pedagogy/tutorMap.ts`) — both genuinely
unreviewed by this campaign until now.

**1. MEDIUM — the learning map's `continueTarget` doubled its own read
cost and collapsed a real failure into "nothing to continue."**
`buildTutorMap` fetches `kc`/`kc_edge`/`learner_kc_mastery`/`memory_card`
to build the map, then called `buildSessionPlan` — which independently
RE-FETCHED the exact same four tables a second time, purely to answer
"what would today's session open with." That doubled the route's read
cost, and silently conflated two different things into the identical
`continueTarget: null`: a learner who genuinely has nothing to continue,
and the redundant re-fetch itself failing on a table the map's own read
of that exact table had just succeeded against — the §1.14 pattern this
codebase keeps finding in new shapes.

Fixed by extracting the planner's review+frontier ranking
(`rankPlanKcs` in `sessionPlan.ts`) as a PURE function over already-fetched
rows — no I/O, cannot fail. `buildTutorMap` now calls it directly with
the rows it already holds; `buildSessionPlan` (used elsewhere, e.g.
session creation) calls the same pure function internally and keeps its
own fifth read (`misconception`s) for callers that actually need them —
`continueTarget` never surfaced misconceptions, so the map route no
longer fetches them at all. Proven with two new tests in
`backend/src/__tests__/tutorMap.test.ts`: the four tables are each read
exactly once with zero calls to `misconception`; and a map still comes
back fully populated in a scenario where the OLD redundant second fetch
would have failed (impossible to trigger against the current code,
which is exactly the point — the failure mode no longer exists). Both
confirmed to fail against the pre-fix code for the exact claimed reason
via `git stash`. Full backend suite green (backend + `tutorMap.test.ts` +
`pedagogy.test.ts`: 97 tests together, all passing), lint clean,
type-check clean.

**2. MEDIUM — the whiteboard's own schema declaration never told the
model the field existed.** `TUTOR_SYSTEM_PROMPT`'s "The object has
exactly these fields:" JSON-shape block never listed `whiteboard` at
all — the only place the model was ever told to set it was 35 lines
later, inside one worked pedagogical example, with `multiply_percent`
never named or explained anywhere in the prompt. This is a plausible
root cause of an ALREADY-measured symptom this same file's own
`narratesUnshownGrowth` comment records: the real model sometimes
narrates a growth story and never sets `whiteboard` — indistinguishable,
from inside the model, from "this field does not really exist," because
the block that is supposed to be authoritative said so. Left
unexplained, `multiply_percent` was also a live risk in the OTHER
direction: per `whiteboard.ts`, it can only ever GROW a quantity (no
code path shrinks via percentage — `subtract` is the only way to
represent spending down, a discount, or loss), but a model reaching for
"multiply by a percent" by the more natural reading ("the new value IS
X percent of the old") would draw a board that GROWS while the
narration describes something SHRINKING — the exact drawn-vs-spoken
contradiction this whole feature exists to prevent.

Fixed by adding `whiteboard` to the schema block and explicitly naming
and defining all three step operators, with `multiply_percent` stated
as growth-only. Verified live (`tutor:converse` — the paid
`tutor-deploy step=converse` gate remains blocked by the same
account-wide billing issue tracked all session, so local runs are the
substitute evidence): whiteboard usage increased across runs post-fix,
including a correctly-represented decreasing story via `subtract`
("cada semana come 1 tonelada", 6→5→4→3→2→1→0) and, for the first time
observed this session, a correct `multiply_percent` growth story ("cada
mes crece 10%", 10→11→12.1→13.31) — neither pattern reproduced before
the fix. Full oracle suite green (479 tests), `verify:tutor` green,
lint and type-check clean. Documented as `oracle/AGENTS.md` item 42.

**Noted, deliberately NOT fixed this round — reachability or product
intent make a speculative fix worse than leaving it recorded:**

- **MEDIUM, ambiguous product intent — retiring a KC with live
  dependents silently unlocks them.** `kc_edge` carries no status
  filter, so an edge to a since-retired prerequisite drops out of
  `prereqsOf` entirely, and the dependent's `.every()` over an empty
  prerequisite list is vacuously true. Whether "a retired prerequisite's
  dependent becomes available" is the CORRECT degradation (arguably
  better than permanently locking content whose gate no longer exists)
  or a bug depends on a product decision about what "retired" means for
  a KC with live dependents — this needs a human call, not a guess.
  Requires a content-admin action to reach (retiring a KC), not
  user-triggered.
- **LOW, by design — `TUTOR_V3_BRAIN=false` and a genuinely empty/unseeded
  catalog produce byte-identical responses.** The route's own comment
  states this is intentional ("an unseeded graph yields an empty map,
  which the client says honestly"), and the flag defaults to `true` —
  disabling it is a deliberate operator action. A diagnostics gap for
  engineers debugging a misconfigured deploy, not a learner-facing harm.
- Rounding/float drift in `computeSequence` (e.g. `10 × 1.1³ =
  13.309999999999999`) is real but fully absorbed at DISPLAY time by
  `TutorWhiteboard.tsx`'s `Intl.NumberFormat({maximumFractionDigits: 0})`
  — confirmed the same component renders both the live and replayed
  board, so no broken bar height or spoken/drawn mismatch ever reaches a
  child on either surface. Not a defect.

## A rejected preference save could close the personalize picker as if it had worked, and an unguarded silence budget could end a hands-free turn almost instantly — found by adversarial review, closed 2026-08-30

Round 38 reviewed hands-free voice timing (`frontend/src/tutor/useHandsFreeTurn.ts`)
and the personalization/nickname save flow (`PersonalizeInWorld.tsx`,
`TutorExperience.tsx`, `stage/StageShell.tsx`, the lab's mock in
`TutorLabPage.tsx`) — neither previously touched by this campaign.

**1. HIGH — a rejected preference save left the picker believing it had
succeeded.** `onSave: (patch) => void` gave the caller no way to learn
whether a save actually landed. `commitNickname` returned `true` the
instant `onSave` was CALLED, not once it actually succeeded — the
client-side format check (`NICKNAME_PATTERN`) cannot replicate the
backend's real-name check (it has no access to the learner's
`display_name`), so a clean-looking value like "Ana Vasquez" sailed past
the client check, `onSave` fired, and the "I'm ready" button closed the
picker as if it had worked, while the server had actually rejected it
and the optimistic value never really saved — with nothing on screen
ever telling the learner or parent that anything had gone wrong.

Fixed by changing the contract to `onSave: (patch) => Promise<boolean>`
end to end: `TutorExperience.tsx`'s `persistPreferences` now applies the
patch optimistically (so the picker still feels instant), captures the
PRIOR state inside the `setState` updater — the only place it's actually
available — and rolls back to exactly that prior state if
`savePreferences` comes back without data, resolving `false`.
`PersonalizeInWorld.tsx`'s `commitNickname` is now `async`, awaits the
real result, sets a new `tutor.personalize.nicknameRejected` error
("That nickname didn't work. Try a different one.", all 3 locales) on
failure, and the "I'm ready" press only calls `onDone()` when the save
actually succeeded — a rejected save now keeps the learner on the
picker with a visible reason, instead of silently discarding their
correction. All 5 fire-and-forget `onSave(...)` call sites (tutor
choice, companion toggle, island choice, light, adaptation toggle)
updated to `void` the now-Promise-returning call.

Verified live in `/dev/tutor-lab`: with the lab's mock forced to reject
every save, changing the nickname and pressing "I'm ready" left the
learner on the personalize screen with the new error banner visible,
at both desktop (~1280px) and mobile (~375px) — screenshotted at both.
The first attempt at this looked like the fix had failed (surface still
advanced to `introducing`), which turned out to be an artifact of the
lab's OWN mock: it called `setPreferences` unconditionally regardless of
the returned success value, so the input's `onBlur`-triggered commit
optimistically wrote the new nickname into `preferences` even though it
"failed" — by the time the "I'm ready" click's own `commitNickname` ran,
`next === preferences.nickname` was already true and it short-circuited
to `true` without calling `onSave` a second time. Production's real
`persistPreferences` does not have this problem (it rolls back on
failure); only the lab's simplified mock needed a truer rejection
(dropping its own optimistic `setPreferences`) to prove the fix
correctly. Confirmed via `git stash` that the pre-fix code let `onDone`
fire regardless of `onSave`'s result. Full frontend suite green (126
files, 1445 tests), lint and type-check clean, `i18n:check` green for
the new key.

**2. MEDIUM, not reachable through any code path shipped today — an
unguarded silence budget could end a hands-free turn almost instantly.**
`useHandsFreeTurn.ts` passed the server-sent `listenSilenceMs` straight
into the turn detector's policy with no floor. `ws/protocol.ts`'s own
comment already warns "a zero here would cut a child off the moment
they drew breath," but nothing on either side of the wire actually
enforced positivity — every real value the server sends today is a
hardcoded positive constant (900–3500ms per strategy), so this was
latent, not live.

Fixed with a `MIN_LISTEN_SILENCE_MS = 500` floor applied via
`Math.max(MIN_LISTEN_SILENCE_MS, policyRef.current.listenSilenceMs)`,
well below every real production value so a healthy policy is
unaffected. Proven with a new test in `useHandsFreeTurn.test.tsx`
supplying `listenSilenceMs: 0`: `onTurn` is NOT called after ~200ms of
silence, and IS called once the floored 500ms budget is actually
reached. Confirmed to fail against the pre-fix code via `git stash`.

**Noted, deliberately NOT fixed this round — a half-built feature, not
a bug with a clear repro:**

- **`idleNudgeMs` is computed server-side per pedagogical strategy
  (`oracle/src/tutor/controller.ts`'s `IDLE_NUDGE_MS`), sent over the
  wire in the same `policy` object as `listenSilenceMs`
  (`ws/server.ts`, `ws/protocol.ts`), typed on the client
  (`useTutorSocket.ts`, `types.ts`) — and never read anywhere in
  `TutorExperience.tsx` or `useHandsFreeTurn.ts`.** No idle-nudge timer
  exists client-side; the value arrives and is discarded. This reads as
  an intentionally staged rollout (server-side plumbing landed ahead of
  the client behavior it's meant to drive) rather than a regression —
  there is no prior client implementation this could have broken. Left
  for a future round to either build the client-side nudge or confirm
  the feature is intentionally deferred.

## An invalid whiteboard.unit discarded a whole real turn, live, in this session's own testing — found and closed 2026-08-30

Not from the round-38/39 adversarial-review agents — from directly
playing the Tutor via `npm run tutor:converse` right after round 38
closed, per this session's own standing instruction to test live and
judge critically rather than only reviewing code. One of six scripted
conversations logged:

```
[oracle] discarded model turn (invalid_shape): whiteboard.unit: Invalid option: expected one of "day"|"week"|"month"|"year"
```

The model had set `whiteboard.unit` to something outside the closed
four-value enum. `TutorTurnSchema`'s `.strict()` parse failed on the
WHOLE object, so a real, well-taught reply was thrown away over one
cosmetic field, and the retry that followed had no idea what to fix:
unlike every OTHER repairable fault this orchestrator's retry loop
handles (`wrongUnit`, `missedWhiteboard`, a repeated sentence, a
self-answered question — each sets a `turnCorrection` string the retry
prompt actually reads), a schema-level `invalid_shape` failure sets
none, so the one retry is a blind re-ask.

This is the SAME class of defect `turnSchema.ts` already documents
twice over — `preferredTypes`'s doc comment, and the `emotion`/`action`
"A GESTURE IS NOT WORTH A LESSON" block from 2026-08-29 (a model chose
an out-of-enum `action` twice in a row and a child got "Se me
enredaron las ideas" instead of a lesson, over a wave-vs-nod mismatch).
`whiteboard.unit` just hadn't been given the same treatment yet.

Fixed the same way: in `parseTurn` (`oracle/src/tutor/turnSchema.ts`),
before validation, a `whiteboard` that fails `WhiteboardSchema.safeParse`
on its own is dropped to `null` wholesale — not patched field-by-field,
so a bad `op` or `currency` degrades exactly the same way a bad `unit`
does. `say`, `next` and `segmentRequest` are untouched; only the bonus
visual is lost for that one turn. Two new tests added to
`oracle/src/__tests__/session.test.ts` proving this directly against
`parseTurn`, confirmed to fail without the fix via `git stash` (both
failed with `expected false to be true`, matching the pre-fix discard).
Full oracle suite green (25 files, 481 tests), lint and type-check clean
(including `tsconfig.scripts.json` and `tsconfig.test.json`),
`verify:tutor` and `verify:pedagogy` both green. Documented as
`oracle/AGENTS.md` item 43, which also names the general lesson: this
codebase now has three independent instances of "an optional field's
closed vocabulary lives inside a `.strict()` object that gates the
entire turn" — the next new one should be checked against this list
before it becomes a fourth.

No live re-verification via `tutor:converse` for this specific fix —
unlike round 37's prompt-wording change, this fix touches parsing logic
only, not the prompt, so its correctness is fully determined by
`parseTurn`'s own code path and is exhaustively covered by the two new
unit tests against the real function; spending a paid conversation
hoping to re-trigger a rare model mistake would be a worse test of a
deterministic code path, not a better one.

## A specific, labeled, tappable map node can silently start a fully generic chat — proven, deliberately NOT fixed, needs a product decision — round 39, 2026-08-30

Round 39 reviewed the frontend learning-map surface
(`frontend/src/tutor/map/MapGraph.tsx`, `OfferChips.tsx`) against the
`/tutor/map` contract round 37 changed — genuinely unreviewed by this
campaign since rounds 11/21, both of which predate round 37.

**MEDIUM, proven, needs a human product call before fixing.**
`TutorMapNode.skillKey` is `kc.skill_key`, which
`database/migrations/0052_kc_graph.sql` documents as an ordinary,
expected transient state: "Several KCs may share one skill_key; NULL
means no published pool yet." Nothing in `deriveNodeState`
(`backend/src/services/pedagogy/tutorMap.ts`) excludes an unbridged KC
from rendering `available`/`in_progress`/`needs_review` — all tappable
states — so a node can legitimately show a specific title as "Ready to
learn" while carrying `skillKey: null`.

`OfferChips.tsx`'s `pickNode`/`startInputForNode` turns a tap on such a
node into `{ intent: 'open' }` — byte-identical to what the fully
generic "Ask me anything" chip sends, with no `kcKey`, no title, nothing
tying the new session back to what was tapped. A child sees "Dar
cambio — Ready to learn," taps it expecting that lesson, and gets a
topic-blind open conversation with no idea anything was tapped at all.
Proven with a throwaway RTL test rendering the real `OfferChips`, a
node with a real title and `skillKey: null`, clicking it, and reading
the `onStart` spy's call: `{"intent":"open","wantsVoice":true}`.
`continueTarget` (the map's own headline CONTINUE button) can degrade
the identical way.

**Why this is not fixed this round.** Every fix considered changes
child-facing product behavior, not just code:
- Restricting such a node's clickable states would hide content a
  learner may legitimately be able to review/practice, contradicting
  what `deriveNodeState` currently intends `available`/`needs_review`
  to mean.
- Showing an honest "not ready yet" message instead of launching a
  session is a real UX/copy decision on a child-facing surface, not a
  mechanical bugfix.
- Threading the node's own `kcKey`/title into the session so the tutor
  at least knows the intended topic even without a bridged skill pool
  would be new data reaching the model's context — and this repo's own
  documentation stewardship table is explicit: "a new field reaching
  the model ALSO needs `/LEGAL/AI_TUTOR_LEGAL_REVIEW.md`." That is a
  legal-review-gated change, not a same-round fix.

Left for a human to choose a direction (hide/gray the node, show an
honest in-place message, or scope a `kcKey`-context-passing feature
with its required legal review) before any of the three gets built.
`git status --porcelain` confirmed clean after the review (the
throwaway test and an incidental `frontend/package-lock.json` diff from
a worktree `npm install` were both reverted).

Also confirmed sound this round, no fix needed: round 37's `rankPlanKcs`
contract shape is consumed correctly end to end; the already-fixed
locked-node prerequisite-naming bug (commit `06e27d84`) holds under
`MapGraph.tsx`'s current code; `refreshOffersAndMap` is wired into
every phase transition that actually needs a re-fetch after grading;
map nodes are real `<button>` elements with no synthetic-click or
z-index concern; i18n parity holds for `tutor.map.*` in all 3 locales.

## Two real HIGH findings from round 40 — a spoofed birth date bypassed the §1.9 age floor, and the FAQ intent's "closed" question set was not closed — found by adversarial review, closed 2026-08-30

Round 40 reviewed the two Tutor session-start paths no prior round had
touched — `faq`/`diagnostic` intents and the course-placement
conversational intake — and found both real, both HIGH.

**1. HIGH, child safety — a client-supplied `birthDate` in
`POST /placement/:courseSlug/intake` overrode the learner's own
verified profile, bypassing the §1.9 age floor.** `IntakeBody` accepted
an optional `birthDate`, and the gate read
`ageBandForIntake(parsed.data.birthDate ?? profiles[0]?.birth_date,
new Date())` — the CLIENT value took priority. `GET /intake` (used only
to decide whether to show the UI) correctly derives the age band from
the profile alone; the `POST` that actually sends free text to a
third-party model did not. A crafted request with a fabricated adult
birth date bypassed the floor for an account whose real, on-file birth
date belonged to a child under 12 — sending their words to the model
and, as a direct consequence, disabling `placementIntake.ts`'s
`requireModelPass` (the fail-CLOSED moderation guarantee meant for
exactly that population; `oracle/src/safety/moderation.ts` fails OPEN
when it's false and the judge is briefly unavailable). No legitimate
caller ever sent this field — `PlacementPage.tsx`'s only POST body is
`{ learnerText, neutralReflection }` — so it is removed entirely rather
than reprioritized: the gate now reads only `profiles[0]?.birth_date`,
matching `GET /intake` exactly. New test in `placement.test.ts` proves
a real under-12 profile is refused even when the request tries to
assert an adult age; confirmed to fail without the fix via `git stash`
(the pre-fix code returned `available: true`).

**2. HIGH — the FAQ intent's "closed, human-written question set" was
enforced nowhere, and even a legitimate id never reached the model as
an actual question.** Two compounding defects in one path:

- `backend/src/routes/tutor.ts`'s `/offers` route commented the FAQ
  list as "A closed, human-written question set. Never a free-text
  box" — but `StartBody`'s `skillKey` was `z.string().min(1).max(128)`
  regardless of `intent`, so `POST /sessions` with
  `{ intent: 'faq', skillKey: <any string> }` was accepted outright,
  including instruction-shaped text. That string reached Oracle's
  `plan.ts` as the lesson's `objective` — a live prompt-injection
  channel, reachable by any authenticated account including a `kid`.
  Fixed by extracting the list to a shared `FAQ_IDS` constant and
  adding a `.refine` on `StartBody` rejecting any `faq` session whose
  `skillKey` isn't one of the four published ids. New test in
  `tutor.test.ts` proves an instruction-shaped `skillKey` is rejected
  (`400 VALIDATION_ERROR`) and a real FAQ id is accepted; confirmed to
  fail without the fix via `git stash`.
- Even a legitimate FAQ id never became the actual question. Oracle's
  `buildPlan` (`oracle/src/tutor/plan.ts`) has no access to the
  frontend's i18n catalog where the curated question text lives (`why
  prices change?`, etc.) — the two services deploy independently — so
  the raw slug (`why_prices_change`) fell straight through to
  `subject` and became the entire lesson objective: `Teach one real
  idea about "why_prices_change" until the learner can use it.` The
  model was never told this names a question, in a session whose
  spoken locale it doesn't even match (the slug is always English).
  Fixed with a small closed `FAQ_TOPICS` map translating each of the
  four ids to a readable English phrase; an id outside the map
  degrades to the existing no-subject objective rather than a broken
  slug. Two new tests in `plan.test.ts` prove the readable phrase
  appears and the raw id never does; confirmed to fail without the fix
  via `git stash`.

Both fixes documented as `oracle/AGENTS.md` item 44 (the plan.ts half)
and this entry (the backend halves). Full suites green: backend (39
files, 654 tests), oracle (25 files, 483 tests). Lint and type-check
clean in both services (including `tsconfig.test.json` and, for
oracle, `tsconfig.scripts.json`). `verify:tutor` and `verify:pedagogy`
green. Root `docs:check`, `secrets:check`, `i18n:check`,
`provider:check`, and `tools:test` (26/26) all green.
