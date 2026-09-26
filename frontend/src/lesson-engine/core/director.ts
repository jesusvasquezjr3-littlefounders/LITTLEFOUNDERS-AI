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
 * own categories — which is also why a reviewer can SEE what a wrong answer
 * looks like without reading this file.
 *
 * B.20 / OD-7 (S05.3g): a correct answer gets an INFORMATIONAL reaction (a nod,
 * a lean-in), never a celebration. The per-answer pools used to include
 * `celebrate.joy`, `celebrate.perfect` (a dance), `celebrate.first`,
 * `celebrate.streak` (a jump) and `feedback.correct.proud`, whose `celebrate`
 * action also plays the celebration sound (Character3D). Celebration poses are
 * now reserved for the results screen of a completed lesson, which is on the
 * closed milestone list; `PER_ANSWER_EVENTS` below is pinned by test to
 * feedback-only, nod/idle/peek/think/point actions.
 *
 * B.26 and B.23 (S05.3g): a miss gets an encouraging nod or a pointer to the
 * hint, never a head-shake, and the Mentor's presence follows the learner's
 * register (backend/src/services/learnerRegisterPolicy.ts): lively for 0–12,
 * CALM for teens and adults, where a met answer is a nod and a miss is the
 * character holding still and listening.
 */
const LIVELY: Record<DirectorEvent, readonly string[]> = {
  lesson_start: ['greet.hello', 'greet.excited', 'greet.ready'],
  correct: ['feedback.correct', 'feedback.correct.quiet'],
  perfect: ['feedback.correct', 'feedback.impressed'],
  almost: ['feedback.almost', 'feedback.better', 'feedback.retry.gentle'],
  // NEVER mocking, never disappointed, never a head-shake (B.26).
  wrong: ['feedback.retry.gentle', 'feedback.hint'],
  // A run of right answers is information (the banner names it), not a party.
  streak: ['feedback.impressed', 'feedback.correct'],
  hint: ['feedback.hint', 'think.ponder', 'teach.checkin'],
  // The only celebration: a completed lesson (OD-7), and only when Core named it.
  results_pass: ['celebrate.lesson', 'celebrate.levelup'],
  results_fail: ['feedback.retry.gentle', 'ambient.listen'],
  idle: ['ambient.idle', 'ambient.listen'],
}

/** Teen and adult registers: minimal presence, calm animation (Block B register table). */
const CALM: Record<DirectorEvent, readonly string[]> = {
  ...LIVELY,
  lesson_start: ['greet.nod', 'ambient.attentive'],
  correct: ['feedback.correct', 'ambient.attentive'],
  perfect: ['feedback.correct', 'ambient.attentive'],
  almost: ['feedback.almost', 'think.consider'],
  wrong: ['ambient.listen', 'think.wait'],
  streak: ['feedback.correct', 'ambient.attentive'],
  results_fail: ['ambient.listen', 'think.wait'],
}

/** Events that fire on a single answer. None of them may ever celebrate (B.20, OD-7). */
export const PER_ANSWER_EVENTS: readonly DirectorEvent[] = ['correct', 'perfect', 'almost', 'wrong', 'streak', 'hint']

/** The pools, exported for the pinned tests. */
export const DIRECTOR_POOLS: Readonly<{ lively: typeof LIVELY; calm: typeof CALM }> = { lively: LIVELY, calm: CALM }

/** Every pose the director can ask for — the gate in its test walks this. */
export const DIRECTOR_POSE_IDS: readonly string[] = Object.freeze(
  [...new Set([...Object.values(LIVELY), ...Object.values(CALM)].flat())],
)

export interface DirectorState {
  lastIndex: Partial<Record<DirectorEvent, number>>
  castCursor: number
}

export interface DirectorOptions {
  /** Teen and adult registers (`mentor.animation === 'calm'` in the register policy). */
  calm?: boolean
}

export function createDirector(cast: CharacterId[], options: DirectorOptions = {}) {
  const state: DirectorState = { lastIndex: {}, castCursor: 0 }
  const POSES = options.calm ? CALM : LIVELY
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
