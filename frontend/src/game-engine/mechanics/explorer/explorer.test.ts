// `explorer` — the regression classes GAME_ENGINE.md requires of a mechanic:
// determinism, the winnability gate, schema bounds, the mechanic's own rules, and — the
// one that matters most for THIS mechanic — the reachability solver that proves a world
// is completable and rejects one that is not.

import { createElement } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'

import { replayGame, runBot } from '@/game-engine/core/replay'
import type { GameDocument, GameInputEvent, SimInit, SimSnapshot } from '@/game-engine/core/types'

import { ExplorerView } from './components'
import { explorerFixtures } from './fixtures'
import {
  EXPLORER_SPRITE_SLOTS,
  explorerConfigSchema,
  explorerContentSchema,
  type ExplorerConfig,
  type ExplorerContent,
} from './schema'
import { explorerSimulator, solveExplorerWorld, type ExplorerState } from './simulate'

const SEED = 20260730

function configOf(document: GameDocument): ExplorerConfig {
  return explorerConfigSchema.parse(document.config)
}

function contentOf(document: GameDocument): ExplorerContent {
  return explorerContentSchema.parse(document.content)
}

function maxTicksOf(document: GameDocument): number {
  return configOf(document).tick_budget
}

function initOf(document: GameDocument, seed = SEED): ExplorerState {
  const input: SimInit = {
    config: document.config,
    content: document.content,
    scoring: document.scoring,
    seed,
  }
  return explorerSimulator.init(input)
}

/** Advance a state through a scripted log without going near replayGame's caps — the
 *  rule tests care about one transition, not a whole run. Ticks are ABSOLUTE. */
function drive(
  start: ExplorerState,
  fromTick: number,
  toTick: number,
  events: readonly GameInputEvent[],
): ExplorerState {
  let state = start
  for (let tick = fromTick; tick < toTick; tick += 1) {
    state = explorerSimulator.step(
      state,
      tick,
      events.filter((event) => event.tick === tick),
    )
  }
  return state
}

function nodeIdAt(state: ExplorerState): string {
  return state.nodes[state.at]?.id ?? ''
}

function isOpen(state: ExplorerState, edgeId: string): boolean {
  const index = state.edges.findIndex((edge) => edge.id === edgeId)
  return index >= 0 && state.open[index] === true
}

function clone(document: GameDocument): GameDocument {
  return JSON.parse(JSON.stringify(document)) as GameDocument
}

describe('explorer fixtures', () => {
  it('ships at least two playable manifests', () => {
    expect(explorerFixtures.length).toBeGreaterThanOrEqual(2)
  })

  for (const document of explorerFixtures) {
    describe(document.meta.slug, () => {
      it('passes the config and content schemas', () => {
        expect(() => explorerConfigSchema.parse(document.config)).not.toThrow()
        expect(() => explorerContentSchema.parse(document.content)).not.toThrow()
      })

      it('binds only declared sprite slots', () => {
        const declared: readonly string[] = EXPLORER_SPRITE_SLOTS
        for (const slot of Object.keys(document.skin.sprites)) {
          expect(declared).toContain(slot)
        }
        for (const item of document.content.items) {
          if (item.image_slot !== undefined) expect(declared).toContain(item.image_slot)
        }
        for (const node of contentOf(document).nodes) {
          if (node.image_slot !== undefined) expect(declared).toContain(node.image_slot)
        }
      })

      it('is PROVABLY completable and lands inside its own difficulty bounds', () => {
        const report = solveExplorerWorld(configOf(document), contentOf(document))
        expect(report.unreachable).toEqual([])
        expect(report.goal_reachable).toBe(true)
        expect(report.solvable).toBe(true)
        expect(report.audit.within_connectivity).toBe(true)
        expect(report.audit.within_lock_mix).toBe(true)
        expect(report.audit.tutorial_rooms_ok).toBe(true)
      })

      it('teaches the first ability of every family in a safe tutorial room', () => {
        const content = contentOf(document)
        const families = [...new Set(content.abilities.map((ability) => ability.family))]
        for (const family of families) {
          const room = content.nodes.find(
            (node) => node.kind === 'tutorial' && node.teaches_family === family,
          )
          expect(room).toBeDefined()
          // Safe means safe: a tutorial room never tests.
          expect(room?.challenge).toBeUndefined()
        }
      })
    })
  }
})

