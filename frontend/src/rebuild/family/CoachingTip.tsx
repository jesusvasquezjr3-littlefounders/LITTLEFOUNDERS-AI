import { useId, useState } from 'react';
import { Button, Copy, InlineNotice } from '../design/controls';
import type { CoachingTip as Tip, TipId } from './governanceApi';
import '../design/tokens.css';
import '../design/system.css';
import './familyHub.css';
import './familyGovernance.css';

/*
 * S07.7 (D.23), the Tutor's monthly tip. One short tip a month, drawn from
 * Appendix G's findings and delivered only after the Pedagogical Lead's
 * review (Core passes the database reviewed tips only). The "why" is layered
 * behind a button and says plainly that it is a research finding, not a
 * promise (Block D Part 4: nothing here is marketed as proven). Hiding the
 * tip records it; nothing celebrates. Adult band copy.
 */

export interface CoachingCopy { label: string; why: string; whyNote: string; dismiss: string; failed: string }
export type TipCopy = Record<TipId, { title: string; body: string; why: string }>;

export function CoachingTip({ copy, tips, locale, dark, tip, failed, busy, onOpen, onDismiss }: {
  copy: CoachingCopy;
  tips: TipCopy;
  locale: string;
  dark: boolean;
  tip: Tip | null;
  failed: boolean;
  busy: boolean;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const heading = useId();
  const [why, setWhy] = useState(false);
  if (failed) {
    return <section className="lf-rebuild lf-family-hub lf-governance" data-governance="coaching" data-theme={dark ? 'dark' : 'light'} lang={locale} aria-label={copy.label}>
      <InlineNotice tone="error" live>{copy.failed}</InlineNotice>
    </section>;
  }
  // No reviewed tip, or the Tutor hid this month's: nothing to show.
  if (!tip || tip.dismissed) return null;
  const text = tips[tip.tipId];
  return <section className="lf-rebuild lf-family-hub lf-governance" data-governance="coaching" data-tip={tip.tipId} data-theme={dark ? 'dark' : 'light'}
    lang={locale} aria-labelledby={heading}>
    <div className="lf-governance-tip">
      <span className="lf-governance-label" data-copy-role="data">{copy.label}</span>
      <h2 id={heading} className="lf-governance-tip-title" data-copy-role="heading">{text.title}</h2>
      <Copy role="body">{text.body}</Copy>
      {why && <div className="lf-governance-why" data-governance-part="why">
        <Copy role="body">{text.why}</Copy>
        <p className="lf-family-hub-muted" data-copy-role="body">{copy.whyNote}</p>
      </div>}
      <div className="lf-family-hub-actions">
        {!why && <Button disabled={busy} aria-expanded={false} onClick={() => { setWhy(true); if (!tip.opened) onOpen(); }}>{copy.why}</Button>}
        <Button disabled={busy} onClick={onDismiss}>{copy.dismiss}</Button>
      </div>
    </div>
  </section>;
}
