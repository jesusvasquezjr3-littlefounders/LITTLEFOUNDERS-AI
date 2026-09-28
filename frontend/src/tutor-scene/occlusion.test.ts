import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Raycaster, Vector3, type Object3D } from 'three';
import type { CharacterId } from '@/components/characters/control/types';
import { corridorClear, readablePoints, stageOcclusions, STAGE_ASPECTS, STAGE_SHOTS, type RayHit } from './occlusion';
import { poseFor, STAGE_BEARING, type ShotScene } from './shots';
import { findStandingSpots } from './standingSpots';

/*
 * Frontend Bible 08 §2 / §10 item 3: nothing decorative covers the Mentor's
 * face or hands. The shots test here projects the head and hands of all four
 * characters from every stage shot (close-up, wide close-up) in every stage
 * viewport (phone, desktop, compact band) against synthetic scenery; the real
 * Dioramas (diorama-a, diorama-b) are checked by `npm run verify:placement`,
 * which loads them and runs the same `stageOcclusions` for every lead.
 */

const CAST: CharacterId[] = ['rho', 'zara', 'liruf', 'dina'];
const SCENE: ShotScene = { centre: { x: 0, y: 1, z: 0 }, size: { x: 10, y: 2, z: 10 } };

function hitter(root: Object3D): RayHit {
  root.updateMatrixWorld(true);
  const ray = new Raycaster();
  return (from, direction, far) => {
    ray.set(new Vector3(from.x, from.y, from.z), new Vector3(direction.x, direction.y, direction.z));
    ray.far = far;
    return ray.intersectObject(root, true)[0]?.distance ?? null;
  };
}

/** An island: a slab, optionally with a post (a "palm" or an "ammonite") standing at (x, z). */
function island(post?: { x: number; z: number; height: number }): Group {
  const root = new Group();
  const slab = new Mesh(new BoxGeometry(10, 0.4, 10), new MeshBasicMaterial());
  slab.position.y = -0.2;
  root.add(slab);
  if (post) {
    const p = new Mesh(new BoxGeometry(0.3, post.height, 0.3), new MeshBasicMaterial());
    p.position.set(post.x, post.height / 2, post.z);
    root.add(p);
  }
  return root;
}

describe('the stage shots keep the face and hands clear (08 §2)', () => {
  it('places the head above the hands and in front of the feet for every character, facing the camera', () => {
    for (const who of CAST) {
      const points = readablePoints({ who, x: 0, y: 0, z: 0, facing: 0 });
      const head = points.find((p) => p.name === 'head')!.at;
      const hands = points.filter((p) => p.name !== 'head').map((p) => p.at);
      expect(hands, who).toHaveLength(2);
      for (const hand of hands) expect(head.y, who).toBeGreaterThan(hand.y);
      expect(head.z, who).toBeGreaterThanOrEqual(0);
    }
  });

  it('finds nothing in front of any character on open ground, in every shot and viewport', () => {
    const hit = hitter(island());
    for (const who of CAST) {
      expect(stageOcclusions({ who, x: 0, y: 0, z: 0, facing: STAGE_BEARING }, SCENE, hit), who).toEqual([]);
    }
  });

  it('projects head and hands of all four characters and reports a prop standing in the camera corridor', () => {
    for (const who of CAST) {
      const placement = { who, x: 0, y: 0, z: 0, facing: 0 };
      // A tall post halfway between the close-up camera (phone) and the character, on the line to the head.
      const pose = poseFor('closeup', { scene: SCENE, lead: { x: 0, y: 1, z: 0, facing: 0, height: 1.7 }, companion: null, aspect: STAGE_ASPECTS[0]!.aspect, fov: 36 });
      const post = { x: 0, z: pose.position.z / 2, height: 4 };
      const found = stageOcclusions(placement, SCENE, hitter(island(post)));
      expect(found.some((o) => o.shot === 'closeup' && o.point === 'head'), who).toBe(true);
      // Every occlusion is named by shot, viewport and point, and sits in front of the point.
      for (const o of found) {
        expect(STAGE_SHOTS).toContain(o.shot);
        expect(o.blockedAt).toBeLessThan(o.distance);
      }
    }
  });

  it('stays clear when the same prop stands behind the character', () => {
    for (const who of CAST) {
      expect(stageOcclusions({ who, x: 0, y: 0, z: 0, facing: 0 }, SCENE, hitter(island({ x: 0, z: -2.5, height: 4 }))), who).toEqual([]);
    }
  });

  it('the placement solver moves the lead out of a blocked corridor, and only the lead', () => {
    const scenery = island({ x: 1.2, z: 3.6, height: 4 });
    scenery.updateMatrixWorld(true);
    const hit = hitter(scenery);
    const walkable = (x: number, z: number) => Math.hypot(x - 1.2, z - 3.6) > 0.8;
    const free = findStandingSpots(scenery, { count: 1, isWalkable: walkable, preferDirection: new Vector3(0.35, 0, 1) });
    const gated = findStandingSpots(scenery, {
      count: 1, isWalkable: walkable, preferDirection: new Vector3(0.35, 0, 1),
      leadCorridorClear: (spot) => corridorClear('rho', spot, SCENE, hit),
    });
    expect(gated).toHaveLength(1);
    expect(corridorClear('rho', gated[0]!, SCENE, hit)).toBe(true);
    // The gate only ever removes candidates: when the best spot was already clear it is the same spot.
    if (corridorClear('rho', free[0]!, SCENE, hit)) expect(gated[0]).toEqual(free[0]);
  });
});
