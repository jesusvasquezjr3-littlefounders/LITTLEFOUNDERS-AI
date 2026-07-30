// Runner — complete, PLAYABLE es-MX manifests (GAME_ENGINE.md §7).
//
// These are not test stubs: each one satisfies the PRODUCTION schemas (§1.14 forbids
// relaxing a schema for a fixture), each one is winnable by the `perfect` bot and not
// by the `random` bot (`runner.test.ts` asserts both), and each one carries real
// financial-literacy content for its tier. There is no child PII here and there never
// can be: a game is generated from curriculum, not from a child (§11).
//
// `skin.sprites` is deliberately EMPTY. Sprite URLs are Prism/Depot artifacts produced
// by the `illustrate` stage; inventing one here would be a fabricated asset. The view
// falls back to palette-tinted shapes plus each item's Material Symbols `icon`, which
// is the same path a document takes before illustration.

import type { GameDocument } from '@/game-engine/core/types'

import type { RunnerConfig, RunnerContent } from './schema'

// ---- Fixture 1 — tier 1, cheer mode, single-jump ------------------------------------
//
// "Necesidad o deseo": run the market street, take the needs, hop over the wants.
// Physics: impulse 15 / gravity 1 gives a 105-unit arc lasting 29 ticks (1.45s), which
// clears every 60–64-unit hurdle in the pattern library at all three ramp speeds.

const NEEDS_CONFIG: RunnerConfig = {
  world: { width: 900, height: 540, ground_y: 420, avatar_x: 140, avatar_w: 56, avatar_h: 72 },
  action: {
    model: 'jump',
    jump: { dir: 1, impulse: 15, gravity: 1, max_jumps: 1 },
    hold: { enabled: false, glide_gravity: 0, max_hold_ticks: 0 },
  },
  speed: {
    phases: [
      { from_tick: 0, units_per_tick: 6 },
      { from_tick: 300, units_per_tick: 8 },
      { from_tick: 600, units_per_tick: 10 },
    ],
  },
  spawn: {
    lead_units: 200,
    min_gap_units: 140,
    max_gap_units: 240,
    patterns: [
      {
        id: 'hurdle',
        weight: 5,
        length_units: 320,
        elements: [
          { role: 'obstacle', dx: 0, y: 360, w: 44, h: 60, variant: 'static' },
          {
            role: 'good',
            dx: 20,
            y: 280,
            w: 40,
            h: 40,
            variant: 'moving',
            amplitude: 16,
            period_ticks: 24,
          },
          { role: 'good', dx: 280, y: 380, w: 40, h: 40, variant: 'static' },
        ],
      },
      {
        id: 'want-trap',
        weight: 4,
        length_units: 320,
        elements: [
          { role: 'bad', dx: 0, y: 360, w: 44, h: 60, variant: 'static' },
          { role: 'good', dx: 20, y: 280, w: 40, h: 40, variant: 'static' },
          { role: 'good', dx: 280, y: 380, w: 40, h: 40, variant: 'static' },
        ],
      },
      {
        id: 'twin-hurdle',
        weight: 3,
        length_units: 700,
        min_distance_units: 2000,
        elements: [
          { role: 'obstacle', dx: 0, y: 356, w: 44, h: 64, variant: 'static' },
          { role: 'good', dx: 20, y: 276, w: 40, h: 40, variant: 'static' },
          { role: 'good', dx: 300, y: 380, w: 40, h: 40, variant: 'static' },
          { role: 'obstacle', dx: 480, y: 360, w: 44, h: 60, variant: 'static' },
          { role: 'good', dx: 500, y: 280, w: 40, h: 40, variant: 'static' },
        ],
      },
    ],
  },
  lives: { policy: 'checkpoint', checkpoint_every_units: 1500, respawn_invulnerable_ticks: 24 },
  scoring: {
    distance_weight: 0.4,
    collect_weight: 0.6,
    collect_points: 10,
    collect_target: 700,
    wrong_penalty_pct: 5,
    crash_penalty_pct: 4,
    combo: { step: 3, max: 4 },
  },
  target_distance: 6000,
  max_ticks: 900,
}

