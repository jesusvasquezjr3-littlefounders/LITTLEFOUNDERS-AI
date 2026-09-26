/*
 * Core's half of Product C.17 — age-band-differentiated dialogue calibration
 * (Appendix D §3.6), instrumented for Appendix F §1.2's "Age-Band Calibration
 * A/B Outcome" and Part 3 Stage 7.
 *
 *   1. THE BAND. Derived HERE, from Core's own age evidence (the declared age
 *      band, the birth date, the confirmed teaching tier) — the birth date
 *      never leaves Core, and neither band nor age ever enters the sealed
 *      model context. Four registers, the B.23 ones: young_child (6–9),
 *      tween (10–12), teen (13–17), adult (18+). Without age evidence finer
 *      than the tier, a tier-3 learner is a tween: never the teen or adult
 *      register on a guess.
 *   2. THE VARIANT. C.17 requires the calibration to be A/B tested, not
 *      assumed correct. The experiment runs on the H.7 runtime (dataintel,
 *      surface `tutor`, target `mentor.dialogue-register`; variant A = the
 *      uniform `control` register, B = `calibrated`). OD-23 / H.7: enrolment
 *      is ADULTS ONLY until Product and Legal choose wider ages
 *      (`MENTOR_DIALOGUE_EXPERIMENT_BANDS`, default `adult`), and it follows
 *      the same analytics-consent rule as behavioural measurement (a kid needs
 *      a verified guardian's consent, a teen their own preference). Every
 *      learner not enrolled receives the SPEC's calibrated register. A runtime
 *      that cannot answer is never a guess: the calibrated default, recorded
 *      as `runtime_unavailable`. Exposure is recorded when the session starts
 *      with the treatment (the register applies from the first turn).
 *   3. THE RECORD. Oracle reports at close what the register did; one row of
 *      `tutor_dialogue_calibration` per session (labels and counts only).
 *   4. THE OUTCOME. Per band and variant: the Alliance Bond Proxy Score (C.15)
 *      and the closing outcome (C.16 — a completed close versus a silent
 *      dropout), with Welch / two-proportion 95% intervals on the
 *      calibrated − control difference. Sessions outside the experiment are
 *      reported separately and labelled UNCONTROLLED (calibrated default
 *      versus the pre-C.17 baseline): observational, never causal.
 *   5. STAGE 7. If the calibrated arm is significantly WORSE than control on
 *      either outcome for any band with enough sessions, the rollback puts
 *      every new session on the control register until an operator records
 *      the resolution (`audit_logs`, counts only).
 *
 * Every threshold is PROPOSED, pending calibration:
 * docs/rebuild/mentor/THRESHOLD-RECALIBRATION-LOG.md (C.17 rows).
 */

import { z } from 'zod';
import { declaredBandForDate, type AgeScreenState } from '../ageScreen.js';
import { allowsSelfManagedAnalytics } from '../analyticsPreference.js';
import { hasActiveAnalyticsConsent } from '../insights.js';
import { getExperimentAssignments, recordExperimentExposure } from '../learningIntel.js';
import { insertAuditLog, serviceRest } from '../supabaseRest.js';

// ── vocabularies (hand-mirrored from Oracle's tutor/dialogueCalibration.ts) ──

export const DIALOGUE_BANDS = ['young_child', 'tween', 'teen', 'adult'] as const;
export type DialogueBand = (typeof DIALOGUE_BANDS)[number];
export const DIALOGUE_VARIANTS = ['calibrated', 'control'] as const;
export type DialogueVariant = (typeof DIALOGUE_VARIANTS)[number];
export const DIALOGUE_ASSIGNMENTS = [
  'experiment',
  'not_eligible',
  'no_consent',
  'no_experiment',
  'runtime_unavailable',
  'rollback',
  'tier_fallback',
  'operator_off',
] as const;
export type DialogueAssignment = (typeof DIALOGUE_ASSIGNMENTS)[number];

/** The H.7 runtime target of the C.17 experiment (variant A = control, B = calibrated). */
export const DIALOGUE_EXPERIMENT_TARGET = 'mentor.dialogue-register';

