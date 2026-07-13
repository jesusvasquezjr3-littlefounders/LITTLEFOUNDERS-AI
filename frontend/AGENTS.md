# AGENTS.md — frontend

> Domain rules for this service. Root rules: [/AGENTS.md](../AGENTS.md). Context: [agent/core/CONTEXT.md](../agent/core/CONTEXT.md).

## Mission

The SPA: the five product sections (learn, tutor, games, tasks, profile). Talks ONLY to backend (Core) — plus Supabase Auth for sessions. Deployed on Vercel.

## Invariants that bite here

- **/DESIGN.md is AUTHORITATIVE** (LittleFounders Arcade). Tokens live in `tailwind.config.js` + `src/index.css` CSS vars — never add values those files/DESIGN.md don't define. Type ONLY via the closed `lf-*` scale (`lf-display-xl`…`lf-caption`, Figtree). Build UI with the kit in `src/components/ui/` (Button, Icon, Card, IconChip, Dropdown, ThemeToggle, ProgressBar, Badge, StatCard) — no per-view restyling. Elevation ONLY via the liquid-glass set (`shadow-glass*`, `shadow-pop`, `.lf-glass`, `.lf-glass-deep`); sharp corners and raw hex are prohibited. Icons: Material Symbols via `<Icon name="…"/>` — never emojis (except country flags in the language switcher, DESIGN.md's one exception).
- **No native pickers**: never `<select>`, `<input type="date">`, etc. as a choice control — always `Dropdown` or a purpose-built component (`ThemeToggle`).
- **Action Color Contract (/DESIGN.md §Colors) is NON-NEGOTIABLE**: every button/action's color is chosen by what it DOES, not by taste — `primary` variant = the ONE main CTA (papaya `accent` fill), `secondary` (alternative/lower emphasis, outlined), `success` (positive completion), `danger` (destructive/irreversible). Blue (`primary` token) is for links/focus/info — never the CTA fill; `warning`/`delight` are status/celebration only, never button fills.
- **COMPOSITION FIDELITY (/DESIGN.md §0):** build from **/DESIGN.md §Screen Recipes** — they are the single composition source (there is no mockup directory). Deviating without human sign-off is a design bug; if a recipe is ambiguous, fix the recipe in the same commit.
- **Motion is a closed system** (/DESIGN.md §Motion): only the five recipes (page transition via layout, `<Reveal>` scroll reveal with ≤3×80ms stagger, `.lf-pop` panels, press physics, arrow nudge) with `--lf-ease`/`--lf-dur-*` tokens. `.lf-float` is the only infinite animation. Everything reduced-motion safe (wired in index.css).
- **i18n zero tolerance** (§1.8): every string via `t()`. Locales are DIRECTORIES of route-area fragments — `src/i18n/{en-US,es-MX,pt-BR}/{common,marketing,errors,…}.json` — assembled in `src/i18n/index.ts` (fragment name ⇒ key prefix; `common` spreads at the root). A new key (or fragment file) lands in all three locale dirs in the same commit. Gate: `npm run i18n:check` (root) — checks file-set AND per-file key parity.
- **Dark mode at write time**: every component styles `dark:` variants. Never light-only.
- **Characters are canonical assets**: Dina, Dino, Dr. Rho, Zara Vex (`src/components/characters/`). Reuse; no new mascots without sign-off. Animate them ONLY through Character Control (`characters/control/` — `CharacterActor` + `lf-rig-*` hooks, /LESSON_ENGINE.md §9): never edit SVG geometry/colors, never animate the RAF-owned head/pupil groups.
- **Lesson Engine** (`src/lesson-engine/`): /LESSON_ENGINE.md is authoritative (taxonomy, document contract, grading, session). Exercises build ONLY from `lesson-engine/core/primitives.tsx`; new types follow the §11 extension protocol (family slice + registry, never cross-family edits). Answer keys are server-only — `stripAnswers()` before anything client-persistent; the local grader is dev-lab-only. QA surface: `/dev/lesson-lab` (dev builds).
- API calls expect the envelope; error codes map to `errors.api.<code>` i18n keys.
- a11y floor: semantic elements, focus-visible, ≥44×44px hit areas (`min-h-11 min-w-11`).
- Never import from internal services — backend only.
- **Responsive is NON-NEGOTIABLE** (/AGENTS.md §1.11, /DESIGN.md §Layout → *Responsive Adaptation*): every screen and component MUST work at Desktop (≥1024px) AND Mobile (<768px). No frontend task is done until verified in-browser at both ~375px and ~1280px — screenshot both. Desktop must use the freed width deliberately (sidebar, multi-column) — never a stretched mobile column.
- **Global Theme Transition is NON-NEGOTIABLE**: Every color, background, and border change across the app must transition smoothly when switching themes. This is enforced globally in `index.css` via `transition-property: background-color, border-color, color, fill, stroke;`. Do not override this behavior globally, and ensure all theme changes respect this smooth fading animation.

## Layout

`src/routes/` (pages + Layout) · `src/components/` (shared; characters live here) · `src/lesson-engine/` (core/ · families/ · player/ · lab/ · registry/schema — see /LESSON_ENGINE.md) · `src/i18n/` (3 locale dirs of fragment JSONs + init) · `src/theme/` (dark-mode hook) · `src/lib/` (utils).

## Read before touching

- `/DESIGN.md` — current rules + what's locked (modes, characters, a11y floor).
- `agent/prompts/templates/new-component.md` — the component protocol.
- Skills: `impeccable`, `agave`, `emil-design-eng` apply to all UI work here.
