import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

/*
 * `.env.example` MUST PARSE AS-IS.
 *
 * oracle/README.md tells a new contributor to copy this file and run the
 * service. Following that produced EIGHTEEN validation errors and a refusal to
 * start, for two reasons that both look fine to a reader:
 *
 *   1. Three internal keys carried the 10-character value `replace-me` against
 *      `z.string().min(16)`.
 *   2. Every optional key was assigned an EMPTY value. `.optional()` permits
 *      `undefined`, not `''` — an empty assignment is a PRESENT value of length
 *      zero, so it reaches the `.min()` rule and fails it. The fix is to
 *      comment the line out, which is the only way a dotenv file says "unset".
 *
 * A name-by-name parity check between the schema and the example passes
 * happily on both of those, which is exactly why this test parses VALUES
 * instead. The reference file is documentation, and documentation that does
 * not work is worse than none: it costs a newcomer their first hour and
 * teaches them the project does not run.
 */

const EXAMPLE = resolve(import.meta.dirname, '../../.env.example');

/** Minimal dotenv: enough for a file we control, and no dependency. */
function parseDotenv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

describe('oracle/.env.example', () => {
  const original = { ...process.env };

  afterEach(async () => {
    for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key];
    Object.assign(process.env, original);
    const { resetConfigCache } = await import('../env.js');
    resetConfigCache();
  });

  it('boots the service with no edits at all', async () => {
    const vars = parseDotenv(readFileSync(EXAMPLE, 'utf8'));

    // A pristine environment holding ONLY what the example file says, which is
    // what `--env-file=.env.example` on an empty shell actually gives you.
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('ORACLE_') || key.startsWith('INWORLD_') || key.startsWith('MODEL_')) {
        delete process.env[key];
      }
    }
    for (const [key, value] of Object.entries(vars)) process.env[key] = value;

    const { getConfig, resetConfigCache } = await import('../env.js');
    resetConfigCache();

    // The assertion is simply that this does not throw. `getConfig` reports
    // every failing field at once, so a regression names itself.
    expect(() => getConfig()).not.toThrow();
  });

  it('never assigns an empty value to an optional key', async () => {
    /*
     * The shape of the original bug, pinned separately from the boot test
     * because it is the one a human reintroduces: adding a new optional key
     * and writing `NEW_KEY=` to show it exists. That reads as "unset" and is
     * not — comment it out instead.
     */
    const empty = Object.entries(parseDotenv(readFileSync(EXAMPLE, 'utf8')))
      .filter(([, value]) => value === '')
      .map(([key]) => key);

    expect(empty).toEqual([]);
  });

  it('documents every variable the schema knows about', async () => {
    // The other direction: a variable added to env.ts and never written down
    // is invisible to anyone deploying the service.
    const source = readFileSync(resolve(import.meta.dirname, '../env.ts'), 'utf8');
    const declared = [...source.matchAll(/^ {2}([A-Z][A-Z0-9_]+):\s*z\b/gm)].map((m) => m[1]);
    const text = readFileSync(EXAMPLE, 'utf8');

    // Present as an assignment OR as a commented-out one — both document it.
    const missing = declared.filter(
      (key) => !new RegExp(`^#?\\s*${key}=`, 'm').test(text),
    );

    expect(missing).toEqual([]);
    expect(declared.length).toBeGreaterThan(30);
  });
});
