// Flyer — complete, PLAYABLE es-MX manifests (GAME_ENGINE.md §7).
//
// These are not test stubs: each one satisfies the PRODUCTION schemas (§1.14 forbids
// relaxing a schema for a fixture), each one is winnable by the `perfect` bot and not by
// the `random` bot (`flyer.test.ts` asserts both), and each one carries real
// financial-literacy content for its tier. There is no child PII here and there never
// can be: a game is generated from curriculum, not from a child (§11).
//
// `skin.sprites` is deliberately EMPTY. Sprite URLs are Prism/Depot artifacts produced
// by the `illustrate` stage; inventing one here would be a fabricated asset. The view
// falls back to palette-tinted shapes plus each item's Material Symbols `icon`, which is
// the same path a document takes before illustration.
//
// The two manifests deliberately sit at opposite ends of the config surface, so the
// "one mechanic, many games" claim is exercised rather than asserted:
//   1. `vuelo-de-la-alcancia` — tier 1, cheer mode, arcade flight model (low inertia),
//      no lanes, no armament, no enemies. Pure energy economy: climb costs, glide and
//      thermals pay.
//   2. `escuadron-del-presupuesto` — tier 2, arcade mode with lives, a heavier flight
//      model, two lanes with a crosswind, the full armament (beam + projectiles + body
//      slam), three enemy types including a phased boss, storms with rain that douses
//      the beam, and an upgrades block.

import type { GameDocument } from '@/game-engine/core/types'

import type { FlyerConfig, FlyerContent } from './schema'

// ---- Fixture 1 — tier 1, cheer mode, no combat -----------------------------------------
//
// "Vuelo de la alcancia": fly the savings route, pass through the coins that go into the
// piggy bank, leave the impulse buys alone. The ENERGY bar is the child's own reserve:
// pulling the nose up (spending) drains it, gliding and riding a thermal (saving and
// income) fill it back. Physics: thrust 0.7 against drag 0.05 settles at 14 units/tick;
// a 26-degree climb bleeds 1.6*sin(26)=0.70 per tick, so a sustained climb decays toward
// the 4.5 stall speed in about fifteen ticks — one command is safe, two back-to-back are
// not, which is exactly the decision the mechanic is about.

