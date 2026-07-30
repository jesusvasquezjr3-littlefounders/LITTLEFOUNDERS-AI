// `simulate` — the bot-play winnability gate (GAME_ENGINE.md §9).
//
// Every case here runs the REAL mechanics out of `gamegen/src/contract/`: a gate that
// passed against a stub simulator would prove nothing about the manifests it clears for
// the paid judge. The three cases the stage exists for are a deliberately UNWINNABLE
// manifest (rejected), a TRIVIALLY EASY one (rejected), and a well-tuned one (passes),
// plus the explorer world solver and the sidecar bounds Core enforces at reward time.
//
// The sorter manifests are adapted from `frontend/src/game-engine/mechanics/sorter/
// fixtures.ts` — the reference answer to "what does a well-tuned sorter look like" —
// then detuned in exactly one dimension per case, so a failure names the dimension.
// Content is curriculum, never a child (§1.9).

import { describe, expect, it } from 'vitest'

import type { GameDocument, GameValidation } from '../contract/core/types.js'
import { simulateGate, gateSeeds, maxTicksForDocument } from '../pipeline/simulateGate.js'

// ---- A well-tuned sorter manifest ---------------------------------------------

function wellTunedSorter(): GameDocument {
  return {
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
    config: {
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
        wrong_drop: { score_pct: 4, lives: 0, combo_reset: true, return_item: true },
        miss: { score_pct: 0, lives: 0, combo_reset: false },
      },
      trash_zone: true,
      repeat_items: false,
      initial_fill: 6,
      round: { target_correct: 10, target_points: 90, tick_budget: 2400 },
      score_weights: { accuracy: 0.5, progress: 0.3, points: 0.2 },
    },
    content: {
      categories: [
        { id: 'necesito', label_md: 'Necesito', image_slot: 'bin_1' },
        { id: 'quiero', label_md: 'Quiero', image_slot: 'bin_2' },
      ],
      items: [
        { id: 'agua', label_md: 'Agua para tomar', category: 'necesito', icon: 'water_drop', tier: 1 },
        { id: 'lonche', label_md: 'El lonche de la escuela', category: 'necesito', icon: 'restaurant', tier: 1 },
        { id: 'medicina', label_md: 'La medicina del doctor', category: 'necesito', icon: 'medical_services', tier: 1 },
        { id: 'pasaje', label_md: 'El pasaje del camion', category: 'necesito', icon: 'directions_bus', tier: 1 },
        { id: 'cuaderno', label_md: 'Un cuaderno para la tarea', category: 'necesito', icon: 'menu_book', tier: 1 },
        {
          id: 'internet-tarea',
          label_md: 'Internet para hacer la tarea',
          category: 'necesito',
          icon: 'router',
          tier: 2,
          misconception_md: 'Suena a lujo, pero si la tarea se entrega en linea, es una necesidad.',
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
          misconception_md: 'Unos tenis si son necesidad; que sean de esa marca ya es un gusto.',
        },
        { id: 'audifonos', label_md: 'Audifonos que brillan', category: 'quiero', icon: 'headphones', tier: 2 },
        {
          id: 'dia-soleado',
          label_md: 'Un dia soleado',
          icon: 'sunny',
          tier: 1,
          misconception_md: 'No se compra ni se paga, asi que no cabe en ninguna de las dos cajas.',
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
        correct_md: ['Esa va justo ahi.', 'Lo pensaste bien.', 'Sigue asi.'],
        incorrect_md: ['Casi. Piensa que pasa si no lo tienes.', 'Otra vuelta: puedes esperar para tenerlo?'],
        results_md: 'Separar lo que necesito de lo que quiero es el primer paso para decidir mi dinero.',
      },
    },
    scoring: { mode: 'cheer', xp_max: 10, pass_score: 60, lives: null, target: 10 },
  }
}

/** A generous, honest sidecar for the manifest above: the bounds Core enforces, all
 *  wide enough that an optimal run clears every one of them. */
const GENEROUS_SIDECAR: GameValidation = {
  max_score: 100,
  min_duration_seconds: 0,
  max_events: 2000,
}

function clone(document: GameDocument): GameDocument {
  return JSON.parse(JSON.stringify(document)) as GameDocument
}

