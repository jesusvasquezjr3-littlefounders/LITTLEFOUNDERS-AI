import type { ConsoleMethod, ConsoleTransport, ConsoleTransportResult } from './consoleApi';

/*
 * Fixtures for the rebuilt Family console's tests and preview (W2F.1): Core's
 * real envelopes and shapes (backend/src/routes/family.ts, tutor.ts, learn.ts,
 * tasks.ts), and a transport that answers by "METHOD /path" and records every
 * call, so a test can assert the exact request a control sent.
 */

export const KID_A = '22222222-2222-4222-8222-222222222222';
export const KID_B = '33333333-3333-4333-8333-333333333333';
export const SESSION_A = '44444444-4444-4444-8444-444444444444';
export const SESSION_B = '55555555-5555-4555-8555-555555555555';
export const T = '2026-09-20T10:00:00.000Z';

export const childWire = (over: Record<string, unknown> = {}) => ({
  userId: KID_A, displayName: 'Sofía', username: 'sofia_2016', analyticsConsent: false, pendingApprovalCount: 2, walletTotal: 34,
  taskStreakDays: 6, accountType: 'child', profileReview: { flagged: false, fields: [] }, ...over,
});

export const FAMILY = [
  childWire(),
  childWire({ userId: KID_B, displayName: 'Mateo', username: 'mateo_2018', analyticsConsent: true, pendingApprovalCount: 0, walletTotal: 8, taskStreakDays: 0 }),
];

export const territoryWire = (over: { passed?: number; total?: number; streakDays?: number; stats?: unknown } = {}) => ({
  tree: {
    course: { id: 'c1', slug: 'money-basics', title: { 'en-US': 'Money Basics', 'es-MX': 'Bases del dinero', 'pt-BR': 'Bases do dinheiro' }, description: {},
      subject: 'money', progress: { passed: over.passed ?? 3, total: over.total ?? 8, pct: 37 }, placementRequired: false, inProgress: false },
    adventures: [{
      id: 'a1', slug: 'saving', title: { 'en-US': 'Saving', 'es-MX': 'Ahorrar', 'pt-BR': 'Poupar' }, description: {}, theme: 'forest', position: 1,
      state: 'available', progress: { passed: over.passed ?? 3, total: over.total ?? 8, pct: 37 },
      sagas: [{ id: 's1', slug: 's', title: {}, icon: '', position: 1, progress: { passed: 3, total: 8, pct: 37 }, topics: [
        { id: 't1', slug: 't1', title: { 'en-US': 'Why save' }, position: 1, kind: 'lesson', reviewOf: [], state: 'completed', lessons: [{ id: 'l1', state: 'passed' }] },
        { id: 't2', slug: 't2', title: { 'en-US': 'Goals' }, position: 2, kind: 'lesson', reviewOf: [], state: 'in-progress', lessons: [{ id: 'l2', state: 'current' }] },
        { id: 't3', slug: 't3', title: { 'en-US': 'Interest' }, position: 3, kind: 'lesson', reviewOf: [], state: 'not-started', lessons: [{ id: 'l3', state: 'locked' }] },
        { id: 't4', slug: 't4', title: { 'en-US': 'Review' }, position: 4, kind: 'review', reviewOf: ['t1'], state: 'review-due', lessons: [] },
      ] }],
    }],
    nextLessonId: 'l2',
  },
  stats: over.stats !== undefined ? over.stats : { xpPoints: 420, lessonsCompleted: 12, streakDays: over.streakDays ?? 5, longestStreak: 9, lastActiveDate: '2026-09-19' },
});

export const sessionWire = (over: Record<string, unknown> = {}) => ({
  id: SESSION_A, locale: 'en-US', character: 'dina', companion: null, diorama: 'diorama-a', intent: 'course_topic', startedAt: T, endedAt: '2026-09-20T10:12:00.000Z',
  closeReason: 'completed', turnCount: 14, segmentCount: 1, xpAwarded: 20,
  narrative: { topics: ['saving'], struggledTopic: null, struggleResolved: false, gradedCorrect: 3, gradedTotal: 4 }, ...over,
});

export const historyWire = (over: Record<string, unknown> = {}) => ({
  sessions: [sessionWire()], hasMore: false,
  safetyFlags: [
    { id: 'f-low', session_id: SESSION_B, turn_seq: 2, category: 'model_output_blocked', severity: 'low', handled: 'turn_blocked', created_at: '2026-09-20T11:00:00.000Z' },
    { id: 'f-high', session_id: SESSION_B, turn_seq: 3, category: 'self_harm', severity: 'high', handled: 'session_stopped', created_at: '2026-09-18T11:00:00.000Z' },
  ],
  placementSafetyFlags: [{ id: 'p-med', course_id: 'c1', category: 'personal_data', severity: 'medium', created_at: '2026-09-19T11:00:00.000Z' }],
  ...over,
});

