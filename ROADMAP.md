# ROADMAP.md — Architecture & Sprint Plan

> Authority: second only to /AGENTS.md. Architecture decisions recorded here; the running log lives in WALKTHROUGH.md.

## Architecture summary (locked 2026-07-11)

Independent services (no npm workspaces): **Vault** (Supabase self-hosted on Railway), **Core** backend, frontend (Vercel), **Forge** coursegen, **Echo** audiogen, **Prism** picturegen (added 2026-07-23, owner-directed: the only image-generation path — art-director judge + Qwen `qwen-image-max` + Depot storage + Vault request-cache; Gemini discarded, quota-0), **Guardian** parent-id-check, **Courier** email-server, **Data Intel** dataintel (added 2026-07-29 — DuckDB analytics warehouse: segmentation, forecasting, anomaly detection, experiments) — all TypeScript + Express + Node 24 except Vault (SQL + tooling). Six roles, four product sections, 3 locales, light/dark. Full tables: /AGENTS.md §1.2–§1.5.

Forge keeps DeepSeek as the preferred author and Qwen as the independent judge. A retryable DeepSeek transport failure or provider-local DeepSeek 402 balance failure may route one author call to the already-required Qwen provider, while preserving ledger accounting, deterministic gates, review, and human release. Invalid credentials, malformed requests, and billable empty completions remain fail-closed.

Prism's generated-art identity is strict two-dimensional flat educational vector illustration. Its global and object-tile cache discriminators are versioned for a visual-identity change, so new candidate requests never reuse earlier 3D-looking art; only defect-exclusion-only hardening preserves cache reuse.

## Sprint: v2 bootstrap (goal — 100% functional scaffold + first vertical slice in < 1 week)

### Day 1 — Reset & agent environment ✅ DONE
Wipe v1 (main intact) · root scaffold · AGENTS/CLAUDE + agent/ + all root docs · repo-map tooling.
**DoD:** gates runnable (`docs:check`, `secrets:check`), docs complete, pushed. — met.

### Day 2 — Service scaffolds ✅ DONE
Stamp the 6 Express services + database/ (migrations 0001 identity + 0002 provisional content) + frontend (Vite/React/Tailwind/i18n×3/dark/5 sections/characters).
**DoD:** `npm install && npm run type-check && npm run lint && npm test` green in all 8; frontend `npm run build` passes. — met.

### Day 3 — CI + green pipeline ✅ DONE
8 path-filtered workflows · push · all runs green · repo_map regenerated · doc-sync ritual executed once for real.
**DoD:** `gh run list` fully green on littlefounders_v2. — met.

### Day 3.5 — Design system ✅ DONE (landed ahead of schedule)
`DESIGN.md` authoritative — **LittleFounders Arcade** (Brilliant.org-style gaming clarity + liquid glass; replaced the initial claymorphism system on 2026-07-12, `template/` deleted) · tokens implemented (Tailwind + CSS vars, light+dark) · reusable UI kit (`frontend/src/components/ui/`) · views re-skinned · i18n fragmented per route area per locale · agent rules hardened: responsive (desktop+mobile) made a non-negotiable product invariant (§1.11), anti-hallucination/instruction-fidelity rules added (§1.12).
**DoD:** DESIGN.md authoritative, verified in browser light/dark + es-MX, CI green. — met.

### Day 4–5 — Vault deploy + auth ✅ DONE (deploy executed 2026-07-17, see Day 8)
**Stack source locked (2026-07-12): pinned `supabase/supabase` clone** (`database/SUPABASE_VERSION`, latest approved release — v1.26.07 today) drives local dev AND production; Railway services deploy the exact image tags from the release's docker-compose (pin table: `database/DEPLOYMENT.md`). ✅ Local stack running from the pin · ✅ migrations applied + reset-twice verified · ✅ signup bootstrap in DB (`0003`) · ✅ real generated types.
**Auth shipped (2026-07-12, local E2E-verified):** Core `/api/v1/auth/*` (signup/login/refresh/logout/me over GoTrue; local HS256 JWT verify; social-provider flow reserved — Google first, later Discord/Facebook) · frontend `/login` + `/signup` (Tutor-intent field; everyone starts `universal`) + `/verify-parent` · **Guardian v1 = local OCR (tesseract.js)**: stateless verdict endpoint, ID photo in-memory only (NEVER stored), Core writes `parent_verifications` (0004, isolated, RLS) + grants `parent` + audit.
**DoD (deploy phase):** live signup → session → `/health` chain across deployed Core. — met 2026-07-17 (see Day 8).

