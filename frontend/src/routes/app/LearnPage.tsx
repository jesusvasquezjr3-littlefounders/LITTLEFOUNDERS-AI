import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { Badge, Card, Icon, IconChip, LoadingOverlay, ProgressBar, Reveal } from '@/components/ui';
import CharacterActor from '@/components/characters/control/CharacterActor';
import { DinaCharacter } from '@/components/characters/DinaCharacter';
import { ErrorBanner } from '@/routes/auth/ErrorBanner';

/*
 * learn/ — the universal user's home. Course cards per /DESIGN.md §Screen
 * Recipes → Dashboard (md:grid-cols-2 lg:grid-cols-3 with ProgressBars).
 * Liquid glass hero header + staggered reveal grid of gamified course cards.
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

type LoadState = { status: 'loading' } | { status: 'error'; code: string } | { status: 'ready'; courses: Course[] };

export function LearnPage() {
  const { t, i18n } = useTranslation();
  const { profile, getToken } = useAuth();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

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

  return (
    <div className="flex flex-col gap-8">
      {/* Liquid Glass Hero Header */}
      <Reveal>
        <div className="relative overflow-hidden rounded-xl border border-outline/60 bg-gradient-to-br from-primary-soft/40 via-surface to-accent-soft/30 p-6 shadow-glass md:p-8">
          <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div className="flex flex-col gap-3 max-w-2xl">
              <h1 className="lf-display-lg text-content">
                {firstName ? t('dashboard.learn.greeting', { name: firstName }) : t('dashboard.learn.greetingAnon')}
              </h1>
              <p className="lf-body-lg text-content-muted">
                {t('dashboard.learn.subtitle')}
              </p>
            </div>

            <div className="flex shrink-0 items-center justify-center self-end md:self-center">
              <div className="h-28 w-28 md:h-36 md:w-36">
                <CharacterActor character="dina" emotion="happy" action="idle" size="md" />
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      {/* Main Catalog Content */}
      <section aria-busy={state.status === 'loading'} className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="lf-headline text-content">{t('dashboard.learn.title')}</h2>
          {state.status === 'ready' && state.courses.length > 0 && (
            <span className="lf-caption font-bold text-content-muted">
              {state.courses.length} {state.courses.length === 1 ? t('dashboard.learn.lessonCount_one', { count: 1 }) : t('dashboard.learn.lessonCount_other', { count: state.courses.length })}
            </span>
          )}
        </div>

        {state.status === 'loading' && (
          <LoadingOverlay label={t('learn.loading')} />
        )}

        {state.status === 'error' && <ErrorBanner code={state.code} />}

        {state.status === 'ready' && state.courses.length === 0 && (
          <Card hero className="flex flex-col items-center gap-4 text-center">
            <div className="h-40 w-40">
              <DinaCharacter />
            </div>
            <h2 className="lf-title text-content">{t('dashboard.learn.emptyTitle')}</h2>
            <p className="lf-body max-w-md text-content-muted">{t('dashboard.learn.emptyBody')}</p>
          </Card>
        )}

        {state.status === 'ready' && state.courses.length > 0 && (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {state.courses.map((course, index) => {
              const tone = COURSE_TONES[course.slug] ?? 'primary';
              const isStarted = course.progress.passed > 0;
              const isCompleted = course.progress.passed === course.progress.total && course.progress.total > 0;
              const ctaText = isStarted ? t('dashboard.learn.resumeCta') : t('dashboard.learn.exploreCta');

              return (
                <Reveal key={course.id} delay={(index % 3) * 80}>
                  <Link
                    to={`/learn/${course.slug}`}
                    className="group block h-full rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <Card interactive className="relative flex h-full flex-col overflow-hidden transition-all duration-300">
                      {/* Top Glow Accent Bar */}
                      <div className={`absolute inset-x-0 top-0 h-1 ${TONE_BAR_CLASSES[tone] ?? 'bg-primary'}`} />

                      <div className="flex items-start justify-between gap-3 pt-1">
                        <IconChip tone={tone} size="lg">
                          <Icon name={COURSE_ICONS[course.slug] ?? 'menu_book'} className="text-[26px]" />
                        </IconChip>
                        <div className="flex flex-col items-end gap-1">
                          <Badge>
                            {t('dashboard.learn.lessonCount', { count: course.lessonCount })}
                          </Badge>
                          {isCompleted && (
                            <span className="lf-caption flex items-center gap-1 font-bold text-success-strong">
                              <Icon name="check_circle" className="!text-[14px]" />
                              {t('learn.completed')}
                            </span>
                          )}
                        </div>
                      </div>

                      <h2 className="lf-title mt-4 text-content group-hover:text-primary transition-colors">
                        {course.title[locale] ?? course.title['en-US'] ?? course.slug}
                      </h2>

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
