import { app, preview } from './helpers.mjs';

/*
 * Lane 2 (learn): the lesson player and teaching boards on the preview entry,
 * at the ages each one serves (as the S05 matrices run them), and the real
 * lesson route in every state it can show (S03.5/S03.6), signed in and
 * answered by the synthetic Core.
 */
export const lane = 'learn';

const lessonSurfaces = [
  ['lesson', ['6-9', 'adult']], ['waffle', ['6-9']], ['donut', ['10-12']], ['ratiotable', ['10-12']], ['timeline', ['6-9', 'adult']],
  ['sequence', ['6-9']], ['numberline', ['6-9', '10-12']], ['goal', ['6-9', 'adult']], ['percent', ['10-12']], ['placevalue', ['6-9']],
  ['rulebuilder', ['10-12']], ['ledger', ['13-17']], ['growthcompare', ['13-17']], ['taxbracket', ['13-17']], ['fractionline', ['10-12']],
  ['fractionarea', ['6-9']], ['barmodel', ['10-12']], ['schemadiagram', ['10-12']], ['workedexample', ['10-12']], ['functionmachine', ['10-12']],
  ['cpafading', ['6-9', '10-12']], ['result', ['6-9']], ['replay', ['6-9']], ['upgrade', ['6-9']], ['invalid', ['6-9']], ['opening', ['6-9']],
  ['offline', ['6-9']], ['loaderror', ['6-9']], ['resultbadge', ['6-9']],
  // W2L.4 (OD-27 (3)): the Tutor's view of an under-13 child's story choices, at the adult budget it is written to.
  ['childdecisions', ['adult']],
];

export const states = [
  ...lessonSurfaces.flatMap(([screen, ages]) => ages.map((age) => preview(`${screen}@${age}`, { screen, age }))),
  // The lesson route mounts the rebuilt lesson inside the design-system root (S03.6): every screen it can show.
  app('/learn/lesson@goal-6-9', '/learn/lesson/audit-goal', 'lesson-goal', '[data-screen="goal"]'),
  app('/learn/lesson@allocation-adult', '/learn/lesson/audit-allocation', 'lesson-allocation', '[data-screen="lesson"]'),
  app('/learn/lesson@function-machine-10-12', '/learn/lesson/audit-machine', 'lesson-function-machine', '[data-screen="function-machine"]'),
  app('/learn/lesson@opening', '/learn/lesson/audit-opening', 'lesson-opening', '[data-screen="lesson-opening"]'),
  app('/learn/lesson@offline', '/learn/lesson/audit-offline', 'lesson-offline', '[data-screen="lesson-offline"]'),
  app('/learn/lesson@load-error', '/learn/lesson/audit-error', 'lesson-load-error', '[data-screen="lesson-load-error"]'),
  app('/learn/lesson@placement', '/learn/lesson/audit-placement', 'lesson-placement', '[data-screen="lesson-placement"]'),
  app('/learn/lesson@eligibility-required', '/learn/lesson/audit-required', 'lesson-eligibility-required', '[data-screen="lesson-eligibility-required"]'),
  app('/learn/lesson@eligibility-restricted', '/learn/lesson/audit-restricted', 'lesson-eligibility-restricted', '[data-screen="lesson-eligibility-restricted"]'),
  app('/learn/lesson@eligibility-unavailable', '/learn/lesson/audit-unavailable', 'lesson-eligibility-unavailable', '[data-screen="lesson-eligibility-unavailable"]'),
  // W2L.3: Core's refusals that no retry can change, each its own screen in the lesson layer.
  app('/learn/lesson@locked', '/learn/lesson/audit-locked', 'lesson-locked', '[data-screen="lesson-locked"]'),
  app('/learn/lesson@prerequisite', '/learn/lesson/audit-prerequisite', 'lesson-prerequisite', '[data-screen="lesson-prerequisite"]'),
  app('/learn/lesson@not-found', '/learn/lesson/audit-not-found', 'lesson-not-found', '[data-screen="lesson-not-found"]'),
];

/*
 * W2L.1: the learner home (L1) and the one course screen (L2) on their real
 * routes inside the learner shell, and the journal and rhythm moved onto it,
 * for each population they serve: a parent-created child on the linear
 * engine, an independent teen and an adult on the pathway engine, the B.3
 * unavailable course, the B.2 prerequisite and the age safeguard (OD-16).
 */
