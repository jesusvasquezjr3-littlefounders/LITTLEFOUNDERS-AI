import { describe, expect, it } from 'vitest';
import { V2_SEGMENT_CAPABILITIES } from '../../v2/contract.js';
import { HORIZONTE_FORGE_CAPABILITIES, HORIZONTE_FORGE_PACKS, horizonteGuidanceFor, horizontePieceGates } from '../../v2/horizonte/index.js';
import { FIN2_CAPABILITIES, fin2 } from '../../v2/horizonte/fin2.js';
import { registeredSolvabilityTypes, runSolvabilityGate } from '../../v2/solvability.js';
import '../../v2/solvabilityPacks.js';

const CASH = 'money.cash-flow.v2';
const GRID = 'reasoning.decision-grid.v2';
const PLAN = 'plan.schedule-board.v2';

type Seg = { id: string; type: string; visual: { type: string }; prompt: string; labels: Record<string, string>; payload: Record<string, unknown> };
type Doc = { age_band?: string; segments: Seg[] };

const named = (ids: readonly string[]): Record<string, string> => Object.fromEntries(ids.map((id) => [id, id.replace(/-/g, ' ')]));
const seg = (id: string, type: string, visual: string, ids: readonly string[], payload: Record<string, unknown>): Seg => ({ id, type, visual: { type: visual }, prompt: 'Place every piece on the board.', labels: named(ids), payload });
const keyOf = (...solutions: Array<Record<string, string[]>>) => ({ solutions });

const AXES = ['x-name', 'y-name', 'x-low', 'x-high', 'y-low', 'y-high'];
const items = (list: Array<[string, number]>) => list.map(([id, amount]) => ({ id, amount }));

const cashShort = seg('cash-flow-short', CASH, 'statement-board', ['weekend-job', 'tutoring', 'savings-interest', 'stock-dividend', 'phone-plan', 'snacks', 'savings', 'bike-loan'], {
  items: items([['weekend-job', 420], ['tutoring', 180], ['savings-interest', 12], ['stock-dividend', 25], ['phone-plan', 35], ['snacks', 90], ['savings', 650], ['bike-loan', 300]]),
});
const cashShortKey = keyOf({ earned: ['weekend-job', 'tutoring'], passive: ['savings-interest', 'stock-dividend'], expenses: ['phone-plan', 'snacks'], assets: ['savings'], liabilities: ['bike-loan'], goal: ['goal-short'] });
const cashMet = seg('cash-flow-met', CASH, 'statement-board', ['print-sales', 'design-gigs', 'stock-dividend', 'song-royalty', 'garage-rent', 'ink-paper', 'bus-pass', 'printer', 'laptop-loan'], {
  items: items([['print-sales', 380], ['design-gigs', 200], ['stock-dividend', 110], ['song-royalty', 140], ['garage-rent', 90], ['ink-paper', 120], ['bus-pass', 60], ['printer', 900], ['laptop-loan', 700]]),
});
const cashMetKey = keyOf({ earned: ['print-sales', 'design-gigs'], passive: ['stock-dividend', 'song-royalty', 'garage-rent'], expenses: ['ink-paper', 'bus-pass'], assets: ['printer'], liabilities: ['laptop-loan'], goal: ['goal-met'] });

