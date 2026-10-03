import {
  ALSO_TRUE, COUNT_NAMES, EULER_COUNTS, PLANE_LIMITS, coneVolume, isCountName, isEulerSolid, isPlatonicId, isSectionShape, isSectionSolid, pyramidVolume, sectionCut, sectionShape, slideRange, slideShapes,
  type CountName, type EulerSolid, type Plane, type SectionShape, type SectionSolid,
} from './polyhedra.js';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const whole = (value: unknown, minimum: number, maximum: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum;

export const OPTION_LIMITS = { min: 2, max: 4 } as const;
export const VOLUME_LIMITS = { side: { min: 2, max: 12 }, height: { min: 1, max: 12 } } as const;
export const CONE_LIMITS = { radius: { min: 1, max: 12 }, height: { min: 1, max: 12 } } as const;
/** The bounds a typed count or volume must sit in (the prism of the largest case is 1,728 cubic units, the cylinder 1,728 pi). */
export const EULER_BOUNDS = { minimum: '0', maximum: '30' } as const;
export const ARCHIMEDEAN_BOUNDS = { minimum: '0', maximum: '90' } as const;
export const VOLUME_BOUNDS = { minimum: '0', maximum: '1728' } as const;

/** The bounds of a typed count: the Platonic solids top out at 30 edges, the Archimedean ones at 90. */
export const eulerBounds = (solid: EulerSolid): typeof EULER_BOUNDS | typeof ARCHIMEDEAN_BOUNDS => (isPlatonicId(solid) ? EULER_BOUNDS : ARCHIMEDEAN_BOUNDS);

export interface SectionPayload { mode: 'section'; solid: SectionSolid; plane: Plane; options: SectionShape[] }
export interface EulerPayload { mode: 'euler'; solid: EulerSolid; hide: CountName }
export interface VolumePayload { mode: 'volume'; side: number; height: number }
export interface ConePayload { mode: 'cone'; radius: number; height: number }
export interface SlidePayload { mode: 'slide'; solid: SectionSolid; normal: Plane['normal']; start: number; target: SectionShape }
export type SolidSectionPayload = SectionPayload | EulerPayload | VolumePayload | ConePayload | SlidePayload;

function readPlane(value: unknown): Plane | null {
  if (!isRecord(value) || !exactKeys(value, ['normal', 'offset'])) return null;
  const { normal, offset } = value;
  if (!Array.isArray(normal) || normal.length !== 3 || !normal.every((part) => whole(part, -PLANE_LIMITS.normal, PLANE_LIMITS.normal)) || normal.every((part) => part === 0)) return null;
  if (!whole(offset, -PLANE_LIMITS.offset, PLANE_LIMITS.offset)) return null;
  return { normal: [normal[0], normal[1], normal[2]] as [number, number, number], offset };
}

export function readSolidSectionPayload(value: unknown): SolidSectionPayload | null {
  if (!isRecord(value)) return null;
  if (value.mode === 'section') {
    if (!exactKeys(value, ['mode', 'solid', 'plane', 'options']) || !isSectionSolid(value.solid)) return null;
    const plane = readPlane(value.plane);
    const options = value.options;
    if (!plane || !Array.isArray(options) || options.length < OPTION_LIMITS.min || options.length > OPTION_LIMITS.max || !options.every(isSectionShape) || new Set(options).size !== options.length) return null;
    return { mode: 'section', solid: value.solid, plane, options: [...options] as SectionShape[] };
  }
  if (value.mode === 'euler') {
    if (!exactKeys(value, ['mode', 'solid', 'hide']) || !isEulerSolid(value.solid) || !isCountName(value.hide)) return null;
    return { mode: 'euler', solid: value.solid, hide: value.hide };
  }
  if (value.mode === 'volume') {
    if (!exactKeys(value, ['mode', 'side', 'height']) || !whole(value.side, VOLUME_LIMITS.side.min, VOLUME_LIMITS.side.max) || !whole(value.height, VOLUME_LIMITS.height.min, VOLUME_LIMITS.height.max)) return null;
    return { mode: 'volume', side: value.side, height: value.height };
  }
  if (value.mode === 'cone') {
    if (!exactKeys(value, ['mode', 'radius', 'height']) || !whole(value.radius, CONE_LIMITS.radius.min, CONE_LIMITS.radius.max) || !whole(value.height, CONE_LIMITS.height.min, CONE_LIMITS.height.max)) return null;
    return { mode: 'cone', radius: value.radius, height: value.height };
  }
  if (value.mode === 'slide') {
    if (!exactKeys(value, ['mode', 'solid', 'normal', 'start', 'target']) || !isSectionSolid(value.solid) || !isSectionShape(value.target)) return null;
    const plane = readPlane({ normal: value.normal, offset: value.start });
    return plane ? { mode: 'slide', solid: value.solid, normal: plane.normal, start: plane.offset, target: value.target } : null;
  }
  return null;
}

/** The shape the plane cuts from the solid; null when the plane only touches the solid or misses it. */
export const cutShape = (payload: SectionPayload): SectionShape | null => sectionShape(payload.solid, payload.plane);

/** The count the learner types in the Euler question: the hidden one, from V - E + F = 2. */
export const hiddenCount = (payload: EulerPayload): number => EULER_COUNTS[payload.solid][payload.hide];
export const shownCounts = (payload: EulerPayload): CountName[] => COUNT_NAMES.filter((name) => name !== payload.hide);

/** The shape the slide asks for is made by these positions of the plane (none of them the start). */
export const slideSolutions = (payload: SlidePayload): number[] => [...slideShapes(payload.solid, payload.normal)].flatMap(([offset, shape]) => (shape === payload.target ? [offset] : []));

/** The shape the plane makes at `offset`; null when it only touches the solid, misses it or runs into an end cap. */
export const slideCut = (payload: SlidePayload, offset: number): SectionShape | null => sectionShape(payload.solid, { normal: payload.normal, offset });

export type SolidSectionAnswer = { pick: SectionShape } | { target: string };

export function solidSectionAnswer(payload: SolidSectionPayload): SolidSectionAnswer | null {
  if (payload.mode === 'section') {
    const shape = cutShape(payload);
    return shape ? { pick: shape } : null;
  }
  if (payload.mode === 'slide') return { pick: payload.target };
  if (payload.mode === 'euler') return { target: String(hiddenCount(payload)) };
  const volume = payload.mode === 'cone' ? coneVolume(payload.radius, payload.height) : pyramidVolume(payload.side, payload.height);
  return volume === null ? null : { target: String(volume) };
}

function slideProblem(payload: SlidePayload): string | null {
  const shapes = slideShapes(payload.solid, payload.normal);
  const { min, max } = slideRange(payload.solid, payload.normal);
  if (payload.start < min || payload.start > max) return 'The plane must start on the slider';
  if (slideSolutions(payload).length === 0) return 'No position of the plane makes the shape asked for';
  if (shapes.get(payload.start) === payload.target) return 'The plane must not start on the shape asked for';
  const reachable = new Set([...shapes.values()].filter((shape): shape is SectionShape => shape !== null));
  if ([...reachable].some((shape) => shape !== payload.target && ALSO_TRUE[shape].includes(payload.target))) return 'The plane can also make a shape that is the shape asked for (a square is also a rectangle), so one position would be graded two ways';
  return null;
}

export function solidSectionProblem(payload: SolidSectionPayload): string | null {
  if (payload.mode === 'euler') return null;
  if (payload.mode === 'volume') return pyramidVolume(payload.side, payload.height) === null ? 'The base area times the height must divide by 3, so the pyramid has a whole volume' : null;
  if (payload.mode === 'cone') return coneVolume(payload.radius, payload.height) === null ? 'The radius squared times the height must divide by 3, so the cone has a whole volume in pi' : null;
  if (payload.mode === 'slide') return slideProblem(payload);
  const shape = cutShape(payload);
  if (!shape) return sectionCut(payload.solid, payload.plane).clipped ? 'The cut through a cylinder must stay clear of the end caps' : 'The plane must cut through the solid, not just touch it or miss it';
  if (!payload.options.includes(shape)) return 'The options must include the shape of the cut';
  if (payload.options.some((option) => option !== shape && ALSO_TRUE[shape].includes(option))) return 'An option also names the cut (a square is also a rectangle), so the question would have two answers';
  return null;
}
