import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui';
import type { CharacterId } from '@/components/characters/control/types';
import { localizedText, type LessonNode } from './types';

/*
 * A syllabus row (/DESIGN.md §Screen Recipes → Learn). The row IS the
 * button, so it does not also contain one: a labelled "Start" pill inside a
 * tappable row is a second target for the same navigation, and on a phone the
 * two are a thumb-width apart. What is left is state, title, and the two
 * numbers a learner actually weighs before tapping — how long, how much XP.
 */

const STATUS_ICONS: Record<LessonNode['state'], string> = {
  passed: 'check',
  current: 'play_arrow',
  available: 'play_arrow',
  locked: 'lock',
};

const STATUS_TILE_CLASSES: Record<LessonNode['state'], string> = {
  passed: 'bg-success-soft text-success-strong',
  current: 'bg-accent text-on-accent',
  available: 'bg-primary-soft text-primary',
  locked: 'bg-surface-sunken text-content-faint',
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
  const clickable = lesson.state !== 'locked';
  const title = localizedText(lesson.title, locale, lesson.slug);
  const isCurrent = lesson.state === 'current' || isNextLesson;

  function go() {
    if (!clickable) return;
    navigate(`/learn/lesson/${lesson.id}`, { state: { courseSlug } });
  }

  return (
    <button
      ref={registerRef as React.Ref<HTMLButtonElement>}
      type="button"
      onClick={go}
      disabled={!clickable}
      aria-disabled={!clickable}
      aria-label={`${title}, ${t(`learn.state.${lesson.state}`)}`}
      className={cn(
        'group flex w-full items-center gap-3.5 rounded-md border p-3.5 text-left transition-[border-color,background-color] duration-200',
        clickable
          ? 'cursor-pointer border-outline/50 bg-surface hover:border-primary/50 hover:bg-primary-soft/15'
          : 'cursor-not-allowed border-outline/40 bg-surface-sunken/40 opacity-70',
        isCurrent && 'border-accent/60 bg-accent-soft/20',
        isNextLesson && 'lf-pop',
      )}
    >
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
          STATUS_TILE_CLASSES[lesson.state],
        )}
      >
        <Icon name={STATUS_ICONS[lesson.state]} className="!text-[20px]" aria-hidden />
      </span>

      {/*
        * List rows (/DESIGN.md §Layout → Grid Systems): one full-width row at
        * every breakpoint. The width the row gains on desktop is spent moving
        * the meta out from under the title and onto the right, so a wide row
        * is a wider row and never a mobile row with empty space in the middle.
        */}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <span className="lf-body break-words font-bold text-content transition-colors duration-150 group-hover:text-primary">
          {title}
        </span>
        <span className="lf-caption lf-number shrink-0 text-content-muted">
          {t('learn.lessonMeta', { minutes: lesson.estimated_minutes, xp: lesson.xp_total })}
        </span>
      </span>

      {clickable && (
        <Icon
          name="chevron_right"
          className="!text-[20px] shrink-0 text-content-faint transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary"
          aria-hidden
        />
      )}
    </button>
  );
}
