// Coverage pin for the `localize` string freeze (`nonVisibleKeys.ts`).
//
// WHY THIS TEST IS SCHEMA-DERIVED AND NOT A HAND LIST. The freeze is a DENY list, so a
// field added to a mechanic schema is translatable BY DEFAULT — which is correct for a
// new `*_md` line and catastrophic for a new URL, id, enum or tuning number. Nothing at
// runtime would complain: a sprite URL handed to DeepSeek comes back as plausible prose,
// `z.url()` rejects it, and the run burns paid corrective attempts on a stage that can
// never succeed — or worse, an id "translates" into another valid id and the replay
// silently scores a different game. So this test walks the REAL schemas (the envelope
// plus all eight mechanics' config + content) and fails until every non-prose leaf is
// covered. Adding such a field to a schema breaks CI here until the freeze is updated.
//
// The rule it encodes, in one line: **a GameDocument's translatable surface is exactly
// its MarkdownLite `*_md` fields plus `meta.title` — everything else is structure.**
// Both halves are asserted: nothing structural is translated, and nothing prose is
// frozen. When it fails, ADD THE KEY (or name the new prose field `*_md`). Never relax
// the rule — that is the mistake coursegen paid for with `mode: "typed"` returning as
// pt-BR prose, and it is worse here because `skin.sprites` keys are arbitrary data.

import { describe, expect, it } from 'vitest'
import type { z } from 'zod'

import { gameDocumentEnvelopeSchema, parseGameDocumentSync } from '../contract/core/schema.js'
import { GAME_MECHANICS } from '../contract/registry.js'
import type { GameDocument } from '../contract/core/types.js'
import {
  NON_VISIBLE_KEYS,
  extractVisibleStrings,
  frozenSkeleton,
  isFrozenPath,
  setAtPath,
} from './nonVisibleKeys.js'

// ---- Zod introspection -----------------------------------------------------------
// Structural view of a Zod 4 internal def. Deliberately partial and all-optional: the
// walker reads only what it needs, and an unknown node type falls through to "leaf".

interface ZodDefLite {
  type?: string
  shape?: Record<string, z.ZodType>
  element?: z.ZodType
  innerType?: z.ZodType
  options?: z.ZodType[]
  items?: z.ZodType[]
  valueType?: z.ZodType
  left?: z.ZodType
  right?: z.ZodType
  in?: z.ZodType
  out?: z.ZodType
  getter?: () => z.ZodType
}

function defOf(schema: z.ZodType): ZodDefLite | undefined {
  return (schema as unknown as { _zod?: { def?: ZodDefLite } })._zod?.def
}

interface SchemaLeaf {
  /** Document path; `[]` marks an array element and `*` a record key. */
  path: string[]
  type: string
}

const MAX_DEPTH = 16

function collectLeaves(schema: z.ZodType, path: string[], out: SchemaLeaf[], depth: number): void {
  if (depth > MAX_DEPTH) throw new Error(`schema walker exceeded depth at ${path.join('.')}`)
  const def = defOf(schema)
  if (def === undefined) {
    out.push({ path, type: 'unknown-node' })
    return
  }
  switch (def.type) {
    case 'optional':
    case 'nullable':
    case 'default':
    case 'prefault':
    case 'nonoptional':
    case 'readonly':
    case 'catch':
      if (def.innerType) collectLeaves(def.innerType, path, out, depth + 1)
      return
    case 'pipe': {
      const next = def.out ?? def.in
      if (next) collectLeaves(next, path, out, depth + 1)
      return
    }
    case 'lazy':
      if (def.getter) collectLeaves(def.getter(), path, out, depth + 1)
      return
    case 'array':
      if (def.element) collectLeaves(def.element, [...path, '[]'], out, depth + 1)
      return
    case 'tuple':
      for (const [index, item] of (def.items ?? []).entries()) {
        collectLeaves(item, [...path, String(index)], out, depth + 1)
      }
      return
    case 'union':
      for (const option of def.options ?? []) collectLeaves(option, path, out, depth + 1)
      return
    case 'intersection':
      if (def.left) collectLeaves(def.left, path, out, depth + 1)
      if (def.right) collectLeaves(def.right, path, out, depth + 1)
      return
    case 'record':
    case 'map':
      if (def.valueType) collectLeaves(def.valueType, [...path, '*'], out, depth + 1)
      return
    case 'object':
    case 'interface':
      for (const [key, value] of Object.entries(def.shape ?? {})) {
        collectLeaves(value, [...path, key], out, depth + 1)
      }
      return
    default:
      out.push({ path, type: def.type ?? 'unnamed' })
      return
  }
}

