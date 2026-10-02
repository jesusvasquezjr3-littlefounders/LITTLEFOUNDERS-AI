import { describe, expect, it } from 'vitest';
import {
  assignSeries, buildTableRows, clamp, clientToView, COARSE_FACTOR, createFrame, decimalsOf, describePoint, domainProblem, effectiveBounds, formatPlanoValue,
  HANDLE_HIT_PX, interpretKey, linearScale, MAX_LINES, niceStep, niceTicks, pathFromPoints, pathFromRuns, PLANO_VIEWBOX, pointerToValue,
  regionCorners, regionPolygon, resolveKeyStep, resolvePoint, roundTo, sampleCurve, snapToStep, snapWithin, stepFor, ticksAtStep,
  type PlanoDomain, type PlanoMoveConfig,
} from './model';

/*
 * F0.2: the pure model of the Plano primitive. Scale, snapping, keys, ticks, formatting and sampling are decided here
 * and nowhere else, so every board that reuses the plane agrees with the picture and with the table.
 */

const domain: PlanoDomain = { xMin: 0, xMax: 10, yMin: 0, yMax: 10 };

describe('domain and numbers', () => {
  it('accepts a proper domain and names what is wrong with the others', () => {
    expect(domainProblem(domain)).toBeNull();
    expect(domainProblem({ ...domain, xMax: 0 })).toMatch(/xMin/);
    expect(domainProblem({ ...domain, yMax: -1 })).toMatch(/yMin/);
    expect(domainProblem({ ...domain, xMin: Number.NaN })).toMatch(/finite/);
    expect(domainProblem({ ...domain, yMax: Number.POSITIVE_INFINITY })).toMatch(/finite/);
  });

  it('clamps and counts decimals', () => {
    expect(clamp(12, 0, 10)).toBe(10);
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(4, 0, 10)).toBe(4);
    expect(decimalsOf(5)).toBe(0);
    expect(decimalsOf(0.25)).toBe(2);
    expect(decimalsOf(-0.125)).toBe(3);
    expect(decimalsOf(1e-7)).toBe(7);
    expect(decimalsOf(1.5e-7)).toBe(8);
    expect(decimalsOf(0.1 + 0.2)).toBe(8);
    expect(decimalsOf(Number.NaN)).toBe(0);
  });

  it('rounds float noise away and never returns negative zero', () => {
    expect(roundTo(0.1 + 0.2, 2)).toBe(0.3);
    expect(roundTo(2.675, 0)).toBe(3);
    expect(Object.is(roundTo(-0.0001, 2), 0)).toBe(true);
    expect(Object.is(roundTo(-0, 0), 0)).toBe(true);
  });

  it('reads a step as one number or one per axis, and rejects anything unusable', () => {
    expect(stepFor(2, 'x')).toBe(2);
    expect(stepFor({ x: 1, y: 5 }, 'y')).toBe(5);
    expect(stepFor({ x: 1, y: 5 }, 'x')).toBe(1);
    for (const none of [null, undefined, false, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) expect(stepFor(none as never, 'x')).toBeNull();
    expect(stepFor({ x: 0, y: 2 }, 'x')).toBeNull();
  });
});

describe('snapping and clamping', () => {
  it('snaps to the grid anchored at zero without float noise', () => {
    expect(snapToStep(2.4, 0.5)).toBe(2.5);
    expect(snapToStep(-0.26, 0.5)).toBe(-0.5);
    expect(snapToStep(0.3, 0.1)).toBe(0.3);
    expect(snapToStep(7.3, 2)).toBe(8);
    expect(snapToStep(-3, 2)).toBe(-2);
    expect(Object.is(snapToStep(-0.1, 1), 0)).toBe(true);
    expect(snapToStep(4.4, 0)).toBe(4.4);
    expect(snapToStep(Number.NaN, 1)).toBeNaN();
  });

  it('keeps the snapped value inside the range, using the nearest grid value that fits', () => {
    expect(snapWithin(4.2, 2, 0, 10)).toBe(4);
    expect(snapWithin(9.8, 2, 0, 9)).toBe(8);
    expect(snapWithin(1.2, 5, 1, 7)).toBe(5);
    expect(snapWithin(-4, 1, 0, 10)).toBe(0);
    expect(snapWithin(40, 1, 0, 10)).toBe(10);
    expect(snapWithin(3.37, null, 0, 10)).toBe(3.37);
  });

  it('leaves the clamped value alone when no grid value lives in the range', () => {
    expect(snapWithin(1.2, 2, 0.5, 1.5)).toBe(1.2);
    expect(snapWithin(1, 5, 1, 4)).toBe(1);
  });
});

