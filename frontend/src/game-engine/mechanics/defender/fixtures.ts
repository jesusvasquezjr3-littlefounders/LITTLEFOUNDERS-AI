// `defender` fixtures — two complete, PLAYABLE es-MX manifests (GAME_ENGINE.md §7).
//
// They are not demo scaffolding. They are the reference answer to "what does a
// well-tuned defender document look like", they are what `/dev/game-lab` loads, and
// `defender.test.ts` asserts that the PERFECT bot reaches `pass_score` on each one while
// the RANDOM bot does not — the same §9 winnability gate the Arcade pipeline runs before
// a generated document may be published.
//
// Deliberately opposite ends of the dial:
//
//   1. "Cuida tu alcancía" — tier 1, CHEER (no fail state), a fixed road with dead-end
//      build pockets, three waves, three tower types one of which is a TRAP purchase
//      (expensive, slow, and carrying the misconception that explains why). Towers never
//      block the path, so a six-year-old cannot accidentally break their own board.
//   2. "El laberinto del presupuesto" — tier 3, ARCADE with five lives, an open field
//      whose ONE corridor is a single cell wide (so the seal rule genuinely bites), all
//      eight tower archetypes, mutually exclusive upgrade branches, flying / stealth /
//      sapper / splitter / healer / shielded enemies and a phased boss, a secondary
//      currency with two global abilities, and two voluntary heat modifiers.
//
// THE LESSON IS THE ECONOMY. Both manifests pay interest on the gold still in hand at a
// wave clear and score the surplus at the end, so a player who spends every coin the
// moment they have it finishes below one who saves deliberately — and `results_md` says
// exactly that out loud.
//
// Content is curriculum, never a child: no names, no locations, no PII (§1.9).
// `skin.sprites` is empty on purpose — Prism fills it at illustrate time, and the view
// must be fully legible before it does.

import type { GameDocument } from '@/game-engine/core/types'

import type { DefenderConfig, DefenderContent } from './schema'

// ---- 1. Cuida tu alcancía (tier 1, cheer, fixed road) -----------------------------

/**
 * The map: one road from the entry to the alcancía, framed in rock, with twelve
 * two-cell DEAD-END pockets hanging off it. A dead end is never on a shortest path, so
 * the route is fixed and a tier-1 player cannot seal anything — while the inner pocket
 * row sits one cell from the road (inside every tower's range) and the outer row sits
 * two cells away (outside it). Where you build is already a decision.
 */
