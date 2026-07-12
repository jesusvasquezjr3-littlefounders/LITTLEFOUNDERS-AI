# ROADMAP.md — Architecture & Sprint Plan

> Authority: second only to /AGENTS.md. Architecture decisions recorded here; the running log lives in WALKTHROUGH.md.

## Architecture summary (locked 2026-07-11)

8 independent services (no npm workspaces): **Vault** (Supabase self-hosted on Railway), **Core** backend, frontend (Vercel), **Forge** coursegen, **Echo** audiogen, **Arcade** gamegen, **Guardian** parent-id-check, **Courier** email-server — all TypeScript + Express + Node 24 except Vault (SQL + tooling). Six roles, five product sections, 3 locales, light/dark. Full tables: /AGENTS.md §1.2–§1.5.

## Sprint: v2 bootstrap (goal — 100% functional scaffold + first vertical slice in < 1 week)

### Day 1 — Reset & agent environment ✅ DONE
Wipe v1 (main intact) · root scaffold · AGENTS/CLAUDE + agent/ + all root docs · repo-map tooling.
**DoD:** gates runnable (`docs:check`, `secrets:check`), docs complete, pushed. — met.

### Day 2 — Service scaffolds ✅ DONE
Stamp the 6 Express services + database/ (migrations 0001 identity + 0002 provisional content) + frontend (Vite/React/Tailwind/i18n×3/dark/5 sections/characters).
**DoD:** `npm install && npm run type-check && npm run lint && npm test` green in all 8; frontend `npm run build` passes. — met.

### Day 3 — CI + green pipeline ✅ DONE
8 path-filtered workflows · push · all runs green · repo_map regenerated · doc-sync ritual executed once for real.
**DoD:** `gh run list` fully green on littlefounders_v2. — met.

### Day 3.5 — Design system ✅ DONE (landed ahead of schedule)
`DESIGN.md` authoritative — **LittleFounders Arcade** (Brilliant.org-style gaming clarity + liquid glass; replaced the initial claymorphism system on 2026-07-12, `template/` deleted) · tokens implemented (Tailwind + CSS vars, light+dark) · reusable UI kit (`frontend/src/components/ui/`) · views re-skinned · i18n fragmented per route area per locale · agent rules hardened: responsive (desktop+mobile) made a non-negotiable product invariant (§1.11), anti-hallucination/instruction-fidelity rules added (§1.12).
**DoD:** DESIGN.md authoritative, verified in browser light/dark + es-MX, CI green. — met.

### Day 4–5 — Vault deploy + auth (NEXT)
Supabase self-hosted on Railway (template) · apply migrations · GoTrue signup/login wired into backend + frontend (`universal` role on signup) · RUNBOOK backup/restore section written BEFORE any real data.
**DoD:** live signup → session → `/health` chain across deployed Core.

### Day 6–7 — First vertical slice + buffer
Signup → universal user → profile section → DiceBear avatar customization persisted, using the DESIGN.md tokens + UI kit; app shell (sidebar/dashboard per mockup) built responsive from the start (mobile bottom nav + desktop sidebar).
**DoD:** a real user can sign up, set an avatar, and see it persist — deployed, verified at mobile AND desktop.

## Immediate next step (frontend modeling)

The environment is ready to start building real UI. First candidates, either is a reasonable start:
- **App shell** — the 280px sidebar + content layout from the mockup's dashboard, built with the UI kit, responsive (bottom nav <768px) from the first commit.
- **learn/ section** — first real course/lesson card layout using `Card`/`StatCard`/`ProgressBar`.

Both must follow `agent/prompts/templates/new-component.md` and pass the mobile+desktop verification gate (/AGENTS.md §1.11) before being considered done.

## Next up (post-sprint backlog, unordered)

- Guardian verification flow (provider decision: Stripe Identity / Persona / Veriff / manual)
- learn/ course consumption MVP + Forge pipeline v1 (survey→plan→scaffold→lessons, checkpoint/resume)
- tutor/ Oracle MVP with moderation + cite-or-refuse posture
- tasks/ parent→kid assignment + rewards
- Echo TTS provider decision + per-locale voices
- Arcade first generated minigame bound to a learn concept
- Courier engine decision (Postal / Maddy / Haraka / Stalwart) + templates
- CD wiring (platform-native: Vercel Git integration, Railway watch-paths)

## Open decisions

| Decision | Status | Where documented |
|---|---|---|
| Email engine | OPEN | email-server/README.md candidates table |
| ID-verification provider | OPEN | parent-id-check/AGENTS.md |
| TTS provider | OPEN | audiogen/AGENTS.md |
| gamegen approach (generated vs templated) | OPEN | gamegen/AGENTS.md |
| License | OPEN (UNLICENSED placeholder) | README.md |
