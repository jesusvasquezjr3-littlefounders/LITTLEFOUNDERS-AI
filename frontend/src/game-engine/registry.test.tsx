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
const WIRED: MechanicId[] = ['sorter', 'launcher', 'runner', 'stacker', 'defender']

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
    // Coverage is PARTIAL by design today: autobattler, explorer and flyer have no
    // slice yet, and the degradation suite below is what keeps that safe. When the
    // last three land, WIRED becomes all of MECHANIC_IDS and this becomes full
    // coverage — the forward-compatibility suite is written to survive that.
    for (const id of UNIMPLEMENTED) {
      expect(WIRED, `${id} is unwired but listed as shipped`).not.toContain(id)
    }
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
    expect(typeof slice.simulator.bots.perfect).toBe('function')
    expect(typeof slice.simulator.bots.random).toBe('function')
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
    for (const id of UNIMPLEMENTED) {
      await expect(loadMechanic(id)).resolves.toBeNull()
    }
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

  it.each(UNIMPLEMENTED)('parses a %s document to the unsupported reason', async (id) => {
    const slice = await requireSlice('sorter')
    const fixture = slice.fixtures[0]
    if (fixture === undefined) throw new Error('sorter has no fixtures')

    const parsed = await parseGameDocument({ ...fixture, meta: { ...fixture.meta, mechanic: id } })
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(isUnsupportedMechanic(parsed.issues)).toBe(true)
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
