# doc_map.md — Topic → Document Routing Index

> Look up your topic, open ONLY the doc/section listed. Maintained by hand; update on any doc restructuring (stewardship §8).

## By topic

| Topic | Authoritative doc | Section |
|---|---|---|
| Operating rules, invariants, gates | /AGENTS.md (== /CLAUDE.md) | §0–§8 |
| Roles & permissions | /AGENTS.md | §1.3–§1.4 |
| Child safety & minor PII | /AGENTS.md | §1.9 |
| Service map, ports, codenames | /AGENTS.md | §1.5 |
| API envelope & conventions | /AGENTS.md §1.6 + agent/core/CONVENTIONS.md | — |
| Naming | /AGENTS.md §1.7 + GLOSSARY.md | — |
| i18n rules | /AGENTS.md §1.8; parity gate: agent/tools/check-i18n.sh | — |
| Secrets | /AGENTS.md §1.10 + RUNBOOK.md (leak response); test-fixture placeholder convention: agent/core/CONVENTIONS.md | — |
| Repo-wide CI gates (docs sync, secrets, i18n parity — no path filter) | .github/workflows/repo-gates.yml | all |
| Transactional email (engine, delivery, deploy) | email-server/AGENTS.md · email-server/README.md · database/DEPLOYMENT.md (GoTrue wiring) | — |
| Analytics, observability, system health, GA4 import | pulse/AGENTS.md (pins, upgrade, §1.9 boundary) · pulse/README.md (services, env, GA4 runbook) | — |
| First-party learning/usage telemetry, kid consent, /admin/insights | /INSIGHTS.md | all |
| Insights rollup refresh + retention prune (nightly) | .github/workflows/insights-maintenance.yml + /INSIGHTS.md | §6 |
| Auth email templates + language selector | frontend/public/email-templates/README.md | all |
| Social login (Google OAuth) | backend/README.md ("Social login") · backend/AGENTS.md | — |
| Architecture decisions & sprint | ROADMAP.md | all |
| Deployment, isolation, security, scaling, cost (how services ship & run in prod) | DEPLOYMENT.md | all; §8 = new-service checklist |
| Vault stack deploy specifics (pinned images, backups, upgrade) | database/DEPLOYMENT.md | all |
| Terminology | GLOSSARY.md | all |
| Visual design (authoritative tokens); desktop+mobile responsive rules | DESIGN.md | all, esp. §Layout → Responsive Adaptation |
| Current repo state, past decisions | WALKTHROUGH.md | Current State / Decision Log |
| Incidents, rollback | RUNBOOK.md | all |
| Skills catalog & session rituals | TEAM_PROTOCOL.md | all |
| Product/architecture context (canonical) | agent/core/CONTEXT.md | all |
| Code conventions (copy-paste shapes) | agent/core/CONVENTIONS.md | all |
| Human-sign-off boundaries | agent/core/BOUNDARIES.md | all |
| Lesson Engine (taxonomy, document contract, grading, session, Character Control) | LESSON_ENGINE.md | all |
| Course Engine (hierarchy, curriculum catalog, generation pipeline, gates, providers) | COURSE_ENGINE.md | all |
| AI tutor (Oracle) — approved design, NOT implemented | ORACLE.md | all |
| Task templates | agent/prompts/templates/ | pick by task |
| Multi-step procedures | agent/workflows/ | pick by job |
| File locations | repo_map.md (generated — `npm run repo:map`) | — |

## Per service

| Service | Domain doc |
|---|---|
| database (Vault) | database/AGENTS.md · deploy: database/DEPLOYMENT.md |
| backend (Core) | backend/AGENTS.md |
| frontend | frontend/AGENTS.md |
| coursegen (Forge) | coursegen/AGENTS.md · lesson contract: /LESSON_ENGINE.md · pipeline spec: /COURSE_ENGINE.md |
| audiogen (Echo) | audiogen/AGENTS.md |
| picturegen (Prism) | picturegen/AGENTS.md |
| gamegen (Arcade) | gamegen/AGENTS.md |
| parent-id-check (Guardian) | parent-id-check/AGENTS.md |
| email-server (Courier) | email-server/AGENTS.md · engine (Haraka→SES) + live wiring record: email-server/README.md · haraka/README.md · auth templates: frontend/public/email-templates/README.md |
| filebase (Depot) | filebase/AGENTS.md |
| pulse (Pulse) | pulse/AGENTS.md · pulse/README.md |
