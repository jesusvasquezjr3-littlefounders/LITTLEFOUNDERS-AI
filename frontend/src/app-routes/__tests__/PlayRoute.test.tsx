import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { api } from '@/lib/api';
import { ThemeProvider } from '@/theme/useTheme';
import { PlayRoute } from '../PlayRoute';

/*
 * The host of a game inside /learn, against Core's real envelope (api() mocked at
 * the transport, nothing else): what it asks Core for, what it builds from the
 * answer (the iframe, with the contract's attributes and only an allowed
 * address), where the learner can go, and what a refusal looks like. The
 * handshake and every relay are tested at the controller (games/kartrush).
 */

vi.mock('@/lib/api', () => ({ api: vi.fn() }));
vi.mock('@/auth/AuthContext', () => {
  const getToken = async () => 'token-123';
  const session = { user: { id: 'kid-1' } };
  return { useAuth: () => ({ getToken, session, profile: { display_name: 'Sofía Pérez' } }) };
});

const mockedApi = vi.mocked(api);
type Answer = { data: unknown; error: null } | { data: null; error: { code: string; message: string } };
const ok = (data: unknown): Answer => ({ data, error: null });
const refuse = (code: string): Answer => ({ data: null, error: { code, message: code } });

const SESSION = {
  sessionId: '11111111-2222-4333-8444-555555555555', sessionRef: 'ref_abcdefgh12', game: { url: 'http://localhost:4010/?embed=1', build: 'b1' },
  mentor: 'zara', band: '6-9', caps: { softMs: 900000, hardMs: 1500000, idleMs: 600000 }, save: { revision: 0, data: null }, bests: [], sessionsRemainingToday: 1,
};
const list = (left: number, enabled = true) => ok({ games: [{ gameId: 'kartrush', status: 'live', sessionsRemainingToday: left, enabled }] });

let table: Record<string, Answer | ((init?: { method?: string; body?: unknown }) => Answer)>;
function answer(patch: typeof table = {}) {
  table = { '/learn/games': list(2), '/learn/games/kartrush/sessions': ok(SESSION), '/learn/register': ok({ register: 'young', copy_band: '6-9', policy_version: '2026-09-24.1', graduation: null }),
    '/tutor/preferences': ok({ character: 'dina', personalized: true }), ...patch };
  mockedApi.mockImplementation((async (path: string, init?: { method?: string; body?: unknown }) => {
    const entry = table[path] ?? (path.endsWith('/end') ? ok({ ok: true }) : undefined);
    if (entry === undefined) return refuse('NOT_FOUND');
    return typeof entry === 'function' ? entry(init) : entry;
  }) as unknown as typeof api);
}
const callsTo = (suffix: string) => mockedApi.mock.calls.filter(([path]) => path.endsWith(suffix));

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}
function renderAt(path: string) {
  return render(<ThemeProvider><MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/learn/play/:gameId" element={<PlayRoute />} />
      <Route path="/learn" element={<p>learn home</p>} />
      <Route path="/tutor" element={<p>mentor screen</p>} />
    </Routes>
    <Where />
  </MemoryRouter></ThemeProvider>);
}

beforeEach(async () => {
  await i18n.changeLanguage('en-US');
  mockedApi.mockReset();
  try { window.localStorage.clear(); } catch { /* jsdom always has storage */ }
});
afterEach(() => cleanup());

