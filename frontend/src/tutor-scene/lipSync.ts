import { VISEMES } from './mouthAtlas';

/*
 * Amplitude-driven lip-sync — the seam TTS plugs into.
 *
 * `audiogen` returns a URL; the product plays it through an <audio> element;
 * this turns that element's live loudness into a viseme index for the mouth
 * card. Nothing here knows about DeepSeek, Qwen or a transcript, which is the
 * point: the stage stays a rendering concern and the conversational layer
 * (/ORACLE.md) owns the words.
 *
 * WHY AMPLITUDE AND NOT REAL VISEMES: real viseme timing needs a phoneme track,
 * and Qwen3-TTS does not return one. Amplitude is what is actually available on
 * day one, it costs one AnalyserNode, and — because the mouth is a texture
 * atlas rather than a rig — upgrading later means indexing the SAME eight
 * frames from a phoneme track instead of a loudness value. No model, no card
 * and no component changes when that day comes. That upgrade path is the whole
 * reason the mouth was built as an atlas (/TUTOR_3D.md §7.1).
 */

/** Index into VISEMES. Named so call sites read as intent, not as magic numbers. */
export const VISEME_CLOSED = 0;

const INDEX = Object.fromEntries(VISEMES.map((name, index) => [name, index])) as Record<
  (typeof VISEMES)[number],
  number
>;

/*
 * Loudness bands, quietest first. Each band offers SEVERAL mouth shapes of
 * similar openness so that steady speech does not park on one frame — a mouth
 * that holds a single wide "E" for a whole sentence reads as a broken texture
 * rather than as talking.
 */
const BANDS: ReadonlyArray<{ upTo: number; shapes: readonly number[] }> = [
  { upTo: 0.04, shapes: [INDEX.closed] },
  { upTo: 0.1, shapes: [INDEX.MBP, INDEX.closed] },
  { upTo: 0.18, shapes: [INDEX.FV, INDEX.I] },
  { upTo: 0.3, shapes: [INDEX.I, INDEX.E, INDEX.U] },
  { upTo: 0.45, shapes: [INDEX.E, INDEX.O] },
  { upTo: Infinity, shapes: [INDEX.A, INDEX.O, INDEX.E] },
];

/**
 * Picks a mouth shape for a loudness in 0..1.
 *
 * `step` advances once per mouth CHANGE, not once per frame, so the choice
 * within a band is stable while a sound is held and only varies across
 * successive sounds.
 */
export function visemeForAmplitude(amplitude: number, step: number): number {
  const level = Number.isFinite(amplitude) ? Math.min(Math.max(amplitude, 0), 1) : 0;
  const band = BANDS.find((entry) => level <= entry.upTo) ?? BANDS[BANDS.length - 1]!;
  const shapes = band.shapes;
  const wrapped = ((step % shapes.length) + shapes.length) % shapes.length;
  return shapes[wrapped]!;
}

/**
 * Root-mean-square of a time-domain buffer, in 0..1.
 *
 * RMS rather than peak: peak jumps on every consonant burst and makes the mouth
 * flap. RMS tracks perceived loudness, which is what a mouth follows.
 */
export function rms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let total = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index]!;
    total += sample * sample;
  }
  return Math.sqrt(total / samples.length);
}

/**
 * Smooths loudness toward a target with an asymmetric follow.
 *
 * Attack is fast and release is slow, the way a mouth actually moves: lips open
 * quickly on a syllable and close lazily after it. A symmetric filter either
 * lags the opening (reads as dubbing) or snaps shut between syllables (reads as
 * a stutter).
 */
export function follow(current: number, target: number, delta: number): number {
  const rate = target > current ? 22 : 7;
  const blend = 1 - Math.exp(-rate * Math.max(delta, 0));
  return current + (target - current) * blend;
}

/**
 * How loud a signal must get before the mouth leaves `closed`.
 *
 * Below this the mouth is SHUT rather than fractionally open: a resting mouth
 * that never quite closes is the single clearest tell of a cheap talking
 * avatar.
 */
export const SILENCE_FLOOR = 0.02;
