import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { REST_DAYS_PER_WEEK, STREAK_MILESTONES } from '../services/choreStreak.js';
import { BONUS_PER_TEN_COINS, BONUS_PER_TEN_RATE_BP, BONUS_PER_TEN_UNIT, MAX_BONUS_RATE_BP, PERCENT_FRAMING_MIN_AGE } from '../services/savingsBonus.js';
import { MAX_CONTRIBUTION_COINS, PAUSE_MAX_BACKDATE_DAYS, PAUSE_MAX_DAYS, PAUSE_MAX_LEAD_DAYS } from '../routes/tasks.js';
import * as autonomy from '../services/familyAutonomy.js';
import { REGISTER_TEEN_MIN_AGE, REGISTER_TRANSITION_MIN_AGE, TEEN_STATEMENT_LINES } from '../services/moneyPresentation.js';
import { ENGAGEMENT_ACTIVE_DAYS } from '../services/insights.js';
import { RECOMMENDED_SAVE_PCT, RECOMMENDED_SHARE_PCT, RECOMMENDED_SPEND_PCT, RECOMMENDED_SPLIT, SHARE_COMPLETION_WINDOW_DAYS, SHARE_GIFT_MAX_COINS } from '../services/moneyHabits.js';

/*
 * Appendix H's Block D Threshold Recalibration Log is enforced, not only
 * written: every value in docs/operations/BLOCK-D-THRESHOLD-LOG.md must equal
 * the constant Core uses AND the number the database migration enforces. A
 * recalibration that changes one without the others fails here.
 */

const root = fileURLToPath(new URL('../../../', import.meta.url));
const log = readFileSync(join(root, 'docs/operations/BLOCK-D-THRESHOLD-LOG.md'), 'utf8');
const migrations = readdirSync(join(root, 'database/migrations')).filter((f) => f.endsWith('.sql'));
const migration = (suffix: string) => {
  const name = migrations.find((f) => f.endsWith(`${suffix}.sql`));
  if (!name) throw new Error(`no migration ending ${suffix}`);
  return readFileSync(join(root, 'database/migrations', name), 'utf8');
};

const values = new Map([...log.matchAll(/^\| `([a-z0-9_.]+)` \| ([^|]+) \|/gm)].map((m) => [m[1]!, m[2]!.trim()]));
const num = (key: string) => {
  const raw = values.get(key);
  if (raw === undefined) throw new Error(`threshold ${key} is missing from the log`);
  return Number(raw);
};

