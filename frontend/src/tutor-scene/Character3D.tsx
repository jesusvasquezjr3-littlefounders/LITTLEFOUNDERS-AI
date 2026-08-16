import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { AnimationMixer, Box3, Group, LoopOnce, LoopRepeat, Vector3 } from 'three';
import { useSceneModel } from './useSceneModel';
import { characterScale, CHARACTER_ASSETS, SCENE_ASSET_BASE, type CharacterAsset } from './assets';
import { MouthCard, hasMouthCard } from './MouthCard';
import type { QualitySettings } from './quality';
import type { CharacterAction, CharacterEmotion, CharacterId } from '@/components/characters/control/types';
import { useGround } from './ground';
import { ContactShadow } from './ContactShadow';
import { bindRig, resetRig, type Rig, type RigKind } from './rig';
import { ACTION_SECONDS, LOOPING_ACTIONS, applyCharacterFrame, applyEmotionPosture } from './characterActions';
import { useClipLibrary } from './useClipLibrary';
import { additiveEmotion, clipFor, emotionClipFor, LOOPING_CLIPS, restClipFrom } from './clipLibrary';

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
  /** Seconds into the authored clip to freeze at. */
  poseAt?: number;
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
}

/** Distinct irrational-ish multipliers keep two characters from breathing in sync. */
const PHASE = { dina: 0, liruf: 1.7, rho: 3.1, zara: 4.6 } as const satisfies Record<CharacterId, number>;

export function Character3D({
  id,
  settings,
  position = [0, 0, 0],
  rotation = 0,
  poseAt = 0,
  emotion = 'neutral',
  action = 'idle',
  actionKey = 0,
  viseme = 0,
}: Character3DProps) {
  const asset: CharacterAsset = CHARACTER_ASSETS[id];
  const { scene, animations } = useSceneModel(asset.url, settings);
  const inner = useRef<Group>(null);

  const scale = useMemo(() => characterScale(asset), [asset]);

  /*
   * Feet-on-the-ground in two measured parts:
   *   footOffset — how far the model's own lowest vertex sits from its origin,
   *                after scaling. The exports mostly rest on y=0, but "mostly"
   *                is not a contract and a character sunk a centimetre into an
   *                island reads as cheap.
   *   surfaceY   — the island's actual surface under this (x, z), by raycast.
   */
  const { footOffset, footprint } = useMemo(() => {
    const box = new Box3().setFromObject(scene);
    const size = box.getSize(new Vector3());
    return {
      footOffset: -box.min.y * scale,
      // Footprint, not height: a quadruped is wide and low, a human narrow and
      // tall, and a shadow sized off height would be absurd on both.
      footprint: (Math.max(size.x, size.z) * scale) / 2,
    };
  }, [scene, scale]);

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

  // Evaluate the authored clip once to get a usable standing pose, then stop.
  const mixer = useMemo(() => (animations.length ? new AnimationMixer(scene) : null), [animations, scene]);
  useEffect(() => {
    if (!mixer || !animations[0]) return;
    const action = mixer.clipAction(animations[0]);
    action.play();
    mixer.setTime(poseAt);
    action.paused = true;
    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(scene);
    };
  }, [mixer, animations, poseAt, scene]);

  /*
   * Bound AFTER the authored clip has been posed (the effect above runs first
   * in declaration order), so the captured rest orientations are the character's
   * actual standing posture rather than its bind pose.
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
  }, [scene, poseAt]);

  // One-shot actions restart when the action or its replay key changes.
  const actionLift = useRef(0);
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
    () => (rigKind === 'biped' ? clipFor(clips, action) : null),
    [clips, action, rigKind],
  );

  const clipMixer = useMemo(() => (clip ? new AnimationMixer(scene) : null), [clip, scene]);

  /*
   * The EMOTION LAYER, composed additively over the action clip.
   *
   * Only meaningful while the mixer owns the skeleton. On the procedural path
   * `applyEmotionPosture` does this job instead, and running both would apply
   * the emotion twice.
   */
  const emotionClip = useMemo(
    () => (rigKind === 'biped' ? emotionClipFor(clips, emotion) : null),
    [clips, emotion, rigKind],
  );
  const restClip = useMemo(() => restClipFrom(clips), [clips]);

  useEffect(() => {
    if (!clipMixer || !emotionClip || !restClip) return;
    const additive = additiveEmotion(emotionClip, restClip);
    const layer = clipMixer.clipAction(additive);
    layer.setLoop(LoopRepeat, Infinity);
    layer.play();
    return () => {
      layer.stop();
      clipMixer.uncacheAction(additive, scene);
    };
  }, [clipMixer, emotionClip, restClip, scene]);

  useEffect(() => {
    if (!clipMixer || !clip) return;
    const running = clipMixer.clipAction(clip);
    running.reset();
    running.setLoop(LOOPING_CLIPS.has(clip.name) ? LoopRepeat : LoopOnce, Infinity);
    // A finished one-shot HOLDS its last frame. Without this the mixer restores
    // the bind pose on the final frame and the character snaps upright the
    // instant a bow completes.
    running.clampWhenFinished = true;
    running.play();
    return () => {
      running.stop();
      clipMixer.uncacheAction(clip, scene);
    };
    // actionKey replays the same clip: a one-shot that has already finished
    // will not restart on its own.
  }, [clipMixer, clip, scene, actionKey]);

  useFrame((state, delta) => {
    const group = inner.current;
    if (!group) return;

    const bones = rig.current;
    if (bones && clipMixer) {
      /*
       * An authored clip OWNS the skeleton this frame. `resetRig` and the
       * procedural driver are both skipped, because a mixer writes absolute
       * orientations and the two layers would fight for the same joints —
       * whichever ran last would win, per bone, which reads as jitter rather
       * than as a bug.
       *
       * Emotion still composes, because it is a RELATIVE offset premultiplied
       * onto whatever the mixer just wrote.
       */
      clipMixer.update(delta);
      // An authored emotion clip is already blended in additively by the mixer;
      // applying the procedural posture as well would double it.
      if (!emotionClip) {
        applyEmotionPosture(bones, emotion, state.clock.elapsedTime + PHASE[id]);
      }
      actionLift.current = 0;
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
    // constants read identically on a 0.7 m dino and a 1.7 m adult. The bob is
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
        {hasMouthCard(id) ? (
          <MouthCard
            id={id}
            scene={scene}
            assetBase={SCENE_ASSET_BASE}
            viseme={viseme}
            anisotropy={settings.anisotropy}
          />
        ) : null}
      </group>
    </group>
  );
}

/** Preload hint so a character's bytes are in flight before it mounts. */
export const CHARACTER_URLS = Object.values(CHARACTER_ASSETS).map((asset) => asset.url);
export { PHASE as CHARACTER_IDLE_PHASE };
