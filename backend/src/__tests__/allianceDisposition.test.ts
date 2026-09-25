import { describe, expect, it } from 'vitest';
import {
  AllianceReportBody,
  allianceKillSwitchLog,
  ALLIANCE_KILL_SWITCH_RESOLVED,
  ALLIANCE_KILL_SWITCH_TRIGGERED,
  evaluateAllianceKillSwitch,
  SelfExplanationReportBody,
  summarizeBondProxy,
  summarizeCompleteness,
  summarizeGoalAgreement,
  summarizeRenegotiation,
  summarizeSelfExplanation,
  type AllianceSessionRow,
} from '../services/pedagogy/alliance.js';
import {
  decideContinuity,
  deriveTraits,
  DispositionObservationBody,
  emptyProfile,
  explainProfile,
  foldBondProxy,
  foldSession,
  persistentlyDeclined,
  toOracleProjection,
  type DispositionObservation,
  type SessionFacts,
} from '../services/pedagogy/disposition.js';

/*
 * The pure halves of Core's C.15 / C.14 / C.7 work, without a database:
 * the disposition fold and its traits, the continuity decision, the Appendix F
 * summaries and the Stage 7 kill-switch condition.
 */

const USER = '11111111-1111-4111-8111-111111111111';
const NOW = '2026-09-25T12:00:00.000Z';

const observation = (extra: Partial<DispositionObservation> = {}): DispositionObservation => ({
  learnerTurns: 10,
  hintRequests: 1,
  tellRequests: 0,
  typedReplyMs: 5000,
  spokenReplyMs: null,
  acceptedAdaptations: [],
  declinedAdaptations: [],
  profileReceived: false,
  applied: [],
  ...extra,
});
const facts = (extra: Partial<SessionFacts> = {}): SessionFacts => ({
  character: 'rho',
  closeReason: 'completed',
  endedAt: NOW,
  disengagementFired: false,
  checkInMisaligned: null,
  selfExplanationPrompts: 0,
  selfExplanationFirstPass: 0,
  ...extra,
});

