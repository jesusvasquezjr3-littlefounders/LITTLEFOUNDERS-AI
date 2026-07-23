/** Typed image-generation failures — never leak raw provider payloads to callers/logs. */
export class ImageError extends Error {
  constructor(
    public readonly code:
      | 'IMAGE_TIMEOUT'
      | 'IMAGE_RATE_LIMITED'
      | 'IMAGE_PROVIDER_ERROR'
      | 'IMAGE_BAD_RESPONSE'
      | 'IMAGE_DOWNLOAD_FAILED',
    message: string,
  ) {
    super(message);
    this.name = 'ImageError';
  }
}
