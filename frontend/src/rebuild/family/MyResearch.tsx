import { useId, useState } from 'react';
import { Button, Copy, InlineNotice } from '../design/controls';
import type { Research } from './governanceApi';
import '../design/tokens.css';
import '../design/system.css';
import './familyHub.css';
import './familyGovernance.css';

/*
 * S07.7 (D.22), the participant's own view. A child whose Tutor said yes to
 * research is told so in their own words and can say no themselves: the
 * database accepts the participant's own no and deletes every snapshot at
 * once. Nothing shows for a child who is not taking part. Written to the
 * youngest band (6-9); it asks once before stopping.
 */

export interface MyResearchCopy { heading: string; body: string; stop: string; button: string; confirm: string; yes: string; no: string; stopped: string; failed: string }

export function MyResearch({ copy, locale, dark, research, busy, notice, onStop }: {
  copy: MyResearchCopy;
  locale: string;
  dark: boolean;
  research: Research | null;
  busy: boolean;
  notice: { text: string; error: boolean } | null;
  onStop: () => void;
}) {
  const heading = useId();
  const [confirming, setConfirming] = useState(false);
  // An adult's answer (H-25, the re-consent at 18) lives in their own Settings (AdultResearch), never here.
  if (research?.adult && !notice) return null;
  if (!notice && (!research || !research.participating)) return null;
  return <section className="lf-rebuild lf-family-hub lf-governance" data-governance="my-research" data-theme={dark ? 'dark' : 'light'} lang={locale} aria-labelledby={heading}>
    <h2 id={heading} className="lf-governance-tip-title" data-copy-role="heading">{copy.heading}</h2>
    {notice && <InlineNotice tone={notice.error ? 'error' : 'success'} live>{notice.text}</InlineNotice>}
    {research?.participating && <>
      <Copy role="body">{copy.body}</Copy>
      <Copy role="body">{copy.stop}</Copy>
      {confirming ? <div className="lf-governance-reflection" data-research="confirm">
        <p data-copy-role="prompt">{copy.confirm}</p>
        <div className="lf-family-hub-actions">
          <Button variant="accent" disabled={busy} onClick={() => { setConfirming(false); onStop(); }}>{copy.yes}</Button>
          <Button disabled={busy} onClick={() => setConfirming(false)}>{copy.no}</Button>
        </div>
      </div> : <div className="lf-family-hub-actions"><Button disabled={busy} onClick={() => setConfirming(true)}>{copy.button}</Button></div>}
    </>}
  </section>;
}
