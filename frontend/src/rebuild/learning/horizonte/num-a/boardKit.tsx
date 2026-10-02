import type { KeyboardEvent, MouseEvent } from 'react';
import { Button } from '../../../design/controls';
import type { Locale } from '../../../design/copyBudget';

/** Fill each `{n}` slot of a copy string in order. */
export const fillSlots = (text: string, ...values: ReadonlyArray<string | number>): string => values.reduce<string>((out, value) => out.replace('{n}', String(value)), text);

/** An SVG shape that acts as a button: a tap, Enter or Space runs the action. */
export const pressable = (action: () => void, disabled = false) => ({
  role: 'button' as const,
  tabIndex: disabled ? -1 : 0,
  'aria-disabled': disabled,
  onClick: () => { if (!disabled) action(); },
  onKeyDown: (event: KeyboardEvent) => { if (!disabled && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); action(); } },
});

export const decimalText = (locale: Locale, value: number, digits: number): string =>
  new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);

/** Where a pointer landed across an element, 0 at its start edge and 1 at its end edge; 0 when it has no measured width. */
export function fractionAcross(event: MouseEvent<Element>): number {
  const box = event.currentTarget.getBoundingClientRect();
  return box.width > 0 ? Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)) : 0;
}

export function TableToggle({ open, onToggle, show, hide }: { open: boolean; onToggle: () => void; show: string; hide: string }) {
  return <Button size="sm" aria-expanded={open} onClick={onToggle} data-hz-table-toggle="">{open ? hide : show}</Button>;
}
