import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse } from './helpers.js';
import { newCard, reviewCard, reviewCardTwoTier } from '../services/pedagogy/fsrs.js';
import {
  drawAuditSample,
  evaluateRoutingCompliance,
  evaluateSpacedReviewKillSwitch,
  handoffKcIds,
  routeWrongAnswer,
  SPACED_REVIEW_OPERATIONS,
  SpacedReviewReportBody,
  spacedReviewKillSwitchLog,
  summarizeRouting,
  type RoutingRow,
  type SpacedReviewReport,
} from '../services/pedagogy/spacedReview.js';
import {
  bondDifference,
  dialogueBandFor,
  DialogueCalibrationReportBody,
  evaluateDialogueKillSwitch,
  resolveDialogueCalibration,
  summarizeCalibrationExperiment,
  summarizeControllingLanguage,
  summarizeObservational,
  verdictFor,
  type CalibrationOutcomeRow,
} from '../services/pedagogy/dialogueCalibration.js';

/*
 * C.11 / C.17 — Core's pure halves: the scheduler's short horizon, the
 * routing audit and its Stage 7 verdict, the dialogue band, the OD-23-gated
 * experiment assignment, the A/B outcome statistics and the C.17 rollback.
 */

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const KC = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const KC2 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
const USER = '11111111-1111-4111-8111-111111111111';

describe('fsrs — the two tiers seen from the cross-session scheduler', () => {
  const H = 180 * 60_000;
  const t0 = new Date('2026-09-25T10:00:00Z');
  const at = (minutes: number) => new Date(t0.getTime() + minutes * 60_000);
  const reviewed = reviewCard(newCard(t0), 'good', t0); // state review, stability 3, lastReviewAt t0

  it('a first attempt, and any attempt after the horizon, is a spaced review', () => {
    expect(reviewCardTwoTier(newCard(t0), 'good', t0, H).tier).toBe('spaced');
    const later = reviewCardTwoTier(reviewed, 'good', at(181), H);
    expect(later.tier).toBe('spaced');
    expect(later.card.stability).toBeGreaterThan(reviewed.stability);
  });

  it('massed successes inside the horizon never grow the interval', () => {
    let card = reviewed;
    for (const m of [5, 10, 15, 20]) {
      const r = reviewCardTwoTier(card, 'easy', at(m), H);
      expect(r.tier).toBe('short_horizon');
      card = r.card;
    }
    expect(card).toEqual(reviewed);
  });

  it('a lapse after a counted success is real forgetting; a second lapse in the window does not compound', () => {
    const lapse = reviewCardTwoTier(reviewed, 'again', at(10), H);
    expect(lapse.tier).toBe('spaced');
    expect(lapse.card.state).toBe('relearning');
    const again = reviewCardTwoTier(lapse.card, 'again', at(15), H);
    expect(again.tier).toBe('short_horizon');
    expect(again.card).toEqual(lapse.card);
  });

  it('a horizon of 0 is the pre-C.11 behaviour: every attempt is a review', () => {
    expect(reviewCardTwoTier(reviewed, 'good', at(1), 0)).toEqual({ card: reviewCard(reviewed, 'good', at(1)), tier: 'spaced' });
  });
});

// ── C.11 audit ──────────────────────────────────────────────────────────────

const decision = (extra: Record<string, unknown> = {}) => ({
  observation: 1,
  kcId: KC,
  tier: 'within_session',
  reason: 'near_threshold',
  source: 'first_miss',
  pBefore: 0.8,
  pAfter: 0.45,
  turnsRemaining: 60,
  msUntilWrap: 600_000,
  budgetState: 'running',
  planned: true,
  reexposuresBefore: 0,
  queuedBefore: 0,
  atTurn: 3,
  outcome: 'retired',
  successes: 2,
  failures: 1,
  ...extra,
});
const report = (decisions: unknown[], extra: Record<string, unknown> = {}) => ({
  mode: 'act',
  ruleVersion: 'c11.v1',
  learnerTurns: 12,
  detoursOpened: 1,
  overflow: 0,
  decisions,
  ...extra,
});

