import { z } from 'zod';

/*
 * C.15 — THE ALLIANCE CONTROLLER (Appendix D §3.4; Appendix F §1.2, Part 2
 * worked example, Part 3 Stage 7).
 *
 * The working alliance — BOND, GOAL agreement and TASK agreement (Bordin,
 * 1979) — is the most cross-domain-validated predictor of whether a helping
 * relationship produces benefit at all, and youth-mentoring research names
 * "being told what to do without collaboration" as what breaks it (DuBois et
 * al., 2011; Harder et al., 2022). This is the pedagogy controller's SIBLING:
 * it does not pick strategies; it tracks the three alliance dimensions as
 * explicit, separately monitorable session state and owns four moves.
 *
 *   GOAL   The goal-agreement opening move: on the learner's first
 *          substantive turn the Mentor restates, in the learner's own terms,
 *          what the session is for, as one confirming question; the learner
 *          answers on two equal chips (`goal_response`) or in words
 *          (`classifyGoalReply`). "Something else" asks what they would like
 *          instead, and their answer becomes the goal (`renegotiated`).
 *          Recorded: agreed / renegotiated / unconfirmed / not_reached.
 *   TASK   Adaptation offers, acceptances and declines. A defined pattern —
 *          `renegotiateAfterDeclines` consecutive declines with no acceptance
 *          between them — is a RENEGOTIATION TRIGGER, never silent
 *          persistence: the Mentor's next turn only reacts, and the SYSTEM
 *          asks a written question ("That way isn't working. What would help
 *          you more right now?"). Each trigger is followed for
 *          `improvementWindow` learner turns to see whether the session got
 *          better (no further decline, no disengagement firing, no "not
 *          really" at a check-in): the Stage 7 input.
 *   BOND   Whether the Mentor referenced something specific the learner did
 *          (C.18's praise classification of every delivered turn), and the
 *          end-of-session bond proxy ("did I get what you were going for
 *          today?"), which the learner answers after the session closes and
 *          Core records per persona.
 *   CONTINUITY  Whether this persona has worked with this learner before,
 *          decided by Core from the persistent persona-rapport history (C.7):
 *          `first_meeting`, `persona_switch`, `memory_gap` or `continuing`.
 *          In the first three the Mentor re-establishes bond/goal/task
 *          framing instead of acting falsely familiar: a written
 *          introduction replaces a greeting that assumes a history, the model
 *          is told on every turn not to claim shared memories, and a turn that
 *          does claim one ("last time we…") is repaired and never delivered.
 *
 * THE STAGE 7 KILL SWITCH (`mode`): `act` does everything above; `shadow`
 * suspends the renegotiation trigger and the continuity re-establishment
 * (recorded, never acted on) and keeps the passive bond/goal tracking — the
 * rollback Appendix F Part 3 specifies; `off` does nothing. The mode is the
 * stricter of the operator's TUTOR_ALLIANCE_CONTROLLER and Core's automatic
 * rollback verdict (`allianceMode` in the session context).
 *
 * PRIVACY: nothing here reaches the model context (the sealed 14-field
 * schema is untouched). The continuity decision selects a written line and
 * one fixed instruction sentence; the report Core stores is labels and
 * counts, never the learner's words and never a claim about how they feel.
 */

export type AllianceMode = 'act' | 'shadow' | 'off';

export function parseAllianceMode(raw: string | undefined): AllianceMode {
  return raw === 'shadow' || raw === 'off' ? raw : 'act';
}

/** off > shadow > act: Core's automatic rollback can only make it quieter. */
export function strictestAllianceMode(a: AllianceMode, b: AllianceMode): AllianceMode {
  if (a === 'off' || b === 'off') return 'off';
  if (a === 'shadow' || b === 'shadow') return 'shadow';
  return 'act';
}

export const CONTINUITY_KINDS = ['first_meeting', 'persona_switch', 'memory_gap', 'continuing'] as const;
export type ContinuityKind = (typeof CONTINUITY_KINDS)[number];

export const CONTINUITY_MOVES = ['delivered', 'shadow', 'not_needed', 'unknown'] as const;
export type ContinuityMove = (typeof CONTINUITY_MOVES)[number];

export const GOAL_AGREEMENTS = ['agreed', 'renegotiated', 'unconfirmed', 'not_reached'] as const;
export type GoalAgreement = (typeof GOAL_AGREEMENTS)[number];

