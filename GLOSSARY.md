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
| **learning stats** | `learning_stats` — XP points, minutes learned, lessons completed, `streak_days` + `longest_streak` (0013). One row per user (auto-created at signup), system-written only (no client INSERT/UPDATE policy). Lessons write all of them. |

## Services & codenames

| Dir | Codename | One-liner |
|---|---|---|
| `database/` | **Vault** | Schema, migrations, RLS, generated types (shared-type hub) |
| `backend/` | **Core** | Main API — the only service the frontend calls |
| `frontend/` | — | The SPA |
| `coursegen/` | **Forge** | Course & lesson generation (DeepSeek + Qwen) |
| `audiogen/` | **Echo** | Lesson TTS audio, per-locale voices |
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
| **competency graph** | The derived DAG of topic prerequisite/retrieval edges (`coursegen/src/catalog/competencyGraph.ts`), persisted to Vault as `topics.prerequisites` (migration `0042`) — the catalog stays the source of truth, the graph is a query-time-resolved projection, never a second content source. |
| **placement probe** | One offline-authored multiple-choice question per teaching topic's first lesson (`topics.placement_probe`, migration `0042`), authored once per catalog topic — never per learner — by `coursegen/src/pipeline/placementProbe.ts`. The live placement quiz only ever serves and grades pre-authored probes; no LLM call happens per learner. |
| **placement** | The mandatory, per-course quiz (`course_placements`, migration `0043`) that walks the competency graph's hard-edge subset backwards from the learner's claimed level to place them at the earliest topic they haven't proven mastery of, instead of lesson 1. `backend/src/services/placementAlgorithm.ts` computes it; `PlacementPage.tsx` is the wizard. |
| **placement credit** | A lesson the learner was placed past (`placement_credits`, migration `0043`) — counts toward course-completion badges and the progress bar like a real pass (confirmed product decision), but is never a fabricated `lesson_progress` row and stays distinguishable everywhere (`LessonNode.placementCredited`). |

## Product sections

`learn` (gamified courses) · `tutor` (live AI tutor) · `tasks` (parent-assigned, gamified rewards) · `profile` (DiceBear avatar + settings).

## Platform terms

| Term | Definition |
|---|---|
| **guest** | A Duolingo-style zero-friction session — GoTrue's native anonymous sign-in (`auth.users.is_anonymous=true`), surfaced end to end as `isGuest`. A real user row from the first request, so every existing trigger/RLS policy/JWT flow works unchanged. Distinct from, and unrelated to, the pre-signup `lf_aid` marketing visitor id (`frontend/src/lib/visitor.ts`) — never conflate the two. Upgrading (`POST /api/v1/auth/upgrade`) attaches a permanent identity to the SAME `auth.users.id`, never `/signup`, which would mint a second blank identity. |
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
