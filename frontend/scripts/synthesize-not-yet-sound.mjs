import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/*
 * The gentle "not yet" cue for a missed lesson answer (owner decision OD-28,
 * review item L-02: "Wrong answers get a dedicated, gentle 'not yet' sound").
 *
 * Synthesized procedurally, at zero spend (OD-23): no provider, no network, no
 * recorded or licensed sample. The file is a pure function of the constants
 * below, so it is reproducible byte for byte and can never drift from this
 * generator:
 *
 *   node scripts/synthesize-not-yet-sound.mjs          writes public/sounds/edu/not_yet.wav
 *   node scripts/synthesize-not-yet-sound.mjs --check  fails if the checked-in file differs
 *
 * The asset gate (`check-rebuild-assets.mjs`, in `spec:check`) imports
 * `synthesize()` and runs the same comparison for the manifest row that names
 * this script as its `generator`.
 *
 * Why it is gentle (Product 10 B.26: no non-verbal shame signal, sound
 * included; Frontend 02 §8 "not yet": no red, nothing is spent):
 *
 *   - Two soft notes descending a major third, E5 (659.26 Hz) to C5
 *     (523.25 Hz). Both belong to one major triad, so the pair is consonant
 *     and warm: it reads as "not this one, try again", not as the minor-third
 *     "uh-oh" and never as a buzzer. A falling line is the conventional
 *     "not quite" gesture; the interval is small so it does not dramatize.
 *   - Sine tones with a quiet second harmonic (-18 dB) for a rounded,
 *     soft-mallet colour. No odd-harmonic stack, so nothing square, saw or
 *     buzz-like; the spectrum stays below 1.4 kHz where small phone speakers
 *     still reproduce it without harshness.
 *   - Each note opens with a 12 ms raised-cosine attack (no click, no hard
 *     transient), decays exponentially like a struck soft mallet, and closes
 *     with a 40 ms raised-cosine release that lands exactly on zero. The file
 *     starts and ends on silence.
 *   - Short: 0.42 s in total, the second note overlapping the first by 30 ms
 *     so the pair sounds like one phrase. The second note is slightly softer,
 *     so the cue settles rather than insists.
 *   - Quiet: the peak is normalized to -12 dBFS (the gate refuses any sound
 *     cue above -9 dBFS). The player also applies its own low SFX volume.
 *   - 22,050 Hz mono 16-bit PCM WAV: every partial is far below the 11 kHz
 *     Nyquist limit, and the file stays under 20 KB.
 */
export const SAMPLE_RATE = 22_050;
export const PEAK_DBFS = -12;
const TOTAL_SECONDS = 0.42;
const SECOND_HARMONIC = 0.125; // -18 dB relative to the fundamental
const ATTACK_SECONDS = 0.012;
const RELEASE_SECONDS = 0.04;
const DECAY_SECONDS = 0.16; // exponential time constant of each note
const NOTES = [
  { hz: 659.26, start: 0.0, length: 0.17, gain: 1.0 }, // E5
  { hz: 523.25, start: 0.14, length: 0.26, gain: 0.85 }, // C5, a major third below
];

/** One note: fundamental plus a quiet second harmonic, shaped by attack, decay and release. */
function note(out, { hz, start, length, gain }) {
  const first = Math.round(start * SAMPLE_RATE);
  const count = Math.round(length * SAMPLE_RATE);
  const attack = Math.round(ATTACK_SECONDS * SAMPLE_RATE);
  const release = Math.round(RELEASE_SECONDS * SAMPLE_RATE);
  for (let i = 0; i < count; i++) {
    const t = i / SAMPLE_RATE;
    let envelope = gain * Math.exp(-t / DECAY_SECONDS);
    if (i < attack) envelope *= 0.5 - 0.5 * Math.cos((Math.PI * i) / attack);
    const fromEnd = count - 1 - i;
    if (fromEnd < release) envelope *= 0.5 - 0.5 * Math.cos((Math.PI * fromEnd) / release);
    const phase = 2 * Math.PI * hz * t;
    out[first + i] += envelope * (Math.sin(phase) + SECOND_HARMONIC * Math.sin(2 * phase));
  }
}

/** Mono 16-bit PCM WAV (the same layout as audiogen's encodeWav; frontend cannot import audiogen). */
function encodeWav(samples, sampleRate) {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) buffer.writeInt16LE(samples[i], 44 + i * 2);
  return buffer;
}

/** The cue as WAV bytes. Deterministic: no randomness, no clock, no input. */
export function synthesize() {
  const mix = new Float64Array(Math.round(TOTAL_SECONDS * SAMPLE_RATE));
  for (const spec of NOTES) note(mix, spec);
  let peak = 0;
  for (const value of mix) peak = Math.max(peak, Math.abs(value));
  const scale = (10 ** (PEAK_DBFS / 20) * 32767) / peak;
  const samples = Int16Array.from(mix, (value) => Math.round(value * scale));
  return encodeWav(samples, SAMPLE_RATE);
}

export const OUTPUT = resolve(import.meta.dirname, '../public/sounds/edu/not_yet.wav');

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const bytes = synthesize();
  if (process.argv.includes('--check')) {
    let current = null;
    try { current = readFileSync(OUTPUT); } catch { /* reported below */ }
    if (!current || !current.equals(bytes)) {
      console.error(`${OUTPUT} is missing or differs from its generator; run node scripts/synthesize-not-yet-sound.mjs`);
      process.exitCode = 1;
    } else console.log(`not_yet.wav matches its generator (${bytes.length} bytes).`);
  } else {
    writeFileSync(OUTPUT, bytes);
    console.log(`Wrote ${OUTPUT} (${bytes.length} bytes).`);
  }
}
