import { issue, result, searchAssignments, type SolvabilityChecker, type SolvabilityIssue } from '../solvability.js';
import {
  graded, isId, keyRuleIssues, keysAre, prepareKey, record, repeated, sameKeys, whole, withKey,
  type Frame, type Rec, type Slots,
} from './comShared.js';

/*
 * F2.18 bits and logic gates. Hand-mirrored from backend/src/services/horizonte/com/circuits.ts.
 * Both boards are graded by rule: the bits must add up to the target, the gates must give the expected outputs.
 */

export const CIRCUIT_VISUALS = ['bits', 'gates'] as const;
export type CircuitVisual = (typeof CIRCUIT_VISUALS)[number];
export const isCircuitVisual = (value: unknown): value is CircuitVisual => typeof value === 'string' && (CIRCUIT_VISUALS as readonly string[]).includes(value);

const BITS_MIN = 4;
const BITS_MAX = 8;
const BITS_SLOT = 'bits-on';
const INPUT_MAX = 3;
const GATE_SLOT_MAX = 5;
const GATE_PIECE_MAX = 7;
const GATE_KINDS = ['and', 'or', 'not', 'xor', 'nand', 'nor'] as const;
type GateKind = (typeof GATE_KINDS)[number];

interface BitsPayload { bits: number; target: number }
interface GateSlot { id: string; from: string[] }
interface GatePiece { id: string; kind: GateKind }
interface GatesPayload { inputs: string[]; slots: GateSlot[]; pieces: GatePiece[]; expected: Array<0 | 1> }

export function circuitVisualOf(payload: Rec): CircuitVisual | null {
  if (payload.bits !== undefined) return 'bits';
  return payload.inputs !== undefined ? 'gates' : null;
}

/* ── bits ── */

const bitId = (weight: number): string => `bit-${weight}`;
const bitWeights = (bits: number): number[] => Array.from({ length: bits }, (_, index) => 2 ** (bits - 1 - index));

function bitsProblem(payload: unknown): string | null {
  if (!keysAre(payload, ['bits', 'target'])) return 'A bits payload holds a bit count and a target';
  if (!whole(payload.bits, BITS_MIN, BITS_MAX)) return `The number of bits is ${BITS_MIN} to ${BITS_MAX}`;
  if (!whole(payload.target, 1, 2 ** payload.bits - 1)) return 'The target is a whole number the bits can show, and never zero';
  return null;
}

function bitsMet(payload: BitsPayload, slots: Slots): boolean {
  if (Object.keys(slots).some((key) => key !== BITS_SLOT)) return false;
  const on = slots[BITS_SLOT] ?? [];
  return on.length > 0 && on.reduce((sum, id) => sum + Number(id.slice(4)), 0) === payload.target;
}

/* ── gates ── */

const gateArity = (kind: GateKind): 1 | 2 => (kind === 'not' ? 1 : 2);

function gateOut(kind: GateKind, a: 0 | 1, b: 0 | 1 = 0): 0 | 1 {
  switch (kind) {
    case 'and': return a & b ? 1 : 0;
    case 'or': return a | b ? 1 : 0;
    case 'not': return a ? 0 : 1;
    case 'xor': return a ^ b ? 1 : 0;
    case 'nand': return a & b ? 0 : 1;
    default: return a | b ? 0 : 1;
  }
}

/** The value of each input on row `row` of the truth table; the first input is the most significant bit. */
const rowInputs = (count: number, row: number): Array<0 | 1> => Array.from({ length: count }, (_, index) => (((row >> (count - 1 - index)) & 1) as 0 | 1));

/** The output of the last position on one row, or null while a position is empty or holds a gate of the wrong arity. */
function evalCircuit(gates: GatesPayload, assignment: Readonly<Record<string, string>>, row: number): 0 | 1 | null {
  const value = new Map<string, 0 | 1>(gates.inputs.map((id, index) => [id, rowInputs(gates.inputs.length, row)[index]!]));
  let last: 0 | 1 | null = null;
  for (const slot of gates.slots) {
    const piece = gates.pieces.find((candidate) => candidate.id === assignment[slot.id]);
    if (!piece || gateArity(piece.kind) !== slot.from.length) return null;
    const out = gateOut(piece.kind, value.get(slot.from[0]!)!, slot.from.length === 2 ? value.get(slot.from[1]!)! : 0);
    value.set(slot.id, out);
    last = out;
  }
  return last;
}

const givesExpected = (gates: GatesPayload, assignment: Readonly<Record<string, string>>): boolean => gates.expected.every((bit, row) => evalCircuit(gates, assignment, row) === bit);