export const DIALOGUE_THRESHOLDS = {
  /** Sessions per arm (per band) before the A/B outcome is judged at all. */
  minSessionsPerArm: 30,
  /** "At minimum non-regression": the calibrated arm may trail control by at most this (bond proxy, 0..1). */
  nonRegressionMargin: 0.05,
  /** The same margin for the completed-close share. */
  closingMargin: 0.05,
  /** Two-sided 95% normal quantile. */
  z: 1.96,
  /** Window the Stage 7 verdict reads (days). */
  killSwitchDays: 90,
  killSwitchCacheMs: 10 * 60_000,
} as const;

export interface DialogueCalibration {
  band: DialogueBand;
  variant: DialogueVariant;
  assignment: DialogueAssignment;
  experimentId: string | null;
}

// ── 1. the band ──────────────────────────────────────────────────────────────

function exactAge(birthDate: string, now: Date): number | null {
  const born = new Date(`${birthDate}T00:00:00.000Z`);
  if (Number.isNaN(born.getTime())) return null;
  let age = now.getUTCFullYear() - born.getUTCFullYear();
  if (now.getUTCMonth() < born.getUTCMonth() || (now.getUTCMonth() === born.getUTCMonth() && now.getUTCDate() < born.getUTCDate())) age -= 1;
  return age >= 0 && age <= 120 ? age : null;
}

const bandOfAge = (age: number): DialogueBand => (age <= 9 ? 'young_child' : age <= 12 ? 'tween' : age <= 17 ? 'teen' : 'adult');

/**
 * The dialogue band from Core's own evidence, in the SAME precedence the
 * teaching tier uses (`mentorAgeCalibration.ts` `knownMentorAgeTier`): the
 * declared age band of a self-registered account (13–17 → teen, adult →
 * adult) wins; otherwise a birth date gives an exact age (parent-created
 * accounts); otherwise the confirmed teaching tier (1–2 → young child,
 * 3 → tween — never teen or adult on a guess). Returns the exact age too, for
 * the experiment runtime's H.7 age bounds — only when a birth date AGREES
 * with the band; null otherwise.
 */
export function dialogueBandFor(input: {
  birthDate: string | null;
  screening: AgeScreenState;
  tier: 1 | 2 | 3;
  now?: Date;
}): { band: DialogueBand; age: number | null } {
  const now = input.now ?? new Date();
  const age = input.birthDate && declaredBandForDate(input.birthDate, now) !== null ? exactAge(input.birthDate, now) : null;
  const declared =
    !input.screening.protectedOrigin && input.screening.ageBand === 'adult'
      ? 'adult'
      : !input.screening.protectedOrigin && input.screening.ageBand === '13_to_17'
        ? 'teen'
        : null;
  if (declared !== null) return { band: declared, age: age !== null && bandOfAge(age) === declared ? age : null };
  if (age !== null) return { band: bandOfAge(age), age };
  return { band: input.tier === 3 ? 'tween' : 'young_child', age: null };
}

// ── 2. the variant ───────────────────────────────────────────────────────────

/**
 * The variant this session runs. Never throws and never guesses: every path
 * that is not an enrolled, exposed assignment is the SPEC's calibrated
 * default with the reason recorded.
 */
export async function resolveDialogueCalibration(input: {
  userId: string;
  band: DialogueBand;
  age: number | null;
  roles: readonly string[];
  screening: AgeScreenState;
  eligibleBands: readonly DialogueBand[];
  rollback: boolean;
}): Promise<DialogueCalibration> {
  const calibrated = (assignment: DialogueAssignment): DialogueCalibration => ({
    band: input.band,
    variant: 'calibrated',
    assignment,
    experimentId: null,
  });
  if (input.rollback) return { band: input.band, variant: 'control', assignment: 'rollback', experimentId: null };
  // OD-23 / H.7: only the bands Product and Legal opened (adults by default).
  if (!input.eligibleBands.includes(input.band)) return calibrated('not_eligible');
  // Experiment participation follows the analytics-consent rule.
  const consented = input.roles.includes('kid')
    ? (await hasActiveAnalyticsConsent(input.userId)) === true
    : await allowsSelfManagedAnalytics(input.userId, input.screening);
  if (!consented) return calibrated('no_consent');
  const assignments = await getExperimentAssignments({
    userId: input.userId,
    surface: 'tutor',
    target: DIALOGUE_EXPERIMENT_TARGET,
    age: input.age,
  });
  if (assignments === null) return calibrated('runtime_unavailable');
  const assignment = assignments[0];
  if (!assignment) return calibrated('no_experiment');
  // The treatment applies from the session's first turn: the exposure is recorded now, or not at all.
  const exposure = await recordExperimentExposure({
    userId: input.userId,
    experimentId: assignment.experimentId,
    surface: 'tutor',
    target: DIALOGUE_EXPERIMENT_TARGET,
    age: input.age,
  });
  if (exposure === null) return calibrated('runtime_unavailable');
  return {
    band: input.band,
    variant: exposure.variant === 'A' ? 'control' : 'calibrated',
    assignment: 'experiment',
    experimentId: exposure.experimentId,
  };
}

