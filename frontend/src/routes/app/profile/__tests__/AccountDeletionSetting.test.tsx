import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { AccountDeletionSetting } from '../AccountDeletionSetting';
import { AccountDeletionStatus } from '@/routes/auth/AccountDeletionStatus';

/*
 * E.6 wiring: Settings shows Core's verdict, a confirmed scheduled deletion
 * signs the session out and hands the stated date to /account-deletion, a
 * wrong password stays on the form, and a signed-in account with a
 * scheduled deletion can keep it from the deletion screen.
 */

const mocks = vi.hoisted(() => ({
  auth: {
    session: { user: { id: 'synthetic' } } as unknown,
    accountDeletion: null as unknown,
    getToken: vi.fn().mockResolvedValue('jwt'),
    logout: vi.fn().mockResolvedValue(undefined),
    refreshMe: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ isDark: false }) }));
vi.mock('@/lib/api', () => ({ BASE_URL: 'http://core.test' }));

type Reply = { status: number; body: unknown };
let replies: Record<string, Reply[]>;
const sent: { method: string; body: unknown }[] = [];

beforeEach(async () => {
  await i18n.changeLanguage('en-US');
  sent.length = 0;
  mocks.auth.session = { user: { id: 'synthetic' } };
  mocks.auth.accountDeletion = null;
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    sent.push({ method, body: init?.body ? JSON.parse(String(init.body)) : null });
    const reply = replies[method]?.shift() ?? { status: 500, body: null };
    return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { 'Content-Type': 'application/json' } });
  }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

const adult = { allowed: true, population: 'adult', graceDays: 14, immediate: false, reauth: 'password', children: { lastTutorOf: 1, sharedTutorOf: 0 } };

function Where() {
  const location = useLocation();
  return <output data-testid="where">{location.pathname}</output>;
}

function renderSettings() {
  return render(<MemoryRouter initialEntries={['/profile/settings']}>
    <Routes>
      <Route path="/profile/settings" element={<AccountDeletionSetting />} />
      <Route path="/account-deletion" element={<><AccountDeletionStatus /><Where /></>} />
      <Route path="/login" element={<Where />} />
    </Routes>
  </MemoryRouter>);
}

describe('AccountDeletionSetting', () => {
  it('schedules the deletion, signs out and shows the stated date on the public screen', async () => {
    replies = {
      GET: [{ status: 200, body: { data: { deletion: null, eligibility: adult }, error: null } }],
      POST: [{ status: 202, body: { data: { status: 'pending', scheduledFor: '2026-10-08T21:00:00.000Z', signedOut: true }, error: null } }],
    };
    renderSettings();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete account' }));
    expect(screen.getByText('1 child account only you supervise will be paused.')).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pw' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm deletion' }));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/account-deletion'));
    expect(sent.find((call) => call.method === 'POST')?.body).toEqual({ acknowledge: true, currentPassword: 'pw' });
    expect(mocks.auth.logout).toHaveBeenCalledOnce();
    expect(screen.getByText('Your account will be deleted on Oct 8, 2026.')).toBeTruthy();
    expect(screen.getByText('You are signed out. Sign in before then to keep it.')).toBeTruthy();
  });

  it('keeps the form and says so when the password is wrong', async () => {
    replies = {
      GET: [{ status: 200, body: { data: { deletion: null, eligibility: adult }, error: null } }],
      POST: [{ status: 401, body: { data: null, error: { code: 'INVALID_CREDENTIALS', message: 'x' } } }],
    };
    renderSettings();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete account' }));
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm deletion' }));
    expect((await screen.findByRole('alert')).textContent).toBe('That password is not right. Try again.');
    expect(mocks.auth.logout).not.toHaveBeenCalled();
  });

  it('shows a parent-created child who can delete the account, with no control', async () => {
    replies = { GET: [{ status: 200, body: { data: { deletion: null, eligibility: { allowed: false, reason: 'kid' } }, error: null } }] };
    renderSettings();
    expect(await screen.findByText('Your Tutor can delete this account from Family.')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('an unreadable state offers a retry, never a control', async () => {
    replies = {
      GET: [{ status: 502, body: { data: null, error: { code: 'DATA_UNAVAILABLE' } } }, { status: 200, body: { data: { deletion: null, eligibility: adult }, error: null } }],
    };
    renderSettings();
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: 'Delete account' })).toBeTruthy();
  });
});

describe('AccountDeletionStatus (signed in with a scheduled deletion)', () => {
  it('keeps the account through Core and then lets the holder continue', async () => {
    mocks.auth.accountDeletion = { status: 'pending', scheduledFor: '2026-10-08T21:00:00.000Z' };
    replies = { DELETE: [{ status: 200, body: { data: { status: 'cancelled', cancelledAt: '2026-09-24T00:00:00.000Z' }, error: null } }] };
    render(<MemoryRouter initialEntries={['/account-deletion']}>
      <Routes>
        <Route path="/account-deletion" element={<AccountDeletionStatus />} />
        <Route path="/" element={<Where />} />
      </Routes>
    </MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Deletion scheduled');
    fireEvent.click(screen.getByRole('button', { name: 'Keep account' }));
    expect(await screen.findByText('Your account is kept. Nothing was deleted.')).toBeTruthy();
    expect(mocks.auth.refreshMe).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByTestId('where').textContent).toBe('/');
  });

  it('a direct visit with nothing to show goes to sign-in', () => {
    mocks.auth.session = null;
    render(<MemoryRouter initialEntries={['/account-deletion']}>
      <Routes>
        <Route path="/account-deletion" element={<AccountDeletionStatus />} />
        <Route path="/login" element={<Where />} />
      </Routes>
    </MemoryRouter>);
    expect(screen.getByTestId('where').textContent).toBe('/login');
  });
});
