import { useId, type ReactNode } from 'react';
import type { CopyRole } from './copyBudget';
import { Glyph } from './glyphs';
import './disclosure.css';

/*
 * A disclosure (W2 Lane 1, for the public FAQ, M4): a heading whose button
 * shows or hides the content below it. The button says whether it is open
 * (`aria-expanded`) and which region it controls; the glyph repeats the state
 * and is never the only signal (02 rule 6). The summary is usually a question,
 * so it carries its own copy role (a heading, not a three-word action). The
 * caller owns the open state, so several can be open at once and a link can
 * open one on arrival. The whole summary row is the target (56 px floor).
 */
export function Disclosure({ summary, open, onToggle, children, headingLevel = 2, summaryRole = 'heading' }: {
  summary: ReactNode; open: boolean; onToggle: () => void; children: ReactNode;
  headingLevel?: 2 | 3; summaryRole?: CopyRole;
}) {
  const id = useId();
  const Heading = headingLevel === 3 ? 'h3' : 'h2';
  return <div className="lf-disclosure" data-open={open}>
    <Heading className="lf-disclosure-heading">
      <button type="button" className="lf-disclosure-summary" aria-expanded={open} aria-controls={`${id}-panel`} data-copy-role={summaryRole} onClick={onToggle}>
        <span className="lf-disclosure-label">{summary}</span>
        <Glyph name={open ? 'minus' : 'plus'} />
      </button>
    </Heading>
    <div id={`${id}-panel`} className="lf-disclosure-panel" hidden={!open}>{children}</div>
  </div>;
}
