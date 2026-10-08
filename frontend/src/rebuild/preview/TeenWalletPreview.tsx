import { LearnerShell, MENTOR_NAMES, RebuildRoot, type ShellNavItem } from '../design/controls';
import { NAV_MARKS } from '../design/navMarks';
import type { Locale } from '../design/copyBudget';
import { TeenWallet } from '../wallet/TeenWallet';
import type { Session } from '../wallet/walletApi';
import { rebuildNamespaceCopy } from '../../i18n/rebuild';
import { StaticThemeProvider } from '../../theme/useTheme';
import { moneyHabitsInRegister } from '../../routes/app/family/coinAccountCopy';
import en from '../../i18n/en-US/teenWallet.json';
import es from '../../i18n/es-MX/teenWallet.json';
import pt from '../../i18n/pt-BR/teenWallet.json';

/*
 * The self-registered teen's wallet (/wallet, OD-3 Option B) whole, with fixture
 * data and no Core, inside the learner shell. Preview entry
 * `rebuild.html?screen=teen-wallet`. Development-only.
 */
const TEXT = { 'en-US': en, 'es-MX': es, 'pt-BR': pt } as const;
const GOAL = { 'en-US': 'Headphones', 'es-MX': 'Audífonos', 'pt-BR': 'Fones de ouvido' } as const;
const REWARD = { 'en-US': 'Movie night', 'es-MX': 'Noche de cine', 'pt-BR': 'Noite de cinema' } as const;

function fixtureSession(locale: Locale): Session {
  const routes: Record<string, unknown> = {
    'GET /wallet/access': { holder: 'teen', familyChild: false },
    'GET /tasks/wallet': { balances: { save: 64, spend: 22, share: 8 } },
    'GET /tasks/goals': { goals: [
      { id: '11111111-1111-4111-8111-111111111111', title: GOAL[locale], target: 80, icon: 'star', status: 'active', reachedAt: null, followsGoalId: null, saved: 40,
        progress: { own: 40, bonus: 0, family: 0, total: 40 }, nextStep: null },
    ] },
    'GET /tasks/wallet/split': { usual: { save: 50, spend: 40, share: 10 }, custom: false, recommended: { save: 50, spend: 40, share: 10 } },
    'GET /tasks/share': { destinations: [], gifts: [] },
    'GET /wallet/rewards': { rewards: [{ id: '22222222-2222-4222-8222-222222222222', title: REWARD[locale], cost: 5, status: 'active', createdAt: '2026-10-01T00:00:00Z', archivedAt: null }] },
    'GET /tasks/wallet/ledger': { entries: [
      { id: 3, bucket: 'spend', amount: -5, reason: 'personal_reward', note: null, source: null, rewardTitle: REWARD[locale], createdAt: '2026-10-05T00:00:00Z' },
      { id: 2, bucket: 'save', amount: 30, reason: 'self_income', note: null, source: 'allowance', rewardTitle: null, createdAt: '2026-10-03T00:00:00Z' },
      { id: 1, bucket: 'spend', amount: 12, reason: 'self_income', note: null, source: 'earned', rewardTitle: null, createdAt: '2026-10-03T00:00:00Z' },
    ] },
    'GET /wallet/guardians': { guardians: [] },
  };
  return {
    token: 'preview',
    transport: async (path: string, options: { method?: string }) => {
      const data = routes[`${options.method ?? 'GET'} ${path}`];
      return data === undefined ? { data: null, error: { code: 'NOT_ROUTED', message: '' } } : { data, error: null };
    },
  } as Session;
}

export function TeenWalletPreview({ locale, theme }: { locale: Locale; theme: 'light' | 'dark' }) {
  const dark = theme === 'dark';
  const family = rebuildNamespaceCopy[locale].family;
  const shell = rebuildNamespaceCopy[locale].core.appShell;
  const item = (id: 'learn' | 'tasks' | 'wallet' | 'profile'): ShellNavItem => ({ id, label: shell.nav[id], href: `#${id}`, iconAssetId: NAV_MARKS[id] });
  return <RebuildRoot theme={theme} locale={locale}>
    <StaticThemeProvider isDark={dark}>
      <LearnerShell appName="LittleFounders" pageTitle={shell.nav.wallet} routeKey="teen-wallet" locale={locale} onNavigate={() => {}} current="wallet"
        items={[item('learn'), item('tasks'), item('wallet'), item('profile')]} labels={{ skip: shell.skip, navigation: shell.navigation }}
        mentor={{ href: '#mentor', name: MENTOR_NAMES.zara, character: 'zara' }}>
        <TeenWallet copy={TEXT[locale]} habits={moneyHabitsInRegister(locale, 'teen')} shared={{ home: family.childCoins.home, move: family.childCoins.move }} locale={locale} dark={dark}
          session={fixtureSession(locale)} tasksHref="/tasks" onOpenTasks={() => {}} inviteLinkFor={(token) => `https://app.test/join/${token}`} copyText={async () => true} />
      </LearnerShell>
    </StaticThemeProvider>
  </RebuildRoot>;
}
