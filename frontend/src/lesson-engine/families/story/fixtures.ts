// `story` family — one demo segment per type for /dev/lesson-lab.
// Content types are ungraded and carry xp: 0 (LESSON_ENGINE.md §3, §5.1).
//
// WRITTEN PER LOCALE — see `../../lab/fixtureCopy.ts` for why, and for the
// parity rule the type system enforces. Structure (ids, payload shape, answer
// keys) is written ONCE below and is identical in every locale by construction;
// only the copy differs.

import type { Locale } from '@/i18n'
import type { SegmentBase } from '../../core/types'
import { copyPack, type Copy } from '../../lab/fixtureCopy'

const EN = {
  dialoguePrompt: 'The big lemonade idea',
  dialogue1: 'Dina, Dina! I found **$20** cleaning my room. I am buying candy RIGHT NOW!',
  dialogue2: 'Hold on, Liruf… what if those $20 worked **for you**? You could start a tiny business.',
  dialogue3: 'A business with $20? Hmm… like what?',
  dialogue4:
    'By my maps, $20 buys the lemons and sugar for **20 cups** of lemonade. Sell each cup for $5… do the math.',
  dialogue5: 'That would be **$100**! That is called *investing*: using your money to earn more. Let us go!',

  scenePrompt: 'The stand opens for business',
  sceneBody:
    'Saturday morning. Liruf hangs up the sign: **Liruf Lemonade — $5 a cup**.\nThe first customer is already walking over with a shiny coin…',

  ideasPrompt: 'What the lemonade stand taught us',
  ideaInvestTitle: 'Invest',
  ideaInvestBody: 'Using your money to **earn more** later, like buying lemons to sell lemonade.',
  ideaCostTitle: 'Cost',
  ideaCostBody: 'What you pay to start: the **$20** of lemons and sugar.',
  ideaProfitTitle: 'Profit',
  ideaProfitBody: 'What is left after you pay your costs: **$100 − $20 = $80**.',

  revealPrompt: 'Tap each card to find its secret',
  revealFront1: 'What is an **entrepreneur**?',
  revealBack1:
    'Someone who spots a problem and builds an **idea** to solve it… like selling lemonade on a hot day!',
  revealFront2: 'What is a **price**?',
  revealBack2: 'The money you ask for your product. Too high and nobody buys; too low and you earn nothing.',
  revealFront3: 'Who are your **customers**?',
  revealBack3: 'The people who buy what you sell. Look after them and they come back for more!',

  checkpointPrompt: 'Take a breath, partner. How are we doing?',
  checkpointRecap:
    'So far:\n- We **invested** $20 in lemons and sugar.\n- We sold 20 cups at **$5** each.\n- Our **profit** was $80.',
  checkpointMood: 'Shall we keep going, or go back over the lemonade part?',

  eavesdropPrompt: 'Listen closely: the market sellers are talking about money.',
  eavesdropContext:
    'It is Saturday at the market. Dina and Liruf set up their stand and listen to the sellers next door.',
  eavesdropLine1: 'Today we are going to ==break even==: we sold exactly what we spent.',
  eavesdropNote1:
    '**Breaking even** means neither earning nor losing money: what came in equals what went out.',
  eavesdropLine2: 'I set aside my ==emergency fund== before I count any profit.',
  eavesdropNote2:
    'An **emergency fund** is money kept only for surprises, like when something breaks.',
  eavesdropLine3: 'Good idea. Tomorrow I raise the price a little and see if the stand ==holds==.',
  eavesdropNote3:
    'A price that **holds**: customers keep buying even though it costs a bit more.',
} as const

