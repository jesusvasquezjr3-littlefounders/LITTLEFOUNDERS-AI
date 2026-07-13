# Pre-Commit Checklist (expanded /AGENTS.md §5)

In every touched service:

- [ ] `npm run type-check` clean
- [ ] `npm run lint` clean
- [ ] `npm test` green; new logic has tests (happy + sad path)
- [ ] `npm run build` green (verify CI in all services)

From repo root:

- [ ] `npm run docs:check` — AGENTS.md == CLAUDE.md
- [ ] `npm run secrets:check` — no credential patterns
- [ ] `npm run i18n:check` — if frontend strings changed
- [ ] `npm run repo:map` — if files were added/moved/deleted
- [ ] `npm run deps:check` — if any package.json changed
- [ ] Frontend UI changes: verified in-browser at mobile (~375px) AND desktop (~1280px), screenshots taken — non-negotiable (`/AGENTS.md` §1.11)

Documentation:

- [ ] Stewardship table (`/AGENTS.md` §8) satisfied in THIS commit
- [ ] `WALKTHROUGH.md` decision log updated if a decision was made
- [ ] Commit message follows `type(scope): summary` (CONVENTIONS.md)
- [ ] Every discrete requirement from the task instruction addressed — none silently dropped (`/AGENTS.md` §1.12)
- [ ] No claim in this response ("verified", "tests pass", "CI green") is unbacked by output actually observed this session
