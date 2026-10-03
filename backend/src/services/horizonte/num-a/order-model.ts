import type { ArrangementContext, SlotMap } from '../../v2AnswerShapes.js';

export const ORDER_SCALES: readonly number[] = [0, 1, 2];
export const ORDER_MAX_UNITS = 100000;
export const ORDER_MIN_COUNT = 4;
export const ORDER_MAX_COUNT = 20;
export const ORDER_MIN_VALUES = 2;
export const ORDER_MAX_VALUES = 6;

const whole = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);
const record = (value: unknown): Record<string, unknown> | undefined => (typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined);

/** Every number is a whole count of the finest grid (3.47 is 347 at scale 2); marks sit `step` grid units apart from `low`. */
export interface OrderSetup { scale: number; low: number; step: number; count: number; values: readonly number[] }

export const orderMarkUnits = (setup: OrderSetup, index: number): number => setup.low + index * setup.step;

/** The public setup of an ordering line: a window of `count` equal gaps and two to six numbers that each sit on a mark. */
export function orderSetup(payload: unknown): OrderSetup | undefined {
  const value = record(payload);
  if (!value || !whole(value.scale) || !ORDER_SCALES.includes(value.scale) || !whole(value.low) || !whole(value.step) || !whole(value.count) || !Array.isArray(value.values)) return undefined;
  if (value.low < 0 || value.step < 1 || value.count < ORDER_MIN_COUNT || value.count > ORDER_MAX_COUNT || value.low + value.count * value.step > ORDER_MAX_UNITS) return undefined;
  const low = value.low;
  const step = value.step;
  const count = value.count;
  const values = value.values;
  if (values.length < ORDER_MIN_VALUES || values.length > ORDER_MAX_VALUES || new Set(values).size !== values.length) return undefined;
  if (!values.every((entry) => whole(entry) && entry >= low && entry <= low + count * step && (entry - low) % step === 0)) return undefined;
  return { scale: value.scale, low, step, count, values: values as number[] };
}

export const orderPieceId = (units: number): string => `n-${units}`;
export const orderSlotId = (index: number): string => `m-${index}`;

export const orderContext = (setup: OrderSetup): ArrangementContext => ({
  pieceIds: setup.values.map(orderPieceId),
  slotIds: Array.from({ length: setup.count + 1 }, (_, index) => orderSlotId(index)),
});

/** Where each given number belongs: the mark that holds exactly that value. */
export const orderTruth = (setup: OrderSetup): SlotMap =>
  Object.fromEntries(setup.values.map((units) => [orderSlotId((units - setup.low) / setup.step), [orderPieceId(units)]]));

/** A key is sound only when it is the one arrangement the numbers force; a key that disagrees with the line is a malformed key. */
export function orderKeyProblem(setup: OrderSetup, solutions: unknown): string | null {
  if (!Array.isArray(solutions) || solutions.length !== 1) return 'exactly one solution';
  const given = record(solutions[0]);
  const truth = orderTruth(setup);
  if (!given || Object.keys(given).length !== Object.keys(truth).length) return 'a mark per number';
  const agrees = Object.entries(truth).every(([slot, pieces]) => { const placed = given[slot]; return Array.isArray(placed) && placed.length === 1 && placed[0] === pieces[0]; });
  return agrees ? null : 'a number off its mark';
}

/** Nothing placed yet: the board's start state, never a score. */
export function orderUntouched(setup: OrderSetup, response: unknown): boolean {
  const value = record(response);
  const slots = value ? record(value.slots) : undefined;
  if (!value || Object.keys(value).join() !== 'slots' || !slots) return false;
  const known = orderContext(setup).slotIds;
  return Object.entries(slots).every(([slot, pieces]) => known.includes(slot) && Array.isArray(pieces) && pieces.length === 0);
}

/** The learner's state: each placed number (in grid units) and the index of the mark it sits on. */
export type OrderPlacement = Readonly<Record<number, number>>;

export const orderResponse = (placement: OrderPlacement): { slots: SlotMap } =>
  ({ slots: Object.fromEntries(Object.entries(placement).map(([units, mark]) => [orderSlotId(mark), [orderPieceId(Number(units))]])) });

export const orderOccupant = (placement: OrderPlacement, mark: number): number | undefined => {
  const found = Object.entries(placement).find(([, at]) => at === mark);
  return found === undefined ? undefined : Number(found[0]);
};

/** Put a number on a mark. A number already there swaps places with it, or goes back to the tray when this one came from the tray. */
export function orderPlace(placement: OrderPlacement, units: number, mark: number): OrderPlacement {
  const next: Record<number, number> = { ...placement };
  const occupant = orderOccupant(placement, mark);
  if (occupant !== undefined && occupant !== units) {
    if (placement[units] === undefined) delete next[occupant];
    else next[occupant] = placement[units]!;
  }
  next[units] = mark;
  return next;
}

export function orderRemove(placement: OrderPlacement, units: number): OrderPlacement {
  const next: Record<number, number> = { ...placement };
  delete next[units];
  return next;
}

/** Marks that carry a printed label: both ends, and the middle when the gaps split evenly. */
export const orderLabelled = (setup: OrderSetup, index: number): boolean => index === 0 || index === setup.count || (setup.count % 2 === 0 && index === setup.count / 2);
