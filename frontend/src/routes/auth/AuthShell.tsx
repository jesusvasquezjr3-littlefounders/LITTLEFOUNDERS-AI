import type { ReactNode } from 'react';
import { Card } from '@/components/ui';

/*
 * Composition per /DESIGN.md §Screen Recipes → Auth: focused single column
 * (max-w-md) centered on `base`, soft primary glow behind one resting card.
 * Wide screens spend their space on calm, not columns — trust surface.
 */
export function AuthShell({ title, subtitle, children, footer, wide = false }: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="relative flex justify-center px-5 py-14 sm:py-20 md:px-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-6 mx-auto h-72 max-w-lg rounded-full bg-primary/10 blur-3xl"
      />
      <div className={wide ? 'relative w-full max-w-2xl' : 'relative w-full max-w-md'}>
        <header className="mb-8 text-center">
          <h1 className="lf-display-lg text-content">{title}</h1>
          {subtitle && <p className="lf-body-lg mt-3 text-content-muted">{subtitle}</p>}
        </header>
        <Card className="p-6 sm:p-8">{children}</Card>
        {footer && <div className="lf-body mt-6 text-center text-content-muted">{footer}</div>}
      </div>
    </div>
  );
}
