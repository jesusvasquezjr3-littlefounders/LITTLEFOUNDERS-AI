import { Fragment, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Box3, Group, Vector3 } from 'three';
import { SceneCanvas, type SceneStats } from './SceneCanvas';
import { SceneLighting } from './SceneLighting';
import { Diorama } from './Diorama';
import { Character3D } from './Character3D';
import { getDeviceProbe, QUALITY_SETTINGS, type QualitySettings } from './quality';
import { GroundProvider, useGround } from './ground';
import {
  AUDITION_GROUPING,
  AUDITION_SAMPLES_PER_METRE,
  findStandingSpots,
  type StandingSpot,
} from './standingSpots';
import {
  castClearanceM,
  castSeparationM,
  CHARACTER_ASSETS,
  characterFootprintM,
  pairSeparationM,
  type SCENE_ASSETS,
} from './assets';
import { walkabilityFor } from './walkability';
import { CameraDirector } from './CameraDirector';
import { solveFacings } from './facing';
import { shotForLegacyFraming, STAGE_BEARING, type LegacyFraming, type ShotId, type ShotSubject } from './shots';
import { AnchorProjector, AnchorProvider, useAnchorRegistry, WorldAnchor } from './ScreenAnchor';
import { castMarks, SKY_MARK_IDS, STAGE_MARK_IDS, type AnchorId } from './anchors';
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

/**
 * Somebody who is actually standing on the island, and where their head is.
 *
 * `index` is their position in the cast the caller asked for, and it is the
 * whole reason this is an ordered list rather than a lead/companion pair: the
 * personalization audition hangs candidate N's name plate on `castMarks(n)[N]`,
 * so the scene has to be able to say WHICH candidate is standing where. A
 * candidate the solver could not seat is simply absent from this list, and the
 * plate that would have named them is then culled rather than left hovering
 * over empty grass.
 */
export interface CastPlacement {
  id: CharacterId;
  index: number;
  focus: SpeakerFocus;
}

