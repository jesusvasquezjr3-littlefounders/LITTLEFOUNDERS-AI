import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkControls, declaredControls, flatStrings, holdsIn, latestFunctionBody, liveInputs } from './check-no-unbacked-guarantee.mjs';

/*
 * D.7's gate must see every way a control becomes cosmetic: a later migration
 * that redefines an enforcing function without its guard, a freeze hold the
 * UI would list that nothing enforces, a surface declaring an unregistered
 * control, a proof deleted, a copy key missing in one locale, and a payment
 * SDK that would make "no bank or card behind it" untrue.
 */

test('the live repository agrees', () => {
  assert.deepEqual(checkControls(liveInputs()), []);
});

test('finds the latest definition, never a REVOKE or a trigger', () => {
  const migrations = [
    { name: '0001_a.sql', sql: "CREATE OR REPLACE FUNCTION public.f(x int) RETURNS int LANGUAGE sql AS $$ SELECT guard $$;\nREVOKE ALL ON FUNCTION public.f(int) FROM PUBLIC;" },
    { name: '0002_b.sql', sql: "CREATE TRIGGER t BEFORE INSERT ON x FOR EACH ROW EXECUTE FUNCTION public.f();" },
  ];
  assert.deepEqual(latestFunctionBody(migrations, 'f'), { name: '0001_a.sql', body: ' SELECT guard ' });
  migrations.push({ name: '0003_c.sql', sql: 'CREATE FUNCTION public.f(x int) RETURNS int LANGUAGE plpgsql AS $body$ BEGIN RETURN 1; END $body$;' });
  assert.equal(latestFunctionBody(migrations, 'f').name, '0003_c.sql');
  assert.equal(latestFunctionBody(migrations, 'g'), null);
});

test('reads holds and declared controls', () => {
  assert.deepEqual(holdsIn("export const FREEZE_HOLDS = ['rewards', 'share'] as const;"), ['rewards', 'share']);
  assert.deepEqual(declaredControls('<div data-control="freeze" /><li data-control={`freeze.${hold}`} />'), ['freeze', 'freeze.*']);
});

const mutate = (change) => {
  const live = liveInputs();
  return checkControls({ ...live, ...change(live) });
};

test('catches a later migration that drops the freeze guard from an enforcing function', () => {
  const failures = mutate((live) => ({
    migrations: [...live.migrations, { name: '9999_regression.sql', sql: 'CREATE OR REPLACE FUNCTION public.run_due_scheduled_credits(p_kid_user_id uuid) RETURNS int LANGUAGE plpgsql AS $$ BEGIN RETURN 0; END; $$;' }],
  }));
  assert.ok(failures.some((f) => f.includes('run_due_scheduled_credits (9999_regression.sql) no longer contains')), failures.join('\n'));
});

test('catches a freeze hold that nothing enforces', () => {
  const failures = mutate((live) => ({
    readFile: (path) => path.endsWith('moneyPresentation.ts')
      ? live.readFile(path).replace("['rewards', 'splits', 'credits', 'share'] as const", "['rewards', 'splits', 'credits', 'share', 'withdrawals'] as const")
      : live.readFile(path),
  }));
  assert.ok(failures.some((f) => f.includes('FREEZE_HOLDS is rewards,splits,credits,share,withdrawals')), failures.join('\n'));
});

test('catches a surface declaring a control the registry does not know', () => {
  const failures = mutate((live) => ({ rebuiltSources: [...live.rebuiltSources, ['frontend/src/rebuild/banking/Fake.tsx', '<p data-control="insured">Insured</p>']] }));
  assert.deepEqual(failures, ['frontend/src/rebuild/banking/Fake.tsx: data-control="insured" is not in docs/operations/block-d-controls.json']);
});

test('catches a deleted proof', () => {
  const failures = mutate((live) => ({
    readFile: (path) => path.endsWith('verify-freeze-postgres.py') ? '' : live.readFile(path),
  }));
  assert.ok(failures.some((f) => f.startsWith('freeze: database/scripts/verify-freeze-postgres.py no longer contains')), failures.join('\n'));
});

test('catches a claim\'s copy missing in one locale', () => {
  const failures = mutate((live) => ({
    locales: (locale, ns) => (locale === 'es-MX' && ns === 'coinAccount' ? { ...live.locales(locale, ns), tutor: {} } : live.locales(locale, ns)),
  }));
  assert.ok(failures.includes('freeze: copy coinAccount:tutor.whileFrozen is missing in es-MX'), failures.join('\n'));
});

test('catches a payment or bank-linking SDK', () => {
  const failures = mutate((live) => ({ packages: [...live.packages, ['backend/package.json', { dependencies: { stripe: '^1.0.0' } }]] }));
  assert.deepEqual(failures, ['backend/package.json: depends on stripe, a payment or bank-linking SDK; the simulation claim would no longer be true']);
});

test('catches a retired claim coming back in any string of its namespace (S07.8)', () => {
  const failures = mutate((live) => ({
    locales: (locale, ns) => (locale === 'pt-BR' && ns === 'marketing'
      ? { ...live.locales(locale, ns), extra: { note: 'Gastar precisa da sua aprovação antes, sempre.' } }
      : live.locales(locale, ns)),
  }));
  assert.equal(failures.length, 1, failures.join('\n'));
  assert.match(failures[0], /^marketing:extra\.note \(pt-BR\) says "gastar precisa da sua aprovação antes"/);
});

test('flattens copy to dotted keys', () => {
  assert.deepEqual(flatStrings({ a: { b: 'x', c: ['y'] }, d: 1 }), [['a.b', 'x'], ['a.c.0', 'y']]);
});