describe('the C.11 close body is strict', () => {
  it('accepts a well-formed report', () => {
    expect(SpacedReviewReportBody.safeParse(report([decision()])).success).toBe(true);
  });

  it.each([
    ['learner text', report([decision({ text: 'I hate this' })])],
    ['an emotion label', report([decision()], { emotion: 'frustrated' })],
    ['a user id', report([decision({ userId: USER })])],
    ['a within-session decision with a cross-session reason', report([decision({ reason: 'time_budget' })])],
    ['a cross-session decision that was "retired"', report([decision({ tier: 'cross_session', reason: 'time_budget', outcome: 'retired' })])],
    ['a within-session decision "handed_off"', report([decision({ outcome: 'handed_off' })])],
    ['retired without a spaced success', report([decision({ successes: 0 })])],
    ['a shadow router that opened a re-check', report([decision({ outcome: 'session_ended', successes: 0 })], { mode: 'shadow' })],
    ['a non-catalog KC id', report([decision({ kcId: 'kc-a' })])],
    ['a duplicate observation', report([decision(), decision()])],
    ['an unknown reason', report([decision({ tier: 'cross_session', reason: 'bored', outcome: 'handed_off' })])],
  ])('refuses %s', (_name, body) => {
    expect(SpacedReviewReportBody.safeParse(body).success).toBe(false);
  });
});

describe('the hand-off to the cross-session scheduler', () => {
  it('hands off what the session did not retire, by each KC’s final decision, in act mode only', () => {
    const r = SpacedReviewReportBody.parse(
      report([
        decision({ observation: 1, kcId: KC, outcome: 'rerouted', successes: 0, failures: 1 }),
        decision({ observation: 2, kcId: KC, tier: 'cross_session', reason: 'time_budget', source: 'reexposure_miss', outcome: 'handed_off' }),
        decision({ observation: 3, kcId: KC2, outcome: 'retired' }),
      ]),
    ) as SpacedReviewReport;
    expect(handoffKcIds(r)).toEqual([KC]);
    expect(handoffKcIds({ ...r, mode: 'shadow', detoursOpened: 0 })).toEqual([]);
    const ended = SpacedReviewReportBody.parse(report([decision({ outcome: 'session_ended', successes: 1 })])) as SpacedReviewReport;
    expect(handoffKcIds(ended)).toEqual([KC]);
  });
});

const row = (extra: Partial<RoutingRow> = {}): RoutingRow => ({
  session_id: '33333333-3333-4333-8333-333333333333',
  mode: 'act',
  rule_version: 'c11.v1',
  observation: 1,
  kc_id: KC,
  tier: 'within_session',
  reason: 'near_threshold',
  source: 'first_miss',
  outcome: 'retired',
  created_at: '2026-09-25T10:00:00Z',
  planned: true,
  p_before: 0.8,
  turns_remaining: 60,
  ms_until_wrap: 600_000,
  budget_state: 'running',
  reexposures_before: 0,
  queued_before: 0,
  ...extra,
});

