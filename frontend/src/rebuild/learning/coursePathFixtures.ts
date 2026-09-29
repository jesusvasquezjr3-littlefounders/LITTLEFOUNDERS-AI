import type { CoursePath } from './coursePath';
import type { CourseState } from './course';

/*
 * Preview and test fixtures for the course path, one per server population.
 * They are shaped exactly like GET /learn/courses/:slug/path (the schema
 * parses them in CourseView.test.tsx) and stand in for Core only in the
 * preview; the authenticated route always renders Core's own answer.
 */

const loc = (en: string, es: string, pt: string) => ({ 'en-US': en, 'es-MX': es, 'pt-BR': pt });

const chapters = {
  kids: { id: 'ch-kids', slug: 'coins', title: loc('Coins and counting', 'Monedas y conteo', 'Moedas e contagem'), position: 1, stage: 'child' as const },
  teens: { id: 'ch-teens', slug: 'budgets', title: loc('Budgets that work', 'Presupuestos que funcionan', 'Orçamentos que funcionam'), position: 2, stage: 'teen' as const },
  adults: { id: 'ch-adults', slug: 'household', title: loc('Household money', 'El dinero del hogar', 'O dinheiro da casa'), position: 3, stage: 'adult' as const },
};

const item = (id: string, topic: ReturnType<typeof loc>, lesson: ReturnType<typeof loc>, chapterId: string, reason: CoursePath['items'][number]['reason'], access: 'pathway' | 'optional', recommended = false) =>
  ({ lessonId: id, lessonTitle: lesson, topicId: `topic-${id}`, topicTitle: topic, chapterId, reason, access, estimatedMinutes: 5, recommended });

const skill = (key: string, title: ReturnType<typeof loc>, shown: 'course' | 'mentor' | 'none') => ({ key, title, shown });

/** A child (6–9) in the middle of the child pathway, with one skill already shown with the Mentor. */
export function childPathFixture(): CoursePath {
  return {
    course: { slug: 'money', title: loc('Money basics', 'Lo básico del dinero', 'O básico do dinheiro'), badgeAsset: null, progress: { passed: 6, total: 14, pct: 43 } },
    pathway: {
      learnerStage: 'child', pathwayStage: 'child', basis: 'own-stage', placementRequired: false,
      badge: { earnedStages: [], eligible: false, stage: 'child', contentGap: false },
      progress: { passed: 6, total: 14, pct: 43, skillsTaught: 5, skillsShown: 3, complete: false },
      advisorySkills: [],
    },
    chapters: [
      { ...chapters.kids, access: 'pathway', state: 'available', progress: { passed: 6, total: 14, pct: 43 } },
      { ...chapters.teens, access: 'closed', state: 'locked', progress: { passed: 0, total: 8, pct: 0 } },
      { ...chapters.adults, access: 'closed', state: 'locked', progress: { passed: 0, total: 6, pct: 0 } },
    ],
    items: [
      item('l-1', loc('Counting coins', 'Contar monedas', 'Contar moedas'), loc('Coins in a jar', 'Monedas en un frasco', 'Moedas no pote'), 'ch-kids', 'next', 'pathway', true),
      item('l-2', loc('Needs and wants', 'Necesidades y deseos', 'Necessidades e desejos'), loc('What do we need?', '¿Qué necesitamos?', 'Do que precisamos?'), 'ch-kids', 'next', 'pathway'),
      item('l-3', loc('Coin review', 'Repaso de monedas', 'Revisão de moedas'), loc('Coins again', 'Otra vez monedas', 'Moedas de novo'), 'ch-kids', 'review', 'pathway'),
      item('l-4', loc('Saving a little', 'Ahorrar un poco', 'Poupar um pouco'), loc('The piggy bank', 'La alcancía', 'O cofrinho'), 'ch-kids', 'known', 'pathway'),
    ],
    blocked: [{ topicId: 'topic-x', topicTitle: loc('Making change', 'Dar cambio', 'Dar troco'), chapterId: 'ch-kids', missingSkills: [], missingTopics: [] }],
    skills: [
      skill('money.count', loc('Count coins', 'Contar monedas', 'Contar moedas'), 'course'),
      skill('money.compare', loc('Compare amounts', 'Comparar cantidades', 'Comparar valores'), 'course'),
      skill('money.save', loc('Save for later', 'Ahorrar para después', 'Poupar para depois'), 'mentor'),
      skill('money.needs', loc('Needs and wants', 'Necesidades y deseos', 'Necessidades e desejos'), 'none'),
      skill('money.change', loc('Make change', 'Dar cambio', 'Dar troco'), 'none'),
    ],
    // GAP-FIX-R5: the young register's mechanism is a binary pick of the next topic; no enrichment track.
    autonomy: { path: 'binary', approach: false, enrichment: false, mentor: true, pace: true },
    enrichment: [],
    earlyAccess: [], masteryOffers: [], masteryCreditedTopicIds: [],
  };
}

