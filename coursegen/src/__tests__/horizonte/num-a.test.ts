import { describe, expect, it } from 'vitest';
import { V2_SEGMENT_CAPABILITIES } from '../../v2/contract.js';
import { HORIZONTE_FORGE_CAPABILITIES, HORIZONTE_FORGE_PACKS, horizonteGuidanceFor, horizontePieceGates } from '../../v2/horizonte/index.js';
import { NUM_A_CAPABILITIES, numA } from '../../v2/horizonte/num-a.js';

type Payload = Record<string, unknown>;
const segment = (type: string, visual: string, payload: Payload) => ({ segments: [{ id: 'seg-num', type, visual: { type: visual }, payload }] });
const gate = (document: ReturnType<typeof segment>, key?: unknown) => horizontePieceGates(document, key === undefined ? undefined : { 'seg-num': key });

const REKENREK = segment('math.rekenrek.v2', 'rekenrek', { start: [0, 0] });
const ABACUS = segment('math.abacus.v2', 'abacus', { start: [3, 5] });
const JUMP = segment('math.number-line.empty.v2', 'empty-number-line', { start: 47, sizes: [1, 5, 10, 20], max: 6 });
const ZOOM = segment('math.number-line.zoom.v2', 'zoom-number-line', { low: 0, high: 10, depth: 1, start: 0 });
const CLOCK = segment('math.clock.v2', 'analog-clock', { start: 195, step: 5 });
const RULER = segment('math.ruler.v2', 'ruler', { unit: 'cm', from: 2, start: 3, max: 10 });
const BALANCE = segment('math.pan-balance.v2', 'pan-balance', { left: [5], right: [], weights: [1, 2, 2, 3] });