describe('scales and the frame', () => {
  it('maps linearly and inverts for the y axis', () => {
    const x = linearScale(0, 10, 0, 600);
    expect(x.toPx(5)).toBe(300);
    expect(x.toValue(150)).toBe(2.5);
    const y = linearScale(0, 10, 400, 0);
    expect(y.toPx(0)).toBe(400);
    expect(y.toPx(10)).toBe(0);
    expect(y.toValue(100)).toBe(7.5);
  });

  it('builds a frame in viewBox units with y growing downwards, and round-trips', () => {
    const frame = createFrame({ xMin: -5, xMax: 5, yMin: -2, yMax: 2 });
    expect(frame.size).toEqual(PLANO_VIEWBOX);
    expect(frame.toView({ x: 0, y: 0 })).toEqual({ x: 300, y: 200 });
    expect(frame.toView({ x: 5, y: 2 })).toEqual({ x: 600, y: 0 });
    expect(frame.toView({ x: -5, y: -2 })).toEqual({ x: 0, y: 400 });
    expect(frame.toValue({ x: 450, y: 100 })).toEqual({ x: 2.5, y: 1 });
    const point = { x: 1.25, y: -0.5 };
    const back = frame.toValue(frame.toView(point));
    expect(back.x).toBeCloseTo(point.x, 10);
    expect(back.y).toBeCloseTo(point.y, 10);
  });

  it('places overlay marks by percentage and keeps them on the plot', () => {
    const frame = createFrame(domain);
    expect(frame.percent({ x: 0, y: 0 })).toEqual({ left: 0, top: 100 });
    expect(frame.percent({ x: 5, y: 5 })).toEqual({ left: 50, top: 50 });
    expect(frame.percent({ x: 10, y: 10 })).toEqual({ left: 100, top: 0 });
    expect(frame.percent({ x: 99, y: -99 })).toEqual({ left: 100, top: 100 });
  });

  it('refuses a domain with no area, and follows a custom plot size', () => {
    expect(() => createFrame({ ...domain, xMax: 0 })).toThrow(RangeError);
    const wide = createFrame(domain, { width: 1000, height: 100 });
    expect(wide.toView({ x: 10, y: 0 })).toEqual({ x: 1000, y: 100 });
  });

  it('turns a pointer position into viewBox units and domain values, and waits for layout', () => {
    const box = { left: 10, top: 20, width: 300, height: 200 };
    expect(clientToView(box, PLANO_VIEWBOX, 160, 120)).toEqual({ x: 300, y: 200 });
    expect(clientToView({ ...box, width: 0 }, PLANO_VIEWBOX, 160, 120)).toBeNull();
    expect(clientToView({ ...box, height: 0 }, PLANO_VIEWBOX, 160, 120)).toBeNull();
    const frame = createFrame(domain);
    expect(pointerToValue(frame, box, 160, 120)).toEqual({ x: 5, y: 5 });
    expect(pointerToValue(frame, box, 10, 220)).toEqual({ x: 0, y: 0 });
    expect(pointerToValue(frame, { ...box, width: 0 }, 160, 120)).toBeNull();
  });
});

