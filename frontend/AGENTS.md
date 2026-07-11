# AGENTS.md — frontend

> Domain rules for this service. Root rules: [/AGENTS.md](../AGENTS.md). Context: [agent/core/CONTEXT.md](../agent/core/CONTEXT.md).

## Mission

The SPA: the five product sections (learn, tutor, games, tasks, profile). Talks ONLY to backend (Core) — plus Supabase Auth for sessions. Deployed on Vercel.

## Invariants that bite here

- **DESIGN.md is a skeleton** — do NOT invent design tokens. Tailwind defaults only; mark new surfaces `// DESIGN: pending re-skin`. The re-skin pass happens when the mockup-derived spec lands.
- **i18n zero tolerance** (§1.8): every string via `t()`, keys in `en-US.json` + `es-MX.json` + `pt-BR.json` in the same commit. Gate: `npm run i18n:check` (root).
- **Dark mode at write time**: every component styles `dark:` variants. Never light-only.
- **Characters are canonical assets**: Dina, Dino, Dr. Rho, Zara Vex (`src/components/characters/`). Reuse; no new mascots without sign-off.
- API calls expect the envelope; error codes map to `errors.api.<code>` i18n keys.
- a11y floor: semantic elements, focus-visible, ≥44×44px hit areas (`min-h-11 min-w-11`).
- Never import from internal services — backend only.

## Layout

`src/routes/` (pages + Layout) · `src/components/` (shared; characters live here) · `src/i18n/` (3 locale JSONs + init) · `src/theme/` (dark-mode hook) · `src/lib/` (utils).

## Read before touching

- `/DESIGN.md` — current rules + what's locked (modes, characters, a11y floor).
- `agent/prompts/templates/new-component.md` — the component protocol.
- Skills: `impeccable`, `agave`, `emil-design-eng` apply to all UI work here.
