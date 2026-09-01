import { useEffect, useRef } from 'react';
import { Icon } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useScrollEdges } from './hud/useScrollEdges';

/*
 * The running transcript: everything that has been said, in order.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * THIS FILE USED TO BE `TutorBubble.tsx`, AND THE BUBBLE IS GONE — 2026-08-22.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The bubble was the character's 2D head beside the line it was saying right
 * now, mounted on the lesson plate. It existed for two stated reasons, and both
 * of them moved rather than died (/DESIGN.md §Lumen → *One line, one printing,
 * two channels*):
 *
 * 1. THE ARTICULATING MOUTH. `liruf` and `dina` have none in 3D (/TUTOR_3D.md
 *    §3.1) and all four are selectable as the tutor (/ORACLE.md §0 decision 4),
 *    so for half the cast the 2D mouth is the only one there is. It is now
 *    `TutorFace`, mounted in the caption over the speaker's crown — bigger,
 *    cropped to the head, and beside the words instead of 252 px below them.
 *    Measured before the move: the bubble's actor box was 64x64 CSS px holding
 *    a whole standing figure, which put Dr Rho's mouth at about five pixels.
 * 2. THE ACCESSIBLE SPINE. That is this component, and it stays exactly as it
 *    was.
 *
 * What did NOT survive is the bubble printing the tutor's live sentence a
 * second time. At 1280x800 the same 21 words stood in the caption and in the
 * bubble at once — 142 words on screen for 21 being said — while the exercise
 * they introduced ran 274 px past the bottom of the plate. Two channels was the
 * owner's requirement and it is still met; two PRINTINGS was never the
 * requirement, and it was costing the activity the room to be answered in.
 */

export interface TranscriptEntry {
  speaker: 'learner' | 'tutor';
  text: string;
  seq: number;
}

export interface TutorTranscriptProps {
  history: TranscriptEntry[];
  /**
   * The `seq` of a tutor turn that is ALREADY on screen somewhere else.
   *
   * THE LINE BEING SAID RIGHT NOW BELONGS TO THE CAPTION. A log's job is the
   * past; a log that also carries the present is a log catching up with itself,
   * and it was the third printing of one sentence before the bubble became the
   * second. It reappears here the moment the tutor says anything else, which is
   * exactly when it becomes history.
   *
   * A learner's own turn always stays: nothing else on screen shows them what
   * the microphone actually heard.
   */
  spokenSeq?: number | null;
  /**
   * The activity has the plate, and the log yields to it.
   *
   * WHY THIS IS A PROP AND NOT A CONSTANT. The log is one of two things
   * depending on what else is on the plate. With no activity up, the
   * conversation IS the plate and the log should have the room. With an
   * exercise up, the learner is answering a question, and a 192 px log below it
   * was the difference between a `Check` control on screen and a `Check`
   * control 15 px past the bottom edge (measured at 1280x800 in es-MX). It is
   * capped rather than hidden, because it is a live region and it is the only
   * announcement a learner's own transcribed speech ever gets — collapsing it
   * would take that away at the exact moment they are talking to the tutor
   * about an exercise.
   */
  compact?: boolean;
  /** Accessible name for the log. */
  label?: string;
  /**
   * Rephrase the learner's LAST message. When set, the newest learner entry
   * grows a small edit control that hands its text back to the composer —
   * only the last, because the wire's edit verb rewinds exactly one exchange
   * and an affordance the protocol cannot honour is a lie with an icon.
   */
  onEditLast?: (text: string) => void;
  /** Accessible name for that control. Required whenever `onEditLast` is set. */
  editLabel?: string;
  className?: string;
}

/**
 * Everything said so far, oldest first, pinned to the bottom.
 *
 * Its own scroller rather than a run of text inside the plate's, because a log
 * that grows without bound would push the activity off the bottom of the plate
 * after a dozen turns, and the activity is the thing the learner is actually
 * working on.
 */
