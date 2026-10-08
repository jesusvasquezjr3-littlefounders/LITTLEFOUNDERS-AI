import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, '../..');

describe('content:gates canonical V2 dispatch', () => {
  it('checks an explicit complete replacement instead of falling back to the withdrawn catalog', () => {
    const source = 'curriculum-production/financial-education/complete-source';
    const blueprint = JSON.parse(readFileSync(path.join(packageRoot, source, 'blueprint.json'), 'utf8'));
    const directory = mkdtempSync(path.join(tmpdir(), 'content-gates-source-'));
    try {
      const ids = path.join(directory, 'ids.json');
      writeFileSync(ids, JSON.stringify(Object.fromEntries(blueprint.lessons.map((row: {lesson_id: string}, i: number) => [row.lesson_id, `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`]))));
      const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/contentGates/cli.ts', '--course', 'financial-education', '--blueprint', `${source}/blueprint.json`, '--plans', `${source}/plans`, '--lesson-ids', ids, '--no-ui', '--json', path.join(directory, 'report.json')], {cwd: packageRoot, encoding: 'utf8', timeout: 120_000});
      expect(result.status, result.stderr + result.stdout).toBe(0);
      expect(result.stdout).toContain('plans: 294   documents: 882/882');
      expect(result.stdout).not.toContain('curriculum-v2/financial-education');
      const partial = spawnSync(process.execPath, ['--import', 'tsx', 'src/contentGates/cli.ts', '--course', 'financial-education', '--blueprint', `${source}/blueprint.json`, '--no-ui'], {cwd: packageRoot, encoding: 'utf8', timeout: 120_000});
      expect(partial.status).toBe(2);
      expect(partial.stderr).toContain('requires --course, --blueprint, --plans and --lesson-ids together');
    } finally { rmSync(directory, {recursive: true, force: true}); }
  }, 120_000);
  it('rejects the withdrawn Financial Education V2 corpus and never falls back to the legacy blueprint', () => {
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/contentGates/cli.ts', '--course', 'financial-education', '--no-ui'], {
      cwd: packageRoot,
      encoding: 'utf8',
      timeout: 120_000,
    });
    expect(result.status, result.stderr).toBe(1);
    expect(result.stdout).toContain('sources: curriculum-v2/financial-education');
    expect(result.stdout).toContain('plans: 112');
    expect(result.stdout).toContain('payload.scene [narrative]: 3 sentences (max 2)');
    expect(result.stdout).toContain('content:gates FAILED');
    expect(result.stdout).not.toContain('curriculum/financial-education');
  }, 120_000);
});
