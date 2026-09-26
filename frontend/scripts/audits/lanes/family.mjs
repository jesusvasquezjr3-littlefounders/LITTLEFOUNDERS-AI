import { app } from './helpers.mjs';

/*
 * Lane 4 (family): Family Hub, the Tutor console, tasks, banking and the teen wallet.
 *
 * W2F.1: the rebuilt Family console (F1, /family), a child's progress (F2,
 * /family/:kidId/territory) and a child's Mentor talks (F3,
 * /family/:kidId/tutor), on the real routes, signed in as a verified Tutor
 * and answered here with Core's real shapes. Every state a Tutor can meet:
 * two children (one a linked self-registered teen), one child, none, the
 * verification refusal, offline, a child not linked to this Tutor, and no
 * course yet. `family` in a scenario is what this lane's `respond` reads;
 * `scripts/verify-family-console.mjs` runs the same scenarios.
 */
export const lane = 'family';

export const KID_A = '22222222-2222-4222-8222-222222222222';
export const KID_B = '33333333-3333-4333-8333-333333333333';
const SESSION_A = '44444444-4444-4444-8444-444444444444';
const SESSION_B = '55555555-5555-4555-8555-555555555555';
const GOAL = '66666666-6666-4666-8666-666666666666';
const T = '2026-09-20T10:00:00.000Z';

const tutor = (family) => ({ population: 'verified parent (Tutor)', guest: false, ageBand: 'adult', roles: ['parent'], family });

export const scenarios = {
  'family-two': tutor({ kids: 'two' }),
  'family-one': tutor({ kids: 'one' }),
  'family-empty': tutor({ kids: 'none' }),
  'family-unverified': tutor({ kids: 'unverified' }),
  'family-offline': tutor({ kids: 'offline' }),
  'family-progress-forbidden': tutor({ kids: 'two', territory: 'forbidden' }),
  'family-progress-no-course': tutor({ kids: 'two', courses: 'none' }),
  'family-mentor-forbidden': tutor({ kids: 'two', history: 'forbidden' }),
  'family-mentor-quiet': tutor({ kids: 'two', history: 'quiet' }),
  // Everyone else meets the parent gate (RequireRole): the console never renders for them (verify-family-console.mjs).
  'family-kid': { population: 'parent-created child 6-9', guest: false, ageBand: '6-9', roles: ['kid'] },
  'family-teen': { population: 'independent teen 13-17', guest: false, ageBand: '13-17', roles: ['universal'], wallet: { holder: 'teen', familyChild: false } },
  'family-adult': { population: 'adult, not a verified parent', guest: false, ageBand: 'adult', roles: ['universal'] },
  'family-staff': { population: 'staff, view_analytics only', guest: false, ageBand: 'adult', roles: ['admin'], adminPermissions: ['view_analytics'] },
  'family-guest': { population: 'guest (age screen done, under 13)', guest: true, ageBand: '6-9' },
};

const ready = {
  console: '[data-screen="family-console"] [data-console-part="overview"]',
  progress: '[data-screen="child-progress"] [data-console-part="map"]',
  mentor: '[data-screen="child-mentor"] [data-console-part="sessions"]',
};

export const states = [
  app('/family@two-children', `/family?child=${KID_A}`, 'family-two', ready.console, { readyAlso: '[data-console-part="picker"]' }),
  app('/family@teen-selected', `/family?child=${KID_B}`, 'family-two', `[data-console-control="manage-child"][data-self-managed="true"]`),
  app('/family@one-child', '/family', 'family-one', ready.console),
  app('/family@manage-open', '/family', 'family-one', '[data-console-control="remove-child"]', { open: ['[data-console-control="manage-child"] button'] }),
  app('/family@add-child', '/family', 'family-empty', '[data-console-control="add-child"] form', { open: ['[data-console-control="add-child"] button'] }),
  app('/family@empty', '/family', 'family-empty', '[data-screen="family-console"] .lf-state--empty'),
  app('/family@unverified', '/family', 'family-unverified', '[data-screen="family-console"] .lf-state--empty a[href="/verify-parent"]'),
  app('/family@offline', '/family', 'family-offline', '[data-screen="family-console"] .lf-state--error'),
  app('/family/:kid/territory@progress', `/family/${KID_A}/territory`, 'family-two', ready.progress, { readyAlso: '[data-console-part="shares"]' }),
  app('/family/:kid/territory@forbidden', `/family/${KID_A}/territory`, 'family-progress-forbidden', '[data-screen="child-progress"] .lf-state--empty'),
  app('/family/:kid/territory@no-course', `/family/${KID_A}/territory`, 'family-progress-no-course', '[data-screen="child-progress"] .lf-state--empty'),
  app('/family/:kid/tutor@talks', `/family/${KID_A}/tutor`, 'family-two', ready.mentor, { readyAlso: ['[data-console-part="flags"]', '[data-memory-note]'] }),
  app('/family/:kid/tutor@transcript', `/family/${KID_A}/tutor`, 'family-two', '[data-console-part="sessions"] [data-console-part="transcript"]',
    { open: ['[data-console-part="sessions"] [data-session-id] button'] }),
  app('/family/:kid/tutor@quiet', `/family/${KID_A}/tutor`, 'family-mentor-quiet', ready.mentor),
  app('/family/:kid/tutor@forbidden', `/family/${KID_A}/tutor`, 'family-mentor-forbidden', '[data-screen="child-mentor"] .lf-state--empty'),
];

