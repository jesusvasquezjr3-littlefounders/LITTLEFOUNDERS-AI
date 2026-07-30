// `stacker` fixtures — two complete, PLAYABLE es-MX manifests (GAME_ENGINE.md §7).
//
// They are not demo scaffolding. They are the reference answer to "what does a
// well-tuned stacker document look like", they are what `/dev/game-lab` loads, and
// `stacker.test.ts` asserts that the PERFECT bot reaches `pass_score` on each one while
// the RANDOM bot does not — the same §9 winnability gate the Arcade pipeline runs before
// a generated document may be published.
//
// Deliberately different across every axis the schema exposes: a tier-1 CHEER manifest
// (snap placement, no rotation, no fail state, a gentle wind-then-rain timeline, blended
// scoring) and a tier-3 ARCADE manifest (pieces dropped from above, four rotation steps,
// two lives, an earthquake in the timeline, special-property pieces, a reposition cost,
// adaptive assistance enabled, and the report's literal product score model).
//
// THE CONCEPT IS THE ECONOMY (§4 learning binding). In both documents the pieces are
// money decisions and the budget is money: a child who builds a wide, cheap, boring
// foundation and keeps change in hand outscores one who spends everything on tall,
// pretty, fragile things. That trade-off is the lesson, and the physics is how it is
// argued rather than asserted.
//
// Content is curriculum, never a child: no names, no locations, no PII (§1.9).
// `skin.sprites` is empty on purpose — Prism fills it at illustrate time, and the view
// must be fully legible before it does.

import type { GameDocument } from '@/game-engine/core/types'

import type { StackerConfig, StackerContent } from './schema'

// ---- 1. La torre de mi ahorro (tier 1, cheer, snap, blended score) ----------------

const savingsTowerConfig: StackerConfig = {
  field: {
    width: 900,
    height: 540,
    ground_y: 440,
    base_x: 450,
    base_width: 320,
    baseline_y: 520,
  },
  // Ordinary downward gravity: 90 degrees is straight down in the engine's screen
  // convention, and `dsin(90)`/`dcos(90)` are pinned exactly, so the common case costs
  // no accuracy at all.
  gravity: { intensity: 1.2, direction_degrees: 90 },
  catalog: [
    {
      item_id: 'meta-clara',
      shape: 'box',
      w: 300,
      h: 48,
      mass: 6,
      friction: 0.92,
      restitution: 0.02,
      property: 'none',
      property_value: 0,
      cost: 20,
      unlock_after_pieces: 0,
      max_uses: 1,
    },
    {
      item_id: 'ahorro-semanal',
      shape: 'box',
      w: 240,
      h: 44,
      mass: 4,
      friction: 0.9,
      restitution: 0.02,
      property: 'none',
      property_value: 0,
      cost: 16,
      unlock_after_pieces: 0,
      max_uses: 2,
    },
    {
      item_id: 'gasto-anotado',
      shape: 'box',
      w: 180,
      h: 40,
      mass: 3,
      friction: 0.88,
      restitution: 0.02,
      property: 'none',
      property_value: 0,
      cost: 12,
      unlock_after_pieces: 0,
      max_uses: 2,
    },
    {
      item_id: 'alcancia',
      shape: 'box',
      w: 120,
      h: 38,
      mass: 2,
      friction: 0.86,
      restitution: 0.03,
      property: 'none',
      property_value: 0,
      cost: 9,
      unlock_after_pieces: 2,
      max_uses: 2,
    },
    {
      // The trap: cheap, bouncy, low-friction and it belongs nowhere in a savings plan.
      // A circle on purpose — it rolls, which is the physics telling the same story the
      // misconception text tells.
      item_id: 'compra-impulso',
      shape: 'circle',
      w: 80,
      h: 80,
      mass: 1,
      friction: 0.14,
      restitution: 0.5,
      property: 'elastic',
      property_value: 0.3,
      cost: 14,
      unlock_after_pieces: 0,
      max_uses: 3,
    },
  ],
  placement: {
    mode: 'snap',
    drop_y: 60,
    rotation_steps: 1,
    snap_grid: 30,
    ghost_preview: true,
    max_pieces: 8,
    build_ticks: 240,
  },
  economy: {
    budget: 200,
    use_piece_cost: true,
    cost_per_mass: 0,
    cost_per_area: 0,
    min_cost: 1,
    refund_pct: 60,
    // Tier 1 lets a child change their mind for free — the trade-off being taught is
    // WHAT to buy, not how decisive to be about it.
    reposition_cost: 0,
    collapse_refund_pct: 60,
  },
  solver: {
    iterations: 12,
    position_correction: 1,
    sleep_speed: 0.4,
    sleep_ticks: 3,
    // Above one tick of gravity (1.2 * 0.95 = 1.14), which the schema enforces: below it
    // every resting contact would re-bounce every tick and the tower would never settle.
    rest_speed: 2,
    damping: 0.95,
    wind_area_scale: 4000,
    magnet_pull: 0,
  },
  stability: {
    // Tuned against this document's own physics: the tower's friction capacity at the
    // base is `friction * mass * gravity` ~ 40 force units, so the strongest gust below
    // stays under that (the tower never slides) while still pulling the margin under the
    // threshold (the hold breaks and has to be earned again). Wind that slides a tower
    // instead of tipping it is a bug in the manifest, not a harder level.
    margin_threshold: 2.2,
    margin_cap: 8,
    hold_ticks: 300,
    target_height: 240,
    contact_epsilon: 2,
  },
  collapse: {
    max_tilt_degrees: 22,
    tilt_min_height: 60,
    // Generous on purpose: the Gauss-Seidel solver lets a tall stack creep a fraction of
    // a unit per tick under a long gust, and a tower that leans a little across a whole
    // storm has not collapsed. What this catches is a piece that genuinely slid away.
    max_shift: 100,
    brittle_breaks_run: false,
    grace_ticks: 6,
  },
  timeline: {
    announce_ticks: 40,
    gust_variance: 0.15,
    events: [
      { id: 'viento-suave', at_tick: 20, kind: 'wind', magnitude: 0.85, duration_ticks: 60 },
      { id: 'lluvia', at_tick: 100, kind: 'rain', magnitude: 12, duration_ticks: 80 },
      { id: 'viento-fuerte', at_tick: 200, kind: 'wind', magnitude: 1.2, duration_ticks: 70 },
    ],
  },
  assist: {
    // Tier 1 has no fail state, so there is nothing to ease: the document's `adaptive`
    // block is absent and assistance stays off.
    enabled: false,
    ease_after_failures: 2,
    ease_factor: 0.8,
    suggest_piece: false,
  },
  style: {
    symmetry_weight: 1,
    cantilever_weight: 0.4,
    cantilever_min_overhang: 30,
    cantilever_target: 2,
    bonus_share: 0.3,
  },
  score_model: 'blend',
  score_weights: { height: 0.4, stability: 0.15, hold: 0.15, efficiency: 0.15, style: 0.15 },
  penalty: { collapse_pct: 4, reposition_pct: 0, avoid_piece_pct: 3 },
  round: { tick_budget: 1200 },
}

