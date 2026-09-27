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
  // W2F.2: Tasks (F4) and coins (F5) for the Tutor, the child boards and the teen wallet (verify-family-money-screens.mjs).
  'money-tutor': tutor({ kids: 'two', money: 'full' }),
  'money-tutor-new': tutor({ kids: 'two', money: 'new' }),
  'money-tutor-offline': tutor({ kids: 'two', money: 'offline' }),
  'money-tutor-empty': tutor({ kids: 'none', money: 'full' }),
  'money-child': { population: 'parent-created child 6-9', guest: false, ageBand: '6-9', roles: ['kid'], family: { money: 'full', register: 'young' } },
  'money-child-new': { population: 'parent-created child 6-9', guest: false, ageBand: '6-9', roles: ['kid'], family: { money: 'new', register: 'young' } },
  'money-child-offline': { population: 'parent-created child 6-9', guest: false, ageBand: '6-9', roles: ['kid'], family: { money: 'offline', register: 'young' } },
  'money-teen-linked': { population: 'self-registered teen 13-17 with a linked Tutor', guest: false, ageBand: '13-17', roles: ['universal'],
    wallet: { holder: 'teen', familyChild: true }, family: { money: 'full', register: 'teen' } },
  'money-teen': { population: 'independent teen 13-17', guest: false, ageBand: '13-17', roles: ['universal'], wallet: { holder: 'teen', familyChild: false },
    family: { money: 'full', register: 'teen' } },
  'money-teen-offline': { population: 'independent teen 13-17', guest: false, ageBand: '13-17', roles: ['universal'], wallet: { holder: 'teen', familyChild: false },
    family: { money: 'offline', register: 'teen' } },
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
  tutorTasks: '[data-screen="tutor-tasks"] [data-family-part="chores"] [data-task-id]',
  childTasks: '[data-screen="child-tasks"] [data-family-part="chores"] [data-task-id]',
  tutorCoins: '[data-screen="tutor-coins"] [data-family-part="allowance"]',
  childCoins: '[data-screen="child-coins"] [data-family-part="card-look"]',
};

/*
 * A state reached by a press: the runner waits for readiness BEFORE it presses (audit-rebuild.mjs `load`), so readiness is
 * the control to press, never what the press reveals (W2F.3: waiting for the revealed part meant these states could never
 * become ready). That the press landed is proved by the runner's signature check: the opened page must not render the same
 * markup as the unopened state of the same scenario, which is also audited (one-child, empty, talks, tutor, child).
 * The first-view word budget (06 §3.1) is what a screen says on arrival, so it is measured on those unopened states; what
 * a deliberate press reveals is layered copy (06 §4), measured by every other rule (roles, text fit, proportion).
 */
const opens = (selector) => [selector, { open: [selector], firstView: false }];

