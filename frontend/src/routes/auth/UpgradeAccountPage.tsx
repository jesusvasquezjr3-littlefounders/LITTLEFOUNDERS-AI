import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { APP_HOME } from '@/app-shell/home';
import { useShellLocale, useShellNavigate } from '@/app-shell/ShellRoot';
import { UpgradeAccountScreen } from '@/rebuild/identity/RecoveryScreens';
import { failureCode } from './failureCode';

/*
 * `/upgrade-account` (A6): attaches an email and password to the CURRENT guest
 * session in place, never /signup (which would create a second, empty
 * account). The account id stays the same, so the streak and progress carry
 * over with no migration, and so does a refused child's under-13 origin marker
 * (A.2): Core keeps it through the upgrade, and the age screen never asks
 * that account for a date again. A non-guest has nothing to save and goes to
 * Learn. Now on the sign-in shell (the legacy page was its own layer).
 */
export function UpgradeAccountPage() {
  const locale = useShellLocale();
  const onNavigate = useShellNavigate();
  const { isGuest, upgradeAccount } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  if (!isGuest) return <Navigate to={APP_HOME} replace />;

  async function submit(email: string, password: string) {
    setPending(true);
    setErrorCode(null);
    const { error } = await upgradeAccount({ email, password });
    setPending(false);
    if (error) { setErrorCode(failureCode(error)); return; }
    navigate(APP_HOME, { replace: true });
  }

  return <UpgradeAccountScreen locale={locale} pending={pending} errorCode={errorCode} onSubmit={(email, password) => void submit(email, password)}
    onLater={() => navigate(APP_HOME)} onNavigate={onNavigate} />;
}
