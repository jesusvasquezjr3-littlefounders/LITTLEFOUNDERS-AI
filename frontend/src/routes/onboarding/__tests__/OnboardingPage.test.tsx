import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n';
import { api } from '@/lib/api';
import en from '@/i18n/en-US/rebuild-site.json';
import { ThemeProvider } from '@/theme/useTheme';
import { OnboardingPage } from '../OnboardingPage';

vi.mock('@/lib/api', () => ({ api: vi.fn() }));

/*
 * O1 rebuilt (W2S.2). refreshMe uses REAL useState (not a plain closure
 * variable) so the test reproduces the race that shipped a real bug: the live
 * AuthContext's refreshMe() flips onboardingComplete via its own setState, and
 * that re-render can land BEFORE complete()'s own navigate() runs. A mock whose
 * onboardingComplete never changes mid-flight could not catch it.
 */
const refreshMe = vi.fn(async () => {});
let initialOnboardingComplete = false;
vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => {
    const [onboardingComplete, setOnboardingComplete] = useState(initialOnboardingComplete);
    refreshMe.mockImplementation(async () => setOnboardingComplete(true));
    return { getToken: async () => 'token-123', refreshMe, onboardingComplete };
  },
}));

const mockedApi = vi.mocked(api);
const copy = en.onboardingFlow;

beforeEach(async () => {
  mockedApi.mockReset();
  refreshMe.mockClear();
  initialOnboardingComplete = false;
  await i18n.changeLanguage('en-US');
});

function renderPage() {
  return render(<ThemeProvider><MemoryRouter initialEntries={['/onboarding']}>
    <Routes>
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/learn" element={<div>landed on learn</div>} />
      <Route path="/upgrade-account" element={<div>landed on upgrade</div>} />
    </Routes>
  </MemoryRouter></ThemeProvider>);
}

const press = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const heading = () => screen.getByRole('heading', { level: 1 });

/** welcome -> name -> (mentor skipped) -> discovery */
async function toDiscovery(name = 'Ana') {
  press(copy.start);
  fireEvent.change(await screen.findByLabelText(copy.nameLabel), { target: { value: name } });
  press(copy.continue);
  await screen.findByRole('heading', { name: copy.mentorTitle });
  press(copy.skip);
  await screen.findByRole('heading', { name: copy.discoveryTitle });
}

describe('OnboardingPage (O1)', () => {
  it('walks every step on one full-bleed screen and submits exactly Core’s strict payload once, with no date of birth', async () => {
    mockedApi.mockResolvedValueOnce({ data: { streakDays: 1 }, error: null });
    const { container } = renderPage();
    expect(heading()).toHaveTextContent(copy.welcomeTitle);
    expect(container.querySelector('[data-shell="single-state"][data-hue="primary"]')).not.toBeNull();
    expect(container.querySelector('[data-age-band="6-9"]')).not.toBeNull();
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
    await toDiscovery();
    expect(screen.queryByLabelText(en.authCommon.day)).not.toBeInTheDocument();
    press(copy.skip);
    await screen.findByRole('heading', { name: copy.accountTitle });
    press(copy.later);
    await waitFor(() => expect(mockedApi).toHaveBeenCalledTimes(1));
    expect(mockedApi).toHaveBeenCalledWith('/onboarding/complete', {
      token: 'token-123',
      body: { displayName: 'Ana', discoveryChannel: undefined, accountOfferChoice: 'later', localDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) },
    });
    await screen.findByText('landed on learn');
  });

  it('sends the learner’s own calendar date, not the UTC one', async () => {
    mockedApi.mockResolvedValueOnce({ data: { streakDays: 1 }, error: null });
    renderPage();
    await toDiscovery();
    press(copy.skip);
    await screen.findByRole('heading', { name: copy.accountTitle });
    press(copy.later);
    await waitFor(() => expect(mockedApi).toHaveBeenCalledTimes(1));
    const now = new Date();
    const local = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect((mockedApi.mock.calls[0]![1] as { body: { localDate: string } }).body.localDate).toBe(local);
  });

  it('carries a chosen discovery channel into the single submit (a radio, then Continue)', async () => {
    mockedApi.mockResolvedValueOnce({ data: { streakDays: 1 }, error: null });
    renderPage();
    await toDiscovery('Beto');
    expect(screen.getByRole('button', { name: copy.continue })).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: copy.channels.school }));
    press(copy.continue);
    await screen.findByRole('heading', { name: copy.accountTitle });
    press(copy.later);
    await waitFor(() => expect(mockedApi).toHaveBeenCalledTimes(1));
    expect((mockedApi.mock.calls[0]![1] as { body: object }).body).toMatchObject({ displayName: 'Beto', discoveryChannel: 'school' });
  });

  it('sends the learner to account creation when they choose to save now (the refreshMe race)', async () => {
    mockedApi.mockResolvedValueOnce({ data: { streakDays: 1 }, error: null });
    renderPage();
    await toDiscovery();
    press(copy.skip);
    await screen.findByRole('heading', { name: copy.accountTitle });
    press(copy.create);
    await screen.findByText('landed on upgrade');
  });

  it('counts a completion Core already recorded (409) as done', async () => {
    mockedApi.mockResolvedValueOnce({ data: null, error: { code: 'ONBOARDING_ALREADY_COMPLETE', message: 'done' } });
    renderPage();
    await toDiscovery();
    press(copy.skip);
    await screen.findByRole('heading', { name: copy.accountTitle });
    press(copy.later);
    await screen.findByText('landed on learn');
  });

  it('redirects an already-onboarded visitor away instead of re-running the flow', async () => {
    initialOnboardingComplete = true;
    renderPage();
    await screen.findByText('landed on learn');
    expect(mockedApi).not.toHaveBeenCalled();
  });

  it('says so and stays put when the submit fails, and both choices come back', async () => {
    mockedApi.mockResolvedValueOnce({ data: null, error: { code: 'INTERNAL', message: 'nope' } });
    renderPage();
    await toDiscovery();
    press(copy.skip);
    await screen.findByRole('heading', { name: copy.accountTitle });
    press(copy.later);
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.failed);
    expect(heading()).toHaveTextContent(copy.accountTitle);
    expect(screen.getByRole('button', { name: copy.later })).toBeEnabled();
    expect(screen.getByRole('button', { name: copy.create })).toBeEnabled();
  });
});

