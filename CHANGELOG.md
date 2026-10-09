# Changelog

All notable changes to the repository. Newest first. Updated in the same commit as the change; see [[CI-CD-AND-VERSION-CONTROL]] and the open work in [[BUILD-TASKS]].

## Unreleased

### Added

- Documentation system under `docs/` with an index ([[INDEX]]), scaffolds for product, design, engineering, security, operations and process documents, a decision log, and `scripts/check-docs.mjs` run as a pre-commit hook and in CI.
- Security tooling: vendored anti-slop Oxlint rules (`npm run lint:slop`), Strix security skills and references, rules for AI penetration testing ([[ai-pentesting]]).
- Google Analytics 4, consent-gated, next to Plausible and Umami.
- Git LFS tracking for the 3D character files.
- Skills for words and design (D-008): `humanizer` as the always-on standard for user-facing text (new rule 12 in [[CLAUDE]] and [[AGENTS]]), and `impeccable` plus seven taste-skill design skills that run only when the owner invokes them; see [[AI-WORKFLOW]].
- [[UI-LIBRARIES]]: the seven mandatory UI libraries (Bklit UI, Motion, Sileo, 000h by Cojeev, Bencho, Morphicons, Thinking Orbs), decision D-007 and tasks T-009 to T-011; the Bencho procedure and licence are recorded in it.

### Changed

- The frontend moved to React 19, Tailwind CSS v4 and shadcn. The hand-written design system (`src/rebuild/`) and its asset manifest were deleted; the landing, shell, cookie choice, theme toggle and language menu were rebuilt on the libraries, with brand tokens in `src/styles/lf-theme.css`. The "ten seeds" row became a Bklit ring chart. Public assets moved from `/rebuild/...` to `/landing/` and `/brand/`; copy files from `rebuild-*.json` to `core.json` and `site.json`.
- Sileo toasts take the brand colors and show their text as written; Sileo shares our Motion copy (`overrides` in `package.json`), which cut the entry chunk from 987 KB to 860 KB.
- Accessibility pass on the landing (axe, keyboard): the skip link is the first Tab stop, targets are at least 48 px, closing the cookie sheet returns focus to its opener, and menus no longer contain a focusable scroll wrapper (one local patch to copied code, listed in [[UI-LIBRARIES]]). Stable libraries are built into their own chunks.
- `noUncheckedIndexedAccess` is off and registry code is excluded from ESLint and `lint:slop`, because the libraries' copied code does not satisfy them.
- `frontend-ci.yml` no longer triggers on the removed branch and paths. `frontend-cd.yml` now fetches the LFS 3D scenes (about 6 MB) before building, so a deploy does not ship pointer files.
- The product was restarted from zero (2026-10-09). Only the landing page, the 3D characters, the pinned Supabase setup and Pulse remain; see [[DECISIONS]].
