import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { Badge, Button, Card, Icon, IconChip, LoadingOverlay, ProgressBar, Reveal } from '@/components/ui';
import CharacterActor from '@/components/characters/control/CharacterActor';
import { DinaCharacter } from '@/components/characters/DinaCharacter';
import { ErrorBanner } from '@/routes/auth/ErrorBanner';
import { courseBadgeAsset } from '@/lib/courseBadges';

/*
 * learn/ — the learner's home. The composition follows Brilliant's strongest
 * learning pattern: make the next useful action obvious, then keep discovery
 * calm and secondary. Course progress remains server-derived.
 */

interface Course {
  id: string;
  slug: string;
  title: Record<string, string>;
  lessonCount: number;
  badgeAsset?: string | null;
  progress: { passed: number; total: number; pct: number };
}

const COURSE_ICONS: Record<string, string> = {
  'money-basics': 'payments',
  'saving-superpowers': 'savings',
  'first-business': 'storefront',
  'first-lemonade-stand': 'local_drink',
  'financial-education': 'account_balance',
  entrepreneurship: 'rocket_launch',
  investing: 'trending_up',
};

const COURSE_TONES: Record<string, 'primary' | 'secondary' | 'accent' | 'warning' | 'success' | 'delight'> = {
  'money-basics': 'warning',
  'saving-superpowers': 'success',
  'first-business': 'accent',
  'first-lemonade-stand': 'delight',
  'financial-education': 'warning',
  entrepreneurship: 'accent',
  investing: 'success',
};

const COURSE_CATEGORIES: Record<string, 'entrepreneurship' | 'finance' | 'saving'> = {
  'first-lemonade-stand': 'entrepreneurship',
  'first-business': 'entrepreneurship',
  'money-basics': 'finance',
  'saving-superpowers': 'saving',
  'financial-education': 'finance',
  entrepreneurship: 'entrepreneurship',
  investing: 'saving',
};

const TONE_BAR_CLASSES: Record<string, string> = {
  warning: 'bg-warning',
  success: 'bg-success',
  accent: 'bg-accent',
  delight: 'bg-delight',
  primary: 'bg-primary',
};

const TONE_TEXT_CLASSES: Record<string, string> = {
  warning: 'text-warning-strong',
  success: 'text-success-strong',
  accent: 'text-accent-strong',
  delight: 'text-delight',
  primary: 'text-primary',
};

