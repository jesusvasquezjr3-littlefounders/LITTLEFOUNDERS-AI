import { getConfig } from '../env.js';
import { sealContext, type SkillState, type TutorContext } from '../context/schema.js';
import {
  buildPlan,
  noteConversationTurn,
  planState,
  recordGrade,
  stuckInstruction,
  type LessonPlan,
} from './plan.js';
import { IDLE_NUDGE_MS, PedagogicalController, type PedagogyEvent } from './controller.js';
import { classifyLearnerInput, type SafetyCategory } from '../safety/classifier.js';
import { fenceUntrusted } from '../safety/untrusted.js';
import { moderateTutorOutput } from '../safety/moderation.js';
import { complete, CompletionAbortedError, ModelUnavailableError } from '../model/provider.js';
import { evaluateBudget, WRAP_UP_INSTRUCTION, type BudgetVerdict } from '../session/budget.js';
import { buildContextMessage, TUTOR_SYSTEM_PROMPT } from './prompt.js';
import { parseTurn, type TutorTurn } from './turnSchema.js';
import {
  closingResponse,
  consentRevokedResponse,
  greetingResponse,
  moderationBlockedResponse,
  modelDownResponse,
  safetyResponse,
} from './scripted.js';
import type { SpeechResult } from '../voice/speech.js';
import type { SessionContext } from '../core/client.js';

/*
 * One live session, as a state machine over turns.
 *
 * THE PIPELINE, in the order /ORACLE.md §5 and §6 require, with the reason each
 * step is where it is:
 *
 *   budget      → an over-budget session must not spend a model call to find
 *                 out it is over budget.
 *   classify    → BEFORE the model. A flagged utterance must never enter a
 *                 context window; once it is there it is already at a third
 *                 party and no downstream check can recall it.
 *   fence       → the learner's words become labelled data, never instructions.
 *   seal        → .strict() validation of everything about the learner. Throws
 *                 rather than trimming.
 *   generate    → the only model call.
 *   parse       → closed schema. Invalid output is DISCARDED, not displayed.
 *   moderate    → whole turn, before screen and before speech. Fail-closed.
 *   speak       → synthesis is best-effort and last, so a voice outage costs
 *                 the sound and nothing else.
 *
 * TWO LATENCY DECISIONS live here, and neither weakens the order above:
 *
 *   SPLIT DELIVERY — a turn's emission carries `audio` as a PROMISE. The text
 *   ships to the learner the moment moderation passes; the voice follows when
 *   synthesis and storage finish. Nothing unmoderated moves earlier: the text
 *   frame still sits strictly after the moderation await.
 *
 *   SPECULATIVE SYNTHESIS (owner sign-off 2026-08-28) — for a model-authored
 *   turn, synthesis starts CONCURRENTLY with the moderation judge. The audio
 *   is delivered only on a pass; on a block it is discarded, still billed
 *   (`speechCounts.discarded` makes the spend visible), and never referenced.
 *   "Moderated whole, and only then SPOKEN" is about what reaches the child's
 *   ear, and that gate is intact — the discarded clip reaches nobody. Blocked
 *   turns are rare enough that paying for their synthesis buys roughly a
 *   second off every ordinary turn.
 *
 * This class is transport-agnostic: it knows nothing about websockets. The
 * server (ws/server.ts) owns the socket and calls `handleLearnerText`; the
 * orchestrator returns what should be emitted. That split is what makes the
 * whole pipeline testable without opening a port.
 */

export interface TurnEmission {
  turn: TutorTurn;
  seq: number;
  source: 'model' | 'scripted';
  /**
   * The turn's voice, still arriving. Resolves to a Depot URL, or to null
   * when the turn stays captioned and silent. Never rejects — `speak()`
   * swallows synthesis failures into null, because a lost voice costs the
   * sound and not the lesson. The caller delivers the text immediately and
   * the audio when this settles.
   */
  audio: Promise<string | null>;
  moderation: Record<string, unknown>;
}

export interface SafetyEvent {
  category: SafetyCategory;
  severity: 'low' | 'medium' | 'high';
  handled: 'scripted_response' | 'turn_blocked' | 'session_stopped';
  turnSeq: number;
}

