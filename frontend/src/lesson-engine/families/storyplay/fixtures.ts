// `storyplay` family — one demo segment per type for /dev/lesson-lab.
// Written per locale; see `../../lab/fixtureCopy.ts`. Structure and answer keys
// are written once and are identical in every locale by construction.

import type { Locale } from '@/i18n'
import type { SegmentBase } from '../../core/types'
import { copyPack, type Copy } from '../../lab/fixtureCopy'

const EN = {
  branchPrompt: 'Your **lemonade stand** opens today. Every decision counts.',
  branchExplain:
    'Investing in **quality**, telling your customers and setting a **fair price** is what brings them back tomorrow.',
  branchN1: 'You have **$50** to start your lemonade stand. What do you buy?',
  branchN1a: 'Juicy lemons and good sugar ($30)',
  branchN1b: 'Cheap, half-dried lemons ($10)',
  branchN2: 'Your lemonade tastes delicious! You have **$20** left. Now what?',
  branchN2a: 'Make an eye-catching sign ($10)',
  branchN2b: 'Keep it all and wait around',
  branchN3: 'Hmm… the lemonade came out **watery**. A customer pulls a face.',
  branchN3a: 'Lower the price and be honest',
  branchN3b: 'Sell it anyway at the full price',
  branchN4: 'Several customers arrive! What price do you set per cup?',
  branchN4a: 'A fair price: $10',
  branchN4b: 'A sky-high price: $30',

  dialoguePrompt: 'Zara wants to **haggle** at your stand. Negotiate without losing money.',
  dialogueExplain:
    'Negotiating well is not saying yes to everything: it is finding a deal where **both** of you win.',
  dialogueName: 'Zara Vex',
  dialogueRole: 'A curious customer at your lemonade stand',
  dialogueOpening: 'Mmm… your lemonade looks tasty, but **$15** feels a bit steep.',
  dialogueT1: 'Will you let me have it for **$5**?',
  dialogueT1r1: 'All right, $5… I suppose.',
  dialogueT1r2: 'I can do $12 and throw in extra ice.',
  dialogueT1r3: 'No. $15 or nothing.',
  dialogueT1x1: 'Zara smiles… but each cup cost you **more than $5** to make. You lost money.',
  dialogueT1x2: '"Deal! I love extra ice," says Zara. You gave a little and **gained a customer**.',
  dialogueT1x3: 'Zara hesitates. Holding your price is fine, but **with no options** the customer may walk.',
  dialogueT2: 'Interesting… and if I buy **two** cups?',
  dialogueT2r1: 'Two for $20 — a good deal for both of us!',
  dialogueT2r2: 'Two for $8, practically free.',
  dialogueT2r3: 'Two for $30, same as buying them separately.',
  dialogueT2x1: '"I will take both!" A small volume discount **sells more** without giving your work away.',
  dialogueT2x2: 'Zara buys happily… but at $4 a cup you **lose** on every sale.',
  dialogueT2x3: 'Zara buys just one. With no incentive there was no reason to take two.',
  dialogueT3: 'Last question: will you have more lemonade tomorrow?',
  dialogueT3r1: 'Yes, and if you come back I will give you a regular-customer price.',
  dialogueT3r2: 'Not sure, depends how I feel.',
  dialogueT3r3: 'Yes, at the same price as today.',
  dialogueT3x1: '"I will be back tomorrow!" Looking after someone who **returns** is worth more than one sale.',
  dialogueT3x2: 'Zara shrugs. If she does not know there will be any, she will **find another stand**.',
  dialogueT3x3: '"Okay, I will be here." Keeping your word is good; rewarding loyalty is **better still**.',

  flashPrompt: 'Quick! Match each money word with what it means.',
  flashL1: 'Saving',
  flashL2: 'Spending',
  flashL3: 'Income',
  flashL4: 'Goal',
  flashR1: 'Money I keep for later',
  flashR2: 'Money that goes out when I buy',
  flashR3: 'Money that comes into my pocket',
  flashR4: 'What I want to achieve with my money',
  flashR5: 'A very old coin',

  lightningPrompt: 'Lemonade-stand lightning round. Think fast!',
  lightningExplain: 'Profit = what **comes in** minus what you **spend** making the product.',
  lightningQ1: 'You sold 3 cups at **$10** each. How much came in?',
  lightningQ1a: '$30',
  lightningQ1b: '$13',
  lightningQ1c: '$310',
  lightningQ2: 'You had $50 and spent **$20** on lemons. How much is left?',
  lightningQ2a: '$70',
  lightningQ2b: '$30',
  lightningQ2c: '$25',
  lightningQ3: '$60 came in and you spent $25. What was your **profit**?',
  lightningQ3a: '$85',
  lightningQ3b: '$25',
  lightningQ3c: '$35',
  lightningQ4: 'If you save **$5** of your profit every day, how much is that in a week?',
  lightningQ4a: '$35',
  lightningQ4b: '$12',
  lightningQ4c: '$57',

  ratherPrompt: 'Your stand did well today. Which would you rather?',
  ratherExplain:
    'What you give up when you choose is called the **opportunity cost**. Knowing it makes you a better founder!',
  ratherA: 'Take **$50 today**',
  ratherB: 'Wait a month and take **$100**',
  ratherFollowup: 'Think: what happens to the option you did **not** choose?',
  ratherReveal:
    'Both are worth something: $50 today is **safe and fast**; waiting gives you **double**, if you can hold out. What you give up when you decide is your **opportunity cost**.',
} as const

