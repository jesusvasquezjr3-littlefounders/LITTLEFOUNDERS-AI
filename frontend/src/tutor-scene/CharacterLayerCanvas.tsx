import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, Vector3, type Group } from 'three';
import { Character3D } from './Character3D';
import { FlatGroundProvider } from './ground';
import { SceneCanvas, type SceneStats } from './SceneCanvas';
import { SceneLighting } from './SceneLighting';
import { CHARACTER_ASSETS, characterScale } from './assets';
import { modelBounds } from './modelBounds';
import { useSceneModel } from './useSceneModel';
import { framingDistance } from './framing';
import type { QualitySettings } from './quality';
import type { Slot } from './CharacterLayer';

/*
 * The 3D half of `CharacterLayer` — everything that touches `three`, kept in
 * its own module so the layer's registry can be imported without dragging the
 * renderer into whatever chunk the caller lands in.
 */

const FOV = 30;

interface Measured {
  height: number;
  width: number;
  depth: number;
  centreY: number;
}

interface Live {
  group: Group | null;
  camera: PerspectiveCamera;
  measured: Measured | null;
}

export function CharacterLayerCanvas({
  slots,
  slotsRef,
  onDrawing,
  onStats,
}: {
  slots: readonly Slot[];
  slotsRef: { current: Map<string, Slot> };
  onDrawing: (drawing: boolean) => void;
  onStats?: (stats: SceneStats) => void;
}) {
  const [settings, setSettings] = useState<QualitySettings | null>(null);

  // Nothing on this surface receives a shadow map and every contact shadow is a
  // painted plane, so the pass would draw each character a second time for no
  // visible pixel. The same reasoning, and the same measurement, as
  // `CharacterStage`: Zara 100,122 -> 50,123 triangles per frame.
  const stageSettings = useMemo(() => (settings ? { ...settings, shadows: false } : null), [settings]);

  useEffect(() => {
    onDrawing(Boolean(stageSettings));
    return () => onDrawing(false);
  }, [stageSettings, onDrawing]);

  return (
    <SceneCanvas className="h-full w-full" onStats={onStats} onSettings={setSettings}>
      {stageSettings && <LayerScene slots={slots} slotsRef={slotsRef} settings={stageSettings} />}
    </SceneCanvas>
  );
}

/**
 * One slot's character, its own camera, and its own measurement.
 *
 * `instanced` is what lets the same character appear in two slots at once: the
 * clone shares geometry and materials — the expensive parts, already on the GPU
 * — and duplicates only the node hierarchy and the skeleton. A dialogue where
 * Zara speaks on lines 1 and 3 is two poses, not two downloads.
 */
function SlotCharacter({
  slot,
  settings,
  onReady,
}: {
  slot: Slot;
  settings: QualitySettings;
  onReady: (key: string, live: Live | null) => void;
}) {
  const group = useRef<Group>(null);
  const camera = useMemo(() => new PerspectiveCamera(FOV, 1, 0.05, 100), []);
  const asset = CHARACTER_ASSETS[slot.character];
  // The SHARED model, purely to measure. Every clone has the same box, and
  // measuring the cached one keeps the measurement out of the render path.
  const { scene } = useSceneModel(asset.url, settings);

  const measured = useMemo<Measured | null>(() => {
    const box = modelBounds(scene);
    if (box.isEmpty()) return null;
    const scale = characterScale(asset);
    const size = box.getSize(new Vector3()).multiplyScalar(scale);
    return {
      height: size.y,
      width: size.x,
      depth: size.z,
      // Feet rest on y = 0, so the model's own origin offset comes out before
      // the centre can serve as an aim point.
      centreY: (box.getCenter(new Vector3()).y - box.min.y) * scale,
    };
  }, [scene, asset]);

  useEffect(() => {
    onReady(slot.key, { group: group.current, camera, measured });
    return () => onReady(slot.key, null);
  }, [slot.key, camera, measured, onReady]);

  return (
    <group ref={group} visible={false}>
      <Character3D
        id={slot.character}
        settings={settings}
        emotion={slot.emotion ?? 'neutral'}
        action={slot.action ?? 'idle'}
        actionKey={slot.actionKey}
        instanced
        /* Nothing drives visemes in a lesson yet, so the lip-sync card would
           paste a static closed mouth over the model's own painted one. */
        mouth={false}
        /* A lesson page is not a floor: see `shadow` on Character3D. */
        shadow={false}
      />
    </group>
  );
}

