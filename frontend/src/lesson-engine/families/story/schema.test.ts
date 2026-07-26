// `story` family — schema tests: every fixture parses; malformed samples reject.

import { describe, expect, it } from 'vitest'
import {
  checkpoint,
  conceptReveal,
  eavesdrop,
  keyIdeas,
  storyDialogue,
  storyScene,
  storySchemas,
} from './schema'
import { storyFixtures } from './fixtures'
import { storyGraders } from './grade'
import { storyRegistry } from './register'

const schemaByType = {
  story_dialogue: storyDialogue,
  story_scene: storyScene,
  key_ideas: keyIdeas,
  concept_reveal: conceptReveal,
  checkpoint,
  eavesdrop,
} as const

describe('story fixtures parse against their schemas', () => {
  it('covers every story type exactly once', () => {
    expect(storyFixtures.map((f) => f.type).sort()).toEqual(Object.keys(schemaByType).sort())
    expect(storySchemas).toHaveLength(6)
  })

  it('content types carry xp: 0 and no answer key', () => {
    for (const fixture of storyFixtures) {
      expect(fixture.xp, fixture.id).toBe(0)
      expect(fixture.answer, fixture.id).toBeUndefined()
    }
  })

  for (const fixture of storyFixtures) {
    it(`${fixture.type} fixture (${fixture.id}) parses`, () => {
      const schema = schemaByType[fixture.type as keyof typeof schemaByType]
      expect(schema).toBeDefined()
      const result = schema.safeParse(fixture)
      expect(
        result.success,
        result.success ? undefined : JSON.stringify(result.error.issues, null, 2),
      ).toBe(true)
    })
  }
})

describe('malformed story segments are rejected', () => {
  const base = { id: 'fx-bad', prompt_md: 'x', difficulty: 1, xp: 0 }

  it('story_dialogue with 0 lines fails', () => {
    expect(
      storyDialogue.safeParse({ ...base, type: 'story_dialogue', payload: { lines: [] } }).success,
    ).toBe(false)
  })

  it('story_scene with an unknown backdrop fails', () => {
    expect(
      storyScene.safeParse({
        ...base,
        type: 'story_scene',
        payload: { backdrop: 'purple', body_md: 'hola' },
      }).success,
    ).toBe(false)
  })

  it('key_ideas with a single idea fails', () => {
    expect(
      keyIdeas.safeParse({
        ...base,
        type: 'key_ideas',
        payload: { ideas: [{ icon: 'savings', title: 'Solo una', body_md: 'no alcanza' }] },
      }).success,
    ).toBe(false)
  })

  it('concept_reveal with a single card fails', () => {
    expect(
      conceptReveal.safeParse({
        ...base,
        type: 'concept_reveal',
        payload: { cards: [{ front_md: 'a', back_md: 'b' }] },
      }).success,
    ).toBe(false)
  })

  it('checkpoint without recap_md fails', () => {
    expect(
      checkpoint.safeParse({ ...base, type: 'checkpoint', payload: {} }).success,
    ).toBe(false)
  })

  it('eavesdrop rejects a highlight/notes count mismatch — the tap-to-explain invariant', () => {
    const bad = eavesdrop.safeParse({
      ...base,
      type: 'eavesdrop',
      payload: {
        context_md: 'En el mercado.',
        lines: [
          { character: 'zara', text_md: 'Hoy vamos a ==salir tablas== con la ==caja==.', notes: ['Solo una nota.'] },
          { character: 'rho', text_md: 'Sin resaltados aquí.' },
        ],
      },
    })
    expect(bad.success).toBe(false)
    if (!bad.success) {
      expect(JSON.stringify(bad.error.issues)).toContain('==highlight== span')
    }
  })

  it('eavesdrop accepts highlight-free lines with no notes', () => {
    const good = eavesdrop.safeParse({
      ...base,
      type: 'eavesdrop',
      payload: {
        context_md: 'En el mercado.',
        lines: [
          { character: 'zara', text_md: 'Hola vecino.' },
          { character: 'rho', text_md: 'Buen día de ventas.' },
        ],
      },
    })
    expect(good.success).toBe(true)
  })
})

describe('family wiring', () => {
  it('story types are ungraded — no graders registered', () => {
    expect(Object.keys(storyGraders)).toHaveLength(0)
  })

  it('all 6 types are registered as content kind', () => {
    const types = Object.keys(schemaByType)
    expect(Object.keys(storyRegistry).sort()).toEqual(types.sort())
    for (const type of types) {
      expect(storyRegistry[type]?.kind, type).toBe('content')
    }
  })
})
