import type { DecodedWav } from './wav.js';

/*
 * Picks the cleanest ~TARGET_SECONDS continuous window out of a long raw
 * voice-actor recording, for DashScope voice-clone enrollment
 * (qwen-voice-enrollment): 10-20s recommended, 60s max, <10MB, no single
 * silent gap over 2s inside the sample. Pure energy-based (RMS) silence
 * detection — no external DSP dependency, deterministic, unit-testable
 * against a synthetic signal.
 */

export const TARGET_SECONDS = 18;
export const MAX_PAUSE_MS = 2000;
const FRAME_MS = 50;
const SILENCE_RATIO = 0.15; // a frame is "silent" if its RMS < 15% of the clip's overall RMS

export interface TrimResult {
  samples: Int16Array;
  sampleRate: number;
  startMs: number;
  endMs: number;
  durationMs: number;
  /** The longest single silent run inside the chosen window. */
  longestSilenceMs: number;
  /** Whether longestSilenceMs respects the enrollment API's 2s max-pause rule. */
  withinPauseLimit: boolean;
}

function frameRms(samples: Int16Array, start: number, end: number): number {
  let sumSquares = 0;
  const n = Math.max(1, end - start);
  for (let i = start; i < end; i += 1) {
    const s = samples[i] ?? 0;
    sumSquares += s * s;
  }
  return Math.sqrt(sumSquares / n);
}

function overallRms(samples: Int16Array): number {
  return frameRms(samples, 0, samples.length);
}

/** Longest run of consecutive silent frames, in frame-count. */
function longestSilentRun(silent: boolean[]): number {
  let longest = 0;
  let current = 0;
  for (const isSilent of silent) {
    current = isSilent ? current + 1 : 0;
    if (current > longest) longest = current;
  }
  return longest;
}

export function selectCleanWindow(wav: DecodedWav, targetSeconds: number = TARGET_SECONDS): TrimResult {
  const { samples, sampleRate } = wav;
  const frameSize = Math.max(1, Math.round((sampleRate * FRAME_MS) / 1000));
  const frameCount = Math.ceil(samples.length / frameSize);
  const targetFrames = Math.max(1, Math.round((targetSeconds * 1000) / FRAME_MS));

  if (frameCount <= targetFrames) {
    // Source is already <= target length — use it all, no window search needed.
    const silent = silenceMap(samples, frameSize, frameCount);
    const longestFrames = longestSilentRun(silent);
    const longestMs = longestFrames * FRAME_MS;
    return {
      samples,
      sampleRate,
      startMs: 0,
      endMs: Math.round((samples.length / sampleRate) * 1000),
      durationMs: Math.round((samples.length / sampleRate) * 1000),
      longestSilenceMs: longestMs,
      withinPauseLimit: longestMs <= MAX_PAUSE_MS,
    };
  }

  const silent = silenceMap(samples, frameSize, frameCount);

  // Prefix sums for O(1) "total silent frames in [a,b)" queries.
  const prefixSilent = new Int32Array(frameCount + 1);
  for (let i = 0; i < frameCount; i += 1) {
    prefixSilent[i + 1] = (prefixSilent[i] ?? 0) + (silent[i] ? 1 : 0);
  }

  // Score = (violates the 2s-max-pause rule?, total silent frames) — windows
  // that respect the pause limit always beat ones that don't; within the
  // same group, less total silence wins. Lexicographic tuple comparison.
  let best: { start: number; totalSilent: number; longestRun: number } | null = null;
  for (let start = 0; start + targetFrames <= frameCount; start += 1) {
    const end = start + targetFrames;
    const totalSilent = (prefixSilent[end] ?? 0) - (prefixSilent[start] ?? 0);
    const longestRun = longestSilentRun(silent.slice(start, end));
    if (best === null || isBetterWindow({ totalSilent, longestRun }, best)) {
      best = { start, totalSilent, longestRun };
    }
  }
  // best is always set: the loop runs at least once since frameCount > targetFrames.
  const chosen = best!;
  const startSample = chosen.start * frameSize;
  const endSample = Math.min(samples.length, startSample + targetFrames * frameSize);
  const longestMs = chosen.longestRun * FRAME_MS;

  return {
    samples: samples.slice(startSample, endSample),
    sampleRate,
    startMs: Math.round((startSample / sampleRate) * 1000),
    endMs: Math.round((endSample / sampleRate) * 1000),
    durationMs: Math.round(((endSample - startSample) / sampleRate) * 1000),
    longestSilenceMs: longestMs,
    withinPauseLimit: longestMs <= MAX_PAUSE_MS,
  };
}

function isBetterWindow(
  a: { totalSilent: number; longestRun: number },
  b: { totalSilent: number; longestRun: number },
): boolean {
  const aOk = a.longestRun * FRAME_MS <= MAX_PAUSE_MS;
  const bOk = b.longestRun * FRAME_MS <= MAX_PAUSE_MS;
  if (aOk !== bOk) return aOk; // a valid window always beats an invalid one
  return a.totalSilent < b.totalSilent;
}

function silenceMap(samples: Int16Array, frameSize: number, frameCount: number): boolean[] {
  const threshold = overallRms(samples) * SILENCE_RATIO;
  const map: boolean[] = new Array(frameCount);
  for (let f = 0; f < frameCount; f += 1) {
    const start = f * frameSize;
    const end = Math.min(samples.length, start + frameSize);
    map[f] = frameRms(samples, start, end) < threshold;
  }
  return map;
}