describe('resolving a move', () => {
  it('narrows the domain by a handle\'s own bounds and collapses inverted ones', () => {
    expect(effectiveBounds(domain)).toEqual(domain);
    expect(effectiveBounds(domain, { xMin: 2, yMax: 6 })).toEqual({ xMin: 2, xMax: 10, yMin: 0, yMax: 6 });
    expect(effectiveBounds(domain, { xMin: 3, xMax: 1 })).toEqual({ xMin: 3, xMax: 3, yMin: 0, yMax: 10 });
    expect(effectiveBounds(domain, { xMin: 40, yMin: -9 })).toEqual({ xMin: 10, xMax: 10, yMin: 0, yMax: 10 });
  });

  it('clamps to the domain and snaps to the grid', () => {
    expect(resolvePoint({ x: 3.4, y: 7.6 }, { x: 0, y: 0 }, { domain, snap: 1 })).toEqual({ x: 3, y: 8 });
    expect(resolvePoint({ x: -3, y: 14 }, { x: 5, y: 5 }, { domain, snap: 1 })).toEqual({ x: 0, y: 10 });
    expect(resolvePoint({ x: 1.3, y: 5.1 }, { x: 0, y: 0 }, { domain, snap: { x: 0.5, y: 2 } })).toEqual({ x: 1.5, y: 6 });
    expect(resolvePoint({ x: 1.337, y: 5.1 }, { x: 0, y: 0 }, { domain, snap: false })).toEqual({ x: 1.337, y: 5.1 });
  });

  it('honours the handle bounds and an axis lock', () => {
    expect(resolvePoint({ x: 6, y: 6 }, { x: 1, y: 1 }, { domain, snap: 1, bounds: { xMax: 4 } })).toEqual({ x: 4, y: 6 });
    expect(resolvePoint({ x: 3.4, y: 9 }, { x: 2, y: 5 }, { domain, snap: 1, axis: 'x' })).toEqual({ x: 3, y: 5 });
    expect(resolvePoint({ x: 3.4, y: 9 }, { x: 2, y: 5 }, { domain, snap: 1, axis: 'y' })).toEqual({ x: 2, y: 9 });
    expect(resolvePoint({ x: 3.4, y: 9 }, { x: 2, y: 5 }, { domain, axis: 'both' })).toEqual({ x: 3.4, y: 9 });
  });
});

