import { PedagogicalController } from './controller.js';
import type { KcState, SessionPlanEntry } from '../core/client.js';
import {
  SPACED_REVIEW_THRESHOLDS,
  SpacedReviewRouter,
  type SpacedReviewReport,
  type SpacedReviewThresholds,
} from './spacedReview.js';
import {
  controllingLanguage,
  dialoguePolicy,
  type DialogueBand,
  type DialoguePolicy,
  type DialogueVariant,
} from './dialogueCalibration.js';
import { HintLadder, type HintLevel } from './hintLadder.js';
import { buildPlan, recordGrade, stuckMove, type StuckMoveKind } from './plan.js';

/*
 * C.11 / C.17 — THE SPACED-REVIEW ROUTER AND THE DIALOGUE CALIBRATION AGAINST
 * APPENDIX F'S SIMULATED LEARNERS (Part 3, Stage 2).
 *
 * The C.11 personas drive the REAL controller and the REAL router with the
 * same glue the orchestrator uses (`strategyInstruction` / `openDueReview`),
 * on a simulated clock and turn budget. Each is a deterministic script of
 * learner acts with the behaviour the two tiers must show:
 *
 *   near_miss_slipper       slips once on a KC they nearly have. MUST be kept
 *                           in-session, re-checked after the gap once the plan
 *                           moved on, and retired — the re-check never
 *                           celebrates or advances the plan.
 *   late_session_struggler  misses with three minutes before the wrap-up. MUST
 *                           be handed to the cross-session scheduler, with NO
 *                           re-check crammed into the last minutes.
 *   far_below_learner       does not know it yet. MUST NOT be treated as
 *                           review: handed off, no re-check.
 *   forgetting_reviewer     celebrated a KC, then fails its re-check. MUST lose
 *                           the mastery (the demotion rule) and end handed off.
 *   gaming_rapid_guesser    Baker's gaming: misses the same KC turn after turn.
 *                           Massed misses MUST NOT count as spaced ones, and the
 *                           re-exposure cap MUST hand it off.
 *
 * The C.17 personas run the dialogue policy the session would run:
 *
 *   reactant_teen           Appendix D §3.6's autonomy threat. Every controlling
 *                           draft (three locales) MUST be caught; a stuck skill
 *                           MUST get an offer, never a unilateral change; RESCUE
 *                           MUST ask first.
 *   polite_teen             the over-correction check: invitational drafts and
 *                           questions MUST NOT be flagged.
 *   young_hint_seeker       asks for help four times. MUST reach the tell in
 *                           three requests on the shorter ladder, never
 *                           repeating a rung, in "together" wording.
 *   adult_control           the control arm. MUST be the uniform pre-C.17
 *                           register (full ladder, no gate, unilateral change).
 */

// ── C.11 ────────────────────────────────────────────────────────────────────

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
const planEntry = (kcId: string, pKnown: number): SessionPlanEntry => ({
  kcId,
  kcKey: `gym.${kcId.slice(0, 4)}`,
  skillKey: `gym-${kcId.slice(0, 4)}`,
  reason: 'frontier',
  pKnown,
  targetDifficulty: 3,
  objective: `Gym objective ${kcId.slice(0, 4)}`,
  prereqKcIds: [],
  misconceptions: [],
});

export type ReviewAct =
  | { kind: 'answer'; correct: boolean | ((activeKcId: string | null) => boolean) }
  | { kind: 'talk' };

export interface ReviewPersona {
  name: string;
  why: string;
  plan: SessionPlanEntry[];
  kcStates: KcState[];
  /** Minutes already elapsed when the script starts. */
  startMinute: number;
  acts: ReviewAct[];
  check: (result: ReviewPersonaResult) => string[];
}

export interface ReviewPersonaResult {
  report: SpacedReviewReport;
  /** Every re-check the controller opened: the KC and the learner turn. */
  detours: { kcId: string; atTurn: number; minute: number }[];
  /** Plan progress changed or a celebration happened while a re-check was open. */
  detourAdvanced: boolean;
  revokedKcIds: readonly string[];
  strategies: string[];
}

