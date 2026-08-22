import { describe, expect, it } from 'vitest';
import { castDrawCalls, fitsFrameBudget, readBudget, trianglesPerFrame, TUTOR_ASSET_BUDGET } from './budget';
import { CHARACTER_MEASUREMENTS, SCENE_MEASUREMENTS } from './measurements';

describe('readBudget', () => {
  it('measures a live scene against the PER-FRAME ceiling', () => {
    /*
     * The shipped scene — rho + liruf on diorama-a — contains 51,208 triangles
     * and reports 102,424 on the `high` tier, because that is the only tier
     * with shadows and a shadow pass submits the geometry a second time. That
     * scene is within its documented cost and must not read as over budget.
     */
    const [triangles] = readBudget({ triangles: 102_424, drawCalls: 10, perFrame: true });
    expect(triangles!.over).toBe(false);
  });

  it('measures a single asset against the ASSET ceiling', () => {
    // The same number inspected as one .glb IS over budget: no file should
    // carry 102k triangles on its own.
    const [triangles] = readBudget({ triangles: 102_424, drawCalls: 10 });
    expect(triangles!.over).toBe(true);
  });

  it('keeps the two ceilings distinct', () => {
    // If these ever collapse to one number the false alarm comes straight back.
    expect(TUTOR_ASSET_BUDGET.maxTrianglesPerFrame).toBeGreaterThan(TUTOR_ASSET_BUDGET.maxTriangles);
  });

  it('still catches a genuinely expensive frame', () => {
    const [triangles] = readBudget({ triangles: 400_000, drawCalls: 10, perFrame: true });
    expect(triangles!.over).toBe(true);
  });

  it('reports draw calls against one ceiling either way', () => {
    const live = readBudget({ triangles: 1, drawCalls: 40, perFrame: true })[1];
    const asset = readBudget({ triangles: 1, drawCalls: 40 })[1];
    expect(live!.over).toBe(true);
    expect(asset!.over).toBe(true);
  });

  it('omits file size when it is unknown rather than passing it as zero', () => {
    // An unknown size reported as a passing zero is the failure mode §1.14 is
    // about: a scene streamed from Depot has no known byte count.
    expect(readBudget({ triangles: 1, drawCalls: 1 })).toHaveLength(2);
    expect(readBudget({ triangles: 1, drawCalls: 1, fileBytes: 10 })).toHaveLength(3);
  });
});

/*
 * THE PERSONALIZATION AUDITION, COSTED AGAINST THE REAL EXPORTS.
 *
 * Standing the whole cast on the island is what makes "choose your tutor by
 * looking at them" true rather than a menu in world coordinates — and it is a
 * budget question before it is a design one. These numbers come from
 * `npm run assets:inspect` and live in `measurements.ts`, so the test moves the
 * day an asset is re-exported instead of quietly certifying an old figure.
 *
 * The shadow assertion is the point of the pair. Four characters fit
 * comfortably with the shadow pass off and do NOT fit with it on, which is the
 * whole reason the scene turns it off for the duration rather than dropping a
 * candidate and putting a name plate back over empty ground.
 */
describe('standing the whole cast', () => {
  const CAST = Object.values(CHARACTER_MEASUREMENTS).map((measurement) => measurement.triangles);
  const ISLANDS = Object.values(SCENE_MEASUREMENTS);

  it('fits the per-frame ceiling on every island once the shadow pass is off', () => {
    for (const island of ISLANDS) {
      const cost = trianglesPerFrame({ scene: island.triangles, cast: CAST, shadows: false });
      expect(cost, island.id).toBeLessThanOrEqual(TUTOR_ASSET_BUDGET.maxTrianglesPerFrame);
      expect(fitsFrameBudget({ scene: island.triangles, cast: CAST, shadows: false }), island.id).toBe(true);
    }
  });

  it('does NOT fit with shadows on, which is why the audition turns them off', () => {
    for (const island of ISLANDS) {
      // A shadow-casting light re-renders the whole scene, so every triangle is
      // submitted twice: 302,408 on diorama-a and 346,152 on diorama-b.
      expect(fitsFrameBudget({ scene: island.triangles, cast: CAST, shadows: true }), island.id).toBe(false);
    }
  });

  it('leaves the ordinary two-character scene inside its budget with shadows ON', () => {
    // The audition is the exception; a normal session must not have paid for it.
    const pair = [CHARACTER_MEASUREMENTS.rho.triangles, CHARACTER_MEASUREMENTS.liruf.triangles];
    for (const island of ISLANDS) {
      expect(fitsFrameBudget({ scene: island.triangles, cast: pair, shadows: true }), island.id).toBe(true);
    }
  });

  it('stays inside the draw-call ceiling, which is what a phone actually feels', () => {
    // Four single-primitive characters, their contact-shadow quads, the two
    // fitted mouth cards and the island.
    expect(castDrawCalls({ cast: 4, mouthCards: 2, shadows: false })).toBeLessThanOrEqual(
      TUTOR_ASSET_BUDGET.maxDrawCalls,
    );
    // And the ordinary pair, on the one tier that also submits a shadow pass.
    expect(castDrawCalls({ cast: 2, mouthCards: 1, shadows: true })).toBeLessThanOrEqual(
      TUTOR_ASSET_BUDGET.maxDrawCalls,
    );
  });
});
