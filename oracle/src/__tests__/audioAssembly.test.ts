import { describe, expect, it } from 'vitest';
import { assembleClip, decodeChunk } from '../ws/audioAssembly.js';

/*
 * WHY THE TUTOR HEARD "Ah." WHEN A LEARNER ASKED ABOUT COMPOUND INTEREST.
 *
 * The microphone uploads while the learner is still speaking, one base64 frame
 * per MediaRecorder chunk, and the commit used to rebuild the clip with
 * `parts.join('')` — concatenating the ENCODED strings. Every frame is its own
 * complete base64 document, so any chunk whose byte length is not a multiple of
 * three ends in `=` padding, and joining puts padding in the middle of the
 * document. Decoders stop there.
 *
 * The first chunk is the container header plus a fraction of a second, so the
 * transcriber received the first syllable of every sentence, on every browser,
 * for as long as streaming existed. It never looked like an assembly bug — it
 * looked like bad speech recognition, and it was debugged as such twice.
 */

/** A clip split the way MediaRecorder splits one: uneven, mostly not multiples of 3. */
function splitInto(bytes: Buffer, sizes: number[]): Buffer[] {
  const parts: Buffer[] = [];
  let at = 0;
  for (const size of sizes) {
    parts.push(bytes.subarray(at, at + size));
    at += size;
  }
  if (at < bytes.length) parts.push(bytes.subarray(at));
  return parts;
}

/** Stand-in for a real recording: the bytes only have to survive intact. */
const CLIP = Buffer.from(Array.from({ length: 97 }, (_, i) => (i * 7 + 3) % 256));

describe('a streamed clip is rebuilt byte for byte', () => {
  it('survives chunk sizes that are not multiples of three', () => {
    // 4, 10 and 7 all leave base64 padding behind. This is the case that broke.
    const parts = splitInto(CLIP, [4, 10, 7, 31]);
    const rebuilt = assembleClip(parts.map((p) => decodeChunk(p.toString('base64'))));
    expect(rebuilt.equals(CLIP)).toBe(true);
  });

  it('survives a single chunk, and an empty tail', () => {
    expect(assembleClip([decodeChunk(CLIP.toString('base64'))]).equals(CLIP)).toBe(true);
    expect(assembleClip([]).byteLength).toBe(0);
  });

  it('DOES NOT lose the sentence, unlike joining the encoded strings', () => {
    /*
     * The bug itself, written down as a test, so nobody reintroduces the
     * "obvious" one-liner. This is not a hypothetical: it is what shipped.
     */
    const parts = splitInto(CLIP, [4, 10, 7, 31]);
    const naive = Buffer.from(parts.map((p) => p.toString('base64')).join(''), 'base64');
    expect(naive.byteLength).toBeLessThan(CLIP.byteLength);

    const correct = assembleClip(parts.map((p) => decodeChunk(p.toString('base64'))));
    expect(correct.byteLength).toBe(CLIP.byteLength);
  });

  it('keeps the FIRST chunk intact — which is why the bug was so convincing', () => {
    // The naive join preserved chunk one exactly, so the clip always decoded,
    // always transcribed, and always came back with a plausible short word.
    const parts = splitInto(CLIP, [4, 10, 7, 31]);
    const naive = Buffer.from(parts.map((p) => p.toString('base64')).join(''), 'base64');
    expect(naive.equals(parts[0]!)).toBe(true);
  });
});
