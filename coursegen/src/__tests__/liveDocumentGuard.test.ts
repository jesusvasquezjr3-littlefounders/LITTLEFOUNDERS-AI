import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/*
 * G.2 (owner queue F-09, option a): Vault refuses an in-place rewrite of a
 * published lesson's document by any API role, allowing only Echo's narration
 * stamp. These static pins keep the three places that must agree in step:
 * the migration's guard, the one key it allowlists, and the key Echo
 * (audiogen) actually stamps. The behaviour itself is proven on real
 * PostgreSQL by database/scripts/verify-data-platform-postgres.py.
 */

const root = fileURLToPath(new URL('../../../', import.meta.url));
const read = (path: string) => readFileSync(join(root, path), 'utf8').split('\r\n').join('\n');
const migrationName = readdirSync(join(root, 'database/migrations')).find((f) => f.endsWith('_live_lesson_document_guard.sql'));

describe('the live lesson document guard (G.2)', () => {
  const sql = migrationName ? read(`database/migrations/${migrationName}`) : '';

  it('exists, and guards updates and deletes of lesson_documents', () => {
    expect(migrationName).toBeDefined();
    expect(sql).toMatch(/CREATE TRIGGER lesson_documents_live_guard\s+BEFORE UPDATE OR DELETE ON public\.lesson_documents/);
  });

  it('refuses the API roles on a published lesson, and only logs the database owner', () => {
    expect(sql).toContain("current_user IN ('anon', 'authenticated', 'service_role')");
    expect(sql).toContain("l.status = 'published'");
    expect(sql).toMatch(/ERRCODE = '42501'/);
    expect(sql).toContain("'content.live_document_patched'");
  });

  it('allowlists exactly the narration stamp Echo writes', () => {
    const allowlisted = [...sql.matchAll(/e\.value - '([a-z_]+)'/g)].map((m) => m[1]);
    expect(allowlisted).toEqual(['audio_segment_id']);
    const echo = read('audiogen/src/service/lessonAudio.ts');
    const stamped = [...echo.matchAll(/segment\.([a-z_]+) = /g)].map((m) => m[1]);
    expect(stamped).toEqual(['audio_segment_id']);
  });

  it('images:backfill asks for each lesson status and never writes a published one', () => {
    const backfill = read('coursegen/src/scripts/backfill-images.ts');
    expect(backfill).toContain('&status=in.(published,review)&select=id,slug,status');
    expect(backfill).toContain("r.lessonStatus !== 'published'");
  });
});