const PIGGY_CONFIG: FlyerConfig = {
  world: {
    width: 900,
    height: 540,
    avatar_x: 150,
    mount_w: 64,
    mount_h: 44,
    ceiling_y: 40,
    floor_y: 480,
  },
  mount: {
    top_speed: 14,
    min_speed: 3,
    start_speed: 10,
    thrust_per_tick: 0.7,
    drag_per_tick: 0.05,
    turn_rate_deg: 9,
    hull: 5,
    armour: 0,
    hit_grace_ticks: 12,
  },
  flight: {
    climb_pitch_deg: 26,
    dive_pitch_deg: -26,
    command_ticks: 12,
    // Tier 1 flies ARCADE: the nose returns to level almost on its own, so a 6-year-old
    // is never fighting drift on top of everything else.
    inertia: 0.3,
    lift_per_tick: 1.4,
    climb_speed_cost: 1.6,
    dive_speed_gain: 1.6,
    stall: {
      speed: 4.5,
      recover_speed: 6.5,
      pitch_deg: -30,
      sink_per_tick: 3,
      control_lockout_ticks: 8,
    },
  },
  energy: {
    capacity: 110,
    start: 110,
    glide_band_deg: 8,
    climb_drain_per_tick: 0.9,
    glide_regen_per_tick: 1.6,
    level_regen_per_tick: 0.8,
    manoeuvre_cost: 2,
    thermal_regen_per_tick: 3,
    low_threshold: 35,
  },
  armament: {
    // Tier 1 carries no weapons at all. The blocks still exist because the SHAPE is the
    // contract; `enabled: false` is how a manifest says "this game is not about that".
    beam: { enabled: false, damage_per_tick: 0, range_units: 200, width_units: 60, drain_per_tick: 0 },
    projectile: {
      enabled: false,
      damage: 0,
      speed_per_tick: 20,
      cooldown_ticks: 20,
      energy_cost: 0,
      range_units: 400,
      w: 12,
      h: 8,
    },
    slam: { enabled: false, damage: 0, self_damage: 0, min_speed: 60, energy_cost: 0 },
  },
  enemies: [],
  environment: {
    thermal: { lift_per_tick: 2.2 },
    storm: { visibility_pct: 55, turbulence_deg: 4, drain_per_tick: 0.4 },
    obstacle: { damage: 1 },
  },
  weather: {
    turbulence_deg: 1.2,
    crosswind_per_tick: 0,
    rain: { enabled: false, douses: 'none', effectiveness_pct: 100 },
  },
  lanes: { enabled: false, count: 1, spacing_units: 100, shift_ticks: 6, hit_band: 0.4, energy_cost: 0 },
  upgrades: {
    turn_speed_bonus_deg: 0,
    energy_capacity_bonus: 0,
    attack_element: 'none',
    element_multiplier: 1,
    armour_bonus: 0,
    damage_bonus_pct: 0,
  },
  spawn: {
    lead_units: 220,
    min_gap_units: 160,
    max_gap_units: 260,
    patterns: [
      {
        id: 'ruta-alta',
        weight: 5,
        length_units: 380,
        elements: [
          { role: 'good', dx: 0, y: 150, w: 46, h: 46, lane: 0 },
          { role: 'good', dx: 130, y: 150, w: 46, h: 46, lane: 0 },
          { role: 'obstacle', dx: 260, y: 330, w: 40, h: 130, lane: 0 },
        ],
      },
      {
        id: 'ruta-baja',
        weight: 5,
        length_units: 380,
        elements: [
          { role: 'good', dx: 0, y: 320, w: 46, h: 46, lane: 0 },
          { role: 'good', dx: 130, y: 320, w: 46, h: 46, lane: 0 },
          { role: 'obstacle', dx: 260, y: 90, w: 40, h: 130, lane: 0 },
        ],
      },
      {
        id: 'termica-domingo',
        weight: 4,
        length_units: 320,
        elements: [
          { role: 'thermal', dx: 0, y: 120, w: 200, h: 320, lane: 0 },
          { role: 'good', dx: 70, y: 240, w: 46, h: 46, lane: 0 },
        ],
      },
      {
        id: 'antojo',
        weight: 3,
        length_units: 340,
        elements: [
          { role: 'bad', dx: 0, y: 230, w: 50, h: 50, lane: 0 },
          { role: 'good', dx: 200, y: 140, w: 46, h: 46, lane: 0 },
        ],
      },
      {
        id: 'mes-dificil',
        weight: 3,
        length_units: 460,
        min_distance_units: 2200,
        elements: [
          { role: 'storm', dx: 0, y: 60, w: 380, h: 400, lane: 0 },
          { role: 'good', dx: 170, y: 260, w: 46, h: 46, lane: 0 },
        ],
      },
    ],
  },
  scoring: {
    // Distance is deliberately the SMALLEST share: the sky scrolls whether or not the
    // child plays well, so paying much for it would let doing nothing look like skill.
    distance_weight: 0.15,
    collect_weight: 0.6,
    combat_weight: 0,
    energy_weight: 0.25,
    collect_points: 10,
    collect_target: 220,
    combat_target: 1,
    energy_budget: 900,
    wrong_penalty_pct: 5,
    hit_penalty_pct: 4,
    stall_penalty_pct: 4,
    combo: { step: 4, max: 2 },
  },
  target_distance: 6000,
  max_ticks: 720,
}