/**
 * The same manifest with a RECYCLING deck falling into a wide field: `repeat_items`
 * pushes each drawn entry to the back of the deck instead of consuming it, so the live
 * state genuinely grows with every spawn. This is the shape the per-tick work bound
 * exists to measure.
 */
function spawnHeavySorter(): GameDocument {
  const document = clone(wellTunedSorter())
  const config = document.config as {
    mode: string
    repeat_items: boolean
    initial_fill: number
    ladder: { spawn_interval_ticks: number; fall_speed: number; max_active: number }[]
  }
  config.mode = 'falling'
  config.repeat_items = true
  config.initial_fill = 1
  for (const level of config.ladder) {
    level.spawn_interval_ticks = 1
    level.fall_speed = 1
    level.max_active = 12
  }
  return document
}

const SORTER = { mechanic: 'sorter' } as const

// ---- The three cases the stage exists for -------------------------------------

describe('simulateGate — a well-tuned manifest', () => {
  it('passes: the perfect bot wins every seed and the random bot wins none', () => {
    const verdict = simulateGate(wellTunedSorter(), GENEROUS_SIDECAR, SORTER)

    expect(verdict.problems).toEqual([])
    expect(verdict.ok).toBe(true)
    expect(verdict.random_passes).toBe(0)
    expect(verdict.perfect).toHaveLength(verdict.seeds.perfect.length)
    expect(verdict.random).toHaveLength(verdict.seeds.random.length)
    for (const trace of verdict.perfect) {
      expect(trace.score).toBeGreaterThanOrEqual(verdict.pass_score)
      expect(trace.finished).toBe(true)
      expect(trace.events).toBeGreaterThan(0)
    }
    for (const trace of verdict.random) {
      expect(trace.score).toBeLessThan(verdict.pass_score)
    }
  })

  it('measures the per-tick work on every run and finds a static tray light', () => {
    const verdict = simulateGate(wellTunedSorter(), GENEROUS_SIDECAR, SORTER)
    for (const trace of [...verdict.perfect, ...verdict.random]) {
      expect(trace.peak_entity_growth).toBeGreaterThanOrEqual(0)
      expect(trace.peak_entity_growth).toBeLessThan(100)
    }
  })

  it('fails a manifest whose simulation outgrows the per-tick work bound', () => {
    // A recycling deck spawning into a 12-wide field genuinely GROWS the live state —
    // unlike the static tray above, whose elements come out of a deck that shrinks by
    // the same amount. Driving the bound below that growth must reject the manifest:
    // the bound is a real ceiling, not a decorative field.
    const document = spawnHeavySorter()
    const loose = simulateGate(document, GENEROUS_SIDECAR, SORTER)
    const peak = Math.max(
      ...[...loose.perfect, ...loose.random].map((trace) => trace.peak_entity_growth),
    )
    expect(peak).toBeGreaterThan(1)

    const tight = simulateGate(document, GENEROUS_SIDECAR, { ...SORTER, maxEntityGrowth: 1 })
    expect(tight.ok).toBe(false)
    const problem = tight.problems.find((candidate) => candidate.code === 'entity_load_exceeded')
    expect(problem?.observed).toBe(`${peak}`)
    // Reported once, from the heaviest run — not once per seed.
    expect(tight.problems.filter((c) => c.code === 'entity_load_exceeded')).toHaveLength(1)
  })
})

