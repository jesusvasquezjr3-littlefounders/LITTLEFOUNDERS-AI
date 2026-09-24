import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { trackInsight } from '@/lib/insights';
import { Card, Icon, LoadingOverlay, ProgressBar, Reveal } from '@/components/ui';
import CharacterActor3D from '@/components/characters/control/CharacterActor3D';
import { ErrorBanner } from '@/routes/auth/ErrorBanner';
import { AdventureBanner } from './AdventureBanner';
import { placementPath, territoryPath } from './paths';
import { SagaSection } from './SagaSection';
import { findAdventureForLesson, localizedText, type CourseTree } from './types';

/*
 * /learn/:courseSlug — the course path (/DESIGN.md §Screen Recipes → Learn).
 *
 * One column, one way forward. The page used to carry the learner's next
 * lesson in three places at once: a card in a desktop rail, a floating
 * button, and a labelled button on the row itself. Three affordances for one
 * action is not three times the guidance, it is a learner deciding which of
 * them is the real one. The floating pill is the only one left, and it is the
 * page's single accent CTA. The rail is gone with it: its progress lives in
 * the bar under the header, and its chapter list was the accordion it sat
 * next to. The server-derived tree remains the only source of progress.
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

  useEffect(() => {
    if (state.status !== 'ready' || scrolledRef.current || !openAdventureId || !state.tree.nextLessonId) return;
    scrolledRef.current = true;
    scrollToNext(state.tree.nextLessonId);
  }, [state, openAdventureId, scrollToNext]);

  useEffect(() => {
    if (!pendingScrollRef.current || state.status !== 'ready' || !state.tree.nextLessonId) return;
    pendingScrollRef.current = false;
    scrollToNext(state.tree.nextLessonId);
  }, [openAdventureId, state, scrollToNext]);

  useEffect(() => {
    if (state.status !== 'ready') return;
    // Course identity makes funnel and content-friction analysis actionable.
    // The beacon is consent-gated, so this remains a no-op for unconsented kids.
    trackInsight('course_open', { routeClass: 'learn', courseId: state.tree.course.id });
  }, [state]);

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
    return <LoadingOverlay label={t('learn.loading')} />;
  }

  if (state.status === 'error') {
    // B.2: an unmet prerequisite course is not a failure — it is guidance.
    // The mentor voice names the step ahead instead of an error banner.
    if (state.code === 'COURSE_PREREQUISITE_REQUIRED') {
      return (
        <Card hero className="flex flex-col items-center gap-4 text-center">
          <CharacterActor3D character="dina" emotion="happy" action="idle" size="lg" />
          <h2 className="lf-title text-content">{t('learn.prerequisite.title')}</h2>
          <p className="lf-body max-w-md text-content-muted">{t('learn.prerequisite.body')}</p>
          <Link to="/learn">
            <span className="lf-press lf-label font-bold text-primary hover:underline">{t('learn.prerequisite.back')}</span>
          </Link>
        </Card>
      );
    }
    return <ErrorBanner code={state.code} />;
  }

  const { tree } = state;

  // Client-side convenience only — the real gate is server-side (learn.ts's
  // PLACEMENT_REQUIRED 403 on every lesson-access endpoint). Replace, not
  // push, so the back button doesn't bounce the learner into a 403 loop.
  if (tree.course.placementRequired) {
    return <Navigate to={placementPath(courseSlug)} replace />;
  }

  if (tree.adventures.length === 0) {
    return (
      <Card hero className="flex flex-col items-center gap-4 text-center">
        <CharacterActor3D character="dina" emotion="happy" action="idle" size="lg" />
        <h2 className="lf-title text-content">{t('learn.emptyTitle')}</h2>
        <p className="lf-body max-w-md text-content-muted">{t('learn.emptyBody')}</p>
      </Card>
    );
  }

  const courseTitle = localizedText(tree.course.title, locale, tree.course.slug);
  const progressLabel = t('learn.lessonsProgress', {
    passed: tree.course.progress.passed,
    total: tree.course.progress.total,
  });

  return (
    <div className="flex flex-col gap-6">
      {/* One slim row, and one bar that IS the course progress. */}
      <div className="sticky top-0 z-30 -mx-5 bg-base/85 px-5 pt-1 backdrop-blur-md md:-mx-8 md:px-8">
        <header className="flex items-center gap-3 py-3">
          <Link
            to="/learn"
            aria-label={t('dashboard.nav.learn')}
            className="lf-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-content-muted transition-colors duration-150 hover:bg-surface-sunken hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Icon name="arrow_back" className="!text-[20px]" aria-hidden />
          </Link>

          <h1 className="lf-headline min-w-0 flex-1 truncate text-content">{courseTitle}</h1>

          <span className="lf-caption lf-number hidden shrink-0 font-bold text-content-muted sm:inline">
            {progressLabel}
          </span>

          <Link
            to={territoryPath(tree.course.slug)}
            aria-label={t('learn.territory.open')}
            title={t('learn.territory.open')}
            className="lf-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-content-muted transition-colors duration-150 hover:bg-surface-sunken hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Icon name="map" className="!text-[20px]" aria-hidden />
          </Link>
        </header>

        <ProgressBar value={tree.course.progress.pct} tone="accent" label={t('learn.territory.progress')} />
      </div>

      <main className="flex flex-col gap-6">
        {/*
         * Said once, at the top of the path, in full — the card's badge is the
         * headline and this is the sentence. Entrepreneurship and Investing go
         * live with every lesson written and judged, and with no narration and
         * no illustrations at all; a learner who meets that unwarned concludes
         * the product is broken rather than unfinished.
         */}
        {tree.course.inProgress && (
          <div className="flex items-start gap-3 rounded-md border border-outline/50 bg-surface-sunken px-4 py-3">
            {/* The study's small icon well, in the notice's own hue (§The study's component set). */}
            <span className="lf-tile mt-0.5 h-7 w-7 text-warning-strong">
              <Icon name="construction" className="!text-[16px]" aria-hidden />
            </span>
            <p className="lf-caption text-content-muted">{t('learn.courseInProgress.notice')}</p>
          </div>
        )}

        {tree.adventures.map((adventure, idx) => {
          const isOpen = adventure.id === openAdventureId;
          return (
            <Reveal key={adventure.id} delay={(idx % 3) * 60}>
              <div className="flex flex-col overflow-hidden rounded-md border border-outline/50 bg-surface">
                <AdventureBanner
                  adventure={adventure}
                  locale={locale}
                  expanded={isOpen}
                  onToggle={() => setOpenAdventureId(isOpen ? null : adventure.id)}
                />
                {isOpen && adventure.state !== 'locked' && (
                  <div className="flex flex-col gap-8 p-4 md:p-6">
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
            </Reveal>
          );
        })}
      </main>

      {/* The page's ONE accent CTA (/DESIGN.md §Colors → Action Color Contract). */}
      {tree.nextLessonId && createPortal(
        <button
          type="button"
          onClick={goToMyLesson}
          className="lf-press lf-label motion-safe-press fixed bottom-20 right-4 z-40 flex min-h-11 items-center gap-2 rounded-full bg-accent px-5 py-3 text-on-accent shadow-pop transition-colors duration-150 hover:bg-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:bottom-8 lg:right-8"
        >
          <Icon name="target" className="!text-[18px] text-current" aria-hidden />
          {t('learn.goToMyLesson')}
        </button>,
        document.body
      )}
    </div>
  );
}

export default CoursePage;