const piggyConfig: DefenderConfig = {
  grid: {
    cell_size: 56,
    map: [
      '#############',
      '#.#.#.#.#.#.#',
      '#.#.#.#.#.#.#',
      'S===========X',
      '#.#.#.#.#.#.#',
      '#.#.#.#.#.#.#',
      '#############',
    ],
  },
  step_costs: { open: 3, road: 1 },
  build: {
    wall_cost: 12,
    wall_hp: 80,
    max_walls: 4,
    sell_refund_pct: 60,
    // Tier 1: a tower is a turret beside the road, never labyrinth material.
    towers_block_path: false,
  },
  economy: {
    starting_gold: 70,
    wave_clear_bonus: 30,
    interest_pct: 10,
    interest_cap: 40,
    early_call_bonus_gold: 6,
    hp_growth_pct_per_wave: 125,
    gold_growth_pct_per_wave: 110,
  },
  // One resistance row, so "some things cost more to stop" is on the board from the
  // first game a child plays.
  damage_matrix: [{ damage: 'impact', armor: 'light', multiplier_pct: 50 }],
  default_multiplier_pct: 100,
  slow: { diminishing_pct: 50, max_slow_pct: 70 },
  enemies: [
    {
      id: 'gasto-hormiga',
      item_id: 'gasto-hormiga',
      hp: 26,
      armor: 'unarmored',
      speed_mcells: 90,
      bounty: 7,
      lives_cost: 1,
      sprite_slot: 'enemy_1',
    },
    {
      id: 'antojo-grande',
      item_id: 'antojo-grande',
      hp: 45,
      armor: 'light',
      speed_mcells: 65,
      bounty: 12,
      lives_cost: 1,
      sprite_slot: 'enemy_2',
    },
  ],
  towers: [
    {
      id: 'torre-ahorro',
      item_id: 'torre-ahorro',
      archetype: 'single',
      cost: 25,
      range_mcells: 1800,
      fire_interval_ticks: 8,
      damage: 12,
      damage_type: 'impact',
      targets_air: false,
      targets_ground: true,
      blocks_path: false,
      default_priority: 'first',
      sprite_slot: 'tower_single',
    },
    {
      id: 'alcancia',
      item_id: 'alcancia',
      archetype: 'economy',
      cost: 30,
      range_mcells: 0,
      fire_interval_ticks: 1,
      damage: 0,
      damage_type: 'impact',
      targets_air: false,
      targets_ground: false,
      income_per_wave: 20,
      blocks_path: false,
      default_priority: 'first',
      sprite_slot: 'tower_economy',
    },
    {
      // THE TRAP. Three times the price for barely more damage, three times as slowly:
      // buying it is the opportunity cost the lesson is about, and the catalog item
      // carries the misconception that names it.
      id: 'torre-brillante',
      item_id: 'torre-brillante',
      archetype: 'single',
      cost: 85,
      range_mcells: 1900,
      fire_interval_ticks: 22,
      damage: 14,
      damage_type: 'impact',
      targets_air: false,
      targets_ground: true,
      blocks_path: false,
      default_priority: 'first',
      sprite_slot: 'tower_single',
    },
  ],
  waves: [
    {
      id: 'primera-tanda',
      groups: [{ enemy: 'gasto-hormiga', count: 6, interval_ticks: 26, start_tick: 0, entry: 0 }],
      bonus_gold: 20,
    },
    {
      id: 'segunda-tanda',
      groups: [
        { enemy: 'gasto-hormiga', count: 8, interval_ticks: 22, start_tick: 0, entry: 0 },
        { enemy: 'antojo-grande', count: 3, interval_ticks: 34, start_tick: 60, entry: 0 },
      ],
      bonus_gold: 30,
    },
    {
      id: 'tanda-final',
      groups: [
        { enemy: 'gasto-hormiga', count: 10, interval_ticks: 18, start_tick: 0, entry: 0 },
        { enemy: 'antojo-grande', count: 5, interval_ticks: 26, start_tick: 40, entry: 0 },
      ],
      bonus_gold: 40,
    },
  ],
  prep_ticks: 50,
  efficiency: { wall_budget: 4, gold_surplus_target: 120 },
  score_weights: { defense: 0.5, leak_free: 0.2, economy: 0.2, walls: 0.1 },
  leak_penalty_pct: 2,
  tick_budget: 2200,
}

const piggyContent: DefenderContent = {
  items: [
    {
      id: 'gasto-hormiga',
      label_md: 'Gasto hormiga',
      icon: 'pest_control',
      tier: 1,
      image_slot: 'enemy_1',
      props: { costo: 7 },
    },
    {
      id: 'antojo-grande',
      label_md: 'Antojo grande',
      icon: 'icecream',
      tier: 2,
      image_slot: 'enemy_2',
      props: { costo: 12 },
    },
    {
      id: 'torre-ahorro',
      label_md: 'Torre Ahorro',
      icon: 'savings',
      tier: 1,
      image_slot: 'tower_single',
      props: { precio: 25 },
    },
    {
      id: 'alcancia',
      label_md: 'Alcancía que rinde',
      icon: 'account_balance',
      tier: 2,
      image_slot: 'tower_economy',
      props: { precio: 30 },
    },
    {
      id: 'torre-brillante',
      label_md: 'Torre Brillante',
      icon: 'auto_awesome',
      tier: 3,
      image_slot: 'tower_single',
      props: { precio: 85, trap: 1 },
      misconception_md:
        'Cuesta más del triple y dispara mucho más lento: se ve increíble, pero con ese dinero compras tres Torres Ahorro.',
    },
  ],
  interludes: [
    {
      id: 'pausa-ahorro',
      after_round: 1,
      kind: 'pick_one',
      prompt_md: 'Te quedan monedas después de la primera tanda. ¿Qué te conviene más?',
      options: [
        {
          id: 'a',
          label_md: 'Gastarlas todas ya mismo',
          correct: false,
          rationale_md: 'Si gastas todo, no te queda nada para la tanda que viene, que es más grande.',
        },
        {
          id: 'b',
          label_md: 'Guardar una parte para la siguiente tanda',
          correct: true,
          rationale_md: 'Lo que guardas te da un poquito más al cerrar la tanda: ahorrar rinde.',
        },
      ],
    },
  ],
  feedback: {
    correct_md: ['¡Bien colocada!', 'Ese lugar sí cubre el camino.', '¡Tu alcancía está segura!'],
    incorrect_md: [
      'Casi. Prueba una torre más cerca del camino.',
      'Otra vuelta: ¿esa torre alcanza a los gastos?',
    ],
    results_md:
      'Guardar una parte de tus monedas te dejó más torres al final que gastarlas todas de golpe.',
  },
}

