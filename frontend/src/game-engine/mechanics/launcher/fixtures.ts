// `launcher` — complete, PLAYABLE es-MX manifests (GAME_ENGINE.md §7).
//
// These are not test stubs: each one satisfies the PRODUCTION schemas (§1.14 forbids
// relaxing a schema for a fixture), each one is winnable by the `perfect` bot and not by
// the `random` bot (`launcher.test.ts` asserts both), and each one carries real
// financial-literacy content for its tier — the target a child aims at IS the answer,
// and every misconception target explains itself. There is no child PII here and there
// never can be: a game is generated from curriculum, not from a child (§11).
//
// `skin.sprites` is deliberately EMPTY. Sprite URLs are Prism/Depot artifacts produced
// by the `illustrate` stage; inventing one here would be a fabricated asset. The view
// falls back to palette-tinted shapes plus each element's Material Symbols `icon`, which
// is the same path a document takes before illustration.

import type { GameDocument } from '@/game-engine/core/types'

import type { LauncherConfig, LauncherContent } from './schema'

// ---- Fixture 1 — tier 1, cheer mode, one plain projectile -----------------------------
//
// "Tiro al ahorro": launch a coin into the savings jar and the goal ring, and never into
// the impulse-buy stand. Physics: gravity 1.1 units/tick² with a 12–30 units/tick speed
// band puts every target inside the arc envelope from the fixed emplacement, and the
// preview line is ON because tier 1 gets the aid (GAME_ENGINE.md §4).

const SAVE_CONFIG: LauncherConfig = {
  world: { width: 900, height: 540, ground_y: 470 },
  launcher: {
    x: 60,
    y: 380,
    w: 70,
    h: 70,
    min_angle: 15,
    max_angle: 75,
    angle_step: 5,
    start_angle: 45,
    min_power: 30,
    max_power: 100,
    power_step: 10,
    start_power: 70,
    speed_min: 12,
    speed_max: 30,
    pull_max_units: 220,
    move: { axis: 'none', min: 0, max: 0, step: 1 },
    cooldown_ticks: 8,
  },
  physics: {
    gravity: 1.1,
    wind_x: 0,
    wind_gust: 0,
    wind_period_ticks: 60,
    drag_permille: 0,
    ground_restitution_permille: 0,
    ground_friction_permille: 1000,
    max_flight_ticks: 110,
  },
  projectiles: [
    {
      id: 'moneda',
      kind: 'standard',
      item_ref: 'moneda-10',
      icon: 'paid',
      radius: 12,
      gravity_scale_permille: 1000,
      speed_scale_permille: 1000,
      damage: 1,
      bounces: 0,
      restitution_permille: 500,
      friction_permille: 300,
    },
  ],
  aim: { trajectory_preview: { enabled: true, dots: 14, tick_step: 3 } },
  rounds: [
    {
      id: 'ronda-alcancia',
      shots: 4,
      max_ticks: 350,
      target_speed_permille: 1000,
      targets: [
        {
          id: 'alcancia',
          role: 'correct',
          item_ref: 'alcancia',
          shape: 'box',
          x: 560,
          y: 380,
          w: 90,
          h: 80,
          hp: 1,
          value: 10,
          motion: 'static',
          icon: 'savings',
        },
        {
          id: 'meta',
          role: 'correct',
          item_ref: 'meta-bici',
          shape: 'circle',
          x: 700,
          y: 300,
          w: 80,
          h: 80,
          hp: 1,
          value: 12,
          motion: 'static',
          icon: 'flag',
        },
        {
          id: 'antojo',
          role: 'incorrect',
          item_ref: 'antojo',
          shape: 'box',
          x: 380,
          y: 400,
          w: 70,
          h: 60,
          hp: 1,
          value: 5,
          motion: 'static',
          icon: 'icecream',
        },
      ],
      obstacles: [],
    },
    {
      id: 'ronda-muro',
      shots: 5,
      max_ticks: 400,
      target_speed_permille: 1000,
      targets: [
        {
          id: 'alcancia-2',
          role: 'correct',
          item_ref: 'alcancia',
          shape: 'box',
          x: 600,
          y: 390,
          w: 90,
          h: 80,
          hp: 1,
          value: 10,
          motion: 'static',
          icon: 'savings',
        },
        {
          id: 'meta-2',
          role: 'correct',
          item_ref: 'meta-bici',
          shape: 'box',
          x: 740,
          y: 280,
          w: 70,
          h: 70,
          hp: 1,
          value: 12,
          motion: 'moving',
          axis: 'y',
          amplitude: 40,
          period_ticks: 60,
          icon: 'flag',
        },
        {
          id: 'antojo-2',
          role: 'incorrect',
          item_ref: 'antojo',
          shape: 'box',
          x: 300,
          y: 400,
          w: 70,
          h: 60,
          hp: 1,
          value: 5,
          motion: 'static',
          icon: 'icecream',
        },
      ],
      obstacles: [
        {
          id: 'muro',
          x: 430,
          y: 300,
          w: 30,
          h: 170,
          material: 'deflect',
          restitution_permille: 700,
          friction_permille: 200,
          chain: false,
          icon: 'fence',
        },
      ],
    },
  ],
  scoring: {
    accuracy_weight: 1,
    points_weight: 1,
    leftover_weight: 0.6,
    bounce_weight: 0,
    hit_points: 10,
    points_target: 70,
    bounce_target: 3,
    wrong_penalty_pct: 6,
    miss_penalty_pct: 4,
    lives_cost_on_wrong: false,
    combo: { step: 2, max: 3 },
  },
  max_ticks: 1000,
}

