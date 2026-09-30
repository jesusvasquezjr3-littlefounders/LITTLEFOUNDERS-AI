# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Read this first

**`README.md` is the single operational document of this repo** — service map, local setup, every test/deploy command, migration procedure, DNS records, and the non-obvious invariants section. This file only adds what's specific to working as Claude Code here; consult `README.md` for anything operational.

**`CLAUDE.md` and `AGENTS.md` must always be identical.** They are the same content published under two filenames for two different agent tools. Any edit to one must be applied to the other in the same change — never let them drift.

## Mandatory rules — non-negotiable

These gates are not optional, not skippable under time pressure, and not satisfied by "it looked fine":

1. **Don't work against an unprovisioned checkout — but provision only what the task actually needs.** Editing code, running a service's commands or querying the DB against a checkout that has no `node_modules`, no `.env` files or no container stack produces failures that look like product bugs. Check what's missing and fix that much.

   **`npm run setup` is from-zero provisioning and it is destructive:** `scripts/setup-dev.sh` calls `db:reset` unconditionally, which nukes every container volume before re-migrating. Never run it on a working checkout to "make sure" — it will delete a local database that was fine. On a checkout that only lacks dependencies, `npm install` in the packages you're touching is the whole fix, and plenty of work (docs, gates, a single service's unit tests) needs no database at all.