describe('Spaced-Review Routing Accuracy — every decision re-evaluated from its recorded inputs', () => {
  it('the mirrored rule reproduces the recorded decision', () => {
    expect(routeWrongAnswer(row())).toEqual({ tier: 'within_session', reason: 'near_threshold' });
    expect(evaluateRoutingCompliance([row(), row({ tier: 'cross_session', reason: 'time_budget', ms_until_wrap: 1000, outcome: 'handed_off' })])).toMatchObject({
      evaluated: 2,
      mismatches: [],
      rate: 1,
    });
  });

  it('a decision the rule does not reproduce is a counted misroute, and the report calls it a defect', () => {
    const misrouted = row({ observation: 2, p_before: 0.2 }); // kept in-session while far below the threshold
    const compliance = evaluateRoutingCompliance([row(), misrouted]);
    expect(compliance.mismatches).toEqual([
      expect.objectContaining({ observation: 2, recorded: 'within_session/near_threshold', rule: 'cross_session/far_from_threshold' }),
    ]);
    const summary = summarizeRouting(Array.from({ length: 40 }, (_, i) => row({ observation: i + 1 })).concat(misrouted));
    expect(summary.status).toBe('defect');
    expect(summary.findings[0]).toMatch(/misroute/);
  });

  it('a systematic failure to deliver re-checks is a misrouting pattern', () => {
    const rows = Array.from({ length: 40 }, (_, i) => row({ observation: i + 1, outcome: i < 30 ? 'session_ended' : 'retired' }));
    const summary = summarizeRouting(rows);
    expect(summary.undeliveredShare).toBe(0.75);
    expect(summary.findings.some((f) => /systematically misrouting/.test(f))).toBe(true);
  });

  it('thin data is insufficient, never healthy', () => {
    expect(summarizeRouting([row()]).status).toBe('insufficient_data');
  });

  it('the quarterly sample is reproducible, stratified across both tiers, and bounded', () => {
    const rows = [
      ...Array.from({ length: 30 }, (_, i) => row({ observation: i + 1 })),
      ...Array.from({ length: 30 }, (_, i) => row({ observation: 100 + i, tier: 'cross_session', reason: 'time_budget', ms_until_wrap: 0, outcome: 'handed_off' })),
    ];
    const a = drawAuditSample(rows, 10, '2026-Q3');
    expect(a).toEqual(drawAuditSample(rows, 10, '2026-Q3'));
    expect(a).toHaveLength(10);
    expect(new Set(a.map((r) => r.tier))).toEqual(new Set(['within_session', 'cross_session']));
    expect(drawAuditSample(rows, 10, '2026-Q4')).not.toEqual(a);
  });
});

describe('the C.11 Stage 7 verdict', () => {
  it('trips on any recorded decision the rule does not reproduce', () => {
    const verdict = evaluateSpacedReviewKillSwitch([row(), row({ observation: 2, p_before: 0.1 })]);
    expect(verdict).toMatchObject({ tripped: true, causes: ['rule_mismatch'], mismatches: 1 });
  });

  it('trips when most within-session routings never get their re-check (with a full sample only)', () => {
    const undelivered = Array.from({ length: SPACED_REVIEW_OPERATIONS.deliverySample }, (_, i) =>
      row({ observation: i + 1, outcome: i % 4 === 0 ? 'retired' : 'session_ended' }),
    );
    expect(evaluateSpacedReviewKillSwitch(undelivered)).toMatchObject({ tripped: true, causes: ['reexposure_not_delivered'] });
    expect(evaluateSpacedReviewKillSwitch(undelivered.slice(0, 50))).toMatchObject({ tripped: false, undeliveredShare: null });
  });

  it('healthy routing does not trip; the trigger log pairs trips with resolutions', () => {
    expect(evaluateSpacedReviewKillSwitch([row()]).tripped).toBe(false);
    const log = spacedReviewKillSwitchLog([
      { action: 'mentor.kill_switch.spaced_review.triggered', created_at: '2026-09-01T00:00:00Z', detail: { causes: ['rule_mismatch'] } },
      { action: 'mentor.kill_switch.spaced_review.resolved', created_at: '2026-09-01T06:00:00Z', detail: null },
    ]);
    expect(log).toEqual([{ triggeredAt: '2026-09-01T00:00:00Z', causes: ['rule_mismatch'], resolvedAt: '2026-09-01T06:00:00Z', resolutionHours: 6 }]);
  });
});

// ── C.17 ────────────────────────────────────────────────────────────────────

const screen = (ageBand: 'under_13' | '13_to_17' | 'adult' | null, protectedOrigin = false) => ({
  required: ageBand === null,
  ageBand,
  protectedOrigin,
});
const NOW = new Date('2026-09-25T12:00:00Z');

