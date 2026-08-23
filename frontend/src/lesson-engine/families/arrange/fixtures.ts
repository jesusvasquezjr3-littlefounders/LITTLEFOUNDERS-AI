// `arrange` family — one demo segment per type for /dev/lesson-lab.
// Written per locale; see `../../lab/fixtureCopy.ts`. Structure and answer keys
// are written once and are identical in every locale by construction.

import type { Locale } from '@/i18n'
import type { SegmentBase } from '../../core/types'
import { copyPack, type Copy } from '../../lab/fixtureCopy'

const EN = {
  matchPrompt: 'Match each **coin** with something you can buy with it.',
  matchHint: 'Start with the biggest coin: which thing costs most?',
  matchExplain: 'Everything has its own **price** — knowing them helps you plan what you buy.',
  matchL1: '$5',
  matchL2: '$20',
  matchL3: '$50',
  matchR1: 'A piece of gum',
  matchR2: 'A juice and some biscuits',
  matchR3: 'An illustrated storybook',
  matchR4: 'A brand-new bicycle',

  memoryPrompt: 'Find the pairs: each **money word** with what it means.',
  memoryExplain: 'Turning the pairs over again helps you **remember** what each word means.',
  memoryA1: 'Save',
  memoryB1: 'Keep money for later',
  memoryA2: 'Spend',
  memoryB2: 'Use money to buy',
  memoryA3: 'Give',
  memoryB3: 'Hand some over to help',

  sortPrompt: 'Sort each one: is it for **saving**, **spending** or **giving**?',
  sortHint: "Saving is for tomorrow's goals; spending is for today.",
  sortBucket1: 'Save',
  sortBucket2: 'Spend',
  sortBucket3: 'Give',
  sortI1: 'Put $10 aside for the skateboard',
  sortI2: "Buy today's lunch",
  sortI3: 'Give $5 to the dog shelter',
  sortI4: 'Drop coins in the piggy bank',

  stepsPrompt: 'Put the steps for **saving towards a goal** in order.',
  stepsExplain: 'First pick the goal, then find the price, then save a little at a time… and buy it!',
  stepsS1: 'Choose what I want to buy',
  stepsS2: 'Find out how much it costs',
  stepsS3: 'Save a little every week',
  stepsS4: 'Buy it once I have it all',

  rankPrompt: 'Put these purchases in order, from the **most urgent** to the one that can wait.',
  rankCriterion: 'Think: what does your family need **first** to live well this week?',
  rankC1: "This week's food",
  rankC2: "Medicine for your brother's cough",
  rankC3: 'A new game for the console',
  rankC4: 'Stickers for the album',

  sentencePrompt: 'Build the secret saving sentence out of the tiles.',
  sentenceExplain: "**Save first, spend after** — Dina's golden rule.",
  sentenceT1: 'Save',
  sentenceT2: 'first,',
  sentenceT3: 'spend',
  sentenceT4: 'after',
  sentenceT5: 'never',
  sentenceT6: 'lose',

  timelinePrompt: 'Lay out the story of **money** on the timeline.',
  timelineExplain:
    'First people swapped things, then metal coins arrived, then paper notes, and cards last of all.',
  timelineE1: 'Barter: swapping hens for maize',
  timelineE2: 'The first metal coins',
  timelineE3: 'Paper banknotes',
  timelineE4: 'Cards and digital payments',

  patternPrompt: 'Look at the piggy-bank pattern and **finish it**.',
  patternHint: 'Watch how they repeat: coin, coin, note…',

  setsPrompt: 'For each one: do you **buy** it, **save** for it, both… or neither?',
  setsExplain:
    'Some things you buy today, others you save up for — and the air in the park costs nothing!',
  setsA: 'Cheap (today)',
  setsB: 'Savings goal',
  setsG1: 'An ice pop',
  setsG2: 'A bicycle',
  setsG3: 'A notebook I want now, but I am also saving for the fancy one',
  setsG4: 'The air in the park',

  linePrompt: 'The ice pop costs **$7**. Tap where **7** goes on the line.',
  lineHint: '7 is between 5 and 10, closer to 5.',
} as const

