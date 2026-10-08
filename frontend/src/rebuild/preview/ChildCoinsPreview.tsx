import { useMemo, useState } from 'react';
import { CoinAccount, type WalletPart } from '../banking/CoinAccount';
import type { CoinAccountView } from '../banking/bankingApi';
import { ChildCoins } from '../banking/coins/ChildCoins';
import { LearnerShell, MENTOR_NAMES, RebuildRoot, type ShellNavItem } from '../design/controls';
import { NAV_MARKS } from '../design/navMarks';
import type { Locale } from '../design/copyBudget';
import { fakeTransport, ok } from '../family/console/consoleFixtures';
import type { HabitGoal } from '../family/moneyHabitsApi';
import { SavingsGoals } from '../family/SavingsGoals';
import { ShareGiving } from '../family/ShareGiving';
import type { ShareView } from '../family/moneyHabitsApi';
import { accountWire } from '../family/tasks/moneyFixtures';
import { SplitChooser } from '../family/SplitChooser';
import { UsualSplit } from '../family/UsualSplit';
import { rebuildNamespaceCopy } from '../../i18n/rebuild';
import { StaticThemeProvider } from '../../theme/useTheme';
import { coinAccountCopy } from '../../routes/app/family/coinAccountCopy';
import enHabits from '../../i18n/en-US/moneyHabits.json';
import esHabits from '../../i18n/es-MX/moneyHabits.json';
import ptHabits from '../../i18n/pt-BR/moneyHabits.json';

/*
 * The child's Wallet page (F5-K) whole, as the route mounts it, with fixture
 * data and no Core: the page's own component (`ChildCoins`) over a fake
 * transport, and the wave-1 surfaces it takes as slots mounted with fixtures.
 * Preview entry `rebuild.html?screen=child-coins`; `?credits=1` adds a waiting
 * allowance, `?goal=reached` a goal that is done. Development-only; the
 * landing's tablet images are rendered from it (scripts/render-site-tablet.mjs).
 */
const HABITS = { 'en-US': enHabits, 'es-MX': esHabits, 'pt-BR': ptHabits } as const;
const DEMO = {
  'en-US': { card: 'Rocket', goal: 'New bike', second: 'Space book' },
  'es-MX': { card: 'Cohete', goal: 'Bicicleta nueva', second: 'Libro del espacio' },
  'pt-BR': { card: 'Foguete', goal: 'Bicicleta nova', second: 'Livro do espaço' },
} as const;

export function walletFixtureView(locale: Locale): CoinAccountView {
  return {
    register: 'young',
    account: { nickname: DEMO[locale].card, design: 'violet', simulated: true, freeze: { frozen: false, by: null, since: null, holds: ['rewards', 'splits', 'credits', 'share'], canChange: true } },
    pockets: { save: 90, spend: 18, share: 10 }, pendingCredits: 0,
    spendLimit: { configured: true, period: 'weekly', remaining: 12 },
    statement: {
      month: '2026-10', earned: 118, spent: 18, saved: 90, given: 10,
      lines: [
        { id: 4, bucket: 'save', amount: 14, reason: 'task_approved', createdAt: '2026-10-05T16:00:00.000Z' },
        { id: 3, bucket: 'share', amount: 4, reason: 'task_approved', createdAt: '2026-10-05T16:00:00.000Z' },
        { id: 2, bucket: 'spend', amount: -8, reason: 'redemption', createdAt: '2026-10-03T12:00:00.000Z' },
        { id: 1, bucket: 'save', amount: 10, reason: 'allowance', createdAt: '2026-10-01T09:00:00.000Z' },
      ],
    },
  };
}

const WHAT = {
  'en-US': { chore: 'Wash the dishes', reward: 'Pick dinner', gift: 'Animal shelter' },
  'es-MX': { chore: 'Lavar los platos', reward: 'Elegir la cena', gift: 'Refugio de animales' },
  'pt-BR': { chore: 'Lavar a louça', reward: 'Escolher o jantar', gift: 'Abrigo de animais' },
} as const;

/** The latest movements, newest first, each named for what it was for (a bank names the thing, not only the kind). */
export function walletFixtureLines(locale: Locale): NonNullable<CoinAccountView['statement']['lines']> {
  return [
    { id: 5, bucket: 'save', amount: 14, reason: 'task_approved', title: WHAT[locale].chore, createdAt: '2026-10-05T16:00:00.000Z' },
    { id: 4, bucket: 'share', amount: -5, reason: 'share_gift', title: WHAT[locale].gift, createdAt: '2026-10-04T10:00:00.000Z' },
    { id: 3, bucket: 'spend', amount: -8, reason: 'redemption', title: WHAT[locale].reward, createdAt: '2026-10-03T12:00:00.000Z' },
    { id: 2, bucket: 'save', amount: 10, reason: 'allowance', createdAt: '2026-10-01T09:00:00.000Z' },
  ];
}