const SOFT_MS = 15 * 60_000;
const MAX_TURNS = 120;
const ACT_MS = 45_000;

export function runReviewPersona(
  persona: ReviewPersona,
  t: SpacedReviewThresholds = SPACED_REVIEW_THRESHOLDS,
): ReviewPersonaResult & { problems: string[] } {
  const controller = new PedagogicalController(persona.plan, persona.kcStates);
  const router = new SpacedReviewRouter('act');
  let now = persona.startMinute * 60_000;
  let turns = 0;
  const detours: ReviewPersonaResult['detours'] = [];
  const strategies: string[] = [];
  let detourAdvanced = false;
  const headroom = () => ({
    turnsRemaining: Math.max(0, MAX_TURNS - turns),
    msUntilWrap: Math.max(0, SOFT_MS - now),
    budgetState: (now >= SOFT_MS ? 'wrapping' : 'running') as 'running' | 'wrapping',
  });

  for (const act of persona.acts) {
    now += ACT_MS;
    turns += 1;
    router.noteLearnerTurn();
    const reviewBefore = controller.inSessionReviewKcId;
    const progressBefore = JSON.stringify(controller.kcProgress);
    const correct =
      act.kind === 'answer' ? (typeof act.correct === 'function' ? act.correct(controller.activeKcId) : act.correct) : false;
    const event =
      act.kind === 'answer'
        ? { kind: 'activity_result' as const, correct, misconceptionCode: null, attemptNumber: 1, latencyMs: null }
        : { kind: 'conversation_turn' as const };
    const decision = controller.decide(event, now);
    strategies.push(decision.strategy);
    if (reviewBefore !== null) {
      if (JSON.stringify(controller.kcProgress) !== progressBefore) detourAdvanced = true;
      if (decision.strategy === 'CELEBRATE' || decision.strategy === 'TRANSFER') detourAdvanced = true;
    }
    if (act.kind === 'answer' && decision.kcId !== null && decision.pKnownBefore !== null) {
      router.observe(
        {
          kcId: decision.kcId,
          planned: controller.isPlannedKc(decision.kcId),
          correct,
          pBefore: decision.pKnownBefore,
          pAfter: decision.pKnown ?? decision.pKnownBefore,
          ...headroom(),
          fromDetour: reviewBefore !== null && reviewBefore === decision.kcId,
        },
        t,
      );
    }
    if (decision.review?.outcome === 'abandoned') router.noteDetourAbandoned(decision.review.kcId);
    const openable =
      decision.review === null &&
      decision.strategy !== 'CELEBRATE' &&
      decision.strategy !== 'TRANSFER' &&
      (act.kind === 'talk' || correct);
    if (openable && controller.active) {
      const due = router.dueKcId(controller.inSessionReviewKcId ?? controller.activeKcId, headroom().budgetState, t);
      if (due !== null && controller.openInSessionReview(due, now)) {
        router.noteDetourOpened(due);
        detours.push({ kcId: due, atTurn: turns, minute: Math.round(now / 6_000) / 10 });
      }
    }
  }
  const result: ReviewPersonaResult = {
    report: router.report(),
    detours,
    detourAdvanced,
    revokedKcIds: controller.revokedMasteryKcIds,
    strategies,
  };
  return { ...result, problems: persona.check(result) };
}

const wrongOnReview = (kc: string) => (active: string | null) => active !== kc;

