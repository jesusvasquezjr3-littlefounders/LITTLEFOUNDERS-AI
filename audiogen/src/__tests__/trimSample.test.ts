import { describe, expect, it } from 'vitest';
import { selectCleanWindow, TARGET_SECONDS, MAX_PAUSE_MS } from '../tts/trimSample.js';
import type { DecodedWav } from '../tts/wav.js';

const SAMPLE_RATE = 8000;

function loudSamples(seconds: number): Int16Array {
  const count = Math.round(seconds * SAMPLE_RATE);
  const out = new Int16Array(count);
  for (let i = 0; i < count; i += 1) {
    out[i] = Math.round(Math.sin((2 * Math.PI * 440 * i) / SAMPLE_RATE) * 8000);
  }
  return out;
}

function silentSamples(seconds: number): Int16Array {
  // Near-zero, not exactly zero — a real recording's "silence" still has noise floor.
  return new Int16Array(Math.round(seconds * SAMPLE_RATE)).fill(1);
}

function concat(...parts: Int16Array[]): Int16Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Int16Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

function wavOf(samples: Int16Array): DecodedWav {
  return { sampleRate: SAMPLE_RATE, channels: 1, bitsPerSample: 16, samples };
}

describe('selectCleanWindow', () => {
  it('returns the source unmodified when it is already <= target length', () => {
    const samples = loudSamples(10);
    const result = selectCleanWindow(wavOf(samples));
    expect(result.startMs).toBe(0);
    expect(result.durationMs).toBe(10_000);
    expect(result.samples.length).toBe(samples.length);
    expect(result.withinPauseLimit).toBe(true);
  });

  it('flags a short source whose only content is a pause over the 2s limit', () => {
    const samples = concat(loudSamples(2), silentSamples(3), loudSamples(2));
    const result = selectCleanWindow(wavOf(samples));
    expect(result.longestSilenceMs).toBeGreaterThan(MAX_PAUSE_MS);
    expect(result.withinPauseLimit).toBe(false);
  });

  it('picks the cleanest TARGET_SECONDS window out of a longer recording, skipping silent regions', () => {
    // 0-3s loud, 3-6s silent (3s > 2s max pause), 6-24s loud (exactly TARGET_SECONDS, clean), 24-30s silent.
    const samples = concat(loudSamples(3), silentSamples(3), loudSamples(TARGET_SECONDS), silentSamples(6));
    const result = selectCleanWindow(wavOf(samples), TARGET_SECONDS);

    expect(result.durationMs).toBe(TARGET_SECONDS * 1000);
    expect(result.withinPauseLimit).toBe(true);
    expect(result.longestSilenceMs).toBe(0);
    // The clean window starts right after the first silent stretch (~6s in).
    expect(result.startMs).toBeGreaterThanOrEqual(5_950);
    expect(result.startMs).toBeLessThanOrEqual(6_050);
  });

  it('when every window violates the pause limit, still prefers the one with less total silence', () => {
    // Almost entirely silent (23s), with a single 1s loud strip — every
    // TARGET_SECONDS window is mostly silence, so none can satisfy the 2s
    // pause limit, but a window that captures the loud strip has strictly
    // less total silence than one that doesn't.
    const samples = concat(silentSamples(3), loudSamples(1), silentSamples(20));
    const result = selectCleanWindow(wavOf(samples), TARGET_SECONDS);
    expect(result.withinPauseLimit).toBe(false);
    expect(result.durationMs).toBe(TARGET_SECONDS * 1000);
    // A window fully inside the trailing silence would be 100% silent
    // (longestSilenceMs === durationMs) — the chosen one must beat that.
    expect(result.longestSilenceMs).toBeLessThan(result.durationMs);
  });
});
