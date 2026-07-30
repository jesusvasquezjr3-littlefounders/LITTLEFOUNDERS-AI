// Inline game documents for the mechanics added after the first parity batch
// (launcher, stacker, defender, then autobattler, explorer, flyer) — the data half of
// `game-contract.test.ts`.
//
// WHY THEY LIVE HERE AND NOT IN THE TEST FILE. `game-contract.test.ts` already carries
// the sorter and runner documents inline; three more full manifests would bury the
// assertions under a thousand lines of data. Same rule as `learnFixtures.ts`: the
// fixture module holds the values, the test file holds the argument.
//
// WHY THEY ARE TRANSCRIBED AND NOT IMPORTED. `frontend/` is not a dependency of
// `backend/` (CLAUDE.md §1.2: ten independent packages, no workspaces), so importing
// `frontend/src/game-engine/mechanics/*/fixtures.ts` is impossible at build time and
// would misrepresent what Core can actually reach at runtime. The config/content
// VALUES of each mechanic's first published fixture are transcribed instead, and they
// satisfy the PRODUCTION schemas unmodified — §1.14 forbids a relaxed schema for a
// fixture, and `game-contract.test.ts` asserts the parse of each one explicitly.
//
// Curriculum content only: no child, no PII, nothing that identifies anyone (§1.9).

import type { GameDocument } from '../game-contract/core/types.js';

/** Hard tick ceilings, read off each document's own config rather than guessed:
 *  launcher `config.max_ticks`, stacker `config.round.tick_budget`, defender
 *  `config.tick_budget`. `replayGame` refuses any event past them. */
export const LAUNCHER_MAX_TICKS = 1000;
export const STACKER_MAX_TICKS = 1200;
export const DEFENDER_MAX_TICKS = 2200;

