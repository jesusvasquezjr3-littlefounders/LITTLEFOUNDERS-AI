import { createContext, useContext, useEffect, useMemo, useState, type MutableRefObject } from 'react';
import { useThree } from '@react-three/fiber';
import { CanvasTexture, CircleGeometry, PMREMGenerator, SRGBColorSpace, type Texture } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/*
 * The shared parts of the landing hero's scene: one clock, the reflections for
 * metal, and the soft floor and contact pools that tie the figures to it.
 * Every part reads the same clock so a held clock (reduced motion) freezes the
 * picture on one composed frame instead of mid-motion.
 */

export type TimeRef = MutableRefObject<number>;

/**
 * The video loops every LOOP seconds, so every motion in the scene is a whole number of turns in that time: lanes and
 * spins are given in turns per loop, and any other frequency is snapped to the nearest one by `loopFreq`.
 */
export const LOOP = 30;
export const TAU = Math.PI * 2;
export const turnsToRadians = (turns: number) => (turns * TAU) / LOOP;
export const loopFreq = (radiansPerSecond: number) => turnsToRadians(Math.max(1, Math.round((radiansPerSecond * LOOP) / TAU)));

const TimeContext = createContext<TimeRef>({ current: 0 });
export const TimeProvider = TimeContext.Provider;
export const useTime = () => useContext(TimeContext);

export function radialTexture(inner: string, outer: string) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d')!;
  const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(1, outer);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Metal and paper need something to reflect; the characters are lit by the scene rig and ignore this. */
export function useReflections() {
  const gl = useThree((state) => state.gl);
  const [map, setMap] = useState<Texture | null>(null);
  useEffect(() => {
    const generator = new PMREMGenerator(gl);
    const target = generator.fromScene(new RoomEnvironment(), 0.04);
    generator.dispose();
    setMap(target.texture);
    return () => target.dispose();
  }, [gl]);
  return map;
}

/**
 * The floor is light, not a disc: a wide pool of brand colour that fades to
 * nothing well inside the frame, so no edge of it is ever visible.
 */
export function StageFloor({ radius }: { radius: number }) {
  const glow = useMemo(() => radialTexture('rgba(132,124,255,0.55)', 'rgba(132,124,255,0)'), []);
  useEffect(() => () => glow.dispose(), [glow]);
  return <mesh rotation-x={-Math.PI / 2} position-y={0.004} scale={[1, 0.62, 1]}>
    <circleGeometry args={[radius, 72]} /><meshBasicMaterial map={glow} transparent depthWrite={false} toneMapped={false} />
  </mesh>;
}

/** A soft dark pool under each figure, so they sit on the light instead of hovering over it. One mesh for all of them. */
export function ContactPools({ xs, radius = 0.62 }: { xs: readonly number[]; radius?: number }) {
  const pool = useMemo(() => radialTexture('rgba(10,12,40,0.5)', 'rgba(10,12,40,0)'), []);
  const geometry = useMemo(() => mergeGeometries(xs.map((x) => new CircleGeometry(radius, 32).translate(x, 0, 0)))!, [xs, radius]);
  useEffect(() => () => { pool.dispose(); geometry.dispose(); }, [pool, geometry]);
  return <mesh geometry={geometry} position-y={0.012} rotation-x={-Math.PI / 2}>
    <meshBasicMaterial map={pool} transparent depthWrite={false} toneMapped={false} />
  </mesh>;
}