export interface TurnOutcome {
  emission: TurnEmission;
  safety: SafetyEvent | null;
  budget: BudgetVerdict;
  /** Set when the session must end after this turn is delivered. */
  closeReason: 'completed' | 'hard_budget' | 'turn_cap' | 'safety_stop' | null;
}

export interface Synthesizer {
  (turn: TutorTurn, session: SessionContext): Promise<SpeechResult>;
}

export class TutorOrchestrator {
  private readonly history: { speaker: 'learner' | 'tutor'; text: string }[] = [];
  private seq = 0;
  private modelUsd = 0;
  private voiceUsd = 0;
  private paidSyntheses = 0;
  private freeSyntheses = 0;
  private discardedSyntheses = 0;
  private segmentCount = 0;
  private adaptations: TutorContext['adaptations'];
  private stopped = false;
  private lastTurn: { turn: TutorTurn; seq: number } | null = null;
  /** The lesson's spine — deterministic, server-owned (tutor/plan.ts). */
  private readonly plan: LessonPlan;
  /**
   * The v3 strategy controller (tutor/controller.ts). Dormant (inactive) when
   * Core sent no session plan — v2 behaviour exactly. When active it decides
   * HOW each beat is taught while plan.ts keeps deciding WHICH beat.
   */
  private readonly controller: PedagogicalController;
  /**
   * The one currently-open activity a spoken answer could be checked against:
   * set when a voice-checkable segment is served, cleared when it grades.
   */
  private openCheckableSegment: string | null = null;
  /**
   * The session's LIVE copy of the skill estimates. The handshake snapshot
   * used to be frozen for the whole session, so the model was told "very
   * little evidence" about a skill the learner had just demonstrated four
   * times. Nudged locally per graded result; Core keeps the authoritative
   * record through its own grading endpoint, so nothing here is persisted.
   */
  private readonly skillStates: SkillState[];
  /**
   * Every activity THIS session actually served, by id. `segment_graded` must
   * name one of these — the score is client-reported (it echoes Core's own
   * grading), and a fabricated id was previously accepted without question.
   */
  private readonly servedSegmentSkills = new Map<string, string>();

  constructor(
    private readonly session: SessionContext,
    private readonly startedAtMs: number,
    /** Injected so tests never touch a network and the server owns Depot. */
    private readonly synthesize: Synthesizer,
  ) {
    this.adaptations = [...session.adaptations] as TutorContext['adaptations'];
    this.plan = buildPlan(session.intent, session.courseContext, session.skillKey ?? null);
    this.skillStates = session.skillStates.slice(0, 12).map((s) => ({ ...s }));
    this.controller = new PedagogicalController(session.sessionPlan ?? []);
  }

  /** Whether the v3 brain is steering this session. */
  get pedagogyActive(): boolean {
    return this.controller.active;
  }

  /** The KC the next served activity should be stamped with, or null. */
  get activeKcId(): string | null {
    return this.controller.active ? this.controller.activeKcId : null;
  }

  /** The strategy in force, for provenance stamps and telemetry. */
  get activeStrategy(): string | null {
    return this.controller.active ? this.controller.currentStrategy : null;
  }

  /** Per-strategy client idle-nudge budget, or null while the brain is off. */
  get idleNudgeMs(): number | null {
    return this.controller.active ? IDLE_NUDGE_MS[this.controller.currentStrategy] : null;
  }

  /** The controller's difficulty band for the next activity, or null. */
  get activeDifficulty(): 1 | 2 | 3 | 4 | 5 | null {
    return this.controller.active ? this.controller.targetDifficulty : null;
  }

  /** The active KC's content-pool skill key, when the catalog mapped one. */
  get activeSkillKey(): string | null {
    return this.controller.active ? this.controller.activeSkillKey : null;
  }

  /** The open activity a spoken answer could be deterministically checked against. */
  get checkableSegmentId(): string | null {
    return this.openCheckableSegment;
  }

  get turnCount(): number {
    return this.seq;
  }

  /**
   * What this session cost us, model AND voice (/ORACLE.md §15).
   *
   * Voice used to be missing from this number entirely, which meant the ledger
   * confidently reported the cheap half of the most expensive surface in the
   * product. It is one number because that is what Core stores; the split is
   * available beside it for a log line and for anyone asking where it went.
   */
  get totalCostUsd(): number {
    return this.modelUsd + this.voiceUsd;
  }

