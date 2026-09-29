/*
 * C.22 / Appendix E §3.1 (Tier 2 "released via canary rollout") / Appendix F
 * Part 3 Stage 5: the canary delivery path, Core's half.
 *
 * A Tier 2 proposal reaches "a small percentage of real sessions first"
 * through an H.7 experiment on surface `tutor`, target `mentor.canary`,
 * listed in docs/rebuild/mentor/governance/canaries.json (generated into
 * `mentorCanaryTables.generated.ts`). At session start Core decides this
 * learner's arm and records the exposure; the negotiated session context
 * carries `{ proposalId, arm, overrides }` to Oracle (never the sealed model
 * context). Oracle reports the arm it actually ran at close and Core stores
 * it on the session row (`tutor_sessions.canary_proposal_id`, `canary_arm`),
 * which the Mentor-quality dashboard reads as canary against control.
 *
 * WHO MAY BE IN A CANARY (OD-23: experiments are adults only until the owner
 * decides otherwise). Only a learner Core already treats as a verified adult
 * for the Mentor's safeguards (`resolveMentorSafety` says not a minor: the
 * latest service-owned ID verification proves 18+), whose dialogue band is
 * adult, and whom the adult analytics rule admits. Every other population —
 * a kid-role account, an unverified or unknown age, a teen, a declared adult
 * without verification, an adult who turned analytics off — is never asked
 * for an assignment and never exposed.
 *
 * THE SHARE. The H.7 runtime splits an experiment's eligible learners 50/50.
 * A canary is a small share, so Core first draws a deterministic pool
 * (`2 × share` of eligible learners, hashed with its own salt so it is
 * independent of the runtime's A/B draw); only a pooled learner is exposed,
 * which makes the canary arm about `share` of eligible sessions and the
 * matched control arm the same size. A learner never flips arms.
 *
 * Tier 1 (component governance.model).
 */

import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { AgeScreenState } from '../ageScreen.js';
import { allowsSelfManagedAnalytics } from '../analyticsPreference.js';
import { getExperimentAssignments, recordExperimentExposure } from '../learningIntel.js';
import { serviceRest } from '../supabaseRest.js';
import type { DialogueBand } from './dialogueCalibration.js';
import {
  MENTOR_CANARIES,
  MENTOR_CANARY_MAX_SHARE,
  MENTOR_CANARY_TARGET,
  TIER2_PARAMETERS,
  type MentorCanaryEntry,
} from './mentorCanaryTables.generated.js';

export const CANARY_ARMS = ['canary', 'control'] as const;
export type CanaryArm = (typeof CANARY_ARMS)[number];

/** Why a session is or is not in a canary (logged, never sent). */
export type CanaryAssignment =
  | 'no_canary'
  | 'not_eligible'
  | 'no_consent'
  | 'not_sampled'
  | 'runtime_unavailable'
  | 'experiment';

export const PROPOSAL_ID = /^P-\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/;

export interface MentorCanaryContext {
  proposalId: string;
  arm: CanaryArm;
  overrides: Record<string, number>;
}

/** Every override is a registered Tier 2 parameter, a finite number inside its bounds (integers where required). */
export function validOverrides(overrides: Readonly<Record<string, number>>): boolean {
  const entries = Object.entries(overrides);
  return (
    entries.length > 0 &&
    entries.every(([key, value]) => {
      const p = Object.prototype.hasOwnProperty.call(TIER2_PARAMETERS, key) ? TIER2_PARAMETERS[key] : undefined;
      return (
        p !== undefined &&
        typeof value === 'number' &&
        Number.isFinite(value) &&
        value >= p.min &&
        value <= p.max &&
        (!p.integer || Number.isInteger(value))
      );
    })
  );
}

/** A deterministic draw in [0, 1) for one learner and one canary, independent of the runtime's A/B draw. */
export function canaryPoolDraw(experimentId: string, userId: string): number {
  const digest = createHash('sha256').update(`mentor.canary.pool:${experimentId}:${userId}`).digest();
  return digest.readUInt32BE(0) / 2 ** 32;
}

/** Whether this learner falls in the canary's pool (both arms together: twice the share). */
export function inCanaryPool(entry: Pick<MentorCanaryEntry, 'experimentId' | 'share'>, userId: string): boolean {
  const share = Math.min(entry.share, MENTOR_CANARY_MAX_SHARE);
  return share > 0 && canaryPoolDraw(entry.experimentId, userId) < 2 * share;
}

/**
 * This session's canary arm, or null. Never throws and never guesses: a
 * failed runtime read is "no canary", and the exposure is recorded before
 * the arm is returned (a treatment that was not recorded never runs).
 */
