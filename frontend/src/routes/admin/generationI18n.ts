/*
 * Shared i18n helpers for the generation dashboard. Keeps the locale-aware
 * formatting logic in one place so every tab renders numbers, dates, and
 * stage labels consistently in the user's locale.
 */

/**
 * Maps checkpoint failedFrom values → i18n key suffixes for stage labels.
 * Every unmapped value collapses to `unknown`.
 */
const FAILED_FROM_TO_STAGE: Record<string, string> = {
  pending: 'pending',
  planned: 'planning',
  localized: 'localizing',
  illustrated: 'illustrating',
  written: 'writing',
  reviewed: 'reviewing',
  unknown: 'unknown',
};

/**
 * Translates a raw `failedFrom` value (from the database) into the
 * corresponding i18n key under `admin.generation.failedFromLabels.<key>`.
 * Falls back to the raw value if the mapping is missing.
 */
export function failedFromI18nKey(raw: string): string {
  return FAILED_FROM_TO_STAGE[raw] ?? 'unknown';
}

/**
 * Locale-aware percentage formatter. Falls back to en-US digits when
 * Intl is unavailable; always respects the decimal separator.
 */
export function formatPct(value: number, locale: string, decimals = 0): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value / 100);
}

/**
 * Locale-aware number with fixed decimals (uses locale decimal separator,
 * unlike toFixed which always uses ".").
 */
export function formatFixed(value: number, locale: string, decimals = 0): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}
