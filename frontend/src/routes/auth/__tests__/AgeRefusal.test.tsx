import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { SignupPage } from '../SignupPage';

const mocks = vi.hoisted(() => ({ signup: vi.fn(), guest: vi.fn(), insights: vi.fn() }));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ signup: mocks.signup, startGuestSession: mocks.guest, getToken: vi.fn() }) }));
vi.mock('@/lib/insights', () => ({ configureInsights: mocks.insights, trackInsight: vi.fn(), flushInsights: vi.fn() }));
vi.mock('@/lib/sound', () => ({ playPlatformSound: vi.fn() }));
vi.mock('../SocialAuth', () => ({ SocialAuth: () => null }));

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('en-US');
  mocks.signup.mockResolvedValue({ error: { code: 'AGE_RESTRICTED' } });
});

describe('A.2 age-refusal guest entry', () => {
  it.each([true, false])('sends only the origin boolean and navigates only on confirmed protection: %s', async (success) => {
    mocks.guest.mockResolvedValue({ error: success ? null : { code: 'DATA_UNAVAILABLE' } });
    const { container } = render(<MemoryRouter initialEntries={['/signup']}><Routes>
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/onboarding" element={<div>Protected entry</div>} />
    </Routes></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'synthetic-password' } });
    fireEvent.submit(container.querySelector('form')!);
    const cta = await screen.findByRole('button', { name: 'Keep going without an account' });
    expect(mocks.insights).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
    fireEvent.click(cta);
    await waitFor(() => expect(mocks.guest).toHaveBeenCalledWith({ under13Origin: true }));
    if (success) expect(await screen.findByText('Protected entry')).toBeInTheDocument();
    else await waitFor(() => {
      expect(screen.queryByText('Protected entry')).not.toBeInTheDocument();
      expect(cta).not.toBeDisabled();
    });
  });
});