const kid = (over) => ({ userId: KID_A, displayName: 'Sofía', username: 'sofia_2016', analyticsConsent: false, pendingApprovalCount: 2, walletTotal: 34,
  taskStreakDays: 6, accountType: 'child', profileReview: { flagged: false, fields: [] }, ...over });
const KIDS = {
  two: [kid({}), kid({ userId: KID_B, displayName: 'Mateo', username: 'mateo_teen', analyticsConsent: true, pendingApprovalCount: 0, walletTotal: 120,
    taskStreakDays: 0, accountType: 'teen', profileReview: { flagged: true, fields: ['displayName'] } })],
  one: [kid({})],
  none: [],
};

const TITLES = {
  course: { 'en-US': 'Money Basics', 'es-MX': 'Bases del dinero', 'pt-BR': 'Bases do dinheiro' },
  saving: { 'en-US': 'Saving', 'es-MX': 'Ahorrar', 'pt-BR': 'Poupar' },
  sharing: { 'en-US': 'Sharing', 'es-MX': 'Compartir', 'pt-BR': 'Compartilhar' },
  why: { 'en-US': 'Why we save', 'es-MX': 'Por qué ahorramos', 'pt-BR': 'Por que poupamos' },
  goals: { 'en-US': 'Setting a goal', 'es-MX': 'Poner una meta', 'pt-BR': 'Definir uma meta' },
  interest: { 'en-US': 'Growing savings', 'es-MX': 'Hacer crecer el ahorro', 'pt-BR': 'Fazer a poupança crescer' },
  review: { 'en-US': 'Saving review', 'es-MX': 'Repaso de ahorro', 'pt-BR': 'Revisão de poupança' },
  give: { 'en-US': 'Giving to others', 'es-MX': 'Dar a otros', 'pt-BR': 'Doar para outros' },
};
const topic = (id, title, state) => ({ id, slug: id, title, position: 1, kind: 'lesson', reviewOf: [], state, lessons: [{ id: `${id}-l`, state: 'passed' }] });
const TERRITORY = {
  tree: {
    course: { id: 'c1', slug: 'money-basics', title: TITLES.course, description: {}, subject: 'money', progress: { passed: 5, total: 12, pct: 41 }, placementRequired: false, inProgress: false },
    adventures: [
      { id: 'a1', slug: 'saving', title: TITLES.saving, description: {}, theme: 'forest', position: 1, state: 'available', progress: { passed: 4, total: 6, pct: 66 },
        sagas: [{ id: 's1', slug: 's1', title: {}, icon: '', position: 1, progress: { passed: 4, total: 6, pct: 66 }, topics: [
          topic('t1', TITLES.why, 'completed'), topic('t2', TITLES.goals, 'in-progress'), topic('t3', TITLES.interest, 'not-started'), topic('t4', TITLES.review, 'review-due'),
        ] }] },
      { id: 'a2', slug: 'sharing', title: TITLES.sharing, description: {}, theme: 'river', position: 2, state: 'locked', progress: { passed: 1, total: 6, pct: 16 },
        sagas: [{ id: 's2', slug: 's2', title: {}, icon: '', position: 1, progress: { passed: 1, total: 6, pct: 16 }, topics: [topic('t5', TITLES.give, 'not-started')] }] },
    ],
    nextLessonId: 't2-l',
  },
  stats: { xpPoints: 420, lessonsCompleted: 12, streakDays: 5, longestStreak: 9, lastActiveDate: '2026-09-19' },
};

