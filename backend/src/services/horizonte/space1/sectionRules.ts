import {
  ALSO_TRUE, COUNT_NAMES, PLANE_LIMITS, PLATONIC_COUNTS, isCountName, isPlatonicId, isSectionShape, isSectionSolid, pyramidVolume, sectionShape,
  type CountName, type Plane, type PlatonicId, type SectionShape, type SectionSolid,
} from './polyhedra.js';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const whole = (value: unknown, minimum: number, maximum: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum;

export const OPTION_LIMITS = { min: 2, max: 4 } as const;
export const VOLUME_LIMITS = { side: { min: 2, max: 12 }, height: { min: 1, max: 12 } } as const;
/** The bounds a typed count or volume must sit in (the prism of the largest case is 1,728 cubic units). */
export const EULER_BOUNDS = { minimum: '0', maximum: '30' } as const;
export const VOLUME_BOUNDS = { minimum: '0', maximum: '1728' } as const;

export interface SectionPayload { mode: 'section'; solid: SectionSolid; plane: Plane; options: SectionShape[] }
export interface EulerPayload { mode: 'euler'; solid: PlatonicId; hide: CountName }
export interface VolumePayload { mode: 'volume'; side: number; height: number }
export type SolidSectionPayload = SectionPayload | EulerPayload | VolumePayload;

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
    if (!exactKeys(value, ['mode', 'solid', 'hide']) || !isPlatonicId(value.solid) || !isCountName(value.hide)) return null;
    return { mode: 'euler', solid: value.solid, hide: value.hide };
  }
  if (value.mode === 'volume') {
    if (!exactKeys(value, ['mode', 'side', 'height']) || !whole(value.side, VOLUME_LIMITS.side.min, VOLUME_LIMITS.side.max) || !whole(value.height, VOLUME_LIMITS.height.min, VOLUME_LIMITS.height.max)) return null;
    return { mode: 'volume', side: value.side, height: value.height };
  }
  return null;
}

/** The shape the plane cuts from the solid; null when the plane only touches the solid or misses it. */
export const cutShape = (payload: SectionPayload): SectionShape | null => sectionShape(payload.solid, payload.plane);

/** The count the learner types in the Euler question: the hidden one, from V - E + F = 2. */
export const hiddenCount = (payload: EulerPayload): number => PLATONIC_COUNTS[payload.solid][payload.hide];
export const shownCounts = (payload: EulerPayload): CountName[] => COUNT_NAMES.filter((name) => name !== payload.hide);

export type SolidSectionAnswer = { pick: SectionShape } | { target: string };

export function solidSectionAnswer(payload: SolidSectionPayload): SolidSectionAnswer | null {
  if (payload.mode === 'section') {
    const shape = cutShape(payload);
    return shape ? { pick: shape } : null;
  }
  if (payload.mode === 'euler') return { target: String(hiddenCount(payload)) };
  const volume = pyramidVolume(payload.side, payload.height);
  return volume === null ? null : { target: String(volume) };
}

export function solidSectionProblem(payload: SolidSectionPayload): string | null {
  if (payload.mode === 'euler') return null;
  if (payload.mode === 'volume') return pyramidVolume(payload.side, payload.height) === null ? 'The base area times the height must divide by 3, so the pyramid has a whole volume' : null;
  const shape = cutShape(payload);
  if (!shape) return 'The plane must cut through the solid, not just touch it or miss it';
  if (!payload.options.includes(shape)) return 'The options must include the shape of the cut';
  if (payload.options.some((option) => option !== shape && ALSO_TRUE[shape].includes(option))) return 'An option also names the cut (a square is also a rectangle), so the question would have two answers';
  return null;
}