const swotPieces = ['fresh-recipe', 'loyal-regulars', 'cash-only', 'one-seller', 'school-fair', 'new-park', 'rainy-season', 'rival-stand'];
const swot = seg('grid-swot-stand', GRID, 'swot', swotPieces, { pieces: swotPieces });
const swotKey = keyOf({ strengths: swotPieces.slice(0, 2), weaknesses: swotPieces.slice(2, 4), opportunities: swotPieces.slice(4, 6), threats: swotPieces.slice(6, 8) });
const weekPieces = ['study-test', 'pay-supplier', 'plan-menu', 'learn-pricing', 'refill-cups', 'hand-flyers', 'scroll-videos', 'sort-stickers'];
const week = seg('grid-eisenhower-week', GRID, 'eisenhower', weekPieces, { pieces: weekPieces });
const weekKey = keyOf({ 'do-now': weekPieces.slice(0, 2), schedule: weekPieces.slice(2, 4), delegate: weekPieces.slice(4, 6), drop: weekPieces.slice(6, 8) });
const ideaPieces = ['new-sign', 'order-app', 'extra-napkins', 'second-cart', 'discount-card', 'rename-stand'];
const ideas = seg('grid-two-by-two-ideas', GRID, 'two-by-two', [...ideaPieces, ...AXES], { pieces: ideaPieces, points: [[2, 8], [9, 9], [3, 2], [8, 3], [4, 7], [7, 2]] });
const ideasKey = keyOf({ 'top-left': ['new-sign', 'discount-card'], 'top-right': ['order-app'], 'bottom-left': ['extra-napkins'], 'bottom-right': ['second-cart', 'rename-stand'] });
const spotPieces = ['market-corner', 'library-steps', 'bus-stop'];
const spot = seg('grid-decision-spot', GRID, 'decision-matrix', [...spotPieces, 'foot-traffic', 'low-rent', 'shade'], {
  pieces: spotPieces,
  criteria: [{ id: 'foot-traffic', weight: 5 }, { id: 'low-rent', weight: 3 }, { id: 'shade', weight: 2 }],
  scores: [[5, 3, 1], [2, 4, 5], [4, 2, 4]],
});
const spotKey = keyOf({ 'rank-1': ['market-corner'], 'rank-2': ['bus-stop'], 'rank-3': ['library-steps'] });
const canvasPieces = ['fruit-farm', 'squeeze-juice', 'cart-cooler', 'fresh-cold', 'stamp-card', 'street-corner', 'fair-table', 'students-parents', 'lemons-sugar', 'cup-sales'];
const canvas = seg('grid-canvas-lemonade', GRID, 'business-canvas', canvasPieces, { pieces: canvasPieces });
const canvasKey = keyOf({ partners: ['fruit-farm'], activities: ['squeeze-juice'], resources: ['cart-cooler'], value: ['fresh-cold'], relationships: ['stamp-card'], channels: ['street-corner', 'fair-table'], segments: ['students-parents'], costs: ['lemons-sugar'], revenue: ['cup-sales'] });

const ganttTasks = [
  { id: 'design-menu', after: [], duration: 2 }, { id: 'print-menu', after: ['design-menu'], duration: 1 }, { id: 'shop-lemons', after: [], duration: 1 },
  { id: 'squeeze-juice', after: ['shop-lemons'], duration: 2 }, { id: 'open-stand', after: ['print-menu', 'squeeze-juice'], duration: 1 }, { id: 'make-sign', after: [], duration: 1 },
];
const gantt = seg('plan-gantt-opening', PLAN, 'gantt', ganttTasks.map((task) => task.id), { tasks: ganttTasks, periods: 5, workers: 2 });
const ganttKey = keyOf({ 'period-1': ['design-menu', 'shop-lemons'], 'period-2': ['squeeze-juice'], 'period-3': ['print-menu'], 'period-4': ['open-stand', 'make-sign'] });
const kanbanTasks = [
  { id: 'design-menu', after: [] }, { id: 'buy-cups', after: [] }, { id: 'print-menu', after: ['design-menu'] }, { id: 'buy-lemons', after: [] },
  { id: 'set-tables', after: ['buy-cups', 'print-menu'] }, { id: 'open-stand', after: ['buy-lemons', 'set-tables'] },
];
const kanban = seg('plan-kanban-opening', PLAN, 'kanban', kanbanTasks.map((task) => task.id), { tasks: kanbanTasks, done: ['design-menu', 'buy-cups'], limit: 2 });
const kanbanKey = keyOf({ doing: ['print-menu', 'buy-lemons'], todo: ['set-tables', 'open-stand'] });
const lineTasks = [
  { id: 'buy-lemons', after: [] }, { id: 'make-juice', after: ['buy-lemons'] }, { id: 'set-price', after: [] }, { id: 'make-sign', after: ['set-price'], due: 3 },
  { id: 'open-stand', after: ['make-juice', 'make-sign'], due: 5 }, { id: 'count-cash', after: ['open-stand'] },
];
const timeline = seg('plan-timeline-opening', PLAN, 'timeline', lineTasks.map((task) => task.id), { tasks: lineTasks });
const timelineKey = keyOf({ 'step-1': ['buy-lemons'], 'step-2': ['set-price'], 'step-3': ['make-sign'], 'step-4': ['make-juice'], 'step-5': ['open-stand'], 'step-6': ['count-cash'] });

