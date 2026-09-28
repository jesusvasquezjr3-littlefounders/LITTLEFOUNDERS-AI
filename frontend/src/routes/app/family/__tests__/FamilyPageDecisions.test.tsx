import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { FamilyPage } from '../FamilyPage';

/*
 * GAP-FIX-R2 (OD-27 (3), owner review L-13; B.9/B.10): /family mounts the
 * Tutor's view of a child's story choices in the child's learning group. The
 * real ChildDecisionsPanel runs against a synthetic Core: an under-13
 * parent-created child's choices appear; a teen's private journal
 * (JOURNAL_PRIVATE) leaves no trace, not even a heading.
 */

const { mockApi, mockGetToken } = vi.hoisted(() => ({ mockApi: vi.fn(), mockGetToken: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: mockApi, BASE_URL: 'http://core.test' }));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ getToken: mockGetToken }) }));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ isDark: false }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { resolvedLanguage: 'en-US', language: 'en-US' } }) }));

// Every other wave-1 panel is a stand-in; the decisions host is the real one.
vi.mock('../LearningPanels', async (original) => {
  const actual = await original<typeof import('../LearningPanels')>();
  const { panel } = await import('./panelStub');
  return { ...actual, LearningBridgesPanel: panel('bridges'), LearningNarrativePanel: panel('narrative'), StreakPausePanel: panel('learning-pause') };
});
vi.mock('../WalletCorrectionsPanel', async () => { const { panel } = await import('./panelStub'); return { WalletCorrectionsPanel: panel('corrections') }; });
vi.mock('../StreakPausesPanel', async () => { const { panel } = await import('./panelStub'); return { StreakPausesPanel: panel('chore-pauses') }; });
vi.mock('../ShareDestinationsPanel', async () => { const { panel } = await import('./panelStub'); return { ShareDestinationsPanel: panel('share-places') }; });
vi.mock('../AutonomyLadderPanel', async () => { const { panel } = await import('./panelStub'); return { AutonomyLadderPanel: panel('ladder') }; });
vi.mock('../SocialRequestsPanel', async () => { const { panel } = await import('./panelStub'); return { SocialRequestsPanel: panel('requests') }; });
vi.mock('../SocialGraphPanel', async () => { const { panel } = await import('./panelStub'); return { SocialGraphPanel: panel('graph') }; });
vi.mock('../SocialHistoryPanel', async () => { const { panel } = await import('./panelStub'); return { SocialHistoryPanel: panel('history') }; });
vi.mock('../BadgeSharesPanel', async () => { const { panel } = await import('./panelStub'); return { BadgeSharesPanel: panel('old-links') }; });
vi.mock('../SocialNoticesPanel', async () => { const { panel } = await import('./panelStub'); return { SocialNoticesPanel: panel('notices') }; });
vi.mock('../GovernancePanels', async () => { const { panel } = await import('./panelStub'); return { CoachingTipPanel: panel('tip'), DataPolicyPanel: panel('data-policy'), ResearchConsentPanel: panel('research'), ScopeStatementPanel: panel('scope') }; });
vi.mock('../DataPracticePanels', async () => { const { panel } = await import('./panelStub'); return { DataPracticeConsentPanel: panel('data-practices') }; });
vi.mock('../GuardianInvitePanel', async () => { const { panel } = await import('./panelStub'); return { GuardianInvitePanel: panel('invite'), GuardianInviteJoin: panel('join') }; });
vi.mock('../CoGuardiansPanel', async () => { const { panel } = await import('./panelStub'); return { CoGuardiansPanel: panel('tutors'), GuardianRequestsPanel: panel('tutor-requests') }; });
vi.mock('@/app-routes/CoopGoalsConsentPanel', async () => { const { panel } = await import('./panelStub'); return { CoopGoalsConsentPanel: panel('coop') }; });

const KIDS = [
  { userId: 'kid-young', displayName: 'Sofía', username: 'sofia_2016', analyticsConsent: false, pendingApprovalCount: 0, walletTotal: 3, taskStreakDays: 0, accountType: 'child' },
  { userId: 'kid-teen', displayName: 'Mateo', username: 'mateo_2011', analyticsConsent: true, pendingApprovalCount: 0, walletTotal: 9, taskStreakDays: 0, accountType: 'child' },
];

const DECISIONS = {
  locale: 'en-US',
  entries: [{ id: 'd-1', courseTitle: 'Coins and choices', lessonTitle: 'The lemonade stand', situation: 'Rain is coming and the stand is open.',
    choice: 'Save half the lemons for tomorrow.', recordedAt: '2026-09-20T15:00:00.000Z' }],
  hasMore: false,
};

beforeEach(() => {
  mockApi.mockReset().mockImplementation(async (path: string) => {
    if (path === '/family/kids') return { data: { kids: KIDS }, error: null };
    if (path.startsWith('/tutor/consent/')) return { data: { active: false, grantedAt: null, locale: null, policy: 'allowed' }, error: null };
    if (path.startsWith('/family/learning/kids/kid-young/decisions')) return { data: DECISIONS, error: null };
    if (path.startsWith('/family/learning/kids/kid-teen/decisions')) return { data: null, error: { code: 'JOURNAL_PRIVATE', message: 'private' } };
    return { data: null, error: { code: 'NOT_FOUND', message: 'unrouted' } };
  });
  mockGetToken.mockReset().mockResolvedValue('token-1');
});

function renderAt(url: string) {
  return render(<MemoryRouter initialEntries={[url]}><Routes><Route path="/family" element={<FamilyPage />} /></Routes></MemoryRouter>);
}

describe('/family story choices (OD-27 (3))', () => {
  it('shows an under-13 child\'s story choices to the verified Tutor', async () => {
    const { container } = renderAt('/family?child=kid-young');
    await screen.findByRole('heading', { level: 2, name: 'Sofía' });
    const heading = await screen.findByRole('heading', { name: 'Story choices' });
    const section = heading.closest('[data-screen="child-decisions"]')!;
    expect(section).not.toBeNull();
    // It sits in the child's learning group, beside the narrative.
    const narrative = container.querySelector('[data-panel="narrative"]')!;
    expect(narrative.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'See choices' }));
    expect(await screen.findByText('Save half the lemons for tomorrow.')).toBeVisible();
    expect(mockApi).toHaveBeenCalledWith('/family/learning/kids/kid-young/decisions?limit=10&offset=0', expect.objectContaining({ token: 'token-1' }));
  });

  it('renders nothing for a teen whose journal is private', async () => {
    const { container } = renderAt('/family?child=kid-teen');
    await screen.findByRole('heading', { level: 2, name: 'Mateo' });
    await waitFor(() => expect(mockApi).toHaveBeenCalledWith('/family/learning/kids/kid-teen/decisions?limit=10&offset=0', expect.anything()));
    await waitFor(() => expect(container.querySelector('[data-screen="child-decisions"]')).toBeNull());
    expect(screen.queryByRole('heading', { name: 'Story choices' })).toBeNull();
  });
});