describe('keyboard steps', () => {
  const config: PlanoMoveConfig = { domain, snap: 1, step: { x: 1, y: 1 } };
  const at = (x: number, y: number) => ({ x, y });

  it('moves one step per arrow and five on Shift', () => {
    expect(interpretKey('ArrowRight', false, at(5, 5), config)).toEqual({ kind: 'move', point: at(6, 5) });
    expect(interpretKey('ArrowLeft', false, at(5, 5), config)).toEqual({ kind: 'move', point: at(4, 5) });
    expect(interpretKey('ArrowUp', false, at(5, 5), config)).toEqual({ kind: 'move', point: at(5, 6) });
    expect(interpretKey('ArrowDown', false, at(5, 5), config)).toEqual({ kind: 'move', point: at(5, 4) });
    expect(COARSE_FACTOR).toBe(5);
    expect(interpretKey('ArrowRight', true, at(2, 2), config)).toEqual({ kind: 'move', point: at(7, 2) });
    expect(interpretKey('ArrowUp', true, at(2, 2), { ...config, coarse: 2 })).toEqual({ kind: 'move', point: at(2, 4) });
  });

  it('stops at the edge and reports the same point there', () => {
    expect(interpretKey('ArrowRight', false, at(10, 5), config)).toEqual({ kind: 'move', point: at(10, 5) });
    expect(interpretKey('ArrowDown', true, at(5, 3), config)).toEqual({ kind: 'move', point: at(5, 0) });
    expect(interpretKey('ArrowRight', false, at(7, 5), { ...config, bounds: { xMax: 7 } })).toEqual({ kind: 'move', point: at(7, 5) });
  });

  it('adds without float noise', () => {
    const fine: PlanoMoveConfig = { domain, step: { x: 0.1, y: 0.1 } };
    expect(interpretKey('ArrowRight', false, at(0.2, 0), fine)).toEqual({ kind: 'move', point: at(0.3, 0) });
    expect(interpretKey('ArrowRight', false, at(0.7, 0), fine)).toEqual({ kind: 'move', point: at(0.8, 0) });
  });

  it('jumps to the limits with Home and End', () => {
    expect(interpretKey('Home', false, at(5, 5), config)).toEqual({ kind: 'move', point: at(0, 5) });
    expect(interpretKey('End', false, at(5, 5), config)).toEqual({ kind: 'move', point: at(10, 5) });
    expect(interpretKey('End', false, at(5, 5), { ...config, bounds: { xMax: 8 } })).toEqual({ kind: 'move', point: at(8, 5) });
    expect(interpretKey('Home', false, at(5, 5), { ...config, axis: 'y' })).toEqual({ kind: 'move', point: at(5, 0) });
    expect(interpretKey('End', false, at(5, 5), { ...config, axis: 'y' })).toEqual({ kind: 'move', point: at(5, 10) });
  });

  it('runs every arrow along the axis of a locked handle', () => {
    expect(interpretKey('ArrowUp', false, at(5, 5), { ...config, axis: 'x' })).toEqual({ kind: 'move', point: at(6, 5) });
    expect(interpretKey('ArrowDown', false, at(5, 5), { ...config, axis: 'x' })).toEqual({ kind: 'move', point: at(4, 5) });
    expect(interpretKey('ArrowRight', false, at(5, 5), { ...config, axis: 'y' })).toEqual({ kind: 'move', point: at(5, 6) });
    expect(interpretKey('ArrowLeft', false, at(5, 5), { ...config, axis: 'y' })).toEqual({ kind: 'move', point: at(5, 4) });
  });

  it('switches handle with Page Up and Page Down and leaves other keys to the browser', () => {
    expect(interpretKey('PageUp', false, at(5, 5), config)).toEqual({ kind: 'switch', direction: -1 });
    expect(interpretKey('PageDown', false, at(5, 5), config)).toEqual({ kind: 'switch', direction: 1 });
    for (const key of ['Tab', 'Enter', ' ', 'a', 'Escape']) expect(interpretKey(key, false, at(5, 5), config)).toBeNull();
  });

  it('picks a fine step that always moves: the caller\'s, the snap grid, or a nice fiftieth of the span', () => {
    const wide: PlanoDomain = { xMin: 0, xMax: 10, yMin: 0, yMax: 100 };
    expect(resolveKeyStep(wide)).toEqual({ x: 0.2, y: 2 });
    expect(resolveKeyStep(wide, 1)).toEqual({ x: 1, y: 1 });
    expect(resolveKeyStep(wide, { x: 1, y: 5 })).toEqual({ x: 1, y: 5 });
    expect(resolveKeyStep(wide, 0.5, 0.2)).toEqual({ x: 0.5, y: 0.5 });
    expect(resolveKeyStep(wide, 2, 4)).toEqual({ x: 4, y: 4 });
    expect(resolveKeyStep(wide, 0.25, 1)).toEqual({ x: 1, y: 1 });
    expect(resolveKeyStep(wide, null, { x: 0.5, y: 10 })).toEqual({ x: 0.5, y: 10 });
  });
});

