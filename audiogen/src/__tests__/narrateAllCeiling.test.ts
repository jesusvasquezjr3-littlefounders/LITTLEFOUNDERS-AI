// OD-28 (owner review D-03): the real narrate:all entry point refuses a paid
// run without the owner-approved USD ceiling, before any config, Vault or
// provider is touched (no credentials are present at all in this spawn).
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(here, '../..');

function run(args: string[]) {
  return spawnSync(process.execPath, ['--import', 'tsx', 'src/narrateAll.ts', ...args], {
    cwd: PACKAGE_ROOT,
    encoding: 'utf8',
    env: Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !/^(TTS_|SUPABASE_|FILEBASE_|INTERNAL_API_KEY|AUDIOGEN_)/.test(key)),
    ),
    timeout: 120_000,
  });
}

describe('narrate:all owner USD ceiling (OD-28)', () => {
  it.each([[['--course', 'first-lemonade-stand']], [['--max-usd', '0']], [['--max-usd', 'abc']]])(
    'refuses %j and exits 1',
    (args) => {
      const result = run(args);
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/narrate:all: a paid run needs the owner-approved USD ceiling \(--max-usd <n>\)/);
      expect(result.stdout).not.toMatch(/batch narration/);
    },
    150_000,
  );
});
