// Registry-completeness gate (GAME_ENGINE.md §7) — the twin of the Lesson Engine's
// registry.test.tsx. It proves the two properties the hub and the player depend on:
//
//   COMPLETENESS   every declared mechanic id has hub metadata and a loader row, so a
//                  9th id cannot be added without its card and its chunk.
//   DEGRADATION    a mechanic this build does not implement resolves to `null` and
//                  parses to the stable unsupported reason — it never throws. That is
//                  the property that lets new mechanics ship into production content
//                  without breaking clients that predate them.
//
// It also holds the implemented slices to their own contract: their fixtures must
// survive the FULL production parse (§1.14 — fixtures satisfy production schemas,
// never a relaxed one).
//
// Every per-slice assertion below is driven by IMPLEMENTED, which is DERIVED from the
// loader table — so wiring a new mechanic in subjects it to the identical battery with
// no edit here. The one hand-maintained list is WIRED: it pins WHICH mechanics this
// build claims to ship, so a row silently reverting to `null` (or a mechanic landing
// with a slice nobody registered) fails loudly instead of quietly shrinking the
// derived matrix to the mechanics that still work.
//
// Coverage is now FULL: all eight declared mechanics are wired, so IMPLEMENTED ===
// MECHANIC_IDS and UNIMPLEMENTED is empty. The DEGRADATION suite is deliberately NOT
// deleted along with the partial coverage it was written for — its live, reachable case
// is an id outside MECHANIC_IDS entirely ('newthing'), which is precisely the mechanic-#9
// scenario, and its UNIMPLEMENTED-driven cases re-arm themselves the moment a 9th id is
// declared ahead of its slice. Those loops iterate an empty list today, so each one also
// asserts that emptiness explicitly rather than passing silently on nothing.

import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { UNSUPPORTED_MECHANIC, isUnsupportedMechanic, parseGameDocument } from './core/schema'
import { MECHANIC_IDS } from './core/types'
import type { MechanicId, MechanicSlice } from './core/types'
import { MECHANIC_LOADERS, MECHANIC_META, isMechanicId, loadMechanic } from './registry'

/**
 * The mechanics this build ships. Update it in the SAME commit that adds a loader row
 * — never to make a red test green, since a row disappearing from MECHANIC_LOADERS is
 * exactly the regression this list exists to catch.
 */
const WIRED: MechanicId[] = [
  'sorter',
  'launcher',
  'runner',
  'stacker',
  'autobattler',
  'explorer',
  'defender',
  'flyer',
]

const IMPLEMENTED: MechanicId[] = MECHANIC_IDS.filter((id) => MECHANIC_LOADERS[id] !== null)
const UNIMPLEMENTED: MechanicId[] = MECHANIC_IDS.filter((id) => MECHANIC_LOADERS[id] === null)

/** Every ordered pair of distinct implemented mechanics, for the cross-mechanic checks. */
const PAIRS: [MechanicId, MechanicId][] = IMPLEMENTED.flatMap((a) =>
  IMPLEMENTED.filter((b) => b !== a).map((b): [MechanicId, MechanicId] => [a, b]),
)

/** Loads a slice and fails the test — rather than returning null — when it is missing. */
async function requireSlice(id: MechanicId): Promise<MechanicSlice> {
  const slice = await loadMechanic(id)
  if (slice === null) throw new Error(`no slice for ${id}`)
  return slice
}

