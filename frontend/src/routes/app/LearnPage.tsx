import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { Badge, Button, Card, Icon, IconChip, LoadingOverlay, ProgressBar, Reveal } from '@/components/ui';
import CharacterActor from '@/components/characters/control/CharacterActor';
import { DinaCharacter } from '@/components/characters/DinaCharacter';
import { ErrorBanner } from '@/routes/auth/ErrorBanner';

/*
 * learn/ — the universal user's home (Brilliant.org-inspired course catalog).
 * Features a prominent "Featured / Jump Back In" hero banner, interactive
 * learning track filter pills, and a 3-column liquid glass course card grid.
 */

interface Course {
  id: string;
  slug: string;
  title: Record<string, string>;
  lessonCount: number;
  progress: { passed: number; total: number; pct: number };
}

const COURSE_ICONS: Record<string, string> = {
  'money-basics': 'payments',
  'saving-superpowers': 'savings',
  'first-business': 'storefront',
  'first-lemonade-stand': 'local_drink',
};

const COURSE_TONES: Record<string, 'primary' | 'secondary' | 'accent' | 'warning' | 'success' | 'delight'> = {
  'money-basics': 'warning',
  'saving-superpowers': 'success',
  'first-business': 'accent',
  'first-lemonade-stand': 'delight',
};

const COURSE_CATEGORIES: Record<string, 'entrepreneurship' | 'finance' | 'saving'> = {
  'first-lemonade-stand': 'entrepreneurship',
  'first-business': 'entrepreneurship',
  'money-basics': 'finance',
  'saving-superpowers': 'saving',
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
    ? (state.courses.find((c) => c.progress.passed > 0 && c.progress.passed < c.progress.total) ?? state.courses[0])
    : null;

  const filteredCourses = state.status === 'ready'
    ? state.courses.filter((course) => {
        if (activeFilter === 'all') return true;
        return COURSE_CATEGORIES[course.slug] === activeFilter;
      })
    : [];

  return (
    <div className="flex flex-col gap-10">
      {/* Top Welcome Header */}
      <header className="flex flex-col gap-2">
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
                    {featuredCourse.progress.passed > 0 ? t('dashboard.learn.continueLearning') : t('dashboard.learn.featuredBadge')}
                  </span>
                  <Badge>
                    {t('dashboard.learn.lessonCount', { count: featuredCourse.lessonCount })}
                  </Badge>
                </div>

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
                      {featuredCourse.progress.passed > 0 ? t('dashboard.learn.resumeCta') : t('dashboard.learn.startCourse')}
                      <Icon name="arrow_forward" className="transition-transform duration-200 motion-safe:group-hover:translate-x-0.5" />
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Right Mascot/Visual Column */}
              <div className="flex shrink-0 items-center justify-center md:col-span-4 lg:col-span-3">
                <div className="flex h-32 w-32 items-center justify-center rounded-2xl border border-outline/50 bg-primary-soft/30 shadow-glass-sm md:h-44 md:w-44">
                  <CharacterActor character="dina" emotion="happy" action="idle" size="lg" />
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      )}

      {/* Course Catalog & Category Filter Section */}
      <section aria-busy={state.status === 'loading'} className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h2 className="lf-headline text-content">{t('dashboard.learn.browseTracks')}</h2>

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

        {/* Brilliant-Style 3-Column Course Cards Grid */}
        {state.status === 'ready' && filteredCourses.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredCourses.map((course, index) => {
              const tone = COURSE_TONES[course.slug] ?? 'primary';
              const categoryKey = COURSE_CATEGORIES[course.slug] ?? 'entrepreneurship';
              const isStarted = course.progress.passed > 0;
              const isCompleted = course.progress.passed === course.progress.total && course.progress.total > 0;
              const ctaText = isStarted ? t('dashboard.learn.resumeCta') : t('dashboard.learn.exploreCta');

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
                    <Card interactive className="relative flex h-full flex-col overflow-hidden transition-all duration-300">
                      {/* Top Glow Accent Bar */}
                      <div className={`absolute inset-x-0 top-0 h-1.5 ${TONE_BAR_CLASSES[tone] ?? 'bg-primary'}`} />

                      <div className="flex items-start justify-between gap-3 pt-2">
                        <IconChip tone={tone} size="lg">
                          <Icon name={COURSE_ICONS[course.slug] ?? 'menu_book'} className="text-[26px]" />
                        </IconChip>
                        <div className="flex flex-col items-end gap-1.5">
                          <Badge>
                            {t('dashboard.learn.lessonCount', { count: course.lessonCount })}
                          </Badge>
                          <span className="lf-caption font-semibold text-content-faint">
                            {categoryLabel}
                          </span>
                        </div>
                      </div>

                      <h3 className="lf-title mt-4 text-content group-hover:text-primary transition-colors">
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
                          <span className="lf-label flex items-center gap-1 text-primary group-hover:translate-x-0.5 transition-transform duration-200">
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