const PIGGY_CONTENT: FlyerContent = {
  items: [
    { id: 'moneda-guardada', label_md: 'Moneda para la alcancia', category: 'ahorro', icon: 'savings', value: 5, tier: 1 },
    { id: 'domingo', label_md: 'Tu domingo', category: 'ahorro', icon: 'payments', value: 20, tier: 1 },
    { id: 'meta-bici', label_md: 'Meta: la bici', category: 'ahorro', icon: 'flag', value: 60, tier: 2 },
    {
      id: 'antojo-tienda',
      label_md: 'Antojo de la tienda',
      category: 'gasto',
      icon: 'storefront',
      value: 12,
      tier: 1,
      misconception_md:
        'Se ve chiquito, pero cada antojo sale de la misma alcancia que guarda tu meta.',
    },
    {
      id: 'sticker-repetido',
      label_md: 'Sticker repetido',
      category: 'gasto',
      icon: 'label',
      value: 8,
      tier: 1,
      misconception_md: 'Ya tienes uno igual: pagarlo otra vez no te acerca a tu meta.',
    },
  ],
  categories: [
    { id: 'ahorro', label_md: 'Ahorro', description_md: 'Lo que se queda en tu alcancia.' },
    { id: 'gasto', label_md: 'Gasto', description_md: 'Lo que sale de tu alcancia hoy mismo.' },
  ],
  feedback: {
    correct_md: ['Esa moneda ya es tuya.', 'Tu alcancia sube.', 'Vas derecho a tu meta.'],
    incorrect_md: ['Ese era un antojo, sigue volando.', 'Casi: ese puede esperar.'],
    results_md:
      'Volaste guardando monedas y descansando en las termicas. Subir cuesta energia; planear cuesta menos.',
  },
  roles: {
    collect: ['moneda-guardada', 'domingo', 'meta-bici'],
    avoid: ['antojo-tienda', 'sticker-repetido'],
  },
}

const PIGGY_FLIGHT: GameDocument = {
  schema_version: 1,
  meta: {
    slug: 'vuelo-de-la-alcancia',
    title: 'Vuelo de la alcancia',
    locale: 'es-MX',
    mechanic: 'flyer',
    concept: {
      topic_path: 'ahorro/primeras-monedas/guardar-o-gastar',
      recap_md:
        'Aprendiste que **guardar** una moneda hoy te acerca a tu meta y que un **antojo** la aleja. Aqui tu energia es tu alcancia: subir gasta, planear y descansar en las corrientes de aire recupera.',
    },
    tier: 1,
    estimated_minutes: 3,
    cast: ['dina'],
  },
  skin: {
    palette: 'ocean-blue',
    sprites: {},
    sfx: { collect: 'collect', hit: 'impact', climb: 'whoosh', thermal: 'powerup', win: 'celebration' },
  },
  config: PIGGY_CONFIG,
  content: PIGGY_CONTENT,
  scoring: { mode: 'cheer', xp_max: 10, pass_score: 62, lives: null, target: 6000 },
}

// ---- Fixture 2 — tier 2, arcade mode, lanes + full armament -------------------------------
//
// "Escuadron del presupuesto": the same simulator with a heavier flight model, two lanes
// under a crosswind, a beam and a projectile on a cooldown, a body slam that costs hull,
// three enemy types (a fast pursuer, a slow armoured one that shoots from a stand-off,
// and a phased boss) and storms whose rain douses the beam. Every one of those is a
// manifest field, not a second codebase.

