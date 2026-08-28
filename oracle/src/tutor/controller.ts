import type { PedagogyState, Strategy } from '../context/schema.js';
import type { SessionPlanEntry } from '../core/client.js';

/*
 * The v3 pedagogical controller (/ORACLE.md, Tutor v3; blueprint §9).
 *
 * NOT a prompt — a policy. It receives state (the session plan Core computed,
 * the local mastery mirror, the events the server witnessed) and emits a
 * STRATEGY CODE per turn; the conversational layer only performs the matching
 * template. If the differentiation lived in the prompt, there would be no
 * product — this file is where "the intelligence lives upstream of the LLM"
 * becomes code.
 *
 * Deterministic and side-effect-free by construction, like plan.ts: every
 * decision here must be explainable to a parent later ("why did my child get
 * a hint?"), which is why it is a rule engine and not a learned policy. When
 * a learned policy exists someday, these rules stay as the SHIELD: it
 * proposes, they veto.
 *
 * `plan.ts` remains the macro-phase spine (warmup → explain → practice …);
 * this controller decides HOW the current phase is taught. With no session
 * plan (v3 off, unseeded, cold learner) the controller reports null and the
 * whole pipeline behaves exactly as v2 — that dormancy is the deploy story.
 */

/** The local BKT mirror's fixed parameters — display-grade, Core's persisted
 * update is authoritative. Matching Core's seed defaults keeps the mirror
 * honest enough for band selection, which is all it is for. */
const MIRROR = { pT: 0.15, pG: 0.2, pS: 0.1 };

export function mirrorBktUpdate(pKnown: number, correct: boolean): number {
  const p = Math.min(1, Math.max(0, pKnown));
  let posterior: number;
  if (correct) {
    const num = p * (1 - MIRROR.pS);
    const den = num + (1 - p) * MIRROR.pG;
    posterior = den > 0 ? num / den : p;
  } else {
    const num = p * MIRROR.pS;
    const den = num + (1 - p) * (1 - MIRROR.pG);
    posterior = den > 0 ? num / den : p;
  }
  const learned = posterior + (1 - posterior) * MIRROR.pT;
  return Math.min(0.999, Math.max(0.001, learned));
}

export interface ControllerDecision {
  strategy: Strategy;
  scaffolding: 0 | 1 | 2 | 3;
  difficulty: 1 | 2 | 3 | 4 | 5;
  /** The extra system-side line the turn's prompt carries, or null. */
  instruction: string | null;
  /** How long the client should wait before a gentle nudge, per strategy. */
  idleNudgeMs: number;
}

export type PedagogyEvent =
  | { kind: 'activity_result'; correct: boolean; misconceptionCode: string | null; attemptNumber: number }
  | { kind: 'voice_result'; correct: boolean; misconceptionCode: string | null }
  | { kind: 'conversation_turn' }
  | { kind: 'entry_opened' };

/** Guardrail: never raise difficulty after a failure; cap strategy churn. */
const MAX_STRATEGY_CHANGES_PER_MINUTE = 3;

type Difficulty = 1 | 2 | 3 | 4 | 5;
const band = (n: number): Difficulty => Math.min(5, Math.max(1, Math.round(n))) as Difficulty;

export class PedagogicalController {
  private entryIndex = 0;
  /** Local mastery mirror per kcId — Core's persisted BKT is authoritative. */
  private readonly pKnown = new Map<string, number>();
  private strategy: Strategy;
  private consecutiveFailures = 0;
  private lastDifficulty: 1 | 2 | 3 | 4 | 5;
  private misconceptionCode: string | null = null;
  private strategyChangesAt: number[] = [];
  /** Set while probing a prerequisite; holds the interrupted entry's index. */
  private probeReturnIndex: number | null = null;
  private probingKcId: string | null = null;
  private celebrated = false;

  constructor(private readonly plan: SessionPlanEntry[]) {
    for (const entry of plan) this.pKnown.set(entry.kcId, entry.pKnown);
    this.strategy = this.plan.length > 0 ? this.baseStrategy(this.plan[0]!) : 'DIRECT';
    this.lastDifficulty = band(this.plan[0]?.targetDifficulty ?? 2);
  }

  /** Whether the controller has anything to control. False = v2 behaviour. */
  get active(): boolean {
    return this.plan.length > 0 && this.entryIndex < this.plan.length;
  }

