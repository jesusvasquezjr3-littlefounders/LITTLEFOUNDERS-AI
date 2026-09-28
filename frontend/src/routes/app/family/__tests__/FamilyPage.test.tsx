import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { FamilyPage } from '../FamilyPage';

/*
 * W2F.1 route adapter for /family: it binds the rebuilt console to Core, the
 * session and the router, and hands it the wave-1 surfaces for the child in
 * view. The console itself is covered in rebuild/family/console; this file
 * pins the binding: `?child=` picks the child (and picking writes it back),
 * `?join=` shows a second Tutor's invite first, each wave-1 panel receives the
 * child in view, losing access reloads the family, and a network failure is
 * reported as offline.
 */

const { mockApi, mockGetToken } = vi.hoisted(() => ({ mockApi: vi.fn(), mockGetToken: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: mockApi, BASE_URL: 'http://core.test' }));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ getToken: mockGetToken }) }));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ isDark: false }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { resolvedLanguage: 'en-US', language: 'en-US' } }) }));

vi.mock('../LearningPanels', async () => { const { panel } = await import('./panelStub'); return { LearningBridgesPanel: panel('bridges'), LearningNarrativePanel: panel('narrative'), LearningDecisionsPanel: panel('decisions'), StreakPausePanel: panel('learning-pause') }; });
vi.mock('../WalletCorrectionsPanel', async () => { const { panel } = await import('./panelStub'); return { WalletCorrectionsPanel: panel('corrections') }; });
vi.mock('../StreakPausesPanel', async () => { const { panel } = await import('./panelStub'); return { StreakPausesPanel: panel('chore-pauses') }; });
vi.mock('../ShareDestinationsPanel', async () => { const { panel } = await import('./panelStub'); return { ShareDestinationsPanel: panel('share-places') }; });
vi.mock('../AutonomyLadderPanel', async () => { const { panel } = await import('./panelStub'); return { AutonomyLadderPanel: panel('ladder') }; });
vi.mock('../SocialRequestsPanel', async () => { const { panel } = await import('./panelStub'); return { SocialRequestsPanel: panel('requests') }; });
vi.mock('../SocialGraphPanel', async () => { const { panel } = await import('./panelStub'); return { SocialGraphPanel: panel('graph') }; });
vi.mock('../SocialHistoryPanel', async () => { const { panel } = await import('./panelStub'); return { SocialHistoryPanel: panel('history') }; });
vi.mock('../BadgeSharesPanel', async () => { const { panel } = await import('./panelStub'); return { BadgeSharesPanel: panel('old-links') }; });
vi.mock('../SocialNoticesPanel', async () => { const { panel } = await import('./panelStub'); return { SocialNoticesPanel: panel('notices') }; });
vi.mock('@/app-routes/TeenDeletionNoticesPanel', async () => { const { panel } = await import('./panelStub'); return { TeenDeletionNoticesPanel: panel('deletion-notices') }; });
vi.mock('../GovernancePanels', async () => { const { panel } = await import('./panelStub'); return { CoachingTipPanel: panel('tip'), DataPolicyPanel: panel('data-policy'), ResearchConsentPanel: panel('research'), ScopeStatementPanel: panel('scope') }; });
vi.mock('../DataPracticePanels', async () => { const { panel } = await import('./panelStub'); return { DataPracticeConsentPanel: panel('data-practices') }; });
vi.mock('../GuardianInvitePanel', async () => { const { panel } = await import('./panelStub'); return { GuardianInvitePanel: panel('invite'), GuardianInviteJoin: panel('join') }; });
vi.mock('../CoGuardiansPanel', async () => { const { panel } = await import('./panelStub'); return { CoGuardiansPanel: panel('tutors'), GuardianRequestsPanel: panel('tutor-requests') }; });

