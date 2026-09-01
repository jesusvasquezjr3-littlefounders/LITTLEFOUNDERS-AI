import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  looksLikeSupabaseJwt,
  mintSessionToken,
  nonceLedger,
  verifySessionToken,
} from '../session/token.js';
import { evaluateBudget } from '../session/budget.js';
import { spendGuard } from '../session/spend-guard.js';
import { getConfig, resetConfigCache } from '../env.js';
import { parseTurn, sanitizePreferredTypes, TutorTurnSchema } from '../tutor/turnSchema.js';

const SECRET = process.env.TUTOR_SESSION_SECRET as string;
const SID = '11111111-1111-4111-8111-111111111111';
const UID = '22222222-2222-4222-8222-222222222222';

function future(seconds = 60): number {
  return Math.floor(Date.now() / 1000) + seconds;
}

describe('the live-session token', () => {
  beforeEach(() => nonceLedger.clear());

  it('round-trips a freshly minted token', () => {
    const verdict = verifySessionToken(mintSessionToken({ sid: SID, uid: UID, exp: future() }, SECRET));
    expect(verdict.ok).toBe(true);
    if (verdict.ok) {
      expect(verdict.payload.sid).toBe(SID);
      expect(verdict.payload.uid).toBe(UID);
    }
  });

  it('works exactly ONCE — a replay is refused', () => {
    const token = mintSessionToken({ sid: SID, uid: UID, exp: future() }, SECRET);
    expect(verifySessionToken(token).ok).toBe(true);
    const second = verifySessionToken(token);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toBe('replayed');
  });

  it('refuses a token signed with a different secret', () => {
    const forged = mintSessionToken({ sid: SID, uid: UID, exp: future() }, 'test-not-the-real-secret-000000');
    const verdict = verifySessionToken(forged);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toBe('bad_signature');
  });

  it('refuses an expired token', () => {
    const token = mintSessionToken({ sid: SID, uid: UID, exp: future(-1) }, SECRET);
    const verdict = verifySessionToken(token);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toBe('expired');
  });

  it('does not throw on a signature carrying multi-byte characters', () => {
    // §1.14: a String.length pre-check before timingSafeEqual turns a forged
    // token into a RangeError — a 500 where a 401 belongs. Digest comparison
    // makes the byte width irrelevant.
    expect(() => verifySessionToken('v1.eyJhIjoxfQ.ñññññññññññ')).not.toThrow();
  });

  it.each([
    ['empty', ''],
    ['one part', 'v1'],
    ['wrong prefix', 'v2.abc.def'],
    ['not base64 payload', 'v1.!!!!.def'],
  ])('refuses a %s token without throwing', (_label, token) => {
    expect(() => verifySessionToken(token)).not.toThrow();
    expect(verifySessionToken(token).ok).toBe(false);
  });

  it('recognises a Supabase JWT so the error can say what to fix', () => {
    expect(looksLikeSupabaseJwt('eyJhbGciOiJIUzI1NiJ9.e30.sig')).toBe(true);
    expect(looksLikeSupabaseJwt(mintSessionToken({ sid: SID, uid: UID, exp: future() }, SECRET))).toBe(false);
  });
});

