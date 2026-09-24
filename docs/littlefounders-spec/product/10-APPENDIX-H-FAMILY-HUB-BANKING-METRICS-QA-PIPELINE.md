# Appendix H — Family Hub & Digital Banking Success Metrics, Definition of Done, and Production/QA Pipeline

**Status:** Authoritative operational framework closing Block D. Appendix G answers what the evidence actually supports about chores, allowances, savings mechanics, and parental financial oversight. This appendix answers the three questions still open after D.1–D.23 and the Real-World Money Practice Standard were written: **how do we know this domain is actually building the judgment it claims to build, how do we know a given requirement is done, and how does a change to a family's money-adjacent mechanics get built, tested, and released** without either quietly drifting back toward the "pay for compliance, not judgment" pattern Appendix G warns against, or shipping a control (like the D.1 freeze) that looks real but isn't. Every metric and gate below ties back to a specific requirement (D.x) or research finding (Appendix G §x) so this framework is traceable, not free-floating.

---

## Part 1 — Success Metrics Framework

Four categories, mirroring the logic already established in Appendices C and F: a domain built around money and family trust can look healthy on a shallow read (coins flowing, chores completing) while quietly failing on the dimensions that actually matter (genuine habit formation, real autonomy growth, trustworthy controls). No single category may be used alone to declare Block D "working."

### 1.1 Financial-Habit Effectiveness Metrics

| Metric | What it measures | Data source | Target | Verifies |
|---|---|---|---|---|
| Save-Bucket Contribution Persistence | Rolling Save-bucket contribution rate per child, tracked continuously (not just at goal milestones) | Wallet ledger | Diagnostic — no fixed target; establishes the baseline used as the denominator for the Post-Goal Motivation Cliff metric below | D.15, Appendix G §2.3 |
| Post-Goal Motivation Cliff | Change in Save-bucket contribution rate in the 1–2 weeks following a goal reaching "reached," compared to the child's own pre-completion baseline | Wallet ledger, Savings Goal event log | A measurable drop is expected per Appendix G §2.3; the metric exists to confirm the next-goal prompt (D.15) measurably narrows this drop over successive releases, not to eliminate it entirely | D.15 |
| Allowance-Triggered Redemption Spike | Correlation between time-since-last-allowance-credit and redemption-request rate, compared to the equivalent correlation for chore-by-chore credits | Wallet ledger, Redemption Request log | Diagnostic — confirms or disconfirms the rigidity-risk prediction in Appendix G §2.1 directly against LittleFounders' own population | D.13 |
| Split-Ratio Engagement Quality | % of chore/allowance allocations where the child adjusts the default split rather than accepting an unconsidered default, if a recommended-default-with-override model is adopted per D.13 | Wallet allocation event log | Diagnostic — a near-zero adjustment rate over time signals the split has become rote rather than a genuine decision | D.13 |
| Chore-Tag Adoption Rate | % of parent-created chores tagged as "expected contribution" vs. "bonus task," once D.10 ships | Task event log | Diagnostic — establishes whether families actually use the distinction once offered | D.10 |
| Chore Streak-Freeze Utilization Rate | % of qualifying Chore Streak lapses (a missed day within the lapse-tolerant model's allowed grace) that are covered by a streak-freeze rather than resetting the streak to zero, once B.21's lapse-tolerant model is extended to the Chore Streak entity per D.2 | Chore Streak event log | Diagnostic — no fixed target; mirrors `10-APPENDIX-C-SUCCESS-METRICS-QA-PIPELINE.md`'s Streak-Freeze Utilization Rate for B.21, applied to the same underlying mechanic on the Chore Streak entity, and confirms the lapse-tolerant fix is actually being used in practice, not just present in the spec | D.2 |
| Age-Tier Bonus Comprehension Proxy | For the 13–17 tier, completion rate of the worked-example teaching moment attached to the percentage-based Savings Bonus (D.11) | Banking event log | Diagnostic — no fixed target; establishes a baseline and tracks alongside qualitative feedback, since no direct comprehension test exists in the literature to benchmark against (Appendix G §2.4) | D.11 |
| Real-World Bridge Engagement Rate | % of eligible older teens (by age and/or independence tier) who actually engage with the age-gated transition path once D.19 ships (a graduation curriculum module, a real-account linkage flow, or whatever form the bridge takes) | Real-world-bridge event log | Diagnostic — no fixed target; establishes a baseline. This is D.19's own outcome metric, distinct from D.22's broader data-completeness measure, and should be read alongside `10-APPENDIX-C-SUCCESS-METRICS-QA-PIPELINE.md`'s existing **Real-World Bridge Conversion Rate** (Part 1.1, tracking Learning-domain milestone prompts converting into Family Hub tasks/goals) — the two metrics measure the same underlying idea (does the product's practice actually connect to a real-world action) at two different domain boundaries, and should be reviewed together, not independently | D.19 |