describe('ticks', () => {
  it('chooses a step of 1, 2 or 5 times a power of ten', () => {
    expect(niceStep(10, 5)).toBe(2);
    expect(niceStep(1, 5)).toBe(0.2);
    expect(niceStep(100, 5)).toBe(20);
    expect(niceStep(7, 5)).toBe(1);
    expect(niceStep(30, 5)).toBe(5);
    expect(niceStep(45, 5)).toBe(10);
    expect(niceStep(0.3, 5)).toBe(0.05);
    expect(niceStep(0, 5)).toBe(1);
    expect(niceStep(10, 0)).toBe(1);
  });

  it('lists the multiples of a step inside the range, anchored at zero', () => {
    expect(ticksAtStep(0, 10, 2)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(ticksAtStep(-5, 5, 5)).toEqual([-5, 0, 5]);
    expect(ticksAtStep(0.5, 3.5, 1)).toEqual([1, 2, 3]);
    expect(ticksAtStep(0, 1, 0.25)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(ticksAtStep(0, 0.3, 0.1)).toEqual([0, 0.1, 0.2, 0.3]);
    expect(ticksAtStep(-3, -1, 1)).toEqual([-3, -2, -1]);
    expect(ticksAtStep(0, 10, 0)).toEqual([]);
    expect(ticksAtStep(0, 10, -2)).toEqual([]);
    expect(ticksAtStep(5, 0, 1)).toEqual([]);
  });

  it('never draws more than the line budget: a step too fine is replaced by a nice one', () => {
    const ticks = ticksAtStep(0, 1000, 1);
    expect(ticks.length).toBeLessThanOrEqual(MAX_LINES);
    expect(ticks[0]).toBe(0);
    expect((ticks[1] ?? 0) - (ticks[0] ?? 0)).toBe(50);
  });

  it('gives an axis its ticks: the caller\'s step or a nice one', () => {
    expect(niceTicks(0, 10, 5)).toEqual({ ticks: [0, 2, 4, 6, 8, 10], step: 2 });
    expect(niceTicks(0, 10, 5, 5)).toEqual({ ticks: [0, 5, 10], step: 5 });
    expect(niceTicks(0, 10, 5, 0).step).toBe(2);
    expect(niceTicks(0, 10, 5, -1).step).toBe(2);
    expect(niceTicks(-1, 1, 4).ticks).toEqual([-1, -0.5, 0, 0.5, 1]);
  });
});

describe('formatting', () => {
  it('writes numbers in the learner\'s locale with a limited number of decimals', () => {
    expect(formatPlanoValue(1234.5, 'en-US', 2)).toBe('1,234.5');
    expect(formatPlanoValue(1234.5, 'pt-BR', 2)).toBe('1.234,5');
    expect(formatPlanoValue(0.5, 'es-MX', 1)).toBe('0.5');
    expect(formatPlanoValue(0.5, 'pt-BR', 1)).toBe('0,5');
    expect(formatPlanoValue(2.6, 'en-US', 0)).toBe('3');
    expect(formatPlanoValue(1 / 3, 'en-US', 3)).toBe('0.333');
    expect(formatPlanoValue(7, 'en-US')).toBe('7');
  });

  it('removes float noise and never writes minus zero', () => {
    expect(formatPlanoValue(0.1 + 0.2, 'en-US', 2)).toBe('0.3');
    expect(formatPlanoValue(-0, 'en-US', 2)).toBe('0');
    expect(formatPlanoValue(-0.001, 'en-US', 2)).toBe('0');
    expect(formatPlanoValue(-4, 'en-US', 2)).toBe('-4');
  });

  it('describes a point for a screen reader, one axis for a locked handle, and separates by locale', () => {
    expect(describePoint({ x: 3, y: 4.5 }, { locale: 'en-US' })).toBe('x 3, y 4.5');
    expect(describePoint({ x: 3, y: 4.5 }, { locale: 'en-US', xLabel: 'Time', yLabel: 'Coins' })).toBe('Time 3, Coins 4.5');
    expect(describePoint({ x: 3.5, y: 4 }, { locale: 'pt-BR' })).toBe('x 3,5; y 4');
    expect(describePoint({ x: 3, y: 4 }, { locale: 'en-US', axis: 'x' })).toBe('x 3');
    expect(describePoint({ x: 3, y: 4 }, { locale: 'en-US', axis: 'y', yLabel: 'Coins' })).toBe('Coins 4');
    expect(describePoint({ x: 1 / 3, y: 4 }, { locale: 'en-US', digits: 1 })).toBe('x 0.3, y 4');
  });
});

describe('sampling a curve from a callback', () => {
  const view = { yMin: -5, yMax: 5 };

  it('samples evenly across the range in one run', () => {
    const runs = sampleCurve((x) => x, -5, 5, { ...view, samples: 10 });
    expect(runs).toHaveLength(1);
    expect(runs[0]).toHaveLength(11);
    expect(runs[0]?.[0]).toEqual({ x: -5, y: -5 });
    expect(runs[0]?.[10]).toEqual({ x: 5, y: 5 });
    expect(sampleCurve((x) => x, 0, 1, view)[0]).toHaveLength(161);
    expect(sampleCurve((x) => x, 0, 1, { ...view, samples: 1 })[0]).toHaveLength(3);
    expect(sampleCurve((x) => x, 0, 1, { ...view, samples: 99999 })[0]).toHaveLength(601);
  });

  it('breaks the line where the function is not finite instead of joining over the gap', () => {
    const runs = sampleCurve((x) => 1 / x, -2, 2, { ...view, samples: 40 });
    expect(runs).toHaveLength(2);
    expect(Math.max(...(runs[0] ?? []).map((point) => point.x))).toBeLessThan(0);
    expect(Math.min(...(runs[1] ?? []).map((point) => point.x))).toBeGreaterThan(0);
    const root = sampleCurve((x) => Math.sqrt(x), -4, 4, { ...view, samples: 8 });
    expect(root).toHaveLength(1);
    expect(root[0]?.[0]?.x).toBe(0);
    expect(sampleCurve(() => Number.NaN, 0, 1, view)).toEqual([]);
  });

  it('breaks the line at an asymptote: a jump of more than two plot heights', () => {
    const runs = sampleCurve((x) => (x < 0 ? -100 : 100), -1, 1, { ...view, samples: 4 });
    expect(runs.map((run) => run.map((point) => point.x))).toEqual([[-1, -0.5], [0, 0.5, 1]]);
    const kept = sampleCurve((x) => x * 3, -5, 5, { ...view, samples: 10 });
    expect(kept).toHaveLength(1);
    expect(sampleCurve((x) => (x < 0 ? -100 : 100), -1, 1, { ...view, samples: 4, jump: 1000 })).toHaveLength(1);
  });

  it('treats a callback that throws as a gap and keeps far values off the page', () => {
    const throwing = sampleCurve((x) => { if (x > 0) throw new Error('domain'); return x; }, -2, 2, { ...view, samples: 4 });
    expect(throwing).toHaveLength(1);
    expect(throwing[0]).toHaveLength(3);
    const huge = sampleCurve(() => 1e9, 0, 1, { ...view, samples: 2 });
    expect(huge[0]?.every((point) => point.y === 505)).toBe(true);
  });
});

describe('paths and regions', () => {
  const frame = createFrame(domain);

  it('writes an SVG path in viewBox units, skipping runs too short to draw', () => {
    expect(pathFromRuns([[{ x: 0, y: 0 }, { x: 10, y: 10 }]], frame)).toBe('M0,400L600,0');
    expect(pathFromRuns([[{ x: 0, y: 0 }, { x: 5, y: 5 }], [{ x: 7, y: 7 }], [{ x: 8, y: 8 }, { x: 10, y: 10 }]], frame)).toBe('M0,400L300,200M480,80L600,0');
    expect(pathFromRuns([], frame)).toBe('');
    expect(pathFromPoints([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], frame, true)).toBe('M0,400L600,400L600,0Z');
    expect(pathFromPoints([{ x: 1, y: 1 }], frame, true)).toBe('');
  });

  it('outlines a region as its own polygon or the band between two bounds', () => {
    const own = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 4 }];
    expect(regionPolygon({ points: own })).toEqual(own);
    expect(regionPolygon({ points: own })).not.toBe(own);
    const band = regionPolygon({ between: { upper: 8, lower: 2, from: 0, to: 10, samples: 2 } });
    expect(band).toEqual([{ x: 0, y: 8 }, { x: 5, y: 8 }, { x: 10, y: 8 }, { x: 10, y: 2 }, { x: 5, y: 2 }, { x: 0, y: 2 }]);
    const under = regionPolygon({ between: { upper: (x) => x, lower: 0, from: 0, to: 4, samples: 2 } });
    expect(under).toEqual([{ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 4, y: 4 }, { x: 4, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 0 }]);
    const gap = regionPolygon({ between: { upper: (x) => Math.sqrt(x - 1), lower: 0, from: 0, to: 2, samples: 2 } });
    // The undefined start is skipped: the upper bound keeps (1, 0) and (2, 1), the lower one its three points.
    expect(gap).toHaveLength(5);
    expect(gap.some((point) => Number.isNaN(point.y))).toBe(false);
    expect(regionPolygon({})).toEqual([]);
  });

  it('names the corners a table can list for a region', () => {
    expect(regionCorners({ between: { upper: 8, lower: 2, from: 1, to: 9 } })).toEqual([{ x: 1, y: 8 }, { x: 9, y: 8 }, { x: 9, y: 2 }, { x: 1, y: 2 }]);
    expect(regionCorners({ points: [{ x: 1, y: 1 }, { x: 2, y: 3 }] })).toEqual([{ x: 1, y: 1 }, { x: 2, y: 3 }]);
    expect(regionCorners({})).toEqual([]);
  });
});