const SAVE_CONTENT: LauncherContent = {
  items: [
    {
      id: 'moneda-10',
      label_md: 'Moneda de 10 pesos',
      icon: 'paid',
      value: 10,
      tier: 1,
      category: 'ahorro',
    },
    {
      id: 'alcancia',
      label_md: 'Alcancia',
      icon: 'savings',
      value: 0,
      tier: 1,
      category: 'ahorro',
    },
    {
      id: 'meta-bici',
      label_md: 'Meta: la bici',
      icon: 'flag',
      value: 900,
      tier: 1,
      category: 'ahorro',
    },
    {
      id: 'antojo',
      label_md: 'Antojo del recreo',
      icon: 'icecream',
      value: 15,
      tier: 1,
      category: 'gasto',
      misconception_md:
        'El antojo se acaba en un rato y tu moneda ya no vuelve: si toda la moneda se va ahi, la meta nunca llega.',
    },
  ],
  categories: [
    { id: 'ahorro', label_md: 'Ahorro', description_md: 'Donde tu dinero se queda y crece.' },
    { id: 'gasto', label_md: 'Gasto rapido', description_md: 'Lo que se acaba el mismo dia.' },
  ],
  feedback: {
    correct_md: ['Directo a la alcancia.', 'Esa moneda ya es tuya.', 'Tu meta esta mas cerca.'],
    incorrect_md: ['Esa moneda se fue en el antojo.', 'Casi: apunta a tu meta.'],
    results_md: 'Cada moneda que apuntaste al ahorro te acerco a tu meta. Asi crece una alcancia.',
  },
  roles: { correct: ['alcancia', 'meta-bici'], incorrect: ['antojo'] },
}

const SAVE_SHOT: GameDocument = {
  schema_version: 1,
  meta: {
    slug: 'tiro-al-ahorro',
    title: 'Tiro al ahorro',
    locale: 'es-MX',
    mechanic: 'launcher',
    concept: {
      topic_path: 'dinero-basico/ahorro/guardar-para-una-meta',
      recap_md:
        'Aprendiste que **ahorrar** es guardar una parte de tu dinero para una **meta**, en vez de gastarlo todo el mismo dia. Ahora apunta: manda cada moneda a la alcancia y a tu meta, no al antojo.',
    },
    tier: 1,
    estimated_minutes: 2,
    cast: ['dina'],
  },
  skin: {
    palette: 'ocean-blue',
    sprites: {},
    sfx: { launch: 'launch', impact: 'impact', hit: 'correct', win: 'celebration' },
  },
  config: SAVE_CONFIG,
  content: SAVE_CONTENT,
  scoring: { mode: 'cheer', xp_max: 10, pass_score: 60, lives: null, target: 4 },
}

// ---- Fixture 2 — tier 2, arcade mode, wind + explosive ammo ------------------------------
//
// "Presupuesto a distancia": the same mechanic with a crosswind, air resistance, an
// explosive charge whose blast opens a `chain` crate, a deflecting wall and an erratic
// target in the second round. Three lives, and a hit on a misconception target costs one
// — the tier-2 arcade posture. The predictive aid is OFF: at tier 2 the manifest may
// offer it, and this document chooses not to.

