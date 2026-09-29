import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { rebuildNamespaceCopy } from '@/i18n/rebuild';
import en from '@/i18n/en-US/moneyHabits.json';
import { ChildCoins } from '@/rebuild/banking/coins/ChildCoins';
import { fakeTransport, ok, type Answer } from '@/rebuild/family/console/consoleFixtures';
import { ChildTasks } from '@/rebuild/family/tasks/ChildTasks';
import { accountWire, fakePhotos, T, TASK_APPROVED, TASKS } from '@/rebuild/family/tasks/moneyFixtures';
import { AllocationPanel } from '../AllocationPanel';
import { splitResultText } from '../../family/moneyHabitsCopy';

/*
 * GAP-FIX-R4 (Frontend Bible 02 §9.2, mockup K18, OD-7, D.13): confirming a
 * coin split gets a lasting status that states the result ("Done: 5 to Save,
 * 4 to Spend, 1 to Share."). The payout's own slot leaves the board on the
 * re-read that follows the split, so the board (ChildTasks, ChildCoins) holds
 * the confirmation, wired exactly as TasksPage and BankingPage wire it. It is
 * a status only: no celebration (a split is not an OD-7 milestone).
 */

const { mockApi } = vi.hoisted(() => ({ mockApi: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: mockApi }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { resolvedLanguage: 'en-US' } }) }));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ isDark: false }) }));

const family = rebuildNamespaceCopy['en-US'].family;
const USUAL = { usual: { save: 50, spend: 40, share: 10 }, custom: false, recommended: { save: 50, spend: 40, share: 10 } };
const RESULT = 'Done: 5 to Save, 4 to Spend, 1 to Share.';

/** Core for the split panel (the shared client): the usual split, no goals, and one allocation that settles `onAllocate`. */
function serveSplit(path: string, onAllocate: () => void) {
  mockApi.mockImplementation(async (url: string, options: { method?: string }) => {
    const key = `${options.method ?? 'GET'} ${url}`;
    if (key === 'GET /tasks/wallet/split') return { data: USUAL, error: null };
    if (key === 'GET /tasks/goals') return { data: { goals: [] }, error: null };
    if (key === `POST ${path}`) { onAllocate(); return { data: { allocated: true, goal: null }, error: null }; }
    return { data: null, error: { code: 'NOT_STUBBED' } };
  });
}

const slot = (name: string) => <p data-copy-role="data" data-slot={name}>{name}</p>;

beforeEach(() => { mockApi.mockReset(); });

describe('the split result outlives the payout it confirms', () => {
  it('formats the three placed counts in every locale', () => {
    expect(splitResultText('en-US', { save: 5, spend: 4, share: 1 })).toBe(RESULT);
    expect(splitResultText('es-MX', { save: 5, spend: 4, share: 1 })).toBe('Listo: 5 a Ahorrar, 4 a Gastar, 1 a Compartir.');
    expect(splitResultText('pt-BR', { save: 5, spend: 4, share: 1 })).toBe('Pronto: 5 para Poupar, 4 para Gastar, 1 para Compartilhar.');
    expect(en.split.result).not.toMatch(/\{(?!save|spend|share)/);
  });

  it('on /tasks: the chore leaves the board after the re-read, the result stays, and nothing celebrates', async () => {
    let allocated = false;
    serveSplit(`/tasks/${TASK_APPROVED}/allocate`, () => { allocated = true; });
    const mine = TASKS.slice(0, 3);
    const transport = fakeTransport({
      'GET /tasks/mine': () => ok({ tasks: allocated ? mine.map((t) => t.id === TASK_APPROVED ? { ...t, allocated: true } : t) : mine }),
      'GET /tasks/wallet': () => ok({ balances: allocated ? { save: 17, spend: 24, share: 4 } : { save: 12, spend: 20, share: 3 } }),
      'GET /tasks/catalog/available': ok({ items: [] }),
      'GET /tasks/redemptions/mine': ok({ redemptions: [] }),
      'GET /banking/register': ok({ register: 'young' }),
    } satisfies Record<string, Answer>);
    const view = render(<ChildTasks copy={family.childTasks} locale="en-US" dark={false} transport={transport} photos={fakePhotos()} onNavigate={vi.fn()}
      slots={{ streak: slot('streak'), level: slot('level'), notes: slot('notes'), usualSplit: slot('usual'), goals: slot('goals'), share: slot('share'),
        history: slot('history'), done: () => null, ask: () => null,
        split: (task, settled) => <AllocationPanel token="t" kind="task" id={task.id} amount={task.rewardCoins} title={task.title}
          onDone={(split) => settled(splitResultText('en-US', split))} /> }} />);
    fireEvent.click(await screen.findByRole('button', { name: en.split.splitNow }));
    fireEvent.click(await screen.findByRole('button', { name: en.split.use }));
    // The re-read removed the payout (and with it the SplitChooser); the board still states the result.
    await waitFor(() => expect(view.container.querySelector('[data-family-part="payouts"]')).toBeNull());
    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent(RESULT);
    expect(view.container.querySelector('[data-family-part="split-result"]')).toContainElement(status);
    expect(view.container.querySelector('[data-money-habits="split-chooser"]')).toBeNull();
    expect(view.container.querySelector('[data-celebration], .lf-celebration')).toBeNull();
    // The pockets re-read too: the split settled into place.
    expect(view.container.querySelector('[data-family-part="pockets"] [data-pocket="save"]')).toHaveTextContent('17');
  });

  it('on /family-wallet: the allowance leaves the board after the re-read, the result stays, and nothing celebrates', async () => {
    let allocated = false;
    serveSplit('/banking/wallet/pending-credits/credit-1/allocate', () => { allocated = true; });
    const transport = fakeTransport({
      'GET /banking/account': ok({ account: accountWire() }),
      'GET /banking/wallet/pending-credits': () => ok({ credits: allocated ? [] : [{ id: 'credit-1', amount: 10, source: 'allowance', createdAt: T }] }),
      'GET /banking/register': ok({ register: 'young' }),
    } satisfies Record<string, Answer>);
    const view = render(<ChildCoins copy={family.childCoins} colours={family.coinCard} locale="en-US" dark={false} transport={transport} onNavigate={vi.fn()}
      slots={{ account: () => slot('account'), usualSplit: slot('usual'), bonus: slot('bonus'), goals: () => slot('goals'), history: slot('history'),
        bridge: slot('bridge'), research: slot('research'),
        split: (credit, frozen, settled) => <AllocationPanel token="t" kind="credit" id={credit.id} amount={credit.amount} frozen={frozen}
          onDone={(split) => settled(splitResultText('en-US', split))} /> }} />);
    fireEvent.click(await screen.findByRole('button', { name: en.split.splitNow }));
    fireEvent.click(await screen.findByRole('button', { name: en.split.use }));
    await waitFor(() => expect(view.container.querySelector('[data-family-part="payouts"]')).toBeNull());
    expect(await screen.findByRole('status')).toHaveTextContent(RESULT);
    expect(view.container.querySelector('[data-celebration], .lf-celebration')).toBeNull();
  });
});
