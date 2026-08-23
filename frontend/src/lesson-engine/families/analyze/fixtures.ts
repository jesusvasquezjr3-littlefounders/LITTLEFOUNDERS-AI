// `analyze` family — one demo segment per type for /dev/lesson-lab.
// Written per locale; see `../../lab/fixtureCopy.ts`. Structure and answer keys
// are written once and are identical in every locale by construction.

import type { Locale } from '@/i18n'
import type { SegmentBase } from '../../core/types'
import { copyPack, type Copy } from '../../lab/fixtureCopy'

const EN = {
  errorPrompt: 'Liruf worked out his change. Find the step with the **mistake**.',
  errorHint: 'Check the subtraction: how much is $50 minus $25?',
  errorExplain:
    'To check a calculation, follow **every step** calmly: the mistake is almost always hiding in just one.',
  errorContext: 'Liruf wants a **$25** notebook and pays with a **$50** note.',
  errorS1: 'The notebook costs $25.',
  errorS2: 'Liruf pays with a $50 note.',
  errorS3: 'The change is $50 − $25 = **$35**.',
  errorS4: 'Liruf puts his change in the piggy bank.',
  errorFix: 'The right change is **$50 − $25 = $25**. Liruf was given $10 too much!',

  causePrompt: "Put Dina's story in order: what caused what?",
  causeHint: 'Start on the day Dina got her money.',
  causeExplain:
    'Every money decision has an **effect** later. Thinking through the whole chain helps you decide better.',
  causeE1: 'Dina got her pocket money',
  causeE2: 'She spent it all on sweets the same day',
  causeE3: 'Nothing was left for her mum’s present',
  causeE4: 'She had to wait until next week',
  causeD1: 'She found a coin in the sofa',
  causeD2: 'Her piggy bank filled up with interest',

  tablePrompt: 'Fill in the table: piggy bank or bank?',
  tableHint: 'Think: what happens if the piggy bank is lost? And does the bank pay anything extra?',
  tableExplain:
    'A piggy bank is great to start with, but a bank **protects** your money and even pays it interest.',
  tableRowPiggy: 'Piggy bank',
  tableRowBank: 'Bank',
  tableColSafe: 'How safe?',
  tableColGrow: 'Does it grow?',
  tableT1: 'Fairly safe',
  tableT2: 'Very safe',
  tableT3: 'Does not grow',
  tableT4: 'Earns interest',

  chartPrompt: "Look at Dina's savings and answer.",
  chartHint: 'The tallest bar is the week she saved most.',
  chartExplain:
    'Charts tell stories: the **height** of each bar is how much Dina saved that week.',
  chartSeries: "Dina's savings",
  chartW1: 'Wk 1',
  chartW2: 'Wk 2',
  chartW3: 'Wk 3',
  chartW4: 'Wk 4',
  chartQ1: 'Which week did she save the **most**?',
  chartQ1a: 'Week 1',
  chartQ1b: 'Week 4',
  chartQ1c: 'Week 3',
  chartQ2: 'How much did she save **in total** over the 4 weeks?',
  chartQ2a: '$50',
  chartQ2b: '$40',
  chartQ2c: '$35',

  evidencePrompt: "Highlight the sentences that **prove** Rho's idea.",
  evidenceHint: 'Look for sentences about saving and about what it achieved.',
  evidenceExplain:
    'Good **evidence** supports the idea directly. Pretty details do not count as proof.',
  evidenceClaim: 'Saving a little **every week** brings you closer to your goals.',
  evidenceS1: 'Dina put $5 away every week for two months.',
  evidenceS2: 'Her favourite colour is purple.',
  evidenceS3: 'In the end she had $40 and bought her telescope.',
  evidenceS4: 'The telescope is white and blue.',
  evidenceS5: 'Her small savings, week after week, grew big.',

  flagsPrompt: 'Zara found this advert. Mark the **warning signs**.',
  flagsHint: 'If something is "free" but they charge you, that is an alert!',
  flagsExplain:
    'Scam adverts use hurry, fake gifts and requests for your details. Spotting them protects you and your money.',
  flagsArtifact:
    '**FREE! The super robot Liruf-Bot 3000**\n**Today only.** Just pay $299 postage.\n- The first 10 children get two!\n- Send your name and address **now** to the *TurboToysVIP* chat',
  flagsF1: 'Says it is free but charges $299 for "postage"',
  flagsF2: 'Rushes you with "today only"',
  flagsF3: 'Asks for your name and address over chat',
  flagsF4: 'Shows the name of the toy',
  flagsF5: 'It is an advert about a robot',
  flagsF6: 'Promises double to the first 10',

  factPrompt: 'Fact or opinion? Decide for each sentence.',
  factHint: 'A fact can be checked; an opinion is what somebody feels or prefers.',
  factExplain:
    'A **fact** can be checked against evidence. An **opinion** depends on what each person likes.',
  factSt1: 'A $100 note is worth more than a $50 one.',
  factSt2: 'Saving is boring.',
  factSt3: "Banks look after people's money.",
  factSt4: 'Sweets are the best way to spend your pocket money.',
} as const

