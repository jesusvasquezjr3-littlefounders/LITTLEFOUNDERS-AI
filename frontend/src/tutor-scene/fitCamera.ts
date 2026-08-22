import { Box3, Sphere, Vector3, type Object3D, type PerspectiveCamera } from 'three';

/*
 * Frames an object regardless of the units it was exported in.
 *
 * Necessary because the source assets disagree wildly about scale — three
 * characters near 1.65 units tall, one at 0.028, and dioramas around 1.9 across
 * — so a hard-coded camera position frames one asset and misses every other.
 * Fitting from the measured bounding sphere means "look at this thing" works
 * before anyone has decided what its real-world size should be.
 *
 * THIS IS THE INSPECTOR'S FIT AND NOT THE STAGE'S — do not reach for it from
 * `shots.ts`, and do not port its strategy there. Its job is to guarantee an
 * unknown asset is entirely inside the frame, so it fits a bounding SPHERE and
 * pads it: over-framing is the safe failure when you do not yet know what you
 * are looking at, and cropping is not.
 *
 * The stage wants the opposite. An island framed so that all of it fits with
 * air on every side reads as an object on a table; the Tutor's shots stand as
 * CLOSE as the points they promise to hold allow and let the rest run off the
 * edges, which is what makes the render read as a place the learner is standing
 * in. Measured at 375x812 on the same island, the two strategies are 7% of the
 * viewport and 43% of it. The arithmetic here — including the portrait
 * horizontal-FOV correction below — was never wrong; applying its STRATEGY to
 * the stage was.
 */

export interface FitResult {
  /** Where the camera should sit. */
  position: Vector3;
  /** What it should look at — the bounding sphere's centre, not the origin. */
  target: Vector3;
  radius: number;
}

/**
 * Computes a camera placement that frames `object` from a given direction.
 *
 * `padding` > 1 leaves headroom around the subject. The vertical FOV is used
 * for the fit and then corrected for narrow viewports: on a portrait phone the
 * horizontal FOV is the binding constraint, and fitting to vertical alone
 * pushes the subject's sides out of frame.
 */
export function fitObject(
  object: Object3D,
  camera: PerspectiveCamera,
  aspect: number,
  direction = new Vector3(0.6, 0.45, 1),
  padding = 1.25,
): FitResult {
  const box = new Box3().setFromObject(object);
  const sphere = box.getBoundingSphere(new Sphere());
  const radius = Math.max(sphere.radius, 1e-6);

  const vFov = (camera.fov * Math.PI) / 180;
  const fitHeightDistance = radius / Math.sin(vFov / 2);
  // Horizontal FOV derives from the vertical one and the aspect ratio; when
  // aspect < 1 (portrait) this is the larger, binding distance.
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
  const fitWidthDistance = radius / Math.sin(hFov / 2);
  const distance = Math.max(fitHeightDistance, fitWidthDistance) * padding;

  const offset = direction.clone().normalize().multiplyScalar(distance);
  return { position: sphere.center.clone().add(offset), target: sphere.center.clone(), radius };
}

/** Vertical distance between an object's lowest point and y=0. */
export function groundOffset(object: Object3D): number {
  return new Box3().setFromObject(object).min.y;
}
