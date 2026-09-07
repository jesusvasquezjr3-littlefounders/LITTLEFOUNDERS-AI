import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { trackInsight } from '@/lib/insights';
import { Button, Icon, LoadingOverlay } from '@/components/ui';
import CharacterActor3D from '@/components/characters/control/CharacterActor3D';
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
  // Insights (/INSIGHTS.md): lesson_start on entry; lesson_abandon on exit
  // WITHOUT completing — the drop-off signal the server cannot see, since
  // /complete only fires on the results screen. trackInsight is a no-op for
  // unconsented kids, so this wiring carries no §1.9 decision of its own.
  const completedRef = useRef(false);
  useEffect(() => {
    completedRef.current = false;
    const enteredAt = Date.now();
    trackInsight('lesson_start', { lessonId, routeClass: 'learn' });
    return () => {
      if (!completedRef.current) {
        trackInsight('lesson_abandon', { lessonId, routeClass: 'learn', value: Math.round((Date.now() - enteredAt) / 1000) });
      }
    };
  }, [lessonId]);
  // One run id per lesson entry (0012): the server scopes the attempt cap to it,
  // so replaying a completed lesson starts every segment fresh instead of
  // hitting the lifetime cap (which the player mis-rendered as a 0/100 fail).
  const runId = useMemo(() => globalThis.crypto?.randomUUID?.() ?? `${lessonId}-${Date.now()}`, [lessonId]);
  const grader = useMemo(() => createCoreGrader(lessonId, getToken, runId), [lessonId, getToken, runId]);

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
    // Reaching the results phase means the lesson was NOT abandoned,
    // regardless of whether the persist below succeeds.
    completedRef.current = true;
    const token = await getToken();
    // A failed persist never blocks the kid's Results screen or exit path
    // (the Lesson Engine's "never punish the kid for our outage" rule, §7) —
    // the player falls back to its client-computed numbers on null.
    const { data, error } = await api<ServerCompletion>(`/learn/lessons/${lessonId}/complete`, {
      method: 'POST',
      token,
      body: {
        seconds_spent: Math.min(7200, Math.max(1, secondsSpent)),
        run_id: runId, // score THIS run, not a lifetime best (0012)
        // The kid's LOCAL calendar day anchors the streak (v1 parity).
        // Constructed mathematically to guarantee YYYY-MM-DD universally,
        // since toLocaleDateString('sv') falls back to M/D/YYYY on some browsers.
        local_date: (() => {
          const d = new Date();
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        })(),
      },
    });
    return error ? null : data;
  }

  if (state.status === 'loading') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-base">
        <LoadingOverlay label={t('learn.loading')} />
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-base px-5 text-center">
        <CharacterActor3D character="dina" emotion="neutral" action="idle" size="lg" />
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
      lessonId={lessonId}
      grader={grader}
      audio={state.audio}
      onExit={goBack}
      onComplete={(result) => persistCompletion(result.seconds_spent)}
    />
  );
}

export default LessonRoute;
