import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * S07.4 (D.16) release gate: Appendix H's "Goal-Progress Bonus-Distinction
 * Compliance Rate" must be 100% on every release. No goal-progress display in
 * the app may show one mixed number: each one renders <GoalProgress>, which
 * draws the child's own coins, bonus coins and Tutor coins as separate named
 * segments from the server's provenance. This gate fails when any app or
 * rebuilt family/wallet source draws a goal's progress itself (a progress
 * bar, an aria-valuenow, a saved/target ratio or a "saved of target" line),
 * and when a known goal surface stops using <GoalProgress>. The browser
 * matrix (scripts/verify-money-habits.mjs) checks the rendered pages too.
 * Teaching visuals inside lessons (rebuild/learning, lesson-engine) draw
 * pretend goals, not a child's savings, and are out of scope.
 */

const SRC = join(process.cwd(), 'src');
const SCOPES = ['routes/app', 'rebuild/family', 'rebuild/wallet'].map((dir) => join(SRC, dir));

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const GOAL = /\bgoals?\b|Goal\b|goal\./;
const SELF_DRAWN = /role="progressbar"|<ProgressBar\b|<progress\b|aria-valuenow/;
const RATIO = /\bsaved\s*\/\s*[\w.()]*target|\$\{[\w.]*saved\}\s*\/|\{[\w.]*saved\}\s*\/\s*\{|goalSaved|goals\.progress\b/;

describe('D.16 goal-progress distinction gate', () => {
  const files = SCOPES.flatMap(sources);

  it('finds the app and rebuilt sources to audit', () => {
    expect(files.length).toBeGreaterThan(40);
  });

  it('draws no goal progress outside <GoalProgress>', () => {
    const violations: string[] = [];
    for (const file of files) {
      if (file.endsWith('GoalProgress.tsx')) continue;
      readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
        if ((SELF_DRAWN.test(line) && GOAL.test(line)) || RATIO.test(line)) violations.push(`${relative(SRC, file)}:${index + 1}: ${line.trim()}`);
      });
    }
    expect(violations).toEqual([]);
  });

  it('keeps every known goal surface on <GoalProgress>', () => {
    for (const surface of ['rebuild/family/SavingsGoals.tsx', 'rebuild/family/WalletCorrections.tsx', 'rebuild/wallet/TeenWallet.tsx']) {
      expect(readFileSync(join(SRC, surface), 'utf8'), surface).toMatch(/<GoalProgress\b[^>]*progress=\{goal\.progress\}/);
    }
  });

  it('would catch the pre-S07.4 legacy bar (known-bad fixture)', () => {
    const legacy = "<ProgressBar value={(goal.saved / goal.target) * 100} label={goal.title} tone=\"primary\" />";
    expect(SELF_DRAWN.test(legacy) && GOAL.test(legacy)).toBe(true);
    expect(RATIO.test('<span>{`${goal.saved} / ${goal.target}`}</span>')).toBe(true);
    expect(RATIO.test("copy.goalSaved.replace('{saved}', String(goal.saved))")).toBe(true);
  });
});
