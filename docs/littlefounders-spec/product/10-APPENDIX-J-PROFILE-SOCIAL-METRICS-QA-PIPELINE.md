# Appendix J — Profile & Social Success Metrics, Definition of Done, and Production/QA Pipeline

**Status:** Authoritative operational framework closing Block E. Appendix I answers what the evidence actually supports about discoverability, connection models, age-tiering, trust signals, and comparison metrics. This appendix answers the three questions still open after E.1–E.13 and the Safe Social Layer Standard were written: **how do we know the social layer is actually safer, not just differently designed; how do we know a given requirement is done; and how does a change to discoverability, connection, or profile mechanics get built, tested, and released** without quietly reintroducing the exact gap (an open graph with a reassuring-looking but non-functional safeguard) that produced this Block's most severe findings. Every metric and gate below ties back to a specific requirement (E.x) or research finding (Appendix I, Part x) so this framework is traceable, not free-floating.

---

## Part 1 — Success Metrics Framework

Four categories, mirroring the logic already established in Appendices C, F, and H: a social/safety domain can look healthy on a shallow read (follows happening, no visible complaints) while quietly failing on the dimension that actually matters (whether a stranger can still reach a child). No single category may be used alone to declare Block E "working."

### 1.1 Child-Safety Effectiveness Metrics

| Metric | What it measures | Data source | Target | Verifies |
|---|---|---|---|---|
| Cross-Family Discovery Rate | Rate at which a kid-role profile is reached (viewed, appears in search/suggestions) by an account with no prior approved family/connection relationship | Discovery/search event log | Zero, once E.1 ships — any non-zero rate is treated as a regression, not a tolerance | E.1 |
| Unauthorized Connection Attempt Rate | Rate of inbound connection requests to a kid-role account that did not originate from an existing approved relationship | Connection-request event log | Diagnostic pre-launch (establishes baseline exposure under the current open model); nearly zero post-E.1, since such requests should no longer be reachable at all | E.1 |
| Guardian-Approval Queue Latency | Time between an inbound connection request and a guardian's approve/deny action | Family panel event log | Diagnostic — no fixed target; establish baseline, since a persistently high latency signals parents aren't engaging with the queue, which is itself a Trust & Parental-Visibility Health signal (1.2) | E.1, E.2 |
| Report Rate and Resolution Time | Number of reports filed via the E.3 mechanism, and time to staff resolution | Report/moderation queue log | Diagnostic — no fixed target; establish baseline, since a rate of exactly zero after launch is itself a signal worth investigating (it could mean no problems, or that the report action is undiscoverable) | E.3 |
| Age-Tier Boundary Integrity | Rate at which a kid-role or universal-teen account's date-of-birth field changes without the required guardian re-confirmation step (E.4) succeeding anyway | Settings/DOB change audit log | Zero — any successful bypass is a Critical regression, since E.1/E.8's entire gating model depends on this field being trustworthy | E.4 |
| Tutor-Badge Cross-Population Visibility | Rate at which the Tutor badge is rendered to a viewer with no established connection to the badge-holder | Profile-render event log | Zero, once E.5 ships | E.5 |
| Profile-Content Safety Review Coverage | % of kid-role profiles whose username/display-name fields have passed the E.13 content-level safety review (cross-platform-handle reuse check) | Profile safety-review audit log | 100% coverage, checked at profile creation and on every subsequent edit | E.13 |
| Repeated-Contact Pattern Escalation Rate | % of qualifying repeated-report/block patterns (per the threshold defined in E.3) that correctly trigger automatic staff review | Report/block event log vs. staff review queue | 100% — a missed trigger is treated as a Critical regression, not a diagnostic miss | E.3 |

### 1.2 Trust & Parental-Visibility Health Metrics

| Metric | What it measures | Data source | Target | Verifies |
|---|---|---|---|---|
| Family-Panel Social Visibility Adoption | % of parents who view their linked child's followers/following/pending-requests view at least once per defined window, once E.2 ships | Family panel event log | Diagnostic — no fixed target; establish baseline, since a near-zero rate signals the surface is not discoverable enough within the panel, regardless of whether it technically exists | E.2 |
| Audit-Log Completeness for Social Events | % of follow/unfollow/block/report events that produce a corresponding Audit Log entry | Audit Log vs. raw event-stream reconciliation | 100%, verified per release | E.2, E.3 |
| Deletion-Request Clarity | For E.6, % of adult/guest deletion requests (self-service or "contact us") that receive a stated timeline within a defined SLA | Support/deletion request log | Diagnostic pre-SLA — no fixed target until a published SLA exists; establish baseline and track toward that SLA once the flow is built or documented | E.6 |
| Social-Data Retention-Policy Compliance | Confirms social-graph data (follows, blocks, connection requests) is retained/deleted per the E.11 published policy | Data-retention audit log | Pass, every release, once E.11 ships | E.11 |