const piggyGuard: GameDocument = {
  schema_version: 1,
  meta: {
    slug: 'cuida-tu-alcancia',
    title: 'Cuida tu alcancía',
    locale: 'es-MX',
    mechanic: 'defender',
    concept: {
      topic_path: 'mi-primer-dinero/cuidar-lo-que-tengo/gastos-hormiga',
      recap_md:
        'Aprendiste que los **gastos hormiga** son chiquitos pero llegan muchos, y que guardar una parte de tu dinero te deja listo para lo que viene.',
    },
    tier: 1,
    estimated_minutes: 3,
    cast: ['dina'],
  },
  skin: {
    palette: 'forest-pear',
    sprites: {},
    sfx: { build: 'drop', kill: 'match', leak: 'tryagain', wave: 'streak', win: 'celebration' },
  },
  config: piggyConfig,
  content: piggyContent,
  scoring: { mode: 'cheer', xp_max: 10, pass_score: 60, lives: null, target: 32 },
}

// ---- 2. El laberinto del presupuesto (tier 3, arcade, maze) ------------------------

/**
 * The map: two open chambers joined by a SINGLE open cell. Every tower here blocks the
 * ground path, so the chambers are labyrinth material — and the corridor cell is the one
 * placement the seal rule must refuse, which `defender.test.ts` asserts directly.
 */
