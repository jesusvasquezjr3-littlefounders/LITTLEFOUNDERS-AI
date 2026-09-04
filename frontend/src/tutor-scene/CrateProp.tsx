/*
 * Class III / S18 amendment `props` generality (2026-09-04): the SECOND
 * object on the island, built to prove `TutorScene.tsx`'s multi-prop solve
 * is a real mechanism and not a stall-shaped special case. Procedural,
 * lit (`meshStandardMaterial`), built once per mount — the same three
 * reasons `StallProp.tsx`'s own header gives at length; not repeated here,
 * only cross-referenced, the same "a copy would drift" discipline
 * `propPlacement.ts` already applies to its own functions.
 *
 * A stack of two produce crates, offset and turned against each other —
 * the smallest shape that reads as "crates" rather than "a box."
 */

const WOOD = '#b98452';
const WOOD_DARK = '#8a5a34';
const TRIM = '#e8d2a8';

const LOWER = { width: 0.52, depth: 0.52, height: 0.4 };
const UPPER = { width: 0.4, depth: 0.4, height: 0.34 };
const UPPER_OFFSET: readonly [number, number] = [0.07, -0.05];
const UPPER_TURN = 0.5;

/**
 * `position` is the SOLVED (x, z), y assumed 0 — same convention
 * `StallProp`'s own doc comment establishes. `facing` is radians about Y,
 * applied to the whole stack; the individual crates keep their own small
 * relative turn regardless, so the stack never reads as two boxes stacked
 * dead square even from a facing this solver never tries.
 */
export function CrateProp({
  position,
  facing = 0,
}: {
  position: readonly [number, number, number];
  facing?: number;
}) {
  return (
    <group position={[position[0], position[1], position[2]]} rotation={[0, facing, 0]}>
      {/* Lower crate */}
      <mesh position={[0, LOWER.height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[LOWER.width, LOWER.height, LOWER.depth]} />
        <meshStandardMaterial color={WOOD} roughness={0.88} metalness={0} />
      </mesh>
      {/* Rim — a shade lighter, the same "worn board" trick `StallProp`'s counter-top uses */}
      <mesh position={[0, LOWER.height + 0.015, 0]} castShadow receiveShadow>
        <boxGeometry args={[LOWER.width + 0.03, 0.03, LOWER.depth + 0.03]} />
        <meshStandardMaterial color={TRIM} roughness={0.75} metalness={0} />
      </mesh>

      {/* Upper crate — smaller, offset, and turned, so the stack reads as stacked rather than centred */}
      <group position={[UPPER_OFFSET[0], LOWER.height + 0.03, UPPER_OFFSET[1]]} rotation={[0, UPPER_TURN, 0]}>
        <mesh position={[0, UPPER.height / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[UPPER.width, UPPER.height, UPPER.depth]} />
          <meshStandardMaterial color={WOOD_DARK} roughness={0.88} metalness={0} />
        </mesh>
        <mesh position={[0, UPPER.height + 0.012, 0]} castShadow receiveShadow>
          <boxGeometry args={[UPPER.width + 0.025, 0.025, UPPER.depth + 0.025]} />
          <meshStandardMaterial color={TRIM} roughness={0.75} metalness={0} />
        </mesh>
      </group>
    </group>
  );
}