function LayerScene({
  slots,
  slotsRef,
  settings,
}: {
  slots: readonly Slot[];
  slotsRef: { current: Map<string, Slot> };
  settings: QualitySettings;
}) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const size = useThree((state) => state.size);
  const live = useRef(new Map<string, Live>());

  const onReady = useCallback((key: string, entry: Live | null) => {
    if (entry) live.current.set(key, entry);
    else live.current.delete(key);
  }, []);

  useEffect(() => {
    // R3F clears before its own render. With rendering taken over below, the
    // clear is ours to do — once per frame, for the whole canvas.
    gl.autoClear = false;
    /*
     * AND SO IS THE ACCOUNTING. `renderer.info` resets itself at the start of
     * every `render()` call, so with one call per slot it would report the LAST
     * character rather than the frame — the intro screen showed 3,136 triangles
     * for a cast of four whose true cost is 106,208. A readout that under-reports
     * by thirty times is worse than none: it is the "over budget in red for a
     * scene inside its budget" mistake of TUTOR_3D.md §6 with the sign flipped.
     */
    gl.info.autoReset = false;
    return () => {
      gl.autoClear = true;
      gl.info.autoReset = true;
    };
  }, [gl]);

  /*
   * THE SCISSOR LOOP.
   *
   * Priority 1 takes rendering away from R3F, which is required rather than
   * clever: its default loop draws the whole scene once with one camera, and
   * this draws each slot separately with its own. Every character is hidden by
   * default and made visible only for its own pass, so the lights and the
   * ground provider are shared while a character can never appear inside
   * another slot's rectangle.
   *
   * The rectangles come from `getBoundingClientRect` EVERY FRAME, deliberately.
   * A lesson scrolls, reflows when a sheet opens, and reveals transcript lines
   * one at a time; anything cached would trail the layout by a frame and read
   * as the characters sliding into place.
   */
  useFrame(() => {
    gl.info.reset();
    gl.setScissorTest(false);
    gl.clear();

    for (const slot of slotsRef.current.values()) {
      const entry = live.current.get(slot.key);
      if (!entry?.group || !entry.measured) continue;

      const rect = slot.element.getBoundingClientRect();
      /*
       * OFF SCREEN IS NOT DRAWN. A transcript ten lines long has three or four
       * on screen; the rest cost their animation update and nothing else. This
       * is the single biggest reason a whole lesson of characters is
       * affordable on the phones §1.0 cares about.
       */
      if (
        rect.width < 1 ||
        rect.height < 1 ||
        rect.bottom <= 0 ||
        rect.top >= size.height ||
        rect.right <= 0 ||
        rect.left >= size.width
      ) {
        continue;
      }

      const aspect = rect.width / rect.height;
      let distance: number;
      let aim: number;
      if (slot.stageHeightM) {
        /*
         * A SHARED STAGE. The frame spans a fixed world height with y = 0 — the
         * ground the characters stand on — at its bottom edge, so two slots of
         * the same pixel height show the same metres per pixel and the cast
         * comes out at its true relative sizes, feet on one line.
         */
        distance = slot.stageHeightM / (2 * Math.tan((FOV * Math.PI) / 360));
        aim = slot.stageHeightM / 2;
      } else {
        distance = framingDistance(
          { x: entry.measured.width, y: entry.measured.height, z: entry.measured.depth },
          { fill: slot.fill ?? 0.88, rotation: 0, aspect, fov: FOV },
        );
        aim = entry.measured.centreY;
      }
      entry.camera.aspect = aspect;
      entry.camera.position.set(0, aim, distance);
      entry.camera.lookAt(0, aim, 0);
      entry.camera.updateProjectionMatrix();

      // WebGL's origin is bottom-left; the DOM's is top-left.
      gl.setViewport(rect.left, size.height - rect.bottom, rect.width, rect.height);
      gl.setScissor(rect.left, size.height - rect.bottom, rect.width, rect.height);
      gl.setScissorTest(true);

      entry.group.visible = true;
      gl.render(scene, entry.camera);
      entry.group.visible = false;
    }

    gl.setScissorTest(false);
  }, 1);

  return (
    <>
      <SceneLighting settings={settings} backdrop="auto" />
      <FlatGroundProvider>
        {slots.map((slot) => (
          <SlotCharacter key={slot.key} slot={slot} settings={settings} onReady={onReady} />
        ))}
      </FlatGroundProvider>
    </>
  );
}

export default CharacterLayerCanvas;
