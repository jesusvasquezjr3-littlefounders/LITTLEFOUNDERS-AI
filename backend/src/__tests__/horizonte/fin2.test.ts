import { describe, expect, it } from 'vitest';
import { assertScorerContract } from '../../services/horizonte/harness/scorerContract.js';
import { FIN2_CAPABILITIES } from '../../services/horizonte/fin2/capabilities.js';
import { fin2 } from '../../services/horizonte/fin2/index.js';
import { FIN2_FIXTURES } from '../../services/horizonte/fin2/fixtures.js';
import { gridExpected, gridKeyProblem, gridProblem, weightedTotals, type GridPayload } from '../../services/horizonte/fin2/matrix.js';
import { ganttMet, kanbanExpected, scheduleConflicts, scheduleKeyProblem, scheduleProblem, timelineMet, type SchedulePayload } from '../../services/horizonte/fin2/schedule.js';
import { goalReached, statementHoldings, statementKeyProblem, statementProblem, statementTotals, type StatementItem } from '../../services/horizonte/fin2/statement.js';
import { horizonteGrade, horizonteSampleVerdict, horizonteScopeProblem } from '../../services/horizonte/index.js';
import { gradeV2Visual, v2PublicLessonSchema, validateV2LessonForGrading } from '../../services/v2LessonDocument.js';

type Locale = 'en-US' | 'es-MX' | 'pt-BR';
type Grade = (segment: unknown, response: unknown, rubric: unknown) => { verdict: string; diagnostic: string };
const fixture = (id: string) => FIN2_FIXTURES.find((item) => item.id === id)!;
const segmentOf = (id: string, locale: Locale = 'en-US') => fixture(id).segment(locale);
const grade = (id: string, slots: Record<string, string[]>, withRubric = true) => {
  const type = segmentOf(id).type as string;
  return (fin2.scorers[type]!.grade as unknown as Grade)(segmentOf(id), { slots }, withRubric ? fixture(id).rubric : undefined);
};
const solution = (id: string) => (fixture(id).rubric as { solutions: Array<Record<string, string[]>> }).solutions[0]!;
const payloadOf = <T,>(id: string) => segmentOf(id).payload as T;
const steps = (order: string[]) => Object.fromEntries(order.map((task, index) => [`step-${index + 1}`, [task]]));