2. **Before starting any work, establish the local machine's actual capabilities — measure them, don't inherit a limit from another machine.** Collaborator machines here differ by an order of magnitude (see README's "Dev machines here differ" invariant): one is an 8 GB Apple M2 that swaps under parallel subagents + headless Chrome + multiple Vite servers, another is a 32 GB / 16-thread Windows box that does not. Pace the work to the machine you are actually on. Before assuming what you can run in parallel, or that a tool/CLI is available, check:
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
   Plus whichever conditional gate applies to the area touched (README's "Mandatory testing" table — i18n, SEO, provider parity, tutor context/pedagogy, lesson-engine, tutor UI, migrations, etc.). Note the table changes directory halfway down: the parity gates are root scripts, the `verify:*` gates only exist inside their service.

   **What a push to `main` actually does.** Not a fan-out across all 11 services — every `*-ci.yml` is `paths:`-filtered, so CI runs for the services you touched plus the unfiltered `repo-gates.yml`. What makes a push consequential is that **CD is chained to CI**: each touched service whose CI goes green deploys itself, and `database-cd.yml` goes further — it auto-applies *additive* migrations to production (`gate-auto-apply.mjs` refuses anything that removes or narrows). So a push is a deploy, and a push touching `database/migrations/` is a production migration. Passing these gates locally is required before every commit; do not commit or push on the assumption that CI will catch it.

4. **Commits are attributed to the developer only — never to Claude.** Do not append `Co-Authored-By: Claude …` or a `Claude-Session:` trailer (or any similar AI-attribution line) to commit messages or PR descriptions in this repo, even if a default instruction elsewhere says to. This overrides that default here.

5. **All documentation added to this project must be written in English**, regardless of the language the user is conversing in. This includes `README.md`, `CLAUDE.md`/`AGENTS.md`, code comments, commit messages, PR descriptions, and any other doc file added to the repo — translate before writing, don't write in the conversation's language and leave it.

## What this is

LittleFounders: a gamified financial-literacy and entrepreneurship platform for kids/families — gamified courses, an AI tutor, parent-assigned tasks with rewards, under verified parental control. TypeScript + Express (ESM, Node 24) on 9 of the 11 independent npm packages (no workspaces). The other two run no server: `frontend/` is a React 18 + Vite + Tailwind SPA, and `database/` is migrations, seeds and generated types. Supabase self-hosted for the DB; deployed to Railway (backend services) and Vercel (frontend).

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

Single-service work: `cd <service> && npm run type-check && npm run lint && npm run test`. **The hyphen is load-bearing:** services name it `type-check`, and only the root aggregate drops the hyphen (`typecheck:all`), so `npm run typecheck` inside a service is `Missing script` every time. `database/` is the exception to the whole line — it defines `test` and the `db:*` scripts only, so `run-all.sh` skips it for type-check, lint and build; its CI is `npm test` plus the secrets scan.

Per-service `package.json` also carries service-specific scripts: `verify:tutor`, `verify:pedagogy`, `gym:pedagogy` in `oracle/`; `verify:lesson-engine`, `verify:rig`, `verify:placement` and the Mentor-stage gate `audit:gate -- --suite mentor-stage` (it runs `scripts/verify-mentor-stage.mjs`, which has no npm alias; `--suite all` adds the text-fit, proportion and Copy Budget audits) in `frontend/`; `seed:kc` and the tutor audit scripts in `backend/`.

## Architecture — what requires reading multiple files

- **No shared types across the 11 packages, by design.** Wire shapes (whiteboard instruments, `demonstrate` steps, provider config, roleplay voices) are hand-mirrored across 2–6 files each. A `check-*-parity` gate exists for each and must stay green — don't "fix" drift by picking one copy as canonical, update all copies and let the gate confirm.
- **Only `backend/` (Core) is called by the SPA.** Every other service is either internal-only (behind `x-internal-api-key`) or has one narrow public surface (Depot reads, Oracle's `/ws/tutor` websocket). `database/types/database.ts` is the one generated, shared artifact — regenerate it with `db:types`, never hand-edit.
- **Oracle (`oracle/`) is the AI Tutor runtime**: live sessions, voice (Inworld), moderation, pedagogy controller. Its context schema is `.strict()` and pinned to 14 fields by test (`oracle/src/__tests__/privacy-contract-docs.test.ts`) — widening what reaches the model about a child is a reviewed decision, not a refactor. Voice providers are reachable only through `oracle/src/voice/provider.ts`.
- **Coursegen (Forge) and Oracle both call DeepSeek/Qwen** and must agree on base URLs/models (`provider:check`). The tutor model must stay non-reasoning (`deepseek-chat`).
- **Deploy ordering matters when a wire shape changes**: e.g. adding a whiteboard kind needs Core deployed before Oracle, since Core's body union has no fallback member and 400s the whole turn on an unknown `kind`.
- **CD is CI-triggered per service** (`.github/workflows/<service>-cd.yml` on that service's CI going green on `main`), not a GitHub App. CI is `paths:`-filtered, so a push runs only the CI of the services it touched — and deploys each one that passes. Batch commits and push once at the end.

See `README.md`'s "Non-obvious invariants & traps" section for the full list (cost/billing discipline, measuring the machine you are on, the Windows CRLF/WSL traps, synthetic-click hit-testing, DuckDB's single shared connection, `families` derived from `guardian_links`, Railway CLI exit codes, etc.) — those are load-bearing and each was learned the expensive way.

Source files cite a rulebook (`/ORACLE.md §16`, `DESIGN.md`, `TUTOR_3D.md`, …) that was removed in commit `77b55596`; ~480 files still point at it. Read any of it with `git show 77b55596^:ORACLE.md`, and treat it as history, not authority — see the note opening README's invariants section.

## LittleFounders specification (binding)

The product and frontend specification lives in `docs/littlefounders-spec/`. It is the absolute, non-negotiable source of truth for the product transformation and frontend rebuild. Legacy code, tests and historical documents do not override it. Precedence when documents disagree:

1. `product/13-OWNER-DECISION-LOG.md`
2. `product/10-PRODUCT-GOLD-STANDARD-REQUIREMENTS.md` and its appendices
3. `frontend/frontend-bible/02-FOUNDATIONS.md`, then `01`, `03`–`08` (a chapter written for one subject, such as `08` for the Mentor, refines `02` on that subject)
4. `frontend/mockup/littlefounders-mockup.html`: a visual reference only, minus `frontend/mockup/KNOWN-DEVIATIONS.md`
5. `product/reviews/`: history, never implement from it

External sources, cited by name:

- Product audit `00`–`09`: `docs/product-audit/`
- `COSMIC_NARRATIVE.md`: `docs/product-audit/COSMIC_NARRATIVE.md`
- 3D Mentor characters: `glb/{Rho,Zara,Liruf,Dina}.glb`; optimized delivery: `frontend/public/scenes/{rho,zara,liruf,dina}.glb`
- Diorama: `frontend/public/scenes/diorama-{a,b}.glb`; scene and placement: `frontend/src/tutor-scene/Diorama.tsx`
- Pose catalogue: `frontend/src/tutor-scene/poseLibrary.ts`; authored clips: `frontend/public/scenes/clips-biped.glb`
- Forge (content pipeline): `coursegen/`

Before building any screen:

- Read `02-FOUNDATIONS.md` §1–2 (decisions D1–D13 and rules 1–23), then the chapter for the surface you are building.
- Every string meets the Copy Budget (`06`). Every component declares `data-copy-role`.
- Use at most 24 system glyphs. Every other visual is our own asset, in the house style, registered in the asset manifest (`07`). Never use stock icon or illustration packs for meaningful visuals.
- Mentor characters are only renders of the real 3D models in catalogue poses. Never generate a look-alike. Never use a letter avatar.
- The Mentor screen is the stage: the character on the Diorama (`08`). Never a chat window.
- Never import a component from the legacy frontend (buttons, inputs, chat, cards). Build from the Bible (`02` rule 23).
- No lives. No celebration outside the milestone list. "Tutor" is only the verified parent; the AI is the Mentor.
- Every minor safeguard follows age, not role. Option B: a teen may have a personal wallet without a parent. Tasks and approvals are guardian-only.

Before merging UI changes, run the text-fit, proportion and copy-budget audits (`frontend/verification-tools`, adapted to the real app's driver). All three must pass.

The owner resolved OD-12 on 21 September 2026: web first, with a future mobile wrapper sharing the web frontend. Keep tokens platform-neutral and the Mentor stage isolated. See `docs/rebuild/BASELINE.md` for implementation evidence; it is a tracking document, never a competing specification.

Track this migration point by point in `docs/rebuild/SPRINTS.md` and `docs/rebuild/REQUIREMENTS.md`. Every checkpoint records product and frontend verification against the SPEC, evidence and remaining limitations. Implementation, local verification, acceptance and release are separate statuses; never close a requirement on implementation alone. Update the sprint record and affected requirement rows together.