const ES: Copy<typeof EN> = {
  errorPrompt: 'Liruf calculó su cambio. Encuentra el paso con **error**.',
  errorHint: 'Revisa la resta: ¿cuánto es $50 menos $25?',
  errorExplain:
    'Para revisar un cálculo, sigue **cada paso** con calma: el error casi siempre se esconde en uno solo.',
  errorContext: 'Liruf quiere un cuaderno de **$25** y paga con un billete de **$50**.',
  errorS1: 'El cuaderno cuesta $25.',
  errorS2: 'Liruf paga con un billete de $50.',
  errorS3: 'El cambio es $50 − $25 = **$35**.',
  errorS4: 'Liruf guarda su cambio en la alcancía.',
  errorFix: 'El cambio correcto es **$50 − $25 = $25**. ¡A Liruf le dieron $10 de más!',

  causePrompt: 'Ordena la historia de Dina: ¿qué causó qué?',
  causeHint: 'Empieza por el día que Dina recibió su dinero.',
  causeExplain:
    'Cada decisión con dinero tiene un **efecto** después. Pensar en la cadena completa te ayuda a decidir mejor.',
  causeE1: 'Dina recibió su domingo',
  causeE2: 'Gastó todo en dulces el mismo día',
  causeE3: 'No le quedó nada para el regalo de mamá',
  causeE4: 'Tuvo que esperar al próximo domingo',
  causeD1: 'Encontró una moneda en el sillón',
  causeD2: 'Su alcancía se llenó de intereses',

  tablePrompt: 'Completa la tabla: ¿alcancía o banco?',
  tableHint: 'Piensa: ¿qué pasa si se pierde la alcancía? ¿Y el banco paga algo extra?',
  tableExplain:
    'La alcancía es genial para empezar, pero el banco **protege** tu dinero y hasta le paga intereses.',
  tableRowPiggy: 'Alcancía',
  tableRowBank: 'Banco',
  tableColSafe: '¿Qué tan seguro?',
  tableColGrow: '¿Crece tu dinero?',
  tableT1: 'Más o menos seguro',
  tableT2: 'Muy seguro',
  tableT3: 'No crece',
  tableT4: 'Gana intereses',

  chartPrompt: 'Mira los ahorros de Dina y responde.',
  chartHint: 'La barra más alta es la semana con más ahorro.',
  chartExplain:
    'Las gráficas cuentan historias: la **altura** de cada barra es cuánto ahorró Dina esa semana.',
  chartSeries: 'Ahorros de Dina',
  chartW1: 'Sem 1',
  chartW2: 'Sem 2',
  chartW3: 'Sem 3',
  chartW4: 'Sem 4',
  chartQ1: '¿En qué semana ahorró **más**?',
  chartQ1a: 'Semana 1',
  chartQ1b: 'Semana 4',
  chartQ1c: 'Semana 3',
  chartQ2: '¿Cuánto ahorró **en total** en las 4 semanas?',
  chartQ2a: '$50',
  chartQ2b: '$40',
  chartQ2c: '$35',

  evidencePrompt: 'Ilumina las frases que **demuestran** la idea de Rho.',
  evidenceHint: 'Busca frases que hablen de ahorrar y de lo que se logró con eso.',
  evidenceExplain:
    'Una buena **evidencia** apoya la idea directamente. Los detalles bonitos no cuentan como prueba.',
  evidenceClaim: 'Ahorrar un poco **cada semana** te acerca a tus metas.',
  evidenceS1: 'Dina guardó $5 cada semana durante dos meses.',
  evidenceS2: 'Su color favorito es el morado.',
  evidenceS3: 'Al final juntó $40 y compró su telescopio.',
  evidenceS4: 'El telescopio es blanco con azul.',
  evidenceS5: 'Sus pequeños ahorros, semana a semana, se hicieron grandes.',

  flagsPrompt: 'Zara encontró este anuncio. Marca las **señales de trampa**.',
  flagsHint: 'Si algo es "gratis" pero te cobran, ¡alerta!',
  flagsExplain:
    'Los anuncios trampa usan prisa, regalos falsos y piden tus datos. Detectarlos te protege a ti y a tu dinero.',
  flagsArtifact:
    '**¡GRATIS! El súper robot Liruf-Bot 3000**\n**Solo hoy.** Solo paga el envío de $299.\n- ¡Los primeros 10 niños lo reciben doble!\n- Manda tu nombre y dirección **ya** al chat *TurboJuguetesVIP*',
  flagsF1: 'Dice que es gratis pero cobra $299 de "envío"',
  flagsF2: 'Te apura con "solo hoy"',
  flagsF3: 'Pide tu nombre y dirección por chat',
  flagsF4: 'Muestra el nombre del juguete',
  flagsF5: 'Es un anuncio sobre un robot',
  flagsF6: 'Promete el doble a los primeros 10',

  factPrompt: '¿Hecho u opinión? Decide para cada frase.',
  factHint: 'Un hecho se puede comprobar; una opinión es lo que alguien siente o prefiere.',
  factExplain:
    'Un **hecho** se puede comprobar con evidencia. Una **opinión** depende de los gustos de cada quien.',
  factSt1: 'Un billete de $100 vale más que uno de $50.',
  factSt2: 'Ahorrar es aburrido.',
  factSt3: 'Los bancos guardan el dinero de las personas.',
  factSt4: 'Los dulces son la mejor forma de gastar tu domingo.',
}

