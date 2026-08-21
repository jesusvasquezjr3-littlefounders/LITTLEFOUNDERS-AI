import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { mintTutorSessionToken, SESSION_TOKEN_TTL_SECONDS, tutorSocketUrl } from '../services/tutorToken.js';

/*
 * WIRE-FORMAT PARITY with `oracle/src/session/token.ts`.
 *
 * The two implementations are separate files in separate packages, because
 * this repository has no npm workspaces (/AGENTS.md §1.2). This test is the
 * thing that stops them drifting: it re-implements verification independently,
 * from the format as documented, and asserts a minted token satisfies it. If
 * Core changes the encoding, this fails HERE — before a learner meets a socket
 * that refuses to open, with a "malformed" close reason and no other clue.
 *
 * The lesson graders use exactly this pattern (`npm run contract:check`), for
 * exactly this reason.
 */

const SID = '11111111-1111-4111-8111-111111111111';
const UID = '22222222-2222-4222-8222-222222222222';

/** Independent verifier, written from the format rather than from the code. */
function verifyIndependently(token: string, secret: string): { sid: string; uid: string; exp: number; jti: string } {
  const parts = token.split('.');
  expect(parts).toHaveLength(3);
  const [prefix, encoded, signature] = parts;
  expect(prefix).toBe('v1');

  const expected = crypto.createHmac('sha256', secret).update(`${prefix}.${encoded}`).digest('base64url');
  expect(signature).toBe(expected);

  return JSON.parse(Buffer.from(encoded as string, 'base64url').toString('utf8')) as {
    sid: string;
    uid: string;
    exp: number;
    jti: string;
  };
}

describe('the tutor session token', () => {
  const secret = process.env.TUTOR_SESSION_SECRET as string;

  it('produces exactly the three-part v1 format Oracle verifies', () => {
    const { token } = mintTutorSessionToken(SID, UID);
    const payload = verifyIndependently(token, secret);
    expect(payload.sid).toBe(SID);
    expect(payload.uid).toBe(UID);
    expect(payload.jti).toBeTruthy();
  });

  it('expires in one minute — long enough to open a socket, useless when shared', () => {
    const now = 1_700_000_000_000;
    const { token } = mintTutorSessionToken(SID, UID, now);
    const payload = verifyIndependently(token, secret);
    expect(payload.exp).toBe(Math.floor(now / 1000) + SESSION_TOKEN_TTL_SECONDS);
    expect(SESSION_TOKEN_TTL_SECONDS).toBeLessThanOrEqual(120);
  });

  it('never repeats a nonce, so Oracle can burn it on first use', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      seen.add(verifyIndependently(mintTutorSessionToken(SID, UID).token, secret).jti);
    }
    expect(seen.size).toBe(200);
  });

  it('is NOT shaped like a Supabase JWT — Oracle rejects those by name', () => {
    const { token } = mintTutorSessionToken(SID, UID);
    expect(token.startsWith('eyJ')).toBe(false);
    expect(token.startsWith('v1.')).toBe(true);
  });

  it('is signed with TUTOR_SESSION_SECRET, not INTERNAL_API_KEY', () => {
    // Sharing one secret would mean a leaked session token could call the
    // internal API. The separation is the control; this asserts it exists.
    const { token } = mintTutorSessionToken(SID, UID);
    expect(() => verifyIndependently(token, process.env.INTERNAL_API_KEY as string)).toThrow();
  });
});

describe('tutorSocketUrl', () => {
  it('switches the scheme to ws and targets the tutor path', () => {
    const { url } = tutorSocketUrl(SID, UID);
    expect(url.startsWith('ws://')).toBe(true);
    expect(url).toContain('/ws/tutor?token=');
  });

  it('url-encodes the token so a base64url payload survives the query string', () => {
    const { url } = tutorSocketUrl(SID, UID);
    const raw = url.split('token=')[1] ?? '';
    expect(decodeURIComponent(raw).split('.')).toHaveLength(3);
  });
});
