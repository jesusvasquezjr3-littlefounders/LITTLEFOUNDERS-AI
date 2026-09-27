import { useId, useState } from 'react';
import { Button, Copy, InlineNotice, Switch } from '../design/controls';
import { practiceLabel, type DataPracticesCopy } from './DataPracticeConsent';
import type { DataPractice, DataPracticeState, PracticeAnswer, PracticeKey } from './dataPracticesApi';
import '../design/tokens.css';
import '../design/system.css';
import './familyHub.css';
import './familyGovernance.css';

/*
 * S10.3 (OD-9 section 4.2), the account's own view. A migrated child sees the
 * new data practices that apply to them and can turn any of them off (a
 * child's own no counts). A self-registered teen with no Tutor can also say
 * yes to the usage counts, the only practices the database lets a teen answer
 * alone. Nothing shows when there is nothing to answer. Written to the
 * youngest band (6-9); nothing is preselected and nothing celebrates.
 */

export function MyDataPractices({ copy, locale, dark, state, busyKey, notice, onAnswer }: {
  copy: DataPracticesCopy;
  locale: string;
  dark: boolean;
  state: DataPracticeState | null;
  busyKey: PracticeKey | null;
  notice: { text: string; error: boolean } | null;
  onAnswer: (practice: DataPractice, answer: PracticeAnswer) => void;
}) {
  const ids = { heading: useId(), body: useId() };
  const [open, setOpen] = useState(false);
  const shown = state?.migrated ? state.practices.filter((p) => !p.ownFlow && (p.selfGrantable || p.consented)) : [];
  if (shown.length === 0 && !notice) return null;
  const canChoose = shown.some((p) => p.selfGrantable);
  return <section className="lf-rebuild lf-family-hub lf-governance" data-governance="my-data-practices" data-theme={dark ? 'dark' : 'light'} lang={locale} aria-labelledby={ids.heading}>
    <div className="lf-governance-head">
      <h2 id={ids.heading} data-copy-role="heading">{copy.self.heading}</h2>
      {shown.length > 0 && <Button aria-expanded={open} aria-controls={ids.body} onClick={() => setOpen(!open)}>{open ? copy.self.close : copy.self.open}</Button>}
    </div>
    {shown.length > 0 && <Copy role="body">{canChoose ? copy.self.bodyChoose : copy.self.bodyOff}</Copy>}
    {notice && <InlineNotice tone={notice.error ? 'error' : 'success'} live>{notice.text}</InlineNotice>}
    {open && shown.length > 0 && <div id={ids.body} className="lf-governance-panel">
      {shown.map((p) => <div key={p.key} className="lf-governance-step" data-practice={p.key} data-consented={String(p.consented)}>
        {/* Off is always allowed; on only where the database lets this account answer alone. */}
        <Switch label={practiceLabel(copy, p.key)} checked={p.consented} pending={busyKey === p.key} disabled={!p.consented && !p.selfGrantable}
          stateLabels={{ on: copy.self.on, off: copy.self.off }}
          onCheckedChange={(next) => onAnswer(p, next ? { grant: true, disclosureVersion: p.disclosureVersion } : { grant: false })} />
      </div>)}
    </div>}
  </section>;
}