describe('explorer determinism', () => {
  for (const document of explorerFixtures) {
    it(`replays identically twice — ${document.meta.slug}`, () => {
      const maxTicks = maxTicksOf(document)
      const { inputLog } = runBot({
        simulator: explorerSimulator,
        document,
        seed: SEED,
        bot: explorerSimulator.bots.perfect,
        maxTicks,
      })

      const first = replayGame({
        simulator: explorerSimulator,
        document,
        seed: SEED,
        inputLog,
        maxTicks,
      })
      const second = replayGame({
        simulator: explorerSimulator,
        document,
        seed: SEED,
        inputLog,
        maxTicks,
      })

      expect(first.ok).toBe(true)
      expect(second).toEqual(first)
    })

    it(`replay derives the same result the live run produced — ${document.meta.slug}`, () => {
      const maxTicks = maxTicksOf(document)
      const bot = runBot({
        simulator: explorerSimulator,
        document,
        seed: SEED,
        bot: explorerSimulator.bots.perfect,
        maxTicks,
      })
      const replay = replayGame({
        simulator: explorerSimulator,
        document,
        seed: SEED,
        inputLog: bot.inputLog,
        maxTicks,
      })
      expect(replay.ok && replay.result).toEqual(bot.result)
    })

    it(`the same seed rebuilds the identical opening state — ${document.meta.slug}`, () => {
      expect(initOf(document, SEED)).toEqual(initOf(document, SEED))
    })

    it(`the world is authored, not rolled: a different seed changes nothing — ${document.meta.slug}`, () => {
      // A graph mechanic draws no randomness at all. Pinning that here means a future
      // "just shuffle the nodes" change cannot silently break replay parity.
      const a = initOf(document, SEED)
      const b = initOf(document, SEED + 991)
      expect({ ...a, seed: 0 }).toEqual({ ...b, seed: 0 })
    })
  }
})

describe('explorer winnability gate', () => {
  for (const document of explorerFixtures) {
    it(`the perfect bot reaches pass_score — ${document.meta.slug}`, () => {
      const maxTicks = maxTicksOf(document)
      const { result } = runBot({
        simulator: explorerSimulator,
        document,
        seed: SEED,
        bot: explorerSimulator.bots.perfect,
        maxTicks,
      })
      expect(result.finished).toBe(true)
      expect(result.stats.deaths).toBe(0)
      expect(result.stats.wrong).toBe(0)
      expect(result.stats.reached_goal).toBe(1)
      expect(result.score).toBeGreaterThanOrEqual(document.scoring.pass_score)
    })

    it(`flailing cannot reach pass_score even with a perfect map sweep — ${document.meta.slug}`, () => {
      // The structural guarantee behind the random-bot test below, asserted directly so
      // a future re-weighting cannot quietly reopen the hole: every signal except
      // efficiency is capped at 100, so a run that scores ZERO on efficiency — which is
      // what mashing for a whole session does — cannot reach `pass_score` no matter how
      // much of the map it stumbles across.
      const weights = configOf(document).score_weights
      const total =
        weights.exploration +
        weights.abilities +
        weights.collectibles +
        weights.currency +
        weights.efficiency
      const ceilingWithoutEfficiency = ((total - weights.efficiency) / total) * 100
      expect(ceilingWithoutEfficiency).toBeLessThan(document.scoring.pass_score)
    })

    it(`the random bot does NOT reach pass_score — ${document.meta.slug}`, () => {
      const maxTicks = maxTicksOf(document)
      // Several seeds: one lucky run must not hide a world a coin-flip can beat.
      for (const seed of [SEED, SEED + 7, SEED + 101, SEED + 4242, SEED + 8009, SEED + 31337]) {
        const { result } = runBot({
          simulator: explorerSimulator,
          document,
          seed,
          bot: explorerSimulator.bots.random,
          maxTicks,
        })
        expect(result.score).toBeLessThan(document.scoring.pass_score)
      }
    })
  }
})

