import { describe, expect, it } from 'vitest';
import { AnimationClip, QuaternionKeyframeTrack, VectorKeyframeTrack } from 'three';
import { CHARACTER_ACTIONS } from '@/components/characters/control/types';
import {
  additiveClip,
  clipFor,
  emotionClipFor,
  LOOPING_CLIPS,
  REST_CLIP,
  restClipFrom,
  sanitizeClip,
  unknownClipNames,
} from './clipLibrary';

function quatClip(name: string, values: number[]): AnimationClip {
  return new AnimationClip(name, -1, [
    new QuaternionKeyframeTrack('Head.quaternion', [0, 1], values),
  ]);
}

const IDENTITY = [0, 0, 0, 1, 0, 0, 0, 1];

describe('clipFor', () => {
  it('returns null when an action has no authored clip', () => {
    // The NORMAL case while the library fills in — a missing clip is what lets
    // the procedural driver keep owning that action.
    expect(clipFor([], 'wave')).toBeNull();
  });

  it('never matches an emotion clip as an action', () => {
    const clips = [quatClip('emotion.happy', IDENTITY)];
    for (const action of CHARACTER_ACTIONS) {
      expect(clipFor(clips, action)).toBeNull();
    }
  });
});

describe('emotionClipFor', () => {
  it('finds a clip by its namespaced name', () => {
    const clips = [quatClip('emotion.proud', IDENTITY), quatClip('proud', IDENTITY)];
    expect(emotionClipFor(clips, 'proud')?.name).toBe('emotion.proud');
  });

  it('returns null when the emotion is not authored', () => {
    expect(emotionClipFor([], 'thinking')).toBeNull();
  });
});

describe('restClipFrom', () => {
  it('finds the reference pose', () => {
    expect(restClipFrom([quatClip(REST_CLIP, IDENTITY)])?.name).toBe(REST_CLIP);
  });

  it('returns null rather than substituting an emotion as the reference', () => {
    // Making an emotion additive against ANOTHER emotion would silently produce
    // the difference between two feelings.
    expect(restClipFrom([quatClip('emotion.happy', IDENTITY)])).toBeNull();
  });
});

describe('sanitizeClip', () => {
  /*
   * The library is exported with `export_force_sampling`, which emits
   * translation, rotation AND scale for every bone of every clip. A bone's
   * translation in glTF is its rest offset from its parent — the authoring
   * character's PROPORTIONS, not motion — so shipping those channels pulled
   * Liruf's feet from 0.447 apart to Zara's 0.092.
   */
  function mixedClip(): AnimationClip {
    return new AnimationClip('jump', -1, [
      new QuaternionKeyframeTrack('Head.quaternion', [0, 1], IDENTITY),
      new VectorKeyframeTrack('Hips.position', [0, 1], [0, 0, 0, 0, 12, 0]),
      new VectorKeyframeTrack('LeftUpLeg.position', [0, 1], [0.04, 0, 0, 0.04, 0, 0]),
      new VectorKeyframeTrack('Head.scale', [0, 1], [1, 1, 1, 1, 1, 1]),
    ]);
  }

  it('drops the channels that describe a skeleton rather than a motion', () => {
    const names = sanitizeClip(mixedClip()).tracks.map((track) => track.name);
    expect(names).not.toContain('LeftUpLeg.position');
    expect(names).not.toContain('Head.scale');
  });

  it('keeps rotation, and keeps the hips translation that IS the jump', () => {
    // Leaving the ground is root motion and cannot be expressed as a rotation,
    // so this one translation track is the deliberate exception.
    const names = sanitizeClip(mixedClip()).tracks.map((track) => track.name);
    expect(names).toEqual(['Head.quaternion', 'Hips.position']);
  });

  it('does not mutate the clip it is given', () => {
    const clip = mixedClip();
    sanitizeClip(clip);
    expect(clip.tracks).toHaveLength(4);
  });
});

describe('additiveClip', () => {
  it('does not mutate the clip it is given', () => {
    /*
     * `makeClipAdditive` mutates in place. The library is shared by every
     * character on screen, so converting the original would convert it again
     * on the second character to mount — against itself — and the gesture
     * would quietly flatten toward nothing.
     */
    const emotion = quatClip('emotion.happy', [0, 0.1, 0, 0.995, 0, 0.2, 0, 0.98]);
    const before = Array.from(emotion.tracks[0]!.values);
    additiveClip(emotion, quatClip(REST_CLIP, IDENTITY));
    expect(Array.from(emotion.tracks[0]!.values)).toEqual(before);
  });

  it('returns the same converted clip for repeated calls', () => {
    const emotion = quatClip('emotion.proud', [0, 0.1, 0, 0.995, 0, 0.1, 0, 0.995]);
    const rest = quatClip(REST_CLIP, IDENTITY);
    expect(additiveClip(emotion, rest)).toBe(additiveClip(emotion, rest));
  });

  it('reduces a bone that merely holds the rest pose to no offset at all', () => {
    /*
     * THE REGRESSION THIS FILE EXISTS FOR.
     *
     * Force-sampled clips carry all 24 bones even when a gesture touches five,
     * and the other 19 hold the AUTHORING character's rest rotation. Played
     * absolutely, those 19 channels re-posed Rho and Liruf into Zara's
     * skeleton — visibly, and by up to 74 degrees at the hip. Additive
     * conversion has to reduce exactly those to identity so they contribute
     * nothing and each character keeps the stance its own export gave it.
     */
    const rest = [0, 0.2588, 0, 0.9659, 0, 0.2588, 0, 0.9659]; // a 30deg rest
    const untouched = additiveClip(quatClip('idle', rest), quatClip(REST_CLIP, rest));
    /*
     * 1e-4, not 1e-7: keyframe values are stored as float32 and this passes
     * through an inverse-and-multiply, so a few times 1e-5 of residual is the
     * arithmetic rather than a leftover offset. The defect being guarded
     * against was 74 DEGREES — 0.6 in quaternion terms — so the tolerance has
     * four orders of magnitude of room and still catches it.
     */
    for (const value of untouched.tracks[0]!.values) {
      expect(Math.abs(value - Math.round(value))).toBeLessThan(1e-4);
    }
    // Identity quaternion: (0, 0, 0, 1) per key.
    expect(Array.from(untouched.tracks[0]!.values).map(Math.round)).toEqual([0, 0, 0, 1, 0, 0, 0, 1]);
  });

  it('refuses a clip whose track has no reference rather than leaving it absolute', () => {
    /*
     * `makeClipAdditive` skips a track it cannot match — silently, with no
     * warning — and the track stays ABSOLUTE. That is the exact defect being
     * fixed, so it has to fail loudly instead of shipping one joint of someone
     * else's skeleton.
     */
    const clip = new AnimationClip('wave', -1, [
      new QuaternionKeyframeTrack('RightArm.quaternion', [0, 1], IDENTITY),
    ]);
    expect(() => additiveClip(clip, quatClip(REST_CLIP, IDENTITY))).toThrow(/RightArm\.quaternion/);
  });
});

describe('the library contract', () => {
  it('loops exactly the clips the procedural driver loops', () => {
    // Three sources state this — the authoring script, the runtime and
    // characterActions — and drift between them is invisible until a one-shot
    // repeats forever.
    expect([...LOOPING_CLIPS].sort()).toEqual(['celebrate', 'dance', 'idle']);
  });

  it('flags names outside the canonical vocabulary', () => {
    const clips = [quatClip('wave', IDENTITY), quatClip('moonwalk', IDENTITY)];
    expect(unknownClipNames(clips, CHARACTER_ACTIONS)).toEqual(['moonwalk']);
  });
});
