import { useState } from 'react';
import { api } from '@/lib/api';
import { playPlatformSound } from '@/lib/sound';
import { useShellLocale, useShellNavigate } from '@/app-shell/ShellRoot';
import { ForgotPasswordScreen, type ForgotView } from '@/rebuild/identity/RecoveryScreens';

/*
 * `/forgot-password` (A3): asks Core to send the recovery email. Core answers
 * the same for every address (GoTrue never reveals whether one has an
 * account), so the confirmation is the same too. What the legacy page did not
 * do: when Core refuses the request (too many tries, an invalid address, no
 * connection), the screen says so instead of claiming a link was sent.
 */
export function ForgotPasswordPage() {
  const locale = useShellLocale();
  const onNavigate = useShellNavigate();
  const [view, setView] = useState<ForgotView>({ kind: 'form', pending: false, errorCode: null });

  async function submit(email: string) {
    setView({ kind: 'form', pending: true, errorCode: null });
    const { error } = await api('/auth/recover', { method: 'POST', body: { email } });
    if (error) {
      playPlatformSound('auth_error');
      setView({ kind: 'form', pending: false, errorCode: error.code });
      return;
    }
    playPlatformSound('auth_success');
    setView({ kind: 'sent', email });
  }

  return <ForgotPasswordScreen locale={locale} view={view} onSubmit={(email) => void submit(email)} onNavigate={onNavigate} />;
}
