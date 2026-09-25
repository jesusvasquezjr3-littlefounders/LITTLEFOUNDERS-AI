import { z } from 'zod';
import { ADAPTATIONS, type Adaptation } from '../context/schema.js';

/*
 * C.7 — THE LEARNER DISPOSITION PROFILE, AS ORACLE READS AND FEEDS IT.
 *
 * The mastery model answers "what does this learner know"; nothing answered
 * "how does this learner learn best". Core keeps a persistent, cross-session
 * disposition profile (`learner_disposition_profile`), populated at every
 * close from what the Behavioral Telemetry Layer (C.9) and the Alliance
 * Controller (C.15) observed, and sends a derived, closed-vocabulary
 * projection of it in the session context. The pedagogy controller reads it
 * ALONGSIDE the mastery values when it selects a strategy; it never replaces
 * them (C.7: "additive to, not a replacement for").
 *
 * THE PRIVACY BOUNDARY. The projection travels in the SESSION context
 * (`core/client.ts`), which Oracle keeps server-side. It is NOT a field of the
 * sealed model context (`context/schema.ts`, 14 fields, pinned by
 * `privacy-contract-docs.test.ts`), so nothing about a child's disposition
 * ever reaches a third-party model: it changes WHICH strategy the controller
 * picks and which written line the system uses, never what the model is told
 * about the learner. Every field is a closed label or a number; none is an
 * emotion, none is free text.
 *
 * WHAT IT CHANGES (each bounded, each reported at close in `applied` so a
 * parent-facing explanation and the audit can read what it did — Appendix D
 * §2.6's "interpretable, never a black box"):
 *
 *   stuck_degrade_early     `persistence: disengages_early` and/or
 *                           `helpStyle: tell_early` lower the number of
 *                           questioning turns without progress after which the
 *                           controller degrades SOCRATIC/FLUENCY to FADED (a
 *                           worked partial example) from 3 to 2 (both: 1).
 *                           Appendix D §3.3: "a disengaging one gets moved to
 *                           telling sooner".
 *   scaffolded_explanation  `explanation: needs_scaffold` makes the C.14
 *                           self-explanation prompt a sentence stem.
 *   seeded_declines         adaptations the learner turned down across
 *                           sessions and never took are not offered again
 *                           unprompted (cross-session task agreement, C.15).
 *   idle_nudge_paced        a learner whose typical reply takes longer than
 *                           the strategy's idle nudge is not nudged before
 *                           their own pace.
 */

export const HELP_STYLES = ['independent', 'hint_seeking', 'tell_early', 'unknown'] as const;
export const PERSISTENCE = ['persists', 'disengages_early', 'unknown'] as const;
export const EXPLANATION_STYLES = ['explains', 'needs_scaffold', 'unknown'] as const;
export const DISPOSITION_EFFECTS = [
  'stuck_degrade_early',
  'scaffolded_explanation',
  'seeded_declines',
  'idle_nudge_paced',
] as const;
export type DispositionEffect = (typeof DISPOSITION_EFFECTS)[number];

/** The projection Core sends (session context, server-side only). */
export const DispositionProfileSchema = z
  .object({
    sessionsObserved: z.number().int().min(0).max(100_000),
    helpStyle: z.enum(HELP_STYLES),
    persistence: z.enum(PERSISTENCE),
    explanation: z.enum(EXPLANATION_STYLES),
    persistentlyDeclined: z.array(z.enum(ADAPTATIONS)).max(ADAPTATIONS.length),
    typicalTypedReplyMs: z.number().int().min(0).max(600_000).nullable(),
    typicalSpokenReplyMs: z.number().int().min(0).max(600_000).nullable(),
  })
  .strict();
export type DispositionProfile = z.infer<typeof DispositionProfileSchema>;

export interface DispositionEffects {
  /** Questioning turns without progress before SOCRATIC/FLUENCY degrade to FADED (controller default 3). */
  stuckDegradeAfter: 1 | 2 | 3;
  scaffoldedExplanations: boolean;
  seededDeclines: Adaptation[];
  /** The idle nudge is never earlier than this (ms), or null. */
  idleNudgeFloorMs: number | null;
  applied: DispositionEffect[];
}

export const NO_DISPOSITION_EFFECTS: DispositionEffects = {
  stuckDegradeAfter: 3,
  scaffoldedExplanations: false,
  seededDeclines: [],
  idleNudgeFloorMs: null,
  applied: [],
};

/** The idle-nudge floor is never later than a minute (a child who is gone gets nudged eventually). */
const IDLE_NUDGE_FLOOR_CAP_MS = 60_000;

