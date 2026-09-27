import type { Territory, TerritoryState } from './territory';

/*
 * W2L.2: preview and test fixtures for the course world (L3), shaped exactly
 * like Core's GET /learn/courses/:slug/tree (they parse with territorySchema).
 * One world per scene theme, so every scene is seen; review-due topics from
 * the spaced-review layer; a world not reached yet; and, under the B.6
 * pathway engine, an extra younger chapter and a chapter closed by age.
 */

const loc = (en: string, es: string, pt: string) => ({ 'en-US': en, 'es-MX': es, 'pt-BR': pt });
const progress = (passed: number, total: number) => ({ passed, total, pct: total ? Math.round((passed / total) * 100) : 0 });
type LessonState = 'locked' | 'available' | 'current' | 'passed';
const topic = (id: string, title: ReturnType<typeof loc>, state: 'not-started' | 'in-progress' | 'completed' | 'review-due', lessons: LessonState[]) => ({
  id, slug: id, title, kind: 'teaching', state, lessons: lessons.map((lesson, index) => ({ id: `${id}-l${index + 1}`, state: lesson })),
});

function worlds(placementRequired: boolean) {
  const open = (state: LessonState): LessonState => (placementRequired && state !== 'locked' ? 'locked' : state);
  return [
    { id: 'w-coins', slug: 'coins', title: loc('Coin island', 'La isla de las monedas', 'A ilha das moedas'), theme: 'archipelago', state: 'completed' as const,
      progress: progress(6, 6), sagas: [{ id: 's-coins', slug: 'coins', title: loc('Coins', 'Monedas', 'Moedas'), topics: [
        topic('t-count', loc('Counting coins', 'Contar monedas', 'Contar moedas'), 'review-due', ['passed', 'passed', 'passed']),
        topic('t-value', loc('What coins are worth', 'Cuánto valen', 'Quanto valem'), 'completed', ['passed', 'passed', 'passed'])] }] },
    { id: 'w-needs', slug: 'needs', title: loc('The needs forest', 'El bosque de las necesidades', 'A floresta das necessidades'), theme: 'forest', state: 'available' as const,
      progress: progress(3, 8), sagas: [
        { id: 's-needs', slug: 'needs', title: loc('Needs and wants', 'Necesidades y deseos', 'Necessidades e desejos'), topics: [
          topic('t-needs', loc('What we need', 'Lo que necesitamos', 'Do que precisamos'), 'completed', ['passed', 'passed']),
          topic('t-wants', loc('Wants can wait', 'Los deseos pueden esperar', 'Desejos podem esperar'), 'in-progress', ['passed', open('current'), 'locked'])] },
        { id: 's-choose', slug: 'choose', title: loc('Choosing', 'Elegir', 'Escolher'), topics: [
          topic('t-choose', loc('Pick one', 'Elige uno', 'Escolha um'), 'not-started', ['locked', 'locked', 'locked'])] }] },
    { id: 'w-market', slug: 'market', title: loc('Market city', 'La ciudad del mercado', 'A cidade do mercado'), theme: 'city', state: 'locked' as const,
      progress: progress(0, 6), sagas: [{ id: 's-market', slug: 'market', title: loc('Buying', 'Comprar', 'Comprar'), topics: [
        topic('t-price', loc('Prices', 'Precios', 'Preços'), 'not-started', ['locked', 'locked'])] }] },
    { id: 'w-save', slug: 'save', title: loc('Saving valley', 'El valle del ahorro', 'O vale da poupança'), theme: 'valley', state: 'locked' as const,
      progress: progress(0, 5), sagas: [{ id: 's-save', slug: 'save', title: loc('Saving', 'Ahorro', 'Poupança'), topics: [
        topic('t-jar', loc('A jar for later', 'Un frasco para después', 'Um pote para depois'), 'not-started', ['locked'])] }] },
  ];
}

/** Under the linear engine: two worlds explored, two not reached yet. */
export function territoryFixture(placementRequired = false): Territory {
  return {
    course: { id: 'course-financial-education', slug: 'financial-education', title: loc('Money basics', 'Lo básico del dinero', 'O básico do dinheiro'),
      progress: progress(placementRequired ? 0 : 9, 25), placementRequired },
    adventures: worlds(placementRequired),
    nextLessonId: placementRequired ? null : 't-wants-l2',
  };
}

/** Under the B.6 pathway engine for a teen: a younger chapter is an extra, the adult chapter closed by age (never listed). */
export function pathwayTerritoryFixture(): Territory {
  const base = territoryFixture();
  const [coins, needs] = base.adventures;
  return {
    ...base,
    adventures: [
      { ...coins!, pathwayAccess: 'optional' },
      { ...needs!, pathwayAccess: 'pathway' },
      { id: 'w-kingdom', slug: 'kingdom', title: loc('The budget kingdom', 'El reino del presupuesto', 'O reino do orçamento'), theme: 'kingdom', state: 'available',
        pathwayAccess: 'pathway', progress: progress(1, 4), sagas: [{ id: 's-budget', slug: 'budget', title: loc('Budgets', 'Presupuestos', 'Orçamentos'), topics: [
          topic('t-plan', loc('Plan a month', 'Planea un mes', 'Planeje um mês'), 'in-progress', ['passed', 'available'])] }] },
      { id: 'w-cosmos', slug: 'cosmos', title: loc('Household stars', 'Las estrellas del hogar', 'As estrelas da casa'), theme: 'cosmos', state: 'locked',
        pathwayAccess: 'closed', progress: progress(0, 9), sagas: [{ id: 's-home', slug: 'home', title: loc('Household', 'Hogar', 'Casa'), topics: [
          topic('t-bills', loc('Bills', 'Recibos', 'Contas'), 'not-started', ['locked'])] }] },
    ],
  };
}

export const territoryPreviewStates: Record<string, TerritoryState> = {
  linear: { status: 'ready', map: territoryFixture() },
  pathway: { status: 'ready', map: pathwayTerritoryFixture() },
  placement: { status: 'ready', map: territoryFixture(true) },
  loading: { status: 'loading' },
  offline: { status: 'offline' },
  error: { status: 'error' },
  refused: { status: 'refused' },
  'not-found': { status: 'not-found' },
  age: { status: 'age-restricted' },
  prerequisite: { status: 'prerequisite', missing: ['entrepreneurship'] },
};
