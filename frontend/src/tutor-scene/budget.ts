/*
 * The Tutor 3D asset budget, as CODE rather than as prose in a brief.
 *
 * The Tutor scene ships to every user on every device, so these numbers are
 * the contract between the art pipeline and the runtime. Stating them in a
 * document means they get checked by whoever remembers to; stating them here
 * means `/dev/scene-lab` measures a real model against them and says which
 * line was crossed, before the asset is ever published.
 *
 * Derivation: mid-range Android (the constraint, not the target) sustaining
 * 60fps at DPR 1.5 in a browser that is also running the rest of the SPA.
 *
 * TWO DIFFERENT TRIANGLE COUNTS EXIST and confusing them will waste an
 * afternoon:
 *   - `scripts/optimize-glb.mjs` reports MESH triangles — how complex the asset
 *     is. That is the number an artist decimates against.
 *   - The runtime HUD reports triangles RENDERED PER FRAME, read from
 *     `gl.info.render`. Shadow casting re-renders geometry into the shadow map,
 *     so a 28.8k-triangle mesh legitimately reports ~57.6k per frame on the
 *     high tier. That is real GPU work, not double counting.
 * The budget below is applied to both; they simply answer different questions.
 */

export interface AssetBudget {
  /** Whole scene, characters included. Counts each triangle ONCE. */
  maxTriangles: number;
  /**
   * Triangles the GPU may process per frame, which is not the same number.
   *
   * `gl.info.render.triangles` counts every triangle SUBMITTED, and the `high`
   * tier is the only one with shadows — so it renders the scene twice and the
   * count doubles exactly. Measured: rho + liruf on diorama-a reported 102,424
   * against assets containing 51,208. Comparing that against the asset ceiling
   * painted "Over budget" in red for a scene comfortably inside its documented
   * cost, which is worse than no readout: it trains whoever is doing
   * performance work to ignore the one alarm they have.
   */
  maxTrianglesPerFrame: number;
  /** One character on its own. */
  maxTrianglesPerCharacter: number;
  /**
   * Draw calls per frame. On mobile this predicts cost far better than
   * triangle count does — state changes, not vertices, are what stall a tile
   * renderer.
   */
  maxDrawCalls: number;
  maxTextureSize: number;
  /** Post-optimization .glb size over the wire, targeting LATAM 4G. */
  maxFileBytes: number;
}

export const TUTOR_ASSET_BUDGET: Readonly<AssetBudget> = Object.freeze({
  maxTriangles: 100_000,
  // Two passes at the asset ceiling, plus headroom: a shadow-casting scene
  // legitimately submits its geometry twice, and that is real GPU work rather
  // than double counting.
  maxTrianglesPerFrame: 220_000,
  maxTrianglesPerCharacter: 50_000,
  maxDrawCalls: 30,
  maxTextureSize: 2048,
  maxFileBytes: 8 * 1024 * 1024,
});

export type BudgetLine = 'triangles' | 'drawCalls' | 'fileBytes';

export interface BudgetReading {
  line: BudgetLine;
  actual: number;
  limit: number;
  /** Fraction of the limit used. Above 1 means over budget. */
  ratio: number;
  over: boolean;
}

/**
 * Measures a loaded scene against the budget.
 *
 * Returns a reading per line rather than a single pass/fail: "over budget" is
 * not useful without knowing WHICH line and by how much, since the fix for too
 * many draw calls (merge materials) has nothing to do with the fix for too
 * many triangles (decimate).
 *
 * `fileBytes` is optional because a model loaded from a local file picker in
 * the lab has a known size while one streamed from Depot does not — and an
 * unknown size must not be reported as a passing zero (/AGENTS.md §1.14).
 */
export function readBudget(
  stats: { triangles: number; drawCalls: number; fileBytes?: number; perFrame?: boolean },
  budget: AssetBudget = TUTOR_ASSET_BUDGET,
): BudgetReading[] {
  /*
   * A live scene is measured against the PER-FRAME ceiling; a single .glb
   * inspected on its own is measured against the asset one. Same field, two
   * questions, and answering the second with the first is what produced a
   * permanent false alarm on the only tier that casts shadows.
   */
  const triangleLimit = stats.perFrame ? budget.maxTrianglesPerFrame : budget.maxTriangles;
  const readings: BudgetReading[] = [
    line('triangles', stats.triangles, triangleLimit),
    line('drawCalls', stats.drawCalls, budget.maxDrawCalls),
  ];
  if (typeof stats.fileBytes === 'number') {
    readings.push(line('fileBytes', stats.fileBytes, budget.maxFileBytes));
  }
  return readings;
}

function line(name: BudgetLine, actual: number, limit: number): BudgetReading {
  return { line: name, actual, limit, ratio: actual / limit, over: actual > limit };
}
