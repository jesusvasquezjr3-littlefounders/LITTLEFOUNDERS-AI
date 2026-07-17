// The director — maps session events to character reactions (LESSON_ENGINE.md §9).
// Wrong answers get ENCOURAGING reactions, never mocking (P3). Rotation avoids
// two identical consecutive reactions.

import type {
  CharacterAction,
  CharacterEmotion,
  CharacterId,
} from '@/components/characters/control/types'

export type DirectorEvent =
  | 'lesson_start'
  | 'correct'
  | 'perfect'
  | 'almost'
  | 'wrong'
  | 'streak'
  | 'hint'
  | 'results_pass'
  | 'results_fail'
  | 'idle'

export interface CharacterReaction {
  emotion: CharacterEmotion
  action: CharacterAction
}

const REACTIONS: Record<DirectorEvent, CharacterReaction[]> = {
  lesson_start: [
    { emotion: 'happy', action: 'wave' },
    { emotion: 'excited', action: 'peek' },
  ],
  correct: [
    { emotion: 'happy', action: 'celebrate' },
    { emotion: 'excited', action: 'jump' },
    { emotion: 'proud', action: 'nod' },
    { emotion: 'happy', action: 'hop' },
  ],
  perfect: [
    { emotion: 'excited', action: 'dance' },
    { emotion: 'proud', action: 'celebrate' },
    { emotion: 'excited', action: 'jump' },
  ],
  almost: [
    { emotion: 'encouraging', action: 'nod' },
    { emotion: 'encouraging', action: 'hop' },
  ],
  wrong: [
    { emotion: 'encouraging', action: 'think' },
    { emotion: 'thinking', action: 'nod' },
    { emotion: 'encouraging', action: 'shake' },
  ],
  streak: [
    { emotion: 'excited', action: 'dance' },
    { emotion: 'proud', action: 'jump' },
  ],
  hint: [
    { emotion: 'thinking', action: 'think' },
    { emotion: 'encouraging', action: 'point' },
  ],
  results_pass: [
    { emotion: 'proud', action: 'celebrate' },
    { emotion: 'excited', action: 'dance' },
  ],
  results_fail: [
    { emotion: 'encouraging', action: 'wave' },
    { emotion: 'encouraging', action: 'nod' },
  ],
  idle: [{ emotion: 'neutral', action: 'idle' }],
}

export interface DirectorState {
  lastIndex: Partial<Record<DirectorEvent, number>>
  castCursor: number
}

export function createDirector(cast: CharacterId[]) {
  const state: DirectorState = { lastIndex: {}, castCursor: 0 }
  const safeCast: CharacterId[] = cast.length > 0 ? cast : ['dina']

  return {
    /** Pick a reaction for the event, rotating so we never repeat the last one. */
    react(event: DirectorEvent, preferred?: CharacterId): CharacterReaction & { character: CharacterId } {
      const pool = REACTIONS[event]
      const last = state.lastIndex[event] ?? -1
      const next = pool.length > 1 ? (last + 1) % pool.length : 0
      state.lastIndex[event] = next
      let character = preferred
      if (!character) {
        character = safeCast[state.castCursor % safeCast.length] ?? 'dina'
        state.castCursor++
      }
      const reaction = pool[next] ?? { emotion: 'neutral', action: 'idle' as const }
      return { ...reaction, character }
    },
  }
}

export type Director = ReturnType<typeof createDirector>
