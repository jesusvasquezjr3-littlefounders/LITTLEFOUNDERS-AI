import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n';
import { api } from '@/lib/api';
import { OnboardingPage } from '../OnboardingPage';

vi.mock('@/lib/api', () => ({ api: vi.fn() }));

/*
 * refreshMe uses REAL useState (not a plain closure variable) so a test can
 * reproduce the actual race that shipped a real bug: the live AuthContext's
 * refreshMe() flips onboardingComplete to true via its own setState, and
 * that update can land — and re-render OnboardingPage — BEFORE complete()'s
 * own subsequent navigate() call runs (fewer microtask hops through
 * loadMe's setState than through complete()'s continuation). A mock whose
 * onboardingComplete never actually changes mid-flight can't catch that; a
 * plain `let` flipped inside refreshMe wouldn't trigger a re-render either.
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

beforeEach(async () => {
  mockedApi.mockReset();
  refreshMe.mockClear();
  initialOnboardingComplete = false;
  await i18n.changeLanguage('en-US');
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/onboarding']}>
      <Routes>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/learn" element={<div>landed on learn</div>} />
        <Route path="/upgrade-account" element={<div>landed on upgrade</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('OnboardingPage', () => {
  it('walks name -> discovery (skip) -> age (skip) -> later, submitting once with the expected payload', async () => {
    mockedApi.mockResolvedValueOnce({ data: { streakDays: 1 }, error: null });
    renderPage();

    // Step 1: name — Continue starts disabled until a name is entered.
    const continueBtn = () => screen.getByRole('button', { name: 'Continue' });
    expect(continueBtn()).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ana' } });
    expect(continueBtn()).not.toBeDisabled();
    fireEvent.click(continueBtn());

    // Step 2: discovery channel — optional, skip without picking one.
    expect(screen.getByText('Where did you hear about LittleFounders?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

    // Step 3: age — optional, skip.
    expect(screen.getByText('How old are you?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

    // Step 4: account offer — choose "later".
    expect(screen.getByText('Want to save your progress?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Maybe later' }));

    await waitFor(() => expect(screen.getByText('landed on learn')).toBeInTheDocument());

    expect(mockedApi).toHaveBeenCalledTimes(1);
    const [path, options] = mockedApi.mock.calls[0]!;
    expect(path).toBe('/onboarding/complete');
    expect(options).toMatchObject({
      body: {
        displayName: 'Ana',
        discoveryChannel: undefined,
        birthDate: undefined,
        accountOfferChoice: 'later',
      },
    });
    expect(refreshMe).toHaveBeenCalledTimes(1);
  });

  it('routes to /upgrade-account when "create my account" is chosen', async () => {
    mockedApi.mockResolvedValueOnce({ data: { streakDays: 1 }, error: null });
    renderPage();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ana' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Skip' })); // discovery
    fireEvent.click(screen.getByRole('button', { name: 'Skip' })); // age
    fireEvent.click(screen.getByRole('button', { name: 'Create my account' }));

    await waitFor(() => expect(screen.getByText('landed on upgrade')).toBeInTheDocument());
    const [, options] = mockedApi.mock.calls[0]!;
    expect(options).toMatchObject({ body: { accountOfferChoice: 'created_now' } });
  });

  it('shows an inline error and stays on the page when the API call fails', async () => {
    mockedApi.mockResolvedValueOnce({ data: null, error: { code: 'INTERNAL', message: 'boom' } });
    renderPage();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ana' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    fireEvent.click(screen.getByRole('button', { name: 'Maybe later' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong, please try again.'));
    expect(screen.getByText('Want to save your progress?')).toBeInTheDocument(); // still on the last step
    expect(refreshMe).not.toHaveBeenCalled();
  });

  it('redirects home immediately if onboarding is already complete', () => {
    initialOnboardingComplete = true;
    renderPage();
    expect(screen.getByText('landed on learn')).toBeInTheDocument();
  });

  it('regression: lands on /upgrade-account even though refreshMe flips onboardingComplete to true first (the guard must not race the explicit navigate)', async () => {
    mockedApi.mockResolvedValueOnce({ data: { streakDays: 1 }, error: null });
    renderPage();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ana' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Skip' })); // discovery
    fireEvent.click(screen.getByRole('button', { name: 'Skip' })); // age
    fireEvent.click(screen.getByRole('button', { name: 'Create my account' }));

    await waitFor(() => expect(refreshMe).toHaveBeenCalledTimes(1));
    // The real bug: this used to resolve to "landed on learn" (APP_HOME)
    // instead, because the top-of-component defensive guard fired on
    // refreshMe's onboardingComplete=true update before this navigate ran.
    await waitFor(() => expect(screen.getByText('landed on upgrade')).toBeInTheDocument());
    expect(screen.queryByText('landed on learn')).not.toBeInTheDocument();
  });
});
