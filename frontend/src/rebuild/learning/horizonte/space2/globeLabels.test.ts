import { describe, expect, it } from 'vitest';
import { layoutLabels, placeTags } from './globeLabels';

const SIZE = 240;

describe('globe place names', () => {
  it('puts a name beside its dot, inside the drawing, with room to wrap', () => {
    const [label] = layoutLabels(SIZE, [{ id: 'a', text: 'Houston', x: 120, y: 120 }], [], []);
    expect(label).toBeDefined();
    expect(label!.room).toBeGreaterThanOrEqual(28);
    expect(label!.room).toBeLessThanOrEqual(96);
  });

  it('keeps a name off its neighbour, the route tags and the route line', () => {
    const dots = [
      { id: 'a', text: 'Los Angeles', x: 60, y: 120 },
      { id: 'b', text: 'Mexico City', x: 70, y: 132 },
    ];
    const tags = [{ x: 60, y: 100 }];
    const marks = Array.from({ length: 30 }, (_, step) => ({ x: 60 + step * 3, y: 120 + step }));
    const [first, second] = layoutLabels(SIZE, dots, tags, marks);
    expect(first!.id).toBe('a');
    expect(second!.id).toBe('b');
    expect([first!.align, first!.valign].join()).not.toBe([second!.align, second!.valign].join());
  });

  it('never leaves a name past the drawing edge: a dot at the right edge gets its name on the left', () => {
    const [label] = layoutLabels(SIZE, [{ id: 'a', text: 'New York', x: 232, y: 120 }], [], []);
    expect(label!.align).toBe('end');
  });

  it('keeps a long translated name inside the drawing even at its widest', () => {
    for (const x of [14, 120, 226]) {
      const [label] = layoutLabels(SIZE, [{ id: 'a', text: 'Ciudad de México', x, y: 120 }], [], []);
      const left = label!.align === 'start' ? label!.x : label!.align === 'end' ? label!.x - label!.room : label!.x - label!.room / 2;
      expect(left).toBeGreaterThanOrEqual(0);
      expect(left + label!.room).toBeLessThanOrEqual(SIZE);
    }
  });

  it('gives every dot a name', () => {
    const dots = Array.from({ length: 6 }, (_, index) => ({ id: `p${index}`, text: 'Mexico City', x: 40 + index * 28, y: 120 }));
    expect(layoutLabels(SIZE, dots, [], []).map((label) => label.id)).toEqual(dots.map((dot) => dot.id));
  });
});

describe('globe route tags', () => {
  const RADIUS = 104;
  const line = (from: { x: number; y: number }, to: { x: number; y: number }) => (t: number) => (t < 0 || t > 1 ? null : { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });

  it('sits at the middle of a long route', () => {
    const [tag] = placeTags(SIZE, RADIUS, [{ id: 'a', at: line({ x: 60, y: 120 }, { x: 180, y: 120 }) }], [{ x: 60, y: 120 }, { x: 180, y: 120 }]);
    expect(tag).toMatchObject({ id: 'a', x: 120, y: 120 });
  });

  it('steps clear of the place dots on a short route', () => {
    const from = { x: 110, y: 120 };
    const to = { x: 126, y: 120 };
    const [tag] = placeTags(SIZE, RADIUS, [{ id: 'a', at: line(from, to) }], [from, to]);
    expect(Math.hypot(tag!.x - from.x, tag!.y - from.y)).toBeGreaterThanOrEqual(14);
    expect(Math.hypot(tag!.x - to.x, tag!.y - to.y)).toBeGreaterThanOrEqual(14);
  });

  it('draws no tag for a route whose middle is on the far side', () => {
    expect(placeTags(SIZE, RADIUS, [{ id: 'a', at: () => null }], [])).toEqual([]);
  });
});
