import { useId } from 'react';
import { useSiteCopy } from '@/i18n/useCopy';
import { CtaButtons } from '@/features/landing/CtaButtons';
import { grid, heading, section } from '@/features/landing/type';

/*
 * The last ask, on the same grid and the same left edge as everything above: one line on seven
 * columns, the same two buttons on the other five, under a hairline. Stacked below 1024 px.
 */
export function FinalCta() {
  const copy = useSiteCopy().landingV2;
  const titleId = useId();

  return <section aria-labelledby={titleId} className={`${grid} items-center gap-y-6 border-t border-[var(--v-border)] ${section}`}>
    <h2 id={titleId} className={`${heading} col-span-4 md:col-span-8 lg:col-span-7`}>{copy.ctaTitle}</h2>
    <div className="col-span-4 md:col-span-8 lg:col-span-5 lg:justify-self-end">
      <CtaButtons origin="landing-final" />
    </div>
  </section>;
}
