import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { CharacterAction, CharacterEmotion, CharacterId } from '@/components/characters/control/types';
import { Character3D } from './Character3D';
import { FlatGroundProvider } from './ground';
import { SceneCanvas, type SceneStats } from './SceneCanvas';
import { SceneLighting } from './SceneLighting';
import { CHARACTER_ASSETS, characterScale } from './assets';
import { modelBounds } from './modelBounds';
import { useSceneModel } from './useSceneModel';
import { framingDistance } from './framing';
import type { QualitySettings } from './quality';

/*
 * ONE CHARACTER, NO WORLD.
 *
 * The 3D cast has only ever been reachable from inside the Tutor's diorama -
 * an island, a walkability mask, a camera director, a time-of-day light rig.
 * None of that belongs in a lesson, and the owner asked for the characters
 * "sin el diorama, solo personaje". This is that surface, and both the pose lab
 * and the Lesson Engine compose from it so there is exactly one answer to "how
 * do we render a character on its own".
 *
 * WHAT IS DELIBERATELY ABSENT: the diorama, the ground plane and its walk mask,
 * the camera director, and the backdrop's time of day. A lesson is not a place;
 * it has no dawn. Lighting is pinned to `auto`, which resolves against the
 * app's own theme, so a character in a lesson is lit like the page it sits on
 * rather than like an island at some hour.
 *
 * WHAT IS KEPT: `Character3D` exactly as the Tutor uses it, including the
 * emotion and action vocabulary it already shares with the 2D rig, and the
 * adaptive quality governor inside `SceneCanvas` - a lesson runs on the same
 * mid-range phones the Tutor does, and it has less budget to spend, not more.
 *
 * THE CONTACT SHADOW IS NOT OURS TO DRAW. `Character3D` already renders one,
 * sized from the footprint it measured off the model. This surface used to add
 * a second one sized from the character's HEIGHT: two coplanar planes, the
 * outer of them wrong for the quadruped. A caller that genuinely needs no
 * shadow gets an opt-out on `Character3D`, where the measurement lives - not a
 * second shadow here.
 */

export interface CharacterStageProps {
  id: CharacterId;
  emotion?: CharacterEmotion;
  action?: CharacterAction;
  /** Bump to replay the same one-shot action twice in a row. */
  actionKey?: number;
  /** Y rotation in radians. 0 faces the camera. */
  rotation?: number;
  /*
   * How much of the frame the character fills, 0..1. Framing is expressed as a
   * FRACTION rather than a camera distance because the same stage is used at a
   * 96px lesson avatar and a full-width lab tile, and a distance that reads as
   * a portrait at one size reads as a speck at the other.
   */
  fill?: number;
  className?: string;
  onStats?: (stats: SceneStats) => void;
  /**
   * Index into the viseme atlas. Supplying it is what turns the lip-sync card
   * ON: a stage with nothing driving visemes renders no card, so the character
   * keeps its own painted mouth instead of a static one pasted over it.
   *
   * THE DEBT THIS CARRIES A DUE DATE FOR (/AGENTS.md §1.14): the moment a
   * lesson does drive visemes, the card comes back, and under this surface's
   * dark `auto` rig its tint is under-corrected - it reads as a pale rectangle
   * because `mouthCardTint` corrects for the light rig's irradiance while the
   * face around the card is also shaded by geometry the flat card is not. Fix
   * that before wiring a viseme driver here, not after.
   */
  viseme?: number;
  /** The character is talking right now — see `applySpeaking`. */
  speaking?: boolean;
  /** Rendered over the canvas, e.g. a name plate in the lab. */
  overlay?: ReactNode;
}

const FOV = 30;

/*
 * FRAMING, FROM THE MODEL BOX AND THE CONTAINER SHAPE.
 *
 * Three separate things were wrong with framing by `targetHeightM`, and only
 * the first was visible on the character it was tuned against.
 *
 * 1. `SceneCanvas` takes a camera POSITION and nothing else, and the R3F
 *    default camera looks at the origin - so a camera lifted to eye height
 *    tilts DOWN at the floor. The lab first render cropped Zara at the
 *    shoulders exactly that way.
 *
 * 2. HEIGHT is the wrong measure. Dina is 1.9 m by the same number that makes
 *    Rho 1.7 m, but she is a quadruped whose mass is low and long: aiming at a
 *    fraction of her height points above most of her and pins her feet to the
 *    bottom edge. The MEASURED vertical centre is right for every rig without a
 *    per-character constant anybody has to maintain.
 *
 * 3. A character is framed by its SILHOUETTE against a container of a given
 *    shape, not by one extent against a square. That arithmetic lives in
 *    `framing.ts`, where it can be tested against both body plans; this
 *    component's job is to MEASURE and to point the camera.
 *
 * The box comes from `modelBounds`, NOT `Box3.setFromObject`. `useSceneModel`
 * shares one Object3D per character, so on a remount the shared object is still
 * parented to the outgoing scaled group and the world-space call returns metres
 * that are then scaled a second time - the defect that put the contact shadow
 * of Dina 221 m across and her feet 12 m under the island. `modelBounds`
 * composes LOCAL matrices down from the root and reads nothing above it, so it
 * is correct by construction rather than by being called at the right moment.
 */
