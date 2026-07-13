import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { Card, Icon, ProgressBar } from '@/components/ui';
import CharacterActor from '@/components/characters/control/CharacterActor';
import { ErrorBanner } from '@/routes/auth/ErrorBanner';
import { AdventureBanner } from './AdventureBanner';
import { SagaSection } from './SagaSection';
import { findAdventureForLesson, localizedText, type CourseTree } from './types';

/*
 * /learn/:courseSlug — the gamified "mapa de Aventuras" (COURSE_ENGINE.md §2:
 * courses → adventures → sagas → topics → lessons, all server-computed
 * unlock state). Rendered inside AppLayout (App.tsx). Adventures stack
 * vertically as banners; tapping an unlocked one expands its sagas inline
 * (accordion, one open at a time, auto-opened around nextLessonId).
 */

type LoadState = { status: 'loading' } | { status: 'error'; code: string } | { status: 'ready'; tree: CourseTree };

export function CoursePage() {
  const { t, i18n } = useTranslation();
  const { courseSlug = '' } = useParams();
  const { getToken } = useAuth();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [openAdventureId, setOpenAdventureId] = useState<string | null>(null);
  const scrolledRef = useRef(false);
  const pendingScrollRef = useRef(false);
  const nodeRefs = useRef(new Map<string, HTMLElement>());

  const locale = i18n.resolvedLanguage ?? 'en-US';

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    setOpenAdventureId(null);
    scrolledRef.current = false;
    nodeRefs.current.clear();
    void (async () => {
      const token = await getToken();
      const { data, error } = await api<CourseTree>(`/learn/courses/${courseSlug}/tree`, { token });
      if (cancelled) return;
      setState(error ? { status: 'error', code: error.code } : { status: 'ready', tree: data });
    })();
    return () => {
      cancelled = true;
    };
  }, [courseSlug, getToken]);

  // Auto-open the accordion around the next lesson (or the first unlocked
  // adventure) once the tree is ready.
  useEffect(() => {
    if (state.status !== 'ready' || openAdventureId) return;
    const around = state.tree.nextLessonId ? findAdventureForLesson(state.tree, state.tree.nextLessonId) : null;
    const fallback = state.tree.adventures.find((a) => a.state !== 'locked')?.id ?? state.tree.adventures[0]?.id ?? null;
    setOpenAdventureId(around ?? fallback);
  }, [state, openAdventureId]);

  const scrollToNext = useCallback((lessonId: string) => {
    const el = nodeRefs.current.get(lessonId);
    if (!el) return;
    const reduceMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
  }, []);

  // Auto-scroll to the current node once, after the auto-opened accordion has painted.
  useEffect(() => {
    if (state.status !== 'ready' || scrolledRef.current || !openAdventureId || !state.tree.nextLessonId) return;
    scrolledRef.current = true;
    scrollToNext(state.tree.nextLessonId);
  }, [state, openAdventureId, scrollToNext]);

  // The floating "Ir a mi lección" pill may need to open a different
  // adventure first — this effect fires the deferred scroll once that
  // adventure's content has rendered.
  useEffect(() => {
    if (!pendingScrollRef.current || state.status !== 'ready' || !state.tree.nextLessonId) return;
    pendingScrollRef.current = false;
    scrollToNext(state.tree.nextLessonId);
  }, [openAdventureId, state, scrollToNext]);

  const registerNodeRef = useCallback((lessonId: string, el: HTMLElement | null) => {
    if (el) nodeRefs.current.set(lessonId, el);
    else nodeRefs.current.delete(lessonId);
  }, []);

  function goToMyLesson() {
    if (state.status !== 'ready' || !state.tree.nextLessonId) return;
    const advId = findAdventureForLesson(state.tree, state.tree.nextLessonId);
    if (advId && advId !== openAdventureId) {
      pendingScrollRef.current = true;
      setOpenAdventureId(advId);
    } else {
      scrollToNext(state.tree.nextLessonId);
    }
  }

  if (state.status === 'loading') {
    return (
      <div aria-busy="true">
        <div className="mb-6 h-8 w-1/2 animate-pulse rounded-full bg-surface-sunken" />
        <div className="flex flex-col gap-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[120px] w-full animate-pulse rounded-lg bg-surface-sunken md:h-[280px]" />
          ))}
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return <ErrorBanner code={state.code} />;
  }

  const { tree } = state;

  if (tree.adventures.length === 0) {
    return (
      <Card hero className="flex flex-col items-center gap-4 text-center">
        <CharacterActor character="dina" emotion="happy" action="idle" size="lg" />
        <h2 className="lf-title text-content">{t('learn.emptyTitle')}</h2>
        <p className="lf-body max-w-md text-content-muted">{t('learn.emptyBody')}</p>
      </Card>
    );
  }

  return (
    <div>
      <header>
        <h1 className="lf-display-lg text-content">{localizedText(tree.course.title, locale, tree.course.slug)}</h1>
        <div className="mt-3 flex items-center gap-3">
          <ProgressBar
            value={tree.course.progress.pct}
            label={t('learn.lessonsProgress', { passed: tree.course.progress.passed, total: tree.course.progress.total })}
            className="max-w-xs"
          />
          <span className="lf-caption lf-number shrink-0 font-bold text-content-muted">
            {t('learn.lessonsProgress', { passed: tree.course.progress.passed, total: tree.course.progress.total })}
          </span>
        </div>
      </header>

      <div className="mt-6 flex flex-col gap-5">
        {tree.adventures.map((adventure) => {
          const isOpen = adventure.id === openAdventureId;
          return (
            <div key={adventure.id}>
              <AdventureBanner
                adventure={adventure}
                locale={locale}
                expanded={isOpen}
                onToggle={() => setOpenAdventureId(isOpen ? null : adventure.id)}
              />
              {isOpen && adventure.state !== 'locked' && (
                <div className="mt-5 rounded-lg border border-outline/70 bg-surface p-4 shadow-glass md:p-6">
                  {adventure.sagas.map((saga) => (
                    <SagaSection
                      key={saga.id}
                      saga={saga}
                      locale={locale}
                      courseSlug={courseSlug}
                      nextLessonId={tree.nextLessonId}
                      registerNodeRef={registerNodeRef}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {tree.nextLessonId && (
        <button
          type="button"
          onClick={goToMyLesson}
          className="lf-glass motion-safe-press fixed bottom-20 right-4 z-40 flex min-h-11 items-center gap-2 rounded-full px-5 py-3 shadow-pop lf-label text-content lg:bottom-8 lg:right-8"
        >
          <Icon name="near_me" className="text-primary" />
          {t('learn.goToMyLesson')}
        </button>
      )}
    </div>
  );
}

export default CoursePage;
