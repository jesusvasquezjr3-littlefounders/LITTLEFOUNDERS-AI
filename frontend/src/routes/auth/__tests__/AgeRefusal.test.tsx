import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import en from '@/i18n/en-US/rebuild-site.json';
import { SignupPage } from '../SignupPage';

const mocks = vi.hoisted(() => ({ signup: vi.fn(), guest: vi.fn(), insights: vi.fn(), track: vi.fn() }));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ signup: mocks.signup, startGuestSession: mocks.guest, getToken: vi.fn() }) }));
vi.mock('@/lib/insights', () => ({ configureInsights: mocks.insights, trackInsight: mocks.track, flushInsights: vi.fn() }));
vi.mock('@/lib/sound', () => ({ playPlatformSound: vi.fn() }));
vi.mock('@/auth/oauth', () => ({ fetchEnabledProviders: vi.fn().mockResolvedValue([]), startOAuth: vi.fn() }));

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('en-US');
  mocks.signup.mockResolvedValue({ error: { code: 'AGE_RESTRICTED' } });
});

function fillAndSubmit(container: HTMLElement) {
  fireEvent.change(screen.getByLabelText(en.authSignup.name), { target: { value: 'Synthetic' } });
  fireEvent.change(screen.getByLabelText(en.authCommon.email), { target: { value: 'synthetic@example.invalid' } });
  fireEvent.change(screen.getByLabelText(en.authCommon.password), { target: { value: 'synthetic-password' } });
  fireEvent.change(screen.getByLabelText(en.authCommon.day), { target: { value: '1' } });
  fireEvent.change(screen.getByLabelText(en.authCommon.month), { target: { value: '1' } });
  fireEvent.change(screen.getByLabelText(en.authCommon.year), { target: { value: '2018' } });
  fireEvent.submit(container.querySelector('form')!);
}

describe('A.2 age-refusal guest entry', () => {
  it.each([true, false])('sends only the origin boolean and navigates only on confirmed protection: %s', async (success) => {
    mocks.guest.mockResolvedValue({ error: success ? null : { code: 'DATA_UNAVAILABLE' } });
    const { container } = render(<MemoryRouter initialEntries={['/signup']}><Routes>
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/onboarding" element={<div>Protected entry</div>} />
    </Routes></MemoryRouter>);
    fillAndSubmit(container);
    await waitFor(() => expect(mocks.signup).toHaveBeenCalledWith(expect.objectContaining({ birthDate: '2018-01-01', parentIntent: false })));
    const cta = await screen.findByRole('button', { name: en.authSignup.tryGuest });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(en.authSignup.refusedTitle);
    // The refused form's details are gone with it, and the first-party analytics buffer is off.
    expect(screen.queryByLabelText(en.authCommon.email)).not.toBeInTheDocument();
    expect(mocks.insights).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
    expect(mocks.track).not.toHaveBeenCalledWith('signup_complete', expect.anything());
    fireEvent.click(cta);
    await waitFor(() => expect(mocks.guest).toHaveBeenCalledWith({ under13Origin: true }));
    if (success) expect(await screen.findByText('Protected entry')).toBeInTheDocument();
    else {
      expect(await screen.findByRole('alert')).toHaveTextContent(en.authSignup.guestFailed);
      expect(screen.queryByText('Protected entry')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: en.authSignup.tryGuest })).toBeEnabled();
    }
  });

  it('explains the guest path behind "Why?" without claiming more than Core keeps', async () => {
    const { container } = render(<MemoryRouter initialEntries={['/signup']}><SignupPage /></MemoryRouter>);
    fillAndSubmit(container);
    fireEvent.click(await screen.findByRole('button', { name: en.authSignup.why }));
    const dialog = await screen.findByRole('dialog', { name: en.authSignup.whyTitle });
    for (const line of [en.authSignup.whyNoEmail, en.authSignup.whySafety, en.authSignup.whyParent]) expect(dialog).toHaveTextContent(line);
  });
});
