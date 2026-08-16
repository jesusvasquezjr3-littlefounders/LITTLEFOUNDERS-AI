import { describe, expect, it } from 'vitest';
import { AnimationClip, QuaternionKeyframeTrack } from 'three';
import { CHARACTER_ACTIONS } from '@/components/characters/control/types';
import {
  additiveEmotion,
  clipFor,
  emotionClipFor,
  LOOPING_CLIPS,
  REST_CLIP,
  restClipFrom,
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

describe('additiveEmotion', () => {
  it('does not mutate the clip it is given', () => {
    /*
     * `makeClipAdditive` mutates in place. The library is shared by every
     * character on screen, so converting the original would convert it again
     * on the second character to mount — against itself — and the emotion
     * would quietly flatten toward nothing.
     */
    const emotion = quatClip('emotion.happy', [0, 0.1, 0, 0.995, 0, 0.2, 0, 0.98]);
    const before = Array.from(emotion.tracks[0]!.values);
    additiveEmotion(emotion, quatClip(REST_CLIP, IDENTITY));
    expect(Array.from(emotion.tracks[0]!.values)).toEqual(before);
  });

  it('returns the same converted clip for repeated calls', () => {
    const emotion = quatClip('emotion.proud', [0, 0.1, 0, 0.995, 0, 0.1, 0, 0.995]);
    const rest = quatClip(REST_CLIP, IDENTITY);
    expect(additiveEmotion(emotion, rest)).toBe(additiveEmotion(emotion, rest));
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