export function walletFixtureGoals(locale: Locale, reached: boolean): HabitGoal[] {
  const first: HabitGoal = {
    id: '11111111-1111-4111-8111-111111111111', title: DEMO[locale].goal, target: 100, icon: 'bike', status: reached ? 'reached' : 'active', reachedAt: reached ? '2026-10-05T00:00:00.000Z' : null,
    followsGoalId: null, saved: reached ? 100 : 60, progress: reached ? { own: 70, bonus: 10, family: 20, total: 100 } : { own: 42, bonus: 6, family: 12, total: 60 }, nextStep: null,
  };
  const second: HabitGoal = {
    id: '22222222-2222-4222-8222-222222222222', title: DEMO[locale].second, target: 40, icon: 'book', status: 'active', reachedAt: null, followsGoalId: null, saved: 12,
    progress: { own: 12, bonus: 0, family: 0, total: 12 }, nextStep: null,
  };
  return [first, second];
}

/** The Wallet page itself, with no shell around it. */
export function ChildCoinsScreen({ locale, dark, params }: { locale: Locale; dark: boolean; params: URLSearchParams }) {
  const family = rebuildNamespaceCopy[locale].family;
  const habits = HABITS[locale];
  const [open, setOpen] = useState(false);
  const reached = params.get('goal') === 'reached';
  const creditsOn = params.get('credits') === '1';
  const ask = params.get('ask');
  // The goals answer for themselves: putting seeds into (or taking them out of) a goal changes what it holds, so a recorded clip
  // of the move shows the goal grow. Plain Save does not change (what a goal holds is still Save).
  const goals = useMemo(() => walletFixtureGoals(locale, reached), [locale, reached]);
  const transport = useMemo(() => {
    const moves = Object.fromEntries(goals.map((goal) => [`POST /tasks/goals/${goal.id}/moves`, (body: unknown) => {
      const { direction, amount } = (body ?? {}) as { direction?: string; amount?: number };
      const delta = (direction === 'out' ? -1 : 1) * (typeof amount === 'number' ? amount : 0);
      goal.saved = Math.max(0, goal.saved + delta);
      goal.progress = { ...goal.progress, own: Math.max(0, goal.progress.own + delta), total: goal.saved };
      return ok({ moveId: 'preview-goal-move' });
    }]));
    return fakeTransport({
    ...moves,
    'GET /tasks/goals': () => ok({ goals }),
    'GET /banking/account': ok({ account: accountWire({ nickname: DEMO[locale].card, cardDesign: 'violet' }) }),
    'GET /banking/wallet/pending-credits': ok({ credits: creditsOn ? [{ id: 'credit-1', amount: 10, source: 'allowance', createdAt: '2026-10-05T00:00:00.000Z' }] : [] }),
    'GET /banking/register': ok({ register: 'young' }),
    'GET /tasks/wallet': ok({ balances: { save: 90, spend: 18, share: 10 } }),
    'GET /banking/allowance': ok({ rule: { amount: 10, frequency: 'weekly', anchorDay: 5, active: true, nextRunAt: new Date(Date.now() + 3 * 86400000).toISOString() } }),
    'POST /tasks/wallet/moves': ok({ moveId: 'preview-move' }),
    'GET /banking/allowance-request': ok({ request: askFixture(ask) }),
    });
  }, [locale, goals, creditsOn, ask]);
  return <ChildCoins copy={family.childCoins} colours={family.coinCard} locale={locale} dark={dark} transport={transport} onNavigate={() => {}} refreshKey={0}
        slots={{
          account: (_version: number, part: WalletPart, actions) => <CoinAccount part={part} actions={actions} copy={coinAccountCopy(locale, 'young')} register="young" locale={locale} dark={dark} view={walletFixtureView(locale)} loading={false}
            failed={false} busy={false} notice={null} onRetry={() => {}} onFreeze={() => {}} recentLines={part === 'recent' ? walletFixtureLines(locale) : null} />,
          split: (credit) => <SplitChooser copy={habits.split} locale={locale} dark={dark} amount={credit.amount} usual={{ save: 50, spend: 40, share: 10 }}
            goals={[]} busy={false} notice={null} onSubmit={() => {}} />,
          usualSplit: <UsualSplit copy={habits.usualSplit as never} locale={locale} dark={dark} open={open} loading={false} failed={false} value={{ usual: { save: 50, spend: 40, share: 10 }, custom: false, recommended: { save: 50, spend: 40, share: 10 } }} busy={false}
            notice={null} onToggle={() => setOpen(!open)} onRetry={() => {}} onSave={() => {}} />,
          bonus: null,
          share: <ShareGiving copy={habits.share as never} teenCopy={habits.shareTeen as never} locale={locale} dark={dark} available={10} view={shareFixture(locale)} loading={false} failed={false} busy={false}
            notice={null} selfDirected={false} onRetry={() => {}} onPledge={() => {}} onTakeBack={() => {}} onAddPlace={() => {}} onRemovePlace={() => {}} onMarkGiven={() => {}} />,
          goals: (_version: number, options) => <SavingsGoals compact={options.compact} startAdding={options.adding} copy={habits.goals} progressCopy={habits.goalProgress} nextCopy={habits.nextGoal} locale={locale} dark={dark} goals={goals.map((goal) => ({ ...goal }))}
            loading={false} failed={false} busy={false} notice={null} nextNotice={null} onRetry={() => {}} onCreate={() => {}} onArchive={() => {}} onEdit={() => {}} onMove={options.onMove ? (goal, direction) => options.onMove(goal.id, direction) : undefined} headingAction={options.headingAction} onSeen={async () => false} onStartNext={() => {}} onNotNow={() => {}} />,
          history: null, bridge: null, research: null,
        }} />;
}

