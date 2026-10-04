import type { Locale } from '../../design/copyBudget';
import type { HorizonteCopy } from './boardTypes';

/** One locale's strings of a pack copy module, by key; `{n}` style slots are filled with `fillSlot`. */
export function copyText<C extends HorizonteCopy>(copy: C, locale: Locale): { readonly [K in keyof C]: string } {
  return Object.fromEntries(Object.entries(copy).map(([key, entry]) => [key, entry[locale]])) as { readonly [K in keyof C]: string };
}

export const fillSlot = (text: string, value: string | number): string => text.replace('{n}', String(value));
