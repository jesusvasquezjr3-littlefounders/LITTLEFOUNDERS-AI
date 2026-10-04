import type { HorizonteFixture, HorizonteLocale } from '../types.js';

const text = (en: string, es: string, pt: string): Record<HorizonteLocale, string> => ({ 'en-US': en, 'es-MX': es, 'pt-BR': pt });

const TREE_AGES = { ageBand: '13-17', eligibility: { minimum_age: 13, maximum_age: 17 } } as const;
const REGRESSION_AGES = { ageBand: '13-17', eligibility: { minimum_age: 14, maximum_age: 17 } } as const;

const SCREENING = { population: 1000, prior: { part: 1, whole: 100 }, hit: { part: 9, whole: 10 }, alarm: { part: 1, whole: 10 } };
const FILTER = { population: 1000, prior: { part: 1, whole: 5 }, hit: { part: 9, whole: 10 }, alarm: { part: 1, whole: 20 } };
const SURVEY = { population: 2000, prior: { part: 3, whole: 100 }, hit: { part: 4, whole: 5 }, alarm: { part: 1, whole: 20 } };
const CITY = { population: 10000, prior: { part: 1, whole: 50 }, hit: { part: 4, whole: 5 }, alarm: { part: 1, whole: 20 } };
const CHECKUP = { population: 1000, prior: { part: 4, whole: 10 }, hit: { part: 3, whole: 4 }, alarm: { part: 1, whole: 5 } };

const BUILD = text(
  'Build the tree for these people. Drag each count to its branch.',
  'Arma el árbol de estas personas. Arrastra cada cantidad a su rama.',
  'Monte a árvore dessas pessoas. Arraste cada quantidade para o seu ramo.',
);
const CHANCE_POSITIVE = text(
  'One person tests positive. What is the chance they have it?',
  'Una persona da positivo. ¿Cuál es la probabilidad de que lo tenga?',
  'Uma pessoa testa positivo. Qual é a chance de ela ter?',
);
const CHANCE_NEGATIVE = text(
  'One person tests negative. What is the chance they have it anyway?',
  'Una persona da negativo. ¿Cuál es la probabilidad de que aun así lo tenga?',
  'Uma pessoa testa negativo. Qual é a chance de ela ter mesmo assim?',
);
const FIT = text(
  'Move the line to make the squares as small as you can.',
  'Mueve la recta para que los cuadrados sean lo más pequeños posible.',
  'Mova a reta para deixar os quadrados o menores possível.',
);

const slots = (has: number, lacks: number, hasPos: number, hasNeg: number, lacksPos: number, lacksNeg: number) => ({
  solutions: [{ has: [`n-${has}`], lacks: [`n-${lacks}`], 'has-pos': [`n-${hasPos}`], 'has-neg': [`n-${hasNeg}`], 'lacks-pos': [`n-${lacksPos}`], 'lacks-neg': [`n-${lacksNeg}`] }],
});

const line = (m: string, b: string) => ({ family: 'line', params: { m, b } });
const chance = (target: string) => ({ target, tolerance: { absolute: '0.005' }, review: { absolute: '0.02' } });
const fit = (m: string, b: string) => ({ family: 'line', target: { m, b }, parameter_tolerance: { absolute: '0.05' }, parameter_review: { absolute: '0.3' } });

