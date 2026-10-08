import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CanvasTexture, Color, LatheGeometry, MeshStandardMaterial, Quaternion, Vector2, Vector3, type Group, type Mesh } from 'three';
import type { CharacterAction, CharacterEmotion } from '../../mentor/session/vocabulary';
import { Character3D } from '@/tutor-scene/Character3D';
import { FlatGroundProvider } from '@/tutor-scene/ground';
import { SceneCanvas } from '@/tutor-scene/SceneCanvas';
import { SceneLighting } from '@/tutor-scene/SceneLighting';
import type { QualitySettings } from '@/tutor-scene/quality';
import { useTheme } from '@/theme/useTheme';

/*
 * The mini lesson's live stage (owner brief, 2026-10-07: Dina interactive and immersive as the lesson and its decisions advance).
 *
 * One real-time scene the lesson drives: Dina (the real model, her pose following the step), a glass jar that holds the seeds the
 * visitor has (each week's ten drops in as two seeds, buying the game takes five away), a bike on a pedestal that is grey until the
 * jar is full and then lights up and turns, and the game on sale floating in with its price until the visitor decides (Dina takes it,
 * or waves it away). The lesson's card says it in words; this shows it. A transparent canvas on the page itself: no frame. It is loaded
 * only when the section is near the viewport, pauses off screen (the shared SceneCanvas governs both), and the lesson falls back to
 * Dina's clips where real-time 3D cannot run. The bridge to the 3D engine is named in agent/tools/check-product-spec.mjs.
 */

export interface LessonStageState {
  /** Seeds in the jar (one seed is five of the lesson's ten-seed units), 0 to 20. */
  seeds: number;
  /** The bike is lit and turning: the goal is reached. */
  unlocked: boolean;
  /** The game on sale: not there, floating with its price, in Dina's hands, or waved away. */
  game: 'none' | 'offer' | 'taken' | 'gone';
  emotion: CharacterEmotion;
  action: CharacterAction;
  /** Changes whenever Dina should play her action again. */
  actionKey: number;
}

const FOV = 30;
const BOX = { width: 6.0, height: 3.7, centerY: 1.4 };
const JAR = { x: 0.5, z: 0.1, radius: 0.54, height: 1.45 };
const BIKE = { x: 1.95, z: -0.3 };
const DINA_X = -1.3;
const CAPACITY = 20;

const damp = (current: number, target: number, rate: number, dt: number) => current + (target - current) * (1 - Math.exp(-rate * dt));

function Rig() {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  useFrame(() => {
    const aspect = size.width / Math.max(1, size.height);
    const tan = Math.tan((FOV * Math.PI) / 360);
    const distance = Math.max(BOX.width / 2 / (tan * aspect), BOX.height / 2 / tan);
    camera.position.set(0, BOX.centerY + 0.3, distance);
    camera.lookAt(0, BOX.centerY, 0);
    if ('fov' in camera) (camera as { fov: number }).fov = FOV;
    camera.updateProjectionMatrix();
  });
  return null;
}

/** A soft pool of light under the scene, and one dark pool under each thing standing on it. */
function Floor() {
  const glow = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const context = canvas.getContext('2d')!;
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(132,124,255,0.5)'); gradient.addColorStop(1, 'rgba(132,124,255,0)');
    context.fillStyle = gradient; context.fillRect(0, 0, 128, 128);
    return new CanvasTexture(canvas);
  }, []);
  useEffect(() => () => glow.dispose(), [glow]);
  return <mesh rotation-x={-Math.PI / 2} position-y={0.004} scale={[1, 0.5, 1]}>
    <circleGeometry args={[2.9, 64]} /><meshBasicMaterial map={glow} transparent depthWrite={false} toneMapped={false} />
  </mesh>;
}

/** A rod between two points (the bike's tubes). */
function Rod({ from, to, radius, material }: { from: [number, number, number]; to: [number, number, number]; radius: number; material: MeshStandardMaterial }) {
  const { position, quaternion, length } = useMemo(() => {
    const a = new Vector3(...from), b = new Vector3(...to);
    const direction = b.clone().sub(a);
    const length = direction.length();
    return { position: a.clone().add(b).multiplyScalar(0.5), quaternion: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize()), length };
  }, [from, to]);
  return <mesh position={position} quaternion={quaternion} material={material}><cylinderGeometry args={[radius, radius, length, 10]} /></mesh>;
}