  get modelCostUsd(): number {
    return this.modelUsd;
  }

  get voiceCostUsd(): number {
    return this.voiceUsd;
  }

  /**
   * Lines actually paid for, lines served free from the manifest or cache, and
   * speculative syntheses discarded because moderation blocked their turn —
   * paid for and delivered to nobody. `discarded` staying near zero is what
   * keeps the speculative gamble worth taking; a session where it climbs is a
   * session worth reading.
   */
  get speechCounts(): { paid: number; free: number; discarded: number } {
    return { paid: this.paidSyntheses, free: this.freeSyntheses, discarded: this.discardedSyntheses };
  }

  /** The budget verdict right now, for callers outside a turn (keepalive). */
  budgetAt(nowMs: number): BudgetVerdict {
    return this.currentBudget(nowMs);
  }

  /**
   * What a re-attaching socket needs to redraw the conversation: the whole
   * transcript so far, and the turn that was on screen when the connection
   * dropped. Copies, so a caller cannot reach the live history.
   */
  get resumeSnapshot(): {
    turns: { speaker: 'learner' | 'tutor'; text: string }[];
    lastTurn: { turn: TutorTurn; seq: number } | null;
  } {
    return {
      turns: this.history.map((h) => ({ speaker: h.speaker, text: h.text })),
      lastTurn: this.lastTurn,
    };
  }

  get servedSegments(): number {
    return this.segmentCount;
  }

  /**
   * The tutor's OWN last few lines, for the generator's "do not repeat this"
   * hint. Deliberately tutor-only: the learner's words are untrusted input and
   * have no business inside an authoring brief, where nothing fences them.
   */
  get recentTutorLines(): string[] {
    return this.history.filter((h) => h.speaker === 'tutor').slice(-6).map((h) => h.text);
  }

  /** Segment types whose answer is one number a spoken reply could carry. */
  private static readonly CHECKABLE_TYPES = new Set([
    'number_input',
    'count_objects',
    'estimate_slider',
    'money_tray',
  ]);

  /** An activity went out. Remembered by id, so a grade can be matched to it. */
  noteSegmentServed(segmentId: string, skillKey: string, segmentType?: string): void {
    this.segmentCount += 1;
    this.servedSegmentSkills.set(segmentId, skillKey);
    if (segmentType && TutorOrchestrator.CHECKABLE_TYPES.has(segmentType)) {
      this.openCheckableSegment = segmentId;
    }
  }

  /** Whether this session actually served the segment a grade claims to be for. */
  wasServed(segmentId: string): boolean {
    return this.servedSegmentSkills.has(segmentId);
  }

  /** The learner accepted an offered adaptation. Applied only on acceptance (§11). */
  applyAdaptation(adaptation: TutorContext['adaptations'][number]): void {
    if (!this.adaptations.includes(adaptation)) this.adaptations.push(adaptation);
  }

  /**
   * The session's opening line — WRITTEN, not generated.
   *
   * This used to ask the model to invent an opening, which cost a reasoning
   * round trip and a text-to-speech charge in every session that has ever run
   * or ever will. Both are now zero: the line is one of twelve a person wrote
   * in character (`scripted.ts`), and its audio is pre-generated
   * (`voice/pregenerated.ts`), so the session opens as fast as the socket.
   *
   * It is a scripted outcome in the full sense — no model call, no moderation
   * pass (a scripted line is already reviewed text, §2.4), and recorded in the
   * transcript as `source: 'scripted'` like every other written line.
   */
  async greet(nowMs: number): Promise<TurnOutcome> {
    return this.scriptedOutcome(
      greetingResponse(this.session.character, this.session.locale),
      this.currentBudget(nowMs),
      null,
      null,
    );
  }