describe('the dialogue band — Core’s own evidence, in the teaching tier’s precedence', () => {
  it.each([
    ['a parent-created 8-year-old', '2018-03-01', screen('under_13', true), 2, 'young_child', 8],
    ['a parent-created 11-year-old', '2015-01-10', screen('under_13', true), 3, 'tween', 11],
    ['a parent-created 14-year-old', '2012-05-01', screen('under_13', true), 3, 'teen', 14],
    ['an independent teen (declared, no date)', null, screen('13_to_17'), 3, 'teen', null],
    ['an independent teen with an agreeing date', '2011-01-01', screen('13_to_17'), 3, 'teen', 15],
    ['an adult (declared)', null, screen('adult'), 3, 'adult', null],
    ['an adult with a date', '1990-06-01', screen('adult'), 3, 'adult', 36],
    ['a declared teen with a stale child date: the declaration wins, the age is withheld', '2020-01-01', screen('13_to_17'), 3, 'teen', null],
    ['a calibrated tier-3 child without a date', null, screen('under_13', true), 3, 'tween', null],
    ['a calibrated tier-1 child without a date', null, screen('under_13', true), 1, 'young_child', null],
    ['a protected account declaring adult is not an adult', null, screen('adult', true), 3, 'tween', null],
  ] as const)('%s', (_name, birthDate, screening, tier, band, age) => {
    expect(dialogueBandFor({ birthDate, screening, tier, now: NOW })).toEqual({ band, age });
  });
});

