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

/**
 * A running value this close to zero is drawn as zero height, not a bar with
 * the visibility floor below.
 *
 * Mirrors `oracle/src/tutor/whiteboard.ts`'s own `ZERO_EPSILON` (same value,
 * duplicated rather than imported — this package has no dependency on
 * `oracle/`, same posture as `TutorWhiteboardData` above hand-mirroring the
 * wire shape instead of importing it). That module clamps a running value
 * NEGATIVE by a hair of floating-point noise up to exact `0`, for a
 * legitimate "spend it down to zero" sequence — a designed case, not an edge
 * case. It does not clamp noise on the POSITIVE side (e.g. `1e-16` from a
 * different step ordering), so a value can still arrive here a hair above
 * zero. Found by adversarial review, round 107, RUNBOOK.md: this component's
 * `Math.max(6, …)` visibility floor — added so a genuinely small nonzero bar
 * stays visible — did not carve out true zero, so a value the label above it
 * showed as "$0" still drew a bar with real height, contradicting its own
 * label on exactly the story beat ("spend it down to zero") this feature was
 * built to narrate correctly.
 */
const ZERO_EPSILON = 1e-9;

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

  /**
   * The SAME per-bar time-step caption a sighted user reads under each bar
   * ("Start" / "Week 1" / "Week 2"…) — shared with the visual render below
   * rather than recomputed, so the two can never drift apart.
   *
   * Found by adversarial review (RUNBOOK.md Round 101): the aria-label was
   * built from `board.values` alone, so a screen-reader user heard a bare
   * "10, 18, 26" with no notion these were week-by-week totals, while a
   * sighted user saw the full "Start / Week 1 / Week 2" story the `unit`
   * field (§20.5) was added specifically to guarantee. The caption is exactly
   * what makes the board answer "what story is this", so leaving it out of
   * the accessible name loses the one thing this feature exists to convey.
   */
  const captionFor = (i: number) =>
    i === 0 ? t('tutor.whiteboard.start') : t(`tutor.whiteboard.step.${board.unit}`, { n: i });

  return (
    <>
      {/*
        THE MISSING LIVE ANNOUNCEMENT (round 101, HIGH — review sweep
        tutor-review-sweep-101, whiteboard-at-scale dimension). Until this
        round, the ONLY accessibility surface this component had was the
        static `aria-label` below, and an `aria-label` mutating on a node
        that is neither removed nor re-inserted is not reliably announced by
        assistive tech — a screen-reader user who had already met the board
        once got no notice that a NEW turn had redrawn the SAME node with
        new values. That is exactly the "something changed, tell the
        assistive-tech user" event this codebase already has a convention
        for: `LiveSegmentPanel.tsx`'s round-87 fix, a `key`-remounted
        `role="status" aria-live="polite"` span, announcing an activity's
        arrival regardless of breakpoint.

        `key={seq}` reuses the SAME turn-boundary signal the growth
        animation above already resets on (`seq` is bumped once per turn
        specifically so the same board never re-plays for an unrelated
        re-render) — giving the identical guarantee `LiveSegmentPanel` gets
        from `live.segmentId`: announce once per genuinely NEW board, never
        on a re-render of the one already on screen.

        Deliberately a SIBLING of the `role="img"` node below, not a
        descendant of it — an element with `role="img"` presents its
        subtree to assistive tech as the image's own replaced content,
        which would swallow a nested live region rather than let it
        announce on its own.

        Deliberately a GENERIC message, not the board's own label/values —
        that content is owned by a sibling fix to the `aria-label` below
        (this round's scope is the missing MECHANISM only). `LiveSegmentPanel`
        took the identical posture in round 87: its live region announces
        "an activity is ready," never the activity's own prompt text.
      */}
      <span key={seq} role="status" aria-live="polite" className="sr-only">
        {t('tutor.whiteboard.updated')}
      </span>
      <div
        data-tutor-whiteboard
        role="img"
        aria-label={`${board.label}. ${board.values
          .slice(0, shown)
          .map((value, i) => `${captionFor(i)}: ${format(value)}`)
          .join(', ')}`}
        className={cn('flex min-h-0 flex-col gap-3', className)}
      >
        <p className="lf-caption shrink-0 text-content-muted">{board.label}</p>
        <div className="flex min-h-0 flex-1 items-end gap-2 overflow-x-auto px-1 pb-1">
          {board.values.map((value, i) => {
            const grown = i < shown;
            const heightPct = value <= ZERO_EPSILON ? 0 : Math.max(6, Math.round((value / max) * 100));
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
                  {captionFor(i)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
