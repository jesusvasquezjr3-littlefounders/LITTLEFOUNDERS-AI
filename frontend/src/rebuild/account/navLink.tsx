import type { MouseEvent, ReactNode } from 'react';
import { ButtonLink, type ButtonVariant } from '../design/controls';
import { Glyph } from '../design/glyphs';

/*
 * A real link (it goes somewhere) that stays inside the single-page app on a
 * plain press, like the shells' own navigation: a modified press (new tab,
 * new window) or a middle click keeps the browser's own behaviour.
 */
export function followInApp(event: MouseEvent<HTMLAnchorElement>, href: string, onNavigate: (href: string) => void) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  onNavigate(href);
}

export function AppLink({ href, onNavigate, variant = 'secondary', size, children }: {
  href: string; onNavigate: (href: string) => void; variant?: ButtonVariant; size?: 'sm' | 'md' | 'lg'; children: ReactNode;
}) {
  return <ButtonLink href={href} variant={variant} size={size} onClick={(event) => followInApp(event, href, onNavigate)}>{children}</ButtonLink>;
}

/** The way back to the page a screen belongs to: a back glyph and the page's name. */
export function BackLink({ href, label, onNavigate }: { href: string; label: string; onNavigate: (href: string) => void }) {
  return <a className="lf-account-back" href={href} data-copy-role="action" onClick={(event) => followInApp(event, href, onNavigate)}>
    <Glyph name="back" /><span>{label}</span>
  </a>;
}
