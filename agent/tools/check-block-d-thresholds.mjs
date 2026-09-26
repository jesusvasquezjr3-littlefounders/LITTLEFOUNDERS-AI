// check-block-d-thresholds.mjs — Appendix H's Block D Threshold
// Recalibration Log as a gate, not a document.
//
// docs/operations/BLOCK-D-THRESHOLD-LOG.md lists every Block D threshold with
// its value. Each value is enforced in two places: a Core constant and a
// number inside a database migration. A recalibration that edits one of the
// three and forgets another would leave the product enforcing a threshold
// nobody reviewed (or reviewing one nothing enforces). This gate reads all
// three from the real files and fails on any disagreement. It runs in the
// unfiltered repo gates, so a migration-only or doc-only change is checked
// too; backend/src/__tests__/blockDThresholds.test.ts checks the same values
// against the live Core constants.

import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const LOG = 'docs/operations/BLOCK-D-THRESHOLD-LOG.md';

/** Every `| \`key\` | value |` row of the log. */
export function readLog(text) {
  return new Map([...text.matchAll(/^\| `([a-z0-9_.]+)` \| ([^|]+) \|/gm)].map((m) => [m[1], m[2].trim()]));
}

/** The literal value of `export const NAME = <number>` (or an `as const` number list) in a source file. */
export function constant(source, name) {
  const scalar = new RegExp(`export const ${name}\\s*=\\s*(\\d+)\\s*;`).exec(source);
  if (scalar) return scalar[1];
  const list = new RegExp(`export const ${name}\\s*=\\s*\\[([\\d,\\s]+)\\]\\s*as const;`).exec(source);
  if (list) return list[1].split(',').map((v) => v.trim()).join(', ');
  return null;
}

/**
 * The rules: for each log key, the Core constant it must equal and the
 * migration text that must contain it. `{v}` is replaced by the log value.
 */
