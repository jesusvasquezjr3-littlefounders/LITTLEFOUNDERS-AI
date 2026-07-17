// `choice` family — one demo segment per type for /dev/lesson-lab (es-MX content).
// Fixtures are dev data, not UI strings; lesson documents are single-locale (§3).

import type { SegmentBase } from '../../core/types'

export const choiceFixtures: SegmentBase[] = [
  {
    id: 'fx-quiz-mcq',
    type: 'quiz_mcq',
    prompt_md: '¿Qué es el **ahorro**?',
    difficulty: 1,
    xp: 10,
    hints: ['Piensa en tu alcancía: ¿qué haces con las monedas que guardas?'],
    explanation_md: 'Ahorrar es **guardar una parte** de tu dinero hoy para poder usarlo después.',
    narrator: { character: 'dina', emotion: 'happy' },
    payload: {
      options: [
        { id: 'a', text_md: 'Guardar una parte de mi dinero para después' },
        {
          id: 'b',
          text_md: 'Gastar todo mi dinero en dulces',
          rationale_md: 'Eso es *gastar*, no ahorrar. Si gastas todo hoy, no te queda nada para mañana.',
        },
        {
          id: 'c',
          text_md: 'Pedir dinero prestado',
          rationale_md: 'Pedir prestado es lo contrario: usar dinero que **no** es tuyo todavía.',
        },
      ],
    },
    answer: { correct_option_id: 'a' },
  },
  {
    id: 'fx-true-false',
    type: 'true_false',
    prompt_md: 'Liruf dice una frase. ¿Es cierta?',
    difficulty: 2,
    xp: 10,
    explanation_md: 'El dinero que ahorras **sigue siendo tuyo** — solo espera a que lo necesites.',
    narrator: { character: 'liruf', emotion: 'thinking' },
    payload: {
      statement_md: 'Si ahorro mi dinero, **lo pierdo** para siempre.',
      justifications: [
        { id: 'j1', text_md: 'Cierto, porque ya no lo puedo tocar.' },
        { id: 'j2', text_md: 'Falso, porque sigue siendo mío y lo uso cuando lo necesite.' },
        { id: 'j3', text_md: 'Falso, porque la alcancía lo convierte en más dinero sola.' },
      ],
    },
    answer: { is_true: false, correct_justification_id: 'j2' },
  },
  {
    id: 'fx-picture-choice',
    type: 'picture_choice',
    prompt_md: '¿Dónde está más **seguro** tu dinero?',
    difficulty: 1,
    xp: 10,
    explanation_md: 'Un banco guarda tu dinero con **seguridad** y hasta puede pagarte intereses.',
    narrator: { character: 'rho', emotion: 'thinking' },
    payload: {
      options: [
        { id: 'a', icon: 'account_balance', label: 'En el banco' },
        {
          id: 'b',
          icon: 'grass',
          label: 'Bajo una piedra',
          rationale_md: 'Bajo una piedra cualquiera lo puede encontrar… ¡o la lluvia lo arruina!',
        },
        {
          id: 'c',
          icon: 'backpack',
          label: 'En la mochila',
          rationale_md: 'La mochila viaja contigo a todos lados: es fácil perderla o que se caiga.',
        },
      ],
    },
    answer: { correct_option_id: 'a' },
  },
  {
    id: 'fx-odd-one-out',
    type: 'odd_one_out',
    prompt_md: 'Una de estas cosas **no** es dinero. ¿Cuál?',
    difficulty: 2,
    xp: 15,
    narrator: { character: 'zara', emotion: 'thinking' },
    payload: {
      items: [
        { id: 'i1', text_md: 'Moneda de $10' },
        { id: 'i2', text_md: 'Billete de $50' },
        { id: 'i3', text_md: 'Una hoja de árbol' },
        { id: 'i4', text_md: 'Tarjeta de débito' },
      ],
      reasons: [
        { id: 'r1', text_md: 'Porque nadie la acepta para pagar' },
        { id: 'r2', text_md: 'Porque es de color verde' },
        { id: 'r3', text_md: 'Porque es muy pequeña' },
      ],
    },
    answer: { odd_item_id: 'i3', correct_reason_id: 'r1' },
  },
  {
    id: 'fx-best-decision',
    type: 'best_decision',
    prompt_md: '¿Qué harías tú?',
    difficulty: 3,
    xp: 15,
    explanation_md: 'Comparar precios **antes** de comprar te deja más dinero para tus metas.',
    narrator: { character: 'zara', emotion: 'happy' },
    payload: {
      scenario_md:
        'Quieres una pelota que cuesta **$80**. En la tienda de enfrente la misma pelota cuesta **$60**.',
      options: [
        {
          id: 'a',
          text_md: 'Comprarla de inmediato por $80, ¡ya la quiero!',
          rationale_md: 'La prisa cuesta: pagaste **$20 extra** por no cruzar la calle.',
        },
        {
          id: 'b',
          text_md: 'Cruzar y comprarla por $60',
          rationale_md: '¡Bien! Comparar precios te ahorró **$20** que puedes guardar.',
        },
        {
          id: 'c',
          text_md: 'No comprar nada nunca',
          rationale_md: 'Ahorrar está genial, pero el dinero también sirve para disfrutarse **con plan**.',
        },
      ],
    },
    answer: { qualities: { a: 20, b: 100, c: 55 } },
  },
  {
    id: 'fx-yes-no-cases',
    type: 'yes_no_cases',
    prompt_md: 'Regla del detective Rho: ¿es una **necesidad**?',
    difficulty: 2,
    xp: 15,
    narrator: { character: 'rho', emotion: 'thinking' },
    payload: {
      rule_md: 'Una **necesidad** es algo sin lo que no puedes vivir bien: comida, agua, casa, salud.',
      cases: [
        { id: 'c1', text_md: 'Agua para beber' },
        { id: 'c2', text_md: 'El videojuego nuevo' },
        { id: 'c3', text_md: 'Zapatos para ir a la escuela' },
        { id: 'c4', text_md: 'Un dulce gigante' },
      ],
    },
    answer: { applies_ids: ['c1', 'c3'] },
  },
  {
    id: 'fx-speed-tap',
    type: 'speed_tap',
    prompt_md: '¡Rápido! Toca solo las **monedas**.',
    difficulty: 2,
    xp: 15,
    narrator: { character: 'liruf', emotion: 'excited' },
    payload: {
      instruction_md: 'Toca todas las cosas que son **dinero en monedas**. ¡Tienes 20 segundos!',
      items: [
        { id: 'm1', text_md: '$1' },
        { id: 'b1', text_md: 'Billete $20' },
        { id: 'm2', text_md: '$5' },
        { id: 'x1', text_md: 'Botón' },
        { id: 'm3', text_md: '$10' },
        { id: 'x2', text_md: 'Sticker' },
        { id: 'b2', text_md: 'Billete $100' },
        { id: 'm4', text_md: '50¢' },
      ],
      seconds: 20,
    },
    answer: { target_ids: ['m1', 'm2', 'm3', 'm4'] },
  },
  {
    id: 'fx-confidence-quiz',
    type: 'confidence_quiz',
    prompt_md: 'Si guardo $10 cada semana, ¿cuánto tengo en **4 semanas**? Y dime qué tan seguro estás.',
    difficulty: 3,
    xp: 20,
    explanation_md: '$10 × 4 semanas = **$40**. ¡La constancia suma!',
    narrator: { character: 'dina', emotion: 'thinking' },
    payload: {
      options: [
        { id: 'a', text_md: '$14', rationale_md: 'Sumaste 10 + 4 — pero cada semana agregas **otros** $10.' },
        { id: 'b', text_md: '$40' },
        { id: 'c', text_md: '$1000', rationale_md: '¡Ojalá! Pero $10 por 4 semanas son 10+10+10+10.' },
      ],
    },
    answer: { correct_option_id: 'b' },
  },
]
