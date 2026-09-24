# Appendix C — Success Metrics, Quality Assurance & Lesson Production Pipeline

**Status:** Authoritative operational framework closing Block B. Appendices A and B answer "what should a lesson contain and why" (the visual/interactive catalog and the pedagogical/psychological research base). This appendix answers the three questions still open after B.1–B.28 and the Pedagogical Design Standard were written: **how do we know it worked, how do we know it's done, and how does a lesson actually get built end-to-end** by a team of developers and AI systems without drifting into ambiguity, rework, or — the specific risk this review was asked to guard against — a system that optimizes for dialogue volume and engagement time instead of genuine learning. Every metric and gate below ties back to a specific requirement (B.x) or research finding (Appendix B §x) so this framework is traceable, not free-floating.

---

## Part 1 — Success Metrics Framework

Three categories, because "success" for this product is not one number: a lesson can be highly engaging and teach nothing, or teach well and be abandoned. Both are failures. Metrics are grouped so no single category can be used alone to declare victory.

### 1.1 Learning Outcome Metrics — does the product actually teach

| Metric | What it measures | Data source | Target | Verifies |
|---|---|---|---|---|
| Delayed Retention Rate | % of learners answering a spaced-repetition review card correctly 30 / 60 / 90 days after first reaching "mastered" on a knowledge component | AI Mentor review-card results, extended to course-driven KCs post-B.6 | Establish release-1 baseline per KC, then require no decline release over release; improvement is the explicit goal, flat is the floor | B.6, Appendix B §1.4 |
| Transfer Task Success Rate | Success rate on a "novel context" application exercise for a KC, compared to success rate on the originally practiced exercise for the same KC | Grading pipeline, tagged exercise metadata (practice vs. transfer) | Gap between practice and transfer success should narrow over time; a persistently wide gap flags rote memorization, not understanding | B.7, B.12 |
| Time-to-Mastery | Median attempts/sessions to reach "mastered" status per KC, segmented by age band | Mastery model event log | **Diagnostic — no fixed target.** Track trend; must be read jointly with the Desirable-Difficulty Success-Rate metric below — a dropping time-to-mastery paired with success rates drifting toward 100% is a red flag (difficulty silently lowered), not a genuine win | B.19, Appendix B §1.7 |
| Desirable-Difficulty Success-Rate Band | Actual observed success rate on practice exercises, per lesson/exercise family | Grading pipeline | 70–85%, per B.19; anything consistently outside this band triggers a difficulty-calibration review | B.19 |
| Judgment-Quality Signal Differentiation | Correlation between the "judgment quality" signal (B.12) and raw correctness | Grading pipeline | The two signals should meaningfully diverge for a non-trivial share of attempts — if judgment quality always tracks correctness 1:1, the signal isn't actually measuring anything distinct, and Law 4 remains unimplemented in practice regardless of what ships | B.12 |
| Real-World Bridge Conversion Rate | % of course-milestone Family Hub prompts (B.13) that result in an actual task/goal created within 7 days | Family Hub event log cross-referenced with course milestone events | **Diagnostic — no fixed target.** Establish baseline; track as a genuine product-health signal, not a vanity metric | B.13 |
| Decision Journal Coverage & Resurfacing Rate | % of meaningful in-story choices that are recorded to the per-learner narrative "decision journal," and of those, % later resurfaced at a relevant subsequent moment in the course | Narrative-state event log | Establish release-1 baseline for both recording and resurfacing rates, then track upward; a low resurfacing rate specifically flags the journal as a data store rather than a genuine narrative-continuity mechanic | B.9 |

### 1.2 Engagement-Health Metrics — distinguishing healthy engagement from manufactured dependency

This category exists specifically to answer the concern that drove this whole appendix: an AI-assisted product can easily optimize, even unintentionally, for time-on-app and dialogue volume rather than effective teaching. These metrics are designed so that number going up is not automatically good.

