import { describe, expect, it } from 'vitest';
import { assertScorerContract } from '../../services/horizonte/harness/scorerContract.js';
import { numA } from '../../services/horizonte/num-a/index.js';
import { NUM_A_FIXTURES } from '../../services/horizonte/num-a/fixtures.js';
import { NUM_A_AGE_SCOPE, NUM_A_RUBRICS } from '../../services/horizonte/num-a/contract.js';
import { NUM_A_CAPABILITIES } from '../../services/horizonte/num-a/capabilities.js';
import { abacusValue, beadSlid, blocksOf, isAbacusDigits, isRekenrekCounts, rodBeads, rodDigit, tapBead, tapFive, tapOne } from '../../services/horizonte/num-a/beads-model.js';
import {
  isJumpList, jumpSetup, jumpTargetReachable, landing, reachableLandings, zoomCanIn, zoomCanOut, zoomIn, zoomInitial, zoomMove, zoomOut, zoomSetup, zoomSnap, zoomStartUnits, zoomWindow,
} from '../../services/horizonte/num-a/line-model.js';
import {
  balanceSetup, balanceTargetReachable, beamLean, clockMinutes, clockParts, clockSetup, clockText, handAngles, isClockMinutes, isPans, isRulerEnd, minuteAtAngle, panDifference, panTotals, reachableDifferences,
  rulerSetup, rulerTargetReachable, untouchedPans,
} from '../../services/horizonte/num-a/measure-model.js';
import { horizonteGrade, horizonteSampleVerdict, horizonteScopeProblem } from '../../services/horizonte/index.js';
import { gradeV2Visual, v2PublicLessonSchema, validateV2LessonForGrading } from '../../services/v2LessonDocument.js';

type Grade = (segment: unknown, response: unknown, rubric: unknown) => { verdict: string; diagnostic: string };
const fixture = (id: string) => NUM_A_FIXTURES.find((entry) => entry.id === id)!;
const grade = (type: string) => numA.scorers[type]!.grade as unknown as Grade;
const segmentOf = (id: string) => fixture(id).segment('en-US');
const verdict = (id: string, response: unknown, ...key: unknown[]) => grade(segmentOf(id).type as string)(segmentOf(id), response, key.length > 0 ? key[0] : fixture(id).rubric).verdict;

function lesson(id: string, locale: 'en-US' | 'es-MX' | 'pt-BR' = 'en-US') {
  const entry = fixture(id);
  const type = entry.segment('en-US').type as string;
  return {
    schema_version: 2, course_id: 'financial-education', pathway_id: `horizonte-${entry.ageBand}`, chapter_id: 'horizonte-num-a', lesson_id: `hz-num-a-${id}`,
    version_id: 'rev-1', locale, age_band: entry.ageBand, eligibility: entry.eligibility, knowledge_component_ids: ['kc-horizonte-fixture'], adventure_scene_id: 'diorama-a',
    title: entry.title[locale], required_capabilities: [...NUM_A_CAPABILITIES[type as keyof typeof NUM_A_CAPABILITIES]], segments: [entry.segment(locale)],
  };
}

