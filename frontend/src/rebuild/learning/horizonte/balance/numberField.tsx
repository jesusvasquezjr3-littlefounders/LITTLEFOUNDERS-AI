import { TextField } from '../../../design/controls';
import type { Locale } from '../../../design/copyBudget';
import { playerCopy, readNumberAnswer, type NumberAnswerDomain } from '../../segmentKit';

/*
 * A typed number for the balance boards: the same locale-aware reading and echo as the shared NumberAnswer (the board
 * submits the canonical decimal text only), but the input carries its own accessible name so the field can be named
 * without a visible-label lookup, and Reset can empty it.
 */
export function readNumber(text: string, locale: Locale, domain: NumberAnswerDomain): string | null {
  return readNumberAnswer(text, locale, domain).canonical;
}

export function NumberField({ label, locale, text, onText, disabled, domain }: {
  label: string; locale: Locale; text: string; onText: (text: string) => void; disabled?: boolean; domain: NumberAnswerDomain;
}) {
  const t = playerCopy(locale);
  const reading = readNumberAnswer(text, locale, domain);
  const echo = reading.canonical === null ? null : new Intl.NumberFormat(locale, { maximumFractionDigits: 12 }).format(Number(reading.canonical));
  const error = reading.problem === null || reading.problem === 'empty' ? undefined : t[reading.problem];
  return <div className="lf-number-answer">
    <TextField label={label} aria-label={label} inputMode="decimal" autoComplete="off" value={text} disabled={disabled}
      onChange={(event) => onText(event.target.value)} error={error} />
    <p className="lf-number-echo" data-copy-role="body" aria-live="polite">{echo ? t.readsAs.replace('{value}', echo) : ' '}</p>
  </div>;
}

/** Fills named slots in a copy string: `{a}` and `{b}` style, every occurrence. */
export const fillNamed = (text: string, values: Readonly<Record<string, string | number>>): string =>
  text.replace(/\{(\w+)\}/g, (match, name: string) => (name in values ? String(values[name]) : match));