describe('simulateGate — an unwinnable manifest', () => {
  // The author asked for 80 correct placements and 20 000 points from a 14-item deck
  // that never recycles: optimal play cannot get there, so a child never could either.
  function unwinnable(): GameDocument {
    const document = clone(wellTunedSorter())
    const config = document.config as { round: { target_correct: number; target_points: number } }
    config.round.target_correct = 80
    config.round.target_points = 20_000
    return document
  }

  it('is rejected, and the perfect bot is what proves it', () => {
    const verdict = simulateGate(unwinnable(), GENEROUS_SIDECAR, SORTER)

    expect(verdict.ok).toBe(false)
    expect(verdict.problems.map((problem) => problem.code)).toContain('perfect_below_pass_score')
    const problem = verdict.problems.find((candidate) => candidate.code === 'perfect_below_pass_score')
    expect(problem?.field).toBe('scoring.pass_score')
    expect(problem?.trace?.bot).toBe('perfect')
    expect(problem?.trace?.score).toBeLessThan(verdict.pass_score)
  })

  it('fails on EVERY perfect seed, not just an unlucky one', () => {
    const verdict = simulateGate(unwinnable(), GENEROUS_SIDECAR, SORTER)
    const failures = verdict.problems.filter((problem) => problem.code === 'perfect_below_pass_score')
    expect(failures).toHaveLength(verdict.seeds.perfect.length)
  })

  it('emits a bot trace an author prompt can act on', () => {
    const verdict = simulateGate(unwinnable(), GENEROUS_SIDECAR, SORTER)
    const line = verdict.feedback.find((candidate) => candidate.includes('perfect_below_pass_score'))
    expect(line).toBeDefined()
    expect(line).toContain('BOT TRACE')
    expect(line).toContain('scoring.pass_score')
    expect(line).toContain('stalled for the final')
  })
})

describe('simulateGate — a trivially easy manifest', () => {
  // Everything else is the well-tuned manifest; only the bar moved. A pass_score a
  // mashing player clears means the XP is free, which is the fairness half of the gate.
  function trivial(): GameDocument {
    const document = clone(wellTunedSorter())
    document.scoring.pass_score = 5
    return document
  }

  it('is rejected because the random bot reaches pass_score', () => {
    const verdict = simulateGate(trivial(), GENEROUS_SIDECAR, SORTER)

    expect(verdict.ok).toBe(false)
    expect(verdict.problems.map((problem) => problem.code)).toContain('random_reaches_pass_score')
    expect(verdict.random_passes).toBeGreaterThan(0)
    // The perfect bot still wins — the manifest is easy, not broken.
    expect(verdict.problems.map((problem) => problem.code)).not.toContain('perfect_below_pass_score')
  })

  it('reports how many of the random seeds cleared the bar', () => {
    const verdict = simulateGate(trivial(), GENEROUS_SIDECAR, SORTER)
    const problem = verdict.problems.find((candidate) => candidate.code === 'random_reaches_pass_score')
    expect(problem?.observed).toContain(`of ${verdict.seeds.random.length}`)
    expect(problem?.trace?.bot).toBe('random')
  })
})

// ---- Determinism of the gate's own verdict ------------------------------------

describe('simulateGate — reproducibility', () => {
  it('derives its seeds from the slug, never from the clock', () => {
    const document = wellTunedSorter()
    expect(gateSeeds(document, 'perfect', 4)).toEqual(gateSeeds(document, 'perfect', 4))
    // The two halves must not walk the same content draws.
    expect(gateSeeds(document, 'perfect', 4)).not.toEqual(gateSeeds(document, 'random', 4))
    // A different manifest gets a different sequence.
    const other = clone(document)
    other.meta.slug = 'otro-juego'
    expect(gateSeeds(other, 'perfect', 4)).not.toEqual(gateSeeds(document, 'perfect', 4))
  })

  it('returns an identical verdict for identical bytes', () => {
    const first = simulateGate(wellTunedSorter(), GENEROUS_SIDECAR, SORTER)
    const second = simulateGate(wellTunedSorter(), GENEROUS_SIDECAR, SORTER)
    expect(second).toEqual(first)
  })

  it('plays against the same tick ceiling Core replays against', () => {
    const document = wellTunedSorter()
    // 3 advertised minutes x 1200 ticks/minute x 3 slack.
    expect(maxTicksForDocument(document)).toBe(10_800)
    expect(simulateGate(document, GENEROUS_SIDECAR, SORTER).max_ticks).toBe(10_800)
  })
})

// ---- The sidecar bounds Core enforces at reward time --------------------------