const BUDGET_CONFIG: LauncherConfig = {
  world: { width: 900, height: 540, ground_y: 470 },
  launcher: {
    x: 60,
    y: 380,
    w: 70,
    h: 70,
    min_angle: 15,
    max_angle: 75,
    angle_step: 5,
    start_angle: 40,
    min_power: 30,
    max_power: 100,
    power_step: 10,
    start_power: 60,
    speed_min: 14,
    speed_max: 36,
    pull_max_units: 240,
    move: { axis: 'x', min: 40, max: 200, step: 20 },
    cooldown_ticks: 8,
  },
  physics: {
    gravity: 1,
    wind_x: 0.25,
    wind_gust: 0.15,
    wind_period_ticks: 80,
    drag_permille: 6,
    ground_restitution_permille: 400,
    ground_friction_permille: 500,
    max_flight_ticks: 120,
  },
  projectiles: [
    {
      id: 'carga',
      kind: 'explosive',
      item_ref: 'billete-50',
      icon: 'package_2',
      radius: 12,
      gravity_scale_permille: 1000,
      speed_scale_permille: 1000,
      damage: 1,
      bounces: 0,
      restitution_permille: 400,
      friction_permille: 400,
      explosive: { radius: 70, damage: 2, chain_depth: 2 },
    },
    {
      id: 'ligera',
      kind: 'light',
      item_ref: 'moneda-5',
      icon: 'paid',
      radius: 10,
      gravity_scale_permille: 700,
      speed_scale_permille: 1100,
      damage: 1,
      bounces: 2,
      restitution_permille: 700,
      friction_permille: 200,
    },
  ],
  aim: { trajectory_preview: { enabled: false, dots: 0, tick_step: 3 } },
  rounds: [
    {
      id: 'ronda-caja',
      shots: 6,
      max_ticks: 420,
      target_speed_permille: 1000,
      targets: [
        {
          id: 'meta-ahorro',
          role: 'correct',
          shape: 'box',
          x: 620,
          y: 380,
          w: 90,
          h: 80,
          hp: 2,
          value: 12,
          motion: 'static',
          icon: 'savings',
        },
        {
          id: 'fondo',
          role: 'correct',
          shape: 'circle',
          x: 780,
          y: 300,
          w: 80,
          h: 80,
          hp: 1,
          value: 15,
          motion: 'static',
          icon: 'shield',
        },
        {
          id: 'impulso',
          role: 'incorrect',
          shape: 'box',
          x: 300,
          y: 400,
          w: 70,
          h: 60,
          hp: 1,
          value: 5,
          motion: 'static',
          icon: 'shopping_bag',
        },
      ],
      obstacles: [
        {
          id: 'caja',
          x: 470,
          y: 390,
          w: 60,
          h: 80,
          material: 'breakable',
          hp: 2,
          restitution_permille: 300,
          friction_permille: 400,
          chain: true,
          icon: 'inventory_2',
        },
      ],
    },
    {
      id: 'ronda-viento',
      shots: 6,
      max_ticks: 450,
      target_speed_permille: 1500,
      environment: { wind_x: 0.4, wind_gust: 0.2, ground_friction_permille: 200 },
      targets: [
        {
          id: 'plan',
          role: 'correct',
          shape: 'box',
          x: 560,
          y: 360,
          w: 90,
          h: 90,
          hp: 1,
          value: 12,
          motion: 'erratic',
          axis: 'x',
          amplitude: 40,
          period_ticks: 40,
          icon: 'checklist',
        },
        {
          id: 'colchon',
          role: 'correct',
          shape: 'box',
          x: 730,
          y: 390,
          w: 80,
          h: 80,
          hp: 1,
          value: 15,
          motion: 'static',
          icon: 'shield',
        },
        {
          id: 'deuda',
          role: 'incorrect',
          shape: 'box',
          x: 280,
          y: 390,
          w: 80,
          h: 80,
          hp: 1,
          value: 5,
          motion: 'static',
          icon: 'credit_card_off',
        },
      ],
      obstacles: [
        {
          id: 'muro',
          x: 430,
          y: 250,
          w: 30,
          h: 220,
          material: 'deflect',
          restitution_permille: 600,
          friction_permille: 300,
          chain: false,
          icon: 'fence',
        },
      ],
    },
  ],
  scoring: {
    accuracy_weight: 1,
    points_weight: 1,
    leftover_weight: 0.5,
    bounce_weight: 0.2,
    hit_points: 10,
    points_target: 90,
    bounce_target: 2,
    wrong_penalty_pct: 8,
    miss_penalty_pct: 5,
    lives_cost_on_wrong: true,
    combo: { step: 2, max: 4 },
  },
  max_ticks: 1200,
}

