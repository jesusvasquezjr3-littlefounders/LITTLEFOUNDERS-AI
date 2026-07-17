// `input` family — one demo segment per type for /dev/lesson-lab (es-MX content).
// Fixtures are dev data, not UI strings; lesson documents are single-locale (§3).

import type { SegmentBase } from '../../core/types'

export const inputFixtures: SegmentBase[] = [
  {
    id: 'fx-type-answer',
    type: 'type_answer',
    prompt_md: '¿Cómo se llama el cochinito donde guardas tus **monedas** en casa?',
    difficulty: 1,
    xp: 10,
    hints: ['Empieza con "al…" y a veces tiene forma de puerquito.'],
    explanation_md: 'La **alcancía** es tu primer banco: ahí empieza el hábito de ahorrar.',
    narrator: { character: 'dina', emotion: 'happy' },
    payload: {
      placeholder: 'Escribe tu respuesta…',
      max_chars: 30,
    },
    answer: {
      accept: ['alcancía', 'cochinito', 'puerquito'],
      keywords: ['alcancia', 'ahorro'],
    },
  },
  {
    id: 'fx-fill-blank',
    type: 'fill_blank',
    prompt_md: 'Ayuda a Liruf a completar su **plan de ahorro**.',
    difficulty: 2,
    xp: 15,
    explanation_md: 'Si guardas **$30** cada semana, en **10** semanas juntas los $300 de la patineta.',
    narrator: { character: 'liruf', emotion: 'thinking' },
    payload: {
      text_md: 'Para comprar la patineta de **$300**, Liruf guarda {{1}} cada semana durante {{2}} semanas.',
      mode: 'bank',
      bank: [
        { id: 'b1', text_md: '$30' },
        { id: 'b2', text_md: '10' },
        { id: 'b3', text_md: '$5' },
        { id: 'b4', text_md: '100' },
      ],
    },
    answer: {
      gaps: [
        { gap: 1, bank_id: 'b1' },
        { gap: 2, bank_id: 'b2' },
      ],
    },
  },
  {
    id: 'fx-number-input',
    type: 'number_input',
    prompt_md: 'Zara vende limonada a **$12** el vaso. Hoy vendió **5** vasos. ¿Cuánto dinero juntó?',
    difficulty: 2,
    xp: 15,
    hints: ['Es lo mismo que sumar $12 cinco veces.'],
    explanation_md: '12 × 5 = **60**. ¡Multiplicar es sumar más rápido!',
    narrator: { character: 'zara', emotion: 'excited' },
    payload: {
      unit: 'pesos',
    },
    answer: { value: 60, tolerance: 0 },
  },
  {
    id: 'fx-estimate-slider',
    type: 'estimate_slider',
    prompt_md: 'Sin calcular exacto: ¿como cuánto cuesta un **helado** en la tiendita?',
    difficulty: 1,
    xp: 10,
    explanation_md: 'Un helado sencillo cuesta **más o menos $25**. Estimar te ayuda a saber si te alcanza.',
    narrator: { character: 'rho', emotion: 'thinking' },
    payload: {
      min: 0,
      max: 100,
      step: 5,
      unit: 'pesos',
      scale: 'linear',
    },
    answer: { value: 25, full_credit_delta: 10, zero_credit_delta: 50 },
  },
  {
    id: 'fx-count-objects',
    type: 'count_objects',
    prompt_md: 'En la mesa de Dina hay monedas, alcancías y bolsas. Cuenta solo las **monedas**.',
    difficulty: 1,
    xp: 10,
    hints: ['Tócalas con el dedo una por una mientras cuentas.'],
    explanation_md: 'Contar despacio y en orden es el primer paso para cuidar tu dinero.',
    narrator: { character: 'dina', emotion: 'encouraging' },
    payload: {
      scene: [
        { icon: 'paid', tint: 'warning', count: 7 },
        { icon: 'savings', tint: 'primary', count: 3 },
        { icon: 'shopping_bag', tint: 'accent', count: 4 },
      ],
      ask_icon: 'paid',
    },
    answer: { value: 7 },
  },
  {
    id: 'fx-equation-builder',
    type: 'equation_builder',
    prompt_md: 'Liruf compró **4 paletas** de **$5** cada una. Arma la ecuación que dé el total.',
    difficulty: 3,
    xp: 20,
    hints: ['Comprar 4 veces lo mismo es una multiplicación.'],
    explanation_md: '4 × 5 = **20**. ¡Y 5 × 4 también funciona: el orden no cambia el total!',
    narrator: { character: 'liruf', emotion: 'excited' },
    payload: {
      tokens: [
        { id: 't1', text: '4' },
        { id: 't2', text: '×' },
        { id: 't3', text: '5' },
        { id: 't4', text: '+' },
        { id: 't5', text: '9' },
        { id: 't6', text: '2' },
      ],
      slots: 3,
      target_result: 20,
    },
    answer: { accepted: ['4 × 5', '5 × 4'] },
  },
]
