# Live-content governance and the curated activity-pack tier (C.5, C.6)

Status: written 25 September 2026 for checkpoint S06.12 (the orchestrator's wave label S06.7). This policy is implemented and verified locally. It has not been reviewed: the Pedagogical Reviewer and the Safety/Trust Lead must sign off on the Tier 1 items marked below. Every number here is **proposed, pending calibration** and is listed in the [Threshold Recalibration Log](THRESHOLD-RECALIBRATION-LOG.md).

Binding sources: Product `10` C.5 and C.6; Appendix E §1.2, §2.1, §3.1.1 and §3.2; Appendix F §1.3, Part 3 Stage 7 and Part 4 (C.6 "flexible, no hard dependency"); owner decision OD-23 (zero paid spend during the build).

## 1. The content ladder, and which tier governs each rung

The Mentor gets a practice activity from three rungs, in this order:

| Rung | What it is | Who approved it | Governance |
|---|---|---|---|
| 1. Catalog | A graded segment from a published lesson | A human, at lesson release | The lesson pipeline (Block B) |
| 2. Curated activity pack (C.6) | A hand-authored or Forge-generated pack that meets the `tutor-pack.v1` contract | A human with the `manage_content` grant, at pack release | §5 below |
| 3. Live generation (C.5) | One activity written for one learner during a session | The content judge, per item, then a staff sample afterwards | §2 to §4 and §6 below |

**Tier statement (C.22).** Live per-item content judging is its own tier. It sits beside the Tier 1/2/3 proposal-generation model, not inside it (Appendix E §3.1.1). The sampling floors and the calibration minimums are **Tier-1-adjacent**: a human decision may tighten them at any time, but lowering one is a Tier 1 change that needs full human review and explicit sign-off. `npm run live-content:check` fails the build on any lower value in code, the config default, the env example or the migration. Curated-pack release is a human release (like Tier 1 content). The monitoring report is Tier 3 (information for a human, fully automatic).

## 2. Content-risk category

Every live item has a category: `standard`, or `sensitive` when it touches financial hardship, family conflict, loss and grief, or anything adjacent to the safety-stop categories (weapons, drugs and alcohol, gambling, stealing, secrets kept from parents, self-harm wording).

- **Where it is decided.** Core decides it, because Core is the service that certifies the item. Core runs its own deterministic lexicon (`backend/src/services/pedagogy/contentRisk.ts`) over the item's text and the Mentor's rationale. It adds `session_safety_event` when the session has any recorded safety flag, and takes the union with what Oracle reported. Oracle runs the same lexicon over the item and the Mentor's brief, plus the learner-input safety classifier (`learner_classifier_match`). **A report can raise the category and never lower it.** An unknown signal code is recorded as `unrecognized_signal` and makes the item sensitive.
- **Why deterministic.** A model classifier would cost a paid call per item (OD-23), and the text it classifies could steer it. The lexicon is loose on purpose: a false positive costs one extra human review, while a false negative lowers the review rate for exactly the content that needed a higher one. The two copies must stay byte-identical, which `npm run live-content:check` enforces.
- **Known limit.** No lexicon can list every sensitive situation. The staff review of the standard category (at least 15%) is the backstop, and a sensitive item that staff find in the standard category is a lexicon defect to fix.

## 3. Staff sampling: floors, systematic selection, the dynamic rate

- **Floors (Appendix E §3.1.1(a)).** At least 15% of standard items and at least 50% of sensitive items are sampled for post-hoc staff review. `TUTOR_LIVE_REVIEW_SAMPLE_RATE` and `TUTOR_LIVE_REVIEW_SENSITIVE_SAMPLE_RATE` may raise the baselines; a value below a floor is ignored and reported. The database refuses a lower rate in two places: the log's CHECK and the claim function.
- **Systematic, not random.** Each served item adds its rate to its category's credit, and the item is sampled whenever the credit reaches 1 (`tutor_live_sampling_credit`, locked inside the claim transaction). Over any run of `n` items, at least `floor(n × rate)` are sampled. This makes "the reviewed share fell below the floor" an exact statement about staff review, not a coin-flip artifact.
- **The dynamic rate (C.5).** A review batch is 20 consecutive staff decisions in a category. The **first** rejection (a real quality or safety issue) raises that category to its elevated rate at once: 50% for standard, 100% for sensitive, and never below a configured baseline. The rate returns to the baseline only after 5 consecutive clean batches (100 consecutive approvals). Any rejection restarts the count.
- **One transaction per served item.** The segment claim, the sampling decision and the log row (`tutor_live_content_log`) are written together (`insert_tutor_live_segment_checked`). There is no path that serves a live item without its sampling record. If the function is missing (the migration is not applied yet), Core refuses the live item and the other rungs still serve.

## 4. The calibrated judge (Appendix E §2.1, §3.2)

- **No trust before calibration.** The judge's approvals are trusted at no sampling rate until the latest recorded calibration for this judge has **passed** and is at most 35 days old. Until then, live generation is **suspended** for every category. The ladder serves the catalog and the curated packs, and Oracle is told not to author (no paid call for an item Core would refuse). **This is the production state from the first deploy until the owner runs the calibration.**
- **Judge identity.** A calibration is recorded against the judge's model name **and** the SHA-256 of everything the judge is told (`CONTENT_JUDGE_PROMPT_HASH` in `oracle/src/content/generate.ts`: its system prompt and the age-band rules). Oracle stamps both on every candidate, and Core refuses a candidate whose judge does not match. Editing the judge prompt or pointing `JUDGE_MODEL_NAME` elsewhere therefore un-trusts the judge until it is recalibrated.
- **The seed set.** `oracle/src/content/judgeCalibration/seed-set.json` (version `seed.v1`) holds 44 items: 22 standard and 22 sensitive, across the three locales and tiers, with both good items and items with planted defects (wrong key, two defensible answers, a silly distractor, a giveaway, too advanced for the age band, a false concept, a missing rationale, shaming or stereotyping, encouragement to gamble or steal). The `intended` label is the **author's** label, not a rating. Every sensitive item trips the lexicon and no standard one does, which a test pins so the calibration categories match the gate's.
- **The process.** (1) At least two members of the human panel rate every item pass or fail, without seeing the intended label, in a file with `source: "human_panel"`. (2) The owner approves the spend and runs `CONTENT_JUDGE_CALIBRATION_LIVE=approved npm --prefix oracle run content-judge:calibrate -- --live --ratings=a.json,b.json --out=run.json`, which makes one paid judge call per item. (3) An operator records the run with `npm --prefix backend run tutor:live-content-report -- --record-calibration=run.json --recorded-by="…" --note="…"`. Core recomputes every number from the raw labels and verdicts. The human label is the panel's majority, and a tie counts as a fail. Core refuses a dry run, a replay, fewer than two raters or ratings not from the human panel.
- **The bar.** The human inter-rater agreement must be at least 85%. The judge-human agreement must be at least 90% **in each category**, with at least 20 items per category. The database refuses a `passed` row that misses any of these, and refuses thresholds below them. A failed recalibration un-trusts a judge that passed before.
- **Cadence.** Monthly (35 days with grace) in the first year, per Appendix F §1.3. Moving to quarterly is a recorded decision.
- **Scope.** This is the calibration process for the live-content judge. C.23 (S06.14) generalizes it to every automated evaluation judge.

## 5. The curated activity-pack tier (C.6)

**Why these packs first.** Four knowledge components have no published topic (`kc.skill_key` is null): `biz.goods-vs-services`, `money.fraction-of-amount`, `money.percent-intro` and `biz.risk-and-reward`. Before this checkpoint, 100% of their activities were live-generated. They are the highest-predictability live demand there is, so they were covered first, per Appendix C's sequencing: 21 packs (every tier at or above each KC's `tier_min`, in all three locales), 84 activities, hand-authored at zero spend (`database/seeds/tutor_packs/`). After this first batch, the demand log ranks what to author next (§7).

