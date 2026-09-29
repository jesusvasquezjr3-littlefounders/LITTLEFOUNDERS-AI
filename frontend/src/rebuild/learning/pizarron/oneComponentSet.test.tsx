import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import * as pizarron from './index';
import {
  AdditionDotsVisual, AllocationWaffleVisual, BalanceMeterVisual, BaseTenVisual, GrowthCompareVisual, NumberAxisVisual, PIZARRON_VISUALS,
  StackedSlicesVisual, WorkedStepsList,
} from './index';

/*
 * Product B.7 ("unified with the AI Mentor's whiteboard … one component set")
 * and Frontend Bible 05 §2 / §8 ("a check that no reserved hue encodes a data
 * series"). Every lesson board and the Mentor's board draw their pictures
 * from the shared Pizarrón library; no board carries its own chart markup.
 */
const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const read = (path: string) => readFileSync(here(path), 'utf8');
const learningDir = here('../');
const boardFiles = [...readdirSync(learningDir).filter((name) => /Board\.tsx$/.test(name) && !name.startsWith('TeachingChart')),
  // GAP-FIX-R4: the family, build and concept boards and the operation primitives are held to the same rule.
  'familyBoards.tsx', 'buildBoards.tsx', 'conceptBoards.tsx', 'operations/operations.tsx'];

describe('one component set for lessons and the Mentor (B.7)', () => {
  it('finds the lesson boards it audits', () => {
    expect(boardFiles.length).toBeGreaterThanOrEqual(15);
  });

  it.each([...boardFiles.map((name) => `../${name}`), '../../mentor/screen/MentorBoard.tsx'])('%s draws no picture of its own', (file) => {
    const source = read(file);
    expect(source, `${file} draws an inline <svg>; move the picture into learning/pizarron`).not.toMatch(/<svg\b/);
    expect(source, `${file} declares its own chart image; use a shared Pizarrón visual`).not.toMatch(/role="img"/);
  });

  it('exports every visual it names', () => {
    const exported = pizarron as unknown as Record<string, unknown>;
    for (const name of PIZARRON_VISUALS) expect(typeof exported[name], name).toBe('function');
    expect(new Set(PIZARRON_VISUALS).size).toBe(PIZARRON_VISUALS.length);
  });
});

/** Innermost CSS rules as [selector, body] pairs, comments removed. */
function rules(css: string): Array<[string, string]> {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1]!.trim(), m[2]!]);
}

const MARK = /lf-(pz-|tax-(slice|swatch)|percent-(cell|bar)|place-value-(rod|ones)|growth-(line|point|axis)|growth-compare-(simple|compound|axis|prediction|legend)|goal-(track|band|fill|target)|ledger-(zero|bar|point)|learning-(waffle-cell|pattern|legend-|donut|chart-track)|cpa-dots|number-line-(track|tick|marker)|fraction-cell)/;
const STYLESHEETS = ['./pizarron.css', '../learning.css', '../taxBracket.css', '../percentGrid.css', '../placeValue.css', '../growth.css',
  '../growthComparison.css', '../goalBullet.css', '../runningLedger.css', '../numberLine.css', '../savingsRule.css'];

