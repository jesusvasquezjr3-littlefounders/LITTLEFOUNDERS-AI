import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import en from '@/i18n/en-US/rebuild-site.json';
import { familyShellRoutes } from '@/app-routes/family';
import { RequireGuest } from '@/auth/RequireGuest';
import { pendingInvite, rememberInvite } from '@/auth/pendingInvite';
import { JoinInvitePage } from '../JoinInvitePage';
import { LoginPage } from '@/routes/auth/LoginPage';
import { SignupPage } from '@/routes/auth/SignupPage';
import { VerifyParentPage } from '@/routes/auth/VerifyParentPage';
import { AuthCallbackPage } from '@/routes/auth/AuthCallbackPage';

/*
 * GAP-FIX-R5 (A.1 FAQ "twoParents"; D.3 / OD-3 Option B: a teen invites a
 * parent; Law 5). An invite link reaches a person who is usually not a
 * verified Tutor yet. Every hop between the link and the accept keeps the
 * token: the landing, the Family route, log-in, sign-up (with and without the
 * email confirmation), the Google return, the signed-in redirect of the
 * sign-in pages and verification. Only a verified Tutor reaches the accept.
 */
const j = en.authJoin;
const SAMPLE_INVITE = 'inviteToken0123456789ab';
type Auth = { session: unknown; isGuest: boolean; roles: string[]; meLoaded: boolean };
const auth = vi.hoisted(() => ({
  state: { session: null, isGuest: false, roles: [], meLoaded: true } as { session: unknown; isGuest: boolean; roles: string[]; meLoaded: boolean },
  logout: vi.fn(), login: vi.fn(), signup: vi.fn(), completeOAuth: vi.fn(), api: vi.fn(),
  getToken: vi.fn(async () => 'synthetic'), refreshMe: vi.fn(), startGuestSession: vi.fn(),
}));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({
  ...auth.state, logout: auth.logout, login: auth.login, signup: auth.signup, completeOAuth: auth.completeOAuth,
  startGuestSession: auth.startGuestSession, getToken: auth.getToken, refreshMe: auth.refreshMe, suspended: false, deleted: false,
}) }));
vi.mock('@/lib/api', () => ({ api: auth.api }));
vi.mock('@/lib/insights', () => ({ configureInsights: vi.fn(), trackInsight: vi.fn(), flushInsights: vi.fn() }));
vi.mock('@/lib/sound', () => ({ playPlatformSound: vi.fn() }));
vi.mock('@/auth/oauth', () => ({ fetchEnabledProviders: vi.fn().mockResolvedValue([]), startOAuth: vi.fn() }));
vi.mock('@/routes/app/family/FamilyPage', () => ({ FamilyPage: () => <p>Family page</p> }));

const signedIn = (roles: string[], extra: Partial<Auth> = {}) => { auth.state = { session: { user: { id: 'u1' } }, isGuest: false, roles, meLoaded: true, ...extra }; };
const signedOut = () => { auth.state = { session: null, isGuest: false, roles: [], meLoaded: true }; };

/** Where the app is now, with the router state it carries. */
function Where() {
  const location = useLocation();
  return <output data-testid="where" data-state={JSON.stringify(location.state ?? null)}>{location.pathname + location.search}</output>;
}
const where = () => screen.getByTestId('where');

function app(entry: string | { pathname: string; state: unknown }) {
  return render(<MemoryRouter initialEntries={[entry]}><Routes>
    <Route path="/join/:token" element={<><JoinInvitePage /><Where /></>} />
    <Route path="/login" element={<><RequireGuest><LoginPage /></RequireGuest><Where /></>} />
    <Route path="/signup" element={<><RequireGuest><SignupPage /></RequireGuest><Where /></>} />
    <Route path="/verify-parent" element={<><VerifyParentPage /><Where /></>} />
    <Route path="/auth/callback" element={<AuthCallbackPage />} />
    {familyShellRoutes}
    <Route path="*" element={<Where />} />
  </Routes></MemoryRouter>);
}

beforeEach(async () => {
  vi.clearAllMocks();
  window.localStorage.clear();
  signedOut();
  await i18n.changeLanguage('en-US');
});

