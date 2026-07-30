# ROADMAP.md — Architecture & Sprint Plan

> Authority: second only to /AGENTS.md. Architecture decisions recorded here; the running log lives in WALKTHROUGH.md.

## Architecture summary (locked 2026-07-11)

Independent services (no npm workspaces): **Vault** (Supabase self-hosted on Railway), **Core** backend, frontend (Vercel), **Forge** coursegen, **Echo** audiogen, **Prism** picturegen (added 2026-07-23, owner-directed: the only image-generation path — art-director judge + Qwen `qwen-image` + Depot storage + Vault request-cache; Gemini discarded, quota-0), **Arcade** gamegen (approach resolved 2026-07-30: 8 hand-written deterministic game mechanics skinned per instance by generated JSON manifests — never generated game code; the Arcade pipeline authors the manifests and Core derives every reward by replaying the input log — `/GAME_ENGINE.md`), **Guardian** parent-id-check, **Courier** email-server, **Data Intel** dataintel (added 2026-07-29 — DuckDB analytics warehouse: segmentation, forecasting, anomaly detection, experiments) — all TypeScript + Express + Node 24 except Vault (SQL + tooling). Six roles, five product sections, 3 locales, light/dark. Full tables: /AGENTS.md §1.2–§1.5.

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
**Railway (project `littlefounders-b2c`, one project, all services):** Vault deployed as 9 Railway services — `db` (custom Dockerfile wrapping the pinned `supabase/postgres` image + baked-in init SQL, `database/railway/db/`), `kong` (custom Dockerfile, `database/railway/kong/`, declarative config templated for Railway private networking), `auth`/`rest`/`realtime`/`storage`/`meta`/`supavisor`/`studio` (plain pinned-image services, `railway add --image`). `imgproxy` and `functions` (edge-runtime) are **not deployed** — no app code uses Supabase Storage transforms or Edge Functions (Depot/filebase covers all real media needs), and Railway has no equivalent of docker-compose's shared-volume dependency for imgproxy+storage; re-add both if that ever changes (`database/DEPLOYMENT.md`). Migrations 0001–0010 applied via `railway ssh --service db -- psql`. `Redis` (Railway-managed) added for backend's production rate-limit store (`REDIS_URL`, was previously untested — `NODE_ENV=production` switches `rate-limit-redis` on, no MemoryStore fallback in prod). Kong got a public domain (`auth-b2c`); backend/Core reused the pre-existing service (renamed project, not the service — still called `littlefounders-backend`) with a fresh domain (`api-b2c`, replacing the old `b2c-api`); filebase got `media-b2c`. coursegen/audiogen/gamegen/parent-id-check are intentionally **not** publicly exposed (private Railway networking only, matches AGENTS.md §1.5 — never called from the browser).
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
→ nanobanana images → publish-as-review) with the complete **Educación
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
Depot, ~1.5–3 dedicated days; calibrate with a 1-saga pilot first.

**Pipeline QA-ready, not yet executed (2026-07-13):** Forge gained
`forced_types` (COURSE_ENGINE §4 addendum — pins a lesson's exact segment
skeleton, skipping the plan-stage LLM call) and Echo gained the real
per-character × per-locale **voice map** (`voiceFor()` — story/scene speaker →
segment narrator → locale default, 12 optional override env vars). A 4th,
non-shipping course — `first-lemonade-stand` (62 lessons: one per each
of the 56 LESSON_ENGINE types, 4 sequencing combos, a review-layer check) —
exercises text, all gates, the judge, both localizations, images, and (once
narrated) Echo end to end for a fraction of a real course's cost. GEMINI_API_KEY
verified live against the real API (HTTP 200, `gemini-2.5-flash-image`
confirmed available). Not yet run — `npm run generate -- --course
first-lemonade-stand` still costs real money and needs a go-ahead;
character voice files are pending (owner to provide the location).

Next, in Jesús's stated order of interest:
- **Execute the Forge run for Educación Financiera** (operator-triggered:
  `npm run generate -- --course financial-education`; needs GEMINI_API_KEY for
  images, character voices for Echo; lessons land as `review` for human publish;
  start with a 1-saga `--slots` pilot to calibrate cost/latency from the ledger).
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

## Next up (post-sprint backlog, unordered)

