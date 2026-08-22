import type { Locale } from '../context/schema.js';

/*
 * The voice seam (/AGENTS.md §1.2, /ORACLE.md §3.3).
 *
 * The owner's stated intent is to replace Inworld with self-hosted speech once
 * there are recurring users. That migration is cheap only if nothing above
 * this interface knows the provider's name — so NOTHING outside
 * `oracle/src/voice/` may import a provider SDK or reference a provider URL,
 * and a test pins that.
 *
 * The interface is deliberately smaller than any provider's API. Oracle needs
 * two things: turn audio into text, and turn text into audio. Everything else
 * a character-engine platform offers — personas, memory, goals, emotion
 * inference — is refused on purpose, because it is exactly the surface that
 * would move pedagogy and a child's context off our infrastructure.
 */

export interface TranscriptionRequest {
  /** Raw audio bytes as received from the browser. */
  audio: Buffer;
  /** MIME type the browser recorded in, e.g. 'audio/webm;codecs=opus'. */
  mimeType: string;
  locale: Locale;
}

export interface TranscriptionResult {
  text: string;
  /** Provider confidence in [0,1] when reported; null when not. */
  confidence: number | null;
}

export interface SynthesisRequest {
  text: string;
  locale: Locale;
  /**
   * Which canonical character is speaking. The provider-specific voice id is
   * resolved INSIDE the adapter, so a voice-casting change is one file.
   */
  character: 'dina' | 'liruf' | 'rho' | 'zara';
}

export interface SynthesisResult {
  audio: Buffer;
  mimeType: string;
}

export interface VoiceProvider {
  readonly name: string;
  /** False when the provider is configured but unusable (no key, etc.). */
  readonly available: boolean;
  transcribe(request: TranscriptionRequest): Promise<TranscriptionResult>;
  synthesize(request: SynthesisRequest): Promise<SynthesisResult>;
  /**
   * An opaque string that changes whenever the audio this provider would
   * return for this character and locale would change — provider, model and
   * enrolled voice, at least. `null` when this character cannot be spoken here
   * at all (unenrolled, no key), which is a silence, never a substitute.
   *
   * It exists so the speech cache can be keyed on the real inputs to the paid
   * call WITHOUT anything above this interface knowing what those inputs are.
   * A re-enrolled voice or a switched model therefore invalidates the cache by
   * construction, instead of serving a child last month's actor.
   */
  voiceFingerprint(character: SynthesisRequest['character'], locale: Locale): string | null;
}

export class VoiceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VoiceUnavailableError';
  }
}