const learner = (id, path, scenario, ready) => app(id, path, scenario, ready, { readyAlso: '[data-shell="learner"] [data-nav-id="mentor"]' });
states.push(
  learner('/learn@home-child-6-9', '/learn', 'learn-home-child', '[data-screen="learn-home"][data-state="ready"] .lf-learn-hero[data-step="lesson"]'),
  learner('/learn@home-teen-pathway', '/learn', 'learn-home-teen', '[data-screen="learn-home"][data-state="ready"] .lf-bridge-self'),
  learner('/learn@home-young-closed', '/learn', 'learn-home-young', '[data-screen="learn-home"] [data-closed="true"]'),
  learner('/learn@home-unavailable', '/learn', 'learn-home-unavailable', '[data-screen="learn-home"] .lf-banner'),
  learner('/learn@home-empty', '/learn', 'learn-home-empty', '[data-screen="learn-home"] .lf-state--empty'),
  learner('/learn@home-error', '/learn', 'learn-home-error', '[data-screen="learn-home"] .lf-state--error'),
  learner('/learn/:course@linear-child', '/learn/financial-education', 'learn-home-child', '[data-screen="course-path"][data-engine="linear"] .lf-course-path-chapter-toggle'),
  learner('/learn/:course@pathway-adult', '/learn/financial-education', 'learn-course-adult', '[data-screen="course-path"][data-engine="pathway"]'),
  learner('/learn/:course@placement-teen', '/learn/entrepreneurship', 'learn-home-teen', '[data-screen="course-path"] [data-step="placement"]'),
  learner('/learn/:course@prerequisite', '/learn/investing', 'learn-home-child', '[data-screen="course-path-prerequisite"] .lf-list-row'),
  learner('/learn/:course@age-restricted', '/learn/investing', 'learn-home-young', '[data-screen="course-path-age-restricted"]'),
  learner('/learn/journal@teen', '/learn/journal', 'learn-home-teen', '[data-screen="journal"]'),
  learner('/learn/rhythm@child', '/learn/rhythm', 'learn-home-child', '[data-screen="rhythm"]'),
  // W2L.2: the course world (L3) on its real route, both engines, the placement owed, the age safeguard.
  learner('/learn/:course/territory@linear-child', '/learn/financial-education/territory', 'learn-home-child', '[data-screen="territory"] .lf-territory-world--here'),
  learner('/learn/:course/territory@pathway-teen', '/learn/financial-education/territory', 'learn-home-teen', '[data-screen="territory"] .lf-course-path-note'),
  learner('/learn/:course/territory@placement-teen', '/learn/entrepreneurship/territory', 'learn-home-teen', '[data-screen="territory"] [data-step="placement"]'),
  learner('/learn/:course/territory@age-restricted', '/learn/investing/territory', 'learn-home-young', '[data-screen="territory-age-restricted"]'),
  preview('learnhome@6-9', { screen: 'learnhome', age: '6-9' }),
  preview('learnhome-teen@13-17', { screen: 'learnhome', home: 'teen', age: '13-17', bridges: '1', rhythm: 'resting' }),
  preview('learnhome-loading@6-9', { screen: 'learnhome', home: 'loading', age: '6-9' }),
  preview('learnhome-offline@6-9', { screen: 'learnhome', home: 'offline', age: '6-9' }),
  preview('learnhome-refused@adult', { screen: 'learnhome', home: 'refused', age: 'adult' }),
  preview('course-linear@6-9', { screen: 'course', course: 'linear', age: '6-9', building: '1' }),
  preview('course-linear-placement@10-12', { screen: 'course', course: 'linear-placement', age: '10-12' }),
  preview('course-pathway@6-9', { screen: 'course', course: 'pathway', age: '6-9' }),
  preview('course-empty@6-9', { screen: 'course', course: 'empty', age: '6-9' }),
  preview('course-offline@6-9', { screen: 'course', course: 'offline', age: '6-9' }),
  preview('course-not-found@6-9', { screen: 'course', course: 'not-found', age: '6-9' }),
  preview('course-refused@adult', { screen: 'course', course: 'refused', age: 'adult' }),
  // W2L.4 (OD-25): the one-stage-early chapter and the Mentor-mastery topic, each a question the learner answers.
  preview('coursepath-offers@10-12', { screen: 'coursepath', path: 'offers', age: '10-12' }),
);