describe('simulateGate — the server-only sidecar', () => {
  it('rejects a max_events cap that would refuse an optimal run', () => {
    const verdict = simulateGate(wellTunedSorter(), { ...GENEROUS_SIDECAR, max_events: 3 }, SORTER)

    expect(verdict.ok).toBe(false)
    expect(verdict.problems.map((problem) => problem.code)).toContain('sidecar_max_events_too_low')
  })

  it('rejects a max_score below what optimal play reaches', () => {
    const verdict = simulateGate(wellTunedSorter(), { ...GENEROUS_SIDECAR, max_score: 10 }, SORTER)

    expect(verdict.ok).toBe(false)
    expect(verdict.problems.map((problem) => problem.code)).toContain('sidecar_max_score_below_perfect')
  })

  it('rejects a min_duration_seconds an optimal run cannot reach', () => {
    const verdict = simulateGate(
      wellTunedSorter(),
      { ...GENEROUS_SIDECAR, min_duration_seconds: 600 },
      SORTER,
    )

    expect(verdict.ok).toBe(false)
    expect(verdict.problems.map((problem) => problem.code)).toContain(
      'sidecar_min_duration_above_perfect',
    )
  })

  it('still gates a document with no sidecar yet', () => {
    const verdict = simulateGate(wellTunedSorter(), null, SORTER)
    expect(verdict.ok).toBe(true)
  })
})

// ---- Refusals that must never become a pass -----------------------------------

describe('simulateGate — refusals', () => {
  it('refuses a mechanic this release cannot bot-play, instead of passing it through', () => {
    const document = clone(wellTunedSorter())
    // A future/unknown mechanic id reaching this stage must fail the slot: an ungated
    // game is exactly what the winnability gate exists to prevent. The cast models a DB
    // or catalog value, which is a plain string and not narrowed by our closed set.
    ;(document.meta as { mechanic: string }).mechanic = 'holodeck'
    const verdict = simulateGate(document, GENEROUS_SIDECAR, { mechanic: 'holodeck' })

    expect(verdict.ok).toBe(false)
    expect(verdict.problems[0]?.code).toBe('mechanic_unsupported')
    expect(verdict.perfect).toEqual([])
    expect(verdict.random).toEqual([])
  })

  it('refuses a document whose mechanic disagrees with the blueprint', () => {
    const document = clone(wellTunedSorter())
    document.meta.mechanic = 'runner'
    const verdict = simulateGate(document, GENEROUS_SIDECAR, SORTER)
    expect(verdict.ok).toBe(false)
    expect(verdict.problems[0]?.code).toBe('mechanic_mismatch')
    // Nothing was played: the wrong simulator would have gated the wrong game.
    expect(verdict.perfect).toEqual([])
    expect(verdict.random).toEqual([])
  })
})

// ---- explorer: the reachability fixpoint --------------------------------------

/**
 * A minimal explorer world whose goal sits behind a HARD lock demanding an ability no
 * node grants. Structurally schema-valid and completely uncompletable — exactly the
 * failure the reachability fixpoint exists to catch before any bot burns a run on it.
 */
