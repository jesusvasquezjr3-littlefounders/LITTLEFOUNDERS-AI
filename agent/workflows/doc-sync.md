# Workflow: session-end doc sync (run at the end of EVERY working session)

1. **WALKTHROUGH.md** — update *Current State* paragraph; append Decision Log rows for any decision made this session; update Known Issues.
2. **Stewardship audit** — walk `/AGENTS.md` §8 table against this session's changes; fill any gap NOW.
3. **Mirror check** — if AGENTS.md changed: `cp AGENTS.md CLAUDE.md`.
4. **Regenerate map** — if files were added/moved/deleted: `npm run repo:map`.
5. **Gates** —
   ```bash
   npm run docs:check && npm run secrets:check
   npm run i18n:check   # if frontend strings changed
   ```
6. **Commit** — `docs: session sync <YYYY-MM-DD>` (or fold into the session's final feat/fix commit if small).
