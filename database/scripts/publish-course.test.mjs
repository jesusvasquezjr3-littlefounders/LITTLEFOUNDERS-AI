import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const bashCandidates = process.platform === 'win32'
  ? [
      join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Git', 'bin', 'bash.exe'),
      join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Git', 'bin', 'bash.exe'),
    ]
  : ['bash'];
const bash = bashCandidates.find((candidate) => candidate === 'bash' || existsSync(candidate));

test('local course publisher never bypasses the verified release function', () => {
  assert.ok(bash, 'Git Bash is required for the local publish boundary test on Windows');
  const result = spawnSync(bash, ['scripts/test-publish-course.sh'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
  assert.match(result.stdout, /publish-course boundary OK/);
});
