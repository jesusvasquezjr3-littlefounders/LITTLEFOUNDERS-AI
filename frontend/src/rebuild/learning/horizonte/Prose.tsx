import type { ReactNode } from 'react';

/** A sentence inside a data readout: the Copy Budget measures it as body, not as data (Bible 06 section 3). */
export function Prose({ children }: { children: ReactNode }) {
  return <span data-copy-role="body">{children}</span>;
}