describe('the table equivalent', () => {
  it('lists every handle, point, vertex and curve reading, from the same layers the plane draws', () => {
    const rows = buildTableRows({
      handles: [{ id: 'h', label: 'Point A', x: 1, y: 2 }],
      points: [{ id: 'p', x: 3, y: 4 }, { id: 'q', label: 'Goal', x: 5, y: 6 }],
      polylines: [{ id: 'l', label: 'Path', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }, { id: 'solo', label: 'Dot', points: [{ x: 9, y: 9 }] }],
      curves: [{ id: 'c', label: 'Doubling', fn: (x) => 2 * x }],
      regions: [{ id: 'r', label: 'Zone', between: { upper: 8, lower: 2, from: 0, to: 10 } }],
    }, domain, [0, 5, 10]);
    expect(rows.map((row) => [row.name, row.x, row.y])).toEqual([
      ['Point A', 1, 2], ['p', 3, 4], ['Goal', 5, 6],
      ['Path 1', 0, 0], ['Path 2', 1, 1], ['Dot', 9, 9],
      ['Doubling 1', 0, 0], ['Doubling 2', 5, 10], ['Doubling 3', 10, 20],
      ['Zone 1', 0, 8], ['Zone 2', 10, 8], ['Zone 3', 10, 2], ['Zone 4', 0, 2],
    ]);
    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
  });

  it('reads a curve only where it is drawn and defined', () => {
    const limited = buildTableRows({ curves: [{ id: 'c', fn: (x) => 2 * x, from: 2, to: 8 }] }, domain, [0, 5, 10]);
    expect(limited.map((row) => row.x)).toEqual([5]);
    expect(limited[0]?.name).toBe('c');
    const inverse = buildTableRows({ curves: [{ id: 'c', label: 'Share', fn: (x) => 1 / x }] }, domain, [0, 5, 10]);
    expect(inverse.map((row) => row.x)).toEqual([5, 10]);
    const noisy = buildTableRows({ curves: [{ id: 'c', label: 'Third', fn: (x) => x / 3 }] }, domain, [1]);
    expect(noisy[0]?.y).toBe(0.33333333);
    expect(buildTableRows({}, domain, [0])).toEqual([]);
  });
});

describe('series assignment', () => {
  it('gives line-like layers sky, mint and berry in drawing order unless they name their own', () => {
    const line = { id: 'l', points: [] };
    const curve = { id: 'c', fn: (x: number) => x };
    const assigned = assignSeries({ polylines: [line, { ...line, id: 'm', series: 'neutral' }], curves: [curve, curve], regions: [{ id: 'r' }] });
    expect(assigned.polylines).toEqual([1, 'neutral']);
    expect(assigned.curves).toEqual([3, 1]);
    expect(assigned.regions).toEqual([2]);
    expect(assignSeries({})).toEqual({ polylines: [], curves: [], regions: [] });
  });
});

describe('constants', () => {
  it('keep the hit area at the 64 px target and a 3:2 default plot', () => {
    expect(HANDLE_HIT_PX).toBe(64);
    expect(PLANO_VIEWBOX).toEqual({ width: 600, height: 400 });
  });
});
