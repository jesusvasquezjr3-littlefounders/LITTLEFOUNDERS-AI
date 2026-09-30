import type { CharacterAction, CharacterEmotion, CharacterId } from '@/components/characters/control/types';
import { findMentorAvatar, findMentorAvatarInPose, resolveMentorRender } from '@/rebuild/design/assets';
import { POSES } from './poseLibrary';

/*
 * WHAT A CHARACTER SLOT SHOWS WHEN THE 3D LAYER IS NOT DRAWING.
 *
 * Frontend Bible 02 rule 21 and D12, 07 §4 and 08 §7: a Mentor character is
 * only ever a render of its real 3D model, and the fallback while the model
 * loads, without WebGL, after a lost context or in a background tab is a
 * pre-rendered still of the SAME model in a catalogue pose. There is no
 * hand-drawn, letter or look-alike stand-in.
 *
 * A slot sits inside the lesson's own layout (a transcript line, the narrator
 * strip, a cast row), so its still must be transparent: the manifest's square,
 * transparent `mentor.avatar` renders, resolved through `resolveMentorRender`
 * (the same refusals the rebuilt avatar applies). The emotion and action the
 * slot was asked for map to the catalogue pose that expresses them, exactly
 * as the rebuilt stage maps a state to a pose for its stills
 * (`rebuild/mentor/stageStills.ts`); a transparent render in that pose is used
 * when one is registered, otherwise the character's idle avatar render. The
 * pose actually shown is returned, so the slot never claims a state it is not
 * showing (`data-still-pose`).
 */

export interface SlotStill {
  /** The manifest id of the render. */
  id: string;
  /** The public path of the render. */
  path: string;
  /** The catalogue pose the render shows. */
  poseId: string;
  /** The catalogue pose the slot's emotion and action map to. */
  requestedPoseId: string;
}

/** Poses a slot may map to: every character performs them, facing the learner. */
const SLOT_POSES = POSES.filter((pose) => pose.rotation === undefined && !pose.only);
/** The ambient poses first: a resting slot is the resting state (`ambient.idle`), not a greeting or a pause. */
const ORDERED = [...SLOT_POSES.filter((pose) => pose.category === 'ambient'), ...SLOT_POSES.filter((pose) => pose.category !== 'ambient')];

/**
 * The catalogue pose for an emotion and action: the first pose with both
 * (ambient poses first, then catalogue order); else the pose holding that
 * emotion at rest; else the resting pose.
 */
export function poseForSlot(emotion: CharacterEmotion = 'neutral', action: CharacterAction = 'idle'): string {
  const exact = ORDERED.find((pose) => pose.emotion === emotion && pose.action === action);
  if (exact) return exact.id;
  const resting = ORDERED.find((pose) => pose.emotion === emotion && pose.action === 'idle');
  return resting?.id ?? 'ambient.idle';
}

/**
 * The manifest-registered still a slot shows for one character, emotion,
 * action and colour mode, or null when the manifest holds no transparent
 * render of that character (the slot then stays empty; never a stand-in).
 */
export function findSlotStill({ character, emotion, action, theme }: {
  character: CharacterId;
  emotion?: CharacterEmotion;
  action?: CharacterAction;
  theme: 'light' | 'dark';
}): SlotStill | null {
  const requestedPoseId = poseForSlot(emotion, action);
  const id = findMentorAvatarInPose(character, theme, requestedPoseId) ?? findMentorAvatar(character, theme);
  const render = id ? resolveMentorRender(id) : null;
  if (!render || render.character !== character) return null;
  return { id: render.id, path: render.path, poseId: render.poseId, requestedPoseId };
}
