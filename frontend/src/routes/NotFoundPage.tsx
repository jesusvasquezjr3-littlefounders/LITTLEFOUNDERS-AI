import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { Button, Icon } from '@/components/ui';

/*
 * The route of last resort.
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
 *   2. It must not require auth, a session, i18n-beyond-fallback or WebGL. It
 *      is the surface that has to work when something else did not, so it
 *      pulls no 3D stage and no data.
 *
 * Note on reach: `/:handle` (App.tsx, public profiles) already claims every
 * single-segment path, so this catches multi-segment unknown URLs — which is
 * exactly the shape a malformed in-app link takes.
 */
export function NotFoundPage() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // `session === undefined` means auth is still restoring; treat that as
  // signed-out rather than blocking the page behind another spinner.
  const home = session ? '/learn' : '/';

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-base px-5 py-12 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-sunken text-content-muted">
        <Icon name="explore_off" className="!text-[32px]" aria-hidden />
      </span>

      <div className="flex max-w-md flex-col gap-2">
        <h1 className="lf-display-lg text-content">{t('notFound.title')}</h1>
        <p className="lf-body-lg text-content-muted">{t('notFound.body')}</p>
      </div>

      {/* The path is shown, not hidden: it is the one detail that turns
          "it broke" into a reproducible report. */}
      <code className="lf-caption max-w-full truncate rounded-md bg-surface-sunken px-3 py-1.5 text-content-faint">
        {pathname}
      </code>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button variant="primary" onClick={() => navigate(home)}>
          {t(session ? 'notFound.backToLearn' : 'notFound.backHome')}
        </Button>
        <Button variant="secondary" onClick={() => navigate(-1)}>
          <Icon name="arrow_back" className="mr-1" aria-hidden />
          {t('notFound.goBack')}
        </Button>
      </div>
    </main>
  );
}