const mazeConfig: DefenderConfig = {
  grid: {
    cell_size: 48,
    map: [
      '##############',
      '#.....#......#',
      '#.....#......#',
      '#.....#......#',
      'S............X',
      '#.....#......#',
      '#.....#......#',
      '#.....#......#',
      '##############',
    ],
  },
  step_costs: { open: 2, road: 1 },
  build: {
    wall_cost: 12,
    wall_hp: 110,
    max_walls: 20,
    sell_refund_pct: 70,
    towers_block_path: true,
  },
  economy: {
    starting_gold: 130,
    wave_clear_bonus: 45,
    interest_pct: 12,
    interest_cap: 70,
    early_call_bonus_gold: 12,
    // HP outgrows gold on purpose: buying MORE of the same thing stops working, and
    // spending better — upgrades, position, the economy tower — starts mattering.
    hp_growth_pct_per_wave: 118,
    gold_growth_pct_per_wave: 106,
  },
  damage_matrix: [
    { damage: 'impact', armor: 'heavy', multiplier_pct: 200 },
    { damage: 'impact', armor: 'light', multiplier_pct: 50 },
    { damage: 'spark', armor: 'light', multiplier_pct: 200 },
    { damage: 'frost', armor: 'shielded', multiplier_pct: 200 },
    { damage: 'frost', armor: 'heavy', multiplier_pct: 50 },
    { damage: 'impact', armor: 'ethereal', multiplier_pct: 50 },
  ],
  default_multiplier_pct: 100,
  slow: { diminishing_pct: 50, max_slow_pct: 70 },
  enemies: [
    {
      id: 'gasto-chico',
      item_id: 'gasto-chico',
      hp: 55,
      armor: 'unarmored',
      speed_mcells: 175,
      bounty: 9,
      lives_cost: 1,
      sprite_slot: 'enemy_1',
    },
    {
      id: 'gasto-fijo',
      item_id: 'gasto-fijo',
      hp: 150,
      armor: 'heavy',
      speed_mcells: 115,
      bounty: 15,
      lives_cost: 1,
      sprite_slot: 'enemy_2',
    },
    {
      id: 'cargo-oculto',
      item_id: 'cargo-oculto',
      hp: 70,
      armor: 'light',
      speed_mcells: 160,
      bounty: 13,
      lives_cost: 1,
      behavior: { stealth: true },
      sprite_slot: 'enemy_3',
    },
    {
      id: 'compra-impulsiva',
      item_id: 'compra-impulsiva',
      hp: 75,
      armor: 'light',
      speed_mcells: 190,
      bounty: 12,
      lives_cost: 1,
      behavior: { flying: true },
      sprite_slot: 'enemy_4',
    },
    {
      id: 'deuda-que-crece',
      item_id: 'deuda-que-crece',
      hp: 130,
      armor: 'shielded',
      speed_mcells: 120,
      bounty: 17,
      lives_cost: 2,
      behavior: {
        shield: { amount: 50, regen_per_tick: 3, regen_delay_ticks: 40 },
        regen_per_tick: 1,
      },
      sprite_slot: 'enemy_5',
    },
    {
      id: 'promo-que-divide',
      item_id: 'promo-que-divide',
      hp: 110,
      armor: 'light',
      speed_mcells: 145,
      bounty: 14,
      lives_cost: 1,
      behavior: { split: { into: 'gasto-chico', count: 2 } },
      sprite_slot: 'enemy_6',
    },
    {
      id: 'refuerzo-marketing',
      item_id: 'refuerzo-marketing',
      hp: 100,
      armor: 'light',
      speed_mcells: 135,
      bounty: 14,
      lives_cost: 1,
      behavior: { healer: { amount: 6, radius_mcells: 2600, interval_ticks: 28 } },
      sprite_slot: 'enemy_7',
    },
    {
      id: 'barrena-descuento',
      item_id: 'barrena-descuento',
      hp: 140,
      armor: 'heavy',
      speed_mcells: 125,
      bounty: 15,
      lives_cost: 1,
      behavior: { sapper: { damage: 45, interval_ticks: 18 } },
      sprite_slot: 'enemy_8',
    },
    {
      id: 'deuda-jefe',
      item_id: 'deuda-jefe',
      hp: 620,
      armor: 'heavy',
      speed_mcells: 95,
      bounty: 70,
      lives_cost: 3,
      behavior: {
        boss_phases: [
          { below_hp_pct: 60, speed_pct: 125, damage_reduction_pct: 15 },
          { below_hp_pct: 30, speed_pct: 150, damage_reduction_pct: 30 },
        ],
      },
      sprite_slot: 'enemy_9',
    },
  ],
  towers: [
    {
      id: 'torre-presupuesto',
      item_id: 'torre-presupuesto',
      archetype: 'single',
      cost: 42,
      range_mcells: 2400,
      fire_interval_ticks: 7,
      damage: 24,
      damage_type: 'impact',
      targets_air: false,
      targets_ground: true,
      blocks_path: true,
      default_priority: 'first',
      sprite_slot: 'tower_single',
      // Two MUTUALLY EXCLUSIVE branches. Both end in a tier-3 rung that TRANSFORMS the
      // archetype, so the choice is what the tower becomes, not how big its number gets.
      upgrades: [
        {
          id: 'rama-precision',
          item_id: 'rama-precision',
          tiers: [
            { cost: 34, damage_add: 12 },
            { cost: 58, damage_add: 18, fire_interval_delta_ticks: -1 },
            {
              cost: 104,
              damage_add: 26,
              splash_add_mcells: 1200,
              transforms_to: 'area',
            },
          ],
        },
        {
          id: 'rama-alcance',
          item_id: 'rama-alcance',
          tiers: [
            { cost: 30, range_add_mcells: 600 },
            { cost: 54, range_add_mcells: 500, detects_stealth: true },
            { cost: 98, damage_add: 20, targets_air: true, transforms_to: 'antiair' },
          ],
        },
      ],
    },
    {
      id: 'torre-antena',
      item_id: 'torre-antena',
      archetype: 'antiair',
      cost: 46,
      range_mcells: 2900,
      fire_interval_ticks: 9,
      damage: 26,
      damage_type: 'spark',
      targets_air: true,
      targets_ground: false,
      blocks_path: false,
      default_priority: 'first',
      sprite_slot: 'tower_antiair',
    },
    {
      id: 'torre-lupa',
      item_id: 'torre-lupa',
      archetype: 'dot',
      cost: 36,
      range_mcells: 2300,
      fire_interval_ticks: 11,
      damage: 10,
      damage_type: 'frost',
      dot_damage: 4,
      dot_ticks: 16,
      targets_air: false,
      targets_ground: true,
      detects_stealth: true,
      blocks_path: true,
      default_priority: 'first',
      sprite_slot: 'tower_dot',
    },
    {
      id: 'torre-freno',
      item_id: 'torre-freno',
      archetype: 'slow',
      cost: 34,
      range_mcells: 2300,
      fire_interval_ticks: 6,
      damage: 4,
      damage_type: 'frost',
      slow_pct: 35,
      slow_ticks: 30,
      targets_air: false,
      targets_ground: true,
      blocks_path: true,
      default_priority: 'first',
      sprite_slot: 'tower_slow',
    },
    {
      id: 'torre-onda',
      item_id: 'torre-onda',
      archetype: 'area',
      cost: 68,
      range_mcells: 2100,
      fire_interval_ticks: 13,
      damage: 20,
      damage_type: 'spark',
      splash_mcells: 1300,
      splash_damage_pct: 60,
      targets_air: false,
      targets_ground: true,
      blocks_path: true,
      default_priority: 'strongest',
      sprite_slot: 'tower_area',
    },
    {
      id: 'torre-aliento',
      item_id: 'torre-aliento',
      archetype: 'aura',
      cost: 52,
      range_mcells: 2300,
      fire_interval_ticks: 1,
      damage: 0,
      damage_type: 'impact',
      targets_air: false,
      targets_ground: false,
      aura: { damage_bonus_pct: 25, rate_bonus_pct: 20 },
      blocks_path: false,
      default_priority: 'first',
      sprite_slot: 'tower_aura',
    },
    {
      id: 'torre-alcancia',
      item_id: 'torre-alcancia',
      archetype: 'economy',
      cost: 58,
      range_mcells: 0,
      fire_interval_ticks: 1,
      damage: 0,
      damage_type: 'impact',
      targets_air: false,
      targets_ground: false,
      income_per_wave: 38,
      blocks_path: false,
      default_priority: 'first',
      sprite_slot: 'tower_economy',
    },
    {
      id: 'torre-cepo',
      item_id: 'torre-cepo',
      archetype: 'block',
      cost: 14,
      range_mcells: 900,
      fire_interval_ticks: 10,
      damage: 9,
      damage_type: 'impact',
      targets_air: false,
      targets_ground: true,
      blocks_path: true,
      default_priority: 'nearest',
      sprite_slot: 'tower_block',
    },
  ],
  waves: [
    {
      id: 'hormigas',
      groups: [{ enemy: 'gasto-chico', count: 8, interval_ticks: 18, start_tick: 0, entry: 0 }],
      bonus_gold: 40,
    },
    {
      id: 'los-fijos',
      groups: [
        { enemy: 'gasto-chico', count: 6, interval_ticks: 16, start_tick: 0, entry: 0 },
        { enemy: 'gasto-fijo', count: 4, interval_ticks: 26, start_tick: 40, entry: 0 },
      ],
      bonus_gold: 50,
    },
    {
      id: 'letra-chiquita',
      groups: [
        { enemy: 'cargo-oculto', count: 4, interval_ticks: 22, start_tick: 0, entry: 0 },
        { enemy: 'compra-impulsiva', count: 5, interval_ticks: 20, start_tick: 30, entry: 0 },
      ],
      bonus_gold: 55,
    },
    {
      id: 'las-trampas',
      groups: [
        { enemy: 'promo-que-divide', count: 4, interval_ticks: 26, start_tick: 0, entry: 0 },
        { enemy: 'refuerzo-marketing', count: 2, interval_ticks: 34, start_tick: 40, entry: 0 },
        { enemy: 'barrena-descuento', count: 3, interval_ticks: 28, start_tick: 70, entry: 0 },
      ],
      bonus_gold: 60,
    },
    {
      id: 'la-deuda',
      groups: [
        { enemy: 'deuda-que-crece', count: 5, interval_ticks: 24, start_tick: 0, entry: 0 },
        {
          enemy: 'deuda-jefe',
          count: 1,
          interval_ticks: 1,
          start_tick: 110,
          entry: 0,
          boss: true,
        },
      ],
      bonus_gold: 80,
      bonus_gems: 3,
    },
  ],
  prep_ticks: 70,
  heat: [
    {
      id: 'modo-apretado',
      item_id: 'modo-apretado',
      hp_pct: 130,
      gold_pct: 80,
      double_bosses: false,
      score_multiplier_pct: 120,
    },
    {
      id: 'modo-quiebra',
      item_id: 'modo-quiebra',
      hp_pct: 160,
      gold_pct: 60,
      double_bosses: true,
      score_multiplier_pct: 150,
    },
  ],
  efficiency: { wall_budget: 10, gold_surplus_target: 240 },
  // Tier 3 weighting: half the score is stopping the wave, but a FIFTH of it is having
  // needed few walls to do it — an open field rewards thinking about placement, and
  // carpeting it with concrete is exactly the un-thought answer. Each leak costs a flat
  // five points on top, so "almost held" and "held" are visibly different runs.
  score_weights: { defense: 0.5, leak_free: 0.2, economy: 0.1, walls: 0.2 },
  leak_penalty_pct: 5,
  tick_budget: 3200,
}

