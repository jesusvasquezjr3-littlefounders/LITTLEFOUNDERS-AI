import type { CourseState, CourseTree } from './course';
import { childPathFixture, placementPathFixture } from './coursePathFixtures';
import type { Shelf, ShelfCourse, ShelfState } from './learnHome';

/*
 * W2L.1 preview and test fixtures for the learner home and the course
 * screen's linear engine. They are shaped exactly like GET /learn/courses and
 * GET /learn/courses/:slug/tree (the schemas parse them in the tests) and
 * stand in for Core only in the preview and the audits; the authenticated
 * routes always render Core's own answer. Titles follow the published
 * catalog's four courses.
 */

const loc = (en: string, es: string, pt: string) => ({ 'en-US': en, 'es-MX': es, 'pt-BR': pt });
const progress = (passed: number, total: number) => ({ passed, total, pct: total ? Math.round((passed / total) * 100) : 0 });

export const SHELF_TITLES = {
  'first-lemonade-stand': loc('My first lemonade stand', 'Mi primer puesto de limonada', 'Minha primeira barraca de limonada'),
  'financial-education': loc('Money basics', 'Lo básico del dinero', 'O básico do dinheiro'),
  entrepreneurship: loc('Start a business', 'Emprende un negocio', 'Abra um negócio'),
  investing: loc('Smart investing', 'Invertir con cabeza', 'Investir com inteligência'),
};

const course = (slug: keyof typeof SHELF_TITLES, passed: number, total: number, extra: Partial<ShelfCourse> = {}): ShelfCourse => ({
  id: `course-${slug}`, slug, title: SHELF_TITLES[slug], lessonCount: total, badgeAsset: null, inProgress: false, progress: progress(passed, total), ...extra,
});

/** A parent-created child (linear engine): one course under way, one new, one finished, one still being built. */
export function childShelf(): Shelf {
  return { courses: [
    course('first-lemonade-stand', 12, 12),
    course('financial-education', 6, 14),
    course('entrepreneurship', 0, 10),
    course('investing', 0, 8, { inProgress: true }),
  ] };
}

/** An independent teen under the pathway engine: the children's course is a younger bridge, investing is open early. */
export function teenShelf(): Shelf {
  const pathway = (basis: NonNullable<ShelfCourse['pathway']>['basis'], recommendedLessonId: string | null) =>
    ({ learnerStage: 'teen' as const, pathwayStage: basis === 'unavailable' ? null : 'teen' as const, basis, recommendedLessonId });
  return { courses: [
    course('financial-education', 3, 9, { pathway: pathway('own-stage', 'l-1') }),
    course('first-lemonade-stand', 0, 4, { pathway: pathway('younger-bridge', null) }),
    course('entrepreneurship', 0, 6, { pathway: pathway('own-stage', null) }),
    course('investing', 0, 5, { pathway: pathway('older-early', null) }),
  ] };
}

/** A young child under the pathway engine: a teen-only course is listed and closed by age (OD-16). */
export function youngPathwayShelf(): Shelf {
  const pathway = (basis: NonNullable<ShelfCourse['pathway']>['basis'], recommendedLessonId: string | null) =>
    ({ learnerStage: 'child' as const, pathwayStage: basis === 'unavailable' ? null : 'child' as const, basis, recommendedLessonId });
  return { courses: [
    course('financial-education', 6, 14, { pathway: pathway('own-stage', 'l-1') }),
    course('investing', 0, 0, { pathway: pathway('unavailable', null) }),
  ] };
}

const lesson = (id: string, title: ReturnType<typeof loc>, state: 'locked' | 'available' | 'current' | 'passed', bestScore = 0, placementCredited = false) =>
  ({ id, slug: id, title, state, estimated_minutes: 5, bestScore, placementCredited });

