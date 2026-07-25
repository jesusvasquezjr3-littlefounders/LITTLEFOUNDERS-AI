// Regression tests for the 2026-07-24 shuffle no-op bug: sorting on the raw
// polynomial hash left every prefix-sharing id set (a/b/c/d, opt1.., t1..) in
// authored order, so "the correct answer is always option a" leaked the key.
import { describe, expect, it } from 'vitest'
import { seededSort } from './shuffle'

const idsOf = (list: string[], seed: string) =>
  seededSort(list.map((id) => ({ id })), seed, (o) => o.id).map((o) => o.id)

describe('seededSort', () => {
  it('does NOT reproduce the authored order for single-char option ids across seeds', () => {
    const ids = ['a', 'b', 'c', 'd']
    let identity = 0
    for (let i = 0; i < 500; i++) if (idsOf(ids, `seg-${i}`).join('') === 'abcd') identity++
    // Before the fix this was 500/500. A fair shuffle of 4 items hits the
    // identity permutation ~1/24 of the time, so allow well under a tenth.
    expect(identity).toBeLessThan(50)
  })

  it('does NOT reproduce the authored order for prefixed ids (opt1..opt4, t1..t5)', () => {
    let identity = 0
    for (let i = 0; i < 500; i++) {
      if (idsOf(['opt1', 'opt2', 'opt3', 'opt4'], `s-${i}`).join(',') === 'opt1,opt2,opt3,opt4') identity++
    }
    expect(identity).toBeLessThan(50)
    let identity2 = 0
    for (let i = 0; i < 500; i++) {
      if (idsOf(['t1', 't2', 't3', 't4', 't5'], `q-${i}`).join(',') === 't1,t2,t3,t4,t5') identity2++
    }
    expect(identity2).toBeLessThan(40)
  })

  it('is STABLE: the same seed + items always yields the same order (no jumping under the kid\'s finger)', () => {
    const ids = ['a', 'b', 'c', 'd', 'e']
    const first = idsOf(ids, 'seg-stable')
    for (let i = 0; i < 20; i++) expect(idsOf(ids, 'seg-stable')).toEqual(first)
  })

  it('gives DIFFERENT orders to different segments (per-segment decorrelation)', () => {
    const ids = ['a', 'b', 'c', 'd']
    const orders = new Set<string>()
    for (let i = 0; i < 40; i++) orders.add(idsOf(ids, `segment-${i}`).join(''))
    expect(orders.size).toBeGreaterThan(5)
  })

  it('is a PERMUTATION: never drops, duplicates or invents items', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f']
    for (let i = 0; i < 50; i++) {
      const out = idsOf(ids, `p-${i}`)
      expect(out.length).toBe(ids.length)
      expect([...out].sort()).toEqual([...ids].sort())
    }
  })
})