### Day 6–7 — First vertical slice + buffer
Signup → universal user → profile section → DiceBear avatar customization persisted, using the DESIGN.md tokens + UI kit; app shell (sidebar/dashboard per mockup) built responsive from the start (mobile bottom nav + desktop sidebar).
**DoD:** a real user can sign up, set an avatar, and see it persist — deployed, verified at mobile AND desktop.

### Day 8 — Production deployment ✅ DONE (2026-07-17)
`littlefounders_v2` squashed into a single commit on `main` (the branch stays intact, untouched from here on); `main` is now the only branch that deploys. Every `-b2c` domain uses the `<service>-b2c.littlefounders.ai` suffix convention (confirmed over the pre-existing `b2c-api` prefix style, which is retired).
**Railway (project `littlefounders-b2c`, one project, all services):** Vault deployed as 9 Railway services — `db` (custom Dockerfile wrapping the pinned `supabase/postgres` image + baked-in init SQL, `database/railway/db/`), `kong` (custom Dockerfile, `database/railway/kong/`, declarative config templated for Railway private networking), `auth`/`rest`/`realtime`/`storage`/`meta`/`supavisor`/`studio` (plain pinned-image services, `railway add --image`). `imgproxy` and `functions` (edge-runtime) are **not deployed** — no app code uses Supabase Storage transforms or Edge Functions (Depot/filebase covers all real media needs), and Railway has no equivalent of docker-compose's shared-volume dependency for imgproxy+storage; re-add both if that ever changes (`database/DEPLOYMENT.md`). Migrations 0001–0010 were applied during the initial rollout via `railway ssh --service db -- psql`; `0011_oauth_bootstrap` was applied in the OAuth follow-up. `Redis` (Railway-managed) added for backend's production rate-limit store (`REDIS_URL`, was previously untested — `NODE_ENV=production` switches `rate-limit-redis` on, no MemoryStore fallback in prod). Kong got a public domain (`auth-b2c`); backend/Core reused the pre-existing service (renamed project, not the service — still called `littlefounders-backend`) with a fresh domain (`api-b2c`, replacing the old `b2c-api`); filebase got `media-b2c`. coursegen/audiogen/parent-id-check are intentionally **not** publicly exposed (private Railway networking only, matches AGENTS.md §1.5 — never called from the browser).
**CD (all 7 app-facing services + frontend):** one `.github/workflows/<service>-cd.yml` per service, triggered by `workflow_run` on that service's CI succeeding on `main`, deploying via `railway up <dir> --path-as-root --service <name> --ci` (Railway) or the existing Vercel-CLI pull/build/deploy pattern (frontend). No service uses Railway's or Vercel's native GitHub-App connection — every deploy authenticates with a token secret (`RAILWAY_TOKEN`/`VERCEL_TOKEN`), per explicit instruction. All 6 Railway CD workflows fired automatically on the first real push and succeeded. `email-server` was still undeployed at this point — it went live the next day (see the 2026-07-18 entries below), making 17 Railway services total.
**Frontend (Vercel, existing project `littlefounders-ai`, reused):** real bug found and fixed during rollout — the project's Root Directory was unset (repo root) with a manual `cd frontend && ...` Build Command override, so Vercel never read `frontend/vercel.json`'s SPA rewrite and every deep link (`/signup`, `/login`, …) 404'd. Fixed by setting Root Directory = `frontend` and reverting to framework-default build/output (Vite auto-detected). Second real bug: `VITE_BACKEND_URL` was added as a Vercel **Sensitive** variable by default in the dashboard UI — sensitive values are write-only (never readable again, not even by `vercel pull`), so the build baked in the literal string `"[SENSITIVE]"` and every API call 405'd against the frontend's own origin. Fixed by deleting and re-adding the variable as non-sensitive (it's a public URL anyway, already visible in the shipped JS bundle). Real signup verified end-to-end in a browser against the live stack (Vercel → Core → Kong → GoTrue → Postgres → authenticated dashboard).
**Postgres backups + restore drill: DONE (2026-07-17), interim shape.** The original plan (a dedicated Railway volume + service for backups) was blocked mid-implementation when the Railway trial expired ("Your trial has expired. Please select a plan to continue using Railway," new resource creation refused) right after the 16 services above were already up — `db` can only hold one volume (already `PGDATA`), so a second volume needed a new service. Pivoted to a shape that needs zero new resources: `.github/workflows/vault-backup.yml` (daily + on-demand) runs `pg_dump` inside the `db` container via `railway ssh` and pipes the dump straight onto **filebase's (Depot) existing Railway volume** — a genuinely separate disk/service from `db`'s, reached by writing to the container filesystem directly (not filebase's HTTP API, whose mime-type whitelist is for media, not backups). A dedicated SSH keypair was registered with Railway for this (`RAILWAY_SSH_PRIVATE_KEY` secret, separate from any personal key). One restore drill was performed for real: a production dump restored into a scratch database, row counts verified against live data, scratch database dropped. **Revisit once Railway billing is resolved** — a properly separate, dedicated backup volume is still the better long-term shape than sharing filebase's. Also open: the `littlefounders.ai` GoDaddy registration was 8 days from expiry at deploy time and Vercel had a separate failed-payment notice — both need the account owner's action, not an agent's. `GOTRUE_MAILER_AUTOCONFIRM=true` in production is a deliberate interim tradeoff (Courier/email-server isn't deployed yet, so real email confirmation isn't possible) — flip it once Courier ships; until then, signup emails are never verified against mailbox ownership. (**Resolved 2026-07-18:** Courier shipped, GoTrue now sends real confirmation mail through it, and this flipped to `false`.)
**DoD:** ✅ live signup → session → `/health` chain across deployed Core — verified in a real browser, production data.

## Immediate next step

**Pulse (observability) adopted 2026-07-20** (`pulse/AGENTS.md` authoritative;
owner sign-off for the §1.2/§1.5 change recorded in WALKTHROUGH.md): self-hosted
Plausible CE v3.2.1 + Umami v3.2.0 + Uptime Kuma 2.4.0 as five pinned Railway
services, Dependabot-auto-bumped, daily pg_dump backup, data read only through
Core `/api/v1/admin/*`. Feeds the admin/superadmin console's Analytics & Health
panel. Umami behavioral capture is §1.9-fenced to marketing + parent/admin
surfaces (never kid sessions). Remaining manual step: GA4 historical import
(GCP OAuth app — runbook in `pulse/README.md`).

**Lesson Engine v1 shipped 2026-07-12** (`/LESSON_ENGINE.md` authoritative):
56 exercise types across 8 families in `frontend/src/lesson-engine/`, fullscreen
player (cheer/arcade modes, streak/XP/hints, tiered growth-mindset feedback),
Character Control rig over the 4 canonical characters, `/dev/lesson-lab` harness,
229 frontend tests. Grading runs behind a pluggable boundary — the local grader
is dev-only; production grading lands in Core with the content-schema session.
**Course platform shipped on top of it (2026-07-12, same session, `/COURSE_ENGINE.md`
authoritative):** real hierarchy in Vault (0007: courses→adventures→sagas→topics→
lessons→lesson_documents; answer keys service-role-only), server-authoritative
grading + progress/XP in Core (`/api/v1/learn/*`, unlock rule computed in one
place), the gamified adventure-map course viewer (6 CSS-drawn world scenes,
per-lesson path nodes, auto-scroll to current), the new **Depot** (`filebase/`,
4006) media-storage service with CI, **Echo** implemented (qwen3-tts-flash →
mono MP3 → Depot, operator-triggered batch), and **Forge** fully implemented
(catalog → plan → write → 5 deterministic gates incl. Piaget vocabulary +
arithmetic re-execution → independent Qwen judge → structure-frozen localization
→ Prism/Qwen `qwen-image-max` illustrations → publish-as-review) with the complete **Educación
Financiera catalog: 1,312 lesson blueprints** — 864 teaching (tier2 sagas
expanded to 8 topics) + 448 spaced-review (COURSE_ENGINE §3.1 ladder: per-saga
Cofre del Repaso + Reto Entrelazado, per-adventure La Gran Misión review saga;
34% consolidation, ~3.6 years at 1/day) + concept metadata (§3.2: 216
parent_check mastery gut-checks, 43 hard/soft prerequisite edges with reasons —
the future placement DAG) + adult register plumbing (§3.3: --register adult
regenerates, never filters) + gate 6 anti-genericity + concreteness judge
dimension + connect-to-prior prompt discipline, `catalog:check` green. E2E browser-verified:
login → adventure map → real lesson → Core-graded verdicts → complete → XP/streak
→ next lesson unlocked; both breakpoints, light+dark. 524 tests across services.

**The lessons platform is COMPLETE (2026-07-13):** three full course catalogs —
financial-education 1,312 · entrepreneurship 1,408 · investing 1,472 (tier3
debut) = **4,192 blueprints, catalog:check 0/0** — plus migration 0008
(tier1|2|3, `courses.requires`), multi-course catalog:check, and the 3-course
sequence seeded (FE published, the other two draft until generated). Estimated
full FE generation run: ~$225–320 USD all-in (text+TTS×3+images), ~5–6 GB in
Depot, ~1.5–3 dedicated days; calibrate with a one-slot, cost-capped visual
pilot first.

**Pipeline QA-ready, not yet executed (2026-07-13):** Forge gained
`forced_types` (COURSE_ENGINE §4 addendum — pins a lesson's exact segment
skeleton, skipping the plan-stage LLM call) and Echo gained the real
per-character × per-locale **voice map** (`voiceFor()` — story/scene speaker →
segment narrator → locale default, 12 optional override env vars). A 4th,
non-shipping course — `first-lemonade-stand` (62 lessons: one per each
of the 56 LESSON_ENGINE types, 4 sequencing combos, a review-layer check) —
exercises text, all gates, the judge, both localizations, images, and (once
narrated) Echo end to end for a fraction of a real course's cost. Prism is the
only image path and fronts Qwen `qwen-image-max`; it was verified separately when
the service was introduced. Not yet run — `npm run generate -- --course
first-lemonade-stand` still costs real money and needs a go-ahead;
character voice files are pending (owner to provide the location).

Next, in Jesús's stated order of interest:
- **Execute the Forge run for Educación Financiera** (operator-triggered:
  `npm run generate -- --course financial-education`; needs configured Prism
  and character voices for Echo; lessons land as `review`, then require a full
  `verify:course` attestation and audited Core release; first run the
  one-slot zero-cost dry-run, then a USD 0.50 one-slot `--require-images`
  admission probe (one worker, 300-second request timeout and the 16,384-token
  document ceiling). Forge reserves the full worst-case visual bundle before
  drawing its first image, so the probe cannot spend on a partial unreleasable
  lesson. A complete visual lesson uses a separate human-approved cap sized to
  its target count; review its ledger before any full-track spend. A
  `--no-images` pass is non-releasable by the visual coverage gate.)
- **Kid accounts from the Tutor dashboard** — creation + guardian linking UX
  (Testing Tutor ↔ Testing Niño seed pair exists for this).
- **Admin Generation Dashboard v2 (2026-07-27 — Phase 1 + 2 shipped):**
  - ✅ Phase 1 (backend + coursegen): Live telemetry (0018), `liveTelemetry.ts`, Core endpoints `/admin/generation/live` + `/admin/generation/analytics`.
  - ✅ Phase 2 (frontend): React Flow interactive canvas (`PipelineFlow.tsx`), live stats panel with 2s polling (`LiveStats.tsx`), cross-run analytics charts (`AnalyticsCharts.tsx`), three-tab layout (Live Monitor / Run History / Analytics) in `/admin/generation`. i18n in 3 locales.
- **Admin dashboard hardening (2026-07-28 — shipped):**
  - ✅ Content + Moderation merged into single unified page (`/admin/content`).
  - ✅ Admin Users stats bar — role/local/age group distributions with charts.
  - ✅ Signup timeline chart — SVG bar chart with 30d/90d/1y period selector.
  - ✅ Email tracking infrastructure — migration 0021 (`email_logs`), email-server logger + `/api/v1/logs` endpoints, Core proxy `/admin/emails/*`, frontend email dashboard with pagination and KPI cards. **Made durable later the same day (uncommitted — ships with the resilience pass below):** the logger writes through to Vault with the service role (`src/db/emailLogsRepo.ts`) and the 1000-entry ring buffer survives only as the dev/test fallback; a second writer — the Haraka `log_delivery` plugin on `hook_queue_ok` — records GoTrue auth mail, which reaches the relay over SMTP :587 and never touches the HTTP API, so nothing in the repo had been capturing the platform's actual email.
  - ✅ Cybersecurity audit — 6 vulnerabilities fixed (Zod validation on unvalidated query params, proxy response shape validation, fetch timeouts).
  - ✅ Staff Tutor-upgrade card hidden for admin/superadmin.
  - ✅ React Router v7 future flags — silenced console warnings.
- **Insights — first-party learning/usage telemetry (2026-07-29 — in branch, NOT yet merged or deployed):** spec `/INSIGHTS.md`. Migration 0023 (consents + closed-vocabulary events + SQL views), Core ingest with the fail-closed kid consent gate, parent-dashboard consent toggle, `/admin/insights` (calibration/activity/families). Verified E2E on the local stack incl. the consent gate opening and closing. Pre-launch dependency: platform terms / privacy notice for ADULT collection; kid collection is already gated per family.
- **Platform resilience pass (2026-07-28 — in branch, NOT yet merged or deployed):** an adversarial defect sweep (40 candidates, 33 confirmed) whose fixes changed standing platform rules, not just code. Each rule and its reasoning: WALKTHROUGH.md Decision Log. Everything below is uncommitted on `fix/lesson-engine-hardening` and lands in the next PR — production still runs the code merged in #25.
  - ✅ Redis is a degradable dependency — Core listens before connecting, both limiters `passOnStoreError` (fail open), `/health` mounted above the limiter.
  - ✅ Read-modify-write reads distinguish "Vault did not answer" (`null` → 502) from "zero"; `POST /learn/lessons/:id/complete` can no longer erase a learner's accumulated totals.
  - ✅ Prism's HTTP status is Forge's retry instruction (502 transient / 422 terminal), and `BudgetExceededError` is rethrown so `FORGE_MAX_USD_PER_RUN` actually halts a paid run.
  - ✅ Internal-key comparison hashes both sides to fixed-width SHA-256 digests in all 7 services (a non-ASCII header used to throw `RangeError` → 500 HTML instead of a 401 envelope).
  - ✅ Repo-wide gates run without a path filter (`repo-gates.yml`); `check-secrets.sh` exempts declared placeholders, resolving a real conflict with §1.14.
- **Forge illustration provenance (2026-08-02 — local, not deployed):** migration `0032_lesson_illustration_style.sql` records the bundled Prism style on every published lesson document. Image inheritance and zero-spend backfill now accept only the current `FORGE_ILLUSTRATION_STYLE_VERSION`; legacy or NULL provenance is excluded, and `verify:course` fails closed until every release-ready document is style-attested. This prevents a Prism style upgrade from being bypassed by stale Vault URLs.
- **Prism prompt contract (2026-08-02 — local):** all object-tile purpose guides require an edge-to-edge pure-white canvas; the deterministic tile prompt is now a concise positive specification (literal object, centered, fully visible, flat 2D animated vector, clean geometric shapes, crisp contrast, bright colors) without LittleFounders or lesson context. Scene purposes retain complete contextual backgrounds. The mechanical negative list and pixel verifier remain unchanged.
- **Production migration handoff (2026-08-02 — pending sign-off):** a read-only probe on 2026-08-02 verified production Vault at migration `0022` exactly (the ledger's recorded `0011` was stale); with the repo at `0001`–`0033`, `database/scripts/railway-migrate.sh` provides the only approved remote path for the unapplied deltas `0023`–`0033`. It requires an explicit, independently verified baseline for a legacy ledger, supports a no-write dry-run, records immutable checksums, applies one migration per transaction before the service deploy and any paid generation, stays compatible with macOS Bash 3.2, and has a fake-Railway no-write integration test for its transport.
- **Echo audio preflight (2026-08-02 — local):** `narrate:all -- --course <slug> --dry-run` now counts pending narratable units, manifest entries and guard-blocked text without TTS, Depot, speech-cache or Vault writes. The live batch remains separately operator-triggered and cache/idempotency protected.
- **Echo pilot spend guard (2026-08-02 — local):** live batches accept the optional `AUDIOGEN_MAX_TTS_CALLS_PER_RUN` ceiling. Echo reserves calls immediately before synthesis, leaves exhausted lessons unversioned/retryable, and never counts cache hits or deterministic guard refusals. The setting bounds paid call volume; DashScope's current TTS price must still be read from the operator account before quoting a dollar total.
- **Financial-education pilot execution (2026-08-02 — local):** two authorized one-slot attempts spent USD 0.695262 in aggregate and produced no release candidate: one reached review but failed whole-bundle image admission, and the other was rejected after Qwen fallback retries for invalid dialogue characters and an empty rationale. DeepSeek returned HTTP 402 (insufficient balance) on both runs. No Prism image or Echo TTS call was made, and no Vault lesson was published; the ledgers remain diagnostic evidence for the next provider-approved attempt.
- **Financial-education pilot after DeepSeek top-up (2026-08-02 — local):** `live03` reached a valid DeepSeek plan/document and Qwen review, but Prism's actual Qwen pixels still violated the required object-tile canvas (colored/dark framed background) after 12 billed image attempts. Forge failed closed at USD 0.574790 with no localized publication. Direct visual probes confirmed that the current `qwen-image` behavior cannot yet satisfy the white-canvas contract; the next decision is an approved image-model/configuration change or a deterministic segmentation/cutout stage. Do not relax the verifier or start mass generation.
- **Concise Prism prompt experiment (2026-08-02 — local):** the object-tile positive prompt was reduced to five concrete visual requirements and removed all LittleFounders/lesson context. Prism tests remained green, but a fresh service probe still failed closed after three generated attempts; a separate direct `qwen-image` image showed a green outer background and rounded white card. Prompt simplification did not make the current model satisfy the pure-white canvas gate. Do not relax the verifier or start mass generation; the next decision remains an approved model/configuration change or a deterministic segmentation/cutout stage.
- **Prism model switch (2026-08-02 — local, owner-authorized):** Prism and Forge now default to `qwen-image-max`; the local `picturegen/.env` is configured accordingly, and the style/provenance discriminators advance to `v7-qwen-image-max-flat-vector` and `v8-qwen-image-max-object-white-flat-vector` so old `qwen-image` art cannot be inherited. The client now uses DashScope's synchronous multimodal endpoint and the model's square `1328*1328` preset. A single-object canary generated and passed Prism's pictorial and white-canvas gates. The official international list price is USD 0.075/image; the operator must still confirm the account's effective tariff/free quota before the pilot.
- **Forge schema-minimum prompt correction (2026-08-02 — local):** write prompts now print the real minimum collection sizes for the types present in each skeleton (including `sort_buckets.items >= 4` and `dialogue_choice.turns >= 2`). This preserves strict Zod/gate validation while preventing tiny shape placeholders from being copied as complete interactions. Type-check and the focused write suite pass.
- **Max visual pilot (2026-08-02 — local, owner-authorized):** `fe-pilot-financial-20260802-max-live01` failed closed on incomplete model output at USD 0.2321; the corrected `fe-pilot-financial-20260802-max-live02` published one `financial-education` lesson as `review` in `es-MX`, `en-US` and `pt-BR`. It placed 12 images from 14 fresh Max generations, consumed 70,352 tokens and cost USD 1.0880 estimated. Post-run Vault inspection found 3 localized documents, 10 segments each, current style provenance, 11 distinct Depot URLs all returning HTTP 200, and zero placeholder URLs. The candidate is not learner-visible until the human release RPC is intentionally invoked in production.
- **Data Intel production handoff (2026-08-02 — local):** added the missing `dataintel-cd.yml` workflow, gated on successful `dataintel CI` and deploying the service through the same token-based Railway path as the other app services. A regression test now pins the workflow's trigger, service name and Railway command. The live Railway inventory still needs the service instance and its variables created by the operator.
- **All-course graph + production preparation (2026-08-02 — local):** the derived competency graph now runs for every production course and its per-topic prerequisite/retrieval slice is injected into Forge PLAN, WRITE and REVIEW prompts. Added Data Intel's Railway runtime manifest, upload isolation and persistent DuckDB handoff contract. Added migration `0033_retire_unused_game_schema.sql` so the never-shipped game tables and telemetry are removed forward-only; production preflight now fails while the retired `gamegen` Railway service remains.
- **Release-gate coverage (2026-08-02 — local):** the root `run-all.sh` gate now includes every TypeScript service in the service map (including Prism, Depot and Data Intel). The expanded run fixed and regression-tested Data Intel's export-job `rows`/`row_count` SQL alias mismatch; all ten services pass type-check, lint, tests and build.

## Next up (post-sprint backlog, unordered)

- Guardian verification flow (provider decision: Stripe Identity / Persona / Veriff / manual)
- tutor/ Oracle MVP with moderation + cite-or-refuse posture
- tasks/ parent→kid assignment + rewards
- Character voices for Echo (voice map ready; owner supplies voices pre-run)
- **Game Engine — REMOVED 2026-07-31.** A `games/` section runtime (8 deterministic Phaser mechanics) and its Arcade content-generation pipeline (`gamegen/`) were designed and substantially implemented across 2026-07-30/31 on `feat/game-engine` (never merged, never deployed, no paid generation run ever executed). After several redesign passes the owner judged the result did not meet the bar for a real game experience and made the explicit call to remove the feature entirely rather than keep iterating — `gamegen/`, `backend/src/game-contract/`, `frontend/src/game-engine/`, the `/games` product section, and every cross-service integration point (admin generation monitor, family dashboard, dataintel funnels, Prism's game-illustration prompts) were deleted in the same session. Full narrative: WALKTHROUGH.md decision log. Do not re-attempt this feature from the old spec — start any future games effort from a fresh design brief.
- Courier: **DONE + LIVE 2026-07-18** (Haraka → Amazon SES relay) — deployed as the 17th Railway service, GoTrue points at it, `GOTRUE_MAILER_AUTOCONFIRM=false`, branded trilingual auth mail delivering through SES in production. Old Resend DNS/records retired. Only optional leftover: set `EMAIL_SERVER_LIVE=true` to activate the email-server CD workflow (email-server/README.md)
- Google social login: **LIVE 2026-07-20** — Google Cloud OAuth client "LittleFounders v2 (GoTrue)" created (project `littlefounders-auth`, consent screen External + In production), credentials set on the `auth` service, `GOTRUE_EXTERNAL_GOOGLE_ENABLED=true`. Verified end-to-end in production: login button → Google → GoTrue callback → `/auth/callback` → authenticated dashboard; OAuth user created with `provider=google`, display_name from Google metadata (0011), `universal` role, email auto-confirmed (backend/README.md "Social login")
- **Data Intelligence (dataintel/)** — DuckDB analytics warehouse with
  segmentation, forecasting, anomaly detection, and experiment framework
  (2026-07-29, SHIPPED)
- **Move Vault backups to a dedicated Railway volume** once billing allows creating one — today's mechanism (piggybacking on filebase's volume) works and is verified, but a purpose-built backup volume is the better long-term shape
- Pay down the Vercel + Railway billing holds and renew the `littlefounders.ai` GoDaddy registration (owner action, not agent-doable)

## Open decisions

| Decision | Status | Where documented |
|---|---|---|
| Email engine | **DEPLOYED + LIVE 2026-07-18: Haraka (self-hosted SMTP) → Amazon SES relay** — GoTrue sends real confirmation/recovery mail through it with branded trilingual templates | email-server/AGENTS.md · live record: email-server/README.md |
| ID-verification engine | **DECIDED 2026-07-12: local OCR (tesseract.js), photo never stored** | parent-id-check/AGENTS.md |
| TTS provider | OPEN (`TTS_API_KEY` in production is a placeholder — narration will fail until a real DashScope key is supplied) | audiogen/AGENTS.md |
| Games (gamegen/game-engine) | **REVERSED 2026-07-31: the whole feature was removed after implementation** — see the Game Engine entry above and WALKTHROUGH.md | WALKTHROUGH.md |
| License | OPEN (UNLICENSED placeholder) | README.md |
| CD mechanism | **DECIDED 2026-07-17: token-based CLI deploys (`railway up` / Vercel CLI) from GitHub Actions, no native Git-App connection on either platform** — supersedes the earlier "platform-native" backlog item | this file, Day 8 above |