describe('the variant — the C.17 experiment (OD-23 narrowed by OD-26), consent-gated, never a guess', () => {
  const ASSIGN = 'http://localhost:4008/api/v1/intel/runtime/experiments/assignments';
  const EXPOSE = 'http://localhost:4008/api/v1/intel/runtime/experiments/exposure';
  const EXP = '44444444-4444-4444-8444-444444444444';
  function runtime(opts: { assignments?: unknown; exposure?: unknown; consent?: boolean; teenPref?: boolean } = {}) {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        calls.push(url);
        if (url.startsWith(ASSIGN)) {
          return opts.assignments === 'fail'
            ? new Response(null, { status: 502 })
            : jsonResponse(200, { data: { assignments: opts.assignments ?? [] }, error: null });
        }
        if (url.startsWith(EXPOSE)) {
          return opts.exposure === 'fail'
            ? new Response(null, { status: 404 })
            : jsonResponse(200, { data: { assignment: opts.exposure }, error: null });
        }
        if (url.includes('/rest/v1/analytics_consents')) {
          return jsonResponse(200, opts.consent ? [{ kid_user_id: USER, granted_at: '2026-01-01T00:00:00Z', revoked_at: null }] : []);
        }
        if (url.includes('/rest/v1/teen_analytics_preferences')) {
          return jsonResponse(200, opts.teenPref === undefined ? [] : [{ enabled: opts.teenPref, disclosure_version: 1 }]);
        }
        return jsonResponse(200, []);
      }),
    );
    return calls;
  }
  const base = { userId: USER, age: null, eligibleBands: ['adult'] as const, rollback: false };

  it('with the bands narrowed to adults, every minor is outside the experiment: the calibrated register, no runtime call', async () => {
    for (const [band, roles, screening] of [
      ['young_child', ['kid'], screen('under_13', true)],
      ['tween', ['kid'], screen('under_13', true)],
      ['teen', ['universal'], screen('13_to_17')],
    ] as const) {
      const calls = runtime({ assignments: [{ experimentId: EXP, variant: 'A', surface: 'tutor', target: 'mentor.dialogue-register' }] });
      expect(await resolveDialogueCalibration({ ...base, band, roles, screening })).toEqual({ band, variant: 'calibrated', assignment: 'not_eligible', experimentId: null });
      expect(calls.some((u) => u.startsWith(ASSIGN))).toBe(false);
    }
  });

  it('an enrolled adult gets the assigned arm, and the exposure is recorded before it applies', async () => {
    const calls = runtime({
      assignments: [{ experimentId: EXP, variant: 'A', surface: 'tutor', target: 'mentor.dialogue-register' }],
      exposure: { experimentId: EXP, variant: 'A', surface: 'tutor', target: 'mentor.dialogue-register' },
    });
    expect(await resolveDialogueCalibration({ ...base, band: 'adult', roles: ['universal'], screening: screen('adult') })).toEqual({
      band: 'adult',
      variant: 'control',
      assignment: 'experiment',
      experimentId: EXP,
    });
    expect(calls.filter((u) => u.startsWith(ASSIGN) || u.startsWith(EXPOSE))).toEqual([ASSIGN, EXPOSE]);
    runtime({
      assignments: [{ experimentId: EXP, variant: 'B', surface: 'tutor', target: 'mentor.dialogue-register' }],
      exposure: { experimentId: EXP, variant: 'B', surface: 'tutor', target: 'mentor.dialogue-register' },
    });
    expect((await resolveDialogueCalibration({ ...base, band: 'adult', roles: ['universal'], screening: screen('adult') })).variant).toBe('calibrated');
  });

  it('no running experiment, a failed runtime or a failed exposure is the calibrated default with the reason', async () => {
    runtime({ assignments: [] });
    expect((await resolveDialogueCalibration({ ...base, band: 'adult', roles: ['universal'], screening: screen('adult') })).assignment).toBe('no_experiment');
    runtime({ assignments: 'fail' });
    expect(await resolveDialogueCalibration({ ...base, band: 'adult', roles: ['universal'], screening: screen('adult') })).toMatchObject({
      variant: 'calibrated',
      assignment: 'runtime_unavailable',
    });
    runtime({ assignments: [{ experimentId: EXP, variant: 'A', surface: 'tutor', target: 'mentor.dialogue-register' }], exposure: 'fail' });
    expect(await resolveDialogueCalibration({ ...base, band: 'adult', roles: ['universal'], screening: screen('adult') })).toMatchObject({
      variant: 'calibrated',
      assignment: 'runtime_unavailable',
    });
  });

  /*
   * OD-26 (owner review M-12): C.17 may enrol teens 13-17 with their own
   * analytics opt-in and tweens 10-12 with a verified guardian's analytics
   * consent; children 6-9 never, whatever the configuration lists.
   */
  const opened = { ...base, eligibleBands: ['young_child', 'tween', 'teen', 'adult'] as const };
  const armed = { assignments: [{ experimentId: EXP, variant: 'B', surface: 'tutor', target: 'mentor.dialogue-register' }], exposure: { experimentId: EXP, variant: 'B', surface: 'tutor', target: 'mentor.dialogue-register' } };

  it('OD-26: a young child is never enrolled, even listed and with the guardian consenting, and the runtime is not asked', async () => {
    for (const age of [null, 7, 9]) {
      const calls = runtime({ ...armed, consent: true });
      expect(await resolveDialogueCalibration({ ...opened, age, band: 'young_child', roles: ['kid'], screening: screen('under_13', true) })).toEqual({
        band: 'young_child', variant: 'calibrated', assignment: 'not_eligible', experimentId: null,
      });
      expect(calls.some((u) => u.startsWith(ASSIGN) || u.startsWith(EXPOSE))).toBe(false);
    }
  });

  it('OD-26: a tween is enrolled only on an exact age of 10 to 12 and with the guardian consent', async () => {
    const tween = { ...opened, band: 'tween' as const, roles: ['kid'], screening: screen('under_13', true) };
    // A tier guess (no birth date) could be a younger child; an age outside 10-12 is never a tween here.
    for (const age of [null, 9, 13]) {
      const calls = runtime({ ...armed, consent: true });
      expect((await resolveDialogueCalibration({ ...tween, age })).assignment).toBe('not_eligible');
      expect(calls.some((u) => u.startsWith(ASSIGN))).toBe(false);
    }
    // No guardian consent: not enrolled, even with a teen-style preference on record.
    runtime({ ...armed, consent: false, teenPref: true });
    expect((await resolveDialogueCalibration({ ...tween, age: 11 })).assignment).toBe('no_consent');
    const calls = runtime({ ...armed, consent: true });
    expect(await resolveDialogueCalibration({ ...tween, age: 11 })).toEqual({ band: 'tween', variant: 'calibrated', assignment: 'experiment', experimentId: EXP });
    expect(calls.filter((u) => u.startsWith(ASSIGN) || u.startsWith(EXPOSE))).toEqual([ASSIGN, EXPOSE]);
  });

  it("OD-26: a teen is enrolled only on the teen's own analytics opt-in; a guardian's consent alone never enrols a teen", async () => {
    const teen = { ...opened, band: 'teen' as const, roles: ['universal'], screening: screen('13_to_17') };
    for (const teenPref of [undefined, false]) {
      runtime({ ...armed, teenPref, consent: true });
      expect((await resolveDialogueCalibration(teen)).assignment).toBe('no_consent');
    }
    runtime({ ...armed, teenPref: true });
    expect((await resolveDialogueCalibration(teen)).assignment).toBe('experiment');
    // A parent-created teen needs both their own opt-in and the guardian's consent.
    const kidTeen = { ...teen, roles: ['kid'] };
    runtime({ ...armed, teenPref: false, consent: true });
    expect((await resolveDialogueCalibration(kidTeen)).assignment).toBe('no_consent');
    runtime({ ...armed, teenPref: true, consent: false });
    expect((await resolveDialogueCalibration(kidTeen)).assignment).toBe('no_consent');
  });

  it('OD-26: an operator can narrow the bands back to adults, and consent still gates every band', async () => {
    runtime({ ...armed, teenPref: true, consent: true });
    expect((await resolveDialogueCalibration({ ...base, band: 'teen', roles: ['universal'], screening: screen('13_to_17') })).assignment).toBe('not_eligible');
    expect((await resolveDialogueCalibration({ ...base, age: 11, band: 'tween', roles: ['kid'], screening: screen('under_13', true) })).assignment).toBe('not_eligible');
    runtime({ consent: true, assignments: [] });
    expect((await resolveDialogueCalibration({ ...opened, age: 12, band: 'tween', roles: ['kid'], screening: screen('under_13', true) })).assignment).toBe('no_experiment');
  });

  it('the Stage 7 rollback puts everyone on the control register, without asking the runtime', async () => {
    const calls = runtime();
    expect(await resolveDialogueCalibration({ ...base, band: 'teen', roles: ['universal'], screening: screen('13_to_17'), rollback: true })).toEqual({
      band: 'teen',
      variant: 'control',
      assignment: 'rollback',
      experimentId: null,
    });
    expect(calls).toEqual([]);
  });
});

