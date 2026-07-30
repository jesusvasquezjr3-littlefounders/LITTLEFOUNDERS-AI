// `explorer` fixtures — two complete, PLAYABLE es-MX manifests (GAME_ENGINE.md §7).
//
// They are not demo scaffolding. They are the reference answer to "what does a
// well-tuned explorer world look like", they are what `/dev/game-lab` loads, and
// `explorer.test.ts` asserts on each one that the world SOLVER proves it completable,
// that the PERFECT bot reaches `pass_score`, and that the RANDOM bot does not — the same
// §9 winnability gate the Arcade pipeline runs before a generated document is published.
//
// Deliberately different difficulty settings:
//  1. a tier-1 CHEER world — ten nodes, four locks (hard / soft / temporal), free
//     movement, no fail state, hidden content drawn faintly rather than truly hidden;
//  2. a tier-3 ARCADE world — fourteen nodes, eight locks including a COMPOUND tier-2
//     lock fed by fragment upgrades and a SEQUENCE (combination) lock, a shop purchase,
//     an energy price on every ability and on every step, three lives.
//
// The map is a concept-dependency graph in both: you cannot cross the budgeting bridge
// until you have learned to budget. Content is curriculum, never a child — no names, no
// locations, no PII (§1.9). `skin.sprites` is empty on purpose: Prism fills it at
// illustrate time and the view must be fully legible before it does.

import type { GameDocument } from '@/game-engine/core/types'

import type { ExplorerConfig, ExplorerContent } from './schema'

// ---- 1. El mapa del ahorro (tier 1, cheer) --------------------------------------

const savingsConfig: ExplorerConfig = {
  map: { width: 900, height: 540, node_radius: 34 },
  // Tier 1: walking is free and unhurried. Two ticks per edge is a beat the child can
  // watch, not a wait they have to sit through.
  movement: { ticks_per_edge: 2, energy_per_move: 0 },
  energy: {
    max: 12,
    start: 12,
    regen_interval_ticks: 4,
    regen_amount: 2,
    rest_restores: 8,
  },
  abilities: {
    max_tier: 1,
    fragments_per_tier: 2,
    upgrade_depth: 0,
    tutorial_room_per_family: true,
  },
  locks: {
    // Two hard locks, one soft, one temporal: mostly a guided path, with exactly one
    // place where knowing more lets you go around a lock.
    mix: { hard_pct: 50, soft_pct: 25, compound_pct: 0, temporal_pct: 25 },
    mix_tolerance_pct: 15,
    soft_skill_default: 2,
    max_sequence_length: 2,
  },
  connectivity: {
    min_nodes: 8,
    max_nodes: 14,
    locked_edge_pct_min: 20,
    locked_edge_pct_max: 60,
    shortcut_pct_min: 0,
    shortcut_pct_max: 25,
  },
  optional: {
    hidden_pct_min: 0,
    hidden_pct_max: 30,
    // Tier 1: the hidden place is drawn faintly from the start. "There is something
    // over there" is itself the lesson at this age.
    reveal_requires_perception: false,
  },
  collectibles: { enabled: true, target: 2 },
  currency: { start: 10, target: 80, purchase_enabled: false },
  death: {
    currency_loss_pct: 25,
    // Fully recoverable: at tier 1 the lesson is "you can go back for it", not "it is
    // gone". Losing money and getting it back is the whole point.
    cache_recoverable_pct: 100,
    costs_life: true,
    respawn_energy: 8,
  },
  challenge: { attempts: 3, wrong_currency_cost: 5, mastery_per_solve: 1 },
  checkpoints: { start_is_checkpoint: true, rest_only_at_checkpoint: true },
  ending: { exploration_pct_required: 100, require_goal_node: true },
  signposts: {
    hard: { tone: 'primary', shape: 'square', sfx: 'flip' },
    soft: { tone: 'success', shape: 'circle', sfx: 'hint' },
    compound: { tone: 'delight', shape: 'hexagon', sfx: 'match' },
    temporal: { tone: 'warning', shape: 'triangle', sfx: 'streak' },
  },
  // The four "did you find it" signals deliberately sum to 0.6 while EFFICIENCY carries
  // 0.4. That is a structural property, not a taste: a run that flails for the whole
  // session scores 0 on efficiency and therefore CANNOT exceed 60, which is below
  // `pass_score` — so the §9 random bot fails by construction rather than by luck,
  // however long it mashes. A thorough child stays inside the action budget and scores
  // the full 100 on it, so the same rule costs honest play nothing.
  score_weights: {
    exploration: 0.2,
    abilities: 0.15,
    collectibles: 0.1,
    currency: 0.15,
    efficiency: 0.4,
  },
  penalties: { death_pct: 3, wrong_answer_pct: 2 },
  // ~4 minutes of wall clock: a safety stop, not a timer. Efficiency is judged on the
  // 100-decision budget below, which a confident run comes in well under.
  tick_budget: 4800,
  action_budget: 100,
}

