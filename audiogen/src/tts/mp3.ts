import { Mp3Encoder } from '@breezystack/lamejs';
import type { DecodedWav } from './wav.js';

const SAMPLES_PER_FRAME = 1152; // lamejs encodes in fixed-size chunks

/** Encodes decoded mono PCM16 to a small mono MP3 Buffer at `bitrateKbps`. */
export function encodeMp3(wav: DecodedWav, bitrateKbps: number): Buffer {
  const encoder = new Mp3Encoder(1, wav.sampleRate, bitrateKbps);
  const chunks: Uint8Array[] = [];

  for (let i = 0; i < wav.samples.length; i += SAMPLES_PER_FRAME) {
    const chunk = wav.samples.subarray(i, i + SAMPLES_PER_FRAME);
    const encoded = encoder.encodeBuffer(chunk);
    if (encoded.length > 0) chunks.push(encoded);
  }
  const tail = encoder.flush();
  if (tail.length > 0) chunks.push(tail);

  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}
