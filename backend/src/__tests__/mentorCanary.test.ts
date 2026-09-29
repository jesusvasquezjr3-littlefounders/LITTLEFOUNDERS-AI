import { afterEach, describe, expect, it, vi } from 'vitest';

/*
 * GAP-FIX-R3 (C.22, Appendix F Part 3 Stage 5): Core's half of the canary
 * delivery path, decided purely: who may be in a canary (OD-23), the pool
 * that keeps it a small share, the overrides it may carry, the sample the
 * Stage 5 reader reads, and the arm stored at close.
 */

const runtime = vi.hoisted(() => ({
  assignments: vi.fn(),
  exposure: vi.fn(),
  analytics: vi.fn(async () => true),
  rest: vi.fn(async () => ({})),
}));
vi.mock('../services/learningIntel.js', () => ({
  getExperimentAssignments: runtime.assignments,
  recordExperimentExposure: runtime.exposure,
}));
vi.mock('../services/analyticsPreference.js', () => ({ allowsSelfManagedAnalytics: runtime.analytics }));
vi.mock('../services/supabaseRest.js', () => ({ serviceRest: runtime.rest }));

const {
  canaryPoolDraw,
  drawCanarySample,
  inCanaryPool,
  recordCanaryArm,
  resolveMentorCanary,
  summarizeCanaryArms,
  validOverrides,
} = await import('../services/pedagogy/mentorCanary.js');
const { MENTOR_CANARIES, TIER2_PARAMETERS } = await import('../services/pedagogy/mentorCanaryTables.generated.js');

const USER = '11111111-1111-4111-8111-111111111111';
const IN_POOL = '55555555-5555-4555-8555-000000000001';
const OUT_OF_POOL = '55555555-5555-4555-8555-000000000000';
const ENTRY = { experimentId: IN_POOL, proposalId: 'P-2026-10-01-latency-z', share: 0.1, overrides: { 'telemetry.latencyZ': 1.7 } };
const ADULT = {
  userId: USER,
  isMinor: false,
  band: 'adult' as const,
  age: 36 as number | null,
  screening: { required: false, ageBand: 'adult' as const, protectedOrigin: false },
};
const user = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;

afterEach(() => {
  vi.clearAllMocks();
  runtime.analytics.mockImplementation(async () => true);
});

describe('the manifest and its overrides', () => {
  it('ships empty: no Tier 2 change is in canary', () => {
    expect(MENTOR_CANARIES).toEqual([]);
  });

  it('accepts only registered Tier 2 parameters, inside their bounds, integers where required', () => {
    expect(Object.keys(TIER2_PARAMETERS)).toContain('telemetry.latencyZ');
    expect(validOverrides({ 'telemetry.latencyZ': 1.7 })).toBe(true);
    expect(validOverrides({ 'telemetry.maxCheckIns': 3 })).toBe(true);
    expect(validOverrides({})).toBe(false);
    expect(validOverrides({ 'telemetry.latencyZ': 3 })).toBe(false);
    expect(validOverrides({ 'telemetry.maxCheckIns': 2.5 })).toBe(false);
    expect(validOverrides({ 'telemetry.windowSize': 5 })).toBe(false);
    expect(validOverrides({ constructor: 1 })).toBe(false);
    expect(validOverrides({ 'telemetry.latencyZ': Number.NaN })).toBe(false);
  });
});

