import { createHash } from 'node:crypto';
import { insertAuditLog, serviceRest, serviceRestRaw } from '../supabaseRest.js';
import { TRANSCRIPT_RUBRIC } from './transcriptRubric.js';

/*
 * Product C.23 — THE CALIBRATION PROCESS FOR EVERY AUTOMATED EVALUATION JUDGE
 * (Appendix E §2.1, §3.2; Appendix F §1.3 Judge–Human Agreement Rate).
 *
 * No AI judge is trusted for any decision until it reproduces a human panel's
 * judgement on a human-rated seed set, and that calibration is re-run on a
 * defined cadence. The three steps, in order, are the Khan Academy pattern
 * Appendix E §2.1 describes:
 *
 *   1. the HUMANS agree with each other (inter-rater agreement, raw AND
 *      chance-corrected, so a seed set where nearly everything passes cannot
 *      manufacture agreement);
 *   2. the JUDGE agrees with the panel's majority, in EVERY stratum, not on
 *      average (Appendix E §1.2: judge reliability collapses on the hard,
 *      borderline cases, so the weakest stratum decides), with enough items
 *      of both labels that an approve-everything judge cannot pass, and with
 *      two of the documented judge biases checked (verbosity: agreement must
 *      not depend on item length; self-enhancement: the judge must not be
 *      the same model family as the author it judges);
 *   3. the calibration goes STALE after the cadence, and a failed spot check
 *      un-trusts the judge until a new calibration passes (the automatic
 *      recalibration trigger of Appendix F §1.3).
 *
 * This module is the single standard for every judge in `JUDGE_REGISTRY`.
 * Core recomputes every number from the raw labels and verdicts (never from
 * a number a harness computed), and the database recomputes the verdict
 * again from those numbers and the thresholds inside
 * `record_mentor_judge_calibration` (migration
 * `*_mentor_judge_calibration_registry.sql`), refusing any row whose claimed
 * verdict, scope or stratum result does not follow from its own numbers.
 *
 * GOVERNANCE. This standard is Tier 1 (Appendix E §3.1: a judge that gates
 * a release is part of the evaluation machinery). The thresholds may be
 * raised by a human decision at any time and never lowered without full
 * human review; `npm run judge-calibration:check` refuses a lowered value in
 * this file or in the migration, and `npm run governance:check` refuses any
 * change to this file without a Tier 1 change-record row.
 *
 * ZERO SPEND (OD-23). Nothing here calls a model. The paid step, running the
 * real judge over the seed set, is owner-run in Oracle behind an explicit
 * approval variable; see docs/rebuild/mentor/JUDGE-CALIBRATION-POLICY.md.
 */

// ── vocabularies ────────────────────────────────────────────────────────────

export const JUDGE_IDS = ['live_content_judge', 'transcript_judge'] as const;
export type JudgeId = (typeof JUDGE_IDS)[number];

export const CALIBRATION_KINDS = ['calibration', 'spot_check'] as const;
export type CalibrationKind = (typeof CALIBRATION_KINDS)[number];

export const JUDGE_LABELS = ['pass', 'fail', 'not_applicable'] as const;
export type JudgeLabel = (typeof JUDGE_LABELS)[number];

export const CALIBRATION_STRATA = ['standard', 'sensitive', 'routine', 'hard'] as const;
export type CalibrationStratum = (typeof CALIBRATION_STRATA)[number];

/** Every question any registered judge is calibrated on (the migration's CHECK). */
export const CALIBRATION_QUESTIONS = [
  'approve',
  'answer_reveal',
  'false_affirmation',
  'emotion_label',
  'hint_repeat',
  'tell_honored',
  'controlling_language',
] as const;
export type CalibrationQuestion = (typeof CALIBRATION_QUESTIONS)[number];

export const FAILURE_REASONS = [
  'inter_rater_below_threshold',
  'inter_rater_kappa_below_threshold',
  'verbosity_bias',
  'self_enhancement_risk',
  'no_question_calibrated',
  'required_question_uncalibrated',
  'spot_check_scope_lost',
] as const;
export type FailureReason = (typeof FAILURE_REASONS)[number];

export const TRUST_STATES = ['passed', 'stale', 'recalibration_required', 'failed', 'uncalibrated'] as const;
export type TrustState = (typeof TRUST_STATES)[number];

// ── the pre-registered standard ─────────────────────────────────────────────

/**
 * EVERY VALUE IS "PROPOSED, PENDING CALIBRATION" (Appendix F §1.4) and is
 * listed in docs/rebuild/mentor/THRESHOLD-RECALIBRATION-LOG.md. The floors
 * below are the minimums the migration's CHECKs also enforce.
 */
