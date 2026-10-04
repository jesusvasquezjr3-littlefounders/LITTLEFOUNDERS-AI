import { gradeArrangement, sampleArrangement } from '../../v2AnswerShapes.js';
import type { V2Grade } from '../../v2VisualScorer.js';
import type { HorizonteScorer } from '../types.js';
import { exactKeys, isUntouched, isWhole, toContext, type Accepts, type Frame, type SlotMap } from './arrange.js';
import { CALCULUS_TYPE, CIRCUITS_TYPE, NETWORK_TYPE, TRIG_TYPE } from './contract.js';
import { circuitFrame, circuitKeyProblem, circuitMetBy, gatesAccepts } from './circuits.js';
import { explorerOptions, explorerRange, explorerTruth } from './explorer.js';
import { networkFrame, networkKeyProblem, networkMet, networkOrdered, pascalAccepts } from './network.js';

type Segment = { visual?: { type?: unknown }; payload?: unknown };
type Rubric = { solutions: SlotMap[] };

interface Spec {
  frame: (visual: unknown, payload: unknown) => Frame | null;
  keyProblem: (visual: unknown, payload: unknown, solutions: readonly SlotMap[]) => string | null;
  /** The rule the arrangement meets, in whatever way it does: the key lists examples only. */
  met: (visual: unknown, payload: unknown, slots: SlotMap) => boolean;
  /** A walk and a route are read in order; a set of nodes is not. */
  ordered?: (visual: unknown, payload: unknown) => boolean;
  /** Which piece a slot takes; a piece that no rule lets there is a malformed response, not a wrong one. */
  accepts?: (visual: unknown, payload: unknown) => Accepts | null;
}

const INVALID: V2Grade = { verdict: 'invalid', diagnostic: 'none' };
const VALID: V2Grade = { verdict: 'valid', diagnostic: 'none' };
const MET: V2Grade = { verdict: 'met', diagnostic: 'none' };

/**
 * invalid: malformed, off the board, over a slot capacity, a gate in a position of another arity or a malformed key.
 * valid: nothing placed yet, and every well-formed placement when there is no rubric, as in the browser.
 * review: placed, not what the task asks. met: the rule of the task, checked on the placement itself.
 */
function gradeWith(spec: Spec) {
  return (segment: Segment, response: unknown, rubric: Rubric | undefined): V2Grade => {
    const visual = segment?.visual?.type;
    const frame = spec.frame(visual, segment?.payload);
    if (!frame) return INVALID;
    const context = toContext(frame);
    if (rubric !== undefined) {
      if (!exactKeys(rubric, ['solutions']) || sampleArrangement(rubric, context) === null) return INVALID;
      if (spec.keyProblem(visual, segment.payload, rubric.solutions) !== null) return INVALID;
    }
    if (isUntouched(response, frame)) return VALID;
    if (gradeArrangement(response, undefined, context).verdict === 'invalid') return INVALID;
    const slots = (response as { slots: SlotMap }).slots;
    const accepts = spec.accepts?.(visual, segment.payload) ?? null;
    if (accepts && Object.entries(slots).some(([slot, pieces]) => pieces.some((piece) => !accepts(piece, slot)))) return INVALID;
    if (rubric === undefined) return VALID;
    if (spec.met(visual, segment.payload, slots)) return MET;
    const shape = gradeArrangement(response, { ...rubric, ordered: spec.ordered?.(visual, segment.payload) === true }, context);
    return { verdict: shape.verdict, diagnostic: shape.diagnostic };
  };
}

function sampleWith(spec: Spec) {
  return (segment: Segment, rubric: Rubric): unknown => {
    const frame = spec.frame(segment?.visual?.type, segment?.payload);
    return frame ? sampleArrangement(rubric, toContext(frame)) : null;
  };
}

const arrangement = (spec: Spec): HorizonteScorer => ({ grade: gradeWith(spec) as HorizonteScorer['grade'], sample: sampleWith(spec) as HorizonteScorer['sample'] });

const NETWORK: Spec = {
  frame: networkFrame, keyProblem: networkKeyProblem, met: networkMet, ordered: networkOrdered,
  accepts: (visual) => (visual === 'pascal' ? pascalAccepts : null),
};
const CIRCUITS: Spec = {
  frame: circuitFrame, keyProblem: circuitKeyProblem, met: circuitMetBy,
  accepts: (visual, payload) => (visual === 'gates' ? gatesAccepts(payload) : null),
};

/**
 * Explorers answer { predict, value? }: the learner's prediction, then the whole number found by exploring. A response
 * without `value` is the prediction alone: valid. The key must be the model's own answer, so a wrong key never grades. Both
 * right is met; a wrong number is review/value, and a right number after a wrong prediction is review/miss.
 */
function explorerGrade(segment: Segment, response: unknown, rubric: unknown): V2Grade {
  const visual = segment?.visual?.type;
  const truth = explorerTruth(visual, segment?.payload);
  const options = explorerOptions(visual);
  const range = explorerRange(visual, segment?.payload);
  if (!truth || !options || !range) return INVALID;
  if (rubric !== undefined && (!exactKeys(rubric, ['predict', 'value']) || rubric.predict !== truth.predict || rubric.value !== truth.value)) return INVALID;
  if (!exactKeys(response, ['predict'], ['value']) || typeof response.predict !== 'string' || !options.includes(response.predict)) return INVALID;
  if (response.value !== undefined && !isWhole(response.value, range[0], range[1])) return INVALID;
  if (rubric === undefined || response.value === undefined) return VALID;
  if (response.predict === truth.predict && response.value === truth.value) return MET;
  return { verdict: 'review', diagnostic: response.value === truth.value ? 'miss' : 'value' };
}

const explorer = (): HorizonteScorer => ({
  grade: explorerGrade as HorizonteScorer['grade'],
  sample: ((_segment: Segment, rubric: { predict: string; value: number }) => ({ predict: rubric.predict, value: rubric.value })) as HorizonteScorer['sample'],
});

export const COM_SCORERS: Readonly<Record<string, HorizonteScorer>> = {
  [NETWORK_TYPE]: arrangement(NETWORK),
  [TRIG_TYPE]: explorer(),
  [CALCULUS_TYPE]: explorer(),
  [CIRCUITS_TYPE]: arrangement(CIRCUITS),
};
