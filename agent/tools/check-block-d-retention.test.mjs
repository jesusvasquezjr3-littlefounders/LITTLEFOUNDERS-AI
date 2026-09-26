import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkRetention, liveInputs, liveTables } from './check-block-d-retention.mjs';

/*
 * D.21's gate must see every way the retention policy drifts from what the
 * system does: a new Block D table with no class, a period changed in one
 * place, a table with a period that nothing sweeps, a table the family keeps
 * that gets swept, a missing erasure cascade, a policy or copy that stops
 * stating a period, a nightly job that stops running, and Block D data
 * reaching the Mentor or a third-party analytics module.
 */

test('the live repository agrees', () => {
  assert.deepEqual(checkRetention(liveInputs()), []);
});

test('follows every CREATE, RENAME and DROP in the chain', () => {
  const tables = liveTables([
    { name: '0001.sql', sql: 'create table if not exists public.banca_accounts (\n  kid_user_id uuid references auth.users (id) on delete cascade\n);\ncreate table public.family_members (\n  id uuid\n);' },
    { name: '0002.sql', sql: 'alter table public.banca_accounts rename to banking_accounts;\ndrop table if exists public.family_members;' },
  ]);
  assert.deepEqual([...tables.keys()], ['banking_accounts']);
  assert.match(tables.get('banking_accounts'), /on delete cascade/);
});

const mutate = (change) => {
  const live = liveInputs();
  return checkRetention({ ...live, ...change(live) });
};

test('catches a new Block D table with no retention class', () => {
  const failures = mutate((live) => ({
    migrations: [...live.migrations, { name: '9999_new.sql', sql: 'CREATE TABLE IF NOT EXISTS public.family_diary (\n  id uuid PRIMARY KEY\n);' }],
  }));
  assert.deepEqual(failures, ['family_diary: a Block D table with no retention class in docs/operations/block-d-retention.json']);
});

test('catches a period changed in Core alone', () => {
  const failures = mutate((live) => ({
    readFile: (path) => (path.endsWith('familyRetention.ts') ? live.readFile(path).replace('RETENTION_RECORDS_DAYS = 400;', 'RETENTION_RECORDS_DAYS = 800;') : live.readFile(path)),
  }));
  assert.ok(failures.some((f) => f.includes('RETENTION_RECORDS_DAYS is 800, the registry says 400')), failures.join('\n'));
});

test('catches a period changed in a later migration alone', () => {
  const failures = mutate((live) => ({
    migrations: [...live.migrations, {
      name: '9999_longer.sql',
      sql: "CREATE OR REPLACE FUNCTION public.family_retention_days(p_class text) RETURNS int LANGUAGE sql AS $$ SELECT CASE p_class WHEN 'evidence' THEN 90 WHEN 'records' THEN 400 WHEN 'invites' THEN 30 WHEN 'research' THEN 1100 END; $$;",
    }],
  }));
  assert.deepEqual(failures, ['class evidence: the registry says 30 days, family_retention_days() does not']);
});

test('catches a class of records the sweep stopped deleting, and the coin record being swept', () => {
  const failures = mutate((live) => {
    const registry = structuredClone(live.registry);
    registry.tables.wallet_ledger.class = 'records';
    registry.tables.share_gifts.class = 'account';
    return { registry };
  });
  assert.ok(failures.includes('wallet_ledger: class records but family_retention_sweep() never deletes from it'), failures.join('\n'));
  assert.ok(failures.includes('share_gifts: kept while the account exists, but family_retention_sweep() deletes from it'), failures.join('\n'));
});

test('catches an erasure path that is not in the schema', () => {
  const failures = mutate((live) => {
    const registry = structuredClone(live.registry);
    registry.tables.family_decision_reflections.erasedVia = 'auth.users';
    registry.tables.family_state_audit.personal = true;
    return { registry };
  });
  assert.ok(failures.some((f) => f.startsWith('family_decision_reflections: says an erasure reaches it from auth.users')), failures.join('\n'));
  assert.ok(failures.some((f) => f.startsWith('family_state_audit: no erasure path is allowed only for a table with no personal data')), failures.join('\n'));
});

test('catches the written policy or the copy dropping a period', () => {
  const failures = mutate((live) => ({
    readFile: (path) => (path.endsWith('FAMILY-DATA-RETENTION.md') ? live.readFile(path).replaceAll('1,100 days', 'three years') : live.readFile(path)),
    locales: (locale, ns) => {
      const copy = live.locales(locale, ns);
      return locale === 'pt-BR' && ns === 'familyGovernance' ? { ...copy, dataPolicy: { ...copy.dataPolicy, photos: 'Fotos: por pouco tempo.' } } : copy;
    },
  }));
  assert.ok(failures.includes('docs/operations/FAMILY-DATA-RETENTION.md does not state the research period (1100 days)'), failures.join('\n'));
  assert.ok(failures.includes('familyGovernance.json (pt-BR): dataPolicy.photos must show the served period ({days})'), failures.join('\n'));
});

test('catches a nightly job that stopped', () => {
  const failures = mutate((live) => ({
    readFile: (path) => (path.endsWith('family-retention.yml') ? 'name: disabled\n' : live.readFile(path)),
  }));
  assert.deepEqual(failures, ['.github/workflows/family-retention.yml no longer runs the retention job']);
});

test('catches Block D data reaching the Mentor or third-party analytics', () => {
  const failures = mutate((live) => ({
    readFile: (path) => (path.endsWith('context/schema.ts') ? `${live.readFile(path)}\n    walletBalance: z.number(),\n` : live.readFile(path)),
    surfaceSources: [...live.surfaceSources, ['frontend/src/routes/app/family/Fake.tsx', "import { trackMarketingGoal } from '@/lib/analytics';"]],
  }));
  assert.ok(failures.some((f) => f.includes("a Block D field reaches the Mentor's context")), failures.join('\n'));
  assert.ok(failures.includes('frontend/src/routes/app/family/Fake.tsx: a Family Hub surface imports the third-party analytics module'), failures.join('\n'));
});