export const REVIEW_PERSONAS: ReviewPersona[] = [
  {
    name: 'near_miss_slipper',
    why: 'slips once on a KC they nearly have (Appendix D §2.4 "close to threshold")',
    plan: [planEntry(A, 0.9), planEntry(B, 0.4)],
    kcStates: [{ kcId: A, kcKey: 'gym.aaaa', pKnown: 0.9, attempts: 3 }],
    startMinute: 0,
    acts: [
      { kind: 'answer', correct: false },
      { kind: 'answer', correct: true },
      { kind: 'answer', correct: true },
      { kind: 'talk' },
      { kind: 'answer', correct: true },
      // Progress on the next KC between the re-checks: three turns with none
      // would (correctly) trigger RESCUE, and a rescue is never interrupted.
      { kind: 'answer', correct: true },
      { kind: 'talk' },
      { kind: 'talk' },
      { kind: 'answer', correct: true },
    ],
    check: (r) => {
      const problems: string[] = [];
      const first = r.report.decisions[0];
      if (first?.tier !== 'within_session') problems.push(`the slip was routed ${first?.tier ?? 'nowhere'}, expected within_session`);
      if (first?.outcome !== 'retired') problems.push(`the slip ended ${first?.outcome ?? 'unrecorded'}, expected retired`);
      if (r.detours.length !== 2) problems.push(`${r.detours.length} re-checks opened, expected 2`);
      if (r.detourAdvanced) problems.push('a re-check celebrated or moved the plan pointer');
      return problems;
    },
  },
  {
    name: 'late_session_struggler',
    why: 'misses three minutes before the wrap-up (no fake spaced sequence in the last minutes)',
    plan: [planEntry(A, 0.9), planEntry(B, 0.4)],
    kcStates: [{ kcId: A, kcKey: 'gym.aaaa', pKnown: 0.9, attempts: 3 }],
    startMinute: 11.25,
    acts: [{ kind: 'answer', correct: false }, { kind: 'talk' }, { kind: 'talk' }, { kind: 'talk' }, { kind: 'talk' }],
    check: (r) => {
      const problems: string[] = [];
      const first = r.report.decisions[0];
      if (first?.tier !== 'cross_session') problems.push(`a miss before the wrap-up was routed ${first?.tier ?? 'nowhere'}, expected cross_session`);
      if (r.detours.length > 0) problems.push(`${r.detours.length} re-check(s) crammed into the last minutes`);
      return problems;
    },
  },
  {
    name: 'far_below_learner',
    why: 'does not know the KC yet: teaching, not review',
    plan: [planEntry(B, 0.2)],
    kcStates: [],
    startMinute: 0,
    acts: [{ kind: 'answer', correct: false }, { kind: 'talk' }, { kind: 'answer', correct: false }, { kind: 'talk' }, { kind: 'talk' }],
    check: (r) => {
      const problems: string[] = [];
      if (r.report.decisions.some((d) => d.tier === 'within_session')) problems.push('a far-below-threshold miss was queued as review');
      if (r.report.decisions[0]?.reason !== 'far_from_threshold') problems.push(`reason ${r.report.decisions[0]?.reason ?? 'none'}, expected far_from_threshold`);
      if (r.detours.length > 0) problems.push('a re-check opened for something never learned');
      return problems;
    },
  },
  {
    name: 'forgetting_reviewer',
    why: 'celebrated a KC, then cannot do it on the re-check (Khan-style demotion, Appendix D §2.3)',
    plan: [planEntry(A, 0.9), planEntry(B, 0.4)],
    kcStates: [{ kcId: A, kcKey: 'gym.aaaa', pKnown: 0.9, attempts: 3 }],
    startMinute: 0,
    acts: [
      { kind: 'answer', correct: false },
      { kind: 'answer', correct: true },
      { kind: 'answer', correct: true },
      ...Array.from({ length: 4 }, (): ReviewAct[] => [
        { kind: 'talk' },
        { kind: 'answer', correct: wrongOnReview(A) },
        { kind: 'talk' },
        { kind: 'talk' },
      ]).flat(),
    ],
    check: (r) => {
      const problems: string[] = [];
      if (!r.revokedKcIds.includes(A)) problems.push('a failed re-check of a celebrated KC did not revoke its mastery');
      const last = r.report.decisions.at(-1);
      if (last?.outcome !== 'handed_off') problems.push(`the failing KC ended ${last?.outcome ?? 'unrecorded'}, expected handed_off`);
      if (r.detourAdvanced) problems.push('a re-check celebrated or moved the plan pointer');
      if (r.detours.length > SPACED_REVIEW_THRESHOLDS.maxReexposuresPerKc) problems.push(`${r.detours.length} re-checks for one KC, above the cap`);
      return problems;
    },
  },
  {
    name: 'gaming_rapid_guesser',
    why: "Baker's gaming: misses the same KC turn after turn",
    plan: [planEntry(A, 0.8)],
    kcStates: [{ kcId: A, kcKey: 'gym.aaaa', pKnown: 0.8, attempts: 3 }],
    startMinute: 0,
    acts: Array.from({ length: 16 }, (): ReviewAct => ({ kind: 'answer', correct: false })),
    check: (r) => {
      const problems: string[] = [];
      const decisions = r.report.decisions;
      if (decisions.length > SPACED_REVIEW_THRESHOLDS.maxReexposuresPerKc + 1) {
        problems.push(`${decisions.length} routing decisions for one KC: massed misses were counted as spaced`);
      }
      // A massed miss (inside the gap) is never a spaced re-exposure.
      decisions.forEach((d, i) => {
        const gap = i === 0 ? null : d.atTurn - decisions[i - 1]!.atTurn;
        if (gap !== null && gap < SPACED_REVIEW_THRESHOLDS.reexposureGapTurns) {
          problems.push(`decision ${i + 1} came ${gap} turn(s) after the previous one: a massed miss counted as spaced`);
        }
      });
      // As the belief falls the rule itself hands it off (far from the threshold, or the cap).
      if (decisions.at(-1)?.tier !== 'cross_session') problems.push('the repeatedly missed KC was never handed to the cross-session scheduler');
      return problems;
    },
  },
];

