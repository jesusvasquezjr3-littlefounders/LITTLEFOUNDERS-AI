import { describe, expect, it } from 'vitest';
import { chooseRenderMode, type RenderSignals } from './renderMode';
import { foldOf, joined, PAIR_OF } from './netFold';
import type { NetCell } from './net.generated';

const capable: RenderSignals = { webgl: 'webgl2', lowPower: false, saveData: false, reducedMotion: false };
const decide = (request: 'auto' | 'svg' | 'webgl', change: Partial<RenderSignals> = {}) => chooseRenderMode(request, { ...capable, ...change });

describe('solid renderer choice', () => {
  it('uses WebGL only on a capable device that has not asked for less', () => {
    expect(decide('auto')).toBe('webgl');
    expect(decide('auto', { webgl: 'webgl1' })).toBe('webgl');
  });

  it('falls back to the SVG without WebGL, on low power, when saving data, or with reduced motion', () => {
    expect(decide('auto', { webgl: 'none' })).toBe('svg');
    expect(decide('auto', { lowPower: true })).toBe('svg');
    expect(decide('auto', { saveData: true })).toBe('svg');
    expect(decide('auto', { reducedMotion: true })).toBe('svg');
  });

  it('lets a lesson force the SVG, and lets it ask for WebGL only against the soft signals', () => {
    expect(decide('svg')).toBe('svg');
    expect(decide('webgl', { lowPower: true })).toBe('webgl');
    expect(decide('webgl', { saveData: true })).toBe('webgl');
    expect(decide('webgl', { webgl: 'none' })).toBe('svg');
    expect(decide('webgl', { reducedMotion: true })).toBe('svg');
  });
});

const cross: NetCell[] = [[1, 0], [0, 1], [1, 1], [2, 1], [3, 1], [1, 2]];

describe('net folding feedback', () => {
  it('knows when squares touch edge to edge', () => {
    expect(joined([])).toBe(true);
    expect(joined(cross)).toBe(true);
    expect(joined([[0, 0], [1, 0], [3, 0]])).toBe(false);
    expect(joined([[0, 0], [1, 1]])).toBe(false);
  });

  it('reports an empty net as short, apart squares as apart and a collision as overlap', () => {
    expect(foldOf([]).state).toBe('more');
    expect(foldOf([[0, 0], [2, 0]]).state).toBe('join');
    expect(foldOf([[0, 0], [1, 0], [2, 0], [3, 0]]).state).toBe('more');
    expect(foldOf([[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]]).state).toBe('overlap');
    expect(foldOf([[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]]).state).toBe('overlap');
  });

  it('folds a cross into six different faces, opposite squares paired', () => {
    const fold = foldOf(cross);
    expect(fold.state).toBe('ok');
    expect(new Set(fold.faces).size).toBe(6);
    const pairs = fold.faces.map((face) => (face ? PAIR_OF[face] : null));
    expect(pairs[1]).toBe(pairs[3]);
    expect(pairs[0]).toBe(pairs[5]);
    expect(pairs[2]).toBe(pairs[4]);
  });

  it('keeps the faces of a partial net that still folds', () => {
    const fold = foldOf(cross.slice(0, 3));
    expect(fold.state).toBe('more');
    expect(fold.faces.every((face) => face !== null)).toBe(true);
  });
});