const FRAME = {
  rear: [-0.55, 0.4, 0] as [number, number, number], front: [0.55, 0.4, 0] as [number, number, number], bottom: [-0.04, 0.34, 0] as [number, number, number],
  seat: [-0.32, 0.98, 0] as [number, number, number], head: [0.4, 0.94, 0] as [number, number, number], bars: [0.5, 1.12, 0] as [number, number, number],
};

/** The goal: a bike on a pedestal, grey until the jar is full, then violet, lit, and turning. */
function Bike({ unlocked }: { unlocked: boolean }) {
  const root = useRef<Group>(null);
  const progress = useRef(0);
  const frame = useMemo(() => new MeshStandardMaterial({ color: '#b9bdd0', roughness: 0.4, metalness: 0.2, emissive: '#5c55fd', emissiveIntensity: 0 }), []);
  const tyre = useMemo(() => new MeshStandardMaterial({ color: '#2a2d48', roughness: 0.7 }), []);
  const accent = useMemo(() => new MeshStandardMaterial({ color: '#ffc53d', roughness: 0.4, metalness: 0.4 }), []);
  const grey = useMemo(() => new Color('#b9bdd0'), []);
  const violet = useMemo(() => new Color('#5c55fd'), []);
  useEffect(() => () => { frame.dispose(); tyre.dispose(); accent.dispose(); }, [frame, tyre, accent]);
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    progress.current = damp(progress.current, unlocked ? 1 : 0, 3, dt);
    frame.color.copy(grey).lerp(violet, progress.current);
    frame.emissiveIntensity = progress.current * 0.35;
    if (!root.current) return;
    // It turns slowly while lit; locked, it rests facing the camera at an angle.
    root.current.rotation.y += (unlocked ? 0.9 : 0) * dt;
    if (!unlocked) root.current.rotation.y = damp(root.current.rotation.y % (Math.PI * 2), -0.5, 3, dt);
    root.current.position.y = 0.08 + progress.current * Math.abs(Math.sin(performance.now() / 700)) * 0.06;
    root.current.scale.setScalar(0.92 + 0.12 * progress.current);
  });
  return <group position={[BIKE.x, 0, BIKE.z]}>
    <mesh position-y={0.03}><cylinderGeometry args={[0.78, 0.85, 0.06, 40]} /><meshStandardMaterial color="#8f94b4" roughness={0.8} /></mesh>
    <group ref={root} position={[0, 0.08, 0]} rotation={[0, -0.5, 0]}>
      {[FRAME.rear, FRAME.front].map((hub, i) => <mesh key={i} position={[hub[0], hub[1], 0]} material={tyre}><torusGeometry args={[0.36, 0.05, 10, 32]} /></mesh>)}
      <Rod from={FRAME.bottom} to={FRAME.rear} radius={0.028} material={frame} />
      <Rod from={FRAME.bottom} to={FRAME.seat} radius={0.032} material={frame} />
      <Rod from={FRAME.rear} to={FRAME.seat} radius={0.026} material={frame} />
      <Rod from={FRAME.seat} to={FRAME.head} radius={0.03} material={frame} />
      <Rod from={FRAME.bottom} to={FRAME.head} radius={0.032} material={frame} />
      <Rod from={FRAME.head} to={FRAME.front} radius={0.028} material={frame} />
      <Rod from={FRAME.head} to={FRAME.bars} radius={0.026} material={frame} />
      <mesh position={[FRAME.seat[0] - 0.04, FRAME.seat[1] + 0.05, 0]} material={accent}><boxGeometry args={[0.26, 0.06, 0.12]} /></mesh>
      <mesh position={[FRAME.bars[0], FRAME.bars[1], 0]} rotation={[Math.PI / 2, 0, 0]} material={accent}><cylinderGeometry args={[0.025, 0.025, 0.4, 10]} /></mesh>
    </group>
  </group>;
}