const ES: Copy<typeof EN> = {
  dialoguePrompt: 'La gran idea de la limonada',
  dialogue1: '¡Dina, Dina! Encontré **$20** limpiando mi cuarto. ¡Voy a comprar dulces AHORA!',
  dialogue2: 'Espera, Liruf… ¿y si esos $20 trabajaran **para ti**? Con ellos podrías empezar un negocito.',
  dialogue3: '¿Un negocio con $20? Mmm… ¿como cuál?',
  dialogue4:
    'Según mis mapas, con $20 compras limones y azúcar para **20 vasos** de limonada. Si vendes cada vaso a $5… haz la cuenta.',
  dialogue5:
    '¡Serían **$100**! Eso se llama *invertir*: usar tu dinero para ganar más. ¡Manos a la obra!',

  scenePrompt: 'El puesto abre sus puertas',
  sceneBody:
    'Sábado por la mañana. Liruf cuelga su cartel: **Limonada Liruf — $5 el vaso**.\nSu primera clienta ya viene caminando con una moneda brillante…',

  ideasPrompt: 'Lo que nos enseñó el puesto de limonada',
  ideaInvestTitle: 'Invertir',
  ideaInvestBody:
    'Usar tu dinero para **ganar más** después, como comprar limones para vender limonada.',
  ideaCostTitle: 'Costo',
  ideaCostBody: 'Lo que pagas para empezar: los **$20** de limones y azúcar.',
  ideaProfitTitle: 'Ganancia',
  ideaProfitBody: 'Lo que te queda después de pagar tus costos: **$100 − $20 = $80**.',

  revealPrompt: 'Toca cada tarjeta para descubrir su secreto',
  revealFront1: '¿Qué es un **emprendedor**?',
  revealBack1:
    'Alguien que ve un problema y crea una **idea** para resolverlo… ¡como vender limonada en un día de calor!',
  revealFront2: '¿Qué es el **precio**?',
  revealBack2:
    'El dinero que pides por tu producto. Muy alto y nadie compra; muy bajo y no ganas.',
  revealFront3: '¿Quiénes son los **clientes**?',
  revealBack3: 'Las personas que compran lo que vendes. ¡Cuídalos y volverán por más!',

  checkpointPrompt: 'Respira hondo, socio. ¿Cómo vamos?',
  checkpointRecap:
    'Hasta ahora:\n- **Invertimos** $20 en limones y azúcar.\n- Vendimos 20 vasos a **$5** cada uno.\n- Nuestra **ganancia** fue de $80.',
  checkpointMood: '¿Seguimos con la aventura o repasamos la parte de la limonada?',

  eavesdropPrompt: 'Escucha con atención: los vendedores del mercado están hablando de dinero.',
  eavesdropContext:
    'Es sábado en el mercado. Dina y Liruf acomodan su puesto y escuchan a los vendedores de al lado.',
  eavesdropLine1: 'Hoy sí vamos a ==salir tablas==: vendimos justo lo que gastamos.',
  eavesdropNote1:
    '**Salir tablas** significa no ganar ni perder dinero: lo que entró es igual a lo que salió.',
  eavesdropLine2: 'Yo aparto mi ==fondo de emergencia== antes de contar ganancias.',
  eavesdropNote2:
    'Un **fondo de emergencia** es dinero guardado solo para sorpresas, como cuando se rompe algo.',
  eavesdropLine3: 'Buena idea. Mañana subo el precio un peso, a ver si el puesto lo ==aguanta==.',
  eavesdropNote3:
    '**Aguantar** un precio: que los clientes sigan comprando aunque cueste un poco más.',
}

const PT: Copy<typeof EN> = {
  dialoguePrompt: 'A grande ideia da limonada',
  dialogue1: 'Dina, Dina! Achei **R$20** limpando meu quarto. Vou comprar doces AGORA!',
  dialogue2:
    'Calma, Liruf… e se esses R$20 trabalhassem **para você**? Dava para começar um negocinho.',
  dialogue3: 'Um negócio com R$20? Hmm… tipo o quê?',
  dialogue4:
    'Pelos meus mapas, com R$20 você compra limões e açúcar para **20 copos** de limonada. Vendendo cada copo a R$5… faça a conta.',
  dialogue5:
    'Daria **R$100**! Isso se chama *investir*: usar seu dinheiro para ganhar mais. Mãos à obra!',

  scenePrompt: 'A barraquinha abre as portas',
  sceneBody:
    'Sábado de manhã. Liruf pendura a placa: **Limonada do Liruf — R$5 o copo**.\nA primeira cliente já vem chegando com uma moeda brilhante…',

  ideasPrompt: 'O que a barraquinha de limonada nos ensinou',
  ideaInvestTitle: 'Investir',
  ideaInvestBody:
    'Usar seu dinheiro para **ganhar mais** depois, como comprar limões para vender limonada.',
  ideaCostTitle: 'Custo',
  ideaCostBody: 'O que você paga para começar: os **R$20** de limões e açúcar.',
  ideaProfitTitle: 'Lucro',
  ideaProfitBody: 'O que sobra depois de pagar seus custos: **R$100 − R$20 = R$80**.',

  revealPrompt: 'Toque em cada carta para descobrir o segredo',
  revealFront1: 'O que é um **empreendedor**?',
  revealBack1:
    'Alguém que vê um problema e cria uma **ideia** para resolver… como vender limonada num dia quente!',
  revealFront2: 'O que é o **preço**?',
  revealBack2:
    'O dinheiro que você pede pelo seu produto. Muito alto e ninguém compra; muito baixo e você não ganha.',
  revealFront3: 'Quem são os **clientes**?',
  revealBack3: 'As pessoas que compram o que você vende. Cuide bem delas e elas voltam!',

  checkpointPrompt: 'Respira fundo, sócio. Como estamos?',
  checkpointRecap:
    'Até agora:\n- **Investimos** R$20 em limões e açúcar.\n- Vendemos 20 copos a **R$5** cada.\n- Nosso **lucro** foi de R$80.',
  checkpointMood: 'Seguimos na aventura ou revemos a parte da limonada?',

  eavesdropPrompt: 'Escute com atenção: os vendedores da feira estão falando de dinheiro.',
  eavesdropContext:
    'É sábado na feira. Dina e Liruf arrumam a barraquinha e escutam os vendedores do lado.',
  eavesdropLine1: 'Hoje a gente vai ==empatar==: vendemos exatamente o que gastamos.',
  eavesdropNote1:
    '**Empatar** é não ganhar nem perder dinheiro: o que entrou é igual ao que saiu.',
  eavesdropLine2: 'Eu separo minha ==reserva de emergência== antes de contar o lucro.',
  eavesdropNote2:
    'Uma **reserva de emergência** é dinheiro guardado só para imprevistos, como quando algo quebra.',
  eavesdropLine3: 'Boa ideia. Amanhã subo o preço um real, para ver se a barraca ==aguenta==.',
  eavesdropNote3:
    'Um preço que **aguenta**: os clientes continuam comprando mesmo custando um pouco mais.',
}

