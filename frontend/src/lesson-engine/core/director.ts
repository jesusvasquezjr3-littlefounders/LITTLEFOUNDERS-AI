/*
 * The director — maps session events to character reactions
 * (LESSON_ENGINE.md §9). Wrong answers get ENCOURAGING reactions, never
 * mocking (P3). Rotation avoids two identical consecutive reactions.
 *
 * EVERY REACTION NAMES A POSE, and that is the point of this file now. It used
 * to carry its own inline table of emotion/action pairs — a second vocabulary
 * beside the 100-entry pose library, drifting from it, with no gate to notice.
 * GOAL_3D_CHARACTERS.md §6 decision 3 asked for gamification that REUSES the
 * library rather than adding a system beside it, and a director that names
 * `feedback.correct` instead of restating `{ happy, nod }` is what that means
 * in practice: the pose is documented once, reviewed once in the pose lab, and
 * changing how "a right answer" looks is a change to the catalog rather than a
 * change in two places that were supposed to agree.
 */

import type { CharacterId } from '@/components/characters/control/types'
import { poseById, resolvePose } from '@/tutor-scene/poseLibrary'
import type { CharacterAction, CharacterEmotion } from '@/components/characters/control/types'

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
  /** The catalog entry this came from, so a surface can say what it played. */
  pose: string
}

/*
 * Pose IDs, in the order they rotate. Two or more per event so the same beat
 * never looks identical twice running, and all of them drawn from the catalog's
 * own `feedback` / `celebration` / `greeting` categories — which is also why a
 * reviewer can SEE what a wrong answer looks like without reading this file.
 */
const POSES: Record<DirectorEvent, readonly string[]> = {
  lesson_start: ['greet.hello', 'greet.excited', 'greet.ready'],
  correct: ['feedback.correct', 'feedback.correct.bright', 'celebrate.joy', 'feedback.correct.quiet'],
  perfect: ['feedback.correct.proud', 'celebrate.perfect', 'celebrate.first'],
  almost: ['feedback.almost', 'feedback.better', 'feedback.retry.gentle'],
  // NEVER mocking, never disappointed: the catalog's retry poses are the
  // encouraging ones by construction (LESSON_ENGINE.md P3).
  wrong: ['feedback.retry', 'feedback.retry.gentle', 'feedback.hint'],
  streak: ['celebrate.streak', 'celebrate.satisfied', 'feedback.correct.streak'],
  hint: ['feedback.hint', 'think.ponder', 'teach.checkin'],
  results_pass: ['celebrate.lesson', 'celebrate.levelup'],
  results_fail: ['celebrate.comeback', 'feedback.timeout'],
  idle: ['ambient.idle', 'ambient.listen'],
}

/** Every pose the director can ask for — the gate in its test walks this. */
export const DIRECTOR_POSE_IDS: readonly string[] = Object.freeze(
  [...new Set(Object.values(POSES).flat())],
)

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
      const pool = POSES[event]
      const last = state.lastIndex[event] ?? -1
      const next = pool.length > 1 ? (last + 1) % pool.length : 0
      state.lastIndex[event] = next
      let character = preferred
      if (!character) {
        character = safeCast[state.castCursor % safeCast.length] ?? 'dina'
        state.castCursor++
      }
      /*
       * Resolved FOR THIS CHARACTER: `resolvePose` is what falls back when a
       * pose does not apply to whoever is reacting, rather than leaving a
       * character frozen in an idle that reads as a broken model. A pose id
       * that no longer exists resolves to null and lands on the catalog's
       * resting state — loud enough for the test to catch and quiet enough that
       * a learner never sees a hole.
       */
      const id = pool[next]
      const pose = (id ? resolvePose(id, character) : null) ?? poseById('ambient.idle')
      return {
        emotion: (pose?.emotion ?? 'neutral') as CharacterEmotion,
        action: (pose?.action ?? 'idle') as CharacterAction,
        pose: id ?? 'ambient.idle',
        character,
      }
    },
  }
}

export type Director = ReturnType<typeof createDirector>
