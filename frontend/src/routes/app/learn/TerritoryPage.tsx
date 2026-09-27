import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Card, Icon, ProgressBar, SectionHeading } from '@/components/ui';
import { cn } from '@/lib/utils';
import { lessonPath } from './paths';
import { localizedText, type CourseTree, type SagaNode, type TopicNode, type TopicState } from './types';

/*
 * W2L.2: the learner's /learn/:courseSlug/territory is the rebuilt course
 * world (TerritoryRoute, rebuild/learning/TerritoryMapView.tsx). What stays
 * here is only the legacy renderer the Family Hub's kid view still imports
 * (routes/app/family/KidTerritoryPage.tsx, Lane 4): TerritoryView and
 * TerritoryProgressStrip. Removed at the S10 cutover once Lane 4 mounts a
 * rebuilt view (the rebuilt map can serve it: links are the host's).
 *
 * Originally: the skill-territory map (roadmap.sh's
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

const STATE_META: Record<TopicState, { icon: string; tone: string; labelKey: string }> = {
  completed: { icon: 'check_circle', tone: 'text-success-strong', labelKey: 'learn.territory.state.completed' },
  'review-due': { icon: 'history', tone: 'text-warning-strong', labelKey: 'learn.territory.state.reviewDue' },
  'in-progress': { icon: 'radio_button_partial', tone: 'text-primary', labelKey: 'learn.territory.state.inProgress' },
  'not-started': { icon: 'circle', tone: 'text-content-faint', labelKey: 'learn.territory.state.notStarted' },
};

/*
 * ONE SAGA'S COLUMN OF TOPIC CHIPS, headed by the study's lockup.
 *
 * A component of its own rather than an inline `.map`, because the lockup owns
 * the id that names its own group and `useId` cannot be called inside a loop.
 * The tone is `muted`: every chip under it carries its OWN state hue — success
 * when passed, warning when a review is due — so a coloured tile here would
 * claim the group selects in a colour it does not.
 */
function SagaColumn({
  saga,
  locale,
  courseSlug,
  chipLinkTo,
}: {
  saga: SagaNode;
  locale: string;
  courseSlug?: string;
  chipLinkTo?: string;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <SectionHeading id={headingId} as="h3" icon={saga.icon || 'auto_stories'} tone="muted">
        {localizedText(saga.title, locale)}
      </SectionHeading>
      <ul className="flex flex-col gap-2">
        {saga.topics.map((topic) => (
          <TopicChip key={topic.id} topic={topic} locale={locale} courseSlug={courseSlug} fallbackLinkTo={chipLinkTo} />
        ))}
      </ul>
    </section>
  );
}

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
  const linkTo = firstPlayableLesson ? lessonPath(firstPlayableLesson.id) : fallbackLinkTo;
  const content = (
    <>
      {/*
       * The study's small icon WELL rather than a bare glyph (/DESIGN.md §The
       * study's component set). `.lf-tile` takes its fill and its border from
       * `currentColor`, so the state's own hue — success, warning, primary,
       * faint — is the only thing this row has to name.
       */}
      <span className={cn('lf-tile h-7 w-7', meta.tone)}>
        <Icon name={meta.icon} className="!text-[16px]" aria-hidden />
      </span>
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
            // `md` (16px), not `lg` (24px): 24 is the modal shell's radius and
            // every card, panel and row in the product sits at 16 (§Shape).
            'flex min-h-11 items-center gap-2.5 rounded-md border border-outline/50 bg-surface px-3 py-2.5',
            'transition-[border-color,transform] duration-150 hover:border-primary/60 lf-press',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
            topic.state === 'review-due' && 'border-warning/60 bg-warning-soft/30',
          )}
        >
          {content}
        </Link>
      ) : (
        <div className="flex min-h-11 items-center gap-2.5 rounded-md border border-dashed border-outline/60 bg-surface-sunken/40 px-3 py-2.5 opacity-75">
          {content}
          <Icon name="lock" className="shrink-0 text-[16px] text-content-faint" aria-hidden />
        </div>
      )}
    </li>
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
                <SagaColumn
                  key={saga.id}
                  saga={saga}
                  locale={locale}
                  courseSlug={courseSlug}
                  chipLinkTo={chipLinkTo}
                />
              ))}
            </div>
          </Card>
        ),
      )}
    </>
  );
}