export const RENEGOTIATION_OUTCOMES = [
  'answered',
  'unanswered',
  'undelivered',
  'session_ended',
  'superseded',
  'shadow',
] as const;
export type RenegotiationOutcome = (typeof RENEGOTIATION_OUTCOMES)[number];

export interface AllianceConfig {
  /** Consecutive adaptation declines (no acceptance between) that trigger renegotiation. */
  renegotiateAfterDeclines: number;
  /** Learner turns after a renegotiation over which "did it improve?" is judged. */
  improvementWindow: number;
  /** At most this many renegotiations in one session. */
  maxRenegotiations: number;
  /** For `memory_gap`, the no-false-familiarity note rides this many learner turns. */
  memoryGapNoteTurns: number;
}

/** Every value is PROPOSED, PENDING CALIBRATION (docs/rebuild/mentor/THRESHOLD-RECALIBRATION-LOG.md). */
export const ALLIANCE_DEFAULTS: AllianceConfig = {
  renegotiateAfterDeclines: 2,
  improvementWindow: 4,
  maxRenegotiations: 2,
  memoryGapNoteTurns: 3,
};

const RenegotiationEventSchema = z
  .object({
    /** 1-based index of the renegotiation in this session. */
    observation: z.number().int().min(1),
    /** The learner turn on which the decline pattern completed. */
    atTurn: z.number().int().min(0),
    mode: z.enum(['act', 'shadow']),
    outcome: z.enum([...RENEGOTIATION_OUTCOMES, 'pending', 'open']),
    /** Did the next `improvementWindow` learner turns go better? Null until known. */
    improved: z.boolean().nullable(),
    /** Learner turns seen since the answer (the improvement window). */
    windowSeen: z.number().int().min(0),
  })
  .strict();
export type RenegotiationEvent = z.infer<typeof RenegotiationEventSchema>;

export const AllianceSnapshotSchema = z
  .object({
    learnerTurns: z.number().int().min(0),
    goal: z.enum(['pending', 'proposed', 'asked_other', 'agreed', 'renegotiated', 'unconfirmed']),
    goalSettledAtTurn: z.number().int().min(0).nullable(),
    continuityMove: z.enum(CONTINUITY_MOVES),
    offers: z.number().int().min(0),
    accepts: z.number().int().min(0),
    declines: z.number().int().min(0),
    consecutiveDeclines: z.number().int().min(0),
    bondSpecificTurns: z.number().int().min(0),
    bondGenericTurns: z.number().int().min(0),
    renegotiations: z.array(RenegotiationEventSchema).max(6),
    /** Model turns produced while a renegotiation was due that could not carry it. */
    missedTurns: z.number().int().min(0),
  })
  .strict();
export type AllianceSnapshot = z.infer<typeof AllianceSnapshotSchema>;

export const EMPTY_ALLIANCE: AllianceSnapshot = {
  learnerTurns: 0,
  goal: 'pending',
  goalSettledAtTurn: null,
  continuityMove: 'unknown',
  offers: 0,
  accepts: 0,
  declines: 0,
  consecutiveDeclines: 0,
  bondSpecificTurns: 0,
  bondGenericTurns: 0,
  renegotiations: [],
  missedTurns: 0,
};

/** What Core records at close (Goal-Agreement Completion, Renegotiation Trigger Rate, Stage 7). */
export interface AllianceReport {
  mode: 'act' | 'shadow';
  continuity: ContinuityKind | null;
  continuityMove: ContinuityMove;
  goalAgreement: GoalAgreement;
  goalSettledAtTurn: number | null;
  learnerTurns: number;
  adaptationOffers: number;
  adaptationAccepts: number;
  adaptationDeclines: number;
  bondSpecificTurns: number;
  bondGenericTurns: number;
  renegotiations: (Omit<RenegotiationEvent, 'outcome' | 'windowSeen'> & { outcome: RenegotiationOutcome })[];
}

// ── The lines and instructions the moves use ────────────────────────────────

/** The goal-agreement opening move: one confirming question in the learner's own terms. */
export const GOAL_AGREEMENT_INSTRUCTION = [
  'GOAL AGREEMENT — decided by the system, before any teaching. In ONE short question, restate what the',
  "learner wants to do in this session, in their own words and connected to today's topic if there is one",
  '(for example: "So today you want to figure out whether to save for the bike or spend now, right?").',
  'Do NOT teach yet, do NOT request an activity and do NOT offer an adaptation this turn.',
].join(' ');

export const GOAL_AGREED_INSTRUCTION = [
  'The learner confirmed the goal for this session. Start working on it now with the first small step,',
  'in one or two short sentences. Do not ask again what they want to do.',
].join(' ');

