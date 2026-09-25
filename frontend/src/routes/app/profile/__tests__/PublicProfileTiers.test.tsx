import type { ReactNode, ButtonHTMLAttributes } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PublicProfilePage } from '../PublicProfilePage';

/*
 * S08.6 wiring of the legacy public profile to Core's tier verdicts:
 * a private teen renders only the card (E.8), a child sees the Tutor line
 * instead of Follow, and no follower/following number is rendered (E.9).
 */

const { mockApi, getToken } = vi.hoisted(() => ({ mockApi: vi.fn(), getToken: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: mockApi }));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ getToken }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en-US', resolvedLanguage: 'en-US' } }) }));
vi.mock('../ProfileHero', () => ({ ProfileHero: () => null }));
vi.mock('../CourseBadgeCollection', () => ({ CourseBadgeCollection: () => null }));
vi.mock('../ProfileReportControl', () => ({ ProfileReportControl: () => null }));
vi.mock('../ConnectionRequestControl', () => ({ ConnectionRequestControl: ({ decidedBy }: { decidedBy: string }) => <div>request:{decidedBy}</div> }));
vi.mock('../PrivateProfileControl', () => ({ PrivateProfileControl: ({ username, mode, requestPending }: { username: string; mode: string; requestPending: boolean }) => <div>private:{username}:{mode}:{String(requestPending)}</div> }));
vi.mock('../SocialTierNotes', () => ({ ManagedConnectionsControl: () => <div>managed-note</div> }));
vi.mock('@/routes/auth/ErrorBanner', () => ({ ErrorBanner: ({ code }: { code: string }) => <div role="alert">{code}</div> }));
vi.mock('@/components/ui', () => {
  const Container = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return { Badge: Container, Card: Container, SectionHeading: Container, Icon: () => null, LottieIcon: () => null,
    StatCard: ({ value, label }: { value: string; label: string }) => <div>{label}:{value}</div>,
    Button: ({ children, onClick, disabled }: ButtonHTMLAttributes<HTMLButtonElement>) => <button disabled={disabled} onClick={onClick}>{children}</button> };
});

const full = { visibility: 'full', username: 'marta', displayName: 'Marta', cover: {}, avatarOptions: {}, memberSince: '2026-01-01', isFollowing: false,
  requiresGuardianApproval: false, connection: 'follow', isSelf: false, isTutor: false,
  learningStats: { xpPoints: 40, minutesLearned: 12, lessonsCompleted: 3, streakDays: 2, lastActiveDate: null } };

function mount(handle: string) {
  return render(<MemoryRouter initialEntries={[`/@${handle}`]}><Routes><Route path="/:handle" element={<PublicProfilePage />} /></Routes></MemoryRouter>);
}
beforeEach(() => { mockApi.mockReset(); getToken.mockReset().mockResolvedValue('session'); });

it('renders a private teen as the card only: no name, stats or follow', async () => {
  mockApi.mockResolvedValueOnce({ data: { visibility: 'private', username: 'rio', cover: {}, avatarOptions: {}, isSelf: false, isFollowing: false, requiresGuardianApproval: false, connection: 'teenRequest', requestPending: true }, error: null });
  mount('rio');
  expect(await screen.findByText('private:rio:teenRequest:true')).toBeInTheDocument();
  expect(screen.queryByText('profile.stats.title')).toBeNull();
  expect(screen.queryByRole('button', { name: 'profile.public.follow' })).toBeNull();
  expect(screen.getByRole('button', { name: 'profile.public.block' })).toBeInTheDocument();
});

it('shows Follow for an open adult profile and no count anywhere', async () => {
  mockApi.mockResolvedValueOnce({ data: full, error: null });
  const { container } = mount('marta');
  expect(await screen.findByRole('button', { name: 'profile.public.follow' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'profile.stats.followers' })).toBeInTheDocument();
  expect(container.textContent).not.toMatch(/profile\.stats\.followers:\d|profile\.stats\.following:\d/);
  expect(screen.getByText('profile.stats.xp:40')).toBeInTheDocument();
});

it('a child sees the Tutor line instead of Follow', async () => {
  mockApi.mockResolvedValueOnce({ data: { ...full, connection: 'managed' }, error: null });
  mount('marta');
  expect(await screen.findByText('managed-note')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'profile.public.follow' })).toBeNull();
});

it('a teen’s full profile offers a request the teen decides, not a follow', async () => {
  mockApi.mockResolvedValueOnce({ data: { ...full, username: 'rio', connection: 'teenRequest' }, error: null });
  mount('rio');
  expect(await screen.findByText('request:subject')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'profile.public.follow' })).toBeNull();
});
