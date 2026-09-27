import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkResearch, liveInputs, tableColumns } from './check-block-d-research.mjs';

/*
 * D.9's gate must see a requirement losing its research basis, a citation to
 * a section Appendix G does not have, an overdue recalibration at release, a
 * parent-facing claim of proof in any locale, and an experiment column on a
 * Block D table (OD-23).
 */

const run = (change = () => ({})) => {
  const live = liveInputs();
  return checkResearch({ ...live, ...change(live) });
};

test('the live repository agrees', () => {
  assert.deepEqual(run().failures, []);
});

test('reads a table\'s columns from its CREATE TABLE and later ADD COLUMNs', () => {
  const cols = tableColumns([
    { name: '0001.sql', sql: 'CREATE TABLE IF NOT EXISTS public.tasks (\n    id uuid PRIMARY KEY,\n    title text NOT NULL\n);' },
    { name: '0002.sql', sql: 'ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS kind text, ADD COLUMN child_note text;' },
  ]);
  assert.deepEqual([...cols.get('tasks')].sort(), ['child_note', 'id', 'kind', 'title']);
});

test('catches a requirement with no entry and a citation Appendix G does not have', () => {
  const { failures } = run((live) => {
    const registry = structuredClone(live.registry);
    delete registry.requirements['D.14'];
    registry.requirements['D.15'].sections = ['2.3', '5.1'];
    return { registry };
  });
  assert.ok(failures.includes('D.14: no entry in docs/operations/block-d-research.json'), failures.join('\n'));
  assert.ok(failures.includes('D.15: Appendix G has no section 5.1'), failures.join('\n'));
});

test('catches the written foundation understating or dropping a row', () => {
  const { failures } = run((live) => ({
    readFile: (path) => (path.endsWith('BLOCK-D-RESEARCH-FOUNDATION.md')
      ? live.readFile(path).replace('| D.19 | contested |', '| D.19 | supported |').replace(/^\| D\.22 \|.*$/m, '')
      : live.readFile(path)),
  }));
  assert.ok(failures.includes('docs/operations/BLOCK-D-RESEARCH-FOUNDATION.md: the D.19 row does not state its strength (contested)'), failures.join('\n'));
  assert.ok(failures.includes('docs/operations/BLOCK-D-RESEARCH-FOUNDATION.md has no row for D.22'), failures.join('\n'));
});

test('warns on an overdue recalibration, and fails on it at release', () => {
  const late = run(() => ({ today: '2030-01-01' }));
  assert.deepEqual(late.failures, []);
  assert.equal(late.warnings.length, 1);
  const strict = run(() => ({ today: '2030-01-01', strict: true }));
  assert.ok(strict.failures[0].startsWith('the Appendix G recalibration was due'), strict.failures.join('\n'));
});

test('catches a claim of proof in marketing or app copy, in any locale', () => {
  const { failures } = run((live) => ({
    locales: (locale, ns) => {
      const copy = live.locales(locale, ns);
      if (locale === 'en-US' && ns === 'familyGovernance') return { ...copy, scope: { ...copy.scope, intro: 'Scientifically proven to build better savers.' } };
      if (locale === 'pt-BR' && ns === 'rebuild-site') return { ...copy, extra: 'Estudos comprovam que funciona.' };
      if (locale === 'es-MX' && ns === 'coinAccount') return { ...copy, extra: 'Está comprobado por expertos.' };
      return copy;
    },
  }));
  assert.equal(failures.length, 3, failures.join('\n'));
  assert.ok(failures[0].includes('familyGovernance:scope.intro [en-US] claims proof ("Scientifically")'), failures[0]);
});

test('does not mistake an ordinary word for a claim', () => {
  const { failures } = run((live) => ({
    locales: (locale, ns) => (locale === 'es-MX' && ns === 'rebuild-site' ? { ...live.locales(locale, ns), extra: 'Comunicación que aparente provenir de la empresa.' } : live.locales(locale, ns)),
  }));
  assert.deepEqual(failures, []);
});

test('catches an experiment column on a Block D table (OD-23)', () => {
  const { failures } = run((live) => ({
    migrations: [...live.migrations, { name: '9999_ab.sql', sql: 'ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS experiment_variant text;' }],
  }));
  assert.deepEqual(failures, ['tasks.experiment_variant: an experiment column on a Block D table (OD-23: experiments on adults only; a minor\'s Block D data is observed, never assigned)']);
});
