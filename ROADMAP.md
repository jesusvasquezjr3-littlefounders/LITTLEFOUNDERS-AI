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

### Day 4–5 — Vault deploy + auth (auth DONE locally; deploy deferred)
**Stack source locked (2026-07-12): pinned `supabase/supabase` clone** (`database/SUPABASE_VERSION`, latest approved release — v1.26.07 today) drives local dev AND production; Railway services deploy the exact image tags from the release's docker-compose (pin table: `database/DEPLOYMENT.md`). ✅ Local stack running from the pin · ✅ migrations applied + reset-twice verified · ✅ signup bootstrap in DB (`0003`) · ✅ real generated types.
**Auth shipped (2026-07-12, local E2E-verified):** Core `/api/v1/auth/*` (signup/login/refresh/logout/me over GoTrue; local HS256 JWT verify; social-provider flow reserved — Google first, later Discord/Facebook) · frontend `/login` + `/signup` (Tutor-intent field; everyone starts `universal`) + `/verify-parent` · **Guardian v1 = local OCR (tesseract.js)**: stateless verdict endpoint, ID photo in-memory only (NEVER stored), Core writes `parent_verifications` (0004, isolated, RLS) + grants `parent` + audit. Deploy remains deferred by decision (2026-07-12: development stays local; production designed-for but not executed) · RUNBOOK backup/restore BEFORE any real data.
**DoD (deploy phase):** live signup → session → `/health` chain across deployed Core.

### Day 6–7 — First vertical slice + buffer
Signup → universal user → profile section → DiceBear avatar customization persisted, using the DESIGN.md tokens + UI kit; app shell (sidebar/dashboard per mockup) built responsive from the start (mobile bottom nav + desktop sidebar).
**DoD:** a real user can sign up, set an avatar, and see it persist — deployed, verified at mobile AND desktop.

## Immediate next step

Dashboard v1 (universal-first, role-scalable shell) shipped 2026-07-12 —
sections lock/unlock from `frontend/src/routes/app/navConfig.ts`. Next
candidates, in Jesús's stated order of interest:
- **learn/ course consumption** — real lesson player behind the course cards
  (needs the dedicated content-schema session first; 0002 is PROVISIONAL).
- **Kid accounts from the Tutor dashboard** — creation + guardian linking UX
  (Testing Tutor ↔ Testing Niño seed pair exists for this).
- Remaining dashboard sections harden as their features land (AI Tutor,
  Games, Tasks).

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
| ID-verification engine | **DECIDED 2026-07-12: local OCR (tesseract.js), photo never stored** | parent-id-check/AGENTS.md |
| TTS provider | OPEN | audiogen/AGENTS.md |
| gamegen approach (generated vs templated) | OPEN | gamegen/AGENTS.md |
| License | OPEN (UNLICENSED placeholder) | README.md |
