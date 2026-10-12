import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { nextPlace } from '@/features/app/nextPlace';
import { useSession } from '@/features/auth/session';

/*
 * Takes a person to their home when they sign in from the site's home page (D-051). It acts on the
 * moment the account becomes usable, and only from `/`: after signing in, or after an account that
 * still owed its age (somebody who left the window half way and came back) says it.
 *
 * Somebody who is already signed in and opens the site stays on it: the site is still theirs to
 * read, and its calls to action turn into the green "Keep learning" button that goes to their home
 * (features/app/KeepLearning.tsx). The onboarding ends in the application by itself (Onboarding.tsx).
 *
 * It renders nothing and lives above every page, beside the onboarding's hand-off.
 */
export function GoHomeAfterSignIn() {
  const session = useSession();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const owed = useRef(false);

  useEffect(() => {
    if (session.status === 'signedOut' || (session.status === 'signedIn' && session.account?.needsAge)) owed.current = true;

    if (session.status !== 'signedIn' || !owed.current || !session.account || session.account.needsAge) return;

    owed.current = false;

    // to the place they were going when they were asked to sign in, or to their home
    if (pathname === '/') void navigate(nextPlace.path());
  }, [session.status, session.account, pathname, navigate]);

  return null;
}