const BUDGET_CONFIG: FlyerConfig = {
  world: {
    width: 960,
    height: 560,
    avatar_x: 160,
    mount_w: 66,
    mount_h: 46,
    ceiling_y: 40,
    floor_y: 500,
  },
  mount: {
    top_speed: 15,
    min_speed: 3.5,
    start_speed: 11,
    thrust_per_tick: 0.75,
    drag_per_tick: 0.05,
    turn_rate_deg: 8,
    hull: 6,
    armour: 0,
    hit_grace_ticks: 14,
  },
  flight: {
    climb_pitch_deg: 24,
    dive_pitch_deg: -24,
    command_ticks: 12,
    // Dialled toward SIMULATION: the nose keeps a third of its attitude after the
    // command expires, so tier 2 has to fly the aircraft back to level.
    inertia: 0.35,
    lift_per_tick: 1.4,
    climb_speed_cost: 1.7,
    dive_speed_gain: 1.7,
    stall: {
      speed: 5,
      recover_speed: 7,
      pitch_deg: -30,
      sink_per_tick: 3,
      control_lockout_ticks: 8,
    },
  },
  energy: {
    capacity: 130,
    start: 130,
    glide_band_deg: 8,
    climb_drain_per_tick: 1,
    glide_regen_per_tick: 1.6,
    level_regen_per_tick: 0.8,
    manoeuvre_cost: 2,
    thermal_regen_per_tick: 3.2,
    low_threshold: 45,
  },
  armament: {
    beam: {
      enabled: true,
      damage_per_tick: 1.6,
      range_units: 300,
      width_units: 90,
      drain_per_tick: 1.5,
    },
    projectile: {
      enabled: true,
      damage: 12,
      speed_per_tick: 34,
      cooldown_ticks: 14,
      energy_cost: 4,
      range_units: 620,
      w: 18,
      h: 10,
    },
    // The ram costs 5 hull against an armour of 1, so four rams is the whole hull: it is
    // a real decision, not a free extra weapon.
    slam: { enabled: true, damage: 10, self_damage: 5, min_speed: 11, energy_cost: 6 },
  },
  enemies: [
    {
      id: 'cobro-sorpresa',
      item_id: 'cobro-sorpresa',
      hp: 18,
      armour: 0,
      pattern: 'pursuit',
      contact_damage: 2,
      points: 30,
      w: 48,
      h: 44,
      weak_to: 'spark',
      fire: { enabled: false, cooldown_ticks: 40, damage: 1, speed_per_tick: 20, range_units: 400, w: 10, h: 8 },
      pursuit: { climb_per_tick: 2.2, close_per_tick: 3.5 },
      boss: false,
    },
    {
      id: 'nube-deuda',
      item_id: 'nube-deuda',
      hp: 40,
      armour: 3,
      pattern: 'retreat',
      contact_damage: 3,
      points: 45,
      w: 70,
      h: 60,
      fire: { enabled: true, cooldown_ticks: 46, damage: 2, speed_per_tick: 16, range_units: 460, w: 14, h: 10 },
      retreat: { keep_distance_units: 340, adjust_per_tick: 2.2 },
      boss: false,
    },
    {
      id: 'jefe-interes',
      item_id: 'jefe-interes',
      hp: 120,
      armour: 2,
      pattern: 'boss',
      contact_damage: 4,
      points: 160,
      w: 96,
      h: 84,
      weak_to: 'spark',
      fire: { enabled: true, cooldown_ticks: 40, damage: 2, speed_per_tick: 18, range_units: 520, w: 16, h: 12 },
      orbit: { radius_units: 90, degrees_per_tick: 4, drift_per_tick: 1.2 },
      pursuit: { climb_per_tick: 1.6, close_per_tick: 2.2 },
      retreat: { keep_distance_units: 380, adjust_per_tick: 1.8 },
      phases: [
        { from_hp_pct: 100, pattern: 'retreat', speed_multiplier: 1, fire_cooldown_multiplier: 1 },
        { from_hp_pct: 60, pattern: 'circle', speed_multiplier: 1.2, fire_cooldown_multiplier: 0.8 },
        { from_hp_pct: 25, pattern: 'pursuit', speed_multiplier: 1.5, fire_cooldown_multiplier: 0.6 },
      ],
      boss: true,
    },
  ],
  environment: {
    thermal: { lift_per_tick: 2.2 },
    storm: { visibility_pct: 45, turbulence_deg: 5, drain_per_tick: 0.5 },
    obstacle: { damage: 2 },
  },
  weather: {
    turbulence_deg: 1.2,
    // A steady push toward the outer lane: the yaw axis is something to hold, not a
    // switch to flip.
    crosswind_per_tick: 0.012,
    rain: { enabled: true, douses: 'beam', effectiveness_pct: 40 },
  },
  lanes: { enabled: true, count: 2, spacing_units: 120, shift_ticks: 6, hit_band: 0.45, energy_cost: 3 },
  upgrades: {
    turn_speed_bonus_deg: 2,
    energy_capacity_bonus: 20,
    attack_element: 'spark',
    element_multiplier: 1.5,
    armour_bonus: 1,
    damage_bonus_pct: 20,
  },
  spawn: {
    lead_units: 240,
    min_gap_units: 180,
    max_gap_units: 300,
    patterns: [
      {
        id: 'ingreso-alto',
        weight: 5,
        length_units: 400,
        elements: [
          { role: 'good', dx: 0, y: 140, w: 46, h: 46, lane: 0 },
          { role: 'good', dx: 140, y: 140, w: 46, h: 46, lane: 0 },
          { role: 'obstacle', dx: 270, y: 330, w: 40, h: 140, lane: 0 },
        ],
      },
      {
        id: 'ingreso-bajo',
        weight: 5,
        length_units: 400,
        elements: [
          { role: 'good', dx: 0, y: 320, w: 46, h: 46, lane: 0 },
          { role: 'good', dx: 140, y: 320, w: 46, h: 46, lane: 0 },
          { role: 'obstacle', dx: 270, y: 90, w: 40, h: 140, lane: 0 },
        ],
      },
      {
        id: 'termica-quincena',
        weight: 4,
        length_units: 320,
        elements: [
          { role: 'thermal', dx: 0, y: 120, w: 200, h: 340, lane: 0 },
          { role: 'good', dx: 70, y: 250, w: 46, h: 46, lane: 0 },
        ],
      },
      {
        id: 'gasto-hormiga',
        weight: 3,
        length_units: 360,
        elements: [
          { role: 'bad', dx: 0, y: 230, w: 50, h: 50, lane: 0 },
          { role: 'good', dx: 210, y: 150, w: 46, h: 46, lane: 0 },
        ],
      },
      {
        id: 'carril-seguro',
        weight: 3,
        length_units: 380,
        elements: [
          { role: 'obstacle', dx: 0, y: 200, w: 44, h: 160, lane: 0 },
          { role: 'good', dx: 60, y: 250, w: 46, h: 46, lane: 1 },
          { role: 'good', dx: 210, y: 250, w: 46, h: 46, lane: 1 },
        ],
      },
      {
        id: 'cobro-sorpresa',
        weight: 3,
        length_units: 400,
        min_distance_units: 1400,
        elements: [
          { role: 'enemy', dx: 0, y: 200, w: 48, h: 44, lane: 0, enemy_type: 'cobro-sorpresa' },
          { role: 'good', dx: 250, y: 300, w: 46, h: 46, lane: 0 },
        ],
      },
      {
        id: 'nube-de-deuda',
        weight: 2,
        length_units: 440,
        min_distance_units: 2600,
        elements: [
          { role: 'enemy', dx: 0, y: 180, w: 70, h: 60, lane: 0, enemy_type: 'nube-deuda' },
          { role: 'good', dx: 280, y: 330, w: 46, h: 46, lane: 0 },
        ],
      },
      {
        id: 'tormenta-de-recibos',
        weight: 2,
        length_units: 460,
        min_distance_units: 3400,
        elements: [
          { role: 'storm', dx: 0, y: 60, w: 400, h: 420, lane: 0 },
          { role: 'good', dx: 180, y: 260, w: 46, h: 46, lane: 0 },
        ],
      },
      {
        id: 'jefe-del-interes',
        weight: 2,
        length_units: 520,
        min_distance_units: 4600,
        elements: [
          { role: 'enemy', dx: 0, y: 210, w: 96, h: 84, lane: 0, enemy_type: 'jefe-interes' },
          { role: 'good', dx: 330, y: 150, w: 46, h: 46, lane: 0 },
        ],
      },
    ],
  },
  scoring: {
    distance_weight: 0.15,
    collect_weight: 0.5,
    combat_weight: 0.1,
    energy_weight: 0.25,
    collect_points: 12,
    collect_target: 280,
    combat_target: 60,
    energy_budget: 1400,
    wrong_penalty_pct: 5,
    hit_penalty_pct: 4,
    stall_penalty_pct: 4,
    combo: { step: 5, max: 2 },
  },
  target_distance: 6500,
  max_ticks: 760,
}

