import { expect } from 'vitest';
import { rebuildNamespaceCopy, type RebuildNamespace } from '../../i18n/rebuild';
import { checkCopy, type AgeBand, type CopyRole, type Locale } from '../design/copyBudget';

/*
 * Shared helpers for the per-namespace copy-budget contract tests (Frontend
 * Bible 06 §3, OD-13). One test file per rebuilt namespace lives beside this
 * one (`core.test.ts`, `site.test.ts`, ... `staff.test.ts`); each wave-2 lane
 * adds the budget loop for a new key group to its own file only.
 *
 * Every file first proves it is exhaustive: the namespace's top-level keys
 * must equal the groups the file budgets, so a key added without a budget
 * fails here instead of shipping unmeasured.
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