  /**
   * A graded activity came back; the tutor reacts to the actual result — and
   * the PLAN moves. The grade feeds three deterministic things before any
   * model call: the failure counter that decides "stuck", the live skill
   * estimate the context message reads, and the step pointer. The caller has
   * already verified `segmentId` names an activity this session served.
   */
  async handleSegmentResult(
    segmentId: string,
    score: number,
    correct: boolean,
    nowMs: number,
    signal?: AbortSignal,
    pedagogy?: { misconceptionCode: string | null; attemptNumber?: number } | null,
  ): Promise<TurnOutcome | null> {
    const skillKey = this.servedSegmentSkills.get(segmentId) ?? 'unknown';
    this.nudgeSkillEstimate(skillKey, correct);
    // The stuck instruction reads the counter recordGrade is about to bump,
    // so the order is: count the miss, then ask what it now amounts to.
    recordGrade(this.plan, skillKey, correct);
    if (this.openCheckableSegment === segmentId) this.openCheckableSegment = null;

    /*
     * THE CONTROLLER SUPERSEDES THE STUCK COUNTER when it is active: the same
     * event feeds it (with the misconception diagnosis when the signed grade
     * echo carried one), and ITS instruction — REMEDIATE with the catalogued
     * hint, RESCUE, PROBE into a prerequisite — replaces the generic
     * change-the-style line. Inactive controller = exactly the v2 path.
     */
    const extra = this.strategyInstruction(
      {
        kind: 'activity_result',
        correct,
        misconceptionCode: pedagogy?.misconceptionCode ?? null,
        attemptNumber: pedagogy?.attemptNumber ?? 1,
      },
      nowMs,
      correct ? null : () => stuckInstruction(this.plan, skillKey),
    );

    const summary = correct
      ? `The learner completed the activity and scored ${score} out of 100.`
      : `The learner did not pass the activity; they scored ${score} out of 100.`;
    return this.produce(
      `${summary} React to that as their tutor: say what was good about their thinking first, then help with what is still missing. Do not read the number out loud.${extra ? `\n\n${extra}` : ''}`,
      nowMs,
      { isSystemPrompted: true, signal },
    );
  }

  /**
   * A spoken answer was deterministically checked by Core (voice-check). The
   * same pedagogical event stream as a graded widget, minus XP — the tutor
   * reacts to a verdict the model never made.
   */
  async handleVoiceCheckResult(
    segmentId: string,
    result: { correct: boolean; misconceptionCode: string | null },
    utterance: string,
    nowMs: number,
    signal?: AbortSignal,
  ): Promise<TurnOutcome | null> {
    // The learner's line enters the working history exactly as an ordinary
    // turn would — fenced first, so it stays data — or the model would answer
    // a verdict about words it never saw.
    const fenced = fenceUntrusted(utterance, getConfig().TURN_MAX_INPUT_CHARS);
    if (fenced.cleaned !== '') this.history.push({ speaker: 'learner', text: fenced.cleaned });

    const skillKey = this.servedSegmentSkills.get(segmentId) ?? 'unknown';
    this.nudgeSkillEstimate(skillKey, result.correct);
    recordGrade(this.plan, skillKey, result.correct);
    if (this.openCheckableSegment === segmentId) this.openCheckableSegment = null;

    const extra = this.strategyInstruction(
      { kind: 'voice_result', correct: result.correct, misconceptionCode: result.misconceptionCode },
      nowMs,
      result.correct ? null : () => stuckInstruction(this.plan, skillKey),
    );

    const summary = result.correct
      ? 'The learner just answered the current activity OUT LOUD, and their spoken answer was verified as CORRECT.'
      : 'The learner just answered the current activity OUT LOUD, and their spoken answer was verified as INCORRECT.';
    return this.produce(
      `${summary} React as their tutor — acknowledge the spoken answer naturally, never mention any verification.${extra ? `\n\n${extra}` : ''}`,
      nowMs,
      { isSystemPrompted: true, signal },
    );
  }

  /** The controller's instruction when active; the legacy fallback otherwise. */
  private strategyInstruction(
    event: PedagogyEvent,
    nowMs: number,
    legacy: (() => string | null) | null,
  ): string | null {
    if (this.controller.active) {
      return this.controller.decide(event, nowMs).instruction;
    }
    return legacy ? legacy() : null;
  }

  /**
   * The in-session nudge. Small and bounded on purpose: the authoritative
   * estimate is Data Intel's, rebuilt from Core's graded rows offline. This
   * exists so the CONTEXT MESSAGE stops describing a learner as unevidenced
   * on a skill they demonstrated ninety seconds ago.
   */
  private nudgeSkillEstimate(skillKey: string, correct: boolean): void {
    const existing = this.skillStates.find((s) => s.skillKey === skillKey);
    if (existing) {
      const delta = correct ? 0.08 : -0.08;
      existing.masteryProbability = Math.min(0.95, Math.max(0.05, existing.masteryProbability + delta));
      existing.uncertainty = Math.max(0.05, existing.uncertainty * 0.9);
      existing.evidenceCount += 1;
      return;
    }
    if (this.skillStates.length < 12 && skillKey !== 'unknown') {
      this.skillStates.push({
        skillKey,
        masteryProbability: correct ? 0.6 : 0.4,
        uncertainty: 0.5,
        evidenceCount: 1,
        recommendedAction: correct ? 'continue' : 'practice',
        reasonCode: 'observed_this_session',
      });
    }
  }