const calReport = (extra: Record<string, unknown> = {}) => ({
  band: 'teen',
  variant: 'calibrated',
  assignment: 'not_eligible',
  experimentId: null,
  ladderRungs: 5,
  hintRequests: 2,
  tellRequests: 0,
  controllingCaught: 1,
  controllingDelivered: 0,
  pacingOffers: 1,
  unilateralStyleChanges: 0,
  ...extra,
});

describe('the C.17 close body is strict', () => {
  it('accepts well-formed reports', () => {
    expect(DialogueCalibrationReportBody.safeParse(calReport()).success).toBe(true);
    expect(DialogueCalibrationReportBody.safeParse(calReport({ band: 'young_child', ladderRungs: 4, controllingCaught: 0 })).success).toBe(true);
    expect(
      DialogueCalibrationReportBody.safeParse(calReport({ band: 'adult', variant: 'control', assignment: 'experiment', experimentId: '44444444-4444-4444-8444-444444444444', controllingCaught: 0, unilateralStyleChanges: 2 })).success,
    ).toBe(true);
  });

  it.each([
    ['an age', calReport({ age: 15 })],
    ['learner text', calReport({ text: 'hi' })],
    ['an unknown band', calReport({ band: 'toddler' })],
    ['an experiment id outside the experiment', calReport({ experimentId: '44444444-4444-4444-8444-444444444444' })],
    ['an enrolled session without its experiment id', calReport({ assignment: 'experiment' })],
    ['a control arm with the short ladder', calReport({ variant: 'control', ladderRungs: 4, controllingCaught: 0 })],
    ['a control arm that ran the gate', calReport({ variant: 'control' })],
    ['a young-child calibrated session with the full ladder', calReport({ band: 'young_child', controllingCaught: 0 })],
    ['more delivered than caught', calReport({ controllingDelivered: 2 })],
    ['an ask-first register that changed the approach on its own', calReport({ unilateralStyleChanges: 1 })],
  ])('refuses %s', (_name, body) => {
    expect(DialogueCalibrationReportBody.safeParse(body).success).toBe(false);
  });
});