/*
 * W2L.2: the placement flow (L4) on its real route, a full-screen single-state layer outside the learner
 * shell, reached step by step with real presses: welcome, the 12+ opener, a question, the outcome and the
 * learner's own adjustment.
 */
const placementState = (id, scenario, ready, open) => app(`/learn/:course/placement@${id}`, '/learn/financial-education/placement', scenario,
  '[data-shell="single-state"] [data-screen="placement-welcome"]', open ? { open, readyAlso: ready } : { readyAlso: ready });
states.push(
  placementState('welcome-child', 'learn-home-child', '[data-screen="placement-welcome"] [data-mentor-character="zara"] img'),
  placementState('intake-teen', 'learn-home-teen', '[data-mentor-character="dina"] img', ['[data-screen="placement-welcome"] .lf-button--accent']),
  placementState('question-child', 'learn-home-child', '[data-mentor-character="zara"] img', ['[data-screen="placement-welcome"] .lf-button--accent']),
  placementState('outcome-child', 'learn-home-child', '[data-mentor-character="zara"] img', ['[data-screen="placement-welcome"] .lf-button--accent', '[data-screen="placement-question"] .lf-choice']),
  placementState('adjust-adult', 'learn-course-adult', '[data-screen="placement-welcome"]', ['[data-screen="placement-welcome"] .lf-button--accent',
    '[data-screen="placement-intake"] .lf-actions .lf-button--secondary', '[data-screen="placement-question"] .lf-choice',
    '[data-screen="placement-outcome"] .lf-actions .lf-button--secondary']),
  preview('territory@6-9', { screen: 'territory', map: 'linear', age: '6-9' }),
  preview('territory-pathway@13-17', { screen: 'territory', map: 'pathway', age: '13-17' }),
  preview('territory-placement@10-12', { screen: 'territory', map: 'placement', age: '10-12' }),
  preview('territory-loading@6-9', { screen: 'territory', map: 'loading', age: '6-9' }),
  preview('territory-offline@6-9', { screen: 'territory', map: 'offline', age: '6-9' }),
  preview('territory-prerequisite@6-9', { screen: 'territory', map: 'prerequisite', age: '6-9' }),
  preview('placement-welcome@6-9', { screen: 'placement', flow: 'welcome', age: '6-9' }),
  preview('placement-intake@13-17', { screen: 'placement', flow: 'intake', age: '13-17', mentor: 'rho' }),
  preview('placement-reflection@13-17', { screen: 'placement', flow: 'reflection', age: '13-17' }),
  preview('placement-question@6-9', { screen: 'placement', flow: 'question', age: '6-9', mentor: 'none' }),
  preview('placement-confirm@6-9', { screen: 'placement', flow: 'confirm', age: '6-9', mentor: 'liruf' }),
  preview('placement-outcome@6-9', { screen: 'placement', flow: 'outcome', age: '6-9' }),
  preview('placement-capped@10-12', { screen: 'placement', flow: 'capped', age: '10-12' }),
  preview('placement-adjust@6-9', { screen: 'placement', flow: 'adjust', age: '6-9', mentor: 'dina' }),
  preview('placement-save-error@6-9', { screen: 'placement', flow: 'save-error', age: '6-9' }),
  preview('placement-step-offline@6-9', { screen: 'placement', flow: 'step-offline', age: '6-9' }),
  preview('placement-age@6-9', { screen: 'placement', flow: 'age', age: '6-9' }),
);

