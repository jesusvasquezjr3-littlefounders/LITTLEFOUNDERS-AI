import { Suspense, useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { CharacterAction } from '@/components/characters/control/types';
import { useTheme } from '@/theme/useTheme';
import { Character3D } from '@/tutor-scene/Character3D';
import { FlatGroundProvider } from '@/tutor-scene/ground';
import { SceneCanvas } from '@/tutor-scene/SceneCanvas';
import { SceneLighting } from '@/tutor-scene/SceneLighting';
import type { QualitySettings } from '@/tutor-scene/quality';
import { Balloon, Block, Book, Bulb, Cap, Controller, Note, Orbit, PaperPlane, Rocket, Seed, Sprout, Star } from './heroAnchors';
import { ContactPools, LOOP, StageFloor, TimeProvider, useReflections, type TimeRef } from './heroProps';
import { Streak } from './heroStreak';

/*
 * The SOURCE of the landing hero's video, not something the site runs.
 *
 * Dr. Rho and Zara talk around a streak flame with three lanes of small things
 * circling them. `scripts/render-hero-video.mjs` plays this scene on a virtual
 * clock, frame by frame, in both colour modes, and encodes the frames to a
 * short looping video: a phone plays that with its hardware decoder, where the
 * live scene would have cost it a GPU and a battery. Everything here is
 * periodic in LOOP seconds (lanes and spins are whole turns per loop, other
 * frequencies are snapped, the conversation is a fixed script) so the last
 * frame meets the first.
 */

const FOV = 30;
/** The composition's footprint in metres: x within +-3.2, y from -0.6 to 4.7. The camera frames this box. */
const BOX = { width: 6.4, height: 5.1, centerY: 2.0 };
/** Who says something to whom, in turn: eight beats fill the loop exactly. */
const BEATS: readonly { who: 'rho' | 'zara'; action: CharacterAction }[] = [
  { who: 'rho', action: 'point' }, { who: 'zara', action: 'nod' }, { who: 'zara', action: 'point' }, { who: 'rho', action: 'nod' },
  { who: 'rho', action: 'wave' }, { who: 'zara', action: 'wave' }, { who: 'rho', action: 'hop' }, { who: 'zara', action: 'hop' },
];
const BEAT_SECONDS = LOOP / BEATS.length;

/** The scene's only clock: the sum of the frame deltas, so a virtual clock stepped by hand plays it exactly. */
function Clock({ time }: { time: TimeRef }) {
  useFrame((_, delta) => { time.current += Math.min(delta, 0.05); });
  return null;
}

/** Fits the whole composition into the canvas box. */
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

function Cast({ settings, x, time }: { settings: QualitySettings; x: number; time: TimeRef }) {
  const [turn, setTurn] = useState({ beat: 0, rho: 0, zara: 0 });
  useFrame(() => {
    const beat = Math.floor(time.current / BEAT_SECONDS) % BEATS.length;
    if (beat !== turn.beat) setTurn((was) => ({ ...was, beat, [BEATS[beat]!.who]: was[BEATS[beat]!.who] + 1 }));
  });
  const current = BEATS[turn.beat]!;
  return <>
    <ContactPools xs={[-x, x]} />
    <Character3D id="rho" settings={settings} position={[-x, 0, 0]} rotation={0.62} emotion="happy" action={current.who === 'rho' ? current.action : 'idle'}
      actionKey={turn.rho} shadow={false} mouth={false} instanced />
    <Character3D id="zara" settings={settings} position={[x, 0, 0]} rotation={-0.62} emotion="excited" action={current.who === 'zara' ? current.action : 'idle'}
      actionKey={turn.zara} shadow={false} mouth={false} instanced />
  </>;
}

/** Tells the capture script the models are in and drawing. */
function Ready() {
  useEffect(() => { document.body.dataset.heroReady = '1'; return () => { delete document.body.dataset.heroReady; }; }, []);
  return null;
}

/*
 * Three lanes around the pair, a full prop apart in height so no lane can touch
 * another; inside a lane the gap between items never changes. Turns per loop:
 * low lane twice, mid and high once.
 */
function World({ settings }: { settings: QualitySettings }) {
  const time = useRef(0);
  const reflections = useReflections();
  const { isDark } = useTheme();
  // The capture script reads the scene's time to step its virtual clock exactly.
  useEffect(() => { (window as unknown as { __heroClock?: TimeRef }).__heroClock = time; }, [time]);
  return <TimeProvider value={time}>
    <Clock time={time} />
    <Rig />
    <SceneLighting settings={{ ...settings, shadows: false }} backdrop="auto" />
    {/* The page's dark mode leaves small props in shadow; a soft fill keeps every lane readable without flattening the pair. */}
    <ambientLight intensity={isDark ? 1.15 : 0.3} color="#dfe0ff" />
    {/* A cool rim from behind-left separates the pair from the page and ties them to the violet floor. */}
    <directionalLight position={[-3, 3.5, -3]} intensity={0.9} color="#9b94ff" />
    <StageFloor radius={3.4} />
    <FlatGroundProvider>
      <Suspense fallback={null}><Cast settings={settings} x={0.85} time={time} /><Ready /></Suspense>
    </FlatGroundProvider>
    <Streak position={[0, 1.15, 0.1]} size={0.85} />
    <Orbit rx={1.9} rz={0.9} y={0.75} turns={2}>
      <Seed reflections={reflections} />
      <Sprout />
      <Block color="#ff6b6b" />
      <Seed reflections={reflections} />
      <Controller />
    </Orbit>
    <Orbit rx={2.45} rz={1.05} y={2.35} turns={1} phase={0.6}>
      <Book />
      <Rocket />
      <Bulb />
      <Seed reflections={reflections} />
      <PaperPlane />
    </Orbit>
    <Orbit rx={2.0} rz={0.8} y={3.8} turns={1} phase={1.2}>
      <Star reflections={reflections} />
      <Cap />
      <Note />
      <Balloon />
    </Orbit>
  </TimeProvider>;
}

export default function HeroScene() {
  const [settings, setSettings] = useState<QualitySettings | null>(null);
  return <SceneCanvas className="lf-scene-fill" interactive={false} onSettings={setSettings} camera={{ position: [0, BOX.centerY, 10], fov: FOV }}>
    {settings ? <World settings={settings} /> : null}
  </SceneCanvas>;
}