function unsolvableExplorer(): GameDocument {
  return {
    schema_version: 1,
    meta: {
      slug: 'la-ruta-del-mercado',
      title: 'La ruta del mercado',
      locale: 'es-MX',
      mechanic: 'explorer',
      concept: {
        topic_path: 'planear-mi-dinero/el-presupuesto/entradas-y-salidas',
        recap_md: 'Aprendiste que cada camino del mercado cuesta algo distinto.',
      },
      tier: 2,
      estimated_minutes: 4,
    },
    skin: { palette: 'ocean-blue', sprites: {} },
    config: {
      map: { width: 900, height: 540, node_radius: 24 },
      movement: { ticks_per_edge: 2, energy_per_move: 0 },
      energy: { max: 10, start: 10, regen_interval_ticks: 20, regen_amount: 1, rest_restores: 5 },
      abilities: {
        max_tier: 1,
        fragments_per_tier: 2,
        upgrade_depth: 0,
        tutorial_room_per_family: false,
      },
      locks: {
        mix: { hard_pct: 100, soft_pct: 0, compound_pct: 0, temporal_pct: 0 },
        mix_tolerance_pct: 100,
        soft_skill_default: 2,
        max_sequence_length: 2,
      },
      connectivity: {
        min_nodes: 3,
        max_nodes: 64,
        locked_edge_pct_min: 0,
        locked_edge_pct_max: 100,
        shortcut_pct_min: 0,
        shortcut_pct_max: 100,
      },
      optional: { hidden_pct_min: 0, hidden_pct_max: 100, reveal_requires_perception: false },
      collectibles: { enabled: false, target: 0 },
      currency: { start: 0, target: 10, purchase_enabled: false },
      death: { currency_loss_pct: 0, cache_recoverable_pct: 100, costs_life: false, respawn_energy: 5 },
      challenge: { attempts: 3, wrong_currency_cost: 0, mastery_per_solve: 1 },
      checkpoints: { start_is_checkpoint: true, rest_only_at_checkpoint: false },
      ending: { exploration_pct_required: 0, require_goal_node: true },
      signposts: {
        hard: { tone: 'primary', shape: 'circle', sfx: 'hint' },
        soft: { tone: 'secondary', shape: 'square', sfx: 'flip' },
        compound: { tone: 'accent', shape: 'triangle', sfx: 'match' },
        temporal: { tone: 'success', shape: 'diamond', sfx: 'streak' },
      },
      score_weights: { exploration: 1, abilities: 1, collectibles: 0, currency: 0, efficiency: 1 },
      penalties: { death_pct: 0, wrong_answer_pct: 0 },
      tick_budget: 600,
      action_budget: 40,
    },
    content: {
      items: [{ id: 'llave', label_md: 'Llave del puesto', icon: 'key' }],
      abilities: [{ id: 'llave', family: 'interaction', max_tier: 1, energy_cost: 0, cooldown_ticks: 0 }],
      nodes: [
        { id: 'inicio', label_md: 'La entrada', kind: 'start', x: 100, y: 270, checkpoint: true },
        { id: 'plaza', label_md: 'La plaza', kind: 'plain', x: 450, y: 270 },
        { id: 'meta', label_md: 'El puesto de frutas', kind: 'goal', x: 800, y: 270 },
      ],
      edges: [
        { id: 'e1', from: 'inicio', to: 'plaza', lock: null },
        {
          id: 'e2',
          from: 'plaza',
          to: 'meta',
          lock: {
            kind: 'hard',
            requires: [{ ability: 'llave', tier: 1 }],
            hint_md: 'Necesitas la llave del puesto.',
          },
        },
      ],
      start_node: 'inicio',
      goal_node: 'meta',
      feedback: {
        correct_md: ['Ese camino era.'],
        incorrect_md: ['Casi. Mira el letrero otra vez.'],
        results_md: 'Cada ruta cuesta algo distinto, y elegir bien es parte de planear.',
      },
    },
    scoring: { mode: 'cheer', xp_max: 10, pass_score: 60, lives: null },
  }
}

describe('simulateGate — explorer', () => {
  it('rejects an unsolvable world outright, before any bot runs', () => {
    const verdict = simulateGate(unsolvableExplorer(), GENEROUS_SIDECAR, { mechanic: 'explorer' })

    expect(verdict.ok).toBe(false)
    expect(verdict.problems.map((problem) => problem.code)).toContain('explorer_world_unsolvable')
    expect(verdict.explorer?.solvable).toBe(false)
    expect(verdict.explorer?.goal_reachable).toBe(false)
    expect(verdict.explorer?.unreachable).toContain('meta')
    // Short-circuited: bot-playing a provably uncompletable world would only rediscover
    // this statistically, and would report a stall instead of an unreachable goal.
    expect(verdict.perfect).toEqual([])
    expect(verdict.random).toEqual([])
  })

  it('names the unreachable goal in the corrective feedback', () => {
    const verdict = simulateGate(unsolvableExplorer(), GENEROUS_SIDECAR, { mechanic: 'explorer' })
    const line = verdict.feedback.find((candidate) => candidate.includes('explorer_world_unsolvable'))
    expect(line).toContain('goal_unreachable')
  })

  it('reports a world it cannot even parse instead of pretending it played it', () => {
    const document = clone(unsolvableExplorer())
    // `GameContent`'s index signature is the sanctioned home for per-mechanic extras,
    // so an empty node list is a shape the envelope accepts and only the explorer
    // schema rejects — which is precisely the path under test.
    document.content.nodes = []
    const verdict = simulateGate(document, GENEROUS_SIDECAR, { mechanic: 'explorer' })

    expect(verdict.ok).toBe(false)
    expect(verdict.problems.map((problem) => problem.code)).toContain('explorer_world_unparseable')
    expect(verdict.explorer).toBeUndefined()
  })
})
