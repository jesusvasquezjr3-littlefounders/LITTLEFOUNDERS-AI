import type { HorizonteFixture, HorizonteLocale } from '../types.js';

const text = (en: string, es: string, pt: string): Record<HorizonteLocale, string> => ({ 'en-US': en, 'es-MX': es, 'pt-BR': pt });

const CHOICE_LADDER = (met: string) => ({ invalid: { choice: 'z' }, valid: { choice: '' }, met: { choice: met } });

export const SPACE2_FIXTURES: readonly HorizonteFixture[] = [
  {
    id: 'time-beats-rate',
    title: text('Time or rate?', '¿Tiempo o tasa?', 'Tempo ou taxa?'),
    ageBand: '13-17',
    eligibility: { minimum_age: 15, maximum_age: 17 },
    segment: (locale) => ({
      id: 'surface-time-beats-rate', type: 'math.surface.v2', grading: 'server', visual: { type: 'surface' },
      prompt: text(
        'Savings start at $1,000. Which choice ends with the most money?',
        'El ahorro empieza en $1,000. ¿Qué opción termina con más dinero?',
        'A poupança começa em R$ 1.000. Qual opção termina com mais dinheiro?',
      )[locale],
      payload: {
        surface: { kind: 'compound', principalCents: 100000, ratesBps: [200, 400, 600, 800], terms: [5, 10, 15, 20] },
        ask: { kind: 'highest' },
        options: [{ id: 'a', x: 1, y: 3 }, { id: 'b', x: 3, y: 0 }, { id: 'c', x: 2, y: 2 }, { id: 'd', x: 0, y: 3 }],
      },
    }),
    rubric: { choice: 'c' },
    ladder: CHOICE_LADDER('c'),
  },
  {
    id: 'price-and-units',
    title: text('Price and units', 'Precio y unidades', 'Preço e unidades'),
    ageBand: '13-17',
    eligibility: { minimum_age: 15, maximum_age: 17 },
    segment: (locale) => ({
      id: 'surface-price-and-units', type: 'math.surface.v2', grading: 'server', visual: { type: 'surface' },
      prompt: text(
        'Which choice makes a profit of at least $100?',
        '¿Qué opción deja una ganancia de al menos $100?',
        'Qual opção dá um lucro de pelo menos R$ 100?',
      )[locale],
      payload: {
        surface: { kind: 'profit', unitCostCents: 150, fixedCents: 20000, prices: [200, 300, 400, 500], units: [50, 100, 150, 200] },
        ask: { kind: 'reach', targetCents: 10000 },
        options: [{ id: 'a', x: 0, y: 3 }, { id: 'b', x: 1, y: 2 }, { id: 'c', x: 2, y: 1 }, { id: 'd', x: 3, y: 1 }],
      },
    }),
    rubric: { choice: 'd' },
    ladder: CHOICE_LADDER('d'),
  },
  {
    id: 'nearest-route',
    title: text('The nearest route', 'La ruta más cercana', 'A rota mais próxima'),
    ageBand: '10-12',
    eligibility: { minimum_age: 12, maximum_age: 12 },
    segment: (locale) => ({
      id: 'globe-nearest-route', type: 'geography.globe-route.v2', grading: 'server', visual: { type: 'globe-route' },
      prompt: text(
        'Four parcels leave Mexico City. Which route is the shortest?',
        'Cuatro paquetes salen de Ciudad de México. ¿Qué ruta es la más corta?',
        'Quatro pacotes saem da Cidade do México. Qual rota é a mais curta?',
      )[locale],
      payload: {
        routes: [
          { id: 'a', from: 'mexico-city', to: 'madrid', feeBps: 300, flatCents: 500 },
          { id: 'b', from: 'mexico-city', to: 'houston', feeBps: 400, flatCents: 300 },
          { id: 'c', from: 'mexico-city', to: 'tokyo', feeBps: 250, flatCents: 600 },
          { id: 'd', from: 'mexico-city', to: 'new-york', feeBps: 350, flatCents: 400 },
        ],
        ask: 'shortest',
        sendCents: 20000,
      },
    }),
    rubric: { choice: 'b' },
    ladder: CHOICE_LADDER('b'),
  },
  {
    id: 'cheapest-corridor',
    title: text('The cheapest corridor', 'El corredor más barato', 'O corredor mais barato'),
    ageBand: '13-17',
    eligibility: { minimum_age: 13, maximum_age: 17 },
    segment: (locale) => ({
      id: 'globe-cheapest-corridor', type: 'geography.globe-route.v2', grading: 'server', visual: { type: 'globe-route' },
      prompt: text(
        'Send $200 from Los Angeles. Which route costs the least in fees?',
        'Envía $200 desde Los Ángeles. ¿Qué ruta cuesta menos en comisiones?',
        'Envie R$ 200 de Los Angeles. Qual rota custa menos em taxas?',
      )[locale],
      payload: {
        routes: [
          { id: 'a', from: 'los-angeles', to: 'mexico-city', feeBps: 400, flatCents: 800 },
          { id: 'b', from: 'los-angeles', to: 'manila', feeBps: 150, flatCents: 300 },
          { id: 'c', from: 'los-angeles', to: 'lagos', feeBps: 350, flatCents: 400 },
          { id: 'd', from: 'los-angeles', to: 'new-york', feeBps: 250, flatCents: 700 },
        ],
        ask: 'cheapest',
        sendCents: 20000,
      },
    }),
    rubric: { choice: 'b' },
    ladder: CHOICE_LADDER('b'),
  },
  {
    id: 'object-on-the-table',
    title: text('A litre on your table', 'Un litro en tu mesa', 'Um litro na sua mesa'),
    ageBand: '13-17',
    eligibility: { minimum_age: 13, maximum_age: 17 },
    segment: (locale) => ({
      id: 'ar-table-litre-box', type: 'space.ar-table.v2', grading: 'none', visual: { type: 'ar-table' },
      prompt: text(
        'Look at a one litre box at its true size. Turn it to see every side.',
        'Mira una caja de un litro a su tamaño real. Gírala para ver todos sus lados.',
        'Veja uma caixa de um litro no tamanho real. Gire para ver todos os lados.',
      )[locale],
      payload: { object: 'litre-box' },
    }),
    // The AR step is not scored: it has no key and no answer ladder, so these are empty on purpose.
    rubric: {},
    ladder: { invalid: null, valid: null, met: null },
  },
];
