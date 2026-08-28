# ROADMAP.md — Architecture & Sprint Plan

> Authority: second only to /AGENTS.md. Architecture decisions recorded here; the running log lives in WALKTHROUGH.md.

## Architecture summary (locked 2026-07-11)

Independent services (no npm workspaces): **Vault** (Supabase self-hosted on Railway), **Core** backend, frontend (Vercel), **Forge** coursegen, **Echo** audiogen, **Prism** picturegen (added 2026-07-23, owner-directed: the only image-generation path — art-director judge + Qwen `qwen-image-max` + Depot storage + Vault request-cache; Gemini discarded, quota-0), **Guardian** parent-id-check, **Courier** email-server, **Data Intel** dataintel (added 2026-07-29 — DuckDB analytics warehouse: segmentation, forecasting, anomaly detection, experiments) — all TypeScript + Express + Node 24 except Vault (SQL + tooling). Six roles, four product sections, 3 locales, light/dark. Full tables: /AGENTS.md §1.2–§1.5.

Forge keeps DeepSeek as the preferred author and Qwen as the independent judge. A retryable DeepSeek transport failure or provider-local DeepSeek 402 balance failure may route one author call to the already-required Qwen provider, while preserving ledger accounting, deterministic gates, review, and human release. Invalid credentials, malformed requests, and billable empty completions remain fail-closed.

Prism's generated-art identity is strict two-dimensional flat educational vector illustration. Its global and object-tile cache discriminators are versioned for a visual-identity change, so new candidate requests never reuse earlier 3D-looking art; only defect-exclusion-only hardening preserves cache reuse.

Course identity is also content-governed: every new course must ship with a
developer-provided badge asset whose catalog path matches its course slug.
Forge rejects incomplete metadata, Vault blocks publication without a badge,
and Core exposes the same read-only identity on course views and completed
course collections in public profiles. The contract is defined in
`COURSE_ENGINE.md` §3.0 and migration `0039`.

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

