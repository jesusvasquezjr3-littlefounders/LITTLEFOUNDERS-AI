/** Typed image-generation failures — never leak raw provider payloads to callers/logs. */
export class ImageError extends Error {
  constructor(
    public readonly code:
      | 'IMAGE_TIMEOUT'
      | 'IMAGE_RATE_LIMITED'
      | 'IMAGE_PROVIDER_ERROR'
      | 'IMAGE_BAD_RESPONSE'
      | 'IMAGE_DOWNLOAD_FAILED'
      | 'IMAGE_VERIFICATION_FAILED'
      | 'IMAGE_GENERATION_FAILED',
    message: string,
    /** Fresh provider images known to have been created before this error. */
    public readonly generatedImages = 0,
  ) {
    super(message);
    this.name = 'ImageError';
  }
}
