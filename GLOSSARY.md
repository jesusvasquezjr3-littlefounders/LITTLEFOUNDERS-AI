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

The AI tutor **feature** (lives across backend + frontend `tutor/`) is codenamed **Oracle**.

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
| **characters** | The four canonical mascots: **Dina, Dino, Dr. Rho, Zara Vex**. |
