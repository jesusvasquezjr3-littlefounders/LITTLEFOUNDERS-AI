// `maker` family — one demo segment per type for /dev/lesson-lab.
// Written per locale; see `../../lab/fixtureCopy.ts`. Structure and answer keys
// are written once and are identical in every locale by construction.

import type { Locale } from '@/i18n'
import type { SegmentBase } from '../../core/types'
import { copyPack, type Copy } from '../../lab/fixtureCopy'

const EN = {
  codePrompt: "Put the blocks in order to build Liruf's **saving routine**.",
  codeHint: 'Every program starts with `start` and ends by showing the result.',
  codeExplain:
    'First you **start**, then you **repeat** the saving step, and at the end you **show** how much you have.',
  codeB1: 'start',
  codeB2: 'repeat 4 times:',
  codeB3: 'save(10)',
  codeB4: 'show(total)',
  codeLang: 'pseudocode',

  robotPrompt: 'Guide Liruf to the **coin**. Build your program and press **Run**.',
  robotHint: 'Go up first, then turn towards the coin.',
  robotExplain: 'A robot does **exactly** what its program says, one step at a time.',

  debugPrompt: "Zara's saving routine has a **bug**. Find it!",
  debugHint: 'The goal is to SAVE… does every line help her save?',
  debugExplain: 'Debugging is reading line by line and asking: does this do what we **want**?',
  debugIntro: 'Zara wants to reach **$40** by saving $10 a week. Tap the line that is **wrong**.',
  debugB1: 'goal = 40',
  debugB2: 'every week:',
  debugB3: 'spend(10)',
  debugB4: 'total = total + 10',
  debugB5: 'if total >= goal: celebrate()',
  debugFix: 'Change `spend(10)` to `save(10)` — we want to **save**, not spend!',

  scalePrompt: 'The chest weighs **12**. Add weights until the scale is **level**.',
  scaleHint: 'Add weights until you reach exactly 12: try the big ones first.',
  scaleExplain: 'When both sides **add up the same**, the scale does not tip: 5 + 4 + 3 = 12.',
  scaleChest: 'Chest',

  measurePrompt: 'The lab thermometer shows the temperature. How many **degrees** do you read?',
  measureHint: 'Each little line on the tube is worth 5 degrees.',
  measureExplain: 'The liquid rises to the **25 °C** mark: between 20 and 30, right in the middle.',

  machinePrompt: 'The **mystery machine** transforms numbers. Work out its rule and predict the output.',
  machineHint: 'Look at how much each number grows: does it multiply and then add something?',
  machineExplain: 'The rule is **×2 +1**: 6 goes in, the machine does 6 × 2 = 12 and 12 + 1 = **13**.',
} as const

const ES: Copy<typeof EN> = {
  codePrompt: 'Ordena los bloques para armar la **rutina de ahorro** de Liruf.',
  codeHint: 'Todo programa empieza con `inicio` y termina mostrando el resultado.',
  codeExplain:
    'Primero **empiezas**, luego **repites** el paso de guardar, y al final **miras** cuánto juntaste.',
  codeB1: 'inicio',
  codeB2: 'repetir 4 veces:',
  codeB3: 'guardar(10)',
  codeB4: 'mostrar(total)',
  codeLang: 'pseudocódigo',

  robotPrompt: 'Guía a Liruf hasta la **moneda**. Arma tu programa y presiona **Ejecutar**.',
  robotHint: 'Primero avanza hacia arriba y luego gira hacia la moneda.',
  robotExplain: 'Un robot solo hace **exactamente** lo que su programa dice, paso por paso.',

  debugPrompt: 'La rutina de ahorro de Zara tiene un **error**. ¡Encuéntralo!',
  debugHint: 'La meta es AHORRAR… ¿todas las líneas ayudan a ahorrar?',
  debugExplain: 'Depurar es leer línea por línea y preguntarte: ¿esto hace lo que **queremos**?',
  debugIntro: 'Zara quiere juntar **$40** guardando $10 cada semana. Toca la línea que está **mal**.',
  debugB1: 'meta = 40',
  debugB2: 'cada semana:',
  debugB3: 'gastar(10)',
  debugB4: 'total = total + 10',
  debugB5: 'si total >= meta: celebrar()',
  debugFix: 'Cambia `gastar(10)` por `guardar(10)` — ¡queremos **ahorrar**, no gastar!',

  scalePrompt: 'El cofre pesa **12**. Coloca pesas hasta que la balanza quede **pareja**.',
  scaleHint: 'Suma pesas hasta llegar exactamente a 12: prueba con las más grandes primero.',
  scaleExplain:
    'Cuando los dos lados **suman lo mismo**, la balanza no se inclina: 5 + 4 + 3 = 12.',
  scaleChest: 'Cofre',

  measurePrompt: 'El termómetro del laboratorio marca la temperatura. ¿Cuántos **grados** lees?',
  measureHint: 'Cada rayita del tubo vale 5 grados.',
  measureExplain: 'El líquido sube hasta la marca de **25 °C**: entre 20 y 30, justo a la mitad.',

  machinePrompt:
    'La **máquina misteriosa** transforma números. Descubre su regla y predice la salida.',
  machineHint: 'Mira cuánto crece cada número: ¿lo multiplica y luego suma algo?',
  machineExplain: 'La regla es **×2 +1**: entra 6, la máquina hace 6 × 2 = 12 y 12 + 1 = **13**.',
}

