import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react';
import { Box3, Object3D, Raycaster, Vector3 } from 'three';

/*
 * Where is the floor?
 *
 * Not answerable from a bounding box. A diorama's highest point is its back
 * wall or its palm fronds, and its lowest is the underside of the floating
 * rock — the walkable surface is somewhere in between, at a height that
 * differs per island and per spot on that island. Placing characters at the
 * box top put them standing in mid-air above the scenery, which is exactly the
 * bug this replaces.
 *
 * So the ground is MEASURED where the character actually stands: a ray fired
 * straight down from above that (x, z) returns the first surface it meets.
 * That is how the placement generalises — a new island needs no manifest
 * entry, no artist convention about pivots, and no re-measuring by hand.
 */

export interface GroundSampler {
  /** Surface height at (x, z), or null when nothing is under that point. */
  sampleGround: (x: number, z: number) => number | null;
  /** Registers the collidable scenery. */
  setGround: (object: Object3D | null) => void;
  /** The registered scenery, for solvers that need the whole object. */
  groundRef: React.RefObject<Object3D | null>;
}

const GroundContext = createContext<GroundSampler | null>(null);

export function GroundProvider({ children }: { children: ReactNode }) {
  const ground = useRef<Object3D | null>(null);
  const raycaster = useMemo(() => new Raycaster(), []);
  const down = useMemo(() => new Vector3(0, -1, 0), []);

  const setGround = useCallback((object: Object3D | null) => {
    ground.current = object;
  }, []);

  const sampleGround = useCallback(
    (x: number, z: number): number | null => {
      const object = ground.current;
      if (!object) return null;

      // Start above the scenery's own top so the ray cannot begin inside it.
      const top = new Box3().setFromObject(object).max.y;
      raycaster.set(new Vector3(x, top + 1, z), down);
      const hits = raycaster.intersectObject(object, true);
      /*
       * `null`, never 0, when nothing is hit — a character standing off the
       * edge of the island is a placement bug, and reporting "ground at zero"
       * would silently hide it by dropping them onto an invisible plane
       * (/AGENTS.md §1.14: failure must stay distinguishable from emptiness).
       */
      return hits.length ? (hits[0]?.point.y ?? null) : null;
    },
    [raycaster, down],
  );

  const value = useMemo(() => ({ sampleGround, setGround, groundRef: ground }), [sampleGround, setGround]);
  return <GroundContext.Provider value={value}>{children}</GroundContext.Provider>;
}

export function useGround(): GroundSampler {
  const context = useContext(GroundContext);
  if (!context) throw new Error('useGround must be used within a GroundProvider');
  return context;
}