### 1.3 Structural Integrity & Compliance Metrics

| Metric | What it measures | Data source | Target | Verifies |
|---|---|---|---|---|
| Discoverability-Gate Enforcement Verification | Per-release automated adversarial test confirming a kid-role profile cannot be found, searched, or followed by an unconnected account through any path (UI, direct API, or data-gateway write) | Release-gate test suite | Pass, every release, no exceptions — the single highest-priority regression to guard against in this Block, directly analogous to Appendix H's Freeze-Enforcement Verification | E.1 |
| Age-Tier Differentiation Coverage | % of social-layer surfaces (discoverability, connection model, default privacy) that correctly differentiate kid-role, universal-teen, and adult defaults | Schema/flow audit | 100% coverage once E.8 ships; no new social-layer surface ships without this differentiation defined | E.8 |
| Future-Feature Messaging Gate Compliance | For any new messaging/comment-adjacent feature proposed after E.10 ships, confirmation it defaults off for kid-role/universal-teen accounts and requires the specified opt-in before activation | Feature-launch checklist, tied to Stage 0 below | 100% — no exceptions, regardless of the feature's stated purpose | E.10 |
| Comparison-Metric Audit | Recurring review confirming follower/following counts (if retained in any form) are not displayed adjacent to XP/streak/badge metrics, and are private/opt-in rather than public-by-default | Scheduled manual audit (quarterly, proposed) | Zero violations found | E.9 |

### 1.4 QA & Production Metrics

| Metric | What it measures | Data source | Target | Verifies |
|---|---|---|---|---|
| Avatar/No-Upload Constraint Integrity | Confirms no image-upload capability has been introduced to the avatar system without a documented full child-safety re-review | Feature-launch checklist | 100% compliance | E.12 |
| Brand-Narrative Coverage Check | Confirms `COSMIC_NARRATIVE.md` (or its living equivalent) carries an explicit, current statement on the social layer's design philosophy for children | Documentation audit, owned per Part 4 | Present and current, reviewed on the same cadence as other Appendix-derived governance items | E.12 |
| Threshold Recalibration Log (Block E) | Extends Appendices C, F, and H's existing logs to this Block's thresholds: guardian-approval-queue SLA, report-resolution SLA, age-tier boundary rules | Maintained document, owned per Part 4 | Every threshold reviewed at least once per defined cadence (proposed: quarterly for the first year, given the actively-moving regulatory landscape flagged in Appendix I Part 3) | E.4, E.8, E.11 |

---

## Part 2 — Definition of Done

### 2.1 Generic Definition of Done (applies to every item E.1–E.13)

Mirrors the standard already set in Appendices C, F, and H. A requirement is not "done" when code merges. It is done when all four of the following are true:

1. **Functional** — the described behavior is implemented and a test reproducing the exact scenario in the requirement's "Current State" now passes (for defects) or the new capability is exercised end-to-end (for new capability).
2. **Enforced, not just displayed** — where the requirement concerns a control a family relies on (discoverability, a connection gate, an age-tier boundary), a deliberately adversarial test confirms the control actually restricts behavior via every path (UI, direct API call, and the data gateway), not merely that the UI displays the correct state. This is the same sharpening Appendix H established for Block D, made just as necessary here given E.1's central finding.
3. **Measured** — at least one metric from Part 1 is instrumented and reporting real production data tied to this requirement within one release cycle of shipping; for any such metric not explicitly labeled "Diagnostic — no fixed target" in Part 1, that production data must also be trending toward the metric's stated target before this criterion is satisfied — reporting a number alone is not sufficient.
4. **Reviewed** — for a requirement grounded in Appendix I's safety, design-precedent, regulatory, or psychological research (E.8–E.13, which includes E.13's content-level safety review), a reviewer explicitly checks the implementation against that Part's specific design implication, not against a generic "looks good"; for a structural finding (E.1–E.7), a reviewer confirms the specific "Current State" defect no longer reproduces.

