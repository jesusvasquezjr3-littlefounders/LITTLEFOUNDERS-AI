import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  looksLikeSupabaseJwt,
  mintSessionToken,
  nonceLedger,
  verifySessionToken,
} from '../session/token.js';
import {
  evaluateBudget,
  STAFF_HARD_BUDGET_MS,
  STAFF_MAX_TURNS,
  STAFF_SOFT_BUDGET_MS,
} from '../session/budget.js';
import { spendGuard } from '../session/spend-guard.js';
import { getConfig, resetConfigCache } from '../env.js';
import {
  parseTurn,
  sanitizePreferredTypes,
  TutorTurnSchema,
  whiteboardVisibleText,
} from '../tutor/turnSchema.js';

const SECRET = process.env.TUTOR_SESSION_SECRET as string;
const SID = '11111111-1111-4111-8111-111111111111';
const UID = '22222222-2222-4222-8222-222222222222';

function future(seconds = 60): number {
  return Math.floor(Date.now() / 1000) + seconds;
}

describe('the live-session token', () => {
  beforeEach(() => nonceLedger.clear());

  it('round-trips a freshly minted token', async () => {
    const verdict = await verifySessionToken(mintSessionToken({ sid: SID, uid: UID, exp: future() }, SECRET));
    expect(verdict.ok).toBe(true);
    if (verdict.ok) {
      expect(verdict.payload.sid).toBe(SID);
      expect(verdict.payload.uid).toBe(UID);
    }
  });

  it('works exactly ONCE — a replay is refused', async () => {
    const token = mintSessionToken({ sid: SID, uid: UID, exp: future() }, SECRET);
    expect((await verifySessionToken(token)).ok).toBe(true);
    const second = await verifySessionToken(token);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toBe('replayed');
  });

  it('refuses a token signed with a different secret', async () => {
    const forged = mintSessionToken({ sid: SID, uid: UID, exp: future() }, 'test-not-the-real-secret-000000');
    const verdict = await verifySessionToken(forged);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toBe('bad_signature');
  });

  it('refuses an expired token', async () => {
    const token = mintSessionToken({ sid: SID, uid: UID, exp: future(-1) }, SECRET);
    const verdict = await verifySessionToken(token);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toBe('expired');
  });

  it('does not throw (reject) on a signature carrying multi-byte characters', async () => {
    // §1.14: a String.length pre-check before timingSafeEqual turns a forged
    // token into a RangeError — a 500 where a 401 belongs. Digest comparison
    // makes the byte width irrelevant.
    await expect(verifySessionToken('v1.eyJhIjoxfQ.ñññññññññññ')).resolves.toMatchObject({ ok: false });
  });

  it.each([
    ['empty', ''],
    ['one part', 'v1'],
    ['wrong prefix', 'v2.abc.def'],
    ['not base64 payload', 'v1.!!!!.def'],
  ])('refuses a %s token without throwing (rejecting)', async (_label, token) => {
    const verdict = await verifySessionToken(token);
    expect(verdict.ok).toBe(false);
  });

  it('recognises a Supabase JWT so the error can say what to fix', () => {
    expect(looksLikeSupabaseJwt('eyJhbGciOiJIUzI1NiJ9.e30.sig')).toBe(true);
    expect(looksLikeSupabaseJwt(mintSessionToken({ sid: SID, uid: UID, exp: future() }, SECRET))).toBe(false);
  });

  /*
   * `oracle/AGENTS.md` item 79 / `RUNBOOK.md` Round 119: the jti ledger now
   * fails CLOSED when its shared store cannot confirm a nonce is unused,
   * rather than silently treating "can't tell" as "unused" (see
   * `consumeNonce`'s header comment in `token.ts`). Proven here by forcing
   * `lib/lock.ts`'s `acquireLock` to report `unreachable` — the one outcome
   * `isTestOrDev`'s local Map can never produce on its own, since a plain
   * JS Map call has no network to fail on.
   */
  it('fails CLOSED — not open — when the shared store cannot confirm the nonce, and says so distinctly from a real replay', async () => {
    vi.doMock('../lib/lock.js', () => ({
      acquireLock: async () => ({ ok: false, reason: 'unreachable' as const }),
      clearLocalClaims: () => {},
    }));
    vi.resetModules();
    try {
      const fresh = await import('../session/token.js');
      const token = fresh.mintSessionToken({ sid: SID, uid: UID, exp: future() }, SECRET);
      const verdict = await fresh.verifySessionToken(token);
      expect(verdict.ok).toBe(false);
      if (!verdict.ok) {
        // NOT `false` (which would silently let the token through) and NOT
        // reported as `replayed` (which would misname a Redis outage as an
        // attack in every log line reading it).
        expect(verdict.reason).toBe('store_unreachable');
      }
    } finally {
      vi.doUnmock('../lib/lock.js');
      vi.resetModules();
    }
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

  /*
   * THE STAFF USAGE EXEMPTION (owner request, 2026-09-01).
   *
   * Staff test the product past the bounds a learner lives inside. These
   * assert the exemption is real, that it is NOT infinite, and — the one a
   * careless implementation breaks — that omitting the flag still gives a
   * learner the learner's budget.
   */
  describe('the staff exemption', () => {
    it('keeps a staff session RUNNING well past the learner hard budget', () => {
      const verdict = evaluateBudget(
        {
          startedAtMs: start,
          nowMs: start + config.SESSION_HARD_BUDGET_MS + 60_000,
          turnCount: 20,
          isStaff: true,
        },
        config,
      );
      expect(verdict.state).toBe('running');
    });

    it('keeps a staff session running past the learner TURN cap', () => {
      const verdict = evaluateBudget(
        { startedAtMs: start, nowMs: start + 1_000, turnCount: config.SESSION_MAX_TURNS, isStaff: true },
        config,
      );
      expect(verdict.state).toBe('running');
    });

    it('is NOT unlimited — an abandoned staff session still ends, which is the whole point of a finite ceiling', () => {
      const verdict = evaluateBudget(
        { startedAtMs: start, nowMs: start + STAFF_HARD_BUDGET_MS, turnCount: 20, isStaff: true },
        config,
      );
      expect(verdict.state).toBe('ended');
      expect(verdict.reason).toBe('hard_budget');
    });

    it('still ends a staff session on its own turn cap', () => {
      const verdict = evaluateBudget(
        { startedAtMs: start, nowMs: start + 1_000, turnCount: STAFF_MAX_TURNS, isStaff: true },
        config,
      );
      expect(verdict.state).toBe('ended');
      expect(verdict.reason).toBe('turn_cap');
    });

    it('still WRAPS before it ends — staff must be able to reach the goodbye state they are testing', () => {
      const verdict = evaluateBudget(
        { startedAtMs: start, nowMs: start + STAFF_SOFT_BUDGET_MS, turnCount: 20, isStaff: true },
        config,
      );
      expect(verdict.state).toBe('wrapping');
      expect(verdict.reason).toBe('soft_budget');
    });

    it('gives the wind-down the same real fifteen minutes a learner gets, not a proportional slice', () => {
      expect(STAFF_HARD_BUDGET_MS - STAFF_SOFT_BUDGET_MS).toBe(15 * 60_000);
    });

    it('OMITTING the flag is a learner budget — the exemption is asked for, never inherited', () => {
      const verdict = evaluateBudget(
        { startedAtMs: start, nowMs: start + config.SESSION_HARD_BUDGET_MS, turnCount: 20 },
        config,
      );
      expect(verdict.state).toBe('ended');
      expect(verdict.reason).toBe('hard_budget');
    });

    it('isStaff: false is a learner budget too', () => {
      const verdict = evaluateBudget(
        { startedAtMs: start, nowMs: start + config.SESSION_HARD_BUDGET_MS, turnCount: 20, isStaff: false },
        config,
      );
      expect(verdict.state).toBe('ended');
    });
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

    it('dedupes a repeated valid type, in EITHER order', () => {
      // The duplicate-last case: the first version of this test used only this
      // ordering, capped at 2 with no real dedup step, and the slice happened
      // to cut the duplicate off — passing for the wrong reason.
      expect(sanitizePreferredTypes(['interest_peek', 'number_line', 'interest_peek'])).toEqual([
        'interest_peek',
        'number_line',
      ]);
      // The duplicate-FIRST case: this is what the old code actually did wrong
      // — it kept both copies of the duplicate and silently dropped the real
      // second preference, `number_line`, instead.
      expect(sanitizePreferredTypes(['interest_peek', 'interest_peek', 'number_line'])).toEqual([
        'interest_peek',
        'number_line',
      ]);
    });

    it('caps at three once deduped, even with more valid entries than that', () => {
      expect(
        sanitizePreferredTypes(['coin_count', 'make_change', 'piggy_split', 'needs_wants']),
      ).toEqual(['coin_count', 'make_change', 'piggy_split']);
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

  /*
   * TWO-QUANTITY COMPARISON (V4, /ORACLE.md §20.5 backlog: "same schema
   * family, straightforward once sequence is proven live"). Same test shape
   * as `the whiteboard (V4)` above, for the second `kind`.
   */
  describe('the whiteboard: compare (V4)', () => {
    const compareBoard = {
      kind: 'compare' as const,
      left: { label: 'Tienda A', value: 45 },
      right: { label: 'Tienda B', value: 28 },
      label: '¿Cuál playera es más barata?',
      currency: 'MXN' as const,
    };

    it('accepts a turn carrying a comparison board', () => {
      expect(TutorTurnSchema.safeParse({ ...valid, whiteboard: compareBoard }).success).toBe(true);
    });

    it('never both a whiteboard and a segment request on the same turn — same refusal as sequence', () => {
      const withBoth = {
        ...valid,
        next: 'segment' as const,
        segmentRequest: {
          skillKey: 'financial-education/ahorro',
          difficulty: 2,
          framing: 'Practiquemos comparar precios.',
          rationale: 'reinforce the idea just shown',
        },
        whiteboard: compareBoard,
      };
      expect(TutorTurnSchema.safeParse(withBoth).success).toBe(false);
    });

    it('requires a label on each side — a bare number with nothing telling it apart from the other', () => {
      const { label: _label, ...leftWithoutLabel } = compareBoard.left;
      expect(
        TutorTurnSchema.safeParse({ ...valid, whiteboard: { ...compareBoard, left: leftWithoutLabel } }).success,
      ).toBe(false);
    });

    it('refuses an out-of-range value on either side', () => {
      expect(
        TutorTurnSchema.safeParse({
          ...valid,
          whiteboard: { ...compareBoard, left: { ...compareBoard.left, value: -1 } },
        }).success,
      ).toBe(false);
      expect(
        TutorTurnSchema.safeParse({
          ...valid,
          whiteboard: { ...compareBoard, right: { ...compareBoard.right, value: 1_000_001 } },
        }).success,
      ).toBe(false);
    });

    it('refuses a `left`/`right` shape carrying an extra field — closed, not free-form', () => {
      expect(
        TutorTurnSchema.safeParse({
          ...valid,
          whiteboard: { ...compareBoard, left: { ...compareBoard.left, greater: true } },
        }).success,
      ).toBe(false);
    });

    it('keeps the lesson when only the WHITEBOARD is malformed — the same fail-open posture as sequence', () => {
      const parsed = parseTurn(
        JSON.stringify({ ...valid, whiteboard: { ...compareBoard, left: { ...compareBoard.left, value: -1 } } }),
      );
      expect(parsed.ok).toBe(true);
      if (parsed.ok) {
        expect(parsed.turn.whiteboard).toBeNull();
        expect(parsed.turn.say).toBe(valid.say);
      }
    });
  });

  /*
   * A MARKED NUMBER LINE (V4, /ORACLE.md §20.5 backlog). Named `marked_line`,
   * never `number_line` — the Lesson Engine already has a GRADED segment
   * type spelled `number_line` (`frontend/src/lesson-engine/families/arrange/
   * schema.ts`), reached through `segmentRequest.preferredTypes`, an entirely
   * different concept from this ungraded, tutor-drawn visual.
   */
  describe('the whiteboard: marked_line (V4)', () => {
    const markedLineBoard = {
      kind: 'marked_line' as const,
      min: 0,
      max: 40,
      marks: [
        { value: 22, label: 'Lo que tienes' },
        { value: 35, label: 'Los audífonos' },
      ],
      label: '¿Cuánto te falta para los audífonos?',
      currency: 'MXN' as const,
    };

    it('accepts a turn carrying a marked-line board', () => {
      expect(TutorTurnSchema.safeParse({ ...valid, whiteboard: markedLineBoard }).success).toBe(true);
    });

    it('never both a whiteboard and a segment request on the same turn — same refusal as sequence', () => {
      const withBoth = {
        ...valid,
        next: 'segment' as const,
        segmentRequest: {
          skillKey: 'financial-education/ahorro',
          difficulty: 2,
          framing: 'Practiquemos ahorrar.',
          rationale: 'reinforce the idea just shown',
        },
        whiteboard: markedLineBoard,
      };
      expect(TutorTurnSchema.safeParse(withBoth).success).toBe(false);
    });

    it('requires at least one mark', () => {
      expect(TutorTurnSchema.safeParse({ ...valid, whiteboard: { ...markedLineBoard, marks: [] } }).success).toBe(
        false,
      );
    });

    it('refuses more than four marks — bounded, not free-form', () => {
      const fiveMarks = Array.from({ length: 5 }, (_, i) => ({ value: i + 1, label: `m${i}` }));
      expect(
        TutorTurnSchema.safeParse({ ...valid, whiteboard: { ...markedLineBoard, marks: fiveMarks } }).success,
      ).toBe(false);
    });

    it('refuses an out-of-range min, max, or mark value', () => {
      expect(
        TutorTurnSchema.safeParse({ ...valid, whiteboard: { ...markedLineBoard, min: -1 } }).success,
      ).toBe(false);
      expect(
        TutorTurnSchema.safeParse({ ...valid, whiteboard: { ...markedLineBoard, max: 1_000_001 } }).success,
      ).toBe(false);
    });

    it(
      'accepts min > max at the SCHEMA level — that cross-field check only exists in ' +
        'computeMarkedLine (z.discriminatedUnion cannot carry a .refine())',
      () => {
        // Documents the split deliberately, rather than leaving it implicit:
        // this is NOT a gap `parseTurn`'s fail-open guard silently covers for
        // free (see the next test) — the SCHEMA alone really does accept
        // this, on purpose, matching `WhiteboardMarkedLineSchema`'s own
        // comment (turnSchema.ts).
        expect(
          TutorTurnSchema.safeParse({ ...valid, whiteboard: { ...markedLineBoard, min: 50, max: 10 } }).success,
        ).toBe(true);
      },
    );

    it('keeps the lesson when only the WHITEBOARD is malformed — the same fail-open posture as sequence', () => {
      const parsed = parseTurn(
        JSON.stringify({ ...valid, whiteboard: { ...markedLineBoard, marks: [] } }),
      );
      expect(parsed.ok).toBe(true);
      if (parsed.ok) {
        expect(parsed.turn.whiteboard).toBeNull();
        expect(parsed.turn.say).toBe(valid.say);
      }
    });
  });

  describe('whiteboardVisibleText — every free-text field a board shows, regardless of kind', () => {
    it('is empty for no whiteboard', () => {
      expect(whiteboardVisibleText(null)).toEqual([]);
      expect(whiteboardVisibleText(undefined)).toEqual([]);
    });

    it('a sequence carries only its own top-level label', () => {
      expect(
        whiteboardVisibleText({
          kind: 'sequence',
          start: 10,
          unit: 'day',
          steps: [{ op: 'add', value: 2 }],
          label: 'top label',
          currency: null,
        }),
      ).toEqual(['top label']);
    });

    it('a comparison carries its top-level label AND both sides\' — the exact class of gap that let segmentRequest.framing reach a child unmoderated once', () => {
      expect(
        whiteboardVisibleText({
          kind: 'compare',
          left: { label: 'left label', value: 1 },
          right: { label: 'right label', value: 2 },
          label: 'top label',
          currency: null,
        }),
      ).toEqual(['top label', 'left label', 'right label']);
    });

    it('a marked line carries its top-level label AND every mark\'s own', () => {
      expect(
        whiteboardVisibleText({
          kind: 'marked_line',
          min: 0,
          max: 10,
          marks: [
            { value: 2, label: 'mark one' },
            { value: 8, label: 'mark two' },
          ],
          label: 'top label',
          currency: null,
        }),
      ).toEqual(['top label', 'mark one', 'mark two']);
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

  /*
   * `categories` — the first bounded slice of "UI generativa acotada"
   * (blueprint §10.4, ORACLE.md §20.5): a comparison across named things at
   * one moment rather than one quantity over time, same closed-vocabulary
   * discipline as `sequence` above. Nested in the SAME outer `describe('the
   * closed turn schema', ...)` as the sequence block above it, so it shares
   * that describe's `valid` base turn fixture rather than duplicating it.
   */
  /*
   * `tokens` — the first NON-CHART instrument (/TUTOR_INSTRUMENTS.md, Sprint 6):
   * discrete denominated objects a learner counts, for the several remediation
   * moves that ask for coins "on the table where they can be picked up" rather
   * than a height. Same closed-vocabulary discipline as every kind above, plus
   * one property none of them has: its own currency is NOT nullable, because a
   * coin with no currency is not money and its denomination could not be
   * verified against anything.
   */
  describe('the whiteboard — tokens kind (the first non-chart instrument)', () => {
    const tokensBoard = {
      kind: 'tokens' as const,
      groups: [
        { denomination: 10, count: 3 },
        { denomination: 1, count: 4 },
      ],
      label: 'Cuenta lo que hay en la mesa',
      currency: 'MXN' as const,
    };

    it('accepts a turn carrying a tokens whiteboard', () => {
      expect(TutorTurnSchema.safeParse({ ...valid, whiteboard: tokensBoard }).success).toBe(true);
    });

    it('never both a tokens whiteboard and a segment request on the same turn', () => {
      expect(
        TutorTurnSchema.safeParse({
          ...valid,
          next: 'segment' as const,
          segmentRequest: {
            skillKey: 'financial-education/contar-monedas',
            difficulty: 2,
            framing: 'Practiquemos contar monedas.',
            rationale: 'reinforce the counting just shown',
          },
          whiteboard: tokensBoard,
        }).success,
      ).toBe(false);
    });

    it('gives the model NO field for the total — asserting it is the learner\'s job, not the tutor\'s', () => {
      // The same rule that keeps `greater` off a comparison: the sum of a pile
      // is the arithmetic being taught, so it is computed server-side and the
      // schema refuses a turn that tries to state it.
      expect(
        TutorTurnSchema.safeParse({ ...valid, whiteboard: { ...tokensBoard, total: 34 } }).success,
      ).toBe(false);
      expect(
        TutorTurnSchema.safeParse({ ...valid, whiteboard: { ...tokensBoard, subtotals: [30, 4] } }).success,
      ).toBe(false);
    });

    it('requires a currency — unlike every other kind, which may leave it null', () => {
      expect(
        TutorTurnSchema.safeParse({ ...valid, whiteboard: { ...tokensBoard, currency: null } }).success,
      ).toBe(false);
    });

    it('refuses a fractional count — half a coin is not on any table', () => {
      expect(
        TutorTurnSchema.safeParse({
          ...valid,
          whiteboard: { ...tokensBoard, groups: [{ denomination: 5, count: 2.5 }] },
        }).success,
      ).toBe(false);
    });

    it('refuses more than 6 piles, and more than 12 of one coin', () => {
      const seven = Array.from({ length: 7 }, () => ({ denomination: 1, count: 1 }));
      expect(TutorTurnSchema.safeParse({ ...valid, whiteboard: { ...tokensBoard, groups: seven } }).success).toBe(false);
      expect(
        TutorTurnSchema.safeParse({
          ...valid,
          whiteboard: { ...tokensBoard, groups: [{ denomination: 1, count: 13 }] },
        }).success,
      ).toBe(false);
    });

    it('drops a malformed tokens board without losing the turn — the fail-open posture', () => {
      // A board the schema cannot accept must never take an otherwise-good turn
      // down with it: `parseTurn` nulls the whiteboard and delivers the rest.
      const raw = JSON.stringify({
        ...valid,
        whiteboard: { ...tokensBoard, groups: [{ denomination: 'ten', count: 3 }] },
      });
      const parsed = parseTurn(raw);
      expect(parsed.ok).toBe(true);
      if (parsed.ok) {
        expect(parsed.turn.whiteboard).toBeNull();
        expect(parsed.turn.say).toBe(valid.say);
      }
    });
  });

  describe('the whiteboard — categories kind (V4 backlog slice)', () => {
    const categoriesBoard = {
      kind: 'categories' as const,
      categories: [
        { label: 'Necesito', value: 40 },
        { label: 'Quiero', value: 35 },
        { label: 'Ahorré', value: 25 },
      ],
      label: 'Cómo repartiste tus 100 pesos',
      currency: 'MXN' as const,
    };

    it('accepts a turn carrying a categories whiteboard', () => {
      expect(TutorTurnSchema.safeParse({ ...valid, whiteboard: categoriesBoard }).success).toBe(true);
    });

    it('never both a categories whiteboard and a segment request on the same turn — same rule as sequence', () => {
      const withBoth = {
        ...valid,
        next: 'segment' as const,
        segmentRequest: {
          skillKey: 'financial-education/necesidades-y-deseos',
          difficulty: 2,
          framing: 'Practiquemos distinguir necesidades de deseos.',
          rationale: 'reinforce the idea just shown',
        },
        whiteboard: categoriesBoard,
      };
      expect(TutorTurnSchema.safeParse(withBoth).success).toBe(false);
    });

    it('refuses fewer than 2 categories — one bar is not a comparison', () => {
      expect(
        TutorTurnSchema.safeParse({
          ...valid,
          whiteboard: { ...categoriesBoard, categories: [categoriesBoard.categories[0]] },
        }).success,
      ).toBe(false);
    });

    it('refuses more than 6 categories — past a glance is not bounded', () => {
      const seven = Array.from({ length: 7 }, (_, i) => ({ label: `Cat ${i}`, value: 1 }));
      expect(
        TutorTurnSchema.safeParse({ ...valid, whiteboard: { ...categoriesBoard, categories: seven } }).success,
      ).toBe(false);
    });

    it('refuses an out-of-range category value', () => {
      expect(
        TutorTurnSchema.safeParse({
          ...valid,
          whiteboard: { ...categoriesBoard, categories: [{ label: 'A', value: -1 }, { label: 'B', value: 5 }] },
        }).success,
      ).toBe(false);
    });

    it('refuses an empty category label', () => {
      expect(
        TutorTurnSchema.safeParse({
          ...valid,
          whiteboard: { ...categoriesBoard, categories: [{ label: '', value: 5 }, { label: 'B', value: 5 }] },
        }).success,
      ).toBe(false);
    });

    it('refuses a categories board carrying a sequence-only field — .strict() closes the vocabulary per kind', () => {
      expect(TutorTurnSchema.safeParse({ ...valid, whiteboard: { ...categoriesBoard, unit: 'week' } }).success).toBe(
        false,
      );
    });

    it('refuses a kind outside the two known values', () => {
      expect(
        TutorTurnSchema.safeParse({ ...valid, whiteboard: { ...categoriesBoard, kind: 'bar_chart' } }).success,
      ).toBe(false);
    });

    it('keeps the lesson when only the CATEGORIES WHITEBOARD is malformed — same fail-open posture as sequence', () => {
      const parsed = parseTurn(
        JSON.stringify({ ...valid, whiteboard: { ...categoriesBoard, categories: [categoriesBoard.categories[0]] } }),
      );
      expect(parsed.ok).toBe(true);
      if (parsed.ok) {
        expect(parsed.turn.whiteboard).toBeNull();
        expect(parsed.turn.say).toBe(valid.say);
      }
    });
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
