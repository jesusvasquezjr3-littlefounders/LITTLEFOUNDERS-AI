// Test env — config.ts validates at first getConfig() call. Each test file
// gets its own isolated module registry (Vitest default), so this runs
// once per file and gives every file a private FILEBASE_ROOT temp dir.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll } from 'vitest';

process.env.NODE_ENV ??= 'test';
process.env.INTERNAL_API_KEY ??= 'test-internal-key-0123456789';

const dir = mkdtempSync(join(tmpdir(), 'filebase-test-'));
process.env.FILEBASE_ROOT = dir;

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});