### 2.2 Worked examples — the three highest-ambiguity items

**E.1 (discoverability and guardian-approval gate):** Done when (a) a kid-role profile does not resolve, appear in search, or appear in a followers/following list to any account with no approved family/connection relationship, verified by an automated adversarial test attempting all three paths, (b) an inbound connection request to a kid-role account is held in a pending state until a guardian approves it via the Family panel, verified by a test attempting to bypass the pending state directly, (c) the Cross-Family Discovery Rate and Unauthorized Connection Attempt Rate metrics (Part 1.1) are both green in CI on every build, and (d) E.4's date-of-birth lock is confirmed shipped first or simultaneously, since E.1's gating is only as strong as the age field it depends on.

**E.2 (parental visibility and audit trail):** Done when (a) the Family panel displays a linked child's current followers, following, and pending connection requests, (b) every follow, unfollow, and block event produces an Audit Log entry readable by the relevant guardian and by staff, verified by a test comparing the raw event stream against Audit Log contents, and (c) the Audit-Log Completeness for Social Events metric (Part 1.2) reports 100% for at least one full release cycle before this item is marked done.

**E.9 (follower/following count removal or de-emphasis):** Done when (a) follower/following counts are either removed from the default public profile view or converted to a private/opt-in display, verified by a direct UI/API check, (b) no surface displays a follower/following count adjacent to or within the same visual block as XP, streak, or badge metrics, verified by a design review against the Comparison-Metric Audit (Part 1.3), and (c) the change has been reviewed against Appendix I Part 4's specific design implication (removing the one comparison-to-others metric while preserving mastery-oriented metrics), not merely shipped as a visual tweak.

---

## Part 3 — Production/QA Pipeline for Profile & Social Changes

This is the answer to "how does a change to discoverability, connection, profile, or account-settings mechanics get built and released without reintroducing an E.1-style gap between an apparent safeguard and an actually-enforced one." Because this domain touches direct child-safety exposure, every stage explicitly separates "does it display correctly" from "does it actually restrict who can reach whom" — the distinction whose absence produced this Block's most severe finding.

**Stage 0 — Scoping & Risk Classification** (Safety/Trust Lead + Engineering Lead, human)
Every change is classified into one of three categories before development starts: **discoverability/safety** (touches who can find, connect to, or message a kid-role or universal-teen account — search, suggestions, connection requests, any future messaging feature), **age-tiering/trust-signal** (touches the kid-role/universal-teen/adult distinction, the Tutor badge, or DOB-dependent gating), or **presentation-only** (copy, visuals, layout with no behavioral change to who can reach whom). Any change classified discoverability/safety is automatically subject to Stage 2 with no exception, regardless of how small it appears — this is the specific lesson of E.1, where the gap was not a large feature but an absent restriction. This role is named consistently as "Safety/Trust Lead" across Blocks C, E, and F as of this revision — it is the same organizational function in each case, not three different roles.

**Stage 1 — Development** (Engineering, human or AI-assisted)
The change is authored. AI-assisted implementation is permitted for all three categories, but every change enters Stage 2 identically regardless of origin.

**Stage 2 — Automated Adversarial Testing** (machine, mandatory for discoverability/safety changes, recommended for others)
A deliberately adversarial test suite exercises the change as an unconnected stranger, an underage self-declared account, or a bypass attempt would: can an unconnected account find, view, or follow a kid-role profile; can a connection request to a kid-role account skip the guardian-approval queue; can a date-of-birth change take effect without guardian re-confirmation; can a future messaging-adjacent feature reach a kid-role or universal-teen account without the required default-off/opt-in gate? A change failing this stage returns to Stage 1 with an itemized failure report identifying exactly which bypass path succeeded.

**Stage 3 — Safety-Research and Regulatory Review** (Safety/Trust Lead, human — mandatory for any change classified age-tiering/trust-signal or discoverability/safety in Stage 0; this review is a distinct function from the Stage 0 scoping decision, even when the same person fills both roles, to avoid a false sense of independent review)
Checks specifically against Appendix I's design implications: does this change respect the two-tier model required by E.8? Does it expose the Tutor badge outside an established connection (E.5)? Does it touch social-graph data in a way that requires an update to the E.11 retention policy? Because Appendix I Part 3 flags the regulatory landscape as actively moving, this stage also includes a lightweight check against whether the change has any plausible COPPA-disclosure or AADC-style default-privacy implication requiring a flag to counsel — not a legal determination, but a routing decision.

