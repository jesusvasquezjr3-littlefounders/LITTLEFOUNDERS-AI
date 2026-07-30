# GLOSSARY.md — Canonical Terminology

> Authority for naming. If code or docs disagree with this file, fix them (per /AGENTS.md §1.1).

## Roles (exactly six)

| Term | Definition |
|---|---|
| **universal** | Default role at signup, any age — created to minimize registration friction. Upgrades to parent/kid/bigfounder via verification. |
| **parent** | Verified guardian/tutor. Manages kid accounts and families; assigns tasks. A family may have **multiple** parents. |
| **Tutor** | The **user-facing name** for the `parent` role in all product copy/UI (es-MX: "Tutor", en-US: "Tutor", pt-BR: "Tutor"). Code, DB, and API always say `parent`. |
| **kid** | Verified child under parental control; advanced features depend on their guardian. Must always have ≥1 verified guardian link. |
| **bigfounder** | Verified adult; future exclusive features. |
| **admin** | Edits courses and platform content; provides tech support. |
| **superadmin** | Super-user: changes roles and access permissions. Only grantable to `@littlefounders.ai` emails. |

## Family domain

| Term | Definition |
|---|---|
| **family** | A household unit grouping parents and kids. Membership lives in `family_members` (join table). |
| **guardian link** | The verified parent↔kid relation. Created only after identity verification through Guardian (`parent-id-check/`). Has a `verification_status`. |
| **identity verification** | The Guardian-service flow proving an adult's identity — the only path to `parent`/`bigfounder` status and to linking kids. v1 engine: local OCR (tesseract.js); the ID photo is never stored. |
| **parent verification** | One successful Guardian check: applicant form data matched against their ID document. Recorded in the isolated `parent_verifications` table (data only — never the photo). |
| **@username** | A profile's unique public handle (`profiles.username`, lowercase). Share URL vision: `littlefounders.ai/@usuariox`. Viewing any profile requires a session. |
| **follow** | A user→user edge in `follows` ("sígueme en LittleFounders"). Self-managed via RLS; counts are public profile data. |
| **avatar** | The user's DiceBear **Avataaars** option set (`avatars.options`), rendered locally as SVG. Never an uploaded photo — same rule for covers (token-gradient presets only). |
| **block** | A one-directional `blocks` edge that (a) prevents new `follows` rows between the pair in either direction (DB-enforced, `is_blocked()`) and (b) hides both public profiles from each other (mutual 404 — never reveals who blocked whom). Blocking clears any existing follow edge both ways. |
| **learning stats** | `learning_stats` — XP points, minutes learned, lessons completed, `streak_days` + `longest_streak` (0013). One row per user (auto-created at signup), system-written only (no client INSERT/UPDATE policy). Lessons write all of them; **games write `xp_points`, `minutes_learned` and the streak columns but NEVER `lessons_completed`** — a game is not a lesson, and inflating that counter would corrupt course-progress reporting. |

## Services & codenames

| Dir | Codename | One-liner |
|---|---|---|
| `database/` | **Vault** | Schema, migrations, RLS, generated types (shared-type hub) |
| `backend/` | **Core** | Main API — the only service the frontend calls |
| `frontend/` | — | The SPA |
| `coursegen/` | **Forge** | Course & lesson generation (DeepSeek + Qwen) |
| `audiogen/` | **Echo** | Lesson TTS audio, per-locale voices |
| `gamegen/` | **Arcade** | Game generation — `GameDocument` manifests that skin the 8 prebuilt deterministic mechanics (DeepSeek author + Qwen judge + Prism sprites). Documents are shared per-locale content, never per-child: §1.9 keeps kid data out of generation entirely |
| `parent-id-check/` | **Guardian** | Identity verification service |
| `email-server/` | **Courier** | Transactional email — Haraka SMTP engine relaying to Amazon SES (open-source Resend replacement) |
| `filebase/` | **Depot** | Media storage — lesson audio & generated images (content-addressed; public reads for PII-free media, internal-key writes) |
| `picturegen/` | **Prism** | The only image-generation service — art-director judge (LF illustration identity) + Qwen `qwen-image`, assets in Depot, request-cache in Vault (`picture_assets`) |
| `pulse/` | **Pulse** | Observability — self-hosted analytics (Plausible CE + Umami v3) & system health (Uptime Kuma); pinned third-party stack, data read only through Core |

The AI tutor **feature** (lives across backend + frontend `tutor/`) is codenamed **Oracle**.

## Course hierarchy terms (spec: /COURSE_ENGINE.md)