### 1.2 Trust & Autonomy Health Metrics

| Metric | What it measures | Data source | Target | Verifies |
|---|---|---|---|---|
| Denial-Reason Actionability Rate | % of chore/redemption denials carrying a reason specific enough to act on (not a generic "not now"), sampled and human-scored | Sampled denial-reason audit | Trend toward high compliance once D.18 ships; a low or declining rate is treated as a regression | D.18 |
| Independence-Tier Progression Rate | % of eligible parent-managed accounts (by age and/or track record) that actually move to a higher independence tier within a defined window, once D.17 ships | Independence-tier event log | Diagnostic — a near-zero progression rate signals the ladder is not actually being used, regardless of whether it exists in the spec | D.17 |
| Teen Independent-Mode Adoption (confirmed: OD-3, Option B) | % of self-registered 13–17 accounts that adopt the independent (non-family-linked) Family Hub mode, once D.3 ships | Account/role event log | Diagnostic — no fixed target; establishes a baseline post-launch and tracks as a genuine product-health signal, since this closes the sharpest mission/design gap identified in Appendix G | D.3 |
| Repeated-Denial Communication-Nudge Trigger Rate | % of qualifying repeated-denial patterns that correctly trigger the "talk about it" nudge specified in D.18 | Denial event log | Diagnostic — confirms the mechanism fires in practice, not just in the spec | D.18 |
| Share-Bucket Destination Completion Rate | % of Share-bucket contributions that reach their real-world destination (once D.14 ships) within a defined window | Share-destination event log | High completion rate — a low rate would recreate the exact "invisible destination" problem D.14 was built to fix | D.14 |
| Parent-Coaching-Tip Delivery & Engagement Rate | Two-part metric, once D.23 ships: (a) % of eligible parents who actually receive the periodic parent-facing coaching tips (chore-pricing guidance, contribution-vs-bonus framing per D.10, reflective-prompt usage) on the defined cadence, and (b) % of delivered tips that are opened/engaged with | Parent-coaching-content event log | Delivery (a): trend toward 100% — a tip that is written but not reliably delivered is the same "spec vs. reality" gap this Block's other findings warn against. Engagement (b): Diagnostic — no fixed target, since no existing benchmark exists for parent-coaching-tip engagement in this domain | D.23 |

### 1.3 Structural Integrity & Safety Metrics