export const scenarios = {
  'lesson-goal': { population: 'parent-created child 6-9', guest: false, ageBand: '6-9', lesson: 'goal' },
  'lesson-allocation': { population: 'adult', guest: false, ageBand: 'adult', lesson: 'allocation', graded: true, mentorStage: { character: 'zara', scene: 'diorama-a' } },
  'lesson-function-machine': { population: 'parent-created child 10-12', guest: false, ageBand: '10-12', lesson: 'functionMachine', graded: true },
  'lesson-opening': { population: 'parent-created child 6-9', guest: false, ageBand: '6-9', hold: true },
  'lesson-offline': { population: 'parent-created child 6-9', guest: false, ageBand: '6-9', fail: 'InternetDisconnected' },
  'lesson-load-error': { population: 'independent teen 13-17', guest: false, ageBand: '13-17', error: [500, 'INTERNAL'] },
  'lesson-placement': { population: 'parent-created child 10-12', guest: false, ageBand: '10-12', error: [403, 'PLACEMENT_REQUIRED'] },
  'lesson-eligibility-required': { population: 'adult', guest: false, ageBand: 'adult', error: [403, 'LESSON_AGE_ELIGIBILITY_REQUIRED'] },
  'lesson-eligibility-restricted': { population: 'parent-created child 6-9', guest: false, ageBand: '6-9', error: [403, 'LESSON_AGE_RESTRICTED'] },
  'lesson-eligibility-unavailable': { population: 'independent teen 13-17', guest: false, ageBand: '13-17', error: [409, 'LESSON_ELIGIBILITY_MISSING'] },
  'lesson-locked': { population: 'parent-created child 6-9', guest: false, ageBand: '6-9', error: [403, 'LESSON_LOCKED'] },
  'lesson-prerequisite': { population: 'parent-created child 10-12', guest: false, ageBand: '10-12', error: [403, 'COURSE_PREREQUISITE_REQUIRED'] },
  'lesson-not-found': { population: 'independent teen 13-17', guest: false, ageBand: '13-17', error: [404, 'NOT_FOUND'] },
  // W2L.1. `shelf` is what GET /learn/courses answers; `engine` which course engine Core runs; `register` the B.23 register.
  'learn-home-child': { population: 'parent-created child 6-9', guest: false, ageBand: '6-9', roles: ['kid'], mentor: 'zara', shelf: 'child', engine: 'linear', register: 'young' },
  'learn-home-teen': { population: 'independent teen 13-17', guest: false, ageBand: '13-17', roles: ['universal'], wallet: { holder: 'teen', familyChild: false }, mentor: 'dina',
    shelf: 'teen', engine: 'pathway', register: 'teen', bridges: true },
  'learn-home-young': { population: 'parent-created child 6-9', guest: false, ageBand: '6-9', roles: ['kid'], mentor: 'liruf', shelf: 'young', engine: 'pathway', register: 'young' },
  'learn-home-unavailable': { population: 'parent-created child 10-12', guest: false, ageBand: '10-12', roles: ['kid'], mentor: 'rho', shelf: 'unavailable', engine: 'linear', register: 'transition' },
  'learn-home-empty': { population: 'adult', guest: false, ageBand: 'adult', roles: ['universal'], shelf: 'empty', engine: 'linear', register: 'adult' },
  'learn-home-error': { population: 'adult', guest: false, ageBand: 'adult', roles: ['universal'], shelf: 'error', engine: 'linear', register: 'adult' },
  'learn-course-adult': { population: 'adult', guest: false, ageBand: 'adult', roles: ['universal'], shelf: 'child', engine: 'pathway', register: 'adult' },
};

const RUN_ID = '44444444-4444-4444-8444-444444444444';

/* ---- W2L.1 synthetic Core answers, shaped exactly like Core's (the zod schemas in rebuild/learning parse them) ---- */
const loc = (en, es, pt) => ({ 'en-US': en, 'es-MX': es, 'pt-BR': pt });
const progress = (passed, total) => ({ passed, total, pct: total ? Math.round((passed / total) * 100) : 0 });
const TITLES = {
  'first-lemonade-stand': loc('My first lemonade stand', 'Mi primer puesto de limonada', 'Minha primeira barraca de limonada'),
  'financial-education': loc('Money basics', 'Lo básico del dinero', 'O básico do dinheiro'),
  entrepreneurship: loc('Start a business', 'Emprende un negocio', 'Abra um negócio'),
  investing: loc('Smart investing', 'Invertir con cabeza', 'Investir com inteligência'),
};
const course = (slug, passed, total, extra = {}) => ({ id: `course-${slug}`, slug, title: TITLES[slug], lessonCount: total, subject: 'money', badgeAsset: null,
  inProgress: false, adventureCount: 2, progress: progress(passed, total), ...extra });
