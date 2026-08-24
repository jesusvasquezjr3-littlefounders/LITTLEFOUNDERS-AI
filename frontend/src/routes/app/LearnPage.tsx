import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { Button, Card, Icon, LoadingOverlay, ProgressBar, Reveal } from '@/components/ui';
import { CourseBadgeArtwork } from '@/components/course/CourseBadgeArtwork';
import CharacterActor from '@/components/characters/control/CharacterActor';
import { DinaCharacter } from '@/components/characters/DinaCharacter';
import { ErrorBanner } from '@/routes/auth/ErrorBanner';
import { courseBadgeAsset } from '@/lib/courseBadges';

/*
 * learn/ — the learner's home (/DESIGN.md §Screen Recipes → Learn).
 * One greeting, one resume card, one grid. Every element that only restated
 * something already on screen is gone: the card art says which course, the
 * bar says how far, the number says how far exactly. A learner arriving here
 * has one question, and the answer should be the largest thing on the page.
 */

interface Course {
  id: string;
  slug: string;
  title: Record<string, string>;
  lessonCount: number;
  badgeAsset?: string | null;
  /** 0048 — live, but still missing narration/illustrations. */
  inProgress?: boolean;
  progress: { passed: number; total: number; pct: number };
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
 * The control earns its place once the grid stops fitting on one screen, so
 * it appears then and not before.
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

type LoadState = { status: 'loading' } | { status: 'error'; code: string } | { status: 'ready'; courses: Course[] };

export function LearnPage() {
  const { t, i18n } = useTranslation();
  const { profile, getToken } = useAuth();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = await getToken();
      const { data, error } = await api<{ courses: Course[] }>('/learn/courses', { token });
      if (cancelled) return;
      setState(error ? { status: 'error', code: error.code } : { status: 'ready', courses: data.courses });
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  const locale = i18n.resolvedLanguage ?? 'en-US';
  const firstName = (profile?.display_name ?? '').split(/\s+/)[0] ?? '';

  const courses = state.status === 'ready' ? state.courses : [];

  // The one course to resume: in progress first, then unstarted, then the first.
  const featuredCourse = courses.length > 0
    ? (courses.find((c) => c.progress.passed > 0 && c.progress.passed < c.progress.total)
      ?? courses.find((c) => c.progress.passed < c.progress.total)
      ?? courses[0])
    : null;
  const featuredIsCompleted = Boolean(featuredCourse && featuredCourse.progress.total > 0 && featuredCourse.progress.passed === featuredCourse.progress.total);
  const featuredBadgeAsset = featuredCourse ? courseBadgeAsset(featuredCourse.badgeAsset, featuredCourse.slug) : null;

  const showFilters = courses.length > FILTER_THRESHOLD;
  const filteredCourses = showFilters
    ? courses.filter((course) => activeFilter === 'all' || COURSE_CATEGORIES[course.slug] === activeFilter)
    : courses;

  return (
    <div className="flex flex-col gap-8">
      {/*
        * The greeting is not the point of the page and is not sized like it.
        * The course a learner is in the middle of is, so that is the display
        * type here and the salutation is the line above it.
        */}
      <h1 className="lf-headline -mb-4 text-content-muted">
        {firstName ? t('dashboard.learn.greeting', { name: firstName }) : t('dashboard.learn.greetingAnon')}
      </h1>

      {featuredCourse && (
        <Reveal>
          <Card hero className="flex flex-col-reverse items-center gap-6 sm:flex-row sm:items-center sm:justify-between sm:gap-10">
            <div className="flex w-full min-w-0 flex-col items-center gap-5 text-center sm:items-start sm:text-left">
              <h2 className="lf-display-lg text-content">
                {featuredCourse.title[locale] ?? featuredCourse.title['en-US'] ?? featuredCourse.slug}
              </h2>

              <div className="flex w-full max-w-sm items-center gap-3">
                <ProgressBar
                  value={featuredCourse.progress.pct}
                  tone="accent"
                  label={t('dashboard.learn.progressLabel', { passed: featuredCourse.progress.passed, total: featuredCourse.progress.total })}
                  className="flex-1"
                />
                <span className="lf-caption lf-number shrink-0 font-bold text-content-muted">
                  {featuredCourse.progress.passed}/{featuredCourse.progress.total}
                </span>
              </div>

              <Link to={`/learn/${featuredCourse.slug}`}>
                <Button className="group">
                  {featuredIsCompleted
                    ? t('dashboard.learn.reviewCourse')
                    : featuredCourse.progress.passed > 0
                    ? t('dashboard.learn.resumeCta')
                    : t('dashboard.learn.startCourse')}
                  <Icon name="arrow_forward" className="transition-transform duration-200 motion-safe:group-hover:translate-x-0.5" />
                </Button>
              </Link>
            </div>

            <div className="relative flex h-36 w-36 shrink-0 items-center justify-center sm:h-44 sm:w-44">
              <div className="absolute inset-2 rounded-full bg-delight-soft/70 shadow-glass-sm ring-1 ring-outline/50" />
              <CourseBadgeArtwork asset={featuredBadgeAsset} slug={featuredCourse.slug} size="featured" />
              <div className="absolute -bottom-2 -right-3 z-20 h-20 w-20 rounded-full bg-surface/90 shadow-glass ring-2 ring-base">
                <CharacterActor character="dina" emotion="happy" action="idle" size="fill" />
              </div>
            </div>
          </Card>
        </Reveal>
      )}

      <section aria-busy={state.status === 'loading'} className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h2 className="lf-headline text-content">{t('dashboard.learn.browseTracks')}</h2>

          {showFilters && (
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('dashboard.learn.filterLabel')}>
              {FILTERS.map((cat) => {
                const isActive = activeFilter === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveFilter(cat)}
                    aria-pressed={isActive}
                    className={`lf-label inline-flex min-h-11 items-center rounded-full px-4 py-2 transition-[background-color,border-color,color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base ${
                      isActive
                        ? 'bg-accent font-bold text-on-accent'
                        : 'border border-outline/70 bg-surface font-medium text-content-muted hover:border-primary/50 hover:text-content'
                    }`}
                  >
                    {t(FILTER_LABEL_KEYS[cat])}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {state.status === 'loading' && <LoadingOverlay label={t('learn.loading')} />}

        {state.status === 'error' && <ErrorBanner code={state.code} />}

        {state.status === 'ready' && filteredCourses.length === 0 && (
          <Card hero className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="h-32 w-32">
              <DinaCharacter />
            </div>
            <h3 className="lf-title text-content">{t('dashboard.learn.emptyTitle')}</h3>
            <p className="lf-body max-w-md text-content-muted">{t('dashboard.learn.emptyBody')}</p>
          </Card>
        )}

        {/* Card grid (/DESIGN.md §Layout → Grid Systems): 1 / 2 / 3. */}
        {state.status === 'ready' && filteredCourses.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredCourses.map((course, index) => {
              const isCompleted = course.progress.total > 0 && course.progress.passed === course.progress.total;
              return (
                <Reveal key={course.id} delay={(index % 3) * 80}>
                  <Link
                    to={`/learn/${course.slug}`}
                    className="group block h-full rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <Card interactive className="flex h-full flex-col gap-5">
                      <div className="flex items-start justify-between gap-3">
                        <CourseBadgeArtwork asset={course.badgeAsset} slug={course.slug} size="compact" />
                        {isCompleted && (
                          <Icon name="emoji_events" fill className="!text-[20px] text-success-strong" aria-hidden />
                        )}
                      </div>

                      <h3 className="lf-title text-content transition-colors duration-150 group-hover:text-primary">
                        {course.title[locale] ?? course.title['en-US'] ?? course.slug}
                      </h3>

                      {/*
                       * A course can be live and still be missing its narration
                       * and art (0048). Saying so on the card is the difference
                       * between "they are still building this" and "this product
                       * is broken", and a learner who is not told picks the
                       * second reading.
                       */}
                      {course.inProgress && (
                        <span className="lf-caption inline-flex w-fit items-center gap-1.5 rounded-full bg-surface-sunken px-2.5 py-1 text-content-muted">
                          <Icon name="construction" className="!text-[16px]" aria-hidden />
                          {t('learn.courseInProgress.badge')}
                        </span>
                      )}

                      <div className="mt-auto flex items-center gap-3">
                        <ProgressBar
                          value={course.progress.pct}
                          tone="accent"
                          label={t('dashboard.learn.progressLabel', { passed: course.progress.passed, total: course.progress.total })}
                          className="flex-1"
                        />
                        <span className="lf-caption lf-number shrink-0 font-bold text-content-muted">
                          {course.progress.passed}/{course.progress.total}
                        </span>
                      </div>
                    </Card>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
