import { getConfig } from '../env.js';
import { withTimeout } from '../lib/http.js';
import type { Locale } from '../context/schema.js';
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
 * VERIFIED AGAINST THE LIVE API on 2026-08-21 with a real (non-production)
 * key. Everything below was measured, not read off a documentation page:
 *
 *   POST /tts/v1/voice        0.96 s for a sentence, MP3 back as base64
 *   POST /stt/v1/transcribe   0.64 s, correct Spanish transcript
 *   POST /voices/v1/voices:clone   instant voice cloning, 200, usable
 *                                  immediately — RATE LIMITED TO 2/MINUTE
 *   DELETE /voices/v1/voices/{id}  removes a cloned voice
 *
 * The earlier draft of this file guessed `/v1/speech:synthesize` and
 * `/v1/speech:recognize` and expected raw audio bytes. All three were wrong.
 * That is why it carried an UNVERIFIED banner, and why the banner is now gone.
 */

const TTS_PATH = '/tts/v1/voice';
const STT_PATH = '/stt/v1/transcribe';
const CLONE_PATH = '/voices/v1/voices:clone';

/** Verified present: inworld-tts-1, -1-max, -2, -2-flash. */
const DEFAULT_TTS_MODEL = 'inworld-tts-1';
const STT_MODEL = 'inworld/inworld-stt-1';

/*
 * WE DO NOT NAME THE ENCODING. THE PROVIDER SNIFFS IT.
 *
 * This function used to translate the browser's MIME type into Inworld's
 * encoding enum, and it mapped `audio/webm;codecs=opus` — what Chrome, Edge
 * and every Android browser's `MediaRecorder` produces — to `OGG_OPUS`.
 *
 * WebM and Ogg are DIFFERENT CONTAINERS that happen to carry the same codec.
 * Telling the API a Matroska stream is an Ogg stream makes its demuxer fail,
 * and it answers `500 {"code":13,"message":"proxy has failed to process your
 * request"}`. Measured against the live API on 2026-08-24:
 *
 *   webm + OGG_OPUS      500  ← every microphone turn on Chrome/Edge/Android
 *   webm + AUTO_DETECT   200  "Hola, quiero aprender a ahorrar dinero."
 *   ogg  + OGG_OPUS      200  (a real Ogg container — the label was never wrong here)
 *   m4a  + AUTO_DETECT   200  ← Safari/iOS, which has no other recording format
 *   wav  + AUTO_DETECT   200
 *   mp3  + AUTO_DETECT   200
 *
 * `AUTO_DETECT` returned a correct transcript for ALL FIVE containers, so the
 * mapping bought nothing and cost the entire microphone on the majority of
 * devices. There is also no enum to reach for even if we wanted one: `WEBM_OPUS`
 * and `M4A` are both rejected as `AUDIO_ENCODING_UNSPECIFIED`.
 *
 * §1.14: a confident wrong label is worse than no label. The bytes carry their
 * own container header; the provider reads it correctly; we stop guessing.
 * Do not reintroduce a MIME→enum table here — that is this defect, exactly.
 */
const AUDIO_ENCODING = 'AUTO_DETECT';

/*
 * THE CHARACTER VOICES ARE THE WHOLE POINT.
 *
 * Dina, Liruf, Dr. Rho and Zara already have voices: Echo clones them per
 * locale from the owner's reference recordings (`audiogen/src/samples/`,
 * gitignored) and narrates every lesson with them. If the Tutor spoke in a
 * stock catalogue voice, a child who knows Dr. Rho from a lesson would meet a
 * stranger wearing his face — which is worse than a tutor who does not speak
 * at all, because it quietly breaks the one thing the 3D cast exists to build.
 *
 * So this adapter resolves a voice per CHARACTER and LOCALE from configuration
 * whose names deliberately mirror Echo's (`TTS_VOICE_RHO_ES_MX` →
 * `INWORLD_VOICE_RHO_ES_MX`), populated by `npm run voices:clone` from the
 * SAME trimmed samples Echo enrolls. Two services, one casting, provably.
 *
 * AND THERE IS NO FALLBACK. An unmapped character throws, the turn is
 * captioned and silent, and `scripts/clone-character-voices.ts` says which
 * enrolment is missing. Substituting a stock voice would be the §1.14 defect
 * in its purest form: a confident wrong answer where an absent one merely
 * omits.
 */
