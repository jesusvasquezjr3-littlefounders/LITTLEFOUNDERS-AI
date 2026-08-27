import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useThree } from '@react-three/fiber';
import type { CharacterAction, CharacterEmotion, CharacterId } from '@/components/characters/control/types';
import { Character3D } from './Character3D';
import { ContactShadow } from './ContactShadow';
import { FlatGroundProvider } from './ground';
import { SceneCanvas, type SceneStats } from './SceneCanvas';
import { SceneLighting } from './SceneLighting';
import { CHARACTER_MEASUREMENTS } from './measurements';

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
  /** A lesson avatar has no floor to cast onto; a lab tile reads better with one. */
  shadow?: boolean;
  className?: string;
  onStats?: (stats: SceneStats) => void;
  /** Rendered over the canvas, e.g. a name plate in the lab. */
  overlay?: ReactNode;
}

/*
 * The camera is derived from the character's own height rather than fixed,
 * because the cast is not one size: Zara is 1.61 m and Dina 1.9 m, and a
 * hard-coded distance frames one of them and crops the other. `measurements.ts`
 * is the same source `standingSpots` and the marketing captures read.
 */
export function stageCamera(id: CharacterId, fill: number): { position: [number, number, number]; fov: number } {
  const height = CHARACTER_MEASUREMENTS[id].targetHeightM;
  const fov = 30;
  // The vertical extent a perspective camera sees at distance d is
  // 2 * d * tan(fov/2); solving for the distance that makes the character
  // occupy `fill` of it keeps framing identical across the cast.
  const visible = height / Math.max(0.05, Math.min(1, fill));
  const distance = visible / (2 * Math.tan((fov * Math.PI) / 360));
  // Eye level, not floor level: aiming at the feet puts the head against the
  // top edge and wastes the frame on ground nobody drew.
  return { position: [0, height * 0.55, distance], fov };
}

/*
 * AIM. `SceneCanvas` takes a camera POSITION and nothing else, and R3F's default
 * camera looks at the origin - so a camera lifted to eye height tilts DOWN at
 * the floor and pushes the head off the top of the frame. The first render of
 * the pose lab cropped Zara at the shoulders for exactly that reason.
 *
 * Lives inside the Canvas because `useThree` only exists there, and re-aims on
 * every change because the height it aims at is per character.
 */
function AimAt({ y }: { y: number }) {
  const camera = useThree((state) => state.camera);
  useEffect(() => {
    camera.lookAt(0, y, 0);
    camera.updateProjectionMatrix();
  }, [camera, y]);
  return null;
}

export function CharacterStage({
  id,
  emotion = 'neutral',
  action = 'idle',
  actionKey,
  rotation = 0,
  fill = 0.78,
  shadow = false,
  className,
  onStats,
  overlay,
}: CharacterStageProps) {
  // `SceneCanvas` owns the governor and hands the resolved tier down; every
  // consumer of `settings` below is inside the canvas, so it is state rather
  // than a prop we could have computed here.
  const [settings, setSettings] = useState<Parameters<typeof Character3D>[0]['settings'] | null>(null);
  const camera = useMemo(() => stageCamera(id, fill), [id, fill]);

  return (
    <div className={className}>
      <SceneCanvas className="h-full w-full" camera={camera} onStats={onStats} onSettings={setSettings}>
        {settings && (
          <>
            {/* `auto` resolves against the app theme. A lesson has no time of day. */}
            <AimAt y={CHARACTER_MEASUREMENTS[id].targetHeightM * 0.55} />
            <SceneLighting settings={settings} backdrop="auto" />
            {/* The stage has no island, so the floor is the origin plane. See
                FlatGroundProvider: this is a statement about this surface, not
                a workaround for the diorama's "no ground means a bug" rule. */}
            <FlatGroundProvider>
              <Suspense fallback={null}>
              <Character3D
                id={id}
                settings={settings}
                emotion={emotion}
                action={action}
                actionKey={actionKey}
                rotation={rotation}
              />
              {shadow && <ContactShadow radius={CHARACTER_MEASUREMENTS[id].targetHeightM * 0.35} />}
              </Suspense>
            </FlatGroundProvider>
          </>
        )}
      </SceneCanvas>
      {overlay}
    </div>
  );
}
