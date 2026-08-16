import { AnimationUtils, type AnimationClip } from 'three';
import type { CharacterAction, CharacterEmotion } from '@/components/characters/control/types';
import { SCENE_ASSET_BASE } from './assets';

/*
 * The authored clip library.
 *
 * rho, zara and liruf share ONE 24-joint skeleton with identical bone names,
 * and a three.js AnimationClip binds to nodes BY NAME — so a single file of
 * clips drives all three. `frontend/scripts/author-clips.py` produces it.
 *
 * Dina is a quadruped on her own 27-joint rig. Playing a biped clip on her
 * would bind nothing and leave her frozen in bind pose, which is worse than the
 * procedural motion she has today, so she is excluded by rig kind rather than
 * by hoping the names miss.
 */

export const CLIP_LIBRARY_URL = `${SCENE_ASSET_BASE}/clips-biped.glb`;

/**
 * Clips that loop. Must agree with LOOPING in `scripts/author-clips.py` and
 * with LOOPING_ACTIONS in `characterActions.ts` — three sources, one truth,
 * and the test below is what keeps them from drifting.
 */
export const LOOPING_CLIPS: ReadonlySet<string> = new Set(['idle', 'celebrate', 'dance']);

/**
 * Picks the clip for an action, or null when none has been authored yet.
 *
 * A missing clip is the NORMAL case, not an error: 5 of the 19 canonical states
 * are authored so far and the procedural driver still owns the rest. Returning
 * null is what lets the two layers coexist while the library fills in.
 */
export function clipFor(
  clips: readonly AnimationClip[],
  action: CharacterAction,
): AnimationClip | null {
  return clips.find((clip) => clip.name === action) ?? null;
}

/** Names in the library that are not part of the canonical vocabulary. */
export function unknownClipNames(
  clips: readonly AnimationClip[],
  vocabulary: readonly string[],
): string[] {
  return clips.map((clip) => clip.name).filter((name) => !vocabulary.includes(name));
}

/*
 * THE EMOTION LAYER.
 *
 * Emotions compose ADDITIVELY over whichever action is playing, which is the
 * only arrangement that does not multiply the library: seven emotions times
 * twelve actions would be 84 clips to author and re-author. Additive means
 * seven, each touching head, neck and upper torso only — an emotion that moved
 * the legs would fight a jump for the same joints.
 */

/** The reference pose emotion clips are made additive against. */
export const REST_CLIP = 'emotion.rest';

export function emotionClipFor(
  clips: readonly AnimationClip[],
  emotion: CharacterEmotion,
): AnimationClip | null {
  return clips.find((clip) => clip.name === `emotion.${emotion}`) ?? null;
}

export function restClipFrom(clips: readonly AnimationClip[]): AnimationClip | null {
  return clips.find((clip) => clip.name === REST_CLIP) ?? null;
}

/*
 * `makeClipAdditive` MUTATES the clip it is given, so a clip converted twice is
 * converted against itself and the emotion quietly flattens toward nothing.
 * The library is shared by every character on screen, so that would happen on
 * the second character to mount. Convert a CLONE, once, and remember it.
 */
const additiveCache = new WeakMap<AnimationClip, AnimationClip>();

export function additiveEmotion(clip: AnimationClip, reference: AnimationClip): AnimationClip {
  const cached = additiveCache.get(clip);
  if (cached) return cached;
  const copy = clip.clone();
  /*
   * The reference is an EXPORTED rest clip rather than this clip's own frame 0,
   * because a bone's rest orientation is its bind rotation and not identity —
   * there is no way to write "no emotion" in clip space without shipping it.
   * Using frame 0 instead would make every emotion a deviation from ITSELF,
   * so a held posture like `proud` would pulse back to neutral once per loop.
   */
  AnimationUtils.makeClipAdditive(copy, 0, reference, 30);
  additiveCache.set(clip, copy);
  return copy;
}