  /**
   * The main path: the learner said something.
   *
   * Returns null ONLY when the caller aborted mid-production (the learner
   * interrupted): nothing is emitted, nothing is spoken, and the learner's own
   * line stays in the history — they said it, and the next turn answers both.
   */
  async handleLearnerText(raw: string, nowMs: number, signal?: AbortSignal): Promise<TurnOutcome | null> {
    const config = getConfig();
    const budget = this.currentBudget(nowMs);

    if (this.stopped || budget.state === 'ended') {
      return this.scriptedOutcome(
        closingResponse(this.session.locale, 'hard'),
        budget,
        budget.reason === 'turn_cap' ? 'turn_cap' : 'hard_budget',
        null,
      );
    }

    // ── classify BEFORE the model ────────────────────────────────────────────
    const classification = classifyLearnerInput(raw, this.session.locale);
    if (classification.category !== null && classification.action !== 'allow') {
      const stopping = classification.action === 'session_stopped';
      if (stopping) this.stopped = true;
      // The learner's turn IS recorded (a guardian must be able to read what
      // was said), but it is recorded by the caller against the transcript —
      // never added to `history`, so it cannot reach the model on a later turn
      // through the back door of conversational context.
      return this.scriptedOutcome(
        safetyResponse(classification.category, this.session.locale),
        budget,
        stopping ? 'safety_stop' : null,
        {
          category: classification.category,
          severity: classification.severity,
          handled: classification.action,
          turnSeq: this.seq,
        },
      );
    }

    const fenced = fenceUntrusted(raw, config.TURN_MAX_INPUT_CHARS);
    if (fenced.cleaned === '') {
      // Everything the learner sent was invisible characters or fence syntax.
      // Not worth a model call and not worth an error message either.
      return this.scriptedOutcome(moderationBlockedResponse(this.session.locale), budget, null, null);
    }

    this.history.push({ speaker: 'learner', text: fenced.cleaned });
    const outcome = await this.produce(fenced.block, nowMs, { nonce: fenced.nonce, signal });
    // A completed exchange moves the plan's talk-only steps along; an aborted
    // one does not — a question the tutor never answered was not an exchange.
    if (outcome !== null) noteConversationTurn(this.plan);
    return outcome;
  }

  /**
   * The learner rephrased their last message. The pair it replaces — their
   * line and the tutor's answer to it — leaves the WORKING history so the
   * model answers the rephrasing rather than a conversation arguing with
   * itself; the persisted transcript keeps everything, append-only, as a
   * guardian-readable record must. Then it is an ordinary turn.
   */
  async handleLearnerEdit(raw: string, nowMs: number, signal?: AbortSignal): Promise<TurnOutcome | null> {
    if (this.history.at(-1)?.speaker === 'tutor') this.history.pop();
    if (this.history.at(-1)?.speaker === 'learner') this.history.pop();
    return this.handleLearnerText(raw, nowMs, signal);
  }

  /**
   * A guardian revoked the microphone mid-session, and the words in flight
   * came THROUGH that microphone. They are not produced against: the scripted
   * line — human-written, in character, already reviewed — explains what
   * happened, and the session continues typed. This used to be a bare error
   * frame, which left a written-and-recorded line (`consentRevokedResponse`)
   * that the tutor never actually said.
   */
  async consentRevoked(nowMs: number): Promise<TurnOutcome> {
    return this.scriptedOutcome(
      consentRevokedResponse(this.session.locale),
      this.currentBudget(nowMs),
      null,
      null,
    );
  }

  /** Ends the session in character. */
  async farewell(nowMs: number, kind: 'soft' | 'hard'): Promise<TurnOutcome> {
    const budget = this.currentBudget(nowMs);
    return this.scriptedOutcome(closingResponse(this.session.locale, kind), budget, 'completed', null);
  }

