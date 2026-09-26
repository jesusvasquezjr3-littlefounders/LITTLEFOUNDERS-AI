import {
  ALLIANCE_DEFAULTS,
  AllianceController,
  claimsSharedHistory,
  type AllianceConfig,
  type AllianceReport,
  type ContinuityKind,
} from './allianceController.js';
import { classifyGoalReply, type ConceptFamily } from './explanationLexicon.js';
import {
  SELF_EXPLANATION_DEFAULTS,
  SelfExplanation,
  type SelfExplanationConfig,
  type SelfExplanationReport,
} from './selfExplanation.js';

/*
 * C.15 / C.14 — THE ALLIANCE CONTROLLER AND THE SELF-EXPLANATION MOVE AGAINST
 * APPENDIX F'S SIMULATED LEARNERS (Part 3, Stage 2).
 *
 * The C.15 Definition of Done (b) asks that "the goal-agreement opening move
 * and the renegotiation trigger on repeated declines are both exercised and
 * pass in the simulated-student suite", and (c) that persona-continuity
 * re-establishment is verified "with a test scenario that deliberately
 * switches personas mid-relationship". Each persona is a deterministic script
 * of learner acts built from Appendix D's own profiles, with the behaviour the
 * two objects must show:
 *
 *   repeated_decliner   §3.4's unnamed bond/task failure: turns down every way
 *                       of working offered. MUST get the renegotiation before
 *                       a third offer; answers it and the session improves.
 *   reactant_teen       §3.6 autonomy threat: "something else" to the goal,
 *                       declines, brushes off the renegotiation and declines
 *                       again. MUST get its own goal adopted and the
 *                       renegotiation; the window must record NO improvement.
 *   persona_switcher    DoD (c): worked with one persona, now another. MUST be
 *                       introduced honestly, and a "last time we…" draft MUST
 *                       be caught.
 *   filler_explainer    §3.3's gamed prompt ("because it's right", "idk") and
 *                       Baker's gaming. MUST get ONE targeted follow-up, then
 *                       the reason stated by the Mentor, never a loop, and no
 *                       second prompt inside the spacing window.
 *   concept_explainer   names the idea. MUST pass on the first attempt.
 *   frustrated          Pekrun high value / low control: a wrong decision and a
 *                       stated wrong idea. MUST be asked "how" (not "why"),
 *                       and the wrong idea routed to the C.18 correction.
 *   masking             §1.6: polite, vague, never says yes or no. The goal
 *                       MUST end unconfirmed and the move MUST NOT loop.
 *   steady              agrees, accepts, explains. MUST get no renegotiation.
 */

export type GymAct =
  | { kind: 'goal_proposed' }
  | { kind: 'goal_reply'; text: string }
  | { kind: 'own_goal' }
  | { kind: 'offer_declined' }
  | { kind: 'offer_accepted' }
  | { kind: 'mentor_turn' }
  | { kind: 'renegotiation_answer'; answered: boolean }
  | { kind: 'disengagement' }
  | { kind: 'turn' }
  | { kind: 'decision'; families: readonly ConceptFamily[]; verifiedWrong: boolean }
  | { kind: 'explain'; text: string; misconception?: boolean; help?: boolean };

export interface AlliancePersona {
  name: string;
  why: string;
  continuity: ContinuityKind;
  acts: GymAct[];
  /** A Mentor draft for this persona's first turn, checked for false familiarity. */
  firstDraft?: string;
  check: (result: AlliancePersonaResult) => string[];
}

export interface AlliancePersonaResult {
  alliance: AllianceReport;
  selfExplanation: SelfExplanationReport;
  opening: 'introduce' | 'reconnect' | null;
  /** How many times a due renegotiation was actually delivered, and on which offer it arrived. */
  renegotiationsDelivered: number;
  offersBeforeRenegotiation: number | null;
  falseFamiliarityCaught: boolean | null;
  /** Whether the goal move asked again after being settled or unconfirmed (it must not). */
  goalLooped: boolean;
}

const SAVING: readonly ConceptFamily[] = ['saving', 'spending', 'sharing', 'time', 'budget'];

