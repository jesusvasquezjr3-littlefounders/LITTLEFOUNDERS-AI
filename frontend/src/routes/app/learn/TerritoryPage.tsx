import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { Card, Icon, LoadingOverlay, ProgressBar } from '@/components/ui';
import { cn } from '@/lib/utils';
import { ErrorBanner } from '@/routes/auth/ErrorBanner';
import { localizedText, type CourseTree, type TopicNode, type TopicState } from './types';

/*
 * /learn/:courseSlug/territory — the skill-territory map (roadmap.sh's
 * orientation insight, 2026-07-25 analysis: seeing the WHOLE territory plus
 * "you are here" is itself the product). A pure projection of the same
 * server-computed course tree the caminito uses — never a second source of
 * truth — with two things roadmap.sh structurally cannot offer: every state
 * is DATA-DERIVED (server-graded passes + the spaced-review layer, not a
 * self-reported checkbox), and 'review-due' comes straight from the
 * catalog's review_of edges (0016).
 *
 * Fog-of-war: locked adventures render as silhouette bands (name + lock
 * only) — a 6-year-old shown the full 4,000-node graph is overwhelmed, the
 * opposite of orientation.
 */

type LoadState = { status: 'loading' } | { status: 'error'; code: string } | { status: 'ready'; tree: CourseTree };

const STATE_META: Record<TopicState, { icon: string; tone: string; labelKey: string }> = {
  completed: { icon: 'check_circle', tone: 'text-success-strong', labelKey: 'learn.territory.state.completed' },
  'review-due': { icon: 'history', tone: 'text-warning-strong', labelKey: 'learn.territory.state.reviewDue' },
  'in-progress': { icon: 'radio_button_partial', tone: 'text-primary', labelKey: 'learn.territory.state.inProgress' },
  'not-started': { icon: 'circle', tone: 'text-content-faint', labelKey: 'learn.territory.state.notStarted' },
};

function TopicChip({ topic, locale, courseSlug, fallbackLinkTo }: { topic: TopicNode; locale: string; courseSlug?: string; fallbackLinkTo?: string }) {
  const { t } = useTranslation();
  const meta = STATE_META[topic.state];
  const passed = topic.lessons.filter((l) => l.state === 'passed').length;
  const isReviewKind = topic.kind !== 'teaching';
  const firstPlayableLesson = courseSlug
    ? (topic.lessons.find((lesson) => lesson.state === 'current' || lesson.state === 'available')
      ?? topic.lessons.find((lesson) => lesson.state === 'passed')
      ?? null)
    : null;
  const linkTo = firstPlayableLesson ? `/learn/lesson/${firstPlayableLesson.id}` : fallbackLinkTo;
  const content = (
    <>
      <Icon name={meta.icon} className={cn('shrink-0 text-[22px]', meta.tone)} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="lf-label block break-words text-content">{localizedText(topic.title, locale)}</span>
        <span className="lf-caption text-content-faint">
          {isReviewKind
            ? t('learn.territory.reviewTopic')
            : t('learn.territory.lessonCount', { passed, total: topic.lessons.length })}
        </span>
      </span>
      {topic.state === 'review-due' ? (
        <span className="lf-caption shrink-0 rounded-full bg-warning-soft px-2 py-0.5 font-bold text-warning-strong">
          {t('learn.territory.reviewDueBadge')}
        </span>
      ) : null}
      {firstPlayableLesson ? <Icon name="arrow_forward" className="shrink-0 text-[18px] text-primary" aria-hidden /> : null}
    </>
  );

  return (
    <li>
      {linkTo ? (
        <Link
          to={linkTo}
          state={courseSlug ? { courseSlug } : undefined}
          className={cn(
            'flex min-h-11 items-center gap-2.5 rounded-lg border border-outline/60 bg-surface px-3 py-2.5 shadow-glass-sm',
            'transition-[border-color,transform] duration-150 hover:border-primary/60 active:translate-y-px',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
            topic.state === 'review-due' && 'border-warning/60 bg-warning-soft/30',
          )}
        >
          {content}
        </Link>
      ) : (
        <div className="flex min-h-11 items-center gap-2.5 rounded-lg border border-dashed border-outline/60 bg-surface-sunken/40 px-3 py-2.5 opacity-75">
          {content}
          <Icon name="lock" className="shrink-0 text-[16px] text-content-faint" aria-hidden />
        </div>
      )}
    </li>
  );
}