const ES: Copy<typeof EN> = {
  matchPrompt: 'Une cada **moneda** con lo que puedes comprar con ella.',
  matchHint: 'Empieza por la moneda más grande: ¿qué cosa cuesta más?',
  matchExplain:
    'Cada cosa tiene un **precio** distinto — conocerlos te ayuda a planear tus compras.',
  matchL1: '$5',
  matchL2: '$20',
  matchL3: '$50',
  matchR1: 'Un chicle',
  matchR2: 'Un jugo y unas galletas',
  matchR3: 'Un cuento ilustrado',
  matchR4: 'Una bicicleta nueva',

  memoryPrompt: 'Encuentra las parejas: cada **palabra de dinero** con su significado.',
  memoryExplain: 'Repetir las parejas te ayuda a **recordar** qué significa cada palabra.',
  memoryA1: 'Ahorrar',
  memoryB1: 'Guardar dinero para después',
  memoryA2: 'Gastar',
  memoryB2: 'Usar dinero para comprar',
  memoryA3: 'Donar',
  memoryB3: 'Regalar para ayudar',

  sortPrompt: 'Clasifica cada cosa: ¿es para **ahorrar**, **gastar** o **donar**?',
  sortHint: 'Ahorrar es para metas de mañana; gastar es para hoy.',
  sortBucket1: 'Ahorrar',
  sortBucket2: 'Gastar',
  sortBucket3: 'Donar',
  sortI1: 'Guardar $10 para la patineta',
  sortI2: 'Comprar el lunch de hoy',
  sortI3: 'Dar $5 al refugio de perritos',
  sortI4: 'Meter monedas a la alcancía',

  stepsPrompt: 'Pon en orden los pasos para **ahorrar para una meta**.',
  stepsExplain:
    'Primero eliges la meta, luego averiguas el precio, después guardas poco a poco… ¡y la compras!',
  stepsS1: 'Elegir qué quiero comprar',
  stepsS2: 'Averiguar cuánto cuesta',
  stepsS3: 'Guardar un poco cada semana',
  stepsS4: 'Comprarlo cuando junte todo',

  rankPrompt: 'Ordena estas compras de la **más urgente** a la que puede esperar.',
  rankCriterion: 'Piensa: ¿qué necesita tu familia **primero** para vivir bien esta semana?',
  rankC1: 'Comida para la semana',
  rankC2: 'Medicina para la tos de tu hermano',
  rankC3: 'Un juego nuevo para la consola',
  rankC4: 'Estampas para el álbum',

  sentencePrompt: 'Arma la frase secreta del ahorro con las fichas.',
  sentenceExplain: '**Primero ahorro, después gasto** — la regla de oro de Dina.',
  sentenceT1: 'Primero',
  sentenceT2: 'ahorro,',
  sentenceT3: 'después',
  sentenceT4: 'gasto',
  sentenceT5: 'nunca',
  sentenceT6: 'pierdo',

  timelinePrompt: 'Coloca en la línea del tiempo la historia del **dinero**.',
  timelineExplain:
    'Primero se intercambiaban cosas, luego llegaron las monedas, los billetes y al final las tarjetas.',
  timelineE1: 'Trueque: cambiar gallinas por maíz',
  timelineE2: 'Primeras monedas de metal',
  timelineE3: 'Billetes de papel',
  timelineE4: 'Tarjetas y pagos digitales',

  patternPrompt: 'Observa el patrón de la alcancía y **complétalo**.',
  patternHint: 'Mira cómo se repiten: moneda, moneda, billete…',

  setsPrompt: 'Cada cosa: ¿se **compra**, se **ahorra**, las dos… o ninguna?',
  setsExplain:
    'Algunas cosas se compran hoy, otras se ahorran para lograrlas — ¡y el aire no cuesta nada!',
  setsA: 'Cuesta poco (hoy)',
  setsB: 'Meta de ahorro',
  setsG1: 'Una paleta',
  setsG2: 'Una bicicleta',
  setsG3: 'Un cuaderno que quiero ya, pero también junto para el de lujo',
  setsG4: 'El aire del parque',

  linePrompt: 'La paleta cuesta **$7**. Toca el lugar del **7** en la recta.',
  lineHint: 'El 7 está entre el 5 y el 10, más cerca del 5.',
}