const BUDGET_CONTENT: FlyerContent = {
  items: [
    { id: 'ingreso-quincena', label_md: 'Ingreso de la quincena', category: 'ingreso', icon: 'payments', value: 500, tier: 2 },
    { id: 'gasto-fijo', label_md: 'Gasto fijo previsto', category: 'ingreso', icon: 'event_repeat', value: 120, tier: 2 },
    { id: 'fondo-emergencia', label_md: 'Fondo de emergencia', category: 'ingreso', icon: 'shield', value: 200, tier: 3 },
    {
      id: 'compra-impulso',
      label_md: 'Compra de impulso',
      category: 'fuga',
      icon: 'shopping_bag',
      value: 180,
      tier: 2,
      misconception_md:
        'No estaba en el presupuesto: lo que no planeaste sale del dinero que ya tenia trabajo.',
    },
    {
      id: 'pago-tarde',
      label_md: 'Pago fuera de tiempo',
      category: 'fuga',
      icon: 'schedule',
      value: 90,
      tier: 3,
      misconception_md: 'Pagar tarde agrega recargos: el mismo gasto termina costando mas.',
    },
    { id: 'cobro-sorpresa', label_md: 'Cobro sorpresa', category: 'fuga', icon: 'bolt', value: 150, tier: 2 },
    { id: 'nube-deuda', label_md: 'Nube de deuda', category: 'fuga', icon: 'cloud', value: 400, tier: 3 },
    { id: 'jefe-interes', label_md: 'El interes que crece', category: 'fuga', icon: 'trending_up', value: 900, tier: 3 },
  ],
  categories: [
    { id: 'ingreso', label_md: 'Presupuesto', description_md: 'Dinero con un trabajo asignado.' },
    { id: 'fuga', label_md: 'Fuga', description_md: 'Lo que se lleva el dinero sin permiso.' },
  ],
  interludes: [
    {
      id: 'pausa-presupuesto',
      after_round: 2,
      kind: 'pick_one',
      prompt_md: 'Que hace primero un presupuesto?',
      options: [
        {
          id: 'op-asignar',
          label_md: 'Darle un trabajo a cada peso',
          correct: true,
          rationale_md: 'Un presupuesto reparte el dinero antes de gastarlo, por eso alcanza.',
        },
        { id: 'op-prohibir', label_md: 'Prohibir todos los gastos', correct: false },
      ],
    },
  ],
  feedback: {
    correct_md: ['Ese peso ya tiene trabajo.', 'Presupuesto en orden.', 'Buen vuelo, buen plan.'],
    incorrect_md: ['Esa era una fuga, sigue el plan.', 'Casi: eso no estaba presupuestado.'],
    results_md:
      'Volaste con plan: juntaste tu presupuesto, bajaste los cobros sorpresa y cuidaste la energia.',
  },
  roles: {
    collect: ['ingreso-quincena', 'gasto-fijo', 'fondo-emergencia'],
    avoid: ['compra-impulso', 'pago-tarde'],
  },
}