export const RULES = [
  { key: 'chore_streak.rest_days_per_week', core: ['backend/src/services/choreStreak.ts', 'REST_DAYS_PER_WEEK'] },
  { key: 'chore_streak.milestones', core: ['backend/src/services/choreStreak.ts', 'STREAK_MILESTONES'] },
  { key: 'chore_streak.pause_max_days', core: ['backend/src/routes/tasks.ts', 'PAUSE_MAX_DAYS'],
    sql: ['_chore_streak_rest_days', ['ends_on - starts_on < {v}', 'NEW.ends_on - NEW.starts_on >= {v}']] },
  { key: 'chore_streak.pause_max_backdate_days', core: ['backend/src/routes/tasks.ts', 'PAUSE_MAX_BACKDATE_DAYS'],
    sql: ['_chore_streak_rest_days', ['NEW.starts_on < v_today - {v}']] },
  { key: 'chore_streak.pause_max_lead_days', core: ['backend/src/routes/tasks.ts', 'PAUSE_MAX_LEAD_DAYS'],
    sql: ['_chore_streak_rest_days', ['NEW.starts_on > v_today + {v}']] },
  { key: 'chore_streak.pause_live_limit', sql: ['_chore_streak_rest_days', [">= {v} THEN\n            RAISE EXCEPTION 'STREAK_PAUSE_LIMIT'"]] },
  { key: 'chore_streak.completion_day_tolerance_days', sql: ['_chore_streak_rest_days', ['NOT BETWEEN v_today - {v} AND v_today + {v}']] },
  { key: 'chore.contribution_max_coins', core: ['backend/src/routes/tasks.ts', 'MAX_CONTRIBUTION_COINS'],
    sql: ['_family_task_contribution_kind', ["kind = 'contribution' AND reward_coins BETWEEN 0 AND {v}", 'NEW.reward_coins NOT BETWEEN 0 AND {v}']] },
  { key: 'savings_bonus.per_ten_coins', core: ['backend/src/services/savingsBonus.ts', 'BONUS_PER_TEN_COINS'] },
  { key: 'savings_bonus.per_ten_unit', core: ['backend/src/services/savingsBonus.ts', 'BONUS_PER_TEN_UNIT'],
    sql: ['_savings_bonus_age_framing', ["WHEN 'per_ten' THEN greatest(v_save_balance, 0) / {v}"]] },
  { key: 'savings_bonus.percent_min_age', core: ['backend/src/services/savingsBonus.ts', 'PERCENT_FRAMING_MIN_AGE'],
    sql: ['_savings_bonus_age_framing', ['::int < {v} THEN']] },
  { key: 'savings_bonus.max_rate_bp', core: ['backend/src/services/savingsBonus.ts', 'MAX_BONUS_RATE_BP'],
    sql: ['_banca_digital', ['rate_bp between 0 and {v}']] },
  // S07.4 (D.13-D.16).
  { key: 'split.recommended_save_pct', core: ['backend/src/services/moneyHabits.ts', 'RECOMMENDED_SAVE_PCT'], sql: ['_wallet_usual_split', ['{v} AS save_pct']] },
  { key: 'split.recommended_spend_pct', core: ['backend/src/services/moneyHabits.ts', 'RECOMMENDED_SPEND_PCT'], sql: ['_wallet_usual_split', ['{v} AS spend_pct']] },
  { key: 'split.recommended_share_pct', core: ['backend/src/services/moneyHabits.ts', 'RECOMMENDED_SHARE_PCT'], sql: ['_wallet_usual_split', ['{v} AS share_pct']] },
  { key: 'share.destination_limit', sql: ['_share_gift_destinations', ["status = 'active') >= {v} THEN\n            RAISE EXCEPTION 'SHARE_DESTINATION_LIMIT'"]] },
  { key: 'share.gift_max_coins', core: ['backend/src/services/moneyHabits.ts', 'SHARE_GIFT_MAX_COINS'],
    sql: ['_share_gift_destinations', ['amount         integer NOT NULL CHECK (amount BETWEEN 1 AND {v})']] },
  { key: 'share.completion_window_days', core: ['backend/src/services/moneyHabits.ts', 'SHARE_COMPLETION_WINDOW_DAYS'],
    sql: ['_share_gift_flows', ['p_window_days int DEFAULT {v}']] },
  { key: 'next_goal.prompt_window_days', sql: ['_family_money_events', ["n.created_at <= r.at + interval '{v} days'"]] },
  { key: 'post_goal.baseline_days', sql: ['_family_money_events', ["c.created_at > r.at - interval '{v} days' AND c.created_at <= r.at) / {v}.0"]] },
  { key: 'post_goal.after_days', sql: ['_family_money_events', ["c.created_at <= r.at + interval '{v} days') / {v}.0", "e.created_at <= now() - interval '{v} days'"]] },
  { key: 'redemption_timing.first_bin_hours', sql: ['_family_money_events', ["(1, '0_24h', 0, {v})", "(2, '24_72h', {v}, 72)"]] },
  { key: 'redemption_timing.second_bin_hours', sql: ['_family_money_events', ["(2, '24_72h', 24, {v})", "(3, '72_168h', {v}, 168)"]] },
  { key: 'redemption_timing.third_bin_hours', sql: ['_family_money_events', ["(3, '72_168h', 72, {v})", "(4, '168h_plus', {v}, 1000000)"]] },
  { key: 'money_events.retention_days', sql: ['_family_money_events', ['p_retain_days int DEFAULT {v}']] },
  // S07.5 (D.17, D.18): the independence ladder, the reason rule and the nudge.
  { key: 'autonomy.level2_min_age', core: ['backend/src/services/familyAutonomy.ts', 'AUTONOMY_LEVEL2_MIN_AGE'], sql: ['_family_autonomy_ladder', ["'level2_min_age', {v},"]] },
  { key: 'autonomy.level2_min_approved', core: ['backend/src/services/familyAutonomy.ts', 'AUTONOMY_LEVEL2_MIN_APPROVED'], sql: ['_family_autonomy_ladder', ["'level2_min_approved', {v},"]] },
  { key: 'autonomy.level2_max_not_approved_pct', core: ['backend/src/services/familyAutonomy.ts', 'AUTONOMY_LEVEL2_MAX_NOT_APPROVED_PCT'], sql: ['_family_autonomy_ladder', ["'level2_max_not_approved_pct', {v},"]] },
  { key: 'autonomy.level2_preapproved_cap', core: ['backend/src/services/familyAutonomy.ts', 'AUTONOMY_LEVEL2_PREAPPROVED_CAP'], sql: ['_family_autonomy_ladder', ["'level2_preapproved_cap', {v},"]] },
  { key: 'autonomy.level3_min_age', core: ['backend/src/services/familyAutonomy.ts', 'AUTONOMY_LEVEL3_MIN_AGE'], sql: ['_family_autonomy_ladder', ["'level3_min_age', {v},"]] },
  { key: 'autonomy.level3_min_approved', core: ['backend/src/services/familyAutonomy.ts', 'AUTONOMY_LEVEL3_MIN_APPROVED'], sql: ['_family_autonomy_ladder', ["'level3_min_approved', {v},"]] },
  { key: 'autonomy.level3_max_not_approved_pct', core: ['backend/src/services/familyAutonomy.ts', 'AUTONOMY_LEVEL3_MAX_NOT_APPROVED_PCT'], sql: ['_family_autonomy_ladder', ["'level3_max_not_approved_pct', {v},"]] },
  { key: 'autonomy.level3_min_days_at_level2', core: ['backend/src/services/familyAutonomy.ts', 'AUTONOMY_LEVEL3_MIN_DAYS_AT_LEVEL2'], sql: ['_family_autonomy_ladder', ["'level3_min_days_at_level2', {v},"]] },
  { key: 'autonomy.level3_preapproved_cap', core: ['backend/src/services/familyAutonomy.ts', 'AUTONOMY_LEVEL3_PREAPPROVED_CAP'], sql: ['_family_autonomy_ladder', ["'level3_preapproved_cap', {v},"]] },
  { key: 'autonomy.level3_self_log_max_coins', core: ['backend/src/services/familyAutonomy.ts', 'AUTONOMY_LEVEL3_SELF_LOG_MAX_COINS'], sql: ['_family_autonomy_ladder', ["'level3_self_log_max_coins', {v},"]] },
  { key: 'autonomy.record_window_days', core: ['backend/src/services/familyAutonomy.ts', 'AUTONOMY_RECORD_WINDOW_DAYS'], sql: ['_family_autonomy_ladder', ["'record_window_days', {v},"]] },
  { key: 'autonomy.auto_step_down_questioned', core: ['backend/src/services/familyAutonomy.ts', 'AUTONOMY_AUTO_STEP_DOWN_QUESTIONED'], sql: ['_family_autonomy_ladder', ["'auto_step_down_questioned', {v},"]] },
  { key: 'autonomy.auto_step_down_window_days', core: ['backend/src/services/familyAutonomy.ts', 'AUTONOMY_AUTO_STEP_DOWN_WINDOW_DAYS'], sql: ['_family_autonomy_ladder', ["'auto_step_down_window_days', {v},"]] },
  { key: 'autonomy.progression_window_days', core: ['backend/src/services/familyAutonomy.ts', 'AUTONOMY_PROGRESSION_WINDOW_DAYS'], sql: ['_family_autonomy_ladder', ["'progression_window_days', {v},"]] },
  { key: 'decisions.reason_min_chars', core: ['backend/src/services/familyAutonomy.ts', 'DECISION_REASON_MIN_CHARS'], sql: ['_family_autonomy_ladder', ["'reason_min_chars', {v},"]] },
  { key: 'decisions.reason_min_words', core: ['backend/src/services/familyAutonomy.ts', 'DECISION_REASON_MIN_WORDS'], sql: ['_family_autonomy_ladder', ["'reason_min_words', {v},"]] },
  { key: 'decisions.revisit_max_days', core: ['backend/src/services/familyAutonomy.ts', 'DECISION_REVISIT_MAX_DAYS'], sql: ['_family_autonomy_ladder', ["'revisit_max_days', {v},"]] },
  { key: 'decisions.child_note_max_chars', core: ['backend/src/services/familyAutonomy.ts', 'CHILD_NOTE_MAX_CHARS'], sql: ['_family_autonomy_ladder', ["'child_note_max_chars', {v},"]] },
  { key: 'talk.nudge_denials', core: ['backend/src/services/familyAutonomy.ts', 'TALK_NUDGE_DENIALS'], sql: ['_family_autonomy_ladder', ["'talk_nudge_denials', {v},"]] },
  { key: 'talk.nudge_window_days', core: ['backend/src/services/familyAutonomy.ts', 'TALK_NUDGE_WINDOW_DAYS'], sql: ['_family_autonomy_ladder', ["'talk_nudge_window_days', {v},"]] },
  // S07.6 (D.6, D.12): the age registers and the staff insight.
  { key: 'register.transition_min_age', core: ['backend/src/services/moneyPresentation.ts', 'REGISTER_TRANSITION_MIN_AGE'], sql: ['_family_money_register', ['v_age >= {v} THEN']] },
  { key: 'register.teen_min_age', core: ['backend/src/services/moneyPresentation.ts', 'REGISTER_TEEN_MIN_AGE'], sql: ['_savings_bonus_age_framing', ['::int < {v} THEN']] },
  { key: 'register.teen_statement_lines', core: ['backend/src/services/moneyPresentation.ts', 'TEEN_STATEMENT_LINES'] },
  { key: 'engagement.active_days', core: ['backend/src/services/insights.ts', 'ENGAGEMENT_ACTIVE_DAYS'], sql: ['_family_engagement_insight', ['p_active_days int DEFAULT {v}']] },
  { key: 'staff_insight.retention_days', sql: ['_family_engagement_insight', ['p_retain_days int DEFAULT {v}']] },
  // S07.7 (D.19, D.22, D.23): the bridge age, the reflection window and the research windows.
  { key: 'bridge.min_age', core: ['backend/src/services/moneyBridge.ts', 'MONEY_BRIDGE_MIN_AGE'], sql: ['_money_bridge', [', 0) >= {v};']] },
  { key: 'coaching.reflection_window_minutes', core: ['backend/src/services/parentCoaching.ts', 'COACHING_REFLECTION_WINDOW_MINUTES'],
    sql: ['_parent_coaching', ["d.created_at > now() - interval '{v} minutes'"]] },
  { key: 'research.completeness_months', core: ['backend/src/services/familyResearch.ts', 'RESEARCH_COMPLETENESS_MONTHS'],
    sql: ['_family_research_instrumentation', ['p_months int DEFAULT {v}']] },
  { key: 'research.min_tenure_months', core: ['backend/src/services/familyResearch.ts', 'RESEARCH_MIN_TENURE_MONTHS'],
    sql: ['_family_research_instrumentation', ['p_min_tenure_months int DEFAULT {v}']] },
];

