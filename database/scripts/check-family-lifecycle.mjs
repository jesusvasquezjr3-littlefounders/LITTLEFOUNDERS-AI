// check-family-lifecycle.mjs — D.5 / OD-21 as a gate, not a promise.
//
// Appendix H's "Lifecycle-State Completeness Audit": every declared state in
// the Task, Savings Goal, Redemption Request, Wallet Ledger, Guardian Link and
// (S07.2) Personal Reward schemas must have at least one flow that PRODUCES it and at least one that
// CONSUMES it. OD-21 decided "build, not remove" for the states the audit
// found unused, and "no new Block D state may be declared without its
// producing and consuming flow".
//
// How: the CHECK vocabulary of each column is read from the migrations (the
// last definition wins, exactly as PostgreSQL applies them), and compared with
// the registry below. A state added to a CHECK without a registry entry fails;
// a registry entry whose producer or consumer evidence no longer exists in the
// named file fails. Evidence is a literal substring in a real source file, so
// deleting the flow breaks the gate.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const E = (file, text) => ({ file, text });
const SQL = (name) => `database/migrations/*${name}.sql`;
const TASKS = 'backend/src/routes/tasks.ts';
const FAMILY = 'backend/src/routes/family.ts';
const ACTIVITY = 'frontend/src/rebuild/family/WalletActivity.tsx';
const LINKS_UI = 'frontend/src/rebuild/family/CoGuardians.tsx';
// S07.2 (D.3, OD-3 Option B): the self-registered teen's own wallet.
const TEEN_UI = 'frontend/src/rebuild/wallet/TeenWallet.tsx';
const TEEN_FLOWS = SQL('_independent_teen_wallet_flows');
// S07.4 (D.13-D.16): the Share destination, the usual split and the next goal.
const SHARE_SQL = SQL('_share_gift_destinations');
const SHARE_FLOWS = SQL('_share_gift_flows');
const SPLIT_SQL = SQL('_wallet_usual_split');
const NEXT_SQL = SQL('_savings_goal_next_step');
const HABITS_API = 'frontend/src/rebuild/family/moneyHabitsApi.ts';
const SHARE_UI = 'frontend/src/rebuild/family/ShareGiving.tsx';
const GOALS_UI = 'frontend/src/rebuild/family/SavingsGoals.tsx';