/** Every leaf of the live contract: the shared envelope plus, for each implemented
 *  mechanic, its `config` and `content` schemas rooted at their real document paths. */
function allSchemaLeaves(): SchemaLeaf[] {
  const leaves: SchemaLeaf[] = []
  collectLeaves(gameDocumentEnvelopeSchema, [], leaves, 0)
  for (const slice of Object.values(GAME_MECHANICS)) {
    if (slice === null) continue
    collectLeaves(slice.configSchema, ['config'], leaves, 0)
    collectLeaves(slice.contentSchema, ['content'], leaves, 0)
  }
  return leaves
}

/** The last segment that names a FIELD (array/record markers are not field names). */
function fieldName(path: readonly string[]): string {
  for (let index = path.length - 1; index >= 0; index--) {
    const segment = path[index]
    if (segment !== undefined && segment !== '[]' && segment !== '*') return segment
  }
  return ''
}

/** The contract's prose convention: MarkdownLite fields end in `_md`; the one other
 *  learner-visible string in the whole document is `meta.title`. */
function isProseLeaf(path: readonly string[]): boolean {
  const name = fieldName(path)
  return name.endsWith('_md') || name === 'title'
}

// ---- A real, schema-valid document ------------------------------------------------
// Sorter, because it is the mechanic with categories, a trap item, an interlude and a
// full skin — i.e. every shape the freeze has to get right. It is parsed through
// `parseGameDocumentSync` so the test can never drift from the production contract.

function buildSorterDocument(): GameDocument {
  const raw = {
    schema_version: 1,
    meta: {
      slug: 'necesito-o-quiero',
      title: 'Necesito o quiero',
      locale: 'es-MX',
      mechanic: 'sorter',
      concept: {
        topic_path: 'mi-primer-dinero/necesidades/necesito-o-quiero',
        recap_md: 'Aprendiste que una **necesidad** es algo que usas hoy y un deseo puede esperar.',
      },
      tier: 1,
      estimated_minutes: 3,
      cast: ['liruf'],
    },
    skin: {
      palette: 'navy-papaya',
      background_url: 'https://depot.littlefounders.ai/media/game-bg-mercado.webp',
      // Arbitrary Record KEYS — the reason the freeze skips containers, not field names.
      sprites: {
        bin_1: 'https://depot.littlefounders.ai/media/bin-necesito.webp',
        bin_2: 'https://depot.littlefounders.ai/media/bin-quiero.webp',
        item_1: 'https://depot.littlefounders.ai/media/manzana.webp',
        item_2: 'https://depot.littlefounders.ai/media/juguete.webp',
      },
      sfx: { drop_correct: 'correct', drop_wrong: 'tryagain' },
      bgm: 'arcade-calm',
    },
    config: {
      mode: 'static',
      category_count: 2,
      field: { width: 800, height: 600, lanes: 4, item_size: 64 },
      ladder: [
        {
          spawn_interval_ticks: 40,
          fall_speed: 0,
          speed_variance: 0,
          max_active: 4,
          item_tiers: [1],
          points_per_correct: 10,
        },
      ],
      level_up: { correct_per_level: 5 },
      combo: { step: 2, max: 5 },
      penalty: {
        wrong_drop: { score_pct: 5, lives: 0, combo_reset: true, return_item: true },
        miss: { score_pct: 5, lives: 0, combo_reset: true },
      },
      trash_zone: false,
      repeat_items: false,
      initial_fill: 4,
      round: { target_correct: 6, target_points: 60, tick_budget: 600 },
      score_weights: { accuracy: 0.5, progress: 0.3, points: 0.2 },
    },
    content: {
      items: [
        {
          id: 'manzana',
          label_md: 'Manzana',
          category: 'necesito',
          value: 10,
          image_slot: 'item_1',
          icon: 'nutrition',
          tier: 1,
          props: { peso: 1 },
        },
        { id: 'juguete', label_md: 'Juguete nuevo', category: 'quiero', image_slot: 'item_2' },
        {
          id: 'boleto',
          label_md: 'Boleto $20',
          misconception_md: 'Parece urgente, pero la feria puede esperar a la próxima semana.',
          icon: 'confirmation_number',
        },
      ],
      categories: [
        {
          id: 'necesito',
          label_md: 'Necesito',
          description_md: 'Lo que uso hoy',
          image_slot: 'bin_1',
        },
        { id: 'quiero', label_md: 'Quiero', image_slot: 'bin_2' },
      ],
      interludes: [
        {
          id: 'pausa-1',
          after_round: 1,
          kind: 'pick_one',
          prompt_md: '¿Cuál necesitas hoy?',
          options: [
            { id: 'agua', label_md: 'Agua', correct: true, rationale_md: 'La tomas todos los días.' },
            { id: 'sticker', label_md: 'Sticker', correct: false },
          ],
        },
      ],
      feedback: {
        correct_md: ['¡Va!', '¡Justo ahí!'],
        incorrect_md: ['Casi, mira la etiqueta otra vez.'],
        results_md: 'Ordenaste el mercado como toda una fundadora.',
      },
    },
    scoring: { mode: 'cheer', xp_max: 10, pass_score: 60, lives: null },
    adaptive: {
      enabled: true,
      ease_after_failures: 2,
      ease_factor: 0.8,
      assist_toggleable: true,
    },
  }

  const parsed = parseGameDocumentSync(raw)
  if (!parsed.ok) throw new Error(`fixture is not a valid GameDocument: ${parsed.issues.join('; ')}`)
  return parsed.document
}

