import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

/*
 * W2M.2: `/tutor` mounts the rebuilt Mentor screen and hands it only what the
 * application knows. The screen itself is covered by rebuild/mentor/screen.
 */
const routeProps = vi.hoisted(() => [] as Record<string, unknown>[]);
const wallet = vi.hoisted(() => ({ value: { loaded: true, holder: null as string | null, familyChild: false } }));
const track = vi.hoisted(() => vi.fn());

vi.mock('@/rebuild/mentor/screen/MentorRoute', () => ({
  MentorRoute: (props: Record<string, unknown>) => { routeProps.push(props); return <div data-testid="mentor-route" />; },
  mentorCopy: () => ({ mentorScreen: { documentTitle: 'Mentor', close: 'Close', unavailable: 'Resting' } }),
}));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ getToken: async () => 'token', session: { user: { id: 'kid-1' } } }) }));
vi.mock('@/routes/app/wallet/useWalletAccess', () => ({ useWalletAccess: () => wallet.value }));
vi.mock('@/lib/insights', () => ({ trackInsight: track }));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ isDark: true }) }));

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import TutorPage from '../TutorPage';

/** The route reaches no legacy Mentor file (08 §0: the legacy UI is not mounted). */
const legacyMentorMounted = () => /from '@\/tutor\//.test(readFileSync(resolve(process.cwd(), 'src/routes/app/TutorPage.tsx'), 'utf8'));

afterEach(() => { routeProps.length = 0; track.mockClear(); window.history.replaceState(null, '', '/'); });

function mount(search = '') {
  window.history.replaceState(null, '', `/tutor${search}`);
  return render(<MemoryRouter initialEntries={[`/tutor${search}`]}><TutorPage /></MemoryRouter>);
}

describe('/tutor mounts the rebuilt Mentor screen (OD-15)', () => {
  it('passes the account, the mode and a guardian link for a child in a family', () => {
    wallet.value = { loaded: true, holder: 'managed_child', familyChild: true };
    mount();
    expect(screen.getByTestId('mentor-route')).toBeInTheDocument();
    expect(routeProps.at(-1)).toMatchObject({ userId: 'kid-1', theme: 'dark', guardianLink: true, reviewSkill: null });
    expect(legacyMentorMounted()).toBe(false);
  });

  it('says no guardian link for a teen without a parent', () => {
    wallet.value = { loaded: true, holder: 'teen', familyChild: false };
    mount();
    expect(routeProps.at(-1)).toMatchObject({ guardianLink: false });
  });

  it('carries a valid guided-review link and drops anything else (B.26)', () => {
    mount('?review=money%2Fchange');
    expect(routeProps.at(-1)).toMatchObject({ reviewSkill: 'money/change' });
    mount('?review=<script>');
    expect(routeProps.at(-1)).toMatchObject({ reviewSkill: null });
  });

  it('records the Mentor opening once per visit (H.3)', () => {
    const { rerender } = mount();
    rerender(<MemoryRouter initialEntries={['/tutor']}><TutorPage /></MemoryRouter>);
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('tutor_open', { routeClass: 'tutor' });
  });
});
