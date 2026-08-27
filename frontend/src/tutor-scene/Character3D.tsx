import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { AnimationMixer, Group, LoopOnce, LoopRepeat, type AnimationAction } from 'three';
import { useSceneModel } from './useSceneModel';
import { modelFooting } from './modelBounds';
import { characterScale, CHARACTER_ASSETS, SCENE_ASSET_BASE, type CharacterAsset } from './assets';
import { MouthCard, hasMouthCard } from './MouthCard';
import type { SceneBackdropId } from './backdrops';
import type { QualitySettings } from './quality';
import type { CharacterAction, CharacterEmotion, CharacterId } from '@/components/characters/control/types';
import { useGround } from './ground';
import { ContactShadow } from './ContactShadow';
import { bindRig, resetRig, type Rig, type RigKind } from './rig';
import {
  ACTION_SECONDS,
  CLIP_LIFT,
  LOOPING_ACTIONS,
  applyCharacterFrame,
  applyEmotionPosture,
  arc,
  limitFaceLift,
} from './characterActions';
import { useClipLibrary } from './useClipLibrary';
import {
  additiveClip,
  baseClipName,
  clipFor,
  emotionClipFor,
  LOOPING_CLIPS,
  restClipFrom,
} from './clipLibrary';

/*
 * A canonical character standing in the Tutor scene.
 *
 * ANIMATION — the honest state of things. Each export ships exactly ONE clip,
 * and they are locomotion cycles ("walking_man", "running", an Unreal take).
 * Looping a walk cycle on a character who is standing still and talking reads
 * as a treadmill, which is worse than not animating at all. So the authored
 * clip is used as a POSE (evaluated once at a chosen time and held), and the
 * life comes from a procedural idle composed on top: a breathing rise-and-fall
 * plus a slow sway, phase-offset per character so a group never pulses in
 * unison.
 *
 * This costs nothing (two sine calls per frame, no skinning re-evaluation) and
 * survives the arrival of real clips: when `idle`/`wave`/`point` exist, the
 * pose call becomes a clip call and the procedural layer stays as the
 * micro-motion underneath.
 */

export interface Character3DProps {
  id: CharacterId;
  settings: QualitySettings;
  /** Ground position. The model is placed so its feet rest on this point. */
  position?: [number, number, number];
  /** Y rotation in radians. */
  rotation?: number;
  /**
   * Emotion and action use the SAME closed vocabulary as the 2D rig
   * (components/characters/control/types.ts), so lesson content already
   * authored against `CharacterActor` drives these characters unchanged.
   */
  emotion?: CharacterEmotion;
  action?: CharacterAction;
  /** Bump to replay the same one-shot action twice in a row. */
  actionKey?: number;
  /*
   * Index into VISEMES (mouthCard.ts). Defaults to `closed`.
   *
   * This is the seam lip-sync plugs into: today a caller sets it, later an
   * audio-amplitude or viseme track drives it, and neither needs the model to
   * change — which is the whole reason the mouth is a card and not a rig.
   */
  viseme?: number;
  /**
   * The hour the island is standing in, forwarded to `MouthCard`.
   *
   * The character's own materials are lit and need nothing; the mouth card is
   * the one unlit surface in the scene and has to be told what colour the light
   * is (`backdrops.ts` -> `mouthCardTint`). Defaulted so a caller that has no
   * opinion — every test, and `/dev/scene-lab` — gets today's behaviour.
   */
  backdrop?: SceneBackdropId;
  /**
   * Whether to render the lip-sync card at all. Defaults to TRUE, so the Tutor
   * is untouched.
   *
   * The card is the seam lip-sync plugs into, and it is worth its draw call
   * exactly when something drives `viseme`. A surface that never speaks gets a
   * STATIC closed mouth pasted over the character's own painted one - and
   * because the card is unlit while the face around it is not, that paste reads
   * as a pale rectangle rather than as a mouth. Measured on `CharacterStage`
   * under the dark `auto` rig, which is dimmer than any of the island's hours
   * and is therefore a light the tint has never been looked at under.
   */
  mouth?: boolean;
}

/** Distinct irrational-ish multipliers keep two characters from breathing in sync. */
const PHASE = { dina: 0, liruf: 1.7, rho: 3.1, zara: 4.6 } as const satisfies Record<CharacterId, number>;

