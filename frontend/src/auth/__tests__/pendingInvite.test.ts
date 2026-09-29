import { beforeEach, describe, expect, it } from 'vitest';
import { continueAfterSignIn, familyJoinPath, forgetInvite, INVITE_TTL_MS, joinPath, pendingInvite, rememberInvite } from '../pendingInvite';

/* GAP-FIX-R5 (A.1, D.3): the pending Tutor invite store the sign-in hops read. */
const SAMPLE_INVITE = 'inviteToken0123456789ab';

beforeEach(() => window.localStorage.clear());

describe('the pending invite', () => {
  it('keeps a well-formed token and never a malformed one', () => {
    rememberInvite('short');
    expect(pendingInvite()).toBeNull();
    rememberInvite('has spaces and/slashes-0123456789');
    expect(pendingInvite()).toBeNull();
    rememberInvite(SAMPLE_INVITE);
    expect(pendingInvite()).toBe(SAMPLE_INVITE);
  });

  it('expires with the invite (7 days) and drops what it cannot read', () => {
    const now = Date.now();
    rememberInvite(SAMPLE_INVITE, now - INVITE_TTL_MS - 1);
    expect(pendingInvite(now)).toBeNull();
    expect(window.localStorage.length).toBe(0);
    window.localStorage.setItem('lf.guardian-invite.v1', '{not json');
    expect(pendingInvite()).toBeNull();
    window.localStorage.setItem('lf.guardian-invite.v1', JSON.stringify({ token: '../../x', savedAt: now }));
    expect(pendingInvite(now)).toBeNull();
    rememberInvite(SAMPLE_INVITE, now + 60_000);
    expect(pendingInvite(now)).toBeNull();
  });

  it('forgets only the named token, or any', () => {
    rememberInvite(SAMPLE_INVITE);
    forgetInvite('otherToken0123456789abcd');
    expect(pendingInvite()).toBe(SAMPLE_INVITE);
    forgetInvite(SAMPLE_INVITE);
    expect(pendingInvite()).toBeNull();
    rememberInvite(SAMPLE_INVITE);
    forgetInvite();
    expect(pendingInvite()).toBeNull();
  });

  it('builds the landing and the Family paths with the token encoded', () => {
    expect(joinPath(SAMPLE_INVITE)).toBe(`/join/${SAMPLE_INVITE}`);
    expect(familyJoinPath(SAMPLE_INVITE)).toBe(`/family?join=${SAMPLE_INVITE}`);
    expect(joinPath('a/b')).toBe('/join/a%2Fb');
  });
});

describe('where a sign-in continues', () => {
  it('prefers the in-app page that asked, refuses another origin, then a pending invite, then home', () => {
    expect(continueAfterSignIn('/tasks', '/learn')).toBe('/tasks');
    expect(continueAfterSignIn('//evil.example/x', '/learn')).toBe('/learn');
    expect(continueAfterSignIn('https://evil.example', '/learn')).toBe('/learn');
    expect(continueAfterSignIn(42, '/learn')).toBe('/learn');
    rememberInvite(SAMPLE_INVITE);
    expect(continueAfterSignIn(undefined, '/learn')).toBe(`/join/${SAMPLE_INVITE}`);
    expect(continueAfterSignIn('//evil.example/x', '/learn')).toBe(`/join/${SAMPLE_INVITE}`);
    expect(continueAfterSignIn('/tasks', '/learn')).toBe('/tasks');
  });
});
