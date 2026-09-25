# Block D threshold recalibration log

Appendix H (Part 1.4, "Threshold Recalibration Log (Block D)") requires every Block D threshold to be written down, owned and reviewed at least once per cadence (proposed: quarterly for the first year). This file is that log. It is not a specification: the SPEC (`docs/littlefounders-spec/`) and the owner decision log win when they disagree with it, and a change here without a matching change in the code and the database is a defect.

**Enforced, not only written.** `backend/src/__tests__/blockDThresholds.test.ts` reads the table below and fails when a value differs from the constant Core uses or from the number the database migration enforces. To recalibrate a threshold, change this table, the Core constant and a new migration together, and record the review in the history table.

Owner of the review: the Pedagogical Lead (Appendix H, Stage 7), with Product. Cadence: quarterly for the first year after release, then yearly. The first review is due one quarter after the release that ships S07.3.

## Current values

| Key | Value | Requirement | Source of the value | Enforced in Core | Enforced in the database |
|---|---|---|---|---|---|
| `chore_streak.rest_days_per_week` | 2 | D.2 (B.21 model) | Frontend Bible 02 §9.6 rule 1 (design judgement under uncertainty, §12) | `REST_DAYS_PER_WEEK`, `services/choreStreak.ts` | Not stored: the model runs in Core over recorded days |
| `chore_streak.milestones` | 7, 30, 100 | D.2, OD-7 | Owner decision OD-7 (closed milestone list) | `STREAK_MILESTONES`, `services/choreStreak.ts` | Not stored |
| `chore_streak.pause_max_days` | 21 | D.2 | Proposal (S07.3): long enough for a school holiday, short enough that a streak cannot be parked indefinitely | `PAUSE_MAX_DAYS`, `routes/tasks.ts` | `chore_streak_rest_days`: `ends_on - starts_on < 21` |
| `chore_streak.pause_max_backdate_days` | 7 | D.2 | Proposal (S07.3): a Tutor who forgot to pause before a trip can still do it; a paused day never adds to a streak | `PAUSE_MAX_BACKDATE_DAYS`, `routes/tasks.ts` | `chore_streak_rest_days`: `starts_on < v_today - 7` refused |
| `chore_streak.pause_max_lead_days` | 120 | D.2 | Proposal (S07.3) | `PAUSE_MAX_LEAD_DAYS`, `routes/tasks.ts` | `chore_streak_rest_days`: `starts_on > v_today + 120` refused |
| `chore_streak.pause_live_limit` | 3 | D.2 | Proposal (S07.3) | Database refusal mapped by `routes/tasks.ts` | `chore_streak_rest_days`: `>= 3` live pauses refused |
| `chore_streak.completion_day_tolerance_days` | 1 | D.2 | Every real time zone is within one calendar day of UTC | `resolveLocalToday`, `services/choreStreak.ts` | `chore_streak_rest_days`: `v_today - 1 AND v_today + 1` |
| `chore.contribution_max_coins` | 2 | D.10 | Proposal (S07.3) for "unpaid or nominal"; the SPEC mandates the choice, not a number | `MAX_CONTRIBUTION_COINS`, `routes/tasks.ts` | `family_task_contribution_kind`: `reward_coins BETWEEN 0 AND 2` |
| `savings_bonus.per_ten_coins` | 1 | D.11 | The SPEC's proposed starting ratio ("for every 10 coins you keep saved, get 1 more each week"); owner log §8: calibration values apply as written | `BONUS_PER_TEN_COINS`, `services/savingsBonus.ts` | `savings_bonus_age_framing`: `v_save_balance, 0) / 10` |
| `savings_bonus.per_ten_unit` | 10 | D.11 | As above | `BONUS_PER_TEN_UNIT`, `services/savingsBonus.ts` | As above; a per_ten rule stores `rate_bp = 1000` |
| `savings_bonus.percent_min_age` | 13 | D.11, D.12 | Appendix G §1.5 and §2.4: proportional reasoning becomes reliable in early-to-mid adolescence; the SPEC reserves percentages for the 13-17 tier | `PERCENT_FRAMING_MIN_AGE`, `services/savingsBonus.ts` | `savings_bonus_age_framing`: `< 13 THEN 'per_ten'` |
| `savings_bonus.max_rate_bp` | 2000 | D.11 | The existing 0-20% Tutor range (0081), kept for the 13-17 tier | `MAX_BONUS_RATE_BP`, `services/savingsBonus.ts` | `0081_banca_digital`: `rate_bp between 0 and 2000` |
| `split.recommended_save_pct` | 50 | D.13 | Proposal (S07.4): Appendix G §1.4 finds no evidence for any ratio; 5 / 4 / 1 out of 10 is a common family heuristic and only a starting default the child changes | `RECOMMENDED_SAVE_PCT`, `services/moneyHabits.ts` | `wallet_usual_split`: `50 AS save_pct` |
| `split.recommended_spend_pct` | 40 | D.13 | As above | `RECOMMENDED_SPEND_PCT`, `services/moneyHabits.ts` | `wallet_usual_split`: `40 AS spend_pct` |
| `split.recommended_share_pct` | 10 | D.13 | As above | `RECOMMENDED_SHARE_PCT`, `services/moneyHabits.ts` | `wallet_usual_split`: `10 AS share_pct` |
| `share.destination_limit` | 10 | D.14 | Proposal (S07.4): a bound on what one account can create, not a product opinion | Database refusal mapped by `routes/tasks.ts` | `share_gift_destinations`: `>= 10` active places refused |
| `share.gift_max_coins` | 1000 | D.14 | The existing per-movement bound (logged income, corrections) | `SHARE_GIFT_MAX_COINS`, `services/moneyHabits.ts` | `share_gift_destinations`: `amount BETWEEN 1 AND 1000` |
| `share.completion_window_days` | 14 | D.14 | Proposal (S07.4) for Appendix H's "defined window" of the Share-Bucket Destination Completion Rate | `SHARE_COMPLETION_WINDOW_DAYS`, `services/moneyHabits.ts` | `share_gift_flows`: `p_window_days int DEFAULT 14` |
| `next_goal.prompt_window_days` | 2 | D.15 | Proposal (S07.4): a next goal set within 2 days counts as answering the celebration's prompt | Not stored in Core | `family_money_events`: `r.at + interval '2 days'` |
| `post_goal.baseline_days` | 28 | D.15 | Proposal (S07.4): the child's own pre-completion baseline (Appendix H) | Not stored in Core | `family_money_events`: `r.at - interval '28 days'` |
| `post_goal.after_days` | 14 | D.15 | Appendix H: "the 1-2 weeks following" a goal reached | Not stored in Core | `family_money_events`: `r.at + interval '14 days'` |
| `redemption_timing.first_bin_hours` | 24 | D.13 | Proposal (S07.4): the first day after a credit, when Heath and Soll's rigidity effect should be strongest | Not stored in Core | `family_money_events`: `(1, '0_24h', 0, 24)` |
| `redemption_timing.second_bin_hours` | 72 | D.13 | Proposal (S07.4) | Not stored in Core | `family_money_events`: `(2, '24_72h', 24, 72)` |
| `redemption_timing.third_bin_hours` | 168 | D.13 | Proposal (S07.4): one week, the allowance cadence most families use | Not stored in Core | `family_money_events`: `(3, '72_168h', 72, 168)` |
| `money_events.retention_days` | 400 | D.13, D.15 (D.21) | The same bound as `learning_events` (0025) | Not stored in Core; the insights maintenance workflow calls it | `family_money_events`: `p_retain_days int DEFAULT 400` |
| `autonomy.level2_min_age` | 8 | D.17 | Proposal (S07.5): the earliest age at which a child can plausibly self-direct a family contribution; Appendix G §4.3 gives no age, only "gradual" | `AUTONOMY_LEVEL2_MIN_AGE`, `services/familyAutonomy.ts` | `family_autonomy_ladder`: `'level2_min_age', 8,` |
| `autonomy.level2_min_approved` | 10 | D.17 | Proposal (S07.5): about two weeks of chores for a family that sets one a day | `AUTONOMY_LEVEL2_MIN_APPROVED`, `services/familyAutonomy.ts` | `family_autonomy_ladder`: `'level2_min_approved', 10,` |
| `autonomy.level2_max_not_approved_pct` | 25 | D.17 | Proposal (S07.5): at most 1 in 4 requests not approved | `AUTONOMY_LEVEL2_MAX_NOT_APPROVED_PCT`, `services/familyAutonomy.ts` | `family_autonomy_ladder`: `'level2_max_not_approved_pct', 25,` |
| `autonomy.level2_preapproved_cap` | 20 | D.17 | Proposal (S07.5): a small reward, well under the 1-500 coin catalog range | `AUTONOMY_LEVEL2_PREAPPROVED_CAP`, `services/familyAutonomy.ts` | `family_autonomy_ladder`: `'level2_preapproved_cap', 20,` |
| `autonomy.level3_min_age` | 12 | D.17 | Proposal (S07.5): just before the 13-15 autonomy jump Beyers et al. (2024) document | `AUTONOMY_LEVEL3_MIN_AGE`, `services/familyAutonomy.ts` | `family_autonomy_ladder`: `'level3_min_age', 12,` |
| `autonomy.level3_min_approved` | 20 | D.17 | Proposal (S07.5) | `AUTONOMY_LEVEL3_MIN_APPROVED`, `services/familyAutonomy.ts` | `family_autonomy_ladder`: `'level3_min_approved', 20,` |
| `autonomy.level3_max_not_approved_pct` | 20 | D.17 | Proposal (S07.5): at most 1 in 5 | `AUTONOMY_LEVEL3_MAX_NOT_APPROVED_PCT`, `services/familyAutonomy.ts` | `family_autonomy_ladder`: `'level3_max_not_approved_pct', 20,` |
| `autonomy.level3_min_days_at_level2` | 28 | D.17 | Proposal (S07.5): gradual, never abrupt independence (Beyers et al. 2024, "gradual separators") | `AUTONOMY_LEVEL3_MIN_DAYS_AT_LEVEL2`, `services/familyAutonomy.ts` | `family_autonomy_ladder`: `'level3_min_days_at_level2', 28,` |
| `autonomy.level3_preapproved_cap` | 100 | D.17 | Proposal (S07.5) | `AUTONOMY_LEVEL3_PREAPPROVED_CAP`, `services/familyAutonomy.ts` | `family_autonomy_ladder`: `'level3_preapproved_cap', 100,` |
| `autonomy.level3_self_log_max_coins` | 100 | D.17 | Proposal (S07.5): a chore worth more still waits for a Tutor | `AUTONOMY_LEVEL3_SELF_LOG_MAX_COINS`, `services/familyAutonomy.ts` | `family_autonomy_ladder`: `'level3_self_log_max_coins', 100,` |
| `autonomy.record_window_days` | 60 | D.17 | Proposal (S07.5): recent enough to reflect the child now | `AUTONOMY_RECORD_WINDOW_DAYS`, `services/familyAutonomy.ts` | `family_autonomy_ladder`: `'record_window_days', 60,` |
| `autonomy.auto_step_down_questioned` | 3 | D.17 | Proposal (S07.5), after the Appendix D demotion precedent: corroborated, never one event | `AUTONOMY_AUTO_STEP_DOWN_QUESTIONED`, `services/familyAutonomy.ts` | `family_autonomy_ladder`: `'auto_step_down_questioned', 3,` |
| `autonomy.auto_step_down_window_days` | 30 | D.17 | Proposal (S07.5) | `AUTONOMY_AUTO_STEP_DOWN_WINDOW_DAYS`, `services/familyAutonomy.ts` | `family_autonomy_ladder`: `'auto_step_down_window_days', 30,` |
| `autonomy.progression_window_days` | 30 | D.17 | Proposal (S07.5) for Appendix H's "defined window" of the Independence-Tier Progression Rate | `AUTONOMY_PROGRESSION_WINDOW_DAYS`, `services/familyAutonomy.ts` | `family_autonomy_ladder`: `'progression_window_days', 30,` |
| `decisions.reason_min_chars` | 12 | D.18 | Proposal (S07.5): shorter than any next step a child can act on | `DECISION_REASON_MIN_CHARS`, `services/familyAutonomy.ts` | `family_autonomy_ladder`: `'reason_min_chars', 12,` |
| `decisions.reason_min_words` | 3 | D.18 | Proposal (S07.5): "not now" and its equivalents have two | `DECISION_REASON_MIN_WORDS`, `services/familyAutonomy.ts` | `family_autonomy_ladder`: `'reason_min_words', 3,` |
| `decisions.revisit_max_days` | 90 | D.18 | Proposal (S07.5): a "later" further away is not a next step | `DECISION_REVISIT_MAX_DAYS`, `services/familyAutonomy.ts` | `family_autonomy_ladder`: `'revisit_max_days', 90,` |
| `decisions.child_note_max_chars` | 140 | D.18 | Proposal (S07.5): one short message | `CHILD_NOTE_MAX_CHARS`, `services/familyAutonomy.ts` | `family_autonomy_ladder`: `'child_note_max_chars', 140,` |
| `talk.nudge_denials` | 3 | D.18 | Proposal (S07.5) for the SPEC's "defined pattern of repeated denials" | `TALK_NUDGE_DENIALS`, `services/familyAutonomy.ts` | `family_autonomy_ladder`: `'talk_nudge_denials', 3,` |
| `talk.nudge_window_days` | 14 | D.18 | Proposal (S07.5): two weeks, and at most one nudge per child in that time | `TALK_NUDGE_WINDOW_DAYS`, `services/familyAutonomy.ts` | `family_autonomy_ladder`: `'talk_nudge_window_days', 14,` |