describe('registry completeness', () => {
  it('MECHANIC_META covers every declared mechanic id, with i18n keys and an icon', () => {
    expect(Object.keys(MECHANIC_META).sort()).toEqual([...MECHANIC_IDS].sort())
    for (const id of MECHANIC_IDS) {
      const meta = MECHANIC_META[id]
      expect(meta.titleKey, `titleKey for ${id}`).toBe(`games.mechanics.${id}.title`)
      expect(meta.blurbKey, `blurbKey for ${id}`).toBe(`games.mechanics.${id}.blurb`)
      // Material Symbols ligature names are lowercase words joined by underscores.
      expect(meta.icon, `icon for ${id}`).toMatch(/^[a-z0-9_]+$/)
    }
  })

  it('MECHANIC_LOADERS has a row for every id, and exactly the wired ones resolve', () => {
    expect(Object.keys(MECHANIC_LOADERS).sort()).toEqual([...MECHANIC_IDS].sort())
    expect(IMPLEMENTED.sort()).toEqual([...WIRED].sort())
    for (const id of UNIMPLEMENTED) {
      expect(WIRED, `${id} is unwired but listed as shipped`).not.toContain(id)
    }
  })

  it('ships EVERY declared mechanic — coverage is full, not partial', () => {
    // The assertion this file was built to grow into. Every declared id resolves to a
    // slice, so no published document can name a mechanic this build merely knows the
    // name of. A future id added to MECHANIC_IDS fails HERE first, which is the intended
    // signal: declare it, wire it, and only then does content start naming it.
    expect(IMPLEMENTED.sort()).toEqual([...MECHANIC_IDS].sort())
    expect(UNIMPLEMENTED).toEqual([])
    expect(WIRED.sort()).toEqual([...MECHANIC_IDS].sort())
    for (const id of MECHANIC_IDS) expect(MECHANIC_LOADERS[id], `loader for ${id}`).not.toBeNull()
  })

  it('isMechanicId accepts declared ids and rejects anything else', () => {
    for (const id of MECHANIC_IDS) expect(isMechanicId(id)).toBe(true)
    expect(isMechanicId('newthing')).toBe(false)
    expect(isMechanicId('')).toBe(false)
  })
})

describe('implemented mechanics', () => {
  it.each(IMPLEMENTED)('the %s loader resolves to its OWN slice', async (id) => {
    const slice = await requireSlice(id)
    // Catches the copy-paste wiring bug the loader table invites: a row whose path or
    // named export points at a neighbouring mechanic's slice.
    expect(slice.mechanic).toBe(id)
    expect(typeof slice.View).not.toBe('undefined')
    expect(slice.simulator.mechanic).toBe(id)
    expect(slice.simulator.actions.length).toBeGreaterThan(0)
    // The slice the BROWSER loads must carry no headless player. `bots.perfect` returns
    // the exact input log Core replays for XP — 4-61 events for these mechanics — so a
    // simulator that still exposed it would be a working cheat shipped in the chunk.
    // The bots live in each mechanic's `bots.ts`, imported only by gamegen's winnability
    // gate and by tests (see the module-graph guard below).
    expect(slice.simulator).not.toHaveProperty('bots')
    expect(slice).not.toHaveProperty('bots')
    // GAME_ENGINE.md §7: >= 2 complete, playable manifests per mechanic.
    expect(slice.fixtures.length).toBeGreaterThanOrEqual(2)
  })

  it('every implemented row resolves to a distinct slice', async () => {
    const slices = await Promise.all(IMPLEMENTED.map(requireSlice))
    expect(new Set(slices).size).toBe(IMPLEMENTED.length)
    expect(slices.map((slice) => slice.mechanic).sort()).toEqual([...IMPLEMENTED].sort())
  })

  it.each(IMPLEMENTED)('%s declares a non-empty, duplicate-free sprite slot set', async (id) => {
    const slice = await requireSlice(id)
    expect(slice.spriteSlots.length).toBeGreaterThan(0)
    expect(new Set(slice.spriteSlots).size).toBe(slice.spriteSlots.length)
  })

  it.each(IMPLEMENTED)('every %s fixture parses through parseGameDocument', async (id) => {
    const slice = await requireSlice(id)
    for (const fixture of slice.fixtures) {
      expect(fixture.meta.mechanic, `fixture ${fixture.meta.slug} names another mechanic`).toBe(id)
      const parsed = await parseGameDocument(fixture)
      if (!parsed.ok) {
        throw new Error(`${id}/${fixture.meta.slug}\n${parsed.issues.join('\n')}`)
      }
      expect(parsed.document.meta.slug).toBe(fixture.meta.slug)
      expect(parsed.document.meta.mechanic).toBe(id)
    }
  })

  it.each(IMPLEMENTED)('every %s fixture binds only declared sprite slots', async (id) => {
    const slice = await requireSlice(id)
    for (const fixture of slice.fixtures) {
      for (const slot of Object.keys(fixture.skin.sprites)) {
        expect(
          slice.spriteSlots.includes(slot),
          `${id}/${fixture.meta.slug} binds undeclared sprite slot "${slot}"`,
        ).toBe(true)
      }
      // An `image_slot` need NOT be bound in skin.sprites — sprite URLs are Prism
      // artifacts written by `illustrate`, which runs after the gate, so an
      // un-illustrated fixture is a valid state that falls back to `icon` (core/schema.ts).
      // It must still name a DECLARED slot, or nothing could ever bind it.
      const slots: readonly string[] = slice.spriteSlots
      for (const item of fixture.content.items) {
        if (item.image_slot !== undefined) {
          expect(slots, `${id}/${fixture.meta.slug} item ${item.id}`).toContain(item.image_slot)
        }
      }
      for (const category of fixture.content.categories ?? []) {
        if (category.image_slot !== undefined) {
          expect(slots, `${id}/${fixture.meta.slug} category ${category.id}`).toContain(
            category.image_slot,
          )
        }
      }
    }
  })

  it.each(IMPLEMENTED)('caches the %s slice, so its chunk is evaluated once', async (id) => {
    const first = await loadMechanic(id)
    const second = await loadMechanic(id)
    expect(first).not.toBeNull()
    expect(second).toBe(first)
  })

  it('concurrent callers of the same mechanic share one in-flight load', async () => {
    // Sequenced over every implemented mechanic so a new row is covered automatically.
    for (const id of IMPLEMENTED) {
      const [a, b] = await Promise.all([loadMechanic(id), loadMechanic(id)])
      expect(a, `no slice for ${id}`).not.toBeNull()
      expect(b).toBe(a)
    }
  })
})