const pathwayOf = (stage, basis, recommendedLessonId = null) => ({ pathway: { learnerStage: stage, pathwayStage: basis === 'unavailable' ? null : stage, basis, recommendedLessonId } });
const SHELVES = {
  child: () => ({ courses: [course('first-lemonade-stand', 12, 12), course('financial-education', 6, 14), course('entrepreneurship', 0, 10), course('investing', 0, 8, { inProgress: true })] }),
  teen: () => ({ courses: [course('financial-education', 3, 9, pathwayOf('teen', 'own-stage', 'l-1')), course('first-lemonade-stand', 0, 4, pathwayOf('teen', 'younger-bridge')),
    course('entrepreneurship', 0, 6, pathwayOf('teen', 'own-stage')), course('investing', 0, 5, pathwayOf('teen', 'older-early'))] }),
  young: () => ({ courses: [course('financial-education', 6, 14, pathwayOf('child', 'own-stage', 'l-1')), course('investing', 0, 0, pathwayOf('child', 'unavailable'))] }),
  unavailable: () => ({ courses: [course('first-lemonade-stand', 12, 12), course('entrepreneurship', 2, 10), course('investing', 0, 8)],
    unavailableFeaturedCourse: { slug: 'financial-education', title: TITLES['financial-education'] } }),
  empty: () => ({ courses: [] }),
};
const lesson = (id, title, state, bestScore = 0, placementCredited = false) => ({ id, slug: id, title, position: 1, difficulty: 1, xp_total: 10, estimated_minutes: 5, state, bestScore, placementCredited });
/** A topic's state as Core derives it (courseTree.ts): every lesson passed is completed, some is in progress. */
const topicState = (lessons) => {
  const passed = lessons.filter((entry) => entry.state === 'passed').length;
  return lessons.length > 0 && passed === lessons.length ? 'completed' : passed > 0 ? 'in-progress' : 'not-started';
};
const topic = (id, title, position, lessons) => ({ id, slug: id, title, position, kind: 'teaching', reviewOf: [], state: topicState(lessons), lessons });
/*
 * GET /learn/courses/:slug/tree. W2L.2: the same tree the course world reads; under the pathway engine each
 * chapter carries its `pathwayAccess` (the learner's own path, an extra, or closed by age), and the entry
 * placement is owed on `entrepreneurship` (as the path answer says).
 */
