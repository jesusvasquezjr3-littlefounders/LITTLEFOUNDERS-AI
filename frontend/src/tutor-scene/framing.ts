/*
 * WHERE THE CAMERA STANDS TO FRAME ONE CHARACTER.
 *
 * Pure arithmetic, deliberately, and separated from `CharacterStage` for the
 * same reason `composition.ts` is separate from the camera director: the part
 * that can be wrong in a way nobody photographs is the arithmetic, and the only
 * thing that keeps it honest is a test that states what each term is for.
 *
 * The inputs are MEASURED off the model (`modelBounds`), never declared. A
 * declared height is what put a quadruped's feet against the bottom edge:
 * `measurements.ts` calls Dina 1.9 m by the same number that makes Rho 1.7 m,
 * but she is low and long, and framing to a fraction of that number aims above
 * most of her.
 */

export interface ModelExtent {
  /** Width, height and depth in scene metres, after the character scale. */
  x: number;
  y: number;
  z: number;
}

export interface FramingRequest {
  /** How much of the frame the character should fill, 0..1. */
  fill: number;
  /** Y rotation in radians. 0 faces the camera. */
  rotation: number;
  /** Container aspect, width / height. */
  aspect: number;
  /** Vertical field of view in degrees. */
  fov: number;
}

/**
 * The silhouette's WIDTH at a given rotation.
 *
 * A character's depth only costs screen width once the character is turned:
 * face-on it is the model's own width that has to fit, at a quarter turn it is
 * its depth, and in between it is the projection of both. Summing the absolute
 * projections is the bounding-box answer - it slightly over-estimates a rounded
 * silhouette, which errs toward leaving air rather than toward cropping.
 */
export function silhouetteWidth(extent: ModelExtent, rotation: number): number {
  return Math.abs(extent.x * Math.cos(rotation)) + Math.abs(extent.z * Math.sin(rotation));
}

/**
 * The distance at which the character occupies `fill` of the frame.
 *
 * A perspective camera sees `2 * d * tan(fov / 2)` vertically and that times the
 * aspect horizontally. Solving each for the distance that grants the character
 * its share and taking the LARGER is what makes one `fill` mean the same thing
 * for a tall human and a long quadruped, on a portrait tile and a wide one: the
 * nearer of the two solutions is always the one that crops.
 */
export function framingDistance(extent: ModelExtent, request: FramingRequest): number {
  const share = Math.max(0.05, Math.min(1, request.fill));
  const aspect = Math.max(0.01, request.aspect);
  const halfFov = Math.tan((request.fov * Math.PI) / 360);
  const byHeight = extent.y / share / (2 * halfFov);
  const byWidth = silhouetteWidth(extent, request.rotation) / share / (2 * halfFov * aspect);
  return Math.max(byHeight, byWidth);
}