| Metric | What it measures | Data source | Target | Verifies |
|---|---|---|---|---|
| Session Efficiency Ratio | Time spent in graded/practice interaction ÷ total session time (including navigation, idle Mentor chat, replays) | Client instrumentation | Should hold steady or improve as the product matures; a declining ratio means growth is coming from padding, not learning | Appendix B §2.6 |
| AI Mentor Resolution Efficiency | Median number of conversational turns for the AI Mentor to resolve a stated question or complete a requested demonstration | AI Mentor session logs, tagged by resolution event | Should stay flat or decrease over time; an increasing trend is treated as a regression, not a neutral engagement signal | **B.28** |
| Streak-Anxiety Correlation | Correlation between session restarts/re-opens and streak-at-risk notifications, vs. restarts correlated with natural lesson-completion points | Notification + session logs | Low correlation with anxiety-driven triggers, higher correlation with natural stopping points; a high anxiety-correlation flags the mechanic as loss-aversion-driven rather than habit-supportive | B.21, Appendix B §3.7 |
| Streak-Freeze Utilization Rate | % of learners using the lapse-tolerance mechanism (B.21) instead of losing a full streak | Wallet/streak event log | A healthy, non-zero utilization rate indicates the mechanic functions as designed in practice, not just in the spec | B.21 |
| Dark-Pattern Audit Score | Itemized pass/fail against the Radesky et al. taxonomy (B.25), scored per release | Manual audit (Part 3, Stage 3) | Zero manipulative patterns, matching the PBS KIDS benchmark cited in Appendix B §3.6 | B.25 |
| Variable-Ratio Mechanic Audit Pass Rate | Confirms zero randomized/variable-ratio reward mechanics (e.g., loot-box-style unlocks, randomized reward tiers) exist anywhere in the rewards or badge system for any account flagged as a minor | Manual design/content audit, checked every release (Part 3, Stage 3) | 100% — zero variable-ratio mechanics for minor-flagged accounts, every release | B.22 |
| Reward-Framing Composition Rate | % of reward-delivery moments (currency/XP payouts) that pair the payout with competence-affirming, informational language about what was figured out, vs. presenting it as pure payment for compliance | Content/copy audit of reward-trigger moments, cross-referenced with the reward event log | 100% of audited reward moments using informational framing; any purely transactional instance is flagged for revision | B.20 |
| Autonomy Mechanism Adoption Rate | % of learners, when offered the genuine autonomy mechanism mandated by B.24 (real choice over path/approach/pacing, distinct from avatar customization), who exercise that choice rather than accepting the default | Course-engine choice-event log | Establish release-1 baseline once the mechanism ships; track upward — a persistently low rate signals the mechanism exists on paper but is not functioning as genuine autonomy support in practice | B.24 |
| Parent Time-to-Value | Time for a parent to extract the weekly narrative/insight (B.10) from the Family Hub, self-reported and instrumented | Usability testing + client timing | Under an explicit target (proposed: 3 minutes) — the adult register (B.23) is built on respecting parents' time, and this metric holds the product accountable to that | B.10, B.23 |

### 1.3 QA & Content-Pipeline Metrics — is the machinery itself working