| Metric | What it measures | Data source | Target | Verifies |
|---|---|---|---|---|
| Freeze-Enforcement Verification | Per-release automated test confirming a frozen account actually blocks redemptions and holds pending allocations/allowance splits | Release-gate test suite | Pass, every release, no exceptions — this is the single highest-priority regression to guard against in this entire Block | D.1 |
| Unauthorized State-Transition Rate | Count of any chore/goal/redemption/banking-account state change that did not originate through the service-enforced business rules | Data-layer audit log | Zero, verified per release once D.4 ships | D.4 |
| Lifecycle-State Completeness Audit | For every declared state in the Task, Wallet Ledger, Redemption Request, and Guardian Link schemas, confirmation that at least one flow produces and at least one flow consumes it | Schema/flow audit, tied to the Appendix C/F Definition-of-Done pattern | 100% coverage; no new state ships without both a producer and a consumer | D.5 |
| Goal-Progress Bonus-Distinction Compliance Rate | % of Savings Goal progress displays in which bonus-sourced credit (the Savings Bonus, D.11) is visually distinguished from the child's own chore/allowance-sourced contributions, once D.16 ships | Release-gate UI audit / goal-progress event log | 100%, verified per release — no goal-progress display may combine earned and bonus-sourced credit without visual distinction, since this is the specific illusionary-progress dark-pattern risk D.16 exists to close | D.16 |
| Tone-Gate Pass Rate (Family Hub/Banking copy) | % of system-generated copy in this Block passing the extended Forge tone gate (D.8) on first submission | Forge/tone-gate logs | Diagnostic — no fixed target; mirrors Appendix C's Forge Gate Pass Rate approach | D.8 |
| No-Unbacked-Guarantee Audit | Recurring, human-judged review confirming no visual element or copy in Digital Banking implies a control the system does not enforce | Scheduled manual audit (quarterly, proposed) | Zero violations found | D.7 |
| Scope-Disclosure Presence & Accuracy Audit | Recurring, human-judged review confirming parent-facing material plainly states what the simulation does not attempt (credit, debt, real compound interest), once D.20 ships | Scheduled manual audit (quarterly, proposed) | Zero violations found — no parent-facing material may imply broader "financial literacy" coverage than the mechanics actually provide | D.20 |

*Note on D.4 — the "bypass path" pattern:* D.4's underlying defect (a second write path — here, direct data-layer/data-gateway writes — that skips the same business-rule enforcement the primary Core API applies) is not unique to this Block. The identical structural pattern recurs at G.2 in `10-APPENDIX-N-STAFF-CONSOLE-METRICS-QA-PIPELINE.md` (Block G, Staff Console), and this audit now names "bypass path" as a cross-block pattern in `10-PRODUCT-GOLD-STANDARD-REQUIREMENTS.md`'s closing synthesis section. Stage 2 of Part 3 below is written to catch exactly this pattern for every future Block D change, not just D.4 itself.

### 1.4 QA & Production Metrics

| Metric | What it measures | Data source | Target | Verifies |
|---|---|---|---|---|
| Staff Family-Engagement Insight Uptime | % of time the staff family-engagement endpoint returns real data rather than "unavailable" | Staff console monitoring | 100% once D.6 ships | D.6 |
| Retention-Policy Compliance Audit | Confirms Family Hub/Banking behavioral data (chore history, denial reasons, spending configuration) is retained/deleted per the published policy | Data-retention audit log | Pass, every release, once D.21 ships | D.21 |
| Longitudinal-Hypothesis Data Completeness | % of eligible long-tenure accounts with the instrumentation needed to eventually test the core causal hypothesis (D.22) actually capturing usable data | Research-instrumentation pipeline | Diagnostic — no fixed target; establishes a baseline. This is a multi-year metric by design, since the hypothesis itself (per Appendix G §3.6) cannot be tested quickly | D.22 |
| Threshold Recalibration Log (Block D) | Extends Appendices C and F's existing logs to this Block's thresholds: independence-tier eligibility criteria, denial-actionability scoring rubric, age-band bonus-framing cutoffs | Maintained document, owned per Part 4 | Every threshold reviewed at least once per defined cadence (proposed: quarterly for the first year) | D.11, D.12, D.17 |

---

## Part 2 — Definition of Done

### 2.1 Generic Definition of Done (applies to every item D.1–D.23)

Mirrors the standard already set in Appendices C and F. A requirement is not "done" when code merges. It is done when all four of the following are true:

1. **Functional** — the described behavior is implemented and a test reproducing the exact scenario in the requirement's "Current State" now passes (for defects) or the new capability is exercised end-to-end (for new capability).
2. **Enforced, not just displayed** — where the requirement concerns a control a family sees (freeze, spending limit, an independence-tier boundary), a deliberately adversarial test confirms the control actually restricts behavior, not merely that the UI displays the correct state. This is the Block D-specific sharpening of Appendix C/F's "Gated" criterion, made explicit because D.1 and D.7 exist precisely because this distinction was previously missed.
3. **Measured** — at least one metric from Part 1 is instrumented and reporting real production data tied to this requirement within one release cycle of shipping. Reporting real data is necessary but not sufficient: unless that metric is explicitly labeled "Diagnostic — no fixed target" in Part 1, it must also be trending toward its stated target (not merely flat or reporting) before this criterion is satisfied — a metric that reports faithfully but is moving away from, or stalled short of, its target does not satisfy "Measured." Any Part 1 metric that is diagnostic in practice (used to observe a pattern rather than to hit a number) must be labeled "Diagnostic" so this distinction is never ambiguous at review time.
4. **Reviewed** — for a requirement grounded in Appendix G's behavioral-economics or developmental-psychology research (D.10–D.20, D.23), a reviewer explicitly checks the implementation against that section's specific design implication, not against a generic "looks good"; for a structural/integrity requirement (D.1–D.9, D.21–D.22), a reviewer confirms the specific "Current State" defect no longer reproduces.

### 2.2 Worked examples — the three highest-ambiguity items

**D.1 (card freeze enforcement):** Done when (a) a frozen account's redemption requests are rejected server-side in an automated adversarial test, not just hidden client-side, (b) pending allocations and allowance splits are held rather than processed while frozen, (c) a child cannot unfreeze an account a parent froze (verified by a test attempting exactly that), and (d) the Freeze-Enforcement Verification metric (Part 1.3) is green in CI on every build, not just checked once at ship time.

