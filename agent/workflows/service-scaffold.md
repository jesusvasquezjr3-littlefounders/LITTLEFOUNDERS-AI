# Workflow: scaffold a new service end-to-end

> Prereq: human sign-off (BOUNDARIES — new service = stack-of-record change).
> Feeds from: `agent/prompts/templates/new-service.md`.

1. **Stamp** — `bash agent/tools/new-service.sh <name> <port>`.
2. **Fill** — README mission + AGENTS.md (mission, owns/doesn't own, invariants). No TODOs remain.
3. **Verify locally** — `cd <name> && npm install && npm run type-check && npm run lint && npm test` — all green.
4. **CI** — create `.github/workflows/<name>-ci.yml`: copy `email-server-ci.yml`, replace service name in `paths`, `cache-dependency-path`, and `working-directory`.
5. **Docs stewardship (one commit):**
   - `/AGENTS.md` §1.5 service map row → mirror to `CLAUDE.md`
   - Root `README.md` service table
   - `agent/core/CONTEXT.md` services diagram
   - `doc_map.md` row
   - `GLOSSARY.md` codename entry
   - `.claude/launch.json` dev-server entry (local only)
   - `npm run repo:map`
6. **Gates** — `npm run docs:check && npm run secrets:check && npm run deps:check`.
7. **Commit** — `feat(<name>): scaffold <name> service (port <port>)`.

## Production deploy (after the scaffold is committed & green) — `/DEPLOYMENT.md` §8

8. **`railway.json`** (DEPLOYMENT.md §4) + **`.railwayignore`** (per-service, §2 — path-as-root re-roots the archive, so this is required for isolation/hygiene, not optional).
9. **Railway service** — `railway add --service <name>` in project `littlefounders-b2c`; set variables (internal URLs = `<dep>.railway.internal`; secrets never committed); attach a volume only if it persists to disk.
10. **Public vs internal** — public (rare): `railway domain <name>-b2c.littlefounders.ai --service <name> --port <p>` + CNAME/TXT in Vercel DNS + CORS; internal (default): no domain, enforce `x-internal-api-key` with `crypto.timingSafeEqual` (§3).
11. **Deploy + verify** — `railway up <name> --path-as-root --service <name> --ci`; `/health` 200, clean logs, real path exercised.
12. **CD** — `.github/workflows/<name>-cd.yml` (copy one; swap CI-workflow + service name; `RAILWAY_TOKEN`).
13. **Cost** — hot-path → keep warm; idle/admin/operator-only → enable Serverless scale-to-zero; cap any worker-per-core server (§7).