const savingsContent: ExplorerContent = {
  items: [
    {
      id: 'contar',
      label_md: 'Contar mi dinero',
      icon: 'pin',
      image_slot: 'ability_1',
      tier: 1,
    },
    {
      id: 'comparar',
      label_md: 'Comparar precios',
      icon: 'balance',
      image_slot: 'ability_2',
      tier: 1,
    },
    {
      id: 'leer-etiqueta',
      label_md: 'Leer la etiqueta',
      icon: 'visibility',
      image_slot: 'ability_3',
      tier: 1,
    },
    {
      id: 'estampa-ahorro',
      label_md: 'Estampa de ahorro',
      icon: 'savings',
      image_slot: 'collectible_1',
      tier: 1,
    },
    {
      id: 'recibo',
      label_md: 'Recibo de la compra',
      icon: 'receipt_long',
      image_slot: 'collectible_2',
      tier: 2,
    },
  ],
  abilities: [
    { id: 'contar', family: 'movement', max_tier: 1, energy_cost: 2, cooldown_ticks: 2 },
    { id: 'comparar', family: 'interaction', max_tier: 1, energy_cost: 2, cooldown_ticks: 2 },
    {
      id: 'leer-etiqueta',
      family: 'perception',
      max_tier: 1,
      energy_cost: 2,
      cooldown_ticks: 2,
    },
  ],
  nodes: [
    {
      id: 'casa',
      label_md: 'Tu casa',
      description_md: 'Aquí empieza el plan: sabes cuánto tienes y adónde quieres llegar.',
      kind: 'start',
      x: 80,
      y: 270,
      hidden: false,
      checkpoint: true,
      currency_reward: 0,
    },
    {
      id: 'tiendita',
      label_md: 'La tiendita',
      description_md: 'Un lugar seguro para practicar: aquí nadie te apura.',
      kind: 'tutorial',
      x: 230,
      y: 130,
      hidden: false,
      checkpoint: false,
      teaches_family: 'movement',
      grants: { ability: 'contar', tier: 1 },
      currency_reward: 0,
      image_slot: 'node_tutorial',
    },
    {
      id: 'puesto',
      label_md: 'El puesto de fruta',
      description_md: 'Dos precios, la misma fruta. Aquí aprendes a comparar.',
      kind: 'tutorial',
      x: 230,
      y: 400,
      hidden: false,
      checkpoint: false,
      teaches_family: 'interaction',
      grants: { ability: 'comparar', tier: 1 },
      currency_reward: 0,
      image_slot: 'node_tutorial',
    },
    {
      id: 'libreria',
      label_md: 'La papelería',
      description_md: 'Todo trae etiqueta. Aquí aprendes a leerla antes de pagar.',
      kind: 'tutorial',
      x: 400,
      y: 90,
      hidden: false,
      checkpoint: false,
      teaches_family: 'perception',
      grants: { ability: 'leer-etiqueta', tier: 1 },
      currency_reward: 0,
      image_slot: 'node_tutorial',
    },
    {
      id: 'feria',
      label_md: 'La feria del barrio',
      kind: 'plain',
      x: 230,
      y: 270,
      hidden: false,
      checkpoint: false,
      currency_reward: 10,
      challenge: {
        prompt_md: 'Traes 20 pesos y quieres una bici de 200. ¿Qué te acerca más a la bici?',
        options: [
          { id: 'a', label_md: 'Guardar 10 y gastar 10', correct: true },
          {
            id: 'b',
            label_md: 'Gastar los 20 en juegos',
            correct: false,
            rationale_md: 'Gastarlo todo hoy deja tu meta exactamente donde estaba ayer.',
          },
          {
            id: 'c',
            label_md: 'Pedir prestado para comprarla hoy',
            correct: false,
            rationale_md: 'Pedir prestado no crea dinero: lo mueve, y luego hay que regresarlo.',
          },
        ],
      },
    },
    {
      id: 'mercado',
      label_md: 'El mercado',
      description_md: 'Aquí puedes descansar y guardar tu avance.',
      kind: 'plain',
      x: 430,
      y: 300,
      hidden: false,
      checkpoint: true,
      currency_reward: 15,
      challenge: {
        prompt_md: 'Dos bolsas de arroz iguales: una cuesta 18 y otra 22. ¿Cuál llevas?',
        options: [
          { id: 'a', label_md: 'La de 18', correct: true },
          {
            id: 'b',
            label_md: 'La de 22, se ve mejor',
            correct: false,
            rationale_md: 'Si el producto es el mismo, pagar más no te da más: te deja con menos.',
          },
        ],
      },
      image_slot: 'node_checkpoint',
    },
    {
      id: 'alcancia',
      label_md: 'La alcancía grande',
      description_md: 'La prueba de verdad: cuánto guardas y por qué.',
      kind: 'boss',
      x: 600,
      y: 200,
      hidden: false,
      checkpoint: false,
      collectible: 'estampa-ahorro',
      currency_reward: 25,
      challenge: {
        prompt_md: 'Ahorras 10 pesos por semana. ¿Cuánto tendrás en 4 semanas?',
        options: [
          { id: 'a', label_md: '40 pesos', correct: true },
          {
            id: 'b',
            label_md: '14 pesos',
            correct: false,
            rationale_md: 'Ahí sumaste 10 más 4. Ahorrar 10 cada semana se suma cuatro veces.',
          },
          {
            id: 'c',
            label_md: '10 pesos',
            correct: false,
            rationale_md: 'Ese es solo el ahorro de la primera semana; las otras tres también cuentan.',
          },
        ],
      },
      image_slot: 'node_boss',
    },
    {
      id: 'banquito',
      label_md: 'El banquito de la escuela',
      kind: 'plain',
      x: 600,
      y: 430,
      hidden: false,
      checkpoint: false,
      currency_reward: 10,
      challenge: {
        prompt_md: 'Guardar el dinero en un lugar seguro sirve sobre todo para…',
        options: [
          { id: 'a', label_md: 'No gastarlo sin pensar', correct: true },
          {
            id: 'b',
            label_md: 'Que crezca solito de la nada',
            correct: false,
            rationale_md: 'Guardar protege lo que ya juntaste; el dinero no aparece por guardarlo.',
          },
        ],
      },
    },
    {
      id: 'bodega',
      label_md: 'La bodega olvidada',
      description_md: 'Un lugar opcional: no lo necesitas para llegar, pero guarda algo.',
      kind: 'shrine',
      x: 760,
      y: 130,
      hidden: true,
      checkpoint: false,
      collectible: 'recibo',
      currency_reward: 20,
      image_slot: 'node_shrine',
    },
    {
      id: 'meta-bici',
      label_md: 'La bici de la meta',
      description_md: 'Llegaste con un plan, no con suerte.',
      kind: 'goal',
      x: 830,
      y: 400,
      hidden: false,
      checkpoint: false,
      currency_reward: 0,
      image_slot: 'node_goal',
    },
  ],
  edges: [
    { id: 'e-casa-tiendita', from: 'casa', to: 'tiendita', one_way: false, lock: null },
    { id: 'e-casa-puesto', from: 'casa', to: 'puesto', one_way: false, lock: null },
    { id: 'e-casa-feria', from: 'casa', to: 'feria', one_way: false, lock: null },
    {
      id: 'e-tiendita-libreria',
      from: 'tiendita',
      to: 'libreria',
      one_way: false,
      lock: {
        kind: 'hard',
        requires: [{ ability: 'contar', tier: 1 }],
        sequence: false,
        hint_md: 'Para entrar hay que saber cuánto traes.',
      },
    },
    {
      id: 'e-puesto-mercado',
      from: 'puesto',
      to: 'mercado',
      one_way: false,
      lock: {
        kind: 'hard',
        requires: [{ ability: 'comparar', tier: 1 }],
        sequence: false,
        hint_md: 'El paso se abre cuando puedes comparar dos precios.',
      },
    },
    { id: 'e-feria-mercado', from: 'feria', to: 'mercado', one_way: false, lock: null },
    { id: 'e-mercado-alcancia', from: 'mercado', to: 'alcancia', one_way: false, lock: null },
    {
      id: 'e-libreria-banquito',
      from: 'libreria',
      to: 'banquito',
      one_way: false,
      lock: {
        kind: 'soft',
        requires: [{ ability: 'leer-etiqueta', tier: 1 }],
        sequence: false,
        // The sequence-breaking dial: two solved challenges get you past this without
        // the ability at all.
        skill_required: 2,
        hint_md: 'Se abre leyendo la etiqueta, o con lo que ya practicaste.',
      },
    },
    {
      id: 'e-alcancia-bodega',
      from: 'alcancia',
      to: 'bodega',
      one_way: false,
      lock: {
        kind: 'temporal',
        requires: [],
        sequence: false,
        requires_visited: 'libreria',
        hint_md: 'Alguien de la papelería sabe cómo se abre esta puerta.',
      },
    },
    { id: 'e-banquito-meta', from: 'banquito', to: 'meta-bici', one_way: false, lock: null },
    // A one-way shortcut: from the bodega you can drop straight down to the goal, but
    // never climb back up this way.
    { id: 'e-bodega-meta', from: 'bodega', to: 'meta-bici', one_way: true, lock: null },
  ],
  start_node: 'casa',
  goal_node: 'meta-bici',
  feedback: {
    correct_md: ['¡Ese camino se abrió!', 'Buen plan.', 'Eso te acerca a la meta.'],
    incorrect_md: [
      'Casi. Vuelve a mirar cuánto entra y cuánto sale.',
      'Otra vuelta: ¿qué te deja más cerca de la bici?',
    ],
    results_md:
      'Ahorrar es un mapa: cada cosa que aprendes abre un camino nuevo, y lo que guardas te acerca a la meta.',
  },
}