// ── 3. the close record ──────────────────────────────────────────────────────

export const DialogueCalibrationReportBody = z
  .object({
    band: z.enum(DIALOGUE_BANDS),
    variant: z.enum(DIALOGUE_VARIANTS),
    assignment: z.enum(DIALOGUE_ASSIGNMENTS),
    experimentId: z.string().uuid().nullable(),
    ladderRungs: z.number().int().min(2).max(5),
    hintRequests: z.number().int().min(0).max(10_000),
    tellRequests: z.number().int().min(0).max(10_000),
    controllingCaught: z.number().int().min(0).max(10_000),
    controllingDelivered: z.number().int().min(0).max(10_000),
    pacingOffers: z.number().int().min(0).max(10_000),
    unilateralStyleChanges: z.number().int().min(0).max(10_000),
  })
  .strict()
  .refine((r) => (r.assignment === 'experiment') === (r.experimentId !== null), 'an experiment id belongs to an enrolled session only')
  // The control arm is the uniform register: the full ladder, no gate.
  .refine((r) => r.variant === 'calibrated' || (r.ladderRungs === 5 && r.controllingCaught === 0), 'control ran a calibrated behaviour')
  // Only the younger-child register shortens the ladder.
  .refine((r) => r.ladderRungs === (r.variant === 'calibrated' && r.band === 'young_child' ? 4 : 5), 'ladder does not fit the register')
  .refine((r) => r.controllingDelivered <= r.controllingCaught, 'more controlling turns delivered than caught')
  // The ask-first register never changes the approach on its own.
  .refine(
    (r) => !(r.variant === 'calibrated' && (r.band === 'teen' || r.band === 'adult')) || r.unilateralStyleChanges === 0,
    'the ask-first register changed the approach unilaterally',
  );
export type DialogueCalibrationReport = z.infer<typeof DialogueCalibrationReportBody>;

/** One row per session; idempotent on a retried close. Best-effort after the close landed. */
export async function recordDialogueCalibrationClose(input: {
  sessionId: string;
  character: string;
  report: DialogueCalibrationReport;
}): Promise<boolean> {
  const r = input.report;
  const res = await serviceRest<unknown>('/tutor_dialogue_calibration?on_conflict=session_id', {
    method: 'POST',
    headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' },
    body: JSON.stringify({
      session_id: input.sessionId,
      character: input.character,
      band: r.band,
      variant: r.variant,
      assignment: r.assignment,
      experiment_id: r.experimentId,
      ladder_rungs: r.ladderRungs,
      hint_requests: r.hintRequests,
      tell_requests: r.tellRequests,
      controlling_caught: r.controllingCaught,
      controlling_delivered: r.controllingDelivered,
      pacing_offers: r.pacingOffers,
      unilateral_style_changes: r.unilateralStyleChanges,
    }),
  });
  return res !== null;
}

// ── 4. the outcome ───────────────────────────────────────────────────────────

/** One session with its calibration (null: before C.17) and its C.15/C.16 outcomes. */
export interface CalibrationOutcomeRow {
  band: DialogueBand | null;
  variant: DialogueVariant | null;
  assignment: DialogueAssignment | null;
  bond_proxy: 'yes' | 'partly' | 'no' | null;
  closing_script: 'completed' | 'interrupted' | 'learner_left' | 'safety_stop' | null;
  controlling_delivered: number | null;
}