export const CALIBRATION_FLOORS = {
  /** Appendix E §2.1: the panel agrees with itself about 85% of the time. */
  interRaterAgreement: 0.85,
  /** Fleiss' kappa across the panel ("substantial" agreement starts at 0.61). */
  interRaterKappa: 0.6,
  /** Judge vs panel majority, in EVERY stratum. */
  judgeAgreement: 0.9,
  /** Cohen's kappa, judge vs panel majority, per question. */
  judgeKappa: 0.7,
  /** Verbosity bias: agreement in the shortest vs the longest third of items. */
  lengthBiasMaxGap: 0.15,
  /** Terciles smaller than this are not compared (the gap would be noise). */
  lengthBiasMinTercile: 10,
  minRaters: 2,
} as const;

export interface JudgeStandard {
  interRaterAgreement: number;
  interRaterKappa: number;
  judgeAgreement: number;
  judgeKappa: number;
  lengthBiasMaxGap: number;
  lengthBiasMinTercile: number;
  minRaters: number;
  /** Items per (question, stratum) in a full calibration. */
  minItemsPerStratum: number;
  /** Items per question across its strata. */
  minItemsPerQuestion: number;
  /** Panel labels of EACH of pass and fail per (question, stratum). */
  minPerLabel: number;
  /** A spot check re-verifies with smaller strata. */
  spotCheck: { minItemsPerStratum: number; minItemsPerQuestion: number; minPerLabel: number };
  /** Appendix F §1.3: monthly in the first year (with grace). */
  maxAgeDays: number;
  /** The status says "due soon" this many days before the calibration goes stale. */
  dueSoonDays: number;
}

export interface JudgeDefinition {
  id: JudgeId;
  requirement: 'C.5' | 'C.21';
  /** What the judge decides, in one line. */
  purpose: string;
  /** What a PASSED, fresh calibration lets it do; nothing else is permitted. */
  gates: string;
  questions: readonly CalibrationQuestion[];
  /** Questions a passed calibration must include (the judge is useless without them). */
  requiredQuestions: readonly CalibrationQuestion[];
  strata: readonly CalibrationStratum[];
  /** Appendix F §1.3 cadence. Moving to quarterly is a recorded Tier 1 decision. */
  cadence: 'monthly';
  standard: JudgeStandard;
  /** The owner-run harness that produces a run file (paid only with the env approval). */
  harness: string;
  liveApprovalEnv: string;
}

const BASE = {
  interRaterAgreement: CALIBRATION_FLOORS.interRaterAgreement,
  interRaterKappa: CALIBRATION_FLOORS.interRaterKappa,
  judgeAgreement: CALIBRATION_FLOORS.judgeAgreement,
  judgeKappa: CALIBRATION_FLOORS.judgeKappa,
  lengthBiasMaxGap: CALIBRATION_FLOORS.lengthBiasMaxGap,
  lengthBiasMinTercile: CALIBRATION_FLOORS.lengthBiasMinTercile,
  minRaters: CALIBRATION_FLOORS.minRaters,
  maxAgeDays: 35,
  dueSoonDays: 7,
} as const;

/** The judge-scorable rubric criteria that have a pass/fail answer (a diagnostic cannot be agreed on). */
export const TRANSCRIPT_JUDGE_QUESTIONS = TRANSCRIPT_RUBRIC.filter((c) => c.scoredBy.includes('judge') && c.kind !== 'diagnostic').map(
  (c) => c.id,
) as CalibrationQuestion[];

