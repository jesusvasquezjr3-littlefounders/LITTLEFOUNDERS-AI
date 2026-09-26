# Block D research foundation

**Status:** Product 10 D.9, adopted by Engineering on the SPEC's mandate (S07.7, 2026-09-24); the Pedagogical Lead's first review is pending. Appendix G (`docs/littlefounders-spec/product/10-APPENDIX-G-FAMILY-HUB-BANKING-RESEARCH-FRAMEWORK.md`) is the authoritative basis for D.10 to D.23. This file makes that adoption operational: every Block D design choice is traced to the Appendix G section it rests on, with the honest strength of that evidence and the metric through which the product's own data can test it. The registry is `docs/operations/block-d-research.json`; `agent/tools/check-block-d-research.mjs` keeps the two equal and enforces the claims boundary below.

## How to read the strength column

| Strength | Meaning |
|---|---|
| supported | consistent evidence for this design implication, though never a test of this exact mechanic |
| contested | a live scientific disagreement the product must not treat as settled either way |
| extrapolation | plausible from adjacent research, untested for a structured family money mechanic |
| vacuum | no controlled evidence either way; defensible as a communication device |
| open | a question the product's own longitudinal data may one day answer |
| regulatory | a legal and regulatory basis rather than a behavioural finding |

Appendix G's own closing note applies to every row: each choice is theoretically coherent and consistent with adjacent research, and none is directly proven for this context.

## Traceability

| ID | Strength | Appendix G | What was built | How the product's own data tests it |
|---|---|---|---|---|
| D.10 | extrapolation | §1.2, §2.4 | Every chore is a family contribution (0-2 coins) or a paid bonus task; the Tutor chooses (S07.3) | Chore-Tag Adoption Rate |
| D.11 | supported | §1.5, §2.4 | A fixed "1 for every 10 saved" bonus under 13, a percentage with a worked example from 13 (S07.3) | Age-Tier Bonus Comprehension Proxy |
| D.12 | supported | §1.5 | Three registers (young, transition, teen) decided by age evidence, one design with D.11 (S07.6) | The register distribution, read with the comprehension proxy |
| D.13 | extrapolation | §1.4, §2.1 | A recommended split the child can change in one tap, never a mandatory one (S07.4) | Allowance-Triggered Redemption Spike; Split-Ratio Engagement Quality |
| D.14 | vacuum | §1.3, §1.4 | Share coins go to a real place a Tutor or teen chose, recorded when given (S07.4) | Share-Bucket Destination Completion Rate |
| D.15 | supported | §2.3 | "What's your next goal?" at the celebration (S07.4) | Post-Goal Motivation Cliff; Save-Bucket Contribution Persistence |
| D.16 | supported | §2.3 | Goal progress shows the child's own coins apart from bonus and Tutor coins (S07.4) | Goal progress by provenance (a static release gate) |
| D.17 | extrapolation | §2.5, §4.1, §4.3 | A three-level independence ladder by age and track record, with a rollback (S07.5) | Independence-Tier Progression Rate |
| D.18 | supported | §4.2, §4.5 | No "not yet" without an actionable reason; the child's own words reach the Tutor; a "talk about it" nudge (S07.5) | Denial-Reason Actionability Rate; Repeated-Denial Communication-Nudge Trigger Rate |
| D.19 | contested | §3.1, §3.3 | "Beyond the app" from 15: real-world moments with just-in-time checklists (S07.7) | Real-World Bridge Engagement Rate |
| D.20 | supported | §3.5 | A plain statement of what the practice does not teach: credit, debt, real compound interest, risk (S07.7) | Scope-Disclosure Presence & Accuracy Audit |
| D.21 | regulatory | §4.6 | A written, enforced retention and deletion policy for this Block's data (S07.7) | Retention-Policy Compliance Audit |
| D.22 | open | §3.6 | Consent-gated, observational research instrumentation (S07.7) | Longitudinal-Hypothesis Data Completeness |
| D.23 | supported | §1.1, §4.2 | Coaching inside the Tutor's controls, a reflective prompt before every decision, a reviewed monthly tip (S07.7) | Parent-Coaching-Tip Delivery & Engagement Rate |

Notes on the weakest rows, so nobody reads them as stronger than they are:

- **D.13 and D.14.** No study tested Save/Spend/Share against alternatives (§1.4). The split and the Share pocket are kept as a communication device with a default the child can change; the product's own telemetry (the rigidity spike of §2.1) is the only way to learn more.
- **D.17.** The Self-Determination Theory findings are about parenting in general, not family fintech (§4.1 flags this itself). The ladder's thresholds are Engineering proposals in the Block D threshold log.
- **D.19.** Whether financial education decays over long gaps is unresolved (§3.1: Fernandes et al. versus Kaiser et al.). The bridge follows the one recommendation both sides share, education close to a real decision, and measures its own use before anything more is built (`OLDER-TEEN-GRADUATION-INITIATIVE.md`).
- **D.22.** The central hypothesis (childhood practice causes better adult money behaviour) is not demonstrated by any study (§3.6). The company treats it as a question it is testing (`BLOCK-D-LONGITUDINAL-RESEARCH-PLAN.md`).

## What the product may say

Block D Part 4: none of these mechanics may be marketed as scientifically proven, internally or externally.

| May say | Must not say |
|---|---|
| "Based on research about families and money" | "Scientifically proven", "proven to", "clinically" |
| "A finding, not a promise" (the monthly tip's own wording) | "Studies show that children who use LittleFounders…" |
| "We are learning whether practice here helps later in life" | "Builds better adult financial behaviour" |
| "It practises earning, splitting, saving toward goals and asking" | "Teaches financial literacy" as if it covered credit, debt or investing (D.20) |

`check-block-d-research.mjs` screens the app's Block D namespaces, the shared strings and the marketing site in three locales for proof claims and fails on any. Emails, store listings and anything outside those files are read by the quarterly human audit (`BLOCK-D-SCOPE-STATEMENT.md`).

## OD-23: experiments

Experiments run on adults (18+) only until Product and Legal choose wider ages (H.7's interim default). A minor's Block D data is only ever observed, through the consent-gated streams (H.1 analytics, D.22 research). The gate fails when any Block D table gains an experiment, variant or treatment column. Parent coaching is the one Block D surface whose audience is adult; any future experiment on it must still be registered here first.

## Recalibration

Cadence: quarterly for the first year after release, then yearly, the same as Appendices B and D and the Block D threshold log. Owner: the Pedagogical Lead, with Product.

Each review looks at:

1. New published evidence on any section cited above (a replication, a failed replication, a new RCT), and whether a row's strength should change.
2. Each row's metric in production. A diagnostic that contradicts a row's design implication for two quarters is a reason to revisit the design, recorded here.
3. The Block D threshold log's values against the same data.

A review adds a row to the log below and to `recalibration.log` in the registry, with the next review date. `node agent/tools/check-block-d-research.mjs --strict` fails when the next review is overdue; it runs in release readiness, so a release cannot ship on an overdue recalibration, while the ordinary repo gate only warns.

| Date | Scope | Decision | By | Next review |
|---|---|---|---|---|
| 2026-09-24 | Adoption of Appendix G as the authoritative basis for D.10-D.23; traceability and evidence strengths recorded | Adopted by Engineering on the SPEC's mandate; awaiting the Pedagogical Lead's first review. No evidence in Appendix G has been superseded yet. | Engineering (S07 lane) | 2027-01-15 |