const bondValue = (a: string | null): number | null => (a === 'yes' ? 1 : a === 'partly' ? 0.5 : a === 'no' ? 0 : null);

interface ArmStats {
  sessions: number;
  bondAnswers: number;
  bondMean: number | null;
  bondVariance: number | null;
  /** Share of sessions (with a closing script, safety stops excluded) that closed as completed. */
  closings: number;
  completedShare: number | null;
}

function armStats(rows: CalibrationOutcomeRow[]): ArmStats {
  const bonds = rows.map((r) => bondValue(r.bond_proxy)).filter((v): v is number => v !== null);
  const mean = bonds.length === 0 ? null : bonds.reduce((a, b) => a + b, 0) / bonds.length;
  const variance =
    mean === null || bonds.length < 2 ? null : bonds.reduce((a, b) => a + (b - mean) ** 2, 0) / (bonds.length - 1);
  // A safety stop is not a pedagogical ending and is never compared.
  const closings = rows.filter((r) => r.closing_script !== null && r.closing_script !== 'safety_stop');
  return {
    sessions: rows.length,
    bondAnswers: bonds.length,
    bondMean: mean,
    bondVariance: variance,
    closings: closings.length,
    completedShare: closings.length === 0 ? null : closings.filter((r) => r.closing_script === 'completed').length / closings.length,
  };
}

export interface DifferenceEstimate {
  diff: number;
  low: number;
  high: number;
}

/** calibrated − control on the bond proxy, Welch 95% normal interval. Null below the sample floor. */
export function bondDifference(cal: ArmStats, ctl: ArmStats, t = DIALOGUE_THRESHOLDS): DifferenceEstimate | null {
  if (cal.bondAnswers < t.minSessionsPerArm || ctl.bondAnswers < t.minSessionsPerArm) return null;
  if (cal.bondMean === null || ctl.bondMean === null || cal.bondVariance === null || ctl.bondVariance === null) return null;
  const diff = cal.bondMean - ctl.bondMean;
  const se = Math.sqrt(cal.bondVariance / cal.bondAnswers + ctl.bondVariance / ctl.bondAnswers);
  return { diff, low: diff - t.z * se, high: diff + t.z * se };
}

/** calibrated − control on the completed-close share, two-proportion 95% normal interval. */
export function closingDifference(cal: ArmStats, ctl: ArmStats, t = DIALOGUE_THRESHOLDS): DifferenceEstimate | null {
  if (cal.closings < t.minSessionsPerArm || ctl.closings < t.minSessionsPerArm) return null;
  if (cal.completedShare === null || ctl.completedShare === null) return null;
  const diff = cal.completedShare - ctl.completedShare;
  const se = Math.sqrt(
    (cal.completedShare * (1 - cal.completedShare)) / cal.closings + (ctl.completedShare * (1 - ctl.completedShare)) / ctl.closings,
  );
  return { diff, low: diff - t.z * se, high: diff + t.z * se };
}

export type ArmVerdict = 'improvement' | 'non_regression' | 'inconclusive' | 'regression' | 'insufficient_data';

/** Appendix F: "statistically significant improvement, or at minimum non-regression". */
export function verdictFor(estimate: DifferenceEstimate | null, margin: number): ArmVerdict {
  if (estimate === null) return 'insufficient_data';
  if (estimate.high < 0) return 'regression';
  if (estimate.low > 0) return 'improvement';
  if (estimate.low > -margin) return 'non_regression';
  return 'inconclusive';
}

export interface BandOutcome {
  band: DialogueBand;
  calibrated: ArmStats;
  control: ArmStats;
  bond: DifferenceEstimate | null;
  bondVerdict: ArmVerdict;
  closing: DifferenceEstimate | null;
  closingVerdict: ArmVerdict;
}

/**
 * The Age-Band Calibration A/B Outcome (Appendix F §1.2): enrolled sessions
 * only (`assignment = experiment`), per band.
 */