describe('the invite landing, /join/:token', () => {
  it('offers a signed-out visitor sign-up and log-in, keeps the token, and carries it in router state', async () => {
    app(`/join/${SAMPLE_INVITE}`);
    expect(screen.getByRole('heading', { level: 1, name: j.title })).toBeInTheDocument();
    expect(pendingInvite()).toBe(SAMPLE_INVITE);
    expect(document.querySelector('[data-screen="join-invite"]')!.textContent).not.toContain(SAMPLE_INVITE);
    fireEvent.click(screen.getByRole('link', { name: j.create }));
    await waitFor(() => expect(where()).toHaveTextContent('/signup?intent=tutor'));
    expect(JSON.parse(where().dataset.state!)).toEqual({ from: `/join/${SAMPLE_INVITE}` });
    expect(screen.getByRole('checkbox', { name: new RegExp(en.authSignup.tutorIntent) })).toBeChecked();
  });

  it('treats a guest as signed out (a guest must sign up or log in first)', () => {
    signedIn(['universal'], { isGuest: true });
    app(`/join/${SAMPLE_INVITE}`);
    expect(screen.getByRole('link', { name: j.login })).toHaveAttribute('href', '/login');
  });

  it('sends a verified Tutor straight to the invite on the Family page', async () => {
    signedIn(['parent']);
    app(`/join/${SAMPLE_INVITE}`);
    await screen.findByText('Family page');
  });

  it('tells a signed-in adult who is not a Tutor to verify, with the one brand action, and never shows the Family page', () => {
    signedIn(['universal']);
    app(`/join/${SAMPLE_INVITE}`);
    expect(screen.getByRole('heading', { level: 1, name: j.verifyTitle })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: j.verify })).toHaveAttribute('href', '/verify-parent');
    expect(screen.queryByText('Family page')).toBeNull();
    expect(pendingInvite()).toBe(SAMPLE_INVITE);
  });

  it('lets the wrong account step aside and keeps the token for the next one', async () => {
    signedIn(['universal']);
    auth.logout.mockImplementation(async () => { window.localStorage.clear(); signedOut(); });
    app(`/join/${SAMPLE_INVITE}`);
    fireEvent.click(screen.getByRole('button', { name: j.otherAccount }));
    await waitFor(() => expect(auth.logout).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(pendingInvite()).toBe(SAMPLE_INVITE));
  });

  it('tells a parent-created child the link is for an adult', () => {
    signedIn(['kid']);
    app(`/join/${SAMPLE_INVITE}`);
    expect(screen.getByRole('heading', { level: 1, name: j.childTitle })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: j.verify })).toBeNull();
  });

  it('refuses a malformed link and keeps nothing', () => {
    app('/join/short');
    expect(screen.getByRole('heading', { level: 1, name: j.invalidTitle })).toBeInTheDocument();
    expect(pendingInvite()).toBeNull();
  });

  it('waits for the roles before deciding', () => {
    signedIn([], { meLoaded: false });
    app(`/join/${SAMPLE_INVITE}`);
    expect(document.querySelector('[data-join-state="checking"]')).not.toBeNull();
  });
});

describe('the older link form, /family?join=TOKEN', () => {
  it('sends anyone who is not a Tutor to the landing with the token, never to Learn without it', async () => {
    signedIn(['universal']);
    app(`/family?join=${SAMPLE_INVITE}`);
    await screen.findByRole('heading', { level: 1, name: j.verifyTitle });
  });

  it('opens the Family page for a verified Tutor', async () => {
    signedIn(['parent']);
    app(`/family?join=${SAMPLE_INVITE}`);
    await screen.findByText('Family page');
  });

  it('still keeps a non-Tutor out of /family without an invite', async () => {
    signedIn(['universal']);
    app('/family');
    await waitFor(() => expect(where()).toHaveTextContent('/learn'));
  });
});

