import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { BASE_URL } from '@/lib/api';
import { AccountDeletion, type AccountDeletionView } from '@/rebuild/account/AccountDeletion';
import { cancelAccountDeletion } from '@/rebuild/account/deletionClient';
import { StandaloneState } from '@/app-shell/StandaloneState';
import { useShellLocale } from '@/app-shell/ShellRoot';
import en from '@/i18n/en-US/rebuild-profile.json';
import es from '@/i18n/es-MX/rebuild-profile.json';
import pt from '@/i18n/pt-BR/rebuild-profile.json';

/*
 * Product 10 E.6's one public deletion screen, on the rebuild design system.
 *
 *  - Signed in with a scheduled deletion (RequireAuth sends every app route
 *    here): the date, "Keep account" (Core cancels and audits it) and
 *    "Sign out". Nothing else in the app opens until the holder decides.
 *  - Signed out right after confirming (Settings hands the outcome over in
 *    router state): the stated date and how to keep the account, or the
 *    confirmation that it is deleted.
 *  - Anything else (a direct visit): back to the app or to sign-in.
 *
 * It renders on the standalone single-state screen (app-shell/StandaloneState).
 *
 * Deliberately NOT named *Page.tsx: the AuthRecipe gate scans that suffix
 * for the login/signup trust-surface recipe, which this state screen is not.
 */

type Handoff = { deletion?: { kind: 'scheduled'; scheduledFor: string } | { kind: 'deleted'; finishing: boolean } };

function readHandoff(state: unknown): AccountDeletionView | null {
  const deletion = (state as Handoff | null)?.deletion;
  if (!deletion) return null;
  if (deletion.kind === 'deleted') return { kind: 'deleted', finishing: deletion.finishing === true };
  if (deletion.kind === 'scheduled' && typeof deletion.scheduledFor === 'string' && Number.isFinite(Date.parse(deletion.scheduledFor))) {
    return { kind: 'scheduled', status: 'pending', scheduledFor: deletion.scheduledFor, signedOut: true, keeping: false, keepFailed: false };
  }
  return null;
}

export function AccountDeletionStatus() {
  const locale = useShellLocale();
  const { session, accountDeletion, getToken, logout, refreshMe } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [keeping, setKeeping] = useState(false);
  const [keepFailed, setKeepFailed] = useState(false);
  const [kept, setKept] = useState(false);
  const copy = (locale === 'es-MX' ? es : locale === 'pt-BR' ? pt : en).accountDeletion;

  if (session === undefined) return null;
  const handoff = readHandoff(location.state);
  let view: AccountDeletionView | null = null;
  if (kept) view = { kind: 'kept' };
  // A hand-off from Settings wins: the session it belonged to is being
  // signed out (scheduled) or no longer exists (erased).
  else if (handoff) view = handoff;
  else if (session && accountDeletion) {
    view = { kind: 'scheduled', status: accountDeletion.status, scheduledFor: accountDeletion.scheduledFor, signedOut: false, keeping, keepFailed };
  }
  if (!view) return <Navigate to={session ? '/' : '/login'} replace />;

  const keep = async () => {
    if (keeping) return;
    setKeeping(true);
    setKeepFailed(false);
    const token = await getToken();
    const result = token ? await cancelAccountDeletion({ baseUrl: BASE_URL, token }) : { ok: false as const, code: 'UNAVAILABLE' };
    setKeeping(false);
    if (!result.ok) { setKeepFailed(true); return; }
    setKept(true);
    await refreshMe();
  };

  const heading = view.kind === 'scheduled' ? copy.scheduledTitle : view.kind === 'deleted' ? copy.deletedTitle : copy.title;
  return <StandaloneState pageTitle={heading}><AccountDeletion copy={copy} locale={locale} dark={false} view={view} layout="state"
    onKeep={() => void keep()}
    onSignOut={() => void logout().then(() => navigate('/login', { replace: true }))}
    onSignIn={() => navigate('/login', { replace: true })}
    onContinue={() => navigate('/', { replace: true })} /></StandaloneState>;
}