**Guest accounts + onboarding + mandatory placement shipped to PRODUCTION 2026-08-11**
(closes COURSE_ENGINE.md §3.2's reserved "future onboarding/placement
phase"): GoTrue anonymous sign-in (`POST /api/v1/auth/guest`) is the guest
mechanism — a real `auth.users` row, zero new bootstrap code, and a
same-user-id upgrade path (`POST /api/v1/auth/upgrade`) so progress never
migrates. A one-time onboarding wizard activates day-1 streak. Placement is
mandatory per course (`PLACEMENT_REQUIRED` 403 in `learn.ts`, beside every
existing `LESSON_LOCKED` check): the previously in-memory-only competency
graph (`coursegen/src/catalog/competencyGraph.ts`) is now persisted
(migration `0042`, mirroring `0016`'s exact precedent), Forge authors one
placement-quiz probe per teaching topic offline at generation time
(`coursegen/src/pipeline/placementProbe.ts` — never per learner, §1.9 holds
by construction), and `backend/src/services/placementAlgorithm.ts` (pure,
like `unlockRules.ts`) grades the up-to-6-question quiz server-side and
places the learner past the longest contiguous correct-and-probed prefix,
capped at any unmet hard prerequisite. Skipped lessons are credited via a
dedicated `placement_credits` ledger (migration `0043`, never a fabricated
`lesson_progress` row) and DO count toward course badges/progress
(confirmed product decision, Duolingo-style — `get_completed_course_badges`
extended accordingly). Shipped end to end in one session: pushed to
`origin/main`, migrations applied to the production Vault, the GoTrue flag
flipped on the production `auth` service, and the full guest → onboarding →
placement journey live-verified against `https://littlefounders.ai`. Full
detail + both the local and production verification evidence:
WALKTHROUGH.md's 2026-08-11 entry. Remaining manual step: the same
provider-key gap already blocking Financial Education generation
(`production:preflight`'s 4 failures) also blocks the paid Forge backfill
that would author `placement_probe` content for the 3 already-published
production catalogs — until then, placement still gates correctly in
production, just via `no_probe_content_fallback` (no quiz-driven
skip-ahead) — confirmed live against `financial-education`.

**Pulse (observability) adopted 2026-07-20** (`pulse/AGENTS.md` authoritative;
owner sign-off for the §1.2/§1.5 change recorded in WALKTHROUGH.md): self-hosted
Plausible CE v3.2.1 + Umami v3.2.0 + Uptime Kuma 2.4.0 as five pinned Railway
services, Dependabot-auto-bumped, daily pg_dump backup, data read only through
Core `/api/v1/admin/*`. Feeds the admin/superadmin console's Analytics & Health
panel. Plausible acquisition capture is restricted to consented public
marketing routes; Umami behavioral capture is §1.9-fenced to marketing +
signed-in parent product surfaces (never kid or admin sessions). Remaining
manual step: GA4 historical import
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

**Financial Education is LIVE in production (generated, not just published):**
confirmed by direct production query — `courses.status='published'`, 1,208
lessons all `published`, 3,624 `lesson_documents` (= ×3 locales exactly, all
narrated), 9,179 Prism illustrations. Real Forge spend for this run: **$1,586.42**
(508.5M tokens, 41.8% cache hit, 397 images billed of 618 generated) — the
`$225-320` estimate two paragraphs up was superseded by reality by roughly
5x; use the real $/lesson (~$1.31) for any future course cost projection, not
the original estimate. Open, unexplained gap: the catalog defines 1,312
blueprints but only 1,208 are in production (104 short) — not yet root-caused.

**Emprendimiento e Inversiones PIVOTED to tier4 (12-18), fully re-authored
(2026-08-12/13):** neither course had ever been generated (0 rows in
production for either slug), so the owner used that window to redesign both
for a matured audience instead of generating the original tier1-3 (6-12)
catalogs. New shape: a single `tier4` age tier (COURSE_ENGINE.md §3.1b),
**544 lessons each** (down from 1,408/1,472 — half the lessons-per-topic,
each assumed denser/longer), full vocabulary opened except investing's
unchanged high-risk-trading hard ceiling, and `contentPlaybook.ts` gained a
`tierReasoningGuidance('tier4')` register brief centered on teen-anchored
analogies (subscriptions, gig-app fees, loot-box odds, follower growth)
instead of Financial Education's storybook framing that prompted this pivot.
Both new catalogs are `catalog:check`/`graph:check` clean (0 errors) and
`--require-images --dry-run` clean at $0 — **authored, not yet generated**.
Estimated cost at Financial Education's real $/lesson (~$1.31, Forge-only —
does NOT include Echo/TTS, which has no confirmed DashScope price in our
docs, same open item as before this pivot) applied to the CURRENT 544/course
count: **~$714 (entrepreneurship) + ~$714 (investing) ≈ $1,429 combined**
(corrected 2026-08-13 — an earlier pass of this estimate mistakenly kept the
pre-pivot 1,408/1,472 lesson counts instead of the 544 actually authored;
this is also likely a floor, not an exact figure — FE's $/lesson was
measured on 4-lessons/topic content, while tier4 intentionally packs more
into each of its 2 lessons/topic, which plausibly raises the true
per-lesson cost even as the total drops from the lesson-count cut). Before a
paid run is authorized.
**Product-sequencing gap opened by this pivot, not yet decided:** a learner
finishing Financial Education (~6-10) now has no course until 12 — the
10-12 band Inversiones' old tier3 used to cover is currently unserved.

**Emprendimiento GENERATED end-to-end via a subagent authoring harness, not runGeneration (2026-08-18):** the DeepSeek/Forge estimate above ($714) does not apply to this run — Claude Sonnet subagents wrote every document instead, driven by an operator session (`coursegen/AGENTS.md` "Subagent authoring harness"), because the cloud generation path had been unreliable. Confirmed by direct production query: **544/544 lessons across all 8 adventures, ×3 locales (1,632 documents), `status='review'`** — every document cleared the contract, all 9 gates, and the independent judge's pass floors. Audio and images are explicitly out of scope for this run (owner decision) and remain a separate future phase; the DashScope arrears blocker (2026-08-15) still applies to images specifically. Learner visibility is a human `published` flip, not run yet.

**New failure mode found only at 8-adventure scale, not the earlier single-adventure pilot: parallel authoring batches that cannot see each other's work invent DIFFERENT businesses for the same adventure.** One adventure reached four incompatible worlds (a bracelet workshop, an embroidery stall, a notebook stand, an invented finale-only business) before repair. Fix, now standard practice: pin the adventure's world in a `WORLD.md` BEFORE dispatching any authoring batch — and **the world file must state it is subordinate to the brief**, not the reverse. An early `WORLD.md` that omitted that line got obeyed over the catalog's own authored briefs by two batches, which then had to be re-homed (`coursegen/AGENTS.md` documents the pattern and the fix).

**Inversiones GENERATED end-to-end via the same subagent authoring harness, this time via `Workflow`-orchestrated parallelism (2026-08-20):** all 8 adventures authored, validated, judged and translated CONCURRENTLY instead of sequentially — the interactive `Agent` tool's session-wide spawn cap was already exhausted by the Emprendimiento run above, so this run used the `Workflow` tool's separate agent budget instead (`coursegen/AGENTS.md` §"A second full-scale run, at real parallelism"). Confirmed by direct production query: **544/544 lessons across all 8 adventures, ×3 locales (1,632 documents), `status='review'`, course row correct** (`position=2`, `requires=["financial-education","entrepreneurship"]`, `badge_asset` set). Every document cleared the contract, all 9 gates, and the independent judge's pass floors — including 12 real semantic defects the judge caught after gates passed (three instances of sunk cost mislabeled as opportunity cost, four segments unsolvable because a needed fact only appeared in post-answer text, two answer leaks via icon/table design, one graded widget missing its actual question, two weak connect-to-prior openings), all fixed and re-verified before publish. Audio and images remain out of scope for this run (owner decision, matching Emprendimiento); the DashScope arrears blocker still applies to images. Learner visibility is a human `published` flip, not run yet.

**Catalog quality prune, all three courses (2026-08-21):** the counts above are pre-prune. A `Workflow`-driven judge pass (120 saga-batch judges reusing coursegen's own review rubric, plus a 3-judge borderline panel) archived 771 lessons for quality, never for cost. Current state, confirmed by direct production query: **financial-education 475 `published`** (was 1,208; 513 newly archived on top of 220 already archived from a 2026-08-16 rescue pass), **entrepreneurship 414 `review`** (was 544, 130 archived pre-publish), **investing 416 `review`** (was 544, 128 archived pre-publish). `archived` is a reversible status flip, not a delete; full pre-mutation backup at `~/Movies/LITTLEFOUNDERS/lf-lesson-backup-2026-08-21/`. Full method, sanity checks and per-lesson rationale: `WALKTHROUGH.md` "Current State (2026-08-21...)" entry. Any cost projection using the historical $/lesson figures above should apply it to these current counts, not the pre-prune ones.

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
- **Kid accounts from the Tutor dashboard (2026-08-26 — SHIPPED, local only):**
  `POST /api/v1/family/kids` creates the child's auth user through GoTrue's
  admin endpoint (already confirmed, synthetic `.invalid` address — RFC 2606,
  so it can never receive mail), writes a VERIFIED `guardian_links` row, sets
  the profile handle and birth date, then grants `kid`. That order is the §1.3
  safety property: the account is deleted again if the link cannot be written,
  and the role is granted last. `/family` gains an add-a-child card, and
  `/login` accepts a username as well as an email (disambiguated on `@`, which
  `profiles.username` cannot contain) so a child can sign in without a mailbox.
  Collected: first name, username, passphrase, optional birth date. Never: an
  email, a surname or an address. Managing an existing child is in too: rename,
  rotate the passphrase, and remove (a HARD delete, gated behind typing the
  child's username, because `auth.users` cascades to their profile, role, link
  and learning rows and erasing a minor's record when their guardian asks is the
  obligation). Capped at 10 children per guardian - a bound on what one
  compromised parent session can mint, not a view on family size. A child's
  USERNAME is deliberately immutable: their auth address is derived from it.
  **Deploy steps and the smoke tests that could not be run locally are in
  RUNBOOK.md, "Deploying the family/kid accounts release".**
- **Admin Generation Dashboard v2 (2026-07-27 — Phase 1 + 2 shipped):**
  - ✅ Phase 1 (backend + coursegen): Live telemetry (0018), `liveTelemetry.ts`, Core endpoints `/admin/generation/live` + `/admin/generation/analytics`.
  - ✅ Phase 2 (frontend): React Flow interactive canvas (`PipelineFlow.tsx`), live stats panel with 2s polling (`LiveStats.tsx`), cross-run analytics charts (`AnalyticsCharts.tsx`), three-tab layout (Live Monitor / Run History / Analytics) in `/admin/generation`. i18n in 3 locales.
- **Admin Generation live-monitor hardening (2026-08-09 — local only):** Core `/admin/generation/live` is now the authoritative hydration and polling baseline, with optional Realtime acceleration instead of a Realtime-only contract. Forge publishes an initial heartbeat before paid work, seeds completed slots on resume, recomputes terminal counters idempotently, and includes skipped slots in processed progress. Migration `0038_generation_live_accuracy.sql` adds the persisted skipped-slot counters to live rows and snapshots. Frontend tests cover the no-Realtime production path and coursegen tests cover exact terminal accounting. This remains local-only while production generation is active; deploy the migration before the code.
- **Admin governance surfaces (2026-08-09 — local only):** `/admin/audit` now has exact filtered totals, server pagination, read-only event inspection, and human-scale investigation controls. `/admin/roles` now shows exact role/permission assignment summaries, provenance and last-change metadata, searchable user selection for grants, confirmation before revocation, and a closed permission enum. The universal admin-console rule is documented in `WALKTHROUGH.md`: source-of-truth numbers, decision-ready context, expandable views, fixed viewport overlays, explicit high-impact confirmations, and append-only accountability. No push was performed.
- **Admin dashboard hardening (2026-07-28 — shipped):**
  - ✅ Content + Moderation merged into single unified page (`/admin/content`).
  - ✅ Admin Users stats bar — role/local/age group distributions with charts.
  - ✅ Signup timeline chart — SVG bar chart with 30d/90d/1y period selector.
  - ✅ Email tracking infrastructure — migration 0021 (`email_logs`), email-server logger + `/api/v1/logs` endpoints, Core proxy `/admin/emails/*`, frontend email dashboard with pagination and KPI cards. **Made durable later the same day (uncommitted — ships with the resilience pass below):** the logger writes through to Vault with the service role (`src/db/emailLogsRepo.ts`) and the 1000-entry ring buffer survives only as the dev/test fallback; a second writer — the Haraka `log_delivery` plugin on `hook_queue_ok` — records GoTrue auth mail, which reaches the relay over SMTP :587 and never touches the HTTP API, so nothing in the repo had been capturing the platform's actual email.
  - ✅ Cybersecurity audit — 6 vulnerabilities fixed (Zod validation on unvalidated query params, proxy response shape validation, fetch timeouts).
  - ✅ Staff Tutor-upgrade card hidden for admin/superadmin.
  - ✅ React Router v7 future flags — silenced console warnings.
- **Insights — first-party learning/usage telemetry (2026-07-29 — in branch, NOT yet merged or deployed):** spec `/INSIGHTS.md`. Migration 0023 (consents + closed-vocabulary events + SQL views), Core ingest with the fail-closed kid consent gate, parent-dashboard consent toggle, `/admin/insights` (calibration/activity/families). Verified E2E on the local stack incl. the consent gate opening and closing. Pre-launch dependency: platform terms / privacy notice for ADULT collection; kid collection is already gated per family.
- **Unified learning intelligence (2026-08-09 — local):** `/admin/insights` now preserves bookmarks by redirecting to the single `/admin/intel?focus=learning` console. Data Intel receives server-authoritative lesson attempts for calibration, recomputes distinct-user daily aggregates at the reporting grain, aligns cohort weeks correctly, and rejects unsupported metric relabeling rather than manufacturing a precise-looking number. Adult first-party anonymous acquisition links are available only through a service-only, kid-excluding view; exports remove learner identities and re-key sessions per response. Migrations `0034` and `0035` are required before deployment.
- **Decision-ready learning evidence (2026-08-09 — local):** migration `0036` adds retry-safe, bounded event time and closed content/experiment context; authoritative attempts now carry course/topic/skill, timing, document version and diagnostic outcome. Data Intel materializes explainable learner skill states, aggregated content-health priorities and source-quality/freshness checks. Experiments measure only rendered treatment exposure, never assignment alone. Core exposes a learner-only state boundary ready for the future Tutor, while the admin Learning tab makes data readiness visible before any content decision. This remains local-only and requires the standard migration handoff before deployment.
- **Learning evidence command center (2026-08-09 — local):** migration `0037` preserves localized course context in the service-only lesson catalog feed. Data Intel now serves course, lesson and UUID-only learner evidence views with an explicit three-state evidence threshold. `/admin/intel?focus=learning` exposes a browsable published catalog on day one, a learning pulse, actionable content health and full-viewport staff drill-downs. It never substitutes zeroes for missing evidence and retains the consent boundary for behavioural telemetry. This remains local-only and requires the standard migration handoff before deployment.
- **Tutor personalization contract (2026-08-09 — local):** Core now documents and exposes the caller-only `/api/v1/learn/personalization` boundary over Data Intel's derived learner skill states and explainable next action. The future Tutor must receive only a minimal, validated context — never raw events, answers, warehouse access, or another learner's data — and must treat low evidence or warehouse failure explicitly. The Tutor runtime remains unimplemented; the full integration, moderation, evaluation, consent, and parent-visibility gates are specified in `/ORACLE.md`.
- **Platform resilience pass (2026-07-28 — in branch, NOT yet merged or deployed):** an adversarial defect sweep (40 candidates, 33 confirmed) whose fixes changed standing platform rules, not just code. Each rule and its reasoning: WALKTHROUGH.md Decision Log. Everything below is uncommitted on `fix/lesson-engine-hardening` and lands in the next PR — production still runs the code merged in #25.
  - ✅ Redis is a degradable dependency — Core listens before connecting, both limiters `passOnStoreError` (fail open), `/health` mounted above the limiter.
  - ✅ Read-modify-write reads distinguish "Vault did not answer" (`null` → 502) from "zero"; `POST /learn/lessons/:id/complete` can no longer erase a learner's accumulated totals.
  - ✅ Prism's HTTP status is Forge's retry instruction (502 transient / 422 terminal), and `BudgetExceededError` is rethrown so `FORGE_MAX_USD_PER_RUN` actually halts a paid run.
  - ✅ Internal-key comparison hashes both sides to fixed-width SHA-256 digests in all 7 services (a non-ASCII header used to throw `RangeError` → 500 HTML instead of a 401 envelope).
  - ✅ Repo-wide gates run without a path filter (`repo-gates.yml`); `check-secrets.sh` exempts declared placeholders, resolving a real conflict with §1.14.
- **Forge illustration provenance (2026-08-02 — local, not deployed):** migration `0032_lesson_illustration_style.sql` records the bundled Prism style on every published lesson document. Image inheritance and zero-spend backfill now accept only the current `FORGE_ILLUSTRATION_STYLE_VERSION`; legacy or NULL provenance is excluded, and `verify:course` fails closed until every release-ready document is style-attested. This prevents a Prism style upgrade from being bypassed by stale Vault URLs.
- **Prism prompt contract (2026-08-02 — local):** all object-tile purpose guides require an edge-to-edge pure-white canvas; the deterministic tile prompt is now a concise positive specification (literal object, centered, fully visible, flat 2D animated vector, clean geometric shapes, crisp contrast, bright colors) without LittleFounders or lesson context. Scene purposes retain complete contextual backgrounds. The mechanical negative list and pixel verifier remain unchanged.
- **Analytics boundary — trackers, read-time scope and a cross-package gate (2026-08-14 — DEPLOYED):** Plausible and Umami were both auto-capturing SPA navigations in production, recording `/admin/*` and product routes despite correct route gates: each vendor hooks `history.pushState` on load, so ejecting the `<script>` node never revoked it. `/admin/content` was the site's #1 page; 79.6% of stored Plausible pageviews and 31.5% of Umami's were out of boundary. Both now mount with automatic capture disabled and emit one pageview per approved navigation. Stored history is corrected at READ time — an always-on acquisition allowlist inside `plausibleQuery()` (verified: zero out-of-boundary `event:page` rows across twelve months incl. GA4 imports — *this said "zero out-of-boundary rows" until 2026-08-27, which generalised one measured dimension to all fourteen and was false of two of them; see the 2026-08-27 entry*); Umami cannot be scoped (no negation filter) and instead reports `outOfBoundaryPageviews`. Data Intel needed no backfill (`is_staff` joins at query time). The resulting two-package definition of "public acquisition surface" is enforced by `npm run paths:check` in repo-gates, and `agent/tools/*.test.mjs` — which ran in no workflow and had rotted into failure — now runs in CI. Full failure modes and the `whois`-before-approving rule for staff-IP suggestions are in `RUNBOOK.md`.
- **Discoverability — the site had no metadata at all (2026-08-27 — DEPLOYED):** measured against production, every URL on littlefounders.ai returned the same **1,080-byte shell**: `<title>LittleFounders</title>`, no description, no Open Graph, no canonical, no structured data, an empty `<div id="root">`, and no `robots.txt` or `sitemap.xml` anywhere. That is not a ranking problem but an EXISTENCE one, and it hit the three audiences a new brand needs most: social unfurlers (WhatsApp, LinkedIn, Facebook, X, Slack, iMessage) never run JavaScript, so **every link ever shared appeared as a bare grey URL**; LLM and agent crawlers overwhelmingly do not run JavaScript either, so to an assistant asked how to teach a child about money the site had no content; and Google had nothing to rank because the page shipped no title and no description. **Fixed at BUILD time, not by React** — a tag that exists only after hydration is invisible to every one of those consumers. `frontend/scripts/seo/site.mjs` is now the single source for the public surface, and `build-seo.mjs` emits per-route HTML with a complete head (Open Graph + Twitter card + canonical + schema.org JSON-LD covering `EducationalOrganization`, `WebSite`, `WebPage`, `BreadcrumbList` and the three subjects as `Course`), a static content shell assembled from the SAME i18n bundle the app renders (so it cannot drift into cloaking), plus `robots.txt`, `sitemap.xml`, `llms.txt`, `llms-full.txt` and `site.webmanifest`. **AI crawlers are ALLOWED by owner decision** — 17 of them named explicitly; the lessons sit behind authentication where no crawler reaches them, and being the answer when a parent asks an assistant is worth more than blocking the read. **The SPA fallback is now a separate `app-shell.html` marked `noindex`**, so a route nobody deliberately positioned stays out of the index by construction rather than by somebody remembering. **Share cards rebuilt from assets we own** (`npm run seo:cards`, headless Chrome over CDP, no image-API spend): the card that shipped before carried no wordmark, no product name and no promise, and its laptop screen was full of AI-garbled fake text — a stranger seeing it in a WhatsApp group learned nothing and could see it was fake. Three locales, 1200x630, 93 KB each as JPEG against 490 KB as PNG, because an unfurler that times out fetching the image drops the card entirely. Also: the favicon was the 2553px master at **887 KB**, downloaded in full by every visitor and every crawler before the browser discarded all but 32 pixels of it — now 4 KB, with proper 180/192/512 icons and a manifest. Positioning is marketing, not architecture: no vendor, model or service is named anywhere in the public copy, the one statistic used carries its source, and structured data claims no rating or user count we cannot evidence. `npm run seo:check` guards the class that fails silently — a title long enough to truncate the brand away, a description too short to survive as a snippet, a locale left behind, a page both sitemapped and robots-blocked, and search's route list disagreeing with the app's. It found a real defect on its first run. **Console ownership CLOSED 2026-08-27 (owner):** proved with a Google-issued **CNAME in Vercel DNS**, then imported into Bing from Search Console — the most durable method available, and the reason `SITE.verification` is deliberately left `null` rather than filled. `sitemap.xml` submitted in both, and indexing requested for `/` and `/how-it-works`. The operational consequence to remember: **ownership now lives in a DNS record, so deleting it un-verifies both consoles silently** — see DEPLOYMENT.md §1.
- **Analytics range integrity, upstream provenance and the session-dimension leak (2026-08-27 — DEPLOYED):** an outside reader of our own console exports reported that the 6-month report showed zero traffic for every day of August while the 30-day report, pulled from the same tool a minute later, showed real data for those dates. Reproduced against production and root-caused to three defects, all ours, none of them a vendor fault. **(1) Core and Plausible never agreed what a preset meant.** `resolveRange()` computed bounds locally in UTC, then handed Plausible the literal shorthand (`"6mo"`) and let it resolve independently in the site's timezone: Plausible reads `6mo` as the last six COMPLETE calendar months and stopped at 31 July, while Core believed the window ran to today, and `fillDailySeries()` padded the difference with zeros — reporting a traffic collapse that had not happened. Measured across the whole preset set, **every preset except `day` disagreed**; `7d`/`30d` were a timezone day out (so "today" always rendered as zero), `month`/`year` returned windows running into the future. Two defects fell out of it: the `6mo` comparison window overlapped the window it compared against by all of February, and the exports printed a provenance window the figures had not come from. Fixed by resolving every preset to explicit dates in the site's timezone (`PLAUSIBLE_SITE_TIMEZONE`, default `America/Mexico_City`) so one system decides the window and both use it, plus a drift guard that compares what we sent against the `query.date_range` Plausible echoes back and REPORTS a mismatch instead of relabelling the chart. **(2) `meta` was parsed off and discarded.** The always-on `event:page` allowlist cannot be applied to GA4-imported data, so Plausible drops twelve months of imported history from every non-page breakdown and says so on every response (`imports_skip_reason: unsupported_query`). Reading only `results` presented a 48-visitor breakdown under a 1,120-visitor headline with nothing to explain the gap; the reviewer reasonably concluded that dimensional tracking had been switched on in late July, and separately that bounce/duration measurement began in March — neither happened. Imports status now travels with every payload and is stated on the affected cards and in all three export formats. **(3) The read-time scope leaked on session dimensions.** It filters `event:page`, but `visit:entry_page`/`visit:exit_page` describe a SESSION, which passes an event-level filter as soon as any one event does — so `/admin/roles`, `/admin/generation` and `/signup` surfaced inside a report headed "public marketing traffic only". Measured before the fix: **7 of 11 entry-page rows and 11 of 17 exit-page rows out of boundary; zero after.** The 2026-08-14 entry above claimed this was verified, and it had been — for the one dimension it measured. The gate gap that hid all of this: every range test used `custom` ranges, where Core's bounds are correct by construction, so nothing exercised a preset — the only shape where the two systems could disagree. `backend/src/__tests__/analytics-range-integrity.test.ts` now asserts that no preset reaches Plausible as a shorthand, that every window ends today in the site timezone, that no comparison window overlaps its subject, and that the drift guard fires. **The traffic decline itself is real and is the correction landing, not a regression:** through 14 August the site drew 96 visitors at 71% Direct / 77% Desktop; after the staff-IP exclusions of 14 and 19 August and the `navigator.webdriver` filter of 13 August, two visitors remain, both mobile. Two genuinely external hits landed after the change, which is what proves the manual-pageview path still works.
- **Squeezing the rest of it, and IndexNow (2026-08-28):** the audience work exposed how much was collected and never read, so this closes the remainder. **Nine `/admin/insights/*` endpoints had no consumer anywhere in the app**; three of them answer questions the dataintel console does not, and are now on screen — which surfaces get reached, how deep a session goes, and which roles reach what. Alongside them an **instrumentation-health card** lists the closed event vocabulary and marks the members that have never fired, so `signup_complete` at zero across 31 real accounts is something an operator SEES rather than something an engineer has to go and measure; the list is mirrored from the database CHECK constraint and a test fails if the two drift, because a short list would make the card silently clean. **Two collection holes closed at the source:** `setInsightsContext` was only ever called from the anonymous path, so 93% of stored events carried no device, none carried a referrer, and every "breakdown by device" was computed on the anonymous 7% while being labelled as the whole — the authenticated beacon now stamps device, locale and referrer, and re-stamps on a language change. **Reports carry it too**, because a PDF is what leaves the building and gets quoted months later with no chance to ask what it covered: CSV gains a `firstparty` section, the workbook an "Audience (first-party)" sheet, and the PDF a block that prints the accounts-created-versus-observed gap in words. Unread renders as "unavailable", never as zeros. **IndexNow** ships with the key file written by the build (so the deployed file and the submitted key cannot drift), submitting only pages declared indexable, failing soft on purpose — the cost of a missed ping is a slower crawl, the cost of a failed deploy is not shipping. `npm run seo:live` now also asserts the key file is served, since its absence silently refuses every submission.
- **Audience insights — reading the data we already had (2026-08-28 — migration `0050_audience_insights.sql` PENDING; the authoritative pending range lives in the production-migration handoff entry below):** the console could answer "how many lessons were completed" four different ways and could not answer "did anyone who is not us visit last week". `0050_audience_insights.sql` is four read-only views over tables that already existed — nothing is dropped, narrowed or rewritten, so it is `expand` and safe either side of the code. The reason it is needed is a measurement, not a preference: **31 accounts exist and the client-emitted `signup_complete` has fired ZERO times on every day any of them were created**, and two explanations fit that equally well — the funnel drops events, or those accounts were created outside the signup form and only logged into. Nothing in the schema could tell them apart, which is §1.14 exactly. `insights_registrations_daily` is the consent-independent denominator (a row in `profiles` exists because an account exists, retroactive to July where the event stream starts 2026-08-03); `insights_signup_funnel_integrity` sets it beside the client's claim per day and REPORTS the gap rather than smoothing it; `insights_audience_daily` gives distinct sessions per day per role, which cannot be derived by summing `insights_daily_activity` because distinct counts are not additive; and `insights_anon_acquisition` finally reads `anon_visitors`, a table collecting landing route, referrer, device, locale, UTM and conversion since `0024` that **nothing had ever queried**. Same posture as every other insights view: service-role only, revoked from every client role, no identity exposed.
- **Production migration handoff (2026-08-02 — EXECUTED; ledger re-verified 2026-08-14):** the original probe on 2026-08-02 found production Vault at `0022` (the ledger's recorded `0011` was stale) and `database/scripts/railway-migrate.sh` remains the only approved remote path. That handoff and every one since has been applied: the deltas `0045`–`0046` (analytics IP exclusions + the Data Intel staff flag) went out on 2026-08-14, and a read-only ledger probe the same day confirmed production at **46/46** — `0001_identity.sql` through `0046_dataintel_staff_flag.sql`. **`0047_tutor_oracle.sql` was applied on 2026-08-21** as part of the Oracle rollout (seven tables, the voice-consent predicate and the retention function), taking the production ledger 46 → 47; a read-only probe on 2026-08-23 re-confirmed production at **47/47**, `0001_identity.sql` through `0047_tutor_oracle.sql`. **`0048_course_in_progress_notice.sql` was applied on 2026-08-24** (one additive `courses.in_progress` boolean, default false, so no existing course changed behaviour). Two things about that run are worth an operator's attention. It had to run as `supabase_admin`, not `postgres`: `public.courses` is owned by `supabase_admin` and `ALTER TABLE` as `postgres` fails with `must be owner of table courses`. And it needed `NOTIFY pgrst, 'reload schema'` afterwards, or PostgREST keeps serving a schema cache without the new column — verified by reading `in_progress` back through the API before relying on it. It was applied with direct `psql` rather than through `railway-migrate.sh`, which meant the ledger did NOT record it and a probe still read `47`; the receipt was inserted separately with the migrator's own `shasum -a 256` checksum, so the next migrator run sees a truthful ledger rather than re-applying it. A read-only probe after that confirmed production at **48/48**, `0001_identity.sql` through `0048_course_in_progress_notice.sql`. That run succeeded, and the migrator asserts a current ledger as its last act, which puts production at **49/49**, `0001_identity.sql` through `0049_drop_parent_verification_address.sql`. **The most recent unapplied deltas `0050`–`0051` are PENDING** (2026-08-28): `0050_audience_insights.sql` — four read-only insights views, expand-safe either side of the code — and `0051_tutor_session_summary.sql` — one additive `tutor_sessions.summary jsonb` column for the Tutor's cross-session memory digests, additive and nullable, safe before or after the Core deploy that writes it (Oracle tolerates its absence; the two sessions that authored these numbered their migrations concurrently, which is why the tutor column is `0051`). *Independently confirmed on 2026-08-27 by the Vault drift probe (`workflow_dispatch` run 33049310312, 1m 9s, success), the first green run since `6273ac0e` fixed its SSH `LogLevel`: `Remote migration ledger has 49 receipt(s)`, `skip 0049_drop_parent_verification_address.sql (recorded)`, `Pending: 0`, and no checksum drift. That number is now OBSERVED rather than inferred from the migrator exiting 0 — which is the whole reason the probe exists, since the exit code and the ledger are two different claims.* **`0049_drop_parent_verification_address.sql` was applied on 2026-08-27** (Tutor deploy (operator) #29, `workflow_dispatch step=migrate` on `6273ac0e`, 4m 15s, success), taking the production ledger 48 → 49. It removes a home address that nothing ever verified: Guardian never received it, none of its four checks reads one, and no code read the column back. The code that stopped sending it shipped first (`9b75bab7`), which is the order that matters — dropping it while an older Core still named it would have made PostgREST reject every parent-verification insert. This was the first migration run through the hardened path: a pre-flight dump taken immediately before rather than up to twelve hours earlier, the phase report printed before the dry-run, and `NOTIFY pgrst, 'reload schema'` inside the apply transaction so PostgREST cannot keep serving a schema cache that still offers the dropped column — the manual step the `0048` rollout needed and nearly forgot. It had to land before `oracle` was deployed — Oracle reads none of it directly, but Core's `/api/v1/tutor/*` surface does, and a session cannot be created without it — and it did. *This sentence said PENDING until 2026-08-23, two days after the migration ran and the Tutor went live, in the document an operator reads before a migration handoff.* The migrator still requires an explicit, independently verified baseline for a legacy ledger, supports a no-write dry-run, records immutable checksums, applies one migration per transaction before the service deploy and any paid generation, stays compatible with macOS Bash 3.2, and has a fake-Railway no-write integration test for its transport.
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
- **Tutor 3D runtime foundation (2026-08-15 — local, owner-authorized):** the Tutor section becomes a 3D scene for EVERY user (owner mandate, not tiered by device). Stack added under §1.2 with explicit sign-off: `three` 0.185 + `@react-three/fiber` **v8** — v9/drei v10 require React ≥19 and we are on 18.3.1, so the v8 line is forced. **drei is deliberately NOT a dependency**: its React-18 line is frozen at Feb 2025, it would pin `three` backwards, and the ~150 lines actually needed weigh less than the bundle it adds to every user's device. Because the scene ships to all devices, quality is MEASURED, not assumed: a static probe picks a starting tier and a pure reducer (`tutor-scene/governor.ts`) steps it from real frame times, with asymmetric evidence (2 windows down / 5 up), a dead band and a demotion latch to prevent oscillation. Rendering pauses entirely when the canvas is offscreen or the tab is backgrounded — the largest device-load lever in the system — and lost WebGL contexts are recovered rather than left black. Assets are single-file `.glb` with meshopt geometry (chosen over Draco: no externally hosted decoder, and faster decode on the low-end phones the budget exists for) and KTX2 textures (a VRAM decision, not a download one). Depot accepts `model/gltf-binary` in bucket `tutor-scenes`. The asset budget lives in code (`tutor-scene/budget.ts`) and is measured against real exports by `/dev/scene-lab` and `npm run assets:3d`. Verified in-browser at 375px and 1280px, light and dark, zero console errors; the optimizer took a 46.6 MB export to 1.03 MB (-97.8%) and it loaded clean. The `/tutor` surface now renders the composed stage for every user. The four characters were delivered mid-session and measured (`npm run assets:inspect`): 156 MB → 5.19 MB total, all four rigs intact, scene at 7 draw calls / 51k triangles. Three share one 24-joint biped skeleton; Dina is a quadruped on her own 27-joint rig and was the sole unit-scale outlier (Unreal units, 0.028 m). Since every export ships only ONE clip and all of them are locomotion cycles, the full 12-action / 7-emotion vocabulary is driven PROCEDURALLY (`characterActions.ts`) against the same closed vocabulary the 2D rig and the existing lesson catalog already use — so authored `emotion`/`action` fields drive the 3D cast unchanged. Standing positions and ground height are SOLVED from the geometry (`standingSpots.ts`, `ground.tsx`), never hand-authored, so a new diorama needs no coordinates. NOT yet built: lip-sync (no jaw or facial bone exists on any export — needs a Blender pass), authored animation clips, KTX2 texture compression (KTX-Software not installed; textures ship as WebP and decode to full RGBA in VRAM), and the upload of optimized assets to Depot, which is the one remaining blocker before deploy.

## Tutor (Oracle) — CERTIFICATION PASS, 2026-08-23

**Status: the Tutor is FEATURE-COMPLETE and every gate in the repository is
green. It is NOT yet cleared for a public launch with minors, and the three
things standing in the way are all outside the code.**

Green, run this session on the reconciled tree: frontend type-check / lint /
**1159 tests** / build / `verify:rig` / `verify:placement`; oracle type-check /
lint / **165 tests** / build / `verify:tutor`; backend type-check / lint /
**445 tests** / build; database migration + transport gates; root `docs:check`,
`secrets:check`, `i18n:check`, `paths:check`, `provider:check`, `tools:test`
(11), `repo:map`. Looked at: **108 screenshots** across seven phases plus
`adapting` and `consent`, two breakpoints, both themes, three locales; four
end-to-end journeys in es-MX and pt-BR with zero failed clicks; the four
characters in the foreground; a lesson outside the Tutor in all three locales.
`/ORACLE.md` §16 and §16.1 are ticked against what was measured and left
unticked, with reasons, where it was not.

**Two defects found by looking and fixed** (neither was visible to any test):
the unlit mouth card rendered as a white bar over the speaker's mouth at every
backdrop but Day (TUTOR_3D.md §3.1a), and `/ORACLE.md` §14.1's prose had drifted
from a deliberate decision made in code the previous day. **One defect found by
looking and deliberately NOT fixed**: on the desktop audition Dina's name plate
can read as Liruf's, because a plate hangs above a bounding box and a
quadruped's bounding-box top is not over her head. The head-bone fix needs data
the four exports do not agree on — rho's `head` joint is at 0.535 of his height,
which is his waist — so it is recorded with its measurements (TUTOR_3D.md §3.1b)
rather than guessed at.

**Blocking a public launch WITH MINORS, all three outside the code:**

1. **The Inworld data-processing agreement covering minors' audio.** OWNER
   ACTION. Until it exists `TUTOR_VOICE_FOR_MINORS` stays `false` and no child's
   microphone opens. This gates one INPUT METHOD, not the product: every learner
   keeps the whole Tutor, captioned and typed.
2. **The three `/LEGAL/` documents and `npm run legal:sync`.** Blocked on
   counsel; `tutor.consent.body` is still a placeholder.
3. **Voice proven live in the reviewed environment** — `/health` reporting voice
   up, zero missing enrolments, one spoken turn end to end. Cannot be done from
   a development machine: no credentials here, and it spends real money against
   a real contract.

**Security: audited adversarially on 2026-08-23** (`/SECURITY_AUDIT_2026-08-23.md`).
Six surfaces attacked, every finding put to a skeptic told to refute it: 27
raised, 7 survived, 5 high, **all fixed with a regression test each that was
confirmed to fail against the pre-fix code**. The four that mattered were a
model-authored field reaching a child's screen unmoderated while two comments
claimed otherwise, two paths to the model that skipped the turn floor and the
budget, an IP rate limiter that could take the tutor offline platform-wide on
ordinary traffic, and a consent re-check that read "unreadable" as "granted".
What the audit did NOT cover is written down in its §3 — no live provider calls,
no dependency review, no load testing, no multi-instance analysis. **One
consequence to hold onto: Oracle must run as a SINGLE Railway replica** until
the in-process `jti` ledger moves to Redis.

**Not blocking launch, but named before a real cohort** (`/ORACLE.md` §15.2):
there is no platform-wide spend ceiling or circuit breaker, no admission control
on concurrent sessions, no rate limit on the websocket handshake itself, no
alerting on the retention sweep, and no measurement of third-party rate limits.
Every per-learner control is real and tested; what is missing is the difference
between a product that is correct and a service that has been operated.

## Onboarding + placement rebuilt — 2026-08-24

**Owner report:** both flows "deplorables, poco intuitivas, cero funcionales";
testers placed at a level unrelated to what they knew. Four decisions were
taken at the start of the session and they shape everything below.

1. **Publish the remaining courses**, with a short notice that they are still
   being built (migration `0048`, `courses.in_progress`). Verified against
   production first, because the notice had to be true: entrepreneurship and
   investing carry **zero** narration (0 of ~1,245 locale documents each) and
   zero illustrations, against financial-education's 1,425 of 1,425 narrated.
2. **Placement is decided by the KNOWLEDGE GRAPH, not by age.** Age is a signal
   inside it. Implemented as: signals choose where the first question is asked
   and never enter the result — a testable property, not a stated intention.
3. **Voices pregenerated**, spend pre-authorised. 36 clips, ~3,400 characters,
   synthesised once into Depot, free thereafter.
4. **Conversational intake for 12+, deterministic for kids** — the §1.9 line,
   with the floor enforced in Core because Core holds the birth date.

Full trace, including the production evidence that placement had never placed
anybody, is in WALKTHROUGH.md 2026-08-24.

### Blocking, owner action

- **The shared DeepSeek account is out of balance** (`Insufficient Balance`,
  verified live 2026-08-24). One key serves BOTH `coursegen` (generation) and
  `oracle` (`MODEL_API_KEY`), so this is not only a backfill blocker: **the AI
  Tutor is down in production** until it is topped up. Oracle's preflight
  cannot detect it — `modelConfigured()` only checks that a key string exists —
  so a learner is told the session can start and then every turn fails.
- Consequence for placement: probe coverage stands at **189/190 (99%) on the
  published course**, 97/187 on entrepreneurship, 0/190 on investing. Adaptive
  placement is fully functional where learners can actually reach it today, and
  `npm run graph:backfill --course all --confirm` resumes for free on what is
  already done.

## Next up (post-sprint backlog, unordered)

- Guardian verification flow (provider decision: Stripe Identity / Persona / Veriff / manual)
- **tutor/ Oracle — IN PRODUCTION since 2026-08-23; Tutor v2 built 2026-08-28 on `feat/tutor-v2` (this entry previously said "implementation not started" and described a two-panel split ORACLE.md §9.3 had already rejected — both stale; trust /ORACLE.md and WALKTHROUGH.md).** The product is a live, spoken, adaptive tutoring session on the deployed 3D stage; the layout of record is /ORACLE.md §9 + DESIGN.md → Screen Recipes → Tutor (2026-08-28: a docked Lumen panel at desktop, a three-detent sheet on a phone). The eight §0 owner decisions stand unchanged (kids' microphone behind blocking consent; Inworld voice-only; the three-tier content ladder with live generation as the largest §1.9 exception; all four characters selectable; full server-authoritative XP; adaptation offered never imposed; audio proxied through `oracle/`; transcript + tutor audio as the only persistence). **Tutor v2 (owner-signed 2026-08-28)** added: split turn delivery + speculative TTS + a real interrupt + streamed audio upload (latency); session resume on a fresh single-use token (amends the no-reconnect rule); a deterministic lesson-plan state machine, a server-verified grade join, in-session skill nudges and cross-session memory digests (sealed context 9 → 11 fields via the full §4.1/legal process; migration `0051` — authored as `0050` and renumbered on rebase, a concurrent session shipped `0050_audience_insights.sql` first); the docked desktop panel with edit/restart/"explain differently"; a preflight model probe (the 2026-08-24 out-of-balance class now disables the start button honestly); counted transcript-persist failures; and the live-content review queue's first reader (`/admin/tutor/review-queue`). Still blocking on owner action: the Inworld DPA covering minors' voice (with counsel-approved consent wording), applying migrations `0050`–`0051`, running `speech:pregenerate` against production Depot, and naming the person who reads the review queue.
- tasks/ parent→kid assignment + rewards
- Character voices for Echo (voice map ready; owner supplies voices pre-run)
- **Game Engine — REMOVED 2026-07-31.** A `games/` section runtime (8 deterministic Phaser mechanics) and its Arcade content-generation pipeline (`gamegen/`) were designed and substantially implemented across 2026-07-30/31 on `feat/game-engine` (never merged, never deployed, no paid generation run ever executed). After several redesign passes the owner judged the result did not meet the bar for a real game experience and made the explicit call to remove the feature entirely rather than keep iterating — `gamegen/`, `backend/src/game-contract/`, `frontend/src/game-engine/`, the `/games` product section, and every cross-service integration point (admin generation monitor, family dashboard, dataintel funnels, Prism's game-illustration prompts) were deleted in the same session. Full narrative: WALKTHROUGH.md decision log. Do not re-attempt this feature from the old spec — start any future games effort from a fresh design brief.
- **Games, second attempt — KartRush DEPLOYED 2026-08-24, integration NOT started (owner request this session).** The fresh design brief the entry above asks for exists, and it was written outside this repository: `LittleFounders-AI/KartRush` is a finished browser 3D kart racer (four characters, six circuits, an item system, a career loop) with its own specs, its own test suite and its own history. It is now live as the Railway service `kartrush` in `littlefounders-b2c` and is embeddable in a lesson via `<iframe>`, verified against the deployed URL from an allowed origin and refused from a disallowed one. **This is deliberately the opposite shape to the removed feature:** not a `/games` product section, not a runtime inside `frontend/`, not a generation pipeline — a self-contained game that a lesson frames. What exists today is a deployment and an embed contract. What does not exist is any integration at all: no progress reporting, no session identity, no lesson coupling, no XP. Three questions have to be answered before code, and the first is not an engineering question: **what does a game record that is worth a learner's time** (a finished race is not a learning outcome); **what identity crosses the frame** (§1.9 caps it — an opaque, Core-minted session id is the shape that fits, a user id is not); and **who is authoritative** (the game is client-side, so anything it claims is graded server-side by Core, exactly as a live tutor segment is). Contract, caveats and the full integration TODO: that repository's `docs/21-DEPLOYMENT.md` §5.
- Courier: **DONE + LIVE 2026-07-18** (Haraka → Amazon SES relay) — deployed as the 17th Railway service, GoTrue points at it, `GOTRUE_MAILER_AUTOCONFIRM=false`, branded trilingual auth mail delivering through SES in production. Old Resend DNS/records retired. Only optional leftover: set `EMAIL_SERVER_LIVE=true` to activate the email-server CD workflow (email-server/README.md)
- Google social login: **LIVE 2026-07-20** — Google Cloud OAuth client "LittleFounders v2 (GoTrue)" created (project `littlefounders-auth`, consent screen External + In production), credentials set on the `auth` service, `GOTRUE_EXTERNAL_GOOGLE_ENABLED=true`. Verified end-to-end in production: login button → Google → GoTrue callback → `/auth/callback` → authenticated dashboard; OAuth user created with `provider=google`, display_name from Google metadata (0011), `universal` role, email auto-confirmed (backend/README.md "Social login")
- **Data Intelligence (dataintel/)** — DuckDB analytics warehouse with
  segmentation, forecasting, anomaly detection, and experiment framework
  (2026-07-29, SHIPPED)
- **Move Vault backups to a dedicated Railway volume** once billing allows creating one — today's mechanism (piggybacking on filebase's volume) works and is verified, but a purpose-built backup volume is the better long-term shape
- Pay down the Vercel + Railway billing holds and renew the `littlefounders.ai` GoDaddy registration (owner action, not agent-doable)
- **Settle the DashScope / Alibaba Model Studio arrears, then run the financial-education scene repair (2026-08-15, owner action then operator run).** The pipeline fixes shipped in PRs #43–#50 and are deployed; the published catalog still carries the wrong scene art. The provider returns `{"code":"Arrearage"}` on every image call, which also disables the art-director judge and the subject verifier (same key by default), so this must be cleared before any repair — running images elsewhere would regenerate with both quality gates off. Once live: pilot `--adventure archipielago-del-trueque --restyle-scenes --confirm-spend --max-usd 60` (148 lessons, 394 redraws, ~$29.55), review in-app, then the remaining ~3,000 redraws (~$225). Measured, not estimated: WALKTHROUGH.md 2026-08-15.
- **Decide whether to regenerate published lesson TEXT for sequencing (2026-08-15, open).** PR #44 fixed the plan-repair defect that produced "questions out of nowhere", but only for future generation, and plan `fixes` were never persisted so affected lessons cannot be identified retrospectively. Owner chose to measure with one adventure first. That run must also pick `--on-existing-published keep-published` (lesson stays live, no fresh human read) or `demote-to-review` (COURSE_ENGINE §6 gate honoured, ~148 lessons leave the learner catalog until re-released) — there is deliberately no default.
- **Local Qwen inference for FUTURE courses (2026-08-15, deferred not rejected).** Evaluated as a workaround for the arrears and declined for this repair: it changes `IMAGE_MODEL`, which is part of Prism's cache key, so new scenes would come from a different model than the 9,179 existing tiles; an 8 GB laptop runs a quantised 20B image model at roughly minutes per image (~7 days for the catalog vs ~$255 of API); and the judge/verifier share the blocked key. It makes sense for entrepreneurship/investing, where there is no prior catalog to clash with. Note the shape of the work: `JUDGE_API_BASE` is OpenAI-compatible and swappable by config alone, but `IMAGE_API_BASE` is the native DashScope contract with the path and response shape hardcoded in `qwenImageClient.ts`, so local image generation needs an adapter. Sane topology is coursegen + Prism running locally against the production Vault — no tunnel into Railway.
- **Complete `en-US`/`pt-BR` Terms & Conditions content (2026-08-12 finding).** `es-MX`'s Terms & Conditions in `marketing.json` carries the full, canonical-accurate legal text; `en-US`/`pt-BR` carry a condensed paraphrase, and `LegalDocumentViewer.tsx` hardcodes which clauses render `p2`/`p3` at all. Needs a real translation/legal-review pass to bring `en-US`/`pt-BR` up to `es-MX`'s completeness (never the reverse), plus a small component change to render however many paragraphs a clause actually has. Currently blocks `i18n:check` / `repo gates` on `main` — see WALKTHROUGH.md 2026-08-12 for the full trace and why it was deliberately deferred rather than rushed.

## Open decisions

| Decision | Status | Where documented |
|---|---|---|
| Email engine | **DEPLOYED + LIVE 2026-07-18: Haraka (self-hosted SMTP) → Amazon SES relay** — GoTrue sends real confirmation/recovery mail through it with branded trilingual templates | email-server/AGENTS.md · live record: email-server/README.md |
| ID-verification engine | **DECIDED 2026-07-12: local OCR (tesseract.js), photo never stored** | parent-id-check/AGENTS.md |
| TTS provider (lesson narration, Echo) | OPEN (`TTS_API_KEY` in production is a placeholder — narration will fail until a real DashScope key is supplied) | audiogen/AGENTS.md |
| Real-time voice provider (Oracle) | **DECIDED 2026-08-21, owner sign-off for the §1.2 stack change: Inworld, VOICE ONLY (STT + TTS).** The pedagogical model stays DeepSeek/Qwen inside our infrastructure. Explicitly interim — to be replaced by self-hosted STT/TTS once there are recurring users, which is why it sits behind a `VoiceProvider` interface no caller imports around. Echo keeps batch lesson narration; two TTS paths is deliberate, not duplication | /ORACLE.md §0 #2, §3.3 |
| Kid microphone / minors' voice to a third party | **DECIDED 2026-08-21 by the owner, overriding the plain reading of §1.9 after the conflict was surfaced.** Requires a blocking parental-consent gate, revocation effective on the next turn, all three `/LEGAL/` documents updated, and a data-processing agreement with the provider — the DPA is owner action and blocks kid rollout | /ORACLE.md §0 #1, §4.2, §4.3, §16 |
| Live-generated content shown to a minor without human publication | **DECIDED 2026-08-21 by the owner.** The largest §1.9 exception in the project, justified by learners who did not understand the canonical explanation and need another one now. Guarded by a deterministic-grading type allowlist, the Forge gates, an independent judge, answer-key re-execution before any XP, moderation, full provenance, and post-hoc sampled human review. A generation that fails any guard emits NOTHING | /ORACLE.md §0 #3, §7.3 |
| §1.5 browser exception #4 — Oracle's websocket | **DECIDED 2026-08-21, owner sign-off given; written into /AGENTS.md §1.5 with four enforced constraints.** Recommended: the browser opens a websocket straight to Oracle carrying a short-lived, single-use, session-scoped token minted by Core (never a raw Supabase JWT), on the same terms as the Supabase Realtime exception. Rejected alternative: relaying every audio frame through Core, which doubles the latency budget of the one feature where latency is the product and puts a streaming workload inside the service whose `/health` must not depend on anything optional. Oracle enforces all four: it rejects a Supabase JWT by name, burns the nonce on first use, checks the token's user against the session's, and refuses the socket for a minor with no active consent | /ORACLE.md §3.2 |
| Games (gamegen/game-engine) | **REVERSED 2026-07-31: the whole feature was removed after implementation** — see the Game Engine entry above and WALKTHROUGH.md | WALKTHROUGH.md |
| Embedded lesson games — what a game reports, and how | **OPEN.** KartRush is deployed and framed as of 2026-08-24; nothing crosses the frame yet. Needs, in order: a pedagogical definition of "progress" worth recording, then a closed `postMessage` vocabulary with strict origin checks both ways, then a PII-free Core-minted session identity, then server-authoritative grading before any XP. Deliberately not designed in advance of the first answer | ROADMAP.md (games entry) · `KartRush/docs/21-DEPLOYMENT.md` §5 |
| License | OPEN (UNLICENSED placeholder) | README.md |
| CD mechanism | **DECIDED 2026-07-17: token-based CLI deploys (`railway up` / Vercel CLI) from GitHub Actions, no native Git-App connection on either platform** — supersedes the earlier "platform-native" backlog item | this file, Day 8 above |
