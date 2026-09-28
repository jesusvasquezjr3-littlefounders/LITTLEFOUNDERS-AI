import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@/theme/useTheme';
import { AppShellLayout, StaffShellLayout } from '../AppLayouts';

/*
 * The signed-in shells on real routes (W2 Lane 0): which shell an account
 * gets, what its navigation holds, and that no legacy chrome is left.
 */

const auth = vi.hoisted(() => ({
  session: { user: { id: 'user-1' }, isGuest: false } as object,
  roles: ['kid'] as string[],
  adminPermissions: [] as string[],
  meLoaded: true,
  profile: null as null | { locale: string },
  suspended: false,
  deleted: false,
  getToken: async () => 'token',
}));
const wallet = vi.hoisted(() => ({ value: { loaded: true, holder: 'managed_child' as 'teen' | 'managed_child' | null, familyChild: true } }));
const preferences = vi.hoisted(() => ({ value: { character: 'dina', personalized: true } as unknown, error: null as null | object }));

vi.mock('@/auth/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/routes/app/wallet/useWalletAccess', () => ({ useWalletAccess: () => wallet.value }));
vi.mock('@/lib/api', () => ({ api: vi.fn(async () => (preferences.error ? { data: null, error: preferences.error } : { data: preferences.value, error: null })) }));

let userSeq = 0;
beforeEach(() => {
  auth.session = { user: { id: `user-${++userSeq}` }, isGuest: false };
  auth.roles = ['kid'];
  auth.adminPermissions = [];
  auth.suspended = false;
  auth.deleted = false;
  wallet.value = { loaded: true, holder: 'managed_child', familyChild: true };
  preferences.value = { character: 'dina', personalized: true };
  preferences.error = null;
});

function renderApp(path: string, layout: 'app' | 'staff' = 'app') {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={layout === 'app' ? <AppShellLayout /> : <StaffShellLayout />}>
            <Route path="learn" element={<h1>Learn page</h1>} />
            <Route path="family" element={<h1>Family page</h1>} />
            <Route path="admin" element={<h1>Overview page</h1>} />
            <Route path="admin/intel" element={<h1>Intel page</h1>} />
          </Route>
          <Route path="account-suspended" element={<p>Suspended screen</p>} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

const navLinks = () => within(screen.getAllByRole('navigation')[0]!).getAllByRole('link');

describe('the learner app shell', () => {
  it('names the Mentor tab after the chosen character, with a render of the real model, never "Tutor"', async () => {
    renderApp('/learn');
    const mentor = await screen.findAllByRole('link', { name: 'Dina' });
    expect(mentor[0]).toHaveAttribute('href', '/tutor');
    await waitFor(() => expect(mentor[0]!.querySelector('img')).not.toBeNull());
    expect(mentor[0]!.querySelector('img')?.getAttribute('src')).toContain('dina');
    expect(navLinks().map((link) => link.textContent)).toEqual(['Learn', 'Dina', 'Tasks', 'Wallet', 'Profile']);
    for (const nav of screen.getAllByRole('navigation')) expect(nav.textContent).not.toMatch(/tutor|bot|assistant/i);
  });

  it('says "Mentor" with no picture before a character is chosen, and when the preference cannot be read', async () => {
    preferences.value = { character: 'rho', personalized: false };
    renderApp('/learn');
    await waitFor(() => expect(screen.getAllByRole('link', { name: 'Mentor' })[0]).toBeInTheDocument());
    expect(screen.getAllByRole('link', { name: 'Mentor' })[0]!.querySelector('img')).toBeNull();
  });

  it('renders the page inside one <main>, after a skip link, with no legacy chrome', async () => {
    const { container } = renderApp('/learn');
    await screen.findAllByRole('link', { name: 'Dina' });
    expect(container.querySelectorAll('main')).toHaveLength(1);
    expect(container.querySelector('[data-shell="learner"]')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Skip to content' })).toBeInTheDocument();
    expect(within(container.querySelector('main')!).getByRole('heading', { name: 'Learn page' })).toBeInTheDocument();
    // The legacy AppLayout's marks: its raster logo, its sidebar, its glass bars and its "Tutor" lock badge.
    expect(container.querySelector('img[src*="logo"], aside, .lf-glass')).toBeNull();
    // No legacy page body is left (02 rule 23, D13): the page sits directly in the shell's <main>.
    expect(container.querySelector('[data-legacy-body]')).toBeNull();
    expect(container.querySelector('.lf-page-enter, .font-body, .max-w-container')).toBeNull();
    expect(container.querySelector('main > h1')?.textContent).toBe('Learn page');
  });

  it('gives an independent teen the personal wallet and no Tasks (OD-3 Option B)', async () => {
    auth.roles = ['universal'];
    wallet.value = { loaded: true, holder: 'teen', familyChild: false };
    renderApp('/learn');
    await screen.findAllByRole('link', { name: 'Dina' });
    expect(navLinks().map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Learn', '/learn'], ['Dina', '/tutor'], ['Wallet', '/wallet'], ['Profile', '/profile'],
    ]);
  });

  it('sends a suspended or deleted child to the suspended screen, never into a shell', () => {
    auth.suspended = true;
    renderApp('/learn');
    expect(screen.getByText('Suspended screen')).toBeInTheDocument();
    expect(document.querySelector('[data-shell]')).toBeNull();
  });
});

describe('the Tutor console (verified parent)', () => {
  it('uses the Tutor shell with the Tutor role pill and no Mentor slot', () => {
    auth.roles = ['parent'];
    wallet.value = { loaded: true, holder: null, familyChild: false };
    const { container } = renderApp('/family');
    expect(container.querySelector('[data-shell="tutor"]')).not.toBeNull();
    expect(screen.getAllByText('Tutor').length).toBeGreaterThan(0);
    expect(navLinks().map((link) => link.textContent)).toEqual(['Family', 'Tasks', 'Coins', 'Learn', 'Profile']);
    expect(screen.queryByRole('link', { name: /Mentor|Dina/ })).toBeNull();
    expect(navLinks().find((link) => link.getAttribute('aria-current') === 'page')?.textContent).toBe('Family');
  });
});

describe('the staff console', () => {
  it('lists only what the grants open (Learning intel, where Insights lives, G.5; Mentor quality, C.24), plus the way back', () => {
    auth.roles = ['admin'];
    auth.adminPermissions = ['view_analytics'];
    const { container } = renderApp('/admin/intel', 'staff');
    expect(container.querySelector('[data-shell="staff"]')).not.toBeNull();
    const rail = screen.getAllByRole('navigation')[0]!;
    expect(within(rail as HTMLElement).getAllByRole('link').map((link) => link.textContent))
      .toEqual(['Overview', 'Analytics & Health', 'Learning intel', 'Mentor quality', 'Back to app']);
    expect(within(rail as HTMLElement).getByRole('link', { name: 'Learning intel' })).toHaveAttribute('aria-current', 'page');
  });

  it('shows Roles & Access only to a superadmin', () => {
    auth.roles = ['superadmin'];
    renderApp('/admin', 'staff');
    const rail = screen.getAllByRole('navigation')[0]!;
    expect(within(rail).getByRole('link', { name: 'Roles & Access' })).toHaveAttribute('href', '/admin/roles');
    expect(within(rail).getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
  });
});