  private currentBudget(nowMs: number): BudgetVerdict {
    return evaluateBudget(
      { startedAtMs: this.startedAtMs, nowMs, turnCount: this.seq },
      getConfig(),
    );
  }

  /** Builds the sealed context for this turn. Throws if anything is off-contract. */
  private context(): TutorContext {
    return sealContext({
      nickname: this.session.nickname,
      tier: this.session.tier,
      locale: this.session.locale,
      character: this.session.character,
      intent: this.session.intent,
      adaptations: this.adaptations,
      courseContext: this.session.courseContext,
      // The LIVE copy, nudged per graded result — not the handshake snapshot.
      skillStates: this.skillStates.slice(0, 12),
      // Last 20 exchanges. Truncation is not just a token budget: a long
      // history is also a long window in which an earlier injection attempt
      // could keep influencing later turns.
      turnHistory: this.history.slice(-20),
      planState: planState(this.plan),
      previousSessions: (this.session.previousSessions ?? []).slice(0, 3),
      // The v3 controller's strict projection; null while the brain is off,
      // which renders exactly the v2 context (§4.1 row + legal §2.2 item 12).
      pedagogy: this.controller.active ? this.controller.state() : null,
    });
  }

  private async produce(
    userContent: string,
    nowMs: number,
    opts: { nonce?: string; isSystemPrompted?: boolean; signal?: AbortSignal } = {},
  ): Promise<TurnOutcome | null> {
    const budget = this.currentBudget(nowMs);

    /*
     * THE CAP IS ENFORCED HERE, AT THE ENTRY TO EVERY MODEL CALL.
     *
     * `handleLearnerText` refused an ended session before calling this; no
     * other caller did. `handleSegmentResult` went straight through, so a
     * client that sent `segment_graded` kept buying model turns after the
     * budget said stop — and since `this.seq` only advanced AFTER the upstream
     * call returned, a burst of frames all measured themselves against the
     * same stale count and all passed a cap none of them had reached yet.
     *
     * Two changes, and both matter. The refusal moves to the one function
     * every path funnels through, so a new caller inherits it instead of
     * having to remember it. And the slot is RESERVED below before the call
     * rather than counted after it, so the cap describes turns started rather
     * than turns finished.
     */
    if (this.stopped || budget.state === 'ended') {
      return this.scriptedOutcome(
        closingResponse(this.session.locale, 'hard'),
        budget,
        budget.reason === 'turn_cap' ? 'turn_cap' : 'hard_budget',
        null,
      );
    }

    let context: TutorContext;
    try {
      context = this.context();
    } catch (error) {
      // A context that failed .strict() is a bug in our own builder, not a
      // learner problem. Refuse to call the model, say something scripted, and
      // let the error reach the logs with its field name intact.
      console.error('[oracle] context seal failed:', error);
      return this.scriptedOutcome(modelDownResponse(this.session.locale), budget, null, null);
    }

    const systemContent =
      TUTOR_SYSTEM_PROMPT + (budget.state === 'wrapping' ? WRAP_UP_INSTRUCTION : '');

    let turn: TutorTurn | null = null;
    let source: 'model' | 'scripted' = 'model';

    /*
     * THE SLOT IS RESERVED HERE — after the context sealed, before anything is
     * bought, and never released.
     *
     * After the seal because a context that fails `.strict()` never reaches
     * the model and costs nothing, and because that path returns through
     * `scriptedOutcome`, which counts its own turn. Before the call because
     * counting afterwards is what let a burst of concurrent frames each read
     * the same stale `seq` and each pass a cap none of them had reached.
     */
    this.seq += 1;

    try {
      // One retry, and only for a SHAPE failure. A model that returned prose
      // will usually return JSON when told so explicitly; a model that is down
      // will still be down, so retrying a transport error just doubles the
      // learner's wait.
      for (let attempt = 0; attempt < 2 && turn === null; attempt += 1) {
        const messages = [
          { role: 'system' as const, content: systemContent },
          { role: 'user' as const, content: buildContextMessage(context) },
          { role: 'user' as const, content: userContent },
        ];
        if (attempt === 1) {
          messages.push({
            role: 'user' as const,
            content:
              'Your previous reply was not a valid JSON object in the required shape. Reply again with ONLY the JSON object.',
          });
        }

        const result = await complete(messages, {
          temperature: attempt === 0 ? 0.6 : 0.2,
          signal: opts.signal,
        });
        this.modelUsd += estimateCostUsd(result.promptTokens, result.completionTokens);

        const parsed = parseTurn(result.text);
        if (parsed.ok) {
          turn = parsed.turn;
        } else {
          console.warn(`[oracle] discarded model turn (${parsed.reason}): ${parsed.detail}`);
        }
      }
    } catch (error) {
      if (error instanceof CompletionAbortedError) {
        // The learner cut in. The question is abandoned, so its answer is
        // worth nothing: no emission, no scripted line, no synthesis. The
        // reserved slot stays spent — the turn was started, and a cap that
        // interruptions could refund would be a cap a burst can dodge.
        return null;
      }
      if (!(error instanceof ModelUnavailableError)) throw error;
      console.warn('[oracle] model unavailable:', error.message);
    }

    if (turn === null) {
      turn = modelDownResponse(this.session.locale);
      source = 'scripted';
    }

    // ── moderation: whole turn, before screen and before speech ──────────────
    //
    // ONLY generated turns are moderated. A scripted line is text a person
    // wrote and reviewed (tutor/scripted.ts), so putting it in front of a
    // judge buys nothing and costs something real: a judge outage would
    // replace an already-safe scripted line with a different scripted line,
    // and a model outage would then cost two upstream calls per turn instead
    // of one. Moderation exists to check output we did not author.
    let safety: SafetyEvent | null = null;
    let moderationRecord: Record<string, unknown> = { allowed: true, source };

    /*
     * EVERY learner-visible string the model authored, not just `say`.
     *
     * `segmentRequest.framing` is 240 characters of free prose that the client
     * prints under the activity, and it was moderated NOWHERE while two
     * comments — one in turnSchema.ts, one in LiveSegmentPanel.tsx — asserted
     * it was "moderated like `say`". A model that wanted to reach a child with
     * something we would block had only to put it in the other field of the
     * same turn: same model, same turn, same pixel, no judge.
     *
     * They are moderated TOGETHER in one call rather than separately, for two
     * reasons. It is one upstream round trip instead of two on the routine
     * path. And a block already drops the whole turn including its segment
     * request, so a per-field verdict would have nothing extra to act on —
     * there is no state in which we would want to keep the activity and
     * discard its framing.
     *
     * The separator is a blank line so the judge reads two sentences rather
     * than one run-on, which is what it would otherwise score.
     */
    const visibleText =
      turn.segmentRequest != null ? `${turn.say}\n\n${turn.segmentRequest.framing}` : turn.say;

    /*
     * SPECULATIVE SYNTHESIS, concurrent with the judge (see the file header).
     * Started only for a model-authored turn — a scripted line needs no judge,
     * so it has nothing to overlap with. The clip is DELIVERED only on a pass;
     * on a block it is discarded and counted, never referenced.
     */
    let audio: Promise<string | null>;
    if (source === 'model') {
      const speculative = this.speak(turn);
      const verdict = await moderateTutorOutput({
        text: visibleText,
        locale: this.session.locale,
        tier: this.session.tier,
        nonce: opts.nonce,
        // A minor's session always requires the model pass. An adult's may
        // run on the deterministic pass alone (/ORACLE.md §6).
        requireModelPass: this.session.isMinor,
      });

      if (!verdict.allowed) {
        console.warn(`[oracle] blocked tutor turn (${verdict.reason}): ${verdict.detail}`);
        safety = {
          category: 'model_output_blocked' as SafetyCategory,
          severity: verdict.reason === 'moderator_unavailable' ? 'medium' : 'high',
          handled: 'turn_blocked',
          turnSeq: this.seq,
        };
        moderationRecord = { allowed: false, reason: verdict.reason, detail: verdict.detail };
        turn = moderationBlockedResponse(this.session.locale);
        source = 'scripted';
        // The blocked line's clip: paid for (speak() bills it when it settles)
        // and delivered to nobody. Counted so the gamble stays visible.
        this.discardedSyntheses += 1;
        void speculative;
        audio = this.speak(turn);
      } else {
        audio = speculative;
      }
    } else {
      audio = this.speak(turn);
    }

    if (opts.signal?.aborted) {
      // The learner cut in while the judge (or a slow synthesis start) was
      // still working. Money is already spent either way; delivering the turn
      // now would talk OVER the learner, which is the one outcome worse than
      // the waste. The clip joins the discard count and nothing is emitted.
      this.discardedSyntheses += 1;
      return null;
    }

    // `this.seq` was already advanced at entry, where the slot was reserved.
    this.history.push({ speaker: 'tutor', text: turn.say });
    this.lastTurn = { turn, seq: this.seq };

    const afterBudget = this.currentBudget(nowMs);
    const closeReason =
      turn.next === 'close'
        ? 'completed'
        : afterBudget.state === 'ended'
          ? afterBudget.reason === 'turn_cap'
            ? 'turn_cap'
            : 'hard_budget'
          : null;

    return {
      emission: { turn, seq: this.seq, source, audio, moderation: moderationRecord },
      safety,
      budget: afterBudget,
      closeReason,
    };
  }