const COPY = copyPack(EN, ES, PT)

export function storyFixtures(locale: Locale): SegmentBase[] {
  const c = COPY[locale]
  return [
    {
      id: 'fx-story-dialogue',
      type: 'story_dialogue',
      prompt_md: c.dialoguePrompt,
      difficulty: 1,
      xp: 0,
      narrator: { character: 'dina', emotion: 'happy' },
      payload: {
        lines: [
          { character: 'liruf', emotion: 'excited', action: 'jump', text_md: c.dialogue1 },
          { character: 'dina', emotion: 'encouraging', action: 'wave', text_md: c.dialogue2 },
          { character: 'liruf', emotion: 'thinking', action: 'think', text_md: c.dialogue3 },
          { character: 'rho', emotion: 'thinking', action: 'point', text_md: c.dialogue4 },
          { character: 'zara', emotion: 'excited', action: 'celebrate', text_md: c.dialogue5 },
        ],
      },
    },
    {
      id: 'fx-story-scene',
      type: 'story_scene',
      prompt_md: c.scenePrompt,
      difficulty: 1,
      xp: 0,
      payload: {
        backdrop: 'band',
        character: 'liruf',
        emotion: 'proud',
        action: 'bow',
        body_md: c.sceneBody,
        art: { icon: 'storefront', tint: 'accent' },
      },
    },
    {
      id: 'fx-key-ideas',
      type: 'key_ideas',
      prompt_md: c.ideasPrompt,
      difficulty: 1,
      xp: 0,
      narrator: { character: 'rho', emotion: 'happy' },
      payload: {
        ideas: [
          { icon: 'savings', title: c.ideaInvestTitle, body_md: c.ideaInvestBody },
          { icon: 'payments', title: c.ideaCostTitle, body_md: c.ideaCostBody },
          { icon: 'trending_up', title: c.ideaProfitTitle, body_md: c.ideaProfitBody },
        ],
      },
    },
    {
      id: 'fx-concept-reveal',
      type: 'concept_reveal',
      prompt_md: c.revealPrompt,
      difficulty: 2,
      xp: 0,
      narrator: { character: 'zara', emotion: 'thinking' },
      payload: {
        cards: [
          { icon: 'lightbulb', front_md: c.revealFront1, back_md: c.revealBack1 },
          { icon: 'sell', front_md: c.revealFront2, back_md: c.revealBack2 },
          { icon: 'group', front_md: c.revealFront3, back_md: c.revealBack3 },
        ],
      },
    },
    {
      id: 'fx-checkpoint',
      type: 'checkpoint',
      prompt_md: c.checkpointPrompt,
      difficulty: 1,
      xp: 0,
      narrator: { character: 'dina', emotion: 'encouraging' },
      payload: { recap_md: c.checkpointRecap, mood_prompt_md: c.checkpointMood },
    },
    {
      id: 'fx-eavesdrop',
      type: 'eavesdrop',
      prompt_md: c.eavesdropPrompt,
      difficulty: 1,
      xp: 0,
      narrator: { character: 'rho', emotion: 'neutral' },
      payload: {
        context_md: c.eavesdropContext,
        lines: [
          { character: 'zara', emotion: 'happy', text_md: c.eavesdropLine1, notes: [c.eavesdropNote1] },
          { character: 'rho', text_md: c.eavesdropLine2, notes: [c.eavesdropNote2] },
          { character: 'zara', emotion: 'thinking', text_md: c.eavesdropLine3, notes: [c.eavesdropNote3] },
        ],
      },
    },
  ]
}
