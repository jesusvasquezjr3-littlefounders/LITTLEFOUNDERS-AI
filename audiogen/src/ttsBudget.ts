/**
 * Conservative per-batch TTS admission. A reservation is consumed immediately
 * before synthesis, including when the provider later fails, because the
 * request may already have reached a billable boundary.
 *
 * Two independent limits, both optional at this level:
 *  - a call count (AUDIOGEN_MAX_TTS_CALLS_PER_RUN);
 *  - OD-28 (owner review D-03): the owner-approved USD ceiling of a
 *    `narrate:all` run, priced per character at AUDIOGEN_USD_PER_1K_CHARS
 *    (Qwen3-TTS bills by input characters). A reservation that would take the
 *    run past the ceiling is refused, never partially admitted, and once one
 *    is refused the budget reports itself exhausted so the batch stops.
 */
export interface TtsUsdCeiling {
  maxUsd: number;
  usdPer1kChars: number;
}

export class TtsCallBudget {
  private remaining: number | null;
  private readonly usd: TtsUsdCeiling | null;
  private reservedUsd = 0;
  private usdRefused = false;

  constructor(maxCalls?: number, usdCeiling?: TtsUsdCeiling) {
    if (maxCalls !== undefined && (!Number.isInteger(maxCalls) || maxCalls < 1)) {
      throw new RangeError('max TTS calls must be a positive integer');
    }
    if (usdCeiling !== undefined) {
      const { maxUsd, usdPer1kChars } = usdCeiling;
      if (!Number.isFinite(maxUsd) || maxUsd <= 0) throw new RangeError('the USD ceiling must be a positive, finite number');
      if (!Number.isFinite(usdPer1kChars) || usdPer1kChars <= 0) {
        throw new RangeError('the TTS price per 1,000 characters must be a positive, finite number');
      }
    }
    this.remaining = maxCalls ?? null;
    this.usd = usdCeiling ?? null;
  }

  /** Reserve one synthesis of `chars` input characters. */
  tryReserve(chars = 0): boolean {
    if (this.remaining !== null && this.remaining <= 0) return false;
    if (this.usd) {
      const cost = (Math.max(0, chars) / 1000) * this.usd.usdPer1kChars;
      if (this.reservedUsd + cost > this.usd.maxUsd) {
        this.usdRefused = true;
        return false;
      }
      this.reservedUsd += cost;
    }
    if (this.remaining !== null) this.remaining -= 1;
    return true;
  }

  get remainingCalls(): number | null {
    return this.remaining;
  }

  /** USD reserved so far against the owner ceiling (0 when no ceiling is set). */
  get spentUsd(): number {
    return Number(this.reservedUsd.toFixed(6));
  }

  /** True once no further synthesis may be admitted: the call count is used up, or the USD ceiling refused one. */
  get exhausted(): boolean {
    return this.remaining === 0 || this.usdRefused;
  }
}
