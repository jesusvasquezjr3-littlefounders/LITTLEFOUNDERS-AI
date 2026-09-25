import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n';
import { KidTerritoryPage } from '../KidTerritoryPage';

/*
 * OD-20 on the live territory page (Product 10 F.1, F.3): "Share achievement"
 * produces a PICTURE through the rebuild client layer — never the retired
 * link issuer — and the point-of-action disclosure beside it states the
 * image flow's facts. Core remains the enforcing boundary.
 */

const { mockApi, mockShare, stableGetToken } = vi.hoisted(() => ({
  mockApi: vi.fn(),
  mockShare: vi.fn(),
  stableGetToken: vi.fn().mockResolvedValue('tok'),
}));
vi.mock('@/lib/api', () => ({ api: mockApi, BASE_URL: 'https://core.test' }));
vi.mock('@/lib/insights', () => ({ trackInsight: vi.fn() }));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ getToken: stableGetToken }) }));
vi.mock('@/routes/app/learn/TerritoryPage', () => ({ TerritoryView: () => null, TerritoryProgressStrip: () => null }));
vi.mock('@/rebuild/family/achievementImage', () => ({ shareAchievementImage: mockShare }));

const KID = '11111111-1111-4111-8111-111111111111';

beforeEach(async () => {
  await i18n.changeLanguage('en-US');
  mockShare.mockReset();
  mockApi.mockReset();
  mockApi.mockImplementation(async (path: string) => {
    if (path === '/learn/courses') return { data: { courses: [{ slug: 'financial-education' }] }, error: null };
    if (path.endsWith('/goals')) return { data: { goals: [{ id: 'goal-1', title: 'Bike', status: 'reached' }] }, error: null };
    if (path.includes('/territory')) {
      return { data: { tree: { adventures: [] }, stats: { xpPoints: 10, lessonsCompleted: 2, streakDays: 5, longestStreak: 5, lastActiveDate: null } }, error: null };
    }
    return { data: null, error: { code: 'NOT_FOUND', message: 'x' } };
  });
});

function renderPage() {
  return render(<MemoryRouter initialEntries={[`/family/${KID}/territory`]}>
    <Routes><Route path="/family/:kidId/territory" element={<KidTerritoryPage />} /></Routes>
  </MemoryRouter>);
}

describe('territory share action (OD-20)', () => {
  it('shares a streak picture through the image client, never the link issuer', async () => {
    mockShare.mockResolvedValue('downloaded');
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Share achievement/ }));
    await waitFor(() => expect(mockShare).toHaveBeenCalledOnce());
    expect(mockShare.mock.calls[0]![0]).toMatchObject({ baseUrl: 'https://core.test', token: 'tok', kidId: KID, request: { kind: 'streak', locale: 'en-US' } });
    expect(await screen.findByRole('button', { name: /Picture saved/ })).toBeTruthy();
    expect(mockApi.mock.calls.some(([path]) => String(path).endsWith('/badge'))).toBe(false);
  });

  it('shares a reached goal as a picture too', async () => {
    mockShare.mockResolvedValue('shared');
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Share "Bike"/ }));
    await waitFor(() => expect(mockShare).toHaveBeenCalledOnce());
    expect(mockShare.mock.calls[0]![0].request).toEqual({ kind: 'goal_reached', goalId: 'goal-1', locale: 'en-US' });
  });

  it('shows the image-flow disclosure beside each share button and no link language', async () => {
    renderPage();
    await screen.findByRole('button', { name: /Share achievement/ });
    expect(screen.getAllByText('You get a picture with their first name. No link is made.')).toHaveLength(2);
    expect(screen.getAllByText('Anyone you send it to can keep it. It shows LittleFounders.')).toHaveLength(2);
    expect(document.body.textContent).not.toMatch(/30 days|revoke|anyone with it can open/i);
  });

  it('describes each share button with its own disclosure, so a screen reader hears it at the point of action', async () => {
    renderPage();
    const buttons = [
      await screen.findByRole('button', { name: /Share achievement/ }),
      await screen.findByRole('button', { name: /Share "Bike"/ }),
    ];
    const described = buttons.map((button) => (button.getAttribute('aria-describedby') ?? '')
      .split(' ')
      .map((id) => document.getElementById(id)?.textContent ?? '(missing)')
      .join(' '));
    for (const description of described) {
      expect(description).toBe('You get a picture with their first name. No link is made. Anyone you send it to can keep it. It shows LittleFounders.');
    }
    expect(new Set(buttons.map((b) => b.getAttribute('aria-describedby'))).size).toBe(2);
  });

  it('returns to idle on a dismissed share sheet and reports a failure honestly', async () => {
    mockShare.mockResolvedValueOnce('cancelled').mockResolvedValueOnce('failed');
    renderPage();
    const button = await screen.findByRole('button', { name: /Share achievement/ });
    fireEvent.click(button);
    await waitFor(() => expect(mockShare).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('button', { name: /Share achievement/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Share achievement/ }));
    expect(await screen.findByRole('button', { name: /Could not make the picture right now/ })).toBeTruthy();
  });
});