const PT: Copy<typeof EN> = {
  errorPrompt: 'Liruf calculou o troco. Encontre o passo com **erro**.',
  errorHint: 'Confira a subtração: quanto é R$50 menos R$25?',
  errorExplain:
    'Para conferir uma conta, siga **cada passo** com calma: o erro quase sempre está escondido em um só.',
  errorContext: 'Liruf quer um caderno de **R$25** e paga com uma nota de **R$50**.',
  errorS1: 'O caderno custa R$25.',
  errorS2: 'Liruf paga com uma nota de R$50.',
  errorS3: 'O troco é R$50 − R$25 = **R$35**.',
  errorS4: 'Liruf guarda o troco no cofrinho.',
  errorFix: 'O troco certo é **R$50 − R$25 = R$25**. Deram R$10 a mais para o Liruf!',

  causePrompt: 'Coloque a história da Dina em ordem: o que causou o quê?',
  causeHint: 'Comece pelo dia em que Dina recebeu o dinheiro.',
  causeExplain:
    'Toda decisão com dinheiro tem um **efeito** depois. Pensar na cadeia inteira ajuda a decidir melhor.',
  causeE1: 'Dina recebeu a mesada',
  causeE2: 'Gastou tudo em doces no mesmo dia',
  causeE3: 'Não sobrou nada para o presente da mãe',
  causeE4: 'Teve que esperar a próxima semana',
  causeD1: 'Achou uma moeda no sofá',
  causeD2: 'O cofrinho encheu de juros',

  tablePrompt: 'Complete a tabela: cofrinho ou banco?',
  tableHint: 'Pense: e se o cofrinho se perder? E o banco paga algo a mais?',
  tableExplain:
    'O cofrinho é ótimo para começar, mas o banco **protege** seu dinheiro e ainda paga juros.',
  tableRowPiggy: 'Cofrinho',
  tableRowBank: 'Banco',
  tableColSafe: 'Quão seguro?',
  tableColGrow: 'O dinheiro cresce?',
  tableT1: 'Mais ou menos seguro',
  tableT2: 'Muito seguro',
  tableT3: 'Não cresce',
  tableT4: 'Rende juros',

  chartPrompt: 'Veja as economias da Dina e responda.',
  chartHint: 'A barra mais alta é a semana em que ela mais guardou.',
  chartExplain:
    'Os gráficos contam histórias: a **altura** de cada barra é quanto Dina guardou naquela semana.',
  chartSeries: 'Economias da Dina',
  chartW1: 'Sem 1',
  chartW2: 'Sem 2',
  chartW3: 'Sem 3',
  chartW4: 'Sem 4',
  chartQ1: 'Em qual semana ela guardou **mais**?',
  chartQ1a: 'Semana 1',
  chartQ1b: 'Semana 4',
  chartQ1c: 'Semana 3',
  chartQ2: 'Quanto ela guardou **no total** nas 4 semanas?',
  chartQ2a: 'R$50',
  chartQ2b: 'R$40',
  chartQ2c: 'R$35',

  evidencePrompt: 'Ilumine as frases que **comprovam** a ideia do Rho.',
  evidenceHint: 'Procure frases que falem de poupar e do que isso conseguiu.',
  evidenceExplain:
    'Uma boa **evidência** apoia a ideia diretamente. Detalhes bonitinhos não valem como prova.',
  evidenceClaim: 'Guardar um pouco **toda semana** aproxima você das suas metas.',
  evidenceS1: 'Dina guardou R$5 por semana durante dois meses.',
  evidenceS2: 'A cor favorita dela é roxo.',
  evidenceS3: 'No fim juntou R$40 e comprou o telescópio.',
  evidenceS4: 'O telescópio é branco com azul.',
  evidenceS5: 'As economias pequenas dela, semana após semana, ficaram grandes.',

  flagsPrompt: 'Zara achou este anúncio. Marque os **sinais de golpe**.',
  flagsHint: 'Se algo é "grátis" mas cobram de você, é alerta!',
  flagsExplain:
    'Anúncios de golpe usam pressa, brindes falsos e pedem seus dados. Reconhecê-los protege você e o seu dinheiro.',
  flagsArtifact:
    '**GRÁTIS! O super robô Liruf-Bot 3000**\n**Só hoje.** Pague só o frete de R$299.\n- As primeiras 10 crianças recebem em dobro!\n- Mande seu nome e endereço **agora** no chat *TurboBrinquedosVIP*',
  flagsF1: 'Diz que é grátis mas cobra R$299 de "frete"',
  flagsF2: 'Apressa você com "só hoje"',
  flagsF3: 'Pede seu nome e endereço pelo chat',
  flagsF4: 'Mostra o nome do brinquedo',
  flagsF5: 'É um anúncio sobre um robô',
  flagsF6: 'Promete em dobro para os 10 primeiros',

  factPrompt: 'Fato ou opinião? Decida para cada frase.',
  factHint: 'Um fato pode ser conferido; uma opinião é o que alguém sente ou prefere.',
  factExplain:
    'Um **fato** pode ser conferido com evidência. Uma **opinião** depende do gosto de cada um.',
  factSt1: 'Uma nota de R$100 vale mais que uma de R$50.',
  factSt2: 'Poupar é chato.',
  factSt3: 'Os bancos guardam o dinheiro das pessoas.',
  factSt4: 'Doces são a melhor forma de gastar a mesada.',
}