| Term | Definition |
|---|---|
| **adventure** | A themed world inside a course (CSS-drawn scene: archipelago, forest, city, valley, kingdom, cosmos). Unlocks when the previous adventure's lessons are all passed. |
| **saga** | A chapter inside an adventure (4 per adventure). |
| **topic (tema)** | A concept unit inside a saga (~6 per saga) carrying objective/vocabulary/prior-knowledge metadata. |
| **catalog** | The curated curriculum map in `coursegen/curriculum/<course>/` — taxonomy + facts + every planned lesson blueprint. The generation coverage oracle and stop condition. |
| **blueprint** | One planned lesson slot in the catalog: micro-objective, narrative beat, difficulty, suggested families. |
| **Piaget gate** | The hard-fail forbidden-vocabulary scan per age tier per locale (tier1 6-7, tier2 8-10, tier3 10-12 — tier3 unlocks investing vocabulary concretely, still bans leverage/derivatives/trading jargon). |
| **course sequence** | The 3-course track (COURSE_ENGINE §3.1b): financial-education → entrepreneurship → investing, wired by `courses.requires` (the course-level placement edge). |
| **fact anchor** | An entry in the catalog's `facts.yaml` — the only source of real-world numbers in generated lessons. |
| **forced_types** | A catalog blueprint override (COURSE_ENGINE §4 addendum) that pins a lesson's exact segment-type skeleton, skipping the plan-stage LLM call. Powers the QA smoke-test catalog's exact per-type coverage. |
| **voice map** | Echo's per-character × per-locale TTS voice resolution (COURSE_ENGINE §7) — `TTS_VOICE_<CHARACTER>_<LOCALE>` env overrides, falling back to the per-locale default. |

## Product sections

`learn` (gamified courses) · `tutor` (live AI tutor) · `games` (concept-bound minigames — prebuilt mechanics skinned by generated manifests, /GAME_ENGINE.md) · `tasks` (parent-assigned, gamified rewards) · `profile` (DiceBear avatar + settings).

## Platform terms

| Term | Definition |
|---|---|
| **envelope** | The mandatory API response shape `{ data, error }` (/AGENTS.md §1.6). |
| **stack of record** | The locked technology table (/AGENTS.md §1.2). Changing it requires human sign-off. |
| **invariant** | A rule in /AGENTS.md §1.3/§1.9 that no prompt can override. |
| **shared-type hub** | `database/types/` — generated TS types every service consumes; never hand-edited. |
| **internal service** | Any service other than backend/frontend; reachable only service-to-service via `INTERNAL_API_KEY`. |
| **delivery capture** | Courier's SMTP-side email logging: the `log_delivery` Haraka plugin reports each message on `hook_queue_ok` to `POST /api/v1/logs`, which writes `email_logs` (0021). GoTrue auth mail is submitted over SMTP :587 and never touches `POST /api/v1/send`, so this is the only path by which the platform's real mail is recorded. Fire-and-forget: a logging outage must never bounce a password reset. |
| **Insights** | The first-party learning/usage telemetry system (/INSIGHTS.md): closed-vocabulary `learning_events` (0023), the parental consent gate, and the `/admin/insights` console. First-party forever — never Pulse, never a third-party AI API. |
| **analytics consent** | The per-kid, guardian-granted permission row (`analytics_consents`) that gates ALL kid usage telemetry, fail-closed and auditable (revocation keeps the row). Surfaced as the "Share usage insights" toggle on the parent dashboard. |
| **dataintel** (Data Intelligence) | The analytics warehouse service (port 4008). DuckDB-backed OLAP engine providing segmentation, forecasting, anomaly detection, churn prediction, path analysis, and experiment framework. Serves the AdminIntelPage console and `/api/v1/intel/*` endpoints proxied through Core. |
| **DuckDB** | Embedded columnar OLAP database running in-process within the dataintel service. Provides 100-1000× faster analytical queries than Postgres row-store for aggregation workloads. Zero infrastructure — no separate server, no cloud warehouse. |
| **Star schema** | The DuckDB data model — `fact_events` (event stream) joined to dimension tables (`dim_users`, `dim_sessions`, `dim_lessons`, `dim_time`). Enables fast multi-dimensional aggregation across any combination of role, locale, device, and time. |
| **relayed** | The `email_logs.status` written by delivery capture — Haraka accepted the message and handed it to the SES relay. Distinct from `queued`, which means Courier accepted it on `POST /api/v1/send` and passed it to the adapter. Neither is an SES *delivery* confirmation; correlate `message_id` with SES logs for that. |
| **team-mode skill** | An opt-in agent skill that must be proposed to the human before use (TEAM_PROTOCOL.md). |
| **characters** | The four canonical mascots: **Dina, Liruf, Dr. Rho, Zara Vex**. |