  /**
   * Synthesis is best-effort, never throws upward, and is BILLED INTO THE
   * LEDGER when it was actually paid for (/ORACLE.md §15).
   *
   * The free paths — a pre-generated scripted line, a cache hit — add nothing,
   * which is what makes the ledger able to show the cache working: two
   * sessions with the same turn count and very different voice costs is the
   * signal, and it was invisible while `speak()` recorded nothing at all.
   */
  private async speak(turn: TutorTurn): Promise<string | null> {
    let result: SpeechResult;
    try {
      result = await this.synthesize(turn, this.session);
    } catch (error) {
      console.warn('[oracle] synthesis failed:', error instanceof Error ? error.message : error);
      return null;
    }

    if (result.billedChars > 0) {
      this.voiceUsd += estimateVoiceCostUsd(result.billedChars);
      this.paidSyntheses += 1;
    } else if (result.url !== null) {
      this.freeSyntheses += 1;
    }
    return result.url;
  }

  private async scriptedOutcome(
    turn: TutorTurn,
    budget: BudgetVerdict,
    closeReason: TurnOutcome['closeReason'],
    safety: SafetyEvent | null,
  ): Promise<TurnOutcome> {
    this.history.push({ speaker: 'tutor', text: turn.say });
    this.seq += 1;
    this.lastTurn = { turn, seq: this.seq };
    // Not awaited: a scripted line's text is ready NOW, and its audio (usually
    // the pre-generated manifest) follows in its own frame like any other.
    const audio = this.speak(turn);
    return {
      emission: { turn, seq: this.seq, source: 'scripted', audio, moderation: { allowed: true, source: 'scripted' } },
      safety,
      budget,
      closeReason,
    };
  }
}

