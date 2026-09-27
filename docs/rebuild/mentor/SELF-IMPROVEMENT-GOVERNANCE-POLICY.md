# Self-improvement governance policy (C.22)

Status: written 25 September 2026 for checkpoint S06.14 (the orchestrator's wave label S06.9). The model is adopted by engineering and enforced by code from this checkpoint. It has not been reviewed: adoption decision `D-2026-09-25-adoption` and every Tier 1 change-record row wait for the Pedagogical Reviewer's and the Safety/Trust Lead's sign-off. Until they sign, the release audit (§7) fails, by design.

Binding sources: Product `10` C.22 (and C.5, C.21, C.23, C.24); the Block C Real-Time Interaction Standard's governance boundary; Appendix E §1.2, §2.3, §3.1, §3.1.1, §3.2 and §3.3; Appendix F §1.3 (Tier-Compliance Audit), §1.4 (Canary Regression Rate), Part 2 (Definition of Done) and Part 3 (Stages 0–7); owner decision OD-23.

## 1. What "self-improvement" means here

It means **automated measurement and proposal generation, with mandatory human-gated deployment** (Appendix E §2.3). It never means a Mentor that changes its own behaviour in production, or a model fine-tuned on children's conversations (§3.3).

**Today no automated proposal generator exists.** This policy, its registry and its gate were built first, as C.22 requires. Any generator built later must pass through them (§6).

## 2. The tiers

Automation is scoped by **how bad a wrong automated change would be and how hard it would be to notice and undo**, not by what is technically possible (Appendix E §3.1).

| Tier | What automation may do | Named examples in this codebase |
|---|---|---|
| **Tier 1: never automate** | Nothing. Every change is human-authored, is recorded in the Tier 1 change record, and ships only with the Pedagogical Reviewer's and the Safety/Trust Lead's sign-off. | Moderation and memory-note review, and the 14-field context contract. The transcript rubric and its scorer, the judges' prompts, the calibration standard and the gold sets. The simulated-student suites and the bias audit. The six non-negotiable constraints and the controller that wires them. Session caps and the early-close signal. The Stage 7 kill switches and dashboard thresholds. This registry and its gates. |
| **Live-content judging** (Appendix E §3.1.1) | Its own axis, beside the proposal tiers: an AI judge approves one live item for one child. The rules around it (floors, calibration, suspension) change like Tier 1. | The content judge's prompt, the content-risk lexicon, the sampling floors, the pack release contract ([live-content policy](LIVE-CONTENT-GOVERNANCE-POLICY.md)). |
| **Tier 2: gated automate** | Micro-variants **within approved bounds** may be proposed automatically. They reach learners only after Stage 2, Stage 3 or Stage 4, and a human-read canary (§4). | Rewording a scripted line, a persona tone variant, moving the telemetry latency threshold from 1.5 to 1.7 inside its bounds, renegotiating after 3 declines instead of 2. |
| **Tier 3: fully automate** | Measurement and reporting run without gating, because their output is information for a human. A change is classified at Stage 0 and ships instrumented. | The hourly evaluation loop, the dashboard data layer, the honesty-ledger records. |

**Rules that hold across the tiers:**

- **One tier per declaration in a split file, and the strictest is the default.** A file that mixes a non-negotiable rule with tunable numbers (for example `controller.ts`: the C.10 corroboration rule and pacing) is classified per top-level declaration since OD-28 (owner review M-19, 27 September 2026). The strictest component holds `"*"`: every declaration nobody else names, the file's imports and top-level statements, and every declaration added later. A less strict claim (a carve-out) names its declarations, cites a decision, and takes effect only once both leads have signed that decision; until then the whole file stays with the strict component. A Tier 3 carve-out may not be used by a stricter declaration, in its file or by import. The Tier 1 hash, the automated-origin fence and the Tier 2 bounds follow the effective owner of each declaration. Any file not split this way is still one tier as a whole, and the strictest wins. Changing a boundary is itself a Tier 1 change (it edits the registry).
- **Thresholds that watch the Mentor are Tier-1-adjacent.** The Stage 7 kill-switch floors and the dashboard's regression thresholds may be tightened by a human at any time. Loosening one is a Tier 1 change. An automated loop that could relax the rule measuring it is the reward-hacking failure Appendix E §1.2 describes.

## 3. The registry: Stage 0 made mechanical

`docs/rebuild/mentor/governance/registry.json` classifies every Mentor source file under the governed roots:

- `oracle/src/tutor/`, `oracle/src/safety/`, `oracle/src/content/`, `oracle/src/evaluation/` and `oracle/src/context/`;
- `backend/src/services/pedagogy/`;
- plus named files elsewhere, such as the session caps and the pack contract.

Each file belongs to exactly one component, and each component carries:

- a tier, an owner role and a policy document;
- named examples of the changes it covers (C.22 DoD a);
- an append-only tier history.

| Component | Tier | Owner | Covers |
|---|---|---|---|
| `safety.judge` | Tier 1 | Safety/Trust Lead | Moderation, canaries, untrusted-text fencing, memory-note review, the context contract (C.2–C.4) |
| `evaluation.rubric_and_judges` | Tier 1 | Pedagogical Lead | Rubric, scorer, fixtures, gold set, calibration standard, both judges' calibration harnesses (C.21, C.23) |
| `evaluation.stage2_and_bias_audit` | Tier 1 | Safety/Trust Lead | The five simulated-student gyms and the bias audit (C.20; the audit log is excluded from the hash) |
| `mentor.non_negotiables` | Tier 1 | Pedagogical Lead | The hint ladder, feedback honesty, affect claims, the check-in, closing scripts, controller, orchestrator, and Core's persisted corroboration rule (C.9, C.10, C.13, C.16, C.18, C.19) |
| `mentor.monetization_adjacent` | Tier 1 | Safety/Trust Lead | Session budget and caps, the paid-spend guard, the early-close signal (C.8/C.12) |
| `measurement.stage7_and_thresholds` | Tier 1 | Pedagogical Lead | Core's kill switches and regression thresholds (C.9–C.11, C.15, C.17, C.18, C.24) |
| `governance.model` | Tier 1 | Safety/Trust Lead | This registry and the two gates |
| `live_content.judge_and_packs` | Live-content axis | Safety/Trust Lead | Content author and judge, risk lexicons, live gate, pack contract (C.5, C.6) |
| `mentor.dialogue_and_persona` | Tier 2 | Pedagogical Lead | Prompt, scripted lines, role-play scenes, intake, misconceptions, self-explanation wording |
| `mentor.pacing_and_signals` | Tier 2 | Pedagogical Lead | Telemetry weights, spaced review, dialogue calibration, alliance and disposition tuning, the practice plan |
| `mentor.runtime` | Tier 2 | Engineering Lead | Grading, whiteboard, instruments, the turn schema, practice records |
| `measurement.reporting` | Tier 3 | Engineering Lead | The evaluation loop, the dashboard data layer, the honesty-ledger records |

**Stage 0 is enforced.** `npm run governance:check` fails when:

- a governed file is unclassified;
- a file belongs to two components;
- a component matches no file;
- a component's tier is not the last entry of its tier history.

## 4. The pipeline per tier (Appendix F Part 3)

| Stage | Tier 1 / live-content | Tier 2 | Tier 3 |
|---|---|---|---|
| 0. Classification by both leads | Required | Required | Required |
| 1. Authoring | Human only | Human, or an automated proposal | Human or automated |
| 2. Simulated students: the five Appendix F personas (`frustrated`, `disengaging`, `gaming`, `reactant_teen`, `masking`) and the full gym | Required | Required. A failure returns the change to Stage 1 with an itemized report. | Not needed (no behaviour) |
| 3. Calibrated judge (C.23) | **Bypassed**: a judge never gates it | Allowed only when the transcript judge was `passed` when it scored, on criteria in its scope. Otherwise Stage 4. | Skipped |
| 4. Human review: the Pedagogical Reviewer and the Safety/Trust Lead, two different people, addressing the specific risk | Required | Required when Stage 3 did not pass | Optional |
| 5. Canary: a named person reads at least 20 real transcripts | Required | Required, even after clean Stages 2–4 | Not needed |
| 6. Release with the Appendix F metric instrumented | Required | Required | Required |
| 7. Monitoring and kill switches | The Stage 7 table (see the policies of C.5, C.9, C.10, C.15, C.17) | Same | Dashboard freshness |

**Proposal records.** A change that goes through the pipeline carries a record at `docs/rebuild/mentor/governance/proposals/<id>.json`, format `mentor-change-proposal`. The [README in that folder](governance/proposals/README.md) shows the fields. The gate (`evaluateProposal`) enforces:

- The tier is **computed from the paths**, never taken from the record. A record that declares a weaker tier than its paths is refused.
- An `automated` proposal can never touch Tier 1 or the live-content axis.
- A record cannot claim `canary`, `released` or `rolled_back` while a stage its tier requires is missing.
- A Stage 3 claim must name its calibration, judge identity and criteria, and say it was verified with `npm --prefix backend run tutor:judge-calibration -- --verify-proposal=<file>`. That command reads the calibration registry; the repository gate cannot reach the database.
- The **Canary Regression Rate** (Appendix F §1.4) is computed from the Stage 5 outcomes in these records.

## 5. The Tier 1 change record

`docs/rebuild/mentor/governance/tier1-change-record.json` holds one row per change to each Tier 1 or live-content component. Each row carries:

- the component's content hash (every file, line endings normalized);
- the date and what changed;
- `origin: "human"`;
- the two sign-offs, each a name or `pending`.

**The rules:**

- **A change without a row fails the gate.** A component whose files no longer match its latest row turns `governance:check` red on every push. Record the change with `npm run governance:check -- --record --change="<what changed>"`, which appends a row with pending sign-offs. Both leads then replace `pending` with their names.
- **The record is append-only.** With `--base=<ref>`, CI refuses:
  - a removed row;
  - a rewritten hash, date, change or origin;
  - a sign-off changed after it was given.
- **The first rows are a baseline.** They record the code as found when the model was adopted. They need the same sign-offs.

## 6. Fencing automation

| Fence | How it is enforced |
|---|---|
| **No automated commit touches Tier 1 or the live-content axis** | `--range=<a..b>` in CI reads every commit. A commit is automated when its author is a `[bot]` or it carries the trailer `Mentor-Change-Origin: automated`. Such a commit fails if it touches a Tier 1 or live-content file. |
| **An automated commit to any other governed file cites a cleared proposal** | It needs `Mentor-Proposal: <id>`. The record must be `automated`, name every governed file the commit touches, and be in `canary` or `released` with every required stage present. |
| **Every automated pipeline is declared** | A workflow that can write to the repository (`contents: write`, `git push`, `gh pr merge`, `gh pr create`, a pull-request action) must be listed in `automatedPipelines`. Its scope may not reach a Tier 1 or live-content file, and its `maxTier` may not be Tier 1. Today one is declared: `pulse-dependabot-automerge.yml`, scope `pulse/**`. |
| **Proposal generators are declared** | `automatedProposalGenerators` is empty today. A generator is added by a Tier 1 decision, and never with Tier 1 or live-content as its target. |
| **Tier 2 stays inside approved bounds** | Registered Tier 2 parameters must hold values inside their bounds, such as the telemetry z-score (1.0–2.5), `minChannels` (2–3), the renegotiation trigger (2–4 declines) and the self-explanation limits. The bounds live in the registry, which is Tier 1, so widening them is a Tier 1 decision. |
| **No promotion without a signed decision** | A move to a more autonomous tier, or into or out of the live-content axis, must cite a decision in `decisions` signed by both leads. The tier history and the decisions are append-only against the base. |

**Honest limit.** The fence recognizes automation by its author (`[bot]`) or its trailer. A generator that forged a human identity would evade it. That is why generators must be declared, and why the release audit also requires every Tier 1 version to be signed off by two named people.

## 7. The Tier-Compliance Audit (Appendix F §1.3)

`npm run governance:check -- --release [--report=<file>]` is the audit. It runs every check above and requires:

- every Tier 1 and live-content component's current version signed by both leads;
- every decision signed by both leads.

It writes a JSON report with the per-section violations, the sign-off count, the automated commits checked and the Canary Regression Rate. `release:readiness` runs it, so a release candidate cannot pass readiness with an unsigned Tier 1 change. CI runs the non-release checks on every push and pull request (`repo-gates.yml`, job `mentor-governance`, with the base and range of the push).

**First audit against the current architecture** (25 September 2026, C.22 DoD b; before any automated proposal generator exists):

| Check | Result |
|---|---|
| Classification | 12 components; every governed file classified exactly once |
| Tier 1 change record | 8 Tier 1 and live-content components; the baseline rows match the code |
| Automated pipelines | 1 declared (Pulse Dependabot automerge, scope `pulse/**`); no pipeline can reach a Tier 1 or live-content file |
| Automated proposal generators | None |
| Automated commits touching Tier 1 in this lane's history (`git log main..HEAD`) | None |
| Tier 2 parameters | 7 registered, all inside their bounds |
| Tier statements (DoD c) | C.5, C.21, C.23 and C.24 each state their tier in their policy |
| **Release audit** | **Fails as expected**: 8 components and the adoption decision await both sign-offs |

## 8. Tier statements of the other automation requirements (C.22 DoD c)

| Requirement | Where its tier is stated |
|---|---|
| C.5 / C.6 | [Live-content policy §1](LIVE-CONTENT-GOVERNANCE-POLICY.md#1-the-content-ladder-and-which-tier-governs-each-rung): the live-content axis; the floors are Tier-1-adjacent |
| C.21 / C.24 | [Evaluation-loop policy §1](EVALUATION-LOOP-AND-QUALITY-DASHBOARD-POLICY.md#1-governance-tier-c22): Tier 3 running; the rubric is Tier 1 |
| C.23 | [Judge-calibration policy §1](JUDGE-CALIBRATION-POLICY.md#1-governance-tier-c22): the standard is Tier 1; a calibration unlocks one gate |

`governance:check` fails if any of these documents stops naming C.22 and its tier.

## 9. What this does not claim

- **The gate governs the repository.** Operators can still change environment variables in Railway, such as a telemetry mode, a sampling baseline or a kill switch. Those are human actions outside git. The lane review (S06.15) checked what those variables can reach:
  - The seven registered Tier 2 parameters have **no environment override**. They are code constants, so they change only through a commit, and this gate checks their bounds.
  - The mode variables (`TUTOR_BEHAVIORAL_TELEMETRY`, `TUTOR_ALLIANCE_CONTROLLER`, `TUTOR_SELF_EXPLANATION`, `TUTOR_SPACED_REVIEW`, `TUTOR_DIALOGUE_CALIBRATION`, `TUTOR_SESSION_END_SIGNAL`) are Stage 7 kill switches. They can only make the Mentor do less, and an unknown value falls back to the active mode, never to a silent off.
  - Core ignores a live-content sampling baseline below its floor (S06.12).
  - `TUTOR_CORROBORATION_MIN_OBSERVATIONS` now refuses to boot below 2. The C.10 floor is a non-negotiable constraint, so the only single-observation path is the per-KC Stage 7 rollback.
  - `TUTOR_REVIEW_SHORT_HORIZON_MIN` (C.11) and `MENTOR_DIALOGUE_EXPERIMENT_BANDS` (C.17: adults, teens and tweens by default under OD-26, never a young child) are schema-bounded operator values. Widening the experiment bands further is a Product and Legal decision (H.7), recorded in the owner log.
- **The two sign-offs are names in a file.** The gate proves that a named human signed and that the record was not rewritten. It cannot prove who typed the name. Branch protection and review on `main` remain the owner's control.
- **No canary infrastructure beyond the H.7 experiment console exists.** A Stage 5 canary is an experiment arm: surface `tutor`, a small share, adults only (OD-23). The record names it.

## 10. Proposals recorded for owner review

1. **Release blocking.** `release:readiness` now fails until both leads sign the adoption decision and the eight baseline rows. The SPEC's reading is that no Tier 1 item ships without explicit sign-off. The alternative is a documented, time-boxed waiver, which would itself be a Tier 1 decision.
2. **The component boundaries.** Answered by OD-28 (M-19): finer boundaries. `oracle/src/tutor/controller.ts`, `oracle/src/tutor/orchestrator.ts` and seven Core kill-switch modules (`mentorIntegrity`, `mentorQuality`, `behavioralTelemetry`, `alliance`, `dialogueCalibration`, `spacedReview`, `sessionEnd`) are split by declaration. Their strict component keeps `"*"`; the proposed carve-outs (controller pacing tables to Tier 2, two orchestrator history windows to Tier 2, report-only summaries and kill-switch log readers to Tier 3) are listed in decision `D-2026-09-27-finer-tier1-boundaries` and take effect when both leads sign it. Until then the files stay Tier 1 as a whole.
3. **The approved Tier 2 bounds** in the registry.
4. **Branch protection** on `main`, requiring the `mentor-governance` job and a review for any change under the governed roots. This is repository configuration, which only the owner changes. Answered by OD-28 (O-01): Engineering prepared `.github/CODEOWNERS` and the exact ruleset in [`docs/operations/BRANCH-PROTECTION.md`](../../operations/BRANCH-PROTECTION.md); the owner applies it.
5. **Runtime bounds.** Closed by the S06.15 lane review. The registered Tier 2 parameters have no environment override to clamp (see §9), and the one numeric value that could have weakened a Tier 1 constraint (`TUTOR_CORROBORATION_MIN_OBSERVATIONS`) now refuses to boot below 2. If a future change adds an environment override for a registered Tier 2 parameter, it must clamp to the registry's bounds in the same change.