const fixtures: Array<[Seg, unknown, string]> = [
  [cashShort, cashShortKey, '13-17'], [cashMet, cashMetKey, '13-17'], [swot, swotKey, '13-17'], [week, weekKey, '10-12'], [ideas, ideasKey, '13-17'],
  [spot, spotKey, '13-17'], [canvas, canvasKey, '13-17'], [gantt, ganttKey, '13-17'], [kanban, kanbanKey, '13-17'], [timeline, timelineKey, '10-12'],
];

const lateSign = { 'period-1': ['design-menu', 'shop-lemons'], 'period-2': ['squeeze-juice'], 'period-3': ['print-menu'], 'period-4': ['open-stand'], 'period-5': ['make-sign'] };
const signFirst = { 'step-1': ['set-price'], 'step-2': ['make-sign'], 'step-3': ['buy-lemons'], 'step-4': ['make-juice'], 'step-5': ['open-stand'], 'step-6': ['count-cash'] };

const one = (segment: Seg, band = '13-17'): Doc => ({ age_band: band, segments: [segment] });
const patch = (segment: Seg, change: Record<string, unknown>): Seg => ({ ...segment, payload: { ...segment.payload, ...change } });
const gates = (segment: Seg, key?: unknown, band?: string) => horizontePieceGates(one(segment, band), key === undefined ? undefined : { [segment.id]: key });
const first = (segment: Seg, key?: unknown, band?: string) => gates(segment, key, band)[0]?.message ?? '';
const solve = (segment: Seg, key?: unknown, nodeBudget?: number) =>
  runSolvabilityGate(one(segment), key === undefined ? undefined : { [segment.id]: key }, nodeBudget === undefined ? {} : { nodeBudget });
const codes = (segment: Seg, key?: unknown, nodeBudget?: number) => solve(segment, key, nodeBudget).map((finding) => finding.code);

