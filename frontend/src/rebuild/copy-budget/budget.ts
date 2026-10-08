import { expect } from 'vitest';
import { rebuildNamespaceCopy, type RebuildNamespace } from '../../i18n/rebuild';
import { checkCopy, type AgeBand, type CopyRole, type Locale } from '../design/copyBudget';

/*
 * Shared helpers for per-namespace copy-budget checks.
 *
 * A namespace's top-level keys must equal the groups budgeted, so a key
 * added without a budget is flagged instead of shipping unmeasured.
 */

export const LOCALES = ['en-US', 'es-MX', 'pt-BR'] as const;

type Tree = { readonly [key: string]: string | Tree };

/** Each locale's strings of one namespace. */
export function namespaceCopy(namespace: RebuildNamespace) {
  return LOCALES.map((locale) => [locale, rebuildNamespaceCopy[locale][namespace] as unknown as Tree] as const);
}

/** Every string under `value`, with its dotted path relative to it. */
export function flatten(value: string | Tree, prefix = ''): [string, string][] {
  return typeof value === 'string' ? [[prefix, value]]
    : Object.entries(value).flatMap(([key, child]) => flatten(child, prefix ? `${prefix}.${key}` : key));
}

/** Asserts one string fits its role's budget. */
export function expectFits(text: string, role: CopyRole, locale: Locale, ageBand: AgeBand, label: string, surface: 'app' | 'site' = 'app') {
  expect(checkCopy(text, role, { locale, ageBand, surface }), label).toEqual([]);
}

/** Asserts the namespace holds exactly these top-level keys (the groups this file budgets). */
export function expectBudgetedGroups(strings: Tree, groups: readonly string[]) {
  expect(Object.keys(strings).sort()).toEqual([...groups].sort());
}