| Metric | What it measures | Data source | Target | Verifies |
|---|---|---|---|---|
| Placement Commit Success Rate | % of placement attempts (adaptive quiz completion, claimed beginner shortcut, or "this feels too advanced" adjuster use) that successfully persist a placement record | Placement-service write logs / mandatory E2E acceptance-test results | 100% — any failure is release-blocking | B.1 |
| Prerequisite Gate Compliance Rate | If enforcement is built: % of course-entry attempts with unmet prerequisites that are correctly blocked or soft-warned per the shipped decision. If the field is instead removed: a one-time Prerequisite Field Removal Confirmation check that the prerequisite field and all references are removed from the data model and documentation. Designed to apply regardless of which of the two mandated outcomes is chosen | Course-entry event logs (if built) / data-model and documentation audit (if removed) | 100% — ongoing compliance if built, or a single passed removal-confirmation checkpoint if removed | B.2 |
| Course Assembly Failure Visibility Rate | % of individual course-assembly failures that generate a visible staff-console operational signal, and — when the failed course was the learner's active/featured course — a visible "we couldn't load this right now" frontend state rather than a silent omission | Staff console alerting logs cross-referenced with course-assembly service logs | 100% | B.3 |
| Forced-Update Trigger Accuracy | % of lesson attempts where unsupported-segment weight exceeds the defined threshold (proposed 30% of total XP weight) that correctly block completion and force a client update, rather than silently producing an unearned passing score | Client-version + segment-support event logs, cross-referenced with lesson-completion events | 100% | B.4 |
| Replay Non-Regression Messaging Display Rate | % of lesson replays scoring below the kept course-level best that display the mandated clarifying copy confirming the saved best score is unaffected | QA scripted-scenario audit + client display-event instrumentation | 100% | B.5 |
| Forge Gate Pass Rate (per gate) | % of authored lessons passing each individual gate on first submission, tracked separately per gate (concept-cap, redundancy, tone, shame-language, interactive-behavior, regional-adaptation, dark-pattern) | Forge pipeline logs | No fixed target — this is a diagnostic metric to find which pedagogical dimension authors (human or AI) most often get wrong, informing authoring guidelines and, if needed, AI-generation prompt/training adjustments | B.14, B.16, B.17, B.18, B.25, B.26 |
| Defect Escape Rate | Count of pedagogical/psychological-design violations found in already-released content that a gate should have caught | Post-release content audit | Trend toward zero; any non-zero count triggers a gate-effectiveness review, not only a content fix — the question is always "why didn't the gate catch this," not just "fix this instance" | All Forge-gated items |
| Age-Band Register Differentiation Audit | Recurring, human-judged review verifying the registers in B.23 remain genuinely distinct as new content accumulates | Scheduled manual audit (quarterly, proposed) | No drift back toward one generic register across age bands | B.23 |
| Mentor-Misjudgment Content Coverage | % of courses containing at least the mandated minimum number of mentor-misjudgment-and-recovery episodes, narrated with the same no-shame framing required for learner mistakes | Content/Forge metadata audit | 100% of courses at or above the mandated minimum | B.11 |
| Placement-Outcome Framing Copy-Compliance Rate | % of placement-outcome screens, across all four placement paths, using the mandated growth-mindset, non-comparative copy rather than unmandated literal-outcome-only language | Manual QA/content audit against the mandated copy standard | 100% | B.15 |
| Real-World Financial-Framing Audit Pass Rate | Count of flagged instances of moralizing language about a family's actual financial circumstances (income level, spending choices, financial stress) in reviewed scenario, lesson, and Family Hub prompt content | Manual content audit — Forge tone/shame gate extension (Part 3, Stage 2/3) | Zero flagged instances per review cycle | B.27 |
| Threshold Recalibration Log | A living record of every numeric threshold in this document (concept-count caps, success-rate band, resolution-efficiency baseline, etc.), when it was last reviewed against real data, and what changed | Maintained document, owned per Part 4 below | Every threshold reviewed at least once per defined cadence (proposed: quarterly for the first year, then per major release) | B.17, B.19, B.28, and the closing note in Appendix B |

---

### 1.4 Teaching-visual metrics (B.7, part 3)

The metrics for the mathematical, logic and money teaching visuals — scorer parity, structure-vs-answer error split, first unaided stage, tap-alternative coverage, locale rendering coverage, scam-task discrimination (d′) and representation A/B results — are defined in `10-APPENDIX-P-TEACHING-VISUALS-MATH-LOGIC-MONEY.md`, Part 8, and are part of this framework. Part 8 of that appendix also adds a teaching-visual Definition of Done on top of section 2.1 below.

## Part 2 — Definition of Done

### 2.1 Generic Definition of Done (applies to every item B.1–B.28)

A requirement is not "done" when code merges. It is done when all four of the following are true:

1. **Functional** — the described behavior is implemented and a test reproducing the exact scenario in the requirement's "Current State" now passes (for defects) or the new capability is exercised end-to-end (for new capability).
2. **Gated** — where the requirement introduces or modifies a Forge/content gate, that gate is live in the pipeline and demonstrably blocks a deliberately non-compliant test lesson built specifically to fail it (a "red-team" content sample, not just a happy-path check).
3. **Measured** — at least one metric from Part 1 is instrumented and reporting real production data tied to this requirement within one release cycle of shipping. A requirement with no corresponding data point one release later is not verifiably done, regardless of code state. Reporting data is necessary but not sufficient: for any metric that is not explicitly marked **"Diagnostic — no fixed target"** in Part 1, the "Measured" criterion is not satisfied until that metric is trending toward its stated target (or, where a metric is already at target, holding there) — a metric that is instrumented, reporting, and stuck flat or moving away from its target does not satisfy this criterion, even though data is flowing. Metrics explicitly marked diagnostic are exempt from the trending-toward-target requirement, since they exist to inform judgment rather than to be hit, but every such metric must carry that explicit label in Part 1 — an unlabeled metric with no real target is a drafting gap in this appendix, not a legitimate exemption.
4. **Reviewed** — the named role responsible under Part 3's pipeline (see Stage 3) has signed off against the specific finding in the requirement, not against a generic "looks good."