export const GOAL_OTHER_INSTRUCTION = [
  'The learner said that is not what they want to do today. In ONE short question, ask what they would',
  'like to work on instead, offering two concrete choices about money or running a small business.',
  'Do not teach yet and do not request an activity.',
].join(' ');

export const GOAL_ADOPT_INSTRUCTION = [
  'The learner just said, in their own words, what they want to work on. Say in one short sentence that',
  'that is what you will do today, using their words, then start on it with the first small step.',
  'If it is not about money, saving, spending, earning or running a small business, say kindly that you',
  'help with money things and offer the closest money topic instead.',
].join(' ');

/** The reacting turn before the system's renegotiation question. */
export const RENEGOTIATION_LEAD_INSTRUCTION = [
  'RENEGOTIATION — decided by the system: the learner has turned down the last ways of working you offered.',
  'React to what they just did in ONE short sentence. Do NOT offer another adaptation, do NOT ask any',
  'question and do NOT request an activity: the system follows your sentence with its own question about',
  'what would help them more.',
].join(' ');

export const RENEGOTIATION_FOLLOW_INSTRUCTION = [
  'The learner just told you what would help them more right now. Follow it if it fits today\'s lesson:',
  'say in one short sentence how you will do it differently, then do it. If they are not sure, offer two',
  'concrete ways to continue (for example, a worked example or a quick practice question) as a choice.',
  'Do not offer an adaptation they already turned down.',
].join(' ');

/** For a first meeting or a persona switch: never falsely familiar (every model turn). */
export const FRESH_START_NOTE =
  'CONTINUITY — decided by the system: you have NOT worked with this learner before as yourself. Never claim to remember them or say what "we" did before; you may say that you see they have practised a topic before. If this is early in the session, say briefly how you will work together (you ask questions, they can always ask you for a hint).';

/** For a memory gap: it has been a while; ask rather than assume. */
export const MEMORY_GAP_NOTE =
  'CONTINUITY — decided by the system: it has been a long time since you last worked with this learner. Do not act as if you remember details of past sessions; ask where they are now rather than assuming.';

// ── The controller ──────────────────────────────────────────────────────────

export class AllianceController {
  private state: AllianceSnapshot = structuredClone(EMPTY_ALLIANCE);

  constructor(
    readonly mode: AllianceMode,
    /** Decided by Core from the persistent persona-rapport history; null when Core could not say. */
    readonly continuity: ContinuityKind | null,
    private readonly config: AllianceConfig = ALLIANCE_DEFAULTS,
  ) {}

  snapshot(): AllianceSnapshot {
    return structuredClone(this.state);
  }

  restore(snapshot: AllianceSnapshot): void {
    this.state = structuredClone(snapshot);
  }

  // ── continuity ──

  /** Whether this persona must re-establish bond/goal/task framing (and in act mode does). */
  get needsReestablishment(): boolean {
    return this.continuity === 'first_meeting' || this.continuity === 'persona_switch' || this.continuity === 'memory_gap';
  }

  /** In act mode: a first meeting or persona switch — the Mentor must never act falsely familiar. */
  get requiresFreshStart(): boolean {
    return this.mode === 'act' && (this.continuity === 'first_meeting' || this.continuity === 'persona_switch');
  }

  /** Which written opening the continuity move uses, or null (the ordinary opening). */
  get continuityOpening(): 'introduce' | 'reconnect' | null {
    if (this.mode !== 'act') return null;
    if (this.continuity === 'first_meeting' || this.continuity === 'persona_switch') return 'introduce';
    if (this.continuity === 'memory_gap') return 'reconnect';
    return null;
  }

  /** The session opened: records whether the re-establishment happened, was shadowed or was not needed. */
  noteOpening(): void {
    if (this.mode === 'off') return;
    this.state.continuityMove =
      this.continuity === null
        ? 'unknown'
        : !this.needsReestablishment
          ? 'not_needed'
          : this.mode === 'act'
            ? 'delivered'
            : 'shadow';
  }

  /** The no-false-familiarity note for this model turn ('' when none applies). */
  continuityNote(): string {
    if (this.mode !== 'act') return '';
    if (this.requiresFreshStart) return FRESH_START_NOTE;
    if (this.continuity === 'memory_gap' && this.state.learnerTurns <= this.config.memoryGapNoteTurns) return MEMORY_GAP_NOTE;
    return '';
  }