describe('the pool keeps a canary a small share', () => {
  it('is deterministic, in [0, 1), and about twice the share across many learners', () => {
    expect(canaryPoolDraw(IN_POOL, USER)).toBe(canaryPoolDraw(IN_POOL, USER));
    let pooled = 0;
    for (let i = 0; i < 4000; i += 1) {
      const draw = canaryPoolDraw(IN_POOL, user(i));
      expect(draw).toBeGreaterThanOrEqual(0);
      expect(draw).toBeLessThan(1);
      if (inCanaryPool({ experimentId: IN_POOL, share: 0.05 }, user(i))) pooled += 1;
    }
    expect(pooled / 4000).toBeGreaterThan(0.08);
    expect(pooled / 4000).toBeLessThan(0.12);
  });

  it('never exceeds the manifest ceiling, whatever an entry claims', () => {
    let pooled = 0;
    for (let i = 0; i < 2000; i += 1) if (inCanaryPool({ experimentId: IN_POOL, share: 0.9 }, user(i))) pooled += 1;
    expect(pooled / 2000).toBeLessThan(0.23);
  });
});

describe('resolveMentorCanary (OD-23: verified adults only)', () => {
  it('a verified adult in the pool: canary arm with the overrides, after the exposure is recorded', async () => {
    runtime.assignments.mockResolvedValue([{ experimentId: IN_POOL, variant: 'B' }]);
    runtime.exposure.mockResolvedValue({ experimentId: IN_POOL, variant: 'B' });
    const r = await resolveMentorCanary({ ...ADULT, manifest: [ENTRY] });
    expect(r).toEqual({ canary: { proposalId: ENTRY.proposalId, arm: 'canary', overrides: { 'telemetry.latencyZ': 1.7 } }, assignment: 'experiment' });
    expect(runtime.assignments).toHaveBeenCalledWith({ userId: USER, surface: 'tutor', target: 'mentor.canary', age: 36 });
    expect(runtime.exposure).toHaveBeenCalledWith({ userId: USER, experimentId: IN_POOL, surface: 'tutor', target: 'mentor.canary', age: 36 });
  });

  it('variant A is the control arm, with no override', async () => {
    runtime.assignments.mockResolvedValue([{ experimentId: IN_POOL, variant: 'A' }]);
    runtime.exposure.mockResolvedValue({ experimentId: IN_POOL, variant: 'A' });
    expect((await resolveMentorCanary({ ...ADULT, manifest: [ENTRY] })).canary).toEqual({ proposalId: ENTRY.proposalId, arm: 'control', overrides: {} });
  });

  it('a verified adult with no exact age is sent as 18, the floor the ID verification proves', async () => {
    runtime.assignments.mockResolvedValue([]);
    await resolveMentorCanary({ ...ADULT, age: null, manifest: [ENTRY] });
    expect(runtime.assignments).toHaveBeenCalledWith(expect.objectContaining({ age: 18 }));
  });

  it.each([
    ['a minor posture (unverified, unknown age, kid role)', { isMinor: true }],
    ['a teen band', { band: 'teen' as const, age: 16 }],
    ['a tween band', { band: 'tween' as const, age: 11 }],
    ['an age under 18 on an adult band', { age: 17 }],
  ])('%s is never asked for an assignment', async (_name, patch) => {
    const r = await resolveMentorCanary({ ...ADULT, ...patch, manifest: [ENTRY] });
    expect(r).toEqual({ canary: null, assignment: 'not_eligible' });
    expect(runtime.assignments).not.toHaveBeenCalled();
    expect(runtime.exposure).not.toHaveBeenCalled();
  });

  it('an adult the analytics rule does not admit is never asked for an assignment', async () => {
    runtime.analytics.mockImplementation(async () => false);
    expect(await resolveMentorCanary({ ...ADULT, manifest: [ENTRY] })).toEqual({ canary: null, assignment: 'no_consent' });
    expect(runtime.assignments).not.toHaveBeenCalled();
  });

  it('no manifest, an unlisted experiment, outside the pool or a failed runtime: no canary and no exposure', async () => {
    expect(await resolveMentorCanary({ ...ADULT, manifest: [] })).toEqual({ canary: null, assignment: 'no_canary' });
    expect(runtime.assignments).not.toHaveBeenCalled();
    runtime.assignments.mockResolvedValue([{ experimentId: '66666666-6666-4666-8666-666666666666', variant: 'B' }]);
    expect((await resolveMentorCanary({ ...ADULT, manifest: [ENTRY] })).assignment).toBe('no_canary');
    runtime.assignments.mockResolvedValue([{ experimentId: OUT_OF_POOL, variant: 'B' }]);
    expect((await resolveMentorCanary({ ...ADULT, manifest: [{ ...ENTRY, experimentId: OUT_OF_POOL }] })).assignment).toBe('not_sampled');
    runtime.assignments.mockResolvedValue(null);
    expect((await resolveMentorCanary({ ...ADULT, manifest: [ENTRY] })).assignment).toBe('runtime_unavailable');
    expect(runtime.exposure).not.toHaveBeenCalled();
    runtime.assignments.mockResolvedValue([{ experimentId: IN_POOL, variant: 'B' }]);
    runtime.exposure.mockResolvedValue(null);
    expect(await resolveMentorCanary({ ...ADULT, manifest: [ENTRY] })).toEqual({ canary: null, assignment: 'runtime_unavailable' });
  });

  it('an entry with an invalid override is never delivered', async () => {
    runtime.assignments.mockResolvedValue([{ experimentId: IN_POOL, variant: 'B' }]);
    const bad = { ...ENTRY, overrides: { 'session.softCapMinutes': 60 } };
    expect(await resolveMentorCanary({ ...ADULT, manifest: [bad] })).toEqual({ canary: null, assignment: 'no_canary' });
    const outOfBounds = { ...ENTRY, overrides: { 'telemetry.latencyZ': 9 } };
    expect((await resolveMentorCanary({ ...ADULT, manifest: [outOfBounds] })).canary).toBeNull();
  });
});

