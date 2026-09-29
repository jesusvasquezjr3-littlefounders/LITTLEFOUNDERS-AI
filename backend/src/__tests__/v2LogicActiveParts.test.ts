import { describe, expect, it } from 'vitest';
import { gradeV2Response, V2_DIAGNOSTIC_CODES, v2DiagnosticFamily } from '../services/v2VisualScorer.js';
import { eulerPayload, sortBinsPayload, v2FamilyScorerPayload, type V2FamilySegment } from '../services/v2SegmentFamilies.js';

/*
 * GAP-FIX-R4 (Appendix P L5 and L10; Bible 05 §4): the Euler board's active
 * parts (choose the diagram that matches a sentence, flag the occupied
 * regions, draw a syllogism's conclusion) and the sort's mid-task rule switch,
 * each graded by Core with its own diagnostic code.
 */

const euler = (payload: Record<string, unknown>) => ({ id: 'e-01', type: 'logic.euler.v2', grading: 'server', prompt: 'p', visual: { type: 'euler' },
  payload: eulerPayload.parse({ sets: [{ id: 'set-a', label: 'A' }, { id: 'set-b', label: 'B' }],
    items: [{ id: 'item-x', label: 'X' }, { id: 'item-y', label: 'Y' }], ...payload }) }) as unknown as V2FamilySegment;
const grade = (segment: V2FamilySegment, response: unknown, rubric: unknown) =>
  gradeV2Response(segment.type as never, v2FamilyScorerPayload(segment), response, rubric);

describe('L5 Euler active parts', () => {
  it('keeps the declared-relation board unchanged', () => {
    const segment = euler({ relation: 'overlap' });
    const key = { regions: { 'item-x': 'both', 'item-y': 'first' } };
    expect(grade(segment, { placements: { 'item-x': 'both', 'item-y': 'first' } }, key)).toMatchObject({ verdict: 'met' });
    expect(grade(segment, { placements: { 'item-x': 'both', 'item-y': 'second' } }, key)).toMatchObject({ verdict: 'review', diagnostic: 'partial' });
  });

  it('grades the chosen diagram first: the wrong picture is a structure error', () => {
    const segment = euler({ choose_relation: true, sentence: 'No A is a B.' });
    const key = { relation: 'disjoint', regions: { 'item-x': 'first', 'item-y': 'second' } };
    expect(grade(segment, { relation: 'disjoint', placements: { 'item-x': 'first', 'item-y': 'second' } }, key)).toMatchObject({ verdict: 'met' });
    expect(grade(segment, { relation: 'overlap', placements: { 'item-x': 'first', 'item-y': 'second' } }, key)).toMatchObject({ verdict: 'review', diagnostic: 'structure' });
    // A placement the chosen diagram cannot hold is not an answer at all.
    expect(grade(segment, { relation: 'disjoint', placements: { 'item-x': 'both', 'item-y': 'second' } }, key).verdict).toBe('invalid');
    // Without the relation the learner has not answered; a key without its relation cannot grade.
    expect(grade(segment, { placements: { 'item-x': 'first', 'item-y': 'second' } }, key).verdict).toBe('invalid');
    expect(grade(segment, { relation: 'disjoint', placements: { 'item-x': 'first', 'item-y': 'second' } }, { regions: key.regions }).verdict).toBe('invalid');
    // The payload never names the relation it asks for.
    expect(v2FamilyScorerPayload(segment)).not.toHaveProperty('relation');
    expect(eulerPayload.safeParse({ choose_relation: true, sets: [{ id: 'set-a', label: 'A' }, { id: 'set-b', label: 'B' }], items: [{ id: 'item-x', label: 'X' }, { id: 'item-y', label: 'Y' }] }).success).toBe(false);
    expect(eulerPayload.safeParse({ relation: 'overlap', choose_relation: true, sentence: 's', sets: [{ id: 'set-a', label: 'A' }, { id: 'set-b', label: 'B' }], items: [{ id: 'item-x', label: 'X' }, { id: 'item-y', label: 'Y' }] }).success).toBe(false);
  });

  it('grades the region occupancy flags, and refuses a key whose flags miss a region its items sit in', () => {
    const segment = euler({ relation: 'subset', mark_occupancy: true });
    const key = { regions: { 'item-x': 'both', 'item-y': 'neither' }, occupied: ['both', 'second', 'neither'] };
    const placements = { 'item-x': 'both', 'item-y': 'neither' };
    expect(grade(segment, { placements, occupied: ['neither', 'both', 'second'] }, key)).toMatchObject({ verdict: 'met' });
    expect(grade(segment, { placements, occupied: ['both', 'neither'] }, key)).toMatchObject({ verdict: 'review', diagnostic: 'occupancy' });
    expect(grade(segment, { placements, occupied: ['first'] }, key).verdict).toBe('invalid');
    expect(grade(segment, { placements, occupied: ['both', 'neither'] }, { ...key, occupied: ['second'] }).verdict).toBe('invalid');
  });

  it('grades the syllogism conclusion (necessarily / possibly / never) last', () => {
    const segment = euler({ relation: 'subset', conclusion: { statement: 'Some subscriptions are hidden.' } });
    const key = { regions: { 'item-x': 'both', 'item-y': 'second' }, conclusion: 'possibly' };
    const placements = { 'item-x': 'both', 'item-y': 'second' };
    expect(grade(segment, { placements, conclusion: 'possibly' }, key)).toMatchObject({ verdict: 'met' });
    expect(grade(segment, { placements, conclusion: 'necessarily' }, key)).toMatchObject({ verdict: 'review', diagnostic: 'conclusion' });
    expect(grade(segment, { placements: { 'item-x': 'second', 'item-y': 'second' }, conclusion: 'necessarily' }, key)).toMatchObject({ diagnostic: 'partial' });
    expect(grade(segment, { placements, conclusion: 'maybe' }, key).verdict).toBe('invalid');
  });
});

