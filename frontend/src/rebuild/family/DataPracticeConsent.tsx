import { useId, useState } from 'react';
import { Button, Copy, InlineNotice, LoadingState, Switch } from '../design/controls';
import { PRACTICE_GROUPS, type DataPractice, type DataPracticeState, type PracticeAnswer, type PracticeGroup, type PracticeKey } from './dataPracticesApi';
import '../design/tokens.css';
import '../design/system.css';
import './familyHub.css';
import './familyGovernance.css';

/*
 * S10.3 (OD-9 section 4.2), the Tutor's specific consent for a migrated
 * child. Consent given on the legacy platform covered only what it did then;
 * each data practice the rebuild introduced applies to this child only after
 * the Tutor says yes to it here. Nothing is preselected, nothing celebrates,
 * and the surface shows nothing for a child who is not a migrated child (their
 * consent was taken at sign-up). One group opens at a time so each view stays
 * inside the adult first-view budget. Research is answered in its own section
 * (D.22). The database decides who may answer and whether a practice applies.
 */

export interface DataPracticesCopy {
  tutor: { heading: string; lead: string; open: string; close: string; on: string; off: string; saved: string; failed: string; loadFailed: string; loading: string };
  groups: Record<PracticeGroup, { heading: string; body: string }>;
  practices: Record<string, Record<string, string>>;
  self: { heading: string; bodyOff: string; bodyChoose: string; open: string; close: string; on: string; off: string; saved: string; failed: string };
}

/** The label for a practice key ("analytics.motivation_events" reads practices.analytics.motivation_events). */
export function practiceLabel(copy: DataPracticesCopy, key: PracticeKey): string {
  const [family, leaf] = key.split('.') as [string, string];
  return copy.practices[family]?.[leaf] ?? '';
}

const fill = (text: string, values: Record<string, string>) => text.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '');

export function DataPracticeConsent({ copy, kidName, locale, dark, open, state, failed, busyKey, notice, onToggle, onAnswer }: {
  copy: DataPracticesCopy;
  kidName: string;
  locale: string;
  dark: boolean;
  open: boolean;
  state: DataPracticeState | null;
  failed: boolean;
  busyKey: PracticeKey | null;
  notice: { text: string; error: boolean } | null;
  onToggle: () => void;
  onAnswer: (practice: DataPractice, answer: PracticeAnswer) => void;
}) {
  const ids = { heading: useId(), body: useId() };
  const [group, setGroup] = useState<PracticeGroup | null>(null);
  if (!failed && (!state || !state.migrated)) return null;
  const answerable = (state?.practices ?? []).filter((p) => !p.ownFlow);
  return <section className="lf-rebuild lf-family-hub lf-governance" data-governance="data-practices" data-theme={dark ? 'dark' : 'light'} lang={locale} aria-labelledby={ids.heading}>
    <div className="lf-governance-head">
      <h3 id={ids.heading} data-copy-role="heading">{copy.tutor.heading}</h3>
      <Button aria-expanded={open} aria-controls={ids.body} onClick={() => { setGroup(null); onToggle(); }}>{open ? copy.tutor.close : copy.tutor.open}</Button>
    </div>
    <Copy role="body">{fill(copy.tutor.lead, { name: kidName })}</Copy>
    {notice && <InlineNotice tone={notice.error ? 'error' : 'success'} live>{notice.text}</InlineNotice>}
    {open && <div id={ids.body} className="lf-governance-panel">
      {failed ? <InlineNotice tone="error" live>{copy.tutor.loadFailed}</InlineNotice>
        : !state ? <LoadingState label={copy.tutor.loading} />
          : PRACTICE_GROUPS.map((g) => {
            const members = answerable.filter((p) => p.kind === g);
            if (members.length === 0) return null;
            const expanded = group === g;
            return <div key={g} className="lf-governance-note" data-practice-group={g}>
              <Button aria-expanded={expanded} onClick={() => setGroup(expanded ? null : g)}>{copy.groups[g].heading}</Button>
              {expanded && <>
                <Copy role="body">{copy.groups[g].body}</Copy>
                {members.map((p) => <div key={p.key} className="lf-governance-step" data-practice={p.key} data-consented={String(p.consented)}>
                  <Switch label={practiceLabel(copy, p.key)} checked={p.consented} pending={busyKey === p.key}
                    stateLabels={{ on: copy.tutor.on, off: copy.tutor.off }}
                    onCheckedChange={(next) => onAnswer(p, next ? { grant: true, disclosureVersion: p.disclosureVersion } : { grant: false })} />
                </div>)}
              </>}
            </div>;
          })}
    </div>}
  </section>;
}
