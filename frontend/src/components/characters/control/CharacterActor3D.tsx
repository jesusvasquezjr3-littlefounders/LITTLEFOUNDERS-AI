import { cn } from '@/lib/utils'
import { CharacterSlot } from '@/tutor-scene/CharacterLayer'
import CharacterActor, { type CharacterActorProps } from './CharacterActor'

/*
 * THE SAME CONTROL SURFACE, DRAWN IN 3D.
 *
 * Identical props to `CharacterActor`, so switching a surface is a one-line
 * change and every caller keeps working. The 2D component is not replaced,
 * deprecated at the file level, or moved — it is still the only thing that
 * draws a speech bubble, it is still what stands in while the 3D layer loads,
 * and it is still what every surface outside the Lesson Engine uses.
 *
 * THIS DOES NOT OWN A CANVAS. It renders a placeholder that registers with the
 * `CharacterLayerProvider` above it, and one shared canvas draws every
 * character on the screen into its own rectangle. Ten avatars in a dialogue
 * transcript are ten draws in one WebGL context, not ten contexts. Outside a
 * provider the placeholder simply renders the 2D character, so a caller that
 * forgets the provider gets a working character rather than an empty box.
 *
 * TWO PROPS ARE NOT EXPRESSED IN 3D, and neither is dropped silently:
 *
 *   bubble   — falls back to the 2D actor entirely. The bubble is drawn inside
 *              each character's own SVG, with its own tail and type ramp; a
 *              hand-rolled DOM copy floating over a canvas would be a different
 *              component wearing the same name.
 *   speaking — there is no viseme driver in a lesson yet and the lip-sync card
 *              is off (see CharacterStage). The character is present and
 *              animated, but its mouth does not move while it talks. Tracked in
 *              GOAL_3D_CHARACTERS.md as the one behaviour the swap costs.
 *
 * `enableMouseTracking` is 2D-only by nature — the SVG pupils follow a cursor,
 * and the 3D characters never had it. `loop` is honoured by the 3D layer's own
 * table (`LOOPING_ACTIONS`/`LOOPING_CLIPS`) rather than by this prop; for every
 * action the Lesson Engine passes, the two agree, and a test pins that.
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
 * pixels. The 2D characters achieve the same thing by being drawn differently
 * per size; this does it with the camera.
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
  const { character, emotion, action, bubble, size = 'md', className, actionKey, presence } = props
  const spec = presence ? PRESENCE[presence] : null

  // A bubble is a 2D affordance. Asking for one gets the 2D character, whole,
  // rather than a canvas with an approximation of one bolted beside it.
  if (bubble) return <CharacterActor {...props} />

  return (
    <CharacterSlot
      character={character}
      emotion={emotion}
      action={action}
      actionKey={actionKey}
      fill={spec ? spec.fill : SIZE_FILL[size]}
      crop={spec?.crop}
      stageHeightM={spec?.stage ? CAST_STAGE_HEIGHT_M : props.stageHeightM}
      className={cn('pointer-events-none select-none', spec ? spec.box : SIZE_CLASSES[size], className)}
    />
  )
}

export default CharacterActor3D