describe('fin2 pack: F2.13 to F2.15', () => {
  it('meets the scorer contract', () => {
    expect(() => assertScorerContract(fin2, FIN2_FIXTURES)).not.toThrow();
  });

  it('declares the three kinds with parity-ready capability literals and one fixture family each', () => {
    expect(Object.keys(FIN2_CAPABILITIES).sort()).toEqual(['money.cash-flow.v2', 'plan.schedule-board.v2', 'reasoning.decision-grid.v2']);
    const visuals = new Set(FIN2_FIXTURES.map((item) => (item.segment('en-US').visual as { type: string }).type));
    expect([...visuals].sort()).toEqual(['business-canvas', 'decision-matrix', 'eisenhower', 'gantt', 'kanban', 'statement-board', 'swot', 'timeline', 'two-by-two']);
  });

  describe('F2.13 statement board', () => {
    it('keeps the statement model total and strict', () => {
      const items = payloadOf<{ items: StatementItem[] }>('cash-flow-short').items;
      expect(statementProblem({ items })).toBeNull();
      for (const bad of [undefined, null, 0, 'x', [], {}, { items: 'x' }, { items: items.slice(0, 4) }, { items, extra: 1 }, { items: [...items.slice(1), { id: 'goal-met', amount: 5 }] }, { items: [...items.slice(1), items[1]] }, { items: [{ id: 'weekend-job', amount: 0 }, ...items.slice(1)] }, { items: [{ id: 'weekend-job', amount: 1.5 }, ...items.slice(1)] }]) {
        expect(statementProblem(bad)).not.toBeNull();
      }
    });

    it('totals only flows and names the goal as passive greater than expenses', () => {
      const items = payloadOf<{ items: StatementItem[] }>('cash-flow-short').items;
      expect(statementTotals(solution('cash-flow-short'), items)).toEqual({ earned: 600, passive: 37, expenses: 125 });
      expect(goalReached({ earned: 600, passive: 37, expenses: 125 })).toBe(false);
      const met = payloadOf<{ items: StatementItem[] }>('cash-flow-met').items;
      expect(goalReached(statementTotals(solution('cash-flow-met'), met))).toBe(true);
      expect(goalReached({ earned: 0, passive: 100, expenses: 100 })).toBe(false);
      expect(statementHoldings(solution('cash-flow-short'), items)).toEqual({ assets: 650, liabilities: 300 });
      expect(statementHoldings({}, items)).toEqual({ assets: 0, liabilities: 0 });
    });

    it('refuses a key that misplaces an item or names the wrong goal token', () => {
      const payload = payloadOf<{ items: StatementItem[] }>('cash-flow-short');
      expect(statementKeyProblem(payload, [solution('cash-flow-short')])).toBeNull();
      expect(statementKeyProblem(payload, [{ ...solution('cash-flow-short'), goal: ['goal-met'] }])).not.toBeNull();
      expect(statementKeyProblem(payload, [{ ...solution('cash-flow-short'), expenses: ['phone-plan'] }])).not.toBeNull();
      expect(statementKeyProblem(payload, [{ ...solution('cash-flow-short'), goal: [] }])).not.toBeNull();
    });

    it('grades the sort and the conclusion', () => {
      const key = solution('cash-flow-short');
      expect(grade('cash-flow-short', key).verdict).toBe('met');
      expect(grade('cash-flow-short', {}).verdict).toBe('valid');
      expect(grade('cash-flow-short', { ...key, goal: ['goal-met'] })).toEqual({ verdict: 'review', diagnostic: 'partial' });
      expect(grade('cash-flow-short', { ...key, goal: [] })).toEqual({ verdict: 'review', diagnostic: 'miss' });
      expect(grade('cash-flow-short', { ...key, earned: ['weekend-job'], passive: ['savings-interest', 'stock-dividend', 'tutoring'] }).verdict).toBe('review');
      expect(grade('cash-flow-short', { earned: ['weekend-job'] }).verdict).toBe('review');
      expect(grade('cash-flow-short', { goal: ['goal-met', 'goal-short'] }).verdict).toBe('invalid');
      expect(grade('cash-flow-short', { earned: ['weekend-job'], passive: ['weekend-job'] }).verdict).toBe('invalid');
      expect(grade('cash-flow-short', key, false).verdict).toBe('valid');
    });
  });

  describe('F2.14 decision grid', () => {
    it('keeps the grid model total and strict', () => {
      const two = payloadOf<GridPayload>('grid-two-by-two-ideas');
      expect(gridProblem('two-by-two', two)).toBeNull();
      expect(gridProblem('two-by-two', { ...two, points: [[5, 8], ...two.points!.slice(1)] })).not.toBeNull();
      expect(gridProblem('two-by-two', { ...two, points: two.points!.slice(1) })).not.toBeNull();
      expect(gridProblem('swot', { pieces: ['alpha-one', 'alpha-two', 'alpha-three', 'alpha-four'], points: [] })).not.toBeNull();
      expect(gridProblem('swot', { pieces: ['alpha-one', 'alpha-two', 'alpha-three'] })).not.toBeNull();
      expect(gridProblem('nonsense', two)).not.toBeNull();
      expect(gridProblem('swot', null)).not.toBeNull();
      const matrix = payloadOf<GridPayload>('grid-decision-spot');
      expect(gridProblem('decision-matrix', matrix)).toBeNull();
      expect(gridProblem('decision-matrix', { ...matrix, scores: [[3, 3, 3], [3, 3, 3], [4, 2, 4]] })).not.toBeNull();
      expect(gridProblem('decision-matrix', { ...matrix, criteria: [{ id: 'market-corner', weight: 1 }, ...matrix.criteria!.slice(1)] })).not.toBeNull();
    });

    it('computes the one answer of a 2x2 and of a decision matrix', () => {
      expect(weightedTotals(payloadOf<GridPayload>('grid-decision-spot'))).toEqual([36, 32, 34]);
      expect(gridExpected('decision-matrix', payloadOf('grid-decision-spot'))).toEqual(solution('grid-decision-spot'));
      expect(gridExpected('two-by-two', payloadOf('grid-two-by-two-ideas'))).toEqual(solution('grid-two-by-two-ideas'));
      expect(gridExpected('swot', payloadOf('grid-swot-stand'))).toBeNull();
    });

    it('refuses a computed key that is not the computed answer and any key that skips a piece', () => {
      const two = payloadOf('grid-two-by-two-ideas');
      expect(gridKeyProblem('two-by-two', two, [solution('grid-two-by-two-ideas')])).toBeNull();
      expect(gridKeyProblem('two-by-two', two, [{ ...solution('grid-two-by-two-ideas'), 'top-left': ['new-sign'], 'bottom-left': ['extra-napkins', 'discount-card'] }])).not.toBeNull();
      expect(gridKeyProblem('swot', payloadOf('grid-swot-stand'), [{ strengths: ['fresh-recipe'] }])).not.toBeNull();
      expect(gridKeyProblem('swot', payloadOf('grid-swot-stand'), [solution('grid-swot-stand')])).toBeNull();
    });

    it('grades each visual against its key', () => {
      for (const id of ['grid-swot-stand', 'grid-eisenhower-week', 'grid-two-by-two-ideas', 'grid-decision-spot', 'grid-canvas-lemonade']) {
        const key = solution(id);
        expect(grade(id, key).verdict, id).toBe('met');
        expect(grade(id, {}).verdict, id).toBe('valid');
        expect(grade(id, key, false).verdict, id).toBe('valid');
        const [first, second] = Object.keys(key);
        const swapped = { ...key, [first!]: [...key[second!]!], [second!]: [...key[first!]!] };
        expect(grade(id, swapped).verdict, id).toBe('review');
      }
      expect(grade('grid-decision-spot', { 'rank-1': ['bus-stop'], 'rank-2': ['market-corner'], 'rank-3': ['library-steps'] }).verdict).toBe('review');
      expect(grade('grid-swot-stand', { strengths: ['fresh-recipe'] }).verdict).toBe('review');
    });
  });

  describe('F2.15 schedule board', () => {
    it('keeps the schedule model total and strict', () => {
      const gantt = payloadOf<SchedulePayload>('plan-gantt-opening');
      expect(scheduleProblem('gantt', gantt)).toBeNull();
      expect(scheduleProblem('gantt', { ...gantt, periods: 3 })).toMatch(/deadline/);
      expect(scheduleProblem('gantt', { ...gantt, done: ['design-menu'] })).not.toBeNull();
      expect(scheduleProblem('timeline', gantt)).not.toBeNull();
      expect(scheduleProblem('gantt', { ...gantt, tasks: [{ id: 'task-a', after: ['task-b'], duration: 1 }, { id: 'task-b', after: ['task-c'], duration: 1 }, { id: 'task-c', after: ['task-a'], duration: 1 }] })).toMatch(/cycle/);
      expect(scheduleProblem('gantt', { ...gantt, tasks: [{ id: 'task-a', after: ['task-z'], duration: 1 }, ...gantt.tasks.slice(1)] })).not.toBeNull();
      expect(scheduleProblem('gantt', null)).not.toBeNull();
      expect(scheduleProblem('nonsense', gantt)).not.toBeNull();
      const kanban = payloadOf<SchedulePayload>('plan-kanban-opening');
      expect(scheduleProblem('kanban', kanban)).toBeNull();
      expect(scheduleProblem('kanban', { ...kanban, limit: 1 })).not.toBeNull();
      expect(scheduleProblem('kanban', { ...kanban, done: ['design-menu', 'buy-cups', 'set-tables'] })).not.toBeNull();
      expect(scheduleProblem('kanban', { ...kanban, done: ['design-menu', 'buy-cups', 'print-menu', 'buy-lemons', 'set-tables'] })).not.toBeNull();
      expect(scheduleProblem('timeline', payloadOf('plan-timeline-opening'))).toBeNull();
      expect(scheduleProblem('timeline', { tasks: [{ id: 'task-a', after: [], due: 9 }, { id: 'task-b', after: [] }, { id: 'task-c', after: [] }] })).not.toBeNull();
    });

    it('meets a Gantt in more than one way and refuses each broken rule', () => {
      const gantt = payloadOf<SchedulePayload>('plan-gantt-opening');
      expect(ganttMet(gantt, solution('plan-gantt-opening'))).toBe(true);
      expect(ganttMet(gantt, { 'period-1': ['design-menu', 'shop-lemons'], 'period-2': ['squeeze-juice'], 'period-3': ['print-menu'], 'period-5': ['open-stand', 'make-sign'] })).toBe(true);
      expect(ganttMet(gantt, { 'period-1': ['design-menu', 'shop-lemons'], 'period-2': ['squeeze-juice', 'print-menu'], 'period-4': ['open-stand', 'make-sign'] })).toBe(false);
      expect(ganttMet(gantt, { 'period-1': ['design-menu', 'shop-lemons', 'make-sign'], 'period-2': ['squeeze-juice'], 'period-3': ['print-menu'], 'period-4': ['open-stand'] })).toBe(false);
      expect(ganttMet(gantt, { 'period-1': ['design-menu', 'shop-lemons'], 'period-2': ['squeeze-juice'], 'period-3': ['print-menu', 'open-stand'], 'period-4': ['make-sign'] })).toBe(false);
      expect(ganttMet(gantt, { 'period-1': ['design-menu', 'shop-lemons'], 'period-5': ['squeeze-juice'], 'period-3': ['print-menu'], 'period-4': ['open-stand', 'make-sign'] })).toBe(false);
      expect(ganttMet(gantt, { 'period-1': ['design-menu'] })).toBe(false);
    });

    it('accepts the three orders that keep every deadline of the timeline and refuses the rest', () => {
      const timeline = payloadOf<SchedulePayload>('plan-timeline-opening');
      const tail = ['make-juice', 'open-stand', 'count-cash'];
      expect(timelineMet(timeline, steps(['buy-lemons', 'set-price', 'make-sign', 'make-juice', 'open-stand', 'count-cash']))).toBe(true);
      expect(timelineMet(timeline, steps(['set-price', 'buy-lemons', 'make-sign', ...tail]))).toBe(true);
      expect(timelineMet(timeline, steps(['set-price', 'make-sign', 'buy-lemons', ...tail]))).toBe(true);
      expect(timelineMet(timeline, steps(['buy-lemons', 'make-juice', 'set-price', 'make-sign', 'open-stand', 'count-cash']))).toBe(false);
      expect(timelineMet(timeline, steps(['make-sign', 'set-price', 'buy-lemons', ...tail]))).toBe(false);
      expect(timelineMet(timeline, steps(['buy-lemons', 'set-price', 'make-sign', 'make-juice', 'count-cash', 'open-stand']))).toBe(false);
    });

    it('names the placed tasks that break a rule, and never an unplaced one', () => {
      const gantt = payloadOf<SchedulePayload>('plan-gantt-opening');
      const early = { 'period-1': ['design-menu', 'print-menu'], 'period-5': ['squeeze-juice'] };
      expect(scheduleConflicts('gantt', gantt, solution('plan-gantt-opening'))).toEqual([]);
      expect(scheduleConflicts('gantt', gantt, {})).toEqual([]);
      expect(scheduleConflicts('gantt', gantt, early)).toEqual(['print-menu', 'squeeze-juice']);
      expect(scheduleConflicts('gantt', gantt, { 'period-1': ['design-menu', 'shop-lemons', 'make-sign'] })).toEqual(['design-menu', 'shop-lemons', 'make-sign']);
      const timeline = payloadOf<SchedulePayload>('plan-timeline-opening');
      expect(scheduleConflicts('timeline', timeline, steps(['buy-lemons', 'make-juice', 'set-price', 'make-sign', 'open-stand', 'count-cash']))).toEqual(['make-sign']);
      expect(scheduleConflicts('timeline', timeline, { 'step-1': ['make-sign'] })).toEqual([]);
      expect(scheduleConflicts('kanban', payloadOf('plan-kanban-opening'), { doing: ['print-menu'] })).toEqual([]);
      expect(scheduleConflicts('gantt', null, {})).toEqual([]);
    });

    it('derives the single kanban board from the done list', () => {
      expect(kanbanExpected(payloadOf<SchedulePayload>('plan-kanban-opening'))).toEqual(solution('plan-kanban-opening'));
      expect(scheduleKeyProblem('kanban', payloadOf('plan-kanban-opening'), [solution('plan-kanban-opening')])).toBeNull();
      expect(scheduleKeyProblem('kanban', payloadOf('plan-kanban-opening'), [{ doing: ['print-menu', 'set-tables'], todo: ['buy-lemons', 'open-stand'] }])).not.toBeNull();
      expect(scheduleKeyProblem('gantt', payloadOf('plan-gantt-opening'), [{ 'period-1': ['design-menu'] }])).not.toBeNull();
    });

    it('grades by the rules, not only by the key', () => {
      expect(grade('plan-gantt-opening', solution('plan-gantt-opening')).verdict).toBe('met');
      expect(grade('plan-gantt-opening', { 'period-1': ['design-menu', 'shop-lemons'], 'period-2': ['squeeze-juice'], 'period-3': ['print-menu'], 'period-5': ['open-stand', 'make-sign'] })).toEqual({ verdict: 'met', diagnostic: 'none' });
      expect(grade('plan-gantt-opening', { 'period-1': ['design-menu', 'shop-lemons', 'make-sign'], 'period-2': ['squeeze-juice'], 'period-3': ['print-menu'], 'period-4': ['open-stand'] }).verdict).toBe('review');
      expect(grade('plan-gantt-opening', { 'period-1': ['design-menu'] }).verdict).toBe('review');
      expect(grade('plan-timeline-opening', steps(['set-price', 'make-sign', 'buy-lemons', 'make-juice', 'open-stand', 'count-cash'])).verdict).toBe('met');
      expect(grade('plan-timeline-opening', steps(['buy-lemons', 'make-juice', 'set-price', 'make-sign', 'open-stand', 'count-cash'])).verdict).toBe('review');
      expect(grade('plan-timeline-opening', { 'step-1': ['buy-lemons', 'set-price'] }).verdict).toBe('invalid');
      expect(grade('plan-kanban-opening', solution('plan-kanban-opening')).verdict).toBe('met');
      expect(grade('plan-kanban-opening', { doing: ['print-menu'], todo: ['buy-lemons', 'set-tables', 'open-stand'] }).verdict).toBe('review');
      expect(grade('plan-kanban-opening', { doing: ['design-menu'] }).verdict).toBe('invalid');
    });
  });

  it('refuses a malformed key as invalid, never met', () => {
    const met = solution('plan-gantt-opening');
    const grader = fin2.scorers['plan.schedule-board.v2']!.grade as unknown as Grade;
    const segment = segmentOf('plan-gantt-opening');
    expect(grader(segment, { slots: met }, { solutions: [{ 'period-1': ['design-menu'] }] }).verdict).toBe('invalid');
    expect(grader(segment, { slots: met }, { solutions: [met], ordered: true }).verdict).toBe('invalid');
    expect(grader(segment, { slots: met }, { solutions: [] }).verdict).toBe('invalid');
    expect(grader(segment, { slots: met }, { solutions: [{ 'period-1': ['no-such-task'] }] }).verdict).toBe('invalid');
    expect(grader({ ...segment, visual: { type: 'kanban' } }, { slots: met }, { solutions: [met] }).verdict).toBe('invalid');
  });

  it('is open to the declared ages and the adult pathway', () => {
    const scope = (type: string, band: string, minimum_age: number, maximum_age: number) => horizonteScopeProblem({ type }, { age_band: band, eligibility: { minimum_age, maximum_age } });
    expect(scope('money.cash-flow.v2', '13-17', 13, 17)).toBeNull();
    expect(scope('money.cash-flow.v2', '10-12', 12, 12)).not.toBeNull();
    expect(scope('money.cash-flow.v2', 'adult', 18, 99)).toBeNull();
    expect(scope('reasoning.decision-grid.v2', '10-12', 12, 12)).toBeNull();
    expect(scope('reasoning.decision-grid.v2', '10-12', 10, 12)).not.toBeNull();
    expect(scope('plan.schedule-board.v2', '10-12', 12, 12)).toBeNull();
    expect(scope('plan.schedule-board.v2', '6-9', 6, 9)).not.toBeNull();
  });

  describe('plugs into Core', () => {
    const lesson = (id: string, locale: Locale) => {
      const item = fixture(id);
      const type = item.segment('en-US').type as keyof typeof FIN2_CAPABILITIES;
      return {
        schema_version: 2, course_id: 'financial-education', pathway_id: `horizonte-${item.ageBand}`, chapter_id: 'horizonte-fin2', lesson_id: `hz-fin2-${id}`,
        version_id: 'rev-1', locale, age_band: item.ageBand, eligibility: item.eligibility, knowledge_component_ids: ['kc-horizonte-fixture'], adventure_scene_id: 'diorama-a',
        title: item.title[locale], required_capabilities: [...FIN2_CAPABILITIES[type]], segments: [item.segment(locale)],
      };
    };

    it('parses every fixture in every locale, keys it, grades it and never leaks', () => {
      for (const item of FIN2_FIXTURES) {
        for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) expect(v2PublicLessonSchema.safeParse(lesson(item.id, locale)).success, `${item.id} ${locale}`).toBe(true);
        const document = lesson(item.id, 'en-US');
        const keys = { [item.id]: item.rubric };
        expect(validateV2LessonForGrading(document, keys, { lessonId: document.lesson_id, locale: 'en-US' }), item.id).not.toBeNull();
        const parsed = v2PublicLessonSchema.parse(document);
        expect(gradeV2Visual(parsed, keys, item.id, item.ladder.met), item.id).toMatchObject({ score: 100, correct: true });
        expect(gradeV2Visual(parsed, keys, item.id, item.ladder.valid), item.id).toBeNull();
        expect(gradeV2Visual(parsed, keys, item.id, item.ladder.invalid), item.id).toBeNull();
        expect(horizonteGrade(item.segment('en-US') as { type: string }, item.ladder.met, item.rubric)).toMatchObject({ score: 100, correct: true });
        expect(horizonteSampleVerdict(item.segment('en-US') as { type: string }, item.rubric)).toBe('met');
        expect(JSON.stringify(v2PublicLessonSchema.parse(document))).not.toContain('solutions');
      }
    });

    it('scores a wrong placement as a review the learner sees', () => {
      const document = lesson('cash-flow-short', 'en-US');
      const parsed = v2PublicLessonSchema.parse(document);
      const keys = { 'cash-flow-short': fixture('cash-flow-short').rubric };
      expect(gradeV2Visual(parsed, keys, 'cash-flow-short', { slots: { ...solution('cash-flow-short'), goal: ['goal-met'] } })).toMatchObject({ score: 0, correct: false, diagnostic: 'partial' });
    });

    it('refuses an answer in the payload, a wrong visual, a missing label and an unsolvable schedule', () => {
      const base = lesson('plan-gantt-opening', 'en-US');
      const patch = (changes: Record<string, unknown>) => ({ ...base, segments: [{ ...base.segments[0], ...changes }] });
      const payload = base.segments[0]!.payload as Record<string, unknown>;
      expect(v2PublicLessonSchema.safeParse(patch({ payload: { ...payload, solutions: [] } })).success).toBe(false);
      expect(v2PublicLessonSchema.safeParse(patch({ visual: { type: 'kanban' } })).success).toBe(false);
      expect(v2PublicLessonSchema.safeParse(patch({ visual: { type: 'swot' } })).success).toBe(false);
      expect(v2PublicLessonSchema.safeParse(patch({ labels: { 'design-menu': 'Design the menu' } })).success).toBe(false);
      expect(v2PublicLessonSchema.safeParse(patch({ payload: { ...payload, periods: 3 } })).success).toBe(false);
      expect(v2PublicLessonSchema.safeParse(patch({ labels: Object.fromEntries(Object.keys(base.segments[0]!.labels as object).map((key) => [key, ' '])) })).success).toBe(false);
      const grid = lesson('grid-two-by-two-ideas', 'en-US');
      const points = (grid.segments[0]!.payload as GridPayload).points!;
      expect(v2PublicLessonSchema.safeParse({ ...grid, segments: [{ ...grid.segments[0], payload: { ...(grid.segments[0]!.payload as object), points: [[5, 8], ...points.slice(1)] } }] }).success).toBe(false);
    });
  });
});
