import { BoxGeometry, Color, CylinderGeometry, DirectionalLight, HemisphereLight, Matrix4, Mesh, MeshStandardMaterial, PerspectiveCamera, RingGeometry, Scene, WebGLRenderer, type BufferGeometry } from 'three';
import { AR_OBJECTS, type ArObjectId } from '../ar.generated';
import { arSessionInit, type ArSessionHandle, type ArStartInput } from './arPilot';

/*
 * F4.9: the one lazy AR session, loaded only after the learner has allowed it in the app. The object is drawn at its true size
 * in metres and set down on the table where a reticle finds it (hit-test). The browser draws the device's view itself; this
 * module only draws the object and the reticle on top, and it keeps no image, sends nothing and stores nothing. Leaving AR
 * (the browser's own control, or the learner's end) releases the session, the animation loop and every GPU resource.
 */
const token = (name: string): string => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#808080';

/** The object's geometry in metres: the catalogue lists whole centimetres as width, height and depth. */
function objectGeometry(object: ArObjectId): BufferGeometry {
  const { shape, size } = AR_OBJECTS[object];
  const [width, height, depth] = size.map((side) => side / 100) as [number, number, number];
  return shape === 'box' ? new BoxGeometry(width, height, depth) : new CylinderGeometry(width / 2, width / 2, height, 32);
}

export async function startArSession({ xr, object, onEnd }: ArStartInput): Promise<ArSessionHandle> {
  const session = await xr.requestSession('immersive-ar', arSessionInit()) as unknown as XRSession;

  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local');
  const scene = new Scene();
  const camera = new PerspectiveCamera();
  scene.add(new HemisphereLight(0xffffff, 0x888888, 2), new DirectionalLight(0xffffff, 1.5));

  const geometry = objectGeometry(object);
  const material = new MeshStandardMaterial({ color: new Color(token('--sky')) });
  const body = new Mesh(geometry, material);
  body.visible = false;
  const lift = AR_OBJECTS[object].size[1] / 200;
  scene.add(body);

  const ringGeometry = new RingGeometry(0.06, 0.08, 32).rotateX(-Math.PI / 2);
  const ringMaterial = new MeshStandardMaterial({ color: new Color(token('--mint')) });
  const reticle = new Mesh(ringGeometry, ringMaterial);
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  let released = false;
  let hitSource: XRHitTestSource | null = null;
  const release = () => {
    if (released) return;
    released = true;
    renderer.setAnimationLoop(null);
    hitSource?.cancel();
    geometry.dispose();
    material.dispose();
    ringGeometry.dispose();
    ringMaterial.dispose();
    renderer.dispose();
    onEnd();
  };
  session.addEventListener('end', release, { once: true });
  session.addEventListener('select', () => {
    if (!reticle.visible) return;
    body.position.setFromMatrixPosition(reticle.matrix);
    body.position.y += lift;
    body.visible = true;
  });

  await renderer.xr.setSession(session);
  const viewer = await session.requestReferenceSpace('viewer');
  hitSource = (await session.requestHitTestSource?.({ space: viewer })) ?? null;

  renderer.setAnimationLoop((_time, frame) => {
    const space = renderer.xr.getReferenceSpace();
    const hit = frame && hitSource && space ? frame.getHitTestResults(hitSource)[0]?.getPose(space) : undefined;
    reticle.visible = hit !== undefined;
    if (hit) reticle.matrix = new Matrix4().fromArray(hit.transform.matrix);
    renderer.render(scene, camera);
  });

  return { end: () => { void session.end().catch(release); } };
}
