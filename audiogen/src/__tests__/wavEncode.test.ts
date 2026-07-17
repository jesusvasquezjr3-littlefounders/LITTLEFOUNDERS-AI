import { describe, expect, it } from 'vitest';
import { encodeWav } from '../tts/wavEncode.js';
import { parseWav } from '../tts/wav.js';

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

function sineSamples(count: number, sampleRate: number, freq: number): Int16Array {
  const out = new Int16Array(count);
  for (let i = 0; i < count; i += 1) {
    out[i] = Math.round(Math.sin((2 * Math.PI * freq * i) / sampleRate) * 8000);
  }
  return out;
}

describe('encodeWav', () => {
  it('roundtrips through parseWav — same rate, mono, and sample values', () => {
    const sampleRate = 24000;
    const samples = sineSamples(2000, sampleRate, 440);

    const wavBuffer = encodeWav(samples, sampleRate);
    const decoded = parseWav(toArrayBuffer(wavBuffer));

    expect(decoded.sampleRate).toBe(sampleRate);
    expect(decoded.channels).toBe(1);
    expect(decoded.bitsPerSample).toBe(16);
    expect(decoded.samples.length).toBe(samples.length);
    expect(Array.from(decoded.samples)).toEqual(Array.from(samples));
  });

  it('produces a 44-byte header followed by exactly 2 bytes per sample', () => {
    const samples = new Int16Array([0, 100, -100, 32767, -32768]);
    const wavBuffer = encodeWav(samples, 16000);
    expect(wavBuffer.length).toBe(44 + samples.length * 2);
  });

  it('handles an empty sample array', () => {
    const wavBuffer = encodeWav(new Int16Array([]), 24000);
    const decoded = parseWav(toArrayBuffer(wavBuffer));
    expect(decoded.samples.length).toBe(0);
  });
});
