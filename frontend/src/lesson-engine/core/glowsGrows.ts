// "Glows & Grows" — deterministic affective feedback for the results screen.
//
// Two lines computed from the session the kid just played: the family where
// they were strongest (the Glow) and one gentle growth area framed as a quest
// (the Grow). No runtime LLM, no network — a pure selector over SessionState,
// so the copy needs no moderation pass and i18n owns every word (§1.8).
//
// Honesty rules (a kid can smell fake praise):
//   - The Glow names a family only when its average penalized score is a real
//     strength (≥ GLOW_MIN). Below that, the Glow celebrates the EFFORT of
//     finishing — true by construction — instead of inventing a strength.
//   - The Grow names a family only when there is a real gap (< GROW_MAX) AND
//     it differs from the Glow family; a perfect run earns the "mastered"
//     variant, and a single mid-range family shows no Grow at all rather than
//     contradicting its own Glow.
//   - Framing is always quest/exploration, never deficiency (COPPA-minded,
//     /AGENTS.md §1.9 — no streak-shaming applies to wording too).

import type { LessonDocument } from './types'
import type { SessionState } from './session'
import { isGraded } from './session'
import { familyOfType, type LessonFamily } from '../registry'

/** A family reads as a genuine strength only at or above this average score. */
const GLOW_MIN = 70
/** A family below this average is a fair quest; at/above it, nothing to "fix". */
const GROW_MAX = 85

export type Glow = { kind: 'family'; family: LessonFamily } | { kind: 'effort' }
export type Grow = { kind: 'family'; family: LessonFamily } | { kind: 'mastered' } | null

export interface GlowsGrows {
  glow: Glow
  grow: Grow
}

interface FamilyAgg {
  family: LessonFamily
  total: number
  firstTries: number
  n: number
}

/**
 * Returns null when the lesson has no attempted graded segments (all-story
 * lessons) — the results screen simply shows no block.
 */
export function glowsAndGrows(doc: LessonDocument, state: SessionState): GlowsGrows | null {
  const byFamily = new Map<LessonFamily, FamilyAgg>()

  for (const segment of doc.segments) {
    if (!isGraded(segment)) continue
    const seg = state.seg[segment.id]
    if (!seg || seg.attempts === 0) continue
    const family = familyOfType(segment.type)
    if (!family) continue
    const agg = byFamily.get(family) ?? { family, total: 0, firstTries: 0, n: 0 }
    agg.total += seg.best
    if (seg.firstTry === true) agg.firstTries += 1
    agg.n += 1
    byFamily.set(family, agg)
  }

  const families = [...byFamily.values()]
  if (families.length === 0) return null

  const avg = (f: FamilyAgg) => f.total / f.n
  const firstTryRate = (f: FamilyAgg) => f.firstTries / f.n

  const best = families.reduce((a, b) => {
    if (avg(b) !== avg(a)) return avg(b) > avg(a) ? b : a
    if (firstTryRate(b) !== firstTryRate(a)) return firstTryRate(b) > firstTryRate(a) ? b : a
    return b.n > a.n ? b : a
  })
  const worst = families.reduce((a, b) => {
    if (avg(b) !== avg(a)) return avg(b) < avg(a) ? b : a
    return b.n > a.n ? b : a
  })

  const glow: Glow = avg(best) >= GLOW_MIN ? { kind: 'family', family: best.family } : { kind: 'effort' }

  let grow: Grow
  if (avg(worst) >= GROW_MAX) {
    grow = { kind: 'mastered' }
  } else if (glow.kind === 'family' && worst.family === glow.family) {
    // One mid-range family: naming it as both strength and quest reads as a
    // contradiction — show only the Glow.
    grow = null
  } else {
    grow = { kind: 'family', family: worst.family }
  }

  return { glow, grow }
}
