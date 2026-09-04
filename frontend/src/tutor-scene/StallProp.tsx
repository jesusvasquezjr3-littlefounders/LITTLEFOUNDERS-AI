import { useMemo } from 'react';
import { DoubleSide } from 'three';

/*
 * Class III / S18 `props` (TUTOR_INSTRUMENTS.md §3.4): "Objects on the island
 * a character can stand beside and use." The catalog calls this "genuinely
 * new — no prop system exists," and it still is: this is the FIRST object in
 * this scene that is neither a Blender-authored `.glb` character nor a flat
 * billboard (`AvatarBillboard.tsx`) — it has real volume, procedurally built
 * from primitive geometry, the same "no `.glb`" posture `ContactShadow.tsx`
 * already established for a flat plane, extended here to an actual object.
 *
 * PROCEDURAL, NOT BLENDER, ON PURPOSE: the 3D asset pipeline
 * (`/TUTOR_3D.md`) is for RIGGED CHARACTERS — meshopt geometry, KTX2
 * textures, a skeleton, served by Depot. A static market stall has none of
 * that: no rig, no animation, no reason to round-trip through Blender and an
 * export pipeline for six boxes and a plane. `three.js` primitives, built
 * once per mount and otherwise inert, are the honest match for what this
 * object actually is.
 *
 * LIT, NOT UNLIT — deliberately, and this is the one property that matters
 * most: `/AGENTS.md` §1.14 already documents, at length, what happens to a
 * surface that opts out of the scene's lighting system (the Tutor's own
 * mouth card, unlit, photographed as a cream-white rectangle at dusk).
 * `meshStandardMaterial` is a real PBR material, so this stall receives
 * `SceneLighting.tsx`'s `hemisphereLight`/`directionalLight` automatically —
 * it warms and dims with the backdrop exactly as the island and the
 * characters already do, with no backdrop-specific code of its own, because
 * it never opted out of the system that already decides that.
 */

const WOOD = '#8a5a34';
const WOOD_DARK = '#6b4326';
const CANOPY_CREAM = '#f4ede0';
const CANOPY_ACCENT = '#c65b3f';
const COUNTER_TOP = '#b98452';

const COUNTER_WIDTH = 1.6;
const COUNTER_DEPTH = 0.55;
const COUNTER_HEIGHT = 0.9;
const POST_HEIGHT = 2.05;
const POST_RADIUS = 0.035;
const CANOPY_WIDTH = 1.9;
const CANOPY_DEPTH = 0.75;
const CANOPY_HEIGHT = 0.22;
const STRIPE_COUNT = 5;

/**
 * A market stall: a counter, four corner posts, and a striped canopy.
 *
 * `position` is the SOLVED (x, z) — see `propPlacement.ts` — with y assumed
 * 0 (the island's own surface height at that point; every offset here is
 * relative to the ground the way `spot.y` already is for a character).
 * `facing` is radians about Y, same convention `facing.ts` uses for
 * characters, so the stall's counter can be turned to face the cast.
 */
export function StallProp({
  position,
  facing = 0,
}: {
  position: readonly [number, number, number];
  facing?: number;
}) {
  const stripeXs = useMemo(() => {
    const stripeWidth = CANOPY_WIDTH / STRIPE_COUNT;
    return Array.from({ length: STRIPE_COUNT }, (_, i) => -CANOPY_WIDTH / 2 + stripeWidth * (i + 0.5));
  }, []);

  const postOffsets = useMemo<readonly (readonly [number, number])[]>(
    () => [
      [COUNTER_WIDTH / 2 - POST_RADIUS * 2, COUNTER_DEPTH / 2 - POST_RADIUS * 2],
      [-(COUNTER_WIDTH / 2 - POST_RADIUS * 2), COUNTER_DEPTH / 2 - POST_RADIUS * 2],
      [COUNTER_WIDTH / 2 - POST_RADIUS * 2, -(COUNTER_DEPTH / 2 - POST_RADIUS * 2)],
      [-(COUNTER_WIDTH / 2 - POST_RADIUS * 2), -(COUNTER_DEPTH / 2 - POST_RADIUS * 2)],
    ],
    [],
  );

  return (
    <group position={[position[0], position[1], position[2]]} rotation={[0, facing, 0]}>
      {/* Counter body */}
      <mesh position={[0, COUNTER_HEIGHT / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[COUNTER_WIDTH, COUNTER_HEIGHT, COUNTER_DEPTH]} />
        <meshStandardMaterial color={WOOD} roughness={0.85} metalness={0} />
      </mesh>
      {/* Counter top — a thin slab, a shade lighter, standing in for a worn board */}
      <mesh position={[0, COUNTER_HEIGHT + 0.02, 0]} castShadow receiveShadow>
        <boxGeometry args={[COUNTER_WIDTH + 0.06, 0.04, COUNTER_DEPTH + 0.06]} />
        <meshStandardMaterial color={COUNTER_TOP} roughness={0.7} metalness={0} />
      </mesh>

      {/* Four corner posts, holding the canopy up */}
      {postOffsets.map(([x, z], i) => (
        <mesh key={i} position={[x, POST_HEIGHT / 2, z]} castShadow>
          <cylinderGeometry args={[POST_RADIUS, POST_RADIUS, POST_HEIGHT, 8]} />
          <meshStandardMaterial color={WOOD_DARK} roughness={0.8} metalness={0} />
        </mesh>
      ))}

      {/* Canopy: a cream base slab, striped on top — the market-stall silhouette */}
      <group position={[0, POST_HEIGHT, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[CANOPY_WIDTH, CANOPY_HEIGHT, CANOPY_DEPTH]} />
          <meshStandardMaterial color={CANOPY_CREAM} roughness={0.9} metalness={0} />
        </mesh>
        {stripeXs.map((x, i) => (
          <mesh key={i} position={[x, CANOPY_HEIGHT / 2 + 0.005, 0]} castShadow>
            <boxGeometry args={[CANOPY_WIDTH / STRIPE_COUNT / 2, 0.012, CANOPY_DEPTH + 0.01]} />
            <meshStandardMaterial color={CANOPY_ACCENT} roughness={0.9} metalness={0} side={DoubleSide} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
