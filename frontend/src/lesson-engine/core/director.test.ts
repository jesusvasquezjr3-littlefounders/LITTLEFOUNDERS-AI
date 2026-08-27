import { describe, expect, it } from 'vitest'
import { CHARACTER_IDS } from '@/components/characters/control/types'
import { poseById, resolvePose } from '@/tutor-scene/poseLibrary'
import { DIRECTOR_POSE_IDS, createDirector, type DirectorEvent } from './director'

/*
 * The director names POSES now, instead of restating emotion/action pairs
 * beside the 100-entry catalog. That removes a second vocabulary and adds one
 * failure mode in its place: a named pose that does not exist. These are the
 * gate for that, and for the rules the director has always had to keep.
 */

const EVENTS: DirectorEvent[] = [
  'lesson_start',
  'correct',
  'perfect',
  'almost',
  'wrong',
  'streak',
  'hint',
  'results_pass',
  'results_fail',
  'idle',
]

describe('director poses', () => {
  it('EVERY pose it can name exists in the catalog', () => {
    // The failure this prevents is silent: an unknown id falls back to a
    // resting idle, so a wrong answer would still "react" — with nothing.
    for (const id of DIRECTOR_POSE_IDS) {
      expect(poseById(id), `${id} is not in the pose library`).not.toBeNull()
    }
  })

  it('every pose it can name resolves for every character', () => {
    // Including the quadruped. A pose that resolves for three of four means one
    // character silently reacts differently from the rest of the cast.
    for (const id of DIRECTOR_POSE_IDS) {
      for (const character of CHARACTER_IDS) {
        expect(resolvePose(id, character), `${id} for ${character}`).not.toBeNull()
      }
    }
  })

  it('gives every event at least two poses, so a beat never repeats itself', () => {
    const director = createDirector(['zara'])
    for (const event of EVENTS) {
      const first = director.react(event).pose
      const second = director.react(event).pose
      if (event === 'idle') continue
      expect(second, `${event} repeated ${first}`).not.toBe(first)
    }
  })

  it('NEVER answers a wrong answer with a celebration', () => {
    /*
     * LESSON_ENGINE.md P3: wrong answers get encouraging reactions, never
     * mocking. With the poses named rather than inlined, this is now checkable
     * against the catalog's own categories instead of by reading a table.
     */
    const director = createDirector(['zara', 'rho'])
    for (let i = 0; i < 12; i += 1) {
      const reaction = director.react('wrong')
      const pose = poseById(reaction.pose)
      expect(pose?.category, `${reaction.pose} is a ${pose?.category} pose`).toBe('feedback')
      expect(['celebrate', 'dance']).not.toContain(reaction.action)
    }
  })

  it('rotates through the cast when no character is preferred', () => {
    const director = createDirector(['zara', 'rho', 'dina'])
    const seen = [director.react('correct'), director.react('correct'), director.react('correct')]
    expect(new Set(seen.map((r) => r.character)).size).toBe(3)
  })

  it('honours a preferred character — the narrator reacts to their own segment', () => {
    const director = createDirector(['zara', 'rho'])
    expect(director.react('correct', 'dina').character).toBe('dina')
  })

  it('survives an empty cast rather than throwing mid-lesson', () => {
    // Content is data and may be wrong; a lesson with no cast must still play.
    const director = createDirector([])
    const reaction = director.react('correct')
    expect(CHARACTER_IDS).toContain(reaction.character)
  })
})