export async function resolveMentorCanary(input: {
  userId: string;
  /** From resolveMentorSafety: false only for a verified adult. */
  isMinor: boolean;
  band: DialogueBand;
  /** The exact age when Core knows it; a verified adult without one counts as 18 (the proven floor). */
  age: number | null;
  screening: AgeScreenState;
  manifest?: readonly MentorCanaryEntry[];
}): Promise<{ canary: MentorCanaryContext | null; assignment: CanaryAssignment }> {
  const manifest = (input.manifest ?? MENTOR_CANARIES).filter((c) => PROPOSAL_ID.test(c.proposalId) && validOverrides(c.overrides));
  if (manifest.length === 0) return { canary: null, assignment: 'no_canary' };
  // OD-23: adults only, and "adult" means the Mentor's verified-adult posture, never a role or a declaration alone.
  if (input.isMinor || input.band !== 'adult' || (input.age !== null && input.age < 18)) return { canary: null, assignment: 'not_eligible' };
  if (!(await allowsSelfManagedAnalytics(input.userId, input.screening))) return { canary: null, assignment: 'no_consent' };
  // The ID verification proves 18+; a canary experiment declares no upper age bound (dataintel refuses one).
  const age = input.age ?? 18;
  const assignments = await getExperimentAssignments({ userId: input.userId, surface: 'tutor', target: MENTOR_CANARY_TARGET, age });
  if (assignments === null) return { canary: null, assignment: 'runtime_unavailable' };
  const byExperiment = new Map(manifest.map((c) => [c.experimentId, c]));
  const running = assignments.map((a) => byExperiment.get(a.experimentId)).find((c) => c !== undefined);
  if (!running) return { canary: null, assignment: 'no_canary' };
  if (!inCanaryPool(running, input.userId)) return { canary: null, assignment: 'not_sampled' };
  const exposure = await recordExperimentExposure({
    userId: input.userId,
    experimentId: running.experimentId,
    surface: 'tutor',
    target: MENTOR_CANARY_TARGET,
    age,
  });
  if (exposure === null || exposure.experimentId !== running.experimentId) return { canary: null, assignment: 'runtime_unavailable' };
  const arm: CanaryArm = exposure.variant === 'B' ? 'canary' : 'control';
  return {
    canary: { proposalId: running.proposalId, arm, overrides: arm === 'canary' ? { ...running.overrides } : {} },
    assignment: 'experiment',
  };
}

// ── the close record ─────────────────────────────────────────────────────────

/** What Oracle reports at close: the arm it actually ran. */
export const CanaryReportBody = z
  .object({
    proposalId: z.string().regex(PROPOSAL_ID),
    arm: z.enum(CANARY_ARMS),
  })
  .strict();
export type CanaryReport = z.infer<typeof CanaryReportBody>;

/**
 * Stores the arm on the session row, once. A proposal the manifest does not
 * run is refused (nothing is written): the reading must never count a
 * session under a canary Core did not assign.
 */
export async function recordCanaryArm(input: {
  sessionId: string;
  report: CanaryReport;
  manifest?: readonly MentorCanaryEntry[];
}): Promise<'recorded' | 'refused' | 'failed'> {
  const manifest = input.manifest ?? MENTOR_CANARIES;
  if (!manifest.some((c) => c.proposalId === input.report.proposalId)) return 'refused';
  const res = await serviceRest<unknown>(
    `/tutor_sessions?id=eq.${encodeURIComponent(input.sessionId)}&canary_proposal_id=is.null`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ canary_proposal_id: input.report.proposalId, canary_arm: input.report.arm }),
    },
  );
  return res === null ? 'failed' : 'recorded';
}

// ── the Stage 5 reading sample ───────────────────────────────────────────────

/**
 * A REPRODUCIBLE sample of canary-arm sessions for the person who reads real
 * transcripts before release (Appendix F Stage 5: at least 20). The same seed
 * draws the same sessions, so the reader and a reviewer see one sample.
 */
export function drawCanarySample(sessionIds: readonly string[], size: number, seed: string): string[] {
  const key = (id: string) => createHash('sha256').update(`${seed}:${id}`).digest('hex');
  return [...new Set(sessionIds)]
    .sort((a, b) => key(a).localeCompare(key(b)) || a.localeCompare(b))
    .slice(0, Math.max(0, size));
}

export interface CanaryArmSummary {
  sessions: number;
  scored: number;
  failing: number;
  failShare: number | null;
}

/** Per arm: sessions, sessions with a rules score, and those that failed any rules criterion. */
export function summarizeCanaryArms(
  sessions: readonly { id: string; canary_arm: CanaryArm }[],
  scores: readonly { session_id: string | null; outcome: string }[],
): Record<CanaryArm, CanaryArmSummary> {
  const failing = new Map<string, boolean>();
  for (const s of scores) {
    if (s.session_id === null || s.outcome === 'not_applicable') continue;
    failing.set(s.session_id, (failing.get(s.session_id) ?? false) || s.outcome === 'fail');
  }
  const arm = (name: CanaryArm): CanaryArmSummary => {
    const rows = sessions.filter((s) => s.canary_arm === name);
    const scored = rows.filter((s) => failing.has(s.id));
    const fails = scored.filter((s) => failing.get(s.id)).length;
    return { sessions: rows.length, scored: scored.length, failing: fails, failShare: scored.length === 0 ? null : fails / scored.length };
  };
  return { canary: arm('canary'), control: arm('control') };
}
