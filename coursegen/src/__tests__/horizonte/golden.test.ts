import { describe, expect, it } from 'vitest';
import { V2_SEGMENT_CAPABILITIES } from '../../v2/contract.js';
import { HORIZONTE_FORGE_CAPABILITIES, HORIZONTE_FORGE_PACKS, horizonteGuidanceFor, horizontePieceGates } from '../../v2/horizonte/index.js';
import { GOLDEN_CAPABILITIES, golden } from '../../v2/horizonte/golden.js';

const TYPE = 'math.ten-frame.v2';
const doc = (start: number[], visual = start.length === 2 ? 'double-ten-frame' : 'ten-frame') => ({ segments: [{ id: 'seg-frame', type: TYPE, visual: { type: visual }, payload: { start } }] });

describe('golden pack in the Forge (F1.1 ten frame)', () => {
  it('declares the capability literal and the emitter map spreads it', () => {
    expect(GOLDEN_CAPABILITIES[TYPE]).toEqual(['visual.ten-frame.v1', 'operation.drag-chips.v1', 'operation.tap-cells.v1']);
    expect(HORIZONTE_FORGE_CAPABILITIES[TYPE]).toEqual(GOLDEN_CAPABILITIES[TYPE]);
    expect((V2_SEGMENT_CAPABILITIES as Record<string, readonly string[]>)[TYPE]).toEqual(GOLDEN_CAPABILITIES[TYPE]);
    expect(HORIZONTE_FORGE_PACKS).toContain(golden);
  });

  it('adds authoring guidance only when the skeleton uses the type', () => {
    expect(horizonteGuidanceFor([TYPE]).join('\n')).toMatch(/ages 6-9 only/);
    expect(horizonteGuidanceFor(['money.allocation.v2'])).toEqual([]);
  });

  it('accepts a reachable single and double frame and a document with no key', () => {
    expect(horizontePieceGates(doc([6]), { 'seg-frame': { target: [10] } })).toEqual([]);
    expect(horizontePieceGates(doc([8, 5]), { 'seg-frame': { target: [10, 3] } })).toEqual([]);
    expect(horizontePieceGates(doc([6]))).toEqual([]);
  });

  it('refuses a malformed start, a mismatched visual and an unsolvable target at gate 4', () => {
    const gate = (document: ReturnType<typeof doc>, key?: unknown) => horizontePieceGates(document, key === undefined ? undefined : { 'seg-frame': key });
    expect(gate(doc([11]))).toHaveLength(1);
    expect(gate(doc([1, 2, 3]))).toHaveLength(1);
    expect(gate(doc([6], 'double-ten-frame'))).toHaveLength(1);
    expect(gate(doc([6]), { target: [6] })[0]).toMatchObject({ gate: 4, segmentId: 'seg-frame' });
    expect(gate(doc([6]), { target: [4] })[0]?.message).toMatch(/only added/);
    expect(gate(doc([8, 5]), { target: [10, 4] })[0]?.message).toMatch(/keep the total/);
    expect(gate(doc([8, 5]), { target: [8, 5] })[0]?.message).toMatch(/differ from the start/);
    expect(gate(doc([8, 5]), { target: [13] })[0]?.message).toMatch(/one whole count per frame/);
  });
});