**D.17 (graduated-autonomy ladder):** Done when (a) at least two independence tiers exist beyond the current flat model, with a documented, age-and-track-record-based eligibility rule for each, (b) higher tiers demonstrably reduce pre-approval requirements (verified by a test exercising a high-tier account's chore/redemption flow without a parent action where the spec says none is required), (c) the Independence-Tier Progression Rate metric (Part 1.2) is instrumented and reporting within one release cycle, and (d) a rollback path exists to move an account back to a lower tier if a family or the product team determines a tier was reached prematurely — mirroring the demotion-rule precedent already established in Appendix D for the AI Mentor's mastery model.

**D.19 (real-world bridge):** Done when (a) an explicit, documented age-gated transition design exists (not merely a stated intention), (b) at least a first phase of it (for example, the scope-disclosure work in D.20, or a structured "graduation" content module) has shipped and is measurable, and (c) the Longitudinal-Hypothesis Data Completeness metric (Part 1.4) reflects that the transition population is actually being tracked — this item's Definition of Done is deliberately phased, since Appendix G frames this as a multi-year initiative, not a single release.

**D.23 (parent-facing coaching content) — additional note:** Because this item is easy to treat as "soft" and declare done on intent alone, it is done only when (a) chore-pricing and contribution-vs-bonus guidance (D.10) is integrated directly into the Family panel and Tasks/Banking surfaces, not left as a separate help article no parent is prompted to read, (b) the reflective prompt ("what would you tell your kid about this decision?") actually fires at the moment of approval/denial, distinct from and in addition to the reason recorded for the child under D.18, and (c) the Parent-Coaching-Tip Delivery & Engagement Rate metric (Part 1.2) is instrumented and reporting within one release cycle, with the delivery half of that metric trending toward 100% per the Measured criterion in 2.1.

---

## Part 3 — Production/QA Pipeline for Family Hub & Digital Banking Changes

This is the answer to "how does a change to this domain's chore, wallet, savings, or banking mechanics get built and released without reintroducing a D.1-style gap between what a control displays and what it enforces." Because this domain touches family trust and (even simulated) money, every stage explicitly separates "does it display correctly" from "does it actually enforce/behave correctly" — the distinction whose absence produced D.1, D.4, and D.7 in the first place.

**Stage 0 — Scoping & Risk Classification** (Pedagogical Lead + Engineering Lead, human)
Every change is classified into one of three categories before development starts: **structural/safety** (touches a control a family relies on — freeze, spending limit, approval gating, data-layer access rules), **behavioral-economics/developmental** (touches a mechanic Appendix G has a specific research finding about — the split, the bonus, goal progress, streaks), or **presentation-only** (copy, visuals, layout with no behavioral change). This classification determines which of the following stages are mandatory.

*Note on the Engineering Lead pairing:* unlike the earlier content-pipeline blocks (Appendices C and F), Stage 0 here deliberately pairs the Pedagogical Lead with an Engineering Lead from the outset. This Block touches real money-adjacent state (even simulated) and direct family trust, so the risk classification itself — is this structural/safety, and therefore subject to Stage 2's adversarial bypass testing — is an engineering judgment as much as a pedagogical one, and getting it wrong at Stage 0 is how a change like D.1 or D.4 ships looking "presentation-only." This is a deliberate convention for exposure-boundary-heavy blocks, not an inconsistency with how Appendices C and F scope their own Stage 0.

**Stage 1 — Development** (Engineering, human or AI-assisted)
The change is authored. AI-assisted implementation is permitted for all three categories, but every change enters Stage 2 identically regardless of origin.

**Stage 2 — Automated Enforcement Testing** (machine, mandatory for structural/safety changes, recommended for others)
A deliberately adversarial test suite exercises the change as an adversarial family member would: can a child bypass a freeze, exceed a spending limit, or reach a redemption approval state without the required parent action, through any path (UI, direct API call, or — per D.4 — the data gateway)? A change failing this stage returns to Stage 1 with an itemized failure report identifying exactly which bypass path succeeded. D.4 is the named instance in this Block of what this audit now tracks as the "bypass path" pattern — a second write path that skips the same business-rule enforcement the primary Core API applies — which recurs at G.2 (`10-APPENDIX-N-STAFF-CONSOLE-METRICS-QA-PIPELINE.md`) and is named as a cross-block pattern in the main document's closing synthesis section; this stage exists to make sure no future change reopens an instance of it here.

**Stage 3 — Behavioral-Economics & Developmental Review** (Pedagogical Lead, human — mandatory for any change classified behavioral-economics/developmental in Stage 0)
Checks specifically against Appendix G's design implications: does this change respect the age-band differentiation required by D.12? Does it introduce a mandatory, undifferentiated mechanic where the research supports a default-with-override instead (D.13)? Does it fold bonus credit into a progress display without visual distinction (D.16)? A review that only confirms the feature "works" without checking it against the specific research finding it's grounded in does not satisfy this stage. As in Appendices C and F, this reviewer role is a distinct role from the Pedagogical Lead's Stage 0 scoping judgment on the same change, even when the same person occasionally fills both, to avoid a false sense of independent review — the Stage 0 scoping decision and the Stage 3 review of the resulting implementation must be treated as separate checks, not one person's single judgment applied twice.

**Stage 4 — Family-Facing Copy & Tone Gate** (automated + human spot-check, mandatory for any change with user-visible copy)
Runs the extended Forge tone gate (D.8) against any new or changed copy in this domain, checking for "bank voice" language and, per D.7, for any phrasing that implies a guarantee the system does not enforce.

**Stage 5 — Pilot / Family Usability Testing** (Learning Design + a small panel of real families, triggered for new mechanics — a new independence tier, a new bonus framing, the real-world bridge — not required for routine fixes)
Mirrors Appendix C's Stage 4: structured observation with real parents and children in the target age band, checking specifically for the trust and communication failure modes Appendix G Part 4 documents (does a denial actually feel explained? does a newly-granted independence tier feel earned or arbitrary to the child?) — failure modes automated testing and adult review cannot reliably predict on their own.

**Stage 6 — Release & Instrumentation** (Engineering)
The change ships with its relevant Part 1 metric already instrumented, as a launch requirement, not a follow-up ticket.

**Stage 7 — Post-Launch Recalibration** (Pedagogical Lead, on the cadence defined in the Threshold Recalibration Log, Part 1.4)
Real production data feeds back into the numeric thresholds this Block proposes (independence-tier eligibility criteria, age-band bonus cutoffs, denial-actionability scoring). A structural/safety change additionally carries a rollback condition: if the Freeze-Enforcement Verification, Unauthorized State-Transition Rate, or Lifecycle-State Completeness Audit metrics regress after a release, the change is reverted rather than patched forward under pressure, consistent with the kill-switch discipline already established in Appendix F for the AI Mentor's real-time components.

---

## Part 4 — Internal Sequencing & Phasing of Block D

This sequences the 23 Block D requirements into build phases with explicit dependencies, mirroring the approach in Appendices C and F. Cross-block sequencing remains deliberately deferred until every block has been audited.

| Phase | Items | Dependency | Rationale |
|---|---|---|---|
| **0 — Trust-critical enforcement fixes** | D.1, D.4 | None | These are active gaps between what the product displays and what it actually enforces — the same urgency class as Block A's and Block C's Critical safety findings, and the prerequisite for every other control (including the new independence tiers in Phase 3) to be trustworthy at all |
| **1 — Presentation honesty & housekeeping** | D.7, D.5, D.6 | Phase 0 (D.7's audit is only meaningful once D.1's underlying enforcement is real) | Lower-risk, high-trust-value fixes that make the domain's current state honestly legible before new mechanics are layered on |
| **2 — Age-banded mechanics** | D.10, D.11, D.12, D.16 | None hard | Self-contained presentation/framing work that does not depend on the autonomy or bridge work below, and directly closes the age-differentiation gap Block B already solved for lesson content |
| **3 — Graduated autonomy** | D.3 (confirmed: OD-3, Option B), D.17, D.18, D.23 | Phase 0 (an independence tier is meaningless if the underlying controls it relies on aren't genuinely enforced) | The single most mission-critical component of this Block per Appendix G §4.3 — deliberately sequenced after the trust-critical fixes so a newly-independent teen isn't handed a system with known enforcement gaps; D.23's parent-coaching content is grouped here because its reflective-prompt mechanism is built directly on top of D.18's approval/denial surface |
| **4 — Habit-formation refinements** | D.2, D.13, D.14, D.15 | Phase 2 (benefits from age-banded framing already existing) | Mechanic-level refinements grounded in the behavioral-economics research, each independently testable |
| **5 — Governance & disclosure** | D.8, D.20, D.21 | Phase 1 (extends the same honesty standard) | Recurring audits and standing disclosure principles, most valuable once real content/copy volume exists in this domain |
| **6 — Long-horizon initiatives** | D.19, D.22 | Phases 3 and 4 (a real-world bridge and a research-instrumentation plan both require the autonomy ladder and habit mechanics to be stable first) | Deliberately last — these are multi-year product initiatives, not single releases, and depend on the rest of the domain being trustworthy and well-instrumented before they can be meaningfully evaluated |
| **Flexible, no hard dependency** | D.9 | None | A governance/adoption decision (treat Appendix G as authoritative) rather than a code deliverable — effectively already satisfied by this document series, retained as a tracked item for recalibration purposes |

---

## A note on why this appendix exists

Everything in D.1–D.23 describes what must be true of Family Hub and Digital Banking. Without this appendix, a development team would have had to invent its own answer to "how do we know a control we ship actually works" — precisely the question this Block's own audit findings (D.1, D.4, D.7) show was not asked rigorously enough the first time. The Enforced-not-just-displayed criterion in Part 2.1 and the adversarial Stage 2 testing in Part 3 exist specifically so that "the UI shows the right state" is never again treated as equivalent to "the system actually behaves that way" — the exact gap that produced this Block's most serious finding.