const KIDS = [
  { userId: 'kid-1', displayName: 'Sofía', username: 'sofia_2016', analyticsConsent: false, pendingApprovalCount: 0, walletTotal: 3, taskStreakDays: 0, accountType: 'child' },
  { userId: 'kid-2', displayName: 'Mateo', username: 'mateo_2018', analyticsConsent: true, pendingApprovalCount: 1, walletTotal: 9, taskStreakDays: 4, accountType: 'child' },
];

function Where() {
  const location = useLocation();
  return <output data-testid="where">{location.search}</output>;
}

beforeEach(() => {
  mockApi.mockReset().mockImplementation(async (path: string) => path === '/family/kids'
    ? { data: { kids: KIDS }, error: null }
    : path.startsWith('/tutor/consent/') ? { data: { active: false, grantedAt: null, locale: null, policy: 'allowed' }, error: null }
      : { data: null, error: { code: 'NOT_FOUND', message: 'unrouted' } });
  mockGetToken.mockReset().mockResolvedValue('token-1');
});

function renderAt(url: string) {
  return render(<MemoryRouter initialEntries={[url]}><Routes><Route path="/family" element={<><FamilyPage /><Where /></>} /></Routes></MemoryRouter>);
}

describe('FamilyPage (W2F.1 adapter)', () => {
  it('opens the child named in the address and hands every wave-1 panel that child', async () => {
    const { container } = renderAt('/family?child=kid-2');
    await screen.findByRole('heading', { level: 2, name: 'Mateo' });
    const kids = [...container.querySelectorAll('[data-panel][data-kid]')].filter((el) => el.getAttribute('data-kid'))
      .map((el) => `${el.getAttribute('data-panel')}:${el.getAttribute('data-kid')}`);
    expect(kids).toEqual(['narrative', 'decisions', 'bridges', 'learning-pause', 'corrections', 'chore-pauses', 'share-places', 'ladder', 'requests', 'graph',
      'history', 'old-links', 'research', 'data-practices', 'invite', 'tutors'].map((name) => `${name}:kid-2`));
    expect(container.querySelector('[data-panel="tip"]')).not.toBeNull();
    expect(mockApi).toHaveBeenCalledWith('/family/kids', expect.objectContaining({ token: 'token-1' }));
  });

  it('writes the picked child back into the address', async () => {
    renderAt('/family');
    const picker = await screen.findByRole('navigation', { name: 'Your children' });
    fireEvent.click(within(picker).getByRole('button', { name: 'Mateo' }));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('?child=kid-2'));
    await screen.findByRole('heading', { level: 2, name: 'Mateo' });
  });

  it('shows a second Tutor\'s invite first when it arrives with the address', async () => {
    const { container } = renderAt('/family?join=invite-123');
    await screen.findByRole('heading', { level: 2, name: 'Sofía' });
    const join = container.querySelector('[data-panel="join"]')!;
    expect(join.textContent).toContain('invite-123');
    expect(join.compareDocumentPosition(screen.getByRole('heading', { level: 2, name: 'Sofía' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('reloads the family when this Tutor loses access to a child', async () => {
    renderAt('/family');
    await screen.findByRole('heading', { level: 2, name: 'Sofía' });
    const before = mockApi.mock.calls.filter(([path]) => path === '/family/kids').length;
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'lose access' })); });
    await waitFor(() => expect(mockApi.mock.calls.filter(([path]) => path === '/family/kids').length).toBe(before + 1));
  });

  it('reports a failure while the browser is offline as offline, and any other failure as ours', async () => {
    mockApi.mockImplementation(async () => ({ data: null, error: { code: 'INTERNAL', message: 'Network error' } }));
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const { unmount } = renderAt('/family');
    expect(await screen.findByText('You seem to be offline. Reconnect and try again.')).toBeInTheDocument();
    unmount();
    online.mockReturnValue(true);
    renderAt('/family');
    expect(await screen.findByText('Something went wrong on our side. Try again.')).toBeInTheDocument();
    online.mockRestore();
  });
});
