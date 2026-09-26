import type { ReactNode, ButtonHTMLAttributes } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PublicProfilePage } from '../PublicProfilePage';
import { APP_HOME } from '@/app-shell/home';
const { mockApi, getToken } = vi.hoisted(() => ({ mockApi: vi.fn(), getToken: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: mockApi }));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ getToken }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en-US' } }) }));
vi.mock('../ProfileHero', () => ({ ProfileHero: () => null }));
vi.mock('../CourseBadgeCollection', () => ({ CourseBadgeCollection: () => null }));
vi.mock('../ConnectionRequestControl', () => ({ ConnectionRequestControl: () => null }));
vi.mock('@/routes/auth/ErrorBanner', () => ({ ErrorBanner: ({ code }: { code: string }) => <div role="alert">{code}</div> }));
vi.mock('@/components/ui', () => {
  const Container = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return { Badge: Container, Card: Container, SectionHeading: Container, Icon: () => null, LottieIcon: () => null, StatCard: () => null,
    Button: ({ children, onClick, disabled }: ButtonHTMLAttributes<HTMLButtonElement>) => <button disabled={disabled} onClick={onClick}>{children}</button> };
});
const profile = { username: 'person', displayName: 'Person', cover: {}, avatarOptions: {}, memberSince: '2026-01-01', followers: 7, following: 2, isFollowing: true, requiresGuardianApproval: false, isSelf: false, isTutor: false, learningStats: { xpPoints: 0, minutesLearned: 0, lessonsCompleted: 0, streakDays: 0, lastActiveDate: null } };
function mount() { render(<MemoryRouter initialEntries={['/@person']}><Routes><Route path={APP_HOME} element={<div>Home after withdrawal</div>} /><Route path="/:handle" element={<PublicProfilePage />} /></Routes></MemoryRouter>); }
beforeEach(() => { mockApi.mockReset(); getToken.mockReset().mockResolvedValue('session'); });
it('waits for confirmed withdrawal before presenting the follow action', async () => {
  let finish!: (value: unknown) => void;
  mockApi.mockResolvedValueOnce({ data: profile, error: null }).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  mount(); fireEvent.click(await screen.findByRole('button', { name: 'profile.public.following' }));
  expect(screen.getByRole('button', { name: 'profile.public.following' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'profile.public.follow' })).toBeNull();
  await vi.waitFor(() => expect(mockApi).toHaveBeenCalledWith('/profiles/person/follow', { method: 'DELETE', token: 'session' }));
  finish({ data: { following: false }, error: null });
  expect(await screen.findByRole('button', { name: 'profile.public.follow' })).toBeEnabled();
});
it('shows the server failure without presenting successful withdrawal', async () => {
  mockApi.mockResolvedValueOnce({ data: profile, error: null }).mockResolvedValueOnce({ data: null, error: { code: 'INTERNAL' } });
  mount(); fireEvent.click(await screen.findByRole('button', { name: 'profile.public.following' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('INTERNAL');
  expect(screen.queryByRole('button', { name: 'profile.public.follow' })).toBeNull();
});

it('allows an approved child connection to be withdrawn and leaves the private profile after confirmation', async () => {
  mockApi.mockResolvedValueOnce({ data: { ...profile, requiresGuardianApproval: true }, error: null }).mockResolvedValueOnce({ data: { following: false }, error: null });
  mount(); fireEvent.click(await screen.findByRole('button', { name: 'profile.public.following' }));
  expect(await screen.findByText('Home after withdrawal')).toBeVisible();
  expect(screen.queryByText('@person')).toBeNull();
  expect(mockApi).toHaveBeenCalledWith('/profiles/person/follow', { method: 'DELETE', token: 'session' });
});
