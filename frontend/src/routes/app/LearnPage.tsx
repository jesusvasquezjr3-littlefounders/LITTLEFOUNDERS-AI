import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { Badge, Card, Icon, IconChip, ProgressBar } from '@/components/ui';
import { DinaCharacter } from '@/components/characters/DinaCharacter';
import { ErrorBanner } from '@/routes/auth/ErrorBanner';

/*
 * learn/ — the universal user's home. Course cards per /DESIGN.md §Screen
 * Recipes → Dashboard (md:grid-cols-2 lg:grid-cols-3 with ProgressBars).
 * Cards link into the gamified course map (routes/app/learn/CoursePage.tsx,
 * COURSE_ENGINE.md §2) with real server-computed progress.
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
    <div>
      <header>
        <p className="lf-body-lg text-content-muted">
          {firstName ? t('dashboard.learn.greeting', { name: firstName }) : t('dashboard.learn.greetingAnon')}
        </p>
        <h1 className="lf-display-lg mt-1 text-content">{t('dashboard.learn.title')}</h1>
      </header>

      <section className="mt-8" aria-busy={state.status === 'loading'}>
        {state.status === 'loading' && (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Card key={i} aria-hidden="true" className="animate-pulse">
                <div className="h-12 w-12 rounded-full bg-surface-sunken" />
                <div className="mt-4 h-5 w-3/4 rounded-full bg-surface-sunken" />
                <div className="mt-3 h-3 w-1/2 rounded-full bg-surface-sunken" />
                <div className="mt-6 h-2.5 w-full rounded-full bg-surface-sunken" />
              </Card>
            ))}
          </div>
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
            {state.courses.map((course) => (
              <Link
                key={course.id}
                to={`/learn/${course.slug}`}
                className="rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <Card interactive className="flex h-full flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <IconChip>
                      <Icon name={COURSE_ICONS[course.slug] ?? 'menu_book'} />
                    </IconChip>
                    <Badge>
                      {t('dashboard.learn.lessonCount', { count: course.lessonCount })}
                    </Badge>
                  </div>
                  <h2 className="lf-title mt-4 text-content">{course.title[locale] ?? course.title['en-US'] ?? course.slug}</h2>
                  <div className="mt-auto pt-6">
                    <ProgressBar
                      value={course.progress.pct}
                      label={t('dashboard.learn.progressLabel', { passed: course.progress.passed, total: course.progress.total })}
                    />
                    <p className="lf-caption lf-number mt-3 flex items-center gap-1.5 text-content-muted">
                      <Icon name="rocket_launch" className="!text-[16px] text-primary" />
                      {t('dashboard.learn.progressLabel', { passed: course.progress.passed, total: course.progress.total })}
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