const ES: Copy<typeof EN> = {
  branchPrompt: 'Tu **puesto de limonada** abre hoy. Cada decisión cuenta.',
  branchExplain:
    'Invertir en **calidad**, avisar a tus clientes y poner un **precio justo** hace que vuelvan mañana.',
  branchN1: 'Tienes **$50** para empezar tu puesto de limonada. ¿Qué compras?',
  branchN1a: 'Limones jugosos y azúcar buena ($30)',
  branchN1b: 'Limones baratos medio secos ($10)',
  branchN2: '¡Tu limonada sabe deliciosa! Te quedan **$20**. ¿Ahora qué?',
  branchN2a: 'Hacer un letrero llamativo ($10)',
  branchN2b: 'Guardar todo y esperar sentado',
  branchN3: 'Mmm… la limonada quedó **aguada**. Un cliente hace cara rara.',
  branchN3a: 'Bajar el precio y ser honesto',
  branchN3b: 'Venderla igual al precio alto',
  branchN4: '¡Llegan varios clientes! ¿Qué precio pones por vaso?',
  branchN4a: 'Un precio justo: $10',
  branchN4b: 'Un precio altísimo: $30',

  dialoguePrompt: 'Zara quiere **regatear** en tu puesto. Negocia sin perder dinero.',
  dialogueExplain:
    'Negociar bien no es decir que sí a todo: es buscar un trato donde **los dos ganan**.',
  dialogueName: 'Zara Vex',
  dialogueRole: 'Clienta curiosa en tu puesto de limonada',
  dialogueOpening: 'Mmm… tu limonada se ve rica, pero **$15** me parece un poco caro.',
  dialogueT1: '¿Me la dejas en **$5**?',
  dialogueT1r1: 'Está bien, $5… supongo.',
  dialogueT1r2: 'Te la dejo en $12 y te regalo hielo extra.',
  dialogueT1r3: 'No. $15 o nada.',
  dialogueT1x1: 'Zara sonríe… pero hacer cada vaso te costó **más de $5**. Perdiste dinero.',
  dialogueT1x2:
    '—¡Trato! Me encanta el hielo extra —dice Zara. Cediste un poco y **ganaste una clienta**.',
  dialogueT1x3:
    'Zara duda. Defender tu precio está bien, pero **sin opciones** la clienta se puede ir.',
  dialogueT2: 'Interesante… ¿y si compro **dos** vasos?',
  dialogueT2r1: 'Dos por $20, ¡buen trato para las dos!',
  dialogueT2r2: 'Dos por $8, casi regalados.',
  dialogueT2r3: 'Dos por $30, igual que comprarlos separados.',
  dialogueT2x1:
    '—¡Me llevo los dos! Un pequeño descuento por volumen **vende más** sin regalar tu trabajo.',
  dialogueT2x2: 'Zara compra feliz… pero a $4 el vaso **pierdes** en cada venta.',
  dialogueT2x3: 'Zara solo compra uno. Sin ningún incentivo, no había razón para llevar dos.',
  dialogueT3: 'Última pregunta: ¿mañana tendrás más limonada?',
  dialogueT3r1: 'Sí, y si vuelves te doy precio de clienta frecuente.',
  dialogueT3r2: 'No sé, depende de cómo amanezca.',
  dialogueT3r3: 'Sí, al mismo precio de hoy.',
  dialogueT3x1: '—¡Volveré mañana! Cuidar a quien **regresa** vale más que una venta suelta.',
  dialogueT3x2: 'Zara se encoge de hombros. Si no sabe si habrá, **buscará otro puesto**.',
  dialogueT3x3: '—Ok, aquí estaré. Cumplir es bueno; premiar la lealtad es **todavía mejor**.',

  flashPrompt: '¡Rápido! Une cada palabra del dinero con lo que significa.',
  flashL1: 'Ahorro',
  flashL2: 'Gasto',
  flashL3: 'Ingreso',
  flashL4: 'Meta',
  flashR1: 'Dinero que guardo para después',
  flashR2: 'Dinero que sale cuando compro',
  flashR3: 'Dinero que entra a mi bolsillo',
  flashR4: 'Lo que quiero lograr con mi dinero',
  flashR5: 'Una moneda muy antigua',

  lightningPrompt: 'Ronda relámpago del puesto de limonada. ¡Piensa rápido!',
  lightningExplain: 'Ganancia = lo que **entra** menos lo que **gastas** en hacer el producto.',
  lightningQ1: 'Vendiste 3 vasos a **$10** cada uno. ¿Cuánto entró?',
  lightningQ1a: '$30',
  lightningQ1b: '$13',
  lightningQ1c: '$310',
  lightningQ2: 'Tenías $50 y gastaste **$20** en limones. ¿Cuánto te queda?',
  lightningQ2a: '$70',
  lightningQ2b: '$30',
  lightningQ2c: '$25',
  lightningQ3: 'Entraron $60 y gastaste $25. ¿Cuál fue tu **ganancia**?',
  lightningQ3a: '$85',
  lightningQ3b: '$25',
  lightningQ3c: '$35',
  lightningQ4: 'Si ahorras **$5** de tu ganancia cada día, ¿cuánto juntas en una semana?',
  lightningQ4a: '$35',
  lightningQ4b: '$12',
  lightningQ4c: '$57',

  ratherPrompt: 'Tu puesto ganó mucho hoy. ¿Qué prefieres?',
  ratherExplain:
    'Lo que dejas ir al elegir se llama **costo de oportunidad**. ¡Conocerlo te hace mejor fundador!',
  ratherA: 'Recibir **$50 hoy** mismo',
  ratherB: 'Esperar un mes y recibir **$100**',
  ratherFollowup: 'Piensa: ¿qué pasa con la opción que **no** elegiste?',
  ratherReveal:
    'Las dos valen: $50 hoy es **seguro y rápido**; esperar te da **el doble**, si puedes aguantar. Lo que dejas ir al decidir es tu **costo de oportunidad**.',
}