/** Whether some arrangement of the gates gives the expected outputs. */
function hasArrangement(gates: GatesPayload): boolean {
  const used = new Set<string>();
  const assignment: Record<string, string> = {};
  const fill = (index: number): boolean => {
    if (index === gates.slots.length) return givesExpected(gates, assignment);
    const slot = gates.slots[index]!;
    for (const piece of gates.pieces) {
      if (used.has(piece.id) || gateArity(piece.kind) !== slot.from.length) continue;
      used.add(piece.id); assignment[slot.id] = piece.id;
      const found = fill(index + 1);
      used.delete(piece.id); delete assignment[slot.id];
      if (found) return true;
    }
    return false;
  };
  return fill(0);
}

/** `loose` leaves "some arrangement gives the expected outputs" to the search, so an impossible circuit reads as no-solution. */
function gatesProblem(payload: unknown, loose = false): string | null {
  if (!keysAre(payload, ['inputs', 'slots', 'pieces', 'expected'])) return 'A gates payload holds inputs, slots, pieces and the expected outputs';
  const { inputs, slots, pieces, expected } = payload;
  if (!Array.isArray(inputs) || inputs.length < 1 || inputs.length > INPUT_MAX || !inputs.every(isId)) return `A circuit has 1 to ${INPUT_MAX} inputs`;
  if (!Array.isArray(slots) || slots.length < 1 || slots.length > GATE_SLOT_MAX) return `A circuit has 1 to ${GATE_SLOT_MAX} gate positions`;
  if (!Array.isArray(pieces) || pieces.length < slots.length || pieces.length > GATE_PIECE_MAX) return `The tray holds as many gates as there are positions, and at most ${GATE_PIECE_MAX}`;
  const known = new Set<string>();
  const claim = (id: string): boolean => { if (known.has(id)) return false; known.add(id); return true; };
  if (!(inputs as string[]).every(claim)) return 'Input, position and gate ids are all different';
  for (const slot of slots as unknown[]) {
    if (!keysAre(slot, ['id', 'from']) || !isId(slot.id) || !Array.isArray(slot.from) || slot.from.length < 1 || slot.from.length > 2 || !slot.from.every(isId)) return 'Each position has an id and one or two sources';
    if (slot.from.length === 2 && slot.from[0] === slot.from[1]) return 'A two-source position reads two different sources';
    if (!(slot.from as string[]).every((ref) => known.has(ref))) return 'A position reads an input or an earlier position';
    if (!claim(slot.id)) return 'Input, position and gate ids are all different';
  }
  for (const piece of pieces as unknown[]) {
    if (!keysAre(piece, ['id', 'kind']) || !isId(piece.id) || !(GATE_KINDS as readonly unknown[]).includes(piece.kind)) return 'Each gate has an id and a kind';
    if (!claim(piece.id)) return 'Input, position and gate ids are all different';
  }
  if (!Array.isArray(expected) || expected.length !== 2 ** inputs.length || !expected.every((bit) => bit === 0 || bit === 1)) return 'The expected outputs list one bit for every row of the truth table';
  if (expected.every((bit) => bit === expected[0])) return 'The expected outputs are not all the same';
  const list = slots as GateSlot[];
  const feeds = new Set<string>([list[list.length - 1]!.id]);
  for (let index = list.length - 1; index >= 0; index -= 1) if (feeds.has(list[index]!.id)) for (const ref of list[index]!.from) feeds.add(ref);
  if (list.some((slot) => !feeds.has(slot.id))) return 'Every position feeds the output';
  if (!loose && !hasArrangement(payload as unknown as GatesPayload)) return 'Some arrangement of the gates gives the expected outputs';
  return null;
}

/* ── the piece ── */

export function circuitProblem(visual: unknown, payload: unknown, loose = false): string | null {
  if (visual === 'bits') return bitsProblem(payload);
  if (visual === 'gates') return gatesProblem(payload, loose);
  return 'This kind has no such visual';
}

export function circuitFrame(visual: unknown, payload: unknown, loose = false): Frame | null {
  if (circuitProblem(visual, payload, loose) !== null) return null;
  if (visual === 'bits') {
    const { bits } = payload as BitsPayload;
    return { pieceIds: bitWeights(bits).map(bitId), slotIds: [BITS_SLOT], capacities: { [BITS_SLOT]: bits } };
  }
  const gates = payload as GatesPayload;
  return { pieceIds: gates.pieces.map((piece) => piece.id), slotIds: gates.slots.map((slot) => slot.id), capacities: Object.fromEntries(gates.slots.map((slot) => [slot.id, 1])) };
}