const NEEDS_CONTENT: RunnerContent = {
  items: [
    { id: 'agua', label_md: 'Agua', category: 'necesidad', icon: 'water_drop', value: 12, tier: 1 },
    { id: 'frijol', label_md: 'Frijoles', category: 'necesidad', icon: 'restaurant', value: 30, tier: 1 },
    { id: 'cuaderno', label_md: 'Cuaderno', category: 'necesidad', icon: 'menu_book', value: 25, tier: 1 },
    { id: 'zapatos', label_md: 'Zapatos de escuela', category: 'necesidad', icon: 'steps', value: 260, tier: 2 },
    {
      id: 'dulce',
      label_md: 'Dulce extra',
      category: 'deseo',
      icon: 'cake',
      value: 8,
      tier: 1,
      misconception_md:
        'Un dulce se antoja, pero no lo necesitas para vivir ni para ir a la escuela: es un deseo.',
    },
    {
      id: 'juguete',
      label_md: 'Juguete nuevo',
      category: 'deseo',
      icon: 'toys',
      value: 150,
      tier: 2,
      misconception_md:
        'Un juguete nuevo es divertido, pero ya tienes con que jugar: primero van las necesidades.',
    },
    {
      id: 'calcas',
      label_md: 'Calcomanias',
      category: 'deseo',
      icon: 'star',
      value: 15,
      tier: 1,
      misconception_md: 'Las calcomanias adornan tu cuaderno, pero el cuaderno es lo que necesitas.',
    },
  ],
  categories: [
    { id: 'necesidad', label_md: 'Necesidad', description_md: 'Lo que usas para vivir y aprender.' },
    { id: 'deseo', label_md: 'Deseo', description_md: 'Lo que te gusta, pero puede esperar.' },
  ],
  feedback: {
    correct_md: ['Esa si la necesitas.', 'Buena eleccion.', 'Vas llenando tu canasta.'],
    incorrect_md: ['Ese era un deseo, sigue corriendo.', 'Casi: ese puede esperar.'],
    results_md: 'Corriste el mercado eligiendo primero lo que necesitas. Asi se cuida el dinero.',
  },
  roles: { collect: ['agua', 'frijol', 'cuaderno', 'zapatos'], avoid: ['dulce', 'juguete', 'calcas'] },
}

const NEEDS_RUN: GameDocument = {
  schema_version: 1,
  meta: {
    slug: 'carrera-necesidad-o-deseo',
    title: 'Carrera: necesidad o deseo',
    locale: 'es-MX',
    mechanic: 'runner',
    concept: {
      topic_path: 'dinero-basico/necesidades-y-deseos/necesidad-o-deseo',
      recap_md:
        'Aprendiste que una **necesidad** es algo que usas para vivir, comer o estudiar, y un **deseo** es algo que te gusta pero puede esperar. Ahora corre por el mercado: toma las necesidades y deja pasar los deseos.',
    },
    tier: 1,
    estimated_minutes: 2,
    cast: ['dina'],
  },
  skin: {
    palette: 'navy-papaya',
    sprites: {},
    sfx: { collect: 'collect', crash: 'impact', act: 'whoosh', win: 'celebration' },
  },
  config: NEEDS_CONFIG,
  content: NEEDS_CONTENT,
  scoring: { mode: 'cheer', xp_max: 10, pass_score: 65, lives: null, target: 6000 },
}

// ---- Fixture 2 — tier 2, arcade mode, two-lane switching ------------------------------
//
// "Cambia de carril": the same mechanic with a different action model, a steeper speed
// ramp, three lives with checkpoint respawns, and `sudden` obstacles past the halfway
// mark. Coins sit in BOTH lanes at the same offset, so a switch is always a safety
// decision and never a hidden collection tax.

const LANE_CONFIG: RunnerConfig = {
  world: { width: 900, height: 540, ground_y: 480, avatar_x: 130, avatar_w: 56, avatar_h: 64 },
  action: { model: 'lane', lanes: { count: 2, top_y: 180, gap: 160, transition_ticks: 5 } },
  speed: {
    phases: [
      { from_tick: 0, units_per_tick: 8 },
      { from_tick: 200, units_per_tick: 10 },
      { from_tick: 450, units_per_tick: 12 },
      { from_tick: 700, units_per_tick: 14 },
    ],
  },
  spawn: {
    lead_units: 240,
    min_gap_units: 220,
    max_gap_units: 340,
    patterns: [
      {
        id: 'block-top',
        weight: 4,
        length_units: 420,
        elements: [
          { role: 'obstacle', dx: 0, y: 180, w: 48, h: 64, variant: 'static' },
          { role: 'good', dx: 260, y: 190, w: 44, h: 44, variant: 'static' },
          { role: 'good', dx: 260, y: 350, w: 44, h: 44, variant: 'static' },
        ],
      },
      {
        id: 'block-bottom',
        weight: 4,
        length_units: 420,
        elements: [
          { role: 'obstacle', dx: 0, y: 340, w: 48, h: 64, variant: 'static' },
          { role: 'good', dx: 260, y: 190, w: 44, h: 44, variant: 'static' },
          { role: 'good', dx: 260, y: 350, w: 44, h: 44, variant: 'static' },
        ],
      },
      {
        id: 'leak-top',
        weight: 3,
        length_units: 380,
        elements: [
          { role: 'bad', dx: 0, y: 180, w: 48, h: 64, variant: 'static' },
          { role: 'good', dx: 0, y: 350, w: 44, h: 44, variant: 'static' },
        ],
      },
      {
        id: 'leak-bottom',
        weight: 3,
        length_units: 380,
        elements: [
          { role: 'bad', dx: 0, y: 340, w: 48, h: 64, variant: 'static' },
          { role: 'good', dx: 0, y: 190, w: 44, h: 44, variant: 'static' },
        ],
      },
      {
        id: 'sudden-top',
        weight: 2,
        length_units: 460,
        min_distance_units: 2500,
        elements: [
          { role: 'obstacle', dx: 0, y: 180, w: 48, h: 64, variant: 'sudden', reveal_units: 520 },
          { role: 'good', dx: 280, y: 190, w: 44, h: 44, variant: 'static' },
          { role: 'good', dx: 280, y: 350, w: 44, h: 44, variant: 'static' },
        ],
      },
    ],
  },
  lives: { policy: 'checkpoint', checkpoint_every_units: 1000, respawn_invulnerable_ticks: 30 },
  scoring: {
    distance_weight: 0.5,
    collect_weight: 0.5,
    collect_points: 12,
    // Tuned to the reachable ceiling, not the spawned total: a coin sits in BOTH lanes
    // at the same offset, so exactly one of each pair is takeable and "missed" counts
    // its twin. Paying for the unreachable twin would make the game unwinnable.
    collect_target: 190,
    wrong_penalty_pct: 6,
    crash_penalty_pct: 5,
    combo: { step: 4, max: 5 },
  },
  target_distance: 7000,
  max_ticks: 800,
}