// ── C.17 ────────────────────────────────────────────────────────────────────

export interface CalibrationPersona {
  name: string;
  why: string;
  band: DialogueBand;
  variant: DialogueVariant;
  /** Mentor drafts the gate is run on (the check says which must be caught). */
  drafts: string[];
  hintRequests: number;
  /** Graded misses on one skill with the controller dormant (the legacy stuck path). */
  stuckMisses: number;
  check: (result: CalibrationPersonaResult) => string[];
}

export interface CalibrationPersonaResult {
  policy: DialoguePolicy;
  caught: (string | null)[];
  rungs: HintLevel[];
  stuckMoves: StuckMoveKind[];
  rescueOverlay: string | null;
}

export function runCalibrationPersona(
  persona: CalibrationPersona,
  policyFor: (band: DialogueBand, variant: DialogueVariant) => DialoguePolicy = dialoguePolicy,
): CalibrationPersonaResult & { problems: string[] } {
  const policy = policyFor(persona.band, persona.variant);
  const caught = persona.drafts.map((d) => (policy.controllingGate ? controllingLanguage(d) : null));
  const ladder = new HintLadder(policy.ladder);
  const rungs = Array.from({ length: persona.hintRequests }, () => ladder.registerHintRequest('step'));
  const plan = buildPlan('course_topic', null, 'gym-skill');
  const stuckMoves: StuckMoveKind[] = [];
  for (let i = 0; i < persona.stuckMisses; i += 1) {
    recordGrade(plan, 'gym-skill', false);
    stuckMoves.push(stuckMove(plan, 'gym-skill', { askFirst: policy.askBeforePacing }).kind);
  }
  const result: CalibrationPersonaResult = { policy, caught, rungs, stuckMoves, rescueOverlay: policy.strategyOverlay('RESCUE') };
  return { ...result, problems: persona.check(result) };
}

