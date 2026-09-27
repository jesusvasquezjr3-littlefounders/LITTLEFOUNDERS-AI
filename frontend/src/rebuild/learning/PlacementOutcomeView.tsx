import { useId, type Ref } from 'react';
import type { Locale } from '../design/copyBudget';
import { Button } from '../design/controls';
import { placementFrameSchema, placementOutcomeCopy, placementOutcomeLines } from './placementOutcome';
import './placementOutcome.css';

/**
 * B.15 (S05.3d): the rebuilt placement outcome. It renders only Core's closed
 * frame (`framing` on the placement result) and never a score, a count of
 * right answers or a comparison. A malformed frame shows a neutral state with
 * the one action that still makes sense: start.
 *
 * `PlacementOutcomeBody` is the outcome itself (heading, the two framing
 * lines, the actions); the placement flow (W2L.2) mounts it inside its own
 * single-state screen, and `PlacementOutcomeView` is the standalone page the
 * preview shows.
 */
export function PlacementOutcomeBody({ rawFrame, locale, onStart, onEarlier, headingId, headingRef, note = null, brief = false, pending = false, pendingLabel }: {
  rawFrame: unknown;
  locale: Locale;
  onStart: () => void;
  /** Offered only when the path starts further in and the quiz, not the learner, chose it. */
  onEarlier?: () => void;
  headingId?: string;
  headingRef?: Ref<HTMLHeadingElement>;
  /** A plain fact that replaces the growth line (the start stopped before a topic with an unmet prerequisite). */
  note?: string | null;
  /** Only the basis line: something else on the screen needs the words (a save to try again, 06 §3.1). */
  brief?: boolean;
  /** The start is being saved: both actions wait, the chosen one says so. */
  pending?: boolean;
  pendingLabel?: string;
}) {
  const parsed = placementFrameSchema.safeParse(rawFrame);
  const t = placementOutcomeCopy[locale];
  if (!parsed.success) return <>
    <h1 id={headingId} ref={headingRef} tabIndex={-1} data-copy-role="heading">{t.unavailable}</h1>
    <div className="lf-actions"><Button variant="accent" pending={pending} pendingLabel={pendingLabel} onClick={onStart}>{t.start}</Button></div>
  </>;
  const frame = parsed.data;
  const { title, lines } = placementOutcomeLines(frame, locale);
  const shown = brief ? [lines[0]!] : note && !frame.learner_chosen ? [lines[0]!, note] : lines;
  return <>
    <h1 id={headingId} ref={headingRef} tabIndex={-1} data-copy-role="heading">{title}</h1>
    <div className="lf-placement-outcome-card">
      {shown.map((line) => <p key={line} data-copy-role="body">{line}</p>)}
    </div>
    <div className="lf-actions">
      <Button variant="accent" pending={pending} pendingLabel={pendingLabel} onClick={onStart}>{t.start}</Button>
      {frame.start === 'further_in' && !frame.learner_chosen && onEarlier ? <Button disabled={pending} onClick={onEarlier}>{t.earlier}</Button> : null}
    </div>
  </>;
}

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
  return <main className="lf-rebuild lf-placement-outcome" data-theme={dark ? 'dark' : 'light'} lang={locale} data-surface="app" aria-labelledby={headingId}
    data-screen={!parsed.success ? 'placement-outcome-unavailable' : fixture ? 'placement-outcome-preview' : 'placement-outcome'} data-start={parsed.success ? parsed.data.start : undefined}>
    <div className="lf-placement-outcome-inner">
      <PlacementOutcomeBody rawFrame={rawFrame} locale={locale} onStart={onStart} onEarlier={onEarlier} headingId={headingId} />
    </div>
  </main>;
}
