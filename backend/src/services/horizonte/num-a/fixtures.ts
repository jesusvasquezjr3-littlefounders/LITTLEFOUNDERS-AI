import type { HorizonteFixture, HorizonteLocale } from '../types.js';

const text = (en: string, es: string, pt: string): Record<HorizonteLocale, string> => ({ 'en-US': en, 'es-MX': es, 'pt-BR': pt });
const young = { ageBand: '6-9', eligibility: { minimum_age: 6, maximum_age: 9 } } as const;
const older = { ageBand: '10-12', eligibility: { minimum_age: 10, maximum_age: 12 } } as const;

export const NUM_A_FIXTURES: readonly HorizonteFixture[] = [
  {
    id: 'rekenrek-seven', title: text('Show seven', 'Muestra siete', 'Mostre sete'), ...young,
    segment: (locale) => ({
      id: 'rekenrek-seven', type: 'math.rekenrek.v2', grading: 'server', visual: { type: 'rekenrek' },
      prompt: text('Slide 5 beads on top and 2 below.', 'Desliza 5 cuentas arriba y 2 abajo.', 'Deslize 5 contas em cima e 2 embaixo.')[locale],
      payload: { start: [0, 0] },
    }),
    rubric: { target: [5, 2] },
    ladder: { invalid: { beads: [11, 0] }, valid: { beads: [0, 0] }, met: { beads: [5, 2] } },
  },
  {
    id: 'rekenrek-ten', title: text('Make ten', 'Completa diez', 'Complete dez'), ...young,
    segment: (locale) => ({
      id: 'rekenrek-ten', type: 'math.rekenrek.v2', grading: 'server', visual: { type: 'rekenrek' },
      prompt: text('Slide beads until the top row shows ten.', 'Desliza cuentas hasta que la fila de arriba muestre diez.', 'Deslize contas até a fila de cima mostrar dez.')[locale],
      payload: { start: [6, 0] },
    }),
    rubric: { target: [10, 0] },
    ladder: { invalid: { beads: [6] }, valid: { beads: [6, 0] }, met: { beads: [10, 0] } },
  },
  {
    id: 'abacus-forty-seven', title: text('Show a number', 'Muestra un número', 'Mostre um número'), ...young,
    segment: (locale) => ({
      id: 'abacus-forty-seven', type: 'math.abacus.v2', grading: 'server', visual: { type: 'abacus' },
      prompt: text('Show 47 on the abacus.', 'Muestra 47 en el ábaco.', 'Mostre 47 no ábaco.')[locale],
      payload: { start: [0, 0] },
    }),
    rubric: { target: [4, 7] },
    ladder: { invalid: { digits: [4, 10] }, valid: { digits: [0, 0] }, met: { digits: [4, 7] } },
  },
  {
    id: 'abacus-add-twenty', title: text('Add on the abacus', 'Suma en el ábaco', 'Some no ábaco'), ...young,
    segment: (locale) => ({
      id: 'abacus-add-twenty', type: 'math.abacus.v2', grading: 'server', visual: { type: 'abacus' },
      prompt: text('Add 20 to 35 on the abacus.', 'Suma 20 a 35 en el ábaco.', 'Some 20 a 35 no ábaco.')[locale],
      payload: { start: [3, 5] },
    }),
    rubric: { target: [5, 5] },
    ladder: { invalid: { digits: [3] }, valid: { digits: [3, 5] }, met: { digits: [5, 5] } },
  },
  {
    id: 'jump-up', title: text('Jump on the line', 'Saltos en la recta', 'Saltos na reta'), ...young,
    segment: (locale) => ({
      id: 'jump-up', type: 'math.number-line.empty.v2', grading: 'server', visual: { type: 'empty-number-line' },
      prompt: text('Jump from 47 to 73.', 'Salta de 47 a 73.', 'Pule de 47 a 73.')[locale],
      payload: { start: 47, sizes: [1, 5, 10, 20], max: 6 },
    }),
    rubric: { target: 73 },
    ladder: { invalid: { jumps: [3] }, valid: { jumps: [] }, met: { jumps: [20, 5, 1] } },
  },
  {
    id: 'jump-back', title: text('Jump back', 'Saltos hacia atrás', 'Saltos para trás'), ...young,
    segment: (locale) => ({
      id: 'jump-back', type: 'math.number-line.empty.v2', grading: 'server', visual: { type: 'empty-number-line' },
      prompt: text('Jump back from 62 to 38.', 'Salta hacia atrás de 62 a 38.', 'Pule para trás de 62 a 38.')[locale],
      payload: { start: 62, sizes: [1, 2, 10, 20], max: 4 },
    }),
    rubric: { target: 38 },
    ladder: { invalid: { jumps: [-100] }, valid: { jumps: [] }, met: { jumps: [-20, -2, -2] } },
  },
  {
    id: 'zoom-tenths', title: text('Place a decimal', 'Ubica un decimal', 'Posicione um decimal'), ...older,
    segment: (locale) => ({
      id: 'zoom-tenths', type: 'math.number-line.zoom.v2', grading: 'server', visual: { type: 'zoom-number-line' },
      prompt: text('Place 3.4 on the line. Zoom in to see tenths.', 'Ubica 3.4 en la recta. Acércate para ver décimas.', 'Posicione 3,4 na reta. Aproxime para ver décimos.')[locale],
      payload: { low: 0, high: 10, depth: 1, start: 0 },
    }),
    rubric: { target: 34 },
    ladder: { invalid: { units: 101 }, valid: { units: 0 }, met: { units: 34 } },
  },
  {
    id: 'zoom-hundredths', title: text('Hundredths', 'Centésimas', 'Centésimos'), ...older,
    segment: (locale) => ({
      id: 'zoom-hundredths', type: 'math.number-line.zoom.v2', grading: 'server', visual: { type: 'zoom-number-line' },
      prompt: text('Place 3.47 on the line. Zoom in twice.', 'Ubica 3.47 en la recta. Acércate dos veces.', 'Posicione 3,47 na reta. Aproxime duas vezes.')[locale],
      payload: { low: 0, high: 5, depth: 2, start: 0 },
    }),
    rubric: { target: 347 },
    ladder: { invalid: { units: -1 }, valid: { units: 0 }, met: { units: 347 } },
  },
  {
    id: 'clock-half-past', title: text('Set the clock', 'Pon la hora', 'Acerte o relógio'), ...young,
    segment: (locale) => ({
      id: 'clock-half-past', type: 'math.clock.v2', grading: 'server', visual: { type: 'analog-clock' },
      prompt: text('Show half past three.', 'Muestra las tres y media.', 'Mostre três e meia.')[locale],
      payload: { start: 0, step: 15 },
    }),
    rubric: { target: 210 },
    ladder: { invalid: { minutes: 720 }, valid: { minutes: 0 }, met: { minutes: 210 } },
  },
  {
    id: 'clock-later', title: text('Time that passes', 'El tiempo que pasa', 'O tempo que passa'), ...young,
    segment: (locale) => ({
      id: 'clock-later', type: 'math.clock.v2', grading: 'server', visual: { type: 'analog-clock' },
      prompt: text('Show the time 25 minutes later.', 'Muestra la hora 25 minutos después.', 'Mostre a hora 25 minutos depois.')[locale],
      payload: { start: 195, step: 5 },
    }),
    rubric: { target: 220 },
    ladder: { invalid: { minutes: 223 }, valid: { minutes: 195 }, met: { minutes: 220 } },
  },
  {
    id: 'ruler-six', title: text('Measure with a ruler', 'Mide con una regla', 'Meça com uma régua'), ...young,
    segment: (locale) => ({
      id: 'ruler-six', type: 'math.ruler.v2', grading: 'server', visual: { type: 'ruler' },
      prompt: text('Make the bar 6 cm long.', 'Haz la barra de 6 cm.', 'Faça a barra com 6 cm.')[locale],
      payload: { unit: 'cm', from: 2, start: 3, max: 10 },
    }),
    rubric: { target: 8 },
    ladder: { invalid: { end: 1 }, valid: { end: 3 }, met: { end: 8 } },
  },
  {
    id: 'ruler-inches', title: text('Inches', 'Pulgadas', 'Polegadas'), ...young,
    segment: (locale) => ({
      id: 'ruler-inches', type: 'math.ruler.v2', grading: 'server', visual: { type: 'ruler' },
      prompt: text('Make the bar 4 inches long.', 'Haz la barra de 4 pulgadas.', 'Faça a barra com 4 polegadas.')[locale],
      payload: { unit: 'in', from: 3, start: 3, max: 9 },
    }),
    rubric: { target: 7 },
    ladder: { invalid: { end: 10 }, valid: { end: 3 }, met: { end: 7 } },
  },
  {
    id: 'balance-it', title: text('Balance the pans', 'Equilibra la balanza', 'Equilibre a balança'), ...young,
    segment: (locale) => ({
      id: 'balance-it', type: 'math.pan-balance.v2', grading: 'server', visual: { type: 'pan-balance' },
      prompt: text('Make both pans balance.', 'Equilibra los dos platillos.', 'Equilibre os dois pratos.')[locale],
      payload: { left: [5], right: [], weights: [1, 2, 2, 3] },
    }),
    rubric: { target: 0 },
    ladder: { invalid: { pans: [3, 0, 0, 0] }, valid: { pans: [0, 0, 0, 0] }, met: { pans: [0, 0, 2, 2] } },
  },
  {
    id: 'balance-heavier', title: text('Compare the weights', 'Compara las masas', 'Compare as massas'), ...young,
    segment: (locale) => ({
      id: 'balance-heavier', type: 'math.pan-balance.v2', grading: 'server', visual: { type: 'pan-balance' },
      prompt: text('Make the left pan 2 heavier.', 'Haz el platillo izquierdo 2 más pesado.', 'Deixe o prato esquerdo 2 mais pesado.')[locale],
      payload: { left: [4], right: [4], weights: [1, 2, 3] },
    }),
    rubric: { target: 2 },
    ladder: { invalid: { pans: [1, 1] }, valid: { pans: [0, 0, 0] }, met: { pans: [2, 0, 1] } },
  },
];