export function summarizeCalibrationExperiment(rows: CalibrationOutcomeRow[], t = DIALOGUE_THRESHOLDS): BandOutcome[] {
  const enrolled = rows.filter((r) => r.assignment === 'experiment' && r.band !== null);
  return DIALOGUE_BANDS.filter((band) => enrolled.some((r) => r.band === band)).map((band) => {
    const calibrated = armStats(enrolled.filter((r) => r.band === band && r.variant === 'calibrated'));
    const control = armStats(enrolled.filter((r) => r.band === band && r.variant === 'control'));
    const bond = bondDifference(calibrated, control, t);
    const closing = closingDifference(calibrated, control, t);
    return {
      band,
      calibrated,
      control,
      bond,
      bondVerdict: verdictFor(bond, t.nonRegressionMargin),
      closing,
      closingVerdict: verdictFor(closing, t.closingMargin),
    };
  });
}

/**
 * The UNCONTROLLED view: sessions outside the experiment (every minor, by
 * OD-23) on the calibrated default, per band, beside the pre-C.17 baseline
 * (sessions with no calibration row). Observational — confounded by time,
 * content and cohort — and labelled so in every output.
 */
export function summarizeObservational(rows: CalibrationOutcomeRow[]): {
  byBand: Record<string, ArmStats>;
  preC17Baseline: ArmStats;
} {
  const outside = rows.filter((r) => r.band !== null && r.assignment !== 'experiment' && r.variant === 'calibrated');
  const byBand: Record<string, ArmStats> = {};
  for (const band of DIALOGUE_BANDS) {
    const inBand = outside.filter((r) => r.band === band);
    if (inBand.length > 0) byBand[band] = armStats(inBand);
  }
  return { byBand, preC17Baseline: armStats(rows.filter((r) => r.band === null)) };
}

/** The auditable style constraint: controlling language that reached a learner in the autonomy register. */
export function summarizeControllingLanguage(rows: CalibrationOutcomeRow[]): { sessions: number; delivered: number; status: 'ok' | 'defect' | 'insufficient_data' } {
  const autonomy = rows.filter((r) => r.variant === 'calibrated' && (r.band === 'teen' || r.band === 'adult'));
  const delivered = autonomy.reduce((sum, r) => sum + (r.controlling_delivered ?? 0), 0);
  return { sessions: autonomy.length, delivered, status: autonomy.length === 0 ? 'insufficient_data' : delivered > 0 ? 'defect' : 'ok' };
}

// ── 5. Stage 7 ───────────────────────────────────────────────────────────────

export const DIALOGUE_KILL_SWITCH_TRIGGERED = 'mentor.kill_switch.dialogue_calibration.triggered';
export const DIALOGUE_KILL_SWITCH_RESOLVED = 'mentor.kill_switch.dialogue_calibration.resolved';

/** Pure: the bands whose calibrated arm is significantly worse than control on either outcome. */
export function evaluateDialogueKillSwitch(rows: CalibrationOutcomeRow[], t = DIALOGUE_THRESHOLDS): {
  tripped: boolean;
  regressions: { band: DialogueBand; outcome: 'bond_proxy' | 'closing' }[];
} {
  const regressions: { band: DialogueBand; outcome: 'bond_proxy' | 'closing' }[] = [];
  for (const b of summarizeCalibrationExperiment(rows, t)) {
    if (b.bondVerdict === 'regression') regressions.push({ band: b.band, outcome: 'bond_proxy' });
    if (b.closingVerdict === 'regression') regressions.push({ band: b.band, outcome: 'closing' });
  }
  return { tripped: regressions.length > 0, regressions };
}

interface AuditRow {
  action: string;
  created_at: string;
  detail: Record<string, unknown> | null;
}

export interface DialogueKillSwitchState {
  rollback: boolean;
  trippedAt: string | null;
  degraded: boolean;
}

let cache: { at: number; state: DialogueKillSwitchState } | null = null;

export function resetDialogueKillSwitchCache(): void {
  cache = null;
}

interface CalibrationRow {
  session_id: string | null;
  band: DialogueBand;
  variant: DialogueVariant;
  assignment: DialogueAssignment;
  controlling_delivered: number;
  created_at: string;
}

