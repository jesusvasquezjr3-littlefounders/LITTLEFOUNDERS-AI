import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { Card, Icon, LoadingOverlay, Reveal, SectionHeading } from '@/components/ui';
import { DinaCharacter } from '@/components/characters/DinaCharacter';
import { ErrorBanner } from '@/routes/auth/ErrorBanner';
import { CourseCarousel, type CarouselCourse } from '@/routes/app/learn/CourseCarousel';
import { ChapterLessons } from '@/routes/app/learn/ChapterLessons';
import { readCoursesCache, writeCoursesCache } from '@/routes/app/learn/coursesCache';
import { findCurrentChapter, type CourseTree, type CurrentChapter } from '@/routes/app/learn/types';

/*
 * learn/ — the learner's home (/DESIGN.md §Tactile → Screen recipes → Learn).
 *
 * Two objects, in the order a learner needs them: WHICH course, then WHICH
 * lesson. The carousel answers the first and the chapter list answers the
 * second, and the second is the one they came for — so the page loads the
 * course list, picks the course in progress, and immediately fetches that
 * course's tree so the very next lesson is on this screen rather than two
 * navigations away.
 *
 * What this replaced: a hero card for one course followed by a grid of the
 * same courses. Two lists of the same objects, where the grid existed only to
 * reach a course the hero was not showing — which is what a carousel does, in
 * the space the hero already had.
 */

export interface Course extends CarouselCourse {
  lessonCount: number;
}

const COURSE_CATEGORIES: Record<string, 'entrepreneurship' | 'finance' | 'saving'> = {
  'first-lemonade-stand': 'entrepreneurship',
  'first-business': 'entrepreneurship',
  'money-basics': 'finance',
  'saving-superpowers': 'saving',
  'financial-education': 'finance',
  entrepreneurship: 'entrepreneurship',
  investing: 'saving',
};

/*
 * Filtering three courses with four pills is four controls to remove one row.
 * The control earns its place once the carousel stops being scannable in a
 * couple of swipes, so it appears then and not before.
 */
const FILTER_THRESHOLD = 6;

type FilterCategory = 'all' | 'entrepreneurship' | 'finance' | 'saving';

const FILTERS: FilterCategory[] = ['all', 'entrepreneurship', 'finance', 'saving'];

const FILTER_LABEL_KEYS: Record<FilterCategory, string> = {
  all: 'dashboard.learn.filterAll',
  entrepreneurship: 'dashboard.learn.filterEntrepreneurship',
  finance: 'dashboard.learn.filterFinance',
  saving: 'dashboard.learn.filterSaving',
};

interface UnavailableFeaturedCourse {
  slug: string;
  title: Record<string, string>;
}

interface CourseShelf {
  courses: Course[];
  unavailableFeaturedCourse?: UnavailableFeaturedCourse;
}

type LoadState = { status: 'loading' } | { status: 'error'; code: string } | { status: 'ready'; shelf: CourseShelf };

