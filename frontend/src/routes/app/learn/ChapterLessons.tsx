import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Icon, SectionHeading } from '@/components/ui';
import { localizedText, type LessonNode, type TopicNode } from '@/routes/app/learn/types';

/*
 * The chapter lesson list (/DESIGN.md §Tactile → Screen recipes → Learn).
 *
 * One chapter — the one the learner is inside — as a vertical run of lesson
 * rows, followed by the next chapter as a single collapsed row. Not the whole
 * course: a course is dozens of lessons and the question this screen answers
 * is "what do I do next", which is exactly one of them.
 *
 * EVERY STATE IS SERVER-DERIVED. `LessonNode.state` comes from Core's course
 * tree (courseTree.ts, migration 0016) and is never recomputed here from
 * progress numbers. A client that decides for itself what is unlocked is a
 * client that can be told otherwise, and this list is the door to paid,
 * gated content.
 */

interface ChapterLessonsProps {
  courseSlug: string;
  /** The chapter the learner is inside. */
  topic: TopicNode;
  /** Its 1-based position in the course, for the "Chapter N" label. */
  chapterNumber: number;
  /** The chapter after it, rendered collapsed. Absent at the end of a course. */
  nextTopic?: TopicNode | null;
  nextChapterNumber?: number;
  locale: string;
}

/*
 * The row's left-hand token. Three states, three shapes — never colour alone
 * (/DESIGN.md §Answer surfaces: state is never colour alone), so the check,
 * the play triangle and the padlock each say what they are without it.
 */
function StateToken({ state }: { state: LessonNode['state'] }) {
  if (state === 'passed') {
    return (
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-success text-on-success">
        <Icon name="check" fill className="!text-[24px]" aria-hidden />
      </span>
    );
  }
  if (state === 'locked') {
    return (
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-surface-sunken text-content-faint">
        <Icon name="lock" fill className="!text-[20px]" aria-hidden />
      </span>
    );
  }
  return (
    <span className="lf-tactile-accent flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-accent text-on-accent">
      <Icon name="play_arrow" fill className="!text-[24px]" aria-hidden />
    </span>
  );
}

function XpChip({ xp, emphasis }: { xp: number; emphasis: boolean }) {
  const { t } = useTranslation();
  return (
    <span
      className={`lf-caption lf-number inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 font-bold ${
        emphasis ? 'bg-warning-soft text-warning-strong' : 'bg-success-soft text-success-strong'
      }`}
    >
      <Icon name={emphasis ? 'star' : 'bolt'} fill className="!text-[14px]" aria-hidden />
      {t('learn.xp', { xp })}
    </span>
  );
}

function LessonRow({
  lesson,
  courseSlug,
  locale,
  number,
}: {
  lesson: LessonNode;
  courseSlug: string;
  locale: string;
  number: number;
}) {
  const { t } = useTranslation();
  const title = localizedText(lesson.title, locale, lesson.slug);
  const isCurrent = lesson.state === 'current';
  const isLocked = lesson.state === 'locked';

  const body = (
    <>
      <StateToken state={lesson.state} />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`lf-body truncate font-semibold ${isLocked ? 'text-content-faint' : 'text-content'}`}>
            {number}. {title}
          </span>
          {isCurrent && (
            /*
             * A LIVE badge, not a selected one. The dot breathes, which is the
             * difference between "this is happening now" and "you tapped this";
             * a static pill says the second and the row is trying to say the
             * first. Reduced motion stills the dot and keeps the badge.
             */
            <span className="lf-label inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-2.5 py-0.5 text-on-accent">
              <span className="lf-live-dot" aria-hidden />
              {t('learn.chapter.current')}
            </span>
          )}
        </div>
        {/*
          * The subtitle says what the row's STATE is, read from the state
          * itself. Collapsing "available" into "current" made every unlocked
          * lesson in the chapter say "start here", which is three invitations
          * to a screen that only has one next step.
          */}
        <span className="lf-caption truncate text-content-muted">
          {lesson.state === 'passed'
            ? t('learn.completed')
            : isLocked
              ? t('learn.chapter.unlockHint', { n: number - 1 })
              : t(`learn.state.${lesson.state}`)}
        </span>
      </div>

      <span className="lf-caption lf-number hidden shrink-0 text-content-muted sm:inline">
        {t('learn.minutes', { count: lesson.estimated_minutes })}
      </span>
      <XpChip xp={lesson.xp_total} emphasis={isCurrent} />
    </>
  );

  const shell = `flex items-center gap-4 rounded-md border p-3.5 sm:p-4 ${
    isCurrent
      ? 'lf-tactile lf-now shadow-tactile'
      : isLocked
        ? 'border-outline/60 bg-surface-sunken/60'
        : 'lf-tactile border-outline bg-surface'
  }`;

  if (isLocked) {
    /*
     * A locked lesson is not a link and not a disabled button — it is text.
     * A disabled control still takes focus in some assistive technologies and
     * promises something that pressing will never deliver.
     */
    return (
      <li className={shell} aria-label={`${number}. ${title} — ${t('learn.locked')}`}>
        {body}
      </li>
    );
  }

  return (
    <li>
      <Link
        to={`/learn/${courseSlug}/lesson/${lesson.slug}`}
        className={`${shell} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base`}
      >
        {body}
      </Link>
    </li>
  );
}

