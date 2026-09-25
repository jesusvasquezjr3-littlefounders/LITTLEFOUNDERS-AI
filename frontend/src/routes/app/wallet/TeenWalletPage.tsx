import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/theme/useTheme';
import { api } from '@/lib/api';
import { TeenWallet } from '@/rebuild/wallet/TeenWallet';
import { invalidateWalletAccess } from './useWalletAccess';
import { moneyHabitsInRegister } from '../family/coinAccountCopy';
import type { Session, Transport } from '@/rebuild/wallet/walletApi';
import en from '@/i18n/en-US/teenWallet.json';
import es from '@/i18n/es-MX/teenWallet.json';
import pt from '@/i18n/pt-BR/teenWallet.json';

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
  const copy = locale === 'es-MX' ? es : locale === 'pt-BR' ? pt : en;

  // A fresh token per call (getToken refreshes an expiring session); the
  // session token field only signals that the caller is signed in.
  const session = useMemo<Session>(() => {
    const transport: Transport = async (path, options) => api<unknown>(path, { method: options.method, body: options.body, token: await getToken() });
    return { token: 'session', transport };
  }, [getToken]);

  // S07.6 (D.12): only a self-registered teen reaches /wallet (Core admission
  // by age), and the database gives every such teen the 'teen' register.
  return <TeenWallet copy={copy} habits={moneyHabitsInRegister(locale, 'teen')} locale={locale} dark={isDark} session={session} tasksHref="/tasks" onOpenTasks={() => navigate('/tasks')}
    onAccessChanged={invalidateWalletAccess}
    inviteLinkFor={(token) => `${window.location.origin}/family?join=${encodeURIComponent(token)}`}
    copyText={async (text) => {
      try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
    }} />;
}

export default TeenWalletPage;
