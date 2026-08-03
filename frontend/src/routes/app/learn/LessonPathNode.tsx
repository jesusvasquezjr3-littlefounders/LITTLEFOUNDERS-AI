import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Badge, Icon } from '@/components/ui';
import type { CharacterId } from '@/components/characters/control/types';
import { localizedText, type LessonNode } from './types';

/*
 * Brilliant.org-style Syllabus Item Row.
 * Replaces the old Duolingo-style winding snake node with a structured,
 * responsive syllabus card row featuring lesson status, duration, XP rewards,
 * and high-contrast action CTAs.
 */

const STATUS_ICONS: Record<LessonNode['state'], string> = {
  passed: 'check_circle',
  current: 'play_circle',
  available: 'play_circle',
  locked: 'lock',
};

const STATUS_BADGE_CLASSES: Record<LessonNode['state'], string> = {
  passed: 'bg-success-soft text-success-strong border border-success/30',
  current: 'bg-accent text-on-accent shadow-glass-sm',
  available: 'bg-primary-soft text-primary border border-primary/30',
  locked: 'bg-surface-sunken text-content-faint border border-outline/50',
};

interface LessonPathNodeProps {
  lesson: LessonNode;
  locale: string;
  courseSlug: string;
  waveOffset?: number;
  peakCharacter?: CharacterId | null;
  peakSide?: 'left' | 'right';
  isNextLesson: boolean;
  registerRef?: (el: HTMLElement | null) => void;
}

export function LessonPathNode({
  lesson,
  locale,
  courseSlug,
  isNextLesson,
  registerRef,
}: LessonPathNodeProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [popped] = useState(isNextLesson);

  const clickable = lesson.state !== 'locked';
  const title = localizedText(lesson.title, locale, lesson.slug);

  function go() {
    if (!clickable) return;
    navigate(`/learn/lesson/${lesson.id}`, { state: { courseSlug } });
  }

  const isCurrent = lesson.state === 'current' || isNextLesson;
  const ctaLabel = lesson.state === 'passed'
    ? t('learn.reviewLesson')
    : isCurrent
    ? t('learn.continueLesson')
    : t('learn.startLesson');

  return (
    <button
      ref={registerRef as React.Ref<HTMLButtonElement>}
      type="button"
      onClick={go}
      disabled={!clickable}
      aria-disabled={!clickable}
      aria-label={`${title} — ${t(`learn.state.${lesson.state}`)}`}
      className={cn(
        'group relative flex w-full items-center justify-between gap-4 rounded-xl border p-4 shadow-glass-sm transition-all duration-200 text-left',
        clickable ? 'cursor-pointer hover:border-primary/50 hover:bg-primary-soft/10 hover:shadow-glass' : 'cursor-not-allowed opacity-70 bg-surface-sunken/40 border-outline/40',
        isCurrent ? 'border-primary/60 bg-gradient-to-r from-primary-soft/30 via-surface to-surface shadow-glass' : 'border-outline/60 bg-surface',
        popped && 'lf-pop'
      )}
    >
      {/* Left Icon & Lesson Details */}
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        {/* Status Badge Tile */}
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-bold transition-transform duration-200 group-hover:scale-105',
            STATUS_BADGE_CLASSES[lesson.state]
          )}
        >
          <Icon name={STATUS_ICONS[lesson.state]} className="!text-[22px]" aria-hidden />
        </div>

        {/* Title & Metadata */}
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="lf-title truncate text-content group-hover:text-primary transition-colors">
              {title}
            </h4>
            {isCurrent && (
              <Badge className="bg-accent text-on-accent border-none font-bold">
                {t('learn.startHere')}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 text-content-muted lf-caption lf-number font-medium">
            <span className="flex items-center gap-1">
              <Icon name="schedule" className="!text-[14px]" />
              {t('learn.minutes', { count: lesson.estimated_minutes })}
            </span>
            <span>·</span>
            <span className="flex items-center gap-1 font-bold text-primary">
              <Icon name="stars" className="!text-[14px]" />
              {t('learn.xp', { xp: lesson.xp_total })}
            </span>
          </div>
        </div>
      </div>

      {/* Right Action Button */}
      <div className="shrink-0">
        {clickable ? (
          <span
            className={cn(
              'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-5 py-2.5 lf-label font-bold shadow-glass-sm transition-all duration-200 group-hover:translate-x-0.5',
              isCurrent ? 'bg-primary text-on-primary hover:bg-primary-strong' : 'border border-outline/70 bg-surface text-primary hover:border-primary/50'
            )}
          >
            {ctaLabel}
            <Icon name="arrow_forward" className="!text-[16px]" />
          </span>
        ) : (
          <span className="lf-caption flex items-center gap-1 font-bold text-content-faint px-3 py-2 rounded-full bg-surface-sunken">
            <Icon name="lock" className="!text-[14px]" />
            {t('learn.locked')}
          </span>
        )}
      </div>
    </button>
  );
}
