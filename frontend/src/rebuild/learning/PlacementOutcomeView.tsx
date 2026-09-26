import { useId } from 'react';
import type { Locale } from '../design/copyBudget';
import { Button } from '../design/controls';
import { placementFrameSchema, placementOutcomeCopy, placementOutcomeLines } from './placementOutcome';
import './placementOutcome.css';

/**
 * B.15 (S05.3d): the rebuilt placement outcome. It renders only Core's closed
 * frame (`framing` on the placement result) and never a score, a count of
 * right answers or a comparison. A malformed frame shows a neutral state with
 * the one action that still makes sense: start.
 */
export function PlacementOutcomeView({ rawFrame, locale, dark, onStart, onEarlier, fixture = false }: {
  rawFrame: unknown;
  locale: Locale;
  dark: boolean;
  onStart: () => void;
  /** Offered only when the path starts further in and the quiz, not the learner, chose it. */
  onEarlier?: () => void;
  fixture?: boolean;
}) {
  const headingId = useId();
  const parsed = placementFrameSchema.safeParse(rawFrame);
  const t = placementOutcomeCopy[locale];
  const host = { className: 'lf-rebuild lf-placement-outcome', 'data-theme': dark ? 'dark' : 'light', lang: locale, 'data-surface': 'app',
    'aria-labelledby': headingId } as const;
  if (!parsed.success) return <main {...host} data-screen="placement-outcome-unavailable">
    <div className="lf-placement-outcome-inner"><h1 id={headingId} data-copy-role="heading">{t.unavailable}</h1>
      <div className="lf-actions"><Button variant="accent" onClick={onStart}>{t.start}</Button></div></div>
  </main>;
  const frame = parsed.data;
  const { title, lines } = placementOutcomeLines(frame, locale);
  return <main {...host} data-screen={fixture ? 'placement-outcome-preview' : 'placement-outcome'} data-start={frame.start}>
    <div className="lf-placement-outcome-inner">
      <h1 id={headingId} data-copy-role="heading">{title}</h1>
      <div className="lf-placement-outcome-card">
        {lines.map((line) => <p key={line} data-copy-role="body">{line}</p>)}
      </div>
      <div className="lf-actions">
        <Button variant="accent" onClick={onStart}>{t.start}</Button>
        {frame.start === 'further_in' && !frame.learner_chosen && onEarlier ? <Button onClick={onEarlier}>{t.earlier}</Button> : null}
      </div>
    </div>
  </main>;
}
