import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { Button, Icon } from '@/components/ui';
import CharacterActor from '@/components/characters/control/CharacterActor';
import { ErrorBanner } from '@/routes/auth/ErrorBanner';
import LessonPlayer from '@/lesson-engine/player/LessonPlayer';
import type { LessonDocument } from '@/lesson-engine/core/types';
import type { AudioManifest } from '@/lesson-engine/player/narration';
import type { ServerCompletion } from '@/lesson-engine/player/completion';
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
  audio: AudioManifest;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; code: string }
  | { status: 'ready'; document: LessonDocument; audio: AudioManifest };

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

  const courseSlug = (location.state as LocationState | null)?.courseSlug ?? null;
  const grader = useMemo(() => createCoreGrader(lessonId, getToken), [lessonId, getToken]);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    void (async () => {
      const token = await getToken();
      const { data, error } = await api<LessonResponse>(`/learn/lessons/${lessonId}`, { token });
      if (cancelled) return;
      setState(error ? { status: 'error', code: error.code } : { status: 'ready', document: data.document, audio: data.audio ?? {} });
    })();
    return () => {
      cancelled = true;
    };
  }, [lessonId, getToken]);

  function goBack() {
    navigate(courseSlug ? `/learn/${courseSlug}` : '/learn');
  }

  async function persistCompletion(secondsSpent: number): Promise<ServerCompletion | null> {
    const token = await getToken();
    // A failed persist never blocks the kid's Results screen or exit path
    // (the Lesson Engine's "never punish the kid for our outage" rule, §7) —
    // the player falls back to its client-computed numbers on null.
    const { data, error } = await api<ServerCompletion>(`/learn/lessons/${lessonId}/complete`, {
      method: 'POST',
      token,
      body: {
        seconds_spent: Math.min(7200, Math.max(1, secondsSpent)),
        // The kid's LOCAL calendar day anchors the streak (v1 parity) — 'sv'
        // formats as YYYY-MM-DD in the device's own timezone.
        local_date: new Date().toLocaleDateString('sv'),
      },
    });
    return error ? null : data;
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
      audio={state.audio}
      onExit={goBack}
      onComplete={(result) => persistCompletion(result.seconds_spent)}
    />
  );
}

export default LessonRoute;
