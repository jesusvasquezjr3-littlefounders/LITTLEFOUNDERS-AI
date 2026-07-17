# Workflow: pre-deploy release check

> Deploying is a BOUNDARIES action — human sign-off required before step 6.

1. **Full gates** — from root:
   ```bash
   npm run typecheck:all && npm run lint:all && npm run test:all
   npm run docs:check && npm run secrets:check && npm run i18n:check && npm run deps:check
   ```
2. **Builds** — `frontend`: `npm run build` succeeds; each touched Express service: `npm run build` + `npm start` boots and `GET /health` returns the ok envelope.
3. **Migrations** — any new migration reset-tested twice locally; types regenerated and committed; prod application plan written (which env, rollback step).
4. **CI green** — `gh run list --branch <branch>` all passing on the release commit.
5. **RUNBOOK check** — rollback procedure current for what this release touches.
6. **Human sign-off** → deploy → verify prod `/health` per service → record in WALKTHROUGH decision log.
