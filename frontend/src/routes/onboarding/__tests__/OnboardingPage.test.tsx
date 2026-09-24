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
 * refreshMe() flips onboardingComplete to true via its own setState, and that
 * update can land — and re-render OnboardingPage — BEFORE complete()'s own
 * subsequent navigate() call runs (fewer microtask hops through loadMe's
 * setState than through complete()'s continuation). A mock whose
 * onboardingComplete never actually changes mid-flight cannot catch that; a
 * plain `let` flipped inside refreshMe would not trigger a re-render either.
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
  window.localStorage.clear();
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

const clickButton = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));

/** welcome -> name, the two steps every path starts with. */
async function startAndName(name = 'Ana') {
  clickButton('Get started');
  await screen.findByLabelText('Name');
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: name } });
  clickButton('Continue');
}

describe('OnboardingPage', () => {
  it('walks welcome -> name -> discovery (skip) -> later without collecting DOB again, submitting once with the expected payload', async () => {
    mockedApi.mockResolvedValueOnce({ data: { streakDays: 1 }, error: null });
    renderPage();

    // The welcome step exists so the first tap can grant the page permission to
    // make noise — the browser refuses before any gesture.
    expect(screen.getByText('Welcome to LittleFounders')).toBeInTheDocument();
    await startAndName();

    expect(screen.queryByLabelText('Date of birth')).not.toBeInTheDocument();

    await screen.findByText('Where did you hear about us?');
    clickButton('Skip');

    await screen.findByText('Shall we save your progress?');
    clickButton('Later');

    await waitFor(() => expect(mockedApi).toHaveBeenCalledTimes(1));
    expect(mockedApi).toHaveBeenCalledWith('/onboarding/complete', {
      body: {
        displayName: 'Ana',
        discoveryChannel: undefined,
        accountOfferChoice: 'later',
        localDate: expect.any(String),
      },
      token: 'token-123',
    });
    await screen.findByText('landed on learn');
  });

  it('carries a chosen discovery channel into the single submit', async () => {
    mockedApi.mockResolvedValueOnce({ data: { streakDays: 1 }, error: null });
    renderPage();
    await startAndName('Beto');

    await screen.findByText('Where did you hear about us?');
    // The discovery step auto-advances on choice — one tap, not tap-then-continue.
    fireEvent.click(screen.getByRole('radio', { name: 'School' }));

    await screen.findByText('Shall we save your progress?');
    clickButton('Later');

    await waitFor(() => expect(mockedApi).toHaveBeenCalledTimes(1));
    expect(mockedApi.mock.calls[0]![1]!.body).toMatchObject({
      displayName: 'Beto',
      discoveryChannel: 'school',
    });
  });

  it('sends the learner to account creation when they choose to save now', async () => {
    mockedApi.mockResolvedValueOnce({ data: { streakDays: 1 }, error: null });
    renderPage();
    await startAndName();
    await screen.findByText('Where did you hear about us?');
    clickButton('Skip');
    await screen.findByText('Shall we save your progress?');
    clickButton('Create my account');

    // The race guard: refreshMe flips onboardingComplete before navigate() runs,
    // and without the `submitting` check the defensive redirect wins and the
    // account form is silently skipped.
    await screen.findByText('landed on upgrade');
  });

  it('redirects an already-onboarded visitor away instead of re-running the flow', async () => {
    initialOnboardingComplete = true;
    renderPage();
    await screen.findByText('landed on learn');
    expect(mockedApi).not.toHaveBeenCalled();
  });

  it('shows an error and stays put when the submit fails', async () => {
    mockedApi.mockResolvedValueOnce({ data: null, error: { code: 'INTERNAL', message: 'nope' } });
    renderPage();
    await startAndName();
    await screen.findByText('Where did you hear about us?');
    clickButton('Skip');
    await screen.findByText('Shall we save your progress?');
    clickButton('Later');

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
    expect(screen.getByText('Shall we save your progress?')).toBeInTheDocument();
  });
});

/*
 * "Permitir regresar a opciones previas" was an explicit part of the brief, and
 * it is the cheapest anxiety-remover in a first-run flow: a learner who cannot
 * go back is a learner who abandons rather than risk a wrong answer.
 */
describe('OnboardingPage — going back', () => {
  it('offers no back button on the first screen, and one on every screen after', async () => {
    renderPage();
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
    clickButton('Get started');
    expect(await screen.findByRole('button', { name: 'Back' })).toBeInTheDocument();
  });

  it('preserves what was already entered when the learner steps back', async () => {
    renderPage();
    await startAndName('Carla');
    await screen.findByText('Where did you hear about us?');

    clickButton('Back');
    expect((await screen.findByLabelText('Name')).getAttribute('value')).toBe('Carla');
  });
});

describe('OnboardingPage — narration', () => {
  it('shows every spoken line as text, so the flow is complete with no audio at all', async () => {
    renderPage();
    expect(screen.getByText(i18n.t('onboarding.narration.welcome'))).toBeInTheDocument();
    clickButton('Get started');
    expect(await screen.findByText(i18n.t('onboarding.narration.name'))).toBeInTheDocument();
  });

  it('lets the learner mute the voices, and remembers it', async () => {
    renderPage();
    clickButton('Mute voices');
    await waitFor(() => expect(window.localStorage.getItem('lf.guidedVoice.muted')).toBe('1'));
    expect(screen.getByRole('button', { name: 'Turn voices on' })).toBeInTheDocument();
  });

  it('reacts on screen to what the learner typed, without claiming to have said it aloud', async () => {
    renderPage();
    clickButton('Get started');
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Dani' } });
    // Interpolated lines have no recorded audio by construction — they are an
    // on-screen aside, never part of the fixed spoken script.
    expect(await screen.findByText('Dani! I like that name.')).toBeInTheDocument();
  });
});
