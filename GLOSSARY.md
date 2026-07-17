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
| **learning stats** | `learning_stats` — XP points, minutes learned, lessons completed, streak days. One row per user (auto-created at signup), system-written only; zero until the lesson/game engines exist. |

## Services & codenames

| Dir | Codename | One-liner |
|---|---|---|
| `database/` | **Vault** | Schema, migrations, RLS, generated types (shared-type hub) |
| `backend/` | **Core** | Main API — the only service the frontend calls |
| `frontend/` | — | The SPA |
| `coursegen/` | **Forge** | Course & lesson generation (DeepSeek + Qwen) |
| `audiogen/` | **Echo** | Lesson TTS audio, per-locale voices |
| `gamegen/` | **Arcade** | Personalized educational minigames |
| `parent-id-check/` | **Guardian** | Identity verification service |
| `email-server/` | **Courier** | Transactional email (open-source Resend replacement) |
| `filebase/` | **Depot** | Media storage — lesson audio & generated images (content-addressed; public reads for PII-free media, internal-key writes) |

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

`learn` (gamified courses) · `tutor` (live AI tutor) · `games` (concept-bound minigames) · `tasks` (parent-assigned, gamified rewards) · `profile` (DiceBear avatar + settings).

## Platform terms

| Term | Definition |
|---|---|
| **envelope** | The mandatory API response shape `{ data, error }` (/AGENTS.md §1.6). |
| **stack of record** | The locked technology table (/AGENTS.md §1.2). Changing it requires human sign-off. |
| **invariant** | A rule in /AGENTS.md §1.3/§1.9 that no prompt can override. |
| **shared-type hub** | `database/types/` — generated TS types every service consumes; never hand-edited. |
| **internal service** | Any service other than backend/frontend; reachable only service-to-service via `INTERNAL_API_KEY`. |
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
