import type { PedagogyState, Strategy } from '../context/schema.js';
import type { KcState, SessionPlanEntry } from '../core/client.js';

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
  /**
   * How much silence, after the learner has actually spoken, means their turn
   * is over — the blueprint's §6.2 turn policy, per strategy.
   */
  listenSilenceMs: number;
}

export type PedagogyEvent =
  | { kind: 'activity_result'; correct: boolean; misconceptionCode: string | null; attemptNumber: number }
  | { kind: 'voice_result'; correct: boolean; misconceptionCode: string | null }
  | { kind: 'conversation_turn' }
  | { kind: 'entry_opened' };

/** Guardrail: never raise difficulty after a failure; cap strategy churn. */
const MAX_STRATEGY_CHANGES_PER_MINUTE = 3;

/**
 * How many assessed opportunities a knowledge component needs before mastery
 * can be declared, however confident the posterior is.
 *
 * Three is the blueprint's own number for a diagnosis ("2-3 ítems de sondeo",
 * §640) and the conventional minimum in mastery learning. It is deliberately
 * small: this gates CELEBRATING and MOVING ON, not the teaching itself, and a
 * learner who genuinely knows something answers three questions quickly.
 */
const MASTERY_MIN_OPPORTUNITIES = 3;

/**
 * The strategies that ASK rather than TEACH.
 *
 * A learner making no progress must not be left in one of these. Fixing only
 * SOCRATIC — the one the blueprint names — left the identical defect in
 * FLUENCY, which is how this became a set rather than a comparison.
 */
