import { getConfig } from '../env.js';
import { InworldVoiceProvider } from './inworld.js';
import {
  VoiceUnavailableError,
  type SynthesisRequest,
  type SynthesisResult,
  type TranscriptionRequest,
  type TranscriptionResult,
  type VoiceProvider,
} from './provider.js';

/*
 * Provider selection, and the mode that matters most: none.
 *
 * `VOICE_PROVIDER=none` is not a stub or a test double — it is a real,
 * supported deployment posture and the DEFAULT. It is what runs before an
 * Inworld contract exists, what runs if the contract lapses, and what every
 * test runs. A session on it is fully functional: the tutor's lines are
 * captioned above the character's head and mirrored in the 2D bubble, the
 * lesson panel works, grading works, XP works. What is missing is the sound.
 *
 * /ORACLE.md §14 states the principle this encodes: speech is an enhancement,
 * the lesson is the product.
 */

class SilentVoiceProvider implements VoiceProvider {
  readonly name = 'none';
  readonly available = false;

  transcribe(_request: TranscriptionRequest): Promise<TranscriptionResult> {
    return Promise.reject(new VoiceUnavailableError('no voice provider is configured'));
  }

  synthesize(_request: SynthesisRequest): Promise<SynthesisResult> {
    return Promise.reject(new VoiceUnavailableError('no voice provider is configured'));
  }

  /** Nothing can be spoken here, so nothing can be cached here either. */
  voiceFingerprint(): string | null {
    return null;
  }
}

let cached: VoiceProvider | null = null;

export function getVoiceProvider(): VoiceProvider {
  if (cached) return cached;
  const provider = getConfig().VOICE_PROVIDER === 'inworld' ? new InworldVoiceProvider() : new SilentVoiceProvider();
  cached = provider;
  return provider;
}

/** Test seam — also used when configuration is reloaded. */
export function resetVoiceProvider(): void {
  cached = null;
}

export { VoiceUnavailableError };
export type { VoiceProvider, TranscriptionRequest, TranscriptionResult, SynthesisRequest, SynthesisResult };
