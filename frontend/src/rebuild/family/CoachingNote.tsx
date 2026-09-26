import { useId, useState } from 'react';
import { Button, StatusMark } from '../design/controls';
import '../design/tokens.css';
import '../design/system.css';
import './familyHub.css';
import './familyGovernance.css';

/*
 * S07.7 (D.23), coaching integrated into the Tasks and Banking control
 * surfaces themselves, not left in a help article nobody is prompted to read
 * (Appendix H's worked example (a)): a few plain lines next to the control
 * they are about, one tap away. Used for chore pricing and the
 * contribution-versus-bonus choice (D.10, Appendix G §1.2) in the chore
 * composer, and for the spending limit as structure with a reason (§2.5) on
 * the Tutor's Banking page. Static copy; nothing is recorded. Adult band.
 */

export function CoachingNote({ label, close, lines, name, locale, dark, embedded = false }: {
  /** The button that opens the lines (an action). */
  label: string;
  close: string;
  lines: string[];
  /** Which note this is, for the page and its tests. */
  name: string;
  locale: string;
  dark: boolean;
  /** Inside another rebuilt surface: no page-level wrapper of its own. */
  embedded?: boolean;
}) {
  const body = useId();
  const [open, setOpen] = useState(false);
  const content = <>
    <Button aria-expanded={open} aria-controls={body} onClick={() => setOpen(!open)}>{open ? close : label}</Button>
    {open && <ul id={body} className="lf-governance-lines" data-coaching-lines={name}>
      {lines.map((line) => <li key={line}><StatusMark correct /><span data-copy-role="body">{line}</span></li>)}
    </ul>}
  </>;
  if (embedded) return <div className="lf-governance lf-governance-note" data-coaching={name}>{content}</div>;
  return <section className="lf-rebuild lf-family-hub lf-governance lf-governance-note" data-coaching={name} data-theme={dark ? 'dark' : 'light'} lang={locale} aria-label={label}>
    {content}
  </section>;
}
