import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Rule 8 (OD-40): no user-visible text lives in code. Every word a user can read is in the three locale files, so a
 * word that needs changing is changed once, in three languages, and never shipped in one. This looks for text written
 * between JSX tags in the Wallet surfaces; a tag whose content is an expression ({copy.x}) is the only form allowed.
 */

const rebuild = resolve(__dirname, '..');
const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true })
  .flatMap((entry) => (entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]));

const AREAS = ['banking', 'wallet'];
const FILES = ['family/SavingsGoals.tsx', 'family/WalletActivity.tsx', 'family/GoalProgress.tsx', 'family/PocketMark.tsx', 'family/ShareGiving.tsx', 'family/SplitChooser.tsx'];

const surfaces = [
  ...AREAS.flatMap((area) => walk(join(rebuild, area))),
  ...FILES.map((file) => join(rebuild, file)),
].filter((file) => file.endsWith('.tsx') && !/\.test\.tsx$/.test(file));

/** Text between a closing `>` and the next `<`, on one line, with real letters in it: a JSX text node. */
const TEXT_NODE = />([^<>{}\n]*[A-Za-zÀ-ÿ]{3,}[^<>{}\n]*)<\//g;

describe('no user-visible text in code (rule 8)', () => {
  it('has surfaces to check', () => {
    expect(surfaces.length).toBeGreaterThan(15);
  });

  it('would catch a word written between tags, and lets an expression through', () => {
    expect('<span>Delivered by hand</span>'.match(TEXT_NODE)).not.toBeNull();
    expect('<span>{copy.title}</span>'.match(TEXT_NODE)).toBeNull();
  });

  it('writes no words between JSX tags in the Wallet surfaces', () => {
    const offences: string[] = [];
    for (const file of surfaces) {
      const code = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      for (const match of code.matchAll(TEXT_NODE)) {
        // A TypeScript generic or an arrow body is not text: it has no spaces around words and no sentence.
        if (/^[A-Za-z0-9_$.,'"|&\s[\]()=;:?!-]*$/.test(match[1]!) && !/\s/.test(match[1]!.trim())) continue;
        offences.push(`${file.slice(file.lastIndexOf('rebuild'))}: ${match[1]!.trim().slice(0, 60)}`);
      }
    }
    expect(offences).toEqual([]);
  });
});
