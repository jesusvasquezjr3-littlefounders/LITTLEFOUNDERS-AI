# Product transformation: implementation baseline

Date: 21 September 2026. Status: kickoff baseline, not a completed migration or release approval.

Execution now follows the [sprint and acceptance register](SPRINTS.md). This file remains the historical kickoff baseline; current checkpoint status and evidence live in the sprint records and requirement ledger.

## Authority and scope

[`../littlefounders-spec/`](../littlefounders-spec/README.md) is the absolute, non-negotiable product and frontend authority. This document tracks execution; it does not create another specification. Owner decisions win, followed by the product requirements and appendices, the Frontend Bible, and the mockup with K40–K42 excluded. Historical reviews are not implementation instructions.

The work covers the whole product, not the mockup's 17 routes. The legacy audit inventories 45 product routes, 194 Core endpoints and 57 exercise types. Those are audit counts, not newly verified production counts. The requirement ledger tracks all 113 headings (112 requirements: C.8 and C.12 are one item). Each block's Definition of Done and appendix remain mandatory; a row in the ledger is not acceptance evidence.

The owner selected **web with a future mobile wrapper** on 21 September 2026. The decision is recorded in the binding owner log, section 9. No wrapper vendor has been selected. Store-policy and Legal validation remain pre-launch work.

## Source map

| Source | Actual location | Treatment |
|---|---|---|
| Legacy product audit 00–09 | `docs/product-audit/` | Historical current-state evidence, recheck against code |
| Brand narrative | `docs/product-audit/COSMIC_NARRATIVE.md` | Approved brand wording, subject to owner decisions |
| Original characters | `glb/Rho.glb`, `glb/Zara.glb`, `glb/Liruf.glb`, `glb/Dina.glb` | Preserve real models and proportions |
| Delivered characters and Dioramas | `frontend/public/scenes/` | Existing optimized assets; not yet approved under the new manifest gate |
| Diorama placement | `frontend/src/tutor-scene/Diorama.tsx` | Inspect scene behavior; never port legacy HUD or controls |
| Pose catalogue | `frontend/src/tutor-scene/poseLibrary.ts` | Reuse vocabulary and assets; audit old use descriptions against OD-7 |
| Animation clips | `frontend/public/scenes/clips-biped.glb` | Preserve, verify character coverage |
| Forge | `coursegen/` | Migrate content gates and wire contracts |

All original import checksums passed before modification. The owner log and its checksum were then updated together for the owner's OD-12 decision. No mockup deviation was silently accepted.

## Measured local state

- Node 24.19.0 matches `.nvmrc`; npm 11.17.0.
- 16 logical CPUs; 31.71 GiB RAM, approximately 15.37 GiB available at kickoff, measured through Node's OS API. Windows CIM queries were denied.
- Twelve Node processes were present. Their roles were not inferred from process names.
- Docker Desktop's configured Linux pipe was unavailable. No database reset or provisioning was run; this foundation work needs no database. Database-dependent acceptance remains outstanding.
- Frontend dependencies and `.env` were already present; environment values were not printed.
- The checkout already contained substantial uncommitted auth, lesson-recovery, grading, database and UI work. It remains intact. This pass neither certifies nor discards it.

## Initial code findings

These are inspected local-code findings, not claims about the currently deployed application.

| Area | Evidence | Consequence |
|---|---|---|
| Design system | `frontend/tailwind.config.js`: Sora/Inter, 10/16/24/32 radii, glass and tactile shadows | Replace with Fredoka/Nunito, 12/20/28/36 radii and flat fills; changing old tokens globally is not the rebuild |
| Route architecture | `frontend/src/App.tsx`: existing public, auth, learner, family and staff route groups | Preserve an explicit route migration inventory; the mockup is not scope |
| Teen wallet | `frontend/src/App.tsx`: banking gated by `parent`/`kid` roles | Implement OD-3 Option B end to end; revealing a tab does not grant API access |
| Minor safety | `backend/src/routes/tutor.ts`: several `isMinor = roles.includes('kid')` branches for session/voice/memory | A.2–A.4 and C.2–C.4 require a server-owned age/origin policy and adversarial tests; a frontend flag is insufficient |
| Mentor | Existing 3D models, Diorama and pose catalogue are present | Preserve assets, rebuild presentation and controls; validate all eight state mappings and model-rendered fallbacks before replacing the current screen |
| Celebration | Pose catalogue still describes celebration for ordinary streak extension and surprise rewards | Catalogue availability is not permission to trigger it; OD-7's closed milestone list governs new callers |
| Prior lesson work | Existing uncommitted atomic completion/grading and checkpoint changes | Verify and preserve progress/replay guarantees during migration; do not mistake uncommitted work for absence |