export function ChapterLessons({
  courseSlug,
  topic,
  chapterNumber,
  nextTopic,
  nextChapterNumber,
  locale,
}: ChapterLessonsProps) {
  const { t } = useTranslation();
  const eyebrowId = useId();
  const titleId = useId();
  const done = topic.lessons.filter((l) => l.state === 'passed').length;
  const title = localizedText(topic.title, locale, topic.slug);
  const complete = done === topic.lessons.length && done > 0;

  return (
    /*
     * NAMED BY BOTH HALVES OF THE LOCKUP. `aria-labelledby` takes a LIST, so
     * the section announces "Chapter 3 — Saving basics" from the two elements
     * a sighted learner reads, rather than from a third string written only
     * for a screen reader.
     */
    <section className="flex flex-col gap-4" aria-labelledby={`${eyebrowId} ${titleId}`}>
      <header>
        {/*
         * THE STUDY'S LOCKUP: wide-tracked small caps over a display line
         * (/DESIGN.md §The study's component set). The chapter NUMBER is the
         * eyebrow and the chapter TITLE is the line under it — the eyebrow
         * truncates and a title never should, and this is also the pairing the
         * study names as its strongest typographic signature.
         *
         * Accent keys the rows below: the current lesson's play token fills in
         * accent and so does its LIVE badge. Success once the chapter is done,
         * because then nothing under the heading is accent any more — the
         * counter is the only thing on this header that changes, so it marks
         * the moment it stops changing.
         */}
        <SectionHeading
          id={eyebrowId}
          icon={complete ? 'workspace_premium' : 'menu_book'}
          tone={complete ? 'success' : 'accent'}
          meta={
            <span className={`lf-chip lf-caption ${complete ? 'lf-chip-success' : 'lf-chip-accent'}`}>
              <Icon name="workspace_premium" fill className="!text-[16px]" aria-hidden />
              {t('learn.chapter.lessonsOf', { done, total: topic.lessons.length })}
            </span>
          }
        >
          {t('learn.chapter.short', { n: chapterNumber })}
        </SectionHeading>
        <h3 id={titleId} className="lf-title text-content">
          {title}
        </h3>
      </header>

      <ul className="flex flex-col gap-2.5">
        {topic.lessons.map((lesson, i) => (
          <LessonRow
            key={lesson.id}
            lesson={lesson}
            courseSlug={courseSlug}
            locale={locale}
            number={lesson.position || i + 1}
          />
        ))}
      </ul>

      {nextTopic && (
        <>
          <hr className="border-outline/60" />
          <Link
            to={`/learn/${courseSlug}`}
            className="lf-tactile flex items-center gap-4 rounded-md border border-outline bg-surface p-3.5 sm:p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-surface-sunken text-content-faint">
              <Icon name="lock" fill className="!text-[20px]" aria-hidden />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="lf-label text-content-faint">
                {t('learn.chapter.short', { n: nextChapterNumber ?? chapterNumber + 1 })}
              </span>
              <span className="lf-body truncate font-semibold text-content-muted">
                {localizedText(nextTopic.title, locale, nextTopic.slug)}
              </span>
            </div>
            <span className="lf-caption shrink-0 text-content-muted">
              {t('learn.chapter.lessonCount', { count: nextTopic.lessons.length })}
            </span>
          </Link>
        </>
      )}
    </section>
  );
}
