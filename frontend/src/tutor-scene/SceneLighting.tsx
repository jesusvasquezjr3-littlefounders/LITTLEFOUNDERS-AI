import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, type DirectionalLight, type HemisphereLight } from 'three';
import { useTheme } from '@/theme/useTheme';
import { resolveBackdrop, warmBy, type SceneBackdropId } from './backdrops';
import type { QualitySettings } from './quality';

/*
 * Lighting is code, never baked into the .glb — and that is a product
 * requirement, not a preference. DESIGN.md mandates light AND dark mode, so a
 * scene lit once at export time is wrong in one of the two themes by
 * construction. Artists bake ambient OCCLUSION into textures (that is contact
 * shadow, valid in both themes) and nothing else.
 *
 * The light count is also a budget line: every shadow-casting light is an
 * extra render pass over the whole scene. There is exactly one, and it only
 * casts on the high tier.
 *
 * BACKDROP. The learner's chosen time of day arrives here and nowhere else. It
 * had been picked, validated, persisted and returned by two endpoints without
 * ever reaching a renderer — a control that did nothing, all the way down. The
 * palettes live in `backdrops.ts`; this file is the part that has lights.
 *
 * NOTHING IS SET FROM JSX EXCEPT THE SHADOW RIG, and that is deliberate. Colour,
 * intensity and the sun's position are all mutated in place inside the frame
 * loop so a backdrop change LERPS. If any of them were also declared as props,
 * React Three Fiber would re-apply the prop on the next re-render and snap the
 * value back — an intermittent bug that only appears when something unrelated
 * re-renders mid-transition, which is the worst kind to find. `args` is left off
 * the hemisphere light for the same reason: changing `args` makes R3F destroy
 * and rebuild the light object, which is a hard cut in the middle of a fade.
 */

export interface SceneLightingProps {
  settings: QualitySettings;
  /**
   * Which time of day. `auto` follows the app theme and is the shipped
   * behaviour, byte for byte, so nothing changes for anyone who has not chosen.
   */
  backdrop?: SceneBackdropId;
  /**
   * 0..1 toward a warmer key, for the close performance. A transform of the
   * live palette rather than a sixth palette, so the ending honours the backdrop
   * the learner chose instead of overriding it at the one moment they remember.
   */
  warmth?: number;
}

/**
 * Time constant of the fade. About 600 ms to settle — long enough to read as a
 * change of light rather than a flicker, short enough that a learner tapping
 * through the four backdrops can tell them apart.
 */
const LERP_TAU = 0.2;

export function SceneLighting({ settings, backdrop = 'auto', warmth = 0 }: SceneLightingProps) {
  const { isDark } = useTheme();
  const hemisphere = useRef<HemisphereLight>(null);
  const sun = useRef<DirectionalLight>(null);
  const snapped = useRef(false);

  // Scratch colours, allocated once. Parsing a hex string per frame per light
  // would allocate three objects a frame for a value that changes once a minute.
  const scratch = useMemo(() => ({ sky: new Color(), ground: new Color(), sun: new Color() }), []);

  const goal = useMemo(() => warmBy(resolveBackdrop(backdrop, isDark), warmth), [backdrop, isDark, warmth]);

  useFrame((_, delta) => {
    const hemi = hemisphere.current;
    const key = sun.current;
    if (!hemi || !key) return;

    /*
     * The first tick SNAPS. R3F runs frame subscribers before it renders, so
     * this lands before anything is drawn and the scene is never seen under the
     * default lighting these lights were constructed with. Every tick after
     * that eases, which is what makes a backdrop change a change of light.
     */
    const dt = Number.isFinite(delta) && delta > 0 ? Math.min(delta, 0.1) : 0.016;
    const alpha = snapped.current ? 1 - Math.exp(-dt / LERP_TAU) : 1;
    snapped.current = true;

    hemi.color.lerp(scratch.sky.set(goal.sky), alpha);
    hemi.groundColor.lerp(scratch.ground.set(goal.ground), alpha);
    hemi.intensity += (goal.hemisphereIntensity - hemi.intensity) * alpha;

    key.color.lerp(scratch.sun.set(goal.sun), alpha);
    key.intensity += (goal.sunIntensity - key.intensity) * alpha;
    // Moving the sun moves the shadows, which is most of what separates dawn
    // from dusk at a glance. A colour-only change reads as a filter over the
    // same picture rather than as a different hour.
    key.position.x += (goal.sunPosition[0] - key.position.x) * alpha;
    key.position.y += (goal.sunPosition[1] - key.position.y) * alpha;
    key.position.z += (goal.sunPosition[2] - key.position.z) * alpha;
  });

  return (
    <>
      {/*
       * Hemisphere rather than plain ambient: a flat ambient term makes
       * stylized characters read as cardboard cutouts because nothing
       * distinguishes up from down. Sky/ground tinting restores that for the
       * cost of the same single light.
       */}
      <hemisphereLight ref={hemisphere} />
      <directionalLight
        ref={sun}
        castShadow={settings.shadows}
        // A tight, low-resolution shadow map is deliberate: shadow quality is
        // the first thing to sacrifice and the last thing a child notices.
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={1}
        shadow-camera-far={30}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-bias={-0.0015}
      />
    </>
  );
}