  // ── goal ──

  /** The goal-agreement move is still to be made (never in `off`). */
  get goalPromptDue(): boolean {
    return this.mode !== 'off' && this.state.goal === 'pending';
  }

  get goalCheckOpen(): boolean {
    return this.state.goal === 'proposed';
  }

  get goalAskedOther(): boolean {
    return this.state.goal === 'asked_other';
  }

  /** The restatement question reached the learner. */
  markGoalProposed(): void {
    if (this.state.goal === 'pending') this.state.goal = 'proposed';
  }

  /** The learner answered the restatement (chips or words). */
  answerGoal(reply: 'agree' | 'other' | 'unclear'): void {
    if (this.state.goal !== 'proposed') return;
    if (reply === 'agree') {
      this.state.goal = 'agreed';
      // The 1-based index of the learner act that settled it (this answer).
      this.state.goalSettledAtTurn = this.state.learnerTurns + 1;
    } else if (reply === 'other') {
      this.state.goal = 'asked_other';
    } else {
      this.state.goal = 'unconfirmed';
    }
  }

  /** After "something else", the learner's own words became the goal. */
  adoptLearnerGoal(): void {
    if (this.state.goal !== 'asked_other') return;
    this.state.goal = 'renegotiated';
    this.state.goalSettledAtTurn = this.state.learnerTurns + 1;
  }

  // ── task ──

  noteOfferDelivered(): void {
    if (this.mode === 'off') return;
    this.state.offers += 1;
  }

  noteAccepted(): void {
    if (this.mode === 'off') return;
    this.state.accepts += 1;
    this.state.consecutiveDeclines = 0;
  }

  /** A declined adaptation offer: alliance data, and possibly the renegotiation trigger. */
  noteDeclined(): void {
    if (this.mode === 'off') return;
    this.state.declines += 1;
    this.state.consecutiveDeclines += 1;
    this.worsenWindows();
    if (this.state.consecutiveDeclines < this.config.renegotiateAfterDeclines) return;
    this.state.consecutiveDeclines = 0;
    if (this.inFlight() !== undefined) return;
    if (this.state.renegotiations.length >= this.config.maxRenegotiations) return;
    this.state.renegotiations.push({
      observation: this.state.renegotiations.length + 1,
      atTurn: this.state.learnerTurns,
      mode: this.mode === 'act' ? 'act' : 'shadow',
      outcome: this.mode === 'act' ? 'pending' : 'shadow',
      improved: null,
      windowSeen: 0,
    });
  }

  private inFlight(): RenegotiationEvent | undefined {
    const last = this.state.renegotiations.at(-1);
    return last && (last.outcome === 'pending' || last.outcome === 'open') ? last : undefined;
  }

  /** The next Mentor turn must carry the renegotiation (act mode only). */
  get renegotiationDue(): boolean {
    return this.inFlight()?.outcome === 'pending';
  }

  get renegotiationOpen(): boolean {
    return this.inFlight()?.outcome === 'open';
  }

  markRenegotiationDelivered(): void {
    const e = this.inFlight();
    if (e?.outcome === 'pending') e.outcome = 'open';
  }

  /** A delivered Mentor turn went out while it was due and could not carry it (it stays due). */
  noteTurnWithoutRenegotiation(): void {
    if (this.renegotiationDue) this.state.missedTurns += 1;
  }

  /** A safety stop, a closing or the C.19 check-in (itself a renegotiation of the task) took the moment. */
  supersedeRenegotiation(): void {
    const e = this.inFlight();
    if (e !== undefined) e.outcome = 'superseded';
  }

  /** The learner answered the renegotiation question in words; the improvement window starts. */
  answerRenegotiation(answered: boolean): void {
    const e = this.inFlight();
    if (e?.outcome !== 'open') return;
    e.outcome = answered ? 'answered' : 'unanswered';
  }

  /** A disengagement firing or a "not really" at a check-in: the session did not get better. */
  noteDisengagement(): void {
    this.worsenWindows();
  }

  private worsenWindows(): void {
    for (const e of this.state.renegotiations) {
      if ((e.outcome === 'answered' || e.outcome === 'unanswered') && e.improved === null) e.improved = false;
    }
  }

  // ── bond ──

  /** C.18's praise classification of one delivered Mentor turn. */
  notePraise(praise: 'specific' | 'generic' | null): void {
    if (this.mode === 'off' || praise === null) return;
    if (praise === 'specific') this.state.bondSpecificTurns += 1;
    else this.state.bondGenericTurns += 1;
  }

