import { useId } from 'react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { useSiteCopy } from '@/i18n/useCopy';
import { LoopVideo } from '@/features/landing/LoopVideo';

/*
 * Landing section 1: a split hero. The message takes one half and a looping
 * video of the Mentors the other. The calls to action render as buttons and do
 * nothing yet (T-006 in docs/process/BUILD-TASKS.md).
 */

const rise = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0 } };

export function Hero() {
  const copy = useSiteCopy().landingV2;
  const titleId = useId();

  return <section aria-labelledby={titleId} className="grid min-h-[calc(100dvh-72px-8rem)] content-center gap-8 py-8 text-center md:grid-cols-2 md:items-center md:text-start">
    <motion.div className="grid min-w-0 justify-items-center gap-5 md:justify-items-start"
      initial="hidden" animate="show" transition={{ staggerChildren: 0.09, delayChildren: 0.1 }}>
      <motion.h1 id={titleId} variants={rise} className="text-[clamp(2.5rem,6vw,4.5rem)] leading-[1.04] font-extrabold tracking-[-0.025em] text-balance">
        {copy.title}{' '}<span className="block text-[var(--primary-ink)]">{copy.titleAccent}</span>
      </motion.h1>
      <motion.p variants={rise} className="max-w-[28em] text-[length:var(--fs-lead)] text-balance text-[var(--muted-foreground)]">{copy.lead}</motion.p>
      <motion.div variants={rise} className="grid w-full max-w-sm gap-3 sm:flex sm:w-auto sm:max-w-none sm:flex-wrap md:justify-start">
        <Button type="button" variant="accent" size="lg" className="w-full sm:w-auto" data-cta="become-tutor" data-origin="landing-hero">{copy.heroParent}</Button>
        <Button type="button" variant="outline" size="lg" className="w-full sm:w-auto" data-cta="start-free" data-origin="landing-hero-learn">{copy.heroLearn}</Button>
      </motion.div>
    </motion.div>
    <div role="img" aria-label={copy.heroSceneAlt} className="pointer-events-none aspect-[5/4] max-h-[72dvh] w-full min-w-0 justify-self-center [mask-image:radial-gradient(ellipse_72%_70%_at_50%_52%,#000_74%,transparent_100%)]">
      <LoopVideo name="hero" className="block size-full object-contain" />
    </div>
  </section>;
}