/** The Wallet as a child sees it: inside the learner shell, which gives the page its rail, its padding and its width. */
const PLACES = {
  'en-US': ['Animal shelter', 'Gift for Grandma'], 'es-MX': ['Refugio de animales', 'Regalo para la abuela'], 'pt-BR': ['Abrigo de animais', 'Presente para a vovó'],
} as const;

const NOTE = { 'en-US': 'We took food to the shelter.', 'es-MX': 'Llevamos comida al refugio.', 'pt-BR': 'Levamos comida ao abrigo.' } as const;

function shareFixture(locale: Locale): ShareView {
  return {
    destinations: [
      { id: '33333333-3333-4333-8333-333333333333', title: PLACES[locale][0], kind: 'charity', chosenBy: 'tutor', status: 'active', createdAt: '2026-09-01T00:00:00.000Z' },
      { id: '44444444-4444-4444-8444-444444444444', title: PLACES[locale][1], kind: 'gift', chosenBy: 'tutor', status: 'active', createdAt: '2026-09-01T00:00:00.000Z' },
    ],
    gifts: [{ id: '55555555-5555-4555-8555-555555555555', destinationId: '33333333-3333-4333-8333-333333333333', amount: 5, status: 'given', pledgedAt: '2026-09-20T00:00:00.000Z',
      settledAt: '2026-09-22T00:00:00.000Z', settledBy: 'tutor', note: NOTE[locale] }],
  };
}

/** `?ask=waiting` a request waiting for the Tutor; `?ask=denied` a "not yet" with its reason and its day; otherwise none. */
function askFixture(kind: string | null) {
  if (kind !== 'waiting' && kind !== 'denied') return null;
  const base = { id: 'ask-1', kidUserId: 'kid', fromAmount: 10, amount: 15, reasonKind: 'saving_goal', note: null, createdAt: new Date(Date.now() - 86400000).toISOString() };
  return kind === 'waiting'
    ? { ...base, status: 'requested', decidedAt: null, decisionCode: null, decisionReason: null, revisitOn: null }
    : { ...base, status: 'denied', decidedAt: new Date().toISOString(), decisionCode: 'later_date', decisionReason: 'Save two more weeks and ask again', revisitOn: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10) };
}

export function ChildCoinsPreview({ locale, theme, params }: { locale: Locale; theme: 'light' | 'dark'; params: URLSearchParams }) {
  const dark = theme === 'dark';
  const shell = rebuildNamespaceCopy[locale].core.appShell;
  const item = (id: 'learn' | 'tasks' | 'wallet' | 'profile'): ShellNavItem => ({ id, label: shell.nav[id], href: `#${id}`, iconAssetId: NAV_MARKS[id] });
  return <RebuildRoot theme={theme} locale={locale}>
    <StaticThemeProvider isDark={dark}>
      <LearnerShell appName="LittleFounders" pageTitle={shell.nav.wallet} routeKey="child-coins" locale={locale} onNavigate={() => {}} current="wallet"
        items={[item('learn'), item('tasks'), item('wallet'), item('profile')]} labels={{ skip: shell.skip, navigation: shell.navigation }}
        mentor={{ href: '#mentor', name: MENTOR_NAMES.zara, character: 'zara' }}>
        <ChildCoinsScreen locale={locale} dark={dark} params={params} />
      </LearnerShell>
    </StaticThemeProvider>
  </RebuildRoot>;
}

