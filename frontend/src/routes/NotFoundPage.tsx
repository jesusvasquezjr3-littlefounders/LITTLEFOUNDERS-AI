import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { Button, Copy } from '@/rebuild/design/controls';
import { APP_HOME } from '@/app-shell/navigation';
import { StandaloneState } from '@/app-shell/StandaloneState';
import { useShellCopy } from '@/app-shell/ShellRoot';

/*
 * The route of last resort, on the rebuilt single-state screen (W2 Lane 0).
 *
 * Until this existed, <Routes> had no `path="*"` and an unmatched URL rendered
 * NOTHING: React Router matched no branch, #root stayed empty, and the user got
 * a white screen with no error, no chrome and no way back except the browser's
 * back button. That is not a hypothetical — a wrong `to=` in the /learn chapter
 * list (ChapterLessons.tsx) shipped on 2026-09-04 and every lesson opened from
 * the learn home landed here, silently, for a week.
 *
 * So this page exists to make the NEXT such mistake loud instead of invisible.
 * Two rules follow from that:
 *   1. It must never redirect. A redirect would hide the broken link again —
 *      the URL stays in the address bar so a bug report can name it.
 *   2. It must not require auth, a session or WebGL. It is the surface that
 *      has to work when something else did not, so it pulls no 3D stage and
 *      no data.
 *
 * Note on reach: `/:handle` (public profiles) already claims every
 * single-segment path, so this catches multi-segment unknown URLs — which is
 * exactly the shape a malformed in-app link takes.
 */
export function NotFoundPage() {
  const copy = useShellCopy().notFound;
  const { session } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // `session === undefined` means auth is still restoring; treat that as
  // signed-out rather than blocking the page behind another spinner.
  const home = session ? APP_HOME : '/';
  return <StandaloneState pageTitle={copy.title} actions={<>
    <Button variant="accent" onClick={() => navigate(home)}>{session ? copy.backToLearn : copy.backHome}</Button>
    <Button onClick={() => navigate(-1)}>{copy.goBack}</Button>
  </>}>
    <Copy role="heading" as="h1">{copy.title}</Copy>
    <Copy role="body">{copy.body}</Copy>
    {/* The path is shown, not hidden: it is the one detail that turns "it broke" into a reproducible report. */}
    <p data-copy-role="data" className="ugc" data-not-found-path>{pathname}</p>
  </StandaloneState>;
}
