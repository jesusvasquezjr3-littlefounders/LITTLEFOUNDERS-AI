# Block D long-horizon research plan

**Status:** Product 10 D.22 scope document, written by Engineering (S07.7, 2026-09-24) with the first phase of instrumentation built and locally verified. The SPEC asks for a named Product/Research owner within two quarters of approval: **the project leader is the interim owner of this plan** (owner decision OD-28, owner review O-02, 27 September 2026) until a permanent Product/Research owner is named. Legal must approve the research disclosure before any family is asked (OD-10). Nothing here is accepted.

## The question

LittleFounders' theory of change: practising earning and Save/Spend/Share as a child produces better adult money behaviour. No study has demonstrated it, retrospective or otherwise (Appendix G §3.6: Ammerman & Stueve 2019 is retrospective self-report; no prospective cohort tracking childhood money practice through verified adult records exists). The closest randomized analogue, a coached budgeting app for teens, moved knowledge but not budgeting or saving (Frisancho, Herrera & Prina, §3.2). The company therefore treats the hypothesis as **an open question it is testing, never a mechanism it is already delivering**, and says so internally and externally (`BLOCK-D-RESEARCH-FOUNDATION.md`, Block D Part 4).

## Principles

1. **Observe, never assign (OD-23).** No experiment runs on a minor. Until Product and Legal choose wider ages (H.7), experiments run on adults (18+) only, and no Block D table may carry an assignment column (the research gate fails on one). This phase only observes.
2. **A separate, specific consent.** The FTC's 2025 COPPA amendments ask for consent to the specific practice (Appendix G §4.6). Research consent is its own yes, apart from the H.1 analytics consent: a verified Tutor for a child under 18 (or of unknown age); an adult only for themselves. A self-registered teen without a Tutor cannot be enrolled in this phase (nobody can give the parental consent). A Tutor's yes lapses at 18, and nothing more is recorded until the young adult says yes themselves. Since GAP-FIX-R2 (owner review H-25, "It lapses at 18, and re-consent is requested") the young adult is asked in their own Settings: one sentence that the Tutor's yes ended, the disclosure, and Yes or No with nothing preselected. Yes replaces the lapsed row with their own grant and keeps what was recorded as a child; No deletes it all. Recording resumes only while they hold a wallet; adult measures belong to a later phase with its own disclosure.
3. **A no deletes.** A no from the Tutor, any verified Tutor of the child, or the participant (a child's own no counts) withdraws the consent and deletes every snapshot at once.
4. **Totals, not lives.** A monthly snapshot of counts and coin totals the product already keeps. No names, notes, titles, free text, amounts in real money or identity; a random research id that only the database can map back, and only to delete.
5. **Bounded.** Snapshots are deleted after 1,100 days (the first phase's horizon) by the D.21 retention job. Keeping them longer is a later phase's decision, with Legal.

## Phase 1: instrument (built in S07.7)

| Part | What |
|---|---|
| Consent | `family_research_consents` (every yes and no, the record of consent), `family_research_set_consent()`, `family_research_admitted()` (every rule, every time), disclosure version 1 |
| Pseudonym | `family_research_participants`: the account's random `research_id`; deleted on a no, cascading to every snapshot |
| Snapshot | `family_research_snapshots`, one per participant per complete month that began after the consent: age in whole years, register, tenure in months, independence level, coins received, saved, spent and given, goals reached, next goals set, chores approved, rewards asked for and not approved yet, practised days, whether the usual split changed, bridge entries |
| Recorder | `record_family_research_snapshots()`, idempotent, called nightly by `insights-maintenance.yml` for the previous complete month |
| Surfaces | The Tutor's answer per child on the Family screen (`ResearchConsent`), the participant's own view and no (`MyResearch`) on the child's Banking page and the teen wallet |
| API | `GET/PUT /api/v1/family-hub/kids/:kidId/research` (the child's Tutor), `GET/PUT /api/v1/family-hub/research/me` (the participant; a yes only for an adult) |
| Metric | Appendix H Part 1.4, Longitudinal-Hypothesis Data Completeness (Diagnostic): `GET /api/v1/admin/family/research-completeness`, overall and for the 15+ `bridge_age` cohort (D.19 (c)) |

Why these measures: Appendix G §3.3 warns that knowledge quizzes and engagement are the constructs least tied to long-run capability. The snapshot therefore records habit-formation proxies (saving share over time, goal persistence after a goal, behaviour after a "not yet", practice regularity), the ones the CFPB's youth building blocks tie most closely to capability.

Completeness is defined as: of the enrolled participants whose consent covers the whole window of the last 3 complete months, the share with a snapshot for every one of those months, among wallet holders with at least 6 months of history (both windows are in the Block D threshold log). Coverage (enrolled of the long-tenure population) is reported beside it.

## Timeline

| Phase | When | What | Exit |
|---|---|---|---|
| 1. Instrument | Built in S07.7; runs from the first release after Legal approves the disclosure | Consent, snapshots, completeness | Completeness reports real data for one release cycle; a permanent Product/Research owner is named (the project leader is interim owner, OD-28) |
| 2. Baseline | The first 12 months after release | Quarterly completeness and coverage review; the snapshot's measures reviewed with the Pedagogical Lead; the graduation-at-18 re-consent flow (with D.19 milestone 3; the request itself shipped in GAP-FIX-R2, what remains is the adult measures and their disclosure) | A stable, consented cohort and a written analysis plan, registered before any outcome data is looked at |
| 3. Adult outcomes | From the first participants' 18th birthday | With the young adult's own yes: a short, voluntary self-report of adult money behaviour (saving, borrowing, budgeting), linked by research id only | A pre-registered comparison of childhood practice patterns with early-adult outcomes |
| 4. External review | Once phase 3 has two cohorts | An independent researcher reviews the method and the data before any public claim | Findings published as findings, including null or adverse ones |

At every phase, retention stays bounded (1,100 days unless a phase decision extends it with Legal), experiments stay on adults, and nothing is claimed before the analysis exists.

## What would count as evidence against the hypothesis

The plan is only honest if it can fail: no difference in early-adult outcomes between sustained and brief practice, after the confounders the literature names (family income, parental modelling, §1.1 and §1.3), counts against it and will be reported as such.

## Open

- Ownership: the project leader is the interim owner (OD-28, O-02), which meets the SPEC's two-quarter requirement for a named owner; a permanent Product/Research owner replaces them when one exists.
- Legal approves the disclosure text and the consent model, including whether an independent teen may ever enrol, before any family is asked.
- The completeness metric has no production data yet; Phase 1's exit needs one release cycle.