describe('num-a pack: F1.2 rekenrek and abacus, F1.3 number lines, F1.7 clock, ruler and pan balance', () => {
  it('meets the scorer contract', () => {
    expect(() => assertScorerContract(numA, NUM_A_FIXTURES)).not.toThrow();
  });

  it('covers every segment type with at least one fixture and a scope', () => {
    const types = new Set(NUM_A_FIXTURES.map((entry) => entry.segment('en-US').type as string));
    expect([...types].sort()).toEqual(Object.keys(NUM_A_CAPABILITIES).sort());
    for (const type of types) {
      expect(NUM_A_AGE_SCOPE[type], type).toBeDefined();
      expect(NUM_A_RUBRICS[type as keyof typeof NUM_A_RUBRICS], type).toBeDefined();
    }
  });

  it('keeps the bead model total', () => {
    expect(isRekenrekCounts([5, 2])).toBe(true);
    expect(isRekenrekCounts([5])).toBe(false);
    expect(isRekenrekCounts([11, 0])).toBe(false);
    expect(isRekenrekCounts([2.5, 1])).toBe(false);
    expect(isAbacusDigits([4, 7])).toBe(true);
    expect(isAbacusDigits([4, 7], 3)).toBe(false);
    expect(isAbacusDigits([4, 10])).toBe(false);
    expect(isAbacusDigits([1, 2, 3, 4, 5])).toBe(false);
    expect(isAbacusDigits([])).toBe(false);
    expect(blocksOf(7)).toEqual({ fives: 1, ones: 2 });
    expect(blocksOf(10)).toEqual({ fives: 2, ones: 0 });
    expect(beadSlid(3, 2)).toBe(true);
    expect(beadSlid(3, 3)).toBe(false);
    expect(tapBead(3, 6)).toBe(7);
    expect(tapBead(3, 1)).toBe(1);
    expect(tapBead(0, 0)).toBe(1);
    expect(tapBead(10, 9)).toBe(9);
    expect(rodBeads(7)).toEqual({ five: true, ones: 2 });
    expect(rodDigit(true, 4)).toBe(9);
    expect(tapFive(3)).toBe(8);
    expect(tapFive(8)).toBe(3);
    expect(tapOne(7, 3)).toBe(9);
    expect(tapOne(7, 0)).toBe(5);
    expect(tapOne(2, 1)).toBe(1);
    expect(abacusValue([4, 7])).toBe(47);
  });

  it('keeps the number line model total', () => {
    const setup = jumpSetup({ start: 47, sizes: [1, 5, 10, 20], max: 6 })!;
    expect(setup).toBeDefined();
    expect(jumpSetup({ start: 47, sizes: [1], max: 6 })).toBeUndefined();
    expect(jumpSetup({ start: 47, sizes: [1, 3], max: 6 })).toBeUndefined();
    expect(jumpSetup({ start: 47, sizes: [1, 1], max: 6 })).toBeUndefined();
    expect(jumpSetup({ start: 2000, sizes: [1, 5], max: 6 })).toBeUndefined();
    expect(jumpSetup({ start: 4, sizes: [1, 5], max: 9 })).toBeUndefined();
    expect(isJumpList(setup, [20, 5, 1])).toBe(true);
    expect(isJumpList(setup, [20, 5, 1, 1, 1, 1, 1])).toBe(false);
    expect(isJumpList(setup, [3])).toBe(false);
    expect(isJumpList(setup, [0])).toBe(false);
    expect(isJumpList(setup, [1.5])).toBe(false);
    expect(isJumpList({ ...setup, start: 3 }, [-5])).toBe(false);
    expect(landing(47, [20, 5, 1])).toBe(73);
    expect(landing(47, [])).toBe(47);
    expect(reachableLandings(setup).has(73)).toBe(true);
    expect(jumpTargetReachable(setup, 73)).toBe(true);
    expect(jumpTargetReachable(setup, 47)).toBe(false);
    expect(jumpTargetReachable({ ...setup, max: 1 }, 73)).toBe(false);
    expect(jumpTargetReachable({ start: 10, sizes: [5, 10], max: 3 }, 12)).toBe(false);
    expect(jumpTargetReachable(setup, 1.5)).toBe(false);
  });

  it('keeps the zoom model and its state transitions total', () => {
    const setup = zoomSetup({ low: 3, high: 5, depth: 2, start: 4 })!;
    expect(setup).toBeDefined();
    expect(zoomSetup({ low: 0, high: 30, depth: 1, start: 0 })).toBeUndefined();
    expect(zoomSetup({ low: 5, high: 5, depth: 1, start: 5 })).toBeUndefined();
    expect(zoomSetup({ low: 0, high: 10, depth: 3, start: 0 })).toBeUndefined();
    expect(zoomSetup({ low: 0, high: 10, depth: 1, start: 11 })).toBeUndefined();
    expect(zoomStartUnits(setup)).toBe(400);
    let state = zoomInitial(setup);
    expect(state).toEqual({ level: 0, units: 400, anchors: [] });
    expect(zoomWindow(setup, state)).toEqual({ from: 300, to: 500 });
    expect(zoomCanOut(state)).toBe(false);
    expect(zoomCanIn(setup, state)).toBe(true);
    state = zoomMove(setup, state, 347);
    expect(state.units).toBe(300);
    state = zoomIn(setup, state);
    expect(state.level).toBe(1);
    expect(zoomWindow(setup, state)).toEqual({ from: 300, to: 400 });
    state = zoomMove(setup, state, 347);
    expect(state.units).toBe(350);
    expect(zoomSnap(setup, state, 9999)).toBe(400);
    expect(zoomSnap(setup, state, -9999)).toBe(300);
    state = zoomIn(setup, state);
    expect(state.level).toBe(2);
    expect(zoomCanIn(setup, state)).toBe(false);
    expect(zoomIn(setup, state)).toBe(state);
    expect(zoomWindow(setup, state)).toEqual({ from: 340, to: 360 });
    state = zoomMove(setup, state, 347);
    expect(state.units).toBe(347);
    state = zoomOut(setup, state);
    expect(state).toEqual({ level: 1, units: 350, anchors: [300] });
    state = zoomOut(setup, state);
    expect(state).toEqual({ level: 0, units: 400, anchors: [] });
    expect(zoomOut(setup, state)).toBe(state);
  });

  it('keeps the measure model total', () => {
    const clock = clockSetup({ start: 195, step: 5 })!;
    expect(clock).toEqual({ start: 195, step: 5 });
    expect(clockSetup({ start: 195, step: 7 })).toBeUndefined();
    expect(clockSetup({ start: 723, step: 5 })).toBeUndefined();
    expect(clockSetup({ start: 193, step: 5 })).toBeUndefined();
    expect(isClockMinutes(0, 15)).toBe(true);
    expect(isClockMinutes(719, 1)).toBe(true);
    expect(isClockMinutes(720, 1)).toBe(false);
    expect(isClockMinutes(-5, 5)).toBe(false);
    expect(clockParts(0)).toEqual({ hour: 12, minute: 0 });
    expect(clockParts(195)).toEqual({ hour: 3, minute: 15 });
    expect(clockMinutes(12, 0)).toBe(0);
    expect(clockMinutes(3, 30)).toBe(210);
    expect(clockText(210)).toBe('3:30');
    expect(clockText(5)).toBe('12:05');
    expect(handAngles(210)).toEqual({ hour: 105, minute: 180 });
    expect(minuteAtAngle(180, 5)).toBe(30);
    expect(minuteAtAngle(179, 15)).toBe(30);
    expect(minuteAtAngle(359, 5)).toBe(0);
    expect(minuteAtAngle(-90, 15)).toBe(45);

    const ruler = rulerSetup({ unit: 'cm', from: 2, start: 3, max: 10 })!;
    expect(ruler).toBeDefined();
    expect(rulerSetup({ unit: 'ft', from: 2, start: 3, max: 10 })).toBeUndefined();
    expect(rulerSetup({ unit: 'cm', from: 10, start: 10, max: 10 })).toBeUndefined();
    expect(rulerSetup({ unit: 'cm', from: 2, start: 1, max: 10 })).toBeUndefined();
    expect(rulerSetup({ unit: 'cm', from: 2, start: 3, max: 20 })).toBeUndefined();
    expect(isRulerEnd(ruler, 2)).toBe(true);
    expect(isRulerEnd(ruler, 1)).toBe(false);
    expect(isRulerEnd(ruler, 11)).toBe(false);
    expect(rulerTargetReachable(ruler, 8)).toBe(true);
    expect(rulerTargetReachable(ruler, 3)).toBe(false);
    expect(rulerTargetReachable(ruler, 2)).toBe(false);

    const balance = balanceSetup({ left: [5], right: [], weights: [1, 2, 2, 3] })!;
    expect(balance).toBeDefined();
    expect(balanceSetup({ left: [5], right: [], weights: [] })).toBeUndefined();
    expect(balanceSetup({ left: [0], right: [], weights: [1] })).toBeUndefined();
    expect(balanceSetup({ left: [1, 1, 1, 1, 1], right: [], weights: [1] })).toBeUndefined();
    expect(isPans(balance, [0, 0, 2, 2])).toBe(true);
    expect(isPans(balance, [0, 0, 3, 2])).toBe(false);
    expect(isPans(balance, [0, 0])).toBe(false);
    expect(panTotals(balance, [1, 0, 2, 2])).toEqual({ left: 6, right: 5 });
    expect(panDifference(balance, untouchedPans(balance))).toBe(5);
    expect(panDifference(balance, [0, 0, 2, 2])).toBe(0);
    expect(reachableDifferences(balance).has(0)).toBe(true);
    expect(balanceTargetReachable(balance, 0)).toBe(true);
    expect(balanceTargetReachable(balance, 5)).toBe(false);
    expect(balanceTargetReachable(balance, 99)).toBe(false);
    expect(balanceTargetReachable(balanceSetup({ left: [5], right: [], weights: [2, 4] })!, 0)).toBe(false);
    expect(beamLean(3)).toBe(-1);
    expect(beamLean(-3)).toBe(1);
    expect(beamLean(0)).toBe(0);
  });

  it('grades the rekenrek and the abacus against the private target', () => {
    expect(verdict('rekenrek-seven', { beads: [5, 2] })).toBe('met');
    expect(grade('math.rekenrek.v2')(segmentOf('rekenrek-seven'), { beads: [2, 5] }, fixture('rekenrek-seven').rubric)).toEqual({ verdict: 'review', diagnostic: 'value' });
    expect(verdict('rekenrek-seven', { beads: [0, 0] })).toBe('valid');
    expect(verdict('rekenrek-seven', { beads: [11, 0] })).toBe('invalid');
    expect(verdict('rekenrek-seven', { beads: [5, 2], extra: 1 })).toBe('invalid');
    expect(verdict('rekenrek-seven', { counts: [5, 2] })).toBe('invalid');
    expect(verdict('rekenrek-seven', [5, 2])).toBe('invalid');
    expect(verdict('rekenrek-ten', { beads: [10, 0] })).toBe('met');
    expect(verdict('abacus-forty-seven', { digits: [4, 7] })).toBe('met');
    expect(verdict('abacus-forty-seven', { digits: [7, 4] })).toBe('review');
    expect(verdict('abacus-forty-seven', { digits: [0, 0] })).toBe('valid');
    expect(verdict('abacus-forty-seven', { digits: [4, 7, 0] })).toBe('invalid');
    expect(verdict('abacus-add-twenty', { digits: [5, 5] })).toBe('met');
    expect(verdict('abacus-add-twenty', { digits: [3, 5] })).toBe('valid');
  });

  it('grades the number lines against the private target', () => {
    expect(verdict('jump-up', { jumps: [20, 5, 1] })).toBe('met');
    expect(verdict('jump-up', { jumps: [1, 5, 20] })).toBe('met');
    expect(verdict('jump-up', { jumps: [20, 5] })).toBe('review');
    expect(verdict('jump-up', { jumps: [] })).toBe('valid');
    expect(verdict('jump-up', { jumps: [10, -10] })).toBe('valid');
    expect(verdict('jump-up', { jumps: [3] })).toBe('invalid');
    expect(verdict('jump-up', { jumps: [1, 1, 1, 1, 1, 1, 1] })).toBe('invalid');
    expect(verdict('jump-back', { jumps: [-20, -2, -2] })).toBe('met');
    expect(verdict('jump-back', { jumps: [-20, -20, -20, -20] })).toBe('invalid');
    expect(verdict('zoom-tenths', { units: 34 })).toBe('met');
    expect(verdict('zoom-tenths', { units: 40 })).toBe('review');
    expect(verdict('zoom-tenths', { units: 0 })).toBe('valid');
    expect(verdict('zoom-tenths', { units: 101 })).toBe('invalid');
    expect(verdict('zoom-tenths', { units: 3.4 })).toBe('invalid');
    expect(verdict('zoom-hundredths', { units: 347 })).toBe('met');
    expect(verdict('zoom-hundredths', { units: 340 })).toBe('review');
  });

  it('grades the clock, the ruler and the pan balance against the private target', () => {
    expect(verdict('clock-half-past', { minutes: 210 })).toBe('met');
    expect(verdict('clock-half-past', { minutes: 195 })).toBe('review');
    expect(verdict('clock-half-past', { minutes: 0 })).toBe('valid');
    expect(verdict('clock-half-past', { minutes: 212 })).toBe('invalid');
    expect(verdict('clock-later', { minutes: 220 })).toBe('met');
    expect(verdict('clock-later', { minutes: 225 })).toBe('review');
    expect(verdict('ruler-six', { end: 8 })).toBe('met');
    expect(verdict('ruler-six', { end: 7 })).toBe('review');
    expect(verdict('ruler-six', { end: 3 })).toBe('valid');
    expect(verdict('ruler-six', { end: 11 })).toBe('invalid');
    expect(verdict('ruler-inches', { end: 7 })).toBe('met');
    expect(verdict('balance-it', { pans: [0, 0, 2, 2] })).toBe('met');
    expect(verdict('balance-it', { pans: [2, 0, 0, 2] })).toBe('review');
    expect(verdict('balance-it', { pans: [0, 0, 0, 0] })).toBe('valid');
    expect(verdict('balance-it', { pans: [1, 1, 1, 1] })).toBe('review');
    expect(verdict('balance-it', { pans: [0, 0, 0] })).toBe('invalid');
    expect(verdict('balance-heavier', { pans: [2, 0, 1] })).toBe('met');
    expect(verdict('balance-heavier', { pans: [0, 0, 0] })).toBe('valid');
  });

  it('refuses an unreachable, unchanged or malformed target as a malformed key', () => {
    expect(verdict('rekenrek-seven', { beads: [5, 2] }, { target: [0, 0] })).toBe('invalid');
    expect(verdict('rekenrek-seven', { beads: [5, 2] }, { target: [12, 0] })).toBe('invalid');
    expect(verdict('abacus-forty-seven', { digits: [4, 7] }, { target: [0, 0] })).toBe('invalid');
    expect(verdict('abacus-forty-seven', { digits: [4, 7] }, { target: [4, 7, 0] })).toBe('invalid');
    expect(verdict('jump-up', { jumps: [20, 5, 1] }, { target: 47 })).toBe('invalid');
    expect(verdict('jump-up', { jumps: [20, 5, 1] }, { target: 168 })).toBe('invalid');
    expect(verdict('jump-up', { jumps: [20, 5, 1] }, { target: 'far' })).toBe('invalid');
    expect(verdict('zoom-tenths', { units: 34 }, { target: 0 })).toBe('invalid');
    expect(verdict('zoom-tenths', { units: 34 }, { target: 101 })).toBe('invalid');
    expect(verdict('clock-half-past', { minutes: 210 }, { target: 0 })).toBe('invalid');
    expect(verdict('clock-half-past', { minutes: 210 }, { target: 212 })).toBe('invalid');
    expect(verdict('ruler-six', { end: 8 }, { target: 3 })).toBe('invalid');
    expect(verdict('ruler-six', { end: 8 }, { target: 2 })).toBe('invalid');
    expect(verdict('balance-it', { pans: [0, 0, 2, 2] }, { target: 5 })).toBe('invalid');
    expect(verdict('balance-it', { pans: [0, 0, 2, 2] }, { target: 99 })).toBe('invalid');
    expect(verdict('balance-it', { pans: [0, 0, 2, 2] }, { aim: 0 })).toBe('invalid');
    expect(verdict('balance-it', { pans: [0, 0, 2, 2] }, null)).toBe('invalid');
  });

  it('refuses a payload that breaks a rule of its piece', () => {
    const bad = (id: string, payload: unknown) => grade(segmentOf(id).type as string)({ ...segmentOf(id), payload }, (numA.scorers[segmentOf(id).type as string]!.sample as unknown as (segment: unknown, rubric: unknown) => unknown)(segmentOf(id), fixture(id).rubric), fixture(id).rubric).verdict;
    expect(bad('rekenrek-seven', { start: [3] })).toBe('invalid');
    expect(bad('abacus-forty-seven', { start: [] })).toBe('invalid');
    expect(bad('jump-up', { start: 47, sizes: [3, 5], max: 6 })).toBe('invalid');
    expect(bad('zoom-tenths', { low: 0, high: 99, depth: 1, start: 0 })).toBe('invalid');
    expect(bad('clock-half-past', { start: 0, step: 7 })).toBe('invalid');
    expect(bad('ruler-six', { unit: 'cm', from: 9, start: 3, max: 10 })).toBe('invalid');
    expect(bad('balance-it', { left: [5], right: [], weights: [] })).toBe('invalid');
  });

  it('never says met in the browser, which holds no rubric', () => {
    expect(verdict('rekenrek-seven', { beads: [5, 2] }, undefined)).toBe('valid');
    expect(verdict('rekenrek-seven', { beads: [11, 2] }, undefined)).toBe('invalid');
    expect(verdict('jump-up', { jumps: [20, 5, 1] }, undefined)).toBe('valid');
    expect(verdict('jump-up', { jumps: [3] }, undefined)).toBe('invalid');
    expect(verdict('clock-half-past', { minutes: 210 }, undefined)).toBe('valid');
    expect(verdict('balance-it', { pans: [0, 0, 2, 2] }, undefined)).toBe('valid');
  });

  it('has a sample that scores valid for every fixture', () => {
    for (const entry of NUM_A_FIXTURES) {
      const segment = entry.segment('en-US') as { type: string };
      expect(horizonteSampleVerdict(segment, entry.rubric), entry.id).toBe('valid');
    }
  });

  it('is open to the declared ages only', () => {
    const scope = (type: string, band: string, minimum_age: number, maximum_age: number) => horizonteScopeProblem({ type }, { age_band: band, eligibility: { minimum_age, maximum_age } });
    expect(scope('math.rekenrek.v2', '6-9', 6, 9)).toBeNull();
    expect(scope('math.rekenrek.v2', '10-12', 10, 12)).not.toBeNull();
    expect(scope('math.abacus.v2', '6-9', 6, 9)).toBeNull();
    expect(scope('math.number-line.zoom.v2', '10-12', 10, 12)).toBeNull();
    expect(scope('math.number-line.zoom.v2', '6-9', 6, 9)).not.toBeNull();
    expect(scope('math.clock.v2', '6-9', 6, 9)).toBeNull();
    expect(scope('math.pan-balance.v2', '13-17', 13, 17)).not.toBeNull();
    for (const type of Object.keys(NUM_A_CAPABILITIES)) expect(scope(type, 'adult', 18, 99), type).not.toBeNull();
  });

  it('plugs into Core: public schema, answer key and the server grade', () => {
    for (const entry of NUM_A_FIXTURES) {
      for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) expect(v2PublicLessonSchema.safeParse(lesson(entry.id, locale)).success, `${entry.id} ${locale}`).toBe(true);
      const document = lesson(entry.id);
      const id = entry.segment('en-US').id as string;
      const expected = { lessonId: document.lesson_id, locale: document.locale };
      expect(validateV2LessonForGrading(document, { [id]: entry.rubric }, expected), entry.id).not.toBeNull();
      const parsed = v2PublicLessonSchema.parse(document);
      expect(gradeV2Visual(parsed, { [id]: entry.rubric }, id, entry.ladder.met), entry.id).toMatchObject({ score: 100, correct: true });
      expect(gradeV2Visual(parsed, { [id]: entry.rubric }, id, entry.ladder.invalid), entry.id).toBeNull();
      expect(horizonteGrade({ type: entry.segment('en-US').type as string }, entry.ladder.met, entry.rubric), entry.id).toBeNull();
    }
    const seven = lesson('rekenrek-seven');
    const sevenId = 'rekenrek-seven';
    expect(gradeV2Visual(v2PublicLessonSchema.parse(seven), { [sevenId]: { target: [2, 5] } }, sevenId, { beads: [5, 2] })).toMatchObject({ score: 0, correct: false, diagnostic: 'value' });
    expect(validateV2LessonForGrading(seven, { [sevenId]: { target: [0, 0] } }, { lessonId: seven.lesson_id, locale: seven.locale })).toBeNull();
  });

  it('keeps every payload identical across locales and free of the answer', () => {
    for (const entry of NUM_A_FIXTURES) {
      const payload = JSON.stringify((entry.segment('en-US') as { payload: unknown }).payload);
      expect(JSON.stringify((entry.segment('es-MX') as { payload: unknown }).payload), entry.id).toBe(payload);
      expect(JSON.stringify((entry.segment('pt-BR') as { payload: unknown }).payload), entry.id).toBe(payload);
      expect(payload, entry.id).not.toMatch(/target|answer|correct|solution/i);
    }
  });

  it('refuses a payload that leaks the answer, a wrong visual and an out-of-scope document', () => {
    const base = lesson('rekenrek-seven');
    const segment = base.segments[0] as Record<string, unknown>;
    expect(v2PublicLessonSchema.safeParse({ ...base, segments: [{ ...segment, visual: { type: 'abacus' } }] }).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...base, segments: [{ ...segment, payload: { start: [0, 0], target: [5, 2] } }] }).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...base, age_band: '10-12', eligibility: { minimum_age: 10, maximum_age: 12 } }).success).toBe(false);
    const zoom = lesson('zoom-tenths');
    expect(v2PublicLessonSchema.safeParse({ ...zoom, age_band: '6-9', eligibility: { minimum_age: 6, maximum_age: 9 } }).success).toBe(false);
    const clock = lesson('clock-half-past');
    expect(v2PublicLessonSchema.safeParse({ ...clock, segments: [{ ...(clock.segments[0] as Record<string, unknown>), payload: { start: 0, step: 7 } }] }).success).toBe(false);
  });
});
