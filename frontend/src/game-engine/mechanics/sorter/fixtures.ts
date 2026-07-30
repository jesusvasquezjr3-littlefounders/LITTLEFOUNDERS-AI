// `sorter` fixtures — two complete, PLAYABLE es-MX manifests (GAME_ENGINE.md §7).
//
// They are not demo scaffolding. They are the reference answer to "what does a
// well-tuned sorter document look like", they are what `/dev/game-lab` loads, and
// `sorter.test.ts` asserts that the PERFECT bot reaches `pass_score` on each one
// while the RANDOM bot does not — the same §9 winnability gate the Arcade pipeline
// runs before a generated document may be published.
//
// Deliberately different difficulty settings: a tier-1 CHEER manifest (static tray,
// two containers, no fail state, a discard target for the traps) and a tier-3 ARCADE
// manifest (falling elements, four containers, three lives, a life per mistake, no
// discard target so a trap must simply be let go).
//
// Content is curriculum, never a child: no names, no locations, no PII (§1.9).
// `skin.sprites` is empty on purpose — Prism fills it at illustrate time, and the
// view must be fully legible before it does.

import type { GameDocument } from '@/game-engine/core/types'

import type { SorterConfig, SorterContent } from './schema'

// ---- 1. Necesito o quiero (tier 1, cheer, static) ------------------------------

const needsWantsConfig: SorterConfig = {
  mode: 'static',
  category_count: 2,
  field: { width: 900, height: 540, lanes: 3, item_size: 132 },
  ladder: [
    {
      spawn_interval_ticks: 2,
      fall_speed: 0,
      speed_variance: 0,
      max_active: 6,
      item_tiers: [1],
      points_per_correct: 5,
    },
    {
      spawn_interval_ticks: 2,
      fall_speed: 0,
      speed_variance: 0,
      max_active: 6,
      item_tiers: [1, 2],
      points_per_correct: 7,
    },
  ],
  level_up: { correct_per_level: 6 },
  combo: { step: 3, max: 3 },
  penalty: {
    // Tier 1: a mistake costs a few points and the streak, never a life and never
    // the element itself — it comes straight back so the child can try again.
    wrong_drop: { score_pct: 4, lives: 0, combo_reset: true, return_item: true },
    miss: { score_pct: 0, lives: 0, combo_reset: false },
  },
  trash_zone: true,
  repeat_items: false,
  initial_fill: 6,
  round: { target_correct: 10, target_points: 90, tick_budget: 2400 },
  score_weights: { accuracy: 0.5, progress: 0.3, points: 0.2 },
}

const needsWantsContent: SorterContent = {
  categories: [
    {
      id: 'necesito',
      label_md: 'Necesito',
      description_md: 'Cosas sin las que no puedo estar bien: comer, aprender, estar sano.',
      image_slot: 'bin_1',
    },
    {
      id: 'quiero',
      label_md: 'Quiero',
      description_md: 'Cosas que me gustan mucho, pero puedo esperar o vivir sin ellas.',
      image_slot: 'bin_2',
    },
  ],
  items: [
    {
      id: 'agua',
      label_md: 'Agua para tomar',
      category: 'necesito',
      icon: 'water_drop',
      tier: 1,
      image_slot: 'item_1',
    },
    { id: 'lonche', label_md: 'El lonche de la escuela', category: 'necesito', icon: 'restaurant', tier: 1 },
    { id: 'medicina', label_md: 'La medicina del doctor', category: 'necesito', icon: 'medical_services', tier: 1 },
    { id: 'pasaje', label_md: 'El pasaje del camión', category: 'necesito', icon: 'directions_bus', tier: 1 },
    { id: 'cuaderno', label_md: 'Un cuaderno para la tarea', category: 'necesito', icon: 'menu_book', tier: 1 },
    {
      id: 'internet-tarea',
      label_md: 'Internet para hacer la tarea',
      category: 'necesito',
      icon: 'router',
      tier: 2,
      misconception_md: 'Suena a lujo, pero si la tarea se entrega en línea, es una necesidad.',
    },
    { id: 'videojuego', label_md: 'Un videojuego nuevo', category: 'quiero', icon: 'videogame_asset', tier: 1 },
    { id: 'dulces', label_md: 'Dulces de la tiendita', category: 'quiero', icon: 'cake', tier: 1 },
    { id: 'juguete', label_md: 'Otro juguete igual al que tengo', category: 'quiero', icon: 'toys', tier: 1 },
    { id: 'cine', label_md: 'Un boleto para el cine', category: 'quiero', icon: 'movie', tier: 1 },
    {
      id: 'tenis-marca',
      label_md: 'Tenis de la marca de moda',
      category: 'quiero',
      icon: 'checkroom',
      tier: 2,
      misconception_md: 'Unos tenis sí son necesidad; que sean de esa marca ya es un gusto.',
    },
    {
      id: 'audifonos',
      label_md: 'Audífonos que brillan',
      category: 'quiero',
      icon: 'headphones',
      tier: 2,
    },
    {
      id: 'dia-soleado',
      label_md: 'Un día soleado',
      icon: 'sunny',
      tier: 1,
      misconception_md: 'No se compra ni se paga, así que no cabe en ninguna de las dos cajas.',
    },
    {
      id: 'abrazo',
      label_md: 'Un abrazo de tu familia',
      icon: 'volunteer_activism',
      tier: 1,
      misconception_md: 'Es gratis y no se vende: no es un gasto, es algo que ya tienes.',
    },
  ],
  feedback: {
    correct_md: ['¡Esa va justo ahí!', 'Lo pensaste bien.', '¡Sigue así!'],
    incorrect_md: [
      'Casi. Piensa qué pasa si no lo tienes.',
      'Otra vuelta: ¿puedes esperar para tenerlo?',
    ],
    results_md: 'Separar lo que necesito de lo que quiero es el primer paso para decidir mi dinero.',
  },
}