const TOPIC_NAMES = { 'en-US': ['saving', 'sharing'], 'es-MX': ['ahorrar', 'compartir'], 'pt-BR': ['poupar', 'compartilhar'] };
const session = (over) => ({ id: SESSION_A, locale: 'en-US', character: 'dina', companion: null, diorama: 'diorama-a', intent: 'course_topic', startedAt: T,
  endedAt: '2026-09-20T10:12:00.000Z', closeReason: 'completed', turnCount: 14, segmentCount: 1, xpAwarded: 20, narrative: null, ...over });
const history = (locale, quiet) => ({
  sessions: [
    session({ narrative: { topics: TOPIC_NAMES[locale], struggledTopic: TOPIC_NAMES[locale][1], struggleResolved: true, gradedCorrect: 3, gradedTotal: 4 } }),
    session({ id: SESSION_B, intent: 'open', startedAt: '2026-09-18T16:00:00.000Z', endedAt: '2026-09-18T16:04:00.000Z', closeReason: 'learner_left', turnCount: 5,
      narrative: { topics: [TOPIC_NAMES[locale][0]], struggledTopic: null, struggleResolved: false, gradedCorrect: null, gradedTotal: null } }),
  ],
  hasMore: !quiet,
  safetyFlags: quiet ? [] : [{ id: 'f1', session_id: SESSION_B, turn_seq: 2, category: 'personal_data', severity: 'medium', handled: 'turn_blocked', created_at: '2026-09-18T16:02:00.000Z' }],
  placementSafetyFlags: [],
});
const LINES = {
  'en-US': ['Want to plan a goal together?', 'Yes, a bike', 'Great. How many coins a week can you save?'],
  'es-MX': ['¿Planeamos una meta juntos?', 'Sí, una bici', 'Bien. ¿Cuántas monedas por semana puedes ahorrar?'],
  'pt-BR': ['Vamos planejar uma meta juntos?', 'Sim, uma bicicleta', 'Ótimo. Quantas moedas por semana você consegue poupar?'],
};
const transcript = (locale, id) => ({
  session: session({ id }),
  turns: LINES[locale].map((text, index) => ({ id: `${id}-t${index}`, seq: index + 1, speaker: index === 1 ? 'learner' : 'tutor', text, emotion: null, action: null,
    audio_path: null, source: 'model', created_at: `2026-09-20T10:00:0${index * 3}.000Z`, roleplay_scene: null, point_at: null,
    whiteboard: index === 2 ? { kind: 'goal_bar', saved: 5, target: 20, label: '5 / 20' } : null,
    demonstrate: index === 2 ? [{ kind: 'add', denomination: 5 }, { kind: 'add', denomination: 5 }] : null })),
  segments: [{ segmentId: `${id}-seg`, seq: 1, origin: 'catalog', segment: { type: 'choice', prompt_md: LINES[locale][2] }, score: 80, xpAwarded: 12, createdAt: '2026-09-20T10:00:04.000Z' }],
});
const NOTES = {
  'en-US': ['Loves bikes.', 'Loves bikes and is saving for one.'],
  'es-MX': ['Le encantan las bicis.', 'Le encantan las bicis y ahorra para una.'],
  'pt-BR': ['Adora bicicletas.', 'Adora bicicletas e está poupando para uma.'],
};
const POLICY = [{ id: 'photos', days: 30 }, { id: 'records', days: 400 }, { id: 'coins', days: null }, { id: 'insights', days: 400 },
  { id: 'research', days: 1100 }, { id: 'erasure', days: null }, { id: 'sharing', days: null }];

const refuse = (status, code) => ({ status, body: { data: null, error: { code, message: 'Synthetic refusal' } } });

