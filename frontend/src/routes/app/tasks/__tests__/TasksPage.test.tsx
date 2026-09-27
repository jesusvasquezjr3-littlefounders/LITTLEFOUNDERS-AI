import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n';
import { rebuildNamespaceCopy } from '@/i18n/rebuild';
import { TasksPage } from '../TasksPage';

/*
 * /tasks (W2F.2): the route picks the rebuilt board by who is signed in (a
 * Tutor, a parent-created child, a teen who linked a parent), emits H.3's
 * `task_view` once, and wires the wave-1 surfaces so a chore marked done
 * moves the streak (with Core's milestone), the level and the board.
 */
const mocks = vi.hoisted(() => ({ api: vi.fn(), getToken: vi.fn().mockResolvedValue('synthetic'), roles: ['parent'] as string[], familyChild: false,
  track: vi.fn(), streak: vi.fn(), level: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: mocks.api, BASE_URL: 'http://core.test' }));
vi.mock('@/lib/insights', () => ({ trackInsight: mocks.track }));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ isDark: false }) }));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ getToken: mocks.getToken, roles: mocks.roles, session: { user: { id: 'me' } } }) }));
vi.mock('../../wallet/useWalletAccess', () => ({ useWalletAccess: () => ({ loaded: true, holder: mocks.familyChild ? 'teen' : null, familyChild: mocks.familyChild }) }));
vi.mock('../../family/GovernancePanels', () => ({ CoachingTipPanel: () => <p data-copy-role="data">tip</p> }));
vi.mock('../DecisionQueuePanel', () => ({ DecisionQueuePanel: ({ kids }: { kids: { displayName: string }[] }) => <p data-copy-role="data">{`queue:${kids.map((k) => k.displayName).join(',')}`}</p> }));
vi.mock('../ChoreComposerPanel', () => ({ ChoreComposerPanel: () => <p data-copy-role="data">composer</p> }));
vi.mock('../ChoreStreakPanel', () => ({ ChoreStreakPanel: (props: { refreshKey: number; milestone: string | null }) => { mocks.streak(props); return null; } }));
vi.mock('../FamilyVoicePanels', () => ({
  MyLevelPanel: (props: { refreshKey: number }) => { mocks.level(props); return null; },
  DecisionNotesPanel: () => null,
  RewardAskPanel: () => null,
  ChoreDonePanel: ({ onMarked, title }: { title: string; onMarked: (answer: unknown) => void }) =>
    <button type="button" data-copy-role="action" onClick={() => onMarked({ task: {}, selfLogged: false, milestone: 'streak-7' })}>{`done:${title}`}</button>,
}));
vi.mock('../SavingsGoalsPanel', () => ({ SavingsGoalsPanel: () => null }));
vi.mock('../ShareGivingPanel', () => ({ ShareGivingPanel: () => null }));
vi.mock('../UsualSplitPanel', () => ({ UsualSplitPanel: () => null }));
vi.mock('../WalletActivityPanel', () => ({ WalletActivityPanel: () => null }));
vi.mock('../AllocationPanel', () => ({ AllocationPanel: () => null }));

const T = '2026-09-20T10:00:00.000Z';
const task = { id: 't1', assignedBy: 'p', assignedTo: 'k1', title: 'Set the table', rewardCoins: 0, recurrence: 'once', dueAt: null, status: 'open', allocated: false,
  createdAt: T, hasEvidence: false, requiresEvidence: false, cancelReason: null, kind: 'contribution', completedOn: null, childNote: null };
const kid = { userId: 'k1', displayName: 'Sofía', username: 'sofia', analyticsConsent: false, pendingApprovalCount: 0, walletTotal: 0, taskStreakDays: 0,
  accountType: 'child', profileReview: null };

beforeEach(async () => {
  mocks.api.mockReset(); mocks.track.mockReset(); mocks.streak.mockReset(); mocks.level.mockReset();
  await i18n.changeLanguage('en-US');
  mocks.api.mockImplementation(async (path: string) => {
    const data: Record<string, unknown> = {
      '/family/kids': { kids: [kid] }, '/tasks': { tasks: [task] }, '/tasks/catalog': { items: [] }, '/tasks/redemptions': { redemptions: [] },
      '/tasks/mine': { tasks: [task] }, '/tasks/wallet': { balances: { save: 1, spend: 2, share: 3 } }, '/tasks/catalog/available': { items: [] },
      '/tasks/redemptions/mine': { redemptions: [] }, '/banking/register': { register: 'young' },
    };
    return path in data ? { data: data[path], error: null } : { data: null, error: { code: 'NOT_ROUTED', message: '' } };
  });
});

const page = () => render(<MemoryRouter><TasksPage /></MemoryRouter>);
const en = rebuildNamespaceCopy['en-US'].family;

describe('TasksPage', () => {
  it('gives a Tutor the Tutor board, with the queue naming their children, and emits task_view once', async () => {
    mocks.roles = ['parent']; mocks.familyChild = false;
    const view = page();
    expect(await screen.findByText('queue:Sofía')).toBeInTheDocument();
    expect(view.container.querySelector('[data-screen="tutor-tasks"]')).not.toBeNull();
    view.rerender(<MemoryRouter><TasksPage /></MemoryRouter>);
    expect(mocks.track).toHaveBeenCalledTimes(1);
    expect(mocks.track).toHaveBeenCalledWith('task_view', { routeClass: 'tasks' });
  });

  it('gives a teen who linked a parent the child board', async () => {
    mocks.roles = ['universal']; mocks.familyChild = true;
    const view = page();
    await screen.findByRole('heading', { level: 2, name: en.childTasks.choresTitle });
    expect(view.container.querySelector('[data-screen="child-tasks"]')).not.toBeNull();
  });

  it('moves the streak (with Core\'s milestone) and the level when a chore is marked done, and re-reads the board', async () => {
    mocks.roles = ['kid']; mocks.familyChild = false;
    page();
    fireEvent.click(await screen.findByRole('button', { name: 'done:Set the table' }));
    await waitFor(() => expect(mocks.streak).toHaveBeenLastCalledWith(expect.objectContaining({ refreshKey: 1, milestone: 'streak-7' })));
    expect(mocks.level).toHaveBeenLastCalledWith(expect.objectContaining({ refreshKey: 1 }));
    await waitFor(() => expect(mocks.api.mock.calls.filter(([path]) => path === '/tasks/mine').length).toBeGreaterThanOrEqual(2));
  });
});