  // ── turns ──

  /** One learner turn (text, spoken or an activity result): advances the improvement windows. */
  noteLearnerTurn(): void {
    this.state.learnerTurns += 1;
    for (const e of this.state.renegotiations) {
      if ((e.outcome === 'answered' || e.outcome === 'unanswered') && e.improved === null) {
        e.windowSeen += 1;
        if (e.windowSeen >= this.config.improvementWindow) e.improved = true;
      }
    }
  }

  get learnerTurns(): number {
    return this.state.learnerTurns;
  }

  report(): AllianceReport {
    const goal = this.state.goal;
    return {
      mode: this.mode === 'shadow' ? 'shadow' : 'act',
      continuity: this.continuity,
      continuityMove: this.state.continuityMove,
      goalAgreement:
        goal === 'agreed' || goal === 'renegotiated'
          ? goal
          : goal === 'pending'
            ? 'not_reached'
            : 'unconfirmed',
      goalSettledAtTurn: this.state.goalSettledAtTurn,
      learnerTurns: this.state.learnerTurns,
      adaptationOffers: this.state.offers,
      adaptationAccepts: this.state.accepts,
      adaptationDeclines: this.state.declines,
      bondSpecificTurns: this.state.bondSpecificTurns,
      bondGenericTurns: this.state.bondGenericTurns,
      renegotiations: this.state.renegotiations.map(({ windowSeen: _seen, ...e }) => ({
        ...e,
        outcome:
          e.outcome === 'pending'
            ? this.state.missedTurns > 0
              ? 'undelivered'
              : 'session_ended'
            : e.outcome === 'open'
              ? 'unanswered'
              : e.outcome,
      })),
    };
  }
}

// ── The no-false-familiarity output check ───────────────────────────────────

const fold = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/[’‘`´]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ');

const SHARED_HISTORY = new RegExp(
  '(?<![\p{L}])(?:' +
    [
      // en: a first-person memory of a PREVIOUS session, or remembering the learner.
      '(?:last time|last session|the other day|yesterday) (?:we|i|you and i)',
      '(?:we|i|you and i) (?:did|saw|learned|learnt|talked|worked|practiced|practised|played|covered)[^.?!]{0,40}(?:last time|last session|the other day|yesterday)',
      'remember when (?:we|i)',
      '(?:like|as) we (?:did|saw|learned|talked about) (?:last time|before)',
      'i remember (?:you|when you|that you|how you)',
      '(?:good|nice|great) to see you again|see you again',
      // es
      '(?:la vez pasada|la ultima vez|la otra vez|el otro dia|ayer) (?:vimos|hicimos|aprendimos|hablamos|trabajamos|practicamos|jugamos|te dije|te ense)',
      '(?:te acuerdas|recuerdas|te recuerdas) (?:de )?(?:cuando|lo que) (?:vimos|hicimos|hablamos|jugamos|aprendimos|nosotros)',
      'como (?:vimos|hicimos|aprendimos) (?:la vez pasada|la ultima vez|la otra vez|antes)',
      'me acuerdo (?:de ti|de que tu|que tu|de cuando)',
      'verte de nuevo|volver a verte|verte otra vez',
      // pt
      '(?:da ultima vez|na ultima vez|da outra vez|outro dia|ontem) (?:a gente|nos|vimos|fizemos|aprendemos|conversamos|trabalhamos|praticamos|jogamos|eu te)',
      '(?:lembra|se lembra|voce lembra) (?:de )?quando (?:a gente|nos|vimos|fizemos|conversamos|jogamos)',
      'como (?:vimos|fizemos|aprendemos) (?:da ultima vez|da outra vez|antes)',
      '(?:eu )?(?:me )?lembro (?:de voce|que voce|de vc|de quando)',
      'te ver de novo|te ver outra vez|rever voce',
    ].join('|') +
    ')(?![\p{L}])',
  'u',
);

/**
 * Whether a Mentor line claims a shared history with the learner ("last time
 * we…", "I remember you", "good to see you again"). Used only for a first
 * meeting or a persona switch (`requiresFreshStart`), where any such claim is
 * false: the turn is repaired once and never delivered (Appendix D §3.4:
 * "manufactured intimacy breaks trust worse than an honest fresh start").
 * Reading the learner's OWN earlier sessions ("you practised saving before")
 * is allowed and not matched.
 */
export function claimsSharedHistory(say: string): boolean {
  return SHARED_HISTORY.test(fold(say));
}
