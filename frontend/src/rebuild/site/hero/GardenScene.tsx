import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { LatheGeometry, MeshStandardMaterial, SphereGeometry, Vector2, type Group, type Mesh, type Texture } from 'three';
import type { CharacterAction } from '@/components/characters/control/types';
import { Character3D } from '@/tutor-scene/Character3D';
import { FlatGroundProvider } from '@/tutor-scene/ground';
import { SceneCanvas } from '@/tutor-scene/SceneCanvas';
import { SceneLighting } from '@/tutor-scene/SceneLighting';
import type { QualitySettings } from '@/tutor-scene/quality';
import { useTheme } from '@/theme/useTheme';
import { ContactPools, LOOP, StageFloor, TimeProvider, useReflections, type TimeRef } from './heroProps';

/*
 * The SOURCE of the landing's problem-section video, not something the site runs (the hero's method, a different story).
 *
 * "By age 7, money habits are already forming", told as a small scene: Dina plants a seed, Liruf waters it, and the seedling between
 * them grows, leaf pair by leaf pair, into a small tree that bears golden seeds; they cheer when it does. What is planted early grows.
 * Everything is a function of the scene's clock inside one LOOP, so `scripts/render-problem-video.mjs` can play it on a virtual clock,
 * frame by frame, and the last seconds (the tree sinking back into the ground) fade into the first.
 */

const FOV = 30;
const BOX = { width: 5.6, height: 3.4, centerY: 1.45 };
const SOIL = [0, 0.18, 0.1] as const;

const ease = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
const window01 = (t: number, from: number, to: number) => ease((t - from) / (to - from));

/** When each character acts: Dina points as she throws a seed, Liruf nods as he starts to pour, both cheer when the tree is done. */
const EVENTS: readonly { t: number; who: 'liruf' | 'dina'; action: CharacterAction }[] = [
  { t: 1.0, who: 'dina', action: 'point' }, { t: 2.8, who: 'liruf', action: 'nod' },
  { t: 6.0, who: 'dina', action: 'point' }, { t: 7.8, who: 'liruf', action: 'nod' },
  { t: 11.0, who: 'dina', action: 'point' }, { t: 12.8, who: 'liruf', action: 'nod' },
  { t: 20.5, who: 'dina', action: 'celebrate' }, { t: 20.7, who: 'liruf', action: 'celebrate' },
];
/** Seeds thrown into the soil: start time, seconds in the air. */
const THROWS = [{ at: 1.3, air: 1.1 }, { at: 6.3, air: 1.1 }, { at: 11.3, air: 1.1 }] as const;
/** Pouring windows: from, to (seconds). */
const POURS = [[3.0, 5.2], [8.0, 10.2], [13.0, 15.2]] as const;

function Clock({ time }: { time: TimeRef }) {
  useFrame((_, delta) => { time.current += Math.min(delta, 0.05); });
  return null;
}

function Rig() {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  useFrame(() => {
    const aspect = size.width / Math.max(1, size.height);
    const tan = Math.tan((FOV * Math.PI) / 360);
    const distance = Math.max(BOX.width / 2 / (tan * aspect), BOX.height / 2 / tan);
    camera.position.set(0, BOX.centerY + 0.25, distance);
    camera.lookAt(0, BOX.centerY, 0);
    if ('fov' in camera) (camera as { fov: number }).fov = FOV;
    camera.updateProjectionMatrix();
  });
  return null;
}

/** The two characters: each plays its scheduled actions on the loop's clock. */
function Cast({ settings, time }: { settings: QualitySettings; time: TimeRef }) {
  const [turn, setTurn] = useState({ index: -1, liruf: 0, dina: 0 });
  useFrame(() => {
    const t = time.current % LOOP;
    let index = -1;
    EVENTS.forEach((event, i) => { if (t >= event.t) index = i; });
    if (index !== turn.index) setTurn((was) => (index < 0 ? { ...was, index } : { ...was, index, [EVENTS[index]!.who]: was[EVENTS[index]!.who] + 1 }));
  });
  const current = turn.index >= 0 ? EVENTS[turn.index]! : null;
  const t = time.current % LOOP;
  const live = (who: 'liruf' | 'dina') => (current && current.who === who && t < current.t + 2.2 ? current.action : 'idle');
  return <>
    <ContactPools xs={[-1.45, 1.45]} />
    <Character3D id="liruf" settings={settings} position={[-1.45, 0, 0]} rotation={0.7} emotion="happy" action={live('liruf')} actionKey={turn.liruf} shadow={false} mouth={false} instanced />
    <Character3D id="dina" settings={settings} position={[1.45, 0, 0]} rotation={-0.7} emotion="excited" action={live('dina')} actionKey={turn.dina} shadow={false} mouth={false} instanced />
  </>;
}

function Ready() {
  useEffect(() => { document.body.dataset.heroReady = '1'; return () => { delete document.body.dataset.heroReady; }; }, []);
  return null;
}

