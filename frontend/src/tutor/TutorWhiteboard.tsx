import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

/*
 * THE TUTOR'S WHITEBOARD (V4).
 *
 * Until now a growth or spending story lived only in `say` — the tutor could
 * narrate "empiezas con 10 y cada día te dan 2 más" and nothing on screen
 * changed. Reported directly by the owner from a live session, alongside a
 * COMPLETELY UNRELATED activity sitting in the plate. This renders the SAME
 * numbers the tutor is already inventing for its story (oracle/prompt.ts's
 * "invented numbers" rule), live, as the turn arrives.
 *
 * DELIBERATELY NOT A LESSON-ENGINE COMPONENT. `LiveSegmentPanel` reuses the
 * real 57-type registry because grading, XP and the answer key genuinely are
 * shared with the Lesson Player — this is not graded, has no key, and is
 * owned entirely by the tutor surface (LESSON_ENGINE.md §4's family-boundary
 * convention: a family's files are its own, and this is not a family).
 *
 * `values` ARE NEVER RECOMPUTED HERE. Oracle already ran the same arithmetic
 * server-side (`whiteboard.ts`) before this ever reached the wire — the
 * client's job is to draw the numbers it was given, not to re-derive them,
 * exactly the posture the rest of the Tutor takes with a spoken verdict.
 */

export interface TutorWhiteboardData {
  kind: 'sequence';
  start: number;
  values: number[];
  /**
   * What one step represents in time. Found missing from a real session:
   * the tutor's own story said "cada semana" three times and the board, with
   * no notion of a unit, drew "Día 1/2/3" — a label that CONTRADICTED the
   * story it was supposed to match, on the one feature whose entire purpose
   * is that match. Server-set, from the model's own cadence word.
   */
  unit: 'day' | 'week' | 'month' | 'year';
  label: string;
  currency: 'MXN' | 'USD' | 'BRL' | null;
}

export interface TutorWhiteboardProps {
  board: TutorWhiteboardData;
  /** Bumped per turn, so the SAME board (same seq) never replays its animation. */
  seq: number;
  className?: string;
}

/**
 * How long each bar takes to grow in, one at a time.
 *
 * Exported so `replayScript.ts` can compute how long a replayed beat that
 * drew a whiteboard must stay on screen at minimum — the reveal this
 * constant paces is real work this component does AFTER the beat has
 * already started, and nothing else in the replay knew how long it takes.
 * Found by adversarial review (see RUNBOOK.md): a replayed beat's duration
 * was driven purely by the tutor's spoken word count, with zero awareness
 * of this number, so a short `say` paired with a many-step board — the
 * DESIGNED usage, per /ORACLE.md's whiteboard section, not a rare one —
 * could end the beat, and unmount this component, before the bars had
 * finished growing.
 */
export const GROW_STEP_MS = 550;

function useValueFormat(currency: string | null): (n: number) => string {
  const { i18n } = useTranslation();
  return useMemo(() => {
    const fmt = currency
      ? new Intl.NumberFormat(i18n.language, { style: 'currency', currency, maximumFractionDigits: 0 })
      : new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 0 });
    return (n: number) => fmt.format(n);
  }, [i18n.language, currency]);
}

export function TutorWhiteboard({ board, seq, className }: TutorWhiteboardProps) {
  const { t } = useTranslation();
  const format = useValueFormat(board.currency);
  const reducedMotion = useMemo(
    () => typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false),
    [],
  );
  /** How many bars are grown-in so far. All of them immediately for a replayed seq or reduced motion. */
  const [shown, setShown] = useState(reducedMotion ? board.values.length : 1);

  useEffect(() => {
    setShown(reducedMotion ? board.values.length : Math.min(1, board.values.length));
  }, [seq, reducedMotion, board.values.length]);

  useEffect(() => {
    if (reducedMotion || shown >= board.values.length) return;
    const id = window.setTimeout(() => setShown((n) => Math.min(n + 1, board.values.length)), GROW_STEP_MS);
    return () => window.clearTimeout(id);
  }, [shown, reducedMotion, board.values.length]);

  const max = Math.max(...board.values, 1);

  return (
    <div
      data-tutor-whiteboard
      role="img"
      aria-label={`${board.label}. ${board.values.slice(0, shown).map(format).join(', ')}`}
      className={cn('flex min-h-0 flex-col gap-3', className)}
    >
      <p className="lf-caption shrink-0 text-content-muted">{board.label}</p>
      <div className="flex min-h-0 flex-1 items-end gap-2 overflow-x-auto px-1 pb-1">
        {board.values.map((value, i) => {
          const grown = i < shown;
          const heightPct = Math.max(6, Math.round((value / max) * 100));
          return (
            <div key={i} className="flex min-w-[3.5rem] flex-1 flex-col items-center gap-1">
              <span className="lf-number lf-title text-content" aria-hidden="true">
                {grown ? format(value) : ''}
              </span>
              <div
                className={cn(
                  'w-full rounded-t-md bg-[color:var(--lf-accent)]/70 transition-[height] duration-500 ease-out',
                  !grown && 'opacity-0',
                )}
                style={{ height: grown ? `${heightPct}%` : '0%' }}
              />
              <span className="lf-caption text-content-muted" aria-hidden="true">
                {i === 0
                  ? t('tutor.whiteboard.start')
                  : t(`tutor.whiteboard.step.${board.unit}`, { n: i })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
