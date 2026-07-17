import { describe, expect, it, vi } from 'vitest';
import { withCorrectiveRetry, CorrectiveRetryExhaustedError, safeJsonParse, formatZodIssues } from '../pipeline/correctiveRetry.js';

describe('withCorrectiveRetry', () => {
  it('succeeds on the first attempt when parsing succeeds', async () => {
    const callModel = vi.fn().mockResolvedValue('{"ok":true}');
    const result = await withCorrectiveRetry<{ ok: boolean }>({
      maxAttempts: 3,
      callModel,
      parse: (raw) => {
        const json = JSON.parse(raw) as { ok: boolean };
        return { ok: true, data: json };
      },
    });
    expect(result.data).toEqual({ ok: true });
    expect(result.attempts).toBe(1);
    expect(callModel).toHaveBeenCalledTimes(1);
  });

  it('feeds issues from a failed attempt into the next callModel invocation, then succeeds', async () => {
    const callModel = vi
      .fn()
      .mockResolvedValueOnce('not json')
      .mockResolvedValueOnce('{"ok":true}');

    const result = await withCorrectiveRetry<{ ok: boolean }>({
      maxAttempts: 3,
      callModel,
      parse: (raw) => {
        const json = safeJsonParse(raw);
        if (!json.ok) return { ok: false, issues: json.error };
        return { ok: true, data: json.value as { ok: boolean } };
      },
    });

    expect(result.attempts).toBe(2);
    expect(result.data).toEqual({ ok: true });
    // Second call must have received the first failure's issues.
    const secondCallIssues = callModel.mock.calls[1]![0] as string | undefined;
    expect(secondCallIssues).toBeDefined();
    expect(callModel.mock.calls[0]![0]).toBeUndefined();
  });

  it('throws CorrectiveRetryExhaustedError after maxAttempts failures', async () => {
    const callModel = vi.fn().mockResolvedValue('not json');
    await expect(
      withCorrectiveRetry<unknown>({
        maxAttempts: 2,
        callModel,
        parse: (raw) => {
          const json = safeJsonParse(raw);
          return json.ok ? { ok: true, data: json.value } : { ok: false, issues: json.error };
        },
      }),
    ).rejects.toBeInstanceOf(CorrectiveRetryExhaustedError);
    expect(callModel).toHaveBeenCalledTimes(2);
  });
});

describe('formatZodIssues', () => {
  it('truncates to the given limit', () => {
    const issues = Array.from({ length: 10 }, (_, i) => ({ path: [`field${i}`], message: 'bad' }));
    const formatted = formatZodIssues(issues, 3);
    expect(formatted.split(';').length).toBe(3);
  });
});