export const JUDGE_REGISTRY: Record<JudgeId, JudgeDefinition> = {
  live_content_judge: {
    id: 'live_content_judge',
    requirement: 'C.5',
    purpose: 'Approves one live-generated practice item for one learner, before the learner sees it.',
    gates: 'Live per-item content approval (Appendix E §3.1.1), per risk category, under the staff sampling floors.',
    questions: ['approve'],
    requiredQuestions: ['approve'],
    strata: ['standard', 'sensitive'],
    cadence: 'monthly',
    standard: {
      ...BASE,
      minItemsPerStratum: 20,
      minItemsPerQuestion: 40,
      minPerLabel: 5,
      spotCheck: { minItemsPerStratum: 10, minItemsPerQuestion: 20, minPerLabel: 3 },
    },
    harness: 'npm --prefix oracle run content-judge:calibrate',
    liveApprovalEnv: 'CONTENT_JUDGE_CALIBRATION_LIVE',
  },
  transcript_judge: {
    id: 'transcript_judge',
    requirement: 'C.21',
    purpose: 'Scores a Mentor transcript on the rubric criteria no deterministic rule can read.',
    gates: 'Stage 3 of a Tier 2 change (Appendix F Part 3), only on the criteria in its calibrated scope.',
    questions: TRANSCRIPT_JUDGE_QUESTIONS,
    requiredQuestions: [],
    strata: ['routine', 'hard'],
    cadence: 'monthly',
    standard: {
      ...BASE,
      minItemsPerStratum: 10,
      minItemsPerQuestion: 20,
      minPerLabel: 3,
      spotCheck: { minItemsPerStratum: 5, minItemsPerQuestion: 10, minPerLabel: 2 },
    },
    harness: 'npm --prefix oracle run transcript-judge -- --calibration',
    liveApprovalEnv: 'TRANSCRIPT_JUDGE_LIVE',
  },
};

export function isJudgeId(value: unknown): value is JudgeId {
  return typeof value === 'string' && (JUDGE_IDS as readonly string[]).includes(value);
}

// ── inputs ──────────────────────────────────────────────────────────────────

export interface SeedItemRef {
  id: string;
  stratum: CalibrationStratum;
  /** Characters of the judged text: the verbosity-bias check compares short and long items. */
  length: number;
}

export interface RatingInput {
  rater: string;
  source: string;
  labels: Record<string, Record<string, JudgeLabel>>;
}

export interface JudgeRunInput {
  model: string;
  promptHash: string;
  /** Only `live` is recordable; `dry_run` and `replay` recompute, never record. */
  mode: string;
  /** The model whose output the judge scores (self-enhancement check). */
  authorModel: string | null;
  verdicts: Record<string, Record<string, JudgeLabel>>;
}

export interface CalibrationRunInput {
  judgeId: JudgeId;
  kind: CalibrationKind;
  seedSet: { version: string; hash: string; items: SeedItemRef[] };
  ratings: RatingInput[];
  judge: JudgeRunInput;
  /** A spot check names the passed calibration it re-verifies. */
  verifies?: { id: string; model: string; promptHash: string; scope: readonly string[] } | null;
}

export interface StratumResult {
  question: CalibrationQuestion;
  stratum: CalibrationStratum;
  items: number;
  panelPass: number;
  panelFail: number;
  agreement: number;
  /** Cohen's kappa over the whole question (the same on each of its strata). */
  questionKappa: number;
  /** Items, both labels and agreement at the bar in THIS stratum (kappa is judged per question). */
  passed: boolean;
}

export interface CalibrationComputation {
  judgeId: JudgeId;
  kind: CalibrationKind;
  recordable: boolean;
  refusals: string[];
  verdict: 'passed' | 'failed';
  failureReasons: FailureReason[];
  raters: number;
  items: number;
  interRaterAgreement: number;
  interRaterKappa: number;
  lengthBiasGap: number | null;
  sameFamily: boolean;
  authorFamily: string;
  judgeFamily: string;
  scope: CalibrationQuestion[];
  strata: StratumResult[];
  thresholds: {
    interRater: number;
    interRaterKappa: number;
    agreement: number;
    judgeKappa: number;
    lengthGap: number;
    minItemsPerStratum: number;
    minItemsPerQuestion: number;
    minPerLabel: number;
  };
  disagreements: { item: string; question: string; stratum: CalibrationStratum; panel: JudgeLabel; judge: JudgeLabel }[];
}

// ── statistics (pure) ───────────────────────────────────────────────────────

const SHA256 = /^[0-9a-f]{64}$/;
const round4 = (n: number): number => (Number.isFinite(n) ? Math.floor(n * 10_000) / 10_000 : 0);

/**
 * Fleiss' kappa for `n` raters per subject over the label categories. When
 * every rating is the same label chance agreement is 1 and kappa is
 * undefined: reported as 1 when the panel is unanimous (nothing to correct),
 * which the label-balance rule then refuses on its own.
 */