describe('the Age-Band Calibration A/B Outcome', () => {
  const arm = (band: 'adult' | 'teen', variant: 'calibrated' | 'control', answers: ('yes' | 'partly' | 'no')[], closing: 'completed' | 'learner_left' = 'completed'): CalibrationOutcomeRow[] =>
    answers.map((a) => ({ band, variant, assignment: 'experiment', bond_proxy: a, closing_script: closing, controlling_delivered: 0 }));
  const repeat = <T,>(xs: T[], n: number) => Array.from({ length: n }, (_, i) => xs[i % xs.length]!);

  it('reports each band’s arms, the Welch interval and the verdict', () => {
    const rows = [...arm('adult', 'calibrated', repeat(['yes', 'yes', 'partly'], 60)), ...arm('adult', 'control', repeat(['yes', 'partly', 'no'], 60))];
    const [adult] = summarizeCalibrationExperiment(rows);
    expect(adult!.band).toBe('adult');
    expect(adult!.calibrated.bondMean).toBeCloseTo(0.833, 2);
    expect(adult!.control.bondMean).toBeCloseTo(0.5, 2);
    expect(adult!.bondVerdict).toBe('improvement');
    expect(adult!.bond!.low).toBeGreaterThan(0);
  });

  it('insufficient data below the per-arm floor; regression when the calibrated arm is significantly worse', () => {
    expect(summarizeCalibrationExperiment([...arm('adult', 'calibrated', ['yes']), ...arm('adult', 'control', ['yes'])])[0]!.bondVerdict).toBe('insufficient_data');
    const worse = [...arm('adult', 'calibrated', repeat(['no', 'partly', 'no'], 60)), ...arm('adult', 'control', repeat(['yes', 'yes', 'partly'], 60))];
    expect(summarizeCalibrationExperiment(worse)[0]!.bondVerdict).toBe('regression');
    expect(evaluateDialogueKillSwitch(worse)).toEqual({ tripped: true, regressions: [{ band: 'adult', outcome: 'bond_proxy' }] });
  });

  it('the closing outcome is compared too (completed versus a silent dropout), safety stops excluded', () => {
    const rows = [
      ...arm('adult', 'calibrated', repeat(['yes'], 60), 'learner_left'),
      ...arm('adult', 'control', repeat(['yes'], 60), 'completed'),
      { band: 'adult' as const, variant: 'calibrated' as const, assignment: 'experiment' as const, bond_proxy: null, closing_script: 'safety_stop' as const, controlling_delivered: 0 },
    ];
    const [adult] = summarizeCalibrationExperiment(rows);
    expect(adult!.calibrated.closings).toBe(60);
    expect(adult!.closingVerdict).toBe('regression');
  });

  it('verdicts: improvement, non-regression within the margin, inconclusive, regression', () => {
    expect(verdictFor({ diff: 0.1, low: 0.02, high: 0.18 }, 0.05)).toBe('improvement');
    expect(verdictFor({ diff: 0, low: -0.03, high: 0.03 }, 0.05)).toBe('non_regression');
    expect(verdictFor({ diff: -0.02, low: -0.09, high: 0.05 }, 0.05)).toBe('inconclusive');
    expect(verdictFor({ diff: -0.1, low: -0.15, high: -0.02 }, 0.05)).toBe('regression');
    expect(verdictFor(null, 0.05)).toBe('insufficient_data');
    expect(bondDifference({ sessions: 1, bondAnswers: 1, bondMean: 1, bondVariance: 0, closings: 0, completedShare: null }, { sessions: 1, bondAnswers: 1, bondMean: 1, bondVariance: 0, closings: 0, completedShare: null })).toBeNull();
  });

  it('sessions outside the experiment are an UNCONTROLLED view beside the pre-C.17 baseline, never mixed into the A/B', () => {
    const rows: CalibrationOutcomeRow[] = [
      ...arm('teen', 'calibrated', ['yes', 'partly']).map((r) => ({ ...r, assignment: 'not_eligible' as const })),
      { band: null, variant: null, assignment: null, bond_proxy: 'no', closing_script: 'completed', controlling_delivered: null },
    ];
    expect(summarizeCalibrationExperiment(rows)).toEqual([]);
    const observational = summarizeObservational(rows);
    expect(observational.byBand.teen!.bondMean).toBe(0.75);
    expect(observational.preC17Baseline.bondMean).toBe(0);
  });

  it('controlling language that reached a teen or adult in the calibrated register is a defect', () => {
    const rows: CalibrationOutcomeRow[] = [
      { band: 'teen', variant: 'calibrated', assignment: 'not_eligible', bond_proxy: null, closing_script: null, controlling_delivered: 1 },
      { band: 'young_child', variant: 'calibrated', assignment: 'not_eligible', bond_proxy: null, closing_script: null, controlling_delivered: 0 },
    ];
    expect(summarizeControllingLanguage(rows)).toEqual({ sessions: 1, delivered: 1, status: 'defect' });
  });
});

