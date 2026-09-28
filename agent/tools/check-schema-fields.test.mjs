import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { checkSchemaFields, loadInputs } from './check-schema-fields.mjs';

/*
 * Appendix M 1.4: the retired-field rule passes on the real tree and fails on
 * each way the document type could come back.
 */

const repo = fileURLToPath(new URL('../../', import.meta.url));
const FIELD = [{ table: 'parent_verifications', column: 'document_type', requirement: 'A.5', token: 'document_type' }];
const CREATE = { file: '0004_pv.sql', sql: "CREATE TABLE IF NOT EXISTS public.parent_verifications (\n    id uuid,\n    document_type text NOT NULL DEFAULT 'national-id'\n);" };
const DROP = { file: '0194_drop.sql', sql: 'ALTER TABLE public.parent_verifications\n    DROP COLUMN IF EXISTS document_type;' };
const TYPES = '\n      parent_verifications: {\n        Row: {\n          id: string\n        }\n        Relationships: []';

test('the real tree passes', () => {
  assert.deepEqual(checkSchemaFields(loadInputs(repo)), []);
});

test('a clean fixture passes', () => {
  assert.deepEqual(checkSchemaFields({ migrations: [CREATE, DROP], types: TYPES, sources: [] }, FIELD), []);
});

test('fails when no migration drops the column', () => {
  const failures = checkSchemaFields({ migrations: [CREATE], types: TYPES, sources: [] }, FIELD);
  assert.match(failures.join('\n'), /no migration drops the column/);
});

test('fails when a later migration adds it back', () => {
  const back = { file: '0200_back.sql', sql: 'ALTER TABLE public.parent_verifications ADD COLUMN IF NOT EXISTS document_type text;' };
  assert.match(checkSchemaFields({ migrations: [CREATE, DROP, back], types: TYPES, sources: [] }, FIELD).join('\n'), /0200_back\.sql: brings back/);
});

test('fails when the generated types still declare it', () => {
  const types = TYPES.replace('id: string', 'id: string\n          document_type?: string');
  assert.match(checkSchemaFields({ migrations: [CREATE, DROP], types, sources: [] }, FIELD).join('\n'), /still declares document_type/);
});

test('fails when a service source names it', () => {
  const sources = [{ file: 'backend/src/services/x.ts', text: "body: { document_type: 'national-id' }" }];
  assert.match(checkSchemaFields({ migrations: [CREATE, DROP], types: TYPES, sources }, FIELD).join('\n'), /backend\/src\/services\/x\.ts: names the retired field/);
});
