import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LessonDocumentView } from '../../LessonDocumentView';
import { horizonteFixture, horizonteFixtureDocument } from '../previewDocument';
import { GRID_MIN_LINE, GRID_PAD, GRID_VIEW_W, planGrid } from './bayesGrid';

vi.mock('../../../../tutor-scene/quality', () => ({
  getDeviceProbe: () => ({ cores: 8, memoryGb: 8, coarsePointer: false, devicePixelRatio: 1, webgl: 'webgl2', maxTextureSize: 8192, prefersReducedMotion: false }),
  pickInitialTier: () => 'medium',
}));
vi.mock('../../../../tutor-scene/TutorStage', () => ({ TutorStage: () => <div data-testid="tutor-stage" /> }));

const css = readFileSync(resolve(__dirname, 'prob.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const rule = (selector: string): string => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  expect(match, `${selector} must keep a rule in prob.css`).not.toBeNull();
  return match![1]!;
};
const number = (body: string, property: string): number | null => {
  const match = new RegExp(`(?:^|[;\\s])${property}:\\s*([0-9.]+)`).exec(body);
  return match ? Number(match[1]) : null;
};

/** A screening payload scaled to a population every share still divides (multiples of 1000). */
function renderAt(population: number) {
  const raw = horizonteFixtureDocument('prob', 'bayes-screening', 'en-US') as { segments: Array<{ payload: { population: number } }> };
  raw.segments[0]!.payload.population = population;
  return render(<LessonDocumentView raw={raw} locale="en-US" ageBand={horizonteFixture('prob', 'bayes-screening')!.ageBand} onBack={() => {}} onGradeAny={() => ({ verdict: 'review' })} />);
}

describe('Bayes grid keeps its cell outlines at every population', () => {
  it('plans a line spacing a phone can read for every population in the author range', () => {
    for (let population = 100; population <= 10_000; population += 7) {
      const plan = planGrid(population);
      expect(plan.tile, `population ${population}`).toBeGreaterThanOrEqual(GRID_MIN_LINE - 1e-9);
      expect(plan.step).toBeGreaterThanOrEqual(1);
      expect(plan.perSquare).toBe(plan.step * plan.step);
      expect(plan.columns * plan.rows).toBeGreaterThanOrEqual(population);
      expect(plan.columns * plan.cell).toBeCloseTo(GRID_VIEW_W - 2 * GRID_PAD, 6);
      expect(plan.heavy).toBeLessThanOrEqual(5);
      expect(plan.heavy).toBeGreaterThan(0);
    }
    for (const population of [6700, 6701, 9999, 10_000]) expect(planGrid(population).tile).toBeGreaterThanOrEqual(GRID_MIN_LINE - 1e-9);
  });

  it('draws a line around every person while a person is wide enough, and around coarser squares after that', () => {
    expect(planGrid(1000).step).toBe(1);
    expect(planGrid(2000).step).toBe(2);
    expect(planGrid(10_000).step).toBe(3);
    expect(planGrid(10_000).perSquare).toBe(9);
  });

  it.each([1000, 2000, 4000, 7000, 10_000])('draws cell lines over every group at %i people', async (population) => {
    renderAt(population);
    const chart = (await screen.findByRole('img', { name: 'Natural frequencies' })) as unknown as Element;
    const plan = planGrid(population);
    expect(chart.getAttribute('viewBox')).toBe(`0 0 ${GRID_VIEW_W} ${plan.height}`);
    const groups = [...chart.querySelectorAll('.lf-prob-group')];
    expect(groups).toHaveLength(4);
    for (const group of groups) {
      const blocks = group.querySelectorAll('.lf-prob-block');
      const cells = group.querySelectorAll('.lf-prob-cells');
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(cells).toHaveLength(blocks.length);
      for (const layer of cells) {
        const id = /^url\(#(.+)\)$/.exec(layer.getAttribute('fill') ?? '')?.[1];
        expect(id, 'a cell layer must paint a pattern').toBeTruthy();
        const pattern = chart.querySelector(`pattern[id="${id}"]`);
        expect(pattern, 'the pattern must exist').not.toBeNull();
        expect(Number(pattern!.getAttribute('width'))).toBeGreaterThanOrEqual(GRID_MIN_LINE - 1e-9);
        expect(Number(pattern!.getAttribute('height'))).toBeCloseTo(Number(pattern!.getAttribute('width')), 6);
        const lines = pattern!.querySelector('.lf-prob-gridline')?.getAttribute('d') ?? '';
        expect(lines).toMatch(/V/);
        expect(lines).toMatch(/H/);
      }
    }
    const note = document.querySelector('.lf-prob-scale');
    if (plan.perSquare > 1) expect(note).toHaveTextContent(`Each square holds ${plan.perSquare} people`);
    else expect(note).toBeNull();
  });

  it('keeps the outline rules that draw the cells, the blocks and the other boards', () => {
    const stroked = (selector: string, width: string) => {
      const body = rule(selector);
      expect(body, `${selector} stroke`).toMatch(/stroke:\s*var\(--[a-z-]+\)/);
      expect(number(body, width), `${selector} ${width}`).toBeGreaterThan(0);
      const opacity = number(body, 'stroke-opacity');
      if (opacity !== null) expect(opacity, `${selector} stroke-opacity`).toBeGreaterThan(0);
    };
    stroked('.lf-prob-block', 'stroke-width');
    stroked('.lf-prob-gridline', 'stroke-width');
    stroked('.lf-prob-square', 'stroke-width');
    stroked('.lf-prob-frame', 'stroke-width');
    stroked('.lf-prob-edge', 'stroke-width');
    expect(number(rule('.lf-prob-slot'), 'stroke-width')).toBeGreaterThan(0);
    expect(rule('.lf-prob-slot--has')).toMatch(/stroke:\s*var\(--berry-strong\)/);
    expect(rule('.lf-prob-slot--lacks')).toMatch(/stroke:\s*var\(--sky-strong\)/);
  });

  it('never hides the cell layer', () => {
    expect(rule('.lf-prob-cells')).not.toMatch(/display:\s*none|visibility:\s*hidden|opacity:\s*0\b/);
    expect(css).toMatch(/\.lf-prob-group--asked \.lf-prob-block\s*\{[^}]*stroke-width:\s*var\(--lf-prob-heavy/);
  });

  it('colours text and lines with the theme foreground, never the constant ink', () => {
    expect(css).not.toMatch(/var\(--ink\)/);
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|\b(?:white|black)\b/);
    expect(rule('.lf-prob-chart')).toMatch(/color:\s*var\(--content\)/);
  });
});
