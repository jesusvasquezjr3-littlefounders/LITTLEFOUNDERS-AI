import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { APP_HOME } from '@/app-shell/home';
import { useShellLocale } from '@/app-shell/ShellRoot';
import { familyJoinPath, INVITE_TOKEN_RE, joinPath, rememberInvite } from '@/auth/pendingInvite';
import { JoinInviteScreen, type JoinInviteView } from '@/rebuild/identity/JoinInviteScreen';

/*
 * `/join/:token` (GAP-FIX-R5, A.1 and D.3 / OD-3 Option B): the invite link's
 * landing. Public (no role, no session needed), on the sign-in shell. It keeps
 * the token (auth/pendingInvite.ts) and sends each population the one step it
 * needs:
 *
 *   - a verified Tutor (the `parent` role) goes straight to the invite on the
 *     Family page (`/family?join=TOKEN`), where Core previews and accepts it
 *     inside the verified-parent boundary;
 *   - a visitor or a guest is offered sign-up and log-in, each carrying
 *     `from: /join/TOKEN` in router state;
 *   - any other signed-in account is told to verify first (a parent-created
 *     child is told the link is for an adult); /verify-parent's success
 *     returns to the invite.
 */
export function JoinInvitePage() {
  const { token = '' } = useParams();
  const locale = useShellLocale();
  const navigate = useNavigate();
  const { session, isGuest, roles, meLoaded, logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const valid = INVITE_TOKEN_RE.test(token);

  useEffect(() => { if (valid) rememberInvite(token); }, [token, valid]);

  const here = joinPath(token);
  const signedIn = !!session && !isGuest;
  if (valid && signedIn && meLoaded && roles.includes('parent')) return <Navigate to={familyJoinPath(token)} replace />;

  const view: JoinInviteView = !valid ? { kind: 'invalid' }
    : session === undefined || (session && !meLoaded) ? { kind: 'checking' }
    : !signedIn ? { kind: 'signed-out' }
    : roles.includes('kid') ? { kind: 'child' }
    : { kind: 'verify', signingOut };

  return <JoinInviteScreen locale={locale} view={view} signupHref="/signup?intent=tutor" loginHref="/login" verifyHref="/verify-parent" homeHref={signedIn ? APP_HOME : '/'}
    onNavigate={(href) => navigate(href, href === '/login' || href.startsWith('/signup') ? { state: { from: here } } : undefined)}
    onSignOut={() => {
      if (signingOut) return;
      setSigningOut(true);
      // Signing out forgets a pending invite (a shared device); this page keeps it for the next account.
      void logout().then(() => { rememberInvite(token); setSigningOut(false); });
    }} />;
}
