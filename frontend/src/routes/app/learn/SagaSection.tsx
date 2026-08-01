import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon, IconChip, ProgressBar } from '@/components/ui';
import { LessonPathNode } from './LessonPathNode';
import { localizedText, type SagaNode } from './types';

/*
 * Brilliant.org-style Saga/Module Section.
 * Structured module card featuring a clean header with progress metrics,
 * topic sub-headers, and vertical list of interactive syllabus lesson rows.
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
    <section className="flex flex-col gap-5 pt-6 first:pt-0">
      {/* Chapter/Saga Header */}
      <div className="flex flex-col gap-3 rounded-xl border border-outline/50 bg-surface-sunken/40 p-4">
        <div className="flex items-center gap-3">
          <IconChip tone="primary" size="md">
            <Icon name={saga.icon || 'auto_stories'} className="text-[20px]" />
          </IconChip>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="lf-title text-content truncate">
                {localizedText(saga.title, locale, saga.slug)}
              </h3>
              <span className="lf-caption lf-number shrink-0 font-bold text-content-muted">
                {t('learn.lessonsProgress', { passed: saga.progress.passed, total: saga.progress.total })}
              </span>
            </div>
            <ProgressBar
              value={saga.progress.pct}
              tone="accent"
              label={t('learn.lessonsProgress', { passed: saga.progress.passed, total: saga.progress.total })}
              className="mt-2"
            />
          </div>
        </div>
      </div>

      {/* Topics & Lesson List */}
      <div className="flex flex-col gap-6">
        {saga.topics.map((topic) => (
          <div key={topic.id} className="flex flex-col gap-3">
            {/* Topic Sub-Header */}
            <div className="flex items-center gap-2 px-1 pt-1">
              <Icon name="bookmark" className="!text-[16px] text-primary" />
              <h5 className="lf-label text-content-muted">
                {localizedText(topic.title, locale, topic.slug)}
              </h5>
            </div>

            {/* Lesson Rows List */}
            <div className="flex flex-col gap-3">
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
