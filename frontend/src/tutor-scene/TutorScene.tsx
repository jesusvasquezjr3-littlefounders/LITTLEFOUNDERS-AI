import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Box3, Group, Vector3 } from 'three';
import { SceneCanvas, type SceneStats } from './SceneCanvas';
import { SceneLighting } from './SceneLighting';
import { Diorama } from './Diorama';
import { Character3D } from './Character3D';
import { getDeviceProbe, QUALITY_SETTINGS, type QualitySettings } from './quality';
import { GroundProvider, useGround } from './ground';
import { findStandingSpots, type StandingSpot } from './standingSpots';
import { CHARACTER_ASSETS, characterFootprintM, type SCENE_ASSETS } from './assets';
import { walkabilityFor } from './walkability';
import { CameraDirector } from './CameraDirector';
import { shotForLegacyFraming, STAGE_BEARING, type LegacyFraming, type ShotId, type ShotSubject } from './shots';
import { AnchorProjector, AnchorProvider, useAnchorRegistry, WorldAnchor } from './ScreenAnchor';
import { SKY_MARK_IDS, STAGE_MARK_IDS } from './anchors';
import type { SceneBackdropId } from './backdrops';
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
 * CAMERA MOTION — owned by `CameraDirector`, which damps toward whatever pose
 * `shots.ts` names for the active shot. The rig this replaced computed an
 * absolute position inside every frame and wrote it, which is why every framing
 * change SNAPPED: there was no state between one framing and the next for
 * anything to move through. The idle orbit still stops completely under
 * prefers-reduced-motion or on the low tier; the TRAVEL between shots does not,
 * because it costs the same single camera write either way and a stage that can
 * only cut is a worse experience than the one the demotion was protecting.
 */

/**
 * The stage's two shipped framings.
 *
 * Superseded by `ShotId`, and kept only because `ConversationView` still speaks
 * it. Mapping rather than deleting is what lets the camera rebuild land without
 * a flag day across the conversational layer, which a later increment owns.
 *
 * @deprecated Pass `shot` instead.
 */
export type TutorFraming = LegacyFraming;

/**
 * Where a character's head is, and which way they face.
 *
 * Solved by the placement pass rather than authored — the same reason a new
 * diorama needs no coordinates (§5). Structurally identical to the shot
 * vocabulary's `ShotSubject`, and deliberately the same type: the placement
 * solver's output IS the camera's input, and two shapes that must agree are
 * better as one.
 */
export type SpeakerFocus = ShotSubject;

/** Which member of the cast a focus point belongs to. */
type CastRole = 'lead' | 'companion';

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
  /**
   * Index into VISEMES (mouthAtlas.ts), for characters that have a mouth card.
   * This is the seam lip-sync plugs into — see /TUTOR_3D.md §7.1.
   */
  viseme?: number;
  /**
   * How the camera frames the scene. The full vocabulary lives in `shots.ts`;
   * the director travels between them rather than cutting.
   */
  shot?: ShotId;
  /**
   * @deprecated Use `shot`. Honoured only when `shot` is absent, so a caller
   * that has not migrated keeps exactly the framing it had.
   */
  framing?: TutorFraming;
  /**
   * Time of day. Reaches `SceneLighting`, which is the whole point: this axis
   * was offered, validated, persisted and returned by two endpoints while
   * reaching no renderer at all.
   */
  backdrop?: SceneBackdropId;
  /**
   * Fires ONCE, when the island and cast are actually on screen.
   *
   * The scene already gated its own visibility on this and kept it to itself,
   * which left the conversational layer no way to know whether anyone was there
   * yet. Handing it a line before the assets resolve plays audio at a blank
   * canvas — the tutor talking to an empty island. Wait for this before the
   * first line.
   */
  onReady?: () => void;
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
 * Publishes the stage's named places so DOM controls can be pinned to them.
 *
 * The island's own anchors are measured from the registered ground rather than
 * authored, for the same reason placement is: `diorama-a` is 6.5 m across and
 * `diorama-b` is 9.5 m, so a rim anchor written as a coordinate is correct on
 * exactly one island.
 */
