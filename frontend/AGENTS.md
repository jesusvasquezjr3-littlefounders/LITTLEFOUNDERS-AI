# AGENTS.md — frontend

> Domain rules for this service. Root rules: [/AGENTS.md](../AGENTS.md). Context: [agent/core/CONTEXT.md](../agent/core/CONTEXT.md).

## Mission

The SPA: the five product sections (learn, tutor, games, tasks, profile). Talks ONLY to backend (Core) — plus Supabase Auth for sessions. Deployed on Vercel.

## Invariants that bite here

- **/DESIGN.md is AUTHORITATIVE** (LittleFounders Tactile). Tokens live in `tailwind.config.js` + `src/index.css` CSS vars — never add values those files/DESIGN.md don't define. Type ONLY via the closed `lf-*` scale (`lf-display-xl`…`lf-caption`). Build UI with the kit in `src/components/ui/` (Button, Icon, Card, IconChip, Dropdown, ThemeToggle, ProgressBar, Badge, StatCard) — no per-view restyling. Clay shadows only (`shadow-clay*`); sharp corners and raw hex are prohibited. Icons: Material Symbols via `<Icon name="…"/>` — never emojis (except country flags in the language switcher, DESIGN.md's one exception).
- **No native pickers**: never `<select>`, `<input type="date">`, etc. as a choice control — always `Dropdown` or a purpose-built component (`ThemeToggle`).
- **COMPOSITION FIDELITY (/DESIGN.md §0):** build from **/DESIGN.md §Screen Recipes** (the distilled mockups, in our token vocabulary). Open raw `template/` files only when a recipe is ambiguous — and fix the recipe in the same commit. Deviating without human sign-off is a design bug.
- **Motion is a closed system** (/DESIGN.md §Motion): only the five recipes (page transition via layout, `<Reveal>` scroll reveal with ≤3×80ms stagger, `.lf-pop` panels, press physics, arrow nudge) with `--lf-ease`/`--lf-dur-*` tokens. `.lf-float` is the only infinite animation. Everything reduced-motion safe (wired in index.css).
- **i18n zero tolerance** (§1.8): every string via `t()`, keys in `en-US.json` + `es-MX.json` + `pt-BR.json` in the same commit. Gate: `npm run i18n:check` (root).
- **Dark mode at write time**: every component styles `dark:` variants. Never light-only.
- **Characters are canonical assets**: Dina, Dino, Dr. Rho, Zara Vex (`src/components/characters/`). Reuse; no new mascots without sign-off.
- API calls expect the envelope; error codes map to `errors.api.<code>` i18n keys.
- a11y floor: semantic elements, focus-visible, ≥44×44px hit areas (`min-h-11 min-w-11`).
- Never import from internal services — backend only.
- **Responsive is NON-NEGOTIABLE** (/AGENTS.md §1.11, /DESIGN.md §Layout → *Responsive Adaptation*): every screen and component MUST work at Desktop (≥1024px) AND Mobile (<768px). No frontend task is done until verified in-browser at both ~375px and ~1280px — screenshot both. Desktop must use the freed width deliberately (sidebar, multi-column) — never a stretched mobile column.

## Layout

`src/routes/` (pages + Layout) · `src/components/` (shared; characters live here) · `src/i18n/` (3 locale JSONs + init) · `src/theme/` (dark-mode hook) · `src/lib/` (utils).

## Read before touching

- `/DESIGN.md` — current rules + what's locked (modes, characters, a11y floor).
- `agent/prompts/templates/new-component.md` — the component protocol.
- Skills: `impeccable`, `agave`, `emil-design-eng` apply to all UI work here.