describe('the quarterly routing spot check cadence', () => {
  it('is not due until the router has a quarter of history; then it is overdue without a recorded audit', async () => {
    const { routingAuditCadence } = await import('../services/pedagogy/spacedReview.js');
    const now = new Date('2026-12-31T00:00:00Z');
    const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();
    expect(routingAuditCadence(null, null, now)).toEqual({ overdue: false, daysSinceAudit: null });
    expect(routingAuditCadence(null, daysAgo(30), now).overdue).toBe(false);
    expect(routingAuditCadence(null, daysAgo(120), now).overdue).toBe(true);
    expect(routingAuditCadence(daysAgo(40), daysAgo(120), now)).toEqual({ overdue: false, daysSinceAudit: 40 });
    expect(routingAuditCadence(daysAgo(110), daysAgo(400), now).overdue).toBe(true);
  });
});

describe('gap-fix round 1: the close record counts tell answers, budget and self-naming', () => {
  it('accepts the new optional counts and refuses more tell answers than tell requests', () => {
    expect(DialogueCalibrationReportBody.safeParse(calReport({ tellRequests: 2, tellDelivered: 1, tellWithdrawn: 1, budgetCaught: 3, budgetDelivered: 1, selfNamingCaught: 0, selfNamingDelivered: 0 })).success).toBe(true);
    // An Oracle that predates the counts still closes.
    expect(DialogueCalibrationReportBody.safeParse(calReport()).success).toBe(true);
    expect(DialogueCalibrationReportBody.safeParse(calReport({ tellRequests: 1, tellDelivered: 1, tellWithdrawn: 1 })).success).toBe(false);
    expect(DialogueCalibrationReportBody.safeParse(calReport({ budgetCaught: -1 })).success).toBe(false);
  });
});
