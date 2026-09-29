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
  // S-06: a child whose handle the E.13 review flags; Manage account offers the new username.
  'family-flagged': tutor({ kids: 'flagged' }),
  'family-empty': tutor({ kids: 'none' }),
  'family-unverified': tutor({ kids: 'unverified' }),
  'family-offline': tutor({ kids: 'offline' }),
  'family-progress-forbidden': tutor({ kids: 'two', territory: 'forbidden' }),
  'family-progress-no-course': tutor({ kids: 'two', courses: 'none' }),
  'family-mentor-forbidden': tutor({ kids: 'two', history: 'forbidden' }),
  'family-mentor-quiet': tutor({ kids: 'two', history: 'quiet' }),
  // F1-family (Block D oversight, OD-9): a talk whose boards are drawn, a class II board read-only, and kept boards.
  'family-mentor-boards': tutor({ kids: 'two', boards: 'drawn' }),
  // GAP-FIX-R2 (D-14 (b)): the linked teen (KID_B) asked to delete their own account; the Tutor is told (notify only).
  'family-deletion-notice': tutor({ kids: 'two', deletionNotice: true }),
  // GAP-FIX-R4 (OD-27 (1), E.2): goals together for a parent-created 15-year-old, on with open goals, off, and a 12-year-old it is not offered to.
  'family-coop': tutor({ kids: 'coopTeen', coop: 'on' }),
  'family-coop-off': tutor({ kids: 'coopTeen', coop: 'off' }),
  'family-coop-young': tutor({ kids: 'coopYoung' }),
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
  // GAP-FIX-R5 (D.1, D.7): a card a Tutor froze, read by the child, and a card the child froze, read by the Tutor.
  'money-child-frozen': { population: 'parent-created child 6-9', guest: false, ageBand: '6-9', roles: ['kid'], family: { money: 'full', register: 'young', frozen: 'tutor' } },
  'money-tutor-frozen': tutor({ kids: 'two', money: 'full', frozen: 'child' }),
  // GAP-FIX-R5 (D.17): a child at level 2, who may step down on their own.
  'money-child-level2': { population: 'parent-created child 6-9', guest: false, ageBand: '6-9', roles: ['kid'], family: { money: 'full', register: 'young', autonomy: 'level2' } },
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
/* GAP-FIX-R4 (Bible 02 §9.2, K18): open the waiting payout, keep the usual split; the board then states the result as a status. */
const splitPress = (screen) => {
  const open = `[data-screen="${screen}"] [data-family-part="payouts"] [data-allocation-state="closed"] button`;
  return [open, { open: [open, `[data-screen="${screen}"] [data-money-habits="split-chooser"] button[type="submit"]`], firstView: false }];
};

/* GAP-FIX-R4: the controls that open the Connections panels (each a lazy panel behind its own toggle) and the row actions. */
const SOCIAL = {
  graph: '.lf-social-graph:not([data-social-audit]) > button[aria-expanded]',
  requests: '[data-social-audit="requests"] > button[aria-expanded]',
  history: '[data-social-audit="history"] > button[aria-expanded]',
  notices: '.lf-social-notices > button[aria-expanded]',
  badges: '[data-share-audit="badges"] > button[aria-expanded]',
  end: '.lf-social-graph:not([data-social-audit]) [data-social-actions] > .lf-button--danger',
  report: '.lf-social-graph:not([data-social-audit]) [data-social-actions] > button[aria-haspopup="dialog"]:not(.lf-button--danger)',
  // The session token arrives after the console renders, and every token-bound panel remounts when it does (a press before that
  // is lost with the old mount). The goals-together card's answered paragraph proves the remount happened; its failed state is a notice.
  settled: '[data-console-part="coop-goals"] p[data-copy-role="body"]:not(.lf-notice)',
};
const opensSettled = (selector, open = [selector]) => [selector, { open, firstView: false, readyAlso: SOCIAL.settled }];

/*
 * GAP-FIX-R5 (Bible 02 §7 item 10, 03 §5, 06 §7; Appendix H Part 3 Stage 4): the Block D panels that render only after a press.
 * Each per-child panel on /family loads when its toggle is pressed and remounts when the session token arrives, so each is
 * pressed only once SOCIAL.settled proves the remount happened. The queue, the child's asks and the Wallet panels are pressed
 * once the control that opens them is on the page (it renders only after the token-bound read answered).
 */
const PANEL = {
  corrections: '[data-family-hub="wallet-corrections"] > button[aria-expanded]',
  pauses: '[data-family-money="streak-pauses"] > button[aria-expanded]',
  share: '[data-money-habits="share-destinations"] > button[aria-expanded]',
  ladder: '[data-autonomy="ladder"] > button[aria-expanded]',
  tutors: '[data-family-hub="co-guardians"] > button[aria-expanded]',
  research: '[data-governance="research"] button[aria-expanded]',
  policy: '[data-governance="data-policy"] button[aria-expanded]',
  bonus: '[data-family-money="bonus-settings"] > button[aria-expanded]',
};
const QUEUE = {
  yes: '[data-autonomy="queue"] [data-queue="rewards"] li button[data-queue-answer="yes"]',
  notYet: '[data-autonomy="queue"] [data-queue="rewards"] li button[data-queue-answer="not-yet"]',
  // The reflective prompt's plain continue (nothing written: 'skipped'), which opens the reason form after a "not yet".
  reflect: '[data-autonomy="queue"] [data-reflection="step"] button[data-reflection-choice]',
};
/** The Tutor's freeze card has loaded (it reads only once the session token is there, so every token-keyed panel has remounted). */
const TUTOR_CARD = '[data-coin-account="tutor"] [data-control="freeze"]';
const opensAfter = (settled, selector, open = [selector]) => [selector, { open, firstView: false, readyAlso: settled }];

