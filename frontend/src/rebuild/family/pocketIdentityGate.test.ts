import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * GAP-FIX-R4 gate (Frontend Bible 02 §4.3; 07 §1 class B): every pocket shown
 * on the family money, coin account and teen wallet surfaces carries its
 * meaning three ways at once (colour, icon and label). Any element a rebuilt
 * source marks `data-pocket="…"` in rebuild/family, rebuild/banking or
 * rebuild/wallet must contain the pocket's own registered icon: the shared
 * <PocketMark> (or, inside PocketMark itself, the manifest id
 * `pocket.<bucket>.icon`). A swatch or a tint alone fails. Rendered-page
 * checks live in the component tests (PocketSplit, TeenWallet, CoinAccount).
 */

const SRC = join(process.cwd(), 'src', 'rebuild');
const SCOPES = ['family', 'banking', 'wallet'].map((dir) => join(SRC, dir));

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx$/.test(name) && !/\.test\.tsx$/.test(name) ? [path] : [];
  });
}

/** The inner source of the JSX element whose opening tag starts at `start` (same-name nesting counted). */
function elementBody(source: string, start: number, tag: string): string | null {
  const open = source.indexOf('>', start);
  if (open < 0 || source[open - 1] === '/') return null;
  const pattern = new RegExp(`<${tag}[\\s>]|</${tag}>`, 'g');
  pattern.lastIndex = open + 1;
  let depth = 1;
  for (let m = pattern.exec(source); m; m = pattern.exec(source)) {
    depth += m[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return source.slice(open + 1, m.index);
  }
  return null;
}

describe('pocket identity gate (02 §4.3)', () => {
  it('every data-pocket element in the family, banking and wallet sources contains the pocket icon', () => {
    const offenders: string[] = [];
    let seen = 0;
    for (const file of SCOPES.flatMap(sources)) {
      const source = readFileSync(file, 'utf8');
      for (const m of source.matchAll(/<([a-z][a-z0-9]*)\b[^<>]*?\sdata-pocket=/g)) {
        seen++;
        const body = elementBody(source, m.index! + m[0].length, m[1]!);
        if (body === null || !/<PocketMark\b|pocket\.\$\{[^}]+\}\.icon/.test(body)) offenders.push(`${relative(SRC, file)}:${source.slice(0, m.index).split('\n').length}`);
      }
    }
    expect(seen).toBeGreaterThanOrEqual(9);
    expect(offenders).toEqual([]);
  });
});
