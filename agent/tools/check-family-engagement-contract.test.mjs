import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkContract, consoleKeys, coreKeys, functionKeys, liveInputs } from './check-family-engagement-contract.mjs';
import { latestFunctionBody } from './check-no-unbacked-guarantee.mjs';

/*
 * D.6 happened because one copy of the insight's keys changed and the others
 * did not. The gate must see a change in any one of the four copies.
 */

const live = liveInputs();

test('the live repository agrees, and every copy is really read', () => {
  assert.deepEqual(checkContract(live), []);
  const body = latestFunctionBody(live.migrations, 'family_engagement_insight').body;
  assert.deepEqual(functionKeys(body).child, ['first_link_on', 'guardians', 'last_task_on', 'tasks_approved', 'tasks_created']);
  assert.ok(functionKeys(body).summary.includes('listed_children'));
  assert.deepEqual(coreKeys(live.readFile('backend/src/services/insights.ts')).child, functionKeys(body).child);
  assert.deepEqual(consoleKeys(live.readFile('frontend/src/rebuild/staff/console/intelApi.ts')).summary, functionKeys(body).summary);
});

test('catches the original defect: the console still on the per-family shape', () => {
  const readFile = (path) => path.endsWith('intelApi.ts')
    ? live.readFile(path).replace('  guardians: number;\n  tasks_created: number;\n  tasks_approved: number;\n  first_link_on: string;', '  family_id: string;\n  members: number;\n  tasks_created: number;\n  tasks_completed: number;')
    : live.readFile(path);
  const failures = checkContract({ ...live, readFile });
  assert.ok(failures.some((f) => f.startsWith('child keys differ') && f.includes('family_id')), failures.join('\n'));
});

test('catches a Core parser that drops a key', () => {
  const readFile = (path) => path.endsWith('insights.ts') ? live.readFile(path).replace("'active_days', 'listed_children'] as const", "'active_days'] as const") : live.readFile(path);
  const failures = checkContract({ ...live, readFile });
  assert.ok(failures.some((f) => f.startsWith('summary keys differ')), failures.join('\n'));
});

test('catches a later migration that renames a key without the probe', () => {
  const insight = latestFunctionBody(live.migrations, 'family_engagement_insight');
  const redefined = `CREATE OR REPLACE FUNCTION public.family_engagement_insight(p_limit int DEFAULT 100, p_active_days int DEFAULT 30) RETURNS jsonb LANGUAGE plpgsql AS $$${insight.body.replace("'tasks_approved', r.tasks_approved", "'tasks_completed', r.tasks_approved")}$$;`;
  const failures = checkContract({ ...live, migrations: [...live.migrations, { name: '9999_rename.sql', sql: redefined }] });
  assert.ok(failures.some((f) => f.includes('tasks_completed')), failures.join('\n'));
});