  get activeEntry(): SessionPlanEntry | null {
    if (!this.active) return null;
    if (this.probingKcId !== null) {
      // While probing, the "entry" is the prerequisite: evidence and segment
      // requests attach to IT, not to the interrupted KC.
      return this.probeEntry();
    }
    return this.plan[this.entryIndex] ?? null;
  }

  get currentStrategy(): Strategy {
    return this.strategy;
  }

  /** The difficulty band the next activity should carry. */
  get targetDifficulty(): 1 | 2 | 3 | 4 | 5 {
    return this.lastDifficulty;
  }

  /** The content-pool bridge for the active KC, when the catalog mapped one. */
  get activeSkillKey(): string | null {
    return this.activeEntry?.skillKey ?? null;
  }

  /** The kcId a served activity should be stamped with right now. */
  get activeKcId(): string | null {
    return this.activeEntry?.kcId ?? null;
  }

  private probeEntry(): SessionPlanEntry | null {
    const interrupted = this.plan[this.probeReturnIndex ?? 0];
    if (!interrupted || this.probingKcId === null) return null;
    // A synthetic entry for the prerequisite: gentler difficulty, no plan
    // metadata of its own (Core did not plan it — the failure did).
    return {
      kcId: this.probingKcId,
      kcKey: `${interrupted.kcKey}#prereq`,
      skillKey: interrupted.skillKey,
      reason: 'frontier',
      pKnown: this.pKnown.get(this.probingKcId) ?? 0.5,
      targetDifficulty: 1,
      objective: interrupted.objective,
      prereqKcIds: [],
      misconceptions: [],
    };
  }

  private baseStrategy(entry: SessionPlanEntry): Strategy {
    if (entry.reason === 'review_due') return 'SPACED';
    const p = this.pKnown.get(entry.kcId) ?? entry.pKnown;
    if (p < 0.3) return 'DIRECT';
    if (p < 0.5) return 'WORKED';
    if (p < 0.65) return 'FADED';
    if (p < 0.85) return 'SOCRATIC';
    return 'FLUENCY';
  }

  private scaffoldingFor(strategy: Strategy): 0 | 1 | 2 | 3 {
    switch (strategy) {
      case 'DIRECT':
      case 'WORKED':
      case 'RESCUE':
      case 'REMEDIATE':
        return 3;
      case 'FADED':
      case 'PROBE':
        return 2;
      case 'SOCRATIC':
      case 'ELABORATE':
      case 'SPACED':
        return 1;
      default:
        return 0;
    }
  }

  /**
   * The one decision function. Applies the event, selects a strategy, runs
   * the guardrails, and returns what this turn should do.
   */
  decide(event: PedagogyEvent, nowMs: number): ControllerDecision {
    const entry = this.activeEntry;
    if (!entry) {
      return { strategy: 'CELEBRATE', scaffolding: 0, difficulty: this.lastDifficulty, instruction: null, idleNudgeMs: 30_000 };
    }

    let failedNow = false;
    // "Unexpected failure" is judged against what we believed BEFORE the
    // evidence — the update itself drags the posterior down, and a probe
    // decision made on the post-update number would never fire.
    const pBefore = this.pKnown.get(entry.kcId) ?? entry.pKnown;
    if (event.kind === 'activity_result' || event.kind === 'voice_result') {
      const kcId = entry.kcId;
      this.pKnown.set(kcId, mirrorBktUpdate(this.pKnown.get(kcId) ?? entry.pKnown, event.correct));
      this.misconceptionCode = event.misconceptionCode;
      if (event.correct) {
        this.consecutiveFailures = 0;
      } else {
        this.consecutiveFailures += 1;
        failedNow = true;
      }
    }

    const proposed = this.propose(event, entry, failedNow, pBefore);
    const strategy = this.enforceGuardrails(proposed, nowMs);
    this.applyStrategy(strategy, nowMs);

    const p = this.pKnown.get(entry.kcId) ?? entry.pKnown;
    let difficulty = band(entry.targetDifficulty);
    if (failedNow || strategy === 'RESCUE' || strategy === 'REMEDIATE' || strategy === 'PROBE') {
      // Never raise difficulty after a failure — only hold or lower.
      difficulty = band(Math.min(difficulty, Math.max(1, this.lastDifficulty - (failedNow ? 1 : 0))));
    } else if (p >= 0.85 && strategy !== 'CELEBRATE') {
      difficulty = band(this.lastDifficulty + 1);
    }
    this.lastDifficulty = difficulty;

    return {
      strategy,
      scaffolding: this.scaffoldingFor(strategy),
      difficulty,
      instruction: this.instructionFor(strategy, entry),
      idleNudgeMs: IDLE_NUDGE_MS[strategy],
    };
  }