export function circuitLabelsProblem(visual: unknown, payload: unknown, labels: unknown): string | null {
  if (circuitProblem(visual, payload) !== null) return 'The payload is malformed, so no label can be checked';
  if (visual === 'bits') return labels === undefined ? null : 'A row of bits takes no labels';
  const gates = payload as GatesPayload;
  return record(labels) && sameKeys(labels, [...gates.inputs, gates.slots[gates.slots.length - 1]!.id]) ? null : 'Labels name every input and the output, and nothing else';
}

function circuitMet(visual: unknown, payload: unknown, slots: Slots, loose: boolean): boolean {
  if (visual === 'bits') return bitsMet(payload as BitsPayload, slots);
  const gates = payload as GatesPayload;
  if (circuitProblem(visual, payload, loose) !== null || Object.keys(slots).some((key) => !gates.slots.some((slot) => slot.id === key))) return false;
  if (gates.slots.some((slot) => slots[slot.id]?.length !== 1)) return false;
  return givesExpected(gates, Object.fromEntries(gates.slots.map((slot) => [slot.id, slots[slot.id]![0]!])));
}

/** A key solution must itself meet the rule, so a wrong key never grades anyone. */
export function circuitKeyProblem(visual: unknown, payload: unknown, solutions: readonly Slots[], loose = false): string | null {
  if (circuitProblem(visual, payload, loose) !== null) return 'The payload is malformed';
  return solutions.every((solution) => circuitMet(visual, payload, solution, loose)) ? null : 'Every key solution meets the rule of the task';
}

/* ── solvability ── */

function structure(visual: CircuitVisual, payload: Rec): SolvabilityIssue[] {
  if (visual === 'bits') return [];
  const inputs = Array.isArray(payload.inputs) ? payload.inputs.filter((id): id is string => typeof id === 'string') : [];
  const slots = Array.isArray(payload.slots) ? payload.slots.filter(record) : [];
  const pieces = Array.isArray(payload.pieces) ? payload.pieces.filter(record) : [];
  const issues = repeated([...inputs, ...slots.map((slot) => slot.id), ...pieces.map((piece) => piece.id)], 'circuit item');
  const known = new Set(inputs);
  for (const slot of slots) {
    for (const ref of Array.isArray(slot.from) ? slot.from : []) {
      if (typeof ref === 'string' && !known.has(ref)) issues.push(issue('dangling-reference', `"${String(slot.id)}" refers to "${ref}", which is not an input or an earlier position`));
    }
    if (typeof slot.id === 'string') known.add(slot.id);
  }
  return issues;
}

export const circuitChecker: SolvabilityChecker = (segment, context) => {
  const payload = segment.payload;
  const visual = circuitVisualOf(payload);
  if (visual === null) return result([issue('impossible-state', `circuit segment ${segment.id}: the payload matches no visual (a row of bits has "bits", logic gates have "inputs")`)]);
  const subject = `${visual === 'bits' ? 'bits' : 'circuit'} ${segment.id}`;
  const structural = structure(visual, payload);
  if (structural.length > 0) return result(structural);
  const broken = circuitProblem(visual, payload, true);
  if (broken) return result([issue('impossible-state', `${subject}: ${broken}`)]);
  const prepared = prepareKey(circuitFrame(visual, payload, true)!, context, subject);
  const ruleIssues = keyRuleIssues(subject, prepared, prepared.solutions.length > 0 ? circuitKeyProblem(visual, payload, prepared.solutions, true) : null);
  if (visual === 'bits') {
    const { bits, target } = payload as unknown as BitsPayload;
    const weights = bitWeights(bits);
    const totalOf = (picked: readonly number[]) => picked.reduce((sum, on, index) => sum + on * weights[index]!, 0);
    const outcome = graded(subject, (limit) => searchAssignments<number>({
      domains: weights.map(() => [1, 0]),
      accept: (partial) => totalOf(partial) <= target,
      isSolution: (full) => totalOf(full) === target,
      key: (full) => full.join(''),
      limit,
      maxNodes: context.nodeBudget,
    }));
    return withKey(outcome, prepared, ruleIssues);
  }
  const gates = payload as unknown as GatesPayload;
  const assignmentOf = (full: readonly number[]): Record<string, string> => Object.fromEntries(gates.slots.map((slot, index) => [slot.id, gates.pieces[full[index]!]!.id]));
  const outcome = graded(subject, (limit) => searchAssignments<number>({
    domains: gates.slots.map((slot) => gates.pieces.flatMap((piece, index) => (gateArity(piece.kind) === slot.from.length ? [index] : []))),
    distinct: true,
    isSolution: (full) => givesExpected(gates, assignmentOf(full)),
    key: (full) => full.join(','),
    limit,
    maxNodes: context.nodeBudget,
  }));
  return withKey(outcome, prepared, ruleIssues);
};
