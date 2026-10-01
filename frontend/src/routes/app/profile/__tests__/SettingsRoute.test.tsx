import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { RebuildProvider } from '@/rebuild/design/controls';
import { invalidateWalletAccess } from '@/routes/app/wallet/useWalletAccess';
import { SettingsRoute } from '../SettingsRoute';

/*
 * P3 on its real data plane: every age-tier rule the page states (A.6, E.4,
 * E.13), the sign-in changes, blocked accounts and the composed panels.
 * Core is mocked at the client boundary; nothing leaves the test.
 */

const mocks = vi.hoisted(() => ({
  api: vi.fn(), token: vi.fn().mockResolvedValue('synthetic'), refresh: vi.fn().mockResolvedValue(undefined), logout: vi.fn(),
  auth: { roles: [] as string[], isGuest: false, email: 'ana@example.test' as string | undefined },
}));
vi.mock('@/lib/api', () => ({ api: mocks.api, BASE_URL: 'http://core.test' }));
vi.mock('@/lib/insights', () => ({ trackInsight: vi.fn(), configureInsights: vi.fn() }));
vi.mock('@/lib/sound', () => ({ playPlatformSound: vi.fn() }));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ isDark: false, choice: 'auto', setChoice: vi.fn() }) }));
// One stable value per test, like the real provider's (hooks depend on the session object's identity).
let authValue: Record<string, unknown> = {};
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => authValue }));
function signIn() {
  authValue = {
    session: { user: { id: '33333333-3333-4333-8333-333333333333', email: mocks.auth.email }, isGuest: mocks.auth.isGuest },
    isGuest: mocks.auth.isGuest, roles: mocks.auth.roles, meLoaded: true, getToken: mocks.token, refreshMe: mocks.refresh, logout: mocks.logout,
  };
}

const PROFILE = { displayName: 'Ana Ruiz', username: 'ana_ruiz', locale: 'en-US', birthDate: '2016-05-01' };
const DISPOSITION = { exists: true, current: true, sessionsObserved: 5, helpStyle: 'independent', persistence: 'persists', explanation: 'unknown',
  persistentlyDeclined: [], typicalReplySeconds: 12, personas: [], effects: [], updatedAt: '2026-09-20T10:00:00Z' };
type Answer = { data: unknown; error: null } | { data: null; error: { code: string; message: string; fields?: string[] } };
let routes: Record<string, Answer>;
const ok = (data: unknown): Answer => ({ data, error: null });
const refuse = (code: string, extra: Record<string, unknown> = {}): Answer => ({ data: null, error: { code, message: 'refused', ...extra } });

beforeEach(async () => {
  vi.clearAllMocks();
  invalidateWalletAccess();
  mocks.auth.roles = [];
  mocks.auth.isGuest = false;
  mocks.auth.email = 'ana@example.test';
  routes = {
    'GET /profile': ok(PROFILE),
    'GET /profile/blocked': ok({ users: [] }),
    'GET /auth/analytics-preference': ok({ canManage: false, enabled: false, disclosed: true }),
    'GET /tutor/memory-proposals': refuse('FORBIDDEN'),
    'GET /wallet/access': ok({ holder: null, familyChild: false }),
  };
  mocks.api.mockImplementation(async (path: string, options: { method?: string } = {}) => routes[`${options.method ?? 'GET'} ${path}`] ?? ok({ updated: true }));
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const body = String(url).endsWith('/account/deletion')
      ? { data: { deletion: null, eligibility: mocks.auth.roles.includes('kid') ? { allowed: false, reason: 'kid' }
        : { allowed: true, population: mocks.auth.isGuest ? 'guest' : 'adult', graceDays: mocks.auth.isGuest ? 0 : 14, immediate: mocks.auth.isGuest,
          reauth: mocks.auth.isGuest ? 'none' : 'password', children: { lastTutorOf: 0, sharedTutorOf: 0 } } }, error: null }
      : String(url).endsWith('/tutor/disposition') && init?.method === 'DELETE' ? { data: { reset: true }, error: null }
        : String(url).endsWith('/tutor/disposition') ? { data: DISPOSITION, error: null } : { data: null, error: { code: 'NOT_FOUND', message: 'none' } };
    return new Response(JSON.stringify(body), { status: body.error ? 404 : 200, headers: { 'Content-Type': 'application/json' } });
  }));
  await i18n.changeLanguage('en-US');
});