const tree = (slug, engine = 'linear') => ({
  course: { id: `course-${slug}`, slug, title: TITLES[slug], description: {}, subject: 'money', badgeAsset: null, inProgress: false, progress: progress(6, 14),
    placementRequired: slug === 'entrepreneurship' },
  adventures: [
    { id: 'adv-coins', slug: 'coins', title: loc('Coins and counting', 'Monedas y conteo', 'Moedas e contagem'), description: {}, theme: 'archipelago', position: 1, state: 'available', progress: progress(6, 8),
      ...(engine === 'pathway' ? { pathwayAccess: 'pathway' } : {}),
      sagas: [{ id: 'saga-coins', slug: 'coins', title: loc('Coins', 'Monedas', 'Moedas'), icon: 'savings', position: 1, progress: progress(6, 8), topics: [
        topic('t-count', loc('Counting coins', 'Contar monedas', 'Contar moedas'), 1, [
          lesson('l-count-1', loc('Coins in a jar', 'Monedas en un frasco', 'Moedas no pote'), 'passed', 90),
          lesson('l-count-2', loc('Count by fives', 'Contar de cinco en cinco', 'Contar de cinco em cinco'), 'passed', 0, true)]),
        topic('t-needs', loc('Needs and wants', 'Necesidades y deseos', 'Necessidades e desejos'), 2, [
          lesson('l-needs-1', loc('What do we need?', '¿Qué necesitamos?', 'Do que precisamos?'), 'current'),
          lesson('l-needs-2', loc('Wants can wait', 'Los deseos pueden esperar', 'Desejos podem esperar'), 'locked')])] }] },
    { id: 'adv-save', slug: 'save', title: loc('Saving a little', 'Ahorrar un poco', 'Poupar um pouco'), description: {}, theme: 'forest', position: 2, state: 'locked', progress: progress(0, 6),
      ...(engine === 'pathway' ? { pathwayAccess: 'closed' } : {}),
      sagas: [{ id: 'saga-save', slug: 'save', title: loc('Saving', 'Ahorro', 'Poupança'), icon: 'savings', position: 1, progress: progress(0, 6), topics: [
        topic('t-jar', loc('The piggy bank', 'La alcancía', 'O cofrinho'), 1, [lesson('l-jar-1', loc('A jar for later', 'Un frasco para después', 'Um pote para depois'), 'locked')])] }] },
  ],
  nextLessonId: 'l-needs-1',
});
const item = (id, title, chapterId, reason, access, recommended = false) => ({ lessonId: id, lessonTitle: title, topicId: `topic-${id}`, topicTitle: title, chapterId, reason, access, estimatedMinutes: 5, recommended });
const skill = (key, title, shown) => ({ key, title, shown });
const chapter = (id, title, position, stage, access, passed, total) => ({ id, slug: id, title, position, access, stage, state: 'available', progress: progress(passed, total) });
/** GET /learn/courses/:slug/path for a learner of `stage`: their own chapter is the path, younger ones are extras, older ones closed. */
const coursePathAnswer = (slug, stage, placementRequired = false) => {
  const access = (own) => (own === stage ? 'pathway' : ['child', 'tween', 'teen', 'adult'].indexOf(own) < ['child', 'tween', 'teen', 'adult'].indexOf(stage) ? 'optional' : 'closed');
  return {
    course: { slug, title: TITLES[slug], badgeAsset: null, progress: progress(3, 9) },
    pathway: { learnerStage: stage, pathwayStage: stage, basis: 'own-stage', placementRequired,
      badge: { earnedStages: [], eligible: false, stage, contentGap: false }, progress: { ...progress(3, 9), skillsTaught: 4, skillsShown: 2, complete: false }, advisorySkills: [] },
    chapters: [
      chapter('ch-kids', loc('Coins and counting', 'Monedas y conteo', 'Moedas e contagem'), 1, 'child', access('child'), stage === 'child' ? 3 : 0, 6),
      chapter('ch-teens', loc('Budgets that work', 'Presupuestos que funcionan', 'Orçamentos que funcionam'), 2, 'teen', access('teen'), stage === 'teen' ? 3 : 0, 9),
      chapter('ch-adults', loc('Household money', 'El dinero del hogar', 'O dinheiro da casa'), 3, 'adult', access('adult'), stage === 'adult' ? 3 : 0, 9),
    ],
    items: placementRequired ? [] : [
      item('l-1', loc('Plan a monthly budget', 'Planea un presupuesto mensual', 'Planeje um orçamento mensal'), 'ch-teens', 'next', 'pathway', true),
      item('l-2', loc('Needs and wants', 'Necesidades y deseos', 'Necessidades e desejos'), 'ch-teens', 'next', 'pathway'),
      item('l-3', loc('Counting coins', 'Contar monedas', 'Contar moedas'), 'ch-kids', 'review-due', 'optional'),
      item('l-4', loc('Saving a little', 'Ahorrar un poco', 'Poupar um pouco'), 'ch-kids', 'known', 'optional'),
    ],
    blocked: [{ topicId: 'topic-x', topicTitle: loc('Paying interest', 'Pagar intereses', 'Pagar juros'), chapterId: 'ch-teens', missingSkills: [], missingTopics: [] }],
    skills: [skill('money.budget', loc('Make a budget', 'Hacer un presupuesto', 'Fazer um orçamento'), 'course'),
      skill('money.save', loc('Save for later', 'Ahorrar para después', 'Poupar para depois'), 'mentor'),
      skill('money.needs', loc('Needs and wants', 'Necesidades y deseos', 'Necessidades e desejos'), 'none')],
  };
};
const STAGE = { young: 'child', transition: 'tween', teen: 'teen', adult: 'adult' };
const BAND = { young: '6-9', transition: '10-12', teen: '13-17', adult: 'adult' };
const refuse = (status, code, extra = {}) => ({ status, body: { data: null, error: { code, message: 'Synthetic refusal', ...extra } } });