/** A drawn board as Oracle stores it on a turn (the Mentor lane's wire): the goal bar, and a class II board the learner acted on. */
export const GOAL_BOARD = { kind: 'goal_bar', goal: { label: 'Bike', value: 20 }, saved: { label: 'Saved', value: 5 }, remaining: 15, savedFraction: 0.25,
  label: 'Bike: 5 of 20', currency: null } as const;
export const YOUR_TURN_BOARD = { kind: 'your_turn', start: 10, steps: [{ op: 'add', value: 5 }], givenCount: 1, unit: 'week', values: [15, 20, 25],
  label: 'Keep it going', currency: null } as const;

export const transcriptWire = (sessionId = SESSION_A) => ({
  session: sessionWire({ id: sessionId }),
  turns: [
    { id: 'u1', seq: 1, speaker: 'tutor', text: 'Hi! Want to plan a goal?', emotion: null, action: null, audio_path: null, source: 'model', created_at: '2026-09-20T10:00:01.000Z',
      whiteboard: GOAL_BOARD, demonstrate: null, roleplay_scene: null, point_at: null },
    { id: 'u2', seq: 2, speaker: 'learner', text: 'Yes, a bike', emotion: null, action: null, audio_path: null, source: 'typed', created_at: '2026-09-20T10:00:05.000Z',
      whiteboard: null, demonstrate: null, roleplay_scene: null, point_at: null },
    { id: 'u3', seq: 3, speaker: 'tutor', text: 'Let me show you with coins.', emotion: null, action: null, audio_path: null, source: 'model', created_at: '2026-09-20T10:00:30.000Z',
      whiteboard: YOUR_TURN_BOARD, demonstrate: [{ kind: 'add', denomination: 10 }, { kind: 'pause' }, { kind: 'remove', denomination: 5 }], roleplay_scene: null, point_at: null },
    { id: 'u4', seq: 4, speaker: 'system', text: 'Session paused for today.', emotion: null, action: null, audio_path: null, source: 'system', created_at: '2026-09-20T10:01:00.000Z',
      whiteboard: null, demonstrate: null, roleplay_scene: null, point_at: null },
  ],
  segments: [
    { segmentId: 'seg1', seq: 1, origin: 'catalog', segment: { type: 'choice', prompt_md: 'How many **more** coins?', answer_hidden: true }, score: 80, xpAwarded: 12,
      createdAt: '2026-09-20T10:00:10.000Z' },
  ],
});

export const notesWire = (over: Record<string, unknown> = {}) => ({
  current: { learner: 'Loves bikes.', pedagogy: 'Short steps help.' },
  proposals: [
    { id: 'n1', store: 'learner', proposed: 'Loves bikes and saving for one.', expectedBefore: 'Loves bikes.', sessionId: SESSION_A, createdAt: T },
    { id: 'n2', store: 'learner', proposed: 'Likes dinosaurs.', expectedBefore: 'Likes trains.', sessionId: SESSION_B, createdAt: T },
    { id: 'n3', store: 'pedagogy', proposed: 'A picture first, then the rule.', expectedBefore: 'Short steps help.', sessionId: SESSION_A, createdAt: T },
  ],
  ...over,
});

export const dispositionWire = {
  exists: true, current: true, sessionsObserved: 7, helpStyle: 'hint_seeking', persistence: 'persists', explanation: 'explains',
  persistentlyDeclined: ['less_text'], typicalReplySeconds: 9, personas: [{ character: 'dina', sessions: 7 }], effects: [], updatedAt: T,
};

export const micWire = (over: Record<string, unknown> = {}) => ({ active: false, grantedAt: null, locale: null, policy: 'allowed', ...over });

export interface RecordedCall { method: ConsoleMethod; path: string; body: unknown }
export type Answer = ConsoleTransportResult | ((body: unknown) => ConsoleTransportResult | Promise<ConsoleTransportResult>);

export const ok = (data: unknown): ConsoleTransportResult => ({ data, error: null });
export const refuse = (code: string): ConsoleTransportResult => ({ data: null, error: { code } });

/** Answers "METHOD /path" (exact) from `routes`; anything unrouted is refused as NOT_ROUTED so a stray request fails loudly. */
export function fakeTransport(routes: Record<string, Answer>): ConsoleTransport & { calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const transport = (async (path: string, options: { method?: ConsoleMethod; body?: unknown } = {}) => {
    const method = options.method ?? 'GET';
    calls.push({ method, path, body: options.body });
    const answer = routes[`${method} ${path}`];
    if (answer === undefined) return refuse('NOT_ROUTED');
    return typeof answer === 'function' ? answer(options.body) : answer;
  }) as ConsoleTransport & { calls: RecordedCall[] };
  transport.calls = calls;
  return transport;
}
