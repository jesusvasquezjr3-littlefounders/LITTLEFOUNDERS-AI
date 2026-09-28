import { z } from 'zod';
import {
  CONCEPT_FAMILIES,
  CONCEPT_WORDING,
  classifyExplanation,
  type ConceptFamily,
  type ExplanationQuality,
} from './explanationLexicon.js';

/*
 * C.14 — THE SELF-EXPLANATION PROMPT AS A DISTINCT, NAMED, QUALITY-CHECKED
 * DIALOGUE MOVE (Appendix D §3.3; Appendix F Part 4 phase 3).
 *
 * Prompting a learner to explain their own reasoning causally improves
 * understanding and transfer (Chi et al., 1989/1994; Aleven & Koedinger,
 * 2002), and a required prompt is gamed with filler ("because it's right")
 * unless it is checked. This object owns the move, independently of the
 * pedagogy controller's strategy math, the same way C.13's hint ladder owns
 * escalation:
 *
 *   1. A FINANCIAL DECISION POINT is detected by the orchestrator: a graded
 *      decision activity (`familiesForDecision`: piggy_split, needs_wants,
 *      price_compare, budget_fit, savings_goal, fair_trade, best_decision and
 *      the story choices) or a conversational answer to the Mentor's own
 *      money-decision question (`isDecisionQuestion`).
 *   2. `consider()` decides whether THIS decision gets the prompt (spacing
 *      and a per-session cap, so it never becomes an interrogation), and the
 *      Mentor's reacting turn only reacts (`SELF_EXPLANATION_LEAD_INSTRUCTION`);
 *      the SYSTEM then asks the written, pre-generatable question ("Why did
 *      you pick that?"), so the move happens on every selected decision and
 *      never depends on the model choosing to ask.
 *   3. The learner's reply is QUALITY-CHECKED (`classifyExplanation`): does it
 *      name the idea the decision rests on, or is it filler? A pass is
 *      acknowledged SPECIFICALLY; a low-quality reply gets ONE targeted
 *      follow-up question that points at the concept (never silent
 *      acceptance, never the answer given away); a second low-quality reply
 *      gets the reason stated once by the Mentor, and the lesson moves on —
 *      the move never loops.
 *
 * A reply that states a wrong idea is routed to C.18 (the orchestrator's
 * `statedMisconception` path): it is corrected, never praised, and recorded
 * as `misconception`. A help request while the question is open is honoured
 * by the C.13 hint ladder and recorded as `help`.
 *
 * Nothing here stores or reports what the learner said: the record is the
 * decision source, the concept family, the prompt variant and the quality
 * labels (Appendix F: Self-Explanation Quality-Check Pass Rate, diagnostic).
 */

export type SelfExplanationMode = 'act' | 'shadow' | 'off';

export function parseSelfExplanationMode(raw: string | undefined): SelfExplanationMode {
  return raw === 'shadow' || raw === 'off' ? raw : 'act';
}

export const DECISION_SOURCES = ['activity', 'conversation'] as const;
export type DecisionSource = (typeof DECISION_SOURCES)[number];

/**
 * `why` after a correct or ungraded decision, `how` after a verified-wrong
 * one (asks for the thinking without implying it was a mistake to explain),
 * `scaffolded` (a sentence stem) for a learner whose disposition profile
 * shows explanations rarely name the idea (C.7) — the scaffolding Appendix D
 * §3.3 names for low-prior-knowledge learners.
 */
export const PROMPT_VARIANTS = ['why', 'how', 'scaffolded'] as const;
export type PromptVariant = (typeof PROMPT_VARIANTS)[number];

/** A reply's quality label: the check's three, plus what else can happen to an open prompt. */
export const EXPLANATION_QUALITIES = ['concept', 'off_concept', 'filler', 'misconception', 'help', 'unanswered'] as const;
export type RecordedQuality = (typeof EXPLANATION_QUALITIES)[number];

