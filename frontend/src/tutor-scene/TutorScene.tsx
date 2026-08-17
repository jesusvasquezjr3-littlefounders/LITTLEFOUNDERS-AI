import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Box3, Group, Vector3, type PerspectiveCamera } from 'three';
import { SceneCanvas, type SceneStats } from './SceneCanvas';
import { SceneLighting } from './SceneLighting';
import { Diorama } from './Diorama';
import { Character3D } from './Character3D';
import { QUALITY_SETTINGS, type QualitySettings } from './quality';
import { GroundProvider, useGround } from './ground';
import { findStandingSpots, type StandingSpot } from './standingSpots';
import type { SCENE_ASSETS } from './assets';
import type { CharacterAction, CharacterEmotion, CharacterId } from '@/components/characters/control/types';

/*
 * The Tutor's 3D stage.
 *
 * PRESENTATION — a floating-island vignette rather than a room the camera sits
 * inside. That is the right call on all three axes this had to optimise for: a
 * whole island is ONE draw call at 45–67k triangles, it needs no environment
 * map or occlusion work to look finished, and a silhouette against a plain
 * backdrop reads as well at 375 px as at 1280 px. A first-person room would
 * have cost far more and read worse on a phone.
 *
 * FRAMING — computed from the composed scene's actual bounds, never authored.
 * The two islands differ in size (6.5 m and 9.5 m), characters differ in height
 * by 2.4×, and the viewport ranges from a portrait phone to a wide desktop. Any
 * hard-coded camera would frame exactly one of those combinations and crop the
 * rest; measuring costs one bounding-box computation, once.
 *
 * CAMERA MOTION — a slow, shallow orbit. It is what turns a static mesh into a
 * place, and it is nearly free: no re-render, no extra draw call, one sine per
 * frame. It stops completely under prefers-reduced-motion or on the low tier,
 * since a drifting camera is precisely what motion sensitivity is about.
 */

export interface TutorSceneProps {
  scene?: keyof typeof SCENE_ASSETS;
  character?: CharacterId;
  /** Optional companion, placed beside the main character. */
  companion?: CharacterId | null;
  className?: string;
  onStats?: (stats: SceneStats) => void;
  /** Same closed vocabulary as the 2D rig; drives every character in the scene. */
  emotion?: CharacterEmotion;
  action?: CharacterAction;
  actionKey?: number;
}

interface Framing {
  radius: number;
  height: number;
  target: Vector3;
}

/**
 * Frames the composed scene, then orbits it.
 *
 * Runs its fit once the content group has children with geometry, and re-fits
 * on viewport changes — a phone rotated to landscape is a different framing
 * problem, not the same one.
 */
function CameraRig({ content, enabled }: { content: React.RefObject<Group>; enabled: boolean }) {
  const camera = useThree((state) => state.camera) as PerspectiveCamera;
  const size = useThree((state) => state.size);
  const framing = useRef<Framing | null>(null);
  const settled = useRef(0);

  useFrame((state) => {
    const group = content.current;
    if (!group) return;

    if (!framing.current) {
      const box = new Box3().setFromObject(group);
      if (box.isEmpty()) return;
      const extent = box.getSize(new Vector3());
      const center = box.getCenter(new Vector3());

      /*
       * Fit to the BOX, not to the bounding sphere.
       *
       * A sphere around a wide flat island is dominated by its width, so
       * fitting one pushed the camera ~65% further back than necessary and
       * left the subject as a small object in a sea of margin. Fitting the
       * box's half-extents separately against the vertical and horizontal FOV
       * uses the frame the viewport actually has.
       */
      const aspect = size.width / Math.max(size.height, 1);
      const vFov = (camera.fov * Math.PI) / 180;
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
      // Depth matters: the far edge of the island needs clearing too, so half
      // the depth is added to each requirement.
      const halfDepth = Math.max(extent.x, extent.z) / 2;
      const forHeight = extent.y / 2 / Math.tan(vFov / 2) + halfDepth;
      const forWidth = Math.max(extent.x, extent.z) / 2 / Math.tan(hFov / 2) + halfDepth;
      const distance = Math.max(forHeight, forWidth) * (aspect < 1 ? 1.1 : 1.03);

      framing.current = {
        radius: distance,
        // ~22° above the horizon: high enough to show the island's surface and
        // read it as a place, low enough that the characters stay the subject
        // rather than being looked down on like pieces on a board.
        height: center.y + distance * 0.38,
        target: center.clone(),
      };
      settled.current = state.clock.elapsedTime;
    }

    const { radius, height, target } = framing.current;
    const elapsed = state.clock.elapsedTime - settled.current;
    const angle = Math.PI * 0.13 + (enabled ? elapsed * 0.04 : 0);
    const bob = enabled ? Math.sin(elapsed * 0.28) * radius * 0.012 : 0;

    camera.position.set(target.x + Math.sin(angle) * radius, height + bob, target.z + Math.cos(angle) * radius);
    camera.near = Math.max(radius / 200, 0.01);
    camera.far = radius * 20;
    camera.updateProjectionMatrix();
    camera.lookAt(target);
  });

  // Re-fit when the viewport changes shape — a phone turned to landscape is a
  // different framing problem, not the same one at a different size.
  useEffect(() => {
    framing.current = null;
  }, [size.width, size.height]);

  return null;
}

