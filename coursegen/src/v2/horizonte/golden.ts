import type { GateProblem } from '../../pipeline/gates.js';
import type { ForgeGuidance, ForgeHorizontePack } from './types.js';

export const GOLDEN_CAPABILITIES = {
  'math.ten-frame.v2': ['visual.ten-frame.v1', 'operation.drag-chips.v1', 'operation.tap-cells.v1'],
} as const;

const TYPE = 'math.ten-frame.v2';
const CELLS = 10;

const GOLDEN_GUIDANCE: readonly ForgeGuidance[] = [{
  type: TYPE,
  lines: [
    `${TYPE}: ages 6-9 only. The prompt is one imperative sentence of at most 10 words that names the goal as a frame state (make ten, fill the first frame), never a counter count or a sum.`,
    `${TYPE}: one frame asks to add counters to reach a target; two frames ask to move counters with the total unchanged. Never ask for a result above 10 on one frame.`,
  ],
}];

const whole = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);
export const frameCounts = (value: unknown, frames: number): value is number[] =>
  Array.isArray(value) && value.length === frames && value.every((count) => whole(count) && count >= 0 && count <= CELLS);
export const total = (counts: readonly number[]) => counts.reduce((sum, count) => sum + count, 0);

/** Gate 4 (solvability): the private target is reachable from the public start under the frame rule, and is a change. */
function goldenGates(document: { segments?: unknown }, answerKeys?: Record<string, unknown>): GateProblem[] {
  const problems: GateProblem[] = [];
  const segments = Array.isArray(document.segments) ? (document.segments as Array<Record<string, unknown>>) : [];
  for (const segment of segments) {
    if (segment.type !== TYPE) continue;
    const segmentId = typeof segment.id === 'string' ? segment.id : '(segment)';
    const start = (segment.payload as { start?: unknown } | undefined)?.start;
    const frames = Array.isArray(start) ? start.length : 0;
    if (frames < 1 || frames > 2 || !frameCounts(start, frames)) {
      problems.push({ gate: 4, segmentId, message: 'The ten frame start is one or two counts, each a whole number from 0 to 10' });
      continue;
    }
    const visual = (segment.visual as { type?: unknown } | undefined)?.type;
    if (visual !== (frames === 2 ? 'double-ten-frame' : 'ten-frame')) problems.push({ gate: 4, segmentId, message: 'The ten frame visual must match the number of frames' });
    const key = answerKeys && Object.hasOwn(answerKeys, segmentId) ? (answerKeys[segmentId] as { target?: unknown } | null) : undefined;
    if (key === undefined) continue;
    const target = key?.target;
    if (!frameCounts(target, frames)) { problems.push({ gate: 4, segmentId, message: 'The ten frame target must have one whole count per frame, each from 0 to 10' }); continue; }
    if (target.every((count, index) => count === start[index])) problems.push({ gate: 4, segmentId, message: 'The ten frame target must differ from the start' });
    else if (frames === 1 ? target[0]! < start[0]! : total(target) !== total(start)) {
      problems.push({ gate: 4, segmentId, message: frames === 1 ? 'The ten frame target cannot be below the start (counters are only added)' : 'The double ten frame target must keep the total of the start' });
    }
  }
  return problems;
}

export const golden = {
  id: 'golden',
  capabilities: GOLDEN_CAPABILITIES,
  guidance: GOLDEN_GUIDANCE,
  gates: goldenGates,
} as const satisfies ForgeHorizontePack;