const mazeContent: DefenderContent = {
  items: [
    { id: 'gasto-chico', label_md: 'Gasto chico', icon: 'pest_control', tier: 1, image_slot: 'enemy_1' },
    { id: 'gasto-fijo', label_md: 'Gasto fijo', icon: 'event_repeat', tier: 2, image_slot: 'enemy_2' },
    {
      id: 'cargo-oculto',
      label_md: 'Cargo oculto',
      icon: 'visibility_off',
      tier: 3,
      image_slot: 'enemy_3',
      misconception_md: 'No aparece en el precio grande: sólo lo ves si revisas la letra chiquita.',
    },
    {
      id: 'compra-impulsiva',
      label_md: 'Compra impulsiva',
      icon: 'bolt',
      tier: 3,
      image_slot: 'enemy_4',
      misconception_md: 'Se salta tu plan por completo: por eso no la detiene ningún muro.',
    },
    { id: 'deuda-que-crece', label_md: 'Deuda que crece', icon: 'trending_up', tier: 4, image_slot: 'enemy_5' },
    {
      id: 'promo-que-divide',
      label_md: 'Promo 2x1',
      icon: 'call_split',
      tier: 3,
      image_slot: 'enemy_6',
      misconception_md: 'Parece un ahorro, pero al caer se convierte en dos gastos que no tenías.',
    },
    { id: 'refuerzo-marketing', label_md: 'Refuerzo de anuncios', icon: 'campaign', tier: 3, image_slot: 'enemy_7' },
    { id: 'barrena-descuento', label_md: 'Barrena de descuentos', icon: 'construction', tier: 4, image_slot: 'enemy_8' },
    { id: 'deuda-jefe', label_md: 'La deuda grande', icon: 'account_balance_wallet', tier: 4, image_slot: 'enemy_9' },

    { id: 'torre-presupuesto', label_md: 'Torre Presupuesto', icon: 'calculate', tier: 1, image_slot: 'tower_single' },
    { id: 'torre-antena', label_md: 'Antena Anti-impulso', icon: 'settings_input_antenna', tier: 3, image_slot: 'tower_antiair' },
    { id: 'torre-lupa', label_md: 'Lupa de letra chiquita', icon: 'search', tier: 3, image_slot: 'tower_dot' },
    { id: 'torre-freno', label_md: 'Freno de gastos', icon: 'do_not_disturb_on', tier: 2, image_slot: 'tower_slow' },
    { id: 'torre-onda', label_md: 'Onda de recorte', icon: 'blur_on', tier: 3, image_slot: 'tower_area' },
    { id: 'torre-aliento', label_md: 'Meta compartida', icon: 'diversity_3', tier: 3, image_slot: 'tower_aura' },
    { id: 'torre-alcancia', label_md: 'Fondo que rinde', icon: 'savings', tier: 2, image_slot: 'tower_economy' },
    { id: 'torre-cepo', label_md: 'Tope de gasto', icon: 'block', tier: 1, image_slot: 'tower_block' },

    { id: 'rama-precision', label_md: 'Rama Precisión', icon: 'target', tier: 3 },
    { id: 'rama-alcance', label_md: 'Rama Alcance', icon: 'radar', tier: 3 },

    { id: 'bombardeo', label_md: 'Recorte de emergencia', icon: 'crisis_alert', tier: 4 },
    { id: 'congelar', label_md: 'Congelar gastos', icon: 'ac_unit', tier: 4 },

    { id: 'modo-apretado', label_md: 'Mes apretado', icon: 'compress', tier: 3 },
    { id: 'modo-quiebra', label_md: 'Mes en rojo', icon: 'warning', tier: 4 },
  ],
  categories: [
    { id: 'amenazas', label_md: 'Lo que ataca tu plan', description_md: 'Gastos que llegan solos.' },
    { id: 'defensas', label_md: 'Lo que lo protege', description_md: 'Decisiones que compras.' },
  ],
  interludes: [
    {
      id: 'pausa-interes',
      after_round: 2,
      kind: 'true_false',
      prompt_md: 'Las monedas que NO gastas te dan un poco más al cerrar la ronda.',
      options: [
        {
          id: 'si',
          label_md: 'Verdadero',
          correct: true,
          rationale_md: 'Eso es el interés: tu dinero guardado trabaja un poquito por ti.',
        },
        {
          id: 'no',
          label_md: 'Falso',
          correct: false,
          rationale_md: 'Revisa el marcador al cerrar una ronda: lo guardado sube solito.',
        },
      ],
    },
  ],
  feedback: {
    correct_md: ['Ese lugar alarga el camino.', 'Buena inversión.', '¡El laberinto está trabajando!'],
    incorrect_md: [
      'Casi. Ese lugar dejaría el paso libre.',
      'Otra vuelta: ¿dónde tardarían más en pasar?',
    ],
    results_md:
      'Ganaste con dos decisiones: alargar el camino y no gastar todo de golpe. Lo que guardaste te dio interés y con eso llegaron las torres que faltaban.',
  },
}