export const ALLIANCE_PERSONAS: AlliancePersona[] = [
  {
    name: 'repeated_decliner',
    why: 'Appendix D §3.4: a pattern of declines with no adjustment is a bond/task failure with no name',
    continuity: 'continuing',
    acts: [
      { kind: 'turn' }, { kind: 'goal_proposed' }, { kind: 'goal_reply', text: 'yes' },
      { kind: 'turn' }, { kind: 'offer_declined' }, { kind: 'turn' }, { kind: 'offer_declined' },
      { kind: 'turn' }, { kind: 'mentor_turn' },
      { kind: 'turn' }, { kind: 'renegotiation_answer', answered: true },
      { kind: 'turn' }, { kind: 'turn' }, { kind: 'turn' }, { kind: 'turn' },
    ],
    check: (r) => [
      ...(r.renegotiationsDelivered === 1 ? [] : [`expected one renegotiation, got ${r.renegotiationsDelivered}`]),
      ...(r.offersBeforeRenegotiation === 2 ? [] : [`renegotiation must come right after the 2nd decline (came after ${r.offersBeforeRenegotiation})`]),
      ...(r.alliance.renegotiations[0]?.improved === true ? [] : ['a clean window after the renegotiation must read as improved']),
    ],
  },
  {
    name: 'reactant_teen',
    why: 'Appendix D §3.6: autonomy threat — the teen names their own goal and resists offered methods',
    continuity: 'continuing',
    acts: [
      { kind: 'turn' }, { kind: 'goal_proposed' }, { kind: 'goal_reply', text: "nah, I'd rather do something else" },
      { kind: 'turn' }, { kind: 'own_goal' },
      { kind: 'turn' }, { kind: 'offer_declined' }, { kind: 'turn' }, { kind: 'offer_declined' },
      { kind: 'turn' }, { kind: 'mentor_turn' },
      { kind: 'turn' }, { kind: 'renegotiation_answer', answered: true },
      { kind: 'turn' }, { kind: 'offer_declined' }, { kind: 'turn' },
    ],
    check: (r) => [
      ...(r.alliance.goalAgreement === 'renegotiated' ? [] : [`the teen's own goal must be adopted (got ${r.alliance.goalAgreement})`]),
      ...(r.renegotiationsDelivered === 1 ? [] : [`expected one renegotiation, got ${r.renegotiationsDelivered}`]),
      ...(r.alliance.renegotiations[0]?.improved === false ? [] : ['a decline inside the window must read as NOT improved']),
    ],
  },
  {
    name: 'persona_switcher',
    why: 'C.15 DoD (c): a different persona must re-establish, never act falsely familiar',
    continuity: 'persona_switch',
    acts: [{ kind: 'turn' }, { kind: 'goal_proposed' }, { kind: 'goal_reply', text: 'yes' }],
    firstDraft: 'Last time we worked on your bike fund. Shall we go on?',
    check: (r) => [
      ...(r.opening === 'introduce' ? [] : [`a persona switch must open with the introduction (got ${r.opening})`]),
      ...(r.alliance.continuityMove === 'delivered' ? [] : [`the re-establishment must be recorded delivered (got ${r.alliance.continuityMove})`]),
      ...(r.falseFamiliarityCaught === true ? [] : ['a "last time we" draft must be caught']),
    ],
  },
  {
    name: 'filler_explainer',
    why: 'Appendix D §3.3: a required prompt is gamed with filler unless checked',
    continuity: 'continuing',
    acts: [
      { kind: 'turn' }, { kind: 'goal_proposed' }, { kind: 'goal_reply', text: 'ok' },
      { kind: 'turn' }, { kind: 'decision', families: SAVING, verifiedWrong: false },
      { kind: 'turn' }, { kind: 'explain', text: "because it's right" },
      { kind: 'turn' }, { kind: 'explain', text: 'idk' },
      { kind: 'turn' }, { kind: 'decision', families: SAVING, verifiedWrong: false },
    ],
    check: (r) => {
      const [first, second] = r.selfExplanation.events;
      return [
        ...(first?.outcome === 'explained_by_mentor' && first.firstQuality === 'filler' && first.followupQuality === 'filler'
          ? []
          : [`filler must get one follow-up, then the Mentor's reason (got ${JSON.stringify(first)})`]),
        ...(second === undefined ? [] : ['a second prompt inside the spacing window is an interrogation']),
      ];
    },
  },
  {
    name: 'concept_explainer',
    why: 'Appendix D §3.3: a reason that names the idea passes and is acknowledged',
    continuity: 'continuing',
    acts: [
      { kind: 'turn' }, { kind: 'goal_proposed' }, { kind: 'goal_reply', text: 'yes' },
      { kind: 'turn' }, { kind: 'decision', families: SAVING, verifiedWrong: false },
      { kind: 'turn' }, { kind: 'explain', text: 'porque quiero ahorrar para después' },
    ],
    check: (r) => (r.selfExplanation.events[0]?.outcome === 'passed_first' ? [] : ['a named reason must pass first time']),
  },
  {
    name: 'frustrated',
    why: 'Pekrun high value / low control: a wrong decision is asked "how", a wrong idea is corrected',
    continuity: 'continuing',
    acts: [
      { kind: 'turn' }, { kind: 'goal_proposed' }, { kind: 'goal_reply', text: 'sí' },
      { kind: 'turn' }, { kind: 'decision', families: ['budget', 'price_value'], verifiedWrong: true },
      { kind: 'turn' }, { kind: 'explain', text: 'me alcanza para la pelota y también el cuaderno y también los colores', misconception: true },
    ],
    check: (r) => {
      const e = r.selfExplanation.events[0];
      return [
        ...(e?.variant === 'how' ? [] : [`a verified-wrong decision must be asked "how" (got ${e?.variant})`]),
        ...(e?.outcome === 'misconception_corrected' ? [] : [`a stated wrong idea must go to C.18 (got ${e?.outcome})`]),
      ];
    },
  },
  {
    name: 'masking',
    why: 'Appendix D §1.6: polite, vague and never a yes or a no — the move must not loop',
    continuity: 'continuing',
    acts: [
      { kind: 'turn' }, { kind: 'goal_proposed' }, { kind: 'goal_reply', text: 'the bike costs sixty' },
      { kind: 'turn' }, { kind: 'goal_proposed' }, { kind: 'turn' },
    ],
    check: (r) => [
      ...(r.alliance.goalAgreement === 'unconfirmed' ? [] : [`a vague reply must end unconfirmed (got ${r.alliance.goalAgreement})`]),
      ...(r.goalLooped ? ['the goal move asked again'] : []),
    ],
  },
  {
    name: 'steady',
    why: 'In flow: agrees, accepts the offer, explains. Nothing to renegotiate.',
    continuity: 'continuing',
    acts: [
      { kind: 'turn' }, { kind: 'goal_proposed' }, { kind: 'goal_reply', text: "yes, that's it" },
      { kind: 'turn' }, { kind: 'offer_accepted' }, { kind: 'turn' }, { kind: 'offer_declined' }, { kind: 'turn' }, { kind: 'offer_accepted' },
      { kind: 'turn' }, { kind: 'decision', families: ['needs_wants'], verifiedWrong: false },
      { kind: 'turn' }, { kind: 'explain', text: 'because food is a need and the toy is a want' },
    ],
    check: (r) => [
      ...(r.alliance.renegotiations.length === 0 ? [] : ['a learner who accepts must not be renegotiated with']),
      ...(r.alliance.goalAgreement === 'agreed' ? [] : ['the goal must be agreed']),
      ...(r.selfExplanation.events[0]?.outcome === 'passed_first' ? [] : ['the reason must pass']),
    ],
  },
];