const COPY = copyPack(EN, ES, PT)

export function analyzeFixtures(locale: Locale): SegmentBase[] {
  const c = COPY[locale]
  return [
    {
      id: 'fx-spot-error',
      type: 'spot_error',
      prompt_md: c.errorPrompt,
      difficulty: 2,
      xp: 15,
      hints: [c.errorHint],
      explanation_md: c.errorExplain,
      narrator: { character: 'rho', emotion: 'thinking' },
      payload: {
        context_md: c.errorContext,
        steps: [
          { id: 's1', text_md: c.errorS1 },
          { id: 's2', text_md: c.errorS2 },
          { id: 's3', text_md: c.errorS3 },
          { id: 's4', text_md: c.errorS4 },
        ],
      },
      answer: { error_ids: ['s3'], correction_md: c.errorFix },
    },
    {
      id: 'fx-cause-effect',
      type: 'cause_effect',
      prompt_md: c.causePrompt,
      difficulty: 2,
      xp: 15,
      hints: [c.causeHint],
      explanation_md: c.causeExplain,
      narrator: { character: 'dina', emotion: 'thinking' },
      payload: {
        events: [
          { id: 'e1', text_md: c.causeE1 },
          { id: 'e2', text_md: c.causeE2 },
          { id: 'e3', text_md: c.causeE3 },
          { id: 'e4', text_md: c.causeE4 },
          { id: 'd1', text_md: c.causeD1 },
          { id: 'd2', text_md: c.causeD2 },
        ],
        slots: 4,
      },
      answer: { chain: ['e1', 'e2', 'e3', 'e4'] },
    },
    {
      id: 'fx-compare-table',
      type: 'compare_table',
      prompt_md: c.tablePrompt,
      difficulty: 3,
      xp: 20,
      hints: [c.tableHint],
      explanation_md: c.tableExplain,
      narrator: { character: 'rho', emotion: 'neutral' },
      payload: {
        rows: [
          { id: 'alcancia', label: c.tableRowPiggy },
          { id: 'banco', label: c.tableRowBank },
        ],
        cols: [
          { id: 'seguridad', label: c.tableColSafe },
          { id: 'crecimiento', label: c.tableColGrow },
        ],
        tokens: [
          { id: 't1', text_md: c.tableT1 },
          { id: 't2', text_md: c.tableT2 },
          { id: 't3', text_md: c.tableT3 },
          { id: 't4', text_md: c.tableT4 },
        ],
      },
      answer: {
        cells: {
          'alcancia:seguridad': 't1',
          'alcancia:crecimiento': 't3',
          'banco:seguridad': 't2',
          'banco:crecimiento': 't4',
        },
      },
    },
    {
      id: 'fx-read-chart',
      type: 'read_chart',
      prompt_md: c.chartPrompt,
      difficulty: 2,
      xp: 20,
      hints: [c.chartHint],
      explanation_md: c.chartExplain,
      narrator: { character: 'dina', emotion: 'happy' },
      payload: {
        chart: {
          kind: 'bar',
          series: [
            {
              label: c.chartSeries,
              points: [
                { x: c.chartW1, y: 10 },
                { x: c.chartW2, y: 15 },
                { x: c.chartW3, y: 5 },
                { x: c.chartW4, y: 20 },
              ],
            },
          ],
          unit: '$',
        },
        questions: [
          {
            id: 'q1',
            prompt_md: c.chartQ1,
            options: [
              { id: 'a', text_md: c.chartQ1a },
              { id: 'b', text_md: c.chartQ1b },
              { id: 'c', text_md: c.chartQ1c },
            ],
          },
          {
            id: 'q2',
            prompt_md: c.chartQ2,
            options: [
              { id: 'a', text_md: c.chartQ2a },
              { id: 'b', text_md: c.chartQ2b },
              { id: 'c', text_md: c.chartQ2c },
            ],
          },
        ],
      },
      answer: { correct: { q1: 'b', q2: 'a' } },
    },
    {
      id: 'fx-evidence-hunt',
      type: 'evidence_hunt',
      prompt_md: c.evidencePrompt,
      difficulty: 3,
      xp: 20,
      hints: [c.evidenceHint],
      explanation_md: c.evidenceExplain,
      narrator: { character: 'rho', emotion: 'thinking' },
      payload: {
        claim_md: c.evidenceClaim,
        sentences: [
          { id: 's1', text_md: c.evidenceS1 },
          { id: 's2', text_md: c.evidenceS2 },
          { id: 's3', text_md: c.evidenceS3 },
          { id: 's4', text_md: c.evidenceS4 },
          { id: 's5', text_md: c.evidenceS5 },
        ],
      },
      answer: { evidence_ids: ['s1', 's3', 's5'] },
    },
    {
      id: 'fx-red-flags',
      type: 'red_flags',
      prompt_md: c.flagsPrompt,
      difficulty: 3,
      xp: 20,
      hints: [c.flagsHint],
      explanation_md: c.flagsExplain,
      narrator: { character: 'zara', emotion: 'surprised' },
      payload: {
        artifact_md: c.flagsArtifact,
        artifact_kind: 'ad',
        flags: [
          { id: 'f1', text_md: c.flagsF1 },
          { id: 'f2', text_md: c.flagsF2 },
          { id: 'f3', text_md: c.flagsF3 },
          { id: 'f4', text_md: c.flagsF4 },
          { id: 'f5', text_md: c.flagsF5 },
          { id: 'f6', text_md: c.flagsF6 },
        ],
      },
      answer: { redflag_ids: ['f1', 'f2', 'f3', 'f6'] },
    },
    {
      id: 'fx-fact-opinion',
      type: 'fact_opinion',
      prompt_md: c.factPrompt,
      difficulty: 2,
      xp: 15,
      hints: [c.factHint],
      explanation_md: c.factExplain,
      narrator: { character: 'liruf', emotion: 'thinking' },
      payload: {
        statements: [
          { id: 'st1', text_md: c.factSt1 },
          { id: 'st2', text_md: c.factSt2 },
          { id: 'st3', text_md: c.factSt3 },
          { id: 'st4', text_md: c.factSt4 },
        ],
      },
      answer: { fact_ids: ['st1', 'st3'] },
    },
  ]
}
