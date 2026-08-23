// `input` family — one demo segment per type for /dev/lesson-lab.
// Written per locale; see `../../lab/fixtureCopy.ts`. Structure and answer keys
// are written once and are identical in every locale by construction — with one
// deliberate exception noted below (`type_answer`'s accepted spellings, which
// ARE the answer and are words).

import type { Locale } from '@/i18n'
import type { SegmentBase } from '../../core/types'
import { copyPack, type Copy } from '../../lab/fixtureCopy'

const EN = {
  typePrompt: 'What do you call the little pot where you keep your **coins** at home?',
  typeHint: 'It starts with "pig…" and it is usually shaped like one.',
  typeExplain: 'A **piggy bank** is your first bank: the saving habit starts there.',
  typePlaceholder: 'Type your answer…',
  /** Accepted spellings — the answer itself, so it is copy in every locale. */
  typeAccept1: 'piggy bank',
  typeAccept2: 'piggybank',
  typeAccept3: 'money box',
  typeKeyword1: 'piggy',
  typeKeyword2: 'saving',

  blankPrompt: "Help Liruf finish his **savings plan**.",
  blankExplain: 'Save **$30** a week and in **10** weeks you have the $300 for the skateboard.',
  blankText: 'To buy the **$300** skateboard, Liruf saves {{1}} every week for {{2}} weeks.',
  blankB1: '$30',
  blankB2: '10',
  blankB3: '$5',
  blankB4: '100',

  numPrompt: 'Zara sells lemonade at **$12** a cup. Today she sold **5** cups. How much money did she take?',
  numHint: 'It is the same as adding $12 five times.',
  numExplain: '12 × 5 = **60**. Multiplying is adding, faster!',
  numUnit: 'dollars',

  estPrompt: 'No exact maths: roughly how much does an **ice cream** cost at the corner shop?',
  estExplain: 'A simple ice cream costs **about $25**. Estimating tells you whether you can afford it.',
  estUnit: 'dollars',

  countPrompt: "On Dina's table there are coins, piggy banks and bags. Count only the **coins**.",
  countHint: 'Touch them one by one with your finger as you count.',
  countExplain: 'Counting slowly and in order is the first step to looking after your money.',
  countCoins: 'coins',
  countBanks: 'piggy banks',
  countBags: 'bags',

  eqPrompt: 'Liruf bought **4 ice pops** at **$5** each. Build the equation that gives the total.',
  eqHint: 'Buying the same thing 4 times is a multiplication.',
  eqExplain: '4 × 5 = **20**. And 5 × 4 works too: the order does not change the total!',
} as const

const ES: Copy<typeof EN> = {
  typePrompt: '¿Cómo se llama el cochinito donde guardas tus **monedas** en casa?',
  typeHint: 'Empieza con "al…" y a veces tiene forma de puerquito.',
  typeExplain: 'La **alcancía** es tu primer banco: ahí empieza el hábito de ahorrar.',
  typePlaceholder: 'Escribe tu respuesta…',
  typeAccept1: 'alcancía',
  typeAccept2: 'cochinito',
  typeAccept3: 'puerquito',
  typeKeyword1: 'alcancia',
  typeKeyword2: 'ahorro',

  blankPrompt: 'Ayuda a Liruf a completar su **plan de ahorro**.',
  blankExplain:
    'Si guardas **$30** cada semana, en **10** semanas juntas los $300 de la patineta.',
  blankText:
    'Para comprar la patineta de **$300**, Liruf guarda {{1}} cada semana durante {{2}} semanas.',
  blankB1: '$30',
  blankB2: '10',
  blankB3: '$5',
  blankB4: '100',

  numPrompt: 'Zara vende limonada a **$12** el vaso. Hoy vendió **5** vasos. ¿Cuánto dinero juntó?',
  numHint: 'Es lo mismo que sumar $12 cinco veces.',
  numExplain: '12 × 5 = **60**. ¡Multiplicar es sumar más rápido!',
  numUnit: 'pesos',

  estPrompt: 'Sin calcular exacto: ¿como cuánto cuesta un **helado** en la tiendita?',
  estExplain:
    'Un helado sencillo cuesta **más o menos $25**. Estimar te ayuda a saber si te alcanza.',
  estUnit: 'pesos',

  countPrompt: 'En la mesa de Dina hay monedas, alcancías y bolsas. Cuenta solo las **monedas**.',
  countHint: 'Tócalas con el dedo una por una mientras cuentas.',
  countExplain: 'Contar despacio y en orden es el primer paso para cuidar tu dinero.',
  countCoins: 'monedas',
  countBanks: 'alcancías',
  countBags: 'bolsas',

  eqPrompt: 'Liruf compró **4 paletas** de **$5** cada una. Arma la ecuación que dé el total.',
  eqHint: 'Comprar 4 veces lo mismo es una multiplicación.',
  eqExplain: '4 × 5 = **20**. ¡Y 5 × 4 también funciona: el orden no cambia el total!',
}