### 2.2 Worked examples — the three highest-ambiguity items

These three are singled out because "done" is otherwise easy to misjudge on them:

**B.1 (placement commit):** Done when (a) the schema/logic mismatch is resolved for all four real business states, (b) a mandatory E2E acceptance test — complete quiz → successful commit → placement credit written → course progress updated → badge attainable — passes in CI on every build, and (c) a full regression run produces zero "Could not record placement" errors across all four placement paths.

**B.6 (knowledge-graph unification):** Done when (a) 28 of 28 knowledge components are mapped to at least one course lesson (not 24), (b) "current lesson" in the UI is replaced by a frontier of available next-lessons computed from the shared mastery model, (c) a cross-surface consistency test confirms the AI Mentor and the course engine never disagree about a given learner's mastery state for the same knowledge component, and (d) this only ships after B.1's acceptance test is green.

**B.7 ("Pizarrón"):** Done when (a) all 25 Core-tagged chart/diagram types from Appendix A Part 1 ship with the interactive-behavior gate passing across their full input range (not a single authored state), (b) all 16 interaction primitives from Appendix A Part 2 exist as reusable components, not one-off widgets, (c) all 12 concept-to-technique mappings from Appendix A Part 3 are live in at least one course, and (d) a spot-check confirms Situational types are gated to exactly the course/age scope Appendix A specifies for each — not deployed uniformly "because they were already built."

---

## Part 3 — End-to-End Lesson Production Pipeline

This is the answer to "how do we divide the process of creating a lesson to guarantee end-to-end success." Every stage names who is responsible (human, AI-assisted, or automated) and what "pass" means, so a lesson's status is always a specific, checkable state — never an ambiguous "in progress."

**Stage 0 — Concept & Knowledge-Component Scoping** (Pedagogical Lead, human)
Before any content is drafted, the lesson is scoped against the unified knowledge-component graph (B.6): which KC(s) it teaches, its prerequisite edges, and which misconceptions it must address. A lesson with no clean KC mapping is not authored — the graph is extended first. This prevents orphaned content that cannot be placed, tracked for mastery, or reviewed spaced-repetition later.

**Stage 1 — Authoring** (Content Author — human subject-matter expert, AI-assisted generation, or both)
Drafts narrative, exercises, and interactive-component selection from Appendix A's tagged catalog, within the concept-count ceiling from B.17 and the age-band register assigned in B.23. AI-assisted authoring is explicitly permitted and expected at scale, but output enters Stage 2 exactly like human-authored content — no exemption from any gate based on who or what produced the draft.

**Stage 2 — Automated Forge Gates** (machine, deterministic or judge-assisted; run in this fixed, fail-fast order so cheap checks run before expensive ones)

1. Concept-cap gate (B.17)
2. Redundancy gate — on-screen text vs. narration (B.18)
3. Tone gate — banking/transactional language (B.14)
4. Shame-language gate — self-global feedback language and flagged non-verbal cue patterns (B.26, B.27)
5. Interactive-behavior gate — full input-range verification for any Appendix A component used (B.7)
6. Regional-adaptation gate (B.16)
7. Reward-mechanic structural gate — flags any randomized/variable-ratio reward pattern for review against the B.22 prohibition
8. Existing gates carried over from the current pipeline (age-vocabulary, currency-fact accuracy, arithmetic re-execution) — listed here for completeness so this is the single reference for "everything Forge checks," not a partial list

A lesson failing any gate returns to Stage 1 with an itemized, specific failure report (which gate, which exact content span, why) — never a generic rejection that forces the author to guess.