## Lesson Engine terms (spec: /LESSON_ENGINE.md)

| Term | Definition |
|---|---|
| **Lesson Engine** | The frontend lesson runtime (`frontend/src/lesson-engine/`): document contract, 56-type exercise taxonomy, registry, session state machine, player. |
| **lesson document** | One self-contained, single-locale lesson JSON (`LessonDocument`) played start-to-finish. Forge emits one per locale. |
| **segment** | One ordered unit inside a lesson — story content or a graded exercise. Discriminated by `type`. |
| **exercise family** | One of the 8 groups (`story, choice, input, arrange, money, analyze, storyplay, maker`) sharing primitives and grading helpers; each owns its own directory slice. |
| **answer key** | The server-only `answer` block of a segment. Stripped by `stripAnswers()`; never shipped to production clients. |
| **verdict / tier** | A grading result: score 0–100 + tier `perfect/great/almost/tryAgain`. Feedback teaches, never punishes (P3). |
| **grader (boundary)** | The pluggable grading interface. Production = Core endpoint (future content-schema session); `/dev/lesson-lab` = local dev grader. |
| **cheer mode / arcade mode** | Lesson session modes: `hearts: null` (kid default, no fail state) vs numbered hearts (exhausted wrong segments cost one; 0 ends the run at results). |
| **Character Control** | The unified emotion/action API over the four characters (`components/characters/control/`): `CharacterActor`, `lf-act-*` wrapper keyframes, `lf-rig-*` limb hooks. Appearance is NON-NEGOTIABLE — the rig never alters colors/shapes/composition. |
| **director** | The engine layer mapping session events (correct, streak, hint…) to rotating character reactions. |
| **lesson-lab** | Dev-only harness at `/dev/lesson-lab`: plays every fixture and the full showcase through the real player with the local grader. |

**Territory map** — the whole-course skill map at `/learn/:courseSlug/territory`: a pure projection of Core's course tree where every topic carries a DATA-DERIVED state (`not-started` / `in-progress` / `completed` / `review-due`). `review-due` comes from the spaced-review layer (`topics.review_of`, migration 0016): a completed topic flips while a review topic citing it has unpassed lessons. Locked adventures render as fog-of-war silhouettes. Never a second source of truth — it renders the same `/learn/courses/:slug/tree` payload as the caminito.

## Game Engine terms (spec: /GAME_ENGINE.md)

