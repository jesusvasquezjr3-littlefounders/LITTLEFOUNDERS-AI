import { beforeEach, describe, expect, it } from 'vitest';
import {
  looksLikeSupabaseJwt,
  mintSessionToken,
  nonceLedger,
  verifySessionToken,
} from '../session/token.js';
import { evaluateBudget } from '../session/budget.js';
import { getConfig } from '../env.js';
import { parseTurn, TutorTurnSchema } from '../tutor/turnSchema.js';

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
});
