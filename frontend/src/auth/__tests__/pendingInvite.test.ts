import { beforeEach, describe, expect, it } from 'vitest';
import { continueAfterSignIn, familyJoinPath, forgetInvite, INVITE_TTL_MS, joinPath, pendingInvite, rememberInvite } from '../pendingInvite';

/* GAP-FIX-R5 (A.1, D.3): the pending Tutor invite store the sign-in hops read. */
const TOKEN = 'inviteToken0123456789ab';

beforeEach(() => window.localStorage.clear());

describe('the pending invite', () => {
  it('keeps a well-formed token and never a malformed one', () => {
    rememberInvite('short');
    expect(pendingInvite()).toBeNull();
    rememberInvite('has spaces and/slashes-0123456789');
    expect(pendingInvite()).toBeNull();
    rememberInvite(TOKEN);
    expect(pendingInvite()).toBe(TOKEN);
  });

  it('expires with the invite (7 days) and drops what it cannot read', () => {
    const now = Date.now();
    rememberInvite(TOKEN, now - INVITE_TTL_MS - 1);
    expect(pendingInvite(now)).toBeNull();
    expect(window.localStorage.length).toBe(0);
    window.localStorage.setItem('lf.guardian-invite.v1', '{not json');
    expect(pendingInvite()).toBeNull();
    window.localStorage.setItem('lf.guardian-invite.v1', JSON.stringify({ token: '../../x', savedAt: now }));
    expect(pendingInvite(now)).toBeNull();
    rememberInvite(TOKEN, now + 60_000);
    expect(pendingInvite(now)).toBeNull();
  });

  it('forgets only the named token, or any', () => {
    rememberInvite(TOKEN);
    forgetInvite('otherToken0123456789abcd');
    expect(pendingInvite()).toBe(TOKEN);
    forgetInvite(TOKEN);
    expect(pendingInvite()).toBeNull();
    rememberInvite(TOKEN);
    forgetInvite();
    expect(pendingInvite()).toBeNull();
  });

  it('builds the landing and the Family paths with the token encoded', () => {
    expect(joinPath(TOKEN)).toBe(`/join/${TOKEN}`);
    expect(familyJoinPath(TOKEN)).toBe(`/family?join=${TOKEN}`);
    expect(joinPath('a/b')).toBe('/join/a%2Fb');
  });
});

describe('where a sign-in continues', () => {
  it('prefers the in-app page that asked, refuses another origin, then a pending invite, then home', () => {
    expect(continueAfterSignIn('/tasks', '/learn')).toBe('/tasks');
    expect(continueAfterSignIn('//evil.example/x', '/learn')).toBe('/learn');
    expect(continueAfterSignIn('https://evil.example', '/learn')).toBe('/learn');
    expect(continueAfterSignIn(42, '/learn')).toBe('/learn');
    rememberInvite(TOKEN);
    expect(continueAfterSignIn(undefined, '/learn')).toBe(`/join/${TOKEN}`);
    expect(continueAfterSignIn('//evil.example/x', '/learn')).toBe(`/join/${TOKEN}`);
    expect(continueAfterSignIn('/tasks', '/learn')).toBe('/tasks');
  });
});
