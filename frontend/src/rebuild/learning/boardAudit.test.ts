import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

/*
 * Bible 05 §8: the teaching-board rules are part of the shared pre-merge audit
 * (scripts/audit-rebuild.mjs, proportion pass), not only of ad-hoc per-widget
 * scripts. This pins the wiring and the pass/fail rules; the measurements run
 * in a real browser (audits/in-page.mjs `boards()`).
 */
const frontend = resolve(__dirname, '../../..');
const read = (path: string) => readFileSync(resolve(frontend, path), 'utf8');
type Finding = [string, string];
type Rules = { boardFindings: (res: unknown) => Finding[]; proportionFindings: (res: unknown, state: unknown, width: number) => Finding[] };
const rules = () => import(/* @vite-ignore */ pathToFileURL(resolve(frontend, 'scripts/audits/rules.mjs')).href) as Promise<Rules>;

const clean = { count: 1, lowContrast: [], svgWords: [], labelOutside: [], reservedSeries: [], dragHit: [], dragNoAlternative: [] };

describe('teaching-board audit rules (Bible 05 §8)', () => {
  it('measures every board in the page and runs in the pre-merge proportion pass', () => {
    const page = read('scripts/audits/in-page.mjs');
    expect(page).toMatch(/function boards\(\)/);
    expect(page).toMatch(/querySelectorAll\('\.lf-learning-board'\)/);
    expect(page).toMatch(/boardMotion/);
    expect(page).toMatch(/textFit, proportion, motion, boards,/);
    expect(read('scripts/audit-rebuild.mjs')).toMatch(/res\.board = await page\.evaluate\('window\.__lfAudit\.boards\(\)'\)/);
  });

  it('passes a clean board and reports each rule by name', async () => {
    const { boardFindings } = await rules();
    expect(boardFindings({ board: clean, boardMotion: [] })).toEqual([]);
    const types = boardFindings({
      board: {
        ...clean, lowContrast: ['number-line line.axis 2.1:1'], svgWords: ['bar "Savings"'], labelOutside: ['grid "12"'],
        reservedSeries: ['chart save uses primary'], dragHit: ['input 40x40'], dragNoAlternative: ['div.handle'],
      },
      boardMotion: ['i.bar lf-celebration-pop'],
    }).map(([type]) => type);
    expect(types).toEqual([
      'board-mark-contrast<3:1', 'board-svg-text-not-numeral', 'board-label-outside-board', 'board-series-reserved-hue',
      'board-draggable-hit<64', 'board-draggable-without-tap-alternative', 'board-animation-outside-allowed',
    ]);
  });

  it('is part of the proportion findings every state already reports', async () => {
    const { proportionFindings } = await rules();
    const res = { spacing: [], font: [], measure: [], uniform: [], h1n: 1, ratio: null, center: null, split: null, sizes: 4, radii: 2, accent: 1,
      rhythm: [], gaps: 0, pairs: [], idle: 0, unbudgeted: [], strayBusy: [], breathing: 0, offList: [], boardMotion: [],
      board: { ...clean, reservedSeries: ['chart save uses accent'] } };
    expect(proportionFindings(res, { budget: 'app' }, 375).map(([type]) => type)).toEqual(['board-series-reserved-hue']);
  });
});
