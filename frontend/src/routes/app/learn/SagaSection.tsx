import { useCallback, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionHeading } from '@/components/ui';
import { LessonPathNode } from './LessonPathNode';
import { localizedText, type SagaNode } from './types';

/*
 * A chapter's lessons (/DESIGN.md §Screen Recipes → Learn). The header is one
 * line: an icon, a name, a count. It used to be a card of its own holding a
 * progress bar the adventure band above it and the header bar above that both
 * already showed — three readings of the same number, nested two cards deep.
 * The lessons are the content here; everything else is a label on them.
 */

interface SagaSectionProps {
  saga: SagaNode;
  locale: string;
  courseSlug: string;
  nextLessonId: string | null;
  registerNodeRef: (lessonId: string, el: HTMLElement | null) => void;
}

export function SagaSection({ saga, locale, courseSlug, nextLessonId, registerNodeRef }: SagaSectionProps) {
  const { t } = useTranslation();
  const headingId = useId();

  const setNodeRef = useCallback(
    (lessonId: string) => (el: HTMLElement | null) => {
      registerNodeRef(lessonId, el);
    },
    [registerNodeRef],
  );

  return (
    <section className="flex flex-col gap-4" aria-labelledby={headingId}>
      {/*
       * THE SECTION LOCKUP (/DESIGN.md §The study's component set): the saga's
       * OWN icon in a tinted tile, its name in wide-tracked small caps, and the
       * progress count pinned right as `meta` — a count, never a control. The
       * hue is accent because the lesson rows under it mark the next lesson in
       * accent; a tile in any other colour would say the group selects in one.
       *
       * It used to be a bare icon, an `lf-title` and a number laid out by hand
       * — the same three parts, arranged for this one screen instead of built
       * from the piece the whole platform shares.
       */}
      <SectionHeading
        id={headingId}
        as="h3"
        icon={saga.icon || 'auto_stories'}
        tone="accent"
        meta={
          <span className="lf-number font-bold">
            {t('learn.lessonsProgress', { passed: saga.progress.passed, total: saga.progress.total })}
          </span>
        }
      >
        {localizedText(saga.title, locale, saga.slug)}
      </SectionHeading>

      <div className="flex flex-col gap-5">
        {saga.topics.map((topic) => (
          <div key={topic.id} className="flex flex-col gap-2">
            <h4 className="lf-caption font-bold text-content-faint">
              {localizedText(topic.title, locale, topic.slug)}
            </h4>

            <div className="flex flex-col gap-2">
              {topic.lessons.map((lesson) => (
                <LessonPathNode
                  key={lesson.id}
                  lesson={lesson}
                  locale={locale}
                  courseSlug={courseSlug}
                  isNextLesson={lesson.id === nextLessonId}
                  registerRef={setNodeRef(lesson.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
