/*
 * A second Tutor's invite, carried across sign-in (A.1, D.3 / OD-3 Option B;
 * GAP-FIX-R5 F5-identity-site).
 *
 * An invite link is `/join/TOKEN`. The person who opens it is usually not a
 * verified Tutor yet: a parent a self-registered teen invited, or a second
 * parent. Between the link and the accept they may log in, sign up (and
 * confirm their email, which opens a NEW tab), answer the age question and
 * verify their ID. The token rides through every hop in two places:
 *
 *   - router state (`from: /join/TOKEN`) on the hops the app itself makes;
 *   - this store, for the hops it does not control (the confirmation email's
 *     new tab, the Google round trip). sessionStorage is per tab, so the store
 *     is localStorage, bounded by the invite's own 7-day life and cleared
 *     when the invite is accepted, turns out invalid, or the person signs out
 *     (a shared device must not hand one person's invite to the next).
 *
 * The token authorizes nothing here: Core's accept route stays inside the
 * verified-parent boundary and checks it.
 */

export const INVITE_TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;
const KEY = 'lf.guardian-invite.v1';
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const joinPath = (token: string) => `/join/${encodeURIComponent(token)}`;
export const familyJoinPath = (token: string) => `/family?join=${encodeURIComponent(token)}`;

/** Keeps a well-formed token for the next hops. A malformed one is never stored. */
export function rememberInvite(token: string, now = Date.now()): void {
  if (!INVITE_TOKEN_RE.test(token)) return;
  try { window.localStorage.setItem(KEY, JSON.stringify({ token, savedAt: now })); } catch { /* storage blocked: router state still carries it */ }
}

/** The pending invite token, or null (none, expired, malformed or unreadable). */
export function pendingInvite(now = Date.now()): string | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as { token?: unknown; savedAt?: unknown };
    const fresh = typeof value.savedAt === 'number' && now - value.savedAt >= 0 && now - value.savedAt < INVITE_TTL_MS;
    if (typeof value.token === 'string' && INVITE_TOKEN_RE.test(value.token) && fresh) return value.token;
    window.localStorage.removeItem(KEY);
    return null;
  } catch {
    return null;
  }
}

/** Drops the pending invite (all of them, or only `token`'s). */
export function forgetInvite(token?: string): void {
  try {
    if (token !== undefined && pendingInvite() !== token) return;
    window.localStorage.removeItem(KEY);
  } catch { /* nothing stored */ }
}

/**
 * Where a sign-in continues: the page that asked for it (router state
 * `from`, an in-app path only), else a pending invite's landing, else `home`.
 */
export function continueAfterSignIn(from: unknown, home: string): string {
  if (typeof from === 'string' && from.startsWith('/') && !from.startsWith('//')) return from;
  const token = pendingInvite();
  return token ? joinPath(token) : home;
}
