import { cn } from '@/lib/utils'
import { CharacterSlot } from '@/tutor-scene/CharacterLayer'
import type { CharacterAction, CharacterEmotion, CharacterId } from './types'

export interface CharacterActorProps {
  character: CharacterId
  emotion?: CharacterEmotion
  /** One-shot action; the 3D layer returns to idle on its own. */
  action?: CharacterAction
  /**
   * Accepted for callers; the 3D layer decides looping from its own table
   * (`LOOPING_ACTIONS`/`LOOPING_CLIPS`), and the pose catalogue pins the two.
   */
  loop?: boolean
  speaking?: boolean
  size?: 'sm' | 'md' | 'lg' | 'fill'
  className?: string
  /** Bump this to replay the same action (e.g. two "correct" in a row). */
  actionKey?: number
}

/*
 * THE LESSON ENGINE'S CHARACTER, DRAWN IN 3D.
 *
 * THIS DOES NOT OWN A CANVAS. It renders a placeholder that registers with the
 * `CharacterLayerProvider` above it, and one shared canvas draws every
 * character on the screen into its own rectangle. Ten avatars in a dialogue
 * transcript are ten draws in one WebGL context, not ten contexts. Outside a
 * provider, or while the layer is not drawing, the placeholder shows a
 * manifest-registered still of the same character's real model
 * (`tutor-scene/slotStill.ts`; Frontend Bible 02 rule 21, 07 §4, 08 §7). The
 * legacy hand-drawn 2D characters, their bubble and their mouse-tracking
 * pupils were look-alikes and are gone (gap-fix round 8).
 *
 * `speaking` IS expressed, as ARTICULATION rather than lip-sync. Neither rig
 * has a jaw bone, and the viseme card is fitted for only two of the four
 * characters, so a speaking character moves its head and chest on a syllabic
 * cadence — which reads as talking at every size a lesson uses, including the
 * 80 px avatar where a moving mouth would be four pixels. `applySpeaking` in
 * `characterActions.ts` carries the reasoning; real lip-sync stays the Tutor's
 * viseme path, where the geometry for it exists.
 */

/*
 * THE PRESENCE SCALE — how much of a lesson a character is allowed to be.
 *
 * Owner note, 2026-08-27: the characters were too small to be the presence a
 * lesson needs, "como lo hacen los personajes de Duolingo". Two things were
 * wrong and only one of them was size.
 *
 * The other was FRAMING. Our characters were drawn head to toe in every box, so
 * a 96 px avatar spent 70 of those pixels on legs and gave the face 25. A bust
 * crop in the SAME box reads as a character looking at the learner. Presence is
 * mostly framing, and only then size — which is also why this is a scale of
 * four named roles rather than a set of pixel values: a call site chooses what
 * the character IS on that screen, and the proportions follow from here.
 *
 *   inline  a voice in a list — one line of a transcript, a chip in a row
 *   talk    the character SPEAKING to the learner: the narrator strip, feedback
 *   scene   the character IS the screen's subject — a story beat
 *   cast    the company, standing together at the open and at the close
 *
 * Every step is defined at both breakpoints, because §1.11 makes both
 * non-negotiable and a character that only works at 1280 is half a character.
 */
export type CharacterPresence = 'inline' | 'talk' | 'scene' | 'cast'

interface PresenceSpec {
  /** Box, mobile then desktop. */
  box: string
  crop: 'full' | 'bust'
  fill: number
  /** Frame a shared world height so a row keeps true relative sizes. */
  stage?: boolean
}

const PRESENCE: Record<CharacterPresence, PresenceSpec> = {
  inline: { box: 'h-20 w-20 sm:h-24 sm:w-24', crop: 'bust', fill: 0.96 },
  talk: { box: 'h-28 w-28 sm:h-36 sm:w-36', crop: 'bust', fill: 0.96 },
  scene: { box: 'h-44 w-44 sm:h-56 sm:w-56', crop: 'full', fill: 0.94 },
  cast: { box: 'h-40 w-32 sm:h-52 sm:w-44', crop: 'full', fill: 0.94, stage: true },
}

const SIZE_CLASSES: Record<NonNullable<CharacterActorProps['size']>, string> = {
  sm: 'h-24 w-24',
  md: 'h-40 w-40',
  lg: 'h-56 w-56',
  fill: 'h-full w-full',
}

/*
 * How much of its rectangle the character fills.
 *
 * Smaller boxes get a TIGHTER crop, because a 96 px full-body figure is a
 * smudge: at that size the face is the whole point and the feet are four
 * pixels. The camera does it here.
 */
const SIZE_FILL: Record<NonNullable<CharacterActorProps['size']>, number> = {
  sm: 0.94,
  md: 0.9,
  lg: 0.86,
  fill: 0.92,
}

/*
 * The world height a cast row frames, in metres.
 *
 * Dina is the tallest of the four at 1.9 m; dividing by the fill leaves a
 * little air above her. Every member of a row frames THIS height rather than
 * its own, which is what keeps 1.61 m Zara visibly shorter than 1.9 m Dina.
 */
export const CAST_STAGE_HEIGHT_M = 1.9 / 0.86

export function CharacterActor3D(
  props: CharacterActorProps & { presence?: CharacterPresence; stageHeightM?: number },
) {
  const { character, emotion, action, size = 'md', className, actionKey, presence, speaking } = props
  const spec = presence ? PRESENCE[presence] : null

  return (
    <CharacterSlot
      character={character}
      emotion={emotion}
      action={action}
      actionKey={actionKey}
      speaking={speaking}
      fill={spec ? spec.fill : SIZE_FILL[size]}
      crop={spec?.crop}
      stageHeightM={spec?.stage ? CAST_STAGE_HEIGHT_M : props.stageHeightM}
      className={cn('pointer-events-none select-none', spec ? spec.box : SIZE_CLASSES[size], className)}
    />
  )
}

export default CharacterActor3D
