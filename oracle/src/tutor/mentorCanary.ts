/*
 * C.22 / Appendix F Part 3 Stage 5: the canary delivery path, Oracle's half.
 *
 * Core resolves a learner's arm of a running `mentor.canary` H.7 experiment
 * at session start and sends it in the NEGOTIATED session context (never in
 * the sealed 14-field model context): `{ proposalId, arm, overrides }`. The
 * overrides move registered Tier 2 parameters (docs/rebuild/mentor/governance/
 * registry.json `tier2Parameters`) and nothing else:
 *
 *   - a key that is not a registered Tier 2 parameter REFUSES the whole
 *     canary: the session runs the approved defaults and reports no arm, so a
 *     session that did not run the change is never counted as a canary;
 *   - a value outside the registry bounds is CLAMPED to them (and an integer
 *     parameter rounded), so no configuration can push a parameter past what
 *     the leads approved;
 *   - the control arm carries no override and runs the defaults.
 *
 * The id / bounds table is generated from the registry
 * (`tier2Parameters.generated.ts`, `npm run canary:check`). This file is
 * Tier 1 (component governance.model).
 */

import { z } from 'zod';
import { TELEMETRY_DEFAULTS, type TelemetryConfig } from './behavioralTelemetry.js';
import { ALLIANCE_DEFAULTS, type AllianceConfig } from './allianceController.js';
import { SELF_EXPLANATION_DEFAULTS, type SelfExplanationConfig } from './selfExplanation.js';
import { TIER2_PARAMETERS, type Tier2ParameterId } from './tier2Parameters.generated.js';

export const CANARY_ARMS = ['canary', 'control'] as const;
export type CanaryArm = (typeof CANARY_ARMS)[number];

const PROPOSAL_ID = /^P-\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/;

/** The context field, closed: an unknown field refuses the context like every other malformed field. */
export const MentorCanarySchema = z
  .object({
    proposalId: z.string().regex(PROPOSAL_ID),
    arm: z.enum(CANARY_ARMS),
    // Keys are checked against the registry in applyCanary (refused, not dropped).
    overrides: z.record(z.string().max(64), z.number().finite()),
  })
  .strict()
  .refine((c) => c.arm === 'canary' || Object.keys(c.overrides).length === 0, 'the control arm carries no override')
  .refine((c) => c.arm === 'control' || Object.keys(c.overrides).length > 0, 'a canary arm carries at least one override');
export type MentorCanary = z.infer<typeof MentorCanarySchema>;

/** What Oracle reports at close, and Core stores on the session row. */
export interface MentorCanaryReport {
  proposalId: string;
  arm: CanaryArm;
}

export interface CanaryConfigs {
  telemetry: TelemetryConfig;
  alliance: AllianceConfig;
  selfExplanation: SelfExplanationConfig;
  /** Null when no canary applies (none sent, or refused). */
  report: MentorCanaryReport | null;
  /** The values actually applied, after clamping (diagnostics and tests). */
  applied: Partial<Record<Tier2ParameterId, number>>;
  refused: string | null;
}

const isTier2 = (key: string): key is Tier2ParameterId => Object.prototype.hasOwnProperty.call(TIER2_PARAMETERS, key);

/** Clamps a value to the parameter's approved bounds (and rounds an integer parameter). */
export function clampTier2(id: Tier2ParameterId, value: number): number {
  const p = TIER2_PARAMETERS[id];
  const bounded = Math.min(p.max, Math.max(p.min, value));
  return p.integer ? Math.min(p.max, Math.max(p.min, Math.round(bounded))) : bounded;
}

const defaults = (): Omit<CanaryConfigs, 'report' | 'applied' | 'refused'> => ({
  telemetry: { ...TELEMETRY_DEFAULTS },
  alliance: { ...ALLIANCE_DEFAULTS },
  selfExplanation: { ...SELF_EXPLANATION_DEFAULTS },
});

/**
 * The three Tier 2 config objects this session runs with. Never throws; an
 * absent or refused canary is exactly the approved defaults.
 */
export function applyCanary(canary: MentorCanary | null | undefined): CanaryConfigs {
  const base = defaults();
  if (!canary) return { ...base, report: null, applied: {}, refused: null };
  const unknown = Object.keys(canary.overrides).filter((key) => !isTier2(key));
  if (unknown.length > 0) {
    return { ...base, report: null, applied: {}, refused: `not a registered Tier 2 parameter: ${unknown.join(', ')}` };
  }
  const applied: Partial<Record<Tier2ParameterId, number>> = {};
  for (const [key, raw] of Object.entries(canary.overrides)) {
    const id = key as Tier2ParameterId;
    const value = clampTier2(id, raw);
    applied[id] = value;
    const { object, field } = TIER2_PARAMETERS[id];
    const target =
      object === 'TELEMETRY_DEFAULTS' ? base.telemetry : object === 'ALLIANCE_DEFAULTS' ? base.alliance : base.selfExplanation;
    (target as unknown as Record<string, number>)[field] = value;
  }
  return { ...base, report: { proposalId: canary.proposalId, arm: canary.arm }, applied, refused: null };
}