**Stage 3 — Pedagogical Human Review** (Pedagogical Reviewer, human — a distinct role from Content Author, even when the same person occasionally fills both to avoid a false sense of independent review)
Runs the six checks from the Block B Pedagogical Design Standard (see main document, now including B.28's resolution-efficiency check) — specifically the judgment calls the automated gates structurally cannot make: is the age-band register genuinely appropriate and not just technically compliant (B.23)? Is the autonomy mechanism real, not cosmetic (B.24)? Is the reasoning-quality exercise authentic, not correctness-in-disguise (B.12)? Does mentor content in this lesson show real fallibility where required (B.11)? Produces a pass/fail with named findings — a review that only says "approved" without addressing these specific questions does not count as complete under Part 2's Definition of Done.

**Stage 4 — Pilot / Usability Testing** (Learning Design + a small panel of real target-age-band users; triggered for new lesson formats or new interactive primitives, not required for every routine content release)
The one stage the current product entirely lacks today. Structured observation or think-aloud protocol with real children/teens in the target age band, explicitly checking for comprehension and for frustration/shame reactions the automated gates and adult reviewers cannot reliably predict on their own.

**Stage 5 — Release & Instrumentation** (Engineering)
The lesson ships with the relevant Part 1 metrics already instrumented — metrics are a launch requirement, not a follow-up ticket filed after the fact.

**Stage 6 — Post-Launch Recalibration** (Pedagogical Lead, on the cadence defined in the Threshold Recalibration Log, Part 1.3)
Real production data from Stage 5 feeds back into adjusting the numeric thresholds proposed throughout this document (concept caps, success-rate band, resolution-efficiency baseline) and into the recurring Age-Band Register Differentiation Audit. This closes the loop this document is explicit about needing: every threshold here is a research-grounded starting point, not a permanent constant.

---

## Part 4 — Internal Sequencing & Phasing of Block B

This sequences the 28 Block B requirements and Appendix A into build phases with explicit dependencies, so the development team has an order to work in rather than 28 equally-weighted backlog tickets. Cross-block sequencing (against Blocks A, C, D...) is deliberately deferred until every block has been audited — sequencing across the whole product now, before the remaining blocks are even reviewed, would be premature.

| Phase | Items | Dependency | Rationale |
|---|---|---|---|
| **0 — Release-blocking foundation** | B.1 | None | Nothing downstream (credits, badges, growth loop, B.6) can be trusted while this is broken |
| **1 — Architectural unification** | B.6 | B.1 | The single largest architectural decision in Block B; every adaptive-progression and mastery-dependent item downstream assumes this exists |
| **2 — Flagship capability** | B.7, B.8, Appendix A component build | B.6 (for full mastery-driven value); the component library itself can begin in parallel | This is the product's stated differentiation; sequencing it early protects the timeline for the feature most tied to the brand's core claim |
| **3 — Narrative & real-world bridging** | B.9, B.10, B.11, B.13 | B.8 (shared character/animation infrastructure) | These extend the same presentation-layer investment made in Phase 2 |
| **4 — Grading & brand-tone integrity** | B.12, B.14, B.15, B.16 | None hard; benefits from B.6's mastery signal for B.12 | Lower architectural risk, high brand-consistency value; can run in parallel with Phase 3 |
| **5 — Cognitive/pedagogical gates** | B.17, B.18, B.19 | None hard, but most valuable once Stage 2 of the pipeline (Part 3) exists to enforce them | Mechanical, well-specified, and largely independent of the bigger architectural bets |
| **6 — Motivational & ethical architecture** | B.20, B.21, B.22, B.23, B.24 | B.23 benefits from B.8's character/presentation system | Governs how the whole reward and identity system behaves once the content and architecture above exist |
| **7 — Governance & audit layer** | B.25, B.26, B.27, B.28 | Benefits from having real content and real AI Mentor usage data to audit (Phases 2–6) | These are recurring audits and standing principles more than one-time builds — they should be operating processes by the time meaningful content volume exists |
| **Flexible, no hard dependency** | B.2, B.3, B.4, B.5 | None | Small, self-contained fixes; slot into any phase opportunistically based on engineering capacity |

---

## A note on why this appendix exists

Everything in B.1–B.28 describes *what* must be true of the product. Without this appendix, a development team — human or AI-assisted — would have had to invent its own answer to "how do we know when this is done" and "what order do we build this in," almost certainly under time pressure, almost certainly inconsistently across teams, and with no defined way to catch the specific failure mode this review was asked to guard against: a system that quietly optimizes for engagement volume because no one ever wrote down a competing metric for engagement *efficiency*. That is now written down, in Part 1.2 and in B.28, precisely so it cannot be an oversight later.