describe('num-a pack in the Forge (F1.2 rekenrek and abacus, F1.3 number lines, F1.7 clock, ruler, pan balance)', () => {
  it('declares the capability literal and the emitter map spreads it', () => {
    for (const [type, capabilities] of Object.entries(NUM_A_CAPABILITIES)) {
      expect(HORIZONTE_FORGE_CAPABILITIES[type as keyof typeof HORIZONTE_FORGE_CAPABILITIES], type).toEqual(capabilities);
      expect((V2_SEGMENT_CAPABILITIES as Record<string, readonly string[]>)[type], type).toEqual(capabilities);
    }
    expect(HORIZONTE_FORGE_PACKS).toContain(numA);
  });

  it('adds authoring guidance only when the skeleton uses the type, with an age scope for each', () => {
    expect(horizonteGuidanceFor(['math.rekenrek.v2']).join('\n')).toMatch(/ages 6-9 only/);
    expect(horizonteGuidanceFor(['math.number-line.zoom.v2']).join('\n')).toMatch(/ages 10-12 only/);
    for (const type of Object.keys(NUM_A_CAPABILITIES)) expect(horizonteGuidanceFor([type]).join('\n'), type).toMatch(/ages \d+-\d+/);
    expect(horizonteGuidanceFor(['money.allocation.v2'])).toEqual([]);
  });

  it('accepts a reachable target and a document with no key', () => {
    expect(gate(REKENREK, { target: [5, 2] })).toEqual([]);
    expect(gate(ABACUS, { target: [5, 5] })).toEqual([]);
    expect(gate(JUMP, { target: 73 })).toEqual([]);
    expect(gate(ZOOM, { target: 34 })).toEqual([]);
    expect(gate(CLOCK, { target: 220 })).toEqual([]);
    expect(gate(RULER, { target: 8 })).toEqual([]);
    expect(gate(BALANCE, { target: 0 })).toEqual([]);
    for (const document of [REKENREK, ABACUS, JUMP, ZOOM, CLOCK, RULER, BALANCE]) expect(gate(document)).toEqual([]);
  });

  it('refuses a malformed public payload at gate 4', () => {
    expect(gate(segment('math.rekenrek.v2', 'rekenrek', { start: [11, 0] }))).toHaveLength(1);
    expect(gate(segment('math.rekenrek.v2', 'rekenrek', { start: [1] }))).toHaveLength(1);
    expect(gate(segment('math.abacus.v2', 'abacus', { start: [1, 2, 3, 4, 5] }))).toHaveLength(1);
    expect(gate(segment('math.abacus.v2', 'abacus', { start: [1, 10] }))).toHaveLength(1);
    expect(gate(segment('math.number-line.empty.v2', 'empty-number-line', { start: 47, sizes: [3, 5], max: 6 }))).toHaveLength(1);
    expect(gate(segment('math.number-line.empty.v2', 'empty-number-line', { start: 47, sizes: [5], max: 6 }))).toHaveLength(1);
    expect(gate(segment('math.number-line.empty.v2', 'empty-number-line', { start: 47, sizes: [5, 5], max: 6 }))).toHaveLength(1);
    expect(gate(segment('math.number-line.zoom.v2', 'zoom-number-line', { low: 0, high: 40, depth: 1, start: 0 }))).toHaveLength(1);
    expect(gate(segment('math.number-line.zoom.v2', 'zoom-number-line', { low: 0, high: 10, depth: 3, start: 0 }))).toHaveLength(1);
    expect(gate(segment('math.number-line.zoom.v2', 'zoom-number-line', { low: 0, high: 10, depth: 1, start: 11 }))).toHaveLength(1);
    expect(gate(segment('math.clock.v2', 'analog-clock', { start: 0, step: 7 }))).toHaveLength(1);
    expect(gate(segment('math.clock.v2', 'analog-clock', { start: 193, step: 5 }))).toHaveLength(1);
    expect(gate(segment('math.clock.v2', 'analog-clock', { start: 720, step: 5 }))).toHaveLength(1);
    expect(gate(segment('math.ruler.v2', 'ruler', { unit: 'ft', from: 2, start: 3, max: 10 }))).toHaveLength(1);
    expect(gate(segment('math.ruler.v2', 'ruler', { unit: 'cm', from: 10, start: 10, max: 10 }))).toHaveLength(1);
    expect(gate(segment('math.pan-balance.v2', 'pan-balance', { left: [5], right: [], weights: [] }))).toHaveLength(1);
    expect(gate(segment('math.pan-balance.v2', 'pan-balance', { left: [0], right: [], weights: [1] }))).toHaveLength(1);
    expect(gate(segment('math.pan-balance.v2', 'pan-balance', { left: [], right: [], weights: [1, 1, 1, 1, 1, 1, 1] }))).toHaveLength(1);
  });

  it('refuses a mismatched visual at gate 4', () => {
    expect(gate(segment('math.rekenrek.v2', 'abacus', { start: [0, 0] }))[0]).toMatchObject({ gate: 4, segmentId: 'seg-num' });
    expect(gate(segment('math.clock.v2', 'ruler', { start: 0, step: 5 }))[0]?.message).toMatch(/analog-clock/);
  });

  it('refuses an unsolvable, unchanged or malformed target at gate 4', () => {
    expect(gate(REKENREK, { target: [0, 0] })[0]).toMatchObject({ gate: 4, segmentId: 'seg-num' });
    expect(gate(REKENREK, { target: [0, 0] })[0]?.message).toMatch(/differ from the start/);
    expect(gate(REKENREK, { target: [5] })[0]?.message).toMatch(/two bead counts/);
    expect(gate(ABACUS, { target: [3, 5] })[0]?.message).toMatch(/differ from the start/);
    expect(gate(ABACUS, { target: [3, 5, 0] })[0]?.message).toMatch(/per rod/);
    expect(gate(JUMP, { target: 47 })[0]?.message).toMatch(/differ from the start/);
    expect(gate(JUMP, { target: 168 })[0]?.message).toMatch(/cannot be reached/);
    expect(gate(JUMP, { target: 1001 })[0]?.message).toMatch(/0 to 1000/);
    expect(gate(JUMP, { target: 'far' })[0]?.message).toMatch(/0 to 1000/);
    expect(gate(segment('math.number-line.empty.v2', 'empty-number-line', { start: 10, sizes: [5, 10], max: 1 }), { target: 25 })[0]?.message).toMatch(/cannot be reached/);
    expect(gate(ZOOM, { target: 101 })[0]?.message).toMatch(/inside the window/);
    expect(gate(ZOOM, { target: 0 })[0]?.message).toMatch(/differ from the start/);
    expect(gate(CLOCK, { target: 223 })[0]?.message).toMatch(/multiple of the step/);
    expect(gate(CLOCK, { target: 195 })[0]?.message).toMatch(/differ from the start/);
    expect(gate(RULER, { target: 2 })[0]?.message).toMatch(/after the bar start/);
    expect(gate(RULER, { target: 3 })[0]?.message).toMatch(/differ from the start/);
    expect(gate(RULER, { target: 11 })[0]?.message).toMatch(/after the bar start/);
    expect(gate(BALANCE, { target: 5 })[0]?.message).toMatch(/every loose weight in the tray/);
    expect(gate(BALANCE, { target: 99 })[0]?.message).toMatch(/cannot be made/);
    expect(gate(segment('math.pan-balance.v2', 'pan-balance', { left: [5], right: [], weights: [2, 4] }), { target: 0 })[0]?.message).toMatch(/cannot be made/);
    expect(gate(BALANCE, { target: 1.5 })[0]?.message).toMatch(/whole number/);
  });

  it('ignores a type that is not its own', () => {
    expect(numA.gates({ segments: [{ id: 'other', type: 'money.allocation.v2', payload: {} }] })).toEqual([]);
  });
});