export function fleissKappa(subjects: readonly (readonly JudgeLabel[])[]): number {
  const rated = subjects.filter((s) => s.length >= 2);
  if (rated.length === 0) return 0;
  const n = rated[0]!.length;
  if (rated.some((s) => s.length !== n)) return 0;
  const totals: Record<JudgeLabel, number> = { pass: 0, fail: 0, not_applicable: 0 };
  let pBarSum = 0;
  for (const s of rated) {
    const counts: Record<JudgeLabel, number> = { pass: 0, fail: 0, not_applicable: 0 };
    for (const l of s) counts[l] += 1;
    for (const l of JUDGE_LABELS) totals[l] += counts[l];
    const agree = JUDGE_LABELS.reduce((sum, l) => sum + counts[l] * (counts[l] - 1), 0);
    pBarSum += agree / (n * (n - 1));
  }
  const N = rated.length;
  const pBar = pBarSum / N;
  const pe = JUDGE_LABELS.reduce((sum, l) => sum + (totals[l] / (N * n)) ** 2, 0);
  if (pe >= 1) return pBar >= 1 ? 1 : 0;
  return (pBar - pe) / (1 - pe);
}

/** Cohen's kappa between two label sequences of equal length. */
export function cohenKappa(a: readonly JudgeLabel[], b: readonly JudgeLabel[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  const N = a.length;
  let agree = 0;
  const ca: Record<JudgeLabel, number> = { pass: 0, fail: 0, not_applicable: 0 };
  const cb: Record<JudgeLabel, number> = { pass: 0, fail: 0, not_applicable: 0 };
  for (let i = 0; i < N; i++) {
    if (a[i] === b[i]) agree += 1;
    ca[a[i]!] += 1;
    cb[b[i]!] += 1;
  }
  const po = agree / N;
  const pe = JUDGE_LABELS.reduce((sum, l) => sum + (ca[l] / N) * (cb[l] / N), 0);
  if (pe >= 1) return po >= 1 ? 1 : 0;
  return (po - pe) / (1 - pe);
}

/**
 * The panel's label for one (item, question): the label more than half the
 * raters gave. Without a majority: `fail` when any tied label is `fail`
 * (half the panel suspects a defect, which is not a pass — the S06.12 rule),
 * otherwise `not_applicable` (the panel does not agree there was an
 * opportunity, so the pair is not used against the judge).
 */
export function panelLabel(labels: readonly JudgeLabel[]): JudgeLabel {
  const counts: Record<JudgeLabel, number> = { pass: 0, fail: 0, not_applicable: 0 };
  for (const l of labels) counts[l] += 1;
  for (const l of JUDGE_LABELS) if (counts[l] * 2 > labels.length) return l;
  const top = Math.max(...JUDGE_LABELS.map((l) => counts[l]));
  const tied = JUDGE_LABELS.filter((l) => counts[l] === top);
  return tied.includes('fail') ? 'fail' : 'not_applicable';
}

/** The model family, for the self-enhancement check (Appendix E §1.2). */
export function modelFamily(model: string | null | undefined): string {
  const m = (model ?? '').toLowerCase();
  const families: [string, RegExp][] = [
    ['deepseek', /deepseek/],
    ['qwen', /qwen|qwq/],
    ['openai', /\bgpt|\bo[1-9]\b|openai/],
    ['anthropic', /claude|anthropic/],
    ['google', /gemini|gemma|palm/],
    ['meta', /llama/],
    ['mistral', /mistral|mixtral/],
    ['moonshot', /kimi|moonshot/],
    ['zhipu', /glm|zhipu/],
  ];
  for (const [family, re] of families) if (re.test(m)) return family;
  return 'unknown';
}

const isLabel = (v: unknown): v is JudgeLabel => typeof v === 'string' && (JUDGE_LABELS as readonly string[]).includes(v);

/**
 * Computes one calibration run (or spot check) from its raw parts.
 *
 * NOT RECORDABLE (refused whatever the numbers): fewer raters than the
 * standard, a rating set not from the human panel (the seed author's
 * intended labels are not a panel), judge verdicts not obtained live, a
 * judge identity that is not a model plus a SHA-256, a missing label or
 * verdict, a stratum the judge does not have, or a spot check that does not
 * re-verify the same judge identity.
 */
export function computeJudgeCalibration(input: CalibrationRunInput): CalibrationComputation {
  const def = JUDGE_REGISTRY[input.judgeId];
  const std = def.standard;
  const spot = input.kind === 'spot_check';
  const minStratum = spot ? std.spotCheck.minItemsPerStratum : std.minItemsPerStratum;
  const minQuestion = spot ? std.spotCheck.minItemsPerQuestion : std.minItemsPerQuestion;
  const minLabel = spot ? std.spotCheck.minPerLabel : std.minPerLabel;
  const refusals: string[] = [];

  if (input.ratings.length < std.minRaters) refusals.push(`at least ${std.minRaters === 2 ? 'two' : std.minRaters} human raters are required`);
  for (const r of input.ratings) {
    if (r.source !== 'human_panel') refusals.push(`rating set "${r.rater}" is not from the human panel (source: ${r.source})`);
  }
  const raterNames = new Set(input.ratings.map((r) => r.rater.trim().toLowerCase()));
  if (raterNames.size !== input.ratings.length) refusals.push('each rating set must come from a different rater');
  if (input.judge.mode !== 'live') refusals.push(`judge verdicts were not obtained live (mode: ${input.judge.mode})`);
  if (!SHA256.test(input.judge.promptHash)) refusals.push('the judge prompt hash is not a SHA-256');
  if (!input.judge.model || input.judge.model.length > 128) refusals.push('the judge model is not named');
  if (!SHA256.test(input.seedSet.hash)) refusals.push('the seed-set hash is not a SHA-256');
  if (spot) {
    const v = input.verifies;
    if (!v) refusals.push('a spot check names the calibration it re-verifies');
    else if (v.model !== input.judge.model || v.promptHash !== input.judge.promptHash) {
      refusals.push('the spot check judged with a different judge identity than the calibration it re-verifies');
    }
  } else if (input.verifies) refusals.push('a full calibration does not re-verify another row');

  const items = input.seedSet.items;
  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id)) refusals.push(`duplicate seed item ${item.id}`);
    ids.add(item.id);
    if (!def.strata.includes(item.stratum)) refusals.push(`item ${item.id}: stratum ${item.stratum} is not one of ${def.id}'s strata`);
  }

  // ── step 1: the panel agrees with itself ──
  const panel = new Map<string, JudgeLabel>();
  const subjects: JudgeLabel[][] = [];
  let pairAgree = 0;
  let pairTotal = 0;
  for (const item of items) {
    for (const q of def.questions) {
      const labels = input.ratings.map((r) => r.labels[item.id]?.[q]);
      const verdict = input.judge.verdicts[item.id]?.[q];
      if (!labels.every(isLabel) || !isLabel(verdict)) {
        refusals.push(`item ${item.id} / ${q}: a rater label or the judge verdict is missing`);
        continue;
      }
      if (def.id === 'live_content_judge' && (labels.includes('not_applicable') || verdict === 'not_applicable')) {
        refusals.push(`item ${item.id}: the content judge answers pass or fail only`);
        continue;
      }
      subjects.push(labels as JudgeLabel[]);
      panel.set(`${item.id}\u0000${q}`, panelLabel(labels as JudgeLabel[]));
      for (let i = 0; i < labels.length; i++) {
        for (let j = i + 1; j < labels.length; j++) {
          pairTotal += 1;
          if (labels[i] === labels[j]) pairAgree += 1;
        }
      }
    }
  }
  const interRaterAgreement = pairTotal === 0 ? 0 : pairAgree / pairTotal;
  const interRaterKappa = fleissKappa(subjects);

  // ── step 2: the judge agrees with the panel, stratum by stratum ──
  const strata: StratumResult[] = [];
  const disagreements: CalibrationComputation['disagreements'] = [];
  const compared: { length: number; agree: boolean }[] = [];
  const scope: CalibrationQuestion[] = [];
  for (const q of def.questions) {
    const qPanel: JudgeLabel[] = [];
    const qJudge: JudgeLabel[] = [];
    const perStratum: Omit<StratumResult, 'questionKappa' | 'passed'>[] = [];
    for (const stratum of def.strata) {
      let n = 0;
      let agree = 0;
      let pass = 0;
      let fail = 0;
      for (const item of items.filter((i) => i.stratum === stratum)) {
        const p = panel.get(`${item.id}\u0000${q}`);
        const j = input.judge.verdicts[item.id]?.[q];
        if (p === undefined || !isLabel(j)) continue;
        // A pair counts when either side saw an opportunity: a judge that
        // flags a clean transcript is as wrong as one that misses a defect.
        if (p === 'not_applicable' && j === 'not_applicable') continue;
        n += 1;
        if (p === 'pass') pass += 1;
        if (p === 'fail') fail += 1;
        qPanel.push(p);
        qJudge.push(j);
        const ok = p === j;
        if (ok) agree += 1;
        else disagreements.push({ item: item.id, question: q, stratum, panel: p, judge: j });
        compared.push({ length: item.length, agree: ok });
      }
      perStratum.push({ question: q, stratum, items: n, panelPass: pass, panelFail: fail, agreement: n === 0 ? 0 : round4(agree / n) });
    }
    const qKappa = round4(cohenKappa(qPanel, qJudge));
    const qItems = perStratum.reduce((s, r) => s + r.items, 0);
    // A question is calibrated when EVERY stratum reaches the bar on its own
    // (the weakest case decides) AND the judge's chance-corrected agreement
    // over the whole question clears the kappa floor.
    let all = qItems >= minQuestion && qKappa >= std.judgeKappa;
    for (const r of perStratum) {
      const passed = r.items >= minStratum && r.panelPass >= minLabel && r.panelFail >= minLabel && r.agreement >= std.judgeAgreement;
      if (!passed) all = false;
      strata.push({ ...r, questionKappa: qKappa, passed });
    }
    if (all) scope.push(q);
  }

  // ── bias checks ──
  const sorted = [...compared].sort((a, b) => a.length - b.length);
  const third = Math.floor(sorted.length / 3);
  let lengthBiasGap: number | null = null;
  if (third >= std.lengthBiasMinTercile) {
    const rate = (xs: typeof sorted) => xs.filter((x) => x.agree).length / xs.length;
    lengthBiasGap = round4(Math.abs(rate(sorted.slice(0, third)) - rate(sorted.slice(sorted.length - third))));
  }
  const judgeFamily = modelFamily(input.judge.model);
  const authorFamily = modelFamily(input.judge.authorModel);
  const sameFamily = judgeFamily !== 'unknown' && judgeFamily === authorFamily;

  const failureReasons: FailureReason[] = [];
  if (interRaterAgreement < std.interRaterAgreement) failureReasons.push('inter_rater_below_threshold');
  if (interRaterKappa < std.interRaterKappa) failureReasons.push('inter_rater_kappa_below_threshold');
  if (lengthBiasGap !== null && lengthBiasGap > std.lengthBiasMaxGap) failureReasons.push('verbosity_bias');
  if (sameFamily) failureReasons.push('self_enhancement_risk');
  if (scope.length === 0) failureReasons.push('no_question_calibrated');
  if (def.requiredQuestions.some((q) => !scope.includes(q))) failureReasons.push('required_question_uncalibrated');
  if (spot && input.verifies && input.verifies.scope.some((q) => !scope.includes(q as CalibrationQuestion))) failureReasons.push('spot_check_scope_lost');

  const recordable = refusals.length === 0;
  return {
    judgeId: def.id,
    kind: input.kind,
    recordable,
    refusals,
    verdict: recordable && failureReasons.length === 0 ? 'passed' : 'failed',
    failureReasons,
    raters: input.ratings.length,
    items: items.length,
    interRaterAgreement: round4(interRaterAgreement),
    interRaterKappa: round4(interRaterKappa),
    lengthBiasGap,
    sameFamily,
    authorFamily,
    judgeFamily,
    scope,
    strata,
    thresholds: {
      interRater: std.interRaterAgreement,
      interRaterKappa: std.interRaterKappa,
      agreement: std.judgeAgreement,
      judgeKappa: std.judgeKappa,
      lengthGap: std.lengthBiasMaxGap,
      minItemsPerStratum: minStratum,
      minItemsPerQuestion: minQuestion,
      minPerLabel: minLabel,
    },
    disagreements,
  };
}