export const CALIBRATION_PERSONAS: CalibrationPersona[] = [
  {
    name: 'reactant_teen',
    why: 'Appendix D §3.6 autonomy threat: reactance to directive phrasing',
    band: 'teen',
    variant: 'calibrated',
    drafts: ['You have to save half before you spend.', 'Tienes que ahorrar la mitad primero.', 'Você precisa guardar metade antes.', 'You should check the price.'],
    hintRequests: 2,
    stuckMisses: 3,
    check: (r) => {
      const problems: string[] = [];
      r.caught.forEach((c, i) => {
        if (c === null) problems.push(`controlling draft ${i + 1} was not caught`);
      });
      if (r.stuckMoves.includes('style_change')) problems.push('a stuck skill changed approach unilaterally instead of offering');
      if (!r.stuckMoves.includes('offer')) problems.push('a stuck skill never got an accept/decline offer');
      if (r.rescueOverlay === null || !/ASK/.test(r.rescueOverlay)) problems.push('RESCUE does not ask before making it easier');
      if (!/as an option/.test(r.policy.levelWording.indirect)) problems.push('the hint wording is not autonomy-supportive');
      return problems;
    },
  },
  {
    name: 'polite_teen',
    why: 'the over-correction check: the gate must not punish invitations and questions',
    band: 'teen',
    variant: 'calibrated',
    drafts: ['You could try splitting it into four parts.', '¿Tienes que pagarlo hoy?', 'Hay que sumar primero.', 'Você quer tentar de novo?', 'Do you need to see it again?'],
    hintRequests: 0,
    stuckMisses: 0,
    check: (r) => r.caught.flatMap((c, i) => (c === null ? [] : [`draft ${i + 1} flagged as controlling ("${c}")`])),
  },
  {
    name: 'young_hint_seeker',
    why: 'Wood/Bruner/Ross: younger children need direct, contingent scaffolding',
    band: 'young_child',
    variant: 'calibrated',
    drafts: [],
    hintRequests: 4,
    stuckMisses: 2,
    check: (r) => {
      const problems: string[] = [];
      const expected: HintLevel[] = ['misconception', 'fill_blank', 'tell', 'tell'];
      if (JSON.stringify(r.rungs) !== JSON.stringify(expected)) problems.push(`rungs ${r.rungs.join(' → ')}, expected ${expected.join(' → ')}`);
      if (r.rungs.slice(0, 3).some((rung, i, all) => all.indexOf(rung) !== i)) problems.push('a rung repeated before the tell');
      if (!/together/.test(r.policy.levelWording.fill_blank)) problems.push('the fill-in-the-blank rung is not framed as doing it together');
      return problems;
    },
  },
  {
    name: 'adult_control',
    why: 'the A/B control arm must be the uniform pre-C.17 register',
    band: 'adult',
    variant: 'control',
    drafts: ['You have to save half before you spend.'],
    hintRequests: 4,
    stuckMisses: 2,
    check: (r) => {
      const problems: string[] = [];
      if (r.caught.some((c) => c !== null)) problems.push('the control arm ran the controlling-language gate');
      if (r.rungs.join(',') !== 'indirect,misconception,fill_blank,tell') problems.push(`control rungs ${r.rungs.join(',')}, expected the full ladder`);
      if (r.stuckMoves[1] !== 'style_change') problems.push('the control arm did not keep the unilateral change of approach');
      if (r.policy.registerNote !== null) problems.push('the control arm carries a register note');
      return problems;
    },
  },
];

export function runReviewCalibrationGym(): {
  ok: boolean;
  review: { persona: string; why: string; problems: string[]; decisions: number; detours: number }[];
  calibration: { persona: string; why: string; problems: string[] }[];
} {
  const review = REVIEW_PERSONAS.map((p) => {
    const r = runReviewPersona(p);
    return { persona: p.name, why: p.why, problems: r.problems, decisions: r.report.decisions.length, detours: r.detours.length };
  });
  const calibration = CALIBRATION_PERSONAS.map((p) => ({ persona: p.name, why: p.why, problems: runCalibrationPersona(p).problems }));
  return { ok: [...review, ...calibration].every((r) => r.problems.length === 0), review, calibration };
}
