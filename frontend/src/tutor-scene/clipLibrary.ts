import { AnimationUtils, QuaternionKeyframeTrack, type AnimationClip } from 'three';
import type { CharacterAction, CharacterEmotion } from '@/components/characters/control/types';
import { SCENE_ASSET_BASE } from './assets';

/*
 * The authored clip library.
 *
 * rho, zara and liruf share the 24 BONE NAMES the library was authored against,
 * and a three.js AnimationClip binds to nodes by name — so a single file of
 * clips can drive all three. `frontend/scripts/author-clips.py` produces it.
 *
 * WHAT THEY DO NOT SHARE IS A REST POSE, and an earlier version of this comment
 * claimed otherwise. Measured against Zara, the rig the library is authored on:
 *
 *              LeftUpLeg   Hips   Spine02   RightForeArm   foot separation
 *   zara            —        —       —           —              0.092
 *   rho           74deg    70deg   72deg        31deg           0.234
 *   liruf         39deg    27deg   11deg        73deg           0.447
 *
 * 23 of the 24 bones differ. So a clip played ABSOLUTELY dresses every
 * character in Zara's skeleton: Liruf's feet snap from 0.447 apart to 0.092,
 * and Rho's torso folds by 70 degrees. Both were visible on screen — Zara stood
 * correctly and the other two were visibly deformed, which is the tell that a
 * shared-rig assumption is false rather than the animation being bad.
 *
 * Hence the two rules enforced below: a shared clip carries ROTATION ONLY (plus
 * deliberate root motion), and it is composed ADDITIVELY over whatever pose the
 * character's own export gives it.
 *
 * Dina is a quadruped on her own 27-joint rig with different bone names. She is
 * excluded by rig kind rather than by hoping the names miss.
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
 * THE ONLY BONE ALLOWED TO TRANSLATE.
 *
 * Leaving the ground is root motion and cannot be expressed as a rotation, so
 * `jump` and `hop` translate the hips. Every OTHER translation track in these
 * files is not animation at all — a bone's translation in glTF is its rest
 * offset from its parent, i.e. the authoring character's PROPORTIONS.
 */
const ROOT_MOTION_TRACK = 'Hips.position';

/**
 * Strips everything a shared clip has no business carrying.
 *
 * The library is exported with `export_force_sampling`, which emits
 * translation, rotation AND scale for all 24 bones of all 20 clips — 1,440
 * tracks, of which 1,140 describe Zara's skeleton rather than any motion.
 * Played on Rho or Liruf those channels overwrite bone offsets with Zara's,
 * which is what pulled their legs together.
 *
 * Additive conversion alone would already neutralise them (rest minus rest is
 * zero), so this is belt AND braces — but it is the half that states the
 * invariant, and it drops two thirds of the tracks the mixer evaluates per
 * frame. A future re-export with different flags cannot reintroduce the bug.
 */
const sanitizeCache = new WeakMap<AnimationClip, AnimationClip>();

export function sanitizeClip(clip: AnimationClip): AnimationClip {
  const cached = sanitizeCache.get(clip);
  if (cached) return cached;
  const kept = clip.tracks.filter(
    (track) =>
      track instanceof QuaternionKeyframeTrack ||
      track.name.endsWith('.quaternion') ||
      track.name === ROOT_MOTION_TRACK,
  );
  const copy = clip.clone();
  copy.tracks = kept.map((track) => track.clone());
  sanitizeCache.set(clip, copy);
  return copy;
}

/*
 * `makeClipAdditive` MUTATES the clip it is given, so a clip converted twice is
 * converted against itself and quietly flattens toward nothing. The library is
 * shared by every character on screen, so that would happen on the second
 * character to mount. Convert a CLONE, once, and remember it.
 */
const additiveCache = new WeakMap<AnimationClip, AnimationClip>();

/**
 * Converts a clip to deltas against the library's rest pose.
 *
 * This is what makes ONE library safe on THREE different skeletons. An additive
 * action is applied as `characterOwnPose * authoredDelta`, so each character
 * performs the gesture from its own stance instead of being re-posed into
 * Zara's — the same relative-offset rule the procedural driver already follows
 * (`characterActions.ts`), now applied to authored clips too.
 */
export function additiveClip(clip: AnimationClip, reference: AnimationClip): AnimationClip {
  const cached = additiveCache.get(clip);
  if (cached) return cached;
  const clean = sanitizeClip(clip);
  // Compared against the SANITIZED reference: the check has to describe the
  // clip `makeClipAdditive` will actually be handed, not the one on disk.
  const cleanReference = sanitizeClip(reference);
  const referenceNames = new Set(cleanReference.tracks.map((track) => track.name));
  /*
   * A track with no counterpart in the reference is left ABSOLUTE by
   * `makeClipAdditive` — silently, with no warning. That is precisely the
   * defect this function exists to prevent, so an unmatched track is a build
   * error rather than a character who wears someone else's bones for one joint.
   */
  const orphans = clean.tracks.filter((track) => !referenceNames.has(track.name));
  if (orphans.length > 0) {
    throw new Error(
      `clipLibrary: "${clip.name}" has ${orphans.length} track(s) absent from "${reference.name}" ` +
        `(${orphans.slice(0, 3).map((track) => track.name).join(', ')}). ` +
        'makeClipAdditive would leave them absolute and re-pose the character.',
    );
  }
  const copy = clean.clone();
  /*
   * The reference is an EXPORTED rest clip rather than this clip's own frame 0,
   * because a bone's rest orientation is its bind rotation and not identity —
   * there is no way to write "no offset" in clip space without shipping it.
   * Using frame 0 instead would make every clip a deviation from ITSELF, so a
   * held posture like `proud` would pulse back to neutral once per loop.
   */
  AnimationUtils.makeClipAdditive(copy, 0, cleanReference, 30);
  additiveCache.set(clip, copy);
  return copy;
}