| Term | Definition |
|---|---|
| **Game Engine** | The frontend game runtime (`frontend/src/game-engine/`): the `GameDocument` contract, the 8 mechanic slices, the mechanic registry, the pure simulation/replay layer and the player. Same code-vs-data split as the Lesson Engine — behaviour is hand-written, only the manifest is generated. |
| **game document** | One self-contained, single-locale game instance (`GameDocument`), stored per locale in `game_documents`. Arcade emits one per locale, like a **lesson document**. Data only: it skins and parameterizes a mechanic and can never introduce behaviour. |
| **GameDocument manifest** | The manifest shape itself: `schema_version`, `meta`, `skin`, `config`, `content`, `scoring`, optional `adaptive`. Validated in two layers so mechanics stay code-split — `gameDocumentEnvelopeSchema` (mechanic-agnostic, `config` as `unknown`) then the mechanic's own `configSchema`/`contentSchema` plus the cross-field checks, via async `parseGameDocument()`. |
| **mechanic** | One of the 8 closed, hand-written, deterministic game behaviours: `sorter, launcher, runner, stacker, autobattler, explorer, defender, flyer`. Mechanics are CODE and are never generated; the LLMs only author manifests that skin them. |
| **mechanic slice** | The 5-file directory one mechanic owns (`game-engine/mechanics/<mechanic>/`): `schema.ts`, `simulate.ts`, `components.tsx`, `fixtures.ts`, `register.ts`. Zero cross-slice imports, so each mechanic is its own lazy chunk — the twin of an **exercise family** slice. `simulate.ts`/`schema.ts` import no React precisely so the server and gamegen can hold parity copies. |
| **skin** | The `skin` block of a game document: `palette`, Prism `background_url`, the sprite-slot→URL map, and the closed `sfx`/`bgm` names. Purely presentational — a skin change can never alter the simulation or the score. |
| **sprite slot** | A mechanic-declared string id (`<M>_SPRITE_SLOTS`) that `skin.sprites` maps to a Depot URL and that items/categories reference through `image_slot`. Validation rejects any `skin.sprites` key that is not a declared slot of that mechanic. Slot ids are container keys, never localized. |
| **game palette** | One of the 6 closed skin palettes: `navy-papaya, forest-pear, ocean-blue, sunset-papaya, violet-night, sand-clay`. Each resolves to DESIGN.md tokens only — never raw hex. |
| **interlude** | A between-rounds micro-exercise carried in `content.interludes` (≤4, kind `pick_one`, `true_false` or `tap_all`): the concept check that keeps a game a learning surface and not just play. Not a lesson **segment** and not scored by the lesson graders. |
| **GameValidation sidecar** | The server-only block in `game_documents.validation` (`max_score`, `min_duration_seconds`, `max_events`, `item_values`). The Game Engine's twin of the lesson **answer key**: `stripValidation()` is the only sanctioned stripper (mirrored server-side), and `game_documents` runs RLS with **zero policies** because RLS is row-level, not column-level — any SELECT policy would expose this column. |
| **input log** | The ordered `GameInputEvent[]` the client records during a play (integer `tick` + `action` + optional slot/coords/count). Sent once on completion, replayed in memory, then DISCARDED — never persisted. `game_attempts.stats` holds derived aggregates only. |
| **replay validation** | How rewards are derived: Core re-runs the submitted input log through the same pure simulator at the same seed and computes the score itself. A client-reported score is never trusted. A log failing the checks (non-monotonic ticks, unknown action, over the event or tick cap) or a bound violation → 422 `RESULT_REJECTED`, no reward, logged. |
| **simulator** | A mechanic's pure `Simulator` in `simulate.ts` — `init/step/snapshot/result` + bots — on a fixed 50ms integer tick (`TICK_MS`) with randomness only from the injected seeded PRNG. Must be bit-identical across browser V8 and Node, which is what makes replay validation possible: no `Date.now()`, no `Math.random()`, no input mutation, and none of the implementation-defined `Math` transcendentals (use `core/mathd.ts`). |
| **bot gate** (winnability gate) | The free, deterministic `simulate` stage of the **Arcade pipeline**: headless bot play proving a generated document is actually beatable — the `perfect` bot MUST reach `scoring.pass_score`, the `random` bot MUST NOT, inside the tick budget. Failure feeds the bot trace back as corrective-retry feedback instead of shipping an unwinnable game. |
| **cheer mode / arcade mode** (games) | The same pair defined for lessons in *Lesson Engine terms* above, expressed as `scoring.mode`: `cheer` = `lives: null`, no fail state (tier1 default); `arcade` = numbered lives. One vocabulary across both engines on purpose — a kid never meets two different meanings of "cheer mode". |
| **game blueprint** | One planned game slot in the games catalog — mechanic, bound `topic_path`, tier, target minutes. The Arcade twin of a lesson **blueprint**. |
| **games catalog** | `gamegen/curriculum/<course>/games.yaml` — the curated set of game blueprints for a course, Zod-validated by `npm run catalog:check`, which also does cross-catalog validation: every blueprint's `topic_path` must exist in `coursegen/curriculum/<course>/catalog.yaml`. |
| **Arcade pipeline** | gamegen's generation run: `validate → plan → author → gate → simulate → judge → localize → illustrate → publish`. `gate` and `simulate` are deterministic and free; `plan/author/judge/localize/illustrate` are paid and sit behind `checkBudget()` and the `--dry-run` short-circuit. `illustrate` runs on the es-MX document BEFORE the localize string-freeze, so 1 sprite serves 3 locales. Run ids are namespaced `games-<courseSlug>-<ISO8601>` and runs carry `generation_runs.params.kind = 'games'`, so game runs never contaminate Forge's lesson cost/quality trends. Publishes at `status='review'` — never auto-published; the human gate is the admin content queue. |
| **concept binding** | `meta.concept.topic_path` + `recap_md` — the DATA edge tying a game to the topic it reinforces. It gates access (a game stays `locked` until the user has passed a lesson in the bound topic, else 403 `GAME_LOCKED`) and drives the recap intro. Binding is data; no mechanic hardcodes a concept. |
| **game progress** | `game_progress` — one row per (user, game): `best_score` high-water, `plays`, `passed` (sticky OR), `xp_earned` (max, so replays can't farm XP). System-written only through Core's service role; readable by the user and their verified guardians. |
| **game-lab** | Dev-only harness at `/dev/game-lab` (twin of **lesson-lab**): plays every mechanic fixture through the real player and runs the bots locally. |