/** W2L.1: what the learner home, the course screen, the journal and the rhythm read, per scenario. */
function respondLearnerPages({ spec, scenario, locale, path, request, ok }) {
  // Lane 0's shell scenarios land on the learner home too: they get the home's own reads (no other lane's scenario changes).
  if (!spec.shelf && scenario.startsWith('shell-')) {
    const register = { '6-9': 'young', '10-12': 'transition', '13-17': 'teen', adult: 'adult' }[spec.ageBand];
    if (path === '/learn/register' && request.method === 'GET' && register) return ok({ register, copy_band: BAND[register], policy_version: '2026-09-24.1', graduation: null });
    if (path === '/learn/rhythm') return ok({
      streak: { model: 'rest-days-v1', status: 'none', current: 0, best: 0, daysPracticed: 0, restDaysLeft: 2, lastActiveDate: null, pause: null },
      pace: { goal: 1, chosen: false, passedToday: 0, goalMet: false }, mentor: { character: spec.mentor ?? 'rho', chosen: Boolean(spec.mentor) }, levers: ['path', 'mentor', 'pace'],
    });
    if (path === '/learn/bridges') return ok({ prompts: [] });
    return undefined;
  }
  if (!spec.shelf) return undefined;
  if (path === '/learn/courses') return spec.shelf === 'error' ? refuse(502, 'INTERNAL') : ok(SHELVES[spec.shelf]());
  const courseRead = path.match(/^\/learn\/courses\/([^/]+)\/(path|tree)$/);
  if (courseRead) {
    const [, slug, kind] = courseRead;
    if (!TITLES[slug]) return refuse(404, 'NOT_FOUND');
    // The age safeguard and B.2, as Core's courseEntry refuses them (the linear engine only on the tree).
    if (slug === 'investing' && spec.shelf === 'young') return refuse(403, 'COURSE_AGE_RESTRICTED');
    if (kind === 'path' && spec.engine !== 'pathway') return refuse(409, 'PATHWAY_ENGINE_DISABLED');
    if (slug === 'investing') return refuse(409, 'COURSE_PREREQUISITE_REQUIRED', { missingPrerequisites: ['entrepreneurship'] });
    return kind === 'path' ? ok(coursePathAnswer(slug, STAGE[spec.register], slug === 'entrepreneurship')) : ok(tree(slug, spec.engine));
  }
  const placement = path.match(/^\/placement\/([^/]+)\/(intake|step|commit)$/);
  if (placement) return respondPlacement({ spec, locale, kind: placement[2], request, ok });
  if (path === '/learn/rhythm') return ok({
    streak: { model: 'rest-days-v1', status: 'open', current: 4, best: 12, daysPracticed: 41, restDaysLeft: 1, lastActiveDate: '2026-09-22', pause: null },
    pace: { goal: 2, chosen: true, passedToday: 1, goalMet: false }, mentor: { character: spec.mentor ?? 'rho', chosen: Boolean(spec.mentor) }, levers: ['path', 'mentor', 'pace'],
  });
  if (path === '/learn/register' && request.method === 'GET') return ok({ register: spec.register, copy_band: BAND[spec.register], policy_version: '2026-09-24.1', graduation: null });
  if (path === '/learn/bridges') return ok({ prompts: spec.bridges ? [{ id: 'bridge-1', action: 'savings_goal', skill: loc('Saving toward a goal', 'Ahorrar para una meta', 'Poupar para uma meta'),
    createdAt: '2026-09-22T10:00:00.000Z', expiresAt: '2026-10-06T10:00:00.000Z' }] : [] });
  if (path === '/learn/journal' && request.method === 'GET') return ok({ hasMore: false, entries: [{
    id: 'e1', course: { slug: 'financial-education', title: TITLES['financial-education'] }, lesson: { id: 'l1', title: loc('The lemonade stand', 'El puesto de limonada', 'A barraca de limonada') },
    situation: 'What price brings me closer to the guitar?', choice: '10 coins, double the price', firstChoice: '5 coins, the usual price',
    outcome: 'Two neighbors buy. Liruf earns 16 coins toward the guitar.', timesDecided: 2, resurfaced: 1, recordedAt: '2026-09-21T10:00:00.000Z' }] });
  return undefined;
}

