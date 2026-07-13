import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { Button, Icon } from '@/components/ui';
import CharacterActor from '@/components/characters/control/CharacterActor';
import { ErrorBanner } from '@/routes/auth/ErrorBanner';
import LessonPlayer from '@/lesson-engine/player/LessonPlayer';
import type { LessonDocument } from '@/lesson-engine/core/types';
import { createCoreGrader } from './coreGrader';

/*
 * /learn/lesson/:lessonId — the fullscreen Lesson Player wired to Core
 * (COURSE_ENGINE.md §2, LESSON_ENGINE.md §7). Registered OUTSIDE the
 * AppLayout route group in App.tsx so no dashboard chrome ever renders
 * behind it — LessonPlayer already owns a `fixed inset-0` layer.
 *
 * Deviation from the literal task brief (documented per /AGENTS.md §1.12):
 * completion persistence (`onComplete`) and navigation (`onExit`) are kept
 * separate rather than both living in `onComplete`. LessonPlayer fires
 * `onComplete` the instant it reaches the results phase — navigating away
 * there would rip the Results screen (score ring, XP stat cards, cast
 * celebration — DESIGN.md Screen Recipes → Lesson) out from under the kid
 * before they ever see it. So `onComplete` only POSTs the score; navigation
 * happens from `onExit`, which fires when the kid taps "Finish" on the
 * Results screen (or exits early) — matching the Lesson screen recipe.
 */

interface LessonResponse {
  lesson: { id: string; slug: string };
  locale: string;
  document: LessonDocument;
}

type LoadState = { status: 'loading' } | { status: 'error'; code: string } | { status: 'ready'; document: LessonDocument };

interface LocationState {
  courseSlug?: string;
}

export function LessonRoute() {
  const { t } = useTranslation();
  const { lessonId = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const mountedAtRef = useRef(Date.now());

  const courseSlug = (location.state as LocationState | null)?.courseSlug ?? null;
  const grader = useMemo(() => createCoreGrader(lessonId, getToken), [lessonId, getToken]);

  useEffect(() => {
    let cancelled = false;
    mountedAtRef.current = Date.now();
    setState({ status: 'loading' });
    void (async () => {
      const token = await getToken();
      const { data, error } = await api<LessonResponse>(`/learn/lessons/${lessonId}`, { token });
      if (cancelled) return;
      setState(error ? { status: 'error', code: error.code } : { status: 'ready', document: data.document });
    })();
    return () => {
      cancelled = true;
    };
  }, [lessonId, getToken]);

  function goBack() {
    navigate(courseSlug ? `/learn/${courseSlug}` : '/learn');
  }

  async function persistCompletion() {
    const minutesSpent = Math.min(120, Math.max(0, Math.round((Date.now() - mountedAtRef.current) / 60000)));
    const token = await getToken();
    // Fire-and-forget from the UI's perspective: api() never throws, and a
    // failed persist shouldn't block the kid's Results screen or exit path
    // (the Lesson Engine's "never punish the kid for our outage" rule, §7).
    await api(`/learn/lessons/${lessonId}/complete`, { method: 'POST', token, body: { minutes_spent: minutesSpent } });
  }

  if (state.status === 'loading') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-base">
        <div aria-hidden="true" className="h-16 w-16 animate-pulse rounded-full bg-surface-sunken" />
        <span className="sr-only">{t('learn.loading')}</span>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-base px-5 text-center">
        <CharacterActor character="dina" emotion="neutral" action="idle" size="lg" />
        <div className="w-full max-w-md">
          <ErrorBanner code={state.code} />
        </div>
        <Button variant="secondary" onClick={goBack}>
          <Icon name="arrow_back" className="mr-1" />
          {t('learn.backToCourse')}
        </Button>
      </div>
    );
  }

  return (
    <LessonPlayer
      document={state.document}
      grader={grader}
      onExit={goBack}
      onComplete={() => {
        void persistCompletion();
      }}
    />
  );
}

export default LessonRoute;
