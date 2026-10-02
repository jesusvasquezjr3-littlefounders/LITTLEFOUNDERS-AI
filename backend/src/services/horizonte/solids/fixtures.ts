import type { HorizonteFixture, HorizonteLocale } from '../types.js';

const text = (en: string, es: string, pt: string): Record<HorizonteLocale, string> => ({ 'en-US': en, 'es-MX': es, 'pt-BR': pt });

const cube = (count: number): string[] => Array.from({ length: count }, () => 'cube');

export const SOLIDS_FIXTURES: readonly HorizonteFixture[] = [
  {
    id: 'which-has-no-vertices',
    title: text('Which solid has no vertices?', '¿Qué cuerpo no tiene vértices?', 'Qual sólido não tem vértices?'),
    ageBand: '6-9',
    eligibility: { minimum_age: 7, maximum_age: 9 },
    segment: (locale) => ({
      id: 'solid-viewer-no-vertices', type: 'geometry.solid-viewer.v2', grading: 'server', visual: { type: 'solid-viewer' },
      prompt: text(
        'Turn the solids and find the one with no vertices. Then count its faces.',
        'Gira los cuerpos y encuentra el que no tiene vértices. Luego cuenta sus caras.',
        'Gire os sólidos e encontre o que não tem vértices. Depois conte as faces dele.',
      )[locale],
      payload: { solids: ['cube', 'cylinder', 'pyramid'], find: { kind: 'vertices', count: 0 }, report: 'faces' },
    }),
    rubric: { solid: 'cylinder', count: '3' },
    ladder: { invalid: { solid: 'sphere', count: '3' }, valid: { solid: '', count: '' }, met: { solid: 'cylinder', count: '3' } },
  },
  {
    id: 'nine-edges',
    title: text('The solid with nine edges', 'El cuerpo con nueve aristas', 'O sólido com nove arestas'),
    ageBand: '10-12',
    eligibility: { minimum_age: 10, maximum_age: 12 },
    segment: (locale) => ({
      id: 'solid-viewer-nine-edges', type: 'geometry.solid-viewer.v2', grading: 'server', visual: { type: 'solid-viewer' },
      prompt: text(
        'Turn the solids and find the one with nine edges. Then count its vertices.',
        'Gira los cuerpos y encuentra el que tiene nueve aristas. Luego cuenta sus vértices.',
        'Gire os sólidos e encontre o que tem nove arestas. Depois conte os vértices dele.',
      )[locale],
      payload: { solids: ['cube', 'prism', 'pyramid', 'cylinder'], find: { kind: 'edges', count: 9 }, report: 'vertices' },
    }),
    rubric: { solid: 'prism', count: '6' },
    ladder: { invalid: { solid: 'sphere', count: '6' }, valid: { solid: '', count: '' }, met: { solid: 'prism', count: '6' } },
  },
  {
    id: 'name-the-faces',
    title: text('Name the faces of the cube', 'Nombra las caras del cubo', 'Nomeie as faces do cubo'),
    ageBand: '6-9',
    eligibility: { minimum_age: 7, maximum_age: 9 },
    segment: (locale) => ({
      id: 'cube-net-name-faces', type: 'geometry.cube-net.v2', grading: 'server', visual: { type: 'cube-net' },
      prompt: text(
        'This net folds into a cube. Two faces are named. Name the other four.',
        'Esta plantilla se dobla y forma un cubo. Dos caras ya tienen nombre. Nombra las otras cuatro.',
        'Esta planificação dobra e forma um cubo. Duas faces já têm nome. Nomeie as outras quatro.',
      )[locale],
      payload: {
        mode: 'label',
        cells: [[1, 0], [0, 1], [1, 1], [2, 1], [3, 1], [1, 2]],
        fixed: [{ cell: 2, name: 'front' }, { cell: 3, name: 'right' }],
        edge: 2,
      },
    }),
    rubric: { solutions: [{ cell0: ['top'], cell1: ['left'], cell2: ['front'], cell3: ['right'], cell4: ['back'], cell5: ['bottom'] }] },
    ladder: {
      invalid: { slots: { cell2: ['top'], cell3: ['right'] } },
      valid: { slots: { cell2: ['front'], cell3: ['right'] } },
      met: { slots: { cell0: ['top'], cell1: ['left'], cell2: ['front'], cell3: ['right'], cell4: ['back'], cell5: ['bottom'] } },
    },
  },
  {
    id: 'finish-the-net',
    title: text('Finish the net', 'Completa la plantilla', 'Complete a planificação'),
    ageBand: '10-12',
    eligibility: { minimum_age: 10, maximum_age: 12 },
    segment: (locale) => ({
      id: 'cube-net-finish', type: 'geometry.cube-net.v2', grading: 'server', visual: { type: 'cube-net' },
      prompt: text(
        'Three squares are placed. Add three more so the net folds into a cube.',
        'Hay tres cuadrados colocados. Agrega tres más para que la plantilla se doble y forme un cubo.',
        'Há três quadrados colocados. Adicione mais três para que a planificação dobre e forme um cubo.',
      )[locale],
      payload: { mode: 'complete', grid: { cols: 4, rows: 3 }, fixed: [[0, 1], [1, 1], [2, 1]], edge: 2 },
    }),
    rubric: { solutions: [{ g0x1: ['square'], g1x1: ['square'], g2x1: ['square'], g3x1: ['square'], g1x0: ['square'], g1x2: ['square'] }] },
    ladder: {
      invalid: { slots: { g0x1: ['square'], g1x1: ['square'] } },
      valid: { slots: { g0x1: ['square'], g1x1: ['square'], g2x1: ['square'] } },
      met: { slots: { g0x1: ['square'], g1x1: ['square'], g2x1: ['square'], g3x1: ['square'], g1x0: ['square'], g1x2: ['square'] } },
    },
  },
  {
    id: 'staircase',
    title: text('Build the staircase', 'Construye la escalera', 'Construa a escada'),
    ageBand: '10-12',
    eligibility: { minimum_age: 10, maximum_age: 12 },
    segment: (locale) => ({
      id: 'cube-stack-staircase', type: 'geometry.cube-stack.v2', grading: 'server', visual: { type: 'cube-stack' },
      prompt: text(
        'Build with the fewest cubes so the front view reads 3, 2, 1 and the side view reads 3, 2, 1.',
        'Construye con la menor cantidad de cubos para que la vista frontal sea 3, 2, 1 y la vista lateral sea 3, 2, 1.',
        'Construa com o menor número de cubos para que a vista frontal seja 3, 2, 1 e a vista lateral seja 3, 2, 1.',
      )[locale],
      payload: { size: 3, start: [[0, 0, 0], [0, 0, 0], [1, 0, 0]], goal: { front: [3, 2, 1], side: [3, 2, 1] }, fewest: true },
    }),
    rubric: { solutions: [{ c2r0: cube(1), c1r1: cube(2), c0r2: cube(3) }] },
    ladder: {
      invalid: { slots: { c9r9: cube(1) } },
      valid: { slots: { c0r2: cube(1) } },
      met: { slots: { c2r0: cube(1), c1r1: cube(2), c0r2: cube(3) } },
    },
  },
  {
    id: 'two-by-two',
    title: text('Match the three views', 'Iguala las tres vistas', 'Combine as três vistas'),
    ageBand: '6-9',
    eligibility: { minimum_age: 6, maximum_age: 9 },
    segment: (locale) => ({
      id: 'cube-stack-two-by-two', type: 'geometry.cube-stack.v2', grading: 'server', visual: { type: 'cube-stack' },
      prompt: text(
        'Build a stack that matches the front view, the side view and the view from above.',
        'Construye una pila que coincida con la vista frontal, la vista lateral y la vista desde arriba.',
        'Construa uma pilha que combine com a vista frontal, a vista lateral e a vista de cima.',
      )[locale],
      payload: { size: 2, start: [[1, 0], [0, 0]], goal: { front: [2, 2], side: [2, 2], plan: [[1, 0], [0, 1]] }, fewest: false },
    }),
    rubric: { solutions: [{ c0r0: cube(2), c1r1: cube(2) }] },
    ladder: {
      invalid: { slots: { c0r0: cube(4) } },
      valid: { slots: { c0r0: cube(1) } },
      met: { slots: { c0r0: cube(2), c1r1: cube(2) } },
    },
  },
];
