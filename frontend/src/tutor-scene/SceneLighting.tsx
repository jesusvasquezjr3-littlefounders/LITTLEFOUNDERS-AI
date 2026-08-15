import { useTheme } from '@/theme/useTheme';
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
 */

export interface SceneLightingProps {
  settings: QualitySettings;
}

export function SceneLighting({ settings }: SceneLightingProps) {
  const { isDark } = useTheme();

  return (
    <>
      {/*
       * Hemisphere rather than plain ambient: a flat ambient term makes
       * stylized characters read as cardboard cutouts because nothing
       * distinguishes up from down. Sky/ground tinting restores that for the
       * cost of the same single light.
       */}
      <hemisphereLight
        args={[isDark ? '#2a3550' : '#eaf2ff', isDark ? '#0b0f1a' : '#d8c7a8', isDark ? 1.1 : 1.6]}
      />
      <directionalLight
        position={[4, 8, 5]}
        intensity={isDark ? 1.0 : 1.8}
        color={isDark ? '#93b4ff' : '#fff6e5'}
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