const BUDGET_CONTENT: LauncherContent = {
  items: [
    { id: 'billete-50', label_md: 'Billete de 50', icon: 'payments', value: 50, tier: 2 },
    { id: 'moneda-5', label_md: 'Moneda de 5', icon: 'paid', value: 5, tier: 1 },
    {
      id: 'meta-ahorro',
      label_md: 'Meta de ahorro',
      icon: 'savings',
      value: 0,
      tier: 2,
      category: 'plan',
    },
    {
      id: 'fondo-emergencia',
      label_md: 'Fondo para imprevistos',
      icon: 'shield',
      value: 0,
      tier: 2,
      category: 'plan',
    },
    {
      id: 'compra-impulsiva',
      label_md: 'Compra impulsiva',
      icon: 'shopping_bag',
      value: 350,
      tier: 2,
      category: 'fuga',
      misconception_md:
        'Comprar sin pensarlo se siente bien un rato, pero ese dinero ya no esta cuando llega lo importante.',
    },
    {
      id: 'deuda-cara',
      label_md: 'Pagar a meses con intereses',
      icon: 'credit_card_off',
      value: 500,
      tier: 3,
      category: 'fuga',
      misconception_md:
        'Los meses "sin intereses" no siempre lo son: si pagas de mas cada mes, terminas dando mas dinero por lo mismo.',
    },
  ],
  categories: [
    { id: 'plan', label_md: 'Plan', description_md: 'Lo que decides antes de gastar.' },
    { id: 'fuga', label_md: 'Fuga', description_md: 'Lo que se lleva el dinero sin avisar.' },
  ],
  interludes: [
    {
      id: 'pausa-presupuesto',
      after_round: 1,
      kind: 'pick_one',
      prompt_md: 'Que va primero en un presupuesto?',
      options: [
        {
          id: 'op-plan',
          label_md: 'Apartar el ahorro',
          correct: true,
          rationale_md: 'Si apartas primero, lo demas se acomoda con lo que queda.',
        },
        { id: 'op-gasto', label_md: 'Gastar y ver que sobra', correct: false },
      ],
    },
  ],
  feedback: {
    correct_md: ['Al plan.', 'Tu fondo crece.', 'Buen tiro: eso estaba presupuestado.'],
    incorrect_md: ['Esa era una fuga, ajusta el tiro.', 'Casi: apunta al plan.'],
    results_md: 'Apuntaste al plan y esquivaste las fugas, incluso con viento en contra.',
  },
  roles: {
    correct: ['meta-ahorro', 'fondo-emergencia'],
    incorrect: ['compra-impulsiva', 'deuda-cara'],
  },
}

const BUDGET_SHOT: GameDocument = {
  schema_version: 1,
  meta: {
    slug: 'presupuesto-a-distancia',
    title: 'Presupuesto a distancia',
    locale: 'es-MX',
    mechanic: 'launcher',
    concept: {
      topic_path: 'presupuesto/planear-el-gasto/apartar-primero',
      recap_md:
        'Aprendiste que un **presupuesto** decide a donde va el dinero **antes** de gastarlo: primero apartas el ahorro y el fondo para imprevistos, y despues gastas lo que queda. Apunta al plan y deja pasar las fugas.',
    },
    tier: 2,
    estimated_minutes: 3,
    cast: ['liruf', 'zara'],
  },
  skin: {
    palette: 'sunset-papaya',
    sprites: {},
    sfx: { launch: 'launch', impact: 'impact', explode: 'explode', win: 'celebration' },
  },
  config: BUDGET_CONFIG,
  content: BUDGET_CONTENT,
  scoring: { mode: 'arcade', xp_max: 20, pass_score: 65, lives: 3, target: 4 },
  adaptive: { enabled: true, ease_after_failures: 2, ease_factor: 0.8, assist_toggleable: true },
}

export const launcherFixtures: GameDocument[] = [SAVE_SHOT, BUDGET_SHOT]
