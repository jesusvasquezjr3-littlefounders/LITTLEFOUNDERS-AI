import { useId, useState } from 'react';
import { Button, Copy, InlineNotice, LoadingState, StatusMark } from '../design/controls';
import type { ResearchView } from './governanceApi';
import '../design/tokens.css';
import '../design/system.css';
import './familyHub.css';
import './familyGovernance.css';

/*
 * S07.7 (D.22), the Tutor's research answer for one child. The long-horizon
 * question (does practice here help later in life?) is an open one the
 * company is testing, never a claim (Appendix G §3.6). This phase only
 * observes (OD-23: no experiment on a minor), keeps monthly totals with no
 * names, notes or titles, and deletes everything on a no. The disclosure is
 * shown in full before a yes, and the yes names its version; the database
 * decides who may answer and whether anything is recorded. Nothing is
 * preselected and nothing celebrates. Adult band copy.
 */

export interface ResearchCopy {
  open: string; close: string; heading: string; what: string; how: string; never: string; stop: string; yes: string; on: string; months: string;
  paused: string; stopButton: string; confirm: string; confirmYes: string; confirmNo: string; saved: string; deleted: string; failed: string; loading: string;
}

const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));

export function ResearchConsent({ copy, kidName, locale, dark, open, view, loading, failed, busy, notice, onToggle, onAnswer }: {
  copy: ResearchCopy;
  kidName: string;
  locale: string;
  dark: boolean;
  open: boolean;
  view: ResearchView | null;
  loading: boolean;
  failed: boolean;
  busy: boolean;
  notice: { text: string; error: boolean } | null;
  onToggle: () => void;
  onAnswer: (input: { participate: true; disclosureVersion: number } | { participate: false }) => void;
}) {
  const ids = { heading: useId(), body: useId() };
  const [confirming, setConfirming] = useState(false);
  const research = view?.research ?? null;
  const since = research?.since ? new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(research.since)) : '';
  return <section className="lf-rebuild lf-family-hub lf-governance" data-governance="research" data-participating={research ? String(research.participating) : undefined}
    data-theme={dark ? 'dark' : 'light'} lang={locale} aria-labelledby={ids.heading}>
    <div className="lf-governance-head">
      <h3 id={ids.heading} data-copy-role="heading">{copy.heading}</h3>
      <Button aria-expanded={open} aria-controls={ids.body} onClick={() => { setConfirming(false); onToggle(); }}>{open ? copy.close : copy.open}</Button>
    </div>
    {notice && <InlineNotice tone={notice.error ? 'error' : 'success'} live>{notice.text}</InlineNotice>}
    {open && <div id={ids.body} className="lf-governance-panel">
      {failed ? <InlineNotice tone="error" live>{copy.failed}</InlineNotice>
        : loading || !research ? <LoadingState label={copy.loading} />
          : research.participating ? <>
            <Copy role="body">{fill(copy.on, { date: since })}</Copy>
            <Copy role="body">{research.recording ? fill(copy.months, { count: research.months }) : copy.paused}</Copy>
            <Copy role="body">{copy.stop}</Copy>
            {confirming ? <div className="lf-governance-reflection" data-research="confirm">
              <p data-copy-role="prompt">{fill(copy.confirm, { name: kidName })}</p>
              <div className="lf-family-hub-actions">
                <Button variant="accent" disabled={busy} onClick={() => { setConfirming(false); onAnswer({ participate: false }); }}>{copy.confirmYes}</Button>
                <Button disabled={busy} onClick={() => setConfirming(false)}>{copy.confirmNo}</Button>
              </div>
            </div> : <div className="lf-family-hub-actions"><Button disabled={busy} onClick={() => setConfirming(true)}>{copy.stopButton}</Button></div>}
          </> : <>
            <ul className="lf-governance-lines" data-research="disclosure">
              {[copy.what, copy.how, fill(copy.never, { name: kidName }), copy.stop].map((line) => <li key={line}><StatusMark correct /><span data-copy-role="body">{line}</span></li>)}
            </ul>
            <div className="lf-family-hub-actions">
              <Button variant="accent" disabled={busy} onClick={() => onAnswer({ participate: true, disclosureVersion: view!.currentVersion })}>{fill(copy.yes, { name: kidName })}</Button>
            </div>
          </>}
    </div>}
  </section>;
}