export const states = [
  app('/family@two-children', `/family?child=${KID_A}`, 'family-two', ready.console, { readyAlso: '[data-console-part="picker"]' }),
  app('/family@teen-selected', `/family?child=${KID_B}`, 'family-two', `[data-console-control="manage-child"][data-self-managed="true"]`),
  // GAP-FIX-R2 (OD-27 (3)): the story choices of the under-13 child, opened. The teen (KID_B, above) is JOURNAL_PRIVATE: no panel at all.
  app('/family@story-choices', `/family?child=${KID_A}`, 'family-two', ...opens('[data-screen="child-decisions"] .lf-child-decisions-head button')),
  app('/family@teen-deletion-notice', `/family?child=${KID_A}`, 'family-deletion-notice', '[data-family-part="deletion-notices"] [data-deletion-notice]'),
  app('/family@one-child', '/family', 'family-one', ready.console),
  // GAP-FIX-R3: a Tutor mints the second-Tutor invite; the link it shows carries a localized name and the data role.
  app('/family@invite-link', '/family', 'family-one', '[data-invite-control="toggle"]',
    // GAP-FIX-R4: pressed only after the token-bound panels remount (SOCIAL.settled); a press before that was lost at random.
    { open: ['[data-invite-control="toggle"]', '[data-invite-control="mint"]'], firstView: false, readyAlso: [ready.console, SOCIAL.settled] }),
  app('/family@manage-open', '/family', 'family-one', ...opens('[data-console-control="manage-child"] button')),
  app('/family@username-flagged', '/family', 'family-flagged', ...opens('[data-console-control="manage-child"] button')),
  app('/family@add-child', '/family', 'family-empty', ...opens('[data-console-control="add-child"] button')),
  app('/family@empty', '/family', 'family-empty', '[data-screen="family-console"] .lf-state--empty'),
  app('/family@unverified', '/family', 'family-unverified', '[data-screen="family-console"] .lf-state--empty a[href="/verify-parent"]'),
  app('/family@offline', '/family', 'family-offline', '[data-screen="family-console"] .lf-state--error'),
  app('/family/:kid/territory@progress', `/family/${KID_A}/territory`, 'family-two', ready.progress, { readyAlso: '[data-console-part="shares"]' }),
  app('/family/:kid/territory@forbidden', `/family/${KID_A}/territory`, 'family-progress-forbidden', '[data-screen="child-progress"] .lf-state--empty'),
  app('/family/:kid/territory@no-course', `/family/${KID_A}/territory`, 'family-progress-no-course', '[data-screen="child-progress"] .lf-state--empty'),
  app('/family/:kid/tutor@talks', `/family/${KID_A}/tutor`, 'family-two', ready.mentor, { readyAlso: ['[data-console-part="flags"]', '[data-memory-note]'] }),
  app('/family/:kid/tutor@transcript', `/family/${KID_A}/tutor`, 'family-two', ...opens('[data-console-part="sessions"] [data-session-id] button')),
  app('/family/:kid/tutor@boards', `/family/${KID_A}/tutor`, 'family-mentor-boards', ...opens('[data-console-part="sessions"] [data-session-id] button')),
  app('/family/:kid/tutor@quiet', `/family/${KID_A}/tutor`, 'family-mentor-quiet', ready.mentor),
  app('/family/:kid/tutor@forbidden', `/family/${KID_A}/tutor`, 'family-mentor-forbidden', '[data-screen="child-mentor"] .lf-state--empty'),
  // GAP-FIX-R4 (Bible 02 §7, 03 §5, 06 §3; E.1-E.3, OD-27 (1)): the child's Connections slot opened panel by panel, the aside's safety
  // notices, the GAP-FIX-R3 end-connection confirmation and report dialog, the older badge links, and the goals-together card in each state.
  app('/family@connections-graph', `/family?child=${KID_A}`, 'family-two', ...opensSettled(SOCIAL.graph)),
  app('/family@connections-graph-self-managed', `/family?child=${KID_B}`, 'family-two', ...opensSettled(SOCIAL.graph)),
  app('/family@connections-requests', `/family?child=${KID_A}`, 'family-two', ...opensSettled(SOCIAL.requests)),
  app('/family@connections-history', `/family?child=${KID_A}`, 'family-two', ...opensSettled(SOCIAL.history)),
  app('/family@social-notices', `/family?child=${KID_A}`, 'family-two', ...opensSettled(SOCIAL.notices)),
  app('/family@connection-end-confirm', `/family?child=${KID_A}`, 'family-two', ...opensSettled(SOCIAL.graph, [SOCIAL.graph, SOCIAL.end])),
  app('/family@connection-report', `/family?child=${KID_A}`, 'family-two', ...opensSettled(SOCIAL.graph, [SOCIAL.graph, SOCIAL.report])),
  app('/family@badge-links', `/family?child=${KID_A}`, 'family-two', ...opensSettled(SOCIAL.badges)),
  // GAP-FIX-R5 (D.5, D.2, D.14, D.17, OD-21, D.22, D.21): every per-child Block D panel opened, the goal-move form, stepping away.
  app('/family@wallet-corrections', `/family?child=${KID_A}`, 'family-two', ...opensSettled(PANEL.corrections)),
  app('/family@goal-move', `/family?child=${KID_A}`, 'family-two',
    ...opensSettled(PANEL.corrections, [PANEL.corrections, '[data-family-hub="wallet-corrections"] button[data-goal-control="move-out"]'])),
  app('/family@streak-pauses', `/family?child=${KID_A}`, 'family-two', ...opensSettled(PANEL.pauses)),
  app('/family@share-destinations', `/family?child=${KID_A}`, 'family-two', ...opensSettled(PANEL.share)),
  app('/family@autonomy-ladder', `/family?child=${KID_A}`, 'family-two', ...opensSettled(PANEL.ladder)),
  app('/family@co-tutors', `/family?child=${KID_A}`, 'family-two', ...opensSettled(PANEL.tutors)),
  app('/family@co-tutors-leave', `/family?child=${KID_A}`, 'family-two',
    ...opensSettled(PANEL.tutors, [PANEL.tutors, '[data-family-hub="co-guardians"] button[data-guardian-control="leave"]'])),
  app('/family@research-consent', `/family?child=${KID_A}`, 'family-two', ...opensSettled(PANEL.research)),
  app('/family@data-policy', `/family?child=${KID_A}`, 'family-two', ...opensSettled(PANEL.policy)),
  app('/family@coop-goals-consent', '/family', 'family-coop', '[data-console-part="coop-goals"] [data-coop-part="goals"] [data-coop-goal]'),
  app('/family@coop-goals-off', '/family', 'family-coop-off', '[data-console-part="coop-goals"] [role="switch"]'),
  app('/family@coop-goals-not-teen', '/family', 'family-coop-young', '[data-console-part="coop-goals"] p[data-copy-role="body"]'),
  // W2F.2: Tasks (F4) and coins (F5), both sides, and the teen wallet.
  app('/tasks@tutor', '/tasks', 'money-tutor', ready.tutorTasks, { readyAlso: '[data-family-part="rewards"] li' }),
  app('/tasks@tutor-add-reward', '/tasks', 'money-tutor', ...opens('[data-family-part="rewards"] > .lf-button-group button')),
  // GAP-FIX-R5 (D.23, D.18): a yes opens the reflective prompt; a "not yet" goes through the prompt to the reason form.
  app('/tasks@queue-reflection', '/tasks', 'money-tutor', ...opens(QUEUE.yes)),
  app('/tasks@queue-not-yet', '/tasks', 'money-tutor', QUEUE.notYet, { open: [QUEUE.notYet, QUEUE.reflect], firstView: false }),
  app('/tasks@tutor-empty', '/tasks', 'money-tutor-empty', '[data-screen="tutor-tasks"] .lf-state--empty'),
  app('/tasks@tutor-offline', '/tasks', 'money-tutor-offline', '[data-screen="tutor-tasks"] .lf-state--error'),
  app('/tasks@child', '/tasks', 'money-child', ready.childTasks, { readyAlso: '[data-family-part="payouts"]' }),
  app('/tasks@split-confirmed', '/tasks', 'money-child', ...splitPress('child-tasks')),
  // GAP-FIX-R5 (D.18, D.17): the child's reward ask with its reasons, the ask for the next level, and stepping down.
  app('/tasks@reward-ask', '/tasks', 'money-child', ...opens('[data-autonomy="reward-ask"] button[data-reward-ask="open"]:not([disabled])')),
  app('/tasks@level-ask', '/tasks', 'money-child', ...opens('[data-autonomy="my-level"] button[data-level-control="ask"]')),
  app('/tasks@level-step-down', '/tasks', 'money-child-level2', ...opens('[data-autonomy="my-level"] button[data-level-control="step-down"]')),
  app('/tasks@child-new', '/tasks', 'money-child-new', '[data-screen="child-tasks"] [data-family-part="chores"]'),
  app('/tasks@child-offline', '/tasks', 'money-child-offline', '[data-screen="child-tasks"] .lf-state--error'),
  app('/tasks@teen-linked', '/tasks', 'money-teen-linked', ready.childTasks),
  app('/family-wallet@tutor', `/family-wallet?child=${KID_A}`, 'money-tutor', ready.tutorCoins, { readyAlso: '[data-family-part="limit"]' }),
  // GAP-FIX-R5 (D.11, D.7): the bonus settings in the young framing (KID_A) and the teen framing (KID_B), and the freeze confirmation.
  app('/family-wallet@bonus-settings', `/family-wallet?child=${KID_A}`, 'money-tutor', ...opensAfter(TUTOR_CARD, PANEL.bonus)),
  app('/family-wallet@bonus-settings-teen', `/family-wallet?child=${KID_B}`, 'money-tutor', ...opensAfter(TUTOR_CARD, PANEL.bonus)),
  app('/family-wallet@freeze-confirm', `/family-wallet?child=${KID_A}`, 'money-tutor', ...opens(`${TUTOR_CARD} button[data-freeze-control="ask"]`)),
  // GAP-FIX-R5 (D.1, D.7): a frozen card, for the Tutor (the child froze it) and for the child (a Tutor froze it).
  app('/family-wallet@tutor-frozen', `/family-wallet?child=${KID_A}`, 'money-tutor-frozen', `${TUTOR_CARD}[data-frozen="true"][data-by="child"]`),
  app('/family-wallet@child-frozen', '/family-wallet', 'money-child-frozen', '[data-coin-account="child"] [data-control="freeze"][data-frozen="true"][data-by="tutor"]',
    { readyAlso: ready.childCoins }),
  // The details a frozen card keeps one press away (06 §4.4): who froze it, what pauses, that waiting coins wait, who can lift it.
  app('/family-wallet@child-frozen-why', '/family-wallet', 'money-child-frozen', ...opens('[data-coin-account="child"] button[data-freeze-control="holds"]')),
  app('/family-wallet@tutor-frozen-holds', `/family-wallet?child=${KID_A}`, 'money-tutor-frozen', ...opens(`${TUTOR_CARD}[data-frozen="true"] button[data-freeze-control="holds"]`)),
  app('/family-wallet@tutor-open-card', `/family-wallet?child=${KID_A}`, 'money-tutor-new', '[data-family-part="open-card"]'),
  app('/family-wallet@tutor-offline', '/family-wallet', 'money-tutor-offline', '[data-screen="tutor-coins"] .lf-state--error'),
  app('/family-wallet@child', '/family-wallet', 'money-child', ready.childCoins, { readyAlso: '[data-family-part="payouts"]' }),
  app('/family-wallet@split-confirmed', '/family-wallet', 'money-child', ...splitPress('child-coins')),
  app('/family-wallet@child-card', '/family-wallet', 'money-child', ...opens('[data-family-part="card-look"] button')),
  app('/family-wallet@teen-linked', '/family-wallet', 'money-teen-linked', ready.childCoins),
  app('/wallet@teen', '/wallet', 'money-teen', '[data-teen-wallet="root"] [data-pocket="save"]'),
  app('/wallet@teen-offline', '/wallet', 'money-teen-offline', '[data-teen-wallet="root"] .lf-state--error'),
];

