import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendixSections, checkTips, clientTips, coreTips, liveInputs, tipHash } from './check-parent-coaching-tips.mjs';

/*
 * D.23's review gate must refuse every way an unreviewed tip could reach a
 * Tutor: Core marking a draft as sent, an approval without its reviewer, a
 * reviewed tip whose copy changed afterwards, and the three lists (registry,
 * Core, client) drifting apart. It must also refuse a tip with no research
 * basis in Appendix G.
 */

test('the live repository agrees', () => {
  assert.deepEqual(checkTips(liveInputs()), []);
});

test('reads Appendix G sections and the two code mirrors', () => {
  assert.deepEqual([...appendixSections('## Part 1\n### 1.1 A\n### 1.2 B\ntext ### 9.9 no\n')], ['1.1', '1.2']);
  assert.deepEqual(coreTips("  { id: 'a-b', appendixG: ['1.2', '2.4'], reviewed: false },"), [{ id: 'a-b', appendixG: ['1.2', '2.4'], reviewed: false }]);
  assert.deepEqual(clientTips("export const TIP_IDS = [\n  'a-b', 'c-d',\n] as const;"), ['a-b', 'c-d']);
});

const mutate = (change) => {
  const live = liveInputs();
  return checkTips({ ...live, ...change(live) });
};

test('refuses Core sending a tip nobody reviewed', () => {
  const failures = mutate((live) => ({
    readFile: (path) => (path.endsWith('parentCoaching.ts')
      ? live.readFile(path).replace("{ id: 'keep-promises', appendixG: ['1.3'], reviewed: false }", "{ id: 'keep-promises', appendixG: ['1.3'], reviewed: true }")
      : live.readFile(path)),
  }));
  assert.deepEqual(failures, ['keep-promises: Core sends a tip nobody has reviewed']);
});

test('accepts a real review, and refuses one whose copy changed afterwards or that lacks its reviewer', () => {
  const live = liveInputs();
  const approve = (review) => {
    const registry = structuredClone(live.registry);
    Object.assign(registry.tips.find((t) => t.id === 'keep-promises'), { status: 'approved', review });
    return registry;
  };
  const readFile = (path) => (path.endsWith('parentCoaching.ts')
    ? live.readFile(path).replace("{ id: 'keep-promises', appendixG: ['1.3'], reviewed: false }", "{ id: 'keep-promises', appendixG: ['1.3'], reviewed: true }")
    : live.readFile(path));
  const good = { by: 'A. Reviewer', role: 'Pedagogical Lead', at: '2026-10-01', hash: tipHash('keep-promises', live.locales) };
  assert.deepEqual(checkTips({ ...live, registry: approve(good), readFile }), []);
  const edited = (locale) => {
    const copy = live.locales(locale);
    return locale === 'es-MX' ? { ...copy, tips: { ...copy.tips, 'keep-promises': { ...copy.tips['keep-promises'], body: 'Otro texto nuevo sin revisar.' } } } : copy;
  };
  assert.deepEqual(checkTips({ ...live, registry: approve(good), readFile, locales: edited }),
    ['keep-promises: the copy changed after its review; review it again before it can be sent']);
  assert.deepEqual(checkTips({ ...live, registry: approve({ ...good, role: 'Engineer' }), readFile }),
    ['keep-promises: an approval needs the reviewer, the Pedagogical Lead role and the date']);
});

test('refuses a tip with no research basis, or copy missing in a locale', () => {
  const failures = mutate((live) => {
    const registry = structuredClone(live.registry);
    registry.tips.find((t) => t.id === 'share-for-real').appendixG = ['7.1'];
    return {
      registry,
      locales: (locale) => {
        const copy = live.locales(locale);
        return locale === 'pt-BR' ? { ...copy, tips: { ...copy.tips, 'after-a-goal': { ...copy.tips['after-a-goal'], why: '' } } } : copy;
      },
    };
  });
  assert.ok(failures.includes('share-for-real: Appendix G has no section 7.1'), failures.join('\n'));
  assert.ok(failures.includes('share-for-real: Core cites 1.4, the registry 7.1'), failures.join('\n'));
  assert.ok(failures.includes('after-a-goal: no why in pt-BR'), failures.join('\n'));
});

test('refuses the client knowing a tip the registry does not', () => {
  const failures = mutate((live) => ({
    readFile: (path) => (path.endsWith('governanceApi.ts') ? live.readFile(path).replace("'bonus-is-not-interest',", "'bonus-is-not-interest', 'buy-now',") : live.readFile(path)),
  }));
  assert.equal(failures.length, 1);
  assert.ok(failures[0].startsWith('frontend/src/rebuild/family/governanceApi.ts: TIP_IDS is'), failures[0]);
});
