// `maker` family — one demo segment per type for /dev/lesson-lab (es-MX content).
// Fixtures are dev data, not UI strings; lesson documents are single-locale (§3).

import type { SegmentBase } from '../../core/types'

export const makerFixtures: SegmentBase[] = [
  {
    id: 'fx-code-order',
    type: 'code_order',
    prompt_md: 'Ordena los bloques para armar la **rutina de ahorro** de Liruf.',
    difficulty: 2,
    xp: 15,
    hints: ['Todo programa empieza con `inicio` y termina mostrando el resultado.'],
    explanation_md:
      'Primero **empiezas**, luego **repites** el paso de guardar, y al final **miras** cuánto juntaste.',
    narrator: { character: 'liruf', emotion: 'excited' },
    payload: {
      blocks: [
        { id: 'b3', text_md: 'guardar(10)' },
        { id: 'b1', text_md: 'inicio' },
        { id: 'b4', text_md: 'mostrar(total)' },
        { id: 'b2', text_md: 'repetir 4 veces:' },
      ],
      language_hint: 'pseudocódigo',
    },
    answer: { order: ['b1', 'b2', 'b3', 'b4'] },
  },
  {
    id: 'fx-robot-path',
    type: 'robot_path',
    prompt_md: 'Guía a Liruf hasta la **moneda**. Arma tu programa y presiona **Ejecutar**.',
    difficulty: 3,
    xp: 20,
    hints: ['Primero avanza hacia arriba y luego gira hacia la moneda.'],
    explanation_md: 'Un robot solo hace **exactamente** lo que su programa dice, paso por paso.',
    narrator: { character: 'dina', emotion: 'happy' },
    payload: {
      grid: { w: 4, h: 4 },
      start: { x: 0, y: 3, dir: 'up' },
      goal: { x: 3, y: 0 },
      walls: [
        { x: 1, y: 2 },
        { x: 2, y: 1 },
      ],
      commands: ['forward', 'left', 'right'],
      max_commands: 10,
    },
    answer: {},
  },
  {
    id: 'fx-debug-hunt',
    type: 'debug_hunt',
    prompt_md: 'La rutina de ahorro de Zara tiene un **error**. ¡Encuéntralo!',
    difficulty: 3,
    xp: 20,
    hints: ['La meta es AHORRAR… ¿todas las líneas ayudan a ahorrar?'],
    explanation_md: 'Depurar es leer línea por línea y preguntarte: ¿esto hace lo que **queremos**?',
    narrator: { character: 'zara', emotion: 'thinking' },
    payload: {
      intro_md:
        'Zara quiere juntar **$40** guardando $10 cada semana. Toca la línea que está **mal**.',
      blocks: [
        { id: 'b1', text_md: 'meta = 40' },
        { id: 'b2', text_md: 'cada semana:' },
        { id: 'b3', text_md: 'gastar(10)' },
        { id: 'b4', text_md: 'total = total + 10' },
        { id: 'b5', text_md: 'si total >= meta: celebrar()' },
      ],
    },
    answer: {
      bug_ids: ['b3'],
      fix_md: 'Cambia `gastar(10)` por `guardar(10)` — ¡queremos **ahorrar**, no gastar!',
    },
  },
  {
    id: 'fx-balance-scale',
    type: 'balance_scale',
    prompt_md: 'El cofre pesa **12**. Coloca pesas hasta que la balanza quede **pareja**.',
    difficulty: 2,
    xp: 15,
    hints: ['Suma pesas hasta llegar exactamente a 12: prueba con las más grandes primero.'],
    explanation_md: 'Cuando los dos lados **suman lo mismo**, la balanza no se inclina: 5 + 4 + 3 = 12.',
    narrator: { character: 'rho', emotion: 'thinking' },
    payload: {
      left_fixed: [{ label: 'Cofre', value: 12 }],
      weights: [
        { id: 'w5', label: '5', value: 5 },
        { id: 'w4', label: '4', value: 4 },
        { id: 'w3', label: '3', value: 3 },
        { id: 'w2', label: '2', value: 2 },
        { id: 'w1', label: '1', value: 1 },
      ],
    },
    answer: {},
  },
  {
    id: 'fx-measure-read',
    type: 'measure_read',
    prompt_md: 'El termómetro del laboratorio marca la temperatura. ¿Cuántos **grados** lees?',
    difficulty: 2,
    xp: 15,
    hints: ['Cada rayita del tubo vale 5 grados.'],
    explanation_md: 'El líquido sube hasta la marca de **25 °C**: entre 20 y 30, justo a la mitad.',
    narrator: { character: 'dina', emotion: 'thinking' },
    payload: {
      instrument: 'thermometer',
      min: 0,
      max: 40,
      ticks: 9,
      unit: '°C',
      pointer_value: 25,
    },
    answer: { value: 25, tolerance: 1 },
  },
  {
    id: 'fx-machine-io',
    type: 'machine_io',
    prompt_md: 'La **máquina misteriosa** transforma números. Descubre su regla y predice la salida.',
    difficulty: 3,
    xp: 20,
    hints: ['Mira cuánto crece cada número: ¿lo multiplica y luego suma algo?'],
    explanation_md: 'La regla es **×2 +1**: entra 6, la máquina hace 6 × 2 = 12 y 12 + 1 = **13**.',
    narrator: { character: 'rho', emotion: 'excited' },
    payload: {
      examples: [
        { in: 2, out: 5 },
        { in: 3, out: 7 },
        { in: 5, out: 11 },
      ],
      probe_in: 6,
    },
    answer: { value: 13 },
  },
]