describe('forward compatibility', () => {
  it('returns null, never throwing, for a declared-but-unimplemented mechanic', async () => {
    // Empty today (full coverage), so the emptiness is asserted rather than left as a
    // silently-passing loop. The loop stays armed for the next id declared ahead of its
    // slice: on that day this is the test that catches a throw before a blank screen
    // reaches a child.
    for (const id of UNIMPLEMENTED) {
      await expect(loadMechanic(id)).resolves.toBeNull()
    }
    expect(UNIMPLEMENTED).toEqual([])
  })

  it('returns null, never throwing, for an id this build has never heard of', async () => {
    // Holds at ANY coverage level, including the day all eight mechanics are wired —
    // this is the property that lets mechanic #9's content ship before its code does.
    await expect(loadMechanic('newthing')).resolves.toBeNull()
    await expect(loadMechanic('')).resolves.toBeNull()
  })

  it('parses an unknown mechanic to the stable unsupported reason', async () => {
    const slice = await requireSlice('sorter')
    const fixture = slice.fixtures[0]
    if (fixture === undefined) throw new Error('sorter has no fixtures')

    // A document published by a NEWER Arcade than this client knows about.
    const fromTheFuture = { ...fixture, meta: { ...fixture.meta, mechanic: 'newthing' } }
    const parsed = await parseGameDocument(fromTheFuture)
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.issues[0] ?? '').toContain(UNSUPPORTED_MECHANIC)
    expect(isUnsupportedMechanic(parsed.issues)).toBe(true)
  })

  it('parses a declared-but-unimplemented mechanic to the unsupported reason', async () => {
    // A `for` loop rather than `it.each(UNIMPLEMENTED)`: the list is empty at full
    // coverage, and an empty `each` table is a Vitest error, not a skipped case.
    const slice = await requireSlice('sorter')
    const fixture = slice.fixtures[0]
    if (fixture === undefined) throw new Error('sorter has no fixtures')

    for (const id of UNIMPLEMENTED) {
      const parsed = await parseGameDocument({ ...fixture, meta: { ...fixture.meta, mechanic: id } })
      expect(parsed.ok, `${id} document parsed as supported`).toBe(false)
      if (!parsed.ok) expect(isUnsupportedMechanic(parsed.issues)).toBe(true)
    }
    expect(UNIMPLEMENTED).toEqual([])
  })

  it.each(IMPLEMENTED)('reports a broken %s document as field issues', async (id) => {
    const slice = await requireSlice(id)
    const fixture = slice.fixtures[0]
    if (fixture === undefined) throw new Error(`${id} has no fixtures`)

    const broken = {
      ...fixture,
      skin: { ...fixture.skin, sprites: { not_a_slot: 'https://example.com/a.webp' } },
    }
    const parsed = await parseGameDocument(broken)
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(isUnsupportedMechanic(parsed.issues)).toBe(false)
    expect(parsed.issues.join('\n')).toContain('skin.sprites.not_a_slot')
  })

  it.each(PAIRS)('rejects a %s document carrying a %s config', async (host, donor) => {
    const hostSlice = await requireSlice(host)
    const donorSlice = await requireSlice(donor)
    const hostFixture = hostSlice.fixtures[0]
    const donorFixture = donorSlice.fixtures[0]
    if (hostFixture === undefined || donorFixture === undefined) {
      throw new Error(`fixtures missing for ${host}/${donor}`)
    }

    const mismatched = { ...hostFixture, config: donorFixture.config }
    const parsed = await parseGameDocument(mismatched)
    expect(parsed.ok, `${donor} config validated as ${host}`).toBe(false)
    if (parsed.ok) return
    expect(isUnsupportedMechanic(parsed.issues)).toBe(false)
    expect(parsed.issues.some((issue) => issue.startsWith('config.'))).toBe(true)
  })
})

