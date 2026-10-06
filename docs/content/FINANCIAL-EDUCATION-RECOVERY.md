# Financial Education recovery — 5 October 2026

Status: owner-rejected catalog withdrawn from publication; replacement design and initial authoring in progress. No pedagogical acceptance or replacement release is claimed. All new writing is authored directly by the coding agent; deterministic emitters and validators remain useful, without model, image or voice calls.

Current implementation: the [shared workflow](COURSE-AUTHORING-WORKFLOW.md) and [checkpoint](../rebuild/sprints/S05-FINANCIAL-EDUCATION-RECOVERY.md) supersede the initial route proposal and three-pilot scope below. The authored reference now contains 36 lessons, 27 draft skills and 216 distinct graded exercises in three locales. The personal-ledger limitation below has a local implementation fix; Core and frontend deployment remain pending. Historical diagnosis is preserved, not presented as the current implementation state.

## Evidence, not a generator swap

The live read on 5 October found one published course, 112 published lessons and 336 immutable localized versions. The current adult opener is `fe-adult-01-read-the-payslip`. Its brief combines gross/net pay, withholdings, percentages and hourly pay. The adult opening chapter declares seven external prerequisites, including fractions and needs/wants. An adult beginner is not thereby a financial expert. Payroll is a useful later application, not the default entry point for someone starting from zero.

The superseded production checkpoint explicitly says the earlier catalog was authored agentically without paid Forge model calls. Replacing Forge with Codex or Claude therefore does not resolve its instructional failure. The problem spans sequencing, authoring, acceptance criteria and limitations of the player.

A deterministic audit of the 112 committed canonical plans found 283 single-key `reasoning.decide-justify.v2` exercises. In 242 (85.5%), the accepted choice is first. In 56 lessons, at least three such exercises all accept the first choice. The current board preserves authored option order. This audit covers key positions in the source plans, not a semantic review of every live localized document. Evidence: local `audit-results/financial-recovery/rejected-catalog-audit.json`.

Confirmed code-level limitations:

- `coursegen/src/v2/lessonDesign.ts` validates role order and ratios; it cannot establish that an example explains the criterion later assessed. Its six-concept adult ceiling is a maximum, not a recommendation to introduce six concepts.
- `backend/src/services/v2VisualScorer.ts` passes `reasoning.decide-justify.v2` on the choice alone. Reason quality is separate. Feedback must not claim both were mastered.
- `math.worked-example.v2` is a graded scaffold, not a general ungraded visual demonstration. Public expressions can reveal earlier answers. A transfer with the method still supplied is not an independent transfer.
- The existing running-ledger board is a sales/cost sandbox. It is not a neutral personal cashbook; substituting a wage or rent for sales/costs changes the meaning of its controls.
- Minimum-saving and goal-band graders cannot enforce an exact personal budget. The math must match the actual interaction and scorer.
- The adult pathway rejects `math.bar-model.*` and the basic number-line kinds. This follows the current Appendix P age scope, rather than a rendering failure. The initial adult pilot uses the supported comparison chart with visible inputs and a preceding visual example; it does not bypass age policy. Opening foundational manipulatives to adult beginners would be a separately recorded specification change.
- Existing browser fixture coverage demonstrates rendering and controls, not that this catalog is coherent. Core solvability demonstrates an accepted response exists, not that the learner has been taught how to find it.
- The actual `ChartBoard` rendered `AnswerChoice` with the primary-field white foreground on a white control strip. The first real-player screenshots showed invisible answers even though scripted clicks and grading succeeded. The local fix scopes neutral-surface and selection tokens to chart answers; screenshots and computed contrast cover initial, selected and graded states. This also exposes a verification gap: text-fit, proportions and copy counts alone did not report the invisible choices.

The historical pilot report already lists copying answers, weak feedback and unsupported prerequisites as open concerns. These are release risks, not grounds to lower a gate or approve another bulk run.

## Research and its limits

Sources consulted on 5 October 2026:

1. [CFPB, effective financial education](https://www.consumerfinance.gov/archive/blog/effective-financial-education-five-principles-and-how-use-them/): understand the audience, provide actionable and relevant information, develop decision skills, build motivation and make follow-through easier. We use this to focus lessons on useful decisions. It does not prescribe our lesson counts.
2. [FDIC, Money Smart for Adults](https://www.fdic.gov/consumer-resource-center/money-smart-adults): coverage includes income/expenses, spending/saving plans, saving, credit and debt. We use its coverage as a cross-check, not a copied lesson sequence or US rules for other markets.
3. [OECD/EU adult financial competence framework](https://www.oecd.org/en/publications/financial-competence-framework-for-adults-in-the-european-union_510f133c-en.html): a competence inventory across transactions, planning, risk/reward and the financial landscape. It is not a ready-made sequence for Mexican beginners.
4. [CONDUSEF, budget education](https://webappsos.condusef.gob.mx/EducaTuCartera/presupuesto.html): record income and expenses over a defined period. Use this as the Mexican foundation, with fictional example amounts distinguished from current market prices.
5. [IES, Organizing Instruction and Study](https://ies.ed.gov/ncee/wwc/PracticeGuide/1): interleave worked examples and practice; connect concrete and abstract representations; space retrieval. Applying this to our financial micro-lessons is a design inference, not proof that our product improves outcomes.

## Replacement teaching contract

One observable objective per lesson; one primary new financial idea. The prerequisites are explicitly taught earlier or checked with a non-punitive route to support. Worked example → guided completion → independent practice → new-context transfer. A wrong answer gets an explanation related to the decision and a useful next action. Later lessons retrieve earlier skills without reteaching every definition.

Target 3–5 minutes and 6–10 short exercises where this serves the objective. Measure duration; do not label a fifteen-step reading chain as four minutes by declaration. Four distinct exercise types are not a requirement: switching controls can compete with learning. Use scenario decisions, visual quantities, purposeful sorting and simulators when they express the idea better than text.

Design for low prior knowledge, varied reading fluency and attention. Use respectful adult situations for adults. No IQ labels, baby talk, assumed salary, assumed bank account or inference that financial hardship is a moral failure. A phone or internet connection can be essential given the situation; needs/wants cannot be graded from an item name alone. A 50/30/20 split is a later optional example, not a universal requirement or the foundation of budgeting.

## Proposed adult course sequence

Each row is one micro-lesson. This is a curriculum blueprint, not a claim that all rows have authored playable content. Release in coherent units only after the opening unit has passed real-player and novice review.

| Unit | Lesson and measurable outcome | Prerequisite | Appropriate engine evidence |
|---|---|---|---|
| 1. See your money | 01. Distinguish money received from money paid | None | Classify contextual transactions |
| 1 | 02. Distinguish a promised payment from money available now | 01 | Timeline scenario choice |
| 1 | 03. Subtract already committed expenses before a new purchase | 01–02; supported subtraction | Comparison chart and fresh purchase scenario |
| 1 | 04. Record a missed small expense and update the remainder | 03 | Personal cashbook; requires a neutral ledger |
| 2. Choose with limits | 05. Prioritize an essential expense using its stated consequence | 03 | Contextual scenario with defensible alternatives |
| 2 | 06. Identify what must be postponed when funds are insufficient | 05 | Trade-off with consequences |
| 2 | 07. Compare one week of income with one week of expenses | 04 | Matched-period cashbook |
| 2 | 08. Change one flexible expense to balance a short plan | 06–07 | Exact constrained budget; audit scorer |
| 3. Build a buffer | 09. Separate savings for a named goal from spending money | 03 | Visual parts of a total |
| 3 | 10. Find the amount still needed for a goal | 09 | Bar difference, then fresh goal |
| 3 | 11. Find how repeated affordable contributions reach a goal | 10; repeated addition | Savings-line exploration and hidden-answer transfer |
| 3 | 12. Distinguish predictable bills from unexpected urgent costs | 05, 09 | Scenario sorting with reasons reviewed |
| 4. Use money safely | 13. Compare the total cost of two offers | 03; supported addition | Price components and total comparison |
| 4 | 14. Recognize a recurring charge and decide whether to keep it | 07, 13 | Period-aligned repeated costs |
| 4 | 15. Pause and verify a suspicious request through a trusted channel | None beyond basic reading | Messages with specific evidence; no shame |
| 4 | 16. Compare payment methods using stated fees and protections | 13, 15 | Localized evidence table; dated sources |
| 5. Understand borrowing | 17. Distinguish borrowed money from income earned | 01, 07 | Inflow now plus future obligation |
| 5 | 18. Compute total repayment from principal plus stated charges | 13, 17 | Explicit simple amounts before rates |
| 5 | 19. Predict how payment size changes a simulated debt path | 18 | Debt simulator with transparent assumptions |
| 5 | 20. Check whether repayment fits an uncertain-income plan | 02, 08, 19 | Cash timing and buffer; no product advice |
| 6. Think longer term | 21. Explain purchasing power using the same basket at two prices | 13 | Basket comparison; fictional price changes |
| 6 | 22. Distinguish saving certainty from investment risk | 12, 21 | Loss scenarios, no return promise |
| 6 | 23. Explain compound growth using two explicit periods | 11; supported percentages | Stepwise model, assumptions and downside |
| 6 | 24. Compare diversified and concentrated exposure to one shock | 22–23 | Risk allocation scenario, no product selection |

Payroll, tax withholding and hourly pay become optional later applications. Legal content needs separate market research. Percentage instruction precedes percentage budgeting or rates. Repetition scheduling uses the existing shared knowledge model; do not create another mastery system or activate new KCs implicitly.

The previous production checkpoint excluded borrowing and investing from this course. The latest request supplied them as candidate coverage. Units 5–6 above are therefore a proposed course-boundary revision, not an implemented or approved expansion; they may instead lead into separate debt/investing courses. The first recovery unit changes none of those boundaries.

For ages 6–9, start with what money exchanges, concrete counting, limited choices and waiting for a goal. For 10–12, use small purchases, change, saving and safe messages. For 13–17, use variable income, subscriptions, savings and digital payment safety. These are separately authored pathways, not adult lessons with smaller numbers. They remain planned until authored and reviewed.

## Release workflow and stop rules

1. Author a unit storyboard and per-exercise answer rationale directly with the agent.
2. Audit the required engine interaction and grader before writing its JSON.
3. Compile and validate without model calls, then independently recompute numeric keys. Keep review findings visible.
4. Walk through the actual complete lesson: correct, incorrect, help, retry and transfer on mobile and desktop. Capture what the learner can see, not just the schema.
5. Review money wording per market and have a novice explain the unseen transfer in their own words. Treat this as acceptance evidence; a passing agent self-review is not a substitute.
6. Only then expand the remaining units and use the existing reviewed publication path. Do not emergency-activate this catalog or copy old release signatures.

Priority engine work: neutral personal cashbook; ungraded visual demonstrations; feedback conditioned on the actual mistake; explicit treatment of a wrong justification; independent transfers that do not expose their answers. Confirm each with a failing user journey before implementing. Do not rewrite the entire engine before proving the first sequence.

## Production containment and backup

Local recovery directory: `C:\LittleFounders-Backups\content-review-2026-10-05`, outside OneDrive. The authenticated full Vault dump is 3,364,404 plaintext bytes with 240 TABLE DATA entries. Full data decoding recovered all 112 lessons, 336 immutable versions and 336 active-version pointers. This verifies the archive data; it is not a full Supabase restoration rehearsal.

The current catalog has no version audio objects and no HTTP(S) references in its lesson documents. No media or analytics files were deleted. The audited withdrawal transaction archived the course and all 112 lessons, preserving versions and learner records; a separate fresh query confirmed that status and the two existing runs. Physical deletion remains pending the owner's decision about linked history. No production code or replacement lesson was deployed.