type FilterCategory = 'all' | 'entrepreneurship' | 'finance' | 'saving';

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

  // Determine the featured course (first in-progress course or first available course)
  const featuredCourse = state.status === 'ready' && state.courses.length > 0
    ? (state.courses.find((c) => c.progress.passed > 0 && c.progress.passed < c.progress.total)
      ?? state.courses.find((c) => c.progress.passed < c.progress.total)
      ?? state.courses[0])
    : null;
  const featuredIsCompleted = Boolean(featuredCourse && featuredCourse.progress.total > 0 && featuredCourse.progress.passed === featuredCourse.progress.total);
  const featuredBadgeAsset = featuredCourse ? courseBadgeAsset(featuredCourse.badgeAsset, featuredCourse.slug) : null;

  const learningSnapshot = state.status === 'ready'
    ? state.courses.reduce(
        (summary, course) => ({
          coursesStarted: summary.coursesStarted + (course.progress.passed > 0 ? 1 : 0),
          lessonsPassed: summary.lessonsPassed + course.progress.passed,
          lessonsTotal: summary.lessonsTotal + course.progress.total,
        }),
        { coursesStarted: 0, lessonsPassed: 0, lessonsTotal: 0 },
      )
    : { coursesStarted: 0, lessonsPassed: 0, lessonsTotal: 0 };

  const filteredCourses = state.status === 'ready'
    ? state.courses.filter((course) => {
        if (activeFilter === 'all') return true;
        return COURSE_CATEGORIES[course.slug] === activeFilter;
      })
    : [];

  return (
    <div className="flex flex-col gap-8">
      {/* Top Welcome Header */}
      <header className="flex flex-col gap-2">
        <span className="lf-caption font-bold uppercase tracking-[0.12em] text-primary">{t('dashboard.learn.eyebrow')}</span>
        <h1 className="lf-display-lg text-content">
          {firstName ? t('dashboard.learn.greeting', { name: firstName }) : t('dashboard.learn.greetingAnon')}
        </h1>
        <p className="lf-body-lg text-content-muted">
          {t('dashboard.learn.subtitle')}
        </p>
      </header>

      {/* Brilliant-Style Featured Course Hero Banner */}
      {featuredCourse && (
        <Reveal>
          <div className="relative overflow-hidden rounded-xl border border-outline/60 bg-gradient-to-br from-surface via-surface/95 to-primary-soft/40 p-6 shadow-glass md:p-8">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-12 md:items-center">
              {/* Left Content Column */}
              <div className="flex flex-col gap-4 md:col-span-8 lg:col-span-9">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="lf-caption flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 font-bold text-accent-strong">
                    <Icon name="bolt" className="!text-[14px]" />
                    {featuredIsCompleted
                      ? t('dashboard.learn.completedCourse')
                      : featuredCourse.progress.passed > 0
                      ? t('dashboard.learn.continueLearning')
                      : t('dashboard.learn.featuredBadge')}
                  </span>
                  <Badge>
                    {t('dashboard.learn.lessonCount', { count: featuredCourse.lessonCount })}
                  </Badge>
                </div>

                <p className="lf-label text-content-muted">{t('dashboard.learn.nextStep')}</p>
                <h2 className="lf-display-lg text-content">
                  {featuredCourse.title[locale] ?? featuredCourse.title['en-US'] ?? featuredCourse.slug}
                </h2>

                <div className="mt-1 flex max-w-md flex-col gap-2">
                  <ProgressBar
                    value={featuredCourse.progress.pct}
                    tone="accent"
                    label={t('dashboard.learn.progressLabel', { passed: featuredCourse.progress.passed, total: featuredCourse.progress.total })}
                  />
                  <span className="lf-caption lf-number font-bold text-content-muted">
                    {t('dashboard.learn.progressLabel', { passed: featuredCourse.progress.passed, total: featuredCourse.progress.total })} ({featuredCourse.progress.pct}%)
                  </span>
                </div>

                <div className="mt-3">
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
              </div>

              {/* Course badge and mascot composition */}
              <div className="flex shrink-0 items-center justify-center md:col-span-4 lg:col-span-3">
                <div className="relative flex h-40 w-40 items-center justify-center md:h-48 md:w-48">
                  <div className="absolute inset-2 rounded-full bg-delight-soft/70 shadow-glass-sm ring-1 ring-outline/50" />
                  {featuredBadgeAsset ? (
                    <img
                      src={featuredBadgeAsset}
                      alt=""
                      aria-hidden="true"
                      className="relative z-10 h-32 w-32 object-contain drop-shadow-md md:h-40 md:w-40"
                      draggable="false"
                    />
                  ) : (
                    <Icon name="workspace_premium" className="relative z-10 text-[64px] text-delight" aria-hidden />
                  )}
                  <div className="absolute -bottom-2 -right-3 z-20 h-20 w-20 rounded-full bg-surface/90 shadow-glass ring-2 ring-base md:h-24 md:w-24">
                    <CharacterActor character="dina" emotion="happy" action="idle" size="fill" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      )}

      {state.status === 'ready' && state.courses.length > 0 && (
        <section aria-label={t('dashboard.learn.snapshotTitle')} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-outline/60 bg-surface p-4 shadow-glass-sm">
            <p className="lf-caption font-bold uppercase tracking-[0.08em] text-content-faint">{t('dashboard.learn.snapshotProgress')}</p>
            <p className="lf-headline lf-number mt-1 text-content">{learningSnapshot.lessonsPassed}/{learningSnapshot.lessonsTotal}</p>
            <p className="lf-caption mt-1 text-content-muted">{t('dashboard.learn.snapshotLessons')}</p>
          </div>
          <div className="rounded-lg border border-outline/60 bg-surface p-4 shadow-glass-sm">
            <p className="lf-caption font-bold uppercase tracking-[0.08em] text-content-faint">{t('dashboard.learn.snapshotStarted')}</p>
            <p className="lf-headline lf-number mt-1 text-content">{learningSnapshot.coursesStarted}</p>
            <p className="lf-caption mt-1 text-content-muted">{t('dashboard.learn.snapshotCourses')}</p>
          </div>
          <div className="rounded-lg border border-outline/60 bg-surface p-4 shadow-glass-sm">
            <p className="lf-caption font-bold uppercase tracking-[0.08em] text-content-faint">{t('dashboard.learn.snapshotFocus')}</p>
            <p className="lf-headline mt-1 text-content">{featuredCourse ? (featuredCourse.progress.passed === featuredCourse.progress.total ? t('dashboard.learn.snapshotComplete') : t('dashboard.learn.snapshotContinue')) : t('dashboard.learn.snapshotReady')}</p>
            <p className="lf-caption mt-1 text-content-muted">{t('dashboard.learn.snapshotFocusHint')}</p>
          </div>
        </section>
      )}

      {/* Course Catalog & Category Filter Section */}
      <section aria-busy={state.status === 'loading'} className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="lf-headline text-content">{t('dashboard.learn.browseTracks')}</h2>
            <p className="lf-body mt-1 text-content-muted">{t('dashboard.learn.browseTracksHint')}</p>
          </div>

          {/* Brilliant-Style Track Filter Pills */}
          <div
            className="flex flex-wrap items-center gap-2"
            role="group"
            aria-label={t('dashboard.learn.filterLabel')}
          >
            {(['all', 'entrepreneurship', 'finance', 'saving'] as FilterCategory[]).map((cat) => {
              const isActive = activeFilter === cat;
              const labelKey = cat === 'all'
                ? 'dashboard.learn.filterAll'
                : cat === 'entrepreneurship'
                ? 'dashboard.learn.filterEntrepreneurship'
                : cat === 'finance'
                ? 'dashboard.learn.filterFinance'
                : 'dashboard.learn.filterSaving';

              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveFilter(cat)}
                  aria-pressed={isActive}
                  className={`lf-label inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 py-2 transition-[background-color,border-color,color,box-shadow,transform] duration-200 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base ${
                    isActive
                      ? 'bg-accent text-on-accent shadow-glass-sm font-bold hover:bg-accent-strong'
                      : 'border border-outline/70 bg-surface text-content-muted hover:border-primary/50 hover:text-content font-medium'
                  }`}
                >
                  {isActive && <Icon name="check" className="!text-[16px]" aria-hidden />}
                  {t(labelKey)}
                </button>
              );
            })}
          </div>
        </div>

        {state.status === 'loading' && (
          <LoadingOverlay label={t('learn.loading')} />
        )}

        {state.status === 'error' && <ErrorBanner code={state.code} />}

        {state.status === 'ready' && filteredCourses.length === 0 && (
          <Card hero className="flex flex-col items-center gap-4 text-center py-12">
            <div className="h-32 w-32">
              <DinaCharacter />
            </div>
            <h2 className="lf-title text-content">{t('dashboard.learn.emptyTitle')}</h2>
            <p className="lf-body max-w-md text-content-muted">{t('dashboard.learn.emptyBody')}</p>
          </Card>
        )}

        {/* A deliberate card grid keeps discovery scannable without hiding the learner's next action. */}
        {state.status === 'ready' && filteredCourses.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredCourses.map((course, index) => {
              const tone = COURSE_TONES[course.slug] ?? 'primary';
              const categoryKey = COURSE_CATEGORIES[course.slug] ?? 'entrepreneurship';
              const isStarted = course.progress.passed > 0;
              const isCompleted = course.progress.passed === course.progress.total && course.progress.total > 0;
              const ctaText = isCompleted
                ? t('dashboard.learn.reviewCourse')
                : isStarted
                ? t('dashboard.learn.resumeCta')
                : t('dashboard.learn.exploreCta');

              const categoryLabel = categoryKey === 'entrepreneurship'
                ? t('dashboard.learn.filterEntrepreneurship')
                : categoryKey === 'finance'
                ? t('dashboard.learn.filterFinance')
                : t('dashboard.learn.filterSaving');

              return (
                <Reveal key={course.id} delay={(index % 3) * 80}>
                  <Link
                    to={`/learn/${course.slug}`}
                    className="group block h-full rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <Card interactive className="relative flex h-full flex-col overflow-hidden">
                      {/* Top Glow Accent Bar */}
                      <div className={`absolute inset-x-0 top-0 h-1.5 ${TONE_BAR_CLASSES[tone] ?? 'bg-primary'}`} />

                      <div className="flex items-start justify-between gap-3 pt-2">
                        {courseBadgeAsset(course.badgeAsset, course.slug) ? (
                          <IconChip tone={tone} size="lg" className="overflow-hidden p-1.5">
                            <img
                              src={courseBadgeAsset(course.badgeAsset, course.slug) ?? undefined}
                              alt=""
                              aria-hidden="true"
                              className="h-full w-full object-contain"
                              draggable="false"
                              loading="lazy"
                            />
                          </IconChip>
                        ) : (
                          <IconChip tone={tone} size="lg">
                            <Icon name={COURSE_ICONS[course.slug] ?? 'menu_book'} className="text-[26px]" />
                          </IconChip>
                        )}
                        <div className="flex flex-col items-end gap-1.5">
                          <Badge>
                            {t('dashboard.learn.lessonCount', { count: course.lessonCount })}
                          </Badge>
                          <span className="lf-caption font-semibold text-content-faint">
                            {categoryLabel}
                          </span>
                        </div>
                      </div>

                      <h3 className="lf-title mt-4 text-content transition-colors duration-150 group-hover:text-primary">
                        {course.title[locale] ?? course.title['en-US'] ?? course.slug}
                      </h3>

                      <div className="mt-auto pt-6 flex flex-col gap-3">
                        <ProgressBar
                          value={course.progress.pct}
                          tone="accent"
                          label={t('dashboard.learn.progressLabel', { passed: course.progress.passed, total: course.progress.total })}
                        />

                        <div className="flex items-center justify-between gap-2 pt-1 text-content-muted">
                          <span className="lf-caption lf-number flex items-center gap-1.5 font-bold">
                            <Icon name={isCompleted ? 'emoji_events' : 'rocket_launch'} className={`!text-[16px] ${TONE_TEXT_CLASSES[tone] ?? 'text-primary'}`} />
                            {t('dashboard.learn.progressLabel', { passed: course.progress.passed, total: course.progress.total })}
                          </span>
                          <span className="lf-label flex items-center gap-1 text-primary transition-transform duration-200 group-hover:translate-x-0.5">
                            {ctaText}
                            <Icon name="arrow_forward" className="!text-[16px]" />
                          </span>
                        </div>
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
