import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { RequireAgeScreen } from '../RequireAgeScreen';

const mocks = vi.hoisted(() => ({ id: 'synthetic', roles: [] as string[], api: vi.fn(), token: vi.fn().mockResolvedValue('synthetic'), refresh: vi.fn(), logout: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: mocks.api }));
vi.mock('../AuthContext', () => ({ useAuth: () => ({ session: { user: { id: mocks.id } }, roles: mocks.roles, getToken: mocks.token, refreshMe: mocks.refresh, logout: mocks.logout }) }));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ isDark: false }) }));
const pending = { data: { required: true, ageBand: null, protectedOrigin: false }, error: null };
const cleared = { data: { required: false, ageBand: 'under_13', protectedOrigin: true }, error: null };
const view = () => <MemoryRouter><RequireAgeScreen><p>Protected content</p></RequireAgeScreen></MemoryRouter>;
const mount = () => render(view());
beforeEach(async () => { vi.resetAllMocks(); mocks.id = 'synthetic'; mocks.roles = []; mocks.token.mockResolvedValue('synthetic'); await i18n.changeLanguage('en-US'); });

describe('mandatory age screen', () => {
  it('A.4: sends a parent-created child with no age on record to their Tutor, with no date form', async () => {
    mocks.roles = ['kid'];
    mocks.api.mockResolvedValue(pending);
    mount();
    await screen.findByRole('heading', { name: 'Ask your Tutor' });
    expect(screen.queryByLabelText('Day')).toBeNull();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });
  it('A.4: switches to the Tutor screen when Core refuses the child answer (KID_AGE_BY_TUTOR)', async () => {
    mocks.api.mockResolvedValueOnce(pending).mockResolvedValueOnce({ data: null, error: { code: 'KID_AGE_BY_TUTOR' } });
    mount();
    await screen.findByLabelText('Day');
    for (const [name, value] of [['Day', '01'], ['Month', '02'], ['Year', '2018']] as const) {
      fireEvent.change(screen.getByLabelText(name), { target: { value } });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByRole('heading', { name: 'Ask your Tutor' });
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });
  it('ignores an earlier account read after switching accounts', async () => {
    let resolveOld!: (value: typeof cleared) => void;
    mocks.api.mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; })).mockResolvedValueOnce(pending);
    const rendered = mount();
    await waitFor(() => expect(mocks.api).toHaveBeenCalledTimes(1));
    mocks.id = 'another-account';
    rendered.rerender(view());
    await screen.findByLabelText('Day');
    await act(async () => resolveOld(cleared));
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Day')).toBeInTheDocument();
  });
  it('ignores a pending submission even after switching away and back to the same account', async () => {
    let resolveOld!: (value: typeof cleared) => void;
    mocks.api.mockResolvedValueOnce(pending)
      .mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; }))
      .mockResolvedValue(pending);
    const rendered = mount();
    await screen.findByLabelText('Day');
    for (const [name, value] of [['Day', '01'], ['Month', '02'], ['Year', '2018']] as const) {
      fireEvent.change(screen.getByLabelText(name), { target: { value } });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(mocks.api).toHaveBeenCalledTimes(2));
    mocks.id = 'another-account'; rendered.rerender(view());
    await screen.findByLabelText('Day');
    mocks.id = 'synthetic'; rendered.rerender(view());
    await screen.findByLabelText('Day');
    await act(async () => resolveOld(cleared));
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Day')).toHaveValue('');
  });
  it('consults the server again after a remount instead of caching clearance', async () => {
    mocks.api.mockResolvedValueOnce(cleared).mockResolvedValueOnce(pending);
    const rendered = mount();
    await screen.findByText('Protected content');
    rendered.unmount(); mount();
    await screen.findByLabelText('Day');
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    expect(mocks.api).toHaveBeenCalledTimes(2);
  });
  it('offers recovery when the session cannot provide a token', async () => {
    mocks.token.mockResolvedValueOnce(null);
    mount();
    await screen.findByRole('alert');
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    expect(mocks.api).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });
  it('never renders protected content while the request is pending', () => {
    mocks.api.mockReturnValue(new Promise(() => {}));
    mount();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
  it('requires successful server confirmation before showing children', async () => {
    mocks.api.mockResolvedValueOnce(pending).mockResolvedValueOnce(cleared);
    mount();
    await screen.findByLabelText('Day');
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    for (const [name, value] of [['Day', '01'], ['Month', '02'], ['Year', '2018']] as const) {
      fireEvent.change(screen.getByLabelText(name), { target: { value } });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Protected content')).toBeInTheDocument();
    expect(mocks.api).toHaveBeenLastCalledWith('/auth/age-screen', { token: 'synthetic', body: { birthDate: '2018-02-01' } });
    expect(mocks.refresh).toHaveBeenCalled();
  });
  it('S-04: sends the birth month only for a 13-17 date, after saying what it is kept for', async () => {
    const teenCleared = { data: { required: false, ageBand: '13_to_17', protectedOrigin: false }, error: null };
    mocks.api.mockResolvedValueOnce(pending).mockResolvedValueOnce(teenCleared);
    mount();
    await screen.findByLabelText('Day');
    const year = String(new Date().getUTCFullYear() - 15);
    for (const [name, value] of [['Day', '1'], ['Month', '1'], ['Year', year]] as const) {
      fireEvent.change(screen.getByLabelText(name), { target: { value } });
    }
    expect(screen.getByText('At 18, your account moves to adult settings.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Protected content')).toBeInTheDocument();
    expect(mocks.api).toHaveBeenLastCalledWith('/auth/age-screen', { token: 'synthetic', body: { birthDate: `${year}-01-01`, birthMonth: `${year}-01` } });
  });
  it('fails closed on malformed responses, offers retry and keeps sign-out reachable', async () => {
    mocks.api.mockResolvedValueOnce({ data: {}, error: null }).mockResolvedValueOnce(cleared);
    mount();
    await screen.findByRole('alert');
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(mocks.logout).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getByText('Protected content')).toBeInTheDocument());
  });
});