const kid = (over) => ({ userId: KID_A, displayName: 'Sofía', username: 'sofia_2016', analyticsConsent: false, pendingApprovalCount: 2, walletTotal: 34,
  taskStreakDays: 6, accountType: 'child', profileReview: { flagged: false, fields: [] }, ...over });
const KIDS = {
  two: [kid({}), kid({ userId: KID_B, displayName: 'Mateo', username: 'mateo_teen', analyticsConsent: true, pendingApprovalCount: 0, walletTotal: 120,
    taskStreakDays: 0, accountType: 'teen', profileReview: { flagged: true, fields: ['displayName'] } })],
  one: [kid({})],
  flagged: [kid({ profileReview: { flagged: true, fields: ['username'] } })],
  none: [],
  coopTeen: [kid({ displayName: 'Valentina', username: 'vale_2011', pendingApprovalCount: 0 })],
  coopYoung: [kid({ displayName: 'Nico', username: 'nico_2014', pendingApprovalCount: 0 })],
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
/** Boards as Oracle stores them (the Mentor lane's wire), with each locale's words. */
const BOARD_WORDS = {
  bike: { 'en-US': 'Bike', 'es-MX': 'Bici', 'pt-BR': 'Bicicleta' },
  saved: { 'en-US': 'Saved', 'es-MX': 'Ahorrado', 'pt-BR': 'Poupado' },
  weekly: { 'en-US': 'Saving each week', 'es-MX': 'Ahorro cada semana', 'pt-BR': 'Poupança toda semana' },
};
const goalBoard = (locale) => ({ kind: 'goal_bar', goal: { label: BOARD_WORDS.bike[locale], value: 20 }, saved: { label: BOARD_WORDS.saved[locale], value: 5 }, remaining: 15,
  savedFraction: 0.25, label: '5 / 20', currency: null });
const yourTurnBoard = (locale) => ({ kind: 'your_turn', start: 5, steps: [{ op: 'add', value: 5 }], givenCount: 1, unit: 'week', values: [10, 15, 20],
  label: BOARD_WORDS.weekly[locale], currency: null });
const transcript = (locale, id, drawn) => ({
  session: session({ id }),
  turns: LINES[locale].map((text, index) => ({ id: `${id}-t${index}`, seq: index + 1, speaker: index === 1 ? 'learner' : 'tutor', text, emotion: null, action: null,
    audio_path: null, source: 'model', created_at: `2026-09-20T10:00:0${index * 3}.000Z`, roleplay_scene: null, point_at: null,
    whiteboard: index === 2 ? goalBoard(locale) : index === 0 && drawn ? yourTurnBoard(locale) : null,
    demonstrate: index === 2 ? [{ kind: 'add', denomination: 5 }, { kind: 'add', denomination: 5 }] : null })),
  segments: [{ segmentId: `${id}-seg`, seq: 1, origin: 'catalog', segment: { type: 'choice', prompt_md: LINES[locale][2] }, score: 80, xpAwarded: 12, createdAt: '2026-09-20T10:00:04.000Z' }],
});
const SKILL = { 'en-US': 'Counting coins', 'es-MX': 'Contar monedas', 'pt-BR': 'Contar moedas' };
const NOTES = {
  'en-US': ['Loves bikes.', 'Loves bikes and is saving for one.'],
  'es-MX': ['Le encantan las bicis.', 'Le encantan las bicis y ahorra para una.'],
  'pt-BR': ['Adora bicicletas.', 'Adora bicicletas e está poupando para uma.'],
};
const CHOICES = {
  'en-US': ['A friend asks to borrow the coins saved for the bike.', 'Lend half and keep saving.'],
  'es-MX': ['Un amigo pide prestadas las monedas ahorradas para la bici.', 'Prestar la mitad y seguir ahorrando.'],
  'pt-BR': ['Um amigo pede emprestadas as moedas guardadas para a bicicleta.', 'Emprestar metade e continuar poupando.'],
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
  // A child's goals as Core returns them to a Tutor (with provenance, D.16): one reached (the console's shareable picture), one still saving.
  if (/^\/tasks\/[^/]+\/goals$/.test(path) && get) return ok({ goals: kidGoals(locale) });
  if (/^\/tutor\/kids\/[^/]+\/sessions$/.test(path)) return family.history === 'forbidden' ? refuse(403, 'FORBIDDEN') : ok(history(locale, family.history === 'quiet'));
  const sessionMatch = path.match(/^\/tutor\/sessions\/([^/]+)$/);
  if (sessionMatch) return ok(transcript(locale, sessionMatch[1], family.boards === 'drawn'));
  if (/^\/tutor\/kids\/[^/]+\/memory-proposals$/.test(path)) return ok(family.history === 'quiet' ? { current: { learner: null, pedagogy: null }, proposals: [] }
    : { current: { learner: NOTES[locale][0], pedagogy: null }, proposals: [{ id: 'note-1', store: 'learner', proposed: NOTES[locale][1], expectedBefore: NOTES[locale][0], sessionId: SESSION_A, createdAt: T }] });
  // GAP-FIX-R2: what the Mentor decided (numbers and closed labels; the page phrases them).
  if (/^\/tutor\/kids\/[^/]+\/mastery$/.test(path)) return ok(family.history === 'quiet' ? { items: [] } : { items: [
    { kcKey: 'money.count-coins', title: SKILL[locale], state: 'provisional_mastered', correctInARow: 2, attempts: 5,
      decision: { kind: 'mastered', observations: 2, required: 2, discounted: 'too_fast', decidedAt: T }, nextCheckAt: '2026-10-04T09:00:00Z' },
  ] });
  if (/^\/tutor\/kids\/[^/]+\/disposition$/.test(path) && get) return ok({ exists: true, current: true, sessionsObserved: 7, helpStyle: 'independent', persistence: 'persists',
    explanation: 'explains', persistentlyDeclined: [], typicalReplySeconds: 9, personas: [], effects: [], updatedAt: T });
  if (/^\/tutor\/kids\/[^/]+\/plan$/.test(path)) return ok({ plan: family.history === 'quiet' ? null
    : { content: goalBoard(locale), sessionId: SESSION_A, updatedAt: T } });
  if (/^\/tutor\/kids\/[^/]+\/notebook$/.test(path)) return ok({ entries: family.boards === 'drawn'
    ? [{ id: 'kept-1', whiteboard: yourTurnBoard(locale), sessionId: SESSION_A, turnSeq: 1, keptAt: T }] : [] });
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
  if (/^\/tutor\/memory-proposals\/[^/]+\/decision$/.test(path)) return ok({ outcome: 'approved', applied: true, store: 'learner' });
  if (/^\/tutor\/kids\/[^/]+\/disposition$/.test(path) && request.method === 'DELETE') return ok({ reset: true });
  // The wave-1 surfaces the console composes: what each reads when it mounts.
  if (path === '/family-hub/coaching') return ok({ tip: { deliveryId: '99999999-9999-4999-8999-999999999999', tipId: 'keep-promises', period: '2026-09', opened: false, dismissed: false } });
  if (path === '/family-hub/data-policy') return ok({ classes: POLICY });
  if (path === '/family-hub/deletion-notices' && get) return ok({ notices: family.deletionNotice
    ? [{ id: '77777777-7777-4777-8777-777777777777', teenUserId: KID_B, displayName: 'Mateo', scheduledFor: '2026-10-12T10:00:00.000Z', notifiedAt: T }] : [] });
  if (path === '/family/guardian-links/mine') return ok({ links: [] });
  // GAP-FIX-R3: Core's mint answer (201 { token, expiresAt }); the page builds the link from the token.
  if (/^\/family\/kids\/[^/]+\/guardian-invite$/.test(path) && request.method === 'POST') return ok({ token: 'auditInviteToken0123456789ab', expiresAt: '2026-09-27T10:00:00.000Z' });
  if (/^\/family\/learning\/kids\/[^/]+\/bridges$/.test(path)) return ok({ prompts: [] });
  // OD-27 (3): a parent-created child under 13 shares the chosen options; a teen's journal is private (Core's JOURNAL_PRIVATE).
  const decisions = path.match(/^\/family\/learning\/kids\/([^/]+)\/decisions$/)?.[1];
  if (decisions && get) return decisions === KID_B ? refuse(403, 'JOURNAL_PRIVATE')
    : ok({ locale, entries: [{ id: 'decision-1', courseTitle: TITLES.course[locale], lessonTitle: TITLES.goals[locale], situation: CHOICES[locale][0],
      choice: CHOICES[locale][1], recordedAt: T }], hasMore: false });
  if (/^\/family\/learning\/kids\/[^/]+\/streak$/.test(path)) return ok({ streak: { model: 'rest-days-v1', status: 'open', current: 4, best: 9, daysPracticed: 21,
    restDaysLeft: 1, lastActiveDate: '2026-09-24', pause: null } });
  if (family.kids) {
    const answer = social({ family, locale, path, request, ok });
    if (answer !== undefined) return answer;
    const blockD = tutorBlockD({ locale, path, request, ok });
    if (blockD !== undefined) return blockD;
  }
  return undefined;
}

// ── GAP-FIX-R5: the Tutor-side Block D reads behind each per-child panel, in Core's real shapes ─────────────

const KID_ROUTE = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const LINK = (n) => `cccccccc-cccc-4ccc-8ccc-00000000000${n}`;
const ACTION = (n) => `dddddddd-dddd-4ddd-8ddd-00000000000${n}`;
const PLACE = (n) => `88888888-8888-4888-8888-88888888888${n}`;
const GIFT = (n) => `99999999-9999-4999-8999-99999999998${n}`;
const GOAL_SAVING = '66666666-6666-4666-8666-666666666667';
/** What a Tutor typed (reasons, notes, places): user content, in each locale. */
const TYPED = {
  'en-US': { goal: 'Bike', helmet: 'Helmet', adjust: 'Coins from grandma', move: 'The helmet costs more than we thought', place: 'Food bank', park: 'Park cleanup',
    given: 'We gave it together on Saturday', level: 'You finished every chore this month' },
  'es-MX': { goal: 'Bici', helmet: 'Casco', adjust: 'Monedas de la abuela', move: 'El casco cuesta más de lo que pensamos', place: 'Banco de alimentos',
    park: 'Limpieza del parque', given: 'Lo entregamos juntos el sábado', level: 'Terminaste todas tus tareas este mes' },
  'pt-BR': { goal: 'Bicicleta', helmet: 'Capacete', adjust: 'Moedas da vovó', move: 'O capacete custa mais do que pensamos', place: 'Banco de alimentos',
    park: 'Limpeza do parque', given: 'Entregamos juntos no sábado', level: 'Você terminou todas as tarefas este mês' },
};
const typed = (locale) => TYPED[locale] ?? TYPED['en-US'];
const kidGoals = (locale) => [
  { id: GOAL, title: typed(locale).goal, target: 20, icon: 'bike', status: 'reached', reachedAt: T, followsGoalId: null, saved: 20,
    progress: { own: 16, bonus: 2, family: 2, total: 20 }, nextStep: null },
  { id: GOAL_SAVING, title: typed(locale).helmet, target: 30, icon: 'star', status: 'active', reachedAt: null, followsGoalId: GOAL, saved: 12,
    progress: { own: 9, bonus: 1, family: 2, total: 12 }, nextStep: null },
];
/** OD-21: this Tutor, a second verified Tutor, a pending second Tutor waiting for a decision, and one who stepped away. */
const guardians = () => [
  { linkId: LINK(1), displayName: 'Ana', status: 'verified', isMe: true, since: '2026-03-02T10:00:00.000Z', decidedAt: '2026-03-02T10:00:00.000Z', revokedAt: null },
  { linkId: LINK(2), displayName: 'Carlos', status: 'verified', isMe: false, since: '2026-04-11T10:00:00.000Z', decidedAt: '2026-04-12T10:00:00.000Z', revokedAt: null },
  { linkId: LINK(3), displayName: 'Lucía', status: 'pending', isMe: false, since: at(24), decidedAt: null, revokedAt: null },
  { linkId: LINK(4), displayName: null, status: 'revoked', isMe: false, since: '2026-05-01T10:00:00.000Z', decidedAt: '2026-05-02T10:00:00.000Z', revokedAt: at(10) },
];
const guardianActions = (locale) => [
  { id: ACTION(1), kind: 'goal_withdrawal', bucket: 'save', goalId: GOAL_SAVING, amount: 4, reason: typed(locale).move, byMe: false, createdAt: at(23) },
  { id: ACTION(2), kind: 'manual_adjustment', bucket: 'spend', goalId: null, amount: 5, reason: typed(locale).adjust, byMe: true, createdAt: at(21) },
];
const kidShare = (locale) => ({
  destinations: [
    { id: PLACE(1), title: typed(locale).place, kind: 'charity', chosenBy: 'tutor', status: 'active', createdAt: T },
    { id: PLACE(2), title: typed(locale).park, kind: 'community', chosenBy: 'holder', status: 'active', createdAt: T },
  ],
  gifts: [
    { id: GIFT(1), destinationId: PLACE(1), amount: 3, status: 'pledged', pledgedAt: at(24), settledAt: null, settledBy: null, note: null },
    { id: GIFT(2), destinationId: PLACE(2), amount: 2, status: 'given', pledgedAt: at(12), settledAt: at(14), settledBy: 'tutor', note: typed(locale).given },
  ],
});
/** D.17: a child at level 2 with a pre-approved limit, the next level not yet reached. */
const LEVEL2 = { inFamily: true, level: 2, storedLevel: 2, levelSince: '2026-08-30T10:00:00.000Z', preapprovedLimit: 10, preapprovedCap: 20,
  unlocks: { selfLogContributions: true, selfLogMaxCoins: null },
  next: { level: 3, eligible: false, age: { value: 9, min: 10, ok: false }, approved: { value: 12, min: 20 }, notApproved: { value: 1, maxPct: 25, ok: true },
    daysAtLevel: { value: 27, min: 60, ok: false }, windowDays: 60 }, request: null };
/** The Tutor's own change, with the reason the child reads. */
const levelChanges = (locale) => [{ id: ACTION(3), fromLevel: 1, toLevel: 2, fromLimit: 0, toLimit: 10, by: 'tutor', byMe: true, reasonCode: null,
  reason: typed(locale).level, createdAt: '2026-08-30T10:00:00.000Z' }];
const KID_STREAK = { status: 'alive', current: 4, best: 9, totalDays: 30, restDaysLeftThisWeek: 1, restDaysPerWeek: 2, pausedUntil: null, today: '2026-09-26' };
const KID_PAUSES = [{ id: '77777777-7777-4777-8777-777777777772', startsOn: '2026-10-10', endsOn: '2026-10-17', state: 'upcoming' }];

/** The reads behind the Tutor's per-child Block D panels (Family console and Wallet), made only once a panel is opened. */
function tutorBlockD({ locale, path, request, ok }) {
  if (request.method !== 'GET') return undefined;
  const kid = (pattern) => path.match(new RegExp(`^${pattern.replace('KID', `(${KID_ROUTE})`)}$`))?.[1];
  if (kid('/family/kids/KID/guardians')) return ok({ guardians: guardians() });
  if (kid('/tasks/KID/wallet/guardian-actions')) return ok({ actions: guardianActions(locale) });
  // The Tutor's reward requests for one child: one approved and waiting to be delivered, one still asked.
  if (path === '/tasks/redemptions') return ok({ redemptions: [
    rewardRequest({ id: '77777777-7777-4777-8777-777777777773', status: 'approved', decidedAt: at(24), decidedBy: PARENT }),
    rewardRequest({}),
  ] });
  if (path === '/tasks/catalog') return ok({ items: rewards(WORDS[locale] ?? WORDS['en-US']) });
  if (kid('/tasks/KID/streak')) return ok({ streak: KID_STREAK, pauses: KID_PAUSES });
  if (kid('/tasks/KID/share')) return ok(kidShare(locale));
  if (kid('/tasks/KID/wallet/split')) return ok(SPLIT);
  if (kid('/tasks/KID/autonomy')) return ok({ autonomy: LEVEL2, changes: levelChanges(locale) });
  if (kid('/family-hub/kids/KID/research')) return ok(RESEARCH);
  return undefined;
}

// ── GAP-FIX-R4: the Connections slot, the safety notices and goals together, in Core's real shapes ─────────────

const FRIEND = (n) => `bbbbbbbb-bbbb-4bbb-8bbb-00000000000${n}`;
const friend = (n, displayName, username) => ({ userId: FRIEND(n), displayName, username, avatarOptions: {}, isTutor: false });
const PEOPLE = { followers: [friend(1, 'Leo', 'leo_reads'), friend(2, 'Mar', 'mar_2015')], following: [friend(1, 'Leo', 'leo_reads'), friend(3, 'Sol', 'sol_sings')] };
const at = (day) => `2026-09-${String(day).padStart(2, '0')}T16:00:00.000Z`;
const socialHistory = () => [
  { id: 9, actorId: null, action: 'social.coop_goal_closed', sourceId: null, targetId: null, createdAt: at(24), goalId: GOAL, reason: 'ended', target: null, sourceName: null, targetName: null, actorName: null },
  { id: 8, actorId: FRIEND(1), action: 'social.coop_member_ended', sourceId: FRIEND(1), targetId: KID_A, createdAt: at(23), goalId: GOAL, reason: 'removed', target: null,
    sourceName: 'Leo', targetName: 'Sofía', actorName: 'Leo' },
  { id: 7, actorId: KID_A, action: 'social.coop_member_invited', sourceId: KID_A, targetId: FRIEND(2), createdAt: at(22), goalId: GOAL, reason: null, target: null,
    sourceName: 'Sofía', targetName: null, actorName: 'Sofía' },
  { id: 6, actorId: KID_A, action: 'social.coop_goal_created', sourceId: KID_A, targetId: KID_A, createdAt: at(22), goalId: GOAL, reason: null, target: 10,
    sourceName: 'Sofía', targetName: 'Sofía', actorName: 'Sofía' },
  { id: 5, actorId: FRIEND(9), action: 'social.coop_guardian_enabled', sourceId: FRIEND(9), targetId: KID_A, createdAt: at(21), goalId: null, reason: null, target: null,
    sourceName: 'Ana', targetName: 'Sofía', actorName: 'Ana' },
  { id: 4, actorId: KID_A, action: 'social.follow', sourceId: KID_A, targetId: FRIEND(1), createdAt: at(20), sourceName: 'Sofía', targetName: 'Leo', actorName: 'Sofía' },
  { id: 3, actorId: KID_A, action: 'social.block', sourceId: KID_A, targetId: FRIEND(4), createdAt: at(19), sourceName: 'Sofía', targetName: null, actorName: 'Sofía' },
];
const BADGE = { 'en-US': 'Seven-day streak', 'es-MX': 'Racha de siete días', 'pt-BR': 'Sequência de sete dias' };
const coopView = (family) => family.coop === 'on' ? { ageFits: true, enabled: true, openGoals: 2 }
  : family.coop === 'off' ? { ageFits: true, enabled: false, openGoals: 0 } : { ageFits: false, enabled: false, openGoals: 0 };
const coopGoals = (family) => family.coop !== 'on' ? [] : [
  { id: GOAL, kind: 'lessons', target: 10, startsAt: at(20), endsAt: '2026-10-04T16:00:00.000Z', startedByChild: true, childStatus: 'joined',
    people: [{ name: 'Leo', status: 'joined' }, { name: null, status: 'asked' }, { name: 'Mar', status: 'left' }] },
  { id: '77777777-7777-4777-8777-777777777771', kind: 'lessons', target: 5, startsAt: at(24), endsAt: '2026-10-01T16:00:00.000Z', startedByChild: false,
    childStatus: 'asked', people: [{ name: 'Sol', status: 'joined' }] },
];

/** The Family Connections panels (E.1-E.3), the aside's safety notices, the older badge links (OD-20) and goals together (OD-27 (1)). */
function social({ family, locale, path, request, ok }) {
  const get = request.method === 'GET';
  const kidOf = (suffix) => path.match(new RegExp(`^/family/kids/([^/]+)${suffix}$`))?.[1];
  const graphKid = kidOf('/social');
  if (graphKid && get) {
    const direction = new URL(request.url).searchParams.get('direction') === 'following' ? 'following' : 'followers';
    // A parent-created child's connections are the Tutor's to end; a self-registered teen decides its own (E.8).
    return ok({ users: PEOPLE[direction], nextOffset: null, canEnd: graphKid !== KID_B });
  }
  if (kidOf('/social/requests') && get) return ok({ requests: [
    { requestId: '99999999-9999-4999-8999-999999999991', requesterId: FRIEND(5), requesterName: 'Nico', requestedAt: at(24), status: 'pending' },
    { requestId: '99999999-9999-4999-8999-999999999992', requesterId: FRIEND(6), requesterName: null, requestedAt: at(23), status: 'pending' },
  ], nextOffset: null });
  if (kidOf('/social/audit') && get) return ok({ entries: socialHistory(), nextOffset: null });
  if (path === '/family/social-notices' && get) return ok({ notices: [
    { noticeId: '99999999-9999-4999-8999-999999999993', kidUserId: KID_A, subjectId: FRIEND(1), subjectName: 'Leo', canEnd: true, createdAt: at(24) },
    { noticeId: '99999999-9999-4999-8999-999999999994', kidUserId: KID_A, subjectId: FRIEND(7), subjectName: null, canEnd: false, createdAt: at(22) },
  ], nextOffset: null });
  if (kidOf('/badges') && get) return ok({ shares: [{ token: 'auditShareToken0123456789ab', achievementLabel: BADGE[locale], createdAt: at(18), expiresAt: '2026-10-18T16:00:00.000Z' }] });
  if (/^\/family\/kids\/[^/]+\/social\/connections\/[^/]+$/.test(path) && request.method === 'DELETE') return ok({ ended: true, removed: 2 });
  if (/^\/family\/kids\/[^/]+\/social\/connections\/[^/]+\/report$/.test(path) && request.method === 'POST') return ok({ reported: true, reportId: '99999999-9999-4999-8999-999999999995' });
  if (/^\/family\/coop-goals\/kids\/[^/]+$/.test(path) && get) return ok(coopView(family));
  const coopKid = kidOf('/coop-goals');
  if (coopKid && get) return coopKid === KID_B ? refuse(403, 'ACCOUNT_SELF_MANAGED') : ok({ goals: coopGoals(family) });
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
/*
 * `frozen` (GAP-FIX-R5, D.1/D.7) names who froze the card: 'tutor' is read by the child (who cannot lift it), 'child' is read by
 * the Tutor (who always can). Core phrases the author from the reader's side ('you' for the reader's own freeze).
 */
const freeze = (frozen) => frozen === 'tutor' ? { frozen: true, by: 'tutor', since: at(25), holds: HOLDS, canChange: false }
  : frozen === 'child' ? { frozen: true, by: 'child', since: at(25), holds: HOLDS, canChange: true }
    : { frozen: false, by: null, since: null, holds: HOLDS, canChange: true };
const card = (w, frozen) => ({ nickname: w.card, design: 'ocean', simulated: true, freeze: freeze(frozen) });
const legacyAccount = (w, frozen) => ({ nickname: w.card, cardDesign: 'ocean', frozen: Boolean(frozen), frozenBy: frozen === 'tutor' ? PARENT : frozen ? KID_A : null,
  frozenAt: frozen ? at(25) : null, openedAt: T });
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
    if (account && get) return ok({ account: fresh && account[1] === KID_A ? null : legacyAccount(w, family.frozen) });
    const frozenKid = path.match(/^\/banking\/accounts\/([^/]+)\/freeze$/)?.[1];
    if (frozenKid && get) return ok({ register: frozenKid === KID_B ? 'teen' : 'young', account: card(w, family.frozen) });
    // D.11: the bonus in the framing the child's age calls for (per ten coins for a young child, a percentage for a teen).
    const bonusKid = path.match(/^\/banking\/savings-bonus\/([^/]+)$/)?.[1];
    if (bonusKid && bonusKid !== 'example' && get) return ok(bonusKid === KID_B
      ? { framing: 'percent', perTen: null, maxRateBp: 2000, rule: { rateBp: 1000, active: true, nextRunAt: '2026-10-01T00:00:00.000Z' } }
      : { framing: 'per_ten', perTen: { unit: 10, coins: 1 }, maxRateBp: null, rule: { rateBp: 1000, active: true, nextRunAt: '2026-10-01T00:00:00.000Z' } });
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
  // Spend covers the cheaper reward and not the dearer one, so the child meets both an ask and a "not enough yet" (D.18).
  if (path === '/tasks/wallet') return ok({ balances: { save: 20, spend: 16, share: 3 } });
  if (path === '/tasks/catalog/available') return ok({ items: fresh ? [] : rewards(w).map((r) => ({ ...r, active: true })) });
  if (path === '/tasks/redemptions/mine') return ok({ redemptions: [] });
  if (path === '/tasks/wallet/ledger') return ok({ entries: [] });
  if (path === '/tasks/streak') return ok({ streak: STREAK });
  if (path === '/tasks/autonomy' && get) return ok({ autonomy: family.autonomy === 'level2' ? LEVEL2 : AUTONOMY, changes: [] });
  if (path === '/tasks/decisions/mine') return ok({ decisions: [] });
  if (path === '/tasks/goals' && get) return ok({ goals: fresh ? [] : [goal(w)] });
  if (path === '/tasks/wallet/split' && get) return ok(SPLIT);
  if (path === '/tasks/share' && get) return ok({ destinations: fresh ? [] : [{ id: '88888888-8888-4888-8888-888888888888', title: w.place, kind: 'charity',
    chosenBy: 'tutor', status: 'active', createdAt: T }], gifts: [] });
  if (path === '/banking/account' && get) return ok({ account: legacyAccount(w, family.frozen) });
  if (path === '/banking/account' && request.method === 'PATCH') {
    const sent = request.postData ? JSON.parse(request.postData) : {};
    return ok({ account: { ...legacyAccount(w), nickname: sent.nickname, cardDesign: sent.cardDesign } });
  }
  if (/^\/tasks\/[^/]+\/evidence$/.test(path)) return { status: 404, body: { data: null, error: { code: 'NOT_FOUND', message: 'Synthetic' } } };
  // GAP-FIX-R4: a split the child confirms (Core's answer shapes; this synthetic Core keeps no state, so the payout re-reads unchanged).
  if (/^\/tasks\/[^/]+\/allocate$/.test(path) && request.method === 'POST') return ok({ allocated: true, goal: null });
  if (/^\/banking\/wallet\/pending-credits\/[^/]+\/allocate$/.test(path) && request.method === 'POST') return ok({ allocated: true });
  if (path === '/banking/wallet/pending-credits') return ok({ credits: fresh ? [] : [{ id: '99999999-9999-4999-8999-999999999990', amount: 10, source: 'allowance', createdAt: T }] });
  if (path === '/banking/overview') return ok({ register, account: card(w, family.frozen), pockets: { save: 20, spend: 16, share: 3 }, pendingCredits: fresh ? 0 : 1,
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