/** Stable empty list, so "nobody is placed" is not a new array every render. */
const NO_PLACEMENTS: readonly CastPlacement[] = Object.freeze([]);

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
   * EVERYONE who should be standing on the island, in candidate order.
   *
   * Absent (the normal case) means the cast is the tutor and their companion.
   * Present means the personalization audition: the whole catalog stands on the
   * island at once, so that choosing a tutor is looking at people rather than
   * reading name plates hung over empty ground, which is what the stage marks
   * were before this existed (/ORACLE.md §10 — "tapping the character on the
   * island").
   *
   * It is a BUDGET decision as well as a design one. Four characters measure
   * 106,208 triangles against a 220,000 per-frame ceiling, which fits on either
   * island — but only with the shadow pass off, since a shadow-casting light
   * submits the whole scene twice. The scene turns shadows off for the duration
   * rather than dropping a candidate; see `budget.ts`.
   */
  audition?: readonly CharacterId[] | null;
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
  cast,
  markCount,
}: {
  scene: keyof typeof SCENE_ASSETS;
  lead: SpeakerFocus | null;
  companion: SpeakerFocus | null;
  /** Everyone standing, so a candidate's own mark can ride their crown. */
  cast: readonly CastPlacement[];
  /** How many candidates the HUD is hanging plates for. Zero outside an audition. */
  markCount: number;
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

  /*
   * WHICH MARKS THE AUDITION HAS TAKEN OVER.
   *
   * During personalization a stage mark stops being a free place on the ring
   * and becomes a specific candidate's crown, so the plate that names them is
   * over their head instead of over grass. `castMarks` is shared with the HUD
   * (`anchors.ts`) precisely so both sides agree about which mark belongs to
   * which candidate; two copies of that table would drift into a name floating
   * over the wrong face.
   *
   * A reserved mark is NEVER published at its ring position, even when the
   * solver could not seat that candidate. Falling back would put the plate back
   * over empty ground, which is the exact bug this replaced — and a plate whose
   * anchor is unpublished is hidden AND inert, so the learner loses nothing
   * except a control that would have lied.
   */
  const reserved = useMemo(() => new Set<AnchorId>(markCount > 0 ? castMarks(markCount) : []), [markCount]);
  const auditionMarks = useMemo(
    () => (markCount > 0 ? castMarks(markCount) : ([] as readonly AnchorId[])),
    [markCount],
  );

  if (!island || !marks) return null;

  const rightX = Math.cos(STAGE_BEARING);
  const rightZ = -Math.sin(STAGE_BEARING);
  const rim = island.radius * 0.88;
  const skyHeight = island.top + Math.max(island.height * 0.9, 2.4);

  return (
    <>
      {/*
        The crown, in metres, because only the scene knows how tall this
        character is. A focus point is the MID-head (`spot.y + height * 0.75`,
        chosen so the camera has something to aim at), so the top of the skull
        is a further quarter of the character's height up. Anything that must
        sit ABOVE the head rides this rather than nudging itself off the head
        point in CSS: at a close-up that nudge would need to be about 290 px on
        a 1280 viewport and about 40 px at the establishing shot, so any single
        number is wrong in one of the two — and being wrong at the close-up
        means the caption sits across the speaker's face for most of a session.
      */}
      {lead ? <WorldAnchor slot="lead.crown" point={[lead.x, lead.y + lead.height * 0.25, lead.z]} /> : null}
      {lead ? <WorldAnchor slot="lead.head" point={[lead.x, lead.y, lead.z]} /> : null}
      {lead ? <WorldAnchor slot="lead.chest" point={[lead.x, lead.y - lead.height * 0.28, lead.z]} /> : null}
      {companion ? (
        <>
          <WorldAnchor
            slot="companion.crown"
            point={[companion.x, companion.y + companion.height * 0.25, companion.z]}
          />
          <WorldAnchor slot="companion.head" point={[companion.x, companion.y, companion.z]} />
        </>
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

      {/*
        THE CANDIDATES' OWN MARKS, on their crowns rather than on the ring.
        The crown is a quarter of the character's height above the mid-head
        focus point, in METRES, because only the scene knows how tall this
        candidate is — and a plate nudged up by a fixed number of CSS pixels
        lands on the forehead at one camera distance and in the sky at another.
      */}
      {cast.map(({ id, index, focus }) => {
        const slot = auditionMarks[index];
        if (!slot) return null;
        return (
          <WorldAnchor
            key={`cast:${id}`}
            slot={slot}
            point={[focus.x, focus.y + focus.height * 0.25, focus.z]}
          />
        );
      })}

      {STAGE_MARK_IDS.map((slot, index) => {
        if (reserved.has(slot)) return null;
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
 * Solves standing positions once the island is in the graph, then renders
 * everybody on them. The cast is held back until the solve completes rather
 * than being placed at a guessed default and snapping afterwards.
 */
function Cast({
  scene,
  standing,
  principals,
  audition,
  settings,
  emotion,
  action,
  actionKey,
  viseme,
  onPlaced,
}: {
  scene: keyof typeof SCENE_ASSETS;
  /** Everyone to place, in the order their marks are assigned. */
  standing: readonly CharacterId[];
  /**
   * The tutor and their companion. They resolve inside the SUSPENDING boundary
   * so `onReady` still means "the people this session is about are on screen";
   * an audition extra gets a boundary of its own and fades in when it arrives,
   * rather than holding the tutor's first line behind three more .glb fetches.
   */
  principals: ReadonlySet<CharacterId>;
  /** True while the whole catalog is on stage to be chosen from. */
  audition: boolean;
  settings: QualitySettings;
  emotion: CharacterEmotion;
  action: CharacterAction;
  actionKey: number;
  viseme: number;
  onPlaced: (placements: readonly CastPlacement[]) => void;
}) {
  const { groundRef } = useGround();
  const [spots, setSpots] = useState<StandingSpot[] | null>(null);

  /*
   * Separation is derived from WHO IS STANDING THERE, and PER PAIR.
   *
   * It was a flat 1.3 m, which quietly assumed every character is human-sized.
   * They are not, and the footprints are measured rather than proportional:
   * Rho covers 0.82 m, Liruf 1.70 m because of his tail, and Dina 2.83 m. Two
   * spots 1.3 m apart put Dina straight through Liruf however flat and open the
   * ground under each of them scored.
   *
   * One number for the whole cast is the next mistake along, and it only shows
   * up once four people have to fit: Dina and Liruf genuinely need 2.61 m, and
   * applying that to Rho and Zara reserves three times the ground they occupy.
   * Measured on the 6.5 m island, that left two of the four candidates with NO
   * SPOT FOUND (`npm run verify:placement`).
   */
  const footprints = useMemo(
    () => standing.map((id) => characterFootprintM(CHARACTER_ASSETS[id])),
    [standing],
  );

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
   * THE SOLVE DOES NOT DEPEND ON THE CAMERA, and it must never start to.
   *
   * Every shot is built off the cast's own facing axis, and `two-shot` blends
   * two of them. If the shot fed back into placement, the cast would re-solve to face a
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
        count: standing.length,
        minSeparation: castSeparationM(footprints),
        separationFor: (index, other) => pairSeparationM(footprints[index] ?? 0, footprints[other] ?? 0),
        // An audition is a ring you look along, not a huddle, and the coarse
        // ring the shipped pair solves against has no sample in the gap the
        // fourth candidate needs. Both are measured; both live in `standingSpots`.
        grouping: audition ? AUDITION_GROUPING : undefined,
        samplesPerMetre: audition ? AUDITION_SAMPLES_PER_METRE : undefined,
        // The camera opens on +Z, so the cast gathers on that side of the
        // island instead of behind the back wall.
        preferDirection: new Vector3(0.35, 0, 1),
        isWalkable,
        clearance: castClearanceM(footprints),
      }),
    );
  }, [groundRef, standing, footprints, audition, isWalkable]);

  /*
   * Who ended up where, and which way they are turned — computed ONCE and used
   * both to render and to report.
   *
   * These two used to be worked out separately, a few lines apart, from the
   * same three quantities. That is the shape of a bug that only appears on the
   * second change: the camera aims at the head one half computed while the
   * character faces the way the other half computed.
   *
   * FACING IS `facing.ts` NOW, and it is a module rather than four lines here
   * because the four lines were wrong and nothing could see it. They pointed
   * each character radially OUTWARD from the island's centre, on the stated
   * theory that outward is "toward a camera orbiting outside it". The camera
   * does not orbit: it stands at ONE bearing, so outward faces the viewer only
   * for the arc of the island nearest them. Measured with
   * `npm run verify:placement`, three of the four personalization candidates
   * stood with their BACKS to the learner on `diorama-a`, and an ordinary
   * two-person session on `diorama-b` turned the tutor 101 degrees away for the
   * whole conversation. Moving it out bought the gate that now fails on it.
   *
   * `STAGE_BEARING` is a constant of the stage — the direction it is composed
   * to be seen from, derived from the placement solver's own `preferDirection`
   * — and not a live camera pose, so the rule at the top of this component
   * still holds: the camera reads placement, placement never reads the camera.
   */
  const posed = useMemo(() => {
    if (!spots) return null;
    const placed = standing.flatMap((id, index) => {
      const spot = spots[index];
      return spot ? [{ id, index, spot }] : [];
    });

    const facings = solveFacings(placed.map(({ spot }) => spot), STAGE_BEARING);

    return placed.map(({ id, index, spot }, order) => {
      const facing = facings[order] ?? STAGE_BEARING;
      const height = CHARACTER_ASSETS[id].targetHeightM;
      const focus: SpeakerFocus = {
        x: spot.x,
        // Eye level, as a fraction of the character's own height. Dina is a
        // quadruped at 0.70 m to the shoulder; a fixed 1.6 m would aim at sky.
        // Mid-head, not the crown: aiming at the top of the skull put the whole
        // face in the bottom half of the frame.
        y: spot.y + height * 0.75,
        z: spot.z,
        facing,
        height,
      };
      return { id, index, spot, facing, focus };
    });
  }, [spots, standing]);

  /*
   * Report upward. This effect sits ABOVE the early return on purpose: placing
   * it after a `spots` guard changed the hook COUNT between the render before
   * spots resolved and the one after, which React reports as "Rendered more
   * hooks than during the previous render" and which took the whole page blank.
   */
  useEffect(() => {
    onPlaced(posed ? posed.map(({ id, index, focus }) => ({ id, index, focus })) : NO_PLACEMENTS);
  }, [posed, onPlaced]);

  if (!posed || posed.length === 0) return null;

  return (
    <>
      {posed.map(({ id, spot, facing }) => {
        const figure = (
          <Character3D
            id={id}
            settings={settings}
            position={[spot.x, 0, spot.z]}
            rotation={facing}
            emotion={emotion}
            action={action}
            actionKey={actionKey}
            viseme={viseme}
          />
        );
        /*
         * An audition extra suspends ON ITS OWN. Inside the shared boundary all
         * four .glb fetches would have to land before ANY of them appeared —
         * and `onReady`, which gates the tutor's first spoken line, sits in that
         * same boundary. A candidate nobody has chosen must not be able to hold
         * up the tutor talking.
         */
        return principals.has(id) ? (
          <Fragment key={id}>{figure}</Fragment>
        ) : (
          <Suspense key={id} fallback={null}>
            {figure}
          </Suspense>
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

/**
 * Two placement lists are the same when everyone is the same person in the same
 * place.
 *
 * The guard is not defensive tidiness. `Cast` builds a fresh array every time
 * its memo re-runs, and this state feeds props that feed other effects; without
 * it, a value that has not actually changed still produces a new identity,
 * which is precisely the render-loop generator frontend/AGENTS.md records.
 */
function samePlacements(a: readonly CastPlacement[], b: readonly CastPlacement[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((entry, i) => {
    const other = b[i];
    return other !== undefined && entry.id === other.id && entry.index === other.index && sameFocus(entry.focus, other.focus);
  });
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
  audition = null,
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
  const [placements, setPlacements] = useState<readonly CastPlacement[]>(NO_PLACEMENTS);

  const onPlaced = useCallback((next: readonly CastPlacement[]) => {
    setPlacements((previous) => (samePlacements(previous, next) ? previous : next));
  }, []);

  /*
   * WHO IS ON THE ISLAND, in the order their marks are assigned.
   *
   * During an audition that is the whole catalog, in catalog order, so a name
   * plate keeps the same mark whoever is currently chosen: a candidate who
   * moved when you picked somebody else would make the next choice a hunt. The
   * tutor is appended if the catalog somehow does not contain them, because a
   * session with nobody to talk to is a worse failure than an unmarked extra.
   */
  const auditionIds = audition && audition.length > 0 ? audition : null;
  const standing = useMemo<readonly CharacterId[]>(() => {
    if (auditionIds) {
      return auditionIds.includes(character) ? auditionIds : [...auditionIds, character];
    }
    return companion ? [character, companion] : [character];
  }, [auditionIds, character, companion]);

  /** Who this session is actually about; see `Cast`'s own note on boundaries. */
  const principals = useMemo(
    () => new Set<CharacterId>(companion ? [character, companion] : [character]),
    [character, companion],
  );

  const leadFocus = placements.find((entry) => entry.id === character)?.focus ?? null;
  const companionFocus = companion
    ? (placements.find((entry) => entry.id === companion)?.focus ?? null)
    : null;

  /*
   * THE AUDITION TURNS THE SHADOW PASS OFF, and the number is the argument.
   *
   * The four characters measure 106,208 triangles and the islands 44,996 and
   * 66,868, so the composed scene is 151,204 or 173,076 against a 220,000
   * per-frame ceiling: comfortable. The `high` tier is the only tier with a
   * shadow-casting light, and a shadow map re-renders the whole scene, so those
   * become 302,408 and 346,152 — 1.4x and 1.6x over. Dropping a candidate to
   * pay for shadows would put a name plate back over empty ground, which is the
   * bug the audition exists to fix; dropping the shadows costs one directional
   * light's contact darkening on one tier, and every character keeps their
   * `ContactShadow` blob on every tier regardless. See `budget.ts`.
   */
  const composed = useMemo<QualitySettings>(
    () => (auditionIds ? { ...settings, shadows: false } : settings),
    [auditionIds, settings],
  );

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
  const fitKey = `${scene}|${standing.join('+')}`;

  const stage = (
    <SceneCanvas className={className} onStats={onStats} onSettings={setSettings} camera={{ fov: 36 }}>
      {/* Outside the Suspense boundary on purpose: a backdrop change updates
          instantly and can never blank the stage while an asset resolves. */}
      <SceneLighting settings={composed} backdrop={backdrop} />
      <GroundProvider>
        {/*
         * TWO boundaries, not one. A single boundary around the island and the
         * cast meant swapping a character unmounted the island with them — the
         * whole stage went blank for the length of a .glb fetch, at exactly the
         * moment the learner was choosing who to talk to.
         */}
        <Suspense fallback={null}>
          <group ref={content} visible={ready}>
            <Diorama id={scene} settings={composed} />
            <Suspense fallback={null}>
              <Cast
                scene={scene}
                standing={standing}
                principals={principals}
                audition={auditionIds !== null}
                settings={composed}
                emotion={emotion}
                action={action}
                actionKey={actionKey}
                viseme={viseme}
                onPlaced={onPlaced}
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
        <StageAnchors
          scene={scene}
          lead={leadFocus}
          companion={companionFocus}
          cast={placements}
          markCount={auditionIds ? auditionIds.length : 0}
        />
        <CameraDirector
          content={content}
          shot={activeShot}
          lead={leadFocus}
          companion={companionFocus}
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