describe('the session budget', () => {
  const config = getConfig();
  const start = 1_000_000;

  it('runs normally well inside the soft budget', () => {
    const verdict = evaluateBudget({ startedAtMs: start, nowMs: start + 60_000, turnCount: 4 }, config);
    expect(verdict.state).toBe('running');
  });

  it('WRAPS rather than ending at the soft budget — the tutor gets to say goodbye', () => {
    const verdict = evaluateBudget(
      { startedAtMs: start, nowMs: start + config.SESSION_SOFT_BUDGET_MS, turnCount: 20 },
      config,
    );
    expect(verdict.state).toBe('wrapping');
    expect(verdict.reason).toBe('soft_budget');
  });

  it('ends at the hard budget', () => {
    const verdict = evaluateBudget(
      { startedAtMs: start, nowMs: start + config.SESSION_HARD_BUDGET_MS, turnCount: 20 },
      config,
    );
    expect(verdict.state).toBe('ended');
    expect(verdict.reason).toBe('hard_budget');
  });

  it('ends on the turn cap even when there is time left', () => {
    const verdict = evaluateBudget(
      { startedAtMs: start, nowMs: start + 1_000, turnCount: config.SESSION_MAX_TURNS },
      config,
    );
    expect(verdict.state).toBe('ended');
    expect(verdict.reason).toBe('turn_cap');
  });

  it('is a pure function — the same input always gives the same verdict', () => {
    const input = { startedAtMs: start, nowMs: start + 5_000, turnCount: 3 };
    expect(evaluateBudget(input, config)).toEqual(evaluateBudget(input, config));
  });
});

