import { classifyPolygon, sectionCut, sectionPolygon, sectionSolidMesh, type Plane, type SectionShape, type SectionSolid } from './polyhedra.generated';
import { fill, type Space1Text } from './space1Text';

export type CylinderDirection = 'level' | 'along' | 'slanted';
export interface QuadFacts { pairs: 0 | 1 | 2; equal: boolean; right: boolean }
export type CutState =
  | { kind: 'none' } | { kind: 'clipped' }
  | { kind: 'sides'; n: number; quad: QuadFacts | null }
  | { kind: 'round'; direction: CylinderDirection };

/** The cylinder stands on the y axis: a plane normal to it is level, one with no y part runs along it, any other is slanted. */
export const cylinderDirection = (normal: Plane['normal']): CylinderDirection => (normal[0] === 0 && normal[2] === 0 ? 'level' : normal[1] === 0 ? 'along' : 'slanted');

const QUADS: Partial<Record<SectionShape, QuadFacts>> = {
  square: { pairs: 2, equal: true, right: true },
  rectangle: { pairs: 2, equal: false, right: true },
  rhombus: { pairs: 2, equal: true, right: false },
  parallelogram: { pairs: 2, equal: false, right: false },
  trapezoid: { pairs: 1, equal: false, right: false },
  quadrilateral: { pairs: 0, equal: false, right: false },
};

/** What the plane does to the solid, in words that describe the cut without naming its shape: its sides (and for four of them, how they relate), or the way a round solid is cut. */
export function cutState(solid: SectionSolid, plane: Plane): CutState {
  if (solid === 'cylinder') {
    const cut = sectionCut(solid, plane);
    return cut.shape ? { kind: 'round', direction: cylinderDirection(plane.normal) } : cut.clipped ? { kind: 'clipped' } : { kind: 'none' };
  }
  const polygon = sectionPolygon(sectionSolidMesh(solid), plane);
  if (!polygon) return { kind: 'none' };
  return { kind: 'sides', n: polygon.length, quad: polygon.length === 4 ? QUADS[classifyPolygon(polygon)] ?? null : null };
}

const DIRECTION_KEYS = { level: 'cylLevel', along: 'cylAlong', slanted: 'cylSlanted' } as const;
export const directionText = (t: Space1Text, direction: CylinderDirection): string => t[DIRECTION_KEYS[direction]];

export function cutText(t: Space1Text, state: CutState): string {
  switch (state.kind) {
    case 'none': return t.slideNone;
    case 'clipped': return t.slideClipped;
    case 'sides': {
      if (!state.quad) return fill(t.slideSides, { n: state.n });
      const yesNo = (value: boolean) => (value ? t.slideYes : t.slideNo);
      return fill(t.slideQuad, { pairs: state.quad.pairs, equal: yesNo(state.quad.equal), right: yesNo(state.quad.right) });
    }
    case 'round': return directionText(t, state.direction);
  }
}
