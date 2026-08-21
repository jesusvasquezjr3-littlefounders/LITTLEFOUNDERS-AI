import { useEffect, useRef } from 'react';
import { CharacterActor } from '@/components/characters/control/CharacterActor';
import type { CharacterAction, CharacterEmotion, CharacterId } from '@/components/characters/control/types';
import { cn } from '@/lib/utils';

/*
 * The 2D chat rail: the character's head, articulating, beside a running
 * transcript of the conversation.
 *
 * WHY THIS EXISTS ALONGSIDE THE 3D STAGE, rather than instead of it. Two
 * reasons, and the second is the one that decided it:
 *
 * 1. A transcript is the accessible spine of the whole feature. Captions above
 *    the head give the CURRENT line; this gives everything that was said, in
 *    order, scrollable and selectable.
 * 2. `liruf` and `dina` have no mouth in 3D — TUTOR_3D.md §3.1 closed that
 *    after exhausting six techniques. All four are selectable as the speaking
 *    tutor (owner decision 4), so for two of them the ONLY articulating mouth
 *    in the product is the 2D one, right here. `CharacterActor` already takes
 *    `speaking` and the SVGs animate their own mouths from it.
 */

export interface TutorBubbleProps {
  character: CharacterId;
  emotion: CharacterEmotion;
  action: CharacterAction;
  /** Bump to replay the same one-shot action twice in a row. */
  actionKey: number;
  speaking: boolean;
  history: { speaker: 'learner' | 'tutor'; text: string; seq: number }[];
  className?: string;
}

export function TutorBubble({
  character,
  emotion,
  action,
  actionKey,
  speaking,
  history,
  className,
}: TutorBubbleProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    // Jump rather than smooth-scroll: a new line arriving mid-animation while
    // the learner is reading an older one yanks the view twice.
    node.scrollTop = node.scrollHeight;
  }, [history.length]);

  return (
    <div className={cn('flex min-h-0 flex-col gap-3', className)}>
      <div className="flex items-end gap-3">
        <div className="h-16 w-16 shrink-0 sm:h-20 sm:w-20">
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
        <p className="lf-caption text-content-muted">
          {speaking ? '•••' : ''}
        </p>
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1"
        // The transcript is a log: announce additions, but do not steal focus
        // from whatever the learner is doing in the activity panel.
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
    </div>
  );
}