const PT: Copy<typeof EN> = {
  typePrompt: 'Como se chama o potinho onde você guarda suas **moedas** em casa?',
  typeHint: 'Começa com "cofr…" e costuma ter forma de porquinho.',
  typeExplain: 'O **cofrinho** é o seu primeiro banco: o hábito de poupar começa nele.',
  typePlaceholder: 'Escreva sua resposta…',
  typeAccept1: 'cofrinho',
  typeAccept2: 'cofre',
  typeAccept3: 'porquinho',
  typeKeyword1: 'cofrinho',
  typeKeyword2: 'poupar',

  blankPrompt: 'Ajude Liruf a completar o **plano de poupança**.',
  blankExplain:
    'Guardando **R$30** por semana, em **10** semanas você junta os R$300 do skate.',
  blankText:
    'Para comprar o skate de **R$300**, Liruf guarda {{1}} por semana durante {{2}} semanas.',
  blankB1: 'R$30',
  blankB2: '10',
  blankB3: 'R$5',
  blankB4: '100',

  numPrompt: 'Zara vende limonada a **R$12** o copo. Hoje vendeu **5** copos. Quanto dinheiro juntou?',
  numHint: 'É o mesmo que somar R$12 cinco vezes.',
  numExplain: '12 × 5 = **60**. Multiplicar é somar mais rápido!',
  numUnit: 'reais',

  estPrompt: 'Sem conta exata: mais ou menos quanto custa um **sorvete** na vendinha?',
  estExplain:
    'Um sorvete simples custa **mais ou menos R$25**. Estimar ajuda a saber se dá para pagar.',
  estUnit: 'reais',

  countPrompt: 'Na mesa da Dina há moedas, cofrinhos e sacolas. Conte só as **moedas**.',
  countHint: 'Toque uma por uma com o dedo enquanto conta.',
  countExplain: 'Contar devagar e em ordem é o primeiro passo para cuidar do seu dinheiro.',
  countCoins: 'moedas',
  countBanks: 'cofrinhos',
  countBags: 'sacolas',

  eqPrompt: 'Liruf comprou **4 picolés** de **R$5** cada. Monte a equação que dá o total.',
  eqHint: 'Comprar 4 vezes a mesma coisa é uma multiplicação.',
  eqExplain: '4 × 5 = **20**. E 5 × 4 também vale: a ordem não muda o total!',
}

const COPY = copyPack(EN, ES, PT)

export function inputFixtures(locale: Locale): SegmentBase[] {
  const c = COPY[locale]
  return [
    {
      id: 'fx-type-answer',
      type: 'type_answer',
      prompt_md: c.typePrompt,
      difficulty: 1,
      xp: 10,
      hints: [c.typeHint],
      explanation_md: c.typeExplain,
      narrator: { character: 'dina', emotion: 'happy' },
      payload: { placeholder: c.typePlaceholder, max_chars: 30 },
      answer: {
        accept: [c.typeAccept1, c.typeAccept2, c.typeAccept3],
        keywords: [c.typeKeyword1, c.typeKeyword2],
      },
    },
    {
      id: 'fx-fill-blank',
      type: 'fill_blank',
      prompt_md: c.blankPrompt,
      difficulty: 2,
      xp: 15,
      explanation_md: c.blankExplain,
      narrator: { character: 'liruf', emotion: 'thinking' },
      payload: {
        text_md: c.blankText,
        mode: 'bank',
        bank: [
          { id: 'b1', text_md: c.blankB1 },
          { id: 'b2', text_md: c.blankB2 },
          { id: 'b3', text_md: c.blankB3 },
          { id: 'b4', text_md: c.blankB4 },
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
      prompt_md: c.numPrompt,
      difficulty: 2,
      xp: 15,
      hints: [c.numHint],
      explanation_md: c.numExplain,
      narrator: { character: 'zara', emotion: 'excited' },
      payload: { unit: c.numUnit },
      answer: { value: 60, tolerance: 0 },
    },
    {
      id: 'fx-estimate-slider',
      type: 'estimate_slider',
      prompt_md: c.estPrompt,
      difficulty: 1,
      xp: 10,
      explanation_md: c.estExplain,
      narrator: { character: 'rho', emotion: 'thinking' },
      payload: { min: 0, max: 100, step: 5, unit: c.estUnit, scale: 'linear' },
      answer: { value: 25, full_credit_delta: 10, zero_credit_delta: 50 },
    },
    {
      id: 'fx-count-objects',
      type: 'count_objects',
      prompt_md: c.countPrompt,
      difficulty: 1,
      xp: 10,
      hints: [c.countHint],
      explanation_md: c.countExplain,
      narrator: { character: 'dina', emotion: 'encouraging' },
      payload: {
        scene: [
          { icon: 'paid', tint: 'warning', count: 7, label: c.countCoins },
          { icon: 'savings', tint: 'primary', count: 3, label: c.countBanks },
          { icon: 'shopping_bag', tint: 'accent', count: 4, label: c.countBags },
        ],
        ask_icon: 'paid',
        ask_label: c.countCoins,
      },
      answer: { value: 7 },
    },
    {
      id: 'fx-equation-builder',
      type: 'equation_builder',
      prompt_md: c.eqPrompt,
      difficulty: 3,
      xp: 20,
      hints: [c.eqHint],
      explanation_md: c.eqExplain,
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
}
