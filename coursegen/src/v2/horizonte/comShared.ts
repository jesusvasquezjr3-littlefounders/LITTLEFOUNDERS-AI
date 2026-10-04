import {
  checkUniqueIds, issue, result, verifyUniqueOrCovered,
  type SearchResult, type SolvabilityContext, type SolvabilityIssue, type SolvabilityResult,
} from '../solvability.js';

/*
 * Shared helpers of the com pack (F2.16, F2.17, F2.18). Hand-mirrored from backend/src/services/horizonte/com/arrange.ts:
 * the packages share no code, so the rules are copied and the parity of the capability literals is tested.
 */

export type Rec = Record<string, unknown>;
export type Slots = Record<string, string[]>;
export interface Frame { pieceIds: string[]; slotIds: string[]; capacities: Record<string, number> }

const ID = /^[a-z0-9][a-z0-9._:-]{2,100}$/;
export const record = (value: unknown): value is Rec => typeof value === 'object' && value !== null && !Array.isArray(value);
export const isId = (value: unknown): value is string => typeof value === 'string' && ID.test(value);
export const whole = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
export const sorted = (list: readonly string[]): string[] => [...list].sort();
export const range = (from: number, to: number): number[] => Array.from({ length: Math.max(0, to - from + 1) }, (_, index) => from + index);

export function keysAre(value: unknown, required: readonly string[], optional: readonly string[] = []): value is Rec {
  if (!record(value)) return false;
  const keys = Object.keys(value);
  return required.every((key) => keys.includes(key)) && keys.every((key) => required.includes(key) || optional.includes(key));
}

export const sameKeys = (value: Rec, keys: readonly string[]): boolean => {
  const have = Object.keys(value);
  return have.length === keys.length && keys.every((key) => have.includes(key));
};

/** The two lists hold the same ids, in any order, each once. */
export const sameSet = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && new Set(a).size === a.length && b.every((id) => a.includes(id));

const MAX_SOLUTIONS = 8;
/** The backend rubric holds up to 64 pieces in one slot; a Pascal key of the even cells reaches 22. */
const MAX_KEY_PIECES = 64;

/** The private key, as Core's arrangement parser reads it: whole arrangements inside the frame, every piece placed at most once. */
export function keyShapeProblem(frame: Frame, key: unknown): string | null {
  if (!keysAre(key, ['solutions']) || !Array.isArray(key.solutions) || key.solutions.length < 1 || key.solutions.length > MAX_SOLUTIONS) return 'The key is { solutions }: one to eight arrangements';
  for (const solution of key.solutions as unknown[]) {
    if (!record(solution)) return 'Each key solution maps a slot to a list of pieces';
    const used = new Set<string>();
    let total = 0;
    for (const [slot, pieces] of Object.entries(solution)) {
      if (!frame.slotIds.includes(slot)) return `A key solution names a slot this board does not have: ${slot}`;
      if (!Array.isArray(pieces) || pieces.length > (frame.capacities[slot] ?? 1) || pieces.length > MAX_KEY_PIECES) return `A key solution holds the slot ${slot} within its capacity`;
      for (const piece of pieces) {
        if (typeof piece !== 'string' || !frame.pieceIds.includes(piece)) return `A key solution places a piece this board does not have in ${slot}`;
        if (used.has(piece)) return 'A key solution places each piece once';
        used.add(piece);
        total += 1;
      }
    }
    if (total === 0) return 'A key solution places at least one piece';
  }
  return null;
}

export const solutionsOf = (key: unknown): Slots[] => (key as { solutions: Slots[] }).solutions;

export type Prepared = { solutions: Slots[]; issues: SolvabilityIssue[] };

/** The key of an arrangement segment, read against the board's own frame; an absent key is not an error here. */
export function prepareKey(frame: Frame, context: SolvabilityContext, subject: string): Prepared {
  if (context.answerKey === undefined) return { solutions: [], issues: [] };
  const problem = keyShapeProblem(frame, context.answerKey);
  return problem ? { solutions: [], issues: [issue('impossible-state', `${subject}: ${problem}`)] } : { solutions: solutionsOf(context.answerKey), issues: [] };
}

export function repeated(ids: readonly unknown[], subject: string): SolvabilityIssue[] {
  return checkUniqueIds(ids.filter((id): id is string => typeof id === 'string'), subject);
}

/** Every com arrangement is graded by rule, never by comparing with the key, so the search proves a solution exists and nothing more. */
export function graded<V>(subject: string, run: (limit: number) => SearchResult<V>): SolvabilityResult {
  return verifyUniqueOrCovered(run, { subject, predicateGraded: true });
}

export const withKey = (outcome: SolvabilityResult, key: Prepared, extra: SolvabilityIssue[] = []): SolvabilityResult =>
  result([...key.issues, ...extra, ...outcome.issues], { ...(outcome.stats ?? {}), solutionsInKey: key.solutions.length });

/** The issue for a key solution that breaks the rule of the task, or none. */
export const keyRuleIssues = (subject: string, prepared: Prepared, problem: string | null): SolvabilityIssue[] =>
  prepared.issues.length === 0 && prepared.solutions.length > 0 && problem ? [issue('impossible-state', `${subject}: ${problem}`)] : [];
