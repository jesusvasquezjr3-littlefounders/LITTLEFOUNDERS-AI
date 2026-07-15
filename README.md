# LittleFounders

**LittleFounders** is a gamified financial-literacy and entrepreneurship learning platform for kids and families. Kids learn through highly gamified courses, an AI tutor, educational minigames, and parent-assigned tasks with rewards — under verified parental control.

> **v2 — total platform rebuild.** The v1 codebase lives on the `main` branch. This branch (`littlefounders_v2`) is a from-scratch monorepo optimized for AI-agent development.
>
> **AI agents:** read [`AGENTS.md`](AGENTS.md) before touching anything.

## Service map

| Service | Codename | Mission | Port | Deploy |
|---|---|---|---|---|
| [`database/`](database/) | Vault | Schema, migrations, RLS, seeds — Supabase self-hosted | — | Railway (Supabase stack) |
| [`backend/`](backend/) | Core | Main API: auth, roles, families, tasks, profiles | 4000 | Railway |
| [`frontend/`](frontend/) | — | React SPA: learn, tutor, games, tasks, profile | 5173 | Vercel |
| [`coursegen/`](coursegen/) | Forge | Course & lesson generation (DeepSeek + Qwen) | 4001 | Railway |
| [`audiogen/`](audiogen/) | Echo | TTS audio for lessons (3 locales) | 4002 | Railway |
| [`gamegen/`](gamegen/) | Arcade | Personalized educational minigame generation | 4003 | Railway |
| [`parent-id-check/`](parent-id-check/) | Guardian | Guardian identity verification (kid/bigfounder gating) | 4004 | Railway |
| [`email-server/`](email-server/) | Courier | Open-source transactional email (Resend replacement) | 4005 | Railway |
| [`filebase/`](filebase/) | Depot | Media storage — lesson audio & generated images (Railway volume) | 4006 | Railway |

## Stack

TypeScript + Express (ESM, Node 24) on every service · React 18 + Vite + Tailwind frontend · Supabase (self-hosted on Railway): Postgres, Auth, Storage, Realtime · Vitest + Supertest · Zod · i18n: `en-US`, `es-MX`, `pt-BR` · light/dark mode.

## Quickstart (Automated Local Setup)

To set up the entire workspace, install dependencies for all 8 microservices, provision the Supabase database, and load the test users and QA courses, run:

```bash
npm run setup
```

After setup is complete, start all services simultaneously with a single command:

```bash
npm run dev
```
*(This streams all backend, frontend, and generation services into one unified terminal. Press `Ctrl+C` to cleanly stop all of them.)*

> **Advanced Database Management**: If you need to manage Supabase manually (e.g., generate new TS types, run raw migrations, or export a course), see the detailed commands in [`database/README.md`](database/README.md).

Repo-wide gates (from root):

```bash
npm run typecheck:all && npm run lint:all && npm run test:all
npm run docs:check     # AGENTS.md == CLAUDE.md
npm run secrets:check  # no committed secrets
```

## Documentation entry points

1. [`AGENTS.md`](AGENTS.md) — operating rules for AI agents (identical to `CLAUDE.md`)
2. [`doc_map.md`](doc_map.md) — topic → document routing index
3. [`ROADMAP.md`](ROADMAP.md) — sprint plan and architecture decisions
4. [`GLOSSARY.md`](GLOSSARY.md) — canonical terminology
5. [`DESIGN.md`](DESIGN.md) — frontend design system (authoritative; desktop+mobile responsiveness is non-negotiable)
6. [`agent/`](agent/) — prompt templates, workflows, and tools for AI-agent sessions

## License

Proprietary — all rights reserved. Third-party skills under `.github/skills/` retain their original licenses (see each skill's `_SOURCE.md`/`LICENSE`).