/** Flips visibility on once the first real frame has been drawn, so nothing pops. */
function Reveal({ onReady }: { onReady: () => void }) {
  const done = useRef(false);
  useFrame(() => {
    if (done.current) return;
    done.current = true;
    onReady();
  });
  return null;
}

/**
 * Solves standing positions once the island is in the graph, then renders the
 * cast on them. Characters are held back until the solve completes rather than
 * being placed at a guessed default and snapping afterwards.
 */
function Cast({
  character,
  companion,
  settings,
  emotion,
  action,
  actionKey,
}: {
  character: CharacterId;
  companion: CharacterId | null;
  settings: QualitySettings;
  emotion: CharacterEmotion;
  action: CharacterAction;
  actionKey: number;
}) {
  const { groundRef } = useGround();
  const [spots, setSpots] = useState<StandingSpot[] | null>(null);

  useEffect(() => {
    const ground = groundRef.current;
    if (!ground) return;
    setSpots(
      findStandingSpots(ground, {
        count: companion ? 2 : 1,
        minSeparation: 1.3,
        // The camera opens on +Z, so the cast gathers on that side of the
        // island instead of behind the back wall.
        preferDirection: new Vector3(0.35, 0, 1),
      }),
    );
  }, [groundRef, companion]);

  if (!spots || spots.length === 0) return null;

  const cast: Array<{ id: CharacterId; spot: StandingSpot }> = [];
  if (spots[0]) cast.push({ id: character, spot: spots[0] });
  if (companion && spots[1]) cast.push({ id: companion, spot: spots[1] });

  /*
   * Facing. The models' bind pose looks down +Z, so a yaw of `atan2(x, z)`
   * turns a character to face directly AWAY from the island's centre — which
   * is toward a camera orbiting outside it. Facing the centre instead (the
   * first attempt) showed the cast's backs, because "inward" and "toward the
   * viewer" are opposites when the camera is outside the scene.
   *
   * Each is then turned a quarter of the way toward the other, so a pair reads
   * as two figures sharing a moment rather than two props aimed at the lens.
   */
  return (
    <>
      {cast.map(({ id, spot }) => {
        const outward = Math.atan2(spot.x, spot.z);
        const other = cast.find((entry) => entry.id !== id)?.spot;
        const toward = other ? Math.atan2(other.x - spot.x, other.z - spot.z) : outward;
        // Shortest-arc blend: naive averaging of angles flips a character
        // around when the two are on opposite sides of ±π.
        const delta = Math.atan2(Math.sin(toward - outward), Math.cos(toward - outward));
        return (
          <Character3D
            key={id}
            id={id}
            settings={settings}
            position={[spot.x, 0, spot.z]}
            rotation={outward + delta * 0.25}
            emotion={emotion}
            action={action}
            actionKey={actionKey}
          />
        );
      })}
    </>
  );
}

export function TutorScene({
  scene = 'diorama-a',
  character = 'rho',
  companion = 'liruf',
  className,
  onStats,
  emotion = 'neutral',
  action = 'idle',
  actionKey = 0,
}: TutorSceneProps) {
  const [settings, setSettings] = useState<QualitySettings>(QUALITY_SETTINGS.medium);
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  const content = useRef<Group>(null);

  return (
    <SceneCanvas className={className} onStats={onStats} onSettings={setSettings} camera={{ fov: 36 }}>
      <SceneLighting settings={settings} />
      <GroundProvider>
        <Suspense fallback={null}>
          <group ref={content} visible={ready}>
            <Diorama id={scene} settings={settings} />
            <Cast
              character={character}
              companion={companion}
              settings={settings}
              emotion={emotion}
              action={action}
              actionKey={actionKey}
            />
          </group>
          <Reveal onReady={onReady} />
        </Suspense>
        <CameraRig content={content} enabled={settings.ambientMotion} />
      </GroundProvider>
    </SceneCanvas>
  );
}