const savingsTowerContent: StackerContent = {
  categories: [
    { id: 'plan', label_md: 'Mi plan', description_md: 'Piezas que sostienen el ahorro.' },
    { id: 'tentacion', label_md: 'Tentación', description_md: 'Piezas que se ven bien y no sostienen.' },
  ],
  items: [
    {
      id: 'meta-clara',
      label_md: 'Meta clara: $20',
      category: 'plan',
      value: 20,
      icon: 'flag',
      tier: 1,
      image_slot: 'piece_1',
      props: { ancho: 300, peso: 6 },
    },
    {
      id: 'ahorro-semanal',
      label_md: 'Guardar cada semana: $16',
      category: 'plan',
      value: 16,
      icon: 'savings',
      tier: 1,
      image_slot: 'piece_2',
      props: { ancho: 240, peso: 4 },
    },
    {
      id: 'gasto-anotado',
      label_md: 'Anotar lo que gasto: $12',
      category: 'plan',
      value: 12,
      icon: 'edit_note',
      tier: 1,
      image_slot: 'piece_3',
      props: { ancho: 180, peso: 3 },
    },
    {
      id: 'alcancia',
      label_md: 'Alcancía cerrada: $9',
      category: 'plan',
      value: 9,
      icon: 'lock',
      tier: 2,
      image_slot: 'piece_4',
      props: { ancho: 120, peso: 2 },
    },
    {
      id: 'compra-impulso',
      label_md: 'Compra de antojo: $14',
      category: 'tentacion',
      value: 14,
      icon: 'shopping_bag',
      tier: 2,
      image_slot: 'piece_5',
      misconception_md:
        'Cuesta casi lo mismo que tu meta y no sostiene nada: es redonda, se rueda y tira la torre.',
      props: { ancho: 80, peso: 1 },
    },
  ],
  interludes: [
    {
      id: 'pausa-cimiento',
      after_round: 1,
      kind: 'pick_one',
      prompt_md: '¿Qué pieza va hasta abajo para que la torre no se caiga?',
      options: [
        {
          id: 'a',
          label_md: 'La más ancha y pesada',
          correct: true,
          rationale_md: 'Una base ancha reparte el peso y aguanta el viento.',
        },
        {
          id: 'b',
          label_md: 'La más bonita',
          correct: false,
          rationale_md: 'Lo bonito no sostiene: lo que sostiene es la base.',
        },
      ],
    },
  ],
  feedback: {
    correct_md: ['¡Bien puesta!', 'Esa pieza sostiene.', '¡Tu plan va tomando forma!'],
    incorrect_md: [
      'Casi. Prueba con algo más ancho abajo.',
      'Otra vuelta: ¿esa pieza sostiene o solo se ve bien?',
    ],
    results_md:
      'Un plan de ahorro se sostiene igual que una torre: base ancha primero, y guardando algo de dinero para lo que no esperabas.',
  },
  roles: {
    foundation: ['meta-clara', 'ahorro-semanal'],
    avoid: ['compra-impulso'],
  },
}

