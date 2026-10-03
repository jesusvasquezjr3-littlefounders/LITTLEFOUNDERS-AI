import { describe, expect, it } from 'vitest';
import { centroidOf, frameOf, lengthsOf, measureMarks, pathOf, shapeOf } from './netFrame';
import { buildNet, buildSolid } from './polynet.generated';

describe('net frame', () => {
  it('flips the net onto the screen and frames it with padding', () => {
    const points = [[0, 0], [4, 0], [4, 3], [0, 3]] as const;
    expect(pathOf(points)).toBe('0,0 4,0 4,-3 0,-3');
    expect(frameOf(points, 1)).toEqual({ x: -1, y: -4, width: 6, height: 5 });
    expect(centroidOf(points)).toEqual([2, 1.5]);
  });

  it('names the shape and the two lengths of every face', () => {
    const box = buildSolid({ kind: 'rect-prism', dims: [4, 3, 2] })!;
    expect(box.faces.map(shapeOf)).toEqual(['rect', 'rect', 'rect', 'rect', 'rect', 'rect']);
    expect(lengthsOf(box.faces[0]!)).toEqual([4, 3]);
    const prism = buildSolid({ kind: 'tri-prism', dims: [3, 4, 5] })!;
    expect(prism.faces.map(shapeOf)).toEqual(['rect', 'rect', 'rect', 'right', 'right']);
    expect(lengthsOf(prism.faces[3]!).sort()).toEqual([3, 4]);
    const pyramid = buildSolid({ kind: 'sq-pyramid', dims: [6, 5] })!;
    expect(pyramid.faces.map(shapeOf)).toEqual(['rect', 'triangle', 'triangle', 'triangle', 'triangle']);
    expect(lengthsOf(pyramid.faces[1]!)).toEqual([6, 5]);
  });

  it('puts every length inside its panel and draws a guide for a height', () => {
    const pyramid = buildSolid({ kind: 'sq-pyramid', dims: [6, 5] })!;
    const net = buildNet(pyramid, 'star')!;
    net.layout.panels.forEach((panel, index) => {
      const face = pyramid.faces[net.faces[index]!]!;
      const marks = measureMarks(panel.points, face.measures, 0.5);
      expect(marks.labels.map((label) => label.text)).toEqual(face.measures.map((measure) => String(measure.length)));
      expect(marks.guides).toHaveLength(face.measures.filter((measure) => measure.type === 'height').length);
      const xs = panel.points.map((point) => point[0]);
      const ys = panel.points.map((point) => point[1]);
      for (const { at } of marks.labels) {
        expect(at[0]).toBeGreaterThanOrEqual(Math.min(...xs) - 1e-9);
        expect(at[0]).toBeLessThanOrEqual(Math.max(...xs) + 1e-9);
        expect(at[1]).toBeGreaterThanOrEqual(Math.min(...ys) - 1e-9);
        expect(at[1]).toBeLessThanOrEqual(Math.max(...ys) + 1e-9);
      }
    });
  });
});
