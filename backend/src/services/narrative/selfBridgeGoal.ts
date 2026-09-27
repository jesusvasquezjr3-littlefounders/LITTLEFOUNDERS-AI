import { z } from 'zod';
import { serviceRestRaw } from '../supabaseRest.js';

/*
 * L-12 (owner decision OD-28): an independent teen's "I will try" on a
 * savings-goal bridge prompt creates the teen's own savings goal, in their
 * personal wallet (OD-3 Option B, D.3). The database function
 * (`*_teen_bridge_own_goal.sql`) creates the goal in the same transaction
 * that closes the prompt, only for the prompt's own learner, only while that
 * learner holds a personal wallet, and returns the stored goal on a replay.
 *
 * DEPLOY ORDER. Core may reach a database that still runs the pre-L-12
 * function, which refuses ANY detail on a self prompt ("a self prompt creates
 * nothing"). That refusal is recognised and the act is repeated with no
 * details, so "I will try" still records the commitment (the pre-L-12
 * behaviour) and reports `GOAL_UNAVAILABLE` instead of failing. Any other
 * failure is a failure.
 */

const Uuid = z.string().uuid();

export type SelfGoalRefusal = 'WALLET_HOLDER_REQUIRED' | 'GOAL_UNAVAILABLE';

const ActResult = z.object({
  status: z.enum(['acted', 'closed', 'forbidden', 'not_found']),
  replayed: z.boolean().optional(),
  goal_id: z.string().nullable().optional(),
  goal_refused: z.enum(['WALLET_HOLDER_REQUIRED']).nullable().optional(),
}).passthrough();

export interface SelfActResult {
  status: 'acted' | 'closed' | 'forbidden' | 'not_found';
  replayed: boolean;
  goalId: string | null;
  goalRefused: SelfGoalRefusal | null;
}

const PRE_L12_REFUSAL = /a self prompt creates nothing/;

async function act(promptId: string, actorId: string, goal: { title: string; target: number; icon: string } | null) {
  return serviceRestRaw('/rpc/act_on_learning_bridge_prompt', {
    method: 'POST',
    body: JSON.stringify({
      p_prompt_id: Uuid.parse(promptId), p_actor_id: Uuid.parse(actorId),
      p_title: goal?.title ?? null, p_amount: goal?.target ?? null, p_icon: goal?.icon ?? null, p_recurrence: null,
    }),
  });
}

function read(body: unknown, refusedBefore: SelfGoalRefusal | null): SelfActResult | null {
  const parsed = ActResult.safeParse(body);
  if (!parsed.success) return null;
  return {
    status: parsed.data.status,
    replayed: parsed.data.replayed === true,
    goalId: parsed.data.goal_id ?? null,
    goalRefused: parsed.data.status === 'acted' && parsed.data.replayed !== true ? parsed.data.goal_refused ?? refusedBefore : null,
  };
}

/**
 * Acts on a self prompt. `goal` is null for a commitment only (an earning-task
 * prompt); for a savings-goal prompt it holds the goal's details. Null = the
 * call failed and nothing can be said about it.
 */
export async function actOnSelfBridgePrompt(input: {
  promptId: string; actorId: string; goal: { title: string; target: number; icon: string } | null;
}): Promise<SelfActResult | null> {
  const first = await act(input.promptId, input.actorId, input.goal);
  if (first.ok) return read(first.body, null);
  const error = z.object({ code: z.string().optional(), message: z.string().optional() }).passthrough().safeParse(first.body);
  if (input.goal === null || !error.success || error.data.code !== '22023' || !PRE_L12_REFUSAL.test(error.data.message ?? '')) return null;
  const fallback = await act(input.promptId, input.actorId, null);
  return fallback.ok ? read(fallback.body, 'GOAL_UNAVAILABLE') : null;
}
