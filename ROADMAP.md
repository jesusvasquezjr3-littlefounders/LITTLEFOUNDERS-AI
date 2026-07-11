# ROADMAP.md — Architecture & Sprint Plan

> Authority: second only to /AGENTS.md. Architecture decisions recorded here; the running log lives in WALKTHROUGH.md.

## Architecture summary (locked 2026-07-11)

8 independent services (no npm workspaces): **Vault** (Supabase self-hosted on Railway), **Core** backend, frontend (Vercel), **Forge** coursegen, **Echo** audiogen, **Arcade** gamegen, **Guardian** parent-id-check, **Courier** email-server — all TypeScript + Express + Node 24 except Vault (SQL + tooling). Six roles, five product sections, 3 locales, light/dark. Full tables: /AGENTS.md §1.2–§1.5.

## Sprint: v2 bootstrap (goal — 100% functional scaffold + first vertical slice in < 1 week)

### Day 1 — Reset & agent environment ✅ target
Wipe v1 (main intact) · root scaffold · AGENTS/CLAUDE + agent/ + all root docs · repo-map tooling.
**DoD:** gates runnable (`docs:check`, `secrets:check`), docs complete, pushed.

### Day 2 — Service scaffolds
Stamp the 6 Express services + database/ (migrations 0001 identity + 0002 provisional content) + frontend (Vite/React/Tailwind/i18n×3/dark/5 sections/characters).
**DoD:** `npm install && npm run type-check && npm run lint && npm test` green in all 8; frontend `npm run build` passes.

### Day 3 — CI + green pipeline
8 path-filtered workflows · push · all runs green · repo_map regenerated · doc-sync ritual executed once for real.
**DoD:** `gh run list` fully green on littlefounders_v2.

### Day 4–5 — Vault deploy + auth
Supabase self-hosted on Railway (template) · apply migrations · GoTrue signup/login wired into backend + frontend (`universal` role on signup) · RUNBOOK backup/restore section written BEFORE any real data.
**DoD:** live signup → session → `/health` chain across deployed Core.

### Day 6–7 — First vertical slice + buffer
Signup → universal user → profile section → DiceBear avatar customization persisted. DESIGN.md rewritten from mockup if it has landed; re-skin pass begins.
**DoD:** a real user can sign up, set an avatar, and see it persist — deployed.

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
| DESIGN.md tokens | BLOCKED on mockup | DESIGN.md skeleton |
| ID-verification provider | OPEN | parent-id-check/AGENTS.md |
| TTS provider | OPEN | audiogen/AGENTS.md |
| gamegen approach (generated vs templated) | OPEN | gamegen/AGENTS.md |
| License | OPEN (UNLICENSED placeholder) | README.md |