describe('board marks keep the reserved hues out of the data (05 §2, §8)', () => {
  const markRules = STYLESHEETS.flatMap((file) => rules(read(file)).filter(([selector]) => MARK.test(selector)).map(([selector, body]) => ({ file, selector, body })));

  it('audits the mark rules of every board stylesheet', () => {
    expect(markRules.length).toBeGreaterThan(40);
  });

  it('never paints a mark with accent, warning, error or success', () => {
    const offenders = markRules.filter(({ body }) => /var\(--(accent|warning|error|success)\b/.test(body));
    expect(offenders.map(({ file, selector }) => `${file}: ${selector}`)).toEqual([]);
  });

  it('uses reward only for coins, and primary only for the one mark a learner or the board selects', () => {
    const reward = markRules.filter(({ selector, body }) => /var\(--reward\b/.test(body) && !/coin/.test(selector));
    const primary = markRules.filter(({ selector, body }) => /var\(--primary\b|var\(--primary-/.test(body) && !/marked|selected|prediction|marker/.test(selector));
    expect(reward.map(({ file, selector }) => `${file}: ${selector}`)).toEqual([]);
    expect(primary.map(({ file, selector }) => `${file}: ${selector}`)).toEqual([]);
  });

  it('gives every mint and berry mark painted on the strong hue its pattern channel', () => {
    const strong = markRules.filter(({ body }) => /(background|background-color)\s*:\s*var\(--(mint|berry)-strong\)/.test(body));
    // The waffle's save rows are the wallet's first meaning (mint save), solid by the money-manipulable rule.
    const unpatterned = strong.filter(({ selector, body }) => !/background-image|repeating-linear-gradient|radial-gradient/.test(body)
      && !/waffle-cell--save/.test(selector));
    expect(unpatterned.map(({ file, selector }) => `${file}: ${selector}`)).toEqual([]);
  });
});

describe('lesson pictures', () => {
  it('draws a fourth bracket in the neutral overflow, and every slice after the first with its pattern', () => {
    const { container } = render(<StackedSlicesVisual label="Brackets" slices={[
      { id: 'a', amount: 10, keyText: '10%' }, { id: 'b', amount: 20, keyText: '20%' },
      { id: 'c', amount: 30, keyText: '30%' }, { id: 'd', amount: 40, keyText: '40%' },
    ]} />);
    const slices = [...container.querySelectorAll('rect.lf-tax-slice')];
    expect(slices.map((slice) => slice.getAttribute('class'))).toEqual([
      'lf-tax-slice lf-tax-slice--sky', 'lf-tax-slice lf-tax-slice--mint', 'lf-tax-slice lf-tax-slice--berry', 'lf-tax-slice lf-tax-slice--overflow']);
    expect(slices[0]!.getAttribute('fill')).toBe('var(--sky-strong)');
    expect(slices.slice(1).every((slice) => /^url\(#.+-(mint|berry|overflow)\)$/.test(slice.getAttribute('fill') ?? ''))).toBe(true);
    expect(slices.map((slice) => Number(slice.getAttribute('width')))).toEqual([30, 60, 90, 120]);
    expect([...container.querySelectorAll('.lf-tax-swatch')].map((swatch) => swatch.classList[1])).toEqual(
      ['lf-pz-strong--sky', 'lf-pz-strong--mint', 'lf-pz-strong--berry', 'lf-pz-strong--overflow']);
    expect(container.querySelector('[role="img"]')?.getAttribute('data-pizarron')).toBe('stacked-slices');
  });

  it('shows a balance below zero by position, not by an error hue', () => {
    const { container } = render(<BalanceMeterVisual label="Balance" balance={-4} scale={8} aboveLabel="Above" zeroLabel="Zero" belowLabel="Below" />);
    const bar = container.querySelector('rect.lf-ledger-bar')!;
    expect(Number(bar.getAttribute('y'))).toBe(80);
    expect(Number(bar.getAttribute('height'))).toBe(31);
    expect(Number(container.querySelector('circle.lf-ledger-point')!.getAttribute('cy'))).toBe(111);
  });

  it('draws tens as rods of ten and ones as cubes', () => {
    const { container } = render(<BaseTenVisual label="Place value" tens={2} ones={3} tensText="Tens: 2" onesText="Ones: 3" />);
    expect(container.querySelectorAll('.lf-place-value-rod')).toHaveLength(2);
    expect(container.querySelectorAll('.lf-place-value-rod i')).toHaveLength(20);
    expect(container.querySelectorAll('.lf-place-value-ones i')).toHaveLength(3);
  });

  it('keeps the second growth series hidden until it is revealed', () => {
    const points = [{ year: 0, first: 100, second: 100 }, { year: 5, first: 150, second: 170 }];
    const hidden = render(<GrowthCompareVisual label="Growth" points={points} years={5} axisMaximum={200} showSecond={false} prediction={160} predictionAboveScale={false} maxText="200" />);
    expect(hidden.container.querySelector('.lf-growth-compare-compound')).toBeNull();
    hidden.unmount();
    const shown = render(<GrowthCompareVisual label="Growth" points={points} years={5} axisMaximum={200} showSecond prediction={160} predictionAboveScale={false} maxText="200" />);
    expect(shown.container.querySelector('.lf-growth-compare-compound')).not.toBeNull();
  });

  it('fills waffle rows save, spend, share and then leaves the rest', () => {
    const { container } = render(<AllocationWaffleVisual label="Waffle" keyText="1 row = 1 coin"
      pockets={[{ id: 'save', amount: 2 }, { id: 'spend', amount: 3 }, { id: 'share', amount: 1 }]} />);
    const cells = [...container.querySelectorAll('.lf-learning-waffle-cell')].map((cell) => cell.classList[1]);
    expect(cells).toHaveLength(100);
    expect(cells.filter((c) => c === 'lf-learning-waffle-cell--save')).toHaveLength(20);
    expect(cells.filter((c) => c === 'lf-learning-waffle-cell--spend')).toHaveLength(30);
    expect(cells.filter((c) => c === 'lf-learning-waffle-cell--share')).toHaveLength(10);
    expect(cells.filter((c) => c === 'lf-learning-waffle-cell--left')).toHaveLength(40);
  });

  it('ticks a number axis at the shares it is given', () => {
    const { container } = render(<NumberAxisVisual label="Line" ticks={[0, 0.25, 1]} tall />);
    expect([...container.querySelectorAll('.lf-number-line-tick')].map((tick) => Number(tick.getAttribute('x1')))).toEqual([24, 87, 276]);
  });

  it('draws both addition groups at the concrete and pictorial stages', () => {
    for (const stage of ['concrete', 'pictorial'] as const) {
      const { container, unmount } = render(<AdditionDotsVisual label="3 + 2" left={3} right={2} stage={stage} />);
      expect(container.querySelectorAll('.lf-cpa-dots--left span')).toHaveLength(3);
      expect(container.querySelectorAll('.lf-cpa-dots--right span')).toHaveLength(2);
      unmount();
    }
  });

  it('keeps a field inside the worked-step list reachable (the list is not an image)', () => {
    const { container } = render(<WorkedStepsList steps={[{ id: 'a', marker: '1', expression: '2 + 2', state: 'active', detail: <input aria-label="Result" /> }]} />);
    expect(container.querySelector('[role="img"]')).toBeNull();
    expect(container.querySelector('input[aria-label="Result"]')).not.toBeNull();
    expect(container.querySelector('.lf-worked-example-step--active')).not.toBeNull();
  });
});
