import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/theme/useTheme';
import { playPlatformSound } from '@/lib/sound';
import { SessionPreferences } from '@/rebuild/shell/SessionPreferences';
import { useShellCopy, useShellLocale } from './ShellRoot';

/*
 * Settings' mode and sign-out controls (W2 Lane 0). They lived in the legacy
 * app shell's sidebar and top bar, which the rebuilt shells replaced; the
 * profile lane's Settings rebuild keeps this panel (or its equivalent).
 * Signing out plays the same sound and lands on the public home, as before.
 */
export function SessionPreferencesSetting() {
  const copy = useShellCopy().sessionPreferences;
  const locale = useShellLocale();
  const { choice, setChoice, isDark } = useTheme();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    playPlatformSound('auth_bye');
    await logout();
    navigate('/', { replace: true });
  };
  return <SessionPreferences copy={copy} locale={locale} dark={isDark} choice={choice} onChoice={setChoice}
    onSignOut={() => void signOut()} signingOut={signingOut} />;
}
