import type { ReactNode } from 'react';
import { Banner, type NoticeTone } from '../design/controls';

export type LessonFeedbackVerdict = 'met' | 'review' | 'invalid' | 'incomplete' | 'unavailable';

const tone: Record<LessonFeedbackVerdict, NoticeTone> = { met: 'success', review: 'retry', invalid: 'retry', incomplete: 'retry', unavailable: 'error' };

/**
 * The lesson foot's feedback row (02 §9.2) on the shared `Banner`: a correct
 * answer is the success banner, "not yet" is warning gold with a cross (never
 * the error hue, never a penalty), and only a failed check is an error. The
 * status region stays mounted, so every verdict is announced exactly once.
 */
export function LessonFeedback({ verdict, children }: { verdict: LessonFeedbackVerdict | null; children?: ReactNode }) {
  return <div role="status" className={verdict ? `lf-learning-feedback lf-learning-feedback--${verdict}` : 'lf-learning-feedback'}>
    {verdict && children ? <Banner tone={tone[verdict]} live={false}>{children}</Banner> : null}
  </div>;
}