describe('C.7 the disposition fold', () => {
  it('starts from nothing and needs three behavioural sessions before any trait leaves unknown', () => {
    let row = emptyProfile(USER, NOW);
    for (let i = 0; i < 2; i += 1) row = foldSession(row, observation({ tellRequests: 4 }), facts(), NOW);
    expect(row).toMatchObject({ sessions_observed: 2, behavior_sessions: 2, help_style: 'unknown', persistence: 'unknown' });
    row = foldSession(row, observation({ tellRequests: 4 }), facts(), NOW);
    expect(row.help_style).toBe('tell_early');
    expect(row.persistence).toBe('persists');
  });

  it('EWMA moves toward the newest session (alpha 0.3) and the reply pace follows the median', () => {
    let row = foldSession(emptyProfile(USER, NOW), observation({ hintRequests: 5 }), facts(), NOW);
    expect(Number(row.hint_rate)).toBeCloseTo(0.5, 3);
    row = foldSession(row, observation({ hintRequests: 0, typedReplyMs: 15000 }), facts(), NOW);
    expect(Number(row.hint_rate)).toBeCloseTo(0.35, 3);
    expect(row.typed_reply_ms).toBe(8000);
  });

  it('silent dropouts and disengagement firings make an early disengager; a safety stop never counts', () => {
    let row = emptyProfile(USER, NOW);
    for (const reason of ['learner_left', 'learner_left', 'abandoned']) row = foldSession(row, observation(), facts({ closeReason: reason }), NOW);
    expect(row.persistence).toBe('disengages_early');
    const before = { ...row };
    row = foldSession(row, observation({ tellRequests: 10, hintRequests: 0, declinedAdaptations: ['less_text'] }), facts({ closeReason: 'safety_stop', character: 'zara' }), NOW);
    expect(row.behavior_sessions).toBe(before.behavior_sessions);
    expect(row.tell_rate).toBe(before.tell_rate);
    expect(row.left_rate).toBe(before.left_rate);
    expect(row.adaptation_history).toEqual(before.adaptation_history);
    // …but the persona rapport still moves: Zara is not "new" next time.
    expect(row.persona_rapport).toMatchObject({ zara: { sessions: 1 } });
  });

  it('self-explanation: decayed counts, and a low first-attempt pass share needs scaffolding', () => {
    let row = emptyProfile(USER, NOW);
    row = foldSession(row, observation(), facts({ selfExplanationPrompts: 3, selfExplanationFirstPass: 0 }), NOW);
    expect(row.explanation).toBe('unknown');
    row = foldSession(row, observation(), facts({ selfExplanationPrompts: 2, selfExplanationFirstPass: 1 }), NOW);
    expect(Number(row.se_prompts)).toBeCloseTo(4.7, 3);
    expect(row.explanation).toBe('needs_scaffold');
    // A pass count can never exceed the prompts, whatever arrives.
    row = foldSession(row, observation(), facts({ selfExplanationPrompts: 1, selfExplanationFirstPass: 9 }), NOW);
    expect(Number(row.se_first_pass)).toBeLessThanOrEqual(Number(row.se_prompts));
  });

  it('an adaptation declined across sessions and never taken is persistently declined; one taken is not', () => {
    let row = emptyProfile(USER, NOW);
    row = foldSession(row, observation({ declinedAdaptations: ['less_text', 'more_visual'] }), facts(), NOW);
    row = foldSession(row, observation({ declinedAdaptations: ['less_text'], acceptedAdaptations: ['more_visual'] }), facts(), NOW);
    row = foldSession(row, observation({ declinedAdaptations: ['less_text', 'more_visual'] }), facts(), NOW);
    expect(persistentlyDeclined(row)).toEqual(['less_text']);
  });

  it('the bond proxy folds into the persona rapport; the projection carries closed labels and numbers only', () => {
    let row = foldSession(emptyProfile(USER, NOW), observation(), facts({ character: 'liruf' }), NOW);
    row = foldBondProxy(row, 'liruf', 'partly', NOW);
    row = foldBondProxy(row, 'liruf', 'yes', NOW);
    expect(row.persona_rapport).toMatchObject({ liruf: { sessions: 1, bondAnswered: 2, bondYes: 1.5 } });
    const projection = toOracleProjection(row);
    expect(Object.keys(projection).sort()).toEqual(
      ['explanation', 'helpStyle', 'persistence', 'persistentlyDeclined', 'sessionsObserved', 'typicalSpokenReplyMs', 'typicalTypedReplyMs'].sort(),
    );
    expect(JSON.stringify(projection)).not.toMatch(/frustrat|bored|angry|sad|anxious|emotion|mood|user_id/i);
  });

  it('traits are pure functions of the stored rates', () => {
    const base = { ...emptyProfile(USER, NOW), behavior_sessions: 5 };
    expect(deriveTraits({ ...base, hint_rate: '0.30', tell_rate: '0.05' }).help_style).toBe('hint_seeking');
    expect(deriveTraits({ ...base, hint_rate: '0.05', tell_rate: '0.05' }).help_style).toBe('independent');
    expect(deriveTraits({ ...base, disengagement_rate: '0.6' }).persistence).toBe('disengages_early');
    expect(deriveTraits({ ...base, se_prompts: '6', se_first_pass: '4' }).explanation).toBe('explains');
  });

  it('the observation body is strict and bounded', () => {
    expect(DispositionObservationBody.safeParse(observation()).success).toBe(true);
    expect(DispositionObservationBody.safeParse({ ...observation(), mood: 'sad' }).success).toBe(false);
    expect(DispositionObservationBody.safeParse(observation({ hintRequests: 11 })).success).toBe(false);
    expect(DispositionObservationBody.safeParse({ ...observation(), declinedAdaptations: ['go_faster'] }).success).toBe(false);
  });

  it('explains a profile to a parent, and flags a stale one as not current', () => {
    expect(explainProfile(null)).toMatchObject({ exists: false, current: false, helpStyle: 'unknown', effects: [] });
    const row = { ...foldSession(emptyProfile(USER, NOW), observation(), facts(), NOW), updated_at: '2026-07-01T00:00:00Z' };
    expect(explainProfile(row, new Date(NOW))).toMatchObject({ exists: true, current: false, typicalReplySeconds: 5 });
  });
});

describe('C.15 continuity: has this persona worked with this learner?', () => {
  const now = new Date(NOW);
  const rapport = (character: string, daysAgo: number) => ({
    ...emptyProfile(USER, NOW),
    persona_rapport: { [character]: { sessions: 2, lastAt: new Date(now.getTime() - daysAgo * 86_400_000).toISOString(), bondYes: 0, bondAnswered: 0 } },
  });
  it('first meeting, persona switch, memory gap, continuing', () => {
    expect(decideContinuity(null, [], 'rho', now)).toBe('first_meeting');
    expect(decideContinuity(rapport('liruf', 2), [], 'rho', now)).toBe('persona_switch');
    expect(decideContinuity(rapport('rho', 45), [], 'rho', now)).toBe('memory_gap');
    expect(decideContinuity(rapport('rho', 2), [], 'rho', now)).toBe('continuing');
  });
  it('recent session rows fill in for a learner closed before the profile existed; an open session is ignored', () => {
    expect(decideContinuity(null, [{ character: 'rho', ended_at: new Date(now.getTime() - 86_400_000).toISOString() }], 'rho', now)).toBe('continuing');
    expect(decideContinuity(null, [{ character: 'rho', ended_at: null }], 'rho', now)).toBe('first_meeting');
    // The more recent of the two sources wins.
    expect(decideContinuity(rapport('rho', 60), [{ character: 'rho', ended_at: new Date(now.getTime() - 86_400_000).toISOString() }], 'rho', now)).toBe('continuing');
  });
});