const needsWants: GameDocument = {
  schema_version: 1,
  meta: {
    slug: 'necesito-o-quiero',
    title: 'Necesito o quiero',
    locale: 'es-MX',
    mechanic: 'sorter',
    concept: {
      topic_path: 'mi-primer-dinero/decidir-con-calma/necesidades-y-deseos',
      recap_md:
        'Aprendiste que una **necesidad** es algo sin lo que no puedes estar bien, y un **deseo** es algo que te gusta pero puede esperar.',
    },
    tier: 1,
    estimated_minutes: 3,
    cast: ['dina'],
  },
  skin: {
    palette: 'forest-pear',
    sprites: {},
    sfx: { correct: 'correct', wrong: 'tryagain', place: 'drop', combo: 'streak' },
  },
  config: needsWantsConfig,
  content: needsWantsContent,
  scoring: { mode: 'cheer', xp_max: 10, pass_score: 60, lives: null, target: 10 },
}

// ---- 2. Mi presupuesto en movimiento (tier 3, arcade, falling) -----------------

const budgetConfig: SorterConfig = {
  mode: 'falling',
  category_count: 4,
  field: { width: 960, height: 560, lanes: 4, item_size: 108 },
  ladder: [
    {
      spawn_interval_ticks: 14,
      fall_speed: 5,
      speed_variance: 1,
      max_active: 3,
      item_tiers: [1, 2],
      points_per_correct: 6,
    },
    {
      spawn_interval_ticks: 11,
      fall_speed: 7,
      speed_variance: 2,
      max_active: 4,
      item_tiers: [1, 2, 3],
      points_per_correct: 8,
    },
    {
      spawn_interval_ticks: 8,
      fall_speed: 9,
      speed_variance: 3,
      max_active: 5,
      item_tiers: [2, 3, 4],
      points_per_correct: 10,
    },
  ],
  level_up: { correct_per_level: 5 },
  combo: { step: 4, max: 4 },
  penalty: {
    // Tier 3 arcade: a mistake consumes the element and costs a life.
    wrong_drop: { score_pct: 5, lives: 1, combo_reset: true, return_item: false },
    miss: { score_pct: 3, lives: 1, combo_reset: true },
  },
  // No discard target: a trap must simply be LET GO, which is the harder skill.
  trash_zone: false,
  repeat_items: true,
  initial_fill: 1,
  round: { target_correct: 14, target_points: 240, tick_budget: 1600 },
  score_weights: { accuracy: 0.5, progress: 0.3, points: 0.2 },
}

