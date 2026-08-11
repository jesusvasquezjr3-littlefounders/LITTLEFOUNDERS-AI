import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RequireGuest } from './RequireGuest';

/*
 * A guest (anonymous) session must NOT be treated as "already authenticated"
 * here — otherwise the moment a visitor uses the primary landing CTA
 * (startGuestSession), /login and /signup become permanently unreachable,
 * since /upgrade-account can only attach an identity to the CURRENT guest
 * session, never switch to a different pre-existing account.
 */

let session: { userId: string } | null | undefined;
let isGuest: boolean;
vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({
    get session() {
      return session;
    },
    get isGuest() {
      return isGuest;
    },
  }),
}));

beforeEach(() => {
  session = undefined;
  isGuest = false;
});

function renderGuarded() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<RequireGuest><div>login form</div></RequireGuest>} />
        <Route path="/learn" element={<div>landed on learn</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireGuest', () => {
  it('renders nothing while the session is still restoring from storage', () => {
    session = undefined;
    const { container } = renderGuarded();
    expect(container).toBeEmptyDOMElement();
  });

  it('renders children for a fully logged-out visitor (session === null, not undefined)', () => {
    session = null;
    isGuest = false;
    renderGuarded();
    expect(screen.getByText('login form')).toBeInTheDocument();
  });

  it('renders children for a GUEST session — /login must stay reachable', () => {
    session = { userId: 'guest-1' };
    isGuest = true;
    renderGuarded();
    expect(screen.getByText('login form')).toBeInTheDocument();
  });

  it('redirects a REAL (non-guest) session to APP_HOME', () => {
    session = { userId: 'real-1' };
    isGuest = false;
    renderGuarded();
    expect(screen.getByText('landed on learn')).toBeInTheDocument();
  });
});
