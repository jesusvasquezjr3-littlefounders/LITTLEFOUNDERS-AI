# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Read this first

**`README.md` is the single operational document of this repo** — service map, local setup, every test/deploy command, migration procedure, DNS records, and the non-obvious invariants section. This file only adds what's specific to working as Claude Code here; consult `README.md` for anything operational.

**`CLAUDE.md` and `AGENTS.md` must always be identical.** They are the same content published under two filenames for two different agent tools. Any edit to one must be applied to the other in the same change — never let them drift.

## Mandatory rules — non-negotiable

These gates are not optional, not skippable under time pressure, and not satisfied by "it looked fine":

1. **Before doing anything else, the project must be properly initialized locally.** Don't start editing code, running a single service's commands, or poking at the DB against an unprovisioned checkout. If `node_modules`, `.env` files, or the Docker/DB stack aren't already set up in this working copy, run `npm run setup` first (see Commands) and confirm it completed cleanly before proceeding with the actual task.

2. **Before starting any work, establish the local machine's actual capabilities.** This repo runs on different collaborator machines with different constraints (see README's "small dev machine" invariant — one collaborator's machine swaps under parallel subagents + headless Chrome + multiple Vite servers). Before assuming what you can run in parallel, or that a tool/CLI is available, check:
   ```bash
   node -v            # must match .nvmrc (24.x)
   docker info         # Docker Desktop running? required for the DB container stack
   npm -v
   supabase --version  # only if you'll touch migrations/types
   railway --version   # only if you'll deploy/inspect Railway
   gh --version         # only if you'll drive CI/workflows
   ```
   Plus available RAM/CPU and how many dev servers/containers are already running. Do not start multiple heavy watchers, headless browser sessions, or DB resets in parallel without knowing the machine can take it — a swapping machine fails as flaky timing tests, not as a loud error.

3. **Before every commit, and again before every push, run the local tests and gates — no exceptions.**
   ```bash
   npm run typecheck:all && npm run lint:all && npm run test:all
   npm run secrets:check
   npm run tools:test
   ```
   Plus whichever conditional gate applies to the area touched (README's "Mandatory testing" table — i18n, SEO, provider parity, tutor context/pedagogy, lesson-engine, tutor UI, migrations, etc.). A push to `main` fans out CI+CD across all 11 services — a red push wastes that entire fan-out and can ship a broken deploy through CD. Passing these locally is required before every commit; do not commit or push on the assumption that CI will catch it.

4. **Commits are attributed to the developer only — never to Claude.** Do not append `Co-Authored-By: Claude …` or a `Claude-Session:` trailer (or any similar AI-attribution line) to commit messages or PR descriptions in this repo, even if a default instruction elsewhere says to. This overrides that default here.

5. **All documentation added to this project must be written in English**, regardless of the language the user is conversing in. This includes `README.md`, `CLAUDE.md`/`AGENTS.md`, code comments, commit messages, PR descriptions, and any other doc file added to the repo — translate before writing, don't write in the conversation's language and leave it.

## What this is

LittleFounders: a gamified financial-literacy and entrepreneurship platform for kids/families — gamified courses, an AI tutor, parent-assigned tasks with rewards, under verified parental control. TypeScript + Express (ESM, Node 24) on 11 independent npm packages (no workspaces) + a React 18 + Vite + Tailwind frontend, Supabase self-hosted for the DB, all deployed to Railway (backend services) and Vercel (frontend).

## Commands

```bash
npm run setup                                          # from-zero provisioning (all 11 packages + DB + seeds)
DEV_PROFILE=core DEV_DB=1 npm run dev                   # frontend + Core + Supabase containers

npm run typecheck:all && npm run lint:all && npm run test:all   # before every commit
npm run secrets:check && npm run tools:test

npm run release:readiness -- <course>   # before production: all gates + zero-spend dry-runs
npm run production:preflight            # read-only Railway check, operator-only, never CI
```

`README.md`'s "Mandatory testing" table lists which conditional gate to run for the area you touched (i18n, SEO, provider parity, whiteboard/demonstrate-step parity, tutor context/pedagogy, lesson-engine, tutor UI, migrations). Run the gate for your area — CI enforces the repo-wide set but is the backstop, not the gate.

Single-service work: `cd <service> && npm run typecheck && npm run lint && npm run test` — per-service `package.json` also carries service-specific scripts (e.g. `verify:tutor`, `verify:pedagogy`, `gym:pedagogy` in `oracle/`; `verify:lesson-engine`, `verify:tutor-ui`, `verify:rig`, `verify:placement` in `frontend/`).

## Architecture — what requires reading multiple files

- **No shared types across the 11 packages, by design.** Wire shapes (whiteboard instruments, `demonstrate` steps, provider config, roleplay voices) are hand-mirrored across 2–6 files each. A `check-*-parity` gate exists for each and must stay green — don't "fix" drift by picking one copy as canonical, update all copies and let the gate confirm.
- **Only `backend/` (Core) is called by the SPA.** Every other service is either internal-only (behind `x-internal-api-key`) or has one narrow public surface (Depot reads, Oracle's `/ws/tutor` websocket). `database/types/database.ts` is the one generated, shared artifact — regenerate it with `db:types`, never hand-edit.
- **Oracle (`oracle/`) is the AI Tutor runtime**: live sessions, voice (Inworld), moderation, pedagogy controller. Its context schema is `.strict()` and pinned to 14 fields by test (`oracle/src/__tests__/privacy-contract-docs.test.ts`) — widening what reaches the model about a child is a reviewed decision, not a refactor. Voice providers are reachable only through `oracle/src/voice/provider.ts`.
- **Coursegen (Forge) and Oracle both call DeepSeek/Qwen** and must agree on base URLs/models (`provider:check`). The tutor model must stay non-reasoning (`deepseek-chat`).
- **Deploy ordering matters when a wire shape changes**: e.g. adding a whiteboard kind needs Core deployed before Oracle, since Core's body union has no fallback member and 400s the whole turn on an unknown `kind`.
- **CD is CI-triggered per service** (`.github/workflows/<service>-cd.yml` on that service's CI going green on `main`), not a GitHub App — pushing to `main` fans out CI across all 11 services, so batch commits and push once at the end.

See `README.md`'s "Non-obvious invariants & traps" section for the full list (cost/billing discipline, the small dev machine, synthetic-click hit-testing, `families` derived from `guardian_links`, Railway CLI exit codes, etc.) — those are load-bearing and each was learned the expensive way.