/** SHA-256 of a seed set's canonical JSON (item order and content both count). */
export function seedSetHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

// ── trust state (pure) ──────────────────────────────────────────────────────

export interface CalibrationRecordRow {
  id: string;
  judge_id: string;
  kind: CalibrationKind;
  verifies_calibration_id: string | null;
  judge_model: string;
  judge_prompt_hash: string;
  seed_set_version: string;
  verdict: 'passed' | 'failed';
  scope: string[] | null;
  failure_reasons?: string[] | null;
  created_at: string;
}

export interface JudgeTrust {
  judgeId: JudgeId;
  state: TrustState;
  /** The passed calibration the trust rests on (null unless passed or stale). */
  calibration: CalibrationRecordRow | null;
  /** The latest row of any kind, whatever it says. */
  latest: CalibrationRecordRow | null;
  verifiedAt: string | null;
  dueAt: string | null;
  dueSoon: boolean;
  ageDays: number | null;
  scope: string[];
  /** The end of the first year of the cadence (monthly until then, per Appendix F §1.3). */
  firstYearEndsAt: string | null;
}

const DAY = 86_400_000;

/**
 * The trust a judge has NOW, from its recorded rows (any order):
 *
 *   uncalibrated            no calibration was ever recorded
 *   failed                  the latest full calibration failed (a failed
 *                           recalibration un-trusts a judge that passed before)
 *   recalibration_required  a spot check of the current calibration failed
 *                           (Appendix F §1.3's automatic trigger): only a new
 *                           passed calibration restores trust
 *   stale                   passed, but not re-verified within the cadence
 *   passed                  trusted, within its scope, until `dueAt`
 */