export const states = [
  app('/family@two-children', `/family?child=${KID_A}`, 'family-two', ready.console, { readyAlso: '[data-console-part="picker"]' }),
  app('/family@teen-selected', `/family?child=${KID_B}`, 'family-two', `[data-console-control="manage-child"][data-self-managed="true"]`),
  app('/family@one-child', '/family', 'family-one', ready.console),
  app('/family@manage-open', '/family', 'family-one', ...opens('[data-console-control="manage-child"] button')),
  app('/family@add-child', '/family', 'family-empty', ...opens('[data-console-control="add-child"] button')),
  app('/family@empty', '/family', 'family-empty', '[data-screen="family-console"] .lf-state--empty'),
  app('/family@unverified', '/family', 'family-unverified', '[data-screen="family-console"] .lf-state--empty a[href="/verify-parent"]'),
  app('/family@offline', '/family', 'family-offline', '[data-screen="family-console"] .lf-state--error'),
  app('/family/:kid/territory@progress', `/family/${KID_A}/territory`, 'family-two', ready.progress, { readyAlso: '[data-console-part="shares"]' }),
  app('/family/:kid/territory@forbidden', `/family/${KID_A}/territory`, 'family-progress-forbidden', '[data-screen="child-progress"] .lf-state--empty'),
  app('/family/:kid/territory@no-course', `/family/${KID_A}/territory`, 'family-progress-no-course', '[data-screen="child-progress"] .lf-state--empty'),
  app('/family/:kid/tutor@talks', `/family/${KID_A}/tutor`, 'family-two', ready.mentor, { readyAlso: ['[data-console-part="flags"]', '[data-memory-note]'] }),
  app('/family/:kid/tutor@transcript', `/family/${KID_A}/tutor`, 'family-two', ...opens('[data-console-part="sessions"] [data-session-id] button')),
  app('/family/:kid/tutor@quiet', `/family/${KID_A}/tutor`, 'family-mentor-quiet', ready.mentor),
  app('/family/:kid/tutor@forbidden', `/family/${KID_A}/tutor`, 'family-mentor-forbidden', '[data-screen="child-mentor"] .lf-state--empty'),
  // W2F.2: Tasks (F4) and coins (F5), both sides, and the teen wallet.
  app('/tasks@tutor', '/tasks', 'money-tutor', ready.tutorTasks, { readyAlso: '[data-family-part="rewards"] li' }),
  app('/tasks@tutor-add-reward', '/tasks', 'money-tutor', ...opens('[data-family-part="rewards"] > .lf-button-group button')),
  app('/tasks@tutor-empty', '/tasks', 'money-tutor-empty', '[data-screen="tutor-tasks"] .lf-state--empty'),
  app('/tasks@tutor-offline', '/tasks', 'money-tutor-offline', '[data-screen="tutor-tasks"] .lf-state--error'),
  app('/tasks@child', '/tasks', 'money-child', ready.childTasks, { readyAlso: '[data-family-part="payouts"]' }),
  app('/tasks@child-new', '/tasks', 'money-child-new', '[data-screen="child-tasks"] [data-family-part="chores"]'),
  app('/tasks@child-offline', '/tasks', 'money-child-offline', '[data-screen="child-tasks"] .lf-state--error'),
  app('/tasks@teen-linked', '/tasks', 'money-teen-linked', ready.childTasks),
  app('/banking@tutor', `/banking?child=${KID_A}`, 'money-tutor', ready.tutorCoins, { readyAlso: '[data-family-part="limit"]' }),
  app('/banking@tutor-open-card', `/banking?child=${KID_A}`, 'money-tutor-new', '[data-family-part="open-card"]'),
  app('/banking@tutor-offline', '/banking', 'money-tutor-offline', '[data-screen="tutor-coins"] .lf-state--error'),
  app('/banking@child', '/banking', 'money-child', ready.childCoins, { readyAlso: '[data-family-part="payouts"]' }),
  app('/banking@child-card', '/banking', 'money-child', ...opens('[data-family-part="card-look"] button')),
  app('/banking@teen-linked', '/banking', 'money-teen-linked', ready.childCoins),
  app('/wallet@teen', '/wallet', 'money-teen', '[data-teen-wallet="root"] [data-pocket="save"]'),
  app('/wallet@teen-offline', '/wallet', 'money-teen-offline', '[data-teen-wallet="root"] .lf-state--error'),
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
  if (family.money) {
    const answer = money({ spec, family, locale, path, request, ok });
    if (answer !== undefined) return answer;
  }
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

// ── W2F.2: Tasks (F4), coins (F5) and the teen wallet ───────────────────────

const PARENT = '11111111-1111-4111-8111-111111111111';
const TASK = (n) => `aaaaaaaa-aaaa-4aaa-8aaa-00000000000${n}`;
const REWARD_ID = (n) => `eeeeeeee-eeee-4eee-8eee-00000000000${n}`;
const WORDS = {
  'en-US': { table: 'Set the table', car: 'Wash the car', plants: 'Water the plants', towels: 'Fold the towels', dinner: 'Pick dinner', bed: 'Late bedtime',
    note: 'I did the wheels too', reason: 'We did it together', card: 'Rocket Fund', goal: 'Bike', place: 'Food bank', movie: 'Movie night' },
  'es-MX': { table: 'Poner la mesa', car: 'Lavar el coche', plants: 'Regar las plantas', towels: 'Doblar las toallas', dinner: 'Elegir la cena',
    bed: 'Dormir más tarde', note: 'También lavé las llantas', reason: 'Lo hicimos juntos', card: 'Fondo cohete', goal: 'Bici', place: 'Banco de alimentos',
    movie: 'Noche de película' },
  'pt-BR': { table: 'Pôr a mesa', car: 'Lavar o carro', plants: 'Regar as plantas', towels: 'Dobrar as toalhas', dinner: 'Escolher o jantar',
    bed: 'Dormir mais tarde', note: 'Lavei as rodas também', reason: 'Fizemos juntos', card: 'Fundo foguete', goal: 'Bicicleta', place: 'Banco de alimentos',
    movie: 'Noite de filme' },
};
const task = (w, over) => ({ id: TASK(1), assignedBy: PARENT, assignedTo: KID_A, title: w.table, rewardCoins: 0, recurrence: 'once', dueAt: null, status: 'open',
  allocated: false, createdAt: T, hasEvidence: false, requiresEvidence: false, cancelReason: null, kind: 'contribution', completedOn: null, childNote: null, ...over });
const tasks = (w, fresh) => fresh ? [] : [
  task(w, {}),
  task(w, { id: TASK(2), title: w.car, rewardCoins: 20, kind: 'bonus', status: 'done', hasEvidence: true, requiresEvidence: true, recurrence: 'weekly', childNote: w.note }),
  task(w, { id: TASK(3), title: w.plants, rewardCoins: 10, kind: 'bonus', status: 'approved' }),
  task(w, { id: TASK(4), assignedTo: KID_B, title: w.towels, status: 'cancelled', cancelReason: w.reason }),
];
const rewards = (w) => [
  { id: REWARD_ID(1), parentUserId: PARENT, title: w.dinner, cost: 15, active: true, createdAt: T },
  { id: REWARD_ID(2), parentUserId: PARENT, title: w.bed, cost: 40, active: false, createdAt: T },
];
const rewardRequest = (over) => ({ id: '77777777-7777-4777-8777-777777777777', catalogId: REWARD_ID(1), kidUserId: KID_A, status: 'requested', createdAt: T, decidedAt: null,
  decidedBy: null, fulfilledAt: null, childReasonKind: 'saved_for_it', childNote: null, ...over });
const HOLDS = ['rewards', 'splits', 'credits', 'share'];
const card = (w) => ({ nickname: w.card, design: 'ocean', simulated: true, freeze: { frozen: false, by: null, since: null, holds: HOLDS, canChange: true } });
const legacyAccount = (w) => ({ nickname: w.card, cardDesign: 'ocean', displayNumber: 'LF-0000-0000', frozen: false, frozenBy: null, frozenAt: null, openedAt: T });
const goal = (w) => ({ id: GOAL, kidUserId: KID_A, title: w.goal, target: 40, icon: 'bike', status: 'active', createdAt: T, reachedAt: null, followsGoalId: null, saved: 16,
  progress: { own: 12, bonus: 2, family: 2, total: 16 }, nextStep: null });
const statement = (register) => register === 'young' ? { month: '2026-09', earned: 30, spent: 10, saved: 20 }
  : register === 'transition' ? { month: '2026-09', earned: 30, spent: 10, saved: 20, given: 2, adjusted: 0 }
    : { month: '2026-09', earned: 30, spent: 10, saved: 20, given: 2, adjusted: 0, lines: [] };
const limit = (register) => register === 'young' ? { configured: true, period: 'weekly', remaining: 30 }
  : register === 'transition' ? { configured: true, period: 'weekly', remaining: 30, cap: 50, used: 20 }
    : { configured: true, period: 'weekly', remaining: 30, cap: 50, used: 20, usedPercent: 40 };
const AUTONOMY = { inFamily: true, level: 1, storedLevel: 1, levelSince: null, preapprovedLimit: 0, preapprovedCap: 0, unlocks: { selfLogContributions: false, selfLogMaxCoins: null },
  next: { level: 2, eligible: false, age: { value: 9, min: 8, ok: true }, approved: { value: 4, min: 10 }, notApproved: { value: 0, maxPct: 25, ok: true },
    daysAtLevel: { value: 30, min: 0, ok: true }, windowDays: 60 }, request: null };
const STREAK = { status: 'alive', current: 4, best: 9, totalDays: 30, restDaysLeftThisWeek: 1, restDaysPerWeek: 2, pausedUntil: null, today: '2026-09-26' };
const RESEARCH = { research: { participating: false, recording: false, grantor: null, since: null, disclosureVersion: 0, adult: false, months: 0 }, currentVersion: 1 };
const SPLIT = { usual: { save: 50, spend: 40, share: 10 }, custom: false, recommended: { save: 50, spend: 40, share: 10 } };

/** Every Core read the rebuilt Tasks, coin and teen-wallet screens (and the wave-1 surfaces on them) make, in Core's real shapes. */
function money({ spec, family, locale, path, request, ok }) {
  const w = WORDS[locale] ?? WORDS['en-US'];
  const fresh = family.money === 'new';
  const get = request.method === 'GET';
  const offline = family.money === 'offline';
  const register = family.register ?? 'young';
  // A Tutor's reads.
  if (spec.roles?.includes('parent')) {
    if (offline && (path === '/tasks' || path === '/family/kids')) return { fail: 'InternetDisconnected' };
    if (path === '/tasks' && get) return ok({ tasks: tasks(w, false) });
    if (path === '/tasks/catalog' && get) return ok({ items: rewards(w) });
    if (path === '/tasks/redemptions' && get) return ok({ redemptions: [rewardRequest({})] });
    if (path === '/tasks/decisions/queue') return ok({ chores: [tasks(w, false)[1]], openChores: [tasks(w, false)[0]],
      rewards: [{ ...rewardRequest({}), title: w.dinner, cost: 15 }], reviews: [], nudges: [], levelRequests: [] });
    const account = path.match(/^\/banking\/accounts\/([^/]+)$/);
    if (account && get) return ok({ account: fresh && account[1] === KID_A ? null : legacyAccount(w) });
    if (/^\/banking\/accounts\/[^/]+\/freeze$/.test(path) && get) return ok({ register: 'young', account: card(w) });
    if (/^\/banking\/allowance\/[^/]+$/.test(path) && get) return ok({ rule: { amount: 10, frequency: 'weekly', anchorDay: 5, active: true, nextRunAt: '2026-10-02T00:00:00.000Z' } });
    if (/^\/banking\/spend-limit\/[^/]+$/.test(path) && get) return ok({ status: { configured: true, period: 'weekly', cap: 50, used: 20, remaining: 30 } });
    // The writes a journey presses (verify-family-money-screens.mjs records their bodies); Core's answer shapes.
    const sent = request.postData ? JSON.parse(request.postData) : {};
    if (path === '/tasks/catalog' && request.method === 'POST') return ok({ item: { id: REWARD_ID(9), parentUserId: PARENT, title: sent.title, cost: sent.cost, active: true, createdAt: T } });
    const item = path.match(/^\/tasks\/catalog\/([^/]+)$/);
    if (item && request.method === 'PATCH') return ok({ item: { ...(rewards(w).find((r) => r.id === item[1]) ?? rewards(w)[0]), active: sent.active } });
    if (/^\/banking\/allowance\/[^/]+$/.test(path) && request.method === 'PUT') return ok({ rule: { ...sent, nextRunAt: '2026-10-02T00:00:00.000Z' } });
    if (/^\/banking\/spend-limit\/[^/]+$/.test(path) && request.method === 'PUT') return ok({ status: sent.active
      ? { configured: true, period: sent.period, cap: sent.cap, used: 20, remaining: Math.max(0, sent.cap - 20) } : { configured: false } });
    if (/^\/banking\/accounts\/[^/]+$/.test(path) && request.method === 'POST') return ok({ account: { ...legacyAccount(w), nickname: sent.nickname, cardDesign: sent.cardDesign } });
    // The evidence proxy serves an image, which this JSON-only synthetic Core cannot: the screen's own "did not load" state is what is measured.
    if (/^\/tasks\/[^/]+\/evidence$/.test(path)) return { status: 404, body: { data: null, error: { code: 'NOT_FOUND', message: 'Synthetic' } } };
    return undefined;
  }
  // A child's (or a teen's) reads.
  if (offline && ['/tasks/mine', '/banking/account', '/wallet/access', '/tasks/wallet'].includes(path)) return { fail: 'InternetDisconnected' };
  if (path === '/banking/register') return ok({ register });
  if (path === '/tasks/mine') return ok({ tasks: tasks(w, fresh).filter((t) => t.assignedTo === KID_A) });
  if (path === '/tasks/wallet') return ok({ balances: { save: 20, spend: 12, share: 3 } });
  if (path === '/tasks/catalog/available') return ok({ items: fresh ? [] : rewards(w).map((r) => ({ ...r, active: true })) });
  if (path === '/tasks/redemptions/mine') return ok({ redemptions: [] });
  if (path === '/tasks/wallet/ledger') return ok({ entries: [] });
  if (path === '/tasks/streak') return ok({ streak: STREAK });
  if (path === '/tasks/autonomy' && get) return ok({ autonomy: AUTONOMY, changes: [] });
  if (path === '/tasks/decisions/mine') return ok({ decisions: [] });
  if (path === '/tasks/goals' && get) return ok({ goals: fresh ? [] : [goal(w)] });
  if (path === '/tasks/wallet/split' && get) return ok(SPLIT);
  if (path === '/tasks/share' && get) return ok({ destinations: fresh ? [] : [{ id: '88888888-8888-4888-8888-888888888888', title: w.place, kind: 'charity',
    chosenBy: 'tutor', status: 'active', createdAt: T }], gifts: [] });
  if (path === '/banking/account' && get) return ok({ account: legacyAccount(w) });
  if (path === '/banking/account' && request.method === 'PATCH') {
    const sent = request.postData ? JSON.parse(request.postData) : {};
    return ok({ account: { ...legacyAccount(w), nickname: sent.nickname, cardDesign: sent.cardDesign } });
  }
  if (/^\/tasks\/[^/]+\/evidence$/.test(path)) return { status: 404, body: { data: null, error: { code: 'NOT_FOUND', message: 'Synthetic' } } };
  if (path === '/banking/wallet/pending-credits') return ok({ credits: fresh ? [] : [{ id: '99999999-9999-4999-8999-999999999990', amount: 10, source: 'allowance', createdAt: T }] });
  if (path === '/banking/overview') return ok({ register, account: card(w), pockets: { save: 20, spend: 12, share: 3 }, pendingCredits: fresh ? 0 : 1,
    spendLimit: limit(register), statement: statement(register) });
  if (path === '/banking/savings-bonus' && get) return ok(register === 'teen'
    ? { framing: 'percent', perTen: null, maxRateBp: 2000, rule: { rateBp: 1000, active: true, nextRunAt: T }, saved: 20, nextBonus: 2, example: { shown: true, completed: true } }
    : { framing: 'per_ten', perTen: { unit: 10, coins: 1 }, maxRateBp: null, rule: { rateBp: 1000, active: true, nextRunAt: T }, saved: 20, nextBonus: 2, example: null });
  if (path === '/family-hub/bridge' && get) return ok({ eligible: false, minAge: 15, moments: [] });
  if (path === '/family-hub/research/me' && get) return ok(RESEARCH);
  // The independent teen's own wallet (OD-3 Option B).
  if (path === '/wallet/rewards' && get) return ok({ rewards: [{ id: REWARD_ID(3), title: w.movie, cost: 5, status: 'active', createdAt: T, archivedAt: null }] });
  if (path === '/wallet/guardians' && get) return ok({ guardians: [] });
  return undefined;
}
