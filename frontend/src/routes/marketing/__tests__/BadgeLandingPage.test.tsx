import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import en from '@/i18n/en-US/rebuild-site.json';
import { BADGE_LINK_ROUTE_RETIRES_AT, BadgeLandingPage } from '../BadgeLandingPage';

/*
 * The /badge/:token bridge (S10L.3): it asks Core for the legacy link, shows
 * the rebuilt M7 surface, says "expired" for any refusal, stops asking Core
 * once OD-20's retirement date passes, and never tracks the viewer.
 */

const auth = vi.hoisted(() => ({
  session: null as object | null,
  roles: [] as string[],
  meLoaded: true,
  startGuestSession: vi.fn(async () => ({ error: null as object | null, analyticsEnabled: false })),
}));
const core = vi.hoisted(() => ({ api: vi.fn() }));
const insights = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/lib/analytics', () => ({ trackMarketingGoal: vi.fn() }));
vi.mock('@/lib/insights', () => ({ trackInsight: insights.track }));
vi.mock('@/lib/api', () => ({ api: core.api }));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ isDark: false }) }));

beforeEach(() => {
  core.api.mockReset();
  insights.track.mockReset();
});
afterEach(() => vi.useRealTimers());

function open(token = 'tok/../x') {
  return render(<MemoryRouter initialEntries={[`/badge/${encodeURIComponent(token)}`]}><Routes>
    <Route path="/badge/:token" element={<BadgeLandingPage />} />
  </Routes></MemoryRouter>);
}

describe('BadgeLandingPage bridge', () => {
  it('shows a live link and asks Core with the token as one path segment', async () => {
    core.api.mockResolvedValue({ data: { firstName: 'Ana', achievementKind: 'streak', achievementLabel: '7-day streak', imageUrl: '/i.png' }, error: null });
    open();
    expect(await screen.findByRole('heading', { level: 1, name: 'Ana earned 7-day streak' })).toBeInTheDocument();
    expect(core.api).toHaveBeenCalledWith(`/badges/${encodeURIComponent('tok/../x')}`);
    expect(insights.track).not.toHaveBeenCalled();
  });

  it('says the link expired when Core refuses it (revoked, expired, unknown or post-cutover)', async () => {
    core.api.mockResolvedValue({ data: null, error: { status: 404 } });
    open('gone');
    expect(await screen.findByRole('heading', { level: 1, name: en.badgeLanding.expiredTitle })).toBeInTheDocument();
  });

  it('stops asking Core once the route retires (OD-20)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(Date.parse(BADGE_LINK_ROUTE_RETIRES_AT) + 1000));
    open('late');
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(en.badgeLanding.expiredTitle));
    expect(core.api).not.toHaveBeenCalled();
  });
});