// ---- The coverage contract ---------------------------------------------------------

describe('NON_VISIBLE_KEYS coverage (localize string-freeze contract)', () => {
  it('walks the real schemas (guard against vacuous passes)', () => {
    const leaves = allSchemaLeaves()
    // If a Zod upgrade breaks the introspection, every assertion below would pass
    // vacuously on an empty leaf list. Pin the shape of what the walker found.
    expect(leaves.length).toBeGreaterThan(300)
    const paths = leaves.map((leaf) => leaf.path.join('.'))
    expect(paths).toContain('skin.sprites.*')
    expect(paths).toContain('skin.sfx.*')
    expect(paths).toContain('content.items.[].label_md')
    expect(leaves.some((leaf) => leaf.type === 'enum')).toBe(true)
    expect(leaves.filter((leaf) => leaf.type === 'unknown-node')).toEqual([])
  })

  it('freezes EVERY non-prose leaf of the envelope and all 8 mechanic schemas', () => {
    const uncovered = [
      ...new Set(
        allSchemaLeaves()
          .filter((leaf) => !isProseLeaf(leaf.path))
          .filter((leaf) => !isFrozenPath(leaf.path))
          .map((leaf) => `${leaf.path.join('.')} (${leaf.type})`),
      ),
    ].sort()

    expect(
      uncovered,
      'These schema leaves are NOT covered by the freeze, so localize would hand them to ' +
        'the translator. Add the field name — or, if it is a container whose KEYS are ' +
        'data, the container name — to NON_VISIBLE_KEYS in nonVisibleKeys.ts.',
    ).toEqual([])
  })

  it('does NOT freeze any prose leaf — the visible half of the contract', () => {
    const frozenProse = [
      ...new Set(
        allSchemaLeaves()
          .filter((leaf) => isProseLeaf(leaf.path))
          .filter((leaf) => isFrozenPath(leaf.path))
          .map((leaf) => leaf.path.join('.')),
      ),
    ].sort()

    expect(
      frozenProse,
      'These learner-visible fields would be COPIED VERBATIM into en-US and pt-BR, ' +
        'shipping a Spanish-only game. A key in NON_VISIBLE_KEYS is shadowing them.',
    ).toEqual([])

    // The specific fields the product depends on, named explicitly so a rename cannot
    // quietly remove them from the walk.
    for (const path of [
      ['meta', 'title'],
      ['meta', 'concept', 'recap_md'],
      ['content', 'items', 0, 'label_md'],
      ['content', 'items', 2, 'misconception_md'],
      ['content', 'categories', 0, 'description_md'],
      ['content', 'interludes', 0, 'prompt_md'],
      ['content', 'interludes', 0, 'options', 0, 'rationale_md'],
      ['content', 'feedback', 'correct_md', 0],
      ['content', 'feedback', 'results_md'],
    ]) {
      expect(isFrozenPath(path), `${path.join('.')} must stay translatable`).toBe(false)
    }
  })

  it('skips CONTAINERS whole — the difference from coursegen a field list cannot express', () => {
    for (const container of ['config', 'sprites', 'sfx', 'props', 'roles']) {
      expect(NON_VISIBLE_KEYS.has(container), `${container} must be frozen`).toBe(true)
      // Whatever the arbitrary key underneath is called, it is unreachable.
      expect(isFrozenPath(['skin', container, 'any_generated_key', 'deeper'])).toBe(true)
    }
  })
})