// ---- The bot leak (GAME_ENGINE.md §9, core/types.ts `Simulator`) ---------------------
//
// `bots.perfect` returns the exact `GameInputEvent[]` Core replays to grant XP, and a
// perfect log for these mechanics is 4-61 events. The bots therefore must not be
// reachable from anything the browser downloads. The runtime shape is asserted above;
// this suite pins the IMPORT GRAPH, because the shape check alone would still pass if
// `bots.ts` were pulled into the chunk for a side effect or a re-export.
//
// It walks the real relative-import graph from `register.ts` — the one module
// MECHANIC_LOADERS dynamic-imports, i.e. the exact root of the mechanic's lazy chunk —
// and asserts `bots.ts` is not in it. Source text rather than a bundler run: this is the
// property the bundler merely reflects, and it fails on the offending edge by name.

/** This file's own directory — `src/game-engine`. */
const HERE = dirname(fileURLToPath(import.meta.url))

describe('no mechanic ships its bots to the browser', () => {
  /** In-repo specifiers: `./x`, `../x`, and the `@/` alias (tsconfig `paths` → `src/*`).
   *  Both forms are followed, so an alias hop cannot launder the edge. */
  const IN_REPO_IMPORT = /from\s+'((?:\.|@\/)[^']*)'/g

  /** `frontend/src` — this file lives at `src/game-engine/registry.test.tsx`. */
  const SRC_ROOT = resolvePath(HERE, '..')

  function resolveModule(specifier: string): string | null {
    for (const candidate of [`${specifier}.ts`, `${specifier}.tsx`, `${specifier}/index.ts`]) {
      if (existsSync(candidate)) return candidate
    }
    return null
  }

  /** Every module reachable from `entry` through in-repo imports, entry included. */
  function moduleGraph(entry: string): string[] {
    const seen = new Set<string>()
    const queue = [entry]
    while (queue.length > 0) {
      const current = queue.shift()
      if (current === undefined || seen.has(current)) continue
      seen.add(current)
      const source = readFileSync(current, 'utf8')
      for (const match of source.matchAll(IN_REPO_IMPORT)) {
        const specifier = match[1]
        if (specifier === undefined) continue
        const absolute = specifier.startsWith('@/')
          ? resolvePath(SRC_ROOT, specifier.slice(2))
          : resolvePath(dirname(current), specifier)
        const resolved = resolveModule(absolute)
        if (resolved !== null) queue.push(resolved)
      }
    }
    return [...seen]
  }

  it.each(IMPLEMENTED)('%s/register.ts never reaches bots.ts', (id) => {
    const entry = resolvePath(HERE, `mechanics/${id}/register.ts`)
    expect(existsSync(entry), entry).toBe(true)
    const graph = moduleGraph(entry)
    const leaked = graph.filter((file) => file.endsWith('/bots.ts'))
    expect(leaked, `${id}'s client chunk pulls in ${leaked.join(', ')}`).toEqual([])
  })

  it.each(IMPLEMENTED)('%s/bots.ts exists and is where the bots actually live', (id) => {
    const bots = resolvePath(HERE, `mechanics/${id}/bots.ts`)
    expect(existsSync(bots), bots).toBe(true)
    const source = readFileSync(bots, 'utf8')
    expect(source).toContain(`export const ${id}Bots`)
    // The simulator literal must stay bot-less; a `bots:` member on it is the exact
    // regression this whole suite exists to prevent.
    const simulate = readFileSync(resolvePath(HERE, `mechanics/${id}/simulate.ts`), 'utf8')
    expect(simulate).not.toMatch(/^\s*bots:/m)
  })
})
