// Schema-corrective retry loop — a SEPARATE counter from providers/retry.ts's
// transport retries (GAME_ENGINE.md §9). Used by plan.ts, author.ts, judge.ts and
// localize.ts: call the model, try to parse + validate its JSON, and on failure feed
// the issues back into the NEXT call instead of giving up.
//
// The prefix-cache discipline lives at the CALL SITES, not here: each `callModel`
// must APPEND the previous attempt's issues after the original messages rather than
// rebuilding the prompt, so attempts 2..N re-send an identical leading prompt and bill
// as a full context-cache hit. A rebuilt prompt is a silent cost regression.
//
// Ported from coursegen/src/pipeline/correctiveRetry.ts — the two must stay
// behaviourally identical, because Forge's measured retry economics are what this
// pipeline's budget assumptions are based on.

export interface CorrectiveRetryResult<T> {
  data: T;
  attempts: number;
  raw: string;
}

export type ParseOutcome<T> = { ok: true; data: T } | { ok: false; issues: string };

export class CorrectiveRetryExhaustedError extends Error {
  constructor(maxAttempts: number, issues: string) {
    super(`Exceeded ${maxAttempts} corrective attempt(s). Last issues: ${issues}`);
    this.name = 'CorrectiveRetryExhaustedError';
  }
}

export async function withCorrectiveRetry<T>(opts: {
  maxAttempts: number;
  /** `issues` is undefined on the first attempt, then the previous failure's issues. */
  callModel: (issues: string | undefined, attempt: number) => Promise<string>;
  parse: (raw: string) => ParseOutcome<T>;
}): Promise<CorrectiveRetryResult<T>> {
  let issues: string | undefined;
  let raw = '';
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    raw = await opts.callModel(issues, attempt);
    const parsed = opts.parse(raw);
    if (parsed.ok) return { data: parsed.data, attempts: attempt, raw };
    issues = parsed.issues;
  }
  throw new CorrectiveRetryExhaustedError(opts.maxAttempts, issues ?? 'unknown');
}

export function safeJsonParse(raw: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Terse, truncated issue formatting for feeding back into the next prompt. A gate or
 * Zod message a model can ACT on names the field, the expected value and the observed
 * one; the cap exists because a wall of issues costs tokens without adding signal.
 */
export function formatZodIssues(issues: { path: PropertyKey[]; message: string }[], limit = 20): string {
  return issues
    .slice(0, limit)
    .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('; ');
}