function StageAnchors({
  scene,
  lead,
  companion,
}: {
  scene: keyof typeof SCENE_ASSETS;
  lead: SpeakerFocus | null;
  companion: SpeakerFocus | null;
}) {
  const { groundRef } = useGround();
  const [island, setIsland] = useState<{ x: number; z: number; top: number; radius: number; height: number } | null>(
    null,
  );

  /*
   * Measured by WATCHING for the island rather than by measuring once on mount.
   *
   * A one-shot effect would depend on this component's effect running after the
   * island's, which is true today only because of where both sit in the tree —
   * and the failure if that ever stops being true is silent: the island's
   * anchors are simply never published, and every chip pinned to one is hidden
   * forever, which looks like a styling bug rather than a missing measurement.
   * An island also arrives LATE by design, after a .glb fetch inside a Suspense
   * boundary this component deliberately sits outside of, so that a character
   * swap cannot take the island's anchors down with it.
   *
   * The watch costs a ref read and an identity comparison three times a second.
   * The bounding box is only walked when the island object actually changed.
   */
  useEffect(() => {
    let seen: object | null = null;

    const check = () => {
      const ground = groundRef.current;
      if (ground === seen) return;
      seen = ground;

      if (!ground) {
        // Mid-swap: the old island has unregistered and the new one has not
        // arrived. Publishing nothing culls the chips instead of leaving them
        // hovering at the previous island's rim.
        setIsland(null);
        return;
      }

      const box = new Box3().setFromObject(ground);
      if (box.isEmpty()) {
        seen = null;
        return;
      }
      const centre = box.getCenter(new Vector3());
      const extent = box.getSize(new Vector3());
      setIsland({
        x: centre.x,
        z: centre.z,
        top: box.max.y,
        radius: Math.max(extent.x, extent.z) / 2,
        height: extent.y,
      });
    };

    check();
    const timer = window.setInterval(check, 300);
    return () => window.clearInterval(timer);
  }, [groundRef, scene]);

  /*
   * The free marks fan across the arc the camera opens onto, so a chip pinned to
   * one is in front of the island rather than behind it. Spread over ±58° of the
   * stage bearing: wide enough that five chips do not stack, narrow enough that
   * none of them is round the back.
   */
  const marks = useMemo(() => {
    if (!island) return null;
    const spread = (58 * Math.PI) / 180;
    return STAGE_MARK_IDS.map((_, index) => {
      const t = STAGE_MARK_IDS.length > 1 ? index / (STAGE_MARK_IDS.length - 1) : 0.5;
      const angle = STAGE_BEARING - spread + t * spread * 2;
      return { sin: Math.sin(angle), cos: Math.cos(angle) };
    });
  }, [island]);

  if (!island || !marks) return null;

  const rightX = Math.cos(STAGE_BEARING);
  const rightZ = -Math.sin(STAGE_BEARING);
  const rim = island.radius * 0.88;
  const skyHeight = island.top + Math.max(island.height * 0.9, 2.4);

  return (
    <>
      {lead ? <WorldAnchor slot="lead.head" point={[lead.x, lead.y, lead.z]} /> : null}
      {lead ? <WorldAnchor slot="lead.chest" point={[lead.x, lead.y - lead.height * 0.28, lead.z]} /> : null}
      {companion ? (
        <WorldAnchor slot="companion.head" point={[companion.x, companion.y, companion.z]} />
      ) : null}

      <WorldAnchor slot="island.centre" point={[island.x, island.top, island.z]} />
      <WorldAnchor
        slot="island.rim.left"
        point={[island.x - rightX * rim, island.top, island.z - rightZ * rim]}
      />
      <WorldAnchor
        slot="island.rim.right"
        point={[island.x + rightX * rim, island.top, island.z + rightZ * rim]}
      />

      {STAGE_MARK_IDS.map((slot, index) => {
        const mark = marks[index];
        if (!mark) return null;
        const radius = island.radius * 0.68;
        return (
          <WorldAnchor
            key={slot}
            slot={slot}
            point={[island.x + mark.sin * radius, island.top + 1.1, island.z + mark.cos * radius]}
          />
        );
      })}

      {SKY_MARK_IDS.map((slot, index) => {
        const mark = marks[index];
        if (!mark) return null;
        const radius = island.radius * 0.78;
        return (
          <WorldAnchor
            key={slot}
            slot={slot}
            point={[island.x + mark.sin * radius, skyHeight, island.z + mark.cos * radius]}
          />
        );
      })}
    </>
  );
}