const PT: Copy<typeof EN> = {
  matchPrompt: 'Ligue cada **moeda** ao que dá para comprar com ela.',
  matchHint: 'Comece pela maior: qual coisa custa mais?',
  matchExplain:
    'Cada coisa tem um **preço** diferente — conhecê-los ajuda a planejar suas compras.',
  matchL1: 'R$5',
  matchL2: 'R$20',
  matchL3: 'R$50',
  matchR1: 'Um chiclete',
  matchR2: 'Um suco e uns biscoitos',
  matchR3: 'Um livro ilustrado',
  matchR4: 'Uma bicicleta nova',

  memoryPrompt: 'Encontre os pares: cada **palavra do dinheiro** com o seu significado.',
  memoryExplain: 'Repetir os pares ajuda você a **lembrar** o que cada palavra quer dizer.',
  memoryA1: 'Poupar',
  memoryB1: 'Guardar dinheiro para depois',
  memoryA2: 'Gastar',
  memoryB2: 'Usar dinheiro para comprar',
  memoryA3: 'Doar',
  memoryB3: 'Dar para ajudar',

  sortPrompt: 'Classifique cada coisa: é para **poupar**, **gastar** ou **doar**?',
  sortHint: 'Poupar é para as metas de amanhã; gastar é para hoje.',
  sortBucket1: 'Poupar',
  sortBucket2: 'Gastar',
  sortBucket3: 'Doar',
  sortI1: 'Guardar R$10 para o skate',
  sortI2: 'Comprar o lanche de hoje',
  sortI3: 'Dar R$5 para o abrigo de cachorros',
  sortI4: 'Colocar moedas no cofrinho',

  stepsPrompt: 'Coloque em ordem os passos para **poupar para uma meta**.',
  stepsExplain:
    'Primeiro você escolhe a meta, depois descobre o preço, depois guarda aos poucos… e compra!',
  stepsS1: 'Escolher o que eu quero comprar',
  stepsS2: 'Descobrir quanto custa',
  stepsS3: 'Guardar um pouco toda semana',
  stepsS4: 'Comprar quando juntar tudo',

  rankPrompt: 'Coloque estas compras da **mais urgente** à que pode esperar.',
  rankCriterion: 'Pense: do que a sua família precisa **primeiro** para viver bem esta semana?',
  rankC1: 'Comida para a semana',
  rankC2: 'Remédio para a tosse do seu irmão',
  rankC3: 'Um jogo novo para o console',
  rankC4: 'Figurinhas para o álbum',

  sentencePrompt: 'Monte a frase secreta da poupança com as fichas.',
  sentenceExplain: '**Primeiro poupo, depois gasto** — a regra de ouro da Dina.',
  sentenceT1: 'Primeiro',
  sentenceT2: 'poupo,',
  sentenceT3: 'depois',
  sentenceT4: 'gasto',
  sentenceT5: 'nunca',
  sentenceT6: 'perco',

  timelinePrompt: 'Coloque na linha do tempo a história do **dinheiro**.',
  timelineExplain:
    'Primeiro trocavam-se coisas, depois vieram as moedas, as notas e, por último, os cartões.',
  timelineE1: 'Escambo: trocar galinhas por milho',
  timelineE2: 'As primeiras moedas de metal',
  timelineE3: 'Notas de papel',
  timelineE4: 'Cartões e pagamentos digitais',

  patternPrompt: 'Observe o padrão do cofrinho e **complete**.',
  patternHint: 'Veja como se repetem: moeda, moeda, nota…',

  setsPrompt: 'Cada coisa: você **compra**, **poupa**, as duas… ou nenhuma?',
  setsExplain:
    'Algumas coisas você compra hoje, outras você poupa para conseguir — e o ar do parque não custa nada!',
  setsA: 'Custa pouco (hoje)',
  setsB: 'Meta de poupança',
  setsG1: 'Um picolé',
  setsG2: 'Uma bicicleta',
  setsG3: 'Um caderno que quero já, mas também junto para o de luxo',
  setsG4: 'O ar do parque',

  linePrompt: 'O picolé custa **R$7**. Toque no lugar do **7** na reta.',
  lineHint: 'O 7 fica entre o 5 e o 10, mais perto do 5.',
}