function renderSettings() {
  signIn();
  return render(<MemoryRouter initialEntries={['/profile/settings']}>
    <RebuildProvider environment={{ theme: 'light', locale: 'en-US' }} labels={{ dismiss: 'Dismiss' }}><SettingsRoute /></RebuildProvider>
  </MemoryRouter>);
}
const patched = () => mocks.api.mock.calls.filter(([, options]) => options?.method === 'PATCH').map(([, options]) => options.body);

describe('Settings (P3)', () => {
  it('shows the birth date as data that cannot be edited (E.4) and saves only what changed, plus the language', async () => {
    renderSettings();
    const name = await screen.findByLabelText('Name');
    expect(screen.getByText('Wrong? Request a correction below.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Birth date')).toBeNull();
    fireEvent.change(name, { target: { value: 'Ana María' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));
    expect(await screen.findByText('Details saved.')).toBeInTheDocument();
    expect(patched()).toEqual([{ displayName: 'Ana María', locale: 'en-US' }]);
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it('keeps a child account\'s username and has no email of its own (A.6); the child still sees how the Mentor adapts, without a reset', async () => {
    mocks.auth.roles = ['kid'];
    renderSettings();
    await screen.findByLabelText('Name');
    expect(screen.queryByLabelText('Username')).toBeNull();
    expect(screen.getByText('ana_ruiz')).toBeInTheDocument();
    expect(screen.getByText('Your sign-in name stays the same.')).toBeInTheDocument();
    // The youngest register: the adult's helper lines are left out (the date row has no control to begin with).
    expect(screen.getByText('May 1, 2016')).toBeInTheDocument();
    expect(screen.queryByText('Wrong? Request a correction below.')).toBeNull();
    expect(screen.queryByText('Lessons and the app use this language.')).toBeNull();
    expect(screen.getByText('A child account has no email. Your Tutor manages sign-in.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change email' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Change password' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ana' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));
    await screen.findByText('Details saved.');
    expect(patched()).toEqual([{ displayName: 'Ana', locale: 'en-US' }]);
    expect(await screen.findByText('Tries first, then asks')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reset profile' })).toBeNull();
    // E.6: a parent-created child cannot delete their own account.
    expect(await screen.findByText(/Tutor/, { selector: '.lf-account-deletion p' })).toBeInTheDocument();
  });

  it('offers a guest the account upgrade instead of sign-in rows, and the immediate deletion (E.6)', async () => {
    mocks.auth.isGuest = true;
    mocks.auth.email = undefined;
    renderSettings();
    expect(await screen.findByRole('link', { name: 'Create account' })).toHaveAttribute('href', '/upgrade-account');
    expect(screen.queryByText('Email and password')).toBeNull();
    expect(await screen.findByText('We delete your account and its data as soon as you confirm.')).toBeInTheDocument();
  });

  it('maps Core\'s refusals to the field they concern (USERNAME_TAKEN, E.13 PROFILE_FIELD_UNSAFE)', async () => {
    renderSettings();
    const username = await screen.findByLabelText('Username');
    fireEvent.change(username, { target: { value: 'Ana Ruiz!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));
    expect(await screen.findByText('Use only a to z, 0 to 9 and _.')).toBeInTheDocument();
    expect(patched()).toEqual([]);
    routes['PATCH /profile'] = refuse('USERNAME_TAKEN');
    fireEvent.change(username, { target: { value: 'taken_name' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));
    expect(await screen.findByText('That username is taken. Try another.')).toBeInTheDocument();
    routes['PATCH /profile'] = refuse('PROFILE_FIELD_UNSAFE', { fields: ['username'] });
    fireEvent.change(username, { target: { value: 'ana_insta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));
    expect(await screen.findByText('This could help strangers find you. Try another.')).toBeInTheDocument();
    expect(patched()).toEqual([{ username: 'taken_name', locale: 'en-US' }, { username: 'ana_insta', locale: 'en-US' }]);
  });

  it('changes the email only as a pending change confirmed by the link, and says when the password was wrong', async () => {
    renderSettings();
    fireEvent.click(await screen.findByRole('button', { name: 'Change email' }));
    fireEvent.change(screen.getByLabelText('New email'), { target: { value: 'new@example.test' } });
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'wrong' } });
    routes['POST /auth/change-email'] = refuse('INVALID_CREDENTIALS');
    fireEvent.click(screen.getByRole('button', { name: 'Send link' }));
    expect(await screen.findByText('That password is not right.')).toBeInTheDocument();
    routes['POST /auth/change-email'] = ok({ pending: true });
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'right-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send link' }));
    expect(await screen.findByText('Open the link we sent to new@example.test.')).toBeInTheDocument();
    expect(screen.getByText('ana@example.test')).toBeInTheDocument();
    expect(mocks.api).toHaveBeenCalledWith('/auth/change-email', { method: 'POST', token: 'synthetic', body: { newEmail: 'new@example.test', currentPassword: 'right-password' } });
  });

  it('refuses a short new password before Core, then changes it', async () => {
    renderSettings();
    fireEvent.click(await screen.findByRole('button', { name: 'Change password' }));
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'old-password' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save password' }));
    expect(await screen.findByText('Use at least 8 characters.')).toBeInTheDocument();
    expect(mocks.api).not.toHaveBeenCalledWith('/auth/change-password', expect.anything());
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'long-enough' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save password' }));
    expect(await screen.findByText('Password changed.')).toBeInTheDocument();
  });

  it('unblocks an account, and keeps it listed when Core refuses', async () => {
    routes['GET /profile/blocked'] = ok({ users: [{ userId: 'b1', displayName: 'Beto', username: 'beto_1' }, { userId: 'b2', displayName: 'Cris', username: 'cris_2' }] });
    routes['DELETE /profiles/cris_2/block'] = refuse('INTERNAL');
    renderSettings();
    const card = (await screen.findByText('Blocked accounts')).closest('section')!;
    const beto = (await within(card).findByText('Beto')).closest('li')!;
    fireEvent.click(within(beto).getByRole('button', { name: 'Unblock' }));
    await waitFor(() => expect(within(card).queryByText('Beto')).toBeNull());
    const cris = within(card).getByText('Cris').closest('li')!;
    fireEvent.click(within(cris).getByRole('button', { name: 'Unblock' }));
    expect(await within(cris).findByText('Could not unblock. Try again.')).toBeInTheDocument();
  });

  it('shows a failure with a retry, never an empty form, when the profile does not load', async () => {
    routes['GET /profile'] = refuse('INTERNAL');
    renderSettings();
    expect(await screen.findByText('Settings did not load')).toBeInTheDocument();
    expect(screen.queryByLabelText('Name')).toBeNull();
    routes['GET /profile'] = ok(PROFILE);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByLabelText('Name')).toHaveValue('Ana Ruiz');
  });

  it('lets an adult reset how the Mentor adapts, and keeps the mode and sign-out on the page', async () => {
    renderSettings();
    fireEvent.click(await screen.findByRole('button', { name: 'Reset profile' }));
    expect(await screen.findByText('Nothing yet. It builds after a few sessions.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    const mode = screen.getByRole('button', { name: 'Dark' });
    expect(mode.querySelector('svg')).not.toBeNull();
    expect(mode).toHaveTextContent(/^$/);
  });
});

describe('Settings (P3): a 16-17-year-old\'s choice to be found (OD-27 (2))', () => {
  const TEEN = (discoverable: unknown) => ok({ ...PROFILE, birthDate: '2009-05-01', social: { tier: 'teen', privateProfile: true, discoverable } });
  const put = () => mocks.api.mock.calls.filter(([path, options]) => path === '/profile/discoverable' && options?.method === 'PUT').map(([, options]) => options.body);
  const card = async () => (await screen.findByText('Who can find you')).closest('section')!;

  it('is not offered to a child, an adult, a teen Core does not offer it to, or when Core does not send it', async () => {
    for (const answer of [
      ok(PROFILE),
      ok({ ...PROFILE, social: { tier: 'adult', privateProfile: false, discoverable: { canChoose: true, enabled: false } } }),
      ok({ ...PROFILE, social: { tier: 'guardian', privateProfile: true, discoverable: { canChoose: true, enabled: true } } }),
      TEEN({ canChoose: false, enabled: false }),
      TEEN(undefined),
      TEEN({ canChoose: 'yes', enabled: false }),
    ]) {
      routes['GET /profile'] = answer;
      const view = renderSettings();
      await screen.findByLabelText('Name');
      expect(screen.queryByText('Who can find you')).toBeNull();
      view.unmount();
    }
    expect(put()).toEqual([]);
  });

  it('asks before turning it on, sends nothing on Keep private, and shows Core\'s receipt after confirming', async () => {
    routes['GET /profile'] = TEEN({ canChoose: true, enabled: false });
    routes['PUT /profile/discoverable'] = ok({ discoverable: { canChoose: true, enabled: true } });
    renderSettings();
    const section = await card();
    expect(within(section).getByText('Your profile is private. Only people you accept can see it.')).toBeInTheDocument();
    expect(within(section).getByText('People still ask before they follow you. Nobody can message you.')).toBeInTheDocument();
    const toggle = within(section).getByRole('switch', { name: 'Let people find my profile' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(toggle);
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Anyone with an account will see your profile. Turn it off anytime.')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep private' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(put()).toEqual([]);
    fireEvent.click(toggle);
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Turn on' }));
    expect(await within(section).findByText('Saved.')).toBeInTheDocument();
    expect(put()).toEqual([{ discoverable: true }]);
    expect(within(section).getByRole('switch', { name: 'Let people find my profile' })).toHaveAttribute('aria-checked', 'true');
    expect(within(section).getByText('People can find you. Anyone with an account can see your profile.')).toBeInTheDocument();
  });

  it('turns it off in one press, and keeps it on when Core does not confirm', async () => {
    routes['GET /profile'] = TEEN({ canChoose: true, enabled: true });
    routes['PUT /profile/discoverable'] = refuse('INTERNAL');
    renderSettings();
    const section = await card();
    const toggle = within(section).getByRole('switch', { name: 'Let people find my profile' });
    fireEvent.click(toggle);
    expect(await within(section).findByText('This change was not saved. Try again.')).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    routes['PUT /profile/discoverable'] = ok({ discoverable: { canChoose: true, enabled: false } });
    fireEvent.click(toggle);
    expect(await within(section).findByText('Saved.')).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(put()).toEqual([{ discoverable: false }, { discoverable: false }]);
  });

  it('hides the switch and says so when Core refuses the choice', async () => {
    routes['GET /profile'] = TEEN({ canChoose: true, enabled: false });
    routes['PUT /profile/discoverable'] = refuse('DISCOVERABLE_NOT_ELIGIBLE');
    renderSettings();
    const section = await card();
    fireEvent.click(within(section).getByRole('switch', { name: 'Let people find my profile' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Turn on' }));
    expect(await within(section).findByText('This choice is not available for your account now.')).toBeInTheDocument();
    expect(within(section).queryByRole('switch')).toBeNull();
    expect(within(section).getByText('Your profile is private. Only people you accept can see it.')).toBeInTheDocument();
  });

  // OD-9 4.2 (GAP-FIX-R3): a migrated teen whose Tutor has not consented yet.
  it('says a Tutor must allow it first, with no switch, when Core names the missing consent', async () => {
    routes['GET /profile'] = TEEN({ canChoose: false, enabled: false, reason: 'DATA_PRACTICE_CONSENT_REQUIRED' });
    renderSettings();
    const section = await card();
    expect(within(section).getByText('A Tutor must allow this first.')).toBeInTheDocument();
    expect(within(section).queryByRole('switch')).toBeNull();
    expect(within(section).getByText('Your profile is private. Only people you accept can see it.')).toBeInTheDocument();
    expect(put()).toEqual([]);
  });

  it('an unknown reason names nothing and offers nothing', async () => {
    routes['GET /profile'] = TEEN({ canChoose: false, enabled: false, reason: 'SOMETHING_ELSE' });
    const view = renderSettings();
    await screen.findByLabelText('Name');
    expect(screen.queryByText('Who can find you')).toBeNull();
    view.unmount();
  });

  it('hides the switch and says a Tutor must allow it when Core refuses for the missing consent', async () => {
    routes['GET /profile'] = TEEN({ canChoose: true, enabled: false });
    routes['PUT /profile/discoverable'] = refuse('DATA_PRACTICE_CONSENT_REQUIRED');
    renderSettings();
    const section = await card();
    fireEvent.click(within(section).getByRole('switch', { name: 'Let people find my profile' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Turn on' }));
    expect(await within(section).findByText('A Tutor must allow this first.')).toBeInTheDocument();
    expect(within(section).getAllByText('A Tutor must allow this first.')).toHaveLength(1);
    expect(within(section).queryByRole('switch')).toBeNull();
  });
});