export function runAlliancePersona(
  persona: AlliancePersona,
  allianceConfig: AllianceConfig = ALLIANCE_DEFAULTS,
  selfExplanationConfig: SelfExplanationConfig = SELF_EXPLANATION_DEFAULTS,
): AlliancePersonaResult & { problems: string[] } {
  const alliance = new AllianceController('act', persona.continuity, allianceConfig);
  const selfExplanation = new SelfExplanation('act', selfExplanationConfig);
  alliance.noteOpening();
  let offers = 0;
  let offersBeforeRenegotiation: number | null = null;
  let renegotiationsDelivered = 0;
  let goalLooped = false;
  let goalSettled = false;
  for (const act of persona.acts) {
    switch (act.kind) {
      case 'turn':
        alliance.noteLearnerTurn();
        selfExplanation.noteLearnerTurn();
        break;
      case 'goal_proposed':
        if (goalSettled && alliance.goalPromptDue) goalLooped = true;
        if (alliance.goalPromptDue) alliance.markGoalProposed();
        break;
      case 'goal_reply':
        alliance.answerGoal(classifyGoalReply(act.text));
        goalSettled = true;
        break;
      case 'own_goal':
        alliance.adoptLearnerGoal();
        break;
      case 'offer_declined':
        offers += 1;
        alliance.noteOfferDelivered();
        alliance.noteDeclined();
        if (alliance.renegotiationDue && offersBeforeRenegotiation === null) offersBeforeRenegotiation = offers;
        break;
      case 'offer_accepted':
        offers += 1;
        alliance.noteOfferDelivered();
        alliance.noteAccepted();
        break;
      case 'mentor_turn':
        if (alliance.renegotiationDue) {
          alliance.markRenegotiationDelivered();
          renegotiationsDelivered += 1;
        }
        break;
      case 'renegotiation_answer':
        alliance.answerRenegotiation(act.answered);
        break;
      case 'disengagement':
        alliance.noteDisengagement();
        break;
      case 'decision':
        if (selfExplanation.consider({ source: 'activity', families: act.families, verifiedWrong: act.verifiedWrong, scaffolded: false })) {
          selfExplanation.markPromptDelivered();
        }
        break;
      case 'explain': {
        const reading = selfExplanation.readReply(act.text, { misconception: act.misconception === true, help: act.help === true });
        if (reading?.kind === 'followup') selfExplanation.markFollowupDelivered();
        break;
      }
    }
  }
  const result: AlliancePersonaResult = {
    alliance: alliance.report(),
    selfExplanation: selfExplanation.report(),
    opening: alliance.continuityOpening,
    renegotiationsDelivered,
    offersBeforeRenegotiation,
    falseFamiliarityCaught:
      persona.firstDraft === undefined ? null : alliance.requiresFreshStart && claimsSharedHistory(persona.firstDraft),
    goalLooped,
  };
  return { ...result, problems: persona.check(result) };
}

export function runAllianceGym(personas: readonly AlliancePersona[] = ALLIANCE_PERSONAS): {
  ok: boolean;
  reports: { persona: string; why: string; problems: string[] }[];
} {
  const reports = personas.map((persona) => ({
    persona: persona.name,
    why: persona.why,
    problems: runAlliancePersona(persona).problems,
  }));
  return { ok: reports.every((r) => r.problems.length === 0), reports };
}
