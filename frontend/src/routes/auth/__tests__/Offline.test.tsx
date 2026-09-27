import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import en from '@/i18n/en-US/rebuild-site.json';
import { failureCode } from '../failureCode';
import { LoginPage } from '../LoginPage';
import { ForgotPasswordPage } from '../ForgotPasswordPage';

/*
 * The offline state of the rebuilt sign-in screens (W2S.3). A request that
 * never reached Core is the person's connection: the screen says so, keeps the
 * form and offers the retry, and never blames "our side".
 */

const NETWORK = { code: 'INTERNAL', message: 'Network error' };
const mocks = vi.hoisted(() => ({ login: vi.fn(), api: vi.fn() }));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ login: mocks.login, getToken: vi.fn(), suspended: false, deleted: false }) }));
vi.mock('@/lib/api', () => ({ api: mocks.api }));
vi.mock('@/lib/insights', () => ({ configureInsights: vi.fn(), trackInsight: vi.fn(), flushInsights: vi.fn() }));
vi.mock('@/lib/sound', () => ({ playPlatformSound: vi.fn() }));
vi.mock('@/auth/oauth', () => ({ fetchEnabledProviders: vi.fn().mockResolvedValue([]), startOAuth: vi.fn() }));

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('en-US');
});

describe('failureCode', () => {
  it('names a request that never reached Core, or any failure while offline, OFFLINE; every other code is Core’s', () => {
    expect(failureCode(NETWORK, true)).toBe('OFFLINE');
    expect(failureCode({ code: 'INVALID_CREDENTIALS', message: 'x' }, false)).toBe('OFFLINE');
    expect(failureCode({ code: 'INTERNAL', message: 'Malformed response' }, true)).toBe('INTERNAL');
    expect(failureCode({ code: 'RATE_LIMITED', message: 'x' }, true)).toBe('RATE_LIMITED');
  });
});

describe('the offline state on the sign-in screens', () => {
  it('A1 says the connection is gone, keeps what was typed and lets the person retry', async () => {
    mocks.login.mockResolvedValueOnce({ error: NETWORK, analyticsEnabled: false });
    render(<MemoryRouter initialEntries={['/login']}><LoginPage /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText(en.authLogin.identifier), { target: { value: 'synthetic-child' } });
    fireEvent.change(screen.getByLabelText(en.authCommon.password), { target: { value: 'synthetic-password' } });
    fireEvent.click(screen.getByRole('button', { name: en.authLogin.submit }));
    expect(await screen.findByRole('alert')).toHaveTextContent(en.authCommon.errors.OFFLINE);
    expect(screen.queryByText(en.authCommon.errors.INTERNAL)).toBeNull();
    expect(screen.getByLabelText(en.authLogin.identifier)).toHaveValue('synthetic-child');
    expect(screen.getByRole('button', { name: en.authLogin.submit })).toBeEnabled();
  });

  it('A3 never reports a link as sent when the request did not leave the device', async () => {
    mocks.api.mockResolvedValueOnce({ data: null, error: NETWORK });
    render(<MemoryRouter initialEntries={['/forgot-password']}><ForgotPasswordPage /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText(en.authCommon.email), { target: { value: 'parent@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: en.authForgot.submit }));
    expect(await screen.findByRole('alert')).toHaveTextContent(en.authCommon.errors.OFFLINE);
    await waitFor(() => expect(screen.queryByText(en.authForgot.sentTitle)).toBeNull());
  });
});
