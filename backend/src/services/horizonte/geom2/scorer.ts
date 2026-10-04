import { gradePointSet, type ShapeGrade } from '../../v2AnswerShapes.js';
import type { V2Grade } from '../../v2VisualScorer.js';
import type { HorizonteScorer } from '../types.js';
import { areaPointContext, isAreaSquaresPayload, isAreaSquaresRubric, type AreaSquaresPayload, type AreaSquaresRubric } from './areaModel.js';
import { checkBand, findBand, isGeoboardRubric, isGeoboardSize, readBand, type GeoboardPayload, type GeoboardRubric } from './geoboardModel.js';
import { sameSet, type Lattice } from './geometry.js';
import { isTessellationPayload, isTessellationRubric, offeredMotions, placeCopies, readCopies, solveCover, type TessellationPayload, type TessellationRubric } from './tessellationModel.js';
import { isTransformPayload, isTransformRubric, transformPointContext, type TransformPayload, type TransformRubric } from './transformModel.js';

const INVALID: V2Grade = { verdict: 'invalid', diagnostic: 'none' };
const VALID: V2Grade = { verdict: 'valid', diagnostic: 'none' };
const MET: V2Grade = { verdict: 'met', diagnostic: 'none' };
const review = (diagnostic: V2Grade['diagnostic']): V2Grade => ({ verdict: 'review', diagnostic });
const fromShape = (grade: ShapeGrade): V2Grade => ({ verdict: grade.verdict, diagnostic: grade.diagnostic });

/** The one field every geom2 response carries: `points`, a list of whole-number points. */
function pointsOf(response: unknown): unknown[] | null {
  if (typeof response !== 'object' || response === null || Array.isArray(response) || Object.keys(response).join() !== 'points') return null;
  const points = (response as { points: unknown }).points;
  return Array.isArray(points) ? points : null;
}

/**
 * invalid: not a simple band of pegs on the board (a bowtie, two pegs, a peg off the board), or a malformed key.
 * valid: no band yet, and every well-formed band when there is no rubric. review: a band, not the key (area wrong: value;
 * area right but not the named figure: miss). met: the area, and the figure when one is named.
 */
function gradeGeoboard(segment: { payload: GeoboardPayload }, response: unknown, rubric: GeoboardRubric | undefined): V2Grade {
  const size = segment?.payload?.size;
  if (!isGeoboardSize(size)) return INVALID;
  const reading = readBand(response, size);
  if (!reading) return INVALID;
  if (rubric !== undefined && !isGeoboardRubric(rubric, size)) return INVALID;
  if (reading.kind === 'untouched' || rubric === undefined) return VALID;
  const check = checkBand(reading.points, rubric);
  if (check === 'met') return MET;
  return review(check === 'area' ? 'value' : 'miss');
}

/**
 * invalid: not a set of distinct squares on the grid, or a malformed key (one that is not the squares inside the outline).
 * valid: nothing shaded, and every well-formed shading when there is no rubric. review: miss (squares left out),
 * false_alarm (squares outside), partial or value (both). met: exactly the squares inside the outline.
 */
function gradeAreaSquares(segment: { payload: AreaSquaresPayload }, response: unknown, rubric: AreaSquaresRubric | undefined): V2Grade {
  const payload = segment?.payload;
  if (!isAreaSquaresPayload(payload)) return INVALID;
  const points = pointsOf(response);
  if (!points) return INVALID;
  if (rubric !== undefined && !isAreaSquaresRubric(rubric, payload)) return INVALID;
  if (points.length === 0) return VALID;
  return fromShape(gradePointSet(response, rubric === undefined ? undefined : { required: rubric.required }, areaPointContext(payload)));
}

/**
 * invalid: not distinct pegs of the plane, or a malformed key (one that is not the image of the figure under the move).
 * valid: the vertices left where the figure is, and every well-formed answer when there is no rubric. review: some or all
 * of the image missing (miss), extra points (false_alarm), partial or value. met: exactly the image.
 */
function gradeTransform(segment: { payload: TransformPayload }, response: unknown, rubric: TransformRubric | undefined): V2Grade {
  const payload = segment?.payload;
  if (!isTransformPayload(payload)) return INVALID;
  if (!pointsOf(response)) return INVALID;
  const context = transformPointContext(payload);
  if (gradePointSet(response, undefined, context).verdict === 'invalid') return INVALID;
  if (rubric !== undefined && !isTransformRubric(rubric, payload)) return INVALID;
  if (rubric === undefined || sameSet((response as { points: Lattice[] }).points, payload.figure)) return VALID;
  return fromShape(gradePointSet(response, { required: rubric.required }, context));
}

/**
 * invalid: a copy leaves the floor, lands on another copy or uses a motion the floor does not offer, or a malformed key.
 * valid: no copy placed, and every legal placement when there is no rubric. review (partial): legal copies that leave part of
 * the floor open. met: the floor covered. The response is `points` (the anchors) and, when the floor offers a turn or a flip,
 * `motions` (one per anchor).
 */
function gradeTessellation(segment: { payload: TessellationPayload }, response: unknown, rubric: TessellationRubric | undefined): V2Grade {
  const payload = segment?.payload;
  if (!isTessellationPayload(payload)) return INVALID;
  const copies = readCopies(payload, response);
  if (!copies) return INVALID;
  if (rubric !== undefined && !isTessellationRubric(rubric, payload)) return INVALID;
  if (copies.length === 0) return VALID;
  const placement = placeCopies(payload, copies);
  if (placement.kind === 'broken') return INVALID;
  if (rubric === undefined) return VALID;
  return placement.covered === payload.floor.length ? MET : review('partial');
}

const copyPoints = (points: unknown): Lattice[] => (Array.isArray(points) ? points.map((point: Lattice) => ({ x: point?.x, y: point?.y })) : []);

/* A sample proves the key is scorable. Where a key cannot be met at all it returns a response the scorer refuses, so the publish-time check fails. */
export const GEOM2_SCORERS: Readonly<Record<string, HorizonteScorer>> = {
  'math.geoboard.v2': {
    grade: gradeGeoboard as HorizonteScorer['grade'],
    sample: ((segment: { payload: GeoboardPayload }, rubric: GeoboardRubric) => {
      const size = segment?.payload?.size;
      const band = isGeoboardSize(size) && isGeoboardRubric(rubric, size) ? findBand(size, rubric) : null;
      return { points: band ?? [{ x: 0, y: 0 }] };
    }) as HorizonteScorer['sample'],
  },
  'math.area-squares.v2': {
    grade: gradeAreaSquares as HorizonteScorer['grade'],
    sample: ((_segment: unknown, rubric: AreaSquaresRubric) => ({ points: copyPoints(rubric?.required) })) as HorizonteScorer['sample'],
  },
  'math.transform.v2': {
    grade: gradeTransform as HorizonteScorer['grade'],
    sample: ((_segment: unknown, rubric: TransformRubric) => ({ points: copyPoints(rubric?.required) })) as HorizonteScorer['sample'],
  },
  'math.tessellation.v2': {
    grade: gradeTessellation as HorizonteScorer['grade'],
    sample: ((segment: { payload: TessellationPayload }) => {
      const solution = isTessellationPayload(segment?.payload) ? solveCover(segment.payload) : null;
      if (!solution) return {};
      const points = solution.map((copy) => copy.anchor);
      return offeredMotions(segment.payload).length > 1 ? { points, motions: solution.map((copy) => copy.motion) } : { points };
    }) as HorizonteScorer['sample'],
  },
};
