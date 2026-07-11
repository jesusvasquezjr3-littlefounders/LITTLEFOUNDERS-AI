# WALKTHROUGH.md — Current State & Decision Log

> Informational (authority level: /AGENTS.md §1.1 #7). Updated at the end of every working session via `agent/workflows/doc-sync.md`.

## Current State (2026-07-11)

v2 total reset executed on branch `littlefounders_v2`; v1 preserved on `main`. **The full scaffold is green:** all 8 services pass type-check/lint/test locally; frontend production build passes; `/health` envelopes verified on live processes; browser smoke passed (dark/light toggle, en-US↔es-MX switch, mobile layout, zero console errors). 8 per-service CI workflows in place. `DESIGN.md` is authoritative (LittleFounders Tactile, from the `template/` mockup) with tokens implemented and a reusable UI kit. Agent rules hardened: responsive (desktop+mobile) is now a non-negotiable product invariant (§1.11) and anti-hallucination/instruction-fidelity rules are codified (§1.12). Nothing is deployed yet (Vault deploy = ROADMAP Day 4–5). Environment is ready for real frontend modeling to begin (see ROADMAP "Immediate next step"). Local-only survivors on disk (gitignored): `.claude/` (skills + archive of v1 characters/env/lesson data), `LEGAL/`, `.github/skills/`.

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

| 2026-07-11 | DESIGN.md v1 authored from `template/` mockup — "LittleFounders Tactile" (claymorphism, Quicksand+Nunito Sans, indigo primary, closed lf-* type scale, 4 clay shadow tokens) | Mockup approved by Jesús; standardization mandate: nothing outside tokens |
| 2026-07-11 | Frontend token implementation: CSS vars (light/dark) + Tailwind theme + `src/components/ui/` kit (Button/Card/IconChip/ProgressBar/Badge/StatCard); views re-skinned | DESIGN.md §Components; verified in browser both modes |
| 2026-07-11 | Desktop+Mobile responsiveness codified as a NON-NEGOTIABLE invariant, AGENTS.md §1.11 (own weight class alongside schema/child-safety invariants) | Jesús: platform must adapt correctly to both, space must be used deliberately; prior docs only implied it in prose |
| 2026-07-11 | Anti-hallucination & instruction-fidelity rules added, AGENTS.md §1.12 (verify-before-asserting, no fabricated specifics, decompose+check off multi-part instructions, evidence required for "tests pass"/"CI green" claims) | Jesús: harden agents against hallucination and silently dropping parts of instructions |

| 2026-07-11 | Marketing site v1 shipped: `/` landing (mini-pitch: problem→solution, S&P FinLit fact, human motivation, reach & goals), `how-it-works`/`families`/`faq` (coming soon), `legal/terms`+`legal/privacy` (under construction), footer contact informame@littlefounders.ai | Jesús's spec; brand assets recovered from main (logo-main.png, Hero-Families.webp) + 2 verified Pexels photos in `frontend/public/marketing/` |
| 2026-07-11 | Added `dark-secondary` token trio to DESIGN.md + CSS | Contact/footer links (`text-secondary`) were unreadable on dark surfaces — caught in §1.11 dark-mode verification |

## Known Issues

_None yet._
