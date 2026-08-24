import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui';
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

  const setNodeRef = useCallback(
    (lessonId: string) => (el: HTMLElement | null) => {
      registerNodeRef(lessonId, el);
    },
    [registerNodeRef],
  );

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <Icon name={saga.icon || 'auto_stories'} className="!text-[20px] shrink-0 text-primary" aria-hidden />
        <h3 className="lf-title min-w-0 flex-1 truncate text-content">
          {localizedText(saga.title, locale, saga.slug)}
        </h3>
        <span className="lf-caption lf-number shrink-0 font-bold text-content-muted">
          {t('learn.lessonsProgress', { passed: saga.progress.passed, total: saga.progress.total })}
        </span>
      </div>

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
