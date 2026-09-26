import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RebuildRoot } from '@/rebuild/design/controls';
import en from '@/i18n/en-US/rebuild-site.json';
import { Landing } from '../Landing';
import { Families } from '../Families';

/*
 * The route bridges of the public pages (W2 Lane 1): the rebuilt surfaces get
 * the session-aware call to action from the auth context, and the acquisition
 * goals are reported exactly as before.
 */

const auth = vi.hoisted(() => ({
  session: null as object | null,
  roles: [] as string[],
  meLoaded: true,
  startGuestSession: vi.fn(async () => ({ error: null as object | null, analyticsEnabled: false })),
}));
const goals = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/lib/analytics', () => ({ trackMarketingGoal: goals.track }));

beforeEach(() => {
  auth.session = null;
  auth.roles = [];
  auth.startGuestSession.mockReset();
  auth.startGuestSession.mockResolvedValue({ error: null, analyticsEnabled: false });
  goals.track.mockReset();
});

function at(path: string, element: React.ReactNode) {
  return render(<RebuildRoot theme="light" locale="en-US"><MemoryRouter initialEntries={[path]}><Routes>
    <Route path={path} element={element} />
    <Route path="/onboarding" element={<p>onboarding</p>} />
    <Route path="/learn" element={<p>learn</p>} />
  </Routes></MemoryRouter></RebuildRoot>);
}

describe('public page bridges', () => {
  it('Start free starts a guest session, reports the goal first and opens onboarding', async () => {
    at('/', <Landing />);
    fireEvent.click(screen.getAllByRole('button', { name: en.site.startFree })[0]!);
    expect(goals.track).toHaveBeenCalledWith('guest_start', expect.objectContaining({ pathname: '/' }));
    await waitFor(() => expect(screen.getByText('onboarding')).toBeInTheDocument());
    expect(auth.startGuestSession).toHaveBeenCalledOnce();
  });

  it('a failed start stays on the page and says so beside the pressed button', async () => {
    auth.startGuestSession.mockResolvedValue({ error: { code: 'NETWORK' }, analyticsEnabled: false });
    at('/', <Landing />);
    fireEvent.click(screen.getAllByRole('button', { name: en.site.startFree })[1]!);
    expect(await screen.findByRole('alert')).toHaveTextContent(en.site.startError);
    expect(screen.queryByText('onboarding')).toBeNull();
  });

  it('a signed-in visitor continues into the app; the Log in link reports the secondary goal for a visitor', () => {
    const visitor = at('/', <Landing />);
    fireEvent.click(screen.getByRole('link', { name: en.site.login }));
    expect(goals.track).toHaveBeenCalledWith('cta_secondary', expect.anything());
    visitor.unmount();
    auth.session = { user: { id: 'u1' } };
    at('/', <Landing />);
    expect(screen.queryByRole('button', { name: en.site.startFree })).toBeNull();
    fireEvent.click(screen.getAllByRole('link', { name: en.site.continue })[0]!);
    expect(screen.getByText('learn')).toBeInTheDocument();
  });

  it('the family page offers verification to nobody signed in; a parent gets the family', () => {
    auth.session = { user: { id: 'kid' } };
    auth.roles = ['kid'];
    const kid = at('/families', <Families />);
    expect(document.querySelector('a[href="/verify-parent"], a[href^="/signup"]')).toBeNull();
    kid.unmount();
    auth.roles = ['parent'];
    at('/families', <Families />);
    expect(screen.getAllByRole('link', { name: en.site.openFamily })[0]).toHaveAttribute('href', '/family');
  });
});
