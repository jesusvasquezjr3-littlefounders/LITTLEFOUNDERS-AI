import { describe, expect, it } from 'vitest';
import { readBudget, TUTOR_ASSET_BUDGET } from './budget';

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