const BUDGET_FLIGHT: GameDocument = {
  schema_version: 1,
  meta: {
    slug: 'escuadron-del-presupuesto',
    title: 'Escuadron del presupuesto',
    locale: 'es-MX',
    mechanic: 'flyer',
    concept: {
      topic_path: 'presupuesto/ingresos-y-gastos/presupuesto-mensual',
      recap_md:
        'Aprendiste que un **presupuesto** le da un trabajo a cada peso antes de gastarlo. Vuela tu ruta: junta lo presupuestado, esquiva las fugas y baja los cobros sorpresa sin quedarte sin energia.',
    },
    tier: 2,
    estimated_minutes: 4,
    cast: ['liruf', 'zara'],
  },
  skin: {
    palette: 'violet-night',
    sprites: {},
    sfx: {
      collect: 'collect',
      hit: 'impact',
      fire: 'launch',
      beam: 'engine',
      thermal: 'powerup',
      storm: 'alarm',
      win: 'celebration',
    },
  },
  config: BUDGET_CONFIG,
  content: BUDGET_CONTENT,
  scoring: { mode: 'arcade', xp_max: 20, pass_score: 62, lives: 3, target: 6500 },
  adaptive: { enabled: true, ease_after_failures: 2, ease_factor: 0.8, assist_toggleable: true },
}

export const flyerFixtures: GameDocument[] = [PIGGY_FLIGHT, BUDGET_FLIGHT]
