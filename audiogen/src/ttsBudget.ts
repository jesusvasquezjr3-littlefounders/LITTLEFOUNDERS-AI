/**
 * Conservative per-batch TTS admission. A reservation is consumed immediately
 * before synthesis, including when the provider later fails, because the
 * request may already have reached a billable boundary.
 */
export class TtsCallBudget {
  private remaining: number | null;

  constructor(maxCalls?: number) {
    if (maxCalls !== undefined && (!Number.isInteger(maxCalls) || maxCalls < 1)) {
      throw new RangeError('max TTS calls must be a positive integer');
    }
    this.remaining = maxCalls ?? null;
  }

  tryReserve(): boolean {
    if (this.remaining === null) return true;
    if (this.remaining <= 0) return false;
    this.remaining -= 1;
    return true;
  }

  get remainingCalls(): number | null {
    return this.remaining;
  }
}
