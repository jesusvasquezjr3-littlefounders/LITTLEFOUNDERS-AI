export const ARRAY_MAX_SIDE = 10;
export const AREA_ACROSS_MIN = 11;
export const AREA_SIDE_MAX = 99;
export const AREA_DOWN_MIN = 2;
export const DIVISOR_MIN = 2;
export const DIVISOR_MAX = 12;
export const QUOTIENT_MIN = 2;
export const QUOTIENT_MAX = 99;

export type ArrayPayload = { rows: number; columns: number };
export type AreaModelPayload = { across: number; down: number };
export type AreaDivisionPayload = { dividend: number; divisor: number };
export type ArrayAreaKind = 'array' | 'area-model' | 'area-division';

const whole = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);
const between = (value: unknown, low: number, high: number): value is number => whole(value) && value >= low && value <= high;
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const keysAre = (value: Record<string, unknown>, ...keys: string[]): boolean => Object.keys(value).sort().join() === [...keys].sort().join();

export function isArrayPayload(value: unknown): value is ArrayPayload {
  return record(value) && keysAre(value, 'rows', 'columns') && between(value.rows, 1, ARRAY_MAX_SIDE) && between(value.columns, 1, ARRAY_MAX_SIDE);
}

export function isAreaModelPayload(value: unknown): value is AreaModelPayload {
  return record(value) && keysAre(value, 'across', 'down') && between(value.across, AREA_ACROSS_MIN, AREA_SIDE_MAX) && between(value.down, AREA_DOWN_MIN, AREA_SIDE_MAX);
}

/** The dividend divides exactly: the unknown side of the missing-area rectangle is a whole number of 2 to 99. */
export function isAreaDivisionPayload(value: unknown): value is AreaDivisionPayload {
  return record(value) && keysAre(value, 'dividend', 'divisor') && between(value.divisor, DIVISOR_MIN, DIVISOR_MAX)
    && between(value.dividend, DIVISOR_MIN * QUOTIENT_MIN, DIVISOR_MAX * QUOTIENT_MAX)
    && value.dividend % value.divisor === 0 && between(value.dividend / value.divisor, QUOTIENT_MIN, QUOTIENT_MAX);
}

export function arrayAreaKind(payload: unknown): ArrayAreaKind | null {
  if (isArrayPayload(payload)) return 'array';
  if (isAreaModelPayload(payload)) return 'area-model';
  return isAreaDivisionPayload(payload) ? 'area-division' : null;
}

/** The answer the public numbers determine: the total of the array, the area, or the missing side. */
export function arrayAreaAnswer(payload: unknown): number | null {
  const kind = arrayAreaKind(payload);
  if (kind === 'array') return (payload as ArrayPayload).rows * (payload as ArrayPayload).columns;
  if (kind === 'area-model') return (payload as AreaModelPayload).across * (payload as AreaModelPayload).down;
  return kind === 'area-division' ? (payload as AreaDivisionPayload).dividend / (payload as AreaDivisionPayload).divisor : null;
}

export const areaQuotient = (payload: AreaDivisionPayload): number => payload.dividend / payload.divisor;

/** A typed whole number as the boards submit it (no sign, no leading zero, at most seven digits): its value, "blank" while empty, null when malformed. */
export function readWholeText(text: unknown): number | 'blank' | null {
  if (typeof text !== 'string') return null;
  if (text === '') return 'blank';
  return /^(0|[1-9]\d{0,6})$/.test(text) ? Number(text) : null;
}

export type ArrayAreaStanding = 'invalid' | 'incomplete' | 'wrong' | 'right';

const textPair = (value: unknown): value is [string, string] => Array.isArray(value) && value.length === 2 && value.every((item) => readWholeText(item) !== null);
const blank = (text: string): boolean => text === '';

/** Where an array response stands: the typed total. */
export function standArray(payload: ArrayPayload, response: unknown): ArrayAreaStanding {
  if (!record(response) || !keysAre(response, 'value')) return 'invalid';
  const value = readWholeText(response.value);
  if (value === null) return 'invalid';
  if (value === 'blank') return 'incomplete';
  return value === payload.rows * payload.columns ? 'right' : 'wrong';
}

/**
 * Where a multiplication-box response stands: the learner splits the across side at `split` (0 until it is set), then types
 * the two partial products and the total. Any split from 1 to across-1 is a sound use of the distributive property.
 */
export function standAreaModel(payload: AreaModelPayload, response: unknown): ArrayAreaStanding {
  if (!record(response) || !keysAre(response, 'split', 'partials', 'value')) return 'invalid';
  const { split, partials, value } = response;
  if (!between(split, 0, payload.across - 1) || !textPair(partials)) return 'invalid';
  const total = readWholeText(value);
  if (total === null) return 'invalid';
  if (split === 0 || partials.some(blank) || total === 'blank') return 'incomplete';
  const [first, second] = partials.map(Number) as [number, number];
  return first === split * payload.down && second === (payload.across - split) * payload.down && total === payload.across * payload.down ? 'right' : 'wrong';
}

/** Where a missing-area division response stands: two partial quotients that add up, and the quotient. */
export function standAreaDivision(payload: AreaDivisionPayload, response: unknown): ArrayAreaStanding {
  if (!record(response) || !keysAre(response, 'partials', 'value')) return 'invalid';
  const { partials, value } = response;
  if (!textPair(partials)) return 'invalid';
  const total = readWholeText(value);
  if (total === null) return 'invalid';
  if (partials.some(blank) || total === 'blank') return 'incomplete';
  const [first, second] = partials.map(Number) as [number, number];
  const quotient = areaQuotient(payload);
  return first >= 1 && second >= 1 && first + second === quotient && total === quotient ? 'right' : 'wrong';
}

/** The visual a payload belongs to, or null when the payload is malformed. */
export function payloadProblem(visual: string, payload: unknown): string | null {
  const kind = arrayAreaKind(payload);
  if (kind === null) return 'The payload is not a valid array, multiplication box or missing-area division';
  return kind === visual ? null : 'The visual matches the payload';
}