/*
 * Rough cost, for the per-session ledger (/ORACLE.md §15).
 *
 * Deliberately an ESTIMATE with the rates in one place, and deliberately not
 * presented as an invoice. The point is to notice a session that cost ten
 * times what sessions normally cost, long before the provider's bill says so —
 * an order of magnitude is visible through any rate error, and chasing exact
 * per-model pricing in code means it is wrong the week after a price change.
 */
const USD_PER_1K_PROMPT = 0.00027;
const USD_PER_1K_COMPLETION = 0.0011;

/*
 * And the same for VOICE, which was missing from this ledger entirely.
 *
 * §15 says cost is recorded per session "so the economics are measurable
 * before they are a surprise", and the most expensive surface in the product
 * contributed nothing to the number. A session could synthesise forty turns
 * and report the price of its tokens.
 *
 * Speech is billed PER CHARACTER OF TEXT — the provider even returns
 * `usage.processedCharactersCount` — so the rate lives here in the same shape
 * and the same file as the model rates, for the same reason: one place to
 * correct when a price changes, and no pretence of being an invoice. Only text
 * we actually sent is counted; a line served from the manifest or the cache
 * adds zero, which is the whole point of measuring it.
 */
const USD_PER_1K_TTS_CHARS = 0.005;

export function estimateCostUsd(promptTokens: number, completionTokens: number): number {
  return (promptTokens / 1000) * USD_PER_1K_PROMPT + (completionTokens / 1000) * USD_PER_1K_COMPLETION;
}

export function estimateVoiceCostUsd(characters: number): number {
  return (characters / 1000) * USD_PER_1K_TTS_CHARS;
}
