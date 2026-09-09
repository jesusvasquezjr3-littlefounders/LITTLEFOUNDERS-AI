# doc_map.md — Topic → Document Routing Index

> Look up your topic, open ONLY the doc/section listed. Maintained by hand; update on any doc restructuring (stewardship §8).

## By topic

| Topic | Authoritative doc | Section |
|---|---|---|
| 3D characters outside the diorama, the pose library, Lesson Engine gamification | [GOAL_3D_CHARACTERS.md](GOAL_3D_CHARACTERS.md) | Scope + acceptance for the 2026-08-27 request. Draft: three decisions outstanding |
| MCP / school integrations (harness backlog line, `ROADMAP.md` line ~261) | [MCP_SCHOOL_INTEGRATIONS_SCOPING.md](MCP_SCHOOL_INTEGRATIONS_SCOPING.md) | Scoping only, no code — two interpretations laid out, recommendation + required owner/legal/role decisions in §8-§9 |
| Family tasks/rewards/monitoring (`tasks/` product section, family wallet, savings goals, proof-of-work photos, chore streak, `/family` landing) | [FAMILY_HUB.md](FAMILY_HUB.md) | SHIPPED — §0 is the live status (round-2 close-out: every 2026-09-08 deep-audit finding fixed or accepted as a documented risk, §8.1); §7 is the UI spec, §9 the invariant checklist |
| Banca Digital (`/banca` product section — account/card, allowance automation, savings bonus, spend limit, statement) | [BANCA_DIGITAL.md](BANCA_DIGITAL.md) | Waves 0-2 SHIPPED and verified locally 2026-09-08 (§0 is the live status, §14 the build closure + live-verification findings); §7 the UI spec, §12 the open decisions, `family_gifts` (§5.7) deliberately NOT built yet |
| Operating rules, invariants, gates | /AGENTS.md (== /CLAUDE.md) | §0–§8 |
| Roles & permissions | /AGENTS.md | §1.3–§1.4 |
| Child safety & minor PII | /AGENTS.md | §1.9 |
| Service map, ports, codenames | /AGENTS.md | §1.5 |
| API envelope & conventions | /AGENTS.md §1.6 + agent/core/CONVENTIONS.md | — |
| Naming | /AGENTS.md §1.7 + GLOSSARY.md | — |
| i18n rules | /AGENTS.md §1.8; parity gate: agent/tools/check-i18n.sh | — |
| Secrets | /AGENTS.md §1.10 + RUNBOOK.md (leak response); test-fixture placeholder convention: agent/core/CONVENTIONS.md | — |
| Repo-wide CI gates (docs sync, secrets, i18n parity — no path filter) | .github/workflows/repo-gates.yml | all |
| Repairing PUBLISHED lesson content without provider spend (the `speech_hash` constraint, the zero-spend gate, edit ops) | agent/tools/content/README.md | all |
| Transactional email (engine, delivery, deploy) | email-server/AGENTS.md · email-server/README.md · database/DEPLOYMENT.md (GoTrue wiring) | — |
| Analytics, observability, system health, GA4 import | pulse/AGENTS.md (pins, upgrade, §1.9 boundary) · pulse/README.md (services, env, GA4 runbook) | — |
| SEO, discoverability, share cards, robots/sitemap/llms.txt, page titles & descriptions | frontend/README.md ("How the internet sees this site") · frontend/scripts/seo/site.mjs (the surface itself, authoritative) | — |
| First-party learning/usage telemetry, kid consent, /admin/insights | /INSIGHTS.md | all |
| Insights rollup refresh + retention prune (nightly) | .github/workflows/insights-maintenance.yml + /INSIGHTS.md | §6 |
| Auth email templates + language selector | frontend/public/email-templates/README.md | all |
| Social login (Google OAuth) | backend/README.md ("Social login") · backend/AGENTS.md | — |
| Architecture decisions & sprint | ROADMAP.md | all |
| Deployment, isolation, security, scaling, cost (how services ship & run in prod) | DEPLOYMENT.md | all; §8 = new-service checklist |
| Vault stack deploy specifics (pinned images, backups, upgrade) | database/DEPLOYMENT.md | all |
| Terminology | GLOSSARY.md | all |
| Visual design (authoritative tokens); desktop+mobile responsive rules | DESIGN.md | all, esp. §Layout → Responsive Adaptation |
| Screen compositions (what a screen is built OUT of) | DESIGN.md | §Screen Recipes (Marketing · Landing · Auth · Dashboard · Profile · List rows · **Learn** · Lesson · Tutor) |
| Dev QA surfaces — looking at a screen without the whole stack (`/dev/lesson-lab`, `/dev/learn-lab`, `/dev/scene-lab`, `/dev/tutor-lab`) | frontend/AGENTS.md | "Read before touching" + Tutor 3D scene |
| Current repo state, past decisions | WALKTHROUGH.md | Current State / Decision Log |
| Incidents, rollback | RUNBOOK.md | all |
| Skills catalog & session rituals | TEAM_PROTOCOL.md | all |
| Product/architecture context (canonical) | agent/core/CONTEXT.md | all |
| Code conventions (copy-paste shapes) | agent/core/CONVENTIONS.md | all |
| Human-sign-off boundaries | agent/core/BOUNDARIES.md | all |
| Lesson Engine (taxonomy, document contract, grading, session, Character Control) | LESSON_ENGINE.md | all |
| Course Engine (hierarchy, curriculum catalog, generation pipeline, gates, providers) | COURSE_ENGINE.md | all |
| Forge production-readiness audit and research synthesis | COURSEGEN_AUDIT_2026-08-01.md | all |
| AI tutor (Oracle) — product flow, privacy contract, injection defences, content ladder | ORACLE.md | all; §0 = owner decision record |
| Tutor security audit — what was attacked, what was found, what is NOT covered | SECURITY_AUDIT_2026-08-23.md | §3 = the uncovered risk |
| AI tutor runtime code (prompts, moderation, voice, session) | oracle/AGENTS.md · oracle/README.md | all |
| AI tutor legal exposure (minors' voice, ungated generated content, retention) | /LEGAL/AI_TUTOR_LEGAL_REVIEW.md | all; §7 = open questions for counsel |
| Tutor 3D stage (assets, rigs, procedural actions, placement, perf, Blender handoff) | TUTOR_3D.md | all |
| Tutor teaching instruments — the catalog beyond today's 4 whiteboard kinds, the architecture that makes it affordable, the 21-sprint plan | TUTOR_INSTRUMENTS.md | §0 = STATE, read first after any context loss; §5 = invariants; §7 = sprints; §8.2 = owner decisions outstanding. PLAN ONLY — nothing built |
| Analytics warehouse (DuckDB, segmentation, forecasting, experiments) | /DATAINTEL.md · dataintel/AGENTS.md | all |
| Data intelligence console (/admin/intel) | /DATAINTEL.md | §7 |
| Embedded lesson game (KartRush) — deploy, embed contract, integration TODO | `LittleFounders-AI/KartRush` → `docs/21-DEPLOYMENT.md` | all; §3 = the embed contract, §5 = what integration needs |
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
| parent-id-check (Guardian) | parent-id-check/AGENTS.md |
| email-server (Courier) | email-server/AGENTS.md · engine (Haraka→SES) + live wiring record: email-server/README.md · haraka/README.md · auth templates: frontend/public/email-templates/README.md |
| filebase (Depot) | filebase/AGENTS.md |
| dataintel (Data Intel) | dataintel/AGENTS.md · engine spec: /DATAINTEL.md |
| pulse (Pulse) | pulse/AGENTS.md · pulse/README.md |
| oracle (Oracle) | oracle/AGENTS.md · product spec: /ORACLE.md |