/** GET /learn/courses/financial-education/tree for the child above: two chapters, the next lesson in the first. */
export function childTree(placementRequired = false): CourseTree {
  return {
    course: { id: 'course-financial-education', slug: 'financial-education', title: SHELF_TITLES['financial-education'], inProgress: false,
      progress: progress(6, 14), placementRequired },
    adventures: [
      {
        id: 'adv-coins', slug: 'coins', title: loc('Coins and counting', 'Monedas y conteo', 'Moedas e contagem'), state: 'available', progress: progress(6, 8),
        sagas: [{ id: 'saga-coins', slug: 'coins', title: loc('Coins', 'Monedas', 'Moedas'), topics: [
          { id: 't-count', slug: 'count', title: loc('Counting coins', 'Contar monedas', 'Contar moedas'), lessons: [
            lesson('l-count-1', loc('Coins in a jar', 'Monedas en un frasco', 'Moedas no pote'), 'passed', 90),
            lesson('l-count-2', loc('Count by fives', 'Contar de cinco en cinco', 'Contar de cinco em cinco'), 'passed', 0, true),
          ] },
          { id: 't-needs', slug: 'needs', title: loc('Needs and wants', 'Necesidades y deseos', 'Necessidades e desejos'), lessons: [
            lesson('l-needs-1', loc('What do we need?', '¿Qué necesitamos?', 'Do que precisamos?'), placementRequired ? 'available' : 'current'),
            lesson('l-needs-2', loc('Wants can wait', 'Los deseos pueden esperar', 'Desejos podem esperar'), 'locked'),
          ] },
        ] }],
      },
      {
        id: 'adv-save', slug: 'save', title: loc('Saving a little', 'Ahorrar un poco', 'Poupar um pouco'), state: 'locked', progress: progress(0, 6),
        sagas: [{ id: 'saga-save', slug: 'save', title: loc('Saving', 'Ahorro', 'Poupança'), topics: [
          { id: 't-jar', slug: 'jar', title: loc('The piggy bank', 'La alcancía', 'O cofrinho'), lessons: [lesson('l-jar-1', loc('A jar for later', 'Un frasco para después', 'Um pote para depois'), 'locked')] },
        ] }],
      },
    ],
    nextLessonId: placementRequired ? null : 'l-needs-1',
  };
}

/** The course screen in every state it can show, for the preview (`?course=`). */
export const coursePreviewStates: Record<string, CourseState> = {
  linear: { status: 'ready', detail: { engine: 'linear', tree: childTree() } },
  'linear-placement': { status: 'ready', detail: { engine: 'linear', tree: childTree(true) } },
  pathway: { status: 'ready', detail: { engine: 'pathway', path: childPathFixture() } },
  'pathway-placement': { status: 'ready', detail: { engine: 'pathway', path: placementPathFixture() } },
  empty: { status: 'ready', detail: { engine: 'linear', tree: { ...childTree(), adventures: [], nextLessonId: null } } },
  loading: { status: 'loading' },
  age: { status: 'age-restricted' },
  prerequisite: { status: 'prerequisite', missing: ['entrepreneurship'] },
  'not-found': { status: 'not-found' },
  offline: { status: 'offline' },
  refused: { status: 'refused' },
  error: { status: 'error' },
};

/** The home's shelf in every state it can show, for the preview (`?home=`). */
export function homePreviewShelf(key: string): ShelfState {
  switch (key) {
    case 'loading': return { status: 'loading' };
    case 'error': return { status: 'error' };
    case 'offline': return { status: 'offline' };
    case 'refused': return { status: 'refused' };
    case 'empty': return { status: 'ready', shelf: { courses: [] } };
    case 'teen': return { status: 'ready', shelf: teenShelf() };
    case 'young': return { status: 'ready', shelf: youngPathwayShelf() };
    // B.3: the featured course failed to assemble, so Core left it off the shelf and named it.
    case 'unavailable': return { status: 'ready', shelf: {
      courses: childShelf().courses.filter((entry) => entry.slug !== 'financial-education'),
      unavailableFeaturedCourse: { slug: 'financial-education', title: SHELF_TITLES['financial-education'] },
    } };
    default: return { status: 'ready', shelf: childShelf() };
  }
}
