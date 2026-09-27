import { z } from 'zod';
import type { CloseReason } from '../core/client.js';

/*
 * C.16 — FOUR END-REASON-SPECIFIC CLOSING SCRIPTS (Appendix D §3.5).
 *
 * The peak-end rule (meta-analytic r≈0.58) says how a session ENDS drives how
 * the whole of it is remembered, so one generic "great work today!" for every
 * ending is the likely mechanism of the "no aprendí nada" aftertaste. The
 * Alliance Controller part of the Block C standard therefore owns four
 * distinct scripts, chosen from how the session actually ended:
 *
 *   completed     A normal completion. The full sequence: a CO-CONSTRUCTED
 *                 recap question ("what is one thing that clicked for you
 *                 today?"), the Mentor's short reflection of the answer, then
 *                 a SPECIFIC effort acknowledgment naming an act the system
 *                 actually observed (`EffortAct`, below — never generic
 *                 praise), with forward framing to the next session.
 *                 Since OD-28 (owner review M-04) this includes a learner
 *                 pressing "end": the recap question is asked first.
 *   interrupted   The budget ran out mid-task (or the session was cut short
 *                 by the system). Says so explicitly and names the re-entry
 *                 point ("next time, we pick up right here"); the promise is
 *                 kept by the next session's opening (Core's `opening`) and
 *                 the offers screen's "continue" opening.
 *   learner_left  A silent dropout. Nothing can be said to someone who is
 *                 gone, so a short, low-pressure, no-blame re-engagement
 *                 message is QUEUED for their return (Core derives it from
 *                 this session's `closing_script`) — never "nothing happened".
 *   safety_stop   Its own, non-cheerful design: the category's safety line,
 *                 calm posture, and a closing state with no praise, no
 *                 summary counts and no celebration. It NEVER reuses the
 *                 positive template (Block C non-negotiable).
 *
 * The positive template that used to serve every ending ("We did great work
 * today") is gone: no path can reach it for a safety stop or an interruption.
 *
 * The scripted lines themselves live in `scripted.ts` with every other
 * human-written line (closed catalogue, pre-generated audio).
 */

export const CLOSING_SCRIPTS = ['completed', 'interrupted', 'learner_left', 'safety_stop'] as const;
export type ClosingScript = (typeof CLOSING_SCRIPTS)[number];

/**
 * The close reason → closing script mapping. Appendix F's "Session-Closing
 * Script Accuracy" (target 100%) is measured against exactly this table, and
 * Core holds a hand-mirrored copy (`services/pedagogy/sessionEnd.ts`) kept
 * identical by `npm run session-end:check`.
 */
export const CLOSING_SCRIPT_FOR_REASON: Record<CloseReason, ClosingScript> = {
  completed: 'completed',
  soft_budget: 'completed',
  hard_budget: 'interrupted',
  error: 'interrupted',
  consent_revoked: 'interrupted',
  learner_left: 'learner_left',
  abandoned: 'learner_left',
  safety_stop: 'safety_stop',
};

export function closingScriptFor(reason: CloseReason): ClosingScript {
  return CLOSING_SCRIPT_FOR_REASON[reason];
}

/*
 * THE SPECIFIC ACT A COMPLETED CLOSE NAMES — a closed vocabulary, derived only
 * from what the server itself observed, most specific first:
 *
 *   corroborated     the controller declared mastery on corroborated evidence
 *                    (C.10: the same idea right twice in a row) — the peak.
 *   recovered        a correct answer on a skill right after a miss on it.
 *   hint_then_solved a correct answer after hint-ladder help (C.13).
 *   kept_going       worked through graded activities.
 *   talked_through   an open conversation with no graded work.
 *   none             the learner never said or answered anything — the line
 *                    thanks them for coming and claims no act at all.
 *
 * Specific-over-generic praise is also the C.18 measure; the line never says
 * "great job" about nothing.
 */
export const EFFORT_ACTS = ['corroborated', 'recovered', 'hint_then_solved', 'kept_going', 'talked_through', 'none'] as const;
export type EffortAct = (typeof EFFORT_ACTS)[number];

/*
 * THE OPENING LINE a session is greeted with. `greeting` is the character's
 * own scripted hello; the four `reengage_*` openings deliver the message a
 * silent dropout (`left`) or a budget interruption (`interrupted`) QUEUED
 * for the learner's return (C.16). Core decides it once per session from the
 * learner's previous closed session (`GET /tutor/internal/sessions/:id/opening`)
 * and records it on the session row, so a resume never re-delivers it.
 */
export const SESSION_OPENINGS = [
  'greeting',
  'reengage_left_resume',
  'reengage_left_fresh',
  'reengage_interrupted_resume',
  'reengage_interrupted_fresh',
] as const;
export type SessionOpening = (typeof SESSION_OPENINGS)[number];

export const CLOSING_PHASES = ['none', 'recap_asked', 'closed'] as const;
export type ClosingPhase = (typeof CLOSING_PHASES)[number];

