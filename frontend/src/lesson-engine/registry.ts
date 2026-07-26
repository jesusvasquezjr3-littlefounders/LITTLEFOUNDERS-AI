// Central registry — composes the family slices (LESSON_ENGINE.md §4, §11).
// Adding a family = one import block here; families never edit each other.

import type { FamilyGrader, Registry, RegistryEntry } from './core/types'
import { choiceFixtures, choiceGraders, choiceRegistry } from './families/choice/register'
import { storyFixtures, storyGraders, storyRegistry } from './families/story/register'
import { inputFixtures, inputGraders, inputRegistry } from './families/input/register'
import { arrangeFixtures, arrangeGraders, arrangeRegistry } from './families/arrange/register'
import { analyzeFixtures, analyzeGraders, analyzeRegistry } from './families/analyze/register'
import { storyplayFixtures, storyplayGraders, storyplayRegistry } from './families/storyplay/register'
import { makerFixtures, makerGraders, makerRegistry } from './families/maker/register'
import { moneyFixtures, moneyGraders, moneyRegistry } from './families/money/register'

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

/** Fixtures by family, for /dev/lesson-lab. */
export const FIXTURES_BY_FAMILY = {
  story: storyFixtures,
  choice: choiceFixtures,
  input: inputFixtures,
  arrange: arrangeFixtures,
  money: moneyFixtures,
  analyze: analyzeFixtures,
  storyplay: storyplayFixtures,
  maker: makerFixtures,
} as const

export const ALL_TYPES: string[] = Object.keys(REGISTRY)
export const GRADED_TYPES: string[] = Object.keys(GRADERS)

export type LessonFamily = keyof typeof FIXTURES_BY_FAMILY

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