export const PROB_FIXTURES: readonly HorizonteFixture[] = [
  {
    id: 'tree-screening',
    title: text('Grow a screening tree', 'Haz crecer un árbol de detección', 'Cultive uma árvore de triagem'),
    ...TREE_AGES,
    segment: (locale) => ({
      id: 'tree-screening', type: 'prob.tree.v2', grading: 'server', visual: { type: 'prob-tree' }, prompt: BUILD[locale],
      payload: { ...SCREENING, chips: [1, 9, 10, 99, 100, 891, 900, 990] },
    }),
    rubric: slots(10, 990, 9, 1, 99, 891),
    ladder: {
      invalid: { slots: { has: ['n-5'] } },
      valid: { slots: {} },
      met: { slots: { has: ['n-10'], lacks: ['n-990'], 'has-pos': ['n-9'], 'has-neg': ['n-1'], 'lacks-pos': ['n-99'], 'lacks-neg': ['n-891'] } },
    },
  },
  {
    id: 'tree-filter',
    title: text('Grow a spam filter tree', 'Haz crecer un árbol de filtro', 'Cultive uma árvore de filtro'),
    ...TREE_AGES,
    segment: (locale) => ({
      id: 'tree-filter', type: 'prob.tree.v2', grading: 'server', visual: { type: 'prob-tree' }, prompt: BUILD[locale],
      payload: { ...FILTER, chips: [20, 40, 100, 180, 200, 500, 760, 800] },
    }),
    rubric: slots(200, 800, 180, 20, 40, 760),
    ladder: {
      invalid: { slots: { has: ['n-200', 'n-800'] } },
      valid: { slots: {} },
      met: { slots: { has: ['n-200'], lacks: ['n-800'], 'has-pos': ['n-180'], 'has-neg': ['n-20'], 'lacks-pos': ['n-40'], 'lacks-neg': ['n-760'] } },
    },
  },
  {
    id: 'tree-survey',
    title: text('Grow a tree of 2,000', 'Haz crecer un árbol de 2 000', 'Cultive uma árvore de 2.000'),
    ...TREE_AGES,
    segment: (locale) => ({
      id: 'tree-survey', type: 'prob.tree.v2', grading: 'server', visual: { type: 'prob-tree' }, prompt: BUILD[locale],
      payload: { ...SURVEY, chips: [12, 48, 60, 97, 300, 1000, 1843, 1940] },
    }),
    rubric: slots(60, 1940, 48, 12, 97, 1843),
    ladder: {
      invalid: { slots: { ghost: ['n-60'] } },
      valid: { slots: { has: [] } },
      met: { slots: { has: ['n-60'], lacks: ['n-1940'], 'has-pos': ['n-48'], 'has-neg': ['n-12'], 'lacks-pos': ['n-97'], 'lacks-neg': ['n-1843'] } },
    },
  },
  {
    id: 'bayes-screening',
    title: text('Positive screening test', 'Prueba de detección positiva', 'Teste de triagem positivo'),
    ...TREE_AGES,
    segment: (locale) => ({
      id: 'bayes-screening', type: 'prob.bayes.v2', grading: 'server', visual: { type: 'natural-frequencies' }, prompt: CHANCE_POSITIVE[locale],
      payload: { ...SCREENING, ask: 'positive' },
    }),
    rubric: chance('1/12'),
    ladder: { invalid: { value: '2' }, valid: { value: '' }, met: { value: '0.083' } },
  },
  {
    id: 'bayes-filter',
    title: text('Message flagged as spam', 'Mensaje marcado como spam', 'Mensagem marcada como spam'),
    ...TREE_AGES,
    segment: (locale) => ({
      id: 'bayes-filter', type: 'prob.bayes.v2', grading: 'server', visual: { type: 'natural-frequencies' }, prompt: CHANCE_POSITIVE[locale],
      payload: { ...FILTER, ask: 'positive' },
    }),
    rubric: chance('9/11'),
    ladder: { invalid: { value: '1.5' }, valid: { value: '' }, met: { value: '0.82' } },
  },
  {
    id: 'bayes-checkup',
    title: text('Negative check-up result', 'Resultado negativo del chequeo', 'Resultado negativo do exame'),
    ...TREE_AGES,
    segment: (locale) => ({
      id: 'bayes-checkup', type: 'prob.bayes.v2', grading: 'server', visual: { type: 'natural-frequencies' }, prompt: CHANCE_NEGATIVE[locale],
      payload: { ...CHECKUP, ask: 'negative' },
    }),
    rubric: chance('5/29'),
    ladder: { invalid: { value: 'abc' }, valid: { value: '' }, met: { value: '0.17' } },
  },
  {
    id: 'bayes-city',
    title: text('Positive result in a big city', 'Resultado positivo en una ciudad grande', 'Resultado positivo em uma cidade grande'),
    ...TREE_AGES,
    segment: (locale) => ({
      id: 'bayes-city', type: 'prob.bayes.v2', grading: 'server', visual: { type: 'natural-frequencies' }, prompt: CHANCE_POSITIVE[locale],
      payload: { ...CITY, ask: 'positive' },
    }),
    rubric: chance('16/65'),
    ladder: { invalid: { value: '3' }, valid: { value: '' }, met: { value: '0.25' } },
  },
  {
    id: 'regression-climb',
    title: text('Fit a rising line', 'Ajusta una recta que sube', 'Ajuste uma reta que sobe'),
    ...REGRESSION_AGES,
    segment: (locale) => ({
      id: 'regression-climb', type: 'prob.regression.v2', grading: 'server', visual: { type: 'regression-residuals' }, prompt: FIT[locale],
      payload: { size: 10, points: [{ x: 1, y: 1 }, { x: 2, y: 3 }, { x: 3, y: 5 }, { x: 6, y: 7 }, { x: 8, y: 10 }, { x: 10, y: 10 }], start: { slope: 0, intercept: 50 } },
    }),
    rubric: fit('1', '1'),
    ladder: { invalid: line('4', '1'), valid: line('0', '5'), met: line('1', '1') },
  },
  {
    id: 'regression-gentle',
    title: text('Fit a gentle slope', 'Ajusta una pendiente suave', 'Ajuste uma inclinação suave'),
    ...REGRESSION_AGES,
    segment: (locale) => ({
      id: 'regression-gentle', type: 'prob.regression.v2', grading: 'server', visual: { type: 'regression-residuals' }, prompt: FIT[locale],
      payload: { size: 8, points: [{ x: 1, y: 4 }, { x: 2, y: 4 }, { x: 4, y: 6 }, { x: 6, y: 7 }, { x: 7, y: 7 }, { x: 8, y: 7 }], start: { slope: 20, intercept: 0 } },
    }),
    rubric: fit('0.5', '3.5'),
    ladder: { invalid: line('0.5', '20'), valid: line('2', '0'), met: line('0.5', '3.5') },
  },
  {
    id: 'regression-fall',
    title: text('Fit a falling line', 'Ajusta una recta que baja', 'Ajuste uma reta que desce'),
    ...REGRESSION_AGES,
    segment: (locale) => ({
      id: 'regression-fall', type: 'prob.regression.v2', grading: 'server', visual: { type: 'regression-residuals' }, prompt: FIT[locale],
      payload: { size: 10, points: [{ x: 1, y: 9 }, { x: 2, y: 7 }, { x: 3, y: 7 }, { x: 7, y: 1 }, { x: 9, y: 1 }, { x: 10, y: 0 }], start: { slope: 0, intercept: 40 } },
    }),
    rubric: fit('-1', '9.5'),
    ladder: { invalid: line('-4', '9.5'), valid: line('0', '4'), met: line('-1', '9.5') },
  },
];