export function Character3D({
  id,
  settings,
  position = [0, 0, 0],
  rotation = 0,
  emotion = 'neutral',
  action = 'idle',
  actionKey = 0,
  viseme = 0,
  backdrop = 'auto',
  mouth = true,
}: Character3DProps) {
  const asset: CharacterAsset = CHARACTER_ASSETS[id];
  const { scene } = useSceneModel(asset.url, settings);
  const inner = useRef<Group>(null);

  const scale = useMemo(() => characterScale(asset), [asset]);

  /*
   * Feet-on-the-ground in two measured parts:
   *   footOffset — how far the model's own lowest vertex sits from its origin,
   *                after scaling.
   *   surfaceY   — the island's actual surface under this (x, z), by raycast.
   *
   * MEASURED IN THE MODEL'S OWN SPACE, and it has to be. `useSceneModel` shares
   * one Object3D per character, so on a remount this memo runs while that object
   * is still attached to the OUTGOING instance's scaled group — and
   * `Box3.setFromObject`, which this used to call, would then return the box
   * already in scene metres and scale it a second time. See `modelBounds.ts` for
   * the measurements; Dina's contact shadow reached 221 m across and her feet
   * 12 m below the island.
   */
  const { footOffset, footprint } = useMemo(() => modelFooting(scene, scale), [scene, scale]);

  const { sampleGround } = useGround();
  const [surfaceY, setSurfaceY] = useState<number | null>(null);

  useEffect(() => {
    // Both this component and the Diorama resolve inside the same Suspense
    // boundary, so by the time effects run the scenery is already in the graph.
    setSurfaceY(sampleGround(position[0], position[2]));
  }, [sampleGround, position]);

  /*
   * A character with no ground under them is a placement bug, not a character
   * at height zero. Rendering nothing makes it obvious; silently dropping them
   * onto an invisible plane would hide it.
   */
  const grounded = surfaceY !== null;
  const groundY = (surfaceY ?? 0) + footOffset;

  /*
   * ONE mixer owns this skeleton, and that is load-bearing rather than tidiness.
   *
   * With a second mixer for the clip library, each new AnimationMixer captured
   * its "original value" from whatever the bones happened to hold at bind time —
   * which, after a clamped one-shot, is the last frame of the PREVIOUS gesture.
   * Switching from `bow` to `wave` then layered the wave on top of a held bow.
   * A single mixer composes the pose and the additive layers explicitly instead.
   */
  const mixer = useMemo(() => new AnimationMixer(scene), [scene]);

  /*
   * THE BASE POSE IS THE BIND POSE. Nothing is played underneath.
   *
   * This used to evaluate the export's own clip at t=0 and hold that, on the
   * theory that it was "the character's actual standing posture rather than its
   * bind pose". It is the opposite. Every export ships exactly one clip and all
   * of them are locomotion cycles, so frame 0 is a stride, not a stance:
   * Zara stood with her legs crossed mid-step, and Liruf — whose clip is
   * `running` — was frozen AIRBORNE with his legs tucked. Every gesture in the
   * product then composed over that.
   *
   * The bind pose is the natural standing pose the models were authored in, and
   * it matches the reference captures of all four characters exactly.
   *
   * With no normal action playing, three.js falls back to each property's
   * ORIGINAL value — captured when the mixer first binds, which is the bind
   * pose — and applies the additive layers on top of it. That is precisely the
   * base this wants, so the correct amount of code here is none.
   */
  const rig = useRef<Rig | null>(null);
  /*
   * The rig's KIND is state, not a ref read.
   *
   * Deciding "is this a biped, so may it use the clip library" from
   * `rig.current` during render silently fails: a ref mutation does not
   * re-render, so the memo that picks a clip would keep whatever it computed
   * on the first pass — when `rig.current` is still null and everything looks
   * like a biped. Dina would then be handed clips authored for a skeleton she
   * does not have.
   */
  const [rigKind, setRigKind] = useState<RigKind | null>(null);
  useEffect(() => {
    const bound = bindRig(scene);
    rig.current = bound;
    setRigKind(bound.kind);
    return () => {
      rig.current = null;
    };
  }, [scene]);

  // One-shot actions restart when the action or its replay key changes.
  const actionLift = useRef(0);
  const runningAction = useRef<AnimationAction | null>(null);
  const actionStart = useRef(0);
  const startedFor = useRef<string>('');

  /*
   * AUTHORED CLIPS, when one exists for this action.
   *
   * Only for bipeds: rho, zara and liruf share the skeleton the library was
   * authored on, while Dina is a quadruped on a 27-joint rig whose bone names
   * do not match. Binding a biped clip to her would resolve nothing and leave
   * her frozen in bind pose — strictly worse than the procedural motion she has
   * — so she is excluded by RIG KIND rather than by hoping the names miss.
   */
  const { clips } = useClipLibrary();
  const clip = useMemo(
    () => (rigKind === 'biped' ? clipFor(clips, action, id) : null),
    [clips, action, rigKind, id],
  );

  /*
   * The reference pose the library's deltas are measured against. Without it
   * nothing from the library may play: an absolute clip re-poses the character
   * into the authoring rig's skeleton, which is a visibly broken character
   * rather than a missing gesture. Falling back to the procedural driver is the
   * strictly better failure.
   */
  const restClip = useMemo(() => restClipFrom(clips), [clips]);

  /*
   * The EMOTION LAYER, composed additively like the action.
   *
   * Only meaningful while the mixer owns the skeleton. On the procedural path
   * `applyEmotionPosture` does this job instead, and running both would apply
   * the emotion twice.
   */
  const emotionClip = useMemo(
    () => (rigKind === 'biped' ? emotionClipFor(clips, emotion, id) : null),
    [clips, emotion, rigKind, id],
  );

  const clipDriven = clip !== null && restClip !== null;

  useEffect(() => {
    if (!clipDriven || !emotionClip || !restClip) return;
    const additive = additiveClip(emotionClip, restClip);
    const layer = mixer.clipAction(additive);
    layer.setLoop(LoopRepeat, Infinity);
    layer.play();
    return () => {
      layer.stop();
      mixer.uncacheAction(additive, scene);
    };
  }, [mixer, clipDriven, emotionClip, restClip, scene]);

  useEffect(() => {
    if (!clip || !restClip) return;
    /*
     * ADDITIVE, not absolute. The three bipeds share bone NAMES but not rest
     * orientations — 23 of 24 differ, by up to 74 degrees at the hip — so an
     * absolute clip dresses each of them in Zara's skeleton. Additive makes the
     * mixer apply `characterOwnPose * authoredDelta`, so the gesture arrives
     * without the authoring character's stance coming with it.
     */
    const additive = additiveClip(clip, restClip);
    const running = mixer.clipAction(additive);
    running.reset();
    // The BASE name: `celebrate@rho` loops because `celebrate` does. Reading
    // the suffixed name here would turn every override into a one-shot.
    running.setLoop(LOOPING_CLIPS.has(baseClipName(clip.name)) ? LoopRepeat : LoopOnce, Infinity);
    // A finished one-shot HOLDS its last frame. Without this the mixer drops
    // the layer on the final frame and the character snaps upright the instant
    // a bow completes.
    running.clampWhenFinished = true;
    running.play();
    // Kept so the frame loop can read the clip's OWN progress for the lift,
    // rather than running a second, drifting clock beside it.
    runningAction.current = running;
    return () => {
      running.stop();
      runningAction.current = null;
      mixer.uncacheAction(additive, scene);
    };
    // actionKey replays the same clip: a one-shot that has already finished
    // will not restart on its own.
  }, [mixer, clip, restClip, scene, actionKey]);

  useFrame((state, delta) => {
    const group = inner.current;
    if (!group) return;

    const bones = rig.current;
    if (bones && clipDriven) {
      /*
       * The mixer OWNS the skeleton this frame: it writes the character's own
       * pose and then the additive gesture on top of it. `resetRig` and the
       * procedural driver are both skipped, because they assign absolute
       * orientations and the two layers would fight for the same joints —
       * whichever ran last would win, per bone, which reads as jitter rather
       * than as a bug.
       *
       * Emotion still composes, because it is a RELATIVE offset premultiplied
       * onto whatever the mixer just wrote.
       */
      mixer.update(delta);
      // An authored emotion clip is already blended in additively by the mixer;
      // applying the procedural posture as well would double it.
      if (!emotionClip) {
        applyEmotionPosture(bones, emotion, state.clock.elapsedTime + PHASE[id]);
      }
      /*
       * LAST, because it judges the FINISHED pose. The backward lean that hides
       * a face is composed from the rest stance, the emotion layer and the
       * action, and no one of them is wrong on its own — see `limitFaceLift`.
       */
      limitFaceLift(bones);
      /*
       * TRAVEL IS NOT IN THE CLIP. A clip can only express leaving the ground
       * as a hips translation in the authoring rig's units — an absolute value
       * shared between skeletons, which is the defect this whole layer exists
       * to avoid, and it would make a 1.9 m dino jump as far as a 1.7 m human.
       * The lift is read from the clip's OWN time so the flight matches the
       * crouch and landing the clip does carry.
       */
      const travel = CLIP_LIFT[action] ?? 0;
      const playing = runningAction.current;
      actionLift.current =
        travel > 0 && playing && playing.getClip().duration > 0
          ? arc(playing.time / playing.getClip().duration) * travel * asset.targetHeightM
          : 0;
    } else if (bones) {
      // Rest pose first; every driver accumulates onto it.
      resetRig(bones);

      const token = `${action}:${actionKey}`;
      if (startedFor.current !== token) {
        startedFor.current = token;
        actionStart.current = state.clock.elapsedTime;
      }

      const duration = ACTION_SECONDS[action];
      const elapsed = state.clock.elapsedTime - actionStart.current;
      const looping = LOOPING_ACTIONS.has(action);
      // A finished one-shot holds at progress 1 (its arc returns to zero
      // there), rather than snapping or restarting.
      const progress = duration <= 0 ? 0 : looping ? (elapsed % duration) / duration : Math.min(elapsed / duration, 1);

      const lift = applyCharacterFrame(bones, emotion, action, {
        progress,
        time: state.clock.elapsedTime + PHASE[id],
        lift: 0,
      });
      actionLift.current = lift * asset.targetHeightM;
      // Same rule on the procedural path: the quadruped composes an emotion
      // posture and an action driver onto the same joints.
      limitFaceLift(bones);
    }
    if (!settings.ambientMotion) {
      // Reduced motion or the low tier: hold the pose, perfectly still —
      // still ON THE GROUND, which is why groundY is the baseline and not 0.
      group.position.y = groundY + actionLift.current;
      group.rotation.z = 0;
      return;
    }
    const t = state.clock.elapsedTime + PHASE[id];
    // Amplitudes are proportional to the character's height, so the same
    // constants read identically on a 1.9 m dino and a 1.7 m adult. The bob is
    // ADDED to groundY: assigning it directly would drop every character
    // through the island, because this callback owns position.y outright.
    group.position.y = groundY + actionLift.current + Math.sin(t * 1.1) * 0.006 * asset.targetHeightM;
    group.rotation.z = Math.sin(t * 0.43) * 0.006;
  });

  if (!grounded) return null;

  return (
    <group position={[position[0], 0, position[2]]} rotation={[0, rotation, 0]}>
      {/* Anchored to the SURFACE, not to the bobbing group — a shadow that
          rises and falls with the breathing idle would detach from the floor. */}
      <group position={[0, surfaceY ?? 0, 0]}>
        <ContactShadow radius={footprint * 1.15} />
      </group>
      <group ref={inner} position={[0, groundY, 0]} scale={scale}>
        <primitive object={scene} />
        {/* Only the characters whose card has been fitted carry one; the rest
            keep their painted mouth rather than get a generic one bolted on. */}
        {mouth && hasMouthCard(id) ? (
          <MouthCard
            id={id}
            scene={scene}
            assetBase={SCENE_ASSET_BASE}
            viseme={viseme}
            anisotropy={settings.anisotropy}
            backdrop={backdrop}
          />
        ) : null}
      </group>
    </group>
  );
}

/** Preload hint so a character's bytes are in flight before it mounts. */
export const CHARACTER_URLS = Object.values(CHARACTER_ASSETS).map((asset) => asset.url);
export { PHASE as CHARACTER_IDLE_PHASE };