const PT: Copy<typeof EN> = {
  codePrompt: 'Coloque os blocos em ordem para montar a **rotina de poupança** do Liruf.',
  codeHint: 'Todo programa começa com `início` e termina mostrando o resultado.',
  codeExplain:
    'Primeiro você **começa**, depois **repete** o passo de guardar e no fim **mostra** quanto juntou.',
  codeB1: 'início',
  codeB2: 'repetir 4 vezes:',
  codeB3: 'guardar(10)',
  codeB4: 'mostrar(total)',
  codeLang: 'pseudocódigo',

  robotPrompt: 'Guie Liruf até a **moeda**. Monte seu programa e aperte **Executar**.',
  robotHint: 'Primeiro avance para cima e depois vire em direção à moeda.',
  robotExplain: 'Um robô faz **exatamente** o que o programa diz, passo a passo.',

  debugPrompt: 'A rotina de poupança da Zara tem um **erro**. Encontre!',
  debugHint: 'A meta é POUPAR… todas as linhas ajudam a poupar?',
  debugExplain: 'Depurar é ler linha por linha e perguntar: isto faz o que a gente **quer**?',
  debugIntro: 'Zara quer juntar **R$40** guardando R$10 por semana. Toque na linha que está **errada**.',
  debugB1: 'meta = 40',
  debugB2: 'toda semana:',
  debugB3: 'gastar(10)',
  debugB4: 'total = total + 10',
  debugB5: 'se total >= meta: comemorar()',
  debugFix: 'Troque `gastar(10)` por `guardar(10)` — a gente quer **poupar**, não gastar!',

  scalePrompt: 'O baú pesa **12**. Coloque pesos até a balança ficar **equilibrada**.',
  scaleHint: 'Some pesos até chegar exatamente a 12: comece pelos maiores.',
  scaleExplain: 'Quando os dois lados **somam igual**, a balança não pende: 5 + 4 + 3 = 12.',
  scaleChest: 'Baú',

  measurePrompt: 'O termômetro do laboratório marca a temperatura. Quantos **graus** você lê?',
  measureHint: 'Cada risquinho do tubo vale 5 graus.',
  measureExplain: 'O líquido sobe até a marca de **25 °C**: entre 20 e 30, bem no meio.',

  machinePrompt:
    'A **máquina misteriosa** transforma números. Descubra a regra e preveja a saída.',
  machineHint: 'Veja quanto cada número cresce: ela multiplica e depois soma alguma coisa?',
  machineExplain: 'A regra é **×2 +1**: entra 6, a máquina faz 6 × 2 = 12 e 12 + 1 = **13**.',
}

const COPY = copyPack(EN, ES, PT)

export function makerFixtures(locale: Locale): SegmentBase[] {
  const c = COPY[locale]
  return [
    {
      id: 'fx-code-order',
      type: 'code_order',
      prompt_md: c.codePrompt,
      difficulty: 2,
      xp: 15,
      hints: [c.codeHint],
      explanation_md: c.codeExplain,
      narrator: { character: 'liruf', emotion: 'excited' },
      payload: {
        blocks: [
          { id: 'b3', text_md: c.codeB3 },
          { id: 'b1', text_md: c.codeB1 },
          { id: 'b4', text_md: c.codeB4 },
          { id: 'b2', text_md: c.codeB2 },
        ],
        language_hint: c.codeLang,
      },
      answer: { order: ['b1', 'b2', 'b3', 'b4'] },
    },
    {
      id: 'fx-robot-path',
      type: 'robot_path',
      prompt_md: c.robotPrompt,
      difficulty: 3,
      xp: 20,
      hints: [c.robotHint],
      explanation_md: c.robotExplain,
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
      prompt_md: c.debugPrompt,
      difficulty: 3,
      xp: 20,
      hints: [c.debugHint],
      explanation_md: c.debugExplain,
      narrator: { character: 'zara', emotion: 'thinking' },
      payload: {
        intro_md: c.debugIntro,
        blocks: [
          { id: 'b1', text_md: c.debugB1 },
          { id: 'b2', text_md: c.debugB2 },
          { id: 'b3', text_md: c.debugB3 },
          { id: 'b4', text_md: c.debugB4 },
          { id: 'b5', text_md: c.debugB5 },
        ],
      },
      answer: { bug_ids: ['b3'], fix_md: c.debugFix },
    },
    {
      id: 'fx-balance-scale',
      type: 'balance_scale',
      prompt_md: c.scalePrompt,
      difficulty: 2,
      xp: 15,
      hints: [c.scaleHint],
      explanation_md: c.scaleExplain,
      narrator: { character: 'rho', emotion: 'thinking' },
      payload: {
        left_fixed: [{ label: c.scaleChest, value: 12 }],
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
      prompt_md: c.measurePrompt,
      difficulty: 2,
      xp: 15,
      hints: [c.measureHint],
      explanation_md: c.measureExplain,
      narrator: { character: 'dina', emotion: 'thinking' },
      payload: { instrument: 'thermometer', min: 0, max: 40, ticks: 9, unit: '°C', pointer_value: 25 },
      answer: { value: 25, tolerance: 1 },
    },
    {
      id: 'fx-machine-io',
      type: 'machine_io',
      prompt_md: c.machinePrompt,
      difficulty: 3,
      xp: 20,
      hints: [c.machineHint],
      explanation_md: c.machineExplain,
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
}