describe('each sign-in hop keeps the invite', () => {
  it('log-in returns to the landing from router state', async () => {
    auth.login.mockImplementation(async () => { signedIn(['universal']); return { error: null, analyticsEnabled: false }; });
    app({ pathname: '/login', state: { from: `/join/${SAMPLE_INVITE}` } });
    fireEvent.change(screen.getByLabelText(en.authLogin.identifier), { target: { value: 'parent@example.test' } });
    fireEvent.change(screen.getByLabelText(en.authCommon.password), { target: { value: 'synthetic-password' } });
    fireEvent.click(screen.getByRole('button', { name: en.authLogin.submit }));
    await screen.findByRole('heading', { level: 1, name: j.verifyTitle });
  });

  it('log-in with no router state (the confirmation email\'s new tab) continues to a pending invite', async () => {
    rememberInvite(SAMPLE_INVITE);
    auth.login.mockImplementation(async () => { signedIn(['universal']); return { error: null, analyticsEnabled: false }; });
    app('/login');
    fireEvent.change(screen.getByLabelText(en.authLogin.identifier), { target: { value: 'parent@example.test' } });
    fireEvent.change(screen.getByLabelText(en.authCommon.password), { target: { value: 'synthetic-password' } });
    fireEvent.click(screen.getByRole('button', { name: en.authLogin.submit }));
    await screen.findByRole('heading', { level: 1, name: j.verifyTitle });
  });

  it('sign-up continues to the page that asked for it', async () => {
    auth.signup.mockImplementation(async () => { signedIn(['universal']); return { error: null, confirmationRequired: false, analyticsEnabled: false }; });
    const { container } = app({ pathname: '/signup', state: { from: `/join/${SAMPLE_INVITE}` } });
    fireEvent.change(screen.getByLabelText(en.authSignup.name), { target: { value: 'Synthetic' } });
    fireEvent.change(screen.getByLabelText(en.authCommon.email), { target: { value: 'parent@example.test' } });
    fireEvent.change(screen.getByLabelText(en.authCommon.password), { target: { value: 'synthetic-password' } });
    fireEvent.change(screen.getByLabelText(en.authCommon.day), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText(en.authCommon.month), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText(en.authCommon.year), { target: { value: '1988' } });
    fireEvent.submit(container.querySelector('form')!);
    await screen.findByRole('heading', { level: 1, name: j.verifyTitle });
  });

  it('sign-up that needs email confirmation keeps the pending invite for the sign-in that follows', async () => {
    rememberInvite(SAMPLE_INVITE);
    auth.signup.mockResolvedValue({ error: null, confirmationRequired: true, analyticsEnabled: false });
    const { container } = app({ pathname: '/signup', state: { from: `/join/${SAMPLE_INVITE}` } });
    fireEvent.change(screen.getByLabelText(en.authSignup.name), { target: { value: 'Synthetic' } });
    fireEvent.change(screen.getByLabelText(en.authCommon.email), { target: { value: 'parent@example.test' } });
    fireEvent.change(screen.getByLabelText(en.authCommon.password), { target: { value: 'synthetic-password' } });
    fireEvent.change(screen.getByLabelText(en.authCommon.day), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText(en.authCommon.month), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText(en.authCommon.year), { target: { value: '1988' } });
    fireEvent.submit(container.querySelector('form')!);
    await screen.findByRole('heading', { level: 1, name: en.authSignup.confirmTitle });
    expect(pendingInvite()).toBe(SAMPLE_INVITE);
  });

  it('the Google return continues to a pending invite', async () => {
    rememberInvite(SAMPLE_INVITE);
    auth.completeOAuth.mockImplementation(async () => { signedIn(['universal']); return { error: null, newAccount: true, analyticsEnabled: false }; });
    window.history.replaceState(null, '', '/auth/callback#access_token=a&refresh_token=b&expires_in=3600');
    app('/auth/callback');
    await screen.findByRole('heading', { level: 1, name: j.verifyTitle });
  });

  it('a signed-in account opening /login goes on to a pending invite', async () => {
    rememberInvite(SAMPLE_INVITE);
    signedIn(['universal']);
    app('/login');
    await screen.findByRole('heading', { level: 1, name: j.verifyTitle });
  });

  it('verification returns to the invite on the Family page, named as the invite', async () => {
    rememberInvite(SAMPLE_INVITE);
    signedIn(['universal']);
    auth.api.mockResolvedValue({ data: { verified: true }, error: null });
    app('/verify-parent');
    const link = await screen.findByRole('link', { name: en.authVerify.openInvite });
    expect(link).toHaveAttribute('href', `/family?join=${SAMPLE_INVITE}`);
  });

  it('verification with no invite keeps the bare Family link', async () => {
    signedIn(['universal']);
    auth.api.mockResolvedValue({ data: { verified: true }, error: null });
    app('/verify-parent');
    expect(await screen.findByRole('link', { name: en.authVerify.openFamily })).toHaveAttribute('href', '/family');
  });
});
