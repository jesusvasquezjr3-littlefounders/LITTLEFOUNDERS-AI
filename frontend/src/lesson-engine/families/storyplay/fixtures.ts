// `storyplay` family — one demo segment per type for /dev/lesson-lab (es-MX content).
// Fixtures are dev data, not UI strings; lesson documents are single-locale (§3).

import type { SegmentBase } from '../../core/types'

export const storyplayFixtures: SegmentBase[] = [
  {
    id: 'fx-story-branch',
    type: 'story_branch',
    prompt_md: 'Tu **puesto de limonada** abre hoy. Cada decisión cuenta.',
    difficulty: 3,
    xp: 20,
    explanation_md:
      'Invertir en **calidad**, avisar a tus clientes y poner un **precio justo** hace que vuelvan mañana.',
    narrator: { character: 'dina', emotion: 'excited' },
    payload: {
      start_node: 'n1',
      nodes: [
        {
          id: 'n1',
          text_md: 'Tienes **$50** para empezar tu puesto de limonada. ¿Qué compras?',
          character: 'dina',
          emotion: 'happy',
          choices: [
            { id: 'a', text_md: 'Limones jugosos y azúcar buena ($30)', next: 'n2' },
            { id: 'b', text_md: 'Limones baratos medio secos ($10)', next: 'n3' },
          ],
        },
        {
          id: 'n2',
          text_md: '¡Tu limonada sabe deliciosa! Te quedan **$20**. ¿Ahora qué?',
          character: 'liruf',
          emotion: 'excited',
          choices: [
            { id: 'a', text_md: 'Hacer un letrero llamativo ($10)', next: 'n4' },
            { id: 'b', text_md: 'Guardar todo y esperar sentado', next: null },
          ],
        },
        {
          id: 'n3',
          text_md: 'Mmm… la limonada quedó **aguada**. Un cliente hace cara rara.',
          character: 'liruf',
          emotion: 'thinking',
          choices: [
            { id: 'a', text_md: 'Bajar el precio y ser honesto', next: 'n4' },
            { id: 'b', text_md: 'Venderla igual al precio alto', next: null },
          ],
        },
        {
          id: 'n4',
          text_md: '¡Llegan varios clientes! ¿Qué precio pones por vaso?',
          character: 'dina',
          emotion: 'excited',
          choices: [
            { id: 'a', text_md: 'Un precio justo: $10', next: null },
            { id: 'b', text_md: 'Un precio altísimo: $30', next: null },
          ],
        },
      ],
    },
    answer: {
      qualities: [
        { node_id: 'n1', choice_id: 'a', score: 90 },
        { node_id: 'n1', choice_id: 'b', score: 30 },
        { node_id: 'n2', choice_id: 'a', score: 95 },
        { node_id: 'n2', choice_id: 'b', score: 50 },
        { node_id: 'n3', choice_id: 'a', score: 70 },
        { node_id: 'n3', choice_id: 'b', score: 15 },
        { node_id: 'n4', choice_id: 'a', score: 100 },
        { node_id: 'n4', choice_id: 'b', score: 20 },
      ],
    },
  },
  {
    id: 'fx-dialogue-choice',
    type: 'dialogue_choice',
    prompt_md: 'Zara quiere **regatear** en tu puesto. Negocia sin perder dinero.',
    difficulty: 3,
    xp: 20,
    explanation_md:
      'Negociar bien no es decir que sí a todo: es buscar un trato donde **los dos ganan**.',
    narrator: { character: 'zara', emotion: 'happy' },
    payload: {
      persona: {
        character: 'zara',
        name: 'Zara Vex',
        role_md: 'Clienta curiosa en tu puesto de limonada',
      },
      opening_md: 'Mmm… tu limonada se ve rica, pero **$15** me parece un poco caro.',
      turns: [
        {
          id: 't1',
          npc_md: '¿Me la dejas en **$5**?',
          replies: [
            { id: 'r1', text_md: 'Está bien, $5… supongo.' },
            { id: 'r2', text_md: 'Te la dejo en $12 y te regalo hielo extra.' },
            { id: 'r3', text_md: 'No. $15 o nada.' },
          ],
        },
        {
          id: 't2',
          npc_md: 'Interesante… ¿y si compro **dos** vasos?',
          replies: [
            { id: 'r1', text_md: 'Dos por $20, ¡buen trato para las dos!' },
            { id: 'r2', text_md: 'Dos por $8, casi regalados.' },
            { id: 'r3', text_md: 'Dos por $30, igual que comprarlos separados.' },
          ],
        },
        {
          id: 't3',
          npc_md: 'Última pregunta: ¿mañana tendrás más limonada?',
          replies: [
            { id: 'r1', text_md: 'Sí, y si vuelves te doy precio de clienta frecuente.' },
            { id: 'r2', text_md: 'No sé, depende de cómo amanezca.' },
            { id: 'r3', text_md: 'Sí, al mismo precio de hoy.' },
          ],
        },
      ],
    },
    answer: {
      turns: [
        {
          turn_id: 't1',
          qualities: { r1: 20, r2: 100, r3: 55 },
          reactions: {
            r1: 'Zara sonríe… pero hacer cada vaso te costó **más de $5**. Perdiste dinero.',
            r2: '—¡Trato! Me encanta el hielo extra —dice Zara. Cediste un poco y **ganaste una clienta**.',
            r3: 'Zara duda. Defender tu precio está bien, pero **sin opciones** la clienta se puede ir.',
          },
        },
        {
          turn_id: 't2',
          qualities: { r1: 100, r2: 15, r3: 50 },
          reactions: {
            r1: '—¡Me llevo los dos! Un pequeño descuento por volumen **vende más** sin regalar tu trabajo.',
            r2: 'Zara compra feliz… pero a $4 el vaso **pierdes** en cada venta.',
            r3: 'Zara solo compra uno. Sin ningún incentivo, no había razón para llevar dos.',
          },
        },
        {
          turn_id: 't3',
          qualities: { r1: 100, r2: 30, r3: 70 },
          reactions: {
            r1: '—¡Volveré mañana! Cuidar a quien **regresa** vale más que una venta suelta.',
            r2: 'Zara se encoge de hombros. Si no sabe si habrá, **buscará otro puesto**.',
            r3: '—Ok, aquí estaré. Cumplir es bueno; premiar la lealtad es **todavía mejor**.',
          },
        },
      ],
    },
  },
  {
    id: 'fx-flash-match',
    type: 'flash_match',
    prompt_md: '¡Rápido! Une cada palabra del dinero con lo que significa.',
    difficulty: 2,
    xp: 15,
    narrator: { character: 'liruf', emotion: 'excited' },
    payload: {
      left: [
        { id: 'l1', text_md: 'Ahorro' },
        { id: 'l2', text_md: 'Gasto' },
        { id: 'l3', text_md: 'Ingreso' },
        { id: 'l4', text_md: 'Meta' },
      ],
      right: [
        { id: 'r1', text_md: 'Dinero que guardo para después' },
        { id: 'r2', text_md: 'Dinero que sale cuando compro' },
        { id: 'r3', text_md: 'Dinero que entra a mi bolsillo' },
        { id: 'r4', text_md: 'Lo que quiero lograr con mi dinero' },
        { id: 'r5', text_md: 'Una moneda muy antigua' },
      ],
      seconds: 45,
    },
    answer: {
      pairs: [
        ['l1', 'r1'],
        ['l2', 'r2'],
        ['l3', 'r3'],
        ['l4', 'r4'],
      ],
    },
  },
  {
    id: 'fx-lightning-round',
    type: 'lightning_round',
    prompt_md: 'Ronda relámpago del puesto de limonada. ¡Piensa rápido!',
    difficulty: 3,
    xp: 20,
    explanation_md: 'Ganancia = lo que **entra** menos lo que **gastas** en hacer el producto.',
    narrator: { character: 'rho', emotion: 'excited' },
    payload: {
      questions: [
        {
          id: 'q1',
          prompt_md: 'Vendiste 3 vasos a **$10** cada uno. ¿Cuánto entró?',
          options: [
            { id: 'a', text_md: '$30' },
            { id: 'b', text_md: '$13' },
            { id: 'c', text_md: '$310' },
          ],
        },
        {
          id: 'q2',
          prompt_md: 'Tenías $50 y gastaste **$20** en limones. ¿Cuánto te queda?',
          options: [
            { id: 'a', text_md: '$70' },
            { id: 'b', text_md: '$30' },
            { id: 'c', text_md: '$25' },
          ],
        },
        {
          id: 'q3',
          prompt_md: 'Entraron $60 y gastaste $25. ¿Cuál fue tu **ganancia**?',
          options: [
            { id: 'a', text_md: '$85' },
            { id: 'b', text_md: '$25' },
            { id: 'c', text_md: '$35' },
          ],
        },
        {
          id: 'q4',
          prompt_md: 'Si ahorras **$5** de tu ganancia cada día, ¿cuánto juntas en una semana?',
          options: [
            { id: 'a', text_md: '$35' },
            { id: 'b', text_md: '$12' },
            { id: 'c', text_md: '$57' },
          ],
        },
      ],
      seconds_per_q: 8,
    },
    answer: {
      correct: { q1: 'a', q2: 'b', q3: 'c', q4: 'a' },
    },
  },
  {
    id: 'fx-would-you-rather',
    type: 'would_you_rather',
    prompt_md: 'Tu puesto ganó mucho hoy. ¿Qué prefieres?',
    difficulty: 2,
    xp: 15,
    explanation_md:
      'Lo que dejas ir al elegir se llama **costo de oportunidad**. ¡Conocerlo te hace mejor fundador!',
    narrator: { character: 'zara', emotion: 'thinking' },
    payload: {
      a: { text_md: 'Recibir **$50 hoy** mismo', icon: 'payments' },
      b: { text_md: 'Esperar un mes y recibir **$100**', icon: 'savings' },
      followup_md: 'Piensa: ¿qué pasa con la opción que **no** elegiste?',
    },
    answer: {
      qualities: { a: 60, b: 90 },
      reveal_md:
        'Las dos valen: $50 hoy es **seguro y rápido**; esperar te da **el doble**, si puedes aguantar. Lo que dejas ir al decidir es tu **costo de oportunidad**.',
    },
  },
]