**Stage 4 — Comparison-Metric and Tone Review** (automated + human spot-check, mandatory for any change touching profile display or system-generated social-layer copy)
Confirms no new surface reintroduces a public, quantified comparison metric adjacent to gamification elements (E.9), and extends the existing Forge tone gate (established in Block B/D) to any new social-layer copy.

**Stage 5 — Pilot / Family Usability Testing** (Learning Design + Safety/Trust Lead + a small panel of real families, triggered for new mechanics — the guardian-approval queue, the two-tier age model, a redesigned reporting flow — not required for routine fixes)
Mirrors Appendix H's Stage 5: structured observation with real parents and children/teens in the target age band, checking specifically for the failure modes automated testing cannot reliably predict (does the guardian-approval queue actually get checked and used? does a teen on the self-managed tier understand why their defaults differ from an adult's?).

**Stage 6 — Release & Instrumentation** (Engineering)
The change ships with its relevant Part 1 metric already instrumented, as a launch requirement, not a follow-up ticket.

**Stage 7 — Post-Launch Recalibration** (Safety/Trust Lead, on the cadence defined in the Threshold Recalibration Log, Part 1.4)
Real production data feeds back into this Block's thresholds (guardian-approval-queue SLA, report-resolution SLA, age-tier boundary rules). A discoverability/safety change additionally carries a rollback condition: if the Discoverability-Gate Enforcement Verification or Age-Tier Boundary Integrity metrics regress after a release, the change is reverted rather than patched forward under pressure, consistent with the kill-switch discipline already established in Appendix F and H.

---

## Part 4 — Internal Sequencing & Phasing of Block E

This sequences the 13 Block E requirements into build phases with explicit dependencies, mirroring the approach in Appendices C, F, and H. Cross-block sequencing remains deliberately deferred until every block has been audited.

| Phase | Items | Dependency | Rationale |
|---|---|---|---|
| **0 — Age-integrity prerequisite** | E.4 | None | Every subsequent gate in this Block (E.1, E.8) depends on the date-of-birth field being trustworthy; per Appendix I Part 2, an age-tiering scheme built on a self-editable field is theater from day one, so this must ship first, not alongside |
| **1 — Core exposure fix** | E.1, E.2, E.13 | Phase 0 | The single highest-priority fix in this Block: closing the open-discovery/follow graph, giving parents visibility into it, and reviewing profile content for off-platform-locating information are treated as one connected release — an access gate (E.1) and parental visibility (E.2) without a content review (E.13) still leaves an approved or previously-seen profile able to hand a viewer what they need to find the child elsewhere |
| **2 — Accountability layer** | E.3, E.11 | Phase 1 | A reporting path and a retention policy are most meaningful once the connection model they govern (Phase 1) is in place |
| **3 — Trust-signal and age-tiering** | E.5, E.8 | Phase 1 | Both depend on the discoverability/connection architecture from Phase 1 existing to attach to — the Tutor badge's visibility rule and the two-tier model are both extensions of "who is connected to whom" |
| **4 — Comparison-metric and housekeeping** | E.9, E.6 | None hard | Self-contained presentation/product-lifecycle work that does not depend on the connection-model work above |
| **5 — Standing guardrails and governance** | E.10, E.12 | Phase 1 (a documented "no DM" constraint and a brand-narrative statement are most meaningful once the actual connection model they're guarding is fixed) | Governance/documentation items — lower engineering lift, but deliberately not first, since documenting a constraint around a still-open graph would be premature |
| **Flexible, no hard dependency** | E.7 | None | A governance/adoption decision (treat Appendix I as authoritative) rather than a code deliverable — effectively already satisfied by this document series, retained as a tracked item for recalibration purposes |

---

## A note on why this appendix exists

Everything in E.1–E.13 describes what must be true of the Profile and social domain. Without this appendix, a development team would have had to invent its own answer to "how do we know a discoverability restriction we ship actually restricts anything" — precisely the question this Block's own audit findings (E.1, E.2, E.3) show was never asked in the first place. The Enforced-not-just-displayed criterion in Part 2.1 and the adversarial Stage 2 testing in Part 3 exist specifically so that "the Family panel shows a connections list" or "a block button exists" is never again treated as equivalent to "a stranger cannot reach this child" — the exact gap that produced this Block's most serious findings.