const budgetMaze: GameDocument = {
  schema_version: 1,
  meta: {
    slug: 'el-laberinto-del-presupuesto',
    title: 'El laberinto del presupuesto',
    locale: 'es-MX',
    mechanic: 'defender',
    concept: {
      topic_path: 'planear-mi-dinero/el-presupuesto/prioridades-y-costo-de-oportunidad',
      recap_md:
        'Aprendiste que cada peso que gastas es un peso que ya no puedes usar en otra cosa: eso es el **costo de oportunidad**, y por eso el orden en que compras importa tanto como qué compras.',
    },
    tier: 3,
    estimated_minutes: 6,
    cast: ['rho', 'zara'],
  },
  skin: {
    palette: 'navy-papaya',
    sprites: {},
    sfx: {
      build: 'build',
      kill: 'impact',
      leak: 'alarm',
      wave: 'streak',
      ability: 'explode',
      win: 'celebration',
    },
    bgm: 'arcade-tense',
  },
  config: mazeConfig,
  content: mazeContent,
  scoring: { mode: 'arcade', xp_max: 25, pass_score: 75, lives: 5, target: 42 },
  adaptive: { enabled: true, ease_after_failures: 2, ease_factor: 0.85, assist_toggleable: true },
}

export const defenderFixtures: GameDocument[] = [piggyGuard, budgetMaze]
