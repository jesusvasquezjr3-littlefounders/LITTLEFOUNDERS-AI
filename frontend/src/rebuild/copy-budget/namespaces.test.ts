import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REBUILD_NAMESPACES, rebuildCopy, rebuildNamespaceCopy } from '../../i18n/rebuild';
import { LOCALES } from './budget';

/*
 * The rebuilt copy is split into one namespace per wave-2 lane. The merge in
 * `i18n/rebuild.ts` spreads the namespaces into one object, so a top-level key
 * in two namespaces would silently shadow another lane's string: refuse it.
 */
const i18n = join(process.cwd(), 'src/i18n');

describe('rebuilt copy namespaces', () => {
  it('ships exactly the registered namespaces in every locale', () => {
    for (const locale of LOCALES) {
      const files = readdirSync(join(i18n, locale)).filter((file) => /^rebuild/.test(file)).sort();
      expect(files, locale).toEqual(REBUILD_NAMESPACES.map((namespace) => `rebuild-${namespace}.json`).sort());
    }
  });

  it('keeps every top-level key in exactly one namespace', () => {
    for (const locale of LOCALES) {
      const owner = new Map<string, string>();
      const duplicates: string[] = [];
      for (const namespace of REBUILD_NAMESPACES) for (const key of Object.keys(rebuildNamespaceCopy[locale][namespace])) {
        if (owner.has(key)) duplicates.push(`${key}: ${owner.get(key)} and ${namespace}`);
        owner.set(key, namespace);
      }
      expect(duplicates, locale).toEqual([]);
      expect(Object.keys(rebuildCopy[locale]).length, locale).toBe(owner.size);
    }
  });

  it('gives every namespace its own copy-budget test file', () => {
    const tests = readdirSync(join(process.cwd(), 'src/rebuild/copy-budget')).filter((file) => file.endsWith('.test.ts'));
    for (const namespace of REBUILD_NAMESPACES) expect(tests, namespace).toContain(`${namespace}.test.ts`);
  });
});
