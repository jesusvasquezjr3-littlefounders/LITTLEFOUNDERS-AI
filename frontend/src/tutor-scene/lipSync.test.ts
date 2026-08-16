import { describe, expect, it } from 'vitest';
import { VISEMES } from './mouthAtlas';
import { follow, rms, SILENCE_FLOOR, VISEME_CLOSED, visemeForAmplitude } from './lipSync';

describe('visemeForAmplitude', () => {
  it('shuts the mouth on silence', () => {
    expect(visemeForAmplitude(0, 0)).toBe(VISEME_CLOSED);
    expect(visemeForAmplitude(0.01, 5)).toBe(VISEME_CLOSED);
  });

  it('opens wider as the sound gets louder', () => {
    const quiet = visemeForAmplitude(0.08, 0);
    const loud = visemeForAmplitude(0.9, 0);
    expect(quiet).not.toBe(loud);
    // The loudest band must reach the widest shape the atlas has.
    expect(VISEMES[loud]).toBe('A');
  });

  it('always returns a real frame, whatever the input', () => {
    for (const amplitude of [-1, 0, 0.5, 1, 4, NaN, Infinity]) {
      const index = visemeForAmplitude(amplitude, 3);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(VISEMES.length);
    }
  });

  it('varies within a band as the step advances', () => {
    // Steady speech that parked on one frame would read as a broken texture
    // rather than as talking.
    const seen = new Set([0, 1, 2, 3].map((step) => visemeForAmplitude(0.25, step)));
    expect(seen.size).toBeGreaterThan(1);
  });

  it('is stable for a held sound at a fixed step', () => {
    expect(visemeForAmplitude(0.25, 2)).toBe(visemeForAmplitude(0.25, 2));
  });
});

describe('rms', () => {
  it('is zero for silence and for an empty buffer', () => {
    expect(rms(new Float32Array(0))).toBe(0);
    expect(rms(new Float32Array(64))).toBe(0);
  });

  it('measures loudness rather than peak', () => {
    // One loud spike in a quiet buffer must NOT read as a loud buffer — that is
    // the difference that stops the mouth flapping on every consonant.
    const spike = new Float32Array(64);
    spike[0] = 1;
    const sustained = new Float32Array(64).fill(0.5);
    expect(rms(spike)).toBeLessThan(rms(sustained));
  });
});

describe('follow', () => {
  it('opens faster than it closes', () => {
    const opening = follow(0, 1, 1 / 60);
    const closing = 1 - follow(1, 0, 1 / 60);
    expect(opening).toBeGreaterThan(closing);
  });

  it('converges on the target and never overshoots', () => {
    let value = 0;
    for (let i = 0; i < 200; i += 1) value = follow(value, 1, 1 / 60);
    expect(value).toBeGreaterThan(0.99);
    expect(value).toBeLessThanOrEqual(1);
  });

  it('treats a negative or zero frame time as no time passing', () => {
    expect(follow(0.4, 1, 0)).toBeCloseTo(0.4, 6);
    expect(follow(0.4, 1, -1)).toBeCloseTo(0.4, 6);
  });
});

describe('silence floor', () => {
  it('sits below the quietest speaking band', () => {
    // If the floor were above the first band, the mouth could never leave
    // `closed` and lip-sync would look like it had failed silently.
    expect(SILENCE_FLOOR).toBeLessThan(0.04);
    expect(visemeForAmplitude(SILENCE_FLOOR + 0.03, 0)).not.toBe(VISEME_CLOSED);
  });
});
