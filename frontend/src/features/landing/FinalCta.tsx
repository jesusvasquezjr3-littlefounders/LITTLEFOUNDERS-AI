import { useId } from 'react';
import { motion } from 'motion/react';
import { useSiteCopy } from '@/i18n/useCopy';
import { CtaButtons } from '@/features/landing/CtaButtons';
import { reveal, STAGGER } from '@/lib/motionPresets';
import { align, grid, heading, section } from '@/features/landing/type';

/*
 * The last ask, on the same grid and the same left edge as everything above: one line on seven
 * columns, the same two buttons on the other five, under a hairline. Stacked below 1024 px and
 * centered on phones.
 */
export function FinalCta() {
  const copy = useSiteCopy().landingV2;
  const titleId = useId();

  return <motion.section aria-labelledby={titleId} {...reveal} className={`${grid} items-center gap-y-6 border-t border-[var(--v-border)] ${section}`}>
    <h2 id={titleId} className={`${heading} ${align} col-span-4 md:col-span-8 lg:col-span-7`}>{copy.ctaTitle}</h2>
    <motion.div {...reveal} transition={{ ...reveal.transition, delay: STAGGER }} className="col-span-4 flex justify-center md:col-span-8 md:justify-start lg:col-span-5 lg:justify-end">
      <CtaButtons origin="landing-final" />
    </motion.div>
  </motion.section>;
}