describe('explorer world solver', () => {
  const solvable = explorerFixtures[0]

  it('detects a world whose ability is locked behind the lock it opens', () => {
    if (solvable === undefined) throw new Error('fixture missing')
    const broken = clone(solvable)
    const content = contentOf(broken)
    // The classic unsolvable metroidvania: the key is inside the room it unlocks.
    const edge = content.edges.find((candidate) => candidate.id === 'e-tiendita-libreria')
    if (edge === undefined || edge.lock === null) throw new Error('fixture edge missing')
    edge.lock.requires = [{ ability: 'leer-etiqueta', tier: 1 }]

    const report = solveExplorerWorld(configOf(broken), content)

    expect(report.solvable).toBe(false)
    expect(report.goal_reachable).toBe(false)
    expect(report.unreachable).toContain('libreria')
    expect(report.reasons).toContain('goal_unreachable')
  })

  it('detects a world with an ability nobody can afford to use', () => {
    if (solvable === undefined) throw new Error('fixture missing')
    const broken = clone(solvable)
    const config = configOf(broken)
    const content = contentOf(broken)
    const ability = content.abilities[0]
    if (ability === undefined) throw new Error('fixture ability missing')
    ability.energy_cost = config.energy.max + 1

    const report = solveExplorerWorld(config, content)

    expect(report.reasons).toContain(`ability_cost_exceeds_energy:${ability.id}`)
    expect(report.solvable).toBe(false)
  })

  it('a one-way locked shortcut never extends reachability', () => {
    if (solvable === undefined) throw new Error('fixture missing')
    const document = clone(solvable)
    const config = configOf(document)
    const content = contentOf(document)
    // Sever the only other way into the goal and lock the shortcut that reaches it.
    const banquito = content.edges.find((edge) => edge.id === 'e-banquito-meta')
    const shortcut = content.edges.find((edge) => edge.id === 'e-bodega-meta')
    if (banquito === undefined || shortcut === undefined) throw new Error('fixture edge missing')
    banquito.lock = {
      kind: 'hard',
      requires: [{ ability: 'contar', tier: 1 }],
      sequence: false,
    }
    banquito.from = 'bodega'
    banquito.to = 'banquito'
    shortcut.lock = { kind: 'hard', requires: [{ ability: 'contar', tier: 1 }], sequence: false }

    const report = solveExplorerWorld(config, content)

    // The shortcut's lock is operated from `meta-bici`, which is exactly the node it
    // would have to reach — so it can never be the thing that gets you there.
    expect(report.unreachable).toContain('meta-bici')
    expect(report.solvable).toBe(false)
  })
})

