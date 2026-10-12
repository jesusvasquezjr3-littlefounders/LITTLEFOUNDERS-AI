import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { sileo } from 'sileo';
import { nextPlace } from '@/features/app/nextPlace';
import { GOOGLE_CHANNEL, parseGoogleResult, useSession } from '@/features/auth/session';
import { useCoreCopy } from '@/i18n/useCopy';

/*
 * Where Core sends the browser when a Google sign-in ends (`/auth/callback`). The address carries
 * two words and nothing secret: `mode` (was this a small window or the tab itself) and `result`.
 * The session, if there is one, is already in the cookies Core set on the way here.
 *
 *   popup     tell the page that is waiting, over a channel only this site's pages can use, and close.
 *   redirect  ask Core for the session and go to the home page.
 *
 * It sits outside the site shell: in a small window there is no room for a header and a footer.
 */
export function AuthCallback() {
  const copy = useCoreCopy();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const session = useSession();
  const handled = useRef(false);
  const [leftOpen, setLeftOpen] = useState(false);
  const isPopup = params.get('mode') === 'popup';
  const result = parseGoogleResult(params.get('result'));

  useEffect(() => { document.title = `${copy.auth.callbackTitle} · ${copy.appShell.brand}`; }, [copy]);

  useEffect(() => {
    if (handled.current) return;

    handled.current = true;

    if (isPopup) {
      const channel = new BroadcastChannel(GOOGLE_CHANNEL);

      channel.postMessage({ result });
      channel.close();
      window.close();
      // Some browsers do not let a page close a window the person navigated in: say what to do.
      window.setTimeout(() => setLeftOpen(true), 600);

      return;
    }

    void (async () => {
      if (result === 'ok') await session.reload();
      else if (result === 'failed') sileo.error({ title: copy.auth.errors.googleFailed });
      else if (result === 'unavailable') sileo.error({ title: copy.auth.errors.googleUnavailable });

      // Signed in: into the application, to the place the person was going or to their home. Its guard asks
      // what a new account still owes (the age, then a name and a mentor). Anything else: back to the site.
      void navigate(result === 'ok' ? nextPlace.path() : '/', { replace: true });
    })();
  }, [isPopup, result, session, navigate, copy]);

  return <main className="grid min-h-dvh place-items-center bg-[var(--background)] p-6 text-center text-[var(--foreground)]">
    <p role="status" className="m-0 text-xl font-bold text-balance">{leftOpen ? copy.auth.callbackClose : copy.auth.callbackWorking}</p>
  </main>;
}
