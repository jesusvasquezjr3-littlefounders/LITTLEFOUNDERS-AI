# Independent Adversarial Audit — Findings on the Gold-Standard Requirements Document Set

> **Historical record (21 September 2026).** This self-audit was run on an earlier version of the Product package. All of its findings have been applied to `../10-PRODUCT-GOLD-STANDARD-REQUIREMENTS.md` and its appendices. It is kept for traceability. Do not implement from this file: where it differs from `../13-OWNER-DECISION-LOG.md` or `../10-*`, those win.

**Status:** This is a self-audit of the work produced this session (`10-PRODUCT-GOLD-STANDARD-REQUIREMENTS.md` and its 12 appendices), commissioned explicitly to find inconsistencies, missing information, ambiguity, missing metrics, and lack of specificity — without bias and without going easy on the prior work. It was executed by three independent subagents with no prior investment in the audited document (one per axis: structural/brand-citation integrity; metrics/DoD/pipeline completeness; specificity/duplicates/contradictions), plus a direct fact-verification pass by the authoring session against primary sources for the hardest empirical/legal claims. Every finding below was independently confirmed by re-reading the actual current files — nothing here is carried over from memory or assumption.

**How to read this:** findings are organized under the five categories the audit was commissioned to check. Several findings touch more than one category; they are placed under their primary category and cross-referenced. Severity is assessed by this audit, not inherited from the source document's own severity labels.

---

## 0. What was verified and held up (stated first, so the rest of this document isn't read as uniformly negative)

- All hard factual claims independently checked against primary sources came back accurate: the Musical.ly $5.7M COPPA settlement (2019), the FTC v. Epic Games $520M total / $275M COPPA settlement (Dec. 2022), the FTC/YouTube $170M COPPA settlement (2019), Thorn's 2022 grooming statistics (65% platform-migration invitation, 40% approached, 47% of teen girls — verified against Thorn's own press materials, exact wording), Orben & Przybylski's 2019 *Nature Human Behaviour* finding that technology use explains at most ~0.4% of adolescent wellbeing variance, Discord's February 2026 global "teen-by-default" rollout, and Roblox's April 2026 state settlements (Alabama $12.2M confirmed exactly; West Virginia and Nevada figures are consistent with reported multistate totals). No fabricated statistic or citation was found among those checked.
- The phasing/sequencing tables in Appendices C, F, H, J, and L (covering Blocks B, C, D, E, F) are internally clean: every item in those five blocks appears in exactly one phase, with no orphans or duplicates, and every stated cross-phase dependency points to an item actually assigned to an earlier phase.
- Where a Definition of Done exists, its four-part structure (Functional / Enforced-not-displayed / Measured / Reviewed) is a genuinely well-built, falsifiable framework, and several worked examples (B.1, B.6, B.7, C.9, C.15, D.1, E.1, E.2, F.1) specify real pass/fail tests rather than aspirations.
- Several numeric thresholds in the document are correctly flagged as proposals requiring validation, not settled facts (B.4's 30% XP weight, B.17's 6–12yr tier numbers, E.3's "3 reports / 30 days," F.2's "30–90 day" expiration window). This matters because it proves the authors knew the correct practice — which makes the places that skip it (Category 5, below) clear omissions rather than a misunderstanding of the standard.

---

## 1. Incongruencias (Inconsistencies / Contradictions)

