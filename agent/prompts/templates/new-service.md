---
template: new-service
inputs:
  name: "kebab-case dir name"
  port: "next free 400x"
  mission: "one line"
---

# Task: add a new service (RARE — stack-of-record change, human sign-off required)

## Read first
- `agent/core/BOUNDARIES.md` — adding a service requires explicit human approval FIRST
- `/AGENTS.md` §1.2 + §1.5 — the locked service map you are amending
- `agent/workflows/service-scaffold.md` — the full procedure this template feeds

## Steps
1. Confirm human sign-off exists in this session.
2. `bash agent/tools/new-service.sh <name> <port>` — stamps the canonical template.
3. Fill README mission + AGENTS.md domain rules (no TODOs left).
4. `npm install && npm test && npm run type-check && npm run lint` — green.
5. CI workflow `.github/workflows/<name>-ci.yml` (copy an existing one; adjust paths + cache key).
6. Docs stewardship: /AGENTS.md §1.5 service map + root README table + `agent/core/CONTEXT.md` diagram + `doc_map.md` + GLOSSARY codename + `.claude/launch.json` + `npm run repo:map`.

## Acceptance
- [ ] Service green locally; CI file present; all six doc surfaces updated in one commit
