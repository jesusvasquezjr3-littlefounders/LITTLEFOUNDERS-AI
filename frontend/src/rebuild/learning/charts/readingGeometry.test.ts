import { describe, expect, it } from 'vitest';
import { axisShare, bandwidth, densities, densityAt, heatShade, lineEnds, lorenzPoints, markerPath, niceTicks, scaleLinear, timelineLayout } from './readingGeometry';

/* Horizonte F1.0: the pure geometry of the reading charts. */

describe('reading chart geometry', () => {
  it('maps a domain onto a range, and a flat domain onto the middle', () => {
    const x = scaleLinear([0, 10], [20, 120]);
    expect(x(0)).toBe(20);
    expect(x(5)).toBe(70);
    expect(x(10)).toBe(120);
    expect(scaleLinear([4, 4], [0, 100])(4)).toBe(50);
  });

  it('picks round ticks inside the domain', () => {
    expect(niceTicks([0, 100])).toEqual([0, 50, 100]);
    expect(niceTicks([0, 10], 5)).toEqual([0, 5, 10]);
    expect(niceTicks([100, 166])).toEqual([100, 120, 140, 160]);
    expect(niceTicks([0, 1], 4)).toEqual([0, 0.5, 1]);
    expect(niceTicks([-3, 7])).toEqual([0, 5]);
    expect(niceTicks([5, 5])).toEqual([5]);
    expect(niceTicks([Number.NEGATIVE_INFINITY, 1])).toHaveLength(1);
    for (const ticks of [niceTicks([0, 0.3]), niceTicks([0, 1234]), niceTicks([-0.5, 0.5])]) expect(ticks.length).toBeLessThan(10);
  });

  it('estimates a density that sums to one and peaks where the values gather', () => {
    const sample = [1, 2, 2, 3, 3, 3, 4, 4, 5, 9];
    const width = bandwidth(sample);
    expect(width).toBeGreaterThan(0);
    const steps = Array.from({ length: 401 }, (_, i) => -10 + i * 0.1);
    const area = densityAt(sample, width, steps).reduce((sum, value) => sum + value * 0.1, 0);
    expect(area).toBeCloseTo(1, 2);
    const [near, far] = densityAt(sample, width, [3, 20]);
    expect(near!).toBeGreaterThan(far!);
    expect(bandwidth([5])).toBe(1);
    expect(bandwidth([4, 4, 4, 4])).toBeGreaterThan(0);
  });

  it('shares one stretch of axis between groups so their heights compare', () => {
    const result = densities([[1, 2, 3, 4, 5], [6, 7, 8, 9, 10]], 32);
    expect(result.positions).toHaveLength(32);
    expect(result.curves).toHaveLength(2);
    expect(result.domain[0]).toBeLessThan(1);
    expect(result.domain[1]).toBeGreaterThan(10);
    expect(result.peak).toBe(Math.max(...result.curves.flat()));
    expect(result.curves.every((curve) => curve.length === 32 && curve.every(Number.isFinite))).toBe(true);
  });

  it('lays a timeline out in order, keeps labels inside the drawing and off each other', () => {
    const marks = timelineLayout([{ start: 0 }, { start: 3 }, { start: 6, end: 40 }, { start: 100 }], 10, 300, 60, [0, 320]);
    expect(marks[0]!.x0).toBe(10);
    expect(marks[3]!.x1).toBe(310);
    expect(marks[2]!.x1).toBeGreaterThan(marks[2]!.x0);
    expect(marks[2]!.centre).toBeCloseTo((marks[2]!.x0 + marks[2]!.x1) / 2);
    for (const mark of marks) {
      expect(mark.labelX - 30).toBeGreaterThanOrEqual(0);
      expect(mark.labelX + 30).toBeLessThanOrEqual(320);
    }
    expect(marks[0]!.row).not.toBe(marks[1]!.row);
    const spread = timelineLayout([{ start: 0 }, { start: 50 }, { start: 100 }], 10, 300, 40, [0, 320]);
    expect(new Set(spread.map((mark) => mark.row)).size).toBe(1);
  });

  it('shades a heat cell from a visible floor to full ink', () => {
    expect(heatShade(0, [0, 10])).toBeCloseTo(0.14);
    expect(heatShade(10, [0, 10])).toBeCloseTo(1);
    expect(heatShade(5, [0, 10])).toBeCloseTo(0.57);
    expect(heatShade(99, [0, 10])).toBeCloseTo(1);
    expect(heatShade(-4, [0, 10])).toBeCloseTo(0.14);
    expect(heatShade(3, [3, 3])).toBeCloseTo(1);
  });

  it('places a value along a parallel axis, a flat axis in the middle', () => {
    expect(axisShare(4, [4, 10])).toBe(0);
    expect(axisShare(10, [4, 10])).toBe(1);
    expect(axisShare(7, [4, 10])).toBe(0.5);
    expect(axisShare(3, [3, 3])).toBe(0.5);
  });

  it('starts the Lorenz curve at the origin and ends the fitted line where asked', () => {
    expect(lorenzPoints([0.5, 1], [0.2, 1])).toEqual([{ x: 0, y: 0 }, { x: 0.5, y: 0.2 }, { x: 1, y: 1 }]);
    expect(lineEnds({ slope: 2, intercept: 1 }, [0, 5])).toEqual([{ x: 0, y: 1 }, { x: 5, y: 11 }]);
  });

  it('draws three different marker shapes for the second channel', () => {
    const paths = [0, 1, 2].map((shape) => markerPath(shape, 10, 10, 4));
    expect(new Set(paths).size).toBe(3);
    expect(markerPath(3, 10, 10, 4)).toBe(paths[0]);
    expect(paths[0]).toContain('a 4 4');
    expect(paths[1]!.split('L')).toHaveLength(4);
    expect(paths[2]!.split('L')).toHaveLength(3);
  });
});