  private propose(
    event: PedagogyEvent,
    entry: SessionPlanEntry,
    failedNow: boolean,
    pBefore: number,
  ): Strategy {
    const p = this.pKnown.get(entry.kcId) ?? entry.pKnown;

    // 1) Safety rules always win (blueprint §9.3): frustration first. The
    //    comparison is against the strategy IN FORCE — never two in a row.
    if (this.consecutiveFailures >= 2 && this.strategy !== 'RESCUE') return 'RESCUE';

    // 2) A diagnosed wrong idea outranks everything except rescue.
    if (failedNow && this.misconceptionCode !== null) return 'REMEDIATE';

    // 3) Unexpected failure with prerequisites → walk the graph backwards.
    //    Judged on the PRE-update belief: "we thought they had this".
    if (
      failedNow &&
      this.probingKcId === null &&
      entry.prereqKcIds.length > 0 &&
      (pBefore >= 0.55 || this.consecutiveFailures >= 2)
    ) {
      return 'PROBE';
    }

    // 4) While probing: a correct probe closes the probe and remediates the
    //    original KC; a wrong one keeps probing at floor difficulty.
    if (this.probingKcId !== null && (event.kind === 'activity_result' || event.kind === 'voice_result')) {
      return event.correct ? 'REMEDIATE' : 'DIRECT';
    }

    // 5) Mastery reached → celebrate once, then move to the next plan entry.
    if (p >= 0.85 && (event.kind === 'activity_result' || event.kind === 'voice_result') && event.correct) {
      return this.celebrated ? 'TRANSFER' : 'CELEBRATE';
    }

    // 6) A hard-won correct answer earns a self-explanation beat.
    if (
      (event.kind === 'activity_result' && event.correct && event.attemptNumber > 1) ||
      (this.strategy === 'REMEDIATE' && !failedNow && event.kind !== 'conversation_turn')
    ) {
      return 'ELABORATE';
    }

    // 7) Otherwise: the mastery band decides.
    return this.baseStrategy(entry);
  }

  private enforceGuardrails(proposed: Strategy, nowMs: number): Strategy {
    // Never two RESCUEs in a row — if it persists, the session-close path
    // (the orchestrator's budget/adaptation machinery) takes over.
    if (proposed === 'RESCUE' && this.strategy === 'RESCUE') return 'DIRECT';

    // Cap strategy churn: more than 3 changes in 60s reads as erratic to a
    // child, so past the cap the controller HOLDS its current strategy.
    const cutoff = nowMs - 60_000;
    this.strategyChangesAt = this.strategyChangesAt.filter((t) => t > cutoff);
    if (proposed !== this.strategy && this.strategyChangesAt.length >= MAX_STRATEGY_CHANGES_PER_MINUTE) {
      return this.strategy;
    }
    return proposed;
  }

  private applyStrategy(strategy: Strategy, nowMs: number): void {
    if (strategy !== this.strategy) this.strategyChangesAt.push(nowMs);
    this.strategy = strategy;

    if (strategy === 'PROBE' && this.probingKcId === null) {
      const entry = this.plan[this.entryIndex];
      this.probeReturnIndex = this.entryIndex;
      this.probingKcId = entry?.prereqKcIds[0] ?? null;
      if (this.probingKcId === null) this.probeReturnIndex = null;
    }
    if (strategy === 'REMEDIATE' && this.probingKcId !== null) {
      // The probe answered its question; return to the interrupted KC.
      this.probingKcId = null;
      this.probeReturnIndex = null;
    }
    if (strategy === 'CELEBRATE') {
      this.celebrated = true;
      this.advanceEntry();
    }
  }

  private advanceEntry(): void {
    if (this.entryIndex < this.plan.length) {
      this.entryIndex += 1;
      this.consecutiveFailures = 0;
      this.misconceptionCode = null;
      this.celebrated = false;
      const next = this.plan[this.entryIndex];
      if (next) {
        this.strategy = this.baseStrategy(next);
        this.lastDifficulty = band(next.targetDifficulty);
      }
    }
  }

  /** The hint text for the active misconception, from OUR catalog. */
  private activeMisconceptionHint(entry: SessionPlanEntry): string | null {
    if (this.misconceptionCode === null) return null;
    const hit = entry.misconceptions.find((m) => m.code === this.misconceptionCode);
    return hit ? hit.hint.slice(0, 240) : null;
  }

