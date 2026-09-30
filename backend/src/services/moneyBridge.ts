import { z } from 'zod';
import { isRefusal, rpc, UNAVAILABLE } from './familyLifecycle.js';
import { MENTOR_QUALITY_THRESHOLDS } from './pedagogy/mentorQuality.js';

/*
 * S07.7 — D.19: the first milestone of the older-teen graduation initiative
 * (docs/operations/OLDER-TEEN-GRADUATION-INITIATIVE.md). From 15, by stored
 * age evidence and never by role, a wallet holder sees three real-world
 * moments (first real pay, first account at a bank, first real budget) with a
 * short checklist each, timed to when they say the moment has arrived. The
 * database decides eligibility and keeps only the teen's own checklist; no
 * real amount, bank or account detail is ever sent (the split tool runs in the
 * browser). Coins never convert and nothing links to a real account.
 */

export const MONEY_BRIDGE_MIN_AGE = 15;
export const BRIDGE_MILESTONES = ['first_pay', 'first_account', 'first_budget'] as const;
export type BridgeMilestone = (typeof BRIDGE_MILESTONES)[number];
/** Step 0 is "this moment has arrived"; steps 1-3 are its checklist. */
export const BRIDGE_STEPS = 3;

const Progress = z.array(z.object({
  milestone: z.enum(BRIDGE_MILESTONES), step: z.number().int().min(0).max(BRIDGE_STEPS), done_at: z.string(),
}).strict());
const State = z.object({ eligible: z.boolean(), progress: Progress }).strict()
  // An ineligible holder never has a checklist to read.
  .refine((s) => s.eligible || s.progress.length === 0);

export interface BridgeState {
  eligible: boolean;
  minAge: number;
  moments: { milestone: BridgeMilestone; arrived: boolean; steps: number[] }[];
}

export function toWireBridge(state: z.infer<typeof State>): BridgeState {
  return {
    eligible: state.eligible,
    minAge: MONEY_BRIDGE_MIN_AGE,
    moments: state.eligible
      ? BRIDGE_MILESTONES.map((milestone) => {
        const mine = state.progress.filter((p) => p.milestone === milestone);
        return { milestone, arrived: mine.some((p) => p.step === 0), steps: mine.filter((p) => p.step > 0).map((p) => p.step).sort() };
      })
      : [],
  };
}

export function readBridge(holderId: string) {
  return rpc('money_bridge_state', { p_holder: holderId }, State);
}

export function markBridge(holderId: string, milestone: BridgeMilestone, step: number, done: boolean) {
  return rpc('money_bridge_mark', { p_holder: holderId, p_milestone: milestone, p_step: step, p_done: done }, State);
}

const Int = z.union([z.number(), z.string().regex(/^-?\d+$/)]).transform((v) => Number(v)).pipe(z.number().int().nonnegative());

/** The B.13 half of learning_narrative_metrics (the other fields are other metrics' and are not read here). */
const NarrativeBridge = z.object({ bridge_prompts_offered: Int, bridge_prompts_converted_7d: Int, bridge_self_commitments: Int });

/**
 * Appendix H Part 1.1: Real-World Bridge Engagement Rate (Diagnostic), read
 * TOGETHER with Appendix C's Real-World Bridge Conversion Rate (B.13), as
 * Appendix H requires ("reviewed together, not independently"; GAP-FIX-R8).
 *
 * `conversion` is the same reading the Mentor-quality dashboard shows as
 * `learning.bridge_conversion` (services/pedagogy/mentorQuality.ts): the
 * learning_narrative_metrics RPC over that dashboard's window
 * (MENTOR_QUALITY_THRESHOLDS.windowDays), prompts offered and converted
 * within 7 days, with its minimum sample. Engagement is cumulative (every
 * currently eligible holder), which the card says. Either read failing is
 * null (a 502): one half alone is the independent review Appendix H rules
 * out, and an unread conversion is never a calm zero.
 */
export async function readBridgeEngagement(now: Date = new Date()) {
  const windowDays = MENTOR_QUALITY_THRESHOLDS.windowDays;
  const [rows, narrative] = await Promise.all([
    rpc('money_bridge_engagement', {}, z.array(z.object({
      milestone: z.enum(['all', ...BRIDGE_MILESTONES]), eligible: Int, engaged: Int, arrived: Int, completed: Int,
    }).strict()).length(4)),
    rpc('learning_narrative_metrics', {
      p_since: new Date(now.getTime() - windowDays * 86_400_000).toISOString(), p_until: now.toISOString(),
    }, NarrativeBridge),
  ]);
  if (rows === UNAVAILABLE || isRefusal(rows) || narrative === UNAVAILABLE || isRefusal(narrative)) return null;
  const offered = narrative.bridge_prompts_offered;
  const converted = narrative.bridge_prompts_converted_7d;
  return {
    minAge: MONEY_BRIDGE_MIN_AGE,
    moments: rows.map((r) => ({
      milestone: r.milestone, eligible: r.eligible, engaged: r.engaged, arrived: r.arrived, completed: r.completed,
      engagementRate: r.eligible > 0 ? r.engaged / r.eligible : null,
    })),
    conversion: {
      requirement: 'B.13' as const,
      metric: 'learning.bridge_conversion' as const,
      windowDays,
      offered,
      converted,
      selfCommitments: narrative.bridge_self_commitments,
      conversionRate: offered > 0 ? converted / offered : null,
      minSample: MENTOR_QUALITY_THRESHOLDS.narrativeMinSample,
      sufficient: offered >= MENTOR_QUALITY_THRESHOLDS.narrativeMinSample,
    },
  };
}