describe('the Appendix F summaries', () => {
  const session = (extra: Partial<AllianceSessionRow> = {}): AllianceSessionRow => ({
    character: 'rho',
    mode: 'act',
    continuity: 'continuing',
    continuity_move: 'not_needed',
    goal_agreement: 'agreed',
    learner_turns: 6,
    adaptation_offers: 0,
    adaptation_declines: 0,
    bond_specific_turns: 1,
    bond_generic_turns: 1,
    bond_proxy: null,
    bond_proxy_at: null,
    created_at: NOW,
    ...extra,
  });

  it('Goal-Agreement Completion: sessions under the turn floor do not count; below 95% with enough sessions is a defect', () => {
    const rows = [
      ...Array.from({ length: 45 }, () => session()),
      ...Array.from({ length: 5 }, () => session({ goal_agreement: 'unconfirmed' })),
      session({ goal_agreement: 'not_reached', learner_turns: 1 }),
    ];
    const summary = summarizeGoalAgreement(rows);
    expect(summary).toMatchObject({ eligible: 50, agreed: 45, status: 'defect' });
    expect(summarizeGoalAgreement(rows.slice(0, 10)).status).toBe('insufficient_data');
    expect(summarizeGoalAgreement(Array.from({ length: 50 }, () => session({ goal_agreement: 'renegotiated' }))).status).toBe('ok');
  });

  it('Renegotiation Trigger Rate: superseded and session-ended patterns are not opportunities', () => {
    const s = summarizeRenegotiation([
      { character: 'rho', mode: 'act', outcome: 'answered', improved: true, created_at: NOW },
      { character: 'rho', mode: 'act', outcome: 'undelivered', improved: null, created_at: NOW },
      { character: 'rho', mode: 'act', outcome: 'superseded', improved: null, created_at: NOW },
      { character: 'rho', mode: 'shadow', outcome: 'shadow', improved: null, created_at: NOW },
    ]);
    expect(s).toMatchObject({ patterns: 2, delivered: 1, rate: 0.5, improved: 1, shadow: 1, status: 'diagnostic' });
  });

  it('Bond Proxy per persona and the specific-praise share', () => {
    const b = summarizeBondProxy([
      session({ bond_proxy: 'yes', bond_proxy_at: NOW }),
      session({ bond_proxy: 'no', bond_proxy_at: NOW }),
      session({ character: 'zara', bond_proxy: 'partly', bond_proxy_at: NOW, bond_specific_turns: 3, bond_generic_turns: 0 }),
    ]);
    expect(b.rho).toMatchObject({ answered: 2, score: 0.5, specificShare: 0.5 });
    expect(b.zara).toMatchObject({ answered: 1, score: 0.5, specificShare: 1 });
  });

  it('Self-Explanation Pass Rate counts answered act prompts only', () => {
    const s = summarizeSelfExplanation([
      { character: 'rho', family: 'saving', mode: 'act', first_quality: 'concept', outcome: 'passed_first' },
      { character: 'rho', family: 'saving', mode: 'act', first_quality: 'filler', outcome: 'passed_followup' },
      { character: 'rho', family: 'budget', mode: 'act', first_quality: 'unanswered', outcome: 'unanswered' },
      { character: 'rho', family: 'budget', mode: 'act', first_quality: 'help', outcome: 'skipped_help' },
      { character: 'rho', family: 'budget', mode: 'shadow', first_quality: null, outcome: 'shadow' },
    ]);
    expect(s).toMatchObject({ prompts: 2, firstPass: 1, rate: 0.5, shadow: 1, byFamily: { saving: { prompts: 2, firstPass: 1 } } });
  });

  it('Disposition-Profile Completeness', () => {
    expect(summarizeCompleteness(10, 7)).toMatchObject({ rate: 0.7, status: 'diagnostic' });
    expect(summarizeCompleteness(0, 0).rate).toBeNull();
  });

  it('the report bodies refuse emotion labels, learner words and inconsistent counts', () => {
    const ok = {
      mode: 'act',
      continuity: null,
      continuityMove: 'unknown',
      goalAgreement: 'not_reached',
      goalSettledAtTurn: null,
      learnerTurns: 0,
      adaptationOffers: 0,
      adaptationAccepts: 0,
      adaptationDeclines: 0,
      bondSpecificTurns: 0,
      bondGenericTurns: 0,
      renegotiations: [],
    };
    expect(AllianceReportBody.safeParse(ok).success).toBe(true);
    expect(AllianceReportBody.safeParse({ ...ok, mood: 'happy' }).success).toBe(false);
    expect(AllianceReportBody.safeParse({ ...ok, goalAgreement: 'agreed' }).success).toBe(false);
    expect(SelfExplanationReportBody.safeParse({ mode: 'act', prompts: 0, events: [] }).success).toBe(true);
    expect(
      SelfExplanationReportBody.safeParse({
        mode: 'act',
        prompts: 1,
        events: [{ observation: 1, source: 'activity', family: 'saving', variant: 'why', mode: 'act', firstQuality: 'concept', followupQuality: null, outcome: 'passed_first', reply: 'porque si' }],
      }).success,
    ).toBe(false);
  });
});

