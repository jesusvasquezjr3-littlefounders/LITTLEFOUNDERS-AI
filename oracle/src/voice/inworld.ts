import { getConfig } from '../env.js';
import { withTimeout } from '../lib/http.js';
import {
  VoiceUnavailableError,
  type SynthesisRequest,
  type SynthesisResult,
  type TranscriptionRequest,
  type TranscriptionResult,
  type VoiceProvider,
} from './provider.js';

/*
 * The Inworld adapter — the ONLY file in the repository that names the
 * provider or knows its wire format.
 *
 * > ⚠ THE ENDPOINT SHAPES BELOW ARE UNVERIFIED.
 * >
 * > /ORACLE.md §3.3 records this explicitly and it is repeated here because
 * > this is the file where a wrong assumption would actually cost something.
 * > Inworld's concrete API surface — path names, request encoding, streaming
 * > semantics, voice identifiers, pricing and whether a data-processing
 * > agreement covering minors' audio is available — was NOT read when this was
 * > written. Nothing else in the service depends on any of it: the interface
 * > in `provider.ts` is what the runtime uses, `VOICE_PROVIDER=none` is the
 * > default and a fully tested mode, and correcting this file is a contained
 * > change.
 * >
 * > Before enabling this in any environment: verify the four constants below
 * > against the live documentation, confirm the audio encodings, and confirm
 * > the retention/training terms in writing (/ORACLE.md §4.2, §16).
 *
 * The paths are env-overridable for exactly that reason — a documentation
 * correction should not need a deploy of new code to test.
 */

const DEFAULT_STT_PATH = '/v1/speech:recognize';
const DEFAULT_TTS_PATH = '/v1/speech:synthesize';

/**
 * Provider voice ids per canonical character.
 *
 * UNVERIFIED placeholders. Voice casting is a content decision the owner makes
 * with real audio in front of them, exactly as Echo's per-locale casting was —
 * it is not something to guess at from a name.
 */
const VOICE_IDS: Record<SynthesisRequest['character'], string> = {
  rho: 'lf-rho',
  zara: 'lf-zara',
  liruf: 'lf-liruf',
  dina: 'lf-dina',
};

interface RecognizeResponse {
  text?: string;
  transcript?: string;
  confidence?: number;
}

export class InworldVoiceProvider implements VoiceProvider {
  readonly name = 'inworld';

  get available(): boolean {
    return Boolean(getConfig().INWORLD_API_KEY);
  }

  private headers(): Record<string, string> {
    const key = getConfig().INWORLD_API_KEY;
    if (!key) throw new VoiceUnavailableError('INWORLD_API_KEY is not configured');
    return { Authorization: `Bearer ${key}` };
  }

  async transcribe(request: TranscriptionRequest): Promise<TranscriptionResult> {
    const config = getConfig();
    const form = new FormData();
    // A Blob rather than the Buffer directly: undici's FormData needs a
    // Blob/File, and passing a Buffer silently stringifies it — which sends
    // "[object Object]" and gets a cheerful 200 back with an empty transcript.
    form.append('audio', new Blob([new Uint8Array(request.audio)], { type: request.mimeType }));
    form.append('locale', request.locale);

    let response: Response;
    try {
      response = await withTimeout(
        fetch(`${config.INWORLD_API_BASE}${process.env.INWORLD_STT_PATH ?? DEFAULT_STT_PATH}`, {
          method: 'POST',
          headers: this.headers(),
          body: form,
        }),
        config.VOICE_TIMEOUT_MS,
        'inworld speech-to-text',
      );
    } catch (error) {
      throw new VoiceUnavailableError(error instanceof Error ? error.message : 'stt transport failed');
    }

    if (!response.ok) throw new VoiceUnavailableError(`inworld stt responded ${response.status}`);

    const body = (await response.json()) as RecognizeResponse;
    const text = (body.text ?? body.transcript ?? '').trim();
    return { text, confidence: typeof body.confidence === 'number' ? body.confidence : null };
  }

  async synthesize(request: SynthesisRequest): Promise<SynthesisResult> {
    const config = getConfig();

    let response: Response;
    try {
      response = await withTimeout(
        fetch(`${config.INWORLD_API_BASE}${process.env.INWORLD_TTS_PATH ?? DEFAULT_TTS_PATH}`, {
          method: 'POST',
          headers: { ...this.headers(), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: request.text,
            voice: VOICE_IDS[request.character],
            locale: request.locale,
            format: 'mp3',
          }),
        }),
        config.VOICE_TIMEOUT_MS,
        'inworld text-to-speech',
      );
    } catch (error) {
      throw new VoiceUnavailableError(error instanceof Error ? error.message : 'tts transport failed');
    }

    if (!response.ok) throw new VoiceUnavailableError(`inworld tts responded ${response.status}`);

    const audio = Buffer.from(await response.arrayBuffer());
    if (audio.byteLength === 0) {
      // An empty body with a 200 is the failure that looks like success: the
      // mouth stays shut, the turn is marked spoken, and nothing logs.
      throw new VoiceUnavailableError('inworld tts returned an empty body');
    }
    return { audio, mimeType: response.headers.get('content-type') ?? 'audio/mpeg' };
  }
}