describe('the route', () => {
  it('sends an unknown game back to Learn', async () => {
    answer();
    renderAt('/learn/play/pong');
    expect(await screen.findByText('learn home')).toBeTruthy();
    expect(mockedApi).not.toHaveBeenCalledWith('/learn/games', expect.anything());
  });

  it('opens on the Garage, asks Core whether the learner may play, and opens no session by itself', async () => {
    answer();
    renderAt('/learn/play/kartrush');
    expect(await screen.findByRole('heading', { level: 1, name: 'Garage' })).toBeTruthy();
    await waitFor(() => expect(callsTo('/learn/games').length).toBeGreaterThan(0));
    // Opening the Garage must never use up one of the day's sessions: Core counts a session when it is created.
    expect(callsTo('/sessions')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Go' })).toBeTruthy();
  });

  it('defaults the driver to the learner\'s own Mentor', async () => {
    answer();
    renderAt('/learn/play/kartrush');
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Dina' })).toBeChecked());
  });

  it('shows the closed card, with no Go, when no session is left today', async () => {
    answer({ '/learn/games': list(0) });
    renderAt('/learn/play/kartrush');
    expect(await screen.findByRole('heading', { name: 'All done for today' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Go' })).toBeNull();
    expect(callsTo('/sessions')).toHaveLength(0);
  });

  it('shows the closed card when a guardian turned games off', async () => {
    answer({ '/learn/games': list(2, false) });
    renderAt('/learn/play/kartrush');
    expect(await screen.findByRole('heading', { name: 'Racing is off' })).toBeTruthy();
  });

  it('renders in Spanish and Portuguese', async () => {
    answer();
    await i18n.changeLanguage('es-MX');
    const view = renderAt('/learn/play/kartrush');
    expect(await screen.findByRole('heading', { level: 1, name: 'Garaje' })).toBeTruthy();
    view.unmount();
    await i18n.changeLanguage('pt-BR');
    renderAt('/learn/play/kartrush');
    expect(await screen.findByRole('heading', { level: 1, name: 'Garagem' })).toBeTruthy();
  });
});

describe('Go', () => {
  it('creates one session with an empty body and mounts the game in an iframe with the contract\'s attributes and no sandbox', async () => {
    answer();
    renderAt('/learn/play/kartrush');
    fireEvent.click(await screen.findByRole('button', { name: 'Go' }));
    const frame = await waitFor(() => {
      const found = document.querySelector('iframe');
      expect(found).not.toBeNull();
      return found!;
    });
    expect(callsTo('/sessions')).toHaveLength(1);
    expect(mockedApi).toHaveBeenCalledWith('/learn/games/kartrush/sessions', expect.objectContaining({ method: 'POST', body: {} }));
    expect(frame.getAttribute('src')).toBe('http://localhost:4010/?embed=1');
    expect(frame.getAttribute('allow')).toBe('fullscreen; gamepad; autoplay');
    expect(frame.hasAttribute('sandbox')).toBe(false);
    expect(frame.getAttribute('title')).toBe('KartRush racing game');
    expect(screen.getByRole('status')).toHaveTextContent('Getting your kart ready.');
    // The Garage's Go is gone while the game loads: a second press cannot open a second session.
    expect(screen.queryByRole('button', { name: 'Go' })).toBeNull();
  });

  it('never builds an iframe for an address outside the allow-list, and says the game did not start', async () => {
    answer({ '/learn/games/kartrush/sessions': ok({ ...SESSION, game: { url: 'https://evil.example/?embed=1', build: 'b1' } }) });
    renderAt('/learn/play/kartrush');
    fireEvent.click(await screen.findByRole('button', { name: 'Go' }));
    expect(await screen.findByRole('heading', { name: 'The game did not start' })).toBeTruthy();
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('says so when Core\'s answer is malformed, and when the daily limit was reached between the list and Go', async () => {
    answer({ '/learn/games/kartrush/sessions': ok({ sessionId: 'nope' }) });
    const view = renderAt('/learn/play/kartrush');
    fireEvent.click(await screen.findByRole('button', { name: 'Go' }));
    expect(await screen.findByRole('heading', { name: 'The game did not start' })).toBeTruthy();
    view.unmount();
    answer({ '/learn/games/kartrush/sessions': refuse('GAME_DAILY_LIMIT') });
    renderAt('/learn/play/kartrush');
    fireEvent.click(await screen.findByRole('button', { name: 'Go' }));
    expect(await screen.findByRole('heading', { name: 'All done for today' })).toBeTruthy();
  });

  it('remembers the choices made in the Garage', async () => {
    answer();
    const view = renderAt('/learn/play/kartrush');
    fireEvent.click(await screen.findByRole('radio', { name: 'Glacier Circuit' }));
    fireEvent.click(screen.getByRole('radio', { name: '150cc' }));
    view.unmount();
    renderAt('/learn/play/kartrush');
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Glacier Circuit' })).toBeChecked());
    expect(screen.getByRole('radio', { name: '150cc' })).toBeChecked();
  });
});

describe('leaving', () => {
  it('goes back to Learn from the Exit button without a call to Core when no session was opened', async () => {
    answer();
    renderAt('/learn/play/kartrush');
    fireEvent.click(await screen.findByRole('button', { name: 'Exit' }));
    expect(await screen.findByText('learn home')).toBeTruthy();
    expect(callsTo('/end')).toHaveLength(0);
  });

  it('closes the session Core opened when the learner exits', async () => {
    answer();
    renderAt('/learn/play/kartrush');
    fireEvent.click(await screen.findByRole('button', { name: 'Go' }));
    await waitFor(() => expect(document.querySelector('iframe')).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Exit' }));
    expect(await screen.findByText('learn home')).toBeTruthy();
    expect(mockedApi).toHaveBeenCalledWith(`/learn/games/kartrush/sessions/${SESSION.sessionId}/end`, expect.objectContaining({ method: 'POST', body: { reason: 'left' } }));
  });

  it('leaves the Garage on Escape', async () => {
    answer();
    renderAt('/learn/play/kartrush');
    await screen.findByRole('heading', { level: 1, name: 'Garage' });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(await screen.findByText('learn home')).toBeTruthy();
  });

  it('leaves the closed card on Escape too', async () => {
    answer({ '/learn/games': list(0) });
    renderAt('/learn/play/kartrush');
    await screen.findByRole('heading', { name: 'All done for today' });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(await screen.findByText('learn home')).toBeTruthy();
  });

  it('closes an open session when the route unmounts (the browser\'s back button)', async () => {
    answer();
    const view = renderAt('/learn/play/kartrush');
    fireEvent.click(await screen.findByRole('button', { name: 'Go' }));
    await waitFor(() => expect(document.querySelector('iframe')).not.toBeNull());
    view.unmount();
    await waitFor(() => expect(callsTo('/end')).toHaveLength(1));
  });
});
