import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkScope, liveInputs, mechanics, schemaIdentifiers } from './check-block-d-scope.mjs';

/*
 * D.20's gate must see every way the scope statement stops being true: an
 * exclusion dropped, a line missing in a locale, a "practises" line whose
 * backing code is gone, a page that stops showing it, and a borrowing or
 * interest mechanic entering the schema while the statement still says the
 * practice does not teach it.
 */

test('the live repository agrees', () => {
  assert.deepEqual(checkScope(liveInputs()), []);
});

test('reads table and column names, not comments', () => {
  const ids = schemaIdentifiers([{ name: '0001.sql', sql: '-- no loan here\nCREATE TABLE IF NOT EXISTS public.kid_loans (\n    id uuid PRIMARY KEY,\n    interest_rate_bp integer NOT NULL\n);\nALTER TABLE public.x ADD COLUMN IF NOT EXISTS credit_limit integer;' }]);
  assert.deepEqual([...ids].sort(), ['credit_limit', 'id', 'interest_rate_bp', 'kid_loans']);
  assert.deepEqual(mechanics(ids, ['loans', 'interest'], ['credit_limit']), ['credit_limit', 'interest_rate_bp', 'kid_loans']);
  assert.deepEqual(mechanics(new Set(['pending_credits', 'calendar_day', 'reward_coins']), ['loan', 'interest', 'lend'], ['credit_limit']), []);
});

const mutate = (change) => {
  const live = liveInputs();
  return checkScope({ ...live, ...change(live) });
};

test('catches a required exclusion that was dropped', () => {
  const failures = mutate((live) => {
    const registry = structuredClone(live.registry);
    registry.notAttempted = registry.notAttempted.filter((n) => n.concept !== 'compound_interest');
    return { registry };
  });
  assert.ok(failures.includes('the statement no longer says the practice does not teach compound_interest'), failures.join('\n'));
});

test('catches a line missing in one locale', () => {
  const failures = mutate((live) => ({
    locales: (locale, ns) => {
      const copy = live.locales(locale, ns);
      return locale === 'es-MX' ? { ...copy, scope: { ...copy.scope, debt: '' } } : copy;
    },
  }));
  assert.deepEqual(failures, ['debt: copy familyGovernance:scope.debt is missing in es-MX']);
});

test('catches a "practises" line whose backing code is gone', () => {
  const failures = mutate((live) => ({
    readFile: (path) => (path.endsWith('moneyHabits.ts') ? live.readFile(path).replace('export const RECOMMENDED_SAVE_PCT', 'const SAVE') : live.readFile(path)),
  }));
  assert.deepEqual(failures, ['splitting: backend/src/services/moneyHabits.ts no longer contains "export const RECOMMENDED_SAVE_PCT"']);
});

test('catches a page that stops showing the statement', () => {
  const failures = mutate((live) => ({
    readFile: (path) => (path.endsWith('TeenWalletPage.tsx') ? live.readFile(path).replace('<ScopeStatementPanel />', '') : live.readFile(path)),
  }));
  assert.deepEqual(failures, ['frontend/src/routes/app/wallet/TeenWalletPage.tsx: no longer shows the scope statement']);
});

test('catches a lending or interest mechanic entering the schema', () => {
  const failures = mutate((live) => ({
    migrations: [...live.migrations, { name: '9999_loans.sql', sql: 'CREATE TABLE IF NOT EXISTS public.coin_loans (\n    id uuid PRIMARY KEY,\n    interest_bp integer NOT NULL\n);' }],
  }));
  assert.equal(failures.length, 2, failures.join('\n'));
  assert.ok(failures[0].startsWith('schema: "coin_loans" looks like a borrowing'), failures[0]);
});

test('catches an audit log with no dated entry', () => {
  const failures = mutate((live) => ({
    readFile: (path) => (path.endsWith('BLOCK-D-SCOPE-STATEMENT.md') ? live.readFile(path).split('## Audit log')[0] : live.readFile(path)),
  }));
  assert.deepEqual(failures, ['docs/operations/BLOCK-D-SCOPE-STATEMENT.md: the audit log has no dated entry']);
});

test('catches the public FAQ answer dropping an exclusion in one locale, or leaving the page (S07.8)', () => {
  const dropped = mutate((live) => ({
    locales: (locale, ns) => {
      const json = live.locales(locale, ns);
      if (locale !== 'es-MX' || ns !== 'marketing') return json;
      const copy = structuredClone(json);
      copy.faq.items.notTaught.answer = copy.faq.items.notTaught.answer.replace('deudas, ', '');
      return copy;
    },
  }));
  assert.deepEqual(dropped, ['notTaught: marketing:faq.items.notTaught.answer (es-MX) no longer names "deudas"']);
  const unlisted = mutate((live) => ({
    readFile: (path) => (path.endsWith('FAQ.tsx') ? live.readFile(path).replace('{ id: "notTaught", category: "money" },', '') : live.readFile(path)),
  }));
  assert.deepEqual(unlisted, ['frontend/src/routes/marketing/FAQ.tsx: no longer lists the "notTaught" answer']);
});