const LOCALE_SLUG: Record<Locale, string> = {
  'en-US': 'EN_US',
  'es-MX': 'ES_MX',
  'pt-BR': 'PT_BR',
};

export function voiceEnvVar(character: SynthesisRequest['character'], locale: Locale): string {
  return `INWORLD_VOICE_${character.toUpperCase()}_${LOCALE_SLUG[locale]}`;
}

/** The cloned voice id for this character in this locale, or null if unenrolled. */
export function resolveCharacterVoice(
  character: SynthesisRequest['character'],
  locale: Locale,
): string | null {
  const value = process.env[voiceEnvVar(character, locale)];
  return value && value.trim() !== '' ? value.trim() : null;
}

interface RecognizeResponse {
  transcription?: {
    transcript?: string;
    isFinal?: boolean;
    /*
     * PRIVACY FINDING, 2026-08-21. Inworld's STT model can return an inferred
     * VOICE PROFILE alongside the transcript — emotion, vocal style, accent,
     * age, pitch. Measured behaviour: it is null unless asked for, and absent
     * entirely when `enableVoiceProfile: false` is sent.
     *
     * Inferring a child's age and emotional state from their voice is a
     * different KIND of processing from turning speech into text, and nothing
     * in this product needs it. It is disabled explicitly rather than left to
     * a default, because a default is something a provider may change and we
     * would never notice. Recorded in /LEGAL/AI_TUTOR_LEGAL_REVIEW.md §2.1.
     */
    voiceProfile?: unknown;
  };
}

interface SynthesizeResponse {
  audioContent?: string;
  usage?: { processedCharactersCount?: number; modelId?: string };
}

export class InworldVoiceProvider implements VoiceProvider {
  readonly name = 'inworld';

  get available(): boolean {
    return Boolean(getConfig().INWORLD_API_KEY);
  }

  /**
   * Everything that decides what this character sounds like, in one string.
   *
   * The cache keys on it, so a re-enrolment (`voices:clone` issues a new
   * voiceId) or a model switch produces different keys and the old audio is
   * simply never found again. That is the correct behaviour and the cheap one:
   * no invalidation pass, no stale clip, no child hearing a voice that was
   * replaced on purpose.
   */
  voiceFingerprint(character: SynthesisRequest['character'], locale: Locale): string | null {
    if (!getConfig().INWORLD_API_KEY) return null;
    const voiceId = resolveCharacterVoice(character, locale);
    if (!voiceId) return null;
    return `inworld:${getConfig().INWORLD_TTS_MODEL || DEFAULT_TTS_MODEL}:${voiceId}`;
  }

  private headers(): Record<string, string> {
    const key = getConfig().INWORLD_API_KEY;
    if (!key) throw new VoiceUnavailableError('INWORLD_API_KEY is not configured');
    // Basic, and the key is ALREADY the base64 of `keyId:secret` — Inworld
    // issues it pre-encoded. Encoding it again yields a 401 that reads like a
    // wrong credential rather than a wrong header.
    return { Authorization: `Basic ${key}`, 'Content-Type': 'application/json' };
  }

  async transcribe(request: TranscriptionRequest): Promise<TranscriptionResult> {
    const config = getConfig();

    let response: Response;
    try {
      response = await withTimeout(
        fetch(`${config.INWORLD_API_BASE}${STT_PATH}`, {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify({
            transcribeConfig: {
              modelId: STT_MODEL,
              // Inworld takes a bare language subtag here, not a BCP-47 pair.
              language: request.locale.slice(0, 2),
              audioEncoding: AUDIO_ENCODING,
              voiceProfileConfig: { enableVoiceProfile: false },
            },
            audioData: { content: request.audio.toString('base64') },
          }),
        }),
        config.VOICE_TIMEOUT_MS,
        'inworld speech-to-text',
      );
    } catch (error) {
      throw new VoiceUnavailableError(error instanceof Error ? error.message : 'stt transport failed');
    }

    if (!response.ok) {
      /*
       * THE BODY, NOT JUST THE STATUS.
       *
       * This threw `inworld stt responded 500` for weeks. Inworld's actual
       * answer — `{"code":13,"message":"proxy has failed to process your
       * request"}` — never reached a log, so the microphone was dead with no
       * way to tell a bad container from a bad key from a bad quota. The
       * mimeType is included because the container is what goes wrong here.
       */
      const detail = await response.text().catch(() => '');
      throw new VoiceUnavailableError(
        `inworld stt responded ${response.status} for ${request.mimeType}: ${detail.slice(0, 300)}`,
      );
    }

    const body = (await response.json()) as RecognizeResponse;
    if (body.transcription?.voiceProfile) {
      // Never stored, never forwarded, and loud — if this ever appears despite
      // the config above, the provider changed a default and we need to know.
      console.error('[oracle] inworld returned a voice profile despite it being disabled — discarding');
    }

    return { text: (body.transcription?.transcript ?? '').trim(), confidence: null };
  }

