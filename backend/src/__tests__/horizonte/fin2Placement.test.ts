import { describe, expect, it } from 'vitest';
import { FIN2_FIXTURES } from '../../services/horizonte/fin2/fixtures.js';
import { answerOf, canPlace, locate, placePiece, sameSlots, startSlots, TRAY, unplaced } from '../../services/horizonte/fin2/placement.js';
import { scheduleFrame } from '../../services/horizonte/fin2/schedule.js';
import { statementAccepts, statementFrame } from '../../services/horizonte/fin2/statement.js';
import type { Frame } from '../../services/horizonte/fin2/slots.js';
import { gridFrame } from '../../services/horizonte/fin2/matrix.js';

const segment = (id: string) => FIN2_FIXTURES.find((item) => item.id === id)!.segment('en-US') as { visual: { type: string }; payload: unknown };
const frame: Frame = { pieceIds: ['aaa', 'bbb', 'ccc'], slotIds: ['one', 'two', 'solo'], capacities: { one: 2, two: 2, solo: 1 } };

describe('fin2 placement model', () => {
  it('moves a piece into a slot and back to the tray', () => {
    const placed = placePiece(frame, {}, 'aaa', 'one');
    expect(placed).toEqual({ one: ['aaa'] });
    expect(locate(placed, 'aaa')).toBe('one');
    expect(unplaced(frame, placed)).toEqual(['bbb', 'ccc']);
    expect(placePiece(frame, placed, 'aaa', TRAY)).toEqual({});
    expect(placePiece(frame, placed, 'aaa', 'two')).toEqual({ two: ['aaa'] });
  });

  it('leaves the same object when the move is not allowed', () => {
    const placed = { one: ['aaa', 'bbb'] };
    expect(placePiece(frame, placed, 'ccc', 'one')).toBe(placed);
    expect(placePiece(frame, placed, 'aaa', 'one')).toBe(placed);
    expect(placePiece(frame, placed, 'ghost', 'two')).toBe(placed);
    expect(placePiece(frame, placed, 'ccc', 'nowhere')).toBe(placed);
    expect(placePiece(frame, placed, 'ccc', TRAY)).toBe(placed);
    expect(canPlace(frame, placed, 'ccc', 'two')).toBe(true);
    expect(canPlace(frame, placed, 'ccc', 'one')).toBe(false);
  });

  it('swaps with the occupant of a full one-piece slot, from the tray or from another slot', () => {
    const fromTray = placePiece(frame, { solo: ['aaa'] }, 'bbb', 'solo');
    expect(fromTray).toEqual({ solo: ['bbb'] });
    const fromSlot = placePiece(frame, { solo: ['aaa'], one: ['bbb'] }, 'bbb', 'solo');
    expect(fromSlot).toEqual({ solo: ['bbb'], one: ['aaa'] });
  });

  it('refuses a piece a slot does not accept, including the swap back', () => {
    const only = (piece: string, slot: string) => !(piece === 'aaa' && slot === 'two');
    expect(placePiece(frame, {}, 'aaa', 'two', only)).toEqual({});
    expect(placePiece(frame, {}, 'bbb', 'two', only)).toEqual({ two: ['bbb'] });
    const swapped = { solo: ['aaa'], one: ['bbb'] };
    expect(placePiece(frame, swapped, 'bbb', 'solo', (piece, slot) => !(piece === 'aaa' && slot === 'one'))).toBe(swapped);
  });

  it('answers with non-empty slots only and compares placements as sets', () => {
    expect(answerOf({ one: ['aaa'], two: [] })).toEqual({ slots: { one: ['aaa'] } });
    expect(sameSlots({ one: ['aaa', 'bbb'] }, { one: ['bbb', 'aaa'], two: [] })).toBe(true);
    expect(sameSlots({ one: ['aaa'] }, { two: ['aaa'] })).toBe(false);
  });

  it('starts a kanban with every movable task waiting and every other board empty', () => {
    const kanban = segment('plan-kanban-opening');
    expect(startSlots('kanban', kanban.payload)).toEqual({ todo: ['print-menu', 'buy-lemons', 'set-tables', 'open-stand'] });
    expect(startSlots('gantt', segment('plan-gantt-opening').payload)).toEqual({});
    expect(startSlots('kanban', { tasks: [] })).toEqual({});
    expect(unplaced(scheduleFrame('kanban', kanban.payload)!, startSlots('kanban', kanban.payload))).toEqual([]);
  });

  it('keeps goal tokens on the goal slot and items on the lines', () => {
    const statement = segment('cash-flow-short');
    const lines = statementFrame(statement.payload)!;
    expect(placePiece(lines, {}, 'goal-met', 'earned', statementAccepts)).toEqual({});
    expect(placePiece(lines, {}, 'snacks', 'goal', statementAccepts)).toEqual({});
    expect(placePiece(lines, {}, 'goal-met', 'goal', statementAccepts)).toEqual({ goal: ['goal-met'] });
    expect(placePiece(lines, { goal: ['goal-met'] }, 'goal-short', 'goal', statementAccepts)).toEqual({ goal: ['goal-short'] });
  });

  it('ranks by swapping in a decision matrix', () => {
    const grid = segment('grid-decision-spot');
    const ranks = gridFrame(grid.visual.type, grid.payload)!;
    const first = placePiece(ranks, {}, 'bus-stop', 'rank-1');
    const second = placePiece(ranks, first, 'market-corner', 'rank-1');
    expect(second).toEqual({ 'rank-1': ['market-corner'] });
    const both = placePiece(ranks, placePiece(ranks, {}, 'market-corner', 'rank-1'), 'bus-stop', 'rank-2');
    expect(placePiece(ranks, both, 'bus-stop', 'rank-1')).toEqual({ 'rank-1': ['bus-stop'], 'rank-2': ['market-corner'] });
  });
});