  private instructionFor(strategy: Strategy, entry: SessionPlanEntry): string | null {
    const template = STRATEGY_INSTRUCTIONS[strategy];
    if (!template) return null;
    const hint = this.activeMisconceptionHint(entry);
    if (strategy === 'REMEDIATE' && hint) {
      return `${template} The specific wrong idea, from our catalog: "${hint}"`;
    }
    return template;
  }

  /** The strict projection allowed to reach the model (context/schema.ts). */
  state(): PedagogyState | null {
    const entry = this.activeEntry;
    if (!entry) return null;
    const mode =
      this.probingKcId !== null
        ? 'probe'
        : this.strategy === 'REMEDIATE'
          ? 'remediation'
          : entry.reason === 'review_due'
            ? 'review'
            : 'new';
    return {
      strategy: this.strategy,
      scaffolding: this.scaffoldingFor(this.strategy),
      kcObjective: entry.objective.slice(0, 200) || 'Teach the current idea until the learner can use it.',
      mode,
      misconceptionHint: this.activeMisconceptionHint(entry),
    };
  }
}

/**
 * How long the client waits before a gentle nudge, PER STRATEGY (blueprint
 * §6.2, adapted to push-to-talk): thinking time is the most valuable part of
 * a Socratic beat, so those wait long; fluency work wants pace.
 */
export const IDLE_NUDGE_MS: Record<Strategy, number> = {
  DIRECT: 25_000,
  WORKED: 25_000,
  FADED: 35_000,
  SOCRATIC: 45_000,
  FLUENCY: 15_000,
  SPACED: 30_000,
  PROBE: 45_000,
  REMEDIATE: 30_000,
  RESCUE: 40_000,
  ELABORATE: 45_000,
  TRANSFER: 35_000,
  CELEBRATE: 30_000,
};

/**
 * The per-strategy instruction the turn's prompt carries. Constant strings —
 * the prefix cache is untouched because these ride in the USER content, and
 * nothing learner-authored is ever interpolated into them.
 */
export const STRATEGY_INSTRUCTIONS: Record<Strategy, string> = {
  DIRECT:
    'Strategy for this turn: DIRECT INSTRUCTION. Teach the idea plainly in two or three short sentences with one small concrete example, then ask one simple question that uses it.',
  WORKED:
    'Strategy for this turn: WORKED EXAMPLE. Walk through one complete example out loud, naming each step as you do it, then hand the learner the very last step to finish.',
  FADED:
    'Strategy for this turn: FADED EXAMPLE. Start an example and leave the final steps for the learner. Each time they succeed, leave one more step to them.',
  SOCRATIC:
    'Strategy for this turn: SOCRATIC. Ask ONE guiding question that moves them a step forward. NEVER state the answer or any step that reveals it — if they ask for the answer, answer with a smaller question.',
  FLUENCY:
    'Strategy for this turn: FLUENCY. They know this — help them get quick. Short, snappy exchanges, one small question at a time, keep the energy up.',
  SPACED:
    'Strategy for this turn: SPACED REVIEW. This is something they learned before and it is time to bring it back. Present it as a fresh little problem, never as a test of memory.',
  PROBE:
    'Strategy for this turn: DIAGNOSTIC PROBE. Something earlier may be shaky. Ask one gentle question about the underlying idea, framed as curiosity, never as a step backwards.',
  REMEDIATE:
    'Strategy for this turn: REMEDIATION. The learner is applying a specific wrong idea, not making a random mistake. Do not re-explain the whole topic — confront that one idea with an example where it visibly fails, then rebuild.',
  RESCUE:
    'Strategy for this turn: RESCUE. The learner is frustrated. Validate the difficulty first, in one warm sentence. Make the next thing genuinely easier, and offer a choice: keep going gently, or switch to something else.',
  ELABORATE:
    'Strategy for this turn: SELF-EXPLANATION. They got it right — now ask them to explain WHY it works, in their own words. Their explanation matters more than the answer did.',
  TRANSFER:
    'Strategy for this turn: TRANSFER. They own this idea. Give it to them in a completely different context and let them discover it still works.',
  CELEBRATE:
    'Strategy for this turn: CELEBRATE. They just mastered something real. Name exactly what they can now do, connect it to what comes next, and keep it to two sentences of genuine warmth.',
};