export function TutorTranscript({
  history,
  spokenSeq = null,
  compact = false,
  label,
  onEditLast,
  editLabel,
  className,
}: TutorTranscriptProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // A log that is scrolled to its newest row has older ones above it, and the
  // top row is cut mid-line. The edge says so rather than leaving it looking
  // like a rendering seam.
  useScrollEdges(scrollRef);

  const past =
    spokenSeq === null
      ? history
      : history.filter((entry) => !(entry.speaker === 'tutor' && entry.seq === spokenSeq));

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    // Jump rather than smooth-scroll: a new line arriving mid-animation while
    // the learner is reading an older one yanks the view twice.
    node.scrollTop = node.scrollHeight;
  }, [history.length]);

  // Pinned to the bottom, so shrinking the box shows the NEWEST rows and never
  // the oldest. Re-run on the cap as well as on the history, or a log that was
  // already at the bottom stays scrolled to a position that no longer is.
  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [compact]);

  if (past.length === 0) return null;

  // The one entry the edit affordance may attach to (see `onEditLast`).
  // Hand-rolled reverse scan: the build targets ES2022, before findLastIndex.
  let lastLearnerIndex = -1;
  for (let i = past.length - 1; i >= 0; i -= 1) {
    if (past[i]?.speaker === 'learner') {
      lastLearnerIndex = i;
      break;
    }
  }

  return (
    <div
      className={cn(
        'lf-scroll-edge flex min-h-0 flex-col',
        /*
         * Two rows of conversation against as much as the plate has spare.
         * `max-h-24` is deliberately not one row: a single row shows an answer
         * with no question above it.
         *
         * `flex-auto` and not a second fixed cap when there is no activity: the
         * plate's body is a flex COLUMN (`LessonPlate` -> `bodyLayout`), so with
         * nothing else claiming the height this log is the one child that takes
         * it and scrolls. `flex-auto` rather than `flex-1`, because the plate is
         * fitted to its content on desktop and a `flex-basis: 0` child in an
         * auto-height column is asking the container to size against zero.
         *
         * AND WHEN IT IS COMPACT IT YIELDS FIRST, which is what the enormous
         * shrink factor is for. Flexbox distributes a shortfall in proportion to
         * each item's base size, so with the ordinary factor of 1 a 96 px log
         * next to a 550 px exercise absorbed a seventh of the squeeze and the
         * exercise took the rest — measured at 1280x800, six activity types that
         * fitted whole before this log existed were scrolling by 15 to 41 px
         * because of it. At 999 the log gives up essentially all of it, down to
         * nothing if the exercise needs the whole plate. It never disappears in
         * the sense that matters: it stays mounted, so the live region still
         * announces the learner's own transcribed speech, and it comes back the
         * moment the activity is graded.
         */
        compact ? 'max-h-24 shrink-[999]' : 'flex-auto',
        className,
      )}
    >
      <div
        ref={scrollRef}
        // `role="log"` before `aria-label`, not incidental: axe-core's own
        // `aria-prohibited-attr` rule flags `aria-label` on a bare `<div>` as
        // "not well supported" — a role-less generic element has no ARIA node
        // some assistive tech guarantees to expose a name for. `log` is also
        // the semantically CORRECT role for this element regardless (a region
        // where new items append in order and old ones may scroll away, which
        // is exactly what a conversation transcript is), so this is not a
        // workaround bolted on to satisfy a linter — it names what the div
        // already does. `log` also implies `aria-live="polite"`, kept
        // explicit anyway so the behaviour does not depend on a browser
        // correctly inferring it from the role.
        role="log"
        aria-label={label}
        // Found by an axe-core re-run, 2026-09-01 (ORACLE.md §16.1, "re-run
        // axe before launch"): a scrollable region with no focusable
        // descendant (no activity in play, or a learner who has not yet
        // pressed the edit affordance) was reachable by mouse wheel or touch
        // but never by keyboard — `scrollable-region-focusable`. `tabIndex=0`
        // puts it in the tab order without taking focus on mount, so arrow
        // keys / Page Up / Page Down scroll it exactly as a mouse would.
        tabIndex={0}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1"
        // The transcript is a log: announce additions, but do not steal focus
        // from whatever the learner is doing in the activity panel. It is also
        // the ONLY announcement a learner's own transcribed speech ever gets,
        // which is how they find out what the microphone actually heard.
        aria-live="polite"
        aria-relevant="additions"
      >
        {past.map((entry, index) => {
          const editable =
            onEditLast !== undefined &&
            entry.speaker === 'learner' &&
            index === lastLearnerIndex;
          return (
            <div
              key={`${entry.seq}-${index}`}
              className={cn(
                'flex max-w-[92%] items-end gap-1',
                entry.speaker === 'learner' && 'ml-auto flex-row-reverse',
              )}
            >
              <p
                className={cn(
                  'lf-body min-w-0 rounded-md px-3 py-2',
                  entry.speaker === 'tutor'
                    ? 'bg-surface-sunken text-content'
                    : 'bg-accent-soft text-content',
                )}
              >
                {entry.text}
              </p>
              {editable && (
                <button
                  type="button"
                  onClick={() => onEditLast(entry.text)}
                  aria-label={editLabel}
                  title={editLabel}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-content-muted transition-colors hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Icon name="edit" className="!text-[16px]" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