## Review history

| Date | Keys | Decision | By |
|---|---|---|---|
| 2026-09-24 | All rows | Initial values recorded with S07.3. The rest-day count and milestones come from the Bible and OD-7; the per-ten ratio and the 13-year cutoff come from the SPEC; the pause bounds and the contribution cap are Engineering proposals awaiting Product review. | Engineering (S07 lane) |
| 2026-09-25 | `split.*`, `share.*`, `next_goal.*`, `post_goal.*`, `redemption_timing.*`, `money_events.retention_days` | Initial values recorded with S07.4. The recommended split, the Share limits and windows and the metric bins are Engineering proposals awaiting Product review; the retention bound reuses the learning-events bound. | Engineering (S07 lane) |
| 2026-09-24 | `autonomy.*`, `decisions.*`, `talk.*` | Initial values recorded with S07.5 (D.17, D.18). Every value is an Engineering proposal awaiting Product and Safety review: Appendix G supports gradual, volitional fading and a mandatory actionable reason, but gives no number for any of them. | Engineering (S07 lane) |

## What a recalibration looks at

- Rest days and pauses: the Chore Streak rest-day utilization metric (`GET /api/v1/admin/family/chore-streak-rest-days`). A very high share of runs ended by a third missed day would argue for a different allowance; a very low use of pauses would argue the pause is hard to find, not unwanted.
- The contribution cap: the Chore-Tag Adoption metric (`GET /api/v1/admin/family/chore-tag-adoption`), read together with qualitative feedback from families.
- The bonus framing: the Age-Tier Bonus Comprehension Proxy (`GET /api/v1/admin/family/savings-bonus-comprehension`). No literature benchmark exists (Appendix G §2.4), so the first quarters establish a baseline.
- The recommended split: Split-Ratio Engagement Quality (`GET /api/v1/admin/family/split-engagement`). A near-zero adjusted share says the default has become rote; a very high one says it fits few children.
- The redemption bins: the Allowance-Triggered Redemption Spike (`GET /api/v1/admin/family/redemption-timing`), allowance against earned credits.
- The Share window and limit: the Share-Bucket Destination Completion Rate (`GET /api/v1/admin/family/share-completion`), including holders with Share coins and no place.
- The post-goal windows: the Post-Goal Motivation Cliff and Save-Bucket Contribution Persistence (`GET /api/v1/admin/family/post-goal-motivation`, `/save-persistence`).
- The independence ladder: the Independence-Tier Progression Rate and the step-downs by who lowered a level (`GET /api/v1/admin/family/autonomy-progression`). A near-zero progression rate says the rule is too strict or the ladder is hard to find; many system or Tutor step-downs soon after a promotion say a level opens too early.
- The reason rule and the nudge: the Denial-Reason Actionability Rate (a human-scored, consent-gated sample, `GET /api/v1/admin/family/denial-actionability` and `/denial-reasons/sample`) and the Repeated-Denial Communication-Nudge Trigger Rate (`GET /api/v1/admin/family/talk-nudges`). Reasons that pass the structural check but score as not actionable argue for a stricter check or better prompts, never for dropping the requirement.

None of these thresholds is presented to families as scientifically proven (Block D Part 4 governance boundary).