- Guardian verification flow (provider decision: Stripe Identity / Persona / Veriff / manual)
- tutor/ Oracle MVP with moderation + cite-or-refuse posture
- tasks/ parent→kid assignment + rewards
- Character voices for Echo (voice map ready; owner supplies voices pre-run)
- **Game Engine — the `games/` section's runtime + the Arcade content pipeline (2026-07-30 — Phases 0–6 IMPLEMENTED on `feat/game-engine`, NOT merged, NOT deployed, NO paid run executed).** Supersedes the old "Arcade first generated minigame bound to a learn concept" line: the approach decision above turned a one-off minigame into a 7-phase program mirroring the Lesson Engine (spec `/GAME_ENGINE.md`). Phases 0–6 are committed as `4b0b64f..d968a3e`, with an adversarial-audit fix pass in flight on top of them. Status per phase, and the gaps that survive:
  - ✅ **Phase 0 — spec + docs (`4b0b64f`).** `/GAME_ENGINE.md` authored as the authoritative engine doc (level 6, twin of `/LESSON_ENGINE.md`), 13 sections; root `AGENTS.md`/`CLAUDE.md` §1.5 Arcade mission line corrected (it had said "**Personalized** minigames", which the design never does), `gamegen/AGENTS.md` (decision RESOLVED), `GLOSSARY.md`, `doc_map.md`, `DESIGN.md` (Games hub + player recipes, `GAME_PALETTES`, canvas-vs-chrome rule) and this file.
  - ✅ **Phase 1 — engine core + `sorter`, `runner` (`965b628`).** `frontend/src/game-engine/core/` — `types.ts`, `schemaBase.ts`, `schema.ts`, `rng.ts` (mulberry32), `mathd.ts` (deterministic `dsin/dcos/datan2/dpow` from fixed-term series), `replay.ts`, `strip.ts`, `scoring.ts`, `kernel.ts` (the 50 ms tick loop), `input.ts`, `stage.ts`, `audio.ts` — plus the two mechanic slices, the `GamePlayer` shell and `/dev/game-lab` (lazy + `import.meta.env.DEV`-gated).
  - ✅ **Phase 2 — Vault + Core + hub + parent visibility (`ba45705`).** Migrations `0027_game_engine.sql` (`games`, `game_documents`, `game_attempts`, `game_progress`; `game_documents` gets RLS with **zero** policies, since RLS is row-level and any SELECT policy would expose the server-only `validation` sidecar on the same row) and `0028_game_insights.sql` (`game_start` + the return of `game_complete`, plus a nullable `learning_events.game_id` with deliberately no FK). `backend/src/routes/games.ts` with the replay-derived reward path, `backend/src/game-contract/` as a parity copy gated by `npm run game-contract:check`, the `/games` hub replacing `<SectionComingSoon>`, `games.json` in all three locales, and game progress surfaced through `backend/src/routes/family.ts` for verified guardians (§1.9 invariant, not a feature flag). The audit-fix pass adds `0029_game_attempt_integrity.sql` — a `UNIQUE (user_id, game_id, run_id)` index so "a run is paid exactly once" survives concurrent submissions, which an application-level pre-check alone cannot guarantee.
  - ✅ **Phase 3 — `launcher`, `stacker`, `defender` (`d22ed99`).** Ballistics on symplectic Euler with all trigonometry through `mathd.ts`; a small in-repo rigid-body solver (AABBs + circles, fixed iteration count) rather than a physics library, because bit-identical replay cannot survive an adaptive third-party solver; deterministic A\* with a fixed neighbour order and a documented tie-break, where a wall that would fully seal the path is rejected before it is applied.
  - ✅ **Phase 4 — `autobattler`, `explorer`, `flyer` (`96aea1e`).** The closed set of 8 is complete. The report's 0.5 s combat tick is an integer counter of 10 engine ticks, never a float; `explorer` ships a reachability-fixpoint solver so an unsolvable world is rejected before publish; `flyer` is 2.5D by the recorded §13 deviation.
  - ✅ **Phase 5 — Arcade pipeline + admin + orchestration + analytics (`d968a3e`).** `gamegen/` brought to sibling-service convention (Zod `env.ts` with lazy key gates, fail-closed internal-key guard) and given the 9-stage pipeline (`validate → plan → author → gate → simulate → judge → localize → illustrate → publish`) modeled on Forge, with checkpoint/resume, stage-aware retry, the propagating budget kill switch, and the free bot-play winnability gate that no Forge stage has an equivalent for. `games.yaml` catalog with cross-catalog `topic_path` validation against `coursegen/curriculum/**`; Prism gains the additive `game_sprite`/`game_background` purposes (cache-safe — purpose is already in the request hash, so `STYLE_VERSION` stays v4); the admin generation dashboard filters by `params.kind='games'` with its own stage vocabulary and rubric dimensions; `/admin/content` gains a Games review tab where a reviewer can PLAY a game before approving it; root `generate:full` runs Forge and Arcade concurrently with linked ids, a combined summary and one shared illustration-lane budget (the DashScope quota is shared with Prism's other caller), gated behind an explicit `--confirm`; `dataintel` gains game funnels. **Open gap:** `gamegen/src/pipeline/liveTelemetry.ts` and `gamegen/src/vault/telemetry.ts` are written but not imported by `run.ts`, so an Arcade run currently writes nothing to the shared `generation_runs*` tables — the kind-aware admin work is in place and will simply show no game runs until the wiring lands (`gamegen/AGENTS.md` → Known gaps).
  - ✅ **Phase 6 — QA catalog + dry-run + verification.** `gamegen/curriculum/first-lemonade-stand/games.yaml` is the non-shipping QA catalog twinned with Forge's QA course: 18 blueprints across 9 topics, ≥2 per mechanic across all 8, tiers 1–3 and difficulties 1–5 spread deliberately so one run touches every simulator, gate and per-mechanic schema. The keyless `--dry-run` path, determinism and reward-rejection regression tests are in the suites. **Recorded browser verification is partial:** `ba45705` records the `/games` hub checked logged-in as a kid at 1280 px light and 375 px dark with no horizontal overflow; a full light+dark sweep of the player and `/dev/game-lab` at both breakpoints is not recorded in any commit message and should be done before merge (§1.11).
  - **The paid generation run has NOT been executed and is not part of this program.** Not one DeepSeek, Qwen or Prism call has been made by Arcade; `games`/`game_documents` hold zero generated rows and every cost figure in `gamegen/README.md` is a price-table default, not a measurement. Publishing real games costs real money and needs the owner's explicit go-ahead (`agent/core/BOUNDARIES.md` #8), exactly like the Forge runs. Publish writes `status='review'` — `upsertGame()` takes no status argument, so no code path can write `published` — and a human still performs the §1.9 publish flip.
  - **Also still open:** game audio assets do not exist (the SFX/BGM manifest vocabularies are closed and validated, but the only files are the 9 lesson SFX; new event names map to the closest honest existing file or to silence, `GAME_BGM_ENABLED` is `false`, and every game must stay fully playable and winnable with zero audio — real assets are an owner decision and the standing pending owner action); and `RunOptions.topicContext` has no producer, so generation prompts carry the blueprint's own `micro_objective` as their only concept context rather than the bound topic's `concept`/`learning_objective`/`key_vocabulary`.
  - **Deliberate deviations, recorded so they are not re-litigated as oversights** (full reasoning in `/GAME_ENGINE.md` §13): `flyer` is **2.5D, not 6DoF** (touch has no throttle/rudder and §1.11 forbids a desktop-only control scheme; a 6DoF model would also need a large transcendental surface the determinism contract bans); the pipeline lives in **`gamegen/`, not inside `coursegen/`** — the §1.5 service map is LOCKED and assigns game generation to Arcade, with the single-content-factory intent honored instead by shared curriculum binding (blueprints cross-validate against Forge's `catalog.yaml`), shared `generation_runs*` telemetry, and the concurrent `generate:full` orchestrator; **JSON-only manifests, no XML** (the platform is JSONB-native end to end, and a second serialization would need its own schema language, validator and gates for zero benefit).
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
| gamegen approach (generated vs templated) | **DECIDED 2026-07-30: prebuilt parameterized mechanics + generated JSON manifests** — 8 hand-written, deterministic, replayable mechanics (code) skinned per instance by a generated `GameDocument` (data); fully-generated HTML5 games REJECTED (unreviewable code aimed at kids under §1.9, N quality/accessibility/responsive postures instead of one, and unreplayable — which would leave client-reported scores as the only reward signal) | /GAME_ENGINE.md · gamegen/AGENTS.md |
| License | OPEN (UNLICENSED placeholder) | README.md |
| CD mechanism | **DECIDED 2026-07-17: token-based CLI deploys (`railway up` / Vercel CLI) from GitHub Actions, no native Git-App connection on either platform** — supersedes the earlier "platform-native" backlog item | this file, Day 8 above |
