import { afterEach, describe, expect, it, vi } from 'vitest';
import { TutorOrchestrator } from '../tutor/orchestrator.js';
import type { SessionContext } from '../core/client.js';
import type { SpeechResult } from '../voice/speech.js';

/*
 * GAP-FIX-R4 — Appendix F Part 3 Stage 7, the Extended Mastery Engine
 * rollback on Oracle's side: the controller runs on the union of Core's
 * automatic kill switch (`corroborationRollbackKcKeys`) and the operator's
 * env list, and the orchestrator logs ONCE per session when a rolled-back KC
 * is in the plan (the only case in which it can change a decision).
 */

const KC_ID = '44444444-4444-4444-8444-444444444444';
const SESSION: SessionContext = {
  sessionId: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  tier: 3,
  locale: 'en-US',
  nickname: 'Sam',
  character: 'rho',
  companion: null,
  diorama: 'diorama-a',
  intent: 'open',
  adaptations: [],
  courseContext: null,
  skillStates: [],
  isMinor: false,
  voiceConsent: false,
  intelDegraded: false,
  sessionPlan: [
    {
      kcId: KC_ID,
      kcKey: 'money.coins.count',
      skillKey: null,
      reason: 'frontier',
      pKnown: 0.5,
      targetDifficulty: 2,
      objective: 'Count coins.',
      prereqKcIds: [],
      misconceptions: [],
    },
  ],
};

const silent = async (): Promise<SpeechResult> => ({ url: null, source: 'unavailable', billedChars: 0, wordTimings: null });
const rollbackOf = (o: TutorOrchestrator): ReadonlySet<string> =>
  (o as unknown as { controller: { corroboration: { rollbackKcKeys: ReadonlySet<string> } } }).controller.corroboration.rollbackKcKeys;
const rollbackLogs = (spy: ReturnType<typeof vi.spyOn>): string[] =>
  spy.mock.calls.map((c) => String(c[0])).filter((line) => line.includes('Stage 7 mastery rollback'));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the Extended Mastery Engine rollback in a live session', () => {
  it("applies Core's rolled-back KC and logs it once, naming the KC and its source", () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const o = new TutorOrchestrator({ ...SESSION, corroborationRollbackKcKeys: ['money.coins.count'] }, 1_000, silent);
    expect([...rollbackOf(o)]).toEqual(['money.coins.count']);
    const logs = rollbackLogs(warn);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain(SESSION.sessionId);
    expect(logs[0]).toContain('money.coins.count [core]');
    // No learner identity in the line.
    expect(logs[0]).not.toContain(SESSION.userId);
    expect(logs[0]).not.toContain('Sam');
  });

  it('a rolled-back KC outside this session plan is applied but not logged', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const o = new TutorOrchestrator({ ...SESSION, corroborationRollbackKcKeys: ['ent.price.set'] }, 1_000, silent);
    expect([...rollbackOf(o)]).toEqual(['ent.price.set']);
    expect(rollbackLogs(warn)).toEqual([]);
  });

  it('nothing in force (or an older Core that sends no field): nothing rolled back, nothing logged', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const o = new TutorOrchestrator(SESSION, 1_000, silent);
    expect([...rollbackOf(o)]).toEqual([]);
    expect(rollbackLogs(warn)).toEqual([]);
  });
});