export const LAUNCHER_DOCUMENT: GameDocument = {
  schema_version: 1,
  meta: {
    slug: "tiro-al-ahorro",
    title: "Tiro al ahorro",
    locale: "es-MX",
    mechanic: "launcher",
    concept: {
      topic_path: "dinero-basico/ahorro/guardar-para-una-meta",
      recap_md: "Aprendiste que **ahorrar** es guardar una parte de tu dinero para una **meta**, en vez de gastarlo todo el mismo dia. Ahora apunta: manda cada moneda a la alcancia y a tu meta, no al antojo.",
    },
    tier: 1,
    estimated_minutes: 2,
    cast: [
      "dina",
    ],
  },
  skin: {
    palette: "ocean-blue",
    sprites: {},
    sfx: {
      launch: "launch",
      impact: "impact",
      hit: "correct",
      win: "celebration",
    },
  },
  config: {
    world: {
      width: 900,
      height: 540,
      ground_y: 470,
    },
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
      move: {
        axis: "none",
        min: 0,
        max: 0,
        step: 1,
      },
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
        id: "moneda",
        kind: "standard",
        item_ref: "moneda-10",
        icon: "paid",
        radius: 12,
        gravity_scale_permille: 1000,
        speed_scale_permille: 1000,
        damage: 1,
        bounces: 0,
        restitution_permille: 500,
        friction_permille: 300,
      },
    ],
    aim: {
      trajectory_preview: {
        enabled: true,
        dots: 14,
        tick_step: 3,
      },
    },
    rounds: [
      {
        id: "ronda-alcancia",
        shots: 4,
        max_ticks: 350,
        target_speed_permille: 1000,
        targets: [
          {
            id: "alcancia",
            role: "correct",
            item_ref: "alcancia",
            shape: "box",
            x: 560,
            y: 380,
            w: 90,
            h: 80,
            hp: 1,
            value: 10,
            motion: "static",
            icon: "savings",
          },
          {
            id: "meta",
            role: "correct",
            item_ref: "meta-bici",
            shape: "circle",
            x: 700,
            y: 300,
            w: 80,
            h: 80,
            hp: 1,
            value: 12,
            motion: "static",
            icon: "flag",
          },
          {
            id: "antojo",
            role: "incorrect",
            item_ref: "antojo",
            shape: "box",
            x: 380,
            y: 400,
            w: 70,
            h: 60,
            hp: 1,
            value: 5,
            motion: "static",
            icon: "icecream",
          },
        ],
        obstacles: [],
      },
      {
        id: "ronda-muro",
        shots: 5,
        max_ticks: 400,
        target_speed_permille: 1000,
        targets: [
          {
            id: "alcancia-2",
            role: "correct",
            item_ref: "alcancia",
            shape: "box",
            x: 600,
            y: 390,
            w: 90,
            h: 80,
            hp: 1,
            value: 10,
            motion: "static",
            icon: "savings",
          },
          {
            id: "meta-2",
            role: "correct",
            item_ref: "meta-bici",
            shape: "box",
            x: 740,
            y: 280,
            w: 70,
            h: 70,
            hp: 1,
            value: 12,
            motion: "moving",
            axis: "y",
            amplitude: 40,
            period_ticks: 60,
            icon: "flag",
          },
          {
            id: "antojo-2",
            role: "incorrect",
            item_ref: "antojo",
            shape: "box",
            x: 300,
            y: 400,
            w: 70,
            h: 60,
            hp: 1,
            value: 5,
            motion: "static",
            icon: "icecream",
          },
        ],
        obstacles: [
          {
            id: "muro",
            x: 430,
            y: 300,
            w: 30,
            h: 170,
            material: "deflect",
            restitution_permille: 700,
            friction_permille: 200,
            chain: false,
            icon: "fence",
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
      combo: {
        step: 2,
        max: 3,
      },
    },
    max_ticks: 1000,
  },
  content: {
    items: [
      {
        id: "moneda-10",
        label_md: "Moneda de 10 pesos",
        icon: "paid",
        value: 10,
        tier: 1,
        category: "ahorro",
      },
      {
        id: "alcancia",
        label_md: "Alcancia",
        icon: "savings",
        value: 0,
        tier: 1,
        category: "ahorro",
      },
      {
        id: "meta-bici",
        label_md: "Meta: la bici",
        icon: "flag",
        value: 900,
        tier: 1,
        category: "ahorro",
      },
      {
        id: "antojo",
        label_md: "Antojo del recreo",
        icon: "icecream",
        value: 15,
        tier: 1,
        category: "gasto",
        misconception_md: "El antojo se acaba en un rato y tu moneda ya no vuelve: si toda la moneda se va ahi, la meta nunca llega.",
      },
    ],
    categories: [
      {
        id: "ahorro",
        label_md: "Ahorro",
        description_md: "Donde tu dinero se queda y crece.",
      },
      {
        id: "gasto",
        label_md: "Gasto rapido",
        description_md: "Lo que se acaba el mismo dia.",
      },
    ],
    feedback: {
      correct_md: [
        "Directo a la alcancia.",
        "Esa moneda ya es tuya.",
        "Tu meta esta mas cerca.",
      ],
      incorrect_md: [
        "Esa moneda se fue en el antojo.",
        "Casi: apunta a tu meta.",
      ],
      results_md: "Cada moneda que apuntaste al ahorro te acerco a tu meta. Asi crece una alcancia.",
    },
    roles: {
      correct: [
        "alcancia",
        "meta-bici",
      ],
      incorrect: [
        "antojo",
      ],
    },
  },
  scoring: {
    mode: "cheer",
    xp_max: 10,
    pass_score: 60,
    lives: null,
    target: 4,
  },
};

export const STACKER_DOCUMENT: GameDocument = {
  schema_version: 1,
  meta: {
    slug: "la-torre-de-mi-ahorro",
    title: "La torre de mi ahorro",
    locale: "es-MX",
    mechanic: "stacker",
    concept: {
      topic_path: "mi-primer-dinero/guardar-con-calma/como-se-arma-un-ahorro",
      recap_md: "Aprendiste que un ahorro se arma por **partes**: primero una meta clara, luego guardar poquito seguido, y anotar lo que gastas para no perderte.",
    },
    tier: 1,
    estimated_minutes: 4,
    cast: [
      "dina",
    ],
  },
  skin: {
    palette: "forest-pear",
    sprites: {},
    sfx: {
      place: "build",
      collapse: "impact",
      hold: "streak",
      win: "celebration",
    },
  },
  config: {
    field: {
      width: 900,
      height: 540,
      ground_y: 440,
      base_x: 450,
      base_width: 320,
      baseline_y: 520,
    },
    gravity: {
      intensity: 1.2,
      direction_degrees: 90,
    },
    catalog: [
      {
        item_id: "meta-clara",
        shape: "box",
        w: 300,
        h: 48,
        mass: 6,
        friction: 0.92,
        restitution: 0.02,
        property: "none",
        property_value: 0,
        cost: 20,
        unlock_after_pieces: 0,
        max_uses: 1,
      },
      {
        item_id: "ahorro-semanal",
        shape: "box",
        w: 240,
        h: 44,
        mass: 4,
        friction: 0.9,
        restitution: 0.02,
        property: "none",
        property_value: 0,
        cost: 16,
        unlock_after_pieces: 0,
        max_uses: 2,
      },
      {
        item_id: "gasto-anotado",
        shape: "box",
        w: 180,
        h: 40,
        mass: 3,
        friction: 0.88,
        restitution: 0.02,
        property: "none",
        property_value: 0,
        cost: 12,
        unlock_after_pieces: 0,
        max_uses: 2,
      },
      {
        item_id: "alcancia",
        shape: "box",
        w: 120,
        h: 38,
        mass: 2,
        friction: 0.86,
        restitution: 0.03,
        property: "none",
        property_value: 0,
        cost: 9,
        unlock_after_pieces: 2,
        max_uses: 2,
      },
      {
        item_id: "compra-impulso",
        shape: "circle",
        w: 80,
        h: 80,
        mass: 1,
        friction: 0.14,
        restitution: 0.5,
        property: "elastic",
        property_value: 0.3,
        cost: 14,
        unlock_after_pieces: 0,
        max_uses: 3,
      },
    ],
    placement: {
      mode: "snap",
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
      reposition_cost: 0,
      collapse_refund_pct: 60,
    },
    solver: {
      iterations: 12,
      position_correction: 1,
      sleep_speed: 0.4,
      sleep_ticks: 3,
      rest_speed: 2,
      damping: 0.95,
      wind_area_scale: 4000,
      magnet_pull: 0,
    },
    stability: {
      margin_threshold: 2.2,
      margin_cap: 8,
      hold_ticks: 300,
      target_height: 240,
      contact_epsilon: 2,
    },
    collapse: {
      max_tilt_degrees: 22,
      tilt_min_height: 60,
      max_shift: 100,
      brittle_breaks_run: false,
      grace_ticks: 6,
    },
    timeline: {
      announce_ticks: 40,
      gust_variance: 0.15,
      events: [
        {
          id: "viento-suave",
          at_tick: 20,
          kind: "wind",
          magnitude: 0.85,
          duration_ticks: 60,
        },
        {
          id: "lluvia",
          at_tick: 100,
          kind: "rain",
          magnitude: 12,
          duration_ticks: 80,
        },
        {
          id: "viento-fuerte",
          at_tick: 200,
          kind: "wind",
          magnitude: 1.2,
          duration_ticks: 70,
        },
      ],
    },
    assist: {
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
    score_model: "blend",
    score_weights: {
      height: 0.4,
      stability: 0.15,
      hold: 0.15,
      efficiency: 0.15,
      style: 0.15,
    },
    penalty: {
      collapse_pct: 4,
      reposition_pct: 0,
      avoid_piece_pct: 3,
    },
    round: {
      tick_budget: 1200,
    },
  },
  content: {
    categories: [
      {
        id: "plan",
        label_md: "Mi plan",
        description_md: "Piezas que sostienen el ahorro.",
      },
      {
        id: "tentacion",
        label_md: "Tentación",
        description_md: "Piezas que se ven bien y no sostienen.",
      },
    ],
    items: [
      {
        id: "meta-clara",
        label_md: "Meta clara: $20",
        category: "plan",
        value: 20,
        icon: "flag",
        tier: 1,
        image_slot: "piece_1",
        props: {
          ancho: 300,
          peso: 6,
        },
      },
      {
        id: "ahorro-semanal",
        label_md: "Guardar cada semana: $16",
        category: "plan",
        value: 16,
        icon: "savings",
        tier: 1,
        image_slot: "piece_2",
        props: {
          ancho: 240,
          peso: 4,
        },
      },
      {
        id: "gasto-anotado",
        label_md: "Anotar lo que gasto: $12",
        category: "plan",
        value: 12,
        icon: "edit_note",
        tier: 1,
        image_slot: "piece_3",
        props: {
          ancho: 180,
          peso: 3,
        },
      },
      {
        id: "alcancia",
        label_md: "Alcancía cerrada: $9",
        category: "plan",
        value: 9,
        icon: "lock",
        tier: 2,
        image_slot: "piece_4",
        props: {
          ancho: 120,
          peso: 2,
        },
      },
      {
        id: "compra-impulso",
        label_md: "Compra de antojo: $14",
        category: "tentacion",
        value: 14,
        icon: "shopping_bag",
        tier: 2,
        image_slot: "piece_5",
        misconception_md: "Cuesta casi lo mismo que tu meta y no sostiene nada: es redonda, se rueda y tira la torre.",
        props: {
          ancho: 80,
          peso: 1,
        },
      },
    ],
    interludes: [
      {
        id: "pausa-cimiento",
        after_round: 1,
        kind: "pick_one",
        prompt_md: "¿Qué pieza va hasta abajo para que la torre no se caiga?",
        options: [
          {
            id: "a",
            label_md: "La más ancha y pesada",
            correct: true,
            rationale_md: "Una base ancha reparte el peso y aguanta el viento.",
          },
          {
            id: "b",
            label_md: "La más bonita",
            correct: false,
            rationale_md: "Lo bonito no sostiene: lo que sostiene es la base.",
          },
        ],
      },
    ],
    feedback: {
      correct_md: [
        "¡Bien puesta!",
        "Esa pieza sostiene.",
        "¡Tu plan va tomando forma!",
      ],
      incorrect_md: [
        "Casi. Prueba con algo más ancho abajo.",
        "Otra vuelta: ¿esa pieza sostiene o solo se ve bien?",
      ],
      results_md: "Un plan de ahorro se sostiene igual que una torre: base ancha primero, y guardando algo de dinero para lo que no esperabas.",
    },
    roles: {
      foundation: [
        "meta-clara",
        "ahorro-semanal",
      ],
      avoid: [
        "compra-impulso",
      ],
    },
  },
  scoring: {
    mode: "cheer",
    xp_max: 10,
    pass_score: 65,
    lives: null,
    target: 240,
  },
};

export const DEFENDER_DOCUMENT: GameDocument = {
  schema_version: 1,
  meta: {
    slug: "cuida-tu-alcancia",
    title: "Cuida tu alcancía",
    locale: "es-MX",
    mechanic: "defender",
    concept: {
      topic_path: "mi-primer-dinero/cuidar-lo-que-tengo/gastos-hormiga",
      recap_md: "Aprendiste que los **gastos hormiga** son chiquitos pero llegan muchos, y que guardar una parte de tu dinero te deja listo para lo que viene.",
    },
    tier: 1,
    estimated_minutes: 3,
    cast: [
      "dina",
    ],
  },
  skin: {
    palette: "forest-pear",
    sprites: {},
    sfx: {
      build: "drop",
      kill: "match",
      leak: "tryagain",
      wave: "streak",
      win: "celebration",
    },
  },
  config: {
    grid: {
      cell_size: 56,
      map: [
        "#############",
        "#.#.#.#.#.#.#",
        "#.#.#.#.#.#.#",
        "S===========X",
        "#.#.#.#.#.#.#",
        "#.#.#.#.#.#.#",
        "#############",
      ],
    },
    step_costs: {
      open: 3,
      road: 1,
    },
    build: {
      wall_cost: 12,
      wall_hp: 80,
      max_walls: 4,
      sell_refund_pct: 60,
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
    damage_matrix: [
      {
        damage: "impact",
        armor: "light",
        multiplier_pct: 50,
      },
    ],
    default_multiplier_pct: 100,
    slow: {
      diminishing_pct: 50,
      max_slow_pct: 70,
    },
    enemies: [
      {
        id: "gasto-hormiga",
        item_id: "gasto-hormiga",
        hp: 26,
        armor: "unarmored",
        speed_mcells: 90,
        bounty: 7,
        lives_cost: 1,
        sprite_slot: "enemy_1",
      },
      {
        id: "antojo-grande",
        item_id: "antojo-grande",
        hp: 45,
        armor: "light",
        speed_mcells: 65,
        bounty: 12,
        lives_cost: 1,
        sprite_slot: "enemy_2",
      },
    ],
    towers: [
      {
        id: "torre-ahorro",
        item_id: "torre-ahorro",
        archetype: "single",
        cost: 25,
        range_mcells: 1800,
        fire_interval_ticks: 8,
        damage: 12,
        damage_type: "impact",
        targets_air: false,
        targets_ground: true,
        blocks_path: false,
        default_priority: "first",
        sprite_slot: "tower_single",
      },
      {
        id: "alcancia",
        item_id: "alcancia",
        archetype: "economy",
        cost: 30,
        range_mcells: 0,
        fire_interval_ticks: 1,
        damage: 0,
        damage_type: "impact",
        targets_air: false,
        targets_ground: false,
        income_per_wave: 20,
        blocks_path: false,
        default_priority: "first",
        sprite_slot: "tower_economy",
      },
      {
        id: "torre-brillante",
        item_id: "torre-brillante",
        archetype: "single",
        cost: 85,
        range_mcells: 1900,
        fire_interval_ticks: 22,
        damage: 14,
        damage_type: "impact",
        targets_air: false,
        targets_ground: true,
        blocks_path: false,
        default_priority: "first",
        sprite_slot: "tower_single",
      },
    ],
    waves: [
      {
        id: "primera-tanda",
        groups: [
          {
            enemy: "gasto-hormiga",
            count: 6,
            interval_ticks: 26,
            start_tick: 0,
            entry: 0,
          },
        ],
        bonus_gold: 20,
      },
      {
        id: "segunda-tanda",
        groups: [
          {
            enemy: "gasto-hormiga",
            count: 8,
            interval_ticks: 22,
            start_tick: 0,
            entry: 0,
          },
          {
            enemy: "antojo-grande",
            count: 3,
            interval_ticks: 34,
            start_tick: 60,
            entry: 0,
          },
        ],
        bonus_gold: 30,
      },
      {
        id: "tanda-final",
        groups: [
          {
            enemy: "gasto-hormiga",
            count: 10,
            interval_ticks: 18,
            start_tick: 0,
            entry: 0,
          },
          {
            enemy: "antojo-grande",
            count: 5,
            interval_ticks: 26,
            start_tick: 40,
            entry: 0,
          },
        ],
        bonus_gold: 40,
      },
    ],
    prep_ticks: 50,
    efficiency: {
      wall_budget: 4,
      gold_surplus_target: 120,
    },
    score_weights: {
      defense: 0.5,
      leak_free: 0.2,
      economy: 0.2,
      walls: 0.1,
    },
    leak_penalty_pct: 2,
    tick_budget: 2200,
  },
  content: {
    items: [
      {
        id: "gasto-hormiga",
        label_md: "Gasto hormiga",
        icon: "pest_control",
        tier: 1,
        image_slot: "enemy_1",
        props: {
          costo: 7,
        },
      },
      {
        id: "antojo-grande",
        label_md: "Antojo grande",
        icon: "icecream",
        tier: 2,
        image_slot: "enemy_2",
        props: {
          costo: 12,
        },
      },
      {
        id: "torre-ahorro",
        label_md: "Torre Ahorro",
        icon: "savings",
        tier: 1,
        image_slot: "tower_single",
        props: {
          precio: 25,
        },
      },
      {
        id: "alcancia",
        label_md: "Alcancía que rinde",
        icon: "account_balance",
        tier: 2,
        image_slot: "tower_economy",
        props: {
          precio: 30,
        },
      },
      {
        id: "torre-brillante",
        label_md: "Torre Brillante",
        icon: "auto_awesome",
        tier: 3,
        image_slot: "tower_single",
        props: {
          precio: 85,
          trap: 1,
        },
        misconception_md: "Cuesta más del triple y dispara mucho más lento: se ve increíble, pero con ese dinero compras tres Torres Ahorro.",
      },
    ],
    interludes: [
      {
        id: "pausa-ahorro",
        after_round: 1,
        kind: "pick_one",
        prompt_md: "Te quedan monedas después de la primera tanda. ¿Qué te conviene más?",
        options: [
          {
            id: "a",
            label_md: "Gastarlas todas ya mismo",
            correct: false,
            rationale_md: "Si gastas todo, no te queda nada para la tanda que viene, que es más grande.",
          },
          {
            id: "b",
            label_md: "Guardar una parte para la siguiente tanda",
            correct: true,
            rationale_md: "Lo que guardas te da un poquito más al cerrar la tanda: ahorrar rinde.",
          },
        ],
      },
    ],
    feedback: {
      correct_md: [
        "¡Bien colocada!",
        "Ese lugar sí cubre el camino.",
        "¡Tu alcancía está segura!",
      ],
      incorrect_md: [
        "Casi. Prueba una torre más cerca del camino.",
        "Otra vuelta: ¿esa torre alcanza a los gastos?",
      ],
      results_md: "Guardar una parte de tus monedas te dejó más torres al final que gastarlas todas de golpe.",
    },
  },
  scoring: {
    mode: "cheer",
    xp_max: 10,
    pass_score: 60,
    lives: null,
    target: 32,
  },
};

// ---- The second parity batch: autobattler, explorer, flyer ----------------------
//
// Same provenance and same rules as the three above: the config/content VALUES of each
// mechanic's first published frontend fixture, transcribed (never imported — `frontend/`
// is not a dependency of `backend/`), satisfying the PRODUCTION schemas unmodified.
// Curriculum content only, no PII (§1.9).

/** Hard tick ceilings, read off each document's own config rather than guessed:
 *  autobattler `config.max_ticks`, explorer `config.tick_budget`, flyer
 *  `config.max_ticks`. `replayGame` refuses any event past them. */
export const AUTOBATTLER_MAX_TICKS = 5000;
export const EXPLORER_MAX_TICKS = 4800;
export const FLYER_MAX_TICKS = 720;

export const AUTOBATTLER_DOCUMENT: GameDocument = {
  "schema_version": 1,
  "meta": {
    "slug": "el-equipo-del-ahorro",
    "title": "El equipo del ahorro",
    "locale": "es-MX",
    "mechanic": "autobattler",
    "concept": {
      "topic_path": "mi-primer-dinero/guardar-con-un-plan/el-interes",
      "recap_md": "Aprendiste que el **interés** es lo que tu dinero gana por quedarse guardado, y que casi siempre tiene un **tope**: pasado ese punto, guardar de más ya no paga más."
    },
    "tier": 2,
    "estimated_minutes": 5,
    "cast": [
      "dina",
      "liruf"
    ]
  },
  "skin": {
    "palette": "forest-pear",
    "sprites": {},
    "sfx": {
      "buy": "drop",
      "merge": "match",
      "win": "celebration",
      "lose": "tryagain",
      "interest": "streak"
    }
  },
  "config": {
    "board": {
      "cols": 3,
      "rows": 2,
      "cell_size": 84,
      "team_size": 4,
      "bench_size": 4
    },
    "shop": {
      "offers": 3,
      "refresh_cost": 2,
      "rarity_by_level": [
        [
          80,
          20,
          0,
          0
        ],
        [
          55,
          35,
          10,
          0
        ],
        [
          35,
          40,
          20,
          5
        ]
      ],
      "level": {
        "max": 3,
        "xp_cost": 4,
        "xp_per_purchase": 4,
        "xp_per_buy": 1,
        "xp_needed": [
          4,
          6,
          99
        ],
        "units_by_level": [
          3,
          4,
          4
        ]
      }
    },
    "merge": {
      "copies_needed": 3,
      "max_star": 2,
      "star_multipliers": [
        1,
        1.8
      ]
    },
    "economy": {
      "start_gold": 10,
      "base_income": 4,
      "income_growth_per_round": 1,
      "income_cap": 8,
      "interest": {
        "gold_per_step": 5,
        "amount_per_step": 1,
        "max_steps": 3
      },
      "streak": {
        "win_bonus": [
          1,
          2,
          3
        ],
        "loss_bonus": [
          0,
          1,
          2
        ]
      },
      "sell_refund_pct": 100
    },
    "combat": {
      "engine_ticks_per_combat_tick": 10,
      "max_combat_ticks": 60,
      "timeout_result": "most_units",
      "targeting": "closest",
      "min_damage": 1,
      "crit_chance_pct": 0,
      "crit_multiplier_pct": 150,
      "adjacency": {
        "enabled": true,
        "per_neighbour_damage_pct": 5,
        "per_neighbour_armour": 1,
        "same_trait_only": false
      }
    },
    "health": {
      "start": 20,
      "base_damage": 2,
      "per_round": 1,
      "per_survivor": 1
    },
    "prep": {
      "max_ticks": 240,
      "auto_merge": true
    },
    "units": [
      {
        "id": "ahorrador",
        "item_id": "ahorrador",
        "rarity": 1,
        "cost": 1,
        "traits": [
          "ahorro"
        ],
        "stats": {
          "hp": 220,
          "damage": 30,
          "armour": 5,
          "attack_interval": 2,
          "range": 1200,
          "move_speed": 500,
          "mana_max": 40,
          "mana_per_attack": 12,
          "mana_on_damaged": 4
        },
        "ability": {
          "kind": "shield",
          "power": 30,
          "radius": 0
        },
        "sprite_slot": "unit_1"
      },
      {
        "id": "alcancia",
        "item_id": "alcancia",
        "rarity": 1,
        "cost": 1,
        "traits": [
          "ahorro",
          "escudo"
        ],
        "stats": {
          "hp": 300,
          "damage": 20,
          "armour": 10,
          "attack_interval": 3,
          "range": 1100,
          "move_speed": 400,
          "mana_max": 50,
          "mana_per_attack": 12,
          "mana_on_damaged": 6
        },
        "ability": {
          "kind": "heal",
          "power": 45,
          "radius": 0
        },
        "sprite_slot": "unit_2"
      },
      {
        "id": "interes",
        "item_id": "interes",
        "rarity": 2,
        "cost": 2,
        "traits": [
          "ahorro",
          "interes"
        ],
        "stats": {
          "hp": 190,
          "damage": 42,
          "armour": 3,
          "attack_interval": 2,
          "range": 3000,
          "move_speed": 450,
          "mana_max": 30,
          "mana_per_attack": 14,
          "mana_on_damaged": 4
        },
        "ability": {
          "kind": "burst",
          "power": 120,
          "radius": 0
        },
        "targeting": "lowest_health",
        "sprite_slot": "unit_3"
      },
      {
        "id": "gasto-hormiga",
        "item_id": "gasto-hormiga",
        "rarity": 2,
        "cost": 2,
        "traits": [
          "gasto"
        ],
        "stats": {
          "hp": 200,
          "damage": 38,
          "armour": 4,
          "attack_interval": 2,
          "range": 1200,
          "move_speed": 550,
          "mana_max": 40,
          "mana_per_attack": 14,
          "mana_on_damaged": 5
        },
        "ability": {
          "kind": "empower",
          "power": 40,
          "radius": 0
        },
        "sprite_slot": "unit_4"
      },
      {
        "id": "presupuesto",
        "item_id": "presupuesto",
        "rarity": 3,
        "cost": 3,
        "traits": [
          "interes",
          "escudo"
        ],
        "stats": {
          "hp": 280,
          "damage": 45,
          "armour": 8,
          "attack_interval": 2,
          "range": 2200,
          "move_speed": 500,
          "mana_max": 50,
          "mana_per_attack": 16,
          "mana_on_damaged": 6
        },
        "ability": {
          "kind": "splash",
          "power": 100,
          "radius": 1600
        },
        "sprite_slot": "unit_5"
      }
    ],
    "traits": [
      {
        "id": "ahorro",
        "item_id": "trait-ahorro",
        "scope": "team",
        "thresholds": [
          {
            "count": 2,
            "damage_pct": 0,
            "hp_pct": 15,
            "armour": 3,
            "attack_speed_pct": 0
          },
          {
            "count": 3,
            "damage_pct": 0,
            "hp_pct": 15,
            "armour": 4,
            "attack_speed_pct": 0
          }
        ]
      },
      {
        "id": "interes",
        "item_id": "trait-interes",
        "scope": "trait",
        "thresholds": [
          {
            "count": 1,
            "damage_pct": 15,
            "hp_pct": 0,
            "armour": 0,
            "attack_speed_pct": 0
          },
          {
            "count": 2,
            "damage_pct": 20,
            "hp_pct": 0,
            "armour": 0,
            "attack_speed_pct": 10
          }
        ]
      },
      {
        "id": "escudo",
        "item_id": "trait-escudo",
        "scope": "trait",
        "thresholds": [
          {
            "count": 2,
            "damage_pct": 0,
            "hp_pct": 10,
            "armour": 8,
            "attack_speed_pct": 0
          }
        ]
      },
      {
        "id": "gasto",
        "item_id": "trait-gasto",
        "scope": "trait",
        "thresholds": [
          {
            "count": 1,
            "damage_pct": 25,
            "hp_pct": 0,
            "armour": 0,
            "attack_speed_pct": 0
          }
        ]
      }
    ],
    "items": [
      {
        "id": "moneda-extra",
        "item_id": "moneda-extra",
        "damage": 6,
        "hp": 0,
        "armour": 0,
        "attack_speed_pct": 0,
        "combines_with": "libreta",
        "combines_into": "plan-de-ahorro"
      },
      {
        "id": "libreta",
        "item_id": "libreta",
        "damage": 0,
        "hp": 40,
        "armour": 3,
        "attack_speed_pct": 0
      },
      {
        "id": "plan-de-ahorro",
        "item_id": "plan-de-ahorro",
        "damage": 10,
        "hp": 60,
        "armour": 4,
        "attack_speed_pct": 10
      }
    ],
    "opponents": [
      {
        "id": "rival-ahorrador",
        "item_id": "rival-ahorrador",
        "profile": "saver",
        "power_pct": 84,
        "error_rate_pct": 8,
        "units": [
          {
            "unit_id": "ahorrador",
            "star": 1,
            "col": 0,
            "row": 0
          },
          {
            "unit_id": "ahorrador",
            "star": 1,
            "col": 2,
            "row": 0
          },
          {
            "unit_id": "alcancia",
            "star": 1,
            "col": 1,
            "row": 1
          }
        ],
        "sprite_slot": "opponent_1"
      },
      {
        "id": "rival-gastalon",
        "item_id": "rival-gastalon",
        "profile": "synergy",
        "power_pct": 76,
        "error_rate_pct": 0,
        "units": [
          {
            "unit_id": "gasto-hormiga",
            "star": 1,
            "col": 0,
            "row": 0
          },
          {
            "unit_id": "gasto-hormiga",
            "star": 1,
            "col": 2,
            "row": 0
          },
          {
            "unit_id": "alcancia",
            "star": 1,
            "col": 1,
            "row": 1
          },
          {
            "unit_id": "interes",
            "star": 1,
            "col": 0,
            "row": 1
          }
        ],
        "sprite_slot": "opponent_2"
      },
      {
        "id": "rival-espejo",
        "item_id": "rival-espejo",
        "profile": "mirror",
        "power_pct": 72,
        "error_rate_pct": 0,
        "units": [],
        "sprite_slot": "opponent_3"
      }
    ],
    "camps": [
      {
        "id": "camp-monedas",
        "item_id": "camp-monedas",
        "power_pct": 58,
        "units": [
          {
            "unit_id": "ahorrador",
            "star": 1,
            "col": 0,
            "row": 0
          },
          {
            "unit_id": "ahorrador",
            "star": 1,
            "col": 2,
            "row": 0
          },
          {
            "unit_id": "alcancia",
            "star": 1,
            "col": 1,
            "row": 1
          }
        ],
        "drops": [
          "moneda-extra"
        ],
        "sprite_slot": "opponent_4"
      },
      {
        "id": "camp-gastos",
        "item_id": "camp-gastos",
        "power_pct": 68,
        "units": [
          {
            "unit_id": "gasto-hormiga",
            "star": 1,
            "col": 0,
            "row": 0
          },
          {
            "unit_id": "gasto-hormiga",
            "star": 1,
            "col": 2,
            "row": 0
          },
          {
            "unit_id": "alcancia",
            "star": 1,
            "col": 1,
            "row": 1
          }
        ],
        "drops": [
          "libreta"
        ],
        "sprite_slot": "opponent_5"
      }
    ],
    "opponent_profiles": {
      "saver": {
        "early_power_pct": 70,
        "late_power_pct": 120,
        "late_from_round": 4,
        "adaptive_per_win_pct": 0,
        "team_bonus_pct": 0,
        "mirror": false
      },
      "rush": {
        "early_power_pct": 120,
        "late_power_pct": 80,
        "late_from_round": 4,
        "adaptive_per_win_pct": 0,
        "team_bonus_pct": 0,
        "mirror": false
      },
      "synergy": {
        "early_power_pct": 90,
        "late_power_pct": 100,
        "late_from_round": 3,
        "adaptive_per_win_pct": 0,
        "team_bonus_pct": 15,
        "mirror": false
      },
      "mirror": {
        "early_power_pct": 100,
        "late_power_pct": 100,
        "late_from_round": 1,
        "adaptive_per_win_pct": 0,
        "team_bonus_pct": 0,
        "mirror": true
      },
      "adaptive": {
        "early_power_pct": 85,
        "late_power_pct": 95,
        "late_from_round": 3,
        "adaptive_per_win_pct": 5,
        "team_bonus_pct": 0,
        "mirror": false
      }
    },
    "rounds": [
      {
        "kind": "pve",
        "camp_id": "camp-monedas"
      },
      {
        "kind": "pvp",
        "opponent_id": "rival-ahorrador"
      },
      {
        "kind": "pve",
        "camp_id": "camp-gastos"
      },
      {
        "kind": "pvp",
        "opponent_id": "rival-gastalon"
      },
      {
        "kind": "pvp",
        "opponent_id": "rival-espejo"
      },
      {
        "kind": "pvp",
        "opponent_id": "rival-ahorrador"
      }
    ],
    "score_weights": {
      "rounds": 0.4,
      "health": 0.2,
      "interest": 0.4
    },
    "targets": {
      "rounds_won": 5,
      "interest": 14
    },
    "loss_penalty_pct": 2,
    "max_ticks": 5000
  },
  "content": {
    "categories": [
      {
        "id": "equipo",
        "label_md": "Tu equipo",
        "description_md": "Los que pelean por tu plan."
      },
      {
        "id": "rivales",
        "label_md": "Rivales",
        "description_md": "Quienes retan tu presupuesto."
      },
      {
        "id": "objetos",
        "label_md": "Objetos",
        "description_md": "Lo que sueltan los campamentos."
      }
    ],
    "items": [
      {
        "id": "ahorrador",
        "label_md": "Ahorrador",
        "category": "equipo",
        "icon": "savings",
        "value": 1,
        "image_slot": "unit_1",
        "props": {
          "costo": 1
        }
      },
      {
        "id": "alcancia",
        "label_md": "Alcancía",
        "category": "equipo",
        "icon": "account_balance_wallet",
        "value": 1,
        "image_slot": "unit_2",
        "props": {
          "costo": 1
        }
      },
      {
        "id": "interes",
        "label_md": "Interés",
        "category": "equipo",
        "icon": "trending_up",
        "value": 2,
        "image_slot": "unit_3",
        "props": {
          "costo": 2
        }
      },
      {
        "id": "gasto-hormiga",
        "label_md": "Gasto hormiga",
        "category": "equipo",
        "icon": "local_cafe",
        "value": 2,
        "image_slot": "unit_4",
        "misconception_md": "Pega fuerte al principio, pero cada compra chiquita te deja sin monedas que guardar.",
        "props": {
          "costo": 2
        }
      },
      {
        "id": "presupuesto",
        "label_md": "Presupuesto",
        "category": "equipo",
        "icon": "receipt_long",
        "value": 3,
        "image_slot": "unit_5",
        "props": {
          "costo": 3
        }
      },
      {
        "id": "trait-ahorro",
        "label_md": "Ahorro",
        "icon": "shield_moon",
        "image_slot": "trait_1"
      },
      {
        "id": "trait-interes",
        "label_md": "Interés",
        "icon": "percent",
        "image_slot": "trait_2"
      },
      {
        "id": "trait-escudo",
        "label_md": "Colchón",
        "icon": "security",
        "image_slot": "trait_3"
      },
      {
        "id": "trait-gasto",
        "label_md": "Gasto",
        "icon": "shopping_bag",
        "image_slot": "trait_4"
      },
      {
        "id": "rival-ahorrador",
        "label_md": "La que guarda primero",
        "category": "rivales",
        "icon": "group",
        "image_slot": "opponent_1"
      },
      {
        "id": "rival-gastalon",
        "label_md": "El que gasta todo",
        "category": "rivales",
        "icon": "shopping_cart",
        "image_slot": "opponent_2",
        "misconception_md": "Se ve poderoso, pero gastó todo y no le quedó nada para la ronda siguiente."
      },
      {
        "id": "rival-espejo",
        "label_md": "Tu propio reflejo",
        "category": "rivales",
        "icon": "flip",
        "image_slot": "opponent_3"
      },
      {
        "id": "camp-monedas",
        "label_md": "Campamento de monedas",
        "category": "rivales",
        "icon": "paid",
        "image_slot": "opponent_4"
      },
      {
        "id": "camp-gastos",
        "label_md": "Campamento de antojos",
        "category": "rivales",
        "icon": "icecream",
        "image_slot": "opponent_5"
      },
      {
        "id": "moneda-extra",
        "label_md": "Moneda extra",
        "category": "objetos",
        "icon": "toll",
        "image_slot": "item_1"
      },
      {
        "id": "libreta",
        "label_md": "Libreta de gastos",
        "category": "objetos",
        "icon": "edit_note",
        "image_slot": "item_2"
      },
      {
        "id": "plan-de-ahorro",
        "label_md": "Plan de ahorro",
        "category": "objetos",
        "icon": "workspace_premium",
        "image_slot": "item_3"
      }
    ],
    "interludes": [
      {
        "id": "pausa-interes",
        "after_round": 2,
        "kind": "pick_one",
        "prompt_md": "Tienes 12 monedas. ¿Qué te deja mejor para la próxima ronda?",
        "options": [
          {
            "id": "a",
            "label_md": "Gastarlas todas hoy",
            "correct": false,
            "rationale_md": "Te quedas fuerte una ronda y sin interés para la siguiente."
          },
          {
            "id": "b",
            "label_md": "Guardar hasta el tope y gastar lo que sobra",
            "correct": true,
            "rationale_md": "Así cobras el interés completo y aun así mejoras tu equipo."
          }
        ]
      }
    ],
    "feedback": {
      "correct_md": [
        "¡Tu plan aguantó!",
        "Guardaste y ganaste.",
        "Ese equipo estaba bien pensado."
      ],
      "incorrect_md": [
        "Casi. Revisa cuántas monedas te quedaron guardadas.",
        "Otra vuelta: ¿te faltó equipo o te faltó ahorro?"
      ],
      "results_md": "Guardar hasta el tope del interés y gastar solo lo que sobra te deja fuerte hoy y más rico mañana."
    },
    "tips": {
      "interest_md": "Cada 5 monedas guardadas te pagan 1 al final de la ronda, hasta 3 monedas.",
      "saving_md": "Si gastas todo, el interés se va a cero. Guarda hasta el tope y compra con lo demás."
    }
  },
  "scoring": {
    "mode": "cheer",
    "xp_max": 15,
    "pass_score": 65,
    "lives": null,
    "target": 4
  }
};

export const EXPLORER_DOCUMENT: GameDocument = {
  "schema_version": 1,
  "meta": {
    "slug": "el-mapa-del-ahorro",
    "title": "El mapa del ahorro",
    "locale": "es-MX",
    "mechanic": "explorer",
    "concept": {
      "topic_path": "mi-primer-dinero/guardar-para-despues/el-plan-de-ahorro",
      "recap_md": "Aprendiste que **ahorrar** es guardar hoy un poquito para alcanzar algo más grande después, y que cada peso guardado te acerca a tu meta."
    },
    "tier": 1,
    "estimated_minutes": 4,
    "cast": [
      "dina"
    ]
  },
  "skin": {
    "palette": "forest-pear",
    "sprites": {},
    "sfx": {
      "unlock": "flip",
      "take": "collect",
      "rest": "hint",
      "arrive": "drop"
    }
  },
  "config": {
    "map": {
      "width": 900,
      "height": 540,
      "node_radius": 34
    },
    "movement": {
      "ticks_per_edge": 2,
      "energy_per_move": 0
    },
    "energy": {
      "max": 12,
      "start": 12,
      "regen_interval_ticks": 4,
      "regen_amount": 2,
      "rest_restores": 8
    },
    "abilities": {
      "max_tier": 1,
      "fragments_per_tier": 2,
      "upgrade_depth": 0,
      "tutorial_room_per_family": true
    },
    "locks": {
      "mix": {
        "hard_pct": 50,
        "soft_pct": 25,
        "compound_pct": 0,
        "temporal_pct": 25
      },
      "mix_tolerance_pct": 15,
      "soft_skill_default": 2,
      "max_sequence_length": 2
    },
    "connectivity": {
      "min_nodes": 8,
      "max_nodes": 14,
      "locked_edge_pct_min": 20,
      "locked_edge_pct_max": 60,
      "shortcut_pct_min": 0,
      "shortcut_pct_max": 25
    },
    "optional": {
      "hidden_pct_min": 0,
      "hidden_pct_max": 30,
      "reveal_requires_perception": false
    },
    "collectibles": {
      "enabled": true,
      "target": 2
    },
    "currency": {
      "start": 10,
      "target": 80,
      "purchase_enabled": false
    },
    "death": {
      "currency_loss_pct": 25,
      "cache_recoverable_pct": 100,
      "costs_life": true,
      "respawn_energy": 8
    },
    "challenge": {
      "attempts": 3,
      "wrong_currency_cost": 5,
      "mastery_per_solve": 1
    },
    "checkpoints": {
      "start_is_checkpoint": true,
      "rest_only_at_checkpoint": true
    },
    "ending": {
      "exploration_pct_required": 100,
      "require_goal_node": true
    },
    "signposts": {
      "hard": {
        "tone": "primary",
        "shape": "square",
        "sfx": "flip"
      },
      "soft": {
        "tone": "success",
        "shape": "circle",
        "sfx": "hint"
      },
      "compound": {
        "tone": "delight",
        "shape": "hexagon",
        "sfx": "match"
      },
      "temporal": {
        "tone": "warning",
        "shape": "triangle",
        "sfx": "streak"
      }
    },
    "score_weights": {
      "exploration": 0.2,
      "abilities": 0.15,
      "collectibles": 0.1,
      "currency": 0.15,
      "efficiency": 0.4
    },
    "penalties": {
      "death_pct": 3,
      "wrong_answer_pct": 2
    },
    "tick_budget": 4800,
    "action_budget": 100
  },
  "content": {
    "items": [
      {
        "id": "contar",
        "label_md": "Contar mi dinero",
        "icon": "pin",
        "image_slot": "ability_1",
        "tier": 1
      },
      {
        "id": "comparar",
        "label_md": "Comparar precios",
        "icon": "balance",
        "image_slot": "ability_2",
        "tier": 1
      },
      {
        "id": "leer-etiqueta",
        "label_md": "Leer la etiqueta",
        "icon": "visibility",
        "image_slot": "ability_3",
        "tier": 1
      },
      {
        "id": "estampa-ahorro",
        "label_md": "Estampa de ahorro",
        "icon": "savings",
        "image_slot": "collectible_1",
        "tier": 1
      },
      {
        "id": "recibo",
        "label_md": "Recibo de la compra",
        "icon": "receipt_long",
        "image_slot": "collectible_2",
        "tier": 2
      }
    ],
    "abilities": [
      {
        "id": "contar",
        "family": "movement",
        "max_tier": 1,
        "energy_cost": 2,
        "cooldown_ticks": 2
      },
      {
        "id": "comparar",
        "family": "interaction",
        "max_tier": 1,
        "energy_cost": 2,
        "cooldown_ticks": 2
      },
      {
        "id": "leer-etiqueta",
        "family": "perception",
        "max_tier": 1,
        "energy_cost": 2,
        "cooldown_ticks": 2
      }
    ],
    "nodes": [
      {
        "id": "casa",
        "label_md": "Tu casa",
        "description_md": "Aquí empieza el plan: sabes cuánto tienes y adónde quieres llegar.",
        "kind": "start",
        "x": 80,
        "y": 270,
        "hidden": false,
        "checkpoint": true,
        "currency_reward": 0
      },
      {
        "id": "tiendita",
        "label_md": "La tiendita",
        "description_md": "Un lugar seguro para practicar: aquí nadie te apura.",
        "kind": "tutorial",
        "x": 230,
        "y": 130,
        "hidden": false,
        "checkpoint": false,
        "teaches_family": "movement",
        "grants": {
          "ability": "contar",
          "tier": 1
        },
        "currency_reward": 0,
        "image_slot": "node_tutorial"
      },
      {
        "id": "puesto",
        "label_md": "El puesto de fruta",
        "description_md": "Dos precios, la misma fruta. Aquí aprendes a comparar.",
        "kind": "tutorial",
        "x": 230,
        "y": 400,
        "hidden": false,
        "checkpoint": false,
        "teaches_family": "interaction",
        "grants": {
          "ability": "comparar",
          "tier": 1
        },
        "currency_reward": 0,
        "image_slot": "node_tutorial"
      },
      {
        "id": "libreria",
        "label_md": "La papelería",
        "description_md": "Todo trae etiqueta. Aquí aprendes a leerla antes de pagar.",
        "kind": "tutorial",
        "x": 400,
        "y": 90,
        "hidden": false,
        "checkpoint": false,
        "teaches_family": "perception",
        "grants": {
          "ability": "leer-etiqueta",
          "tier": 1
        },
        "currency_reward": 0,
        "image_slot": "node_tutorial"
      },
      {
        "id": "feria",
        "label_md": "La feria del barrio",
        "kind": "plain",
        "x": 230,
        "y": 270,
        "hidden": false,
        "checkpoint": false,
        "currency_reward": 10,
        "challenge": {
          "prompt_md": "Traes 20 pesos y quieres una bici de 200. ¿Qué te acerca más a la bici?",
          "options": [
            {
              "id": "a",
              "label_md": "Guardar 10 y gastar 10",
              "correct": true
            },
            {
              "id": "b",
              "label_md": "Gastar los 20 en juegos",
              "correct": false,
              "rationale_md": "Gastarlo todo hoy deja tu meta exactamente donde estaba ayer."
            },
            {
              "id": "c",
              "label_md": "Pedir prestado para comprarla hoy",
              "correct": false,
              "rationale_md": "Pedir prestado no crea dinero: lo mueve, y luego hay que regresarlo."
            }
          ]
        }
      },
      {
        "id": "mercado",
        "label_md": "El mercado",
        "description_md": "Aquí puedes descansar y guardar tu avance.",
        "kind": "plain",
        "x": 430,
        "y": 300,
        "hidden": false,
        "checkpoint": true,
        "currency_reward": 15,
        "challenge": {
          "prompt_md": "Dos bolsas de arroz iguales: una cuesta 18 y otra 22. ¿Cuál llevas?",
          "options": [
            {
              "id": "a",
              "label_md": "La de 18",
              "correct": true
            },
            {
              "id": "b",
              "label_md": "La de 22, se ve mejor",
              "correct": false,
              "rationale_md": "Si el producto es el mismo, pagar más no te da más: te deja con menos."
            }
          ]
        },
        "image_slot": "node_checkpoint"
      },
      {
        "id": "alcancia",
        "label_md": "La alcancía grande",
        "description_md": "La prueba de verdad: cuánto guardas y por qué.",
        "kind": "boss",
        "x": 600,
        "y": 200,
        "hidden": false,
        "checkpoint": false,
        "collectible": "estampa-ahorro",
        "currency_reward": 25,
        "challenge": {
          "prompt_md": "Ahorras 10 pesos por semana. ¿Cuánto tendrás en 4 semanas?",
          "options": [
            {
              "id": "a",
              "label_md": "40 pesos",
              "correct": true
            },
            {
              "id": "b",
              "label_md": "14 pesos",
              "correct": false,
              "rationale_md": "Ahí sumaste 10 más 4. Ahorrar 10 cada semana se suma cuatro veces."
            },
            {
              "id": "c",
              "label_md": "10 pesos",
              "correct": false,
              "rationale_md": "Ese es solo el ahorro de la primera semana; las otras tres también cuentan."
            }
          ]
        },
        "image_slot": "node_boss"
      },
      {
        "id": "banquito",
        "label_md": "El banquito de la escuela",
        "kind": "plain",
        "x": 600,
        "y": 430,
        "hidden": false,
        "checkpoint": false,
        "currency_reward": 10,
        "challenge": {
          "prompt_md": "Guardar el dinero en un lugar seguro sirve sobre todo para…",
          "options": [
            {
              "id": "a",
              "label_md": "No gastarlo sin pensar",
              "correct": true
            },
            {
              "id": "b",
              "label_md": "Que crezca solito de la nada",
              "correct": false,
              "rationale_md": "Guardar protege lo que ya juntaste; el dinero no aparece por guardarlo."
            }
          ]
        }
      },
      {
        "id": "bodega",
        "label_md": "La bodega olvidada",
        "description_md": "Un lugar opcional: no lo necesitas para llegar, pero guarda algo.",
        "kind": "shrine",
        "x": 760,
        "y": 130,
        "hidden": true,
        "checkpoint": false,
        "collectible": "recibo",
        "currency_reward": 20,
        "image_slot": "node_shrine"
      },
      {
        "id": "meta-bici",
        "label_md": "La bici de la meta",
        "description_md": "Llegaste con un plan, no con suerte.",
        "kind": "goal",
        "x": 830,
        "y": 400,
        "hidden": false,
        "checkpoint": false,
        "currency_reward": 0,
        "image_slot": "node_goal"
      }
    ],
    "edges": [
      {
        "id": "e-casa-tiendita",
        "from": "casa",
        "to": "tiendita",
        "one_way": false,
        "lock": null
      },
      {
        "id": "e-casa-puesto",
        "from": "casa",
        "to": "puesto",
        "one_way": false,
        "lock": null
      },
      {
        "id": "e-casa-feria",
        "from": "casa",
        "to": "feria",
        "one_way": false,
        "lock": null
      },
      {
        "id": "e-tiendita-libreria",
        "from": "tiendita",
        "to": "libreria",
        "one_way": false,
        "lock": {
          "kind": "hard",
          "requires": [
            {
              "ability": "contar",
              "tier": 1
            }
          ],
          "sequence": false,
          "hint_md": "Para entrar hay que saber cuánto traes."
        }
      },
      {
        "id": "e-puesto-mercado",
        "from": "puesto",
        "to": "mercado",
        "one_way": false,
        "lock": {
          "kind": "hard",
          "requires": [
            {
              "ability": "comparar",
              "tier": 1
            }
          ],
          "sequence": false,
          "hint_md": "El paso se abre cuando puedes comparar dos precios."
        }
      },
      {
        "id": "e-feria-mercado",
        "from": "feria",
        "to": "mercado",
        "one_way": false,
        "lock": null
      },
      {
        "id": "e-mercado-alcancia",
        "from": "mercado",
        "to": "alcancia",
        "one_way": false,
        "lock": null
      },
      {
        "id": "e-libreria-banquito",
        "from": "libreria",
        "to": "banquito",
        "one_way": false,
        "lock": {
          "kind": "soft",
          "requires": [
            {
              "ability": "leer-etiqueta",
              "tier": 1
            }
          ],
          "sequence": false,
          "skill_required": 2,
          "hint_md": "Se abre leyendo la etiqueta, o con lo que ya practicaste."
        }
      },
      {
        "id": "e-alcancia-bodega",
        "from": "alcancia",
        "to": "bodega",
        "one_way": false,
        "lock": {
          "kind": "temporal",
          "requires": [],
          "sequence": false,
          "requires_visited": "libreria",
          "hint_md": "Alguien de la papelería sabe cómo se abre esta puerta."
        }
      },
      {
        "id": "e-banquito-meta",
        "from": "banquito",
        "to": "meta-bici",
        "one_way": false,
        "lock": null
      },
      {
        "id": "e-bodega-meta",
        "from": "bodega",
        "to": "meta-bici",
        "one_way": true,
        "lock": null
      }
    ],
    "start_node": "casa",
    "goal_node": "meta-bici",
    "feedback": {
      "correct_md": [
        "¡Ese camino se abrió!",
        "Buen plan.",
        "Eso te acerca a la meta."
      ],
      "incorrect_md": [
        "Casi. Vuelve a mirar cuánto entra y cuánto sale.",
        "Otra vuelta: ¿qué te deja más cerca de la bici?"
      ],
      "results_md": "Ahorrar es un mapa: cada cosa que aprendes abre un camino nuevo, y lo que guardas te acerca a la meta."
    }
  },
  "scoring": {
    "mode": "cheer",
    "xp_max": 12,
    "pass_score": 70,
    "lives": null,
    "target": 10
  }
};

export const FLYER_DOCUMENT: GameDocument = {
  "schema_version": 1,
  "meta": {
    "slug": "vuelo-de-la-alcancia",
    "title": "Vuelo de la alcancia",
    "locale": "es-MX",
    "mechanic": "flyer",
    "concept": {
      "topic_path": "ahorro/primeras-monedas/guardar-o-gastar",
      "recap_md": "Aprendiste que **guardar** una moneda hoy te acerca a tu meta y que un **antojo** la aleja. Aqui tu energia es tu alcancia: subir gasta, planear y descansar en las corrientes de aire recupera."
    },
    "tier": 1,
    "estimated_minutes": 3,
    "cast": [
      "dina"
    ]
  },
  "skin": {
    "palette": "ocean-blue",
    "sprites": {},
    "sfx": {
      "collect": "collect",
      "hit": "impact",
      "climb": "whoosh",
      "thermal": "powerup",
      "win": "celebration"
    }
  },
  "config": {
    "world": {
      "width": 900,
      "height": 540,
      "avatar_x": 150,
      "mount_w": 64,
      "mount_h": 44,
      "ceiling_y": 40,
      "floor_y": 480
    },
    "mount": {
      "top_speed": 14,
      "min_speed": 3,
      "start_speed": 10,
      "thrust_per_tick": 0.7,
      "drag_per_tick": 0.05,
      "turn_rate_deg": 9,
      "hull": 5,
      "armour": 0,
      "hit_grace_ticks": 12
    },
    "flight": {
      "climb_pitch_deg": 26,
      "dive_pitch_deg": -26,
      "command_ticks": 12,
      "inertia": 0.3,
      "lift_per_tick": 1.4,
      "climb_speed_cost": 1.6,
      "dive_speed_gain": 1.6,
      "stall": {
        "speed": 4.5,
        "recover_speed": 6.5,
        "pitch_deg": -30,
        "sink_per_tick": 3,
        "control_lockout_ticks": 8
      }
    },
    "energy": {
      "capacity": 110,
      "start": 110,
      "glide_band_deg": 8,
      "climb_drain_per_tick": 0.9,
      "glide_regen_per_tick": 1.6,
      "level_regen_per_tick": 0.8,
      "manoeuvre_cost": 2,
      "thermal_regen_per_tick": 3,
      "low_threshold": 35
    },
    "armament": {
      "beam": {
        "enabled": false,
        "damage_per_tick": 0,
        "range_units": 200,
        "width_units": 60,
        "drain_per_tick": 0
      },
      "projectile": {
        "enabled": false,
        "damage": 0,
        "speed_per_tick": 20,
        "cooldown_ticks": 20,
        "energy_cost": 0,
        "range_units": 400,
        "w": 12,
        "h": 8
      },
      "slam": {
        "enabled": false,
        "damage": 0,
        "self_damage": 0,
        "min_speed": 60,
        "energy_cost": 0
      }
    },
    "enemies": [],
    "environment": {
      "thermal": {
        "lift_per_tick": 2.2
      },
      "storm": {
        "visibility_pct": 55,
        "turbulence_deg": 4,
        "drain_per_tick": 0.4
      },
      "obstacle": {
        "damage": 1
      }
    },
    "weather": {
      "turbulence_deg": 1.2,
      "crosswind_per_tick": 0,
      "rain": {
        "enabled": false,
        "douses": "none",
        "effectiveness_pct": 100
      }
    },
    "lanes": {
      "enabled": false,
      "count": 1,
      "spacing_units": 100,
      "shift_ticks": 6,
      "hit_band": 0.4,
      "energy_cost": 0
    },
    "upgrades": {
      "turn_speed_bonus_deg": 0,
      "energy_capacity_bonus": 0,
      "attack_element": "none",
      "element_multiplier": 1,
      "armour_bonus": 0,
      "damage_bonus_pct": 0
    },
    "spawn": {
      "lead_units": 220,
      "min_gap_units": 160,
      "max_gap_units": 260,
      "patterns": [
        {
          "id": "ruta-alta",
          "weight": 5,
          "length_units": 380,
          "elements": [
            {
              "role": "good",
              "dx": 0,
              "y": 150,
              "w": 46,
              "h": 46,
              "lane": 0
            },
            {
              "role": "good",
              "dx": 130,
              "y": 150,
              "w": 46,
              "h": 46,
              "lane": 0
            },
            {
              "role": "obstacle",
              "dx": 260,
              "y": 330,
              "w": 40,
              "h": 130,
              "lane": 0
            }
          ]
        },
        {
          "id": "ruta-baja",
          "weight": 5,
          "length_units": 380,
          "elements": [
            {
              "role": "good",
              "dx": 0,
              "y": 320,
              "w": 46,
              "h": 46,
              "lane": 0
            },
            {
              "role": "good",
              "dx": 130,
              "y": 320,
              "w": 46,
              "h": 46,
              "lane": 0
            },
            {
              "role": "obstacle",
              "dx": 260,
              "y": 90,
              "w": 40,
              "h": 130,
              "lane": 0
            }
          ]
        },
        {
          "id": "termica-domingo",
          "weight": 4,
          "length_units": 320,
          "elements": [
            {
              "role": "thermal",
              "dx": 0,
              "y": 120,
              "w": 200,
              "h": 320,
              "lane": 0
            },
            {
              "role": "good",
              "dx": 70,
              "y": 240,
              "w": 46,
              "h": 46,
              "lane": 0
            }
          ]
        },
        {
          "id": "antojo",
          "weight": 3,
          "length_units": 340,
          "elements": [
            {
              "role": "bad",
              "dx": 0,
              "y": 230,
              "w": 50,
              "h": 50,
              "lane": 0
            },
            {
              "role": "good",
              "dx": 200,
              "y": 140,
              "w": 46,
              "h": 46,
              "lane": 0
            }
          ]
        },
        {
          "id": "mes-dificil",
          "weight": 3,
          "length_units": 460,
          "min_distance_units": 2200,
          "elements": [
            {
              "role": "storm",
              "dx": 0,
              "y": 60,
              "w": 380,
              "h": 400,
              "lane": 0
            },
            {
              "role": "good",
              "dx": 170,
              "y": 260,
              "w": 46,
              "h": 46,
              "lane": 0
            }
          ]
        }
      ]
    },
    "scoring": {
      "distance_weight": 0.15,
      "collect_weight": 0.6,
      "combat_weight": 0,
      "energy_weight": 0.25,
      "collect_points": 10,
      "collect_target": 220,
      "combat_target": 1,
      "energy_budget": 900,
      "wrong_penalty_pct": 5,
      "hit_penalty_pct": 4,
      "stall_penalty_pct": 4,
      "combo": {
        "step": 4,
        "max": 2
      }
    },
    "target_distance": 6000,
    "max_ticks": 720
  },
  "content": {
    "items": [
      {
        "id": "moneda-guardada",
        "label_md": "Moneda para la alcancia",
        "category": "ahorro",
        "icon": "savings",
        "value": 5,
        "tier": 1
      },
      {
        "id": "domingo",
        "label_md": "Tu domingo",
        "category": "ahorro",
        "icon": "payments",
        "value": 20,
        "tier": 1
      },
      {
        "id": "meta-bici",
        "label_md": "Meta: la bici",
        "category": "ahorro",
        "icon": "flag",
        "value": 60,
        "tier": 2
      },
      {
        "id": "antojo-tienda",
        "label_md": "Antojo de la tienda",
        "category": "gasto",
        "icon": "storefront",
        "value": 12,
        "tier": 1,
        "misconception_md": "Se ve chiquito, pero cada antojo sale de la misma alcancia que guarda tu meta."
      },
      {
        "id": "sticker-repetido",
        "label_md": "Sticker repetido",
        "category": "gasto",
        "icon": "label",
        "value": 8,
        "tier": 1,
        "misconception_md": "Ya tienes uno igual: pagarlo otra vez no te acerca a tu meta."
      }
    ],
    "categories": [
      {
        "id": "ahorro",
        "label_md": "Ahorro",
        "description_md": "Lo que se queda en tu alcancia."
      },
      {
        "id": "gasto",
        "label_md": "Gasto",
        "description_md": "Lo que sale de tu alcancia hoy mismo."
      }
    ],
    "feedback": {
      "correct_md": [
        "Esa moneda ya es tuya.",
        "Tu alcancia sube.",
        "Vas derecho a tu meta."
      ],
      "incorrect_md": [
        "Ese era un antojo, sigue volando.",
        "Casi: ese puede esperar."
      ],
      "results_md": "Volaste guardando monedas y descansando en las termicas. Subir cuesta energia; planear cuesta menos."
    },
    "roles": {
      "collect": [
        "moneda-guardada",
        "domingo",
        "meta-bici"
      ],
      "avoid": [
        "antojo-tienda",
        "sticker-repetido"
      ]
    }
  },
  "scoring": {
    "mode": "cheer",
    "xp_max": 10,
    "pass_score": 62,
    "lives": null,
    "target": 6000
  }
};