const savingsTower: GameDocument = {
  schema_version: 1,
  meta: {
    slug: 'la-torre-de-mi-ahorro',
    title: 'La torre de mi ahorro',
    locale: 'es-MX',
    mechanic: 'stacker',
    concept: {
      topic_path: 'mi-primer-dinero/guardar-con-calma/como-se-arma-un-ahorro',
      recap_md:
        'Aprendiste que un ahorro se arma por **partes**: primero una meta clara, luego guardar poquito seguido, y anotar lo que gastas para no perderte.',
    },
    tier: 1,
    estimated_minutes: 4,
    cast: ['dina'],
  },
  skin: {
    palette: 'forest-pear',
    sprites: {},
    sfx: { place: 'build', collapse: 'impact', hold: 'streak', win: 'celebration' },
  },
  config: savingsTowerConfig,
  content: savingsTowerContent,
  scoring: { mode: 'cheer', xp_max: 10, pass_score: 65, lives: null, target: 240 },
}

// ---- 2. El presupuesto que aguanta (tier 3, arcade, drop, product score) -----------

const budgetTowerConfig: StackerConfig = {
  field: {
    width: 960,
    height: 560,
    ground_y: 460,
    base_x: 480,
    base_width: 300,
    baseline_y: 540,
  },
  // Lighter gravity plus heavier air damping gives a terminal fall speed around
  // `intensity * damping / (1 - damping)` ~ 19 design units per tick — comfortably under
  // the shortest piece, so a dropped piece can never tunnel through the stack it lands
  // on. Tuning a drop-mode manifest is exactly this calculation.
  gravity: { intensity: 1.2, direction_degrees: 90 },
  catalog: [
    {
      item_id: 'fondo-emergencia',
      shape: 'box',
      w: 280,
      h: 56,
      mass: 8,
      friction: 0.95,
      restitution: 0.02,
      // A counterweight: the emergency fund is heavier than it looks, which is the whole
      // reason a budget with one under it does not tip.
      property: 'counterweight',
      property_value: 1.4,
      cost: 40,
      unlock_after_pieces: 0,
      max_uses: 1,
    },
    {
      item_id: 'gastos-fijos',
      shape: 'box',
      w: 220,
      h: 48,
      mass: 6,
      friction: 0.9,
      restitution: 0.03,
      property: 'none',
      property_value: 0,
      cost: 26,
      unlock_after_pieces: 1,
      max_uses: 2,
    },
    {
      item_id: 'ahorro-programado',
      shape: 'box',
      w: 170,
      h: 44,
      mass: 4,
      friction: 0.92,
      restitution: 0.02,
      // Adhesive: money you moved automatically stays where you put it.
      property: 'adhesive',
      property_value: 3,
      cost: 22,
      unlock_after_pieces: 2,
      max_uses: 3,
    },
    {
      item_id: 'seguro-medico',
      shape: 'box',
      w: 130,
      h: 40,
      mass: 3,
      friction: 0.9,
      restitution: 0.02,
      property: 'none',
      property_value: 0,
      cost: 18,
      unlock_after_pieces: 3,
      max_uses: 2,
    },
    {
      item_id: 'deuda-tarjeta',
      shape: 'box',
      w: 150,
      h: 36,
      mass: 5,
      friction: 0.3,
      restitution: 0.12,
      // Brittle: it holds until the first real shock, and then it does not.
      property: 'brittle',
      property_value: 34,
      cost: 10,
      unlock_after_pieces: 0,
      max_uses: 2,
    },
    {
      item_id: 'antojo-mensual',
      shape: 'circle',
      w: 72,
      h: 72,
      mass: 1,
      friction: 0.15,
      restitution: 0.5,
      property: 'elastic',
      property_value: 0.3,
      cost: 14,
      unlock_after_pieces: 0,
      max_uses: 3,
    },
  ],
  placement: {
    mode: 'drop',
    drop_y: 40,
    rotation_steps: 4,
    snap_grid: 20,
    ghost_preview: true,
    max_pieces: 10,
    build_ticks: 700,
  },
  economy: {
    budget: 380,
    use_piece_cost: true,
    cost_per_mass: 0,
    cost_per_area: 0,
    min_cost: 1,
    refund_pct: 50,
    // Tier 3 charges for changing your mind — the report's reposition cost, and a real
    // budgeting lesson: moving money around is never free.
    reposition_cost: 6,
    collapse_refund_pct: 45,
  },
  solver: {
    iterations: 12,
    position_correction: 1,
    sleep_speed: 0.35,
    sleep_ticks: 4,
    rest_speed: 1.2,
    damping: 0.94,
    wind_area_scale: 4200,
    magnet_pull: 0.4,
  },
  stability: {
    margin_threshold: 1.6,
    margin_cap: 10,
    hold_ticks: 220,
    target_height: 200,
    contact_epsilon: 2,
  },
  collapse: {
    max_tilt_degrees: 18,
    tilt_min_height: 70,
    max_shift: 80,
    brittle_breaks_run: true,
    grace_ticks: 40,
  },
  timeline: {
    announce_ticks: 25,
    gust_variance: 0.15,
    events: [
      { id: 'viento-de-mes', at_tick: 30, kind: 'wind', magnitude: 2, duration_ticks: 60 },
      {
        id: 'gasto-sorpresa',
        at_tick: 110,
        kind: 'load',
        magnitude: 4,
        duration_ticks: 60,
      },
      {
        id: 'temblor',
        at_tick: 200,
        kind: 'earthquake',
        magnitude: 2.2,
        duration_ticks: 60,
        period_ticks: 20,
      },
      { id: 'temporada-de-lluvia', at_tick: 290, kind: 'rain', magnitude: 14, duration_ticks: 90 },
    ],
  },
  assist: {
    // Wired to the document's `adaptive` block below: same trigger count, same factor.
    // The view only offers it because `adaptive.enabled` is true, and the child may
    // always decline (`assist_toggleable`).
    enabled: true,
    ease_after_failures: 1,
    ease_factor: 0.75,
    suggest_piece: true,
  },
  style: {
    symmetry_weight: 1,
    cantilever_weight: 0.5,
    cantilever_min_overhang: 26,
    cantilever_target: 3,
    bonus_share: 0.3,
  },
  // The owner report's literal formula. Tier 3 can carry it: one weak signal really
  // should cost the whole run here.
  score_model: 'product',
  score_weights: { height: 0.35, stability: 0.2, hold: 0.15, efficiency: 0.2, style: 0.1 },
  penalty: { collapse_pct: 6, reposition_pct: 2, avoid_piece_pct: 4 },
  round: { tick_budget: 2400 },
}