describe('Stage 7: the Alliance Controller kill-switch condition', () => {
  const now = new Date(NOW);
  const at = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86_400_000).toISOString();
  const answers = (character: string, n: number, answer: string, daysAgo: (i: number) => number) =>
    Array.from({ length: n }, (_, i) => ({ character, bond_proxy: answer, bond_proxy_at: at(daysAgo(i)) }));

  it('trips on a persona more than 15% below its own baseline, and names only that persona', () => {
    const v = evaluateAllianceKillSwitch(
      [...answers('liruf', 60, 'yes', (i) => 20 + (i % 60)), ...answers('liruf', 30, 'partly', (i) => 1 + (i % 10)), ...answers('rho', 60, 'yes', (i) => 20 + (i % 60)), ...answers('rho', 30, 'yes', (i) => 1 + (i % 10))],
      [],
      now,
    );
    expect(v.tripped).toBe(true);
    expect(v.causes).toEqual(['bond_proxy_drop']);
    expect(v.droppedPersonas.map((p) => p.character)).toEqual(['liruf']);
  });

  it('a drop within 15%, or a thin sample, is not a trip', () => {
    expect(evaluateAllianceKillSwitch([...answers('liruf', 60, 'yes', (i) => 20 + i), ...answers('liruf', 30, 'yes', () => 1), ...answers('liruf', 3, 'partly', () => 2)], [], now).tripped).toBe(false);
    expect(evaluateAllianceKillSwitch([...answers('liruf', 10, 'yes', (i) => 20 + i), ...answers('liruf', 30, 'no', () => 1)], [], now).tripped).toBe(false);
  });

  it('trips when the latest 50 renegotiations mostly did not improve the session; fewer than 50 is not evidence', () => {
    const poor = Array.from({ length: 50 }, (_, i) => ({ improved: i < 10 }));
    expect(evaluateAllianceKillSwitch([], poor, now)).toMatchObject({ tripped: true, causes: ['renegotiation_without_improvement'], renegotiationImprovedShare: 0.2 });
    expect(evaluateAllianceKillSwitch([], poor.slice(0, 49), now).tripped).toBe(false);
    expect(evaluateAllianceKillSwitch([], Array.from({ length: 50 }, () => ({ improved: true })), now).tripped).toBe(false);
  });

  it('pairs triggers and resolutions into the Kill-Switch Trigger Log', () => {
    const log = allianceKillSwitchLog([
      { action: ALLIANCE_KILL_SWITCH_TRIGGERED, created_at: '2026-09-01T00:00:00Z', detail: { causes: ['bond_proxy_drop'] } },
      { action: ALLIANCE_KILL_SWITCH_RESOLVED, created_at: '2026-09-01T06:00:00Z', detail: {} },
      { action: ALLIANCE_KILL_SWITCH_TRIGGERED, created_at: '2026-09-10T00:00:00Z', detail: { causes: ['renegotiation_without_improvement'] } },
    ]);
    expect(log).toEqual([
      { triggeredAt: '2026-09-01T00:00:00Z', causes: ['bond_proxy_drop'], resolvedAt: '2026-09-01T06:00:00Z', resolutionHours: 6 },
      { triggeredAt: '2026-09-10T00:00:00Z', causes: ['renegotiation_without_improvement'], resolvedAt: null, resolutionHours: null },
    ]);
  });
});
