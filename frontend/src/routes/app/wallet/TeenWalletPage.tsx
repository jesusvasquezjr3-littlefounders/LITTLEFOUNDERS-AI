import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/theme/useTheme';
import { api } from '@/lib/api';
import { TeenWallet } from '@/rebuild/wallet/TeenWallet';
import { MoneyBridgePanel, MyResearchPanel, ScopeStatementPanel } from '../family/GovernancePanels';
import { MyDataPracticesPanel } from '../family/DataPracticePanels';
import { invalidateWalletAccess } from './useWalletAccess';
import { moneyHabitsInRegister } from '../family/coinAccountCopy';
import { useConsoleEnvironment } from '../family/consoleSession';
import type { Session, Transport } from '@/rebuild/wallet/walletApi';
import en from '@/i18n/en-US/teenWallet.json';
import es from '@/i18n/es-MX/teenWallet.json';
import pt from '@/i18n/pt-BR/teenWallet.json';
import { joinPath } from '@/auth/pendingInvite';

/*
 * /wallet — S07.2 (D.3, OD-3 Option B): the self-registered teen's personal
 * wallet. This wrapper only binds the rebuilt surface (which imports nothing
 * legacy) to the shared Core client, the locale, the theme and the router.
 * Admission is by age at Core; the route gate in App.tsx is UI-only.
 */

export function TeenWalletPage() {
  const { i18n } = useTranslation();
  const { isDark } = useTheme();
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const locale = i18n.resolvedLanguage ?? 'en-US';
  const { family } = useConsoleEnvironment();
  const copy = locale === 'es-MX' ? es : locale === 'pt-BR' ? pt : en;

  // A fresh token per call (getToken refreshes an expiring session); the
  // session token field only signals that the caller is signed in.
  const session = useMemo<Session>(() => {
    const transport: Transport = async (path, options) => {
      const result = await api<unknown>(path, { method: options.method, body: options.body, token: await getToken() });
      // W2F.2: a failure while the browser reports no connection is NETWORK, so the screen can say "offline"; Core's message is never shown.
      return result.error && typeof navigator !== 'undefined' && navigator.onLine === false ? { data: null, error: { code: 'NETWORK', message: '' } } : result;
    };
    return { token: 'session', transport };
  }, [getToken]);

  // S07.6 (D.12): only a self-registered teen reaches /wallet (Core admission
  // by age), and the database gives every such teen the 'teen' register.
  // S07.7 (D.19, D.20, D.22): "Beyond the app" from 15, what the practice covers, and a research no.
  // W2F.2: the design system's page states (offline, refused, failed), and the page's companions beside the wallet.
  return <TeenWallet copy={copy} habits={moneyHabitsInRegister(locale, 'teen')} locale={locale} dark={isDark} session={session} tasksHref="/tasks"
    onOpenTasks={() => navigate('/tasks')} onAccessChanged={invalidateWalletAccess}
    inviteLinkFor={(token) => `${window.location.origin}${joinPath(token)}`}
    copyText={async (text) => {
      try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
    }}
    screen={{ copy: family.teenWalletScreen, learnHref: '/learn', onNavigate: (href) => navigate(href) }}
    aside={<>
      {/* S07.7 (D.19, D.20, D.22): "Beyond the app" from 15, what the practice covers, and the teen's own research answer. */}
      <MoneyBridgePanel session={session} />
      <ScopeStatementPanel />
      <MyResearchPanel session={session} />
      {/* S10.3 (OD-9 4.2): the teen's own answers to the practices the rebuild introduced. */}
      <MyDataPracticesPanel session={session} />
    </>} />;
}

export default TeenWalletPage;
