export type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Same shape as the Space of forgeV2Behaviour.ts: the states a learner can reach, the ones Core must refuse, and the rubric's own verdict. */
export interface HzSpace {
  inRange: unknown[];
  invalid: unknown[];
  initial?: unknown;
  expectMet?: (response: Json) => boolean;
  expectDiagnostic?: (response: Json) => string | null;
}

/** One builder per Horizonte kind: the payload and the private rubric in, the space out; null when the payload is not a mode the model covers. */
export type HzBuilder = (payload: Json, rubric: Json, segment: Json) => HzSpace | null;

export const SPACE_LIMIT = 3_000;

export const range = (from: number, to: number, step = 1): number[] => {
  const out: number[] = [];
  for (let value = from; value <= to && out.length <= SPACE_LIMIT; value += step) out.push(value);
  return out;
};

export const sameJson = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Evenly spaced picks, both ends kept. */
export const even = <T,>(values: T[], limit: number): T[] => values.length <= limit ? values
  : Array.from({ length: limit }, (_, index) => values[Math.round(index * (values.length - 1) / (limit - 1))]!);

/** The states capped to `limit`, with every `keep` state present: reachability is tested even when the space is sampled. */
export function bounded<T>(states: T[], limit: number, keep: T[] = []): T[] {
  const picked = even(states, limit);
  const seen = new Set(picked.map((state) => JSON.stringify(state)));
  for (const state of keep) if (!seen.has(JSON.stringify(state))) { picked.push(state); seen.add(JSON.stringify(state)); }
  return picked;
}

export const unique = <T,>(values: T[]): T[] => {
  const seen = new Set<string>();
  return values.filter((value) => { const key = JSON.stringify(value); if (seen.has(key)) return false; seen.add(key); return true; });
};

export const product = <T,>(lists: T[][], limit = SPACE_LIMIT * 4): T[][] => {
  let out: T[][] = [[]];
  for (const list of lists) {
    const next: T[][] = [];
    for (const prefix of out) for (const value of list) { next.push([...prefix, value]); if (next.length > limit) break; }
    out = even(next, limit);
  }
  return out;
};

export const isRecord = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
