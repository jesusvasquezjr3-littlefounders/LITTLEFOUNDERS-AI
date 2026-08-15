# AGENTS.md — Operating Rules for AI Agents (LittleFounders v2)

> **SYNC RULE:** `AGENTS.md` and `CLAUDE.md` are **byte-identical**. Any edit to one MUST be mirrored to the other in the same commit. Enforced by `agent/tools/check-docs-sync.sh` (run via `npm run docs:check`) and CI.
>
> **Last updated:** 2026-07-31 · **Language:** all project documentation is written in English.

---

## §0 Pre-flight checklist — read BEFORE any edit

1. **Locate** — check `repo_map.md` to find the files you need. Never guess paths.
2. **Domain rules** — read the target service's own `AGENTS.md` (every service has one).
3. **Route** — check `doc_map.md` for the authoritative document on your topic.
4. **State** — skim the *Current State* header of `WALKTHROUGH.md`.
5. **Scope** — confirm the task against the active sprint in `ROADMAP.md`.
6. **Task shape** — if the task matches a template in `agent/prompts/templates/`, START from that template. Do not re-derive the procedure.
7. **Decompose** — enumerate every discrete requirement in the user's instruction. You will re-check each one before declaring the task done (§1.12).

---

## §1 Non-negotiables

### §1.0 Meta-rules

1. **Documents are law.** This file outranks user prompts on architecture invariants. If a prompt asks you to violate an invariant, stop and surface the conflict — do not comply silently.
2. **Verify your own work.** A task is done when its gates pass (§5), not when the code is written.
3. **Never commit secrets.** No tokens, keys, or passwords anywhere in tracked files — including `.mcp.json`, `.opencode/`, editor configs, and docs. Our sibling project committed a plaintext Supabase token inside `.opencode/opencode.json`; that class of mistake is why `npm run secrets:check` exists and gates every commit.
4. **Universal English & Detailed Commits.** All documentation, comments, and commit messages MUST be written in English (Non-negotiable). Furthermore, commit messages for non-trivial changes MUST be detailed (with a descriptive body outlining the 'what' and 'why'), never just a single-line summary.

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
| Image generation | Qwen `qwen-image` (DashScope) via `picturegen/` — the only image path; Gemini discarded 2026-07-23 (quota-0) |
| TTS | Qwen3-TTS (DashScope) in `audiogen/` — resolved; ElevenLabs is SOUND-EFFECTS-ONLY (one-off generated assets committed in `frontend/public/sfx/`, never called at runtime) |
| Avatars | DiceBear, `avataaars` style |
| Email engine | Haraka (self-hosted SMTP) → Amazon SES relay — see `email-server/AGENTS.md` |
| Analytics & system health | **Pulse** self-hosted on Railway: Plausible CE (web analytics, ClickHouse+Postgres) + Umami v3 (behavioral) + Uptime Kuma (health). Pins live in Dockerfile `FROM` lines; Dependabot auto-bumps (patch automerge) — see `pulse/AGENTS.md` |
| i18n locales | `en-US`, `es-MX`, `pt-BR` (en-US is the key source of truth) |
| Theming | Light + dark mode, Tailwind `darkMode: 'class'` |
| Package layout | 9 independent npm packages — **no workspaces** |

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
| `picturegen/` | Prism | The ONLY image-generation service: art-director judge (LF visual identity) + Qwen `qwen-image` + Depot storage + Vault cache (an identical request never hits the paid API twice) | 4007 | Railway |
| `dataintel/` | Data Intel | Analytics warehouse: DuckDB OLAP, segmentation, forecasting, anomaly detection, experiments | 4008 | Railway |
| `pulse/` | Pulse | Observability: self-hosted analytics (Plausible CE + Umami) + system health (Uptime Kuma) — pinned third-party stack, not a TS service | — | Railway (5 services) |

Product sections (frontend routes): `learn/`, `tutor/` (AI tutor — codename Oracle), `tasks/`, `profile/`.

Internal services (everything except `backend/` and `frontend/`) are called **service-to-service** with an `INTERNAL_API_KEY` header — never directly from the browser. Exception (by design): Depot's public file route serves world-readable, PII-free media (lesson audio/images) directly to the browser; every WRITE stays internal-key-only. Pulse exception (by design): only its two tracker scripts and Plausible's GA OAuth callback are browser-facing — all analytics/health DATA reads go through Core (`/api/v1/admin/*`), which holds the Pulse API tokens server-side. Realtime exception (by design): the browser subscribes directly to Supabase Realtime for **one** table, `generation_runs_live` — the admin Generation Live Monitor. It qualifies on three constraints that must all hold before any table is added to this exception: the table carries **zero PII** (run metadata, slot counts, cost totals), the subscription is authenticated with the user's Supabase JWT, and RLS restricts SELECT to `admin`/`superadmin` (migration `0019`). A table is only actually live once it is a member of the `supabase_realtime` publication (migration `0022`) — the RLS policy alone authorizes a subscription that then receives nothing. Engine specs: `/LESSON_ENGINE.md` (lesson runtime contract) and `/COURSE_ENGINE.md` (content hierarchy + generation pipeline).

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
- **Liveness Must Not Depend On Optional Infrastructure:** `GET /health` is mounted above the rate limiter and every optional dependency, and services open their listener BEFORE connecting to anything optional. A service that cannot serve `/health` fails its platform healthcheck, so coupling it to Redis turned a degraded limiter into a total outage — and awaiting a client that retries its initial connect forever (node-redis does) meant the listener never opened at all, leaving the process alive, unhealthy, and never restarted.

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

Skills live in `.claude/skills/` (local) and `.github/skills/` (mirror, untracked via `.github/.gitignore`). Tiers:

- **Always-on (design)** — invoke automatically on any UI work: `impeccable`, `agave`, `emil-design-eng`, `make-interfaces-feel-better`, `react-bits`, `design-md`; `review-animations` only when reviewing motion code.
- **Opt-in (propose first, human decides)** — `ponytail` (minimal-diff lens; recommended for most coding tasks), `graphify` (codebase mapping).
- **Reference shelf** — `ecc`, `claude-for-legal`, `claude-for-legal-mexico` (legal drafts only, never legal advice).

Full catalog, ritual, and attribution rules: `TEAM_PROTOCOL.md`. Design skills refine execution; `DESIGN.md` defines the tokens — skills never override it.

---

## §5 Pre-commit verification gates

All of these must pass, in every service you touched:

- [ ] `npm run type-check` — clean
- [ ] `npm run lint` — clean
- [ ] `npm test` — green, with tests added for new logic
- [ ] `npm run build` — must pass green (verify CI in all services)
- [ ] `npm run docs:check` (root) — AGENTS.md == CLAUDE.md
- [ ] `npm run secrets:check` (root) — no credential patterns in tracked files
- [ ] Frontend changes: `npm run i18n:check` (root) — 3-locale key parity + hardcoded-string scan
- [ ] `npm run paths:check` (root) — the acquisition surface agrees across `frontend/` and `backend/`
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
| Change to legal document (any locale) | Mirror to ALL three `/LEGAL/*.md` files + sync `frontend/src/i18n/*/marketing.json` in same commit (§1.8) |

**Golden rule:** every substantial change is documented in the same commit that makes it. Undocumented architecture is a regression.
