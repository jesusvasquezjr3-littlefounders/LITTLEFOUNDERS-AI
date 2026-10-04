import type { ReactNode } from 'react';
import './space2.css';

/** A wide table scrolls inside its own box, never the page; the box is focusable so the keyboard can scroll it. */
export function ScrollRegion({ label, children }: { label: string; children: ReactNode }) {
  return <div className="lf-s2-scroll" role="region" tabIndex={0} aria-label={label}>{children}</div>;
}
