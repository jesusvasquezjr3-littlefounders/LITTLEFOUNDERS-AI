// `analyze` family — one demo segment per type for /dev/lesson-lab (es-MX content).
// Fixtures are dev data, not UI strings; lesson documents are single-locale (§3).

import type { SegmentBase } from '../../core/types'

export const analyzeFixtures: SegmentBase[] = [
  {
    id: 'fx-spot-error',
    type: 'spot_error',
    prompt_md: 'Liruf calculó su cambio. Encuentra el paso con **error**.',
    difficulty: 2,
    xp: 15,
    hints: ['Revisa la resta: ¿cuánto es $50 menos $25?'],
    explanation_md: 'Para revisar un cálculo, sigue **cada paso** con calma: el error casi siempre se esconde en uno solo.',
    narrator: { character: 'rho', emotion: 'thinking' },
    payload: {
      context_md: 'Liruf quiere un cuaderno de **$25** y paga con un billete de **$50**.',
      steps: [
        { id: 's1', text_md: 'El cuaderno cuesta $25.' },
        { id: 's2', text_md: 'Liruf paga con un billete de $50.' },
        { id: 's3', text_md: 'El cambio es $50 − $25 = **$35**.' },
        { id: 's4', text_md: 'Liruf guarda su cambio en la alcancía.' },
      ],
    },
    answer: {
      error_ids: ['s3'],
      correction_md: 'El cambio correcto es **$50 − $25 = $25**. ¡A Liruf le dieron $10 de más!',
    },
  },
  {
    id: 'fx-cause-effect',
    type: 'cause_effect',
    prompt_md: 'Ordena la historia de Dina: ¿qué causó qué?',
    difficulty: 2,
    xp: 15,
    hints: ['Empieza por el día que Dina recibió su dinero.'],
    explanation_md: 'Cada decisión con dinero tiene un **efecto** después. Pensar en la cadena completa te ayuda a decidir mejor.',
    narrator: { character: 'dina', emotion: 'thinking' },
    payload: {
      events: [
        { id: 'e1', text_md: 'Dina recibió su domingo' },
        { id: 'e2', text_md: 'Gastó todo en dulces el mismo día' },
        { id: 'e3', text_md: 'No le quedó nada para el regalo de mamá' },
        { id: 'e4', text_md: 'Tuvo que esperar al próximo domingo' },
        { id: 'd1', text_md: 'Encontró una moneda en el sillón' },
        { id: 'd2', text_md: 'Su alcancía se llenó de intereses' },
      ],
      slots: 4,
    },
    answer: { chain: ['e1', 'e2', 'e3', 'e4'] },
  },
  {
    id: 'fx-compare-table',
    type: 'compare_table',
    prompt_md: 'Completa la tabla: ¿alcancía o banco?',
    difficulty: 3,
    xp: 20,
    hints: ['Piensa: ¿qué pasa si se pierde la alcancía? ¿Y el banco paga algo extra?'],
    explanation_md: 'La alcancía es genial para empezar, pero el banco **protege** tu dinero y hasta le paga intereses.',
    narrator: { character: 'rho', emotion: 'neutral' },
    payload: {
      rows: [
        { id: 'alcancia', label: 'Alcancía' },
        { id: 'banco', label: 'Banco' },
      ],
      cols: [
        { id: 'seguridad', label: '¿Qué tan seguro?' },
        { id: 'crecimiento', label: '¿Crece tu dinero?' },
      ],
      tokens: [
        { id: 't1', text_md: 'Más o menos seguro' },
        { id: 't2', text_md: 'Muy seguro' },
        { id: 't3', text_md: 'No crece' },
        { id: 't4', text_md: 'Gana intereses' },
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
    prompt_md: 'Mira los ahorros de Dina y responde.',
    difficulty: 2,
    xp: 20,
    hints: ['La barra más alta es la semana con más ahorro.'],
    explanation_md: 'Las gráficas cuentan historias: la **altura** de cada barra es cuánto ahorró Dina esa semana.',
    narrator: { character: 'dina', emotion: 'happy' },
    payload: {
      chart: {
        kind: 'bar',
        series: [
          {
            label: 'Ahorros de Dina',
            points: [
              { x: 'Sem 1', y: 10 },
              { x: 'Sem 2', y: 15 },
              { x: 'Sem 3', y: 5 },
              { x: 'Sem 4', y: 20 },
            ],
          },
        ],
        unit: '$',
      },
      questions: [
        {
          id: 'q1',
          prompt_md: '¿En qué semana ahorró **más**?',
          options: [
            { id: 'a', text_md: 'Semana 1' },
            { id: 'b', text_md: 'Semana 4' },
            { id: 'c', text_md: 'Semana 3' },
          ],
        },
        {
          id: 'q2',
          prompt_md: '¿Cuánto ahorró **en total** en las 4 semanas?',
          options: [
            { id: 'a', text_md: '$50' },
            { id: 'b', text_md: '$40' },
            { id: 'c', text_md: '$35' },
          ],
        },
      ],
    },
    answer: { correct: { q1: 'b', q2: 'a' } },
  },
  {
    id: 'fx-evidence-hunt',
    type: 'evidence_hunt',
    prompt_md: 'Ilumina las frases que **demuestran** la idea de Rho.',
    difficulty: 3,
    xp: 20,
    hints: ['Busca frases que hablen de ahorrar y de lo que se logró con eso.'],
    explanation_md: 'Una buena **evidencia** apoya la idea directamente. Los detalles bonitos no cuentan como prueba.',
    narrator: { character: 'rho', emotion: 'thinking' },
    payload: {
      claim_md: 'Ahorrar un poco **cada semana** te acerca a tus metas.',
      sentences: [
        { id: 's1', text_md: 'Dina guardó $5 cada semana durante dos meses.' },
        { id: 's2', text_md: 'Su color favorito es el morado.' },
        { id: 's3', text_md: 'Al final juntó $40 y compró su telescopio.' },
        { id: 's4', text_md: 'El telescopio es blanco con azul.' },
        { id: 's5', text_md: 'Sus pequeños ahorros, semana a semana, se hicieron grandes.' },
      ],
    },
    answer: { evidence_ids: ['s1', 's3', 's5'] },
  },
  {
    id: 'fx-red-flags',
    type: 'red_flags',
    prompt_md: 'Zara encontró este anuncio. Marca las **señales de trampa**.',
    difficulty: 3,
    xp: 20,
    hints: ['Si algo es "gratis" pero te cobran, ¡alerta!'],
    explanation_md: 'Los anuncios trampa usan prisa, regalos falsos y piden tus datos. Detectarlos te protege a ti y a tu dinero.',
    narrator: { character: 'zara', emotion: 'surprised' },
    payload: {
      artifact_md:
        '**¡GRATIS! El súper robot Liruf-Bot 3000**\n**Solo hoy.** Solo paga el envío de $299.\n- ¡Los primeros 10 niños lo reciben doble!\n- Manda tu nombre y dirección **ya** al chat *TurboJuguetesVIP*',
      artifact_kind: 'ad',
      flags: [
        { id: 'f1', text_md: 'Dice que es gratis pero cobra $299 de "envío"' },
        { id: 'f2', text_md: 'Te apura con "solo hoy"' },
        { id: 'f3', text_md: 'Pide tu nombre y dirección por chat' },
        { id: 'f4', text_md: 'Muestra el nombre del juguete' },
        { id: 'f5', text_md: 'Es un anuncio sobre un robot' },
        { id: 'f6', text_md: 'Promete el doble a los primeros 10' },
      ],
    },
    answer: { redflag_ids: ['f1', 'f2', 'f3', 'f6'] },
  },
  {
    id: 'fx-fact-opinion',
    type: 'fact_opinion',
    prompt_md: '¿Hecho u opinión? Decide para cada frase.',
    difficulty: 2,
    xp: 15,
    hints: ['Un hecho se puede comprobar; una opinión es lo que alguien siente o prefiere.'],
    explanation_md: 'Un **hecho** se puede comprobar con evidencia. Una **opinión** depende de los gustos de cada quien.',
    narrator: { character: 'liruf', emotion: 'thinking' },
    payload: {
      statements: [
        { id: 'st1', text_md: 'Un billete de $100 vale más que uno de $50.' },
        { id: 'st2', text_md: 'Ahorrar es aburrido.' },
        { id: 'st3', text_md: 'Los bancos guardan el dinero de las personas.' },
        { id: 'st4', text_md: 'Los dulces son la mejor forma de gastar tu domingo.' },
      ],
    },
    answer: { fact_ids: ['st1', 'st3'] },
  },
]