export const SELF_EXPLANATION_OUTCOMES = [
  'passed_first',
  'passed_followup',
  'explained_by_mentor',
  'misconception_corrected',
  'skipped_help',
  'unanswered',
  'undelivered',
  'superseded',
  'shadow',
] as const;
export type SelfExplanationOutcome = (typeof SELF_EXPLANATION_OUTCOMES)[number];

export interface SelfExplanationConfig {
  /** At most this many prompts in one session (proposed, pending calibration). */
  maxPerSession: number;
  /** At least this many learner turns between two prompts. */
  minSpacingTurns: number;
}

export const SELF_EXPLANATION_DEFAULTS: SelfExplanationConfig = { maxPerSession: 4, minSpacingTurns: 3 };

const EventSchema = z
  .object({
    /** 1-based index of the prompt in this session. */
    observation: z.number().int().min(1),
    source: z.enum(DECISION_SOURCES),
    /** The first family the decision rests on (the one the follow-up points at). */
    family: z.enum(CONCEPT_FAMILIES),
    variant: z.enum(PROMPT_VARIANTS),
    mode: z.enum(['act', 'shadow']),
    firstQuality: z.enum(EXPLANATION_QUALITIES).nullable(),
    followupQuality: z.enum(EXPLANATION_QUALITIES).nullable(),
    outcome: z.enum([...SELF_EXPLANATION_OUTCOMES, 'pending', 'open', 'followup_due', 'followup_open']),
  })
  .strict();
export type SelfExplanationEvent = z.infer<typeof EventSchema>;

export const SelfExplanationSnapshotSchema = z
  .object({
    learnerTurns: z.number().int().min(0),
    lastPromptAtTurn: z.number().int().min(0).nullable(),
    /** Every family the open decision rests on (the quality check accepts any of them). */
    families: z.array(z.enum(CONCEPT_FAMILIES)).max(CONCEPT_FAMILIES.length),
    events: z.array(EventSchema).max(12),
  })
  .strict();
export type SelfExplanationSnapshot = z.infer<typeof SelfExplanationSnapshotSchema>;

export const EMPTY_SELF_EXPLANATION: SelfExplanationSnapshot = {
  learnerTurns: 0,
  lastPromptAtTurn: null,
  families: [],
  events: [],
};

/** What Core records at close (the internal lifecycle states never leave Oracle). */
export interface SelfExplanationReport {
  mode: 'act' | 'shadow';
  prompts: number;
  events: (Omit<SelfExplanationEvent, 'outcome'> & { outcome: SelfExplanationOutcome })[];
}

/** The reacting turn before the system's question: react, ask nothing, do not explain. */
export const SELF_EXPLANATION_LEAD_INSTRUCTION = [
  'SELF-EXPLANATION — decided by the system after a money decision the learner just made. React to their',
  'choice in ONE short sentence (if the system verified it right or wrong, you may say so plainly). Do NOT',
  'explain why it is right or wrong, do NOT ask any question, do NOT request an activity: the system follows',
  'your sentence with its own question asking them to explain their thinking.',
].join(' ');

/** The reply named the idea: acknowledge THEIR reason, specifically. */
export const SELF_EXPLANATION_PASS_INSTRUCTION = [
  'The learner just explained the reason for their choice, and their reason names the idea behind it.',
  'Acknowledge the SPECIFIC reason they gave, in their own terms (never generic praise such as "great thinking").',
  'If part of it is not right, say which part kindly. Then continue with the next small step.',
].join(' ');

/** The reply was filler or missed the idea: ONE targeted follow-up, never the reason given away. */
export function followupInstruction(family: ConceptFamily): string {
  return [
    'The learner was asked why they chose that, and their answer did not give a reason that names the idea',
    `behind the choice. Do NOT accept it as a reason, do NOT scold, and do NOT give the reason yourself. Ask ONE`,
    `short, concrete follow-up question that points them toward ${CONCEPT_WORDING[family]} — for example, about`,
    'what would happen next with their money. Ask nothing else and do not request an activity this turn.',
  ].join(' ');
}