The remaining per-requirement implementation audit is open. In particular, placement storage, freeze enforcement, social visibility, share revocation and staff permissions still need targeted current-code and execution evidence. The historical audit alone cannot mark them fixed or prove a present production exploit.

## First implementation slice

The new foundation lives in `frontend/src/rebuild/` and imports no legacy UI. The development-only `frontend/rebuild.html` entry mounts it independently of auth, analytics and service clients. It is a **design verification surface**, not the new product, a production lesson, or an approved final design.

- Color, radius, spacing and touch tokens are generated from the binding Bible. Light/dark values are checked for drift.
- New flat buttons, fields, copy roles, selected choices and informational feedback support content reflow and reduced motion.
- Copy-budget contracts cover EN/es-MX/pt-BR, young-child limits, sentence limits and exemptions for required disclosures.
- Celebration eligibility is restricted to OD-7's seven milestone identifiers. This is foundation code; existing production callers have not yet been migrated.
- Fredoka and Nunito Latin variable fonts are extracted from the delivered reference, self-hosted with their SIL OFL licenses. No runtime font request goes to a third party.
- The preview's sample copy is not approved brand copy and is counted as ordinary copy. Its local form does not save account data.
- The spec gate checks import integrity, identical agent instructions, requirement coverage and the new UI import boundary. It is a scoped gate, not proof that every product requirement is implemented.

## Execution sequence

1. **Safety and trust hotfixes (OD-8):** age/origin provenance and locked birth date first; then fail-closed Mentor/voice/analytics enforcement, social relationship visibility, staff permission enforcement, freeze enforcement, share lifecycle and placement. Preserve the preexisting completion/grading work. Backend policy and data changes need database-backed acceptance before rollout.
2. **Shared frontend foundation:** complete controls, overlay/focus behavior, asset manifest, system glyph inventory and the real-app drivers for text-fit, composition and copy audits. New asset families require the style approval specified by Bible 07; prepare actual candidates before requesting it.
3. **Identity and learner journey:** rebuild registration, all age gates, authentication, onboarding, navigation, course shelf and placement against migrated Core contracts. Use real loading, empty, error and recovery states.
4. **Mentor and learning together:** rebuild the shared stage and compact lesson stage from the real assets; unify the teaching board and knowledge graph. B.1 must pass before B.6. Appendix A Core visuals and Appendix P's first-release scope are not optional extras.
5. **Family and teen autonomy:** teen wallet without approval, guardian-only Tasks, connected-child wallet, approval rationale, savings goals, consistent streak behavior and weekly learning narratives.
6. **Profiles, achievements, staff and operations:** enforce age-based relationships, controlled sharing, permissions, consuming flows for every event, retention and operational alerting.
7. **Cutover:** data reconciliation and rollback rehearsal; all locale/theme/viewport/a11y checks; required Legal review; every block's Definition of Done. Remove replaced legacy screens and controls as their replacements pass acceptance. Do not leave a permanently mixed design system.

The open owner/product/legal decisions remain in the binding owner log section 8. Resolve them before their specified block or phase, not all at kickoff. No production deployment is implied by this baseline.

## Verification of this slice

- Specification integrity, agent parity, 113-heading ledger coverage, new UI dependency boundary and generated token parity: passed. The new gate is included in the unfiltered repository CI workflow.
- Frontend type check and lint: passed. Production build: passed, with existing large-chunk and mixed-import warnings. The standalone preview entry is absent from production output.
- New contract and translation tests: 7 passed. Repository tool tests: 54 passed after putting Git Bash ahead of the unavailable WSL shell in PATH.
- Repository localization parity, hardcoded-string checks and tracked-file credential scan: passed.
- Foundation browser audit: 288 configurations, zero findings, covering three screens, EN/es-MX/pt-BR, both themes, widths 320/375/768/1280, normal/+40% text and normal/WCAG text spacing. Real-pointer checks exercised answer selection, miss/correct feedback, retry, field validation and confirmation; reduced-motion behavior also passed. Runtime console errors and failed HTTP responses were checked. Captures at 375 and 1280 were visually inspected.
- Scope limitation: this browser report is not the full product audit, a complete composition gate, a screen-reader assessment, or proof of backend safety. The full repository service test aggregates and database gates were not run. No commit, push, migration or deployment was performed.

Evidence: `audit-results/rebuild/report.json` and the matching screenshots. These are local run artifacts; all 112 product requirements remain subject to their own acceptance evidence.