export function LearnPage() {
  const { t, i18n } = useTranslation();
  const { profile, getToken, session } = useAuth();
  // The filter group is NAMED by its lockup rather than by a hidden label, so
  // the heading a sighted learner reads and the name the group announces are
  // the same string (/DESIGN.md §The study's component set).
  const filterHeadingId = useId();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');
  /*
   * The chapter is a SECOND, dependent fetch and it is allowed to be absent.
   * It hangs off whichever course turns out to be in progress, which is not
   * known until the first request lands — so the carousel renders as soon as
   * it can rather than waiting for both, and the list appears underneath when
   * it arrives. A single combined spinner would hold a screen the learner
   * could already be using.
   */
  const [chapter, setChapter] = useState<{ slug: string; current: CurrentChapter } | null>(null);

  /*
   * STALE-WHILE-REVALIDATE. The shelf a learner already saw paints
   * immediately and a fresh read always goes out behind it, so the
   * /learn -> lesson -> back -> /learn loop — which IS the product — stops
   * showing a spinner for data that has not changed. The cache is dropped
   * when a lesson completes (LessonRoute) precisely because that is the one
   * moment the progress here DID change and a stale number would read as a
   * bug; that path takes the honest spinner.
   */
  const userId = session?.user.id ?? null;

  useEffect(() => {
    let cancelled = false;
    const cached = readCoursesCache(userId);
    if (cached) setState({ status: 'ready', shelf: { courses: cached } });
    void (async () => {
      const token = await getToken();
      const { data, error } = await api<CourseShelf>('/learn/courses', { token });
      if (cancelled) return;
      if (error) {
        // A failed revalidation must not blank a shelf the learner is reading.
        if (!cached) setState({ status: 'error', code: error.code });
        return;
      }
      writeCoursesCache(userId, data.courses);
      setState({ status: 'ready', shelf: data });
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, userId]);

  const locale = i18n.resolvedLanguage ?? 'en-US';
  const firstName = (profile?.display_name ?? '').split(/\s+/)[0] ?? '';

  const courses = state.status === 'ready' ? state.shelf.courses : [];
  const unavailableFeaturedCourse = state.status === 'ready' ? state.shelf.unavailableFeaturedCourse ?? null : null;

  // The one course to resume: in progress first, then unstarted, then the first.
  const featuredCourse = courses.length > 0
    ? (courses.find((c) => c.progress.passed > 0 && c.progress.passed < c.progress.total)
      ?? courses.find((c) => c.progress.passed < c.progress.total)
      ?? courses[0])
    : null;
  const featuredSlug = featuredCourse?.slug ?? null;

  useEffect(() => {
    if (!featuredSlug) return undefined;
    let cancelled = false;
    void (async () => {
      /*
       * This whole fetch is OPTIONAL and it must FAIL QUIETLY — but quietly is
       * not the same as invisibly. The carousel above is the page; the chapter
       * list is the shortcut. A transient tree failure leaves the shortcut off
       * and the page still does its job. What it may never do is escape as an
       * unhandled rejection: this runs detached from React's render, so a throw
       * here has nowhere to land and takes the tab's error handler with it.
       */
      try {
        const token = await getToken();
        const res = await api<CourseTree>(`/learn/courses/${featuredSlug}/tree`, { token });
        if (cancelled || !res || res.error) return;
        const current = findCurrentChapter(res.data);
        setChapter(current ? { slug: featuredSlug, current } : null);
      } catch {
        if (!cancelled) setChapter(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [featuredSlug, getToken]);

  const showFilters = courses.length > FILTER_THRESHOLD;
  const filteredCourses = showFilters
    ? courses.filter((course) => activeFilter === 'all' || COURSE_CATEGORIES[course.slug] === activeFilter)
    : courses;

  // Carousel order: the course in progress leads, the rest keep their order.
  const orderedCourses = featuredCourse
    ? [featuredCourse, ...filteredCourses.filter((c) => c.id !== featuredCourse.id)].filter((c) =>
        filteredCourses.some((f) => f.id === c.id) || c.id === featuredCourse.id,
      )
    : filteredCourses;

  /*
   * "Continue lesson N" counts the lesson's place in its chapter, not its
   * storage ordinal. `lesson.position` is unique per topic but not contiguous,
   * and reading it raw put "Continue lesson 4" on the card above a chapter
   * list whose own badge said "2 of 3 lessons" — see the numbering note in
   * ChapterLessons.tsx. Both surfaces now count the same way.
   */
  const resumeLessonIndex =
    chapter?.current.topic.lessons.findIndex((l) => l.state === 'current') ?? -1;
  const resumeLessonNumber = resumeLessonIndex >= 0 ? resumeLessonIndex + 1 : null;

  return (
    <div className="mx-auto flex w-full max-w-board flex-col gap-8">
      {/* The study's soft indigo wash behind the hero (/DESIGN.md §Tactile). */}
      <div className="lf-ambient" aria-hidden="true" />
      {/*
       * The greeting is not the point of the page and is not sized like it.
       * The course a learner is in the middle of is.
       */}
      <h1 className="lf-headline -mb-2 text-content-muted">
        {firstName ? t('dashboard.learn.greeting', { name: firstName }) : t('dashboard.learn.greetingAnon')}
      </h1>

      {showFilters && (
        <div>
          {/*
           * The lockup keys the pills below it: the selected pill fills in
           * accent, so the tile is accent. A section whose cards select in one
           * hue and whose icon is another teaches the wrong thing about its
           * own colour (/DESIGN.md §The section heading is a lockup).
           */}
          <SectionHeading id={filterHeadingId} icon="filter_list" tone="accent">
            {t('dashboard.learn.filterLabel')}
          </SectionHeading>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-labelledby={filterHeadingId}>
            {FILTERS.map((cat) => {
              const isActive = activeFilter === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveFilter(cat)}
                  aria-pressed={isActive}
                  className={`lf-label lf-tactile inline-flex min-h-11 items-center rounded-full px-4 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base ${
                    isActive
                      ? 'lf-tactile-accent bg-accent font-bold text-on-accent'
                      : 'border border-outline/70 bg-surface font-medium text-content-muted hover:border-primary/50 hover:text-content'
                  }`}
                >
                  {t(FILTER_LABEL_KEYS[cat])}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {state.status === 'loading' && <LoadingOverlay label={t('learn.loading')} />}

      {state.status === 'error' && <ErrorBanner code={state.code} />}

      {unavailableFeaturedCourse && (
        <Card role="status" aria-live="polite" className="flex items-start gap-3 border border-warning/40 bg-warning-soft/50 p-4">
          <span className="lf-tile h-11 w-11 shrink-0 text-warning-strong" aria-hidden="true">
            <Icon name="cloud_off" className="!text-[22px]" />
          </span>
          <div className="min-w-0">
            <h2 className="lf-label font-bold text-content" data-copy-role="heading">{t('learn.courseUnavailable.title')}</h2>
            <p className="lf-caption mt-1 text-content-muted" data-copy-role="body">
              {t('learn.courseUnavailable.body', {
                title: unavailableFeaturedCourse.title[locale] ?? unavailableFeaturedCourse.title['en-US'] ?? unavailableFeaturedCourse.slug,
              })}
            </p>
          </div>
        </Card>
      )}

      {state.status === 'ready' && orderedCourses.length === 0 && (
        <Card hero className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="h-32 w-32">
            <DinaCharacter />
          </div>
          <h3 className="lf-title text-content">{t('dashboard.learn.emptyTitle')}</h3>
          <p className="lf-body max-w-md text-content-muted">{t('dashboard.learn.emptyBody')}</p>
        </Card>
      )}

      {state.status === 'ready' && orderedCourses.length > 0 && (
        <Reveal>
          <CourseCarousel
            courses={orderedCourses}
            locale={locale}
            activeSlug={featuredSlug}
            resumeLessonNumber={resumeLessonNumber}
          />
        </Reveal>
      )}

      {chapter && chapter.slug === featuredSlug && (
        <Reveal delay={80}>
          <ChapterLessons
            courseSlug={chapter.slug}
            topic={chapter.current.topic}
            chapterNumber={chapter.current.number}
            nextTopic={chapter.current.next}
            nextChapterNumber={chapter.current.nextNumber ?? undefined}
            locale={locale}
          />
        </Reveal>
      )}
    </div>
  );
}