**The `tutor-pack.v1` authoring contract** (`backend/src/services/tutorPacks.ts`):

| Rule | Check |
|---|---|
| Target | Exactly one of a knowledge component (`kc_key`, stored as skill key `kc:<key>`) or a catalog skill key; one tier, never below the KC's `tier_min`; one locale |
| Size | 4 to 12 activities |
| Types | `quiz_mcq`, `true_false`, `number_input`, `sort_buckets`, `order_steps`; payloads mirror the Lesson Engine's schemas, and a frontend test parses every seed item with the real `segmentUnion` |
| Ids | `pack-` + kebab-case, unique across all packs (the ladder's never-repeat-in-a-session check reads them) |
| Teaching | Every item has an explanation; every wrong option has a teaching rationale; exactly one correct option |
| Correctness | The same deterministic gates a live item passes (the tier's vocabulary band, key re-execution with the real grader), and stricter: every key must re-execute to 100, so every pack item pays XP |
| Language | No link, email or phone number; a guard against a pack written in the wrong language |
| Risk | The author declares `standard` or `sensitive`; a pack whose own text trips the content-risk lexicon must declare `sensitive` |
| Glossary | In-app currency is "coins / monedas / moedas", never money, pesos or reais (owner log §5) |

**Storage.** The pack stays in `tutor_packs` (migration 0047), with new columns: `kc_key`, `pack_version`, `content_hash`, `source`, `demand_pattern`, `risk_category` and `validated_at`. The stored form strips the answer keys from the learner-visible segments and keeps them beside them. A served pack item carries `pack_id`, `pack_version`, `content_hash` and `pack_source` in its provenance, so a defect found later can be traced to every learner who saw that exact text.

**Release.** `npm --prefix backend run seed:tutor-packs` loads packs as `review`. When content changes, the pack goes back to `review` and its release is cleared: a published pack is never silently changed. A staff member with `manage_content` publishes or archives it through `POST /admin/tutor/packs/:id/status`, which re-runs the whole contract on the **stored** content, checks the content hash and the live `tier_min`, and records the releasing staff member (`released_by`) and an `audit_logs` row. A pack in `review` is never served; the ladder reads only published packs.

**Selection in the ladder.** The order is catalog for the named skill, then the pack for the named skill, then **the pack for the exact knowledge component** (new), then the prerequisite's catalog, pack or **KC pack** (new), then the learner's frontier, and finally live generation (if it is open). Within a pack, the item nearest the requested difficulty (preferred types first) that this session has not seen is served. Personalization happens at selection, not at generation.

## 6. Stage 7: suspension and resolution

| Condition | Effect | Resolution |
|---|---|---|
| No passed calibration, or the latest one is older than 35 days | Every category is suspended | Record a passed calibration (§4) |
| Judge Approval-Quality Concordance below 90% (at least 20 decisions, the latest 100 under the current calibration) | That category is suspended; a trip is written to `audit_logs` | Operator `--resolve=<category>:concordance_below_floor`, **refused** unless a passed calibration was recorded after the trip ("until the judge is recalibrated", Appendix E §3.1.1(b)) |
| Staff review below the floor (fewer reviewed than `floor(served × floor)` among items served 30 to 7 days ago, at least 20 served), or any row recorded under the floor | That category is suspended; a trip is written | Operator `--resolve=<category>:review_rate_below_floor`, **refused** while coverage is still below the floor |
| A candidate approved by a judge other than the calibrated one | That item is refused | Not a trip: the item is recorded as `live_refused / judge_not_calibrated` |
| The gate's own state cannot be read | That request is refused (fail closed) | None: it is not cached, and the next request re-reads |

A suspended request falls back to the curated packs and the catalog, and otherwise to conversation, exactly as when no activity is available. Oracle makes no paid author or judge call for a suspended category.

## 7. Measurement

- `tutor_live_content_log`: one row per served live item (category, signals, the rate, elevated or not, sampled or not, judge identity, calibration, and the staff verdict and issue class).
- `tutor_content_ladder_events`: one row per ladder decision (catalog, bank, invitation to generate, suspended, served live, refused live, with the rung that answered and the refusal reason).
- `npm --prefix backend run tutor:live-content-report` prints the calibration, the per-category rate and state, the **Judge Approval-Quality Concordance Rate** (Appendix F §1.3), review coverage, the backlog past the SLA, the **content-ladder shares and the weekly live share** (C.6's measure: it must fall as packs land), the **unmet demand ranked by request pattern** (the next packs to author) and the **Kill-Switch Trigger Log**. `mentor-live-content-monitor.yml` runs it weekly. The staff console shows the same status and the review decision (`frontend/src/rebuild/mentor/LiveContentGovernance.tsx`).

## 8. Privacy and retention

None of the three new tables holds a learner id or learner text. They hold labels, numbers, our own catalog keys, the judge's model name and prompt hash, and the deciding staff member's account id. The log's segment reference becomes NULL at the 90-day transcript purge, and the row itself is kept as governance evidence. RLS is on, with no client policy; the service role reads and writes. The requested skill key is stored in the demand log only when it matches the catalog key shape, because it is model-written text.

## 9. Proposals recorded for owner and pedagogy review

1. **Live generation is suspended at deploy until the owner runs the calibration.** This is the SPEC's reading ("calibrated … before its approvals are trusted at any sampling rate"). Until then, the Mentor serves the catalog and the curated packs, or teaches in conversation. The alternative, a time-boxed exception, would be a Tier 1 decision (owner question).
2. **"Content category" for the dynamic rate is the risk category** (standard or sensitive), not the risk category × segment type. It is the coarser, stricter choice: an issue raises the rate for the whole category.
3. **The size of the increase:** standard to 50%, sensitive to 100%. The SPEC does not size it.
4. **A batch is 20 consecutive decisions.** The SPEC's "5 clean batches" is kept.
5. **The calibration bar is 90% per category**, equal to the concordance floor, with an 85% inter-rater bar and 20 items per category.
6. **The seed set's intended labels are the author's.** The human panel must be named, and must rate without seeing them.
7. **The four seed KCs were chosen by construction** (100% live today), not from production demand, which does not exist yet. The demand report ranks the next ones.
8. **Native-speaker review of the es-MX and pt-BR pack text** and of the risk lexicon.

## 10. What this does not claim

- It does not claim the judge is calibrated. No human panel has rated the seed set, and no live judge run was made (OD-23).
- It does not claim the lexicon finds every sensitive topic.
- It does not claim the packs are pedagogically reviewed. They meet the deterministic contract, and they await a human release in the console.
- Nothing here has been applied to a physical PostgreSQL or observed in production.
