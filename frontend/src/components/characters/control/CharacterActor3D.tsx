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

export function CharacterActor3D(props: CharacterActorProps & { stageHeightM?: number }) {
  const { character, emotion, action, bubble, size = 'md', className, actionKey, stageHeightM } = props

  // A bubble is a 2D affordance. Asking for one gets the 2D character, whole,
  // rather than a canvas with an approximation of one bolted beside it.
  if (bubble) return <CharacterActor {...props} />

  return (
    <CharacterSlot
      character={character}
      emotion={emotion}
      action={action}
      actionKey={actionKey}
      fill={SIZE_FILL[size]}
      stageHeightM={stageHeightM}
      className={cn('pointer-events-none select-none', SIZE_CLASSES[size], className)}
    />
  )
}

export default CharacterActor3D