### 1.1 — [CRITICAL] The document's own headline totals are wrong, and this was independently found by two of the three audit agents plus the arithmetic re-check
The closing "Document Status" section states **111 total requirement items** and **39 High-severity items**. Independently recounting every `### X.N` heading and severity label in the live file gives:
- **Block C is undercounted.** The cross-block table states Block C = 22 items / 11 High. Block C actually runs C.1–C.24 (24 distinct IDs; 23 distinct tracked rows once C.8/C.12 are merged, which the document's own Block C summary table already does). Recounting severities directly from Block C's own table gives 6 Critical / 12 High / 4 Medium-High / 1 Medium = 23, not 22/11.
- Block C's own References line and Appendix F's Part 4 header both independently state "**24** Block C requirements" — the document contradicts its own headline count with its own supporting text, in two places.
- **Corrected totals: 112–113 items total (not 111), 41 High-severity items (not 39).** Every other block's row (A, B, D, E, F, G, H) matches an independent recount exactly.
- This is a self-audit document whose entire methodology is built on catching declared-but-unverified states and unreconciled claims — getting its own top-line item count wrong is a direct hit against that stated standard.

### 1.2 — [CRITICAL] The two "cross-block pattern" synthesis paragraphs — the document's own candidate for its most important takeaways — both miscount the very patterns they name
- The "kid role ≠ minor" synthesis claims the pattern "recurs, independently discovered, in **five** separate domains," then names only **four** (A.3/A.4, D.3, E.8, H.1). It omits **Block C**, which is actually the most extensively developed instance of this exact pattern: C.2, C.3, and C.4 each explicitly describe themselves, in their own text, as "the same 'kid role ≠ real minor' fracture identified at the account level in Block A." A synthesis paragraph built to demonstrate the document's own rigor undercounts its strongest evidence.
- The "cosmetic control" synthesis (D.1's card freeze, G.1's staff permissions) claims this pattern was "found independently in **three** unrelated domains," then names only **two** (D and G). No third domain is ever identified anywhere in the document.

### 1.3 — [HIGH] The Law/Pillar brand-citation system has a real, verifiable error, confirmed independently by a fresh reviewer
`COSMIC_NARRATIVE.md` has two structurally different lists: five numbered "Communication Laws" and six *unnumbered* "Authority" bullets under "The Guide." The document invents an informal "Pillar N" numbering for the second list (used in 17 separate Brand Alignment citations: A.2–A.5, B.25, C.2–C.4, D.1, D.4, E.1, E.3, E.5, E.13, F.1, F.6, G.6) and, in at least one place, presents an invented phrase as a direct quote: **A.1's Finding text cites `Pillar 5 ('Verified parental control')`** — that exact phrase does not appear anywhere in `COSMIC_NARRATIVE.md`; it is the document's own paraphrase dressed as a quotation.
Separately, and more concretely: **D.3, D.10, and D.19 each quote text that is verbatim from Pillar 1** ("we teach judgment, not transactions"; "living with the consequences") **but attribute it to "Law 1."** Law 1 is actually about a different thing entirely — parent-facing active-verb copy ("the parent is the hero, we are the guide"). This is not an interpretive stretch; two of the three instances (D.3, D.19) place Pillar 1's exact wording in quotation marks and then cite the wrong numbered Law. D.17 and E.8 show a softer version of the same confusion (paraphrase rather than verbatim misquote).

### 1.4 — [MEDIUM] A cross-reference to Appendix B is wrong, and the error was copied into a second document rather than independently checked
Item E.9 and Appendix I §4.4 both cite "`Appendix B §2.3`" for a finding about peer-visible leaderboards being risk-amplifying for the 13–17 age band. Appendix B §2.3 is actually about Erikson's psychosocial stages and says nothing about leaderboards; the cited language is verbatim from **§2.2**, and the specific "no peer-visible risk leaderboards" recommendation is in the age-band synthesis table at **§2.9**. That the identical wrong section number appears in both the main document and a separately-written appendix suggests the citation was copied forward rather than checked against the source in either place.

### 1.5 — [MEDIUM] Appendix C's Definition-of-Done for the document's own "flagship" item miscounts its own source by 39%
Appendix C states B.7 is done when "all **18** Core-tagged chart/diagram types from Appendix A Part 1 ship." An actual count of Core-tagged rows in Appendix A Part 1 gives **25**, not 18. This is the acceptance criterion for the item the document repeatedly calls the product's "signature" capability.

### 1.6 — [MEDIUM] The document's "non-negotiable, not a suggestion" framing is contradicted by a real subset of its own "Mandated Requirements"
Line 3 of the main document states requirements "must be treated as the specification for engineering work, not a suggestion." At least seven items (B.11, B.16, D.13, D.19, D.22, G.4, F.1) use "consider," "evaluate whether," or specify no deliverable/owner/threshold at all inside a field labeled "Mandated Requirement" — see Category 3 and Category 5 for the full list. A document cannot be simultaneously non-negotiable and contain mandates whose operative verb is "consider."

### 1.7 — [MEDIUM] Appendix E's own governance principle is not applied to the single place in Block C where it matters most
Appendix E's central, repeated claim is that "in every credible source, a human explicitly approves before a change reaches real users," and its Tier 1 ("never automate") explicitly covers changes to a safety-judge reaching a child-facing product. C.5/C.6 describe an AI judge that autonomously approves individual pieces of **live-generated content before a child sees it**, with only a post-hoc staff sample — structurally the exact pattern Appendix E's model exists to prevent — and C.5/C.6 are never explicitly assigned a tier under the Tier 1/2/3 model that C.22 itself mandates be adopted "before any automated proposal-generation capability is built."

### 1.8 — [LOW-MEDIUM] Role-name drift between appendices, unreconciled
"Safety Reviewer" (used exclusively in Appendix F / Block C, the AI Mentor — arguably the single highest real-time child-safety-stakes domain) and "Safety/Trust Lead" (used exclusively in Appendices J and L / Blocks E and F) are never stated to be the same role or different ones. Relatedly, Appendices H and J (Blocks D, E) never introduce an independent second-reviewer safeguard, even though Appendices C and F (Blocks B, C) explicitly warn, in their own text, against "a false sense of independent review" when the same person scopes and reviews a change — the warning both blocks state for themselves is silently absent from two other blocks with materially similar risk profiles.

### 1.9 — [LOW-MEDIUM] Duplicate or overlapping item IDs, inflating the item count and diluting traceability
- **C.8 and C.12 are a literal duplicate.** C.12's own "Current State" and "Finding" fields read only "See C.8" — there is no independent content. The Block C summary table already merges them into one display row, which is itself part of why the cross-block total in Finding 1.1 doesn't reconcile.
- **C.7** (persistent learner-disposition profile) is never mentioned in the main document's own "three new components" synthesis of the AI Mentor architecture, despite being a separately-numbered, High-severity architectural item.
- **B.21 and D.2** track the identical streak-arithmetic defect across two blocks — D.2's own text acknowledges this ("not a new design problem... the same fix already specified for Block B").
- **D.11 and D.12** substantially overlap; D.12's mandate explicitly subsumes D.11's specific case.
- A "bypass path skips the same gate the primary interface enforces" pattern recurs at least four times (D.1/D.4/D.7, G.2) but, unlike the "kid role ≠ minor" pattern, is never named as its own cross-cutting architectural risk.

---

## 2. Información faltante (Missing information)

### 2.1 — [CRITICAL] Blocks A, G, and H — 19 items total — have no success metrics, no Definition of Done, and no phasing/sequencing anywhere in the document set
This contradicts the working assumption (stated in this session's own prior "Document Status" section) that this material was "formalized directly inline" for these three blocks. A full re-check of the Block A, G, and H sections, plus a grep for "Phase," "Definition of Done," and "Metrics" across the entire file, finds only the three-column "Summary of Mandated Changes" tables (ID / Finding / Severity / Owner decision needed) — no build order, no dependency logic, no acceptance test, no target metric. This includes multiple Critical-severity items the document elsewhere holds up as its clearest examples of a systemic engineering-discipline gap (A.2, A.3, **G.1**, which the document's own text calls "the staff-console equivalent of D.1's cosmetic card freeze") — none of which has a single falsifiable way to confirm it is actually fixed.

### 2.2 — [HIGH] 44 of 111 items (~40%) have no traceable success metric and no stated justification for the absence
Breakdown: all 6 of Block A, 10 (strict) + 2 (weak-only, covered by a generic catch-all metric) of Block B, 9 of Block C, 4 of Block D, all 6 of Block G, all 7 of Block H. **Only two items in the entire document (D.9, E.7) carry an explicit, stated justification for having no metric** — everywhere else listed above, the absence is simply unaddressed. Notable specific cases:
- **B.1**, the item the document itself calls "release-blocking" and "the entry point to the entire learning pillar," has no metric anywhere — only a DoD acceptance test.
- **C.21** (the item that mandates building the Mentor's own evaluation-and-improvement loop) and **C.24** (a monitoring dashboard) have no metric verifying their own completion or use — the measurement infrastructure has no measurement of itself.
- **D.2** repeats the exact metric gap Appendix C already solved for the identical mechanic in Block B (Streak-Freeze Utilization Rate has no D.2 analog), despite D.2's own premise being "this is the same fix, just missed for a second entity."

### 2.3 — [HIGH] The single most safety-critical automated mechanism in the document — the AI Mentor kill-switch — never defines an actual threshold, anywhere, even provisionally
Appendix F's kill-switch table (governing automatic rollback of real-time, child-facing AI components) uses the placeholder phrasing "drops below **a defined floor**," "exceeds **a defined ceiling**," "over **a defined sample**" — a pattern that recurs 13 times across the appendix set (7 of them in Appendix F alone) without a single instance ever being resolved to an actual number, not even a flagged provisional one of the kind the document uses correctly elsewhere (see §0 and Category 5).

### 2.4 — [MEDIUM] Two items are silently excluded from the literal scope statement of their own block's Definition of Done
Appendix H states its Generic DoD "applies to every item D.1–D.22" — Block D actually runs to **D.23**, which has no DoD anywhere in the document (compounding Finding 2.2, since D.23 also has no metric). Appendix J states its Generic DoD "applies to every item E.1–E.12" — Block E runs to **E.13**, the item requiring a content-level safety review to prevent a child's off-platform location from being exposed, arguably one of the higher-stakes items in the document, which falls outside its own block's stated DoD scope.

---

## 3. Ambigüedad / abierto a interpretación (Ambiguity / open to interpretation)

### 3.1 — [HIGH] The "Measured" Definition-of-Done criterion never requires a metric to actually clear a target
As written in every metrics appendix, "Measured" only requires a metric to be "instrumented and reporting real production data" — not to show the feature performing acceptably. Combined with a large number of metrics explicitly marked "Diagnostic — no fixed target" (Forge Gate Pass Rate, Self-Explanation Quality-Check Pass Rate, Simulated-Student Pass Rate, Chore-Tag Adoption Rate, Split-Ratio Engagement Quality, among others), an item can be formally "done" under this framework while the underlying metric shows the feature performing badly, as long as data is flowing at all. This is a structural gap in the DoD standard itself, not an isolated wording slip in one item.

### 3.2 — [MEDIUM] The one human-judgment review gate in the lesson pipeline has no rubric
Appendix C, Stage 3 (Pedagogical Human Review) asks a reviewer to judge whether "the age-band register [is] genuinely appropriate and not just technically compliant" and whether "the autonomy mechanism [is] real, not cosmetic" — with no scoring rubric, no example of a pass vs. a fail, and no threshold. This is one of only two human-review gates in the entire content pipeline.

### 3.3 — [MEDIUM] Item F.1 (Critical severity) leaves its own central decision unowned
F.1's Mandated Requirement is to "evaluate whether a downloadable/shareable image... satisfies the actual use case" versus keeping the current page architecture — this is the single Critical-severity item in Block F, and unlike A.1's structurally similar decision (which has an explicit priority order and named fallback), F.1's core architecture choice has no named decision-owner and no deadline.

### 3.4 — [MEDIUM] Several other items mandate an outcome without specifying what would satisfy it
D.19 ("design an explicit, age-gated transition path for older teens... a multi-year product initiative") and D.22 ("design a long-horizon, privacy-respecting research instrumentation plan") each carry High severity but no scope, deliverable, owner, or milestone. G.4 ("add a periodic access-review cadence") never states a cadence. H.1 ("a teen-facing, self-managed analytics disclosure/opt-out") never specifies what the disclosure contains or what the opt-out actually restricts. D.23 ("periodic, unobtrusive parent-facing tips") specifies neither cadence nor content.

### 3.5 — [LOW-MEDIUM] B.17's teen/adult tier is internally self-contradictory
The item promises "a higher but still explicit ceiling for teens/adults" while stating no number for that tier at all — the sentence claims explicitness while providing none (contrast with the 6–9 and 10–12 tiers in the same item, which do get numbers).

---

## 4. Bloques con métricas faltantes (Blocks with missing metrics)

This is a direct rollup of Category 2, presented by block for planning purposes:

| Block | Metrics status |
|---|---|
| **A** | No metrics framework exists at all (6/6 items unmeasured) |
| **B** | 10 items with no metric at all; 2 more covered only by a generic catch-all, not a dedicated metric (12/28 affected) |
| **C** | 9 items with no metric, including the two items (C.21, C.24) that are themselves supposed to build the measurement/monitoring infrastructure |
| **D** | 4 items with no metric, including D.23 (also missing from DoD scope) |
| **E** | Fully covered — the most rigorously instrumented block in the document (only E.7, explicitly justified, has none) |
| **F** | Fully covered |
| **G** | No metrics framework exists at all (6/6 items unmeasured) |
| **H** | No metrics framework exists at all (7/7 items unmeasured) |

**44 of 111 (or 112–113, see Finding 1.1) items — roughly 40% of the entire document — have no way to verify they were actually fixed**, beyond a one-time DoD check at ship time.

---

## 5. Falta de especificidad (Lack of specificity)

### 5.1 — [HIGH] Numeric thresholds presented as settled that are exactly as invented as the ones the document correctly flags as proposals
The document knows how to do this correctly (see §0: B.4, B.17, E.3, F.2 are all properly flagged as proposals needing validation). Two thresholds are not:
- **C.10**: "a minimum of two consecutive observations... before the pedagogy controller autonomously executes either of its two most consequential moves." Nothing in the cited source (Appendix D §2.6) derives "two" from data; it is presented as settled, and the metric built around it (Corroborating-Evidence Compliance Rate) sets a hard **100%** target — an odd thing to build a zero-tolerance metric around for a number the document treats as arbitrary everywhere else.
- **D.11**: the replacement for an arbitrary percentage-based savings bonus is a new "10 coins saved → 1 bonus coin" ratio, offered as *the fix* for the previous number's arbitrariness while being just as arbitrary itself, and never flagged as a proposal or tied to a recalibration-log entry the way the age-band cutoffs around it are.
- Lower-priority: **B.19**'s "70–85% success-rate band" is applied as a firm operational target despite Appendix B's own caveat, in the same document, that "the exact optimal percentage varies by task type, age, and the learner's current... state."

### 5.2 — [MEDIUM] Several "Mandated Requirements" specify no concrete deliverable at all
Beyond the ambiguity noted in Category 3, these items are non-actionable as written for an engineering team to scope: **B.11** ("a minimum proportion of story content" — no proportion given, no process to set one, no gate), **B.16** ("add a regional-adaptation layer... beyond translation" — no deliverable, no gate spec, no owner), **B.20** ("audit and reframe reward delivery" — no acceptance criterion, unlike sibling items B.21/B.22/B.26 in the same cluster which do specify a mechanism), **B.7**'s reliance on subjective, untested adjectives ("simplest possible," "guided rather than open-ended") as a binding design standard for a 30-item, Critical-severity component library.

### 5.3 — [LOW] An internal citation-format collision
B.7 cites a "(D4)" convention referring to the *original source audit's* flow numbering — not this document's own Block D item numbering (which uses "D.4," with a period). Both concern the same general topic (server-side score/state trust), which compounds the risk that a future reader treats "(D4)" as a cross-reference to this document's own D.4, when it is not. The document never explains this citation convention anywhere.

---

## Ranked summary of the single most severe issues

1. **The document's own headline totals are wrong** (111 vs. 112–113 items; 39 vs. 41 High-severity), independently discovered by two separate audit passes, and directly contradicted by the document's own Appendix F and Block C References text (§1.1).
2. **Three full blocks — A, G, H, 19 items including multiple Critical items — have no metrics, no DoD, and no phasing anywhere**, despite the document's own framing implying this material existed inline for them (§2.1).
3. **The 17-instance invented "Pillar N" citation convention, including one fabricated quotation ("Verified parental control") attributed to the brand document**, plus three confirmed and two probable Law/Pillar mislabelings (D.3, D.10, D.19; D.17, E.8) (§1.3).
4. **44/111 items (~40%) have no traceable success metric**, including the document's own self-described "release-blocking" top item (B.1) and the two items whose entire job is to build the measurement infrastructure the rest of the framework depends on (C.21, C.24) (§2.2).
5. **The document's two highest-level "cross-block pattern" synthesis paragraphs each undercount the pattern they name** — "five domains" naming four and omitting the pattern's most developed instance (Block C); "three domains" naming two (§1.2).
6. **The AI Mentor kill-switch — the automatic safety rollback for real-time child-facing AI — never resolves a single trigger threshold to an actual number**, even provisionally, in 13 separate instances (§2.3).
7. **A structural DoD gap**: "Measured" only requires data to flow, not to clear any target, so an item can be formally "done" while its own metric shows it performing badly (§3.1).

---

## A note on methodology and honesty

This audit used three subagents with no prior involvement in authoring the reviewed document, each assigned a distinct axis and instructed explicitly to be adversarial and to avoid padding with praise, plus a direct verification pass by the authoring session against primary sources (FTC press releases, Thorn's own report, peer-reviewed citation metadata) for the hardest factual claims in Appendices I and K. All three subagents independently converged on the same headline-arithmetic error (Finding 1.1) and the same Law/Pillar citation problem (Finding 1.3) without being told about each other's findings — that convergence is the strongest evidence this audit's findings are real defects, not artifacts of one reviewer's particular reading. Nothing in this document should be read as invalidating the underlying research or requirements; the substantive content — the research appendices' factual claims, the core architecture findings (D.1, G.1, the kid-role pattern) — held up. What did not fully hold up is the document's own internal bookkeeping: its arithmetic, its citation precision, and, in roughly 40% of its 111+ items, its own promised traceability from requirement to metric.
