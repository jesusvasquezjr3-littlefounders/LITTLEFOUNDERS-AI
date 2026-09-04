import { describe, expect, it } from 'vitest';
import { resolvePointBearing } from './pointTarget';

/**
 * A minimal fake `Document` — real enough for `querySelector` and
 * `getBoundingClientRect` to answer correctly, without pulling in JSDOM's
 * full layout engine (which does not compute real box positions anyway;
 * `getBoundingClientRect` is stubbed per-node here instead).
 */
function fakeDocument(
  boardRect: { left: number; top: number; width: number; height: number },
  items: Record<number, { left: number; top: number; width: number; height: number }>,
): Document {
  const doc = window.document.implementation.createHTMLDocument('');
  const board = doc.createElement('div');
  board.setAttribute('data-tutor-whiteboard', '');
  board.getBoundingClientRect = () => boardRect as DOMRect;
  doc.body.appendChild(board);

  for (const [index, rect] of Object.entries(items)) {
    const item = doc.createElement('div');
    item.setAttribute('data-tutor-whiteboard-item', index);
    item.getBoundingClientRect = () => rect as DOMRect;
    board.appendChild(item);
  }

  return doc;
}

describe('resolvePointBearing', () => {
  it('is null when pointAt is null or undefined', () => {
    const doc = fakeDocument({ left: 0, top: 0, width: 400, height: 200 }, {});
    expect(resolvePointBearing(null, doc)).toBeNull();
    expect(resolvePointBearing(undefined, doc)).toBeNull();
  });

  it('is null when no board is mounted at all', () => {
    const doc = window.document.implementation.createHTMLDocument('');
    expect(resolvePointBearing(0, doc)).toBeNull();
  });

  it('is null when the index names no real element — a guessed id costs nothing', () => {
    const doc = fakeDocument({ left: 0, top: 0, width: 400, height: 200 }, {
      0: { left: 0, top: 0, width: 50, height: 50 },
    });
    expect(resolvePointBearing(9, doc)).toBeNull();
  });

  it('is null when the board measures zero — not yet laid out', () => {
    const doc = fakeDocument({ left: 0, top: 0, width: 0, height: 0 }, {
      0: { left: 0, top: 0, width: 50, height: 50 },
    });
    expect(resolvePointBearing(0, doc)).toBeNull();
  });

  it('reads 0,0 for an item exactly at the board centre', () => {
    // Board spans x:[0,400] y:[0,200], centre (200,100). Item centred there too.
    const doc = fakeDocument({ left: 0, top: 0, width: 400, height: 200 }, {
      1: { left: 175, top: 75, width: 50, height: 50 },
    });
    const bearing = resolvePointBearing(1, doc);
    expect(bearing).not.toBeNull();
    expect(bearing!.x).toBeCloseTo(0, 5);
    expect(bearing!.y).toBeCloseTo(0, 5);
  });

  it('reads a negative x for an item left of centre, positive for one to the right', () => {
    const doc = fakeDocument({ left: 0, top: 0, width: 400, height: 200 }, {
      0: { left: 0, top: 75, width: 50, height: 50 }, // centre x = 25, board centre x = 200
      2: { left: 350, top: 75, width: 50, height: 50 }, // centre x = 375
    });
    expect(resolvePointBearing(0, doc)!.x).toBeLessThan(0);
    expect(resolvePointBearing(2, doc)!.x).toBeGreaterThan(0);
  });

  it('clamps to [-1, 1] rather than reporting a target outside the board', () => {
    const doc = fakeDocument({ left: 0, top: 0, width: 400, height: 200 }, {
      0: { left: -1000, top: 75, width: 50, height: 50 },
    });
    expect(resolvePointBearing(0, doc)!.x).toBe(-1);
  });
});
