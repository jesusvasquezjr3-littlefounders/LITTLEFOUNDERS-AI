import { Button } from '../../../design/controls';
import type { Locale } from '../../../design/copyBudget';
import { pluralUnit } from '../../../design/plural';

export const fmt = (locale: Locale, value: number, digits = 2): string => new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(Object.is(value, -0) ? 0 : value);

export const slots = (text: string, values: Readonly<Record<string, string | number>>): string => text.replace(/\{(\w+)\}/g, (whole, key: string) => String(values[key] ?? whole));

/** "99 people", "1 person": the unit comes from the locale's own plural rules. */
export const people = (locale: Locale, count: number, words: { readonly person: string; readonly people: string }): string =>
  `${fmt(locale, count, 0)} ${pluralUnit(locale, count, { one: words.person, other: words.people })}`;

export function TableToggle({ open, onToggle, show, hide }: { open: boolean; onToggle: () => void; show: string; hide: string }) {
  return <Button size="sm" aria-expanded={open} onClick={onToggle} data-hz-table-toggle="">{open ? hide : show}</Button>;
}
