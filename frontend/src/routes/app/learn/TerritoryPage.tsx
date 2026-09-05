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
      <Icon name={meta.icon} className={cn('shrink-0 text-[20px]', meta.tone)} aria-hidden />
      <span className="lf-label min-w-0 flex-1 break-words text-content">{localizedText(topic.title, locale)}</span>
      {topic.state === 'review-due' ? (
        <span className="lf-caption shrink-0 rounded-full bg-warning-soft px-2 py-0.5 font-bold text-warning-strong">
          {t('learn.territory.reviewDueBadge')}
        </span>
      ) : null}
      <span className="lf-caption lf-number shrink-0 text-content-muted">
        {isReviewKind ? t('learn.territory.reviewTopic') : `${passed}/${topic.lessons.length}`}
      </span>
    </>
  );

  return (
    <li>
      {linkTo ? (
        <Link
          to={linkTo}
          state={courseSlug ? { courseSlug } : undefined}
          className={cn(
            'flex min-h-11 items-center gap-2.5 rounded-lg border border-outline/50 bg-surface px-3 py-2.5',
            'transition-[border-color,transform] duration-150 hover:border-primary/60 lf-press',
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

  const topicStates = new Set(
    state.tree.adventures
      .filter((adventure) => adventure.state !== 'locked')
      .flatMap((adventure) => adventure.sagas.flatMap((saga) => saga.topics.map((topic) => topic.state))),
  );
  const presentStates = (Object.keys(STATE_META) as TopicState[]).filter((key) => topicStates.has(key));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-4">
        <Link to={`/learn/${courseSlug}`} className="lf-caption flex w-fit items-center gap-1 font-bold text-primary hover:underline">
          <Icon name="arrow_back" className="text-[16px]" aria-hidden /> {t('learn.territory.back')}
        </Link>
        <h1 className="lf-display text-content">{t('learn.territory.title')}</h1>
        <TerritoryProgressStrip tree={state.tree} />
        {/*
          * A legend for a state nothing on this page is in explains a symbol
          * the learner will not meet, which is the same cost as the symbol it
          * was meant to save them.
          */}
        <div className="flex flex-wrap gap-2" aria-label={t('learn.territory.legendLabel')}>
          {presentStates.map((stateKey) => (
            <span key={stateKey} className="lf-caption inline-flex items-center gap-1.5 rounded-full bg-surface-sunken px-3 py-1 font-semibold text-content-muted">
              <Icon name={STATE_META[stateKey].icon} className={cn('!text-[15px]', STATE_META[stateKey].tone)} aria-hidden />
              {t(STATE_META[stateKey].labelKey)}
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
    <div className="flex w-full items-center gap-3 lg:max-w-md">
      <ProgressBar value={tree.course.progress.pct} tone="accent" label={t('learn.territory.progress')} className="flex-1" />
      <span className="lf-caption lf-number shrink-0 font-bold text-content-muted">
        {tree.course.progress.passed}/{tree.course.progress.total}
      </span>
      {reviewsDue > 0 ? (
        <span className="lf-caption shrink-0 rounded-full bg-warning-soft px-2 py-0.5 font-bold text-warning-strong">
          {t('learn.territory.reviewsDue', { count: reviewsDue })}
        </span>
      ) : null}
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
          <Card
            key={adventure.id}
            aria-label={`${localizedText(adventure.title, locale)}, ${t('learn.territory.locked')}`}
            className="flex items-center gap-3 border-dashed p-4 opacity-70"
          >
            <Icon name="lock" className="text-[22px] text-content-faint" aria-hidden />
            <h2 className="lf-title text-content-muted">{localizedText(adventure.title, locale)}</h2>
          </Card>
        ) : (
          <Card key={adventure.id} className="flex flex-col gap-4 p-4 md:p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="lf-title text-content">{localizedText(adventure.title, locale)}</h2>
              <span className="lf-caption lf-number shrink-0 text-content-muted">
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
