import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/*
 * The tutor's words, ABOVE the character's head.
 *
 * This is an accessibility requirement, not decoration (/ORACLE.md §1 step 4).
 * A deaf or hard-of-hearing learner must get the whole lesson, and a caption
 * that lives in a side panel makes them choose between watching the character
 * and reading what it said. Above the head, they are the same glance.
 *
 * IT IS AN HTML OVERLAY, NOT SCENE GEOMETRY. Text inside WebGL is a font-atlas
 * problem — glyph coverage for three locales, hinting, subpixel rendering,
 * scaling with the camera — and none of it buys anything here, because the
 * caption is always facing the viewer anyway. An absolutely-positioned div
 * over the canvas gets real text rendering, real text selection, real screen
 * reader output and real i18n for free.
 *
 * The typewriter reveal is capped and interruptible: a caption that is still
 * typing when the next line arrives would fall behind the audio and stay
 * behind for the rest of the session.
 */

export interface SpeechCaptionProps {
  text: string | null;
  /** Bump when a NEW line starts, so the same text can replay. */
  turnSeq: number;
  className?: string;
  /** Skips the reveal animation. Respected from prefers-reduced-motion too. */
  instant?: boolean;
}

/** Fast enough to keep up with speech, slow enough to read as "being said". */
const CHARS_PER_TICK = 2;
const TICK_MS = 24;

export function SpeechCaption({ text, turnSeq, className, instant = false }: SpeechCaptionProps) {
  const [shown, setShown] = useState('');
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    if (!text) {
      setShown('');
      return;
    }

    const reduced =
      instant ||
      (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    if (reduced) {
      setShown(text);
      return;
    }

    let index = 0;
    setShown('');
    timerRef.current = window.setInterval(() => {
      index += CHARS_PER_TICK;
      setShown(text.slice(0, index));
      if (index >= text.length && timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }, TICK_MS);

    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
    // turnSeq is in the deps on purpose: the same sentence said twice must
    // replay, and text alone would not change.
  }, [text, turnSeq, instant]);

  if (!text) return null;

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center px-4 pt-4 sm:pt-6',
        className,
      )}
    >
      <p
        /*
         * aria-live="polite" and the FULL text, not the typewriter slice: a
         * screen reader must announce the sentence once, when it is complete,
         * not stutter through it two characters at a time.
         */
        aria-live="polite"
        aria-atomic="true"
        className="lf-glass lf-body max-w-[46ch] rounded-lg px-4 py-2.5 text-center text-content shadow-glass-sm sm:max-w-[56ch]"
      >
        <span aria-hidden="true">{shown}</span>
        <span className="sr-only">{text}</span>
      </p>
    </div>
  );
}
