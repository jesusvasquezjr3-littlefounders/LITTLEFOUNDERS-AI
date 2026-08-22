import { useEffect, useRef } from 'react';
import { CharacterActor } from '@/components/characters/control/CharacterActor';
import type { CharacterAction, CharacterEmotion, CharacterId } from '@/components/characters/control/types';
import { cn } from '@/lib/utils';

/*
 * The 2D chat bubble: the character's head, articulating, beside the line it is
 * saying right now, and the running transcript of everything before it.
 *
 * WHY THIS EXISTS ALONGSIDE THE 3D STAGE, rather than instead of it. Two
 * reasons, and the second is the one that decided it:
 *
 * 1. A transcript is the accessible spine of the whole feature. The caption
 *    above the head gives the CURRENT line; this gives everything that was
 *    said, in order, scrollable and selectable.
 * 2. `liruf` and `dina` have no mouth in 3D — TUTOR_3D.md §3.1 closed that
 *    after exhausting six techniques. All four are selectable as the speaking
 *    tutor (owner decision 4), so for two of them the ONLY articulating mouth
 *    in the product is the 2D one, right here. `CharacterActor` already takes
 *    `speaking` and the SVGs animate their own mouths from it.
 *
 * THE SAME LINE THEREFORE APPEARS TWICE ON PURPOSE, above the head in the world
 * and here in the bubble. That is the owner's accessibility decision, not
 * redundancy to be tidied away: the caption is where a learner watching the
 * character reads, the bubble is where a learner watching the mouth reads, and
 * for two of the four characters the bubble is the only mouth there is.
 *
 * THE TWO HALVES ARE SEPARATELY MOUNTABLE. `TutorBubble` is the head and the
 * current line; `TutorTranscript` is the log. They ship as one component for
 * callers that want the whole thing in one place, and as two for the live
 * session, where the activity has to sit BETWEEN them: the tutor speaks, hands
 * over an exercise, and the history belongs underneath both rather than wedged
 * between a character and the thing it just asked for.
 */

export interface TranscriptEntry {
  speaker: 'learner' | 'tutor';
  text: string;
  seq: number;
}

export interface TutorBubbleProps {
  character: CharacterId;
  emotion: CharacterEmotion;
  action: CharacterAction;
  /** Bump to replay the same one-shot action twice in a row. */
  actionKey: number;
  speaking: boolean;
  history: TranscriptEntry[];
  /**
   * The line being said right now. Falls back to the last thing the tutor said,
   * so a caller holding only a transcript still gets a bubble with words in it.
   */
  line?: string | null;
  /**
   * Render the running transcript under the bubble.
   *
   * Defaults to true, which keeps every existing caller whole. The live session
   * passes false and mounts `TutorTranscript` itself, lower down.
   */
  transcript?: boolean;
  /** Accessible name for the bubble region. */
  label?: string;
  className?: string;
}

export function TutorBubble({
  character,
  emotion,
  action,
  actionKey,
  speaking,
  history,
  line,
  transcript = true,
  label,
  className,
}: TutorBubbleProps) {
  const spoken = line ?? lastTutorLine(history);

  return (
    <section aria-label={label} className={cn('flex min-h-0 flex-col gap-3', className)}>
      <div className="flex items-start gap-3">
        <div className="h-14 w-14 shrink-0 sm:h-16 sm:w-16">
          <CharacterActor
            character={character}
            emotion={emotion}
            action={action}
            actionKey={actionKey}
            speaking={speaking}
            size="fill"
            // Off inside a lesson: the per-frame mouse-follow loop is charm on
            // a marketing page and a distraction when a child is thinking.
            enableMouseTracking={false}
          />
        </div>

        {/*
          NOT a live region. The caption over the character's head is already
          `aria-live="polite"` for exactly this sentence, and two live regions
          carrying one line make a screen reader say everything twice. This is
          the VISUAL mirror; the announcement belongs to the caption.
        */}
        <p className="lf-body min-w-0 flex-1 rounded-lg rounded-tl-sm bg-surface-sunken px-3 py-2 text-content">
          {spoken}
          {speaking && (
            // A speaking indicator with no text of its own, so it cannot be
            // read out as punctuation in the middle of the tutor's sentence.
            <span aria-hidden="true" className="ml-1 align-middle text-content-muted">
              •••
            </span>
          )}
        </p>
      </div>

      {transcript && <TutorTranscript history={history} />}
    </section>
  );
}

export interface TutorTranscriptProps {
  history: TranscriptEntry[];
  /** Accessible name for the log. */
  label?: string;
  className?: string;
}

/**
 * Everything said so far, oldest first, pinned to the bottom.
 *
 * Its own scroller rather than a run of text inside the plate's, because a log
 * that grows without bound would push the activity off the bottom of a 62vh
 * plate after a dozen turns, and the activity is the thing the learner is
 * actually working on.
 */
export function TutorTranscript({ history, label, className }: TutorTranscriptProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    // Jump rather than smooth-scroll: a new line arriving mid-animation while
    // the learner is reading an older one yanks the view twice.
    node.scrollTop = node.scrollHeight;
  }, [history.length]);

  if (history.length === 0) return null;

  return (
    <div
      ref={scrollRef}
      aria-label={label}
      className={cn('max-h-48 min-h-0 space-y-2 overflow-y-auto overscroll-contain pr-1', className)}
      // The transcript is a log: announce additions, but do not steal focus
      // from whatever the learner is doing in the activity panel. It is also
      // the ONLY announcement a learner's own transcribed speech ever gets,
      // which is how they find out what the microphone actually heard.
      aria-live="polite"
      aria-relevant="additions"
    >
      {history.map((entry, index) => (
        <p
          key={`${entry.seq}-${index}`}
          className={cn(
            'lf-body max-w-[92%] rounded-md px-3 py-2',
            entry.speaker === 'tutor'
              ? 'bg-surface-sunken text-content'
              : 'ml-auto bg-accent-soft text-content',
          )}
        >
          {entry.text}
        </p>
      ))}
    </div>
  );
}

function lastTutorLine(history: TranscriptEntry[]): string {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index];
    if (entry && entry.speaker === 'tutor') return entry.text;
  }
  return '';
}
