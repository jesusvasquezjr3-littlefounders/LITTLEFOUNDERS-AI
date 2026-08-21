import crypto from 'crypto';
import { getConfig } from '../config.js';

/*
 * Minting the live-session token the browser carries to Oracle
 * (/ORACLE.md §3.2, /AGENTS.md §1.5 Oracle exception).
 *
 * The FORMAT IS DUPLICATED between here and `oracle/src/session/token.ts`, and
 * that is a deliberate choice rather than an oversight. This repository has no
 * npm workspaces (§1.2), so a shared package does not exist; the alternatives
 * were a copied file with a drift test — which is what the lesson graders do —
 * or a runtime call to Oracle to mint, which would put Oracle on the critical
 * path of starting a session it might then refuse.
 *
 * The parity test (`backend/src/__tests__/tutor-token.test.ts`) pins the wire
 * format against the same vectors Oracle's own test uses. If the two ever
 * disagree, that test fails before a learner sees a socket that will not open.
 *
 * Three properties the token must have, and why each one:
 *
 * - SHORT-LIVED (60s). It travels in a query string, because a browser cannot
 *   set headers on a WebSocket handshake. Sixty seconds is long enough to open
 *   a socket and short enough that a screen recording is worthless.
 * - SINGLE-USE. Oracle burns the nonce. A copied URL opens nothing.
 * - SESSION-SCOPED. It names one session id, so even a valid signature cannot
 *   be pointed at somebody else's conversation.
 */

const PREFIX = 'v1';

/** Sixty seconds: enough to open one socket, useless the moment it is shared. */
export const SESSION_TOKEN_TTL_SECONDS = 60;

export interface SessionTokenPayload {
  sid: string;
  uid: string;
  exp: number;
  jti: string;
}

function sign(body: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('base64url');
}

export function mintTutorSessionToken(
  sessionId: string,
  userId: string,
  now = Date.now(),
): { token: string; expiresAt: string } {
  const payload: SessionTokenPayload = {
    sid: sessionId,
    uid: userId,
    exp: Math.floor(now / 1000) + SESSION_TOKEN_TTL_SECONDS,
    jti: crypto.randomBytes(16).toString('base64url'),
  };
  const body = `${PREFIX}.${Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')}`;
  return {
    token: `${body}.${sign(body, getConfig().TUTOR_SESSION_SECRET)}`,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
  };
}

/**
 * The websocket URL the browser should open.
 *
 * Built here rather than in the client so the token never has to be handed to
 * the frontend as a separate value it might log, store, or put in a router
 * state that survives a back navigation.
 */
export function tutorSocketUrl(sessionId: string, userId: string): { url: string; expiresAt: string } {
  const { ORACLE_PUBLIC_URL } = getConfig();
  const { token, expiresAt } = mintTutorSessionToken(sessionId, userId);
  const base = ORACLE_PUBLIC_URL.replace(/^http/, 'ws').replace(/\/+$/, '');
  return { url: `${base}/ws/tutor?token=${encodeURIComponent(token)}`, expiresAt };
}