const PT: Copy<typeof EN> = {
  branchPrompt: 'Sua **barraquinha de limonada** abre hoje. Cada decisão conta.',
  branchExplain:
    'Investir em **qualidade**, avisar seus clientes e colocar um **preço justo** é o que faz eles voltarem amanhã.',
  branchN1: 'Você tem **R$50** para começar a barraquinha. O que compra?',
  branchN1a: 'Limões suculentos e açúcar bom (R$30)',
  branchN1b: 'Limões baratos meio secos (R$10)',
  branchN2: 'Sua limonada ficou deliciosa! Sobraram **R$20**. E agora?',
  branchN2a: 'Fazer uma placa chamativa (R$10)',
  branchN2b: 'Guardar tudo e ficar esperando',
  branchN3: 'Hmm… a limonada ficou **aguada**. Um cliente faz careta.',
  branchN3a: 'Baixar o preço e ser honesto',
  branchN3b: 'Vender assim mesmo pelo preço cheio',
  branchN4: 'Chegam vários clientes! Que preço você põe por copo?',
  branchN4a: 'Um preço justo: R$10',
  branchN4b: 'Um preço altíssimo: R$30',

  dialoguePrompt: 'Zara quer **pechinchar** na sua barraquinha. Negocie sem perder dinheiro.',
  dialogueExplain:
    'Negociar bem não é dizer sim para tudo: é achar um acordo em que **os dois** ganham.',
  dialogueName: 'Zara Vex',
  dialogueRole: 'Cliente curiosa na sua barraquinha de limonada',
  dialogueOpening: 'Hmm… sua limonada parece boa, mas **R$15** me parece um pouco caro.',
  dialogueT1: 'Você faz por **R$5**?',
  dialogueT1r1: 'Tá bom, R$5… acho.',
  dialogueT1r2: 'Faço por R$12 e ainda dou gelo extra.',
  dialogueT1r3: 'Não. R$15 ou nada.',
  dialogueT1x1: 'Zara sorri… mas cada copo custou **mais de R$5** para você fazer. Você perdeu dinheiro.',
  dialogueT1x2:
    '— Fechado! Adoro gelo extra — diz Zara. Você cedeu um pouco e **ganhou uma cliente**.',
  dialogueT1x3:
    'Zara hesita. Defender seu preço é bom, mas **sem opções** a cliente pode ir embora.',
  dialogueT2: 'Interessante… e se eu levar **dois** copos?',
  dialogueT2r1: 'Dois por R$20, bom negócio para nós duas!',
  dialogueT2r2: 'Dois por R$8, quase de graça.',
  dialogueT2r3: 'Dois por R$30, igual a comprar separado.',
  dialogueT2x1:
    '— Levo os dois! Um descontinho por volume **vende mais** sem dar o seu trabalho de graça.',
  dialogueT2x2: 'Zara compra feliz… mas a R$4 o copo você **perde** em cada venda.',
  dialogueT2x3: 'Zara leva só um. Sem incentivo nenhum, não havia motivo para levar dois.',
  dialogueT3: 'Última pergunta: amanhã vai ter mais limonada?',
  dialogueT3r1: 'Vai, e se você voltar eu faço preço de cliente frequente.',
  dialogueT3r2: 'Não sei, depende de como eu acordar.',
  dialogueT3r3: 'Vai, pelo mesmo preço de hoje.',
  dialogueT3x1: '— Volto amanhã! Cuidar de quem **volta** vale mais que uma venda solta.',
  dialogueT3x2: 'Zara dá de ombros. Se não sabe se vai ter, ela **procura outra barraca**.',
  dialogueT3x3: '— Tá, estarei aqui. Cumprir é bom; premiar a fidelidade é **melhor ainda**.',

  flashPrompt: 'Rápido! Ligue cada palavra do dinheiro ao que ela significa.',
  flashL1: 'Poupança',
  flashL2: 'Gasto',
  flashL3: 'Renda',
  flashL4: 'Meta',
  flashR1: 'Dinheiro que eu guardo para depois',
  flashR2: 'Dinheiro que sai quando eu compro',
  flashR3: 'Dinheiro que entra no meu bolso',
  flashR4: 'O que eu quero conseguir com o meu dinheiro',
  flashR5: 'Uma moeda muito antiga',

  lightningPrompt: 'Rodada relâmpago da barraquinha de limonada. Pense rápido!',
  lightningExplain: 'Lucro = o que **entra** menos o que você **gasta** para fazer o produto.',
  lightningQ1: 'Você vendeu 3 copos a **R$10** cada. Quanto entrou?',
  lightningQ1a: 'R$30',
  lightningQ1b: 'R$13',
  lightningQ1c: 'R$310',
  lightningQ2: 'Você tinha R$50 e gastou **R$20** em limões. Quanto sobrou?',
  lightningQ2a: 'R$70',
  lightningQ2b: 'R$30',
  lightningQ2c: 'R$25',
  lightningQ3: 'Entraram R$60 e você gastou R$25. Qual foi o seu **lucro**?',
  lightningQ3a: 'R$85',
  lightningQ3b: 'R$25',
  lightningQ3c: 'R$35',
  lightningQ4: 'Se você guardar **R$5** do lucro por dia, quanto junta em uma semana?',
  lightningQ4a: 'R$35',
  lightningQ4b: 'R$12',
  lightningQ4c: 'R$57',

  ratherPrompt: 'Sua barraquinha lucrou bem hoje. O que você prefere?',
  ratherExplain:
    'O que você deixa de lado ao escolher se chama **custo de oportunidade**. Conhecê-lo faz de você um fundador melhor!',
  ratherA: 'Receber **R$50 hoje** mesmo',
  ratherB: 'Esperar um mês e receber **R$100**',
  ratherFollowup: 'Pense: o que acontece com a opção que você **não** escolheu?',
  ratherReveal:
    'As duas valem: R$50 hoje é **seguro e rápido**; esperar dá **o dobro**, se você aguentar. O que você deixa de lado ao decidir é o seu **custo de oportunidade**.',
}