describe('extractVisibleStrings on a real document', () => {
  const document = buildSorterDocument()
  const extracted = extractVisibleStrings(document)
  const values = extracted.map((entry) => entry.value)

  it('extracts exactly the learner-visible prose', () => {
    expect(values).toEqual([
      'Necesito o quiero',
      'Aprendiste que una **necesidad** es algo que usas hoy y un deseo puede esperar.',
      'Manzana',
      'Juguete nuevo',
      'Boleto $20',
      'Parece urgente, pero la feria puede esperar a la próxima semana.',
      'Necesito',
      'Lo que uso hoy',
      'Quiero',
      '¿Cuál necesitas hoy?',
      'Agua',
      'La tomas todos los días.',
      'Sticker',
      '¡Va!',
      '¡Justo ahí!',
      'Casi, mira la etiqueta otra vez.',
      'Ordenaste el mercado como toda una fundadora.',
    ])
  })

  it('never extracts a generated media URL — the 1-image-serves-3-locales invariant', () => {
    expect(values.filter((value) => value.includes('depot.littlefounders.ai'))).toEqual([])
    for (const url of Object.values(document.skin.sprites)) {
      expect(values).not.toContain(url)
    }
    expect(values).not.toContain(document.skin.background_url)
  })

  it('never extracts an id, an icon ligature, an enum value or a topic path', () => {
    for (const frozen of [
      'necesito-o-quiero', // meta.slug
      'mi-primer-dinero/necesidades/necesito-o-quiero', // meta.concept.topic_path
      'es-MX', // meta.locale
      'sorter', // meta.mechanic
      'liruf', // meta.cast[]
      'navy-papaya', // skin.palette
      'arcade-calm', // skin.bgm
      'correct', // skin.sfx value
      'static', // config.mode — an ordinary English word a translator would happily render
      'manzana', // item id (lowercased twin of the label: the subtle one)
      'nutrition', // item icon ligature
      'item_1', // item image_slot
      'cheer', // scoring.mode
      'pick_one', // interlude kind
    ]) {
      expect(values, `${frozen} must never reach the translator`).not.toContain(frozen)
    }
  })
})

describe('re-injection preserves structure exactly', () => {
  it('round-trips through the same Zod contract with identical ids, numbers and URLs', () => {
    const source = buildSorterDocument()
    const candidate: GameDocument = structuredClone(source)
    candidate.meta.locale = 'pt-BR'

    // Stand-in for the model: every visible string becomes something unmistakably
    // different, and nothing else is touched.
    for (const entry of extractVisibleStrings(candidate)) {
      expect(setAtPath(candidate, entry.path, `[pt] ${entry.value}`)).toBe(true)
    }

    const parsed = parseGameDocumentSync(candidate)
    expect(parsed.ok ? [] : parsed.issues).toEqual([])
    if (!parsed.ok) return

    const translated = parsed.document
    expect(translated.meta.locale).toBe('pt-BR')
    expect(translated.meta.title).toBe('[pt] Necesito o quiero')

    // Identical ids…
    expect(translated.content.items.map((item) => item.id)).toEqual(
      source.content.items.map((item) => item.id),
    )
    expect(translated.meta.slug).toBe(source.meta.slug)
    // …identical URLs…
    expect(translated.skin.sprites).toEqual(source.skin.sprites)
    expect(translated.skin.background_url).toBe(source.skin.background_url)
    // …identical numbers and mechanic config.
    expect(translated.config).toEqual(source.config)
    expect(translated.scoring).toEqual(source.scoring)
    expect(translated.content.items.map((item) => item.value)).toEqual(
      source.content.items.map((item) => item.value),
    )

    // And the one assertion that covers every field at once, including the ones nobody
    // thought to list: with prose normalized away, the two documents are byte-identical.
    const localeSwappedSource: GameDocument = structuredClone(source)
    localeSwappedSource.meta.locale = 'pt-BR'
    expect(frozenSkeleton(translated)).toBe(frozenSkeleton(localeSwappedSource))
  })

  it('detects a document whose frozen structure moved', () => {
    const source = buildSorterDocument()
    const tampered: GameDocument = structuredClone(source)
    tampered.skin.sprites = {
      ...tampered.skin.sprites,
      bin_1: 'https://depot.littlefounders.ai/media/OTHER.webp',
    }
    expect(frozenSkeleton(tampered)).not.toBe(frozenSkeleton(source))
  })

  it('setAtPath refuses a path that no longer exists', () => {
    const document = buildSorterDocument()
    expect(setAtPath(document, ['content', 'items', 99, 'label_md'], 'x')).toBe(false)
    expect(setAtPath(document, [], 'x')).toBe(false)
  })
})
