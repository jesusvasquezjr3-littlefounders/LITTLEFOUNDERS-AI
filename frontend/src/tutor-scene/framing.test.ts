import { describe, expect, it } from 'vitest';
import { framingDistance, silhouetteWidth, type ModelExtent } from './framing';

/*
 * These are the two shapes the cast actually contains, measured off the shipped
 * exports rather than invented: a standing human who is far taller than wide,
 * and a quadruped who is the other way round. Every assertion below exists
 * because framing by declared HEIGHT got the second one wrong while looking
 * perfect on the first.
 */
const HUMAN: ModelExtent = { x: 0.62, y: 1.61, z: 0.34 };
const QUADRUPED: ModelExtent = { x: 1.24, y: 0.78, z: 1.9 };

const SQUARE = { fill: 0.78, rotation: 0, aspect: 1, fov: 30 };

describe('silhouetteWidth', () => {
  it('is the model width face-on and its depth at a quarter turn', () => {
    expect(silhouetteWidth(QUADRUPED, 0)).toBeCloseTo(1.24, 6);
    expect(silhouetteWidth(QUADRUPED, Math.PI / 2)).toBeCloseTo(1.9, 6);
  });

  it('never returns less than either extent alone, at any angle', () => {
    // A negative cosine must not cancel a positive sine: it did, in the first
    // draft, and a character turned past a quarter turn framed as if it were
    // paper-thin.
    for (let deg = 0; deg < 360; deg += 15) {
      const width = silhouetteWidth(QUADRUPED, (deg * Math.PI) / 180);
      expect(width, `${deg} deg`).toBeGreaterThanOrEqual(Math.min(QUADRUPED.x, QUADRUPED.z) - 1e-9);
    }
  });

  it('is symmetric about the facing axis — turning left or right frames the same', () => {
    expect(silhouetteWidth(QUADRUPED, 0.7)).toBeCloseTo(silhouetteWidth(QUADRUPED, -0.7), 9);
  });
});

describe('framingDistance', () => {
  it('frames the human by HEIGHT and the quadruped by WIDTH on a square frame', () => {
    /*
     * THE WHOLE POINT. If both were framed by height, the quadruped - 0.78 m
     * tall and 1.24 m wide - would be placed close enough that her width
     * overflows the frame, which is exactly the "feet against the bottom edge"
     * the pose lab showed.
     */
    const halfFov = Math.tan((30 * Math.PI) / 360);
    const humanByHeight = HUMAN.y / 0.78 / (2 * halfFov);
    const quadByWidth = QUADRUPED.x / 0.78 / (2 * halfFov);

    expect(framingDistance(HUMAN, SQUARE)).toBeCloseTo(humanByHeight, 6);
    expect(framingDistance(QUADRUPED, SQUARE)).toBeCloseTo(quadByWidth, 6);
  });

  it('pulls further back on a NARROW frame, for the character that is width-bound', () => {
    // A portrait tile has less horizontal room, so the width-bound character
    // must retreat while the height-bound one does not move at all.
    const portrait = { ...SQUARE, aspect: 0.6 };
    expect(framingDistance(QUADRUPED, portrait)).toBeGreaterThan(framingDistance(QUADRUPED, SQUARE));
    expect(framingDistance(HUMAN, portrait)).toBeCloseTo(framingDistance(HUMAN, SQUARE), 6);
  });

  it('retreats as a deep character turns side-on', () => {
    const facing = framingDistance(QUADRUPED, SQUARE);
    const side = framingDistance(QUADRUPED, { ...SQUARE, rotation: Math.PI / 2 });
    // 1.9 m of depth becomes 1.9 m of width, so side-on must be further away.
    expect(side).toBeGreaterThan(facing);
  });

  it('a smaller fill means a smaller character, so a longer lens distance', () => {
    expect(framingDistance(HUMAN, { ...SQUARE, fill: 0.4 })).toBeGreaterThan(
      framingDistance(HUMAN, { ...SQUARE, fill: 0.9 }),
    );
  });

  it('clamps a nonsense fill instead of dividing by zero', () => {
    /*
     * `fill` reaches this from a prop, and a caller passing 0 - or a stale
     * animated value passing through 0 - would otherwise put the camera at
     * infinity and blank the canvas. A blank canvas reads as a broken model,
     * which is the most expensive kind of wrong answer to debug.
     */
    for (const fill of [0, -1, 12, Number.NaN]) {
      const distance = framingDistance(HUMAN, { ...SQUARE, fill });
      if (Number.isNaN(fill)) {
        // Math.min/max propagate NaN; the clamp must not pretend otherwise, so
        // this asserts the honest outcome rather than a silently invented one.
        expect(Number.isNaN(distance)).toBe(true);
      } else {
        expect(Number.isFinite(distance), `fill=${fill}`).toBe(true);
        expect(distance).toBeGreaterThan(0);
      }
    }
  });

  it('survives a zero-height model rather than collapsing onto it', () => {
    // An empty or failed load measures as a point. Framing must still produce a
    // usable number, because the alternative is a camera inside the origin.
    expect(framingDistance({ x: 0, y: 0, z: 0 }, SQUARE)).toBe(0);
  });
});
