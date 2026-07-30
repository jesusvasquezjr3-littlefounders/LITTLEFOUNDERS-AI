import { createRng, seedFromString, shuffleWith } from '@/game-engine/core/rng'

/** Drains `count` floats from a fresh Rng built on `seed`. */
function sequence(seed: number, count: number): number[] {
  const rng = createRng(seed)
  const out: number[] = []
  for (let i = 0; i < count; i += 1) out.push(rng.next())
  return out
}

describe('createRng', () => {
  it('produces an identical sequence for an identical seed', () => {
    expect(sequence(12345, 64)).toEqual(sequence(12345, 64))
  })

  it('produces different sequences for different seeds', () => {
    const a = sequence(1, 32)
    const b = sequence(2, 32)
    expect(a).not.toEqual(b)
    // Not merely "not deeply equal": the very first draw must already differ, so a
    // one-off replay with the wrong seed cannot look right for its opening ticks.
    expect(a[0]).not.toBe(b[0])
  })

  it('is stateful — consecutive draws from one instance are not all equal', () => {
    const rng = createRng(99)
    const draws = new Set<number>()
    for (let i = 0; i < 50; i += 1) draws.add(rng.next())
    expect(draws.size).toBeGreaterThan(45)
  })

  it('returns floats within [0, 1)', () => {
    for (const value of sequence(7, 500)) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
      expect(Number.isFinite(value)).toBe(true)
    }
  })

  it('accepts any number as a seed without producing NaN', () => {
    for (const seed of [0, -1, 2.5, 4294967296, Number.NaN]) {
      const value = createRng(seed).next()
      expect(Number.isFinite(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('replays identically from a seed derived from a run id', () => {
    const seed = seedFromString('games-testing-2026-07-30T00:00:00.000Z')
    expect(sequence(seed, 16)).toEqual(sequence(seed, 16))
  })
})

describe('rng.int', () => {
  it('stays within [0, n) and never returns n', () => {
    const rng = createRng(4242)
    for (const n of [1, 2, 3, 7, 64, 1000]) {
      for (let i = 0; i < 300; i += 1) {
        const value = rng.int(n)
        expect(Number.isInteger(value)).toBe(true)
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThan(n)
      }
    }
  })

  it('int(1) is always 0', () => {
    const rng = createRng(5)
    for (let i = 0; i < 20; i += 1) expect(rng.int(1)).toBe(0)
  })

  it('returns 0 for non-positive or non-numeric bounds instead of throwing', () => {
    const rng = createRng(11)
    expect(rng.int(0)).toBe(0)
    expect(rng.int(-5)).toBe(0)
    expect(rng.int(0.5)).toBe(0)
    expect(rng.int(Number.NaN)).toBe(0)
  })

  it('covers every bucket for a small bound (uniform-ish)', () => {
    const rng = createRng(2026)
    const counts = [0, 0, 0, 0]
    for (let i = 0; i < 4000; i += 1) {
      const value = rng.int(counts.length)
      counts[value] = (counts[value] ?? 0) + 1
    }
    for (const count of counts) {
      expect(count).toBeGreaterThan(800)
      expect(count).toBeLessThan(1200)
    }
  })

  it('is deterministic for a fixed seed', () => {
    const draw = (): number[] => {
      const rng = createRng(31337)
      const out: number[] = []
      for (let i = 0; i < 40; i += 1) out.push(rng.int(10))
      return out
    }
    expect(draw()).toEqual(draw())
  })
})

describe('seedFromString', () => {
  it('is stable for a fixed input', () => {
    expect(seedFromString('games-testing-0001')).toBe(seedFromString('games-testing-0001'))
  })

  it('returns an unsigned 32-bit integer', () => {
    for (const input of ['', 'a', 'games-testing-0001', 'ñandú-ünïcode']) {
      const seed = seedFromString(input)
      expect(Number.isInteger(seed)).toBe(true)
      expect(seed).toBeGreaterThanOrEqual(0)
      expect(seed).toBeLessThan(4294967296)
    }
  })

  it('separates near-identical run ids', () => {
    expect(seedFromString('games-testing-0001')).not.toBe(seedFromString('games-testing-0002'))
  })
})

describe('shuffleWith', () => {
  const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const

  it('returns a permutation of the input', () => {
    const shuffled = shuffleWith(items, createRng(8))
    expect(shuffled).toHaveLength(items.length)
    expect([...shuffled].sort()).toEqual([...items].sort())
  })

  it('does not mutate the input', () => {
    const source = [...items]
    shuffleWith(source, createRng(9))
    expect(source).toEqual([...items])
  })

  it('is reproducible for a fixed seed', () => {
    expect(shuffleWith(items, createRng(777))).toEqual(shuffleWith(items, createRng(777)))
  })

  it('differs across seeds', () => {
    expect(shuffleWith(items, createRng(1))).not.toEqual(shuffleWith(items, createRng(2)))
  })

  it('actually reorders (is not the identity for every seed)', () => {
    let reordered = 0
    for (let seed = 0; seed < 20; seed += 1) {
      if (shuffleWith(items, createRng(seed)).join('') !== items.join('')) reordered += 1
    }
    expect(reordered).toBe(20)
  })

  it('handles empty and single-element inputs', () => {
    expect(shuffleWith([], createRng(1))).toEqual([])
    expect(shuffleWith(['only'], createRng(1))).toEqual(['only'])
  })

  it('preserves duplicate values, including undefined entries', () => {
    const withHoles: readonly (string | undefined)[] = ['x', undefined, 'x', undefined, 'y']
    const shuffled = shuffleWith(withHoles, createRng(3))
    expect(shuffled).toHaveLength(5)
    expect(shuffled.filter((v) => v === undefined)).toHaveLength(2)
    expect(shuffled.filter((v) => v === 'x')).toHaveLength(2)
    expect(shuffled.filter((v) => v === 'y')).toHaveLength(1)
  })
})