describe('fin2 pack in the Forge (F2.13, F2.14, F2.15)', () => {
  it('declares the capability literal, spreads it into the emitter map and registers one checker per type', () => {
    for (const type of [CASH, GRID, PLAN] as const) {
      expect(HORIZONTE_FORGE_CAPABILITIES[type]).toEqual(FIN2_CAPABILITIES[type]);
      expect((V2_SEGMENT_CAPABILITIES as Record<string, readonly string[]>)[type]).toEqual(FIN2_CAPABILITIES[type]);
      expect(registeredSolvabilityTypes()).toContain(type);
    }
    expect(FIN2_CAPABILITIES[GRID]).toEqual(['visual.decision-grid.v1', 'operation.drag-chips.v1', 'operation.tap-place.v1']);
    expect(HORIZONTE_FORGE_PACKS).toContain(fin2);
  });

  it('adds authoring guidance only for the types a skeleton uses', () => {
    expect(horizonteGuidanceFor([CASH]).join('\n')).toMatch(/ages 13-17.*goal-met only when the passive total is greater than the expenses total/s);
    expect(horizonteGuidanceFor([GRID]).join('\n')).toMatch(/never 5.*no two weighted totals equal/s);
    expect(horizonteGuidanceFor([PLAN]).join('\n')).toMatch(/gantt.*kanban.*timeline/s);
    expect(horizonteGuidanceFor([GRID]).join('\n')).not.toMatch(/passive total/);
    expect(horizonteGuidanceFor(['text.note.v2'])).toEqual([]);
  });

  describe('gate 4', () => {
    it('accepts every authored example with its key and without one, in its own age band', () => {
      for (const [segment, key, band] of fixtures) {
        expect(gates(segment, key, band)).toEqual([]);
        expect(gates(segment, undefined, band)).toEqual([]);
        expect(gates(segment, undefined, 'adult')).toEqual([]);
      }
    });

    it('keeps the age scope of each kind', () => {
      expect(first(cashShort, undefined, '10-12')).toMatch(/age band 13-17, adult, not 10-12/);
      expect(first(cashShort, undefined, '6-9')).toMatch(/not 6-9/);
      expect(first(swot, undefined, '6-9')).toMatch(/age band 10-12, 13-17, adult, not 6-9/);
      expect(first(gantt, undefined, '6-9')).toMatch(/not 6-9/);
      expect(gates(gantt, undefined, '10-12')).toEqual([]);
    });

    it('refuses a visual that does not fit the type', () => {
      expect(first({ ...cashShort, visual: { type: 'swot' } })).toMatch(/must be statement-board/);
      expect(first({ ...swot, visual: { type: 'gantt' } })).toMatch(/swot, eisenhower, two-by-two, decision-matrix or business-canvas/);
      expect(first({ ...gantt, visual: { type: 'swot' } })).toMatch(/gantt, kanban or timeline/);
    });

    it('ignores the segments of other types', () => {
      expect(horizontePieceGates({ segments: [{ id: 'seg-x', type: 'text.note.v2', visual: { type: 'swot' }, payload: {} }] })).toEqual([]);
    });

    describe('cash flow', () => {
      it('refuses a malformed statement', () => {
        expect(first(patch(cashShort, { items: items([['a-job', 5], ['a-gig', 5], ['a-fee', 5], ['a-bill', 5]]) }))).toMatch(/5 to 12 items/);
        expect(first(patch(cashShort, { extra: 1 }))).toMatch(/holds only its items/);
        expect(first(patch(cashShort, { items: items([['weekend-job', 0], ['tutoring', 5], ['savings-interest', 5], ['stock-dividend', 5], ['phone-plan', 5]]) }))).toMatch(/whole amount/);
        expect(first(patch(cashShort, { items: items([['weekend-job', 5], ['tutoring', 5], ['savings-interest', 5], ['stock-dividend', 5], ['goal-met', 5]]) }))).toMatch(/never a goal token/);
        expect(first(patch(cashShort, { items: items([['weekend-job', 5], ['tutoring', 5], ['savings-interest', 5], ['stock-dividend', 5], ['tutoring', 5]]) }))).toMatch(/unique/);
        expect(first({ ...cashShort, labels: { 'weekend-job': 'Job' } })).toMatch(/Labels name every item/);
      });

      it('refuses a key that is not a whole statement or names the wrong goal token', () => {
        expect(first(cashShort, keyOf({ earned: ['weekend-job'] }))).toMatch(/every item on exactly one line/);
        expect(first(cashMet, keyOf({ ...cashMetKey.solutions[0]!, goal: ['goal-short'] }))).toMatch(/goal token its own totals give/);
        expect(first(cashShort, keyOf({ ...cashShortKey.solutions[0]!, goal: ['goal-met'] }))).toMatch(/goal token its own totals give/);
        expect(first(cashShort, keyOf({ ...cashShortKey.solutions[0]!, goal: ['goal-met', 'goal-short'] }))).toMatch(/within its capacity/);
        expect(first(cashShort, { solutions: [] })).toMatch(/one to eight arrangements/);
        expect(first(cashShort, { solutions: cashShortKey.solutions, extra: 1 })).toMatch(/one to eight arrangements/);
        expect(first(cashShort, keyOf({ ...cashShortKey.solutions[0]!, vault: ['savings'] }))).toMatch(/slot this board does not have/);
        expect(first(cashShort, keyOf({ ...cashShortKey.solutions[0]!, assets: ['savings', 'savings'] }))).toMatch(/places each piece once|every item on exactly one line/);
      });

      it('treats equal totals as short of the goal', () => {
        const tie = seg('cash-flow-tie', CASH, 'statement-board', ['pay-a', 'pay-b', 'gift-a', 'bill-a', 'bill-b'], { items: items([['pay-a', 100], ['pay-b', 50], ['gift-a', 80], ['bill-a', 50], ['bill-b', 30]]) });
        const place = (goal: string) => keyOf({ earned: ['pay-a', 'pay-b'], passive: ['gift-a'], expenses: ['bill-a', 'bill-b'], goal: [goal] });
        expect(gates(tie, place('goal-short'))).toEqual([]);
        expect(first(tie, place('goal-met'))).toMatch(/goal token/);
      });
    });

    describe('decision grid', () => {
      it('refuses malformed grids of every visual', () => {
        expect(first(patch(swot, { pieces: swotPieces.slice(0, 3) }))).toMatch(/4 to 16 unique pieces/);
        expect(first(patch(swot, { points: [] }))).toMatch(/carries only its pieces/);
        expect(first(patch(ideas, { points: [[2, 8], [9, 9], [3, 2]] }))).toMatch(/one point per piece/);
        expect(first(patch(ideas, { points: [[2, 8], [9, 9], [3, 2], [8, 3], [5, 7], [7, 2]] }))).toMatch(/never 5/);
        expect(first(patch(ideas, { points: [[2, 8], [9, 9], [3, 2], [8, 3], [4, 10], [7, 2]] }))).toMatch(/1 to 9/);
        expect(first(patch(spot, { scores: [[5, 3, 1], [2, 4, 5], [4, 2, 6]] }))).toMatch(/1 to 5 for every option/);
        expect(first(patch(spot, { criteria: [{ id: 'foot-traffic', weight: 5 }] }))).toMatch(/2 to 4 criteria/);
        expect(first(patch(spot, { criteria: [{ id: 'foot-traffic', weight: 9 }, { id: 'low-rent', weight: 3 }, { id: 'shade', weight: 2 }] }))).toMatch(/weight from 1 to 5/);
        expect(first(patch(spot, { criteria: [{ id: 'bus-stop', weight: 5 }, { id: 'low-rent', weight: 3 }, { id: 'shade', weight: 2 }] }))).toMatch(/all different/);
        expect(first(patch(spot, { scores: [[5, 3, 1], [3, 3, 5], [4, 2, 4]] }))).toMatch(/Weighted totals must all differ/);
        expect(first(patch(canvas, { pieces: canvasPieces.slice(0, 4) }))).toMatch(/5 to 16 unique pieces/);
      });

      it('wants a label for every piece, criterion and axis', () => {
        expect(first({ ...ideas, labels: named(ideaPieces) })).toMatch(/Labels name every piece, criterion and axis/);
        expect(first({ ...spot, labels: named(spotPieces) })).toMatch(/Labels name every piece, criterion and axis/);
        expect(first({ ...swot, labels: { ...named(swotPieces), extra: 'Extra' } })).toMatch(/Labels name every piece/);
      });

      it('refuses a key that misses a piece or contradicts a computed grid', () => {
        expect(first(swot, keyOf({ strengths: swotPieces.slice(0, 2) }))).toMatch(/every piece exactly once/);
        expect(first(ideas, keyOf({ ...ideasKey.solutions[0]!, 'top-left': ['new-sign'], 'top-right': ['order-app', 'discount-card'] }))).toMatch(/computed grid has one solution/);
        expect(first(spot, keyOf({ 'rank-1': ['market-corner'], 'rank-2': ['library-steps'], 'rank-3': ['bus-stop'] }))).toMatch(/computed grid has one solution/);
        expect(first(spot, keyOf({ 'rank-1': ['market-corner', 'bus-stop'], 'rank-2': ['library-steps'] }))).toMatch(/within its capacity/);
        expect(first(swot, keyOf({ strengths: ['not-a-piece'] }))).toMatch(/piece this board does not have/);
        expect(gates(swot, { solutions: [swotKey.solutions[0], { ...swotKey.solutions[0], strengths: [swotPieces[1]], weaknesses: [swotPieces[0], ...swotPieces.slice(2, 4)] }] })).toEqual([]);
      });
    });

    describe('schedule board', () => {
      it('refuses malformed plans of every visual', () => {
        expect(first(patch(gantt, { tasks: ganttTasks.slice(0, 2) }))).toMatch(/3 to 10 tasks/);
        expect(first(patch(gantt, { tasks: [{ id: 'design-menu', after: ['print-menu'], duration: 2 }, ...ganttTasks.slice(1)] }))).toMatch(/cycle/);
        expect(first(patch(gantt, { tasks: [...ganttTasks.slice(0, 5), { id: 'make-sign', after: ['no-such-task'], duration: 1 }] }))).toMatch(/other tasks of this schedule/);
        expect(first(patch(gantt, { tasks: [{ ...ganttTasks[0]!, duration: 5 }, ...ganttTasks.slice(1)] }))).toMatch(/duration is a whole number of periods from 1 to 4/);
        expect(first(patch(gantt, { tasks: [{ ...ganttTasks[0]!, due: 3 }, ...ganttTasks.slice(1)] }))).toMatch(/never due steps/);
        expect(first(patch(gantt, { periods: 3 }))).toMatch(/longest chain/);
        expect(first(patch(gantt, { workers: 4 }))).toMatch(/optionally 1 to 3 workers/);
        expect(first(patch(gantt, { done: ['design-menu'] }))).toMatch(/never due steps, done or a limit/);
        expect(first(patch(timeline, { periods: 5 }))).toMatch(/no durations, periods or workers/);
        expect(first(patch(timeline, { tasks: [{ id: 'buy-lemons', after: [], due: 7 }, ...lineTasks.slice(1)] }))).toMatch(/due step is within the number of tasks/);
        expect(first(patch(timeline, { limit: 2 }))).toMatch(/no done list or limit/);
        expect(first(patch(kanban, { done: ['design-menu', 'buy-cups', 'print-menu', 'buy-lemons', 'set-tables'] }))).toMatch(/lists what is done and a work-in-progress limit/);
        expect(first(patch(kanban, { limit: 1 }))).toMatch(/limit holds every task that can start now/);
        expect(first(patch(kanban, { tasks: [{ id: 'task-one', after: [] }, { id: 'task-two', after: [] }, { id: 'task-three', after: [] }], done: ['task-one'], limit: 2 }))).toMatch(/still blocked/);
        expect(first(patch(kanban, { done: ['print-menu', 'buy-cups'] }))).toMatch(/only need done tasks/);
        expect(first(patch(kanban, { limit: 9 }))).toMatch(/lists what is done/);
        expect(first({ ...gantt, labels: { 'design-menu': 'Menu' } })).toMatch(/Labels name every task/);
      });

      it('refuses a key that does not keep the plan rules', () => {
        expect(first(gantt, keyOf({ 'period-1': ['design-menu', 'shop-lemons', 'print-menu'] }))).toMatch(/complete schedule that meets the rules/);
        expect(first(gantt, keyOf({ 'period-1': ['design-menu', 'shop-lemons', 'make-sign'], 'period-2': ['squeeze-juice'], 'period-3': ['print-menu'], 'period-4': ['open-stand'] }))).toMatch(/complete schedule that meets the rules/);
        expect(first(gantt, keyOf({ 'period-1': ['design-menu', 'shop-lemons'], 'period-2': ['squeeze-juice'], 'period-3': ['print-menu'], 'period-4': ['open-stand', 'make-sign'], 'period-9': ['make-sign'] }))).toMatch(/slot this board does not have/);
        expect(first(timeline, keyOf({ ...timelineKey.solutions[0]!, 'step-3': ['make-juice'], 'step-4': ['make-sign'] }))).toMatch(/complete schedule that meets the rules/);
        expect(first(timeline, keyOf({ 'step-1': ['buy-lemons', 'set-price'] }))).toMatch(/within its capacity/);
        expect(first(kanban, keyOf({ doing: ['print-menu'], todo: ['buy-lemons', 'set-tables', 'open-stand'] }))).toMatch(/one solution: the key must equal it/);
        expect(first(kanban, keyOf({ doing: ['print-menu', 'buy-lemons', 'set-tables'], todo: ['open-stand'] }))).toMatch(/within its capacity/);
      });

      it('accepts several valid schedules in one key and a due-free timeline', () => {
        expect(gates(gantt, keyOf(ganttKey.solutions[0]!, lateSign))).toEqual([]);
        expect(gates(patch(timeline, { tasks: lineTasks.map(({ id, after }) => ({ id, after })) }), timelineKey)).toEqual([]);
      });
    });
  });

  describe('solvability checkers', () => {
    it('prove every authored example with its key and without one', () => {
      for (const [segment, key] of fixtures) {
        expect(solve(segment, key)).toEqual([]);
        expect(solve(segment)).toEqual([]);
      }
    });

    it('lets the gantt and the timeline name many valid schedules', () => {
      expect(solve(gantt, keyOf(ganttKey.solutions[0]!, lateSign))).toEqual([]);
      expect(solve(timeline, keyOf(timelineKey.solutions[0]!, signFirst))).toEqual([]);
    });

    it('names a statement payload or key that cannot be solved', () => {
      expect(codes(patch(cashShort, { items: items([['a-job', 5], ['a-gig', 5]]) }))).toEqual(['impossible-state']);
      expect(codes(patch(cashShort, { items: items([['a-job', 5], ['a-gig', 5], ['a-fee', 5], ['a-bill', 5], ['a-job', 5]]) }))).toEqual(['duplicate-id']);
      expect(codes(cashShort, keyOf({ ...cashShortKey.solutions[0]!, goal: ['goal-met'] }))).toEqual(['impossible-state']);
      expect(codes(cashShort, keyOf({ ...cashShortKey.solutions[0]!, vault: ['savings'] }))).toEqual(['impossible-state']);
      expect(solve(cashShort, cashMetKey)[0]?.message).toMatch(/solvability\/impossible-state: cash flow cash-flow-short/);
    });

    it('names a two-by-two key that is not the quadrant its points fall in', () => {
      const wrong = keyOf({ ...ideasKey.solutions[0]!, 'top-left': ['new-sign'], 'top-right': ['order-app', 'discount-card'] });
      expect(codes(ideas, wrong)).toEqual(['rubric-gap', 'rubric-accepts-invalid']);
      expect(codes(ideas, keyOf(ideasKey.solutions[0]!, wrong.solutions[0]!))).toEqual(['rubric-accepts-invalid']);
      expect(codes(patch(ideas, { points: [[2, 8], [9, 9], [3, 2], [8, 3], [4, 7], [7, 5]] }))).toEqual(['impossible-state']);
    });

    it('flags two points on one spot for review without blocking', () => {
      const same = patch(ideas, { points: [[2, 8], [9, 9], [3, 2], [8, 3], [2, 8], [7, 2]] });
      const found = solve(same, ideasKey);
      expect(found.map((finding) => [finding.code, finding.severity])).toEqual([['overlap', 'review']]);
    });

    it('names a decision matrix whose totals tie as ambiguous, and a key that covers only one order', () => {
      const tied = patch(spot, { scores: [[5, 3, 1], [3, 3, 5], [4, 2, 4]] });
      expect(codes(tied)).toEqual(['ambiguous-solution']);
      expect(codes(tied, spotKey)).toEqual(['rubric-gap']);
      const both = keyOf(spotKey.solutions[0]!, { 'rank-1': ['market-corner'], 'rank-2': ['library-steps'], 'rank-3': ['bus-stop'] });
      expect(codes(tied, both)).toEqual([]);
      expect(codes(spot, keyOf({ 'rank-1': ['bus-stop'], 'rank-2': ['market-corner'], 'rank-3': ['library-steps'] }))).toEqual(['rubric-gap', 'rubric-accepts-invalid']);
    });

    it('names a key that does not place the authored pieces on a SWOT, Eisenhower or canvas grid', () => {
      expect(codes(swot, keyOf({ strengths: swotPieces.slice(0, 2) }))).toEqual(['impossible-state']);
      expect(codes(canvas, keyOf({ partners: ['no-such-piece'] }))).toEqual(['impossible-state']);
      expect(codes(swot, { solutions: [{ vault: ['fresh-recipe'] }] })).toEqual(['impossible-state']);
      expect(codes(patch(week, { pieces: weekPieces.slice(0, 3) }))).toEqual(['impossible-state']);
      expect(codes(patch(swot, { pieces: [...swotPieces.slice(0, 7), 'fresh-recipe'] }))).toEqual(['duplicate-id']);
    });

    it('names a gantt no schedule can satisfy, and one whose key breaks the rules', () => {
      const crowded = patch(seg('plan-gantt-crowded', PLAN, 'gantt', ['mix-a', 'mix-b', 'mix-c'], {}), {
        tasks: [{ id: 'mix-a', after: [], duration: 2 }, { id: 'mix-b', after: [], duration: 2 }, { id: 'mix-c', after: [], duration: 2 }], periods: 5, workers: 1,
      });
      expect(codes(crowded)).toEqual(['no-solution']);
      expect(codes(patch(crowded, { workers: 2 }))).toEqual([]);
      expect(codes(gantt, keyOf({ 'period-1': ['design-menu', 'shop-lemons', 'print-menu'] }))).toEqual(['impossible-state']);
      expect(codes(gantt, keyOf({ 'period-1': ['design-menu', 'shop-lemons', 'make-sign'], 'period-2': ['squeeze-juice'], 'period-3': ['print-menu'], 'period-4': ['open-stand'] }))).toEqual(['impossible-state']);
    });

    it('names a timeline whose due steps cannot all be met', () => {
      const late = patch(seg('plan-timeline-late', PLAN, 'timeline', ['write-note', 'send-note', 'file-copy'], {}), {
        tasks: [{ id: 'write-note', after: [], due: 1 }, { id: 'send-note', after: [], due: 1 }, { id: 'file-copy', after: ['write-note'] }],
      });
      expect(codes(late)).toEqual(['no-solution']);
      expect(codes(timeline, keyOf({ ...timelineKey.solutions[0]!, 'step-3': ['make-juice'], 'step-4': ['make-sign'] }))).toEqual(['impossible-state']);
    });

    it('names a kanban whose key is not the one board', () => {
      const wrong = keyOf({ doing: ['print-menu'], todo: ['buy-lemons', 'set-tables', 'open-stand'] });
      expect(codes(kanban, wrong)).toEqual(['rubric-gap', 'rubric-accepts-invalid']);
      expect(codes(kanban, keyOf(kanbanKey.solutions[0]!, wrong.solutions[0]!))).toEqual(['rubric-accepts-invalid']);
    });

    it('names a prerequisite that does not exist and a task id used twice', () => {
      const dangling = patch(timeline, { tasks: [...lineTasks.slice(0, 5), { id: 'count-cash', after: ['open-stand', 'no-such-task'] }] });
      expect(codes(dangling)).toEqual(['dangling-reference']);
      const twice = patch(timeline, { tasks: [...lineTasks.slice(0, 5), { id: 'open-stand', after: ['make-juice'] }] });
      expect(codes(twice)).toEqual(['duplicate-id']);
      expect(codes(patch(timeline, { tasks: lineTasks.slice(0, 2) }))).toEqual(['impossible-state']);
    });

    it('never publishes a board it could not prove within the node budget', () => {
      expect(codes(gantt, undefined, 3)).toEqual(['budget-exceeded']);
      expect(codes(timeline, undefined, 3)).toEqual(['budget-exceeded']);
      expect(codes(spot, spotKey, 2)).toEqual(['budget-exceeded']);
      expect(solve(gantt, ganttKey, 3)[0]?.message).toMatch(/solvability\/budget-exceeded: schedule board plan-gantt-opening/);
    });
  });
});
