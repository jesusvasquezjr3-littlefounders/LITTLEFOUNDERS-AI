import { describe, expect, it } from 'vitest';
import { parseWav, WavParseError } from '../tts/wav.js';
import { encodeMp3 } from '../tts/mp3.js';

/** Builds a canonical 44-byte-header PCM16 WAV, mono or interleaved-stereo. */
function buildWav(sampleRate: number, channels: 1 | 2, interleaved: Int16Array): ArrayBuffer {
  const dataSize = interleaved.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  for (let i = 0; i < interleaved.length; i += 1) {
    view.setInt16(44 + i * 2, interleaved[i] ?? 0, true);
  }
  return buffer;
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
}

function sineSamples(count: number, sampleRate: number, freq: number): Int16Array {
  const out = new Int16Array(count);
  for (let i = 0; i < count; i += 1) {
    out[i] = Math.round(Math.sin((2 * Math.PI * freq * i) / sampleRate) * 8000);
  }
  return out;
}

describe('parseWav', () => {
  it('parses a mono PCM16 WAV', () => {
    const samples = sineSamples(2000, 24000, 440);
    const wav = buildWav(24000, 1, samples);
    const decoded = parseWav(wav);
    expect(decoded.sampleRate).toBe(24000);
    expect(decoded.channels).toBe(1);
    expect(decoded.bitsPerSample).toBe(16);
    expect(decoded.samples.length).toBe(2000);
    expect(decoded.samples[0]).toBe(samples[0]);
    expect(decoded.samples[100]).toBe(samples[100]);
  });

  it('downmixes stereo to mono by averaging L/R', () => {
    const left = 4000;
    const right = 2000;
    const interleaved = new Int16Array([left, right, -left, -right]);
    const wav = buildWav(16000, 2, interleaved);
    const decoded = parseWav(wav);
    expect(decoded.samples.length).toBe(2); // 4 interleaved values / 2 channels = 2 frames
    expect(decoded.samples[0]).toBe(Math.round((left + right) / 2));
    expect(decoded.samples[1]).toBe(Math.round((-left - right) / 2));
  });

  it('rejects a buffer with no RIFF header', () => {
    const bogus = new ArrayBuffer(64);
    expect(() => parseWav(bogus)).toThrow(WavParseError);
  });

  it('rejects non-16-bit PCM', () => {
    const wav = buildWav(24000, 1, new Int16Array([1, 2, 3]));
    const view = new DataView(wav);
    view.setUint16(34, 8, true); // corrupt bitsPerSample to 8
    expect(() => parseWav(wav)).toThrow(/16-bit/);
  });
});

describe('encodeMp3', () => {
  it('encodes a sine WAV to a smaller MP3 with a valid frame sync', () => {
    const sampleRate = 24000;
    const samples = sineSamples(sampleRate * 1, sampleRate, 440); // 1 second
    const wav = buildWav(sampleRate, 1, samples);
    const decoded = parseWav(wav);

    const mp3 = encodeMp3(decoded, 48);

    expect(mp3.length).toBeGreaterThan(0);
    expect(mp3.length).toBeLessThan(samples.length * 2); // smaller than raw PCM16 bytes
    // MPEG frame sync: 11 set bits at the start of the bitstream.
    expect(mp3[0]).toBe(0xff);
    expect((mp3[1] ?? 0) & 0xe0).toBe(0xe0);
  });
});