const LANE_CONTENT: RunnerContent = {
  items: [
    { id: 'moneda-1', label_md: 'Moneda de 1 peso', category: 'ahorro', icon: 'savings', value: 1, tier: 1 },
    { id: 'moneda-5', label_md: 'Moneda de 5 pesos', category: 'ahorro', icon: 'paid', value: 5, tier: 2 },
    { id: 'moneda-10', label_md: 'Moneda de 10 pesos', category: 'ahorro', icon: 'account_balance', value: 10, tier: 3 },
    {
      id: 'fuga-suscripcion',
      label_md: 'Suscripcion que no usas',
      category: 'fuga',
      icon: 'subscriptions',
      value: 99,
      tier: 3,
      misconception_md:
        'Parece barata cada mes, pero se cobra sola todo el ano: una fuga chica repetida vacia el ahorro.',
    },
    {
      id: 'fuga-antojo',
      label_md: 'Antojo diario',
      category: 'fuga',
      icon: 'local_cafe',
      value: 20,
      tier: 2,
      misconception_md:
        'Veinte pesos al dia no se sienten, pero en un mes son seiscientos que ya no puedes ahorrar.',
    },
  ],
  categories: [
    { id: 'ahorro', label_md: 'Ahorro', description_md: 'Monedas que se quedan contigo.' },
    { id: 'fuga', label_md: 'Fuga', description_md: 'Gastos chicos que se repiten y se llevan el ahorro.' },
  ],
  interludes: [
    {
      id: 'pausa-fugas',
      after_round: 2,
      kind: 'pick_one',
      prompt_md: 'Cual vacia mas rapido tu alcancia?',
      options: [
        {
          id: 'op-diario',
          label_md: 'Veinte pesos cada dia',
          correct: true,
          rationale_md: 'Un gasto chico que se repite suma mas que uno grande de una sola vez.',
        },
        { id: 'op-unico', label_md: 'Cien pesos una vez al ano', correct: false },
      ],
    },
  ],
  feedback: {
    correct_md: ['Moneda guardada.', 'Tu alcancia sube.', 'Esquivaste la fuga.'],
    incorrect_md: ['Esa era una fuga, cambia de carril.', 'Casi: esa se repite cada mes.'],
    results_md: 'Guardaste monedas y esquivaste las fugas. Las fugas chicas son las que mas pesan.',
  },
  roles: { collect: ['moneda-1', 'moneda-5', 'moneda-10'], avoid: ['fuga-suscripcion', 'fuga-antojo'] },
}

const LANE_RUN: GameDocument = {
  schema_version: 1,
  meta: {
    slug: 'carrera-cambia-de-carril',
    title: 'Carrera: cambia de carril',
    locale: 'es-MX',
    mechanic: 'runner',
    concept: {
      topic_path: 'ahorro/fugas-de-dinero/gastos-hormiga',
      recap_md:
        'Aprendiste que los **gastos hormiga** son pagos chicos que se repiten y se llevan el ahorro sin que lo notes. Cambia de carril para juntar monedas y dejar pasar las fugas.',
    },
    tier: 2,
    estimated_minutes: 3,
    cast: ['liruf', 'zara'],
  },
  skin: {
    palette: 'forest-pear',
    sprites: {},
    sfx: { collect: 'collect', crash: 'impact', act: 'flip', win: 'celebration' },
  },
  config: LANE_CONFIG,
  content: LANE_CONTENT,
  scoring: { mode: 'arcade', xp_max: 20, pass_score: 70, lives: 3, target: 7000 },
  adaptive: { enabled: true, ease_after_failures: 2, ease_factor: 0.8, assist_toggleable: true },
}

export const runnerFixtures: GameDocument[] = [NEEDS_RUN, LANE_RUN]
