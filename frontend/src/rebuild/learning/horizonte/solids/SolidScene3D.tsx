import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useThree } from '@react-three/fiber';
import { BufferGeometry, Float32BufferAttribute, Color, type LineSegments } from 'three';
import { SceneCanvas } from '../../../../tutor-scene/SceneCanvas';
import type { QualitySettings } from '../../../../tutor-scene/quality';
import { faceNormal, solidMesh, type SolidId, type Vec3 } from './model.generated';
import { PERSPECTIVE_LENS, SCENE_SIZE, cameraPose, composeScene, viewBasis, type LabelMode, type SolidView } from './projection.generated';

/*
 * OD-35: the one lazy 3D viewer. Budget: one body mesh, two line passes (3 draw calls), under 200 triangles, no shadows,
 * a cut between the fixed views (never a tween), HTML labels laid out by composeScene with the matching perspective lens.
 * It rides the shared tutor-scene canvas and its adaptive governor; it never touches the Mentor stage.
 */
/*
 * The design tokens live on the `.lf-rebuild` host, never on <html>: reading them from documentElement returned an empty
 * string and painted every solid in the fallback grey in both themes. The palette is read from the canvas host (which sits
 * inside `.lf-rebuild`), the edge pass uses --content (the token that flips with the theme, not the constant --ink), and it is
 * read again when the host's data-theme changes. When a token is missing (a host outside `.lf-rebuild`), the host's own
 * computed text colour stands in, so no colour literal lives in this file.
 */
interface Palette { flat: string; curved: string; edge: string; muted: string }
function readPalette(host: Element): Palette {
  const styles = getComputedStyle(host);
  const own = styles.color;
  const token = (name: string): string => styles.getPropertyValue(name).trim() || own;
  return { flat: token('--sky'), curved: token('--mint'), edge: token('--content'), muted: token('--content-muted') };
}

function usePalette(host: RefObject<HTMLElement | null>): Palette | null {
  const [palette, setPalette] = useState<Palette | null>(null);
  useLayoutEffect(() => {
    const node = host.current;
    if (!node) return undefined;
    const read = () => setPalette(readPalette(node));
    read();
    const themed = node.closest('.lf-rebuild');
    if (!themed || typeof MutationObserver === 'undefined') return undefined;
    const observer = new MutationObserver(read);
    observer.observe(themed, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    return () => observer.disconnect();
  }, [host]);
  return palette;
}

function bodyGeometry(solid: SolidId, palette: Palette): BufferGeometry {
  const mesh = solidMesh(solid);
  const flat = new Color(palette.flat);
  const curved = new Color(palette.curved);
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  for (const face of mesh.faces) {
    const outward = faceNormal(mesh, face);
    const paint = face.kind === 'curved' ? curved : flat;
    for (let at = 1; at < face.corners.length - 1; at += 1) {
      for (const corner of [face.corners[0]!, face.corners[at]!, face.corners[at + 1]!]) {
        const point = mesh.vertices[corner]!;
        const normal: Vec3 = face.kind === 'curved' ? [point[0], 0, point[2]] : outward;
        const length = Math.hypot(normal[0], normal[1], normal[2]) || 1;
        positions.push(point[0], point[1], point[2]);
        normals.push(normal[0] / length, normal[1] / length, normal[2] / length);
        colors.push(paint.r, paint.g, paint.b);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geometry;
}

function edgeGeometry(solid: SolidId): BufferGeometry {
  const mesh = solidMesh(solid);
  const positions: number[] = [];
  for (const edge of mesh.edges) {
    if (edge.kind === 'smooth') continue;
    positions.push(...mesh.vertices[edge.a]!, ...mesh.vertices[edge.b]!);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  return geometry;
}

function CameraCut({ view }: { view: SolidView }) {
  const camera = useThree((state) => state.camera);
  useLayoutEffect(() => {
    const pose = cameraPose(view);
    camera.position.set(pose.position[0], pose.position[1], pose.position[2]);
    camera.up.set(pose.up[0], pose.up[1], pose.up[2]);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }, [camera, view]);
  return null;
}

function Lights({ view }: { view: SolidView }) {
  const basis = viewBasis(view);
  const at = [0, 1, 2].map((axis) => 5 * (0.3 * basis.right[axis]! + 0.55 * basis.up[axis]! + 0.78 * basis.toward[axis]!)) as [number, number, number];
  return <>
    <ambientLight intensity={0.85} />
    <directionalLight position={at} intensity={1.1} />
  </>;
}

function SolidBody({ solid, palette }: { solid: SolidId; palette: Palette }) {
  const body = useMemo(() => bodyGeometry(solid, palette), [solid, palette]);
  const edges = useMemo(() => edgeGeometry(solid), [solid]);
  useEffect(() => () => { body.dispose(); }, [body]);
  useEffect(() => () => { edges.dispose(); }, [edges]);
  const dashed = (line: LineSegments) => { line.computeLineDistances(); };
  return <>
    <mesh geometry={body}>
      <meshLambertMaterial vertexColors polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
    </mesh>
    <lineSegments geometry={edges} onUpdate={dashed} renderOrder={1}>
      <lineDashedMaterial color={palette.muted} dashSize={0.07} gapSize={0.06} depthTest={false} />
    </lineSegments>
    <lineSegments geometry={edges} renderOrder={2}>
      <lineBasicMaterial color={palette.edge} />
    </lineSegments>
  </>;
}

export interface SolidScene3DProps { solid: SolidId; view: SolidView; labels: LabelMode; name: string; onYield: () => void }

export default function SolidScene3D({ solid, view, labels, name, onYield }: SolidScene3DProps) {
  const [camera] = useState(() => ({ position: [...cameraPose(view).position] as [number, number, number], fov: PERSPECTIVE_LENS.mode === 'perspective' ? PERSPECTIVE_LENS.fovDeg : 24 }));
  const settled = useCallback((quality: QualitySettings) => { if (quality.tier === 'low') onYield(); }, [onYield]);
  const host = useRef<HTMLDivElement>(null);
  const palette = usePalette(host);
  const overlay = useMemo(() => composeScene(solid, view, { lens: PERSPECTIVE_LENS, labels }).labels, [solid, view, labels]);
  return <div ref={host} className="lf-solid-canvas" role="img" aria-label={name}>
    {palette ? <SceneCanvas camera={camera} interactive={false} onSettings={settled}>
      <CameraCut view={view} />
      <Lights view={view} />
      <SolidBody solid={solid} palette={palette} />
    </SceneCanvas> : null}
    {overlay.length > 0 ? <div className="lf-solid-labels" aria-hidden="true" data-copy-role="data">
      {overlay.map((label) => <span key={label.id} data-hidden={label.hidden ? 'true' : 'false'}
        style={{ left: `${(label.x / SCENE_SIZE) * 100}%`, top: `${(label.y / SCENE_SIZE) * 100}%` }}>{label.text}</span>)}
    </div> : null}
  </div>;
}