function Framing({
  id,
  fill,
  rotation,
  settings,
}: {
  id: CharacterId;
  fill: number;
  rotation: number;
  settings: QualitySettings;
}) {
  const camera = useThree((state) => state.camera);
  // Subscribing to `size` is what re-frames on a resize or an orientation
  // change; reading `camera.aspect` alone would freeze the first layout in.
  const size = useThree((state) => state.size);

  const asset = CHARACTER_ASSETS[id];
  // The SAME settings `Character3D` loads under, so both read one cache entry
  // instead of decoding the model twice down different KTX2 paths.
  const { scene } = useSceneModel(asset.url, settings);
  const scale = useMemo(() => characterScale(asset), [asset]);

  const measured = useMemo(() => {
    const box = modelBounds(scene);
    if (box.isEmpty()) return null;
    const extent = box.getSize(new Vector3()).multiplyScalar(scale);
    // Feet rest on y = 0 in the scene, so the model own origin offset has to
    // come out of the centre before it can serve as an aim point.
    const centreY = (box.getCenter(new Vector3()).y - box.min.y) * scale;
    return { extent, centreY };
  }, [scene, scale]);

  useEffect(() => {
    if (!measured) return;
    const distance = framingDistance(measured.extent, {
      fill,
      rotation,
      aspect: size.width / Math.max(1, size.height),
      fov: FOV,
    });
    camera.position.set(0, measured.centreY, distance);
    camera.lookAt(0, measured.centreY, 0);
    if ('fov' in camera) (camera as { fov: number }).fov = FOV;
    camera.updateProjectionMatrix();
  }, [camera, measured, fill, rotation, size.width, size.height]);

  return null;
}

export function CharacterStage({
  id,
  emotion = 'neutral',
  action = 'idle',
  actionKey,
  rotation = 0,
  fill = 0.78,
  viseme,
  speaking = false,
  className,
  onStats,
  overlay,
}: CharacterStageProps) {
  // `SceneCanvas` owns the governor and hands the resolved tier down; every
  // consumer of `settings` below is inside the canvas, so it is state rather
  // than a prop we could have computed here.
  const [settings, setSettings] = useState<QualitySettings | null>(null);

  /*
   * NO SHADOW MAP ON THIS SURFACE, AND IT COSTS NOTHING TO LOSE.
   *
   * A shadow map is a second full draw of every caster. On the island that buys
   * something: the ground receives it, and moving the sun is most of what
   * separates dawn from dusk. Here there is no ground - `FlatGroundProvider` is
   * a sampler, not geometry - and the shadow under a character is
   * `ContactShadow`, a painted plane that does not read the map. So the pass
   * rendered Zara's 50,000 triangles a second time to produce no visible pixel.
   * Measured in the pose lab, per frame, with the pass and without it:
   * Zara 100,122 -> 50,123 and 5 -> 4 draw calls, Dina 99,998 -> 50,001,
   * Rho 6,284 -> 3,204, Liruf 6,268 -> 3,136.
   *
   * That is the difference between one lesson avatar costing a whole Tutor
   * scene and costing a fifth of one, on the same mid-range phones (/AGENTS.md
   * §1.0). The override is on the copy handed DOWN, so the canvas governor that
   * resolved the tier is untouched and the diorama keeps its shadows.
   */
  const stageSettings = useMemo(
    () => (settings ? { ...settings, shadows: false } : null),
    [settings],
  );

  return (
    <div className={className}>
      <SceneCanvas className="h-full w-full" onStats={onStats} onSettings={setSettings}>
        {stageSettings && (
          <>
            {/* `auto` resolves against the app theme. A lesson has no time of day. */}
            <SceneLighting settings={stageSettings} backdrop="auto" />
            {/* The stage has no island, so the floor is the origin plane. See
                FlatGroundProvider: this is a statement about this surface, not
                a workaround for the "no ground means a placement bug" rule the
                diorama depends on. */}
            <FlatGroundProvider>
              {/* Framing SUSPENDS - it reads the same model - so it belongs
                  inside the boundary, beside the character it measures. */}
              <Suspense fallback={null}>
                <Framing id={id} fill={fill} rotation={rotation} settings={stageSettings} />
                <Character3D
                  id={id}
                  settings={stageSettings}
                  emotion={emotion}
                  action={action}
                  actionKey={actionKey}
                  rotation={rotation}
                  speaking={speaking}
                  viseme={viseme ?? 0}
                  mouth={viseme !== undefined}
                />
              </Suspense>
            </FlatGroundProvider>
          </>
        )}
      </SceneCanvas>
      {overlay}
    </div>
  );
}
