import {
  congruentByTurning, isCellList, isConnected, isRotationAxis, matchingAngles, sameShape, FIGURE_LIMITS, TARGET_IDS, TARGET_LIMITS,
  type Cell, type RotationAxis, type TargetId,
} from './voxels.js';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const copyCells = (cells: readonly Cell[]): Cell[] => cells.map((cell) => [cell[0], cell[1], cell[2]] as Cell);

export interface RotationPayload { axis: RotationAxis; figure: Cell[]; targets: Cell[][] }

export function readRotationPayload(value: unknown): RotationPayload | null {
  if (!isRecord(value) || !exactKeys(value, ['axis', 'figure', 'targets'])) return null;
  const { axis, figure, targets } = value;
  if (!isRotationAxis(axis) || !isCellList(figure, FIGURE_LIMITS.min, FIGURE_LIMITS.max)) return null;
  if (!Array.isArray(targets) || targets.length < TARGET_LIMITS.min || targets.length > TARGET_LIMITS.max) return null;
  if (!targets.every((target) => isCellList(target, FIGURE_LIMITS.min, FIGURE_LIMITS.max))) return null;
  return { axis, figure: copyCells(figure), targets: (targets as Cell[][]).map(copyCells) };
}

export interface RotationAnswer { pick: TargetId; angles: number[] }

/** The one target the figure becomes when turned about the axis, and every turn (90, 180, 270) that gets it there; null when not exactly one. */
export function rotationAnswer(payload: RotationPayload): RotationAnswer | null {
  const matches = payload.targets.flatMap((target, index) => {
    const angles = matchingAngles(payload.figure, target, payload.axis);
    return angles.length > 0 ? [{ pick: TARGET_IDS[index]!, angles }] : [];
  });
  return matches.length === 1 ? matches[0]! : null;
}

/** The authoring rules: the answer exists and is unique, a wrong shape is never a turn of the figure, and a turn of 0 is never the answer. */
export function rotationProblem(payload: RotationPayload): string | null {
  if (!isConnected(payload.figure)) return 'The figure must be one piece: each cube touches another by a face';
  if (!payload.targets.every(isConnected)) return 'Each target must be one piece';
  if (payload.targets.some((target) => sameShape(payload.figure, target))) return 'A target must differ from the figure as it stands';
  for (let first = 0; first < payload.targets.length; first += 1) {
    for (let second = first + 1; second < payload.targets.length; second += 1) {
      if (sameShape(payload.targets[first]!, payload.targets[second]!)) return 'The targets must differ from one another';
    }
  }
  const answer = rotationAnswer(payload);
  if (!answer) return payload.targets.length === 1 ? 'The target must be the figure turned about the axis' : 'Exactly one target must be the figure turned about the axis';
  const stray = payload.targets.some((target, index) => TARGET_IDS[index] !== answer.pick && congruentByTurning(payload.figure, target));
  return stray ? 'A wrong target must not be a turn of the figure (use a mirror image or a changed shape)' : null;
}