const savingsMap: GameDocument = {
  schema_version: 1,
  meta: {
    slug: 'el-mapa-del-ahorro',
    title: 'El mapa del ahorro',
    locale: 'es-MX',
    mechanic: 'explorer',
    concept: {
      topic_path: 'mi-primer-dinero/guardar-para-despues/el-plan-de-ahorro',
      recap_md:
        'Aprendiste que **ahorrar** es guardar hoy un poquito para alcanzar algo más grande después, y que cada peso guardado te acerca a tu meta.',
    },
    tier: 1,
    estimated_minutes: 4,
    cast: ['dina'],
  },
  skin: {
    palette: 'forest-pear',
    sprites: {},
    sfx: { unlock: 'flip', take: 'collect', rest: 'hint', arrive: 'drop' },
  },
  config: savingsConfig,
  content: savingsContent,
  scoring: { mode: 'cheer', xp_max: 12, pass_score: 70, lives: null, target: 10 },
}

// ---- 2. La ruta del presupuesto (tier 3, arcade) --------------------------------

const budgetConfig: ExplorerConfig = {
  map: { width: 1000, height: 600, node_radius: 30 },
  // Tier 3: every step costs a little, so a wandering route is a worse route.
  movement: { ticks_per_edge: 2, energy_per_move: 1 },
  energy: {
    max: 20,
    start: 20,
    regen_interval_ticks: 3,
    regen_amount: 2,
    rest_restores: 12,
  },
  abilities: {
    max_tier: 2,
    // Two fragments make a tier: the compound lock below needs a tier-2 ability, so the
    // upgrade path is load-bearing rather than decorative.
    fragments_per_tier: 2,
    upgrade_depth: 1,
    tutorial_room_per_family: true,
  },
  locks: {
    mix: { hard_pct: 40, soft_pct: 20, compound_pct: 25, temporal_pct: 15 },
    mix_tolerance_pct: 12,
    soft_skill_default: 4,
    max_sequence_length: 3,
  },
  connectivity: {
    min_nodes: 10,
    max_nodes: 20,
    locked_edge_pct_min: 30,
    locked_edge_pct_max: 60,
    shortcut_pct_min: 5,
    shortcut_pct_max: 30,
  },
  optional: {
    hidden_pct_min: 0,
    hidden_pct_max: 25,
    // Tier 3: the hidden place really is invisible until you can see it.
    reveal_requires_perception: true,
  },
  collectibles: { enabled: true, target: 3 },
  currency: { start: 25, target: 120, purchase_enabled: true },
  death: {
    currency_loss_pct: 30,
    // Not all of it comes back at this tier: the trip is still worth making, and it
    // still costs something. That difference is the lesson.
    cache_recoverable_pct: 80,
    costs_life: true,
    respawn_energy: 12,
  },
  challenge: { attempts: 2, wrong_currency_cost: 10, mastery_per_solve: 1 },
  checkpoints: { start_is_checkpoint: true, rest_only_at_checkpoint: true },
  ending: { exploration_pct_required: 85, require_goal_node: true },
  signposts: {
    hard: { tone: 'primary', shape: 'square', sfx: 'flip' },
    soft: { tone: 'success', shape: 'circle', sfx: 'hint' },
    compound: { tone: 'delight', shape: 'hexagon', sfx: 'match' },
    temporal: { tone: 'warning', shape: 'triangle', sfx: 'streak' },
  },
  // The four "did you find it" signals deliberately sum to 0.6 while EFFICIENCY carries
  // 0.4. That is a structural property, not a taste: a run that flails for the whole
  // session scores 0 on efficiency and therefore CANNOT exceed 60, which is below
  // `pass_score` — so the §9 random bot fails by construction rather than by luck,
  // however long it mashes. A thorough child stays inside the action budget and scores
  // the full 100 on it, so the same rule costs honest play nothing.
  score_weights: {
    exploration: 0.2,
    abilities: 0.15,
    collectibles: 0.1,
    currency: 0.15,
    efficiency: 0.4,
  },
  penalties: { death_pct: 5, wrong_answer_pct: 3 },
  tick_budget: 7200,
  action_budget: 140,
}

