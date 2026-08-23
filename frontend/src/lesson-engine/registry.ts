// Central registry — composes the family slices (LESSON_ENGINE.md §4, §11).
// Adding a family = one import block here; families never edit each other.

// NO FIXTURE IMPORT HERE, DELIBERATELY. This module is EAGER — `LessonPlayer`
// reaches it for `getRegistryEntry` on every lesson a learner opens — so
// anything it imports rides into `index-*.js`. The demo fixtures used to, and
// writing them in three languages would have tripled that for a phone that
// renders one. They live in `lab/fixtureSets.ts`, which only the two lazy lab
// routes import (see the note there).
import type { FamilyGrader, Registry, RegistryEntry } from './core/types'
import { choiceGraders, choiceRegistry } from './families/choice/register'
import { storyGraders, storyRegistry } from './families/story/register'
import { inputGraders, inputRegistry } from './families/input/register'
import { arrangeGraders, arrangeRegistry } from './families/arrange/register'
import { analyzeGraders, analyzeRegistry } from './families/analyze/register'
import { storyplayGraders, storyplayRegistry } from './families/storyplay/register'
import { makerGraders, makerRegistry } from './families/maker/register'
import { moneyGraders, moneyRegistry } from './families/money/register'

export const REGISTRY: Registry = {
  ...storyRegistry,
  ...choiceRegistry,
  ...inputRegistry,
  ...arrangeRegistry,
  ...moneyRegistry,
  ...analyzeRegistry,
  ...storyplayRegistry,
  ...makerRegistry,
}

export const GRADERS: Record<string, FamilyGrader> = {
  ...storyGraders,
  ...choiceGraders,
  ...inputGraders,
  ...arrangeGraders,
  ...moneyGraders,
  ...analyzeGraders,
  ...storyplayGraders,
  ...makerGraders,
}

/** The eight families, in taxonomy order. */
export const LESSON_FAMILIES = [
  'story',
  'choice',
  'input',
  'arrange',
  'money',
  'analyze',
  'storyplay',
  'maker',
] as const

export type LessonFamily = (typeof LESSON_FAMILIES)[number]

export const ALL_TYPES: string[] = Object.keys(REGISTRY)
export const GRADED_TYPES: string[] = Object.keys(GRADERS)

/** type id → family id, derived from the same slices that compose REGISTRY. */
export const FAMILY_OF_TYPE: Record<string, LessonFamily> = Object.fromEntries(
  (
    [
      ['story', storyRegistry],
      ['choice', choiceRegistry],
      ['input', inputRegistry],
      ['arrange', arrangeRegistry],
      ['money', moneyRegistry],
      ['analyze', analyzeRegistry],
      ['storyplay', storyplayRegistry],
      ['maker', makerRegistry],
    ] as const
  ).flatMap(([family, slice]) => Object.keys(slice).map((type) => [type, family])),
) as Record<string, LessonFamily>

export function familyOfType(type: string): LessonFamily | undefined {
  return FAMILY_OF_TYPE[type]
}

/** Unknown types return undefined — the player renders the "unsupported segment"
 *  card (forward compatibility, §6). */
export function getRegistryEntry(type: string): RegistryEntry | undefined {
  return REGISTRY[type]
}