export const REGISTRY = {
  'tasks.status': {
    open: { producer: [E(TASKS, "router.post('/', requireRole(['parent'])")], consumer: [E(TASKS, "transitionTaskStatus(id.data, 'open', 'done', { completed_on: todayLocal })")] },
    done: { producer: [E(TASKS, "transitionTaskStatus(id.data, 'open', 'done', { completed_on: todayLocal })")], consumer: [E(TASKS, "transitionTaskStatus(id.data, 'done', 'approved'")] },
    approved: { producer: [E(TASKS, "transitionTaskStatus(id.data, 'done', 'approved'")], consumer: [E(SQL('_family_hub_transition_guards'), "v_task.status <> 'approved'"), E('database/migrations/*_enforce_banking_freeze.sql', "v_task.status <> 'approved'")] },
    cancelled: { producer: [E(TASKS, "'cancelled', {")], consumer: [E('frontend/src/routes/app/tasks/ParentTaskBoard.tsx', "task.status === 'cancelled'")] },
  },
  // S07.3 (D.10): each chore is an expected family contribution or a paid
  // bonus task. Both kinds must stay producible by the Tutor's composer and
  // shown to the child and the Tutor, and the database keeps their coin rules.
  'tasks.kind': {
    contribution: {
      producer: [E(TASKS, "kind: z.enum(['contribution', 'bonus']).default('bonus')"), E('frontend/src/rebuild/family/ChoreComposer.tsx', "(['contribution', 'bonus'] as const)")],
      consumer: [E('frontend/src/routes/app/family/familyMoneyCopy.ts', "kind === 'contribution' ? copy.contribution"), E(SQL('_family_task_contribution_kind'), "NEW.kind = 'contribution' AND NEW.reward_coins NOT BETWEEN 0 AND 2")],
    },
    bonus: {
      producer: [E(TASKS, "kind: z.enum(['contribution', 'bonus']).default('bonus')"), E('frontend/src/rebuild/family/ChoreComposer.tsx', "(['contribution', 'bonus'] as const)")],
      consumer: [E('frontend/src/routes/app/family/familyMoneyCopy.ts', ': copy.bonus}'), E(SQL('_family_task_contribution_kind'), "NEW.kind = 'bonus' AND NEW.reward_coins NOT BETWEEN 1 AND 500")],
    },
  },
  'savings_goals.status': {
    active: { producer: [E(TASKS, 'insertGoal({')], consumer: [E('frontend/src/rebuild/family/SplitChooser.tsx', "g.status === 'active'"), E(SPLIT_SQL, "WHERE id = p_goal_id AND status = 'active' FOR UPDATE")] },
    reached: { producer: [E(SPLIT_SQL, "UPDATE public.savings_goals SET status = 'reached', reached_at = now() WHERE id = p_goal_id"), E(TEEN_FLOWS, "SET status = 'reached', reached_at = now()")],
      consumer: [E(GOALS_UI, "goal.status === 'reached'"), E(HABITS_API, "g.status === 'reached' && g.nextStep !== null")] },
    archived: { producer: [E('backend/src/services/supabaseRest.ts', "status: 'archived'")], consumer: [E(GOALS_UI, "g.status !== 'archived'")] },
  },
  'redemptions.status': {
    requested: { producer: [E(TASKS, 'insertRedemption({')], consumer: [E(SQL('_enforce_banking_freeze'), "v_redemption.status <> 'requested'")] },
    approved: { producer: [E(SQL('_enforce_banking_freeze'), "SET status = 'approved'")], consumer: [E(SQL('_family_hub_lifecycle_flows'), "v_status <> 'approved'")] },
    denied: { producer: [E(SQL('_enforce_banking_freeze'), "SET status = 'denied'")], consumer: [E(ACTIVITY, 'denied: copy.denied')] },
    fulfilled: { producer: [E(SQL('_family_hub_lifecycle_flows'), "SET status = 'fulfilled'")], consumer: [E(ACTIVITY, 'fulfilled: copy.fulfilled')] },
  },
  'wallet_ledger.reason': {
    task_approved: { producer: [E(SQL('_enforce_banking_freeze'), "'task_approved', p_task_id")], consumer: [E(ACTIVITY, 'task_approved: copy.earned')] },
    goal_withdrawal: { producer: [E(SQL('_family_hub_lifecycle_flows'), "'goal_withdrawal', p_goal_id")], consumer: [E(ACTIVITY, 'goal_withdrawal: copy.fromGoal'), E('backend/src/routes/banking.ts', "e.reason === 'goal_withdrawal'")] },
    redemption: { producer: [E(SQL('_enforce_banking_freeze'), "'redemption', p_redemption_id")], consumer: [E(ACTIVITY, 'redemption: copy.spent')] },
    manual_adjustment: { producer: [E(SQL('_family_hub_lifecycle_flows'), "'manual_adjustment', p_actor, v_action")], consumer: [E(ACTIVITY, 'manual_adjustment: copy.correction'), E('backend/src/routes/banking.ts', "e.reason === 'manual_adjustment'")] },
    allowance: { producer: [E(SQL('_enforce_banking_freeze'), "'allowance', p_created_by")], consumer: [E(ACTIVITY, 'allowance: copy.allowance')] },
    savings_bonus: { producer: [E(SQL('_enforce_banking_freeze'), "'savings_bonus', p_kid_user_id")], consumer: [E(ACTIVITY, 'savings_bonus: copy.bonus')] },
    self_income: { producer: [E(TEEN_FLOWS, "'self_income', p_goal_id, p_holder, v_action")], consumer: [E(TEEN_UI, 'self_income: e.source'), E(ACTIVITY, 'self_income: copy.logged')] },
    personal_reward: { producer: [E(TEEN_FLOWS, "'personal_reward', p_holder, v_action")], consumer: [E(TEEN_UI, 'personal_reward: copy.history.reward'), E(ACTIVITY, 'personal_reward: copy.rewardUsed')] },
    goal_release: { producer: [E(TEEN_FLOWS, "'goal_release', p_goal_id, p_holder, v_action")], consumer: [E(TEEN_UI, 'goal_release: copy.history.goalMove'), E('backend/src/routes/banking.ts', "e.reason === 'goal_release'")] },
    // S07.4 (D.14): coins directed to a Share destination, and a pledge that came back.
    share_gift: { producer: [E(SHARE_FLOWS, "'share', -p_amount, 'share_gift', p_holder, v_gift")], consumer: [E(ACTIVITY, 'share_gift: copy.shared'), E(TEEN_UI, 'share_gift: copy.history.shared'), E('backend/src/routes/banking.ts', "e.reason === 'share_gift'")] },
    share_gift_returned: { producer: [E(SHARE_FLOWS, "'share', v_gift.amount, 'share_gift_returned', p_actor, p_gift")], consumer: [E(ACTIVITY, 'share_gift_returned: copy.shareBack'), E(TEEN_UI, 'share_gift_returned: copy.history.shareBack')] },
  },
  // S07.4 (D.14): a family-chosen (or teen-chosen) place for Share coins.
  'share_destinations.status': {
    active: { producer: [E(SHARE_FLOWS, 'INSERT INTO public.share_destinations (holder_user_id, title, kind, chosen_by, created_by)')], consumer: [E(SHARE_SQL, "v_dest.status <> 'active' THEN"), E(SHARE_UI, "d.status === 'active'")] },
    archived: { producer: [E(SHARE_FLOWS, "SET status = 'archived', archived_at = now() WHERE id = p_destination")], consumer: [E(SHARE_FLOWS, "IF v_dest.status <> 'active' THEN"), E(HABITS_API, "v.status === 'archived'")] },
  },
  // S07.4 (D.14): a pledge of Share coins and what really happened with it.
  'share_gifts.status': {
    pledged: { producer: [E(SHARE_FLOWS, 'INSERT INTO public.share_gifts (holder_user_id, destination_id, amount)')], consumer: [E(SHARE_FLOWS, "IF v_gift.status <> 'pledged' THEN"), E(SHARE_UI, "g.status === 'pledged'")] },
    given: { producer: [E(SHARE_FLOWS, "SET status = 'given', settled_at = now()")], consumer: [E(SHARE_UI, "g.status === 'given'"), E('frontend/src/rebuild/family/ShareDestinations.tsx', "g.status === 'given'")] },
    returned: { producer: [E(SHARE_FLOWS, "SET status = 'returned', settled_at = now()")], consumer: [E(SHARE_SQL, "v_status = 'returned'"), E(SHARE_UI, 'returned: copy.returned')] },
  },
  // S07.4 (D.15): "what's your next goal?" after a goal is reached.
  'goal_next_steps.state': {
    pending: { producer: [E(NEXT_SQL, 'INSERT INTO public.goal_next_steps (goal_id, holder_user_id, reached_at)')], consumer: [E(NEXT_SQL, "IF v_state <> 'pending' THEN"), E(HABITS_API, "g.nextStep.state === 'pending'")] },
    prompted: { producer: [E(NEXT_SQL, "SET state = 'prompted', prompted_at = now()")], consumer: [E(NEXT_SQL, "v_state NOT IN ('pending', 'prompted')"), E(HABITS_API, "g.nextStep.state === 'prompted'")] },
    set: { producer: [E(NEXT_SQL, "SET state = 'set', decided_at = now(), next_goal_id = NEW.id")], consumer: [E(NEXT_SQL, "AND state <> 'set'"), E(HABITS_API, "'set', 'declined'].includes")] },
    declined: { producer: [E(NEXT_SQL, "SET state = 'declined', decided_at = now()")], consumer: [E(NEXT_SQL, "OLD.state IN ('pending', 'prompted', 'declined') AND NEW.state = 'set'")] },
  },
  'personal_rewards.status': {
    active: { producer: [E(TEEN_FLOWS, 'INSERT INTO public.personal_rewards (holder_user_id, title, cost)')], consumer: [E(TEEN_UI, "r.status === 'active'"), E(TEEN_FLOWS, "v_reward.status <> 'active'")] },
    archived: { producer: [E(TEEN_FLOWS, "SET status = 'archived', archived_at = now()")], consumer: [E(TEEN_FLOWS, "IF v_status <> 'active' THEN"), E('frontend/src/rebuild/wallet/walletApi.ts', "value.status === 'archived'")] },
  },
  'guardian_links.verification_status': {
    pending: { producer: [E(SQL('_family_hub_lifecycle_flows'), "THEN 'pending' ELSE 'verified' END")], consumer: [E(SQL('_family_hub_lifecycle_flows'), "v_link.verification_status <> 'pending'"), E(LINKS_UI, "g.status === 'pending'")] },
    verified: { producer: [E('backend/src/services/supabaseRest.ts', "verification_status: 'verified'")], consumer: [E('database/migrations/0001_identity.sql', "gl.verification_status = 'verified'")] },
    rejected: { producer: [E(SQL('_family_hub_lifecycle_flows'), "ELSE 'rejected' END")], consumer: [E(LINKS_UI, "g.status === 'rejected'"), E(FAMILY, "verification_status=in.(pending,rejected,revoked)")] },
    revoked: { producer: [E(SQL('_family_hub_lifecycle_flows'), "SET verification_status = 'revoked'")], consumer: [E(LINKS_UI, 'copy.revoked'), E('backend/src/services/familyLifecycle.ts', 'verification_status=in.(pending,rejected,revoked)')] },
  },
};