const budgetContent: ExplorerContent = {
  items: [
    {
      id: 'presupuestar',
      label_md: 'Hacer un presupuesto',
      icon: 'calculate',
      image_slot: 'ability_1',
      tier: 2,
    },
    {
      id: 'comparar-costos',
      label_md: 'Comparar el costo total',
      icon: 'balance',
      image_slot: 'ability_2',
      tier: 2,
    },
    {
      id: 'leer-letras',
      label_md: 'Leer las letras chiquitas',
      icon: 'visibility',
      image_slot: 'ability_3',
      tier: 3,
    },
    {
      id: 'negociar',
      label_md: 'Negociar el precio',
      icon: 'handshake',
      image_slot: 'ability_4',
      tier: 3,
    },
    {
      id: 'contrato',
      label_md: 'Contrato firmado',
      icon: 'contract',
      image_slot: 'collectible_1',
      tier: 3,
    },
    { id: 'cupon', label_md: 'Cupón de descuento', icon: 'sell', image_slot: 'collectible_2', tier: 2 },
    {
      id: 'factura',
      label_md: 'Factura del almacén',
      icon: 'receipt_long',
      image_slot: 'collectible_3',
      tier: 3,
    },
  ],
  abilities: [
    {
      id: 'presupuestar',
      family: 'movement',
      max_tier: 2,
      energy_cost: 3,
      cooldown_ticks: 4,
    },
    {
      id: 'comparar-costos',
      family: 'interaction',
      max_tier: 1,
      energy_cost: 3,
      cooldown_ticks: 4,
    },
    { id: 'leer-letras', family: 'perception', max_tier: 1, energy_cost: 3, cooldown_ticks: 4 },
    { id: 'negociar', family: 'interaction', max_tier: 1, energy_cost: 4, cooldown_ticks: 6 },
  ],
  nodes: [
    {
      id: 'terminal',
      label_md: 'La terminal',
      description_md: 'El punto de partida. Aquí siempre puedes volver.',
      kind: 'start',
      x: 70,
      y: 300,
      hidden: false,
      checkpoint: true,
      currency_reward: 0,
    },
    {
      id: 'aula-presupuesto',
      label_md: 'El aula del presupuesto',
      kind: 'tutorial',
      x: 200,
      y: 120,
      hidden: false,
      checkpoint: false,
      teaches_family: 'movement',
      grants: { ability: 'presupuestar', tier: 1 },
      currency_reward: 0,
      image_slot: 'node_tutorial',
    },
    {
      id: 'taller-costos',
      label_md: 'El taller de costos',
      kind: 'tutorial',
      x: 200,
      y: 300,
      hidden: false,
      checkpoint: false,
      teaches_family: 'interaction',
      grants: { ability: 'comparar-costos', tier: 1 },
      currency_reward: 0,
      image_slot: 'node_tutorial',
    },
    {
      id: 'sala-letras',
      label_md: 'La sala de las letras chiquitas',
      kind: 'tutorial',
      x: 200,
      y: 480,
      hidden: false,
      checkpoint: false,
      teaches_family: 'perception',
      grants: { ability: 'leer-letras', tier: 1 },
      currency_reward: 0,
      image_slot: 'node_tutorial',
    },
    {
      id: 'plaza',
      label_md: 'La plaza central',
      description_md: 'El cruce de todos los caminos. Aquí se descansa.',
      kind: 'plain',
      x: 380,
      y: 220,
      hidden: false,
      checkpoint: true,
      currency_reward: 30,
      challenge: {
        prompt_md: 'Ganas 300 al mes y tus gastos fijos son 220. ¿Cuánto puedes repartir?',
        options: [
          { id: 'a', label_md: '80', correct: true },
          {
            id: 'b',
            label_md: '300',
            correct: false,
            rationale_md: 'Ese es todo lo que entra; los gastos fijos ya tienen dueño.',
          },
          {
            id: 'c',
            label_md: '220',
            correct: false,
            rationale_md: 'Ese es lo que ya está comprometido, no lo que te queda libre.',
          },
        ],
      },
      image_slot: 'node_checkpoint',
    },
    {
      id: 'tienda-negocio',
      label_md: 'La tienda de trueques',
      description_md: 'Aquí se compra una habilidad, si te alcanza.',
      kind: 'shop',
      x: 380,
      y: 60,
      hidden: false,
      checkpoint: false,
      grants: { ability: 'negociar', tier: 1 },
      price: 60,
      currency_reward: 0,
      image_slot: 'node_shop',
    },
    {
      id: 'fragmento-norte',
      label_md: 'Fragmento del norte',
      kind: 'fragment',
      x: 540,
      y: 90,
      hidden: false,
      checkpoint: false,
      fragment_for: 'presupuestar',
      currency_reward: 10,
      challenge: {
        prompt_md: 'Un gasto fijo es el que…',
        options: [
          { id: 'a', label_md: 'Se repite igual cada mes', correct: true },
          {
            id: 'b',
            label_md: 'Cambia según lo que te den ganas',
            correct: false,
            rationale_md: 'Ese es un gasto variable: tú decides cuánto y cuándo.',
          },
        ],
      },
      image_slot: 'node_fragment',
    },
    {
      id: 'fragmento-sur',
      label_md: 'Fragmento del sur',
      kind: 'fragment',
      x: 540,
      y: 230,
      hidden: false,
      checkpoint: false,
      fragment_for: 'presupuestar',
      currency_reward: 10,
      challenge: {
        prompt_md: 'Si tu presupuesto no cierra, lo primero que se revisa es…',
        options: [
          { id: 'a', label_md: 'Los gastos que puedes cambiar', correct: true },
          {
            id: 'b',
            label_md: 'La cantidad que ahorras, para bajarla a cero',
            correct: false,
            rationale_md: 'Bajar el ahorro a cero cierra el mes y abre el problema del año.',
          },
        ],
      },
      image_slot: 'node_fragment',
    },
    {
      id: 'bodega-contratos',
      label_md: 'La bodega de contratos',
      description_md: 'La prueba grande del presupuesto.',
      kind: 'boss',
      x: 700,
      y: 150,
      hidden: false,
      checkpoint: false,
      collectible: 'contrato',
      currency_reward: 40,
      challenge: {
        prompt_md: 'Un plan de 12 meses a 50 al mes contra pagar 520 de una vez. ¿Cuál cuesta menos?',
        options: [
          { id: 'a', label_md: 'Pagar 520 de una vez', correct: true },
          {
            id: 'b',
            label_md: 'El plan de 50 al mes, se siente más barato',
            correct: false,
            rationale_md: 'Doce veces 50 son 600: se siente más barato cada mes y cuesta más al final.',
          },
          {
            id: 'c',
            label_md: 'Cuestan lo mismo',
            correct: false,
            rationale_md: 'Solo cuestan lo mismo si sumas mal: 600 no es 520.',
          },
        ],
      },
      image_slot: 'node_boss',
    },
    {
      id: 'mirador',
      label_md: 'El mirador escondido',
      description_md: 'Opcional, y solo se ve si sabes mirar.',
      kind: 'shrine',
      x: 860,
      y: 90,
      hidden: true,
      checkpoint: false,
      collectible: 'cupon',
      currency_reward: 25,
      image_slot: 'node_shrine',
    },
    {
      id: 'puente-largo',
      label_md: 'El puente largo',
      description_md: 'Se descansa antes de cruzar.',
      kind: 'plain',
      x: 380,
      y: 480,
      hidden: false,
      checkpoint: true,
      currency_reward: 15,
      challenge: {
        prompt_md: 'Las letras chiquitas de una oferta sirven para…',
        options: [
          { id: 'a', label_md: 'Saber qué te están cobrando de verdad', correct: true },
          {
            id: 'b',
            label_md: 'Rellenar el papel y nada más',
            correct: false,
            rationale_md: 'Ahí es justo donde se esconde lo que cambia el precio final.',
          },
        ],
      },
      image_slot: 'node_checkpoint',
    },
    {
      id: 'almacen',
      label_md: 'El almacén',
      kind: 'plain',
      x: 560,
      y: 480,
      hidden: false,
      checkpoint: false,
      collectible: 'factura',
      currency_reward: 20,
      challenge: {
        prompt_md: 'Comprar en grande sale mejor solo cuando…',
        options: [
          { id: 'a', label_md: 'De verdad lo vas a usar todo', correct: true },
          {
            id: 'b',
            label_md: 'Siempre, porque el precio por pieza baja',
            correct: false,
            rationale_md: 'Lo que se echa a perder no era barato: era dinero tirado.',
          },
        ],
      },
    },
    {
      id: 'feria-ofertas',
      label_md: 'La feria de ofertas',
      kind: 'plain',
      x: 740,
      y: 420,
      hidden: false,
      checkpoint: false,
      currency_reward: 20,
      challenge: {
        prompt_md: 'Una oferta de 2x1 te conviene cuando…',
        options: [
          { id: 'a', label_md: 'Ya ibas a comprar los dos', correct: true },
          {
            id: 'b',
            label_md: 'Siempre, porque uno sale gratis',
            correct: false,
            rationale_md: 'Nada sale gratis si compraste algo que no necesitabas.',
          },
        ],
      },
    },
    {
      id: 'meta-negocio',
      label_md: 'Tu primer negocio',
      description_md: 'Llegaste con las cuentas claras.',
      kind: 'goal',
      x: 930,
      y: 500,
      hidden: false,
      checkpoint: false,
      currency_reward: 0,
      image_slot: 'node_goal',
    },
  ],
  edges: [
    { id: 'e-term-aula', from: 'terminal', to: 'aula-presupuesto', one_way: false, lock: null },
    { id: 'e-term-taller', from: 'terminal', to: 'taller-costos', one_way: false, lock: null },
    { id: 'e-term-sala', from: 'terminal', to: 'sala-letras', one_way: false, lock: null },
    {
      id: 'e-aula-plaza',
      from: 'aula-presupuesto',
      to: 'plaza',
      one_way: false,
      lock: {
        kind: 'hard',
        requires: [{ ability: 'presupuestar', tier: 1 }],
        sequence: false,
        hint_md: 'Solo pasa quien ya sabe repartir lo que entra.',
      },
    },
    { id: 'e-taller-plaza', from: 'taller-costos', to: 'plaza', one_way: false, lock: null },
    { id: 'e-plaza-tienda', from: 'plaza', to: 'tienda-negocio', one_way: false, lock: null },
    {
      id: 'e-plaza-frag-n',
      from: 'plaza',
      to: 'fragmento-norte',
      one_way: false,
      lock: {
        kind: 'hard',
        requires: [{ ability: 'presupuestar', tier: 1 }],
        sequence: false,
        hint_md: 'Se abre con el presupuesto en la mano.',
      },
    },
    {
      id: 'e-plaza-frag-s',
      from: 'plaza',
      to: 'fragmento-sur',
      one_way: false,
      lock: {
        kind: 'soft',
        requires: [{ ability: 'comparar-costos', tier: 1 }],
        sequence: false,
        skill_required: 3,
        hint_md: 'Compara costos, o demuestra que ya sabes hacerlo.',
      },
    },
    {
      id: 'e-plaza-bodega',
      from: 'plaza',
      to: 'bodega-contratos',
      one_way: false,
      lock: {
        // Compound as "A at tier 2": the two fragments are the only way there.
        kind: 'compound',
        requires: [{ ability: 'presupuestar', tier: 2 }],
        sequence: false,
        hint_md: 'Un presupuesto básico no basta: hace falta el completo.',
      },
    },
    {
      id: 'e-bodega-mirador',
      from: 'bodega-contratos',
      to: 'mirador',
      one_way: false,
      lock: {
        kind: 'temporal',
        requires: [],
        sequence: false,
        requires_item: 'contrato',
        hint_md: 'La puerta pide ver el contrato firmado.',
      },
    },
    {
      id: 'e-sala-puente',
      from: 'sala-letras',
      to: 'puente-largo',
      one_way: false,
      lock: {
        kind: 'hard',
        requires: [{ ability: 'leer-letras', tier: 1 }],
        sequence: false,
        hint_md: 'El aviso del puente está en letra chiquita.',
      },
    },
    {
      id: 'e-puente-almacen',
      from: 'puente-largo',
      to: 'almacen',
      one_way: false,
      lock: {
        // The combinatorics lock: two abilities, and they only work IN THIS ORDER.
        kind: 'compound',
        requires: [
          { ability: 'presupuestar', tier: 1 },
          { ability: 'leer-letras', tier: 1 },
        ],
        sequence: true,
        hint_md: 'Primero el presupuesto, después la letra chiquita.',
      },
    },
    {
      id: 'e-almacen-feria',
      from: 'almacen',
      to: 'feria-ofertas',
      one_way: false,
      lock: {
        kind: 'soft',
        requires: [{ ability: 'negociar', tier: 1 }],
        sequence: false,
        skill_required: 5,
        hint_md: 'Negocia el paso, o llega con suficiente práctica.',
      },
    },
    { id: 'e-feria-meta', from: 'feria-ofertas', to: 'meta-negocio', one_way: false, lock: null },
    { id: 'e-puente-plaza', from: 'puente-largo', to: 'plaza', one_way: false, lock: null },
    // Three one-way shortcuts back to the terminal: they shorten the return trip and
    // never open a new path, which is exactly what a shortcut is.
    { id: 'e-mirador-term', from: 'mirador', to: 'terminal', one_way: true, lock: null },
    { id: 'e-almacen-plaza', from: 'almacen', to: 'plaza', one_way: true, lock: null },
    { id: 'e-feria-term', from: 'feria-ofertas', to: 'terminal', one_way: true, lock: null },
  ],
  start_node: 'terminal',
  goal_node: 'meta-negocio',
  interludes: [
    {
      id: 'pausa-1',
      after_round: 2,
      kind: 'pick_one',
      prompt_md: '¿Qué revisas primero cuando el mes no cierra?',
      options: [
        {
          id: 'a',
          label_md: 'Los gastos que sí puedes mover',
          correct: true,
          rationale_md: 'Son los únicos que puedes cambiar esta semana.',
        },
        {
          id: 'b',
          label_md: 'Lo que ya está firmado',
          correct: false,
          rationale_md: 'Un gasto fijo no se mueve por quererlo: por eso se llama fijo.',
        },
      ],
    },
  ],
  feedback: {
    correct_md: ['Camino abierto.', 'Las cuentas te dieron la llave.', 'Eso sí cierra.'],
    incorrect_md: [
      'Casi. Revisa qué entra, qué sale y qué se queda.',
      'Otra vuelta: ¿cuánto cuesta al final, no cada mes?',
    ],
    results_md:
      'Un presupuesto abre puertas: cada cosa que entiendes del dinero es un paso más del mapa que ya puedes caminar.',
  },
}

const budgetRoute: GameDocument = {
  schema_version: 1,
  meta: {
    slug: 'la-ruta-del-presupuesto',
    title: 'La ruta del presupuesto',
    locale: 'es-MX',
    mechanic: 'explorer',
    concept: {
      topic_path: 'planear-mi-dinero/el-presupuesto/entradas-y-salidas',
      recap_md:
        'Aprendiste que un **presupuesto** reparte lo que entra entre lo que sale siempre, lo que sale a veces y lo que se guarda, y que el costo real es el total, no la mensualidad.',
    },
    tier: 3,
    estimated_minutes: 7,
    cast: ['rho', 'zara'],
  },
  skin: {
    palette: 'navy-papaya',
    sprites: {},
    sfx: { unlock: 'flip', take: 'collect', rest: 'hint', arrive: 'drop', death: 'impact' },
    bgm: 'arcade-calm',
  },
  config: budgetConfig,
  content: budgetContent,
  scoring: { mode: 'arcade', xp_max: 25, pass_score: 70, lives: 3, target: 14 },
  adaptive: { enabled: true, ease_after_failures: 2, ease_factor: 0.85, assist_toggleable: true },
}

export const explorerFixtures: GameDocument[] = [savingsMap, budgetRoute]