/** The second reply still missed it: the Mentor states the reason once, and the lesson moves on. */
export function explainInstruction(family: ConceptFamily): string {
  return [
    'The learner still did not name the reason behind their choice. Without making them wrong, state the reason',
    `yourself in ONE short sentence that names ${CONCEPT_WORDING[family]}, then continue with the next small step.`,
    'Do not ask them to explain again.',
  ].join(' ');
}

export type ExplanationReading =
  | { kind: 'pass'; quality: 'concept' }
  | { kind: 'followup'; quality: ExplanationQuality; family: ConceptFamily }
  | { kind: 'explain'; quality: ExplanationQuality; family: ConceptFamily }
  | { kind: 'misconception' }
  | { kind: 'help' };

export class SelfExplanation {
  private state: SelfExplanationSnapshot = structuredClone(EMPTY_SELF_EXPLANATION);

  constructor(
    readonly mode: SelfExplanationMode,
    private readonly config: SelfExplanationConfig = SELF_EXPLANATION_DEFAULTS,
  ) {}

  snapshot(): SelfExplanationSnapshot {
    return structuredClone(this.state);
  }

  restore(snapshot: SelfExplanationSnapshot): void {
    this.state = structuredClone(snapshot);
  }

  private get current(): SelfExplanationEvent | undefined {
    const last = this.state.events.at(-1);
    return last && ['pending', 'open', 'followup_due', 'followup_open'].includes(last.outcome) ? last : undefined;
  }

  /** A learner turn happened (spacing is counted in learner turns). */
  noteLearnerTurn(): void {
    this.state.learnerTurns += 1;
  }

  /** Whether the system's question is waiting for the learner's explanation (first or follow-up). */
  get awaitingExplanation(): boolean {
    const c = this.current;
    return c !== undefined && (c.outcome === 'open' || c.outcome === 'followup_open');
  }

  /** Whether a selected decision's reacting turn is still to carry the prompt. */
  get promptDue(): boolean {
    return this.current?.outcome === 'pending';
  }

  /** Whether the reacting turn is to carry the targeted follow-up. */
  get followupDue(): boolean {
    return this.current?.outcome === 'followup_due';
  }

  get prompts(): number {
    return this.state.events.filter((e) => e.mode === 'act').length;
  }

  /**
   * A financial decision point. Returns whether the reacting turn must carry
   * the prompt: never while another prompt is in flight, never closer than
   * `minSpacingTurns` learner turns to the previous one, never past
   * `maxPerSession`. In shadow the selection is recorded and never acted on.
   */
  consider(input: { source: DecisionSource; families: readonly ConceptFamily[]; verifiedWrong: boolean; scaffolded: boolean }): boolean {
    if (this.mode === 'off' || input.families.length === 0) return false;
    if (this.current !== undefined) return false;
    const recorded = this.state.events.length;
    if (recorded >= this.config.maxPerSession) return false;
    const last = this.state.lastPromptAtTurn;
    if (last !== null && this.state.learnerTurns - last < this.config.minSpacingTurns) return false;
    const variant: PromptVariant = input.scaffolded ? 'scaffolded' : input.verifiedWrong ? 'how' : 'why';
    const act = this.mode === 'act';
    this.state.events.push({
      observation: recorded + 1,
      source: input.source,
      family: input.families[0]!,
      variant,
      mode: act ? 'act' : 'shadow',
      firstQuality: null,
      followupQuality: null,
      outcome: act ? 'pending' : 'shadow',
    });
    this.state.lastPromptAtTurn = this.state.learnerTurns;
    this.state.families = act ? [...input.families] : [];
    return act;
  }

  /** The prompt variant the pending/open event asks with. */
  get variant(): PromptVariant | null {
    return this.current?.variant ?? null;
  }

