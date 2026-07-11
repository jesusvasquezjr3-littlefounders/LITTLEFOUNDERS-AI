# Pre-Commit Checklist (expanded /AGENTS.md §5)

In every touched service:

- [ ] `npm run type-check` clean
- [ ] `npm run lint` clean
- [ ] `npm test` green; new logic has tests (happy + sad path)

From repo root:

- [ ] `npm run docs:check` — AGENTS.md == CLAUDE.md
- [ ] `npm run secrets:check` — no credential patterns
- [ ] `npm run i18n:check` — if frontend strings changed
- [ ] `npm run repo:map` — if files were added/moved/deleted
- [ ] `npm run deps:check` — if any package.json changed

Documentation:

- [ ] Stewardship table (`/AGENTS.md` §8) satisfied in THIS commit
- [ ] `WALKTHROUGH.md` decision log updated if a decision was made
- [ ] Commit message follows `type(scope): summary` (CONVENTIONS.md)