describe('the closed turn schema', () => {
  const valid = {
    say: 'Nice thinking! What happens if you save the same amount next week?',
    emotion: 'happy',
    action: 'nod',
    next: 'ask',
    segmentRequest: null,
    offerAdaptation: null,
  };

  it('accepts a well-formed turn', () => {
    expect(TutorTurnSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects a field the model invented', () => {
    // An injection that persuades the model still has nowhere to put the
    // result — that is the whole point of layer 1.
    expect(TutorTurnSchema.safeParse({ ...valid, html: '<script>x</script>' }).success).toBe(false);
    expect(TutorTurnSchema.safeParse({ ...valid, toolCall: 'fetch' }).success).toBe(false);
    expect(TutorTurnSchema.safeParse({ ...valid, redirectUrl: 'https://x.com' }).success).toBe(false);
  });

  it('rejects an emotion or action outside the canonical vocabulary', () => {
    expect(TutorTurnSchema.safeParse({ ...valid, emotion: 'furious' }).success).toBe(false);
    expect(TutorTurnSchema.safeParse({ ...valid, action: 'backflip' }).success).toBe(false);
  });

  it('refuses next="segment" with no segment request', () => {
    expect(TutorTurnSchema.safeParse({ ...valid, next: 'segment' }).success).toBe(false);
  });

  describe('a segment request\'s visual-type hint (V4)', () => {
    const requestOf = (preferredTypes?: unknown) => ({
      ...valid,
      next: 'segment' as const,
      segmentRequest: {
        skillKey: 'financial-education/ahorro',
        difficulty: 2,
        framing: 'Veamos cómo crece.',
        rationale: 'right after a growth story',
        ...(preferredTypes === undefined ? {} : { preferredTypes }),
      },
    });

    it('is optional — an ordinary request with no hint still parses', () => {
      expect(TutorTurnSchema.safeParse(requestOf()).success).toBe(true);
    });

    it('accepts either of the two named visual types', () => {
      expect(TutorTurnSchema.safeParse(requestOf(['interest_peek'])).success).toBe(true);
      expect(TutorTurnSchema.safeParse(requestOf(['number_line'])).success).toBe(true);
      expect(TutorTurnSchema.safeParse(requestOf(['interest_peek', 'number_line'])).success).toBe(true);
    });

    it('accepts null, the same as omitting it', () => {
      expect(TutorTurnSchema.safeParse(requestOf(null)).success).toBe(true);
    });

    it('parses a value outside the closed vocabulary — sanitizing, not rejecting, is this schema\'s job', () => {
      /*
       * Found live, 2026-08-29: an earlier version of this schema enforced
       * the closed vocabulary with `z.enum` HERE, and the real model set an
       * invalid value on BOTH the first attempt and the retry —
       * `preferredTypes.0: Invalid option`, failing shape validation twice
       * and losing the WHOLE turn to the "se me enredaron las ideas"
       * fallback, over one optional hint field the rest of the turn had
       * nothing to do with. `sanitizePreferredTypes` (tested below) is
       * where the closed vocabulary actually lives now; this schema must
       * never again cost a turn over it.
       */
      expect(TutorTurnSchema.safeParse(requestOf(['quiz_mcq'])).success).toBe(true);
    });

    it('parses more entries than the two types that exist', () => {
      expect(
        TutorTurnSchema.safeParse(requestOf(['interest_peek', 'number_line', 'interest_peek'])).success,
      ).toBe(true);
    });
  });

  describe('sanitizePreferredTypes — the closed vocabulary, enforced without losing the turn', () => {
    it('passes through valid values unchanged', () => {
      expect(sanitizePreferredTypes(['interest_peek'])).toEqual(['interest_peek']);
      expect(sanitizePreferredTypes(['number_line'])).toEqual(['number_line']);
      expect(sanitizePreferredTypes(['interest_peek', 'number_line'])).toEqual(['interest_peek', 'number_line']);
    });

    it('degrades an invalid guess to "no preference" instead of failing anything', () => {
      // The exact live incident: the model invented a value outside the two
      // named types. Silently dropped, never a discarded turn.
      expect(sanitizePreferredTypes(['quiz_mcq'])).toBeNull();
    });

    it('keeps the valid entries and drops only the invalid ones from a mixed list', () => {
      expect(sanitizePreferredTypes(['quiz_mcq', 'number_line'])).toEqual(['number_line']);
    });

    it('caps at two, even if the model listed the same valid type three times', () => {
      expect(sanitizePreferredTypes(['interest_peek', 'number_line', 'interest_peek'])).toEqual([
        'interest_peek',
        'number_line',
      ]);
    });

    it('treats null, undefined, and empty the same — no preference', () => {
      expect(sanitizePreferredTypes(null)).toBeNull();
      expect(sanitizePreferredTypes(undefined)).toBeNull();
      expect(sanitizePreferredTypes([])).toBeNull();
    });
  });

  describe('the whiteboard (V4)', () => {
    const board = {
      kind: 'sequence' as const,
      start: 10,
      unit: 'day' as const,
      steps: [{ op: 'add' as const, value: 2 }],
      label: 'Cada día te dan 2 más',
      currency: 'MXN' as const,
    };

    it('accepts a turn carrying a whiteboard', () => {
      expect(TutorTurnSchema.safeParse({ ...valid, whiteboard: board }).success).toBe(true);
    });

    it('never both a whiteboard and a segment request on the same turn', () => {
      // A board and a graded activity competing for the plate in one turn is
      // exactly the disconnected-surfaces bug this schema exists to close.
      const withBoth = {
        ...valid,
        next: 'segment' as const,
        segmentRequest: {
          skillKey: 'financial-education/ahorro',
          difficulty: 2,
          framing: 'Practiquemos ahorrar.',
          rationale: 'reinforce the idea just shown',
        },
        whiteboard: board,
      };
      expect(TutorTurnSchema.safeParse(withBoth).success).toBe(false);
    });

    it('refuses a step operator outside the closed vocabulary', () => {
      expect(
        TutorTurnSchema.safeParse({
          ...valid,
          whiteboard: { ...board, steps: [{ op: 'divide', value: 2 }] },
        }).success,
      ).toBe(false);
    });

    it('refuses an out-of-range start or step value', () => {
      expect(TutorTurnSchema.safeParse({ ...valid, whiteboard: { ...board, start: -1 } }).success).toBe(false);
      expect(
        TutorTurnSchema.safeParse({
          ...valid,
          whiteboard: { ...board, steps: [{ op: 'add', value: 200_000 }] },
        }).success,
      ).toBe(false);
    });

    it('requires "unit" — a board with no notion of time cannot be labelled', () => {
      // Found by actually using the shipped feature: the tutor's story said
      // "cada semana" and the board (which had no unit field yet) was hard-coded
      // to draw "Día 1/2/3" — a visual that contradicted its own narration.
      const { unit: _unit, ...withoutUnit } = board;
      expect(TutorTurnSchema.safeParse({ ...valid, whiteboard: withoutUnit }).success).toBe(false);
    });

    it('refuses a unit outside the closed vocabulary', () => {
      expect(
        TutorTurnSchema.safeParse({ ...valid, whiteboard: { ...board, unit: 'fortnight' } }).success,
      ).toBe(false);
    });
  });

  it('unwraps a markdown-fenced completion, because models do that', () => {
    const parsed = parseTurn('```json\n' + JSON.stringify(valid) + '\n```');
    expect(parsed.ok).toBe(true);
  });

  it('unwraps a completion with a chatty preamble', () => {
    expect(parseTurn(`Sure! Here you go:\n${JSON.stringify(valid)}`).ok).toBe(true);
  });

  it('reports WHY an invalid turn was discarded', () => {
    // `say` is what the child hears; a wrong one is a real defect and the turn
    // goes. (`emotion` and `action` no longer do — see below.)
    const parsed = parseTurn(JSON.stringify({ ...valid, say: 42 }));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.reason).toBe('invalid_shape');
      expect(parsed.detail).toContain('say');
    }
  });

  it('keeps the lesson when only the GESTURE is out of vocabulary', () => {
    /*
     * A model chose an action outside the enum twice in a row on 2026-08-29;
     * both attempts were discarded and a child got "Se me enredaron las ideas"
     * instead of a lesson, because the character would have waved instead of
     * nodded. `emotion` and `action` are animation, and a wrong one is a
     * neutral face — not a reason to throw away the teaching.
     */
    const parsed = parseTurn(JSON.stringify({ ...valid, emotion: 'furious', action: 'backflip' }));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.turn.emotion).toBe('neutral');
      expect(parsed.turn.action).toBe('idle');
      // The words are untouched, which is the only part that had to survive.
      expect(parsed.turn.say).toBe(valid.say);
    }
  });

  it('reports a completion with no JSON at all', () => {
    const parsed = parseTurn('I am sorry, I cannot do that.');
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.reason).toBe('no_json');
  });

  it('keeps the lesson when only the WHITEBOARD is malformed', () => {
    /*
     * Found live, round 39 (2026-08-30): a real session had the model set
     * `whiteboard.unit` to a value outside day|week|month|year. That failed
     * `TutorTurnSchema`'s strict parse, discarding the entire turn — a real,
     * well-taught reply, lost over one cosmetic field. The board is a bonus
     * visual for a story `say` already tells in words; losing it for one
     * turn costs far less than losing the turn (the same principle already
     * applied to `emotion`/`action` above).
     */
    const board = {
      kind: 'sequence' as const,
      start: 10,
      unit: 'day' as const,
      steps: [{ op: 'add' as const, value: 2 }],
      label: 'Cada día te dan 2 más',
      currency: 'MXN' as const,
    };
    const parsed = parseTurn(JSON.stringify({ ...valid, whiteboard: { ...board, unit: 'fortnight' } }));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.turn.whiteboard).toBeNull();
      // The words are untouched, which is the only part that had to survive.
      expect(parsed.turn.say).toBe(valid.say);
    }
  });

  it('keeps the lesson when the whiteboard has an out-of-vocabulary step operator', () => {
    // Same class as the unit case above: a bad `op` inside `steps` fails the
    // whole `whiteboard` sub-object, which must degrade to no board rather
    // than take the turn down with it.
    const board = {
      kind: 'sequence' as const,
      start: 10,
      unit: 'day' as const,
      steps: [{ op: 'divide' as unknown as 'add', value: 2 }],
      label: 'Cada día te dan 2 más',
      currency: 'MXN' as const,
    };
    const parsed = parseTurn(JSON.stringify({ ...valid, whiteboard: board }));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.turn.whiteboard).toBeNull();
  });
});

