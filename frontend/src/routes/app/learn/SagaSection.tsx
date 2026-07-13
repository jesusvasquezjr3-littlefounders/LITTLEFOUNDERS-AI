import { useTranslation } from 'react-i18next';
import { Icon, IconChip, ProgressBar } from '@/components/ui';
import { LessonPathNode } from './LessonPathNode';
import { localizedText, type SagaNode } from './types';

interface SagaSectionProps {
  saga: SagaNode;
  locale: string;
  courseSlug: string;
  nextLessonId: string | null;
  registerNodeRef: (lessonId: string, el: HTMLElement | null) => void;
}

/** One saga: icon chip + title + progress header, then its topics threaded into ONE continuous wavy lesson path (one node per lesson — improves on v1's per-topic grouping). */
export function SagaSection({ saga, locale, courseSlug, nextLessonId, registerNodeRef }: SagaSectionProps) {
  const { t } = useTranslation();
  let side: 'left' | 'right' = 'left';

  return (
    <section className="mt-8 first:mt-0">
      <div className="mb-5 flex items-center gap-3">
        <IconChip size="md">
          <Icon name={saga.icon || 'flag'} />
        </IconChip>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="lf-title text-content">{localizedText(saga.title, locale, saga.slug)}</h3>
            <span className="lf-caption lf-number shrink-0 font-bold text-content-muted">
              {t('learn.lessonsProgress', { passed: saga.progress.passed, total: saga.progress.total })}
            </span>
          </div>
          <ProgressBar
            value={saga.progress.pct}
            tone="accent"
            label={t('learn.lessonsProgress', { passed: saga.progress.passed, total: saga.progress.total })}
            className="mt-1.5"
          />
        </div>
      </div>

      <div className="relative mx-auto flex max-w-xl flex-col gap-6 pb-2">
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-7 left-1/2 z-0 w-0.5 -translate-x-1/2 bg-outline" />
        {saga.topics.map((topic) => (
          <div key={topic.id} className="relative z-10 flex flex-col gap-6">
            <p className="lf-label self-center rounded-full bg-surface px-3 py-1 text-content-muted">
              {localizedText(topic.title, locale, topic.slug)}
            </p>
            {topic.lessons.map((lesson) => {
              const thisSide = side;
              side = side === 'left' ? 'right' : 'left';
              return (
                <LessonPathNode
                  key={lesson.id}
                  lesson={lesson}
                  locale={locale}
                  courseSlug={courseSlug}
                  side={thisSide}
                  isNextLesson={lesson.id === nextLessonId}
                  registerRef={(el) => registerNodeRef(lesson.id, el)}
                />
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