describe('OnboardingPage: the Mentor (OD-6, 08 §8)', () => {
  it('shows the four real characters as real-model renders, saves the choice to the Mentor preference and marks it chosen', async () => {
    mockedApi.mockResolvedValueOnce({ data: { character: 'zara' }, error: null });
    renderPage();
    press(copy.start);
    fireEvent.change(await screen.findByLabelText(copy.nameLabel), { target: { value: 'Ana' } });
    press(copy.continue);
    await screen.findByRole('heading', { name: copy.mentorTitle });
    const list = screen.getByRole('list', { name: copy.mentorTitle });
    const images = [...list.querySelectorAll('[data-slot="mentor-avatar"] img')];
    expect(images.map((image) => image.getAttribute('data-character'))).toEqual(['rho', 'zara', 'liruf', 'dina']);
    for (const image of images) expect(image.getAttribute('data-asset-id')).toMatch(/^mentor\.[a-z]+\.avatar\.light$/);
    expect(screen.getByRole('button', { name: copy.continue })).toBeDisabled();
    fireEvent.click(within(list).getByRole('button', { name: /Zara/ }));
    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith('/tutor/preferences', { method: 'PUT', token: 'token-123', body: { character: 'zara' } }));
    expect(await within(list).findByText(copy.chosen)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: copy.continue })).toBeEnabled();
  });

  it('says a failed save and keeps the choice open', async () => {
    mockedApi.mockResolvedValueOnce({ data: null, error: { code: 'DATA_UNAVAILABLE', message: 'no' } });
    renderPage();
    press(copy.start);
    fireEvent.change(await screen.findByLabelText(copy.nameLabel), { target: { value: 'Ana' } });
    press(copy.continue);
    const list = await screen.findByRole('list', { name: copy.mentorTitle });
    fireEvent.click(within(list).getByRole('button', { name: /Dina/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.mentorFailed);
    expect(screen.getByRole('button', { name: copy.continue })).toBeDisabled();
    expect(screen.getByRole('button', { name: copy.skip })).toBeEnabled();
  });
});

describe('OnboardingPage: going back', () => {
  it('offers no Back on the first step and one on every step after', async () => {
    renderPage();
    expect(screen.queryByRole('button', { name: copy.back })).not.toBeInTheDocument();
    press(copy.start);
    expect(await screen.findByRole('button', { name: copy.back })).toBeInTheDocument();
  });

  it('keeps what was entered when the learner steps back, and moves focus to the step’s heading', async () => {
    renderPage();
    await toDiscovery('Carla');
    press(copy.back);
    await screen.findByRole('heading', { name: copy.mentorTitle });
    expect(document.activeElement).toBe(heading());
    press(copy.back);
    expect(await screen.findByLabelText(copy.nameLabel)).toHaveValue('Carla');
  });

  it('never narrates and never shows a speech bubble (the legacy guided-voice stage is gone)', () => {
    const { container } = renderPage();
    expect(container.querySelector('audio')).toBeNull();
    expect(screen.queryByRole('button', { name: /voices|play again/i })).not.toBeInTheDocument();
  });
});