const COPY = copyPack(EN, ES, PT)

export function storyplayFixtures(locale: Locale): SegmentBase[] {
  const c = COPY[locale]
  return [
    {
      id: 'fx-story-branch',
      type: 'story_branch',
      prompt_md: c.branchPrompt,
      difficulty: 3,
      xp: 20,
      explanation_md: c.branchExplain,
      narrator: { character: 'dina', emotion: 'excited' },
      payload: {
        start_node: 'n1',
        nodes: [
          {
            id: 'n1',
            text_md: c.branchN1,
            character: 'dina',
            emotion: 'happy',
            choices: [
              { id: 'a', text_md: c.branchN1a, next: 'n2' },
              { id: 'b', text_md: c.branchN1b, next: 'n3' },
            ],
          },
          {
            id: 'n2',
            text_md: c.branchN2,
            character: 'liruf',
            emotion: 'excited',
            choices: [
              { id: 'a', text_md: c.branchN2a, next: 'n4' },
              { id: 'b', text_md: c.branchN2b, next: null },
            ],
          },
          {
            id: 'n3',
            text_md: c.branchN3,
            character: 'liruf',
            emotion: 'thinking',
            choices: [
              { id: 'a', text_md: c.branchN3a, next: 'n4' },
              { id: 'b', text_md: c.branchN3b, next: null },
            ],
          },
          {
            id: 'n4',
            text_md: c.branchN4,
            character: 'dina',
            emotion: 'excited',
            choices: [
              { id: 'a', text_md: c.branchN4a, next: null },
              { id: 'b', text_md: c.branchN4b, next: null },
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
      prompt_md: c.dialoguePrompt,
      difficulty: 3,
      xp: 20,
      explanation_md: c.dialogueExplain,
      narrator: { character: 'zara', emotion: 'happy' },
      payload: {
        persona: { character: 'zara', name: c.dialogueName, role_md: c.dialogueRole },
        opening_md: c.dialogueOpening,
        turns: [
          {
            id: 't1',
            npc_md: c.dialogueT1,
            replies: [
              { id: 'r1', text_md: c.dialogueT1r1 },
              { id: 'r2', text_md: c.dialogueT1r2 },
              { id: 'r3', text_md: c.dialogueT1r3 },
            ],
          },
          {
            id: 't2',
            npc_md: c.dialogueT2,
            replies: [
              { id: 'r1', text_md: c.dialogueT2r1 },
              { id: 'r2', text_md: c.dialogueT2r2 },
              { id: 'r3', text_md: c.dialogueT2r3 },
            ],
          },
          {
            id: 't3',
            npc_md: c.dialogueT3,
            replies: [
              { id: 'r1', text_md: c.dialogueT3r1 },
              { id: 'r2', text_md: c.dialogueT3r2 },
              { id: 'r3', text_md: c.dialogueT3r3 },
            ],
          },
        ],
      },
      answer: {
        turns: [
          {
            turn_id: 't1',
            qualities: { r1: 20, r2: 100, r3: 55 },
            reactions: { r1: c.dialogueT1x1, r2: c.dialogueT1x2, r3: c.dialogueT1x3 },
          },
          {
            turn_id: 't2',
            qualities: { r1: 100, r2: 15, r3: 50 },
            reactions: { r1: c.dialogueT2x1, r2: c.dialogueT2x2, r3: c.dialogueT2x3 },
          },
          {
            turn_id: 't3',
            qualities: { r1: 100, r2: 30, r3: 70 },
            reactions: { r1: c.dialogueT3x1, r2: c.dialogueT3x2, r3: c.dialogueT3x3 },
          },
        ],
      },
    },
    {
      id: 'fx-flash-match',
      type: 'flash_match',
      prompt_md: c.flashPrompt,
      difficulty: 2,
      xp: 15,
      narrator: { character: 'liruf', emotion: 'excited' },
      payload: {
        left: [
          { id: 'l1', text_md: c.flashL1 },
          { id: 'l2', text_md: c.flashL2 },
          { id: 'l3', text_md: c.flashL3 },
          { id: 'l4', text_md: c.flashL4 },
        ],
        right: [
          { id: 'r1', text_md: c.flashR1 },
          { id: 'r2', text_md: c.flashR2 },
          { id: 'r3', text_md: c.flashR3 },
          { id: 'r4', text_md: c.flashR4 },
          { id: 'r5', text_md: c.flashR5 },
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
      prompt_md: c.lightningPrompt,
      difficulty: 3,
      xp: 20,
      explanation_md: c.lightningExplain,
      narrator: { character: 'rho', emotion: 'excited' },
      payload: {
        questions: [
          {
            id: 'q1',
            prompt_md: c.lightningQ1,
            options: [
              { id: 'a', text_md: c.lightningQ1a },
              { id: 'b', text_md: c.lightningQ1b },
              { id: 'c', text_md: c.lightningQ1c },
            ],
          },
          {
            id: 'q2',
            prompt_md: c.lightningQ2,
            options: [
              { id: 'a', text_md: c.lightningQ2a },
              { id: 'b', text_md: c.lightningQ2b },
              { id: 'c', text_md: c.lightningQ2c },
            ],
          },
          {
            id: 'q3',
            prompt_md: c.lightningQ3,
            options: [
              { id: 'a', text_md: c.lightningQ3a },
              { id: 'b', text_md: c.lightningQ3b },
              { id: 'c', text_md: c.lightningQ3c },
            ],
          },
          {
            id: 'q4',
            prompt_md: c.lightningQ4,
            options: [
              { id: 'a', text_md: c.lightningQ4a },
              { id: 'b', text_md: c.lightningQ4b },
              { id: 'c', text_md: c.lightningQ4c },
            ],
          },
        ],
        seconds_per_q: 8,
      },
      answer: { correct: { q1: 'a', q2: 'b', q3: 'c', q4: 'a' } },
    },
    {
      id: 'fx-would-you-rather',
      type: 'would_you_rather',
      prompt_md: c.ratherPrompt,
      difficulty: 2,
      xp: 15,
      explanation_md: c.ratherExplain,
      narrator: { character: 'zara', emotion: 'thinking' },
      payload: {
        a: { text_md: c.ratherA, icon: 'payments' },
        b: { text_md: c.ratherB, icon: 'savings' },
        followup_md: c.ratherFollowup,
      },
      answer: { qualities: { a: 60, b: 90 }, reveal_md: c.ratherReveal },
    },
  ]
}
