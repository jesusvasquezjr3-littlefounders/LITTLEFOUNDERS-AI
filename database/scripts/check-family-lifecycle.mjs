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
// S07.5 (D.17, D.18): the independence ladder and the decision record.
const AUTONOMY_RULES = SQL('_family_autonomy_rules');
const AUTONOMY_FLOWS = SQL('_family_autonomy_flows');
const DECISION_GUARDS = SQL('_family_decision_guards');
const DECISION_FLOWS = SQL('_family_decision_flows');
const NUDGES_SQL = SQL('_family_talk_nudges');
const AUTONOMY_API = 'frontend/src/rebuild/family/familyAutonomyApi.ts';
const AUTONOMY_SERVICE = 'backend/src/services/familyAutonomy.ts';
const QUEUE_UI = 'frontend/src/rebuild/family/DecisionQueue.tsx';
const CHILD_COPY = 'frontend/src/i18n/en-US/familyAutonomy.json';

export const REGISTRY = {
  // S07.5 (D.17, D.18): every task transition goes through the decision
  // flows; a chore sent back returns to open, a self-logged one is approved.
  'tasks.status': {
    open: {
      producer: [E(TASKS, "router.post('/', requireRole(['parent'])"), E(DECISION_FLOWS, "UPDATE public.tasks SET status = 'open', completed_on = NULL, decision_id = v_decision")],
      consumer: [E(TASKS, 'markTaskDone(id.data, kid.id, todayLocal'), E(DECISION_FLOWS, "UPDATE public.tasks SET status = 'done', completed_on = p_completed_on, child_note = v_note")],
    },
    done: {
      producer: [E(DECISION_FLOWS, "UPDATE public.tasks SET status = 'done', completed_on = p_completed_on, child_note = v_note")],
      consumer: [E(DECISION_FLOWS, "UPDATE public.tasks SET status = 'approved', decided_by = p_actor"), E(QUEUE_UI, "kind: 'approveChore', chore: c")],
    },
    approved: {
      producer: [E(DECISION_FLOWS, "UPDATE public.tasks SET status = 'approved', decided_by = p_actor"), E(DECISION_FLOWS, "UPDATE public.tasks SET status = 'approved', decided_at = now(), decision_id = v_decision")],
      consumer: [E(SQL('_family_hub_transition_guards'), "v_task.status <> 'approved'"), E('database/migrations/*_enforce_banking_freeze.sql', "v_task.status <> 'approved'")],
    },
    cancelled: { producer: [E(DECISION_FLOWS, "UPDATE public.tasks SET status = 'cancelled', decided_by = p_actor")], consumer: [E('frontend/src/routes/app/tasks/ParentTaskBoard.tsx', "task.status === 'cancelled'")] },
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
    requested: { producer: [E(DECISION_FLOWS, 'INSERT INTO public.redemptions (catalog_id, kid_user_id, child_reason_kind, child_note)')], consumer: [E(DECISION_FLOWS, "IF v_redemption.status <> 'requested' THEN")] },
    approved: { producer: [E(DECISION_FLOWS, "UPDATE public.redemptions SET status = 'approved', decided_by = p_actor"), E(DECISION_FLOWS, "UPDATE public.redemptions SET status = 'approved', decided_at = now(), decision_id = v_decision")], consumer: [E(SQL('_family_hub_lifecycle_flows'), "v_status <> 'approved'")] },
    denied: { producer: [E(DECISION_FLOWS, "UPDATE public.redemptions SET status = 'denied', decided_by = p_actor")], consumer: [E(ACTIVITY, 'denied: copy.denied'), E(CHILD_COPY, '"denied": "Not yet"')] },
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
  // S07.5 (D.17): the child's own ask for the next level, and its answer.
  'family_autonomy_requests.status': {
    pending: {
      producer: [E(AUTONOMY_FLOWS, 'INSERT INTO public.family_autonomy_requests (kid_user_id, requested_level, child_note)')],
      consumer: [E(AUTONOMY_FLOWS, "IF v_request.status <> 'pending' THEN"), E(AUTONOMY_SERVICE, 'status=eq.pending')],
    },
    granted: { producer: [E(AUTONOMY_FLOWS, "SET status = 'granted', decision_id = v_decision")], consumer: [E(AUTONOMY_RULES, "IF NEW.status = 'granted' AND")] },
    declined: { producer: [E(AUTONOMY_FLOWS, "SET status = 'declined', decision_id = v_decision")], consumer: [E(AUTONOMY_SERVICE, "z.enum(['pending', 'granted', 'declined'])")] },
  },
  // S07.5 (D.18): every decision on a chore, a reward request or a level request.
  'family_decisions.outcome': {
    approved: { producer: [E(DECISION_GUARDS, "VALUES (NEW.assigned_to, 'task', NEW.id, 'done', 'approved', NEW.decided_by, 'tutor')")], consumer: [E(AUTONOMY_RULES, "count(*) FILTER (WHERE d.outcome = 'approved'"), E(CHILD_COPY, '"approved": "Approved"')] },
    self_logged: { producer: [E(DECISION_FLOWS, "VALUES (p_kid, 'task', p_task, 'done', 'self_logged', p_kid, 'child')")], consumer: [E(AUTONOMY_RULES, "d.outcome IN ('self_logged', 'preapproved')"), E(CHILD_COPY, '"self_logged": "Counted on your own"')] },
    preapproved: { producer: [E(DECISION_FLOWS, "'requested', 'preapproved', p_kid, 'child'")], consumer: [E(AUTONOMY_RULES, "d.outcome IN ('self_logged', 'preapproved')"), E(CHILD_COPY, '"preapproved": "Approved by your level"')] },
    sent_back: { producer: [E(TASKS, "decideChore(req, res, 'sent_back')")], consumer: [E(AUTONOMY_RULES, "p_outcome IN ('sent_back', 'denied', 'questioned')"), E(CHILD_COPY, '"sent_back": "Try again"')] },
    cancelled: { producer: [E(TASKS, "decideChore(req, res, 'cancelled')")], consumer: [E(AUTONOMY_RULES, "(p_outcome = 'cancelled' AND p_prior_status = 'done')"), E(CHILD_COPY, '"cancelled": "Removed"')] },
    denied: { producer: [E(DECISION_FLOWS, "'requested', 'denied', p_actor, 'tutor'")], consumer: [E(AUTONOMY_RULES, "p_outcome IN ('sent_back', 'denied', 'questioned')"), E(CHILD_COPY, '"denied": "Not yet"')] },
    granted: { producer: [E(AUTONOMY_FLOWS, "'pending', 'granted', p_actor, 'tutor'")], consumer: [E(AUTONOMY_RULES, "v_decision.outcome <> NEW.status"), E(CHILD_COPY, '"granted": "New level"')] },
    declined: { producer: [E(AUTONOMY_FLOWS, "'pending', 'declined', p_actor, 'tutor'")], consumer: [E(NUDGES_SQL, "OR v_decision.outcome = 'declined')"), E(CHILD_COPY, '"declined": "Not yet"')] },
    confirmed: { producer: [E(QUEUE_UI, "onAction({ kind: 'confirm', review: d })"), E(TASKS, "outcome: z.enum(['confirmed', 'questioned'])")], consumer: [E(CHILD_COPY, '"confirmed": "Looks good"')] },
    questioned: { producer: [E(QUEUE_UI, "onAction({ kind: 'question', review: d, notYet })"), E(TASKS, "outcome: z.enum(['confirmed', 'questioned'])")], consumer: [E(NUDGES_SQL, "IF NEW.outcome = 'questioned' THEN"), E(CHILD_COPY, '"questioned": "Your Tutor asked"')] },
  },
  // S07.5 (D.18): the "talk about it" nudge.
  'family_talk_nudges.status': {
    open: { producer: [E(NUDGES_SQL, 'INSERT INTO public.family_talk_nudges (kid_user_id, origin, decision_id, denials)')], consumer: [E(AUTONOMY_SERVICE, "'&status=eq.open'"), E(AUTONOMY_API, "v.status === 'open'")] },
    talked: { producer: [E(NUDGES_SQL, 'UPDATE public.family_talk_nudges SET status = p_outcome, closed_by = p_actor'), E(QUEUE_UI, "outcome: 'talked'")], consumer: [E(NUDGES_SQL, "n.status = 'talked'")] },
    dismissed: { producer: [E(NUDGES_SQL, 'UPDATE public.family_talk_nudges SET status = p_outcome, closed_by = p_actor'), E(QUEUE_UI, "outcome: 'dismissed'")], consumer: [E(NUDGES_SQL, "n.status = 'dismissed'")] },
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
