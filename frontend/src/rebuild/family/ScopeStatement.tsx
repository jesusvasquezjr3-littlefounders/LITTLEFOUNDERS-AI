import { useId, useState } from 'react';
import { Button, Copy, StatusMark } from '../design/controls';
import '../design/tokens.css';
import '../design/system.css';
import './familyHub.css';
import './familyGovernance.css';

/*
 * S07.7 (D.20): what the practice does and does not teach, stated plainly in
 * parent-facing material (Appendix G §3.5). The four things it does are each
 * backed by a mechanic the product enforces; the four it does not attempt are
 * named explicitly (credit, debt, real compound interest, risk), so "financial
 * literacy" never implies more than the mechanics build. The registry
 * docs/operations/block-d-scope.json lists every line with its evidence, and
 * agent/tools/check-block-d-scope.mjs fails when a line, a required exclusion
 * or a mount disappears, or when a borrowing or interest mechanic appears
 * without this statement changing. The first view is the heading and the
 * intro; the lists are one tap away (Copy Budget layering).
 */

export const SCOPE_TEACHES = ['earning', 'splitting', 'goals', 'asking'] as const;
export const SCOPE_NOT = ['credit', 'debt', 'compounding', 'risk'] as const;

export interface ScopeCopy {
  heading: string; intro: string; open: string; close: string; teachesHeading: string; notHeading: string; why: string;
  earning: string; splitting: string; goals: string; asking: string; credit: string; debt: string; compounding: string; risk: string;
}

export function ScopeStatement({ copy, locale, dark, initiallyOpen = false }: { copy: ScopeCopy; locale: string; dark: boolean; initiallyOpen?: boolean }) {
  const ids = { heading: useId(), body: useId() };
  const [open, setOpen] = useState(initiallyOpen);
  return <section className="lf-rebuild lf-family-hub lf-governance" data-governance="scope" data-theme={dark ? 'dark' : 'light'} lang={locale} aria-labelledby={ids.heading}>
    <div className="lf-governance-head">
      <h2 id={ids.heading} data-copy-role="heading">{copy.heading}</h2>
      <Button aria-expanded={open} aria-controls={ids.body} onClick={() => setOpen(!open)}>{open ? copy.close : copy.open}</Button>
    </div>
    <Copy role="body">{copy.intro}</Copy>
    {open && <div id={ids.body} className="lf-governance-panel">
      <h3 data-copy-role="heading">{copy.teachesHeading}</h3>
      <ul className="lf-governance-lines" data-lines="teaches">
        {SCOPE_TEACHES.map((key) => <li key={key} data-scope={key}><StatusMark correct /><span data-copy-role="body">{copy[key]}</span></li>)}
      </ul>
      <h3 data-copy-role="heading">{copy.notHeading}</h3>
      <ul className="lf-governance-lines" data-lines="not">
        {SCOPE_NOT.map((key) => <li key={key} data-scope={key}><StatusMark correct={false} /><span data-copy-role="body">{copy[key]}</span></li>)}
      </ul>
      <Copy role="body">{copy.why}</Copy>
    </div>}
  </section>;
}
