import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkAccountDeletion } from './check-account-deletion.mjs';

/*
 * The E.6 guardrail must pass on the real tree and fail on each regression it
 * exists to catch — a checker nobody has seen fail is not a checker.
 */

const repo = fileURLToPath(new URL('../../', import.meta.url));
const FILES = [
  'backend/src/app.ts',
  'backend/src/routes/account.ts',
  'backend/src/routes/family.ts',
  'backend/src/services/accountDeletion.ts',
  'backend/src/services/guardianLifecycle.ts',
  'backend/src/services/gotrue.ts',
  'oracle/src/app.ts',
  'oracle/src/routes/erasure.ts',
  'dataintel/src/routes/queries.ts',
  'docs/rebuild/policies/ACCOUNT-DELETION.md',
  'frontend/src/i18n/en-US/marketing.json',
  'frontend/src/i18n/es-MX/marketing.json',
  'frontend/src/i18n/pt-BR/marketing.json',
  '.github/workflows/account-deletion.yml',
];

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'lf-deletion-'));
  for (const file of FILES) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    cpSync(resolve(repo, file), join(root, file));
  }
  cpSync(resolve(repo, 'database/migrations'), join(root, 'database/migrations'), { recursive: true });
  return root;
}

function edit(root, file, from, to) {
  const path = join(root, file);
  const source = readFileSync(path, 'utf8');
  assert.ok(source.includes(from), `${file} fixture lacks ${from}`);
  writeFileSync(path, source.replace(from, to));
}

function withFixture(mutate, expected) {
  const root = fixture();
  try {
    mutate(root);
    const failures = checkAccountDeletion(root);
    assert.ok(failures.some((f) => expected.test(f)), `expected ${expected} in ${JSON.stringify(failures)}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('the real tree passes', () => {
  assert.deepEqual(checkAccountDeletion(repo), []);
});

test('an unmounted self-service route fails', () => {
  withFixture((root) => edit(root, 'backend/src/app.ts', "app.use('/api/v1/account', accountRouter());", ''), /self-service deletion\) is not mounted/);
});

test('a request without the explicit acknowledgement fails', () => {
  withFixture((root) => edit(root, 'backend/src/routes/account.ts', 'acknowledge: z.literal(true)', 'acknowledge: z.boolean()'), /acknowledge:true/);
});

test('letting a parent-created child delete itself fails', () => {
  withFixture((root) => edit(root, 'backend/src/routes/account.ts', "? fail(res, 403, 'KID_DELETION_BY_TUTOR', 'A child account is deleted by its Tutor')", "? fail(res, 403, 'NOPE', 'x')"), /parent-created child must be refused/);
});

test('a direct GoTrue delete outside the lifecycle fails', () => {
  withFixture((root) => edit(root, 'backend/src/routes/family.ts',
    "const outcome = await eraseNow({ subjectId: kidId, population: 'kid', initiatedBy: 'guardian', actorId: authedUser(res).id });",
    "const removed = await adminDeleteUser(kidId); const outcome = await eraseNow({ subjectId: kidId, population: 'kid', initiatedBy: 'guardian', actorId: authedUser(res).id });"),
  /deletes an account through GoTrue directly/);
});

test('an A.1 purge outside the lifecycle fails', () => {
  withFixture((root) => edit(root, 'backend/src/services/guardianLifecycle.ts', 'const erased = await eraseNow(', 'const erased = await eraseLater('), /90-day purge must use the erasure lifecycle/);
});

test('a dropped erasure step fails', () => {
  withFixture((root) => edit(root, 'backend/src/services/accountDeletion.ts', "type StepName = 'oracle' | 'core' | 'depot' | 'dataintel';", "type StepName = 'oracle' | 'core' | 'depot';"), /erasure steps disagree|dataintel erasure step is missing/);
});

test('an erasure that forgets the Mentor memory ledger fails', () => {
  withFixture((root) => {
    // Named by content, never by number: the orchestrator renumbers migrations at merge.
    const dir = join(root, 'database/migrations');
    for (const name of readdirSync(dir)) {
      const source = readFileSync(join(dir, name), 'utf8');
      if (source.includes('FUNCTION public.erase_account_data')) {
        writeFileSync(join(dir, name), source.replace('DELETE FROM public.learner_memory_ledger', 'SELECT 1 FROM public.learner_memory_ledger'));
      }
    }
  }, /Mentor memory ledger/);
});

test('a policy that disagrees with Core’s grace period fails', () => {
  withFixture((root) => {
    const path = join(root, 'docs/rebuild/policies/ACCOUNT-DELETION.md');
    writeFileSync(path, readFileSync(path, 'utf8').replaceAll('14-day grace period', '30-day grace period'));
  }, /grace period Core enforces/);
});

test('a FAQ that goes back to "contact us" fails', () => {
  withFixture((root) => {
    const path = join(root, 'frontend/src/i18n/en-US/marketing.json');
    const faq = readFileSync(path, 'utf8');
    writeFileSync(path, faq.replace(/("deleteAccount": \{\s*"question": "[^"]*",\s*"answer": ")[^"]*"/, '$1Yes, contact us and we will process it."'));
  }, /en-US\/marketing\.json/);
});

test('an unscheduled sweep fails', () => {
  withFixture((root) => edit(root, '.github/workflows/account-deletion.yml', "  schedule:\n    - cron: '45 3 * * *'", '  push:'), /daily sweep must be scheduled/);
});