const budgetTowerContent: StackerContent = {
  categories: [
    { id: 'cimiento', label_md: 'Cimiento', description_md: 'Lo que sostiene el mes entero.' },
    { id: 'encima', label_md: 'Encima', description_md: 'Lo que se apoya en el cimiento.' },
    { id: 'riesgo', label_md: 'Riesgo', description_md: 'Se ve barato y no aguanta.' },
  ],
  items: [
    {
      id: 'fondo-emergencia',
      label_md: 'Fondo de emergencia: $40',
      category: 'cimiento',
      value: 40,
      icon: 'shield',
      tier: 3,
      image_slot: 'piece_1',
      props: { ancho: 280, peso: 8 },
    },
    {
      id: 'gastos-fijos',
      label_md: 'Gastos fijos del mes: $26',
      category: 'cimiento',
      value: 26,
      icon: 'receipt_long',
      tier: 2,
      image_slot: 'piece_2',
      props: { ancho: 220, peso: 6 },
    },
    {
      id: 'ahorro-programado',
      label_md: 'Ahorro programado: $22',
      category: 'encima',
      value: 22,
      icon: 'event_repeat',
      tier: 2,
      image_slot: 'piece_3',
      props: { ancho: 170, peso: 4 },
    },
    {
      id: 'seguro-medico',
      label_md: 'Seguro médico: $18',
      category: 'encima',
      value: 18,
      icon: 'health_and_safety',
      tier: 3,
      image_slot: 'piece_4',
      props: { ancho: 130, peso: 3 },
    },
    {
      id: 'deuda-tarjeta',
      label_md: 'Deuda de tarjeta: $10',
      category: 'riesgo',
      value: 10,
      icon: 'credit_card_off',
      tier: 3,
      image_slot: 'piece_5',
      misconception_md:
        'Es la pieza más barata del catálogo y se rompe con el primer temblor: pagar con deuda mueve el problema, no lo sostiene.',
      props: { ancho: 150, peso: 5 },
    },
    {
      id: 'antojo-mensual',
      label_md: 'Antojo del mes: $14',
      category: 'riesgo',
      value: 14,
      icon: 'local_mall',
      tier: 2,
      image_slot: 'piece_6',
      misconception_md:
        'Cuesta más que tu seguro y es redonda: no apoya nada y rueda en cuanto sopla el viento.',
      props: { ancho: 72, peso: 1 },
    },
  ],
  interludes: [
    {
      id: 'pausa-emergencia',
      after_round: 1,
      kind: 'true_false',
      prompt_md: 'Un fondo de emergencia sirve aunque este mes no pase nada.',
      options: [
        {
          id: 'si',
          label_md: 'Cierto',
          correct: true,
          rationale_md: 'Está ahí justo para el mes en que sí pasa algo.',
        },
        {
          id: 'no',
          label_md: 'Falso',
          correct: false,
          rationale_md: 'Si esperas a necesitarlo para armarlo, ya es tarde.',
        },
      ],
    },
    {
      id: 'pausa-deuda',
      after_round: 2,
      kind: 'pick_one',
      prompt_md: '¿Qué pasa si tu presupuesto se apoya en una deuda?',
      options: [
        {
          id: 'a',
          label_md: 'Aguanta igual: es una pieza más',
          correct: false,
          rationale_md: 'Aguanta hasta el primer imprevisto, y ahí se rompe.',
        },
        {
          id: 'b',
          label_md: 'Aguanta hasta el primer imprevisto',
          correct: true,
          rationale_md: 'La deuda es frágil: al primer temblor deja de sostener.',
        },
      ],
    },
  ],
  feedback: {
    correct_md: ['Cimiento firme.', 'Esa aguanta el mes.', '¡Buen presupuesto!'],
    incorrect_md: [
      'Revisa: ¿esa pieza aguanta un imprevisto?',
      'Casi. Lo barato de hoy a veces es lo que se rompe mañana.',
    ],
    results_md:
      'Un presupuesto que aguanta se arma de abajo hacia arriba: fondo de emergencia, gastos fijos, ahorro programado — y siempre queda algo de dinero sin gastar.',
  },
  roles: {
    foundation: ['fondo-emergencia', 'gastos-fijos'],
    avoid: ['deuda-tarjeta', 'antojo-mensual'],
  },
}