const sort = (payload: Record<string, unknown>) => ({ id: 's-01', type: 'logic.sort-by-rule.v2', grading: 'server', prompt: 'p', visual: { type: 'sort-bins' },
  payload: sortBinsPayload.parse({ bins: [{ id: 'bin-even', label: 'Even' }, { id: 'bin-odd', label: 'Odd' }],
    items: [{ id: 'i-4', label: '4' }, { id: 'i-7', label: '7' }, { id: 'i-10', label: '10' }, { id: 'i-3', label: '3' }],
    reasons: [{ id: 'why-a', label: 'a' }, { id: 'why-b', label: 'b' }], ...payload }) }) as unknown as V2FamilySegment;

describe('L10 sort-by-rule: the rule switch', () => {
  const switched = sort({ switch_after: 2, second_rule: 'Big or small?', second_bins: [{ id: 'bin-big', label: 'Big' }, { id: 'bin-small', label: 'Small' }] });
  const key = { accepted: { 'i-4': [{ bin: 'bin-even', reason: 'why-a' }], 'i-7': [{ bin: 'bin-odd', reason: 'why-b' }],
    'i-10': [{ bin: 'bin-big', reason: 'why-a' }], 'i-3': [{ bin: 'bin-small', reason: 'why-b' }] } };
  const right = { 'i-4': { bin: 'bin-even', reason: 'why-a' }, 'i-7': { bin: 'bin-odd', reason: 'why-b' }, 'i-10': { bin: 'bin-big', reason: 'why-a' }, 'i-3': { bin: 'bin-small', reason: 'why-b' } };

  it('grades each phase: a wrong bin after the switch is rule_switch, a wrong first-phase bin stays bin', () => {
    expect(grade(switched, { placements: right }, key)).toMatchObject({ verdict: 'met' });
    expect(grade(switched, { placements: { ...right, 'i-3': { bin: 'bin-big', reason: 'why-b' } } }, key)).toMatchObject({ verdict: 'review', diagnostic: 'rule_switch' });
    expect(grade(switched, { placements: { ...right, 'i-4': { bin: 'bin-odd', reason: 'why-a' }, 'i-3': { bin: 'bin-big', reason: 'why-b' } } }, key)).toMatchObject({ diagnostic: 'bin' });
    expect(grade(switched, { placements: { ...right, 'i-10': { bin: 'bin-big', reason: 'why-b' } } }, key)).toMatchObject({ diagnostic: 'reason' });
  });

  it('refuses sorting an item with the old rule after the switch (the bins it may use are its phase\'s)', () => {
    expect(grade(switched, { placements: { ...right, 'i-10': { bin: 'bin-even', reason: 'why-a' } } }, key).verdict).toBe('invalid');
    expect(grade(switched, { placements: right }, { accepted: { ...key.accepted, 'i-10': [{ bin: 'bin-even', reason: 'why-a' }] } }).verdict).toBe('invalid');
  });

  it('keeps the payload honest: a switch needs its second bins and rule, and at least one item after it', () => {
    const base = { bins: [{ id: 'bin-a', label: 'A' }, { id: 'bin-b', label: 'B' }], items: [{ id: 'i-1', label: '1' }, { id: 'i-2', label: '2' }],
      reasons: [{ id: 'why-a', label: 'a' }, { id: 'why-b', label: 'b' }] };
    expect(sortBinsPayload.safeParse(base).success).toBe(true);
    expect(sortBinsPayload.safeParse({ ...base, switch_after: 1 }).success).toBe(false);
    expect(sortBinsPayload.safeParse({ ...base, switch_after: 2, second_rule: 'r', second_bins: [{ id: 'bin-c', label: 'C' }, { id: 'bin-d', label: 'D' }] }).success).toBe(false);
    expect(sortBinsPayload.safeParse({ ...base, switch_after: 1, second_rule: 'r', second_bins: [{ id: 'bin-c', label: 'C' }, { id: 'bin-d', label: 'D' }] }).success).toBe(true);
    expect(sortBinsPayload.safeParse({ ...base, depends_bin_id: 'bin-z' }).success).toBe(false);
  });
});

describe('the closed diagnostic vocabulary', () => {
  it('adds occupancy and conclusion as answer errors and rule_switch as a structure error', () => {
    for (const code of ['occupancy', 'conclusion', 'rule_switch'] as const) expect(V2_DIAGNOSTIC_CODES).toContain(code);
    expect(v2DiagnosticFamily('occupancy')).toBe('answer');
    expect(v2DiagnosticFamily('conclusion')).toBe('answer');
    expect(v2DiagnosticFamily('rule_switch')).toBe('structure');
  });
});