  /** The concept family the pending/open event is about (the scaffolded prompt's stems follow it). */
  get family(): ConceptFamily | null {
    return this.current?.family ?? null;
  }

  /** The system's question reached the learner (after a delivered model turn). */
  markPromptDelivered(): void {
    const c = this.current;
    if (c?.outcome === 'pending') c.outcome = 'open';
  }

  /** The reacting turn could not carry it (scripted fallback, block, interrupt): the moment has passed. */
  markPromptNotDelivered(): void {
    const c = this.current;
    if (c?.outcome === 'pending') {
      c.outcome = 'undelivered';
      this.state.families = [];
    }
  }

  /** The follow-up question went out on a delivered model turn. */
  markFollowupDelivered(): void {
    const c = this.current;
    if (c?.outcome === 'followup_due') c.outcome = 'followup_open';
  }

  /** The follow-up turn could not be delivered: the move closes on the first reading. */
  markFollowupNotDelivered(): void {
    const c = this.current;
    if (c?.outcome === 'followup_due') {
      c.outcome = 'undelivered';
      this.state.families = [];
    }
  }

  /**
   * Reads the learner's reply to the open question. `misconception` and
   * `help` are decided by the caller (C.18's reader and C.13's detector run
   * first); otherwise the quality check decides.
   */
  readReply(text: string, precheck: { misconception: boolean; help: boolean }): ExplanationReading | null {
    const c = this.current;
    if (c === undefined || (c.outcome !== 'open' && c.outcome !== 'followup_open')) return null;
    const first = c.outcome === 'open';
    const close = (outcome: SelfExplanationOutcome): void => {
      c.outcome = outcome;
      this.state.families = [];
      // Spacing counts from the END of the move: a learner who needed the
      // follow-up is not asked again right away.
      this.state.lastPromptAtTurn = this.state.learnerTurns;
    };
    if (precheck.misconception) {
      if (first) c.firstQuality = 'misconception';
      else c.followupQuality = 'misconception';
      close('misconception_corrected');
      return { kind: 'misconception' };
    }
    if (precheck.help) {
      if (first) c.firstQuality = 'help';
      else c.followupQuality = 'help';
      close('skipped_help');
      return { kind: 'help' };
    }
    const quality = classifyExplanation(text, this.state.families);
    if (first) {
      c.firstQuality = quality;
      if (quality === 'concept') {
        close('passed_first');
        return { kind: 'pass', quality };
      }
      c.outcome = 'followup_due';
      return { kind: 'followup', quality, family: c.family };
    }
    c.followupQuality = quality;
    if (quality === 'concept') {
      close('passed_followup');
      return { kind: 'pass', quality };
    }
    close('explained_by_mentor');
    return { kind: 'explain', quality, family: c.family };
  }

  /** The learner moved on without answering (an activity, a spoken answer, a system choice). */
  noteMovedOn(): void {
    const c = this.current;
    if (c === undefined) return;
    if (c.outcome === 'open') c.firstQuality = 'unanswered';
    if (c.outcome === 'followup_open') c.followupQuality = 'unanswered';
    if (c.outcome === 'open' || c.outcome === 'followup_open') {
      c.outcome = 'unanswered';
      this.state.families = [];
    }
  }

  /** A safety stop, a closing sequence, the C.19 check-in or C.15 renegotiation took the moment. */
  supersede(): void {
    const c = this.current;
    if (c === undefined) return;
    c.outcome = 'superseded';
    this.state.families = [];
  }

  report(): SelfExplanationReport {
    return {
      mode: this.mode === 'shadow' ? 'shadow' : 'act',
      prompts: this.prompts,
      events: this.state.events.map((e) => ({
        ...e,
        outcome:
          e.outcome === 'pending'
            ? 'undelivered'
            : e.outcome === 'open'
              ? 'unanswered'
              : e.outcome === 'followup_due'
                ? 'undelivered'
                : e.outcome === 'followup_open'
                  ? 'unanswered'
                  : e.outcome,
      })),
    };
  }
}