/*
 * W2L.2: the placement flow (backend/src/routes/placement.ts), stateless as Core is: the first step asks, any
 * step carrying an answer is done (a start further in, with B.15's closed frame), and the commit stores it.
 * Core offers the conversational opener only from 12 (the teen and adult registers here).
 */
const PROBE = {
  'en-US': { prompt: 'You save 10 coins a week. How many after 4 weeks?', options: ['14 coins', '40 coins', '100 coins'] },
  'es-MX': { prompt: 'Ahorras 10 monedas por semana. ¿Cuántas tienes en 4 semanas?', options: ['14 monedas', '40 monedas', '100 monedas'] },
  'pt-BR': { prompt: 'Você poupa 10 moedas por semana. Quantas terá em 4 semanas?', options: ['14 moedas', '40 moedas', '100 moedas'] },
};
const REFLECTION = { 'en-US': 'You already keep a budget. We start past that.', 'es-MX': 'Ya llevas un presupuesto. Empezamos después de eso.',
  'pt-BR': 'Você já faz um orçamento. Começamos depois disso.' };
const PLACED = { frontier: 4, startTopicId: 't-needs', startLessonId: 'l-needs-1', creditedLessonCount: 4, creditedTopicCount: 2, totalTopicCount: 8,
  method: 'adaptive_quiz', cappedByPrerequisite: false, framing: { path: 'adaptive_quiz', start: 'further_in', basis: 'prior_exposure', learner_chosen: false } };
function respondPlacement({ spec, locale, kind, request, ok }) {
  if (!spec.shelf) return undefined;
  const body = request.postData ? JSON.parse(request.postData) : {};
  if (kind === 'intake') return request.method === 'POST'
    ? ok({ available: true, priorFraction: 0.5, reflection: REFLECTION[locale] })
    : ok({ ageAlreadyKnown: true, conversationalIntakeAvailable: spec.register === 'teen' || spec.register === 'adult' });
  if (kind === 'step') return (body.answers ?? []).length === 0
    ? ok({ kind: 'ask', probe: { topicId: '55555555-5555-4555-8555-555555555555', ...PROBE[locale] }, questionNumber: 1, questionsRemaining: 5, phase: 'search' })
    : ok({ kind: 'done', result: PLACED });
  return { status: 201, body: { data: PLACED, error: null } };
}

/** The lesson document and its server-graded run, from the product's own pilot fixtures. */
export function respond({ spec, scenario, locale, fixtures, path, request, ok }) {
  const learnerPage = respondLearnerPages({ spec, scenario, locale, path, request, ok });
  if (learnerPage !== undefined) return learnerPage;
  // W2L.3: the lesson route reads the learner's register (B.23) as the lesson opens; answer it from the scenario's age.
  if (scenario.startsWith('lesson-') && path === '/learn/register' && request.method === 'GET') {
    const register = { '6-9': 'young', '10-12': 'transition', '13-17': 'teen', adult: 'adult' }[spec.ageBand];
    if (register) return ok({ register, copy_band: BAND[register], policy_version: '2026-09-24.1', graduation: null });
  }
  const lesson = path.match(/^\/learn\/lessons\/([^/]+)(\/v2-runs)?$/);
  if (lesson && !lesson[2]) {
    if (spec.hold) return 'hold';
    if (spec.fail) return { fail: spec.fail };
    if (spec.error) return { status: spec.error[0], body: { data: null, error: { code: spec.error[1], message: 'Synthetic refusal' } } };
    if (!spec.lesson) return undefined;
    const document = fixtures[locale][spec.lesson];
    return ok({ lesson: { id: lesson[1], slug: lesson[1] }, locale, document, audio: {}, ...(spec.mentorStage ? { mentor_stage: spec.mentorStage } : {}) });
  }
  if (lesson && lesson[2] && request.method === 'POST' && spec.graded) {
    const document = fixtures[locale][spec.lesson];
    const tokens = Object.fromEntries(document.segments.filter((segment) => segment.grading === 'server').map((segment) => [segment.id, `synthetic-${segment.id}`]));
    return ok({ run_id: RUN_ID, version_id: document.version_id, expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      resumed: false, met_segment_ids: [], attempted_segment_ids: [], attempt_tokens: tokens });
  }
  return undefined;
}