/**
 * Solves standing positions once the island is in the graph, then renders the
 * cast on them. Characters are held back until the solve completes rather than
 * being placed at a guessed default and snapping afterwards.
 */
function Cast({
  scene,
  character,
  companion,
  settings,
  emotion,
  action,
  actionKey,
  viseme,
  onFocus,
}: {
  scene: keyof typeof SCENE_ASSETS;
  character: CharacterId;
  companion: CharacterId | null;
  settings: QualitySettings;
  emotion: CharacterEmotion;
  action: CharacterAction;
  actionKey: number;
  viseme: number;
  onFocus: (role: CastRole, focus: SpeakerFocus | null) => void;
}) {
  const { groundRef } = useGround();
  const [spots, setSpots] = useState<StandingSpot[] | null>(null);

  /*
   * Separation is derived from WHO IS STANDING THERE, not a constant.
   *
   * It was a flat 1.3 m, which quietly assumed every character is human-sized.
   * They are not, and the footprints are measured rather than proportional:
   * Rho covers 0.82 m, Liruf 1.70 m because of his tail, and Dina 2.83 m. Two
   * spots 1.3 m apart put Dina straight through Liruf however flat and open the
   * ground under each of them scored.
   *
   * Centres must clear both half-footprints, plus a margin so they read as two
   * characters sharing a place rather than two characters just barely missing.
   */
  const minSeparation = useMemo(() => {
    const lead = characterFootprintM(CHARACTER_ASSETS[character]);
    const second = companion ? characterFootprintM(CHARACTER_ASSETS[companion]) : 0;
    return Math.max(1.3, (lead + second) / 2 + 0.35);
  }, [character, companion]);

  /*
   * WHERE A CHARACTER MAY STAND AT ALL, as opposed to where the ground happens
   * to be flat. Baked per island by `npm run assets:walkmask` — the solver has
   * no way to tell water from sand on its own, and on `diorama-b` water wins on
   * flatness, which put the whole cast in the pond.
   *
   * A missing mask means the island was never checked. It is NOT read as
   * permission: the console says so, once, because the alternative is that a
   * new diorama silently inherits the exact bug this replaced.
   */
  const isWalkable = useMemo(() => {
    const mask = walkabilityFor(scene);
    if (!mask) {
      console.warn(
        `[tutor-scene] no walkability mask for "${scene}" — placement can only judge shape, ` +
          'not what a surface is. Run `npm run assets:walkmask`.',
      );
    }
    return mask ?? undefined;
  }, [scene]);

  /*
   * The widest half-footprint on stage, used to PREFER roomy spots. Not to
   * reject them: Dina covers 2.83 m of a 6.5 m island, so a hard requirement
   * could leave her with nowhere to stand, and an empty island is a worse
   * failure than a character standing near the rim.
   */
  const clearance = useMemo(() => {
    const lead = characterFootprintM(CHARACTER_ASSETS[character]) / 2;
    const second = companion ? characterFootprintM(CHARACTER_ASSETS[companion]) / 2 : 0;
    return Math.max(lead, second);
  }, [character, companion]);

  /*
   * THE SOLVE DOES NOT DEPEND ON THE CAMERA, and it must never start to.
   *
   * `two-shot` and `over-shoulder` deliberately orbit off the cast's facing
   * axis. If the shot fed back into placement, the cast would re-solve to face a
   * camera that is itself still moving, and the two would chase each other — the
   * characters ending up aimed at a framing that has already been left behind.
   * The dependency array below is the enforcement: no shot, no framing, no
   * camera state appears in it.
   */
  useEffect(() => {
    const ground = groundRef.current;
    if (!ground) return;
    setSpots(
      findStandingSpots(ground, {
        count: companion ? 2 : 1,
        minSeparation,
        // The camera opens on +Z, so the cast gathers on that side of the
        // island instead of behind the back wall.
        preferDirection: new Vector3(0.35, 0, 1),
        isWalkable,
        clearance,
      }),
    );
  }, [groundRef, companion, minSeparation, isWalkable, clearance]);

  /*
   * Report where each character's head is, so the camera has something to frame.
   * Derived from the solved spot and the character's own measured height rather
   * than a constant: rho is 1.70 m and Dina 1.90 m at the shoulder, and one
   * hard-coded eye level would frame a human's chin and a quadruped's sky.
   *
   * BOTH members are reported now, not just the lead. `two-shot` and
   * `over-shoulder` need the second subject, and a shot that silently degrades
   * because the data was never published is indistinguishable from one that is
   * framed wrong.
   *
   * This hook sits ABOVE the early return on purpose. Placing it after the
   * `spots` guard changed the hook COUNT between the render before spots
   * resolved and the one after, which React reports as "Rendered more hooks
   * than during the previous render" and which took the whole page blank.
   */
  const leadSpot = spots?.[0] ?? null;
  const secondSpot = spots?.[1] ?? null;
  useEffect(() => {
    if (!leadSpot) {
      onFocus('lead', null);
      onFocus('companion', null);
      return;
    }

    const focusFor = (spot: StandingSpot, other: StandingSpot | null, height: number): SpeakerFocus => {
      const outward = Math.atan2(spot.x, spot.z);
      const toward = other ? Math.atan2(other.x - spot.x, other.z - spot.z) : outward;
      // Shortest-arc blend: naive averaging of angles flips a character around
      // when the two are on opposite sides of ±π.
      const delta = Math.atan2(Math.sin(toward - outward), Math.cos(toward - outward));
      return {
        x: spot.x,
        // Eye level, as a fraction of the character's own height. Dina is a
        // quadruped at 0.70 m to the shoulder; a fixed 1.6 m would aim at sky.
        // Mid-head, not the crown: aiming at the top of the skull put the whole
        // face in the bottom half of the frame.
        y: spot.y + height * 0.75,
        z: spot.z,
        facing: outward + delta * 0.25,
        height,
      };
    };

    onFocus('lead', focusFor(leadSpot, secondSpot, CHARACTER_ASSETS[character].targetHeightM));
    onFocus(
      'companion',
      companion && secondSpot
        ? focusFor(secondSpot, leadSpot, CHARACTER_ASSETS[companion].targetHeightM)
        : null,
    );
  }, [leadSpot, secondSpot, character, companion, onFocus]);

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
            viseme={viseme}
          />
        );
      })}
    </>
  );
}