/** The glass jar and the seeds in it. Seeds that are added fall in from above one after another; seeds that are taken away shrink out. */
function Jar({ seeds }: { seeds: number }) {
  const geometry = useMemo(() => {
    const profile = [[0, 0], [JAR.radius - 0.04, 0], [JAR.radius, 0.05], [JAR.radius, JAR.height], [JAR.radius - 0.03, JAR.height + 0.06]].map(([x, y]) => new Vector2(x, y));
    return new LatheGeometry(profile, 36);
  }, []);
  const seedGeometry = useMemo(() => {
    const profile = [[0, -0.27], [0.1, -0.255], [0.19, -0.19], [0.235, -0.07], [0.235, 0.06], [0.185, 0.18], [0.1, 0.285], [0.035, 0.335], [0, 0.345]].map(([x, y]) => new Vector2(x, y));
    return new LatheGeometry(profile, 20).scale(1, 1, 0.62);
  }, []);
  const seedMaterial = useMemo(() => new MeshStandardMaterial({ color: '#f2a900', metalness: 0.1, roughness: 0.5, emissive: '#a55f00', emissiveIntensity: 0.3 }), []);
  const refs = useRef<(Mesh | null)[]>([]);
  const state = useRef(Array.from({ length: CAPACITY }, () => ({ scale: 0, fall: 0, delay: 0, present: false })));
  const previous = useRef(0);
  useEffect(() => () => { geometry.dispose(); seedGeometry.dispose(); seedMaterial.dispose(); }, [geometry, seedGeometry, seedMaterial]);
  // Where seed i rests: four to a layer, each layer turned a little so they do not stack in a column.
  const rest = useMemo(() => Array.from({ length: CAPACITY }, (_, i) => {
    const layer = Math.floor(i / 4), slot = i % 4, angle = slot * (Math.PI / 2) + layer * 0.7;
    return new Vector3(Math.cos(angle) * 0.24, 0.24 + layer * 0.22, Math.sin(angle) * 0.24);
  }), []);
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const wanted = Math.max(0, Math.min(CAPACITY, seeds));
    if (wanted !== previous.current) {
      // Newly added seeds fall in one after another.
      state.current.forEach((seed, i) => { if (i >= previous.current && i < wanted) { seed.delay = (i - previous.current) * 0.16; seed.fall = 2.4; seed.present = true; } if (i >= wanted) seed.present = false; });
      previous.current = wanted;
    }
    state.current.forEach((seed, i) => {
      const mesh = refs.current[i];
      if (!mesh) return;
      if (seed.present) {
        if (seed.delay > 0) seed.delay -= dt;
        else { seed.fall = damp(seed.fall, 0, 7, dt); seed.scale = damp(seed.scale, 1, 9, dt); }
      } else seed.scale = damp(seed.scale, 0, 9, dt);
      mesh.visible = seed.scale > 0.02;
      mesh.scale.setScalar(Math.max(0.001, seed.scale) * 0.85);
      mesh.position.set(rest[i]!.x, rest[i]!.y + seed.fall, rest[i]!.z);
      mesh.rotation.set(0.5 + i * 0.7, i * 1.3, 0.8);
    });
  });
  return <group position={[JAR.x, 0, JAR.z]}>
    {Array.from({ length: CAPACITY }, (_, i) => <mesh key={i} ref={(node) => { refs.current[i] = node; }} geometry={seedGeometry} material={seedMaterial} visible={false} />)}
    <mesh geometry={geometry} renderOrder={2}>
      <meshStandardMaterial color="#cfe9ff" transparent opacity={0.2} roughness={0.08} metalness={0.1} side={2} depthWrite={false} />
    </mesh>
    <mesh position-y={JAR.height + 0.05} rotation-x={Math.PI / 2}><torusGeometry args={[JAR.radius - 0.015, 0.025, 8, 36]} /><meshStandardMaterial color="#e6f3ff" roughness={0.2} /></mesh>
  </group>;
}

