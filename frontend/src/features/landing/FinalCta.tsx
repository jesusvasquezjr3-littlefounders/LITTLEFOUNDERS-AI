import { useId } from 'react';
import { useSiteCopy } from '@/i18n/useCopy';
import { CtaButtons } from '@/features/landing/CtaButtons';
import { heading } from '@/features/landing/type';

/** The last ask: one line and the same two buttons as the top of the page. */
export function FinalCta() {
  const copy = useSiteCopy().landingV2;
  const titleId = useId();

  return <section aria-labelledby={titleId} className="mb-12 grid justify-items-center gap-6 rounded-[var(--r-frame)] bg-[var(--v-beige)] px-6 py-12 text-center md:mb-20 md:py-16">
    <h2 id={titleId} className={`${heading} max-w-[20ch]`}>{copy.ctaTitle}</h2>
    <CtaButtons origin="landing-final" className="sm:justify-center" />
  </section>;
}