describe('the close record and the Stage 5 sample', () => {
  it('stores a running proposal once; refuses one the manifest does not run', async () => {
    expect(await recordCanaryArm({ sessionId: 's-1', report: { proposalId: ENTRY.proposalId, arm: 'canary' }, manifest: [ENTRY] })).toBe('recorded');
    expect(runtime.rest).toHaveBeenCalledWith('/tutor_sessions?id=eq.s-1&canary_proposal_id=is.null', expect.objectContaining({ method: 'PATCH' }));
    runtime.rest.mockClear();
    expect(await recordCanaryArm({ sessionId: 's-1', report: { proposalId: 'P-2026-10-09-other', arm: 'canary' }, manifest: [ENTRY] })).toBe('refused');
    expect(runtime.rest).not.toHaveBeenCalled();
  });

  it('draws a reproducible sample: the same seed, the same sessions', () => {
    const ids = Array.from({ length: 50 }, (_, i) => `s-${i}`);
    const a = drawCanarySample(ids, 20, 'seed-1');
    expect(a).toHaveLength(20);
    expect(drawCanarySample([...ids].reverse(), 20, 'seed-1')).toEqual(a);
    expect(drawCanarySample(ids, 20, 'seed-2')).not.toEqual(a);
    expect(drawCanarySample(ids.slice(0, 5), 20, 'seed-1')).toHaveLength(5);
  });

  it('summarizes each arm: a session failing any rules criterion counts once', () => {
    const sessions = [
      { id: 'a', canary_arm: 'canary' as const },
      { id: 'b', canary_arm: 'canary' as const },
      { id: 'c', canary_arm: 'control' as const },
      { id: 'd', canary_arm: 'control' as const },
    ];
    const scores = [
      { session_id: 'a', outcome: 'fail' },
      { session_id: 'a', outcome: 'fail' },
      { session_id: 'b', outcome: 'pass' },
      { session_id: 'c', outcome: 'not_applicable' },
      { session_id: 'd', outcome: 'pass' },
    ];
    expect(summarizeCanaryArms(sessions, scores)).toEqual({
      canary: { sessions: 2, scored: 2, failing: 1, failShare: 0.5 },
      control: { sessions: 2, scored: 1, failing: 0, failShare: 0 },
    });
  });
});