  async synthesize(request: SynthesisRequest): Promise<SynthesisResult> {
    const config = getConfig();

    const voiceId = resolveCharacterVoice(request.character, request.locale);
    if (!voiceId) {
      // Silence over a stranger's voice. See the block comment above.
      throw new VoiceUnavailableError(
        `no cloned voice enrolled for ${request.character} in ${request.locale} ` +
          `(set ${voiceEnvVar(request.character, request.locale)} — run \`npm run voices:clone\`)`,
      );
    }

    let response: Response;
    try {
      response = await withTimeout(
        fetch(`${config.INWORLD_API_BASE}${TTS_PATH}`, {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify({
            text: request.text,
            voiceId,
            modelId: config.INWORLD_TTS_MODEL || DEFAULT_TTS_MODEL,
            language: request.locale,
            audioConfig: { audioEncoding: 'MP3' },
          }),
        }),
        config.VOICE_TIMEOUT_MS,
        'inworld text-to-speech',
      );
    } catch (error) {
      throw new VoiceUnavailableError(error instanceof Error ? error.message : 'tts transport failed');
    }

    if (!response.ok) {
      throw new VoiceUnavailableError(`inworld tts responded ${response.status}`);
    }

    const body = (await response.json()) as SynthesizeResponse;
    if (!body.audioContent) {
      // A 200 with no audio is the failure that looks like success: the mouth
      // stays shut, the turn is marked spoken, and nothing logs.
      throw new VoiceUnavailableError('inworld tts returned no audioContent');
    }

    return { audio: Buffer.from(body.audioContent, 'base64'), mimeType: 'audio/mpeg' };
  }
}

// ── Enrolment (used by scripts/clone-character-voices.ts, never at runtime) ──

export interface CloneVoiceInput {
  displayName: string;
  locale: Locale;
  /** Reference audio, base64. Inworld's instant cloning wants 5–15 seconds. */
  audioBase64: string;
  /** What the reference clip says. Optional to Inworld, and it improves fidelity. */
  transcription?: string;
  description?: string;
}

interface CloneResponse {
  voice?: { voiceId?: string; source?: string; langCode?: string };
}

/**
 * Enrols one cloned voice and returns its id.
 *
 * **Rate limited to 2 requests per minute** — measured, not documented.
 * Enrolling the full cast (4 characters × 3 locales) therefore takes about six
 * minutes of wall clock, and the script paces itself accordingly rather than
 * discovering this as a wall of 429s halfway through.
 */
export async function cloneVoice(input: CloneVoiceInput): Promise<string> {
  const config = getConfig();
  const key = config.INWORLD_API_KEY;
  if (!key) throw new VoiceUnavailableError('INWORLD_API_KEY is not configured');

  const response = await withTimeout(
    fetch(`${config.INWORLD_API_BASE}${CLONE_PATH}`, {
      method: 'POST',
      headers: { Authorization: `Basic ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: input.displayName,
        langCode: input.locale,
        voiceSamples: [{ audioData: input.audioBase64, transcription: input.transcription ?? '' }],
        description: input.description ?? '',
        audioProcessingConfig: { removeBackgroundNoise: true },
      }),
    }),
    120_000,
    'inworld voice clone',
  );

  if (!response.ok) {
    throw new VoiceUnavailableError(
      `inworld clone responded ${response.status}: ${(await response.text()).slice(0, 200)}`,
    );
  }

  const body = (await response.json()) as CloneResponse;
  const voiceId = body.voice?.voiceId;
  if (!voiceId) throw new VoiceUnavailableError('inworld clone returned no voiceId');
  return voiceId;
}
