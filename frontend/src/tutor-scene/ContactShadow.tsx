import { useMemo } from 'react';
import { CanvasTexture, DoubleSide, SRGBColorSpace } from 'three';

/*
 * A soft blob shadow under a character.
 *
 * Why not real shadows: shadow mapping only runs on the HIGH tier, because a
 * shadow-casting light re-renders the scene into a depth map every frame. Most
 * users are not on the high tier, and a character with nothing underneath
 * reads as a sticker pasted onto the scenery — grounding is the single biggest
 * cue that a figure is really standing somewhere.
 *
 * So this is a radial-gradient alpha blob on a flat plane: one shared texture
 * across every character, one extra draw call each, no lights involved, and
 * identical cost on a 2GB phone and a desktop GPU. It composes with real
 * shadows rather than competing — on the high tier the mapped shadow supplies
 * direction and this supplies the tight contact darkening underneath.
 */

/** Built once and shared — a per-character texture would be pure waste. */
let shared: CanvasTexture | null = null;

function shadowTexture(): CanvasTexture {
  if (shared) return shared;

  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');

  if (context) {
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    // Falls off faster than linear: a linear ramp reads as a grey disc, while
    // a soft core with a long tail reads as contact.
    gradient.addColorStop(0, 'rgba(0,0,0,0.55)');
    gradient.addColorStop(0.45, 'rgba(0,0,0,0.22)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }

  shared = new CanvasTexture(canvas);
  shared.colorSpace = SRGBColorSpace;
  return shared;
}

export interface ContactShadowProps {
  /** Diameter in metres. Roughly the character's footprint, not their height. */
  radius: number;
  /** Height above the surface. Small but non-zero, to avoid z-fighting. */
  lift?: number;
  opacity?: number;
}

export function ContactShadow({ radius, lift = 0.012, opacity = 0.75 }: ContactShadowProps) {
  const texture = useMemo(() => shadowTexture(), []);

  return (
    <mesh position={[0, lift, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
      <planeGeometry args={[radius * 2, radius * 2]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={opacity}
        // depthWrite off so the blob never occludes the character standing in
        // it; the island still occludes the blob correctly via depth testing.
        depthWrite={false}
        side={DoubleSide}
      />
    </mesh>
  );
}
