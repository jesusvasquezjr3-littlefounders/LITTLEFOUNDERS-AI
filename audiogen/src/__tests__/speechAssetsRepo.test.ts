import { describe, expect, it } from 'vitest';
import { speechAssetHash } from '../db/speechAssetsRepo.js';

/*
 * The global cache key must treat every request dimension that changes the
 * AUDIBLE OUTPUT as a distinct asset — and nothing else. A collision here
 * serves a child the wrong pronunciation; an over-split key silently re-pays
 * DashScope for audio we already own.
 */
describe('speechAssetHash', () => {
  const base = ['Hola, ¿cómo estás?', 'Jennifer', 'qwen3-tts-flash', 'Spanish', 48] as const;

  it('is deterministic', () => {
    expect(speechAssetHash(...base)).toBe(speechAssetHash(...base));
  });

  it.each([
    ['text', ['Hola, ¿cómo está?', base[1], base[2], base[3], base[4]]],
    ['voice', [base[0], 'Ethan', base[2], base[3], base[4]]],
    ['model', [base[0], base[1], 'qwen3-tts-vc-2026-01-22', base[3], base[4]]],
    ['language_type', [base[0], base[1], base[2], 'Portuguese', base[4]]],
    ['mp3 bitrate', [base[0], base[1], base[2], base[3], 64]],
  ] as const)('changes when %s changes', (_dim, args) => {
    expect(speechAssetHash(...(args as [string, string, string, string, number]))).not.toBe(speechAssetHash(...base));
  });

  it('is concatenation-unambiguous — shifting a word across field boundaries changes the hash', () => {
    // The manifest-level space-joined hash would collide these two.
    const a = speechAssetHash('hello world', 'Voice', 'model', 'English', 48);
    const b = speechAssetHash('hello', 'world Voice', 'model', 'English', 48);
    expect(a).not.toBe(b);
  });
});
