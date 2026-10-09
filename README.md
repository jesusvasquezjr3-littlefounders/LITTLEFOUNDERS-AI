# LittleFounders

LittleFounders helps children and teenagers learn about money.

**The product is being rebuilt from zero** (owner decision, 9 October 2026). Every feature, service and schema of the previous version was deleted so the new one is designed fresh, to the highest security and engineering standards. The previous version is preserved in git as the tag `archive/pre-restart-2026-10-09`; production data will be migrated into the new version when it is ready.

## What exists today

| Piece | State |
|---|---|
| `frontend/` | The landing page (hero, the problem, the four skills, what stays true, the closing ask) inside a shell with header and black footer, built on React 19, Tailwind CSS v4 and seven UI libraries, with the three locales (`en-US`, `es-MX`, `pt-BR`), light/dark theme, the brand tokens and consent-gated Plausible, Umami and Google Analytics 4. Its calls to action do nothing yet. How to work on it: `docs/engineering/FRONTEND-GUIDE.md` and `FRONTEND-TOOLKIT.md`. |
| `database/` | Only the pinned Supabase release (`SUPABASE_VERSION`), the Railway images for the database and gateway, and local-stack scripts. There is no schema: `database/migrations/` is empty. |
| `backend/` | Empty, reserved for the new backend. |
| `pulse/` | Observability, kept as is: Plausible CE, ClickHouse, PostgreSQL, Umami and Uptime Kuma, each a pinned upstream image. |
| 3D characters | Four Mentor models: `glb/` holds the sources and `frontend/public/scenes/` the optimized scenes, both tracked with Git LFS (about 180 MB). Install Git LFS before cloning. |

Nothing else exists: no API, no accounts, no lessons, no tutor, no media services. The previous version's services (Core, Oracle, Forge, Echo, Prism, Depot, Courier, Guardian, Data Intel) may still be running in production; they have no code in this repo.

## Run it

Node 24. From `frontend/`:

```bash
npm install
npm run dev          # http://localhost:5173
npm run type-check && npm run lint && npm run build
```

Database stack (Docker Desktop must be running), from `database/`: `npm run db:sync` fetches the pinned Supabase release, then `db:up`, `db:down`, `db:nuke`, `db:reset`, `db:status`. `db:nuke` deletes all local volumes.

`bash scripts/check-secrets.sh` scans tracked files for committed credentials.

## Deploying

A push to `main` is a deploy. `frontend-ci.yml` and `frontend-cd.yml` build the frontend and deploy it to Vercel (project `littlefounders-ai`, Root Directory `frontend`), so **pushing the restart replaces the live app with the landing page**. Pulse deploys through `pulse-cd.yml`. Backups run daily: `vault-backup.yml` and `pulse-backup.yml` write encrypted dumps to the Depot volume on Railway; see `docs/operations/BACKUP-RESTORE.md`. The backup workflows reach the `filebase` service in Railway, which the restart removed from the repo but not from production: keep that service running until backups move.

Repo secrets: `RAILWAY_TOKEN`, `RAILWAY_SSH_PRIVATE_KEY`, `BACKUP_ENCRYPTION_KEY`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.

## Working rules and documentation

See [[CLAUDE]] (the same file as [[AGENTS]]). All project documentation starts at [[INDEX]]; run `git config core.hooksPath .githooks` once per clone to enable the documentation check.

## License

Proprietary, all rights reserved.