describe('explorer schema bounds', () => {
  const validConfig = explorerFixtures[0]?.config as ExplorerConfig | undefined

  it('rejects a lock mix that does not sum to 100', () => {
    const parsed = explorerConfigSchema.safeParse({
      ...validConfig,
      locks: {
        ...validConfig?.locks,
        mix: { hard_pct: 50, soft_pct: 50, compound_pct: 50, temporal_pct: 0 },
      },
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects a connectivity envelope with min above max', () => {
    const parsed = explorerConfigSchema.safeParse({
      ...validConfig,
      connectivity: { ...validConfig?.connectivity, min_nodes: 20, max_nodes: 5 },
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects an upgrade depth the tier ceiling cannot hold', () => {
    const parsed = explorerConfigSchema.safeParse({
      ...validConfig,
      abilities: { ...validConfig?.abilities, max_tier: 1, upgrade_depth: 2 },
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects two lock kinds signposted with the same colour', () => {
    const parsed = explorerConfigSchema.safeParse({
      ...validConfig,
      signposts: {
        hard: { tone: 'primary', shape: 'square', sfx: 'flip' },
        soft: { tone: 'primary', shape: 'circle', sfx: 'hint' },
        compound: { tone: 'delight', shape: 'hexagon', sfx: 'match' },
        temporal: { tone: 'warning', shape: 'triangle', sfx: 'streak' },
      },
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects an out-of-range tick budget', () => {
    const parsed = explorerConfigSchema.safeParse({ ...validConfig, tick_budget: 5 })
    expect(parsed.success).toBe(false)
  })

  const baseContent = () => {
    const document = explorerFixtures[0]
    if (document === undefined) throw new Error('fixture missing')
    return contentOf(document)
  }

  it('rejects a hard lock offering more than one ability', () => {
    const content = baseContent()
    const edge = content.edges.find((candidate) => candidate.id === 'e-tiendita-libreria')
    if (edge === undefined || edge.lock === null) throw new Error('fixture edge missing')
    edge.lock.requires = [
      { ability: 'contar', tier: 1 },
      { ability: 'comparar', tier: 1 },
    ]
    expect(explorerContentSchema.safeParse(content).success).toBe(false)
  })

  it('rejects a temporal lock with no prior state to require', () => {
    const content = baseContent()
    const edge = content.edges.find((candidate) => candidate.id === 'e-alcancia-bodega')
    if (edge === undefined || edge.lock === null) throw new Error('fixture edge missing')
    delete edge.lock.requires_visited
    expect(explorerContentSchema.safeParse(content).success).toBe(false)
  })

  it('rejects a wrong challenge option that teaches nothing', () => {
    const content = baseContent()
    const node = content.nodes.find((candidate) => candidate.id === 'feria')
    const option = node?.challenge?.options.find((candidate) => !candidate.correct)
    if (option === undefined) throw new Error('fixture option missing')
    delete option.rationale_md
    expect(explorerContentSchema.safeParse(content).success).toBe(false)
  })

  it('rejects a tutorial room that tests instead of teaching', () => {
    const content = baseContent()
    const room = content.nodes.find((candidate) => candidate.id === 'tiendita')
    const donor = content.nodes.find((candidate) => candidate.id === 'feria')
    if (room === undefined || donor?.challenge === undefined) throw new Error('fixture missing')
    room.challenge = donor.challenge
    expect(explorerContentSchema.safeParse(content).success).toBe(false)
  })
})

describe('explorer rules', () => {
  const cheer = explorerFixtures[0]
  const arcade = explorerFixtures[1]

  it('a hard lock refuses the path until the ability is applied there', () => {
    if (cheer === undefined) throw new Error('fixture missing')
    const config = configOf(cheer)
    expect(config.movement.ticks_per_edge).toBe(2)

    // Walk to the tutorial room and take the ability it teaches.
    let state = drive(initOf(cheer), 0, 3, [{ tick: 0, action: 'move', slot: 'tiendita' }])
    expect(nodeIdAt(state)).toBe('tiendita')
    state = drive(state, 3, 4, [{ tick: 3, action: 'take', slot: 'tiendita' }])
    expect(state.tier[0]).toBe(1)

    // The path is still shut: holding the ability is not the same as using it here.
    state = drive(state, 4, 7, [{ tick: 4, action: 'move', slot: 'libreria' }])
    expect(nodeIdAt(state)).toBe('tiendita')
    expect(isOpen(state, 'e-tiendita-libreria')).toBe(false)

    // Apply it at the lock, and the same move now works.
    state = drive(state, 7, 8, [
      { tick: 7, action: 'use', slot: 'e-tiendita-libreria', n: 0 },
    ])
    expect(isOpen(state, 'e-tiendita-libreria')).toBe(true)
    // The ability charged exactly what the manifest says, and started its cooldown.
    expect(state.energy).toBe(config.energy.max - 2)

    state = drive(state, 8, 11, [{ tick: 8, action: 'move', slot: 'libreria' }])
    expect(nodeIdAt(state)).toBe('libreria')
  })

  it('death loses part of the money, drops it recoverably, and never touches an ability', () => {
    if (cheer === undefined) throw new Error('fixture missing')
    // One attempt and no per-answer fee, so the arithmetic under test is only the
    // death rule itself.
    const document = clone(cheer)
    const config = configOf(document)
    config.challenge.attempts = 1
    config.challenge.wrong_currency_cost = 0
    document.config = config

    // Pick up an ability first: the point is that it survives.
    let state = drive(initOf(document), 0, 3, [{ tick: 0, action: 'move', slot: 'tiendita' }])
    state = drive(state, 3, 4, [{ tick: 3, action: 'take', slot: 'tiendita' }])
    expect(state.tier[0]).toBe(1)

    state = drive(state, 4, 7, [{ tick: 4, action: 'move', slot: 'casa' }])
    state = drive(state, 7, 10, [{ tick: 7, action: 'move', slot: 'feria' }])
    expect(nodeIdAt(state)).toBe('feria')

    const before = state.currency
    const feria = state.nodes.findIndex((node) => node.id === 'feria')
    const wrong = state.nodes[feria]?.challenge?.options.findIndex((option) => !option.correct) ?? -1
    expect(wrong).toBeGreaterThanOrEqual(0)

    state = drive(state, 10, 11, [{ tick: 10, action: 'take', slot: 'feria', n: wrong }])

    const lost = Math.floor((before * config.death.currency_loss_pct) / 100)
    expect(state.deaths).toBe(1)
    expect(state.currency).toBe(before - lost)
    expect(state.cache[feria]).toBe(Math.floor((lost * config.death.cache_recoverable_pct) / 100))
    // Respawned at the last activated checkpoint, with the ability still in hand.
    expect(nodeIdAt(state)).toBe('casa')
    expect(state.tier[0]).toBe(1)

    // Walk back and pick the money up: the loss was recoverable, which is the lesson.
    state = drive(state, 11, 14, [{ tick: 11, action: 'move', slot: 'feria' }])
    state = drive(state, 14, 15, [{ tick: 14, action: 'take', slot: 'feria' }])
    expect(state.currency).toBe(before)
    expect(state.cache[feria]).toBe(0)
  })

  it('a shop charges the manifest price and only when the money is there', () => {
    if (arcade === undefined) throw new Error('fixture missing')
    const content = contentOf(arcade)
    const shop = content.nodes.find((node) => node.kind === 'shop')
    expect(shop?.price).toBe(60)

    const state = initOf(arcade)
    const shopIndex = state.nodes.findIndex((node) => node.id === shop?.id)
    // The run starts with 25: a purchase of 60 is not affordable and the node stays
    // unclaimed rather than granting on credit.
    expect(state.currency).toBeLessThan(shop?.price ?? 0)
    expect(state.claimed[shopIndex]).toBe(false)
  })
})

// A tiny world built for the rules that the shipped fixtures reach only after a long
// walk. It satisfies the PRODUCTION schemas — §1.14 forbids relaxing them for a test.
describe('explorer combination, skill and shortcut rules', () => {
  const base = explorerFixtures[0]

  function labWorld(): { document: GameDocument; config: ExplorerConfig } {
    if (base === undefined) throw new Error('fixture missing')
    const document = clone(base)
    const config = configOf(document)
    const content: ExplorerContent = explorerContentSchema.parse({
      items: [
        { id: 'ab-a', label_md: 'Contar', icon: 'pin' },
        { id: 'ab-b', label_md: 'Comparar', icon: 'balance' },
      ],
      abilities: [
        { id: 'ab-a', family: 'movement', max_tier: 1, energy_cost: 2, cooldown_ticks: 2 },
        { id: 'ab-b', family: 'interaction', max_tier: 1, energy_cost: 2, cooldown_ticks: 2 },
      ],
      nodes: [
        { id: 'inicio', label_md: 'Inicio', kind: 'start', x: 60, y: 260, checkpoint: true },
        {
          id: 'aula-a',
          label_md: 'Aula A',
          kind: 'tutorial',
          x: 240,
          y: 120,
          teaches_family: 'movement',
          grants: { ability: 'ab-a', tier: 1 },
        },
        {
          id: 'aula-b',
          label_md: 'Aula B',
          kind: 'tutorial',
          x: 240,
          y: 400,
          teaches_family: 'interaction',
          grants: { ability: 'ab-b', tier: 1 },
        },
        {
          id: 'caja',
          label_md: 'La caja',
          kind: 'plain',
          x: 430,
          y: 260,
          currency_reward: 5,
          challenge: {
            prompt_md: 'Guardar un poco cada semana sirve para…',
            options: [
              { id: 'a', label_md: 'Juntar para algo grande', correct: true },
              {
                id: 'b',
                label_md: 'Gastarlo el mismo dia',
                correct: false,
                rationale_md: 'Si lo gastas el mismo dia, no llegaste a guardar nada.',
              },
            ],
          },
        },
        { id: 'puerta', label_md: 'La puerta', kind: 'plain', x: 640, y: 260, currency_reward: 5 },
        { id: 'meta', label_md: 'La meta', kind: 'goal', x: 820, y: 260 },
      ],
      edges: [
        { id: 'e-ini-a', from: 'inicio', to: 'aula-a' },
        { id: 'e-ini-b', from: 'inicio', to: 'aula-b' },
        { id: 'e-ini-caja', from: 'inicio', to: 'caja' },
        {
          id: 'e-ini-puerta',
          from: 'inicio',
          to: 'puerta',
          lock: {
            kind: 'compound',
            requires: [
              { ability: 'ab-a', tier: 1 },
              { ability: 'ab-b', tier: 1 },
            ],
            sequence: true,
          },
        },
        {
          id: 'e-caja-puerta',
          from: 'caja',
          to: 'puerta',
          lock: { kind: 'soft', requires: [{ ability: 'ab-b', tier: 1 }], skill_required: 1 },
        },
        { id: 'e-puerta-meta', from: 'puerta', to: 'meta' },
        {
          id: 'e-caja-ini',
          from: 'caja',
          to: 'inicio',
          one_way: true,
          lock: { kind: 'hard', requires: [{ ability: 'ab-a', tier: 1 }] },
        },
      ],
      start_node: 'inicio',
      goal_node: 'meta',
      feedback: {
        correct_md: ['Bien'],
        incorrect_md: ['Casi'],
        results_md: 'Cada cosa que aprendes abre un camino.',
      },
    })
    document.content = content as unknown as GameDocument['content']
    return { document, config }
  }

  it('is itself a solvable world', () => {
    const { document, config } = labWorld()
    const report = solveExplorerWorld(config, contentOf(document))
    expect(report.solvable).toBe(true)
    expect(report.unreachable).toEqual([])
  })

  it('a sequence lock demands the abilities IN ORDER and a wrong step resets it', () => {
    const { document } = labWorld()

    // Collect both abilities, returning to the lock between them.
    let state = drive(initOf(document), 0, 3, [{ tick: 0, action: 'move', slot: 'aula-a' }])
    state = drive(state, 3, 4, [{ tick: 3, action: 'take', slot: 'aula-a' }])
    state = drive(state, 4, 7, [{ tick: 4, action: 'move', slot: 'inicio' }])
    state = drive(state, 7, 10, [{ tick: 7, action: 'move', slot: 'aula-b' }])
    state = drive(state, 10, 11, [{ tick: 10, action: 'take', slot: 'aula-b' }])
    state = drive(state, 11, 14, [{ tick: 11, action: 'move', slot: 'inicio' }])
    expect(nodeIdAt(state)).toBe('inicio')
    expect(state.tier).toEqual([1, 1])

    const edgeIndex = state.edges.findIndex((edge) => edge.id === 'e-ini-puerta')

    // Second ability first: the combination resets and costs no energy.
    const energyBefore = state.energy
    state = drive(state, 14, 15, [{ tick: 14, action: 'use', slot: 'e-ini-puerta', n: 1 }])
    expect(state.seqAt[edgeIndex]).toBe(0)
    expect(isOpen(state, 'e-ini-puerta')).toBe(false)
    expect(state.energy).toBeGreaterThanOrEqual(energyBefore)

    // Now in order: first step arms it, second step opens it.
    state = drive(state, 15, 16, [{ tick: 15, action: 'use', slot: 'e-ini-puerta', n: 0 }])
    expect(state.seqAt[edgeIndex]).toBe(1)
    expect(isOpen(state, 'e-ini-puerta')).toBe(false)

    state = drive(state, 16, 17, [{ tick: 16, action: 'use', slot: 'e-ini-puerta', n: 1 }])
    expect(isOpen(state, 'e-ini-puerta')).toBe(true)
  })

  it('a soft lock can be skilled past without ever holding the ability', () => {
    const { document, config } = labWorld()
    expect(config.challenge.mastery_per_solve).toBeGreaterThan(0)

    let state = drive(initOf(document), 0, 3, [{ tick: 0, action: 'move', slot: 'caja' }])
    expect(nodeIdAt(state)).toBe('caja')

    const caja = state.nodes.findIndex((node) => node.id === 'caja')
    const correct = state.nodes[caja]?.challenge?.options.findIndex((option) => option.correct) ?? -1
    state = drive(state, 3, 4, [{ tick: 3, action: 'take', slot: 'caja', n: correct }])
    expect(state.mastery).toBe(config.challenge.mastery_per_solve)
    expect(state.tier).toEqual([0, 0])

    state = drive(state, 4, 5, [{ tick: 4, action: 'use', slot: 'e-caja-puerta' }])
    expect(isOpen(state, 'e-caja-puerta')).toBe(true)
    // The skill route costs nothing: the price was learning the thing in the first place.
    expect(state.energy).toBe(config.energy.max)
  })

  it('a one-way shortcut only opens from the far side', () => {
    const { document } = labWorld()

    let state = drive(initOf(document), 0, 3, [{ tick: 0, action: 'move', slot: 'aula-a' }])
    state = drive(state, 3, 4, [{ tick: 3, action: 'take', slot: 'aula-a' }])
    state = drive(state, 4, 7, [{ tick: 4, action: 'move', slot: 'inicio' }])
    state = drive(state, 7, 10, [{ tick: 7, action: 'move', slot: 'caja' }])
    expect(nodeIdAt(state)).toBe('caja')

    // Standing at `from` with the ability in hand: the shortcut stays shut.
    state = drive(state, 10, 11, [{ tick: 10, action: 'use', slot: 'e-caja-ini', n: 0 }])
    expect(isOpen(state, 'e-caja-ini')).toBe(false)

    // Standing at `to`, the far side reached the long way: now it opens.
    state = drive(state, 11, 14, [{ tick: 11, action: 'move', slot: 'inicio' }])
    state = drive(state, 14, 15, [{ tick: 14, action: 'use', slot: 'e-caja-ini', n: 0 }])
    expect(isOpen(state, 'e-caja-ini')).toBe(true)
  })
})

// The renderer. `explorer.test.ts` above feeds the SIMULATOR hand-written actions and
// proves the rules; none of that can see the UI, so an engine whose view emitted nothing
// at all would still pass every one of them. These drive the REAL controls a child
// touches — the TAP route specifically, because tap is the guaranteed path and drag is
// only ever enhancement over it (/CLAUDE.md §1.11).
describe('explorer view', () => {
  const document_ = explorerFixtures[0]

  function snapshotOf(state: ExplorerState): SimSnapshot {
    return explorerSimulator.snapshot(state)
  }

  function renderView(state: ExplorerState, emit: (action: string, payload?: unknown) => void) {
    if (document_ === undefined) throw new Error('fixture missing')
    return render(
      createElement(ExplorerView, {
        document: document_,
        state,
        snapshot: snapshotOf(state),
        emit: emit as never,
        paused: false,
        reducedMotion: false,
      }),
    )
  }

  it('renders the whole authored map and emits a move when a reachable node is tapped', () => {
    if (document_ === undefined) throw new Error('fixture missing')
    const emit = vi.fn()
    renderView(initOf(document_), emit)

    // Every revealed node is on screen by its own authored label.
    for (const node of contentOf(document_).nodes) {
      expect(screen.getByText(node.label_md)).toBeInTheDocument()
    }

    const button = screen.getByText('La tiendita').closest('button')
    expect(button).not.toBeNull()
    expect(button?.getAttribute('disabled')).toBeNull()
    fireEvent.click(button as HTMLButtonElement)

    expect(emit).toHaveBeenCalledWith('move', { slot: 'tiendita' })
  })

  it('opens a lock with two taps: pick the ability, then tap the lock — no drag needed', () => {
    if (document_ === undefined) throw new Error('fixture missing')
    // Stand at the tutorial room holding the ability its lock wants.
    let state = drive(initOf(document_), 0, 3, [{ tick: 0, action: 'move', slot: 'tiendita' }])
    state = drive(state, 3, 4, [{ tick: 3, action: 'take', slot: 'tiendita' }])
    expect(nodeIdAt(state)).toBe('tiendita')

    const emit = vi.fn()
    const { container } = renderView(state, emit)

    fireEvent.click(screen.getByText('Contar mi dinero').closest('button') as HTMLButtonElement)
    const badge = container.querySelector('[data-dropzone="e-tiendita-libreria"]')
    expect(badge).not.toBeNull()
    fireEvent.click(badge as HTMLElement)

    expect(emit).toHaveBeenCalledWith('use', { slot: 'e-tiendita-libreria', n: 0 })
  })

  it('keeps every control at or above the 44px hit-target floor', () => {
    if (document_ === undefined) throw new Error('fixture missing')
    const { container } = renderView(initOf(document_), vi.fn())
    for (const button of Array.from(container.querySelectorAll('button'))) {
      expect(button.className).toContain('min-h-11')
      expect(button.className).toContain('min-w-11')
    }
  })
})
