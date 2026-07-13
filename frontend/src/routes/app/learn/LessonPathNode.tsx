import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui';
import { localizedText, type LessonNode } from './types';

/*
 * One circular node on a saga's wavy lesson path (DESIGN.md §Layout closed
 * grid categories don't cover this shape — a path, not a grid — kept single
 * column per the task brief; see AdventureBanner's composition note).
 */

const STATE_CLASSES: Record<LessonNode['state'], string> = {
  passed: 'bg-success text-on-success shadow-glass-sm',
  current: 'bg-accent text-on-accent shadow-pop ring-4 ring-accent/30',
  available: 'border-2 border-primary bg-surface text-primary shadow-glass-sm',
  locked: 'bg-surface-sunken text-content-faint',
};

interface LessonPathNodeProps {
  lesson: LessonNode;
  locale: string;
  courseSlug: string;
  side: 'left' | 'right';
  isNextLesson: boolean;
  registerRef?: (el: HTMLElement | null) => void;
}

export function LessonPathNode({ lesson, locale, courseSlug, side, isNextLesson, registerRef }: LessonPathNodeProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // One-shot pop on mount only for the current lesson's ring (DESIGN.md §Motion
  // recipe 3, .lf-pop) — never a re-triggering/looping pulse.
  const [popped] = useState(isNextLesson);

  const clickable = lesson.state !== 'locked';
  const title = localizedText(lesson.title, locale, lesson.slug);

  function go() {
    if (!clickable) return;
    navigate(`/learn/lesson/${lesson.id}`, { state: { courseSlug } });
  }

  return (
    <div
      ref={registerRef}
      className={cn('relative z-10 flex items-center gap-3', side === 'right' ? 'flex-row-reverse self-end text-right' : 'self-start text-left')}
      style={{ maxWidth: '80%' }}
    >
      <button
        type="button"
        onClick={go}
        disabled={!clickable}
        aria-label={`${title} — ${t(`learn.state.${lesson.state}`)}`}
        className={cn(
          'motion-safe-press relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full transition-colors duration-200 disabled:cursor-not-allowed',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
          STATE_CLASSES[lesson.state],
          popped && 'lf-pop',
        )}
      >
        {lesson.state === 'passed' && <Icon name="check" className="text-[24px]" />}
        {lesson.state === 'locked' && <Icon name="lock" className="text-[18px]" />}
        {(lesson.state === 'current' || lesson.state === 'available') && (
          <span className="lf-label lf-number">{lesson.position}</span>
        )}
      </button>
      <div className={cn('flex min-w-0 flex-col gap-0.5', side === 'right' ? 'items-end' : 'items-start')}>
        {isNextLesson && <span className="lf-caption font-bold text-accent-strong">{t('learn.startHere')}</span>}
        <p className="lf-label truncate text-content">{title}</p>
        <span className="lf-caption lf-number text-content-muted">
          {t('learn.xp', { xp: lesson.xp_total })} · {t('learn.minutes', { count: lesson.estimated_minutes })}
        </span>
      </div>
    </div>
  );
}