export function TerritoryPage() {
  const { t, i18n } = useTranslation();
  const { courseSlug = '' } = useParams();
  const { getToken } = useAuth();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const locale = i18n.resolvedLanguage ?? 'en-US';

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    void (async () => {
      const token = await getToken();
      if (!token || cancelled) return;
      const { data, error } = await api<CourseTree>(`/learn/courses/${courseSlug}/tree`, { token });
      if (cancelled) return;
      setState(error ? { status: 'error', code: error.code } : { status: 'ready', tree: data });
    })();
    return () => {
      cancelled = true;
    };
  }, [courseSlug, getToken]);

  if (state.status === 'loading') return <LoadingOverlay label={t('learn.territory.loading')} />;
  if (state.status === 'error') return <ErrorBanner code={state.code} />;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 md:px-6">
      <header className="flex flex-col gap-5 rounded-xl border border-outline/60 bg-surface p-5 shadow-glass md:p-6">
        <div>
          <Link to={`/learn/${courseSlug}`} className="lf-caption flex items-center gap-1 font-bold text-primary hover:underline">
            <Icon name="arrow_back" className="text-[16px]" aria-hidden /> {t('learn.territory.back')}
          </Link>
          <h1 className="lf-display mt-1 text-content">{t('learn.territory.title')}</h1>
          <p className="lf-body text-content-muted">{t('learn.territory.subtitle')}</p>
        </div>
        <TerritoryProgressStrip tree={state.tree} />
        <div className="flex flex-wrap gap-2" aria-label={t('learn.territory.legendLabel')}>
          {(Object.entries(STATE_META) as Array<[TopicState, (typeof STATE_META)[TopicState]]>).map(([stateKey, meta]) => (
            <span key={stateKey} className="lf-caption inline-flex items-center gap-1.5 rounded-full bg-surface-sunken px-3 py-1 font-semibold text-content-muted">
              <Icon name={meta.icon} className={cn('!text-[15px]', meta.tone)} aria-hidden />
              {t(meta.labelKey)}
            </span>
          ))}
        </div>
      </header>
      <TerritoryView tree={state.tree} locale={locale} courseSlug={courseSlug} />
    </div>
  );
}

/** Course progress + reviews-due rollup — shared by kid and parent views. */
export function TerritoryProgressStrip({ tree }: { tree: CourseTree }) {
  const { t } = useTranslation();
  const reviewsDue = tree.adventures
    .flatMap((a) => a.sagas.flatMap((s) => s.topics))
    .filter((topic) => topic.state === 'review-due').length;
  return (
    <div className="w-full lg:max-w-xs">
      <ProgressBar value={tree.course.progress.pct} label={t('learn.territory.progress')} />
      <p className="lf-caption mt-1 text-content-faint">
        {t('learn.territory.progressLabel', { passed: tree.course.progress.passed, total: tree.course.progress.total })}
        {reviewsDue > 0 ? ` · ${t('learn.territory.reviewsDue', { count: reviewsDue })}` : ''}
      </p>
    </div>
  );
}

/** The territory itself — adventure bands, saga columns, topic chips. Pure render of a CourseTree (kid AND parent surfaces). */
export function TerritoryView({ tree, locale, courseSlug, chipLinkTo }: { tree: CourseTree; locale: string; courseSlug?: string; chipLinkTo?: string }) {
  const { t } = useTranslation();
  return (
    <>
      {tree.adventures.map((adventure) =>
        adventure.state === 'locked' ? (
          /* Fog-of-war: name + lock only — territory you have not reached yet. */
          <Card key={adventure.id} className="flex items-center gap-3 border-dashed p-4 opacity-70">
            <Icon name="lock" className="text-[22px] text-content-faint" aria-hidden />
            <div>
              <h2 className="lf-title text-content-muted">{localizedText(adventure.title, locale)}</h2>
              <p className="lf-caption text-content-faint">{t('learn.territory.locked')}</p>
            </div>
          </Card>
        ) : (
          <Card key={adventure.id} className="flex flex-col gap-4 p-4 md:p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="lf-title text-content">{localizedText(adventure.title, locale)}</h2>
              <span className="lf-caption lf-number shrink-0 text-content-faint">
                {adventure.progress.passed}/{adventure.progress.total}
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {adventure.sagas.map((saga) => (
                <section key={saga.id}>
                  <h3 className="lf-caption mb-2 flex items-center gap-1.5 font-bold text-content-muted">
                    <Icon name={saga.icon} className="text-[18px]" aria-hidden />
                    {localizedText(saga.title, locale)}
                  </h3>
                  <ul className="flex flex-col gap-2">
                    {saga.topics.map((topic) => (
                      <TopicChip key={topic.id} topic={topic} locale={locale} courseSlug={courseSlug} fallbackLinkTo={chipLinkTo} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </Card>
        ),
      )}
    </>
  );
}

export default TerritoryPage;