export const SessionClosingSnapshotSchema = z
  .object({
    phase: z.enum(CLOSING_PHASES),
    graded: z.number().int().min(0),
    corroborated: z.boolean(),
    recovered: z.boolean(),
    hintThenSolved: z.boolean(),
    learnerTurns: z.number().int().min(0),
    /** Skills with a miss not yet followed by a correct answer. */
    missedSkills: z.array(z.string().min(1).max(160)).max(40),
    /**
     * OD-28 (owner review M-04): the recap question now open was asked
     * because the learner pressed "end" (`end_session`), not because the
     * Mentor wrapped up or the learner accepted a stop offer. It is what
     * lets a socket that goes away before the answer still close as
     * `completed` (the learner asked to leave) instead of being parked as
     * a silent dropout. Defaulted so a park record written before this
     * field existed still parses.
     */
    learnerEnded: z.boolean().default(false),
  })
  .strict();
export type SessionClosingSnapshot = z.infer<typeof SessionClosingSnapshotSchema>;

export const EMPTY_SESSION_CLOSING: SessionClosingSnapshot = {
  phase: 'none',
  graded: 0,
  corroborated: false,
  recovered: false,
  hintThenSolved: false,
  learnerTurns: 0,
  missedSkills: [],
  learnerEnded: false,
};

/** The server-owned closing state; rides the park snapshot. */
export class SessionCloser {
  private state: SessionClosingSnapshot = structuredClone(EMPTY_SESSION_CLOSING);

  snapshot(): SessionClosingSnapshot {
    return structuredClone(this.state);
  }

  restore(snapshot: SessionClosingSnapshot): void {
    this.state = structuredClone(snapshot);
  }

  get phase(): ClosingPhase {
    return this.state.phase;
  }

  set phase(phase: ClosingPhase) {
    this.state.phase = phase;
  }

  /**
   * OD-28 (M-04): the learner pressed "end" and the recap question is asked
   * on that press. The session stays open for one answer.
   */
  askRecapOnLearnerEnd(): void {
    this.state.phase = 'recap_asked';
    this.state.learnerEnded = true;
  }

  /** OD-28 (M-04): the learner pressed "end" and the recap question still waits for its answer. */
  get learnerEndRecapPending(): boolean {
    return this.state.phase === 'recap_asked' && this.state.learnerEnded;
  }

  /** One graded answer (activity or voice check), as the server verified it. */
  noteGraded(input: { skill: string; correct: boolean; hintAssisted: boolean }): void {
    this.state.graded += 1;
    const skill = input.skill.slice(0, 160);
    if (!input.correct) {
      if (!this.state.missedSkills.includes(skill) && this.state.missedSkills.length < 40) {
        this.state.missedSkills.push(skill);
      }
      return;
    }
    if (this.state.missedSkills.includes(skill)) {
      this.state.recovered = true;
      this.state.missedSkills = this.state.missedSkills.filter((s) => s !== skill);
    }
    if (input.hintAssisted) this.state.hintThenSolved = true;
  }

  /** The learner said something (typed or spoken) — evidence for `talked_through`. */
  noteLearnerTurn(): void {
    this.state.learnerTurns += 1;
  }

  /** The controller declared mastery on corroborated evidence (C.10). */
  noteCorroboratedMastery(): void {
    this.state.corroborated = true;
  }

  effortAct(): EffortAct {
    if (this.state.corroborated) return 'corroborated';
    if (this.state.recovered) return 'recovered';
    if (this.state.hintThenSolved) return 'hint_then_solved';
    if (this.state.graded > 0) return 'kept_going';
    return this.state.learnerTurns > 0 ? 'talked_through' : 'none';
  }
}

/**
 * What the client needs to draw the closing state (Frontend Bible 08 §3
 * "Closing" and §4 "Session end"): which script, the act the Mentor named,
 * and the lesson topic it will pick up from. Our own catalog text only —
 * never the learner's words.
 */
export interface ClosingSummary {
  script: ClosingScript;
  effort: EffortAct | null;
  topic: string | null;
}

/** Instruction for the Mentor's reflection of the learner's recap answer. */
export const RECAP_REFLECTION_INSTRUCTION = [
  'CLOSING — decided by the system: the session is ending and the learner has just answered your',
  'question about what clicked for them today. Reply in ONE short sentence that reflects back, in your',
  'own words, the idea they named — only if it really is something you worked on together. If what',
  'they named is not right, do not praise it: say the right idea in a few words. If they said nothing',
  'clicked or they do not know, say that is okay. Do NOT say goodbye, do NOT ask any question and do',
  'NOT request or promise an activity: the system adds the closing line after yours.',
].join(' ');

/** Instruction carried by the turn that makes the C.8/C.12 stop-or-continue offer. */
export const SESSION_END_OFFER_INSTRUCTION = [
  'SESSION-END OFFER — decided by the system from how this session is going, not by you. After',
  'reacting to this answer in ONE short sentence, ask the learner to choose: stop here for today, or do',
  'one more. Present both as equally fine. Say only that: do NOT describe how they feel, seem, look or',
  'sound (never say they are tired, bored, frustrated or anything like it), do NOT ask any other',
  'question, and do NOT request or promise an activity in this turn.',
].join(' ');