/** Two focus points are the same when every number is. */
function sameFocus(a: SpeakerFocus | null, b: SpeakerFocus | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.x === b.x && a.y === b.y && a.z === b.z && a.facing === b.facing && a.height === b.height;
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
  viseme = 0,
  shot,
  framing,
  backdrop = 'auto',
  onReady,
}: TutorSceneProps) {
  const [settings, setSettings] = useState<QualitySettings>(QUALITY_SETTINGS.medium);
  const [ready, setReady] = useState(false);
  const reveal = useCallback(() => setReady(true), []);

  /*
   * Announced through a ref rather than by depending on `onReady` identity: a
   * caller passing an inline arrow changes it every render, and this has to
   * fire exactly once however the callback is written.
   */
  const announced = useRef(false);
  useEffect(() => {
    if (!ready || announced.current) return;
    announced.current = true;
    onReady?.();
  }, [ready, onReady]);

  const content = useRef<Group>(null);
  const [focus, setFocus] = useState<{ lead: SpeakerFocus | null; companion: SpeakerFocus | null }>({
    lead: null,
    companion: null,
  });

  /*
   * The equality guard is not defensive tidiness. The reporting effect builds a
   * fresh object every time it runs, and this state feeds a prop that feeds
   * another effect; without it, a value that has not actually changed still
   * produces a new identity, which is precisely the render-loop generator
   * frontend/AGENTS.md records.
   */
  const onFocus = useCallback((role: CastRole, next: SpeakerFocus | null) => {
    setFocus((previous) => (sameFocus(previous[role], next) ? previous : { ...previous, [role]: next }));
  }, []);

  /*
   * `ambientMotion` is already false under reduced motion, so it cannot tell the
   * two apart — and the director must, because a low tier still gets camera
   * TRAVEL while a reduced-motion request gets a cut. The probe carries the
   * accessibility instruction on its own.
   */
  const prefersReducedMotion = useMemo(() => getDeviceProbe().prefersReducedMotion, []);

  /*
   * The stage provides its own anchor registry only when nothing above it
   * already has. Once `StageShell` hoists the provider so HUD siblings can share
   * it, this reads non-null and the local wrapper stops being rendered — which
   * is what lets the two layers land in separate commits with no broken step in
   * between.
   */
  const inheritedAnchors = useAnchorRegistry();

  const activeShot: ShotId = shot ?? (framing ? shotForLegacyFraming(framing) : 'establishing');

  /*
   * Everything a change of island or cast invalidates about the measured fit.
   * It used to invalidate on viewport resize alone, which is wrong by a whole
   * island: 6.5 m and 9.5 m are different framing problems, and a stale fit
   * frames one of them with a third of the screen empty.
   */
  const fitKey = `${scene}|${character}|${companion ?? 'solo'}`;

  const stage = (
    <SceneCanvas className={className} onStats={onStats} onSettings={setSettings} camera={{ fov: 36 }}>
      {/* Outside the Suspense boundary on purpose: a backdrop change updates
          instantly and can never blank the stage while an asset resolves. */}
      <SceneLighting settings={settings} backdrop={backdrop} />
      <GroundProvider>
        {/*
         * TWO boundaries, not one. A single boundary around the island and the
         * cast meant swapping a character unmounted the island with them — the
         * whole stage went blank for the length of a .glb fetch, at exactly the
         * moment the learner was choosing who to talk to.
         */}
        <Suspense fallback={null}>
          <group ref={content} visible={ready}>
            <Diorama id={scene} settings={settings} />
            <Suspense fallback={null}>
              <Cast
                scene={scene}
                character={character}
                companion={companion}
                settings={settings}
                emotion={emotion}
                action={action}
                actionKey={actionKey}
                viseme={viseme}
                onFocus={onFocus}
              />
              {/*
               * INSIDE the cast's boundary, not beside it. `onReady` promises the
               * island AND the cast are on screen, and the conversational layer
               * gates the tutor's first line on it — a signal that arrived while
               * a character .glb was still in flight would play audio at an empty
               * island, which is the exact failure the callback exists to
               * prevent. `ready` never resets afterwards, so the split boundary
               * still does its job: swapping a character no longer takes the
               * island down with it.
               */}
              <Reveal onReady={reveal} />
            </Suspense>
          </group>
        </Suspense>
        <StageAnchors scene={scene} lead={focus.lead} companion={focus.companion} />
        <CameraDirector
          content={content}
          shot={activeShot}
          lead={focus.lead}
          companion={focus.companion}
          ambientMotion={settings.ambientMotion}
          reducedMotion={prefersReducedMotion}
          fitKey={fitKey}
        />
        <AnchorProjector />
      </GroundProvider>
    </SceneCanvas>
  );

  return inheritedAnchors ? stage : <AnchorProvider>{stage}</AnchorProvider>;
}
