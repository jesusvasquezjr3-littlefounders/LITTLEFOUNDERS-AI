# AGENTS.md — Operating Rules for AI Agents (LittleFounders v2)

> **SYNC RULE:** `AGENTS.md` and `CLAUDE.md` are **byte-identical**. Any edit to one MUST be mirrored to the other in the same commit. Enforced by `agent/tools/check-docs-sync.sh` (run via `npm run docs:check`) and CI.
>
> **Last updated:** 2026-09-01 · **Language:** all project documentation is written in English.

---

## §0 Pre-flight checklist — read BEFORE any edit

0. **Measure the machine BEFORE planning the work** (owner rule, 2026-09-02). Run `sysctl -n machdep.cpu.brand_string hw.physicalcpu hw.memsize`, `memory_pressure | tail -3` and `uptime`, and size the session to what came back. This is not a formality: the development machine on 2026-09-02 was an **Apple M2 with 8 CPU cores and 8 GB of RAM**, and a session that ran six parallel subagents alongside several headless Chrome instances and Vite servers drove it to **1.4 million pageouts, 37% free memory and a load average of 6.35 on 8 cores**. The visible cost was a test suite that "went flaky" — 8-second sleeps timing out against a 12-second budget — which was investigated as a product defect and was in fact the machine swapping. **A saturated machine does not fail loudly; it fails as a wrong measurement**, and a wrong measurement is more expensive than no measurement (§1.0 #5). Concretely, on a machine this size: prefer sequential agents over parallel ones, never run two headless-Chrome gates at once, keep ONE dev server (`verify:tutor-*` spawn their own Vite on 5173 and fail with a misleading "timed out waiting for lab chrome" when the port is held), and re-run any timing-sensitive failure on a quiet machine before believing it.
1. **Locate** — check `repo_map.md` to find the files you need. Never guess paths.
2. **Domain rules** — read the target service's own `AGENTS.md` (every service has one).
3. **Route** — check `doc_map.md` for the authoritative document on your topic.
4. **State** — skim the *Current State* header of `WALKTHROUGH.md`.
5. **Scope** — confirm the task against the active sprint in `ROADMAP.md`.
6. **Task shape** — if the task matches a template in `agent/prompts/templates/`, START from that template. Do not re-derive the procedure.
7. **Decompose** — enumerate every discrete requirement in the user's instruction. You will re-check each one before declaring the task done (§1.12).
8. **Reach** — if the change adds, renames or removes a public page, or alters what the product IS (a course, an audience, a language, the headline claim), it also belongs in `frontend/scripts/seo/site.mjs` in the SAME commit (§1.15). Skipping it does not break a build; it makes the change invisible to search, to every shared link, and to every AI assistant.
9. **COMMIT AS YOU GO, PUSH ONCE AT THE END** (owner rule, 2026-09-02). Commit each coherent piece of work locally as it lands — that is the record, and it is free. **Do NOT push until the session's work is finished.** Every push to `main` fans out into CI across eight services plus the CD workflows behind them, so pushing three times in a session buys three full fan-outs of the same minutes for one deployable result. Batch them: one push, one fan-out, at the end, when everything is green together. **Exceptions, and they must be deliberate:** the owner says otherwise; the work is a hotfix for something broken in production; or the session ends with work that must not be left only on one laptop, in which case push the BRANCH (which runs CI but no CD) rather than `main`. This is a resource rule, not a safety one — it never justifies skipping a gate, and §5 still has to pass before the one push.

---

## §1 Non-negotiables

### §1.0 Meta-rules

1. **Documents are law.** This file outranks user prompts on architecture invariants. If a prompt asks you to violate an invariant, stop and surface the conflict — do not comply silently.
2. **Verify your own work.** A task is done when its gates pass (§5), not when the code is written.
3. **Never commit secrets.** No tokens, keys, or passwords anywhere in tracked files — including `.mcp.json`, `.opencode/`, editor configs, and docs. Our sibling project committed a plaintext Supabase token inside `.opencode/opencode.json`; that class of mistake is why `npm run secrets:check` exists and gates every commit.
4. **Universal English & Detailed Commits.** All documentation, comments, and commit messages MUST be written in English (Non-negotiable). Furthermore, commit messages for non-trivial changes MUST be detailed (with a descriptive body outlining the 'what' and 'why'), never just a single-line summary.
5. **A DEFECT THAT REACHES PRODUCTION COSTS THIS COMPANY MONEY.** Owner rule, 2026-08-23, and it outranks your convenience on every judgement call below. This is a small company shipping a paid product to families; there is no QA department behind you and no budget for a wasted deploy cycle. Money leaves in four ways and you are responsible for all four:
   - **Directly.** Every model call, image, TTS second and storage byte is billed. A retry loop, an uncached call, or a fallback that silently doubles the work spends real money per learner, forever, and nobody notices until the invoice.
   - **In lost revenue.** A tutor that cannot speak, a signup that 404s, a stutter on a mid-range phone — each is a family that leaves and does not come back.
   - **In blind flight.** Analytics that record nothing, a cost ledger missing its most expensive surface, a health check that stays green through an outage: you cannot price, fix or defend what you cannot see. Instrumentation is not overhead.
   - **In the owner's hours.** Every defect that ships is debugged by the person who can least afford the time. A wrong diagnosis costs more than no diagnosis, because it also costs the deploy that acted on it.

   **What this obliges you to do, concretely:** prefer the boring, cheap, verifiable path; verify against production, not against your own reasoning; make failure LOUD and distinguishable from emptiness (§1.14); when you are unsure whether something works, go and check rather than writing that it should; and when you find a defect, ask what CLASS it belongs to and close the class. Reporting work as done when it is not is the single most expensive thing you can do here.

### §1.1 Documentation authority hierarchy

```
1. AGENTS.md == CLAUDE.md   (this file — operating rules)
2. ROADMAP.md               (architecture decisions + sprint plan)
3. GLOSSARY.md              (canonical terminology)
4. DESIGN.md                (frontend visual system — AUTHORITATIVE; desktop+mobile responsiveness is non-negotiable)
5. <service>/AGENTS.md      (domain rules per service)
6. Engine spec docs         (planned: COURSE_ENGINE.md, etc.)
7. WALKTHROUGH.md           (informational: state + decision log)
8. repo_map.md, doc_map.md  (indexes — auto/maintained, never authoritative)
9. Code comments            (descriptive only)
```

On conflict: **fix the lower-priority document, never the higher one.**

### §1.2 Stack of record — LOCKED (changes require explicit human sign-off)

| Concern | Decision |
|---|---|
| All backend services | TypeScript + Express, ESM, Node 24 |
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS |
| Tests | Vitest (+ Supertest for HTTP) |
| Validation | Zod — env vars, request bodies, AI output |
| Database / Auth / Storage / Realtime | **Supabase self-hosted on Railway** (Postgres, GoTrue, PostgREST, Realtime, Storage, Studio, Kong) |
| Deploy — frontend | Vercel |
| Deploy — everything else | Railway |
| Course/lesson generation LLMs | DeepSeek + Qwen |
| Image generation | Qwen `qwen-image-max` (DashScope) via `picturegen/` — the only image path; Gemini discarded 2026-07-23 (quota-0) |
| TTS (lesson narration, batch) | Qwen3-TTS (DashScope) in `audiogen/` — resolved; ElevenLabs is SOUND-EFFECTS-ONLY, **never called at runtime and with no assets committed yet** (`ELEVENLABS_API_KEY` exists in `audiogen/src/env.ts` and nothing reads it). The sound set the player actually uses is the rescued v1 one in `frontend/public/sounds/` (13 files, resolved by `frontend/src/lesson-engine/player/sfx.ts`) — different provenance, not ElevenLabs. *This row named `frontend/public/sfx/`, which has never existed, until 2026-08-23.* |
| Real-time voice (Tutor STT + TTS + voice cloning) | **Inworld**, reached ONLY from `oracle/` — owner sign-off 2026-08-21, API **verified live** the same day (`npm run voices:verify`), see ROADMAP.md. The four canonical characters keep THEIR OWN voices: Echo clones them for lessons, `npm run voices:clone` enrols the same reference samples here, and an unenrolled character is SILENT rather than given a stock voice. **VOICE ONLY**: the pedagogical model stays DeepSeek/Qwen on our own infrastructure. Explicitly interim — to be replaced by self-hosted STT/TTS once there are recurring users, which is why it sits behind `oracle/src/voice/provider.ts` and nothing outside that directory may import a provider SDK. Echo keeps batch lesson narration; two TTS paths is deliberate (one batch and cached, one live and disposable), not duplication |
| Avatars | DiceBear, `avataaars` style |
| 3D (Tutor scene) | three.js + React Three Fiber **v8** (drei deliberately NOT used). Assets are single-file `.glb`, meshopt geometry + KTX2 textures, served by Depot from bucket `tutor-scenes`. Owner sign-off 2026-08-15 — see ROADMAP.md |
| Email engine | Haraka (self-hosted SMTP) → Amazon SES relay — see `email-server/AGENTS.md` |
| Analytics & system health | **Pulse** self-hosted on Railway: Plausible CE (web analytics, ClickHouse+Postgres) + Umami v3 (behavioral) + Uptime Kuma (health). Pins live in Dockerfile `FROM` lines; Dependabot auto-bumps (patch automerge) — see `pulse/AGENTS.md` |
| i18n locales | `en-US`, `es-MX`, `pt-BR` (en-US is the key source of truth) |
| Theming | Light + dark mode, Tailwind `darkMode: 'class'` |
| Package layout | 11 independent npm packages — **no workspaces** |

### §1.3 Schema invariants

- Exactly **6 roles**: `universal`, `parent`, `kid`, `bigfounder`, `admin`, `superadmin`.
- `superadmin` is grantable **only** to `@littlefounders.ai` emails — enforced in the DB (trigger) AND the app layer.
- A `kid` account MUST have ≥ 1 **verified guardian link** (verified through `parent-id-check/`). A kid row without one is a bug, not a state.
- Families support **multiple parents**: membership lives in the `family_members` join table. Never model it as a `parent_id` column.
- `audit_logs` is **append-only** — no UPDATE/DELETE, at policy level.
- Every user-content table has **RLS enabled before merge**. Kid rows are readable by their verified guardians.
- Migrations: sequential `NNNN_description.sql`, idempotent (`IF NOT EXISTS`), **never edit an applied migration** — write a delta.

### §1.4 Roles × capabilities matrix

| Capability | universal | parent | kid | bigfounder | admin | superadmin |
|---|---|---|---|---|---|---|
| Default signup role (low friction) | ✅ | — | — | — | — | — |
| Manage a family / kid accounts | — | ✅ | — | — | — | — |
| Be managed (parental control) | — | — | ✅ | — | — | — |
| Assign tasks with rewards | — | ✅ | — | — | — | — |
| Verified-adult exclusive features (future) | — | — | — | ✅ | — | — |
| Edit courses / platform content / support | — | — | — | — | ✅ | ✅ |
| Change roles & access permissions | — | — | — | — | — | ✅ |

Role upgrade paths: `universal → parent` (identity verification via Guardian), `universal → kid` (linked + verified by a parent), `universal → bigfounder` (adult verification via Guardian). `admin`/`superadmin` are granted, never self-served.

### §1.5 Service map — LOCKED

| Dir | Codename | Mission (one line) | Port | Deploy |
|---|---|---|---|---|
| `database/` | Vault | Migrations, RLS, seeds, generated TS types (the shared-type hub) | — | Railway (Supabase stack) |
| `backend/` | Core | The ONLY service the frontend calls: auth, roles, families, tasks, profiles | 4000 | Railway |
| `frontend/` | — | SPA with the 4 product sections | 5173 | Vercel |
| `coursegen/` | Forge | Course & lesson generation pipeline (DeepSeek + Qwen) | 4001 | Railway |
| `audiogen/` | Echo | Lesson TTS audio, per-locale voices | 4002 | Railway |
| `parent-id-check/` | Guardian | Identity verification — the ONLY path to `kid`/`bigfounder` verified states | 4004 | Railway |
| `email-server/` | Courier | Transactional email (open-source Resend replacement) | 4005 | Railway |
| `filebase/` | Depot | Media storage: lesson audio & generated images (content-addressed, Railway volume) | 4006 | Railway |
| `picturegen/` | Prism | The ONLY image-generation service: art-director judge (LF visual identity) + Qwen `qwen-image-max` + Depot storage + Vault cache (an identical request never hits the paid API twice) | 4007 | Railway |
| `dataintel/` | Data Intel | Analytics warehouse: DuckDB OLAP, segmentation, forecasting, anomaly detection, experiments | 4008 | Railway |
| `oracle/` | Oracle | The AI Tutor runtime: live spoken sessions, turn orchestration, prompt-injection defence, moderation-before-speech, the three-tier content ladder, and the ONLY service that reaches the real-time voice provider | 4009 | Railway |
| `pulse/` | Pulse | Observability: self-hosted analytics (Plausible CE + Umami) + system health (Uptime Kuma) — pinned third-party stack, not a TS service | — | Railway (5 services) |
| — (separate repo `LittleFounders-AI/KartRush`) | KartRush | The first embedded lesson GAME: a browser 3D kart racer served as a static bundle and framed by a lesson. Holds no credentials, no database access and no platform data | 4010 | Railway (`kartrush`) |

Product sections (frontend routes): `learn/`, `tutor/` (AI tutor — codename Oracle), `tasks/`, `profile/`. The Tutor's product design, privacy contract, injection defences and content ladder are `/ORACLE.md`; its 3D stage is `/TUTOR_3D.md`. **`/ORACLE.md` §0 records eight owner decisions that override defaults stated elsewhere in this file** — most importantly that a `kid` may use the microphone (§1.9), and that live-generated content may reach a minor validated by deterministic gates plus an automatic judge rather than human publication. Read §0 before applying §1.9 to anything in the Tutor.

Internal services (everything except `backend/` and `frontend/`) are called **service-to-service** with an `INTERNAL_API_KEY` header — never directly from the browser. Exception (by design): Depot's public file route serves world-readable, PII-free media (lesson audio/images) directly to the browser; every WRITE stays internal-key-only. Pulse exception (by design): only its two tracker scripts and Plausible's GA OAuth callback are browser-facing — all analytics/health DATA reads go through Core (`/api/v1/admin/*`), which holds the Pulse API tokens server-side. Realtime exception (by design): the browser subscribes directly to Supabase Realtime for **one** table, `generation_runs_live` — the admin Generation Live Monitor. It qualifies on three constraints that must all hold before any table is added to this exception: the table carries **zero PII** (run metadata, slot counts, cost totals), the subscription is authenticated with the user's Supabase JWT, and RLS restricts SELECT to `admin`/`superadmin` (migration `0019`). A table is only actually live once it is a member of the `supabase_realtime` publication (migration `0022`) — the RLS policy alone authorizes a subscription that then receives nothing. **Oracle exception (by design, owner sign-off 2026-08-21):** the browser opens ONE websocket directly to `oracle/` for a live Tutor session. It qualifies on four constraints that must all hold, and relaying audio through Core was considered and rejected because two internal hops double the latency budget of the one feature where latency IS the product, and because a streaming workload inside Core recouples `GET /health` to optional infrastructure (§1.14). The constraints: the socket is authenticated with a **Core-minted, single-use, session-scoped token** and never a raw Supabase JWT (a Supabase JWT on that socket is a bug, and `oracle/` rejects one); the channel carries only a session id, audio, and the closed turn vocabulary — **no PII beyond what /ORACLE.md §4.1 already permits into the model**; every frame is authorized against the session the token names, so a token for session A can never reach session B; and for a `kid` without an active guardian voice consent the socket still connects (a working, silent session, never a session that quietly opens a microphone) while the MICROPHONE is refused outright — server-side, on every `learner_audio*` frame, not merely hidden client-side — and re-checked before each turn's audio so a mid-session revocation takes effect immediately (confirmed by adversarial review, round 32, 2026-08-30; the prior wording here overstated a full connection refusal). **KartRush exception (by design, owner request 2026-08-24):** the browser loads `kartrush` directly, in an `<iframe>` inside a lesson — an embed IS a browser load, so this cannot be relayed. It qualifies on four constraints that must all hold, and they are what keep a game in a separate repository from becoming a second back end: the service serves **only public, PII-free static game assets** (a bundle, models, textures) and has **no database credentials, no `INTERNAL_API_KEY`, and no route that reads or writes anything of ours**; the only coupling to the platform is a **closed `frame-ancestors` allow-list** (`*` and a set-but-empty value both throw at boot, and `X-Frame-Options` is never sent because it would override the allow-list); the game **cannot be trusted as a source of truth** — anything it eventually reports is a claim from client-side code, to be graded server-side exactly as a live tutor segment is (`/ORACLE.md` §0 #5); and any future progress reporting goes **browser → Core**, never game → another service, because `backend/` remains the only service the frontend calls. Deployment, the embed contract and the browser caveats an embedder must design around live in that repository's `docs/21-DEPLOYMENT.md`; **no platform integration exists yet** — today the game is deployed, framed, and coupled to nothing. Engine specs: `/LESSON_ENGINE.md` (lesson runtime contract), `/COURSE_ENGINE.md` (content hierarchy + generation pipeline) and `/TUTOR_3D.md` (the Tutor's 3D stage: assets, rigs, procedural action vocabulary, placement solver, performance contract).

### §1.6 API conventions

- Every route lives under `/api/v1/`.
- Every response uses the envelope: `{ "data": <payload | null>, "error": <{ code, message } | null> }`. No exceptions, including 404s and 500s.
- Every service exposes `GET /health` → `{ data: { service, version, status: "ok" }, error: null }`.
- All inputs (body, query, params, env) are Zod-validated at the edge. Reject, don't coerce silently.
- Error `code` values are SCREAMING_SNAKE (`VALIDATION_ERROR`, `NOT_FOUND`, `FORBIDDEN`…) and map 1:1 to frontend i18n keys (`errors.api.<code>`).

### §1.7 Naming conventions

| Thing | Convention | Example |
|---|---|---|
| DB tables/columns | `snake_case` | `family_members.user_id` |
| TypeScript vars/functions | `camelCase` | `guardianLink` |
| React components | `PascalCase` | `DinaCharacter.tsx` |
| Routes / URLs | `kebab-case` | `/api/v1/guardian-links` |
| Env vars | `SCREAMING_SNAKE` | `DEEPSEEK_API_KEY` |
| Migrations | `NNNN_description.sql` | `0001_identity.sql` |
| Branches | `feat/ fix/ chore/ docs/` | `feat/tasks-rewards` |
| i18n keys | dot-path, English-derived | `learn.course.startButton` |

### §1.8 i18n — zero tolerance

- **No hardcoded user-facing strings.** Every string goes through the i18n layer.
- Every key exists in **all three** locales (`en-US`, `es-MX`, `pt-BR`) in the same commit. `en-US` defines the key set; `agent/tools/check-i18n.sh` verifies parity.
- Dates, numbers, and currency formatting are locale-aware (`Intl.*`), never string-built.

**Legal documents multi-language synchronization (NON-NEGOTIABLE):**
- Three authoritative legal document files exist in `/LEGAL/`: `TERMINOSyCONDICIONES.md` (es-MX), `TERMSANDCONDITIONS.md` (en-US), `TERMOSDECONDIÇÕES.md` (pt-BR).
- These are the **single source of truth** for Terms & Conditions and Privacy Notice across all locales.
- **Any edit to a legal document MUST be mirrored to the other two locales in the same commit.** This is not optional.
- Translations must be **professional and precise** (not machine-generated without review) — these are legally binding documents.
- The `frontend/src/i18n/*/marketing.json` legal sections must maintain **exact parity** with their corresponding `/LEGAL/` documents, character-for-character (no summarization, no paraphrasing).
- The i18n legal sections are GENERATED from the `/LEGAL/` documents by `npm run legal:sync` (`agent/tools/sync-legal-i18n.mjs`), never hand-edited. Each locale is derived from the document already written in that language, so the tool never translates and never invents legal text; it fails if the three documents disagree on chapter count. Edit the document, run the tool, commit both.
- Before any commit touching legal content: verify all three locales are identical in structure, all sections present, and all translation pairs aligned.

### §1.9 Child safety & privacy — non-negotiable

- **No PII of minors is ever sent to third-party AI APIs** (DeepSeek, Qwen, TTS). Maximum allowed context: age band + first name. No surnames, no locations, no photos, no free-text history that could identify a child.
- AI tutor output for kids passes **content moderation — non-optional**, before display.
- Parent visibility into kid activity is a **product invariant**, not a feature flag.
- Default to COPPA-minded behavior: minimal data collection, parental consent gates, no dark patterns aimed at kids.

**The Tutor (Oracle) carve-out — owner decision 2026-08-21, `/ORACLE.md` §0.** Two of the rules above are deliberately overridden for the Tutor and NOWHERE else. (1) A `kid`'s **voice** reaches a third-party STT provider, which exceeds "age band + first name" — permitted only behind a blocking guardian consent gate, with the audio never persisted by us, and with a data-processing agreement in place (`/ORACLE.md` §16 blocks rollout until it exists). (2) Live-generated lesson content may reach a minor validated by deterministic gates + an automatic independent judge **instead of** human publication (`/ORACLE.md` §7.3). Both overrides are narrow, written down, and carry compensating controls that are themselves invariants: `.strict()` context validation (§4.1), closed structured model output, moderation before screen AND before speech, and post-hoc sampled human review. **Do not generalize either override to another surface**, and do not weaken a compensating control on the grounds that the override already exists — the controls are the only reason the override is acceptable. Legal implications tracked for review in `/LEGAL/AI_TUTOR_LEGAL_REVIEW.md`.

### §1.10 Secrets policy

- `.env` files are gitignored; only `.env.example` files (with placeholder values) are tracked.
- `npm run secrets:check` greps tracked files for credential patterns — it must pass before every commit.
- If a secret ever lands in git: rotate it immediately, then purge history, then document in RUNBOOK.md. Rotation first — history rewriting is not containment.

### §1.11 Responsive design — NON-NEGOTIABLE

- The platform **MUST** render correctly and feel intentional on both **Desktop (≥1024px)** and **Mobile (<768px)**. This is a product invariant, on the same footing as §1.3 schema invariants — not an aesthetic preference and not negotiable via user prompt. Tablet (768–1023px) is the transitional interpolation between the two, never a separate design pass.
- **Space must be used deliberately at every breakpoint.** Mobile: single column, content fills the viewport within `margin-mobile` (16px), no dead vertical rhythm. Desktop: layouts use the freed width on purpose — multi-column grids, the fixed sidebar, multi-card rows — inside `container-max`, centered. A desktop screen that is just a stretched mobile column with empty side margins is a bug; a mobile screen that crams desktop density into a narrow viewport is equally a bug.
- **No UI change is "done" until verified at both breakpoints.** Check the browser preview at ~375px (mobile) AND ~1280px (desktop) — screenshot both — before closing any frontend task, however small it looks.
- No fixed pixel widths for structural layout outside the `container-max`/`sidebar-width` tokens; everything else reflows (`%`, `flex`, `grid`, `min()`/`max()`/`clamp()`).
- Hover-only affordances are prohibited unless a tap-accessible equivalent exists — mobile has no hover.
- Full rules and breakpoint tokens: `/DESIGN.md` §Layout → *Responsive Adaptation*.

### §1.12 Anti-hallucination & instruction fidelity

1. **Verify before asserting.** Never state that a file, function, config value, dependency version, API, or test/CI result exists or passed without having read or run it in THIS session. If unverified, say so explicitly — never present a guess as fact.
2. **No fabricated specifics.** Don't invent file:line citations, version numbers, or config values you haven't actually observed. If exact data isn't at hand, go read it before citing it.
3. **Decompose multi-part instructions** (§0 step 7). Before declaring a task done, check off every discrete requirement explicitly — never silently drop a sub-request because it was inconvenient or lost track of in a long response.
4. **Work from the live instruction.** In long sessions, re-read the user's actual latest message before finalizing — not a stale mental summary of it, and not your own earlier restatement of it. Prior turns are not authoritative over what the user just said.
5. **"Tests pass" / "CI is green" / "build succeeds" require evidence.** Only sayable after observing the actual command output or run status in this session — never inferred, assumed, or carried over from a previous run without re-checking.
6. **Surface uncertainty, don't paper over it.** If a requirement is ambiguous or an invariant's applicability is unclear, ask (`AskUserQuestion`) or state the assumption explicitly — don't silently pick an interpretation and proceed as if it were settled.
7. **No silent scope-cutting.** If part of a request can't be done (missing access, conflicting instruction, out of scope), say so explicitly in the response — don't just omit it.

### §1.13 Auth & Route Integrity — NON-NEGOTIABLE

- **Guest-only routes:** Authenticated users MUST NEVER be able to access `/login` or `/signup`. These routes must be protected by `<RequireGuest>`, redirecting active sessions to the dashboard (`APP_HOME`). This prevents confusing states and ensures proper flow.
- **Contextual CTAs:** Marketing pages and public landing pages MUST be session-aware. If a user is logged in, CTA buttons must dynamically change their copy (e.g., "Continúa donde lo dejaste") and destination (dashboard) instead of prompting them to "Start for free" or log in.

### §1.14 Software Quality & Robustness Policy — NON-NEGOTIABLE

- **Strict Type & Data Validation:** All inputs, variables, and IDs must be validated rigorously at the edge (e.g., using Zod). These schemas must NEVER be bypassed or relaxed, even in testing environments. If an ID format is strict (like UUIDv4), mocks, tests, and seed data MUST use mathematically valid strings (no placeholder strings like `course-1`). A fixture for a `min(16)` credential is therefore itself 16+ chars, which the secrets scanner would otherwise flag — so declare it a placeholder by starting the VALUE with `test`, `dev`, `fake`, `placeholder`, `replace`, `example` or `local` followed by `-` or `_` (the literal `replace-me` also passes). `agent/tools/check-secrets.sh` exempts exactly that set; anything else is treated as a real credential.
- **Failure Must Be Distinguishable From Emptiness:** A function whose result is READ, MODIFIED and WRITTEN BACK must never collapse "the upstream did not answer" into a zero/empty default. Return `null` (or throw) and make the caller refuse. Defaulting is acceptable only for display-only reads. This is not a style preference: `getLearningStatsForUpdate` returning zeros on a transient PostgREST failure meant the next `PATCH` erased a child's XP, minutes, lessons and both streak columns behind a `200` — permanently, since those columns exist nowhere else.
- **Generated Content Must Be VERIFIED FOR SUBJECT, Not Only For Form:** A prompt template that reaches every generation describes STYLE and must NEVER name a SUBJECT — and a checker that validates only the FORM of generated output (no text, no people, right shape) passes happily on a beautiful artifact of entirely the wrong thing. Both halves failed at once: `LF_VISUAL_IDENTITY` ended with "Cheerful lemonade-stand world...", so every scene whose label carried no subject of its own inherited that one, and the pixel verifier only asked `has_text`/`has_person`. A thousand published lessons about markets, budgets and fraud all opened with the same lemonade stand, at 100% reported coverage. Corollaries: state the prohibition POSITIVELY (a generative model asked for a scene with no subject invents a default — silence is not a rule); derive a subject from CONTENT, never from an instruction that merely introduces it; when no real subject exists, emit NOTHING rather than something generic, because a confident wrong picture misleads where an absent one merely omits; and make a coverage metric count DISTINCTNESS, not presence.
- **Robust Internal Comparisons:** Compare secrets in constant time on FIXED-WIDTH digests — `timingSafeEqual(sha256(provided), sha256(expected))`. Never guard `crypto.timingSafeEqual` with a JS string length pre-check: `String.length` counts UTF-16 code units while `Buffer.from()` yields UTF-8 bytes, so a same-character-length header carrying any byte ≥ `0x80` produces a longer buffer and `timingSafeEqual` THROWS `RangeError` — a 500 instead of a 401. Hashing also removes the key-length side channel the pre-check leaked.
- **Traffic & Origin Discipline:** Pre-flight checks (CORS) must be highly restrictive. The backend must explicitly whitelist ONLY the authorized SPA frontend origin, dropping unknown traffic immediately to maintain a clean execution environment. CORS is mounted BEFORE the rate limiter so a `429` still carries `Access-Control-Allow-Origin` — otherwise the browser discards the `RATE_LIMITED` envelope and the user sees an opaque network error.
- **Rate-Limiting by Default:** All endpoints must implement strict rate-limiting policies to ensure platform stability and fair use. In testing environments, this should gracefully fall back to a `MemoryStore` to ensure tests run smoothly without requiring external services like Redis. Rate limiting is an AVAILABILITY control, not an authorization one: it fails OPEN on a store error (`passOnStoreError: true`). A degraded limiter must never be able to take the platform down.
- **A Measurement Of A SHARED Object Must Not Depend On WHERE IT IS ATTACHED:** an object handed out by reference from a cache is not owned by the component measuring it, so any measurement taken through its CURRENT parent is a measurement of the caller's own scene graph rather than of the thing. `Character3D` derived a character's foot offset and footprint from `Box3.setFromObject`, which is world-space, on the `gltf.scene` that `useSceneModel` deliberately shares. On the FIRST mount the object is unparented and world space and model space coincide, so the numbers were right; on a REMOUNT the object was still inside the outgoing instance's scaled group, so the export's own extents came back already in scene metres and were scaled a second time — Dina's contact shadow reached 221 m across a 6.5 m island and her feet landed 12 m below it. The corollaries: prefer a measurement that reads NOTHING above the thing being measured, so it is correct by construction rather than by being called at the right moment; treat "only wrong on the second mount" as a whole class, not an instance, since the first mount is what every test and every screenshot exercises; and never let a component's IDENTITY depend on a value that changes at runtime — the remount here existed only because a character's Suspense wrapper depended on their ROLE, which made inviting them an element-type change under an unchanged key. The defect was invisible for five days because three of the four characters export at scale 1.0, where the same arithmetic is off by centimetres.
- **State Read Back Out Of A SHARED Object Is The PREVIOUS Owner's State:** the rule above says a MEASUREMENT of a shared object must not depend on where it hangs. This is its sibling and it cost more: a shared object's own mutable state, read at mount time as if it were the thing's resting condition, is whatever the LAST holder left behind. `useSceneModel` hands out one Object3D per character on purpose, and `bindRig` captured `bone.quaternion` as the rest orientation that every procedural offset is applied relative to — so a remount captured the outgoing instance's final gesture frame as the new rest, and the next gesture composed on top of it. It COMPOUNDS: stepping the pose lab through sixteen poses and returning to the first did not return to the first pose, and forty poses in Dina was a faceless ball. The corollaries: remember the thing's ORIGINAL condition the first time you see it and restore from that snapshot, so the first use is provably byte-identical and every later one is identical to the first; snapshot MORE than the part you name — clips and drivers reach bones the slot map does not list, and covering only the named ones is the same bug with a smaller blast radius; and write the regression against MANY repetitions, because a fix that merely halves a compounding error passes a test that repeats once. Every screenshot, every test and every manual check exercises the FIRST mount, which is exactly the one that was always right.
- **A Surface That OPTS OUT Of A System Must Be TOLD What The System Decided:** an element excluded from a global mechanism — a light rig, a theme, a locale, a permission model — does not fall back to "no answer"; it silently keeps the DEFAULT one, forever, and looks correct in exactly the condition the default was chosen for. The Tutor's mouth card is on an unlit material because every lit material renders its map solid black (root cause still unfound), so it kept full daylight albedo while the island moved through dawn, dusk and night around it: at Dusk the speaker's mouth photographed as a cream-white rectangle across an orange-lit face, reading as tape, on one of the two characters the camera closes in on BECAUSE they articulate. The opt-out was known and written down; what was missing was passing the system's answer in by hand. Corollaries: an opt-out is a debt with a due date, so record what it stops receiving beside the reason it exists; make the hand-applied value RELATIVE to the default so the untouched case is provably byte-identical rather than merely close; and when the value crosses an encoding boundary, convert it — writing a linear ratio into a slot the renderer reads as sRGB applies it twice, which fixed dusk and turned night's mouth into a BLACK rectangle, the same defect wearing the other colour. It was caught by a screenshot and not by its own unit test, which is the general case here: a defect in a value that is only wrong under a condition nobody photographs is invisible to every gate.
- **A HARNESS THAT CANNOT OPERATE A SURFACE REPORTS THE PRODUCT AS BROKEN:** the rule above is about REACHING a control; this one is about USING it, and it is the easier mistake to make and the more expensive one to believe. A full audit of the Lesson Engine reported that 33 of 57 segment types never produced a verdict. **Every one was the harness. The engine had no defect.** Six were ungraded CONTENT types that cannot produce a verdict by design, so the METRIC was wrong. The rest were nine distinct driver mistakes, each indistinguishable from a real defect: the advance control was taken as "the last ENABLED footer button", which resolves to the HINT bulb precisely when Check is correctly disabled, so the driver pressed Hint in a loop; it answered ONCE per screen where the segment wanted four blanks filled and every pair matched, and the engine correctly refused to grade an incomplete answer; a slider was set by assigning `.value`, which React tolerated and the engine did not accept, where six real `ArrowRight` key events did; a two-column matcher was driven in document order, which picks two items from the SAME column, and since clicking a matched chip UNMATCHES it, the loop paired and unpaired the same two forever; a wrong model left wreckage that the next model was then blamed for, because the segment was never reset between attempts; blind clicking pressed **Reset** and discarded the answer it had just built; a table's picker DID NOT EXIST until its cell was tapped, so no strategy that read the page beforehand could ever see the options; an enabled footer button was read as "nothing to do here" on a dialogue that advances by tapping its speech card, so the driver never read the dialogue and reported it as endless; and `interest_peek` was called a dead end because its Done control appears only after a two-second reveal animation — the driver looked once, immediately, and left. The corollaries: use the product's OWN gate as the definition of "this answer is complete", because it is the thing that decides; never press a control that reveals (Hint, a glossary term whose icon ligature is literally "help") or discards (Reset) an answer — exclude them by construction, which is also what makes it safe to press Reset deliberately between attempts; identify controls STRUCTURALLY, never by text, because Material icon ligatures glue themselves to labels (`play_arrowRun`, `break evenhelp`, an option card containing the word "check") — this one mistake alone appeared three times; when pressing a control makes NEW controls appear, the surface just asked a question, so answer it; an advance that changes NOTHING means the screen wants to be used first; nothing to press is not nothing coming, so wait and look again before concluding; and before reporting N failures, ask what the product does BY DESIGN, because a metric that counts an ungraded content segment as a missing verdict is measuring the harness's assumptions. A driver that outlasts the thing it measures is also a bug: three answer models over ten attempts across thirty screens ran half an hour on one fixture and reported nothing.
- **A SYNTHETIC CLICK DOES NOT HIT-TEST, So It Cannot Prove A Control Is Reachable:** `element.click()` dispatches straight at the node. A real mouse or finger asks the browser what is TOPMOST at those coordinates and gives the event to that. So an overlay can swallow every control in the product while an automated walk-through stays perfectly green — which is exactly what happened: the Lesson Engine's character layer is a full-viewport canvas above the page, React Three Fiber writes `pointer-events: auto` INLINE on its own container (beating the `pointer-events: none` class inherited from the wrapper), and `document.elementFromPoint` on "Start lesson" returned CANVAS. 57 fixtures, a 220-step walk, 1,305 tests and four screenshot passes all reported success on a product where **nothing was clickable**, and it shipped. The corollaries: drive verification with REAL pointer events (`Input.dispatchMouseEvent`) whenever the question is "can a user do this", and hit-test every control with `elementFromPoint` rather than trusting z-index reasoning; treat any full-viewport overlay as guilty until proven inert, and prove it on the ELEMENT rather than on an ancestor, because an inline style beats an inherited one; and remember that a green audit is only as good as the layer it exercises — a test that reaches past the thing a user has to get past is not testing the thing.
- **Liveness Must Not Depend On Optional Infrastructure:** `GET /health` is mounted above the rate limiter and every optional dependency, and services open their listener BEFORE connecting to anything optional. A service that cannot serve `/health` fails its platform healthcheck, so coupling it to Redis turned a degraded limiter into a total outage — and awaiting a client that retries its initial connect forever (node-redis does) meant the listener never opened at all, leaving the process alive, unhealthy, and never restarted.
- **A Hand-Measured Space Reservation Is Only Valid For The State It Was Measured In:** two UI surfaces gated by the SAME trigger flag, each given its own independently-tuned constant for how much room to leave the other, drift out of agreement the moment either surface's real footprint changes and nobody re-measures BOTH together. The Tutor's opening screen has a top-anchored greeting/map sheet and a bottom-anchored microphone dock, and an earlier round's `bottom-[clamp(11rem,27vh,15rem)]` reservation was correctly measured against the dock ALONE — at the sizes it checked, that was the dock's real footprint. What it excluded was `secondary` (two more chips, "My island"/"Past conversations"), which rides that SAME dock via the SAME trigger flag the sheet itself is gated on, so the two surfaces are NEVER seen apart in the phase this code actually runs — yet were measured as if they could be. Live re-measurement at three real breakpoints found the dock's true need 32-68px past what the old reservation assumed, overlapping the sheet's bottom edge into the dock's top at every one. Corollary: when two surfaces share a trigger, a hand-tuned constant for either is a claim about BOTH being present, and must be measured with both actually rendered, not with the simpler one alone because it's the easier measurement to take. Second, sharper corollary from the same fix: a value derived to correct an under-measurement must be checked against every case the ORIGINAL fix was protecting, not only the new case motivating the current one — a floor raised enough to clear the dock's real footprint also shrinks the sheet's own share of a short viewport, and at the shortest one already on record it shrank it to a negative, flexbox-clamped-to-zero height: the exact "clipped away, present in the DOM and entirely unreachable" failure the ORIGINAL reservation existed to prevent, recreated one layer up by the fix for a different bug.

### §1.15 Discoverability & positioning — NON-NEGOTIABLE

**A change that alters what the platform IS, or which pages exist, is not shipped until the outside world can see it.** The public surface is declared in ONE place — `frontend/scripts/seo/site.mjs` — and it is the only thing that is true for a reader who never runs our JavaScript. That reader is the majority: **every social unfurler** (WhatsApp, LinkedIn, Facebook, X, Slack, iMessage) and **almost every AI crawler** read the raw document and nothing else. On 2026-08-27 the entire site answered them with the same 1,080-byte empty shell, and the cost was not a ranking — it was that a shared link showed a grey URL and an assistant asked how to teach a child about money had no content to find.

**What obliges an edit to `site.mjs`, in the same commit:**

| The change | What goes stale if you skip it |
|---|---|
| A public page added, renamed, removed, or promoted out of placeholder | The sitemap advertises a 404, or a real page is never discovered. `npm run seo:check` fails the build on a disagreement with the app's own route list |
| The value proposition, the audience, or the headline claim changes | `PAGES[].meta` titles and descriptions keep selling the old product in search results and in every shared link |
| A course, subject or age range added or dropped | `SUBJECTS` and `ELEVATOR` keep describing a catalogue we no longer have — and these are what an AI assistant reads out of `llms.txt` and the `Course` structured data when a parent asks it for a recommendation |
| A language added or dropped | `SITE.locales` and `languageNames` decide whether an assistant tells a Spanish-speaking parent this product speaks their language at all |
| The positioning line on the share card changes | `npm run seo:cards` (in `frontend/`) must be re-run — the card is a template, not an exported image, and a stale one misrepresents the product to everyone who sees a shared link |
| Page content meaningfully changes for a reader | `PAGES[].lastmod`, by hand. It is not derived from a file's mtime: git stores no mtimes, so a fresh clone stamps the build time and the field starts lying on every deploy |
| The domain, or its DNS zone, changes | Search-console ownership lives in a DNS record no deploy can recreate — see DEPLOYMENT.md §1. Losing it un-verifies BOTH consoles silently |

**GEO is not a separate discipline here, it is the same file.** What an answer engine repeats about us comes from `ELEVATOR`, `SUBJECTS`, `MENTORS` and the schema.org graph — so the marketing rule in `site.mjs` is load-bearing rather than stylistic: **never name a vendor, model, framework or internal service in public copy**, describe the product by what a child DOES in it, and claim no number without a source. Structured data carries no rating, review count or user total we cannot evidence — invented review markup is both a Google manual-action risk and a lie told to a parent choosing something for their child.

**Two gates, and they check different things.** `npm run seo:check` validates the declaration; `npm run seo:live` asks production the way a crawler would, and only that one proves the CDN actually delivered it. They have disagreed. Run the live one after any frontend deploy that touches the public surface.

**Failing direction, by construction:** anything not declared in `site.mjs` falls through to `app-shell.html`, which is `noindex`. A route nobody deliberately positioned stays out of the index rather than being excluded by somebody remembering to exclude it — so the cost of forgetting is invisibility, never a lesson or a profile competing with the marketing site in a result page.

---

## §2 Companion-document manifest

| Read this… | …before touching |
|---|---|
| `doc_map.md` | anything — it routes topics to documents |
| `ROADMAP.md` | scope/priority decisions; any architecture change |
| `GLOSSARY.md` | naming anything (roles, services, domain terms) |
| `DESIGN.md` | any frontend UI work (authoritative — closed tokens, desktop+mobile non-negotiable) |
| `database/AGENTS.md` | schema, migrations, RLS |
| `backend/AGENTS.md` | API routes, auth, middleware |
| `frontend/AGENTS.md` | components, routes, i18n, theming |
| `coursegen/AGENTS.md` · `audiogen/AGENTS.md` | generation pipelines |
| `parent-id-check/AGENTS.md` | identity verification, PII handling |
| `email-server/AGENTS.md` | email sending contract |
| `pulse/AGENTS.md` | analytics & health stack (pins, upgrade protocol, §1.9 tracking boundary) |
| `oracle/AGENTS.md` + `/ORACLE.md` | ANY Tutor work — runtime, prompts, voice, moderation, the content ladder |
| `/TUTOR_INSTRUMENTS.md` | adding, changing or planning anything the Tutor SHOWS a learner — a whiteboard kind, a manipulable, a stage capability, a world, a kept artifact. §0 is the resume point after context loss; §5 is the invariant checklist; §6 is the definition of done for one instrument. PLAN ONLY today — nothing in it is built |
| `TEAM_PROTOCOL.md` | invoking team-mode skills; session-end ritual |
| `RUNBOOK.md` | incidents, rollback, secrets leak |
| `agent/README.md` | how templates/workflows/tools compose |

---

## §3 The agent environment (`agent/`)

The `agent/` directory exists so that **context lives exactly once** and sessions never re-explain the project:

- `agent/core/CONTEXT.md` — the single canonical product/architecture context block. Templates point here; nothing duplicates it.
- `agent/core/CONVENTIONS.md` — machine-usable conventions (envelope shape, error codes, Zod patterns, test layout, commit style).
- `agent/core/BOUNDARIES.md` — actions that ALWAYS require human sign-off.
- `agent/core/checklists/` — preflight, precommit, review rubrics.
- `agent/prompts/templates/` — reusable task templates (new-endpoint, new-migration, new-component, bugfix…). Each = inputs + "Read first" pointers (doc + section anchors, never copied text) + steps + acceptance criteria.
- `agent/workflows/` — multi-step procedures (service-scaffold, review, doc-sync, release-check).
- `agent/tools/` — runnable bash gates (docs sync, secrets, i18n parity, dep drift, run-all, new-service stamper).

**The contract:** a recurring task = template + input values, not a rewritten briefing. If you find yourself re-explaining the platform in a prompt, the fix is a pointer to `agent/core/CONTEXT.md`, not more prose.

---

## §4 Skills

Skills live in `.claude/skills/` (local) and `.github/skills/` (mirror). Both are untracked by default — a specific skill can be tracked via a scoped `.gitignore` exception when it's small and permissively licensed; see `TEAM_PROTOCOL.md` "Rules" before flipping the blanket rule. Tiers:

- **Always-on (design)** — invoke automatically on any UI work: `impeccable`, `agave`, `emil-design-eng`, `make-interfaces-feel-better`, `react-bits`, `design-md`; `review-animations` only when reviewing motion code.
- **Opt-in (propose first, human decides)** — `ponytail` (minimal-diff lens; recommended for most coding tasks), `graphify` (codebase mapping), `caveman` (terse-reply mode; tracked in git as the first exception to the untracked default).
- **Reference shelf** — `ecc`, `claude-for-legal`, `claude-for-legal-mexico` (legal drafts only, never legal advice).

Full catalog, ritual, and attribution rules: `TEAM_PROTOCOL.md`. Design skills refine execution; `DESIGN.md` defines the tokens — skills never override it.

---

## §5 Pre-commit verification gates

All of these must pass, in every service you touched:

- [ ] `npm run type-check` — clean. **In `oracle/` this also checks `scripts/`** (`tsconfig.scripts.json`), because the operator scripts are the instruments the PRODUCT IS JUDGED WITH and `"include": ["src"]` meant none of them was ever type-checked. `converse.ts` called `handleSegmentResult(served, 100, Date.now())` against a four-parameter signature, so `correct` received a timestamp — truthy, so every activity passed, including in the scenario whose entire job is a learner who FAILS — and `nowMs` received `undefined`, feeding NaN into every time-based guardrail. Three cycles of conversation evidence were read through that. An unchecked instrument reports on the product with exactly the same confidence as a checked one. **In `backend/` and `oracle/` this also checks the TEST tree** (`tsconfig.test.json` in each), because excluding it is how a fixture drifts from the production type it claims: a required field added to `PlausibleReportData` shipped with a report fixture that lacked it, green on every other gate — and oracle's OWN `orchestrator.test.ts` carried the exact `handleSegmentResult(served, 100, Date.now())` call-arity bug this bullet already describes for `converse.ts`, undetected for the same reason, until 2026-08-29. That config must state `"exclude": []` — `extends` inherits the parent's exclusion, and without it the config written to check the tests excludes the tests and passes everything
- [ ] `npm run lint` — clean
- [ ] `npm test` — green, with tests added for new logic
- [ ] `npm run build` — must pass green (verify CI in all services)
- [ ] `npm run docs:check` (root) — AGENTS.md == CLAUDE.md
- [ ] `npm run secrets:check` (root) — no credential patterns in tracked files
- [ ] Frontend changes: `npm run i18n:check` (root) — 3-locale key parity + hardcoded-string scan
- [ ] `npm run paths:check` (root) — the acquisition surface agrees across `frontend/` and `backend/`
- [ ] `npm run seo:check` (root) — the public surface: every page titled and described in all three locales, nothing both sitemapped and robots-blocked, and search's route list agrees with the app's
- [ ] Frontend deploys: `npm run seo:live` (root) — what production ACTUALLY serves a crawler. `seo:check` validates the declaration; only this proves the CDN delivered it, and the two have disagreed
- [ ] Frontend deploys that change a public page: `npm run seo:indexnow` (root) — tells Bing, Yandex, Naver and Seznam the page changed instead of waiting to be crawled. Fails SOFT by design (a slow search engine must never fail a deploy); Google does not participate and is covered by the sitemap
- [ ] `npm run tools:test` (root) — the repo’s OWN gates. This is the one that is easy to skip because the individual `*:check` scripts all pass without it: it also asserts repo CONSISTENCY, including that `ROADMAP.md` accounts for every migration in `database/migrations/` (high-water mark plus any declared `unapplied deltas` range). Adding a migration without declaring it pending is green locally on every other gate and red in CI.
- [ ] `npm run provider:check` (root) — Forge and Oracle agree on the DeepSeek/Qwen base URLs and model names
- [ ] `npm run instruments:check` (root) — every whiteboard instrument agrees across the FIVE hand-written copies of its shape (`oracle/turnSchema.ts`, `oracle/ws/protocol.ts`, `backend/routes/tutor.ts`, `backend/services/tutorData.ts`, `frontend/tutor/types.ts`). Oracle and Core deliberately share no types, so a forgotten copy throws nothing: `compare` and `marked_line` each shipped without Core's `POST /turns` branch and their boards were LOST SILENTLY on replay and in the guardian transcript viewer — found by adversarial review months apart, by no gate. It also enforces a safety property nothing else did: a SERVER-COMPUTED field (`difference`, `greater`, `values`, a mark's `position`) must never appear in the model-facing schema, because the whole reason the server derives them is that the model must not be able to assert them. Deploy order for a new kind is **Core BEFORE Oracle** — the body union has no fallback member, so an unknown `kind` 400s the entire turn rather than dropping the board
- [ ] Tutor 3D clip/rig changes: `npm run verify:rig` (frontend) — every clip keeps every character in its own stance and proportions
- [ ] Tutor 3D placement/island changes: `npm run verify:placement` (frontend) — every character stands on walkable ground, inside the rim
- [ ] Lesson Engine or character-layer changes: `npm run verify:lesson-engine` (frontend) — every segment type played with REAL pointer events; it gates reachability, start, 3D-only, one WebGL context and a clean console. It does NOT gate how many segments reach a verdict, because that number measures the DRIVER (§1.14) — `--strict` opts into it for a deliberate deep run
- [ ] Tutor HUD/layout changes: `npm run verify:tutor-ui` (frontend) — the conversing phase at desktop light en-US, desktop dark es-MX and mobile es-MX, every visible control hit-tested with `elementFromPoint` (the §1.14 synthetic-click lesson applied to the Tutor's own stack of canvas, caption, panel and dock), plus the edit affordance driven with real mouse events, plus **all four whiteboard kinds** (`whiteboard`/`sequence`, `compare`, `marked-line`, `categories` — the fourth added 2026-09-01, closing a gap /ORACLE.md §20.5 had flagged in writing: the shared shell was already covered, but `CategoriesBoard` draws its OWN `height: N%` bars, which is exactly the construct that rendered at zero pixels for `sequence` in every real browser from launch). Its lab-panel toggling is state-driven rather than assumed — an assumed toggle went out of phase once a fourth kind was added and failed one run, passed the next
- [ ] Tutor caption/plate/replay-transport changes: `npm run verify:tutor-a11y` (frontend) — axe-core WCAG A/AA scan of **all eight stage phases** (arriving, personalizing, introducing, conversing, adapting, closing, replaying, unavailable), each measured at rest, plus a second pass over conversing with a live `sort_buckets` activity, across both themes and desktop/mobile. It covered TWO of the eight until 2026-09-01, and this line said so — "need a manual spot-check until it is extended", which is not a control anybody was scheduled to perform. Extending it found no product defect (24 phase scans, zero violations) and one HARNESS defect worth knowing about: a phase's entrance animation does not start when the phase switch is pressed — a world chip settles when the placement solver seats it, measured 1.9s later — so the old fixed `SETTLE_MS` wait was measured from the wrong event and reported mid-animation contrast as a real violation on roughly one run in eight. The gate now waits for actual animation quiescence (`getAnimations()`, infinite loops excluded) with a floor, so it cannot measure before the page holds still
- [ ] Tutor runtime changes: `npm run verify:tutor` (oracle) — the model context rejects every unlisted field, and the injection canary corpus still fails to escape
- [ ] Tutor pedagogy changes: `npm run verify:pedagogy` (oracle) — the controller driven through real learner profiles, asserting the SEQUENCE rather than the rules. Every §9.2 guardrail was a pure function with a passing unit test and two were wrong: "never two RESCUEs in a row" bounced a struggling child between rescue and direct instruction on alternating turns forever, and the Socratic degradation counted only wrong answers, which made its threshold unreachable. A unit test asks whether ONE transition is right, and each of those was; what a child experiences is the whole run. Costs nothing — no network, just the controller's own arithmetic
- [ ] Tutor pedagogy/controller changes: `npm run gym:pedagogy` (oracle) — the SAME controller, driven against REACTIVE simulated students (each answers based on the strategy the controller just chose) rather than `verify:pedagogy`'s fixed scripts, which is what lets it find guardrail faults that only appear when the learner ADAPTS. It has already caught two real shipped regressions this way: difficulty rising the turn after a failure, and a consistently slow-but-correct learner being promoted on an unbounded, self-inclusive latency median. Costs nothing — no network, no model, just the controller's own arithmetic
- [ ] Tutor PROMPT, strategy or repair changes: `gh workflow run tutor-deploy.yml -f step=converse` — holds four real lessons through the REAL orchestrator and reads the transcripts back for the faults a person notices. This is the only gate that answers "was that a good lesson" rather than "did the machinery work", and every defect the owner reported on 2026-08-28 was in that gap with all other gates green: greeting a child nine times in eleven lines, praising wrong answers, promising a game and then closing. Costs about $0.03. It is NOT part of CI on purpose — it is paid and model-dependent, so a flaky provider must not be able to block a deploy
- [ ] Before trusting a blueprint recommendation about a PROVIDER: measure it. `step=probe-models` asks which models are non-reasoning (production ran one that reasoned for months, against the workflow's own written requirement); `step=probe-empty` isolates one variable at a time where a conversation cannot (18 vs 32 empties at the SAME setting made a conversation useless as an instrument); `step=probe-prosody` asks whether a direction tag is interpreted or SPOKEN — the blueprint's `[warm]` is spoken on our provider, and shipping it would have read "corchete warm" to a six-year-old
- [ ] Files added/moved/deleted: `npm run repo:map` (root) — regenerate the map
- [ ] Docs updated per the stewardship table (§8)
- [ ] No `any` without a written justification in the PR/commit body
- [ ] Every discrete requirement from the task instruction addressed — none silently dropped (§1.12)
- [ ] Frontend UI changes: verified in-browser at mobile (~375px) AND desktop (~1280px) — screenshots taken (§1.11, non-negotiable)

---

## §6 When uncertain

1. `doc_map.md` → find the authoritative doc for the topic.
2. Read that doc's relevant section (not the whole file).
3. `GLOSSARY.md` → confirm terminology.
4. `WALKTHROUGH.md` decision log → was this already decided?
5. Grep the codebase for prior art (`repo_map.md` to locate candidates).
6. Still uncertain → **ask the human**. Never guess on invariants (§1.3, §1.9, §1.11) — a wrong guess there is a security, child-safety, or product-quality bug.

---

## §7 Common-mistake workflows

**Adding a table** → use `agent/prompts/templates/new-migration.md`. Sequence: next `NNNN` number → idempotent DDL → RLS policies in the same migration → seed if needed → `npm run db:reset` twice (must succeed both times) → regenerate types (`npm run db:types`) → update `database/AGENTS.md` if invariants changed.

**Adding a user-facing string** → key in `en-US` first → same key in `es-MX` + `pt-BR` in the same commit → `npm run i18n:check`.

**Adding an endpoint** → use `agent/prompts/templates/new-endpoint.md`. Zod schema → route under `/api/v1/` → envelope response → auth/role middleware → Supertest happy + sad path → service README route table.

**Changing shared types** → `database/types/` is the hub. Regenerate from schema, never hand-edit. Consumers re-pull; CI path filters gate all dependents.

**Touching kid-related data flow** → re-read §1.9 first. If any data leaves our infra, list exactly which fields and why in the PR description.

---

## §8 Documentation stewardship

| Change type | Docs that MUST be updated in the same commit |
|---|---|
| New/changed architecture decision | `ROADMAP.md` + `WALKTHROUGH.md` decision log |
| New migration / schema change | `database/AGENTS.md` (if invariants) + regenerate `database/types/` |
| New endpoint | Service `README.md` route table |
| New domain term | `GLOSSARY.md` |
| New service / dir structure change | `repo_map.md` (regen) + `doc_map.md` + root `README.md` service map |
| New env var | Service `.env.example` + service `README.md` |
| New skill installed | `TEAM_PROTOCOL.md` catalog + `_SOURCE.md` attribution |
| Any edit to this file | Mirror to `CLAUDE.md` byte-identically |
| Incident / recovery procedure learned | `RUNBOOK.md` |
| New public marketing route | `frontend/src/lib/analytics.tsx` (`MARKETING_PREFIXES`) **and** `backend/src/services/pulse.ts` (`MARKETING_ROOTS`) — the tracker records it, the read-time scope reports it; `npm run paths:check` enforces the pair |
| New/changed public marketing route, title, description or share copy | `frontend/scripts/seo/site.mjs` — it is the single source for `<head>`, robots.txt, sitemap.xml, llms.txt and the share cards; `npm run seo:check` enforces it against the app's own route list. Changing a card line also means `npm run seo:cards` (frontend) to rebuild the images |
| Change to what the product IS — a course, subject, age range, language, or the headline claim | `frontend/scripts/seo/site.mjs` (`ELEVATOR`, `SUBJECTS`, `SITE.locales`, `PAGES[].meta`) in the SAME commit — these are what search results, shared links and AI assistants repeat about us (§1.15). Bump `PAGES[].lastmod` by hand when a page's content changed for a reader |
| Domain or DNS-zone change | `DEPLOYMENT.md` §1 records the records no deploy can recreate — the Search Console CNAME above all, whose loss un-verifies both consoles silently |
| New/changed Tutor behaviour, prompt, context field or content-ladder rule | `/ORACLE.md` (authoritative) + `oracle/AGENTS.md`; a new field reaching the model ALSO needs `/LEGAL/AI_TUTOR_LEGAL_REVIEW.md` |
| New/changed KartRush deploy, embed allow-list or platform coupling | that repository's `docs/21-DEPLOYMENT.md` (authoritative) + this file §1.5 + `DEPLOYMENT.md` §1 |
| Change to legal document (any locale) | Mirror to ALL three `/LEGAL/*.md` files + sync `frontend/src/i18n/*/marketing.json` in same commit (§1.8) |

**Golden rule:** every substantial change is documented in the same commit that makes it. Undocumented architecture is a regression.