/** Pure: what a profile changes this session. A null profile changes nothing. */
export function dispositionEffects(profile: DispositionProfile | null | undefined): DispositionEffects {
  if (!profile) return NO_DISPOSITION_EFFECTS;
  const applied: DispositionEffect[] = [];
  const earlier = (profile.persistence === 'disengages_early' ? 1 : 0) + (profile.helpStyle === 'tell_early' ? 1 : 0);
  const stuckDegradeAfter = (3 - earlier) as 1 | 2 | 3;
  if (earlier > 0) applied.push('stuck_degrade_early');
  const scaffoldedExplanations = profile.explanation === 'needs_scaffold';
  if (scaffoldedExplanations) applied.push('scaffolded_explanation');
  const seededDeclines = [...new Set(profile.persistentlyDeclined)];
  if (seededDeclines.length > 0) applied.push('seeded_declines');
  const typical = Math.max(profile.typicalTypedReplyMs ?? 0, profile.typicalSpokenReplyMs ?? 0);
  const idleNudgeFloorMs = typical > 0 ? Math.min(IDLE_NUDGE_FLOOR_CAP_MS, Math.round(typical * 1.5)) : null;
  return { stuckDegradeAfter, scaffoldedExplanations, seededDeclines, idleNudgeFloorMs, applied };
}

// ── What this session contributes to the profile (reported at close) ────────

export const DispositionObserverSnapshotSchema = z
  .object({
    learnerTurns: z.number().int().min(0),
    hintRequests: z.number().int().min(0),
    tellRequests: z.number().int().min(0),
    typedReplyMs: z.array(z.number().int().min(0)).max(30),
    spokenReplyMs: z.array(z.number().int().min(0)).max(30),
    accepted: z.array(z.enum(ADAPTATIONS)).max(20),
    declined: z.array(z.enum(ADAPTATIONS)).max(20),
    idleNudgePaced: z.boolean(),
  })
  .strict();
export type DispositionObserverSnapshot = z.infer<typeof DispositionObserverSnapshotSchema>;

export const EMPTY_DISPOSITION_OBSERVER: DispositionObserverSnapshot = {
  learnerTurns: 0,
  hintRequests: 0,
  tellRequests: 0,
  typedReplyMs: [],
  spokenReplyMs: [],
  accepted: [],
  declined: [],
  idleNudgePaced: false,
};

/** Numbers and closed labels only: what Core folds into the persistent profile at close. */
export interface DispositionObservation {
  learnerTurns: number;
  hintRequests: number;
  tellRequests: number;
  typedReplyMs: number | null;
  spokenReplyMs: number | null;
  acceptedAdaptations: Adaptation[];
  declinedAdaptations: Adaptation[];
  /** Whether Core sent a profile this session. */
  profileReceived: boolean;
  /** Which effects the profile actually had (`DISPOSITION_EFFECTS`). */
  applied: DispositionEffect[];
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return Math.round(sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2);
}

const push = <T>(list: T[], value: T, max: number): void => {
  list.push(value);
  if (list.length > max) list.shift();
};

export class DispositionObserver {
  private state: DispositionObserverSnapshot = structuredClone(EMPTY_DISPOSITION_OBSERVER);

  constructor(
    private readonly profileReceived: boolean,
    private readonly effects: DispositionEffects,
  ) {}

  snapshot(): DispositionObserverSnapshot {
    return structuredClone(this.state);
  }

  restore(snapshot: DispositionObserverSnapshot): void {
    this.state = structuredClone(snapshot);
  }

  noteLearnerTurn(input: { source: 'typed' | 'spoken' | 'activity'; replyMs: number | null; hint: boolean; tell: boolean }): void {
    this.state.learnerTurns += 1;
    if (input.hint) this.state.hintRequests += 1;
    if (input.tell) this.state.tellRequests += 1;
    // A reply latency over ten minutes is an absence, not a pace.
    if (input.replyMs !== null && input.replyMs <= 600_000) {
      if (input.source === 'typed') push(this.state.typedReplyMs, Math.round(input.replyMs), 30);
      if (input.source === 'spoken') push(this.state.spokenReplyMs, Math.round(input.replyMs), 30);
    }
  }

  noteAdaptation(adaptation: Adaptation, accepted: boolean): void {
    push(accepted ? this.state.accepted : this.state.declined, adaptation, 20);
  }

  /** The idle-nudge floor actually changed a nudge budget this session. */
  noteIdleNudgePaced(): void {
    this.state.idleNudgePaced = true;
  }

  report(): DispositionObservation {
    const applied: DispositionEffect[] = this.effects.applied.filter((e) => e !== 'idle_nudge_paced');
    if (this.state.idleNudgePaced) applied.push('idle_nudge_paced');
    return {
      learnerTurns: this.state.learnerTurns,
      hintRequests: this.state.hintRequests,
      tellRequests: this.state.tellRequests,
      typedReplyMs: median(this.state.typedReplyMs),
      spokenReplyMs: median(this.state.spokenReplyMs),
      acceptedAdaptations: [...this.state.accepted],
      declinedAdaptations: [...this.state.declined],
      profileReceived: this.profileReceived,
      applied,
    };
  }
}
