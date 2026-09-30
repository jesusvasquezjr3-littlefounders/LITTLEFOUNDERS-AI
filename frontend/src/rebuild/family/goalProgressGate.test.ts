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
 *
 * Gap-fix round 8 (D.16; Appendix H 1.3; Real-World Money Practice Standard
 * constraint 5): rebuild/banking is the family Wallet itself (CoinAccount,
 * ChildCoins, TutorCoins, ChildCoinActivity, where goal moves and goal ledger
 * lines already appear), so it is in scope. A self-drawn bar is judged over
 * its whole JSX element, not one line, so a goal bar whose props wrap is still
 * caught. The one reviewed non-goal bar in the Wallet is the Tutor's spending
 * limit (TutorCoins.tsx, `limit.used` of `limit.cap`): it carries no goal word
 * and passes on its own; REVIEWED_BARS pins it so it cannot silently turn into
 * a goal bar.
 */

const SRC = join(process.cwd(), 'src');
const SCOPE_DIRS = ['routes/app', 'rebuild/family', 'rebuild/wallet', 'rebuild/banking'];
const SCOPES = SCOPE_DIRS.map((dir) => join(SRC, dir));

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
const SELF_DRAWN_ALL = new RegExp(SELF_DRAWN.source, 'g');

/** Reviewed non-goal bars: file (relative to src) -> the text each of its bars must carry. */
const REVIEWED_BARS: Record<string, string> = {
  'rebuild/banking/coins/TutorCoins.tsx': 'value={Math.min(limit.used, limit.cap)} max={limit.cap}',
};

/** The JSX element a self-drawn marker sits in: from the marker's line to the element's close (capped), at least the whole line. */
function elementAt(text: string, index: number): string {
  const start = text.lastIndexOf('\n', index) + 1;
  const rest = text.slice(index, index + 800);
  const close = rest.search(/\/>|<\//);
  const lineEnd = text.indexOf('\n', index);
  const end = Math.max(close >= 0 ? index + close : index + rest.length, lineEnd < 0 ? text.length : lineEnd);
  return text.slice(start, end);
}

/** Every goal-progress violation in one source file (path relative to src, `/`-separated). */
function violationsIn(file: string, text: string): string[] {
  if (file.endsWith('GoalProgress.tsx')) return [];
  const out: string[] = [];
  const lineOf = (index: number) => text.slice(0, index).split('\n').length;
  for (const match of text.matchAll(SELF_DRAWN_ALL)) {
    const element = elementAt(text, match.index);
    if (GOAL.test(element)) out.push(`${file}:${lineOf(match.index)}: ${element.split('\n')[0]!.trim()}`);
  }
  text.split('\n').forEach((line, index) => {
    if (RATIO.test(line)) out.push(`${file}:${index + 1}: ${line.trim()}`);
  });
  return [...new Set(out)];
}

const rel = (file: string) => relative(SRC, file).split('\\').join('/');
const read = (file: string) => readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

describe('D.16 goal-progress distinction gate', () => {
  const files = SCOPES.flatMap(sources);

  it('finds the app and rebuilt sources to audit, the Wallet folder included', () => {
    expect(files.length).toBeGreaterThan(40);
    const found = files.map(rel);
    for (const dir of SCOPE_DIRS) expect(found.some((file) => file.startsWith(`${dir}/`)), dir).toBe(true);
    for (const wallet of ['rebuild/banking/CoinAccount.tsx', 'rebuild/banking/coins/ChildCoins.tsx', 'rebuild/banking/coins/TutorCoins.tsx', 'rebuild/banking/coins/ChildCoinActivity.tsx']) {
      expect(found, wallet).toContain(wallet);
    }
  });

  it('draws no goal progress outside <GoalProgress>', () => {
    expect(files.flatMap((file) => violationsIn(rel(file), read(file)))).toEqual([]);
  });

  it('keeps each reviewed non-goal bar what it was reviewed as (the Tutor spending limit)', () => {
    for (const [file, marker] of Object.entries(REVIEWED_BARS)) {
      const text = read(join(SRC, file));
      const bars = [...text.matchAll(SELF_DRAWN_ALL)].map((match) => elementAt(text, match.index));
      expect(bars.length, file).toBeGreaterThan(0);
      for (const bar of bars) {
        expect(bar, file).toContain(marker);
        expect(GOAL.test(bar), file).toBe(false);
      }
    }
  });

  it('fails a goal bar added to the Wallet folder (negative fixtures under rebuild/banking)', () => {
    const oneLine = '      <ProgressBar label={copy.goalLabel} value={goal.saved} max={goal.target} tone="reward" />';
    expect(violationsIn('rebuild/banking/coins/ChildCoins.tsx', oneLine)).toHaveLength(1);
    const wrapped = [
      '      {pocket ? <ProgressBar label={copy.progress} tone="reward"',
      '        value={goal.saved} max={goal.target} valueText={copy.left} /> : null}',
    ].join('\n');
    expect(violationsIn('rebuild/banking/CoinAccount.tsx', wrapped)).toEqual([
      'rebuild/banking/CoinAccount.tsx:1: {pocket ? <ProgressBar label={copy.progress} tone="reward"',
    ]);
    const ratio = '<span>{`${goal.saved} / ${goal.target}`}</span>';
    expect(violationsIn('rebuild/banking/coins/ChildCoinActivity.tsx', ratio)).toHaveLength(1);
    // The limit bar TutorCoins draws today is not a goal bar.
    const limit = '<ProgressBar label={copy.usedLabel} value={Math.min(limit.used, limit.cap)} max={limit.cap} tone="reward"\n  valueText={fill(copy.usedValue, { used: limit.used, cap: limit.cap })} />';
    expect(violationsIn('rebuild/banking/coins/TutorCoins.tsx', limit)).toEqual([]);
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
