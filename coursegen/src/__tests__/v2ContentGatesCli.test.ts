import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, '../..');

describe('content:gates canonical V2 dispatch', () => {
  it('checks the Financial Education V2 plans and never falls back to the legacy blueprint', () => {
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/contentGates/cli.ts', '--course', 'financial-education', '--no-ui'], {
      cwd: packageRoot,
      encoding: 'utf8',
      timeout: 120_000,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('sources: curriculum-v2/financial-education');
    expect(result.stdout).toContain('plans: 112   documents: 336/336');
    expect(result.stdout).toContain('canonical V2 plans and emitted documents have no blocking finding');
    expect(result.stdout).not.toContain('curriculum/financial-education');
  }, 120_000);
});