/*
 * /ORACLE.md §15.2 item 1 — the class in isolation. `live-session.test.ts`
 * separately proves `ws/server.ts` actually WIRES a new connection to this
 * guard; these prove the guard's own arithmetic, deterministically and
 * without a real websocket, the same split `evaluateBudget` above gets.
 */
describe('the platform-wide spend circuit breaker (/ORACLE.md §15.2 item 1)', () => {
  const originalCeiling = process.env.DAILY_SPEND_CEILING_USD;
  const originalAlert = process.env.DAILY_SPEND_ALERT_FRACTION;

  beforeEach(() => {
    // A known, round ceiling for every test in this block, rather than
    // whatever DAILY_SPEND_CEILING_USD's own default happens to be —
    // §5's own default rests deliberately on §15.2's real-world reasoning
    // ($20, conservative-and-tunable), which is orthogonal to what this
    // arithmetic is being asked to prove.
    process.env.DAILY_SPEND_CEILING_USD = '10';
    process.env.DAILY_SPEND_ALERT_FRACTION = '0.5';
    resetConfigCache();
    spendGuard.reset();
  });

  afterEach(() => {
    if (originalCeiling === undefined) delete process.env.DAILY_SPEND_CEILING_USD;
    else process.env.DAILY_SPEND_CEILING_USD = originalCeiling;
    if (originalAlert === undefined) delete process.env.DAILY_SPEND_ALERT_FRACTION;
    else process.env.DAILY_SPEND_ALERT_FRACTION = originalAlert;
    resetConfigCache();
    spendGuard.reset();
    vi.restoreAllMocks();
  });

  it('admits a new session while spend is under the ceiling', () => {
    expect(spendGuard.check().admitting).toBe(true);
  });

  it('accumulates every recorded cost', () => {
    spendGuard.record(1);
    spendGuard.record(2.5);
    expect(spendGuard.check().spentUsd).toBeCloseTo(3.5, 10);
  });

  it('ignores a non-positive amount rather than corrupting the ledger', () => {
    // The four call sites already guard their own estimateCostUsd/
    // estimateVoiceCostUsd results before calling this — this is the
    // backstop, not the primary defence, for the reason `record`'s own doc
    // comment gives.
    spendGuard.record(0);
    spendGuard.record(-5);
    expect(spendGuard.check().spentUsd).toBe(0);
  });

  it('stops admitting once spend reaches the ceiling', () => {
    spendGuard.record(10);
    const after = spendGuard.check();
    expect(after.admitting).toBe(false);
    expect(after.spentUsd).toBe(10);
    expect(after.ceilingUsd).toBe(10);
  });

  it('warns exactly once when spend crosses the alert fraction, not on every call past it', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    spendGuard.record(4); // under the 50% alert line ($5 of a $10 ceiling)
    expect(warnSpy).not.toHaveBeenCalled();
    spendGuard.record(2); // now $6 — past the alert line
    expect(warnSpy).toHaveBeenCalledTimes(1);
    spendGuard.record(1); // $7 — still past it, must not re-alert
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('rolls the window after 24h — spend and the alert latch both reset', () => {
    const start = 1_000_000;
    spendGuard.reset(start);
    spendGuard.record(9, start); // past the alert line, short of the ceiling
    expect(spendGuard.check(start).admitting).toBe(true);

    const dayLater = start + 24 * 60 * 60 * 1000;
    expect(spendGuard.check(dayLater).spentUsd).toBe(0);
    expect(spendGuard.check(dayLater).admitting).toBe(true);

    // The alert fires again in the NEW window rather than staying latched
    // from the one that just closed.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    spendGuard.record(6, dayLater + 1);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('does not roll the window a moment before 24h has actually elapsed', () => {
    const start = 1_000_000;
    spendGuard.reset(start);
    spendGuard.record(9, start);
    const almostADay = start + 24 * 60 * 60 * 1000 - 1;
    expect(spendGuard.check(almostADay).spentUsd).toBe(9);
  });
});
