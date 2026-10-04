import type { ReactNode } from 'react';

/** The text equivalent of a board scrolls inside its own region, so a wide table never widens the page. */
export function TableScroll({ label, children }: { label: string; children: ReactNode }) {
  return <div className="lf-sp-scroll" role="region" aria-label={label} tabIndex={0}>{children}</div>;
}
