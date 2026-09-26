import { useId } from 'react';
import { Button, Copy, StatusMark } from '../design/controls';
import type { PolicyClass, PolicyLine } from './governanceApi';
import '../design/tokens.css';
import '../design/system.css';
import './familyHub.css';
import './familyGovernance.css';

/*
 * S07.7 (D.21), the published retention policy in the Tutor's own words: how
 * long each kind of Family Hub data is kept. Every number comes from Core,
 * which serves the same constants the database's retention job enforces (a
 * gate keeps them equal), so what the family reads is what happens. Opens on
 * demand; adult band copy.
 */

export interface DataPolicyCopy extends Record<PolicyClass, string> { heading: string; lead: string; open: string; close: string; failed: string }

export function DataPolicy({ copy, locale, dark, open, lines, failed, onToggle }: {
  copy: DataPolicyCopy;
  locale: string;
  dark: boolean;
  open: boolean;
  lines: PolicyLine[] | null;
  failed: boolean;
  onToggle: () => void;
}) {
  const ids = { heading: useId(), body: useId() };
  return <section className="lf-rebuild lf-family-hub lf-governance" data-governance="data-policy" data-theme={dark ? 'dark' : 'light'} lang={locale} aria-labelledby={ids.heading}>
    <div className="lf-governance-head">
      <h2 id={ids.heading} data-copy-role="heading">{copy.heading}</h2>
      <Button aria-expanded={open} aria-controls={ids.body} onClick={onToggle}>{open ? copy.close : copy.open}</Button>
    </div>
    <Copy role="body">{copy.lead}</Copy>
    {open && <div id={ids.body} className="lf-governance-panel">
      {failed ? <div className="lf-family-hub-notice" role="alert"><StatusMark correct={false} /><Copy role="body">{copy.failed}</Copy></div>
        : lines && <ul className="lf-governance-lines">
          {lines.map((line) => <li key={line.id} data-policy={line.id}>
            <StatusMark correct /><span data-copy-role="body">{copy[line.id].replace('{days}', line.days === null ? '' : new Intl.NumberFormat(locale).format(line.days))}</span>
          </li>)}
        </ul>}
    </div>}
  </section>;
}