const QUESTIONING_STRATEGIES: ReadonlySet<Strategy> = new Set(['SOCRATIC', 'FLUENCY']);

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
  /**
   * Consecutive turns spent ASKING that produced no correct answer.
   *
   * The blueprint's guardrail is a COUNT, not a band: three questions with no
   * progress means questions are not working, whatever the mastery estimate
   * says about them — which is why this counts every questioning strategy and
   * not only the one the blueprint happens to name.
   */
  private questioningWithoutProgress = 0;
  /**
   * Whether RESCUE has already fired since the learner last got something right.
   *
   * Rescue lowers the temperature of a session that is going badly. Firing it
   * repeatedly does not lower it further; it just replaces teaching with
   * reassurance, on a learner who by then needs the teaching.
   */
  private rescuedSinceProgress = false;
  /**
   * How many assessed opportunities this session has produced per KC, seeded
   * from the learner's persisted history.
   *
   * The blueprint's own schema carries `n_opportunities` beside the posterior
   * for a reason: a Bayesian belief says how confident we are, not how much we
   * have seen. Mastery needs both.
   */
  private opportunities = new Map<string, number>();
  /** Set while probing a prerequisite; holds the interrupted entry's index. */
  private probeReturnIndex: number | null = null;
  private probingKcId: string | null = null;
  private celebrated = false;

  constructor(
    private readonly plan: SessionPlanEntry[],
    /**
     * What this learner knows about EVERY knowledge component, not just the
     * ones in today's plan. Core has always sent it and nothing read it —
     * the same shape as `turnHistory`, which travelled sealed and validated
     * for months into a renderer that dropped it.
     *
     * It is what turns the backward walk into a DIAGNOSIS. Without it the
     * probe takes `prereqKcIds[0]`, the first prerequisite in array order,
     * which is a guess wearing the costume of one.
     */
    private readonly kcStates: readonly KcState[] = [],
  ) {
    for (const entry of plan) this.pKnown.set(entry.kcId, entry.pKnown);
    this.strategy = this.plan.length > 0 ? this.baseStrategy(this.plan[0]!) : 'DIRECT';
    this.lastDifficulty = band(this.plan[0]?.targetDifficulty ?? 2);
    /*
     * Seeded from the learner's persisted history, so a child returning to a KC
     * they have already been asked about three times is not made to re-earn the
     * evidence. The count is about how much we have SEEN of them, and previous
     * sessions are things we saw.
     */
    for (const state of this.kcStates) this.opportunities.set(state.kcId, state.attempts);
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
    /*
     * "NEVER MORE THAN 3 SOCRATIC WITHOUT PROGRESS → DEGRADE TO FADED"
     * (blueprint §9.2), applied to the CLASS rather than to the one strategy it
     * names.
     *
     * The band alone decided this before, so a learner who kept getting nowhere
     * stayed in whichever questioning strategy their mastery implied,
     * indefinitely. The blueprint names SOCRATIC, and fixing only SOCRATIC left
     * the identical defect one band up: a learner who had mastered something and
     * then went quiet was given FLUENCY — timed drills — seven turns running,
     * after six answers of "no sé". Same failure, different label, and it was
     * caught by the sequence gate the moment the Socratic half was fixed.
     *
     * RESCUE covers the EMOTIONAL version of this at two consecutive failures,
     * and it is not the same rule: rescue lowers the temperature and hands the
     * learner straight back to the band. This one changes the TEACHING — a faded
     * example gives them the shape of the answer and asks for the last step.
     */
    const stuck = this.questioningWithoutProgress >= 3;
    if (p < 0.85) return stuck ? 'FADED' : 'SOCRATIC';
    return stuck ? 'FADED' : 'FLUENCY';
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
      return {
        strategy: 'CELEBRATE',
        scaffolding: 0,
        difficulty: this.lastDifficulty,
        instruction: null,
        idleNudgeMs: IDLE_NUDGE_MS.CELEBRATE,
        listenSilenceMs: LISTEN_SILENCE_MS.CELEBRATE,
      };
    }

    let failedNow = false;
    /** Whether this turn produced a correct answer — the definition of progress. */
    const assessedCorrect =
      (event.kind === 'activity_result' || event.kind === 'voice_result') && event.correct;
    // "Unexpected failure" is judged against what we believed BEFORE the
    // evidence — the update itself drags the posterior down, and a probe
    // decision made on the post-update number would never fire.
    const pBefore = this.pKnown.get(entry.kcId) ?? entry.pKnown;
    if (event.kind === 'activity_result' || event.kind === 'voice_result') {
      const kcId = entry.kcId;
      this.opportunities.set(kcId, (this.opportunities.get(kcId) ?? 0) + 1);
      this.pKnown.set(kcId, mirrorBktUpdate(this.pKnown.get(kcId) ?? entry.pKnown, event.correct));
      this.misconceptionCode = event.misconceptionCode;
      if (event.correct) {
        this.consecutiveFailures = 0;
      } else {
        this.consecutiveFailures += 1;
        failedNow = true;
      }
    }

    /*
     * THE STREAK COUNTS TURNS THAT WENT NOWHERE, NOT WRONG ANSWERS.
     *
     * A first version counted only failed results, and measuring it showed the
     * threshold was unreachable: two consecutive wrong answers trigger RESCUE
     * before a third can land, and any correct answer resets the count. It was
     * dead code that read like a guardrail.
     *
     * "Sin progreso" is the broader thing, and it is the shape the owner's own
     * transcripts show: a learner answering "no sé" produces a
     * `conversation_turn`, which is not a failure, so `consecutiveFailures`
     * never grows, RESCUE never fires, and the Socratic questions continue
     * indefinitely. Nothing in the controller could see that, because nothing
     * was counting the turns where NOTHING HAPPENED.
     *
     * So: any turn spent asking that did not produce a correct answer counts,
     * and a correct answer resets it. `this.strategy` is the strategy that was in
     * force during the turn being judged, not the one about to be chosen.
     * `entry_opened` is excluded — it is the controller opening a KC, not the
     * learner spending a turn.
     */
    if (assessedCorrect) {
      this.questioningWithoutProgress = 0;
      // Progress re-arms rescue: the next slump gets the same support this one
      // did, rather than being permanently denied it by an earlier bad patch.
      this.rescuedSinceProgress = false;
    } else if (QUESTIONING_STRATEGIES.has(this.strategy) && event.kind !== 'entry_opened') {
      this.questioningWithoutProgress += 1;
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
      listenSilenceMs: LISTEN_SILENCE_MS[strategy],
    };
  }

  private propose(
    event: PedagogyEvent,
    entry: SessionPlanEntry,
    failedNow: boolean,
    pBefore: number,
  ): Strategy {
    const p = this.pKnown.get(entry.kcId) ?? entry.pKnown;

    /*
     * 1) Safety rules always win (blueprint §9.3): frustration first.
     *
     * THE COOLDOWN IS THE RULE, NOT THE "NEVER TWICE IN A ROW".
     *
     * Blocking only the immediately-consecutive rescue produced a worse thing
     * than the one it prevented. Measured against six straight failures, the
     * controller emitted RESCUE, DIRECT, RESCUE, DIRECT, RESCUE, DIRECT: the
     * failure count stays at or above two, so rescue is proposed every turn, and
     * the "never two in a row" guardrail downgrades every second one. The child
     * is bounced between emotional support and direct instruction on alternating
     * turns, forever — which is precisely the erratic experience the churn cap
     * exists to prevent, arriving through a different door. The churn cap cannot
     * catch it either, because real turns are far enough apart to keep clearing
     * its sixty-second window.
     *
     * Rescue is a RESET, so it needs room to work: once it has fired, it does
     * not fire again until the learner gets something right. Failing again after
     * a rescue means the rescue was not the answer, and the answer is to keep
     * teaching — rule 2's remediation, rule 3's prerequisite probe, or direct
     * instruction — not to rescue again with a different label.
     */
    if (this.consecutiveFailures >= 2 && !this.rescuedSinceProgress) return 'RESCUE';

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

    /*
     * 5) Mastery reached → celebrate once, then move to the next plan entry.
     *
     * MASTERY NEEDS EVIDENCE, NOT JUST CONFIDENCE. The posterior alone declared
     * it after a SINGLE correct answer: the mirror's textbook BKT update takes a
     * learner from 0.50 to 0.845 on one right answer and to 0.967 on two, so a
     * plan entry was finished, celebrated and left behind on evidence a guess
     * produces one time in five. Driving a competent learner through the whole
     * session plan took three turns, after which the controller went dormant and
     * the rest of the session fell back to v2 behaviour with no pedagogy at all.
     * That is the shallowness the product was accused of, expressed as a
     * threshold.
     *
     * The fix is the one the blueprint's schema already implies by carrying
     * `n_opportunities` beside the posterior, and that §640 states directly when
     * it asks for "2-3 ítems de sondeo": confidence is not evidence. A belief
     * above the bar on one observation means we have not looked enough, so
     * mastery now also requires having actually asked.
     */
    if (
      p >= 0.85 &&
      (event.kind === 'activity_result' || event.kind === 'voice_result') &&
      event.correct &&
      (this.opportunities.get(entry.kcId) ?? 0) >= MASTERY_MIN_OPPORTUNITIES
    ) {
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
    if (strategy === 'RESCUE') this.rescuedSinceProgress = true;
    this.strategy = strategy;

    if (strategy === 'PROBE' && this.probingKcId === null) {
      const entry = this.plan[this.entryIndex];
      this.probeReturnIndex = this.entryIndex;
      this.probingKcId = this.weakestPrerequisite(entry?.prereqKcIds ?? []);
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

  /**
   * THE PREREQUISITE THEY ARE ACTUALLY WEAKEST AT.
   *
   * The blueprint calls this the product's "wow" moment — walk the graph
   * backwards and find the gap from two years ago, rather than reteaching the
   * step they just failed. Taking the FIRST prerequisite is not that: array
   * order is authoring order, so it probed whichever idea the curriculum
   * happened to list first and called it a diagnosis.
   *
   * With mastery in hand it is a real one: of everything this knowledge
   * component rests on, ask about the piece the learner is least likely to
   * have. A prerequisite with no evidence at all sorts as weakest, which is
   * correct — never assessed is not the same as known, and it is exactly where
   * a hidden gap hides.
   */
  private weakestPrerequisite(prereqKcIds: readonly string[]): string | null {
    if (prereqKcIds.length === 0) return null;
    const masteryOf = new Map(this.kcStates.map((s) => [s.kcId, s]));
    let weakest: string | null = null;
    let lowest = Number.POSITIVE_INFINITY;
    for (const kcId of prereqKcIds) {
      const state = masteryOf.get(kcId);
      // No evidence sorts below any measured belief: unassessed is where a gap
      // survives unnoticed, which is the whole point of looking backwards.
      const score = state === undefined || state.attempts === 0 ? -1 : state.pKnown;
      if (score < lowest) {
        lowest = score;
        weakest = kcId;
      }
    }
    return weakest;
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
 * HOW LONG A PAUSE MEANS "I'M DONE TALKING", PER STRATEGY.
 *
 * This is the blueprint's §6.2 turn policy, and it is differentiator #1 of the
 * fourteen for a reason: in customer service you want to close a turn fast, and
 * in TUTORING you want the opposite. The silence of a child who is thinking is
 * the most valuable part of the session, and a tutor that talks into it has
 * destroyed the thing it was there to cause.
 *
 * So the number is not global and it is not a timeout — it is a pedagogical
 * decision that changes with what the tutor just did. After an open Socratic
 * question, three and a half seconds of quiet is a child working; after a
 * fluency drill, the same silence is a child who has lost the thread and needs
 * the next card. The strategy already knows which of those it is, and it is the
 * only thing that does.
 *
 * These are DELIBERATELY longer than a voice assistant's ~700 ms. A product
 * built for six-year-olds that cuts them off mid-sentence is a product they
 * stop talking to, and the cost of waiting too long is one awkward beat where
 * the cost of waiting too little is the answer itself.
 */
export const LISTEN_SILENCE_MS: Record<Strategy, number> = {
  // The tutor just explained; the learner is acknowledging or asking back.
  DIRECT: 1_500,
  WORKED: 1_500,
  // A partially-faded example: they are working, with a step to fill in.
  FADED: 2_500,
  // The whole point is the pause. Never rush it.
  SOCRATIC: 3_500,
  // Recall drills want pace — a long tail here reads as the app being broken.
  FLUENCY: 900,
  SPACED: 1_500,
  // A diagnostic probe is a question about something they may not know yet.
  PROBE: 3_000,
  REMEDIATE: 2_500,
  // Frustrated: present, unhurried, never looming.
  RESCUE: 2_500,
  // "Explain why it works" — the longest answers in the whole session.
  ELABORATE: 3_500,
  TRANSFER: 3_000,
  CELEBRATE: 1_200,
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