/** The game on sale: it floats in with its price, goes to Dina's hands when it is bought, or flies off when it is not. */
function Game({ game }: { game: LessonStageState['game'] }) {
  const root = useRef<Group>(null);
  const shown = useRef(0);
  const body = useMemo(() => new MeshStandardMaterial({ color: '#4b94ff', roughness: 0.45, metalness: 0.1 }), []);
  const pad = useMemo(() => new MeshStandardMaterial({ color: '#2a2d48', roughness: 0.6 }), []);
  const tag = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#ffffff'; context.beginPath(); context.arc(64, 64, 60, 0, Math.PI * 2); context.fill();
    context.lineWidth = 8; context.strokeStyle = '#cc2e72'; context.stroke();
    context.fillStyle = '#111329'; context.font = '800 56px "Plus Jakarta Sans", sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText('25', 64, 68);
    return new CanvasTexture(canvas);
  }, []);
  useEffect(() => () => { body.dispose(); pad.dispose(); tag.dispose(); }, [body, pad, tag]);
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const group = root.current;
    if (!group) return;
    const offered = game === 'offer', taken = game === 'taken', gone = game === 'gone';
    shown.current = damp(shown.current, game === 'none' ? 0 : gone ? 0 : 1, 4, dt);
    const t = state.clock.elapsedTime;
    const target = taken ? new Vector3(DINA_X + 0.55, 1.15, 0.55) : gone ? new Vector3(1.4, 3.4, -0.4) : new Vector3(0.05, 2.45 + Math.sin(t * 2) * 0.07, 0.5);
    group.position.x = damp(group.position.x, target.x, 3, dt);
    group.position.y = damp(group.position.y, target.y, 3, dt);
    group.position.z = damp(group.position.z, target.z, 3, dt);
    group.rotation.y = Math.sin(t * 1.2) * 0.5;
    group.rotation.z = offered ? Math.sin(t * 1.6) * 0.08 : 0;
    group.scale.setScalar(Math.max(0.001, shown.current) * (taken ? 0.55 : 1));
    group.visible = shown.current > 0.02;
  });
  return <group ref={root} visible={false} position={[0.05, 3.2, 0.5]}>
    <mesh material={body}><boxGeometry args={[0.8, 0.28, 0.46]} /></mesh>
    <mesh material={body} position={[-0.46, -0.05, 0]}><sphereGeometry args={[0.22, 14, 10]} /></mesh>
    <mesh material={body} position={[0.46, -0.05, 0]}><sphereGeometry args={[0.22, 14, 10]} /></mesh>
    <mesh material={pad} position={[-0.26, 0.16, 0]}><cylinderGeometry args={[0.07, 0.07, 0.06, 12]} /></mesh>
    <mesh material={pad} position={[0.26, 0.16, 0]}><cylinderGeometry args={[0.07, 0.07, 0.06, 12]} /></mesh>
    <mesh position={[0.2, 0.15, 0.23]}><sphereGeometry args={[0.05, 10, 8]} /><meshStandardMaterial color="#ffd23f" roughness={0.4} /></mesh>
    <mesh position={[0.32, 0.15, 0.23]}><sphereGeometry args={[0.05, 10, 8]} /><meshStandardMaterial color="#ff5d73" roughness={0.4} /></mesh>
    <mesh position={[0, 0.58, 0.1]}><planeGeometry args={[0.55, 0.55]} /><meshBasicMaterial map={tag} transparent toneMapped={false} /></mesh>
  </group>;
}

function World({ settings, state }: { settings: QualitySettings; state: LessonStageState }) {
  const { isDark } = useTheme();
  return <>
    <Rig />
    <SceneLighting settings={{ ...settings, shadows: false }} backdrop="auto" />
    <ambientLight intensity={isDark ? 1.15 : 0.4} color="#dfe0ff" />
    <directionalLight position={[-3, 3.5, 3]} intensity={0.8} color="#ffffff" />
    <directionalLight position={[-3, 3.5, -3]} intensity={0.7} color="#9b94ff" />
    <Floor />
    <FlatGroundProvider>
      <Suspense fallback={null}>
        <Character3D id="dina" settings={settings} position={[DINA_X, 0, 0.2]} rotation={0.55} emotion={state.emotion} action={state.action} actionKey={state.actionKey}
          shadow={false} mouth={false} instanced />
      </Suspense>
    </FlatGroundProvider>
    <Jar seeds={state.seeds} />
    <Bike unlocked={state.unlocked} />
    <Game game={state.game} />
  </>;
}

export default function LessonStage({ state }: { state: LessonStageState }) {
  const [settings, setSettings] = useState<QualitySettings | null>(null);
  return <SceneCanvas className="lf-scene-fill" interactive={false} onSettings={setSettings} camera={{ position: [0, BOX.centerY, 10], fov: FOV }}>
    {settings ? <World settings={settings} state={state} /> : null}
  </SceneCanvas>;
}
