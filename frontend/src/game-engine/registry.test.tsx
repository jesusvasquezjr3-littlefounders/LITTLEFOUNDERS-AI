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

import { describe, expect, it } from 'vitest'

import { UNSUPPORTED_MECHANIC, isUnsupportedMechanic, parseGameDocument } from './core/schema'
import { MECHANIC_IDS } from './core/types'
import type { MechanicId } from './core/types'
import { MECHANIC_LOADERS, MECHANIC_META, isMechanicId, loadMechanic } from './registry'

const IMPLEMENTED: MechanicId[] = MECHANIC_IDS.filter((id) => MECHANIC_LOADERS[id] !== null)
const UNIMPLEMENTED: MechanicId[] = MECHANIC_IDS.filter((id) => MECHANIC_LOADERS[id] === null)

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

  it('MECHANIC_LOADERS has a row for every id, and at least one is implemented', () => {
    expect(Object.keys(MECHANIC_LOADERS).sort()).toEqual([...MECHANIC_IDS].sort())
    expect(IMPLEMENTED.length).toBeGreaterThan(0)
  })

  it('isMechanicId accepts declared ids and rejects anything else', () => {
    for (const id of MECHANIC_IDS) expect(isMechanicId(id)).toBe(true)
    expect(isMechanicId('newthing')).toBe(false)
    expect(isMechanicId('')).toBe(false)
  })
})

describe('implemented mechanics', () => {
  it.each(IMPLEMENTED)('the %s loader resolves to its own slice', async (id) => {
    const slice = await loadMechanic(id)
    expect(slice, `no slice for ${id}`).not.toBeNull()
    if (slice === null) return
    expect(slice.mechanic).toBe(id)
    expect(typeof slice.View).not.toBe('undefined')
    expect(slice.simulator.mechanic).toBe(id)
    // GAME_ENGINE.md §7: >= 2 complete, playable manifests per mechanic.
    expect(slice.fixtures.length).toBeGreaterThanOrEqual(2)
  })

  it.each(IMPLEMENTED)('every %s fixture parses through parseGameDocument', async (id) => {
    const slice = await loadMechanic(id)
    if (slice === null) throw new Error(`no slice for ${id}`)
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
    const slice = await loadMechanic(id)
    if (slice === null) throw new Error(`no slice for ${id}`)
    for (const fixture of slice.fixtures) {
      for (const slot of Object.keys(fixture.skin.sprites)) {
        expect(
          slice.spriteSlots.includes(slot),
          `${id}/${fixture.meta.slug} binds undeclared sprite slot "${slot}"`,
        ).toBe(true)
      }
    }
  })

  it('caches the resolved slice, so a chunk is evaluated once', async () => {
    const first = await loadMechanic('sorter')
    const second = await loadMechanic('sorter')
    expect(first).not.toBeNull()
    expect(second).toBe(first)
    // Concurrent callers share the same in-flight promise, not two evaluations.
    const [a, b] = await Promise.all([loadMechanic('runner'), loadMechanic('runner')])
    expect(a).not.toBeNull()
    expect(b).toBe(a)
  })
})

describe('forward compatibility', () => {
  it('returns null, never throwing, for a declared-but-unimplemented mechanic', async () => {
    expect(UNIMPLEMENTED.length).toBeGreaterThan(0)
    for (const id of UNIMPLEMENTED) {
      await expect(loadMechanic(id)).resolves.toBeNull()
    }
  })

  it('returns null, never throwing, for an id this build has never heard of', async () => {
    await expect(loadMechanic('newthing')).resolves.toBeNull()
    await expect(loadMechanic('')).resolves.toBeNull()
  })

  it('parses an unknown mechanic to the stable unsupported reason', async () => {
    const slice = await loadMechanic('sorter')
    if (slice === null) throw new Error('sorter slice missing')
    const fixture = slice.fixtures[0]
    if (fixture === undefined) throw new Error('sorter has no fixtures')

    // A document published by a NEWER Arcade than this client knows about.
    const fromTheFuture = { ...fixture, meta: { ...fixture.meta, mechanic: 'newthing' } }
    const parsed = await parseGameDocument(fromTheFuture)
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.issues[0] ?? '').toContain(UNSUPPORTED_MECHANIC)
    expect(isUnsupportedMechanic(parsed.issues)).toBe(true)

    // Same treatment for a declared id whose slice does not exist in this build.
    const unimplemented = UNIMPLEMENTED[0]
    if (unimplemented !== undefined) {
      const other = await parseGameDocument({
        ...fixture,
        meta: { ...fixture.meta, mechanic: unimplemented },
      })
      expect(other.ok).toBe(false)
      if (!other.ok) expect(isUnsupportedMechanic(other.issues)).toBe(true)
    }
  })

  it('reports a broken document as field issues, NOT as an unsupported mechanic', async () => {
    const slice = await loadMechanic('sorter')
    if (slice === null) throw new Error('sorter slice missing')
    const fixture = slice.fixtures[0]
    if (fixture === undefined) throw new Error('sorter has no fixtures')

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

  it('rejects a document whose config does not match the named mechanic', async () => {
    const sorter = await loadMechanic('sorter')
    const runner = await loadMechanic('runner')
    if (sorter === null || runner === null) throw new Error('slices missing')
    const sorterFixture = sorter.fixtures[0]
    const runnerFixture = runner.fixtures[0]
    if (sorterFixture === undefined || runnerFixture === undefined) {
      throw new Error('fixtures missing')
    }

    const mismatched = { ...sorterFixture, config: runnerFixture.config }
    const parsed = await parseGameDocument(mismatched)
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(isUnsupportedMechanic(parsed.issues)).toBe(false)
    expect(parsed.issues.some((issue) => issue.startsWith('config.'))).toBe(true)
  })
})