const COPY = copyPack(EN, ES, PT)

export function arrangeFixtures(locale: Locale): SegmentBase[] {
  const c = COPY[locale]
  return [
    {
      id: 'fx-match-pairs',
      type: 'match_pairs',
      prompt_md: c.matchPrompt,
      difficulty: 2,
      xp: 15,
      hints: [c.matchHint],
      explanation_md: c.matchExplain,
      narrator: { character: 'dina', emotion: 'happy' },
      payload: {
        left: [
          { id: 'l1', text_md: c.matchL1 },
          { id: 'l2', text_md: c.matchL2 },
          { id: 'l3', text_md: c.matchL3 },
        ],
        right: [
          { id: 'r1', text_md: c.matchR1 },
          { id: 'r2', text_md: c.matchR2 },
          { id: 'r3', text_md: c.matchR3 },
          { id: 'r4', text_md: c.matchR4 },
        ],
      },
      answer: { pairs: [['l1', 'r1'], ['l2', 'r2'], ['l3', 'r3']] },
    },
    {
      id: 'fx-memory-flip',
      type: 'memory_flip',
      prompt_md: c.memoryPrompt,
      difficulty: 2,
      xp: 15,
      explanation_md: c.memoryExplain,
      narrator: { character: 'liruf', emotion: 'excited' },
      payload: {
        pairs: [
          { a_md: c.memoryA1, a_icon: 'savings', b_md: c.memoryB1, b_icon: 'account_balance_wallet' },
          { a_md: c.memoryA2, a_icon: 'shopping_cart', b_md: c.memoryB2, b_icon: 'payments' },
          { a_md: c.memoryA3, a_icon: 'volunteer_activism', b_md: c.memoryB3, b_icon: 'handshake' },
        ],
      },
    },
    {
      id: 'fx-sort-buckets',
      type: 'sort_buckets',
      prompt_md: c.sortPrompt,
      difficulty: 2,
      xp: 15,
      hints: [c.sortHint],
      narrator: { character: 'rho', emotion: 'thinking' },
      payload: {
        buckets: [
          { id: 'ahorro', label: c.sortBucket1 },
          { id: 'gasto', label: c.sortBucket2 },
          { id: 'donar', label: c.sortBucket3 },
        ],
        items: [
          { id: 'i1', text_md: c.sortI1 },
          { id: 'i2', text_md: c.sortI2 },
          { id: 'i3', text_md: c.sortI3 },
          { id: 'i4', text_md: c.sortI4 },
        ],
      },
      answer: { assignments: { i1: 'ahorro', i2: 'gasto', i3: 'donar', i4: 'ahorro' } },
    },
    {
      id: 'fx-order-steps',
      type: 'order_steps',
      prompt_md: c.stepsPrompt,
      difficulty: 2,
      xp: 15,
      explanation_md: c.stepsExplain,
      narrator: { character: 'dina', emotion: 'thinking' },
      payload: {
        items: [
          { id: 's1', text_md: c.stepsS1 },
          { id: 's2', text_md: c.stepsS2 },
          { id: 's3', text_md: c.stepsS3 },
          { id: 's4', text_md: c.stepsS4 },
        ],
      },
      answer: { order: ['s1', 's2', 's3', 's4'] },
    },
    {
      id: 'fx-rank-choices',
      type: 'rank_choices',
      prompt_md: c.rankPrompt,
      difficulty: 3,
      xp: 20,
      narrator: { character: 'zara', emotion: 'thinking' },
      payload: {
        criterion_md: c.rankCriterion,
        items: [
          { id: 'c1', text_md: c.rankC1 },
          { id: 'c2', text_md: c.rankC2 },
          { id: 'c3', text_md: c.rankC3 },
          { id: 'c4', text_md: c.rankC4 },
        ],
      },
      answer: { order: ['c2', 'c1', 'c3', 'c4'] },
    },
    {
      id: 'fx-build-sentence',
      type: 'build_sentence',
      prompt_md: c.sentencePrompt,
      difficulty: 2,
      xp: 15,
      explanation_md: c.sentenceExplain,
      narrator: { character: 'dina', emotion: 'proud' },
      payload: {
        tokens: [
          { id: 't1', text_md: c.sentenceT1 },
          { id: 't2', text_md: c.sentenceT2 },
          { id: 't3', text_md: c.sentenceT3 },
          { id: 't4', text_md: c.sentenceT4 },
          { id: 't5', text_md: c.sentenceT5 },
          { id: 't6', text_md: c.sentenceT6 },
        ],
        slots: 4,
      },
      answer: { order: ['t1', 't2', 't3', 't4'] },
    },
    {
      id: 'fx-timeline-order',
      type: 'timeline_order',
      prompt_md: c.timelinePrompt,
      difficulty: 3,
      xp: 20,
      explanation_md: c.timelineExplain,
      narrator: { character: 'rho', emotion: 'excited' },
      payload: {
        events: [
          { id: 'e1', text_md: c.timelineE1, icon: 'swap_horiz' },
          { id: 'e2', text_md: c.timelineE2, icon: 'paid' },
          { id: 'e3', text_md: c.timelineE3, icon: 'payments' },
          { id: 'e4', text_md: c.timelineE4, icon: 'credit_card' },
        ],
      },
      answer: { order: ['e1', 'e2', 'e3', 'e4'] },
    },
    {
      id: 'fx-pattern-complete',
      type: 'pattern_complete',
      prompt_md: c.patternPrompt,
      difficulty: 2,
      xp: 15,
      hints: [c.patternHint],
      narrator: { character: 'liruf', emotion: 'thinking' },
      payload: {
        sequence: [
          { icon: 'paid', tint: 'warning' },
          { icon: 'paid', tint: 'warning' },
          { icon: 'payments', tint: 'success' },
          { icon: 'paid', tint: 'warning' },
          { icon: 'paid', tint: 'warning' },
        ],
        options: [
          { id: 'o1', icon: 'payments', tint: 'success' },
          { id: 'o2', icon: 'paid', tint: 'warning' },
          { id: 'o3', icon: 'savings', tint: 'primary' },
        ],
        missing_slots: 1,
      },
      answer: { correct: { '0': 'o1' } },
    },
    {
      id: 'fx-group-sets',
      type: 'group_sets',
      prompt_md: c.setsPrompt,
      difficulty: 3,
      xp: 20,
      explanation_md: c.setsExplain,
      narrator: { character: 'zara', emotion: 'happy' },
      payload: {
        set_a: c.setsA,
        set_b: c.setsB,
        items: [
          { id: 'g1', text_md: c.setsG1 },
          { id: 'g2', text_md: c.setsG2 },
          { id: 'g3', text_md: c.setsG3 },
          { id: 'g4', text_md: c.setsG4 },
        ],
      },
      answer: { zones: { g1: 'a', g2: 'b', g3: 'both', g4: 'none' } },
    },
    {
      id: 'fx-number-line',
      type: 'number_line',
      prompt_md: c.linePrompt,
      difficulty: 1,
      xp: 10,
      hints: [c.lineHint],
      narrator: { character: 'liruf', emotion: 'encouraging' },
      payload: { min: 0, max: 10, ticks: 10, labels: true },
      answer: { value: 7, full_credit_delta: 0, zero_credit_delta: 3 },
    },
  ]
}