/** Reads the calibration rows in a window and joins the C.15 bond proxy and the C.16 closing script. */
export async function readCalibrationOutcomes(since: Date): Promise<{ rows: CalibrationOutcomeRow[]; calibrated: number } | null> {
  const iso = encodeURIComponent(since.toISOString());
  const [calibration, alliance, sessions] = await Promise.all([
    serviceRest<CalibrationRow[]>(
      `/tutor_dialogue_calibration?select=session_id,band,variant,assignment,controlling_delivered,created_at&created_at=gte.${iso}&order=created_at.desc&limit=50000`,
    ),
    serviceRest<{ session_id: string | null; bond_proxy: string | null }[]>(
      `/tutor_session_alliance?select=session_id,bond_proxy&created_at=gte.${iso}&order=created_at.desc&limit=50000`,
    ),
    serviceRest<{ id: string; closing_script: string | null }[]>(
      `/tutor_sessions?select=id,closing_script&ended_at=gte.${iso}&order=ended_at.desc&limit=50000`,
    ),
  ]);
  if (calibration === null || alliance === null || sessions === null) return null;
  const bond = new Map(alliance.filter((a) => a.session_id !== null).map((a) => [a.session_id!, a.bond_proxy]));
  const byId = new Map(calibration.filter((c) => c.session_id !== null).map((c) => [c.session_id!, c]));
  const rows: CalibrationOutcomeRow[] = sessions.map((s) => {
    const c = byId.get(s.id);
    return {
      band: c?.band ?? null,
      variant: c?.variant ?? null,
      assignment: c?.assignment ?? null,
      bond_proxy: (bond.get(s.id) ?? null) as CalibrationOutcomeRow['bond_proxy'],
      closing_script: s.closing_script as CalibrationOutcomeRow['closing_script'],
      controlling_delivered: c?.controlling_delivered ?? null,
    };
  });
  return { rows, calibrated: calibration.length };
}

/**
 * The rollback state for a new session (cached per process). A trip in force
 * → rollback; otherwise the experiment is evaluated over the window after the
 * latest resolution, and a trip is written to `audit_logs` (bands and
 * outcomes only). A FAILED read is not evidence: no rollback, `degraded`.
 */
export async function getDialogueKillSwitch(now: Date = new Date(), t = DIALOGUE_THRESHOLDS): Promise<DialogueKillSwitchState> {
  if (cache !== null && now.getTime() - cache.at < t.killSwitchCacheMs) return cache.state;
  const log = await serviceRest<AuditRow[]>(
    `/audit_logs?action=in.(${DIALOGUE_KILL_SWITCH_TRIGGERED},${DIALOGUE_KILL_SWITCH_RESOLVED})&select=action,created_at,detail&order=created_at.desc&limit=1`,
  );
  if (log === null) return { rollback: false, trippedAt: null, degraded: true };
  const latest = log[0] ?? null;
  if (latest?.action === DIALOGUE_KILL_SWITCH_TRIGGERED) {
    const state = { rollback: true, trippedAt: latest.created_at, degraded: false };
    cache = { at: now.getTime(), state };
    return state;
  }
  const windowStart = new Date(now.getTime() - t.killSwitchDays * 86_400_000);
  const since = latest?.action === DIALOGUE_KILL_SWITCH_RESOLVED && new Date(latest.created_at) > windowStart ? new Date(latest.created_at) : windowStart;
  const outcomes = await readCalibrationOutcomes(since);
  if (outcomes === null) return { rollback: false, trippedAt: null, degraded: true };
  const verdict = evaluateDialogueKillSwitch(outcomes.rows, t);
  let state: DialogueKillSwitchState = { rollback: false, trippedAt: null, degraded: false };
  if (verdict.tripped) {
    const written = await insertAuditLog(null, DIALOGUE_KILL_SWITCH_TRIGGERED, 'tutor', {
      component: 'dialogue_calibration',
      regressions: verdict.regressions,
      since: since.toISOString(),
    });
    if (!written) console.warn('[tutor] dialogue-calibration kill switch tripped but its audit row did NOT land');
    console.warn('[tutor] dialogue-calibration kill switch TRIPPED: every new session runs the control register');
    state = { rollback: true, trippedAt: now.toISOString(), degraded: false };
  }
  cache = { at: now.getTime(), state };
  return state;
}

export async function resolveDialogueKillSwitch(note: string): Promise<boolean> {
  resetDialogueKillSwitchCache();
  return insertAuditLog(null, DIALOGUE_KILL_SWITCH_RESOLVED, 'tutor', { component: 'dialogue_calibration', note: note.slice(0, 500) });
}