/** Pure check over in-memory inputs, so the gate can be tested against known-bad fixtures. */
export function checkThresholds({ log, readSource, readMigration, rules = RULES }) {
  const failures = [];
  const values = readLog(log);
  const known = new Set(rules.map((r) => r.key));
  for (const key of values.keys()) if (!known.has(key)) failures.push(`${key}: in the log but no rule checks it`);
  for (const rule of rules) {
    const value = values.get(rule.key);
    if (value === undefined) { failures.push(`${rule.key}: missing from ${LOG}`); continue; }
    if (rule.core) {
      const [file, name] = rule.core;
      const actual = constant(readSource(file) ?? '', name);
      if (actual === null) failures.push(`${rule.key}: ${name} not found in ${file}`);
      else if (actual !== value) failures.push(`${rule.key}: log says ${value}, ${file} ${name} is ${actual}`);
    }
    if (rule.sql) {
      const [suffix, snippets] = rule.sql;
      const sql = readMigration(suffix);
      if (sql === null) { failures.push(`${rule.key}: no migration ending ${suffix}.sql`); continue; }
      for (const snippet of snippets) {
        const expected = snippet.replaceAll('{v}', value);
        if (!sql.includes(expected)) failures.push(`${rule.key}: migration *${suffix}.sql does not contain "${expected}"`);
      }
    }
  }
  if (!/## Review history[\s\S]*\| \d{4}-\d{2}-\d{2} \|/.test(log)) failures.push(`${LOG}: the review history has no dated entry`);
  return failures;
}

export function liveInputs(root = ROOT) {
  const dir = join(root, 'database/migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  return {
    log: readFileSync(join(root, LOG), 'utf8').replace(/\r\n/g, '\n'),
    readSource: (path) => { try { return readFileSync(join(root, path), 'utf8'); } catch { return null; } },
    readMigration: (suffix) => {
      const name = files.find((f) => f.endsWith(`${suffix}.sql`));
      return name ? readFileSync(join(dir, name), 'utf8').replace(/\r\n/g, '\n') : null;
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const failures = checkThresholds(liveInputs());
  if (failures.length > 0) {
    for (const failure of failures) console.error(`FAIL: ${failure}`);
    process.exit(1);
  }
  console.log(`block-d-thresholds OK — ${RULES.length} thresholds agree across the log, Core and the migrations`);
}
