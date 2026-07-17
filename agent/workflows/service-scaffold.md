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