/** A golden almond (the platform's unit), without the spin the hero's carries. */
function SeedPip({ reflections, scale = 1 }: { reflections: Texture | null; scale?: number }) {
  const geometry = useMemo(() => {
    const profile = [[0, -0.27], [0.1, -0.255], [0.19, -0.19], [0.235, -0.07], [0.235, 0.06], [0.185, 0.18], [0.1, 0.285], [0.035, 0.335], [0, 0.345]].map(([x, y]) => new Vector2(x, y));
    return new LatheGeometry(profile, 28).scale(1, 1, 0.62);
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} scale={scale}><meshStandardMaterial color="#f3b53b" metalness={1} roughness={0.3} envMap={reflections} envMapIntensity={1.5} /></mesh>;
}

/** The seeds Dina throws: a short arc from her hand into the soil, spinning, gone on arrival. */
function Throws({ time, reflections }: { time: TimeRef; reflections: Texture | null }) {
  const refs = useRef<(Group | null)[]>([]);
  useFrame(() => {
    const t = time.current % LOOP;
    THROWS.forEach((throwing, i) => {
      const group = refs.current[i];
      if (!group) return;
      const u = (t - throwing.at) / throwing.air;
      group.visible = u >= 0 && u <= 1;
      if (!group.visible) return;
      group.position.set(1.05 + (SOIL[0] - 1.05) * u, 1.25 + (SOIL[1] - 1.25) * u + Math.sin(Math.PI * u) * 0.9, 0.35 + (SOIL[2] - 0.35) * u);
      group.rotation.set(u * 9, u * 5, 0.7);
    });
  });
  return <>{THROWS.map((_, i) => <group key={i} ref={(node) => { refs.current[i] = node; }} visible={false}><SeedPip reflections={reflections} scale={0.55} /></group>)}</>;
}

/** The watering can Liruf pours from: it appears, tilts toward the seedling while water falls, and goes. */
function Watering({ time }: { time: TimeRef }) {
  const can = useRef<Group>(null);
  const drops = useRef<(Mesh | null)[]>([]);
  const dropGeometry = useMemo(() => new SphereGeometry(0.045, 10, 8).scale(0.8, 1.25, 0.8), []);
  const waterMaterial = useMemo(() => new MeshStandardMaterial({ color: '#7cc4ff', emissive: '#3b8fe0', emissiveIntensity: 0.5, roughness: 0.2, transparent: true, opacity: 0.9 }), []);
  const canMaterial = useMemo(() => new MeshStandardMaterial({ color: '#5c55fd', roughness: 0.45, metalness: 0.1 }), []);
  useEffect(() => () => { dropGeometry.dispose(); waterMaterial.dispose(); canMaterial.dispose(); }, [dropGeometry, waterMaterial, canMaterial]);
  useFrame(() => {
    const t = time.current % LOOP;
    let strength = 0;
    for (const [from, to] of POURS) strength = Math.max(strength, window01(t, from - 0.4, from + 0.3) * (1 - window01(t, to - 0.3, to + 0.4)));
    if (can.current) {
      can.current.visible = strength > 0.01;
      can.current.scale.setScalar(0.6 + 0.4 * strength);
      can.current.rotation.z = -0.15 - 0.55 * strength;
      can.current.position.set(-0.75, 1.5, 0.25);
    }
    drops.current.forEach((drop, i) => {
      if (!drop) return;
      const phase = ((t * 1.7 + i / drops.current.length) % 1);
      drop.visible = strength > 0.6;
      // From the spout (about 0.5 right and 0.1 up of the can) down onto the soil.
      drop.position.set(-0.2 + Math.sin(i * 2.1) * 0.05, 1.35 - phase * (1.35 - SOIL[1]), 0.25);
      drop.scale.setScalar(0.7 + 0.3 * (1 - phase));
    });
  });
  return <>
    <group ref={can} visible={false}>
      <mesh material={canMaterial} position={[0, 0, 0]}><cylinderGeometry args={[0.28, 0.32, 0.4, 20]} /></mesh>
      <mesh material={canMaterial} position={[0.42, 0.1, 0]} rotation={[0, 0, -0.9]}><cylinderGeometry args={[0.04, 0.07, 0.55, 10]} /></mesh>
      <mesh material={canMaterial} position={[-0.3, 0.02, 0]}><torusGeometry args={[0.2, 0.035, 8, 20, Math.PI]} /></mesh>
    </group>
    {Array.from({ length: 9 }, (_, i) => <mesh key={i} ref={(node) => { drops.current[i] = node; }} geometry={dropGeometry} material={waterMaterial} visible={false} />)}
  </>;
}

/** The soil and the seedling: a stem that grows, leaf pairs that open one after another, a crown, and golden seeds on the branches at the end. */
function Tree({ time, reflections }: { time: TimeRef; reflections: Texture | null }) {
  const root = useRef<Group>(null);
  const stem = useRef<Mesh>(null);
  const leaves = useRef<(Mesh | null)[]>([]);
  const fruit = useRef<(Group | null)[]>([]);
  const green = useMemo(() => new MeshStandardMaterial({ color: '#43c07a', roughness: 0.55 }), []);
  const dark = useMemo(() => new MeshStandardMaterial({ color: '#2e9d5f', roughness: 0.6 }), []);
  const soil = useMemo(() => new MeshStandardMaterial({ color: '#8a5a2b', roughness: 0.9 }), []);
  useEffect(() => () => { green.dispose(); dark.dispose(); soil.dispose(); }, [green, dark, soil]);
  /** Leaf pairs: [height on the stem as a fraction, growth at which it opens, side]. */
  const LEAVES = [[0.38, 0.12, 1], [0.38, 0.12, -1], [0.62, 0.3, 1], [0.62, 0.3, -1], [0.84, 0.5, 1], [0.84, 0.5, -1], [1, 0.68, 1], [1, 0.68, -1]] as const;
  useFrame(() => {
    const t = time.current % LOOP;
    // Slow growth from the first seed to a small tree, a hold, then it sinks back so the loop can start again.
    const grow = window01(t, 2.4, 20) * (1 - window01(t, 26.5, 29.2));
    const height = 0.12 + 1.5 * grow;
    if (stem.current) { stem.current.scale.y = height; stem.current.position.y = SOIL[1] + height / 2; }
    LEAVES.forEach(([at, opens, side], i) => {
      const leaf = leaves.current[i];
      if (!leaf) return;
      const open = ease((grow - opens) / 0.16);
      leaf.visible = open > 0.01;
      const size = Math.max(0.001, open) * (0.85 + 0.3 * at);
      leaf.scale.set(1.7 * size, 0.28 * size, 0.95 * size); // a flattened almond of a leaf, not a ball
      leaf.position.set(side * 0.3 * (0.6 + 0.4 * at), SOIL[1] + height * at, 0);
      leaf.rotation.z = side * (0.45 - 0.1 * at);
    });
    fruit.current.forEach((group, i) => {
      if (!group) return;
      const pop = window01(t, 18.4 + i * 0.5, 19.2 + i * 0.5) * (1 - window01(t, 26.5, 28));
      group.visible = pop > 0.01;
      group.scale.setScalar(Math.max(0.001, pop) * (1 + 0.08 * Math.sin(t * 3 + i)));
    });
    if (root.current) root.current.rotation.z = Math.sin(t * 1.3) * 0.018 * grow;
  });
  return <group position={[SOIL[0], 0, SOIL[2]]}>
    <mesh material={soil} position={[0, 0.06, 0]} scale={[1, 0.38, 0.8]}><sphereGeometry args={[0.52, 22, 14]} /></mesh>
    <group ref={root} position={[0, -SOIL[1], 0]}>
      <mesh ref={stem} material={dark} position={[0, SOIL[1], 0]}><cylinderGeometry args={[0.035, 0.06, 1, 10]} /></mesh>
      {LEAVES.map((_, i) => <mesh key={i} ref={(node) => { leaves.current[i] = node; }} material={i % 2 === 0 ? green : dark} visible={false}><sphereGeometry args={[0.2, 14, 10]} /></mesh>)}
      {[[-0.42, 1.55], [0.4, 1.7], [0.02, 1.95]].map(([x, y], i) => <group key={i} ref={(node) => { fruit.current[i] = node; }} position={[x!, y!, 0.1]} visible={false}><SeedPip reflections={reflections} scale={0.5} /></group>)}
    </group>
  </group>;
}

function World({ settings }: { settings: QualitySettings }) {
  const time = useRef(0);
  const reflections = useReflections();
  const { isDark } = useTheme();
  useEffect(() => { (window as unknown as { __heroClock?: TimeRef }).__heroClock = time; }, [time]);
  return <TimeProvider value={time}>
    <Clock time={time} />
    <Rig />
    <SceneLighting settings={{ ...settings, shadows: false }} backdrop="auto" />
    <ambientLight intensity={isDark ? 1.15 : 0.3} color="#dfe0ff" />
    <directionalLight position={[-3, 3.5, -3]} intensity={0.9} color="#9b94ff" />
    <StageFloor radius={3.6} />
    <FlatGroundProvider>
      <Suspense fallback={null}><Cast settings={settings} time={time} /><Ready /></Suspense>
    </FlatGroundProvider>
    <Tree time={time} reflections={reflections} />
    <Throws time={time} reflections={reflections} />
    <Watering time={time} />
  </TimeProvider>;
}

export default function GardenScene() {
  const [settings, setSettings] = useState<QualitySettings | null>(null);
  return <SceneCanvas className="lf-scene-fill" interactive={false} onSettings={setSettings} camera={{ position: [0, BOX.centerY, 10], fov: FOV }}>
    {settings ? <World settings={settings} /> : null}
  </SceneCanvas>;
}
