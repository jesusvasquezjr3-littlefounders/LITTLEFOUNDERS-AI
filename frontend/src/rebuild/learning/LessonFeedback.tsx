import { useEffect, type ReactNode } from 'react';
import { Banner, type NoticeTone } from '../design/controls';
import { playLessonCue } from './lessonCue';

export type LessonFeedbackVerdict = 'met' | 'review' | 'invalid' | 'incomplete' | 'unavailable';

const tone: Record<LessonFeedbackVerdict, NoticeTone> = { met: 'success', review: 'retry', invalid: 'retry', incomplete: 'retry', unavailable: 'error' };

/**
 * The lesson foot's feedback row (02 §9.2) on the shared `Banner`: a correct
 * answer is the success banner, "not yet" is warning gold with a cross (never
 * the error hue, never a penalty), and only a failed check is an error. The
 * status region stays mounted, so every verdict is announced exactly once.
 * A correct answer and a "not yet" each play their short cue as the verdict
 * arrives (OD-28: the gentle not-yet sound); the words carry the meaning.
 */
export function LessonFeedback({ verdict, children }: { verdict: LessonFeedbackVerdict | null; children?: ReactNode }) {
  const shown = verdict && children ? verdict : null;
  useEffect(() => {
    if (shown === 'met' || shown === 'review') playLessonCue(shown);
  }, [shown]);
  return <div role="status" className={verdict ? `lf-learning-feedback lf-learning-feedback--${verdict}` : 'lf-learning-feedback'}>
    {verdict && children ? <Banner tone={tone[verdict]} live={false}>{children}</Banner> : null}
  </div>;
}
