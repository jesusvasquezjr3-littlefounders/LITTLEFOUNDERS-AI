import type { AnimationClip } from 'three';
import type { CharacterAction } from '@/components/characters/control/types';
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
