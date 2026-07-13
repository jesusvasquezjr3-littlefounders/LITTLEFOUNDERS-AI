# CONTEXT.md — Canonical Product & Architecture Context

> The ONE place this is written. Templates, prompts, and briefings point here. Do not duplicate this content anywhere.

## Product

**LittleFounders** teaches kids financial literacy and entrepreneurship through a gamified platform, under verified parental control. Users learn in **courses** (learn), talk to a live **AI tutor** (tutor), play **educational minigames** (games), complete **parent-assigned tasks** for gamified rewards (tasks), and customize a DiceBear **avatar** (profile).

## The five product sections

| Route | What happens there |
|---|---|
| `learn/` | Highly gamified course-taking (e.g., Entrepreneurship): pick a course, follow it |
| `tutor/` | Live, personalized AI tutor chat (codename Oracle) |
| `games/` | Educational minigames bound to concepts from learn/ |
| `tasks/` | Parents assign tasks to kids; kids earn gamified rewards |
| `profile/` | Avatar customization (DiceBear `avataaars`) + account settings |

## The six roles

- `universal` — default on signup, any age, minimal friction. Upgrades from here.
- `parent` — verified guardian. Manages kid accounts and families. A family can have **several** parents.
- `kid` — verified child, under parental control; advanced features gated by their guardian.
- `bigfounder` — verified adult; future exclusive features.
- `admin` — edits courses/content, gives tech support.
- `superadmin` — role & permission management; **only `@littlefounders.ai` emails**.

Verification (`kid`, `bigfounder`, `parent`) flows exclusively through the **Guardian** service (`parent-id-check/`).

## The eight services

```
frontend (Vercel, 5173)
    │  only talks to ↓
backend "Core" (Railway, 4000) ──────────────┐ INTERNAL_API_KEY, service-to-service
    │                                        ├── coursegen  "Forge"    4001  (DeepSeek+Qwen lessons)
database "Vault"                             ├── audiogen   "Echo"     4002  (lesson TTS, 3 locales)
Supabase self-hosted on Railway              ├── gamegen    "Arcade"   4003  (personalized minigames)
(Postgres·GoTrue·PostgREST·                  ├── parent-id-check "Guardian" 4004 (identity verification)
 Realtime·Storage·Studio·Kong)               ├── email-server "Courier" 4005 (transactional email)
                                             └── filebase   "Depot"    4006  (media storage: lesson audio/images)
```

Data flow rules: the browser only ever calls `backend` (plus Supabase Auth directly for session handling, and Depot's public file route for PII-free lesson media). Generation services write results back through `backend` or directly to the DB with service credentials. `database/types/` (generated TS types) is the shared-type hub every TS service consumes. Engine specs: `/LESSON_ENGINE.md` (lesson runtime) and `/COURSE_ENGINE.md` (hierarchy + generation).

## Platform constants

- i18n: `en-US` (key source of truth), `es-MX`, `pt-BR` — everywhere, always.
- Theming: light + dark, Tailwind `darkMode: 'class'`.
- Characters (canonical mascots): **Dina, Dino, Dr. Rho, Zara Vex** — `frontend/src/components/characters/`.
- Child safety: no minor PII to third-party AI APIs; moderation on all AI output shown to kids; parent visibility is an invariant. (Details: `/AGENTS.md` §1.9.)
