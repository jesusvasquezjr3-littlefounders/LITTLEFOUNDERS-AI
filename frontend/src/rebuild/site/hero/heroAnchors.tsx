import { Children, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending, BoxGeometry, BufferGeometry, CatmullRomCurve3, ConeGeometry, CylinderGeometry, DoubleSide, ExtrudeGeometry, Float32BufferAttribute,
  Group, LatheGeometry, MeshStandardMaterial, Shape, SphereGeometry, TubeGeometry, Vector2, Vector3, type Texture,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { loopFreq, radialTexture, turnsToRadians, useTime } from './heroProps';
import { painted, paintedMaterial, type PaintedPart } from './painted';

/*
 * What circles the two Mentors: a few lanes of small things about learning,
 * play and money, each lane at its own height. Every item in a lane keeps the
 * same angular gap and the same speed, and the lanes are a full prop apart
 * vertically, so nothing ever overtakes, touches or overlaps another.
 * Each prop is ONE draw call (see painted.ts); metal and paper keep their own.
 */

const TAU = Math.PI * 2;

/** One lane: its children are spaced evenly around an ellipse and carried round together. */
/** `turns` is how many full revolutions the lane makes in one loop of the video. */
export function Orbit({ rx, rz, y, turns, phase = 0, lift = 0.42, children }: { rx: number; rz: number; y: number; turns: number; phase?: number; lift?: number; children: ReactNode }) {
  const time = useTime();
  const group = useRef<Group>(null);
  const items = Children.toArray(children);
  useFrame(() => {
    const t = time.current;
    group.current?.children.forEach((slot, i) => {
      const angle = phase + (i / items.length) * TAU + t * turnsToRadians(turns);
      // The far side of the ring rides higher than the near side, so two items at the same x never stack in the picture.
      slot.position.set(Math.cos(angle) * rx, y - Math.sin(angle) * lift + Math.sin(t * loopFreq(1.1) + i * 1.7) * 0.04, Math.sin(angle) * rz);
    });
  });
  return <group ref={group}>{items.map((item, i) => <group key={i}>{item}</group>)}</group>;
}

/** Turns an item in place, around a vertical axis, with an optional resting tilt. */
function Spin({ turns, tilt = [0, 0, 0], scale = 1, children }: { turns: number; tilt?: [number, number, number]; scale?: number; children: ReactNode }) {
  const time = useTime();
  const turn = useRef<Group>(null);
  useFrame(() => { if (turn.current) turn.current.rotation.y = time.current * turnsToRadians(turns); });
  return <group rotation={tilt} scale={scale}><group ref={turn}>{children}</group></group>;
}

/** Builds a prop's merged geometry once and frees it on unmount. */
function usePainted(build: () => PaintedPart[]) {
  const geometry = useMemo(() => painted(build()), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/* ---------------------------------------------------------------------- seeds */

/** The platform's own unit (OD-41): a plump golden seed, one metal mesh, turning in place. Money-shaped things are not in this scene. */
export function Seed({ reflections }: { reflections: Texture | null }) {
  const geometry = useMemo(() => {
    // An almond: round belly, a soft point, flattened a little front to back: a pip, never a drop.
    const profile = [[0, -0.27], [0.1, -0.255], [0.19, -0.19], [0.235, -0.07], [0.235, 0.06], [0.185, 0.18], [0.1, 0.285], [0.035, 0.335], [0, 0.345]].map(([x, y]) => new Vector2(x, y));
    return new LatheGeometry(profile, 32).scale(1, 1, 0.62);
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <Spin turns={5} tilt={[0.5, 0, 0.7]} scale={1.05}>
    <mesh geometry={geometry}><meshStandardMaterial color="#f3b53b" metalness={1} roughness={0.3} envMap={reflections} envMapIntensity={1.5} /></mesh>
  </Spin>;
}

/** A sprout: a stem and two leaves, painted flat in one draw call. What a seed becomes when it is saved. */
export function Sprout() {
  const geometry = usePainted(() => {
    const leaf = (side: 1 | -1) => new SphereGeometry(0.17, 14, 10).scale(1.5, 0.22, 0.85).rotateZ(side * 0.5).translate(side * 0.2, 0.2, 0);
    return [
      [new CylinderGeometry(0.05, 0.065, 0.42, 12).translate(0, -0.05, 0), '#2e9d5f'],
      [leaf(1), '#43c07a'], [leaf(-1), '#2e9d5f'],
      [new SphereGeometry(0.13, 16, 12).scale(1.1, 0.7, 0.9).translate(0, -0.3, 0), '#a67c3c'],
    ];
  });
  return <Spin turns={3} tilt={[0.2, 0, 0.1]} scale={1.2}><mesh geometry={geometry} material={paintedMaterial} /></Spin>;
}

/* ------------------------------------------------------------------- learning */

export function Book() {
  const geometry = usePainted(() => {
    const tilt = 0.16;
    const page = (side: 1 | -1) => new BoxGeometry(0.62, 0.05, 0.86).translate(side * 0.34, 0.045, 0).rotateZ(side * -tilt);
    const cover = (side: 1 | -1) => new BoxGeometry(0.68, 0.035, 0.92).translate(side * 0.36, 0, 0).rotateZ(side * -tilt);
    const lines: PaintedPart[] = [];
    for (const side of [1, -1] as const) for (let i = 0; i < 6; i++) lines.push([new BoxGeometry(0.38, 0.004, 0.028).translate(side * 0.36, 0.077, -0.27 + i * 0.1).rotateZ(side * -tilt), '#b9b08c']);
    return [[cover(1), '#5c55fd'], [cover(-1), '#5c55fd'], [new BoxGeometry(0.06, 0.05, 0.92).translate(0, -0.025, 0), '#5c55fd'], [page(1), '#f7f1de'], [page(-1), '#f7f1de'], ...lines];
  });
  return <Spin turns={3} tilt={[0.6, 0, 0]} scale={0.62}><mesh geometry={geometry} material={paintedMaterial} /></Spin>;
}

export function Bulb() {
  const time = useTime();
  const geometry = usePainted(() => [
    [new SphereGeometry(0.3, 24, 18).translate(0, 0.1, 0), '#ffe58a'],
    [new CylinderGeometry(0.15, 0.1, 0.16, 20).translate(0, -0.2, 0), '#ffe58a'],
    [new CylinderGeometry(0.115, 0.115, 0.1, 20).translate(0, -0.34, 0), '#b9bdd0'],
    [new CylinderGeometry(0.1, 0.07, 0.09, 20).translate(0, -0.43, 0), '#8c90a8'],
  ]);
  const material = useMemo(() => new MeshStandardMaterial({ vertexColors: true, emissive: '#ffc933', emissiveIntensity: 0.55, roughness: 0.25 }), []);
  const halo = useMemo(() => radialTexture('rgba(255,224,120,0.8)', 'rgba(255,200,60,0)'), []);
  useEffect(() => () => { material.dispose(); halo.dispose(); }, [material, halo]);
  useFrame(() => { material.emissiveIntensity = 0.55 + Math.sin(time.current * loopFreq(2.2)) * 0.15; });
  return <group scale={0.62}>
    <mesh position-y={0.04} renderOrder={4}><planeGeometry args={[1.5, 1.5]} /><meshBasicMaterial map={halo} transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} opacity={0.5} /></mesh>
    <mesh geometry={geometry} material={material} />
  </group>;
}

export function Cap() {
  const geometry = usePainted(() => [
    [new BoxGeometry(0.7, 0.045, 0.7).rotateY(Math.PI / 4).translate(0, 0.1, 0), '#4a52b8'],
    [new CylinderGeometry(0.2, 0.22, 0.22, 20).translate(0, -0.04, 0), '#5961d6'],
    [new CylinderGeometry(0.012, 0.012, 0.22, 6).rotateZ(0.15).translate(0.2, 0, 0.2), '#ffc53d'],
    [new SphereGeometry(0.04, 10, 8).translate(0.2, -0.13, 0.2), '#ffc53d'],
  ]);
  return <Spin turns={4} tilt={[0.4, 0, 0]} scale={0.7}><mesh geometry={geometry} material={paintedMaterial} /></Spin>;
}

function starGeometry() {
  const shape = new Shape();
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? 0.34 : 0.15, angle = (i / 10) * TAU + Math.PI / 2;
    if (i === 0) shape.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius); else shape.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  shape.closePath();
  const geometry = new ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 });
  geometry.translate(0, 0, -0.05);
  return geometry;
}

export function Star({ reflections }: { reflections: Texture | null }) {
  const geometry = useMemo(starGeometry, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <Spin turns={5} tilt={[0, 0, 0.12]} scale={0.9}>
    <mesh geometry={geometry}><meshStandardMaterial color="#ffc53d" metalness={0.85} roughness={0.28} envMap={reflections} envMapIntensity={1.4} emissive="#ff9d00" emissiveIntensity={0.2} /></mesh>
  </Spin>;
}

/* ------------------------------------------------------------------------ play */

export function Block({ color }: { color: string }) {
  const geometry = usePainted(() => [[new RoundedBoxGeometry(0.36, 0.36, 0.36, 3, 0.05), color]]);
  return <Spin turns={3} tilt={[0.4, 0, 0.3]}><mesh geometry={geometry} material={paintedMaterial} /></Spin>;
}

export function Rocket() {
  const geometry = usePainted(() => {
    const body = new LatheGeometry([[0.001, -0.32], [0.12, -0.3], [0.17, -0.12], [0.17, 0.1], [0.12, 0.26], [0.001, 0.38]].map(([x, y]) => new Vector2(x, y)), 20);
    const fins: PaintedPart[] = [0, 1, 2].map((i) => [new BoxGeometry(0.02, 0.2, 0.15).rotateY(-(i / 3) * TAU).translate(Math.cos((i / 3) * TAU) * 0.18, -0.24, Math.sin((i / 3) * TAU) * 0.18), '#ff5c6c']);
    return [
      [body, '#f4f6ff'], [new ConeGeometry(0.1, 0.2, 18).translate(0, 0.34, 0), '#ff5c6c'], ...fins,
      [new SphereGeometry(0.07, 12, 8).translate(0, 0.06, 0.15), '#4da3ff'], [new ConeGeometry(0.09, 0.22, 14).rotateX(Math.PI).translate(0, -0.44, 0), '#ffb21c'],
    ];
  });
  return <group rotation-z={-0.65} scale={0.9}><Spin turns={4}><mesh geometry={geometry} material={paintedMaterial} /></Spin></group>;
}

export function Balloon() {
  const geometry = usePainted(() => [
    [new SphereGeometry(0.25, 24, 16).scale(1, 1.2, 1), '#ff5c8a'],
    [new ConeGeometry(0.04, 0.07, 10).rotateX(Math.PI).translate(0, -0.31, 0), '#ff5c8a'],
    [new TubeGeometry(new CatmullRomCurve3([new Vector3(0, -0.3, 0), new Vector3(0.05, -0.45, 0), new Vector3(-0.04, -0.6, 0), new Vector3(0.03, -0.78, 0)]), 14, 0.004, 4), '#ffffff'],
  ]);
  return <Spin turns={2} scale={0.95}><mesh geometry={geometry} material={paintedMaterial} /></Spin>;
}

export function Controller() {
  const geometry = usePainted(() => [
    [new RoundedBoxGeometry(0.62, 0.3, 0.16, 3, 0.07), '#6a63ff'],
    [new RoundedBoxGeometry(0.2, 0.34, 0.16, 3, 0.07).rotateZ(0.25).translate(-0.27, -0.16, 0), '#6a63ff'],
    [new RoundedBoxGeometry(0.2, 0.34, 0.16, 3, 0.07).rotateZ(-0.25).translate(0.27, -0.16, 0), '#6a63ff'],
    [new BoxGeometry(0.15, 0.045, 0.02).translate(-0.18, 0.02, 0.085), '#f4f6ff'],
    [new BoxGeometry(0.045, 0.15, 0.02).translate(-0.18, 0.02, 0.085), '#f4f6ff'],
    [new SphereGeometry(0.04, 10, 8).translate(0.2, 0.05, 0.09), '#ffd23f'],
    [new SphereGeometry(0.04, 10, 8).translate(0.12, -0.03, 0.09), '#ff6b6b'],
  ]);
  return <Spin turns={4} tilt={[0.5, 0, 0.1]} scale={0.95}><mesh geometry={geometry} material={paintedMaterial} /></Spin>;
}

export function PaperPlane() {
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    const nose = [0, 0, 0.5], left = [-0.32, 0.07, -0.3], right = [0.32, 0.07, -0.3], keel = [0, -0.1, -0.3];
    g.setAttribute('position', new Float32BufferAttribute([...nose, ...left, ...keel, ...nose, ...keel, ...right], 3));
    g.computeVertexNormals();
    return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <Spin turns={3} tilt={[0.2, 0, -0.25]} scale={0.8}>
    <mesh geometry={geometry}><meshStandardMaterial color="#ffffff" side={DoubleSide} roughness={0.7} /></mesh>
  </Spin>;
}

export function Note() {
  const geometry = usePainted(() => [
    [new SphereGeometry(0.09, 14, 10).scale(1.3, 0.9, 1).translate(-0.14, -0.2, 0), '#3ed6b4'],
    [new SphereGeometry(0.09, 14, 10).scale(1.3, 0.9, 1).translate(0.16, -0.26, 0), '#3ed6b4'],
    [new CylinderGeometry(0.018, 0.018, 0.46, 6).translate(-0.05, 0, 0), '#3ed6b4'],
    [new CylinderGeometry(0.018, 0.018, 0.46, 6).translate(0.25, -0.06, 0), '#3ed6b4'],
    [new BoxGeometry(0.34, 0.075, 0.03).rotateZ(-0.12).translate(0.1, 0.2, 0), '#3ed6b4'],
  ]);
  return <Spin turns={4} scale={0.95}><mesh geometry={geometry} material={paintedMaterial} /></Spin>;
}
