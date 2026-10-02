import type { HorizonteFixture, HorizonteLocale } from '../types.js';

const text = (en: string, es: string, pt: string): Record<HorizonteLocale, string> => ({ 'en-US': en, 'es-MX': es, 'pt-BR': pt });

const ARRAY = 'math.array-area.v2';
const RATIO = 'math.ratio-line.v2';
const WALL = 'math.fraction-wall.v2';

export const NUM_B_FIXTURES: readonly HorizonteFixture[] = [
  {
    id: 'array-rows-columns',
    title: text('Rows and columns', 'Filas y columnas', 'Linhas e colunas'),
    ageBand: '6-9',
    eligibility: { minimum_age: 8, maximum_age: 9 },
    segment: (locale) => ({
      id: 'array-rows-columns', type: ARRAY, grading: 'server', visual: { type: 'array' },
      prompt: text('How many dots are in 3 rows of 4?', '¿Cuántos puntos hay en 3 filas de 4?', 'Quantos pontos há em 3 fileiras de 4?')[locale],
      payload: { rows: 3, columns: 4 },
    }),
    rubric: { value: 12 },
    ladder: { invalid: { value: 'twelve' }, valid: { value: '' }, met: { value: '12' } },
  },
  {
    id: 'area-box',
    title: text('Multiply with a box', 'Multiplica con una caja', 'Multiplique com uma caixa'),
    ageBand: '10-12',
    eligibility: { minimum_age: 10, maximum_age: 12 },
    segment: (locale) => ({
      id: 'area-box', type: ARRAY, grading: 'server', visual: { type: 'area-model' },
      prompt: text('Split the side of 14 into two parts. Then find 14 × 7.', 'Divide el lado de 14 en dos partes. Luego halla 14 × 7.', 'Divida o lado de 14 em duas partes. Depois ache 14 × 7.')[locale],
      payload: { across: 14, down: 7 },
    }),
    rubric: { value: 98 },
    ladder: {
      invalid: { split: 14, partials: ['70', '28'], value: '98' },
      valid: { split: 10, partials: ['', ''], value: '' },
      met: { split: 10, partials: ['70', '28'], value: '98' },
    },
  },
  {
    id: 'area-division',
    title: text('Divide with a box', 'Divide con una caja', 'Divida com uma caixa'),
    ageBand: '10-12',
    eligibility: { minimum_age: 10, maximum_age: 12 },
    segment: (locale) => ({
      id: 'area-division', type: ARRAY, grading: 'server', visual: { type: 'area-division' },
      prompt: text('A rectangle has area 156 and one side 12. Find the other side.', 'Un rectángulo tiene área 156 y un lado de 12. Halla el otro lado.', 'Um retângulo tem área 156 e um lado de 12. Ache o outro lado.')[locale],
      payload: { dividend: 156, divisor: 12 },
    }),
    rubric: { value: 13 },
    ladder: {
      invalid: { partials: ['x', ''], value: '' },
      valid: { partials: ['', ''], value: '' },
      met: { partials: ['10', '3'], value: '13' },
    },
  },
  {
    id: 'double-line-scale',
    title: text('Two lines, one ratio', 'Dos rectas, una razón', 'Duas retas, uma razão'),
    ageBand: '10-12',
    eligibility: { minimum_age: 10, maximum_age: 12 },
    segment: (locale) => ({
      id: 'double-line-scale', type: RATIO, grading: 'server', visual: { type: 'double-number-line' },
      prompt: text('3 pencils cost 6 coins. How many coins for 12 pencils?', '3 lápices cuestan 6 monedas. ¿Cuántas monedas por 12 lápices?', '3 lápis custam 6 moedas. Quantas moedas por 12 lápis?')[locale],
      payload: { units: ['pencils', 'coins'], base: [3, 6], given: { line: 'top', value: 12 } },
    }),
    rubric: { value: 24 },
    ladder: { invalid: { value: '-4' }, valid: { value: '' }, met: { value: '24' } },
  },
  {
    id: 'tape-share',
    title: text('Share with a tape', 'Reparte con una cinta', 'Divida com uma fita'),
    ageBand: '10-12',
    eligibility: { minimum_age: 10, maximum_age: 12 },
    segment: (locale) => ({
      id: 'tape-share', type: RATIO, grading: 'server', visual: { type: 'ratio-tape' },
      prompt: text('Ana and Ben share 30 stickers in the ratio 3 to 2. How many does Ben get?', 'Ana y Ben reparten 30 calcomanías en razón de 3 a 2. ¿Cuántas recibe Ben?', 'Ana e Ben dividem 30 figurinhas na razão de 3 para 2. Quantas Ben recebe?')[locale],
      payload: { unit: 'stickers', parts: [3, 2], whole: 30, ask: 'b' },
    }),
    rubric: { value: 12 },
    ladder: { invalid: { value: '-4' }, valid: { value: '' }, met: { value: '12' } },
  },
  {
    id: 'wall-equivalent',
    title: text('Match on the wall', 'Iguala en el muro', 'Iguale no muro'),
    ageBand: '6-9',
    eligibility: { minimum_age: 8, maximum_age: 9 },
    segment: (locale) => ({
      id: 'wall-equivalent', type: WALL, grading: 'server', visual: { type: 'fraction-wall' },
      prompt: text('Shade the sixths that match one half.', 'Sombrea los sextos que igualan un medio.', 'Pinte os sextos que igualam um meio.')[locale],
      payload: { op: 'equivalent', fraction: [1, 2], denominator: 6 },
    }),
    rubric: { n: 3, d: 6 },
    ladder: { invalid: { n: 0, d: 1000 }, valid: { n: 0, d: 6 }, met: { n: 3, d: 6 } },
  },
  {
    id: 'bars-add',
    title: text('Add fractions', 'Suma fracciones', 'Some frações'),
    ageBand: '10-12',
    eligibility: { minimum_age: 10, maximum_age: 12 },
    segment: (locale) => ({
      id: 'bars-add', type: WALL, grading: 'server', visual: { type: 'fraction-bars' },
      prompt: text('Add one half and one third. What is the sum?', 'Suma un medio y un tercio. ¿Cuál es la suma?', 'Some um meio e um terço. Qual é a soma?')[locale],
      payload: { op: 'add', left: [1, 2], right: [1, 3] },
    }),
    rubric: { n: 5, d: 6 },
    ladder: { invalid: { n: 5, d: 1000 }, valid: { n: 0, d: 0 }, met: { n: 5, d: 6 } },
  },
  {
    id: 'bars-subtract',
    title: text('Subtract fractions', 'Resta fracciones', 'Subtraia frações'),
    ageBand: '10-12',
    eligibility: { minimum_age: 10, maximum_age: 12 },
    segment: (locale) => ({
      id: 'bars-subtract', type: WALL, grading: 'server', visual: { type: 'fraction-bars' },
      prompt: text('Take one third from three quarters. What is left?', 'Quita un tercio de tres cuartos. ¿Cuánto queda?', 'Tire um terço de três quartos. Quanto sobra?')[locale],
      payload: { op: 'subtract', left: [3, 4], right: [1, 3] },
    }),
    rubric: { n: 5, d: 12 },
    ladder: { invalid: { n: -1, d: 12 }, valid: { n: 0, d: 0 }, met: { n: 5, d: 12 } },
  },
  {
    id: 'product-grid',
    title: text('Multiply fractions', 'Multiplica fracciones', 'Multiplique frações'),
    ageBand: '10-12',
    eligibility: { minimum_age: 10, maximum_age: 12 },
    segment: (locale) => ({
      id: 'product-grid', type: WALL, grading: 'server', visual: { type: 'fraction-product' },
      prompt: text('Find two thirds of three quarters.', 'Halla dos tercios de tres cuartos.', 'Ache dois terços de três quartos.')[locale],
      payload: { op: 'multiply', left: [2, 3], right: [3, 4] },
    }),
    rubric: { n: 1, d: 2 },
    ladder: { invalid: { n: 1000, d: 2 }, valid: { n: 0, d: 0 }, met: { n: 1, d: 2 } },
  },
  {
    id: 'measure-fit',
    title: text('How many fit', 'Cuántos caben', 'Quantos cabem'),
    ageBand: '10-12',
    eligibility: { minimum_age: 10, maximum_age: 12 },
    segment: (locale) => ({
      id: 'measure-fit', type: WALL, grading: 'server', visual: { type: 'fraction-measure' },
      prompt: text('How many thirds fit in five sixths?', '¿Cuántos tercios caben en cinco sextos?', 'Quantos terços cabem em cinco sextos?')[locale],
      payload: { op: 'divide', left: [5, 6], right: [1, 3] },
    }),
    rubric: { n: 5, d: 2 },
    ladder: { invalid: { n: 5, d: 1000 }, valid: { n: 0, d: 0 }, met: { n: 5, d: 2 } },
  },
];