const budgetContent: SorterContent = {
  categories: [
    { id: 'ingreso', label_md: 'Ingreso', description_md: 'Dinero que entra.', image_slot: 'bin_1' },
    {
      id: 'gasto-fijo',
      label_md: 'Gasto fijo',
      description_md: 'Sale cada mes por la misma cantidad.',
      image_slot: 'bin_2',
    },
    {
      id: 'gasto-variable',
      label_md: 'Gasto variable',
      description_md: 'Sale cuando decides, y cambia de tamaño.',
      image_slot: 'bin_3',
    },
    { id: 'ahorro', label_md: 'Ahorro', description_md: 'Se guarda para después.', image_slot: 'bin_4' },
  ],
  items: [
    { id: 'domingo', label_md: 'Tu domingo semanal', category: 'ingreso', icon: 'payments', tier: 1 },
    { id: 'pulseras', label_md: 'Venta de pulseras en el recreo', category: 'ingreso', icon: 'store', tier: 2 },
    {
      id: 'premio',
      label_md: 'Premio de la feria de ciencias',
      category: 'ingreso',
      icon: 'emoji_events',
      tier: 3,
    },
    { id: 'casillero', label_md: 'Renta del casillero', category: 'gasto-fijo', icon: 'lock', tier: 2 },
    {
      id: 'suscripcion',
      label_md: 'Suscripción de música cada mes',
      category: 'gasto-fijo',
      icon: 'library_music',
      tier: 2,
    },
    {
      id: 'club-robotica',
      label_md: 'Cuota mensual del club de robótica',
      category: 'gasto-fijo',
      icon: 'smart_toy',
      tier: 3,
    },
    { id: 'pizza', label_md: 'La pizza del viernes', category: 'gasto-variable', icon: 'local_pizza', tier: 1 },
    { id: 'recarga', label_md: 'Recarga del celular', category: 'gasto-variable', icon: 'smartphone', tier: 2 },
    {
      id: 'regalo-amigo',
      label_md: 'Regalo para tu mejor amigo',
      category: 'gasto-variable',
      icon: 'redeem',
      tier: 3,
    },
    { id: 'alcancia-bici', label_md: 'Alcancía para la bici', category: 'ahorro', icon: 'savings', tier: 2 },
    {
      id: 'cuenta-escolar',
      label_md: 'Cuenta de ahorro de la escuela',
      category: 'ahorro',
      icon: 'account_balance',
      tier: 3,
    },
    {
      id: 'fondo-viaje',
      label_md: 'Fondo para el viaje de fin de curso',
      category: 'ahorro',
      icon: 'flight_takeoff',
      tier: 3,
    },
    {
      id: 'precio-etiqueta',
      label_md: 'El precio en la etiqueta',
      icon: 'sell',
      tier: 2,
      misconception_md:
        'Un precio es información, no dinero que se mueve: nada entra ni sale de tu presupuesto.',
    },
    {
      id: 'fecha-pago',
      label_md: 'La fecha del próximo pago',
      icon: 'calendar_month',
      tier: 3,
      misconception_md: 'Una fecha te dice cuándo, no cuánto: no es ingreso, gasto ni ahorro.',
    },
  ],
  interludes: [
    {
      id: 'pausa-1',
      after_round: 1,
      kind: 'pick_one',
      prompt_md: '¿Cuál de estos gastos puedes cambiar de tamaño este mes?',
      options: [
        {
          id: 'a',
          label_md: 'La cuota del club de robótica',
          correct: false,
          rationale_md: 'Es la misma cantidad cada mes: es un gasto fijo.',
        },
        {
          id: 'b',
          label_md: 'Lo que gastas en antojitos',
          correct: true,
          rationale_md: 'Tú decides cuánto y cuándo: por eso es variable.',
        },
      ],
    },
  ],
  feedback: {
    correct_md: ['Clasificado.', 'Ese movimiento estaba claro.', '¡Buen ojo con tu presupuesto!'],
    incorrect_md: [
      'Revisa: ¿el dinero entra, sale o se guarda?',
      'Casi. Pregúntate si la cantidad cambia cada mes.',
    ],
    results_md:
      'Un presupuesto se lee en cuatro movimientos: lo que entra, lo que sale siempre, lo que sale a veces y lo que se guarda.',
  },
}

const budgetFlow: GameDocument = {
  schema_version: 1,
  meta: {
    slug: 'mi-presupuesto-en-movimiento',
    title: 'Mi presupuesto en movimiento',
    locale: 'es-MX',
    mechanic: 'sorter',
    concept: {
      topic_path: 'planear-mi-dinero/el-presupuesto/entradas-y-salidas',
      recap_md:
        'Aprendiste a leer un presupuesto en cuatro movimientos: **ingreso**, **gasto fijo**, **gasto variable** y **ahorro**.',
    },
    tier: 3,
    estimated_minutes: 5,
    cast: ['rho', 'zara'],
  },
  skin: {
    palette: 'navy-papaya',
    sprites: {},
    sfx: { correct: 'correct', wrong: 'tryagain', place: 'drop', combo: 'streak', miss: 'impact' },
    bgm: 'arcade-drive',
  },
  config: budgetConfig,
  content: budgetContent,
  scoring: { mode: 'arcade', xp_max: 20, pass_score: 70, lives: 3, target: 14 },
  adaptive: { enabled: true, ease_after_failures: 2, ease_factor: 0.85, assist_toggleable: true },
}

export const sorterFixtures: GameDocument[] = [needsWants, budgetFlow]
