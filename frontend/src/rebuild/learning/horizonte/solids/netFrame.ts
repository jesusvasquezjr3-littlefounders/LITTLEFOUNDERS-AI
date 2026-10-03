import type { Measure, Pt, PolyFace } from './polynet.generated';

/*
 * Drawing helpers for a flat net. The model keeps a net with y pointing up (corners counter-clockwise seen from outside); an SVG
 * draws y down, so a point (x, y) of the net sits at (x, -y) on the screen and the net is seen from outside.
 */

/** A window on the net, in screen units (y already flipped). */
export interface Frame { x: number; y: number; width: number; height: number }

const round = (value: number): number => Math.round(value * 1000) / 1000;

export const pathOf = (points: readonly Pt[]): string => points.map(([x, y]) => `${round(x)},${round(-y)}`).join(' ');
export const viewBoxOf = (frame: Frame): string => `${round(frame.x)} ${round(frame.y)} ${round(frame.width)} ${round(frame.height)}`;

/** The window around net points with `pad` units all around. */
export function frameOf(points: readonly Pt[], pad: number): Frame {
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => -point[1]);
  const [minX, minY] = [Math.min(...xs), Math.min(...ys)];
  return { x: minX - pad, y: minY - pad, width: Math.max(...xs) - minX + 2 * pad, height: Math.max(...ys) - minY + 2 * pad };
}

export const centroidOf = (points: readonly Pt[]): Pt => [points.reduce((sum, point) => sum + point[0], 0) / points.length, points.reduce((sum, point) => sum + point[1], 0) / points.length];

/** A length written on a panel, and the dashed line a height is measured along. */
export interface MeasureMarks { labels: { at: Pt; text: string }[]; guides: { from: Pt; to: Pt }[] }

/**
 * Where the lengths of a face go on its flat panel: an edge length sits just inside the middle of that side, a height gets a
 * dashed guide from the apex to the middle of the base and its number beside the guide. `offset` is how far inside a label sits.
 */
export function measureMarks(points: readonly Pt[], measures: readonly Measure[], offset: number): MeasureMarks {
  const centre = centroidOf(points);
  const marks: MeasureMarks = { labels: [], guides: [] };
  const inward = (from: Pt, to: Pt): Pt => {
    const [dx, dy] = [to[0] - from[0], to[1] - from[1]];
    const size = Math.hypot(dx, dy) || 1;
    const normal: Pt = [-dy / size, dx / size];
    const middle: Pt = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
    const toward = (centre[0] - middle[0]) * normal[0] + (centre[1] - middle[1]) * normal[1] >= 0 ? 1 : -1;
    return [middle[0] + normal[0] * offset * toward, middle[1] + normal[1] * offset * toward];
  };
  for (const measure of measures) {
    if (measure.type === 'edge') {
      marks.labels.push({ at: inward(points[measure.from]!, points[measure.to]!), text: String(measure.length) });
      continue;
    }
    const [apex, from, to] = [points[measure.apex]!, points[measure.from]!, points[measure.to]!];
    const foot: Pt = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
    marks.guides.push({ from: apex, to: foot });
    const [dx, dy] = [foot[0] - apex[0], foot[1] - apex[1]];
    const size = Math.hypot(dx, dy) || 1;
    const side: Pt = [-dy / size, dx / size];
    marks.labels.push({ at: [(apex[0] + foot[0]) / 2 + side[0] * offset, (apex[1] + foot[1]) / 2 + side[1] * offset], text: String(measure.length) });
  }
  return marks;
}

export type PanelShape = 'rect' | 'right' | 'triangle';

/** What a face looks like flat: a rectangle, a right triangle (two legs) or a triangle given by a base and a height. */
export function shapeOf(face: PolyFace): PanelShape {
  if (face.vertices.length === 4) return 'rect';
  return face.measures.some((measure) => measure.type === 'height') ? 'triangle' : 'right';
}

/** The two lengths of a face, in the order its shape text names them: sides, legs, or base then height. */
export function lengthsOf(face: PolyFace): [number, number] {
  const [first, second] = face.measures;
  return [first!.length, second!.length];
}