export function judgeTrust(judgeId: JudgeId, rows: readonly CalibrationRecordRow[], now: Date): JudgeTrust {
  const def = JUDGE_REGISTRY[judgeId];
  const mine = rows.filter((r) => r.judge_id === judgeId).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const latest = mine[0] ?? null;
  const base: JudgeTrust = {
    judgeId,
    state: 'uncalibrated',
    calibration: null,
    latest,
    verifiedAt: null,
    dueAt: null,
    dueSoon: false,
    ageDays: null,
    scope: [],
    firstYearEndsAt: null,
  };
  const firstPassed = [...mine].reverse().find((r) => r.kind === 'calibration' && r.verdict === 'passed');
  if (firstPassed) base.firstYearEndsAt = new Date(Date.parse(firstPassed.created_at) + 365 * DAY).toISOString();

  const current = mine.find((r) => r.kind === 'calibration');
  if (!current) return base;
  if (current.verdict !== 'passed') return { ...base, state: 'failed' };
  const after = mine.filter((r) => r.kind === 'spot_check' && r.verifies_calibration_id === current.id && Date.parse(r.created_at) >= Date.parse(current.created_at));
  if (after.some((r) => r.verdict === 'failed')) {
    return { ...base, state: 'recalibration_required', calibration: current };
  }
  const verifiedAt = [current, ...after.filter((r) => r.verdict === 'passed')].map((r) => r.created_at).sort().at(-1)!;
  const age = Math.floor((now.getTime() - Date.parse(verifiedAt)) / DAY);
  const dueAt = new Date(Date.parse(verifiedAt) + def.standard.maxAgeDays * DAY);
  const stale = age > def.standard.maxAgeDays;
  return {
    ...base,
    state: stale ? 'stale' : 'passed',
    calibration: current,
    verifiedAt,
    dueAt: dueAt.toISOString(),
    dueSoon: !stale && dueAt.getTime() - now.getTime() <= def.standard.dueSoonDays * DAY,
    ageDays: age,
    scope: [...(current.scope ?? [])],
  };
}

