/*
 * Minimal RIFF/WAVE parser for the PCM 16-bit WAVs DashScope returns
 * (24kHz mono per the provider spec, but parsed generically — including
 * stereo downmix — so Echo doesn't silently mis-decode a provider change).
 */

export class WavParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WavParseError';
  }
}

export interface DecodedWav {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  /** Mono Int16 PCM samples — stereo input is downmixed by averaging L/R. */
  samples: Int16Array;
}

export function parseWav(buffer: ArrayBuffer): DecodedWav {
  const view = new DataView(buffer);
  if (buffer.byteLength < 44) throw new WavParseError('Buffer too small to be a WAV file');
  if (readAscii(view, 0, 4) !== 'RIFF') throw new WavParseError('Missing RIFF header');
  if (readAscii(view, 8, 4) !== 'WAVE') throw new WavParseError('Missing WAVE header');

  let offset = 12;
  let fmt: { audioFormat: number; channels: number; sampleRate: number; bitsPerSample: number } | null = null;
  let dataOffset = -1;
  let dataLength = 0;

  while (offset + 8 <= buffer.byteLength) {
    const chunkId = readAscii(view, offset, 4);
    const chunkSize = view.getUint32(offset + 4, true);
    const bodyOffset = offset + 8;

    if (chunkId === 'fmt ') {
      fmt = {
        audioFormat: view.getUint16(bodyOffset, true),
        channels: view.getUint16(bodyOffset + 2, true),
        sampleRate: view.getUint32(bodyOffset + 4, true),
        bitsPerSample: view.getUint16(bodyOffset + 14, true),
      };
    } else if (chunkId === 'data') {
      dataOffset = bodyOffset;
      dataLength = chunkSize;
    }

    offset = bodyOffset + chunkSize + (chunkSize % 2); // chunks are word-aligned
  }

  if (!fmt) throw new WavParseError('Missing fmt chunk');
  if (dataOffset < 0) throw new WavParseError('Missing data chunk');
  if (fmt.audioFormat !== 1) throw new WavParseError(`Unsupported WAV audio format ${fmt.audioFormat} (PCM only)`);
  if (fmt.bitsPerSample !== 16) throw new WavParseError(`Unsupported bit depth ${fmt.bitsPerSample} (16-bit only)`);
  if (fmt.channels < 1 || fmt.channels > 2) throw new WavParseError(`Unsupported channel count ${fmt.channels}`);

  const safeLength = Math.min(dataLength, buffer.byteLength - dataOffset);
  const frameCount = Math.floor(safeLength / 2 / fmt.channels);
  // Copy (not a view) so the data chunk's byte offset — not always 2-byte
  // aligned in the source buffer — can't trip Int16Array's alignment check.
  const raw = buffer.slice(dataOffset, dataOffset + frameCount * fmt.channels * 2);
  const interleaved = new Int16Array(raw);

  const samples = fmt.channels === 1 ? interleaved.slice() : downmixStereo(interleaved);

  return { sampleRate: fmt.sampleRate, channels: fmt.channels, bitsPerSample: fmt.bitsPerSample, samples };
}

function downmixStereo(interleaved: Int16Array): Int16Array {
  const frames = interleaved.length / 2;
  const mono = new Int16Array(frames);
  for (let i = 0; i < frames; i += 1) {
    const l = interleaved[i * 2] ?? 0;
    const r = interleaved[i * 2 + 1] ?? 0;
    mono[i] = Math.round((l + r) / 2);
  }
  return mono;
}

function readAscii(view: DataView, offset: number, length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) out += String.fromCharCode(view.getUint8(offset + i));
  return out;
}