/** The Core endpoints the Family console, a child's progress and a child's Mentor talks read (and the wave-1 panels they compose). */
export function respond({ core, spec, locale, path, request, ok }) {
  const family = spec.family;
  if (!family) return undefined;
  const get = request.method === 'GET';
  if (path === '/family/kids' && get) {
    if (family.kids === 'unverified') return refuse(403, 'PARENT_VERIFICATION_REQUIRED');
    if (family.kids === 'offline') return { fail: 'InternetDisconnected' };
    return ok({ kids: KIDS[family.kids] ?? [] });
  }
  if (path === '/learn/courses') return ok({ courses: family.courses === 'none' ? [] : [{ slug: 'money-basics', title: TITLES.course }] });
  if (/^\/family\/kids\/[^/]+\/courses\/money-basics\/territory$/.test(path)) return family.territory === 'forbidden' ? refuse(403, 'FORBIDDEN') : ok(TERRITORY);
  if (/^\/tasks\/[^/]+\/goals$/.test(path) && get) return ok({ goals: [{ id: GOAL, title: locale === 'en-US' ? 'Bike' : 'Bici', status: 'reached', target: 20 }] });
  if (/^\/tutor\/kids\/[^/]+\/sessions$/.test(path)) return family.history === 'forbidden' ? refuse(403, 'FORBIDDEN') : ok(history(locale, family.history === 'quiet'));
  const sessionMatch = path.match(/^\/tutor\/sessions\/([^/]+)$/);
  if (sessionMatch) return ok(transcript(locale, sessionMatch[1]));
  if (/^\/tutor\/kids\/[^/]+\/memory-proposals$/.test(path)) return ok(family.history === 'quiet' ? { current: null, proposals: [] }
    : { current: NOTES[locale][0], proposals: [{ id: 'note-1', proposed: NOTES[locale][1], expectedBefore: NOTES[locale][0], sessionId: SESSION_A, createdAt: T }] });
  if (/^\/tutor\/kids\/[^/]+\/disposition$/.test(path) && get) return ok({ exists: true, current: true, sessionsObserved: 7, helpStyle: 'independent', persistence: 'persists',
    explanation: 'explains', persistentlyDeclined: [], typicalReplySeconds: 9, personas: [], effects: [], updatedAt: T });
  if (/^\/tutor\/kids\/[^/]+\/plan$/.test(path)) return ok({ plan: family.history === 'quiet' ? null
    : { content: { kind: 'goal_bar', saved: 5, target: 20, label: '5 / 20' }, sessionId: SESSION_A, updatedAt: T } });
  if (/^\/tutor\/kids\/[^/]+\/notebook$/.test(path)) return ok({ entries: [] });
  // The microphone consent keeps what a journey wrote, as Core would (per page session).
  const mic = (core.family ??= { microphone: {} }).microphone;
  const micKid = path.match(/^\/tutor\/consent\/([^/]+)$/)?.[1];
  if (micKid && get) return ok({ active: Boolean(mic[micKid]), grantedAt: mic[micKid] ? T : null, locale: null, policy: 'allowed' });
  // The writes a journey presses (verify-family-console.mjs records their bodies).
  const consent = path.match(/^\/family\/kids\/([^/]+)\/analytics-consent$/);
  if (consent) return ok({ kidId: consent[1], analyticsConsent: request.method === 'POST' });
  if (path === '/tutor/consent' && request.method === 'POST') {
    const kidUserId = JSON.parse(request.postData ?? '{}').kidUserId;
    if (kidUserId) mic[kidUserId] = true;
    return ok({ granted: true, grantedAt: T });
  }
  if (micKid && request.method === 'DELETE') { mic[micKid] = false; return ok({ revoked: true }); }
  if (/^\/tutor\/memory-proposals\/[^/]+\/decision$/.test(path)) return ok({ outcome: 'approved', applied: true });
  if (/^\/tutor\/kids\/[^/]+\/disposition$/.test(path) && request.method === 'DELETE') return ok({ reset: true });
  // The wave-1 surfaces the console composes: what each reads when it mounts.
  if (path === '/family-hub/coaching') return ok({ tip: { deliveryId: '99999999-9999-4999-8999-999999999999', tipId: 'keep-promises', period: '2026-09', opened: false, dismissed: false } });
  if (path === '/family-hub/data-policy') return ok({ classes: POLICY });
  if (path === '/family/guardian-links/mine') return ok({ links: [] });
  if (/^\/family\/learning\/kids\/[^/]+\/bridges$/.test(path)) return ok({ prompts: [] });
  if (/^\/family\/learning\/kids\/[^/]+\/streak$/.test(path)) return ok({ streak: { model: 'rest-days-v1', status: 'open', current: 4, best: 9, daysPracticed: 21,
    restDaysLeft: 1, lastActiveDate: '2026-09-24', pause: null } });
  return undefined;
}