/** Whether a judge identity is the trusted one (model AND prompt hash). */
export function trustedIdentity(trust: JudgeTrust, model: unknown, promptHash: unknown): boolean {
  return (
    trust.state === 'passed' &&
    trust.calibration !== null &&
    typeof model === 'string' &&
    typeof promptHash === 'string' &&
    trust.calibration.judge_model === model &&
    trust.calibration.judge_prompt_hash === promptHash
  );
}

// ── Stage 3 of a Tier 2 change (Appendix F Part 3) ──────────────────────────

export interface Stage3Claim {
  judgeId: string;
  calibrationId: string;
  judgeModel: string;
  judgePromptHash: string;
  /** When the judge scored the change's simulated-student transcripts. */
  scoredAt: string;
  /** The rubric criteria the change was scored on. */
  criteria: string[];
}

/**
 * Whether the judge may gate this Tier 2 change. Appendix F Stage 3: "A
 * judge that has not been calibrated, or whose calibration has gone stale
 * ... may not gate this stage — an uncalibrated judge routes the change
 * directly to Stage 4 as if it were Tier 1." Every refusal below means
 * exactly that routing, never a pass.
 */
export function verifyStage3(claim: Stage3Claim, rows: readonly CalibrationRecordRow[]): { mayGate: true } | { mayGate: false; reasons: string[] } {
  const reasons: string[] = [];
  if (!isJudgeId(claim.judgeId) || claim.judgeId !== 'transcript_judge') {
    return { mayGate: false, reasons: [`${claim.judgeId} is not a judge that may gate a Tier 2 change`] };
  }
  const scoredAt = new Date(claim.scoredAt);
  if (Number.isNaN(scoredAt.getTime())) return { mayGate: false, reasons: ['the scoring date is not a date'] };
  // The trust AT THE TIME the change was scored: rows recorded later cannot vouch for it.
  const known = rows.filter((r) => Date.parse(r.created_at) <= scoredAt.getTime());
  const trust = judgeTrust('transcript_judge', known, scoredAt);
  if (trust.state !== 'passed') reasons.push(`the transcript judge was ${trust.state} when the change was scored`);
  else {
    if (trust.calibration!.id !== claim.calibrationId) reasons.push('the change names a calibration that is not the current one');
    if (!trustedIdentity(trust, claim.judgeModel, claim.judgePromptHash)) reasons.push('the judge that scored the change is not the calibrated identity');
    const outside = claim.criteria.filter((c) => !trust.scope.includes(c));
    if (claim.criteria.length === 0) reasons.push('the change names no criterion it was scored on');
    if (outside.length > 0) reasons.push(`criteria outside the calibrated scope: ${outside.join(', ')}`);
  }
  return reasons.length === 0 ? { mayGate: true } : { mayGate: false, reasons };
}