/** The CHECK vocabulary of `table.column`, as the migrations leave it (last definition wins). */
export function vocabulary(migrations, table, column) {
  let found = null;
  const inList = (text) => [...text.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
  for (const { sql } of migrations) {
    const create = new RegExp(`create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?public\\.${table}\\s*\\(([\\s\\S]*?)\\n\\);`, 'gi');
    for (const block of sql.matchAll(create)) {
      const column_ = new RegExp(`\\b${column}\\s+text[^\\n]*check\\s*\\(\\s*${column}\\s+in\\s*\\(([^)]*)\\)\\s*\\)`, 'i').exec(block[1]);
      if (column_) found = inList(column_[1]);
    }
    const constraint = new RegExp(`add\\s+constraint\\s+${table}_${column}_check\\s+check\\s*\\(\\s*${column}\\s+in\\s*\\(([^)]*)\\)\\s*\\)`, 'gi');
    for (const match of sql.matchAll(constraint)) found = inList(match[1]);
  }
  return found;
}

/** Pure check over in-memory inputs, so the gate itself can be tested against known-bad fixtures. */
export function checkLifecycle({ migrations, readSource, registry = REGISTRY }) {
  const failures = [];
  for (const [key, states] of Object.entries(registry)) {
    const [table, column] = key.split('.');
    const declared = vocabulary(migrations, table, column);
    if (!declared) { failures.push(`${key}: no CHECK vocabulary found in the migrations`); continue; }
    for (const state of declared) {
      if (!states[state]) failures.push(`${key}: state '${state}' is declared but has no registered producing/consuming flow (OD-21)`);
    }
    for (const [state, flows] of Object.entries(states)) {
      if (!declared.includes(state)) failures.push(`${key}: registry names '${state}', which the schema does not declare`);
      for (const side of ['producer', 'consumer']) {
        const hits = flows[side].filter(({ file, text }) => (readSource(file) ?? '').includes(text));
        if (hits.length === 0) failures.push(`${key}.${state}: no ${side} evidence found (${flows[side].map((f) => f.file).join(', ')})`);
      }
    }
  }
  return failures;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const dir = join(root, 'database/migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const migrations = files.map((name) => ({ name, sql: readFileSync(join(dir, name), 'utf8') }));
  const readSource = (path) => {
    if (path.startsWith('database/migrations/*')) {
      const suffix = path.slice('database/migrations/*'.length);
      const name = files.find((f) => f.endsWith(suffix));
      return name ? readFileSync(join(dir, name), 'utf8') : null;
    }
    const full = join(root, path);
    return existsSync(full) ? readFileSync(full, 'utf8') : null;
  };
  const failures = checkLifecycle({ migrations, readSource });
  if (failures.length) {
    for (const failure of failures) console.error(`FAIL: ${failure}`);
    process.exitCode = 1;
  } else {
    const count = Object.values(REGISTRY).reduce((sum, states) => sum + Object.keys(states).length, 0);
    console.log(`family-lifecycle OK — ${count} declared Block D states across ${Object.keys(REGISTRY).length} columns each have a producing and a consuming flow`);
  }
}
