// OD-23: a paid Forge run states the owner-approved USD ceiling; a dry-run needs none.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { spendCeilingRefusal } from '../pipeline/spendGuard.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(here, '../..');

describe('the owner-run spend ceiling (OD-23)', () => {
  it('lets a dry-run through with no ceiling', () => {
    expect(spendCeilingRefusal({ command: 'generate', flag: '--max-usd', dryRun: true, ceilingUsd: undefined })).toBeNull();
  });

  it.each([undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])('refuses a paid run with ceiling %s', (ceilingUsd) => {
    const refusal = spendCeilingRefusal({ command: 'generate:track', flag: '--budget-usd', dryRun: false, ceilingUsd });
    expect(refusal).toMatch(/--budget-usd/);
    expect(refusal).toMatch(/FORGE-OWNER-RUN-GENERATION\.md/);
  });

  it('lets a paid run through only with a positive, finite ceiling', () => {
    expect(spendCeilingRefusal({ command: 'generate', flag: '--max-usd', dryRun: false, ceilingUsd: 5 })).toBeNull();
  });

  // The real entry points, end to end: refused before any config, Vault or provider is touched.
  it.each([
    ['src/cli.ts', ['--course', 'first-lemonade-stand'], /--max-usd/],
    ['src/trackCli.ts', ['--course', 'first-lemonade-stand'], /--budget-usd/],
    // OD-28 (D-03): the paid add-only backfill and a confirmed restyle.
    ['src/scripts/backfill-images.ts', ['--course', 'first-lemonade-stand'], /images:backfill: a paid run needs .*--max-usd/],
    ['src/scripts/backfill-images.ts', ['--course', 'first-lemonade-stand', '--restyle-scenes', '--confirm-spend'], /--max-usd/],
  ])('%s refuses a paid run without a ceiling and exits 1', (entry, args, message) => {
    const result = spawnSync(process.execPath, ['--import', 'tsx', entry, ...args], {
      cwd: PACKAGE_ROOT,
      encoding: 'utf8',
      // No provider or Vault credentials at all: the refusal must come first.
      env: Object.fromEntries(
        Object.entries(process.env).filter(([key]) => !/^(DEEPSEEK_|QWEN_|SUPABASE_|FILEBASE_|PICTUREGEN_)/.test(key)),
      ),
      timeout: 120_000,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(message);
    expect(result.stdout).not.toMatch(/\[forge\] budget for/);
  }, 150_000);
});
