import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareMarketingPaths, readMarketingPaths } from './check-marketing-paths.mjs';

/*
 * A drift gate that cannot itself detect drift is worse than no gate: it
 * reports OK forever and everyone stops thinking about the invariant. These
 * tests cover both halves — that the extractor really reads the live files,
 * and that the comparison actually fails when the lists disagree.
 */

test('reads both lists out of the real source files', () => {
  const { prefixes, roots } = readMarketingPaths();
  // If a refactor renames or reformats either declaration, extraction throws
  // rather than returning [] — asserting non-empty pins that contract.
  assert.ok(prefixes.length > 1, 'MARKETING_PREFIXES should not be empty');
  assert.ok(roots.length > 0, 'MARKETING_ROOTS should not be empty');
  assert.ok(prefixes.includes('/'), "the frontend list must carry the site root '/'");
});

test('the live repository is currently in agreement', () => {
  const result = compareMarketingPaths(readMarketingPaths());
  assert.deepEqual(result.missingInBackend, [], 'tracked by the frontend but excluded from reports');
  assert.deepEqual(result.extraInBackend, [], 'admitted by reports but never tracked');
  assert.ok(result.ok);
});

test('catches a route added to the frontend only', () => {
  // The dangerous direction: the page is recorded, then filtered out of every
  // report, so a real marketing page reads as one nobody visits.
  const result = compareMarketingPaths({
    prefixes: ['/', '/how-it-works', '/pricing'],
    roots: ['how-it-works'],
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.missingInBackend, ['pricing']);
  assert.deepEqual(result.extraInBackend, []);
});

test('catches a route added to the backend only', () => {
  const result = compareMarketingPaths({
    prefixes: ['/', '/how-it-works'],
    roots: ['how-it-works', 'pricing'],
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.missingInBackend, []);
  assert.deepEqual(result.extraInBackend, ['pricing']);
});

test("ignores the site root, which has no root name", () => {
  const result = compareMarketingPaths({ prefixes: ['/'], roots: [] });
  assert.ok(result.ok);
});

test('is not fooled by ordering', () => {
  const result = compareMarketingPaths({
    prefixes: ['/', '/faq', '/legal', '/families'],
    roots: ['families', 'legal', 'faq'],
  });
  assert.ok(result.ok);
});