// ── I/O (service role) ──────────────────────────────────────────────────────

export const CALIBRATION_RECORD_SELECT =
  'id,judge_id,kind,verifies_calibration_id,judge_model,judge_prompt_hash,seed_set_version,verdict,scope,failure_reasons,created_at';

export const JUDGE_CALIBRATION_RECORDED = 'mentor.judge_calibration.recorded';

/** Every recorded row for the judges (newest first), or null when the read failed. */
export async function readCalibrationRows(judgeId?: JudgeId, limit = 200): Promise<CalibrationRecordRow[] | null> {
  const filter = judgeId ? `&judge_id=eq.${judgeId}` : '';
  return serviceRest<CalibrationRecordRow[]>(`/mentor_judge_calibration?select=${CALIBRATION_RECORD_SELECT}${filter}&order=created_at.desc&limit=${limit}`);
}

/**
 * Records a computed run through `record_mentor_judge_calibration`, which
 * recomputes every stratum result, the scope and the verdict from the
 * numbers and refuses the row if any claim does not follow. Operator-only.
 */
export async function recordCalibration(input: {
  result: CalibrationComputation;
  seedSet: { version: string; hash: string };
  judge: Pick<JudgeRunInput, 'model' | 'promptHash' | 'authorModel'>;
  verifiesId: string | null;
  recordedBy: string;
  note: string;
}): Promise<{ ok: true; id: string } | { ok: false; why: string }> {
  const r = input.result;
  if (!r.recordable) return { ok: false, why: `not recordable: ${r.refusals.join('; ')}` };
  const t = r.thresholds;
  const body = {
    p_calibration: {
      judge_id: r.judgeId,
      kind: r.kind,
      verifies_calibration_id: input.verifiesId,
      judge_model: input.judge.model,
      judge_prompt_hash: input.judge.promptHash,
      author_model: input.judge.authorModel,
      same_family: r.sameFamily,
      seed_set_version: input.seedSet.version,
      seed_set_hash: input.seedSet.hash,
      raters: r.raters,
      items: r.items,
      inter_rater_agreement: r.interRaterAgreement,
      inter_rater_kappa: r.interRaterKappa,
      length_bias_gap: r.lengthBiasGap,
      threshold_inter_rater: t.interRater,
      threshold_inter_rater_kappa: t.interRaterKappa,
      threshold_agreement: t.agreement,
      threshold_judge_kappa: t.judgeKappa,
      threshold_length_gap: t.lengthGap,
      min_items_per_stratum: t.minItemsPerStratum,
      min_items_per_question: t.minItemsPerQuestion,
      min_per_label: t.minPerLabel,
      scope: r.scope,
      verdict: r.verdict,
      failure_reasons: r.failureReasons,
      recorded_by: input.recordedBy.slice(0, 120),
      note: input.note.slice(0, 1000),
    },
    p_strata: r.strata.map((s) => ({
      question: s.question,
      stratum: s.stratum,
      items: s.items,
      panel_pass: s.panelPass,
      panel_fail: s.panelFail,
      agreement: s.agreement,
      question_kappa: s.questionKappa,
      passed: s.passed,
    })),
  };
  const res = await serviceRestRaw('/rpc/record_mentor_judge_calibration', { method: 'POST', body: JSON.stringify(body) });
  const id = res.ok ? res.body : null;
  if (typeof id !== 'string' || id.length === 0) {
    const message = res.body && typeof res.body === 'object' && 'message' in res.body ? String((res.body as { message: unknown }).message) : null;
    return { ok: false, why: message ? `the database refused the row: ${message}` : 'the database refused the row, or the function is missing (apply the migration first)' };
  }
  await insertAuditLog(null, JUDGE_CALIBRATION_RECORDED, 'tutor', {
    judgeId: r.judgeId,
    kind: r.kind,
    calibrationId: id,
    verdict: r.verdict,
    judgeModel: input.judge.model,
    scope: r.scope,
    failureReasons: r.failureReasons,
  });
  return { ok: true, id };
}
