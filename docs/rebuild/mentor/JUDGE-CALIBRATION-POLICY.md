# Judge calibration policy (C.23)

Status: written 25 September 2026 for checkpoint S06.14 (the orchestrator's wave label S06.9). It is implemented and verified locally. It has not been reviewed: the standard is a Tier 1 item, and the Pedagogical Reviewer and the Safety/Trust Lead must sign it off. Every number is **proposed, pending calibration** and is listed in the [Threshold Recalibration Log](THRESHOLD-RECALIBRATION-LOG.md).

Binding sources: Product `10` C.23 (and C.5, C.21, C.22); Appendix E §1.2, §2.1 and §3.2; Appendix F §1.3 (Judge–Human Agreement Rate), Part 2.1 and Part 3 Stage 3; owner decision OD-23 (zero paid spend during the build).

## 1. Governance tier (C.22)

- **The standard is Tier 1.** The thresholds, the gold and seed sets, the judges' instructions and the recording rules decide what "calibrated" means. A change needs full human review and a row in the Tier 1 change record ([self-improvement governance policy §5](SELF-IMPROVEMENT-GOVERNANCE-POLICY.md#5-the-tier-1-change-record)). `npm run governance:check` refuses an unrecorded change, and `npm run judge-calibration:check` refuses any lowered floor.
- **What a calibration unlocks.** A passed, fresh calibration lets a judge do exactly one thing:
  - the **live-content judge** may approve live items for learners (the live-content axis, Appendix E §3.1.1), under the staff sampling floors;
  - the **transcript judge** may gate Stage 3 of a Tier 2 change (Appendix F Part 3), and only on the criteria in its calibrated scope.
- **Everything else is Tier 3 information.** An uncalibrated or stale judge's output informs a human and decides nothing (Appendix E §3.2). A Tier 2 change it would have scored goes to Stage 4 (human review), as a Tier 1 change would.
- **Running a calibration is owner-run.** The paid step (the real judge over the seed set) needs an explicit approval variable (OD-23). Everything else runs at zero spend.

## 2. The registered judges

`JUDGE_REGISTRY` in `backend/src/services/pedagogy/judgeCalibration.ts` lists every judge that may be trusted with a decision.

| Judge | Requirement | What it decides | Seed set | Strata | Questions |
|---|---|---|---|---|---|
| `live_content_judge` | C.5 | Approves one live practice item for one learner | `seed.v1`: 44 items (`oracle/src/content/judgeCalibration/seed-set.json`) | `standard`, `sensitive` | `approve` |
| `transcript_judge` | C.21 | Scores a transcript on the rubric criteria no rule can read | `transcript-gold.v1`: 47 transcripts (`backend/src/services/pedagogy/transcriptGoldSet.ts`) | `routine`, `hard` | the six pass/fail judge criteria: `answer_reveal`, `false_affirmation`, `emotion_label`, `hint_repeat`, `tell_honored`, `controlling_language` |

**Not in this registry, on purpose:**

- **The moderation judge** (`oracle/src/safety/moderation.ts`) and the memory-note review built on it. These are safety judges: they refuse, pause or escalate in real time, and never grade quality or gate a release. Their changes are Tier 1 (component `safety.judge`), and the C.20 bias audit covers their fairness. A human-panel calibration of the moderation judge is proposed in §9.
- **The deterministic scorers** (the transcript rubric's rules, the self-explanation check, the telemetry lexicons). No model is involved, so there is nothing to calibrate. The fixture suites prove them.
- **Diagnostic criteria** (`praise_specificity`, `scaffold_quality`). There is no pass or fail to agree on, so no judge is trusted on them. Their judge output stays Tier 3 information.

## 3. The standard (pre-registered)

The same computation serves every judge (`computeJudgeCalibration`). Core recomputes every number from the raw labels and verdicts, never from a number a harness printed. The database recomputes each stratum's result, the scope and the verdict again from those numbers (`record_mentor_judge_calibration`), and refuses a row whose claims do not follow.

**Step 1: the panel agrees with itself** (Appendix E §2.1).

| Condition | Floor |
|---|---|
| Raters | At least 2 human-panel members, each with a distinct name. The seed author's labels are never a rater. |
| Mean pairwise agreement | ≥ 85% (the Khanmigo reference) |
| Fleiss' kappa | ≥ 0.60. Raw agreement alone is inflated when most items pass, so the chance-corrected figure must also hold. |

**Step 2: the judge agrees with the panel, in every stratum** (Appendix E §1.2: reliability falls on the hard cases, so the weakest stratum decides).

The panel's label is its majority. A tie that includes `fail` is `fail`, and a tie between `pass` and `not_applicable` is `not_applicable`. A pair counts when either the panel or the judge saw an opportunity, so a false alarm is a disagreement, as a miss is.

| Condition | Content judge | Transcript judge |
|---|---|---|
| Items per (question, stratum) | ≥ 20 | ≥ 10 |
| Items per question | ≥ 40 | ≥ 20 |
| Panel `pass` and panel `fail` items, each, per stratum | ≥ 5 | ≥ 3 |
| Judge–panel agreement, per stratum | ≥ 90% | ≥ 90% |
| Cohen's kappa, judge vs panel, per question | ≥ 0.70 | ≥ 0.70 |

A question is **calibrated** when every one of its strata meets the bar and its kappa clears the floor. The **scope** is the list of calibrated questions. The transcript judge may pass with a partial scope and is then trusted on those criteria only. The content judge must calibrate `approve`.

**Step 3: two documented judge biases are checked.**

- **Verbosity** (Zheng et al., 2023). Agreement on the shortest third of items and on the longest third may differ by at most 15 points (compared only when each third holds at least 10 pairs).
- **Self-enhancement.** The judge may not be of the same model family as the model whose output it judges: Oracle's `JUDGE_MODEL_NAME` against `MODEL_NAME`. Today these are `qwen3-max` and `deepseek-v4-flash`, which is compliant. An unknown family is reported, not refused.
- **Position bias** does not apply: both judges score one item at a time. A future pairwise judge must randomize the order and calibrate both orders.

**Refused whatever the numbers:** a dry run or a replay (only a `live` run records), a judge identity that is not a model plus a SHA-256, a missing label or verdict, a rating file for another gold-set version, a run over a different rubric, or a spot check with a different judge identity from the calibration it re-verifies.

## 4. The seed and gold sets

- **Content seed set `seed.v1`.** 44 items: 22 standard and 22 sensitive, each 11 pass and 11 fail, in three locales. See the [live-content policy §4](LIVE-CONTENT-GOVERNANCE-POLICY.md#4-the-calibrated-judge-appendix-e-21-32).
- **Transcript gold set `transcript-gold.v1`.** 47 short transcripts written by hand for this purpose in en-US, es-MX and pt-BR. They cover every age band, use no real learner, and use coins as the only currency. The strata:
  - `routine` (20 transcripts): the plain case of each question;
  - `hard` (27 transcripts): the borderline case, which is where Appendix E says judges fail. Examples: a paraphrased hint, a hedged or tag-question emotion claim, a leading question that contains the answer, a "hint" that gives away the digits, praise of the method on a wrong answer, "Sure! But first…" instead of the answer, and controlling words said to a child (outside the question).
- **Counts.** Every question has at least 10 applicable transcripts per stratum, with at least 4 of each label. A Core test pins this.
- **Identity.** The gold set's identity is its SHA-256 (`TRANSCRIPT_GOLD_SET_HASH`). A calibration is recorded against it, and rating files carry it, so ratings of an older version are refused.
- **The author's labels are never a rating.** They exist to prove the pipeline in the dry run.

## 5. Runbook: a calibration (owner-run)

1. **Choose the panel.** At least two people, three recommended, for each judge. Each rates alone, without discussing items. Raters must read the locale of the items they rate, so the panel together covers en-US, es-MX and pt-BR. The Pedagogical Lead names them.
2. **Export the blind sheets (zero spend).**
   - Transcript judge: `npm --prefix backend run tutor:judge-calibration -- --export-rating-sheet=<dir>`. This writes `rating-sheet.md`, with the transcripts, the six questions and when each applies and fails, and `rating-template.json`. Neither file has an intended label, a stratum or an author note. Transcript ids are opaque (`gold-` plus 8 hex characters), so an id cannot hint at the answer. A test pins all of this.
   - Content judge: the S06.12 procedure, a rating file with `source: "human_panel"` per rater.
3. **Rate.** Each rater fills `rater` and every label (`pass`, `fail` or `not_applicable`) and keeps `source: "human_panel"`.
4. **Run the judge (PAID, OD-23: the owner approves the spend).**
   - Transcript judge (47 calls):
     - `npm --prefix backend run tutor:judge-calibration -- --export-gold-batch=gold.json`
     - `TRANSCRIPT_JUDGE_LIVE=approved npm --prefix oracle run transcript-judge -- --batch=gold.json --live --out=run.json`
   - Content judge (44 calls): `CONTENT_JUDGE_CALIBRATION_LIVE=approved npm --prefix oracle run content-judge:calibrate -- --live --ratings=a.json,b.json --out=run.json`
5. **Record.** `npm --prefix backend run tutor:judge-calibration -- --record --judge=<transcript_judge|live_content_judge> --run=run.json [--ratings=a.json,b.json] --recorded-by="<name>" --note="<what was run>"`.
   - The command prints every stratum, the kappas, the bias checks, the scope and the disagreements.
   - A failed run is recorded too, and it un-trusts the judge. The failure is information, not an error to hide.
   - The content judge's older command `tutor:live-content-report -- --record-calibration` records into the same registry.
6. **Check.** `npm --prefix backend run tutor:judge-calibration -- --status` shows each judge's state, scope, last verification and due date.

**Before the first panel exists**, `npm --prefix backend run tutor:judge-calibration -- --dry-run` runs the whole computation on the gold set with the author's labels as panel and judge. It makes no call and is never recordable.

## 6. Cadence, spot checks and automatic recalibration (Appendix F §1.3)

- **Cadence.** Monthly in the first year: a calibration is trusted for 35 days after its last verification, and the status says "due soon" 7 days before. Moving a judge to quarterly after its first year is a recorded Tier 1 decision: a registry change, the governance ledger and this guard updated together. `judge-calibration:check` refuses any other cadence.
- **Spot check.** A smaller re-check against the same judge identity, recorded with `--record --spot-check-of=<calibration id>`. Its strata are half the size (content 10 items, transcript 5), and it must keep the calibrated scope.
  - A **passed** spot check restarts the cadence.
  - A **failed** one sets the judge to `recalibration_required`, the automatic recalibration trigger. Only a new full calibration restores trust.
  - For the content judge, the Judge Approval-Quality Concordance Rate (C.5) is the continuous spot check. It suspends live generation per category on its own.
- **Recalibration is also required when:**
  - the judge's model or instructions change. The identity (model plus prompt SHA-256) no longer matches, so the old calibration does not apply;
  - the rubric changes, because the transcript judge's prompt hash includes the rubric hash;
  - the gold or seed set changes;
  - the calibration goes stale.

**Trust states** (`judgeTrust`):

| State | Meaning | What the judge may do |
|---|---|---|
| `uncalibrated` | Never calibrated | Nothing (Tier 3 information) |
| `failed` | The latest full calibration failed | Nothing |
| `recalibration_required` | A spot check of the current calibration failed | Nothing |
| `stale` | Passed, but not re-verified within the cadence | Nothing |
| `passed` | Passed and fresh | Its gate (§1), within its scope, until `dueAt` |

## 7. Where the rules are enforced

| Boundary | Mechanism |
|---|---|
| Database | `mentor_judge_calibration` and `mentor_judge_calibration_stratum` (migration `*_mentor_judge_calibration_registry.sql`). CHECKs hold the floors and the per-judge minimums. A pass must follow from its own numbers. The only write path, `record_mentor_judge_calibration`, recomputes each stratum, the scope and the spot-check rules. RLS is on with no client policy. |
| Core, live content | The live-content gate reads the content judge's trust from the registry. A judge that is not `passed`, or an item approved by any other identity, keeps live generation suspended. |
| Core, Stage 3 | `verifyStage3` (CLI `--verify-proposal`) lets the transcript judge gate a Tier 2 change only if it was `passed` when the change was scored, with the calibrated identity, on criteria in scope. A calibration recorded later cannot vouch for an earlier scoring. |
| Core, dashboard | `transcript_judge.agreement` and `judge.content_calibration` are breaches (urgent, owned by the Safety/Trust Lead) whenever the judge is not `passed`. An unreadable registry is `unavailable`, never calm. |
| Oracle | Live runs are refused before anything is read unless `TRANSCRIPT_JUDGE_LIVE` or `CONTENT_JUDGE_CALIBRATION_LIVE` is `approved`. Every run carries the judge identity and the author model. The transcript judge's prompt defines what pass and fail mean. |
| Repository | `npm run judge-calibration:check` covers vocabulary parity across Core, Oracle and the migration, the Tier 1 floors, the per-judge minimums, the monthly cadence and the owner-approval refusals. `npm run governance:check` refuses any unrecorded change to the standard. |

**Judge-written transcript scores are still not recordable** (`tutor_transcript_score.scorer` admits `rules` only). Scoring real sessions with a judge would export children's transcripts to a paid provider every hour. That needs a privacy review and an ongoing spend decision, not only a calibration. The calibrated judge's first use is therefore Stage 3 over simulated-student transcripts.

## 8. Known limits

- No panel has rated either set, and no live judge run has happened (OD-23). Both judges are `uncalibrated`, so live generation stays suspended and Stage 3 routes to human review. This is the designed starting state.
- The transcript strata are small (10 per stratum). One disagreement moves agreement by up to 10 points. The panel should grow the gold set from real, consented transcripts once the privacy review allows it.
- The gold set is hand-written. Native-speaker review of the es-MX and pt-BR transcripts, and a pedagogy review of the hard cases, are pending.
- The model-family check reads names, not provenance. A renamed model defeats it.

## 9. Proposals recorded for owner and pedagogy review

1. **The kappa floors (0.60 panel, 0.70 judge) and the 15-point verbosity gap.** These are engineering readings of "a defined, documented threshold". Appendix E gives only the ~85% raw figure.
2. **Calibrate the moderation judge too.** Build a human-rated safety set and hold the moderation judge to the same standard. It is excluded today because it is a Tier 1 safety judge, not an evaluation judge.
3. **Panel composition.** At least one rater per locale in each panel, and a Safety/Trust member on the content judge's sensitive stratum.
4. **Spend.** One calibration is 44 + 47 = 91 judge calls, and monthly re-checks repeat it. The owner approves each run under OD-23.
