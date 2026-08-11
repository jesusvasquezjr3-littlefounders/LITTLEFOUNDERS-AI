import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { CourseBadgeArtwork } from '@/components/course/CourseBadgeArtwork';
import { trackInsight } from '@/lib/insights';
import { Badge, Card, Icon, LoadingOverlay, ProgressBar, Reveal } from '@/components/ui';
import CharacterActor from '@/components/characters/control/CharacterActor';
import { ErrorBanner } from '@/routes/auth/ErrorBanner';
import { AdventureBanner } from './AdventureBanner';
import { SagaSection } from './SagaSection';
import { findAdventureForLesson, findLesson, localizedText, type CourseTree } from './types';

/*
 * /learn/:courseSlug — guided course path. The learner sees the course promise,
 * one clear next action, and an expandable syllabus that can be explored at
 * their own pace. The server-derived tree remains the only source of progress.
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
    return <ErrorBanner code={state.code} />;
  }

  const { tree } = state;

  // Client-side convenience only — the real gate is server-side (learn.ts's
  // PLACEMENT_REQUIRED 403 on every lesson-access endpoint). Replace, not
  // push, so the back button doesn't bounce the learner into a 403 loop.
  if (tree.course.placementRequired) {
    return <Navigate to={`/learn/${courseSlug}/placement`} replace />;
  }

  if (tree.adventures.length === 0) {
    return (
      <Card hero className="flex flex-col items-center gap-4 text-center">
        <CharacterActor character="dina" emotion="happy" action="idle" size="lg" />
        <h2 className="lf-title text-content">{t('learn.emptyTitle')}</h2>
        <p className="lf-body max-w-md text-content-muted">{t('learn.emptyBody')}</p>
      </Card>
    );
  }

  const courseTitle = localizedText(tree.course.title, locale, tree.course.slug);
  const nextLesson = findLesson(tree, tree.nextLessonId);
  return (
    <div className="flex flex-col gap-6">
      {/* Sticky Fixed Top Course Hero Header */}
      <div className="sticky top-0 z-30 bg-base/90 pb-2 pt-1 backdrop-blur-md">
        <Reveal>
          <header className="rounded-xl border border-outline/60 bg-gradient-to-r from-surface via-surface/95 to-primary-soft/30 p-5 shadow-glass md:p-6">
            <div className="mb-2">
              <Link
                to="/learn"
                className="lf-caption inline-flex items-center gap-1.5 font-bold text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <Icon name="arrow_back" className="!text-[16px]" aria-hidden />
                {t('dashboard.nav.learn')}
              </Link>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-primary-soft text-primary font-bold">
                    {t('learn.chapters', { num: tree.adventures.length })}: {tree.adventures.length}
                  </Badge>
                  <Badge className="bg-accent-soft text-accent-strong font-bold">
                    {t('learn.totalLessons', { count: tree.course.progress.total })}
                  </Badge>
                </div>
                <h1 className="lf-display-lg text-content">{courseTitle}</h1>
                {localizedText(tree.course.description, locale) && (
                  <p className="lf-body max-w-2xl text-content-muted">{localizedText(tree.course.description, locale)}</p>
                )}
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <Link
                  to={`/learn/${tree.course.slug}/territory`}
                  className="lf-label flex min-h-11 items-center gap-2 rounded-full border border-primary/30 bg-primary-soft/60 px-5 font-bold text-primary shadow-glass-sm transition-[background-color,border-color,color] duration-150 hover:border-primary hover:bg-primary hover:text-on-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <Icon name="map" className="text-[18px]" aria-hidden />
                  {t('learn.territory.open')}
                </Link>
              </div>
            </div>
          </header>
        </Reveal>
      </div>

      {/* Main Layout: readable syllabus plus a compact, sticky orientation rail on desktop. */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <main className="order-2 flex min-w-0 flex-col gap-6 lg:order-1">
          {tree.adventures.map((adventure, idx) => {
            const isOpen = adventure.id === openAdventureId;
            return (
              <Reveal key={adventure.id} delay={(idx % 3) * 60}>
                <div className="flex flex-col overflow-hidden rounded-xl border border-outline/60 bg-surface shadow-glass">
                  <AdventureBanner
                    adventure={adventure}
                    locale={locale}
                    expanded={isOpen}
                    onToggle={() => setOpenAdventureId(isOpen ? null : adventure.id)}
                  />
                  {isOpen && adventure.state !== 'locked' && (
                    <div className="flex flex-col gap-6 border-t border-outline/50 p-4 md:p-6">
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

        <aside className="order-1 flex flex-col lg:sticky lg:top-24 lg:order-2">
          <Card className="flex flex-col gap-5 border-outline/60 p-5 shadow-glass">
            <div className="flex items-center gap-4">
              <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-visible rounded-2xl border border-outline/50 bg-primary-soft/40">
                <CourseBadgeArtwork asset={tree.course.badgeAsset} slug={tree.course.slug} size="orientation" />
                <div className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full border border-surface bg-surface/95 shadow-glass-sm">
                  <CharacterActor character="dina" emotion="happy" action="idle" size="fill" />
                </div>
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <h3 className="lf-title text-content truncate">{courseTitle}</h3>
                <span className="lf-caption font-bold text-content-muted">{t('learn.syllabus')}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-3 border-t border-outline/50">
              <div className="flex items-center justify-between lf-caption font-bold text-content-muted">
                <span>{t('learn.territory.progress')}</span>
                <span className="lf-number">{tree.course.progress.pct}%</span>
              </div>
              <ProgressBar
                value={tree.course.progress.pct}
                tone="accent"
                label={t('learn.lessonsProgress', { passed: tree.course.progress.passed, total: tree.course.progress.total })}
              />
              <span className="lf-caption lf-number text-content-faint text-right font-medium">
                {t('learn.lessonsProgress', { passed: tree.course.progress.passed, total: tree.course.progress.total })}
              </span>
            </div>

            {nextLesson && (
              <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary-soft/50 p-4">
                <div className="flex items-center gap-2 text-primary">
                  <Icon name="play_circle" className="!text-[18px]" aria-hidden />
                  <span className="lf-caption font-bold uppercase tracking-[0.08em]">{t('learn.nextLesson')}</span>
                </div>
                <p className="lf-title break-words text-content">{localizedText(nextLesson.title, locale, nextLesson.slug)}</p>
                <p className="lf-caption text-content-muted">
                  {t('learn.lessonMeta', { minutes: nextLesson.estimated_minutes, xp: nextLesson.xp_total })}
                </p>
                <Link
                  to={`/learn/lesson/${nextLesson.id}`}
                  state={{ courseSlug }}
                  className="lf-label inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-accent px-4 py-2 text-on-accent shadow-glass-sm transition-colors duration-150 hover:bg-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {nextLesson.state === 'passed' ? t('learn.reviewLesson') : t('learn.continueLesson')}
                  <Icon name="arrow_forward" className="!text-[16px]" aria-hidden />
                </Link>
              </div>
            )}

            <div className="flex flex-col gap-2 border-t border-outline/50 pt-4">
              <h4 className="lf-label text-content-muted">{t('learn.chapters')}</h4>
              <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto pr-1">
                {tree.adventures.map((adventure, idx) => {
                  const isCurrentOpen = adventure.id === openAdventureId;
                  const isAdvCompleted = adventure.state === 'completed';
                  const isAdvLocked = adventure.state === 'locked';

                  return (
                    <button
                      key={adventure.id}
                      type="button"
                      disabled={isAdvLocked}
                      onClick={() => setOpenAdventureId(adventure.id)}
                      aria-label={t('learn.chapter', { num: idx + 1 })}
                      className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-left text-xs transition-colors ${
                        isCurrentOpen
                          ? 'bg-primary-soft text-primary font-bold shadow-glass-sm'
                          : isAdvLocked
                          ? 'text-content-faint opacity-60 cursor-not-allowed'
                          : 'text-content hover:bg-surface-sunken font-medium'
                      }`}
                    >
                      <span className="truncate max-w-[180px]">
                        {idx + 1}. {localizedText(adventure.title, locale, adventure.slug)}
                      </span>
                      {isAdvCompleted ? (
                        <Icon name="check_circle" className="!text-[14px] text-success-strong" />
                      ) : (
                        <span className="lf-number text-[11px]">
                          {adventure.progress.passed}/{adventure.progress.total}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>
        </aside>
      </div>

      {/* Floating Action Portal for Active Lesson */}
      {tree.nextLessonId && createPortal(
        <button
          type="button"
          onClick={goToMyLesson}
          className="lf-glass lf-pulse-attention motion-safe-press fixed bottom-20 right-4 z-40 flex min-h-11 items-center gap-2 rounded-full px-5 py-3 shadow-pop lf-label text-content lg:bottom-8 lg:right-8"
        >
          <Icon name="target" className="text-current" />
          {t('learn.goToMyLesson')}
        </button>,
        document.body
      )}
    </div>
  );
}

export default CoursePage;
