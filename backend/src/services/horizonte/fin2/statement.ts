import { exactKeys, isId, isRecord, isWhole, placedPieces, sameKeys, type Frame, type SlotMap } from './slots.js';

export const STATEMENT_LINES = ['earned', 'passive', 'expenses', 'assets', 'liabilities'] as const;
export const STATEMENT_GOAL_SLOT = 'goal';
export const GOAL_MET = 'goal-met';
export const GOAL_SHORT = 'goal-short';
export const STATEMENT_MIN_ITEMS = 5;
export const STATEMENT_MAX_ITEMS = 12;
export const STATEMENT_MAX_AMOUNT = 999_999;

export interface StatementItem { id: string; amount: number }
export interface StatementPayload { items: StatementItem[] }
export interface StatementTotals { earned: number; passive: number; expenses: number }

/** Returns the first rule the payload breaks, or null. Total on any input. */
export function statementProblem(payload: unknown): string | null {
  if (!exactKeys(payload, ['items']) || !Array.isArray(payload.items)) return 'A statement payload holds only its items';
  const items = payload.items as unknown[];
  if (items.length < STATEMENT_MIN_ITEMS || items.length > STATEMENT_MAX_ITEMS) return `A statement has ${STATEMENT_MIN_ITEMS} to ${STATEMENT_MAX_ITEMS} items`;
  const seen = new Set<string>();
  for (const item of items) {
    if (!exactKeys(item, ['id', 'amount']) || !isId(item.id) || !isWhole(item.amount, 1, STATEMENT_MAX_AMOUNT)) return 'Each item has an id and a whole amount per month';
    if (item.id === GOAL_MET || item.id === GOAL_SHORT || item.id === STATEMENT_GOAL_SLOT || seen.has(item.id)) return 'Item ids are unique and never a goal token';
    seen.add(item.id);
  }
  return null;
}

export const statementOf = (payload: unknown): StatementPayload | null => (statementProblem(payload) === null ? (payload as StatementPayload) : null);

export function statementFrame(payload: unknown): Frame | null {
  const statement = statementOf(payload);
  if (!statement) return null;
  const count = statement.items.length;
  return {
    pieceIds: [...statement.items.map((item) => item.id), GOAL_MET, GOAL_SHORT],
    slotIds: [...STATEMENT_LINES, STATEMENT_GOAL_SLOT],
    capacities: { ...Object.fromEntries(STATEMENT_LINES.map((line) => [line, count])), [STATEMENT_GOAL_SLOT]: 1 },
  };
}

/** Items go on a line and goal tokens on the goal slot; a token on a line, or an item on the goal, is a slip the board refuses. */
export const statementAccepts = (piece: string, slot: string): boolean => (piece === GOAL_MET || piece === GOAL_SHORT) === (slot === STATEMENT_GOAL_SLOT);

/** Monthly income and expense totals of a placement; assets and liabilities are values, not flows. */
export function statementTotals(slots: SlotMap, items: readonly StatementItem[]): StatementTotals {
  const amount = new Map(items.map((item) => [item.id, item.amount]));
  const sum = (line: string) => (slots[line] ?? []).reduce((total, id) => total + (amount.get(id) ?? 0), 0);
  return { earned: sum('earned'), passive: sum('passive'), expenses: sum('expenses') };
}

/** What is owned and what is owed: values on the balance sheet, never added to the monthly flows. */
export function statementHoldings(slots: SlotMap, items: readonly StatementItem[]): { assets: number; liabilities: number } {
  const amount = new Map(items.map((item) => [item.id, item.amount]));
  const sum = (line: string) => (slots[line] ?? []).reduce((total, id) => total + (amount.get(id) ?? 0), 0);
  return { assets: sum('assets'), liabilities: sum('liabilities') };
}

/** The goal: passive income is greater than expenses. */
export const goalReached = (totals: StatementTotals): boolean => totals.passive > totals.expenses;

export function statementLabelsProblem(payload: unknown, labels: unknown): string | null {
  const statement = statementOf(payload);
  return statement && isRecord(labels) && sameKeys(labels, statement.items.map((item) => item.id)) ? null : 'Labels name every item, and nothing else';
}

/** A key solution must place every item once and name the goal token its own totals give. */
export function statementKeyProblem(payload: unknown, solutions: readonly SlotMap[]): string | null {
  const statement = statementOf(payload);
  if (!statement) return 'The statement payload is malformed';
  const wanted = [...statement.items.map((item) => item.id)].sort();
  for (const solution of solutions) {
    const lines = Object.fromEntries(Object.entries(solution).filter(([slot]) => slot !== STATEMENT_GOAL_SLOT));
    const placed = placedPieces(lines).sort();
    if (placed.length !== wanted.length || placed.some((id, index) => id !== wanted[index])) return 'A solution places every item on exactly one line';
    const tokens = solution[STATEMENT_GOAL_SLOT] ?? [];
    const token = goalReached(statementTotals(solution, statement.items)) ? GOAL_MET : GOAL_SHORT;
    if (tokens.length !== 1 || tokens[0] !== token) return 'A solution names the goal token its own totals give';
  }
  return null;
}
