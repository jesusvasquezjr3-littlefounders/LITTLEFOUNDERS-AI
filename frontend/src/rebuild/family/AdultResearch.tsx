import { useId, useState } from 'react';
import { Button, Copy, InlineNotice } from '../design/controls';
import type { Research } from './governanceApi';
import '../design/tokens.css';
import '../design/system.css';
import './familyHub.css';
import './familyGovernance.css';

/*
 * GAP-FIX-R2 (owner review H-25, D.22, OD-9 section 4.2): research in an
 * adult's own Settings. A Tutor's yes for a child lapses at 18 and nothing more
 * is recorded; the young adult is asked once, in one short sentence, with the
 * same disclosure the Tutor read, and answers Yes or No. Nothing is
 * preselected: both are plain buttons and neither is the default. Yes records
 * the adult's own grant (Core: family.research_yes_self); No deletes every
 * snapshot at once. An adult already taking part on their own yes sees that
 * and can stop (asked once). Everyone else sees nothing: Core and the
 * database decide who may answer (family_research_set_consent).
 * Adult register (B.23): direct, the choice first.
 */

export interface AdultResearchCopy {
  heading: string; lapsed: string; ask: string; what: string; how: string; yes: string; no: string;
  self: string; stopButton: string; confirm: string; confirmYes: string; confirmNo: string; joined: string; deleted: string; failed: string;
}

export function AdultResearch({ copy, locale, dark, research, busy, notice, onAnswer }: {
  copy: AdultResearchCopy;
  locale: string;
  dark: boolean;
  research: Research | null;
  busy: boolean;
  notice: { text: string; error: boolean } | null;
  onAnswer: (participate: boolean) => void;
}) {
  const heading = useId();
  const [confirming, setConfirming] = useState(false);
  const lapsed = Boolean(research?.lapsed);
  const self = Boolean(research?.participating && research.grantor === 'self' && research.adult);
  if (!notice && !lapsed && !self) return null;
  return <section className="lf-rebuild lf-family-hub lf-governance" data-governance="adult-research" data-research-state={lapsed ? 'lapsed' : self ? 'self' : 'done'}
    data-theme={dark ? 'dark' : 'light'} lang={locale} aria-labelledby={heading}>
    <h2 id={heading} className="lf-governance-tip-title" data-copy-role="heading">{copy.heading}</h2>
    {notice && <InlineNotice tone={notice.error ? 'error' : 'success'} live>{notice.text}</InlineNotice>}
    {lapsed && <>
      <Copy role="body">{copy.lapsed}</Copy>
      <Copy role="body">{copy.what}</Copy>
      <Copy role="body">{copy.how}</Copy>
      <p data-copy-role="prompt">{copy.ask}</p>
      <div className="lf-family-hub-actions" data-research="ask">
        <Button disabled={busy} onClick={() => onAnswer(true)}>{copy.yes}</Button>
        <Button disabled={busy} onClick={() => onAnswer(false)}>{copy.no}</Button>
      </div>
    </>}
    {self && <>
      <Copy role="body">{copy.self}</Copy>
      {confirming ? <div className="lf-governance-reflection" data-research="confirm">
        <p data-copy-role="prompt">{copy.confirm}</p>
        <div className="lf-family-hub-actions">
          <Button variant="accent" disabled={busy} onClick={() => { setConfirming(false); onAnswer(false); }}>{copy.confirmYes}</Button>
          <Button disabled={busy} onClick={() => setConfirming(false)}>{copy.confirmNo}</Button>
        </div>
      </div> : <div className="lf-family-hub-actions"><Button disabled={busy} onClick={() => setConfirming(true)}>{copy.stopButton}</Button></div>}
    </>}
  </section>;
}