const budgetTower: GameDocument = {
  schema_version: 1,
  meta: {
    slug: 'el-presupuesto-que-aguanta',
    title: 'El presupuesto que aguanta',
    locale: 'es-MX',
    mechanic: 'stacker',
    concept: {
      topic_path: 'planear-mi-dinero/imprevistos/fondo-de-emergencia',
      recap_md:
        'Aprendiste que un presupuesto se sostiene sobre un **fondo de emergencia**: primero lo que aguanta, después lo que se apoya, y la deuda nunca como cimiento.',
    },
    tier: 3,
    estimated_minutes: 6,
    cast: ['rho', 'zara'],
  },
  skin: {
    palette: 'navy-papaya',
    sprites: {},
    sfx: {
      place: 'build',
      collapse: 'explode',
      shake: 'alarm',
      hold: 'streak',
      win: 'celebration',
    },
    bgm: 'arcade-tense',
  },
  config: budgetTowerConfig,
  content: budgetTowerContent,
  scoring: { mode: 'arcade', xp_max: 20, pass_score: 65, lives: 2, target: 200 },
  adaptive: { enabled: true, ease_after_failures: 1, ease_factor: 0.75, assist_toggleable: true },
}

export const stackerFixtures: GameDocument[] = [savingsTower, budgetTower]