describe('Block D threshold log (Appendix H Part 1.4)', () => {
  const streak = migration('_chore_streak_rest_days');
  const kinds = migration('_family_task_contribution_kind');
  const bonus = migration('_savings_bonus_age_framing');

  it('lists every threshold exactly once', () => {
    expect([...values.keys()].sort()).toEqual([
      'autonomy.auto_step_down_questioned',
      'autonomy.auto_step_down_window_days',
      'autonomy.level2_max_not_approved_pct',
      'autonomy.level2_min_age',
      'autonomy.level2_min_approved',
      'autonomy.level2_preapproved_cap',
      'autonomy.level3_max_not_approved_pct',
      'autonomy.level3_min_age',
      'autonomy.level3_min_approved',
      'autonomy.level3_min_days_at_level2',
      'autonomy.level3_preapproved_cap',
      'autonomy.level3_self_log_max_coins',
      'autonomy.progression_window_days',
      'autonomy.record_window_days',
      'chore.contribution_max_coins',
      'chore_streak.completion_day_tolerance_days',
      'chore_streak.milestones',
      'chore_streak.pause_live_limit',
      'chore_streak.pause_max_backdate_days',
      'chore_streak.pause_max_days',
      'chore_streak.pause_max_lead_days',
      'chore_streak.rest_days_per_week',
      'decisions.child_note_max_chars',
      'decisions.reason_min_chars',
      'decisions.reason_min_words',
      'decisions.revisit_max_days',
      'engagement.active_days',
      'money_events.retention_days',
      'next_goal.prompt_window_days',
      'post_goal.after_days',
      'post_goal.baseline_days',
      'redemption_timing.first_bin_hours',
      'redemption_timing.second_bin_hours',
      'redemption_timing.third_bin_hours',
      'register.teen_min_age',
      'register.teen_statement_lines',
      'register.transition_min_age',
      'savings_bonus.max_rate_bp',
      'savings_bonus.per_ten_coins',
      'savings_bonus.per_ten_unit',
      'savings_bonus.percent_min_age',
      'share.completion_window_days',
      'share.destination_limit',
      'share.gift_max_coins',
      'split.recommended_save_pct',
      'split.recommended_share_pct',
      'split.recommended_spend_pct',
      'staff_insight.retention_days',
      'talk.nudge_denials',
      'talk.nudge_window_days',
    ]);
  });

  it('matches the chore streak model and the OD-7 milestones', () => {
    expect(num('chore_streak.rest_days_per_week')).toBe(REST_DAYS_PER_WEEK);
    expect(values.get('chore_streak.milestones')).toBe(STREAK_MILESTONES.join(', '));
  });

  it('matches the holiday pause bounds in Core and in the database', () => {
    const days = num('chore_streak.pause_max_days');
    expect(days).toBe(PAUSE_MAX_DAYS);
    expect(streak).toContain(`ends_on - starts_on < ${days}`);
    expect(streak).toContain(`NEW.ends_on - NEW.starts_on >= ${days}`);
    const back = num('chore_streak.pause_max_backdate_days');
    expect(back).toBe(PAUSE_MAX_BACKDATE_DAYS);
    expect(streak).toContain(`NEW.starts_on < v_today - ${back}`);
    const lead = num('chore_streak.pause_max_lead_days');
    expect(lead).toBe(PAUSE_MAX_LEAD_DAYS);
    expect(streak).toContain(`NEW.starts_on > v_today + ${lead}`);
    expect(streak).toMatch(new RegExp(`>= ${num('chore_streak.pause_live_limit')} THEN\\s+RAISE EXCEPTION 'STREAK_PAUSE_LIMIT'`));
    const tolerance = num('chore_streak.completion_day_tolerance_days');
    expect(streak).toContain(`NOT BETWEEN v_today - ${tolerance} AND v_today + ${tolerance}`);
  });

  it('matches the contribution cap in Core and in the database', () => {
    const cap = num('chore.contribution_max_coins');
    expect(cap).toBe(MAX_CONTRIBUTION_COINS);
    expect(kinds).toContain(`kind = 'contribution' AND reward_coins BETWEEN 0 AND ${cap}`);
    expect(kinds).toContain(`NEW.reward_coins NOT BETWEEN 0 AND ${cap}`);
  });

  it('matches the savings bonus framing in Core and in the database', () => {
    const coins = num('savings_bonus.per_ten_coins');
    const unit = num('savings_bonus.per_ten_unit');
    expect(coins).toBe(BONUS_PER_TEN_COINS);
    expect(unit).toBe(BONUS_PER_TEN_UNIT);
    expect(BONUS_PER_TEN_RATE_BP).toBe((coins / unit) * 10000);
    expect(bonus).toContain(`WHEN 'per_ten' THEN greatest(v_save_balance, 0) / ${unit / coins}`);
    expect(bonus).toContain(`NEW.rate_bp <> ${BONUS_PER_TEN_RATE_BP}`);
    const age = num('savings_bonus.percent_min_age');
    expect(age).toBe(PERCENT_FRAMING_MIN_AGE);
    expect(bonus).toContain(`::int < ${age} THEN`);
    const max = num('savings_bonus.max_rate_bp');
    expect(max).toBe(MAX_BONUS_RATE_BP);
    expect(migration('_banca_digital')).toContain(`rate_bp between 0 and ${max}`);
  });

  it('matches the S07.4 recommended split, Share bounds and diagnostic windows in Core and in the database', () => {
    const split = migration('_wallet_usual_split');
    const share = migration('_share_gift_destinations');
    const events = migration('_family_money_events');
    expect([num('split.recommended_save_pct'), num('split.recommended_spend_pct'), num('split.recommended_share_pct')])
      .toEqual([RECOMMENDED_SAVE_PCT, RECOMMENDED_SPEND_PCT, RECOMMENDED_SHARE_PCT]);
    expect(RECOMMENDED_SPLIT.save + RECOMMENDED_SPLIT.spend + RECOMMENDED_SPLIT.share).toBe(100);
    expect(split).toContain(`SELECT ${RECOMMENDED_SAVE_PCT} AS save_pct, ${RECOMMENDED_SPEND_PCT} AS spend_pct, ${RECOMMENDED_SHARE_PCT} AS share_pct`);
    expect(num('share.gift_max_coins')).toBe(SHARE_GIFT_MAX_COINS);
    expect(share).toContain(`amount BETWEEN 1 AND ${SHARE_GIFT_MAX_COINS}`);
    expect(share).toMatch(new RegExp(`>= ${num('share.destination_limit')} THEN\\s+RAISE EXCEPTION 'SHARE_DESTINATION_LIMIT'`));
    expect(num('share.completion_window_days')).toBe(SHARE_COMPLETION_WINDOW_DAYS);
    expect(migration('_share_gift_flows')).toContain(`p_window_days int DEFAULT ${SHARE_COMPLETION_WINDOW_DAYS}`);
    expect(migration('_share_gift_flows')).toContain(`p_amount NOT BETWEEN 1 AND ${SHARE_GIFT_MAX_COINS}`);
    expect(events).toContain(`p_retain_days int DEFAULT ${num('money_events.retention_days')}`);
    expect(events).toContain(`(1, '0_24h', 0, ${num('redemption_timing.first_bin_hours')})`);
  });

  it('matches the S07.5 ladder, reason rule and nudge thresholds in Core and in the database', () => {
    const ladder = migration('_family_autonomy_ladder');
    const pairs: [string, number, string][] = [
      ['autonomy.level2_min_age', autonomy.AUTONOMY_LEVEL2_MIN_AGE, 'level2_min_age'],
      ['autonomy.level2_min_approved', autonomy.AUTONOMY_LEVEL2_MIN_APPROVED, 'level2_min_approved'],
      ['autonomy.level2_max_not_approved_pct', autonomy.AUTONOMY_LEVEL2_MAX_NOT_APPROVED_PCT, 'level2_max_not_approved_pct'],
      ['autonomy.level2_preapproved_cap', autonomy.AUTONOMY_LEVEL2_PREAPPROVED_CAP, 'level2_preapproved_cap'],
      ['autonomy.level3_min_age', autonomy.AUTONOMY_LEVEL3_MIN_AGE, 'level3_min_age'],
      ['autonomy.level3_min_approved', autonomy.AUTONOMY_LEVEL3_MIN_APPROVED, 'level3_min_approved'],
      ['autonomy.level3_max_not_approved_pct', autonomy.AUTONOMY_LEVEL3_MAX_NOT_APPROVED_PCT, 'level3_max_not_approved_pct'],
      ['autonomy.level3_min_days_at_level2', autonomy.AUTONOMY_LEVEL3_MIN_DAYS_AT_LEVEL2, 'level3_min_days_at_level2'],
      ['autonomy.level3_preapproved_cap', autonomy.AUTONOMY_LEVEL3_PREAPPROVED_CAP, 'level3_preapproved_cap'],
      ['autonomy.level3_self_log_max_coins', autonomy.AUTONOMY_LEVEL3_SELF_LOG_MAX_COINS, 'level3_self_log_max_coins'],
      ['autonomy.record_window_days', autonomy.AUTONOMY_RECORD_WINDOW_DAYS, 'record_window_days'],
      ['autonomy.auto_step_down_questioned', autonomy.AUTONOMY_AUTO_STEP_DOWN_QUESTIONED, 'auto_step_down_questioned'],
      ['autonomy.auto_step_down_window_days', autonomy.AUTONOMY_AUTO_STEP_DOWN_WINDOW_DAYS, 'auto_step_down_window_days'],
      ['autonomy.progression_window_days', autonomy.AUTONOMY_PROGRESSION_WINDOW_DAYS, 'progression_window_days'],
      ['decisions.reason_min_chars', autonomy.DECISION_REASON_MIN_CHARS, 'reason_min_chars'],
      ['decisions.reason_min_words', autonomy.DECISION_REASON_MIN_WORDS, 'reason_min_words'],
      ['decisions.revisit_max_days', autonomy.DECISION_REVISIT_MAX_DAYS, 'revisit_max_days'],
      ['decisions.child_note_max_chars', autonomy.CHILD_NOTE_MAX_CHARS, 'child_note_max_chars'],
      ['talk.nudge_denials', autonomy.TALK_NUDGE_DENIALS, 'talk_nudge_denials'],
      ['talk.nudge_window_days', autonomy.TALK_NUDGE_WINDOW_DAYS, 'talk_nudge_window_days'],
    ];
    for (const [key, core, sqlKey] of pairs) {
      expect(num(key), key).toBe(core);
      expect(ladder, key).toContain(`'${sqlKey}', ${core},`);
    }
    // The client mirrors the caps it shows.
    expect(autonomy.PREAPPROVED_CAP).toEqual({ 1: 0, 2: num('autonomy.level2_preapproved_cap'), 3: num('autonomy.level3_preapproved_cap') });
  });

  it('matches the S07.6 registers and staff insight windows in Core and in the database', () => {
    expect(num('register.transition_min_age')).toBe(REGISTER_TRANSITION_MIN_AGE);
    expect(migration('_family_money_register')).toContain(`v_age >= ${REGISTER_TRANSITION_MIN_AGE} THEN`);
    // One design with D.11: the teen register starts exactly where the percentage framing does.
    expect(num('register.teen_min_age')).toBe(REGISTER_TEEN_MIN_AGE);
    expect(REGISTER_TEEN_MIN_AGE).toBe(PERCENT_FRAMING_MIN_AGE);
    expect(num('register.teen_statement_lines')).toBe(TEEN_STATEMENT_LINES);
    expect(num('engagement.active_days')).toBe(ENGAGEMENT_ACTIVE_DAYS);
    expect(migration('_family_engagement_insight')).toContain(`p_active_days int DEFAULT ${ENGAGEMENT_ACTIVE_DAYS}`);
    expect(migration('_family_engagement_insight')).toContain(`p_retain_days int DEFAULT ${num('staff_insight.retention_days')}`);
  });

  it('keeps a review history with a dated first entry', () => {
    expect(log).toMatch(/## Review history[\s\S]*\| 2026-09-24 \|/);
  });
});
