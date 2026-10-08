import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, ExtrudeGeometry, Group, PointLight, Shape } from 'three';
import { loopFreq, radialTexture, useTime } from './heroProps';

/*
 * The streak flame: the same small, rounded, three-tongue flame a learner sees
 * beside their streak count, not a fire. Three nested layers (orange, amber,
 * cream) sway a little out of step, with a warm glow and a soft light that lifts
 * the faces of the two Mentors beside it.
 */

function flameShape() {
  const shape = new Shape();
  shape.moveTo(0.06, 0.82);
  shape.bezierCurveTo(0.12, 0.52, 0.5, 0.34, 0.47, -0.08);
  shape.bezierCurveTo(0.45, -0.38, 0.24, -0.56, 0, -0.56);
  shape.bezierCurveTo(-0.28, -0.56, -0.5, -0.34, -0.46, -0.02);
  shape.bezierCurveTo(-0.43, 0.2, -0.31, 0.26, -0.21, 0.46);
  shape.bezierCurveTo(-0.14, 0.58, -0.02, 0.62, 0.06, 0.82);
  return shape;
}

const LAYERS = [
  { color: '#ff3b00', emissive: '#d42a00', scale: 1, lift: 0, depth: 0.1 },
  { color: '#ff7a00', emissive: '#e86000', scale: 0.62, lift: -0.1, depth: 0.12 },
  { color: '#ffd23a', emissive: '#ffb800', scale: 0.3, lift: -0.19, depth: 0.14 },
] as const;

export function Streak({ position, size = 0.9 }: { position: [number, number, number]; size?: number }) {
  const time = useTime();
  const group = useRef<Group>(null);
  const layers = useRef<Group[]>([]);
  const light = useRef<PointLight>(null);
  const geometries = useMemo(() => LAYERS.map((layer) => {
    const g = new ExtrudeGeometry(flameShape(), { depth: layer.depth, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2, curveSegments: 14 });
    g.translate(0, 0, -layer.depth / 2);
    return g;
  }), []);
  const glow = useMemo(() => radialTexture('rgba(255,170,60,0.8)', 'rgba(255,120,30,0)'), []);
  useEffect(() => () => { geometries.forEach((g) => g.dispose()); glow.dispose(); }, [geometries, glow]);

  useFrame(() => {
    const t = time.current;
    if (group.current) {
      group.current.position.y = position[1] + Math.sin(t * loopFreq(1.2)) * 0.05;
      group.current.rotation.y = Math.sin(t * loopFreq(0.9)) * 0.4;
    }
    layers.current.forEach((layer, i) => {
      layer.scale.set(1 + Math.sin(t * loopFreq(5.2 + i) + i * 1.3) * 0.04, 1 + Math.sin(t * loopFreq(6.4 + i * 0.7) + i) * 0.07, 1);
      layer.rotation.z = Math.sin(t * loopFreq(2.6 + i * 0.6) + i) * 0.06;
    });
    if (light.current) light.current.intensity = 2.4 * (0.88 + 0.08 * Math.sin(t * loopFreq(17)) + 0.04 * Math.sin(t * loopFreq(29)));
  });

  return <group position={[position[0], 0, position[2]]}>
    <pointLight ref={light} position={[0, position[1], 0.9]} color="#ff9a3c" distance={4.5} decay={2} />
    <mesh position={[0, position[1] + 0.08, -0.12]} renderOrder={2}>
      <planeGeometry args={[size * 2.6, size * 2.6]} />
      <meshBasicMaterial map={glow} transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} opacity={0.5} />
    </mesh>
    <group ref={group} position={[0, position[1], 0]} scale={size / 1.4}>
      {LAYERS.map((layer, i) => <group key={layer.color} ref={(g) => { if (g) layers.current[i] = g; }} position={[0, layer.lift, i * 0.03]} scale={layer.scale}>
        <mesh geometry={geometries[i]}><meshStandardMaterial color={layer.color} emissive={layer.emissive} emissiveIntensity={0.35} roughness={0.5} toneMapped={false} /></mesh>
      </group>)}
    </group>
  </group>;
}