/** An adult: the adult chapter is the pathway; childhood and teen chapters are optional extras. */
export function adultPathFixture(): CoursePath {
  return {
    course: { slug: 'money', title: loc('Money basics', 'Lo básico del dinero', 'O básico do dinheiro'), badgeAsset: null, progress: { passed: 1, total: 6, pct: 17 } },
    pathway: {
      learnerStage: 'adult', pathwayStage: 'adult', basis: 'own-stage', placementRequired: false,
      badge: { earnedStages: [], eligible: false, stage: 'adult', contentGap: false },
      progress: { passed: 1, total: 6, pct: 17, skillsTaught: 3, skillsShown: 1, complete: false },
      advisorySkills: [],
    },
    chapters: [
      { ...chapters.kids, access: 'optional', state: 'available', progress: { passed: 0, total: 14, pct: 0 } },
      { ...chapters.teens, access: 'optional', state: 'available', progress: { passed: 0, total: 8, pct: 0 } },
      { ...chapters.adults, access: 'pathway', state: 'available', progress: { passed: 1, total: 6, pct: 17 } },
    ],
    items: [
      item('a-1', loc('A monthly plan', 'Un plan mensual', 'Um plano mensal'), loc('Where the money goes', 'A dónde va el dinero', 'Para onde vai o dinheiro'), 'ch-adults', 'next', 'pathway', true),
      item('a-2', loc('Emergency fund', 'Fondo de emergencia', 'Reserva de emergência'), loc('Why a cushion helps', 'Por qué ayuda un colchón', 'Por que uma reserva ajuda'), 'ch-adults', 'next', 'pathway'),
      item('a-3', loc('Comparing prices', 'Comparar precios', 'Comparar preços'), loc('Two stores', 'Dos tiendas', 'Duas lojas'), 'ch-kids', 'bridge', 'optional'),
      item('a-4', loc('Counting coins', 'Contar monedas', 'Contar moedas'), loc('Coins in a jar', 'Monedas en un frasco', 'Moedas no pote'), 'ch-kids', 'next', 'optional'),
      item('a-5', loc('Budgets that work', 'Presupuestos que funcionan', 'Orçamentos que funcionam'), loc('Your first budget', 'Tu primer presupuesto', 'Seu primeiro orçamento'), 'ch-teens', 'next', 'optional'),
    ],
    blocked: [],
    skills: [
      skill('life.plan', loc('Plan a month', 'Planear un mes', 'Planejar um mês'), 'course'),
      skill('life.cushion', loc('Keep a cushion', 'Tener un colchón', 'Ter uma reserva'), 'none'),
      skill('life.compare', loc('Compare prices', 'Comparar precios', 'Comparar preços'), 'none'),
    ],
    // GAP-FIX-R5: an adult has every lever, and one optional depth lesson is open.
    autonomy: { path: 'open', approach: true, enrichment: true, mentor: true, pace: true },
    enrichment: [{ ...item('a-deep', loc('A monthly plan', 'Un plan mensual', 'Um plano mensal'), loc('Plan for a surprise bill', 'Planea un gasto sorpresa', 'Planeje uma conta surpresa'), 'ch-adults', 'next', 'optional'),
      reason: 'enrichment' as const, access: 'optional' as const }],
    earlyAccess: [], masteryOffers: [], masteryCreditedTopicIds: [],
  };
}

/** A teen who has not placed into the teen stage yet. */
export function placementPathFixture(): CoursePath {
  const base = adultPathFixture();
  return {
    ...base,
    pathway: { ...base.pathway, learnerStage: 'teen', pathwayStage: 'teen', placementRequired: true, progress: { ...base.pathway.progress, passed: 0, pct: 0 } },
    chapters: base.chapters.map((c) => ({ ...c, access: c.stage === 'teen' ? 'pathway' : c.stage === 'adult' ? 'closed' : 'optional' })),
  };
}

/** A finished child pathway with its stage badge. */
export function completePathFixture(): CoursePath {
  const base = childPathFixture();
  return {
    ...base,
    course: { ...base.course, progress: { passed: 14, total: 14, pct: 100 } },
    pathway: { ...base.pathway, badge: { earnedStages: ['child'], eligible: false, stage: 'child', contentGap: false }, progress: { ...base.pathway.progress, passed: 14, pct: 100, skillsShown: 5, complete: true } },
    chapters: base.chapters.map((c) => (c.access === 'pathway' ? { ...c, state: 'completed' as const, progress: { passed: 14, total: 14, pct: 100 } } : c)),
    items: [],
    blocked: [],
    skills: base.skills.map((s) => ({ ...s, shown: 'course' as const })),
  };
}

/** A 10-year-old on the child chapters until tween chapters are written (a recorded content gap). */
export function bridgePathFixture(): CoursePath {
  const base = childPathFixture();
  return { ...base, pathway: { ...base.pathway, learnerStage: 'tween', basis: 'younger-bridge', badge: { ...base.pathway.badge, contentGap: true } } };
}

/**
 * OD-25: a 10-year-old on the child chapters who mastered what the teen
 * chapter needs (it may open one stage early, after they confirm) and showed
 * a topic's skill with the Mentor (they may accept it as done).
 */
export function offersPathFixture(): CoursePath {
  const base = bridgePathFixture();
  const save = { key: 'money.save', title: loc('Save for later', 'Ahorrar para después', 'Poupar para depois') };
  return {
    ...base,
    earlyAccess: [{ chapterId: chapters.teens.id, chapterTitle: chapters.teens.title, stage: 'teen', state: 'eligible', prerequisiteSkills: [save] }],
    masteryOffers: [{ topicId: 'topic-l-4', topicTitle: loc('Saving a little', 'Ahorrar un poco', 'Poupar um pouco'), chapterId: chapters.kids.id, skills: [save] }],
  };
}

const ready = (path: CoursePath): CourseState => ({ status: 'ready', detail: { engine: 'pathway', path } });

/** The course screen under the pathway engine, one state per server population (W2L.1: the one course screen). */
export const coursePathPreviewStates: Record<string, CourseState> = {
  child: ready(childPathFixture()),
  adult: ready(adultPathFixture()),
  placement: ready(placementPathFixture()),
  complete: ready(completePathFixture()),
  bridge: ready(bridgePathFixture()),
  offers: ready(offersPathFixture()),
  age: { status: 'age-restricted' },
  prerequisite: { status: 'prerequisite', missing: ['entrepreneurship'] },
  error: { status: 'error' },
  loading: { status: 'loading' },
};
