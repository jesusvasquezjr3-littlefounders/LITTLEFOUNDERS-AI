/** Typed TTS failures — never leak raw provider payloads to callers/logs. */
export class TtsError extends Error {
  constructor(
    public readonly code:
      | 'TTS_TIMEOUT'
      | 'TTS_RATE_LIMITED'
      | 'TTS_PROVIDER_ERROR'
      | 'TTS_BAD_RESPONSE'
      | 'TTS_DOWNLOAD_FAILED'
      | 'VOICE_CLONE_PROVIDER_ERROR'
      | 'VOICE_CLONE_BAD_RESPONSE',
    message: string,
  ) {
    super(message);
    this.name = 'TtsError';
  }
}
