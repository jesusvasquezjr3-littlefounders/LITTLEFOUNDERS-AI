# WALKTHROUGH.md — Current State & Decision Log

> Informational (authority level: /AGENTS.md §1.1 #7). Updated at the end of every working session via `agent/workflows/doc-sync.md`.

## Current State (2026-07-11)

v2 total reset executed on branch `littlefounders_v2`. The complete v1 platform (FastAPI backend, React frontend, lesson factory, 5 games) is preserved on `main`. This branch carries the fresh 8-service scaffold and the AI-agent environment. Services are being stamped; nothing is deployed yet. Local-only survivors on disk (gitignored): `.claude/` (skills + archive of v1 characters/env/lesson data), `LEGAL/`, `.github/skills/`.

## Decision Log

| Date | Decision | Why |
|---|---|---|
| 2026-07-11 | Total v2 rewrite on `littlefounders_v2`; v1 frozen on `main` | Radical platform change; main = rollback path |
| 2026-07-11 | All services TypeScript + Express (dropped Python/FastAPI) | One toolchain, shared types, sibling-proven patterns |
| 2026-07-11 | Supabase **self-hosted on Railway** (full stack) replaces Supabase Cloud | Control + one infra provider; accepted ops cost (~$20-40/mo, manual backups) |
| 2026-07-11 | 8 independent npm packages, **no workspaces** | Vercel/Railway deploy isolation; per-service CI path filters |
| 2026-07-11 | 6-role model (universal/parent/kid/bigfounder/admin/superadmin) | Low-friction signup + verified upgrade paths |
| 2026-07-11 | `agent/` first-class agent environment (core/tools/prompts/workflows) | Sibling lacked it; kills context repetition across sessions |
| 2026-07-11 | English for all project documentation | Team + agent consistency |
| 2026-07-11 | CD deferred; CI first. Platform-native deploys later (Vercel Git, Railway watch-paths) | Nothing to deploy yet; avoid v1's CLI-in-Actions complexity until needed |
| 2026-07-11 | Email engine deferred (candidates: Postal/Maddy/Haraka/Stalwart) | Contract stubbed in Courier; decision when implementation starts |
| 2026-07-11 | i18n locales locked: en-US, es-MX, pt-BR | Product decision |
| 2026-07-11 | DiceBear `avataaars` for avatars | Product decision |
| 2026-07-11 | v1 characters (Dina, Dino, Dr. Rho, Zara Vex) carried into v2 | Brand continuity; archived + restored into frontend |
| 2026-07-11 | `.github/skills/` stays untracked (via `.github/.gitignore`) | 13MB third-party content; local + `.claude/skills` mirror suffice (v1 precedent) |

## Known Issues

_None yet._
