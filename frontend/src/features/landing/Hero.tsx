import { useId } from 'react';
import { motion } from 'motion/react';
import { useSiteCopy } from '@/i18n/useCopy';
import { CtaButtons } from '@/features/landing/CtaButtons';
import { LoopVideo } from '@/features/landing/LoopVideo';
import { display, lead } from '@/features/landing/type';

/*
 * Landing section 1: a split hero. The message takes one half and a looping video of the Mentors
 * the other. The message answers three things in the first ten seconds: who it is for (your kids),
 * what they get (practice before it is real) and what it is not (real money).
 */
const rise = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0 } };

export function Hero() {
  const copy = useSiteCopy().landingV2;
  const titleId = useId();

  return <section aria-labelledby={titleId} className="grid min-h-[calc(100dvh-72px-8rem)] content-center gap-8 py-8 text-center md:grid-cols-2 md:items-center md:text-start">
    <motion.div className="grid min-w-0 justify-items-center gap-6 md:justify-items-start"
      initial="hidden" animate="show" transition={{ staggerChildren: 0.09, delayChildren: 0.1 }}>
      <motion.h1 id={titleId} variants={rise} className={display}>
        {copy.title}{' '}<span className="block text-[var(--primary-ink)]">{copy.titleAccent}</span>
      </motion.h1>
      <motion.p variants={rise} className={lead}>{copy.lead}</motion.p>
      <motion.div variants={rise} className="w-full md:w-auto">
        <CtaButtons origin="landing-hero" className="mx-auto md:mx-0" />
      </motion.div>
    </motion.div>
    <div role="img" aria-label={copy.heroSceneAlt} className="pointer-events-none aspect-[5/4] max-h-[72dvh] w-full min-w-0 justify-self-center [mask-image:radial-gradient(ellipse_72%_70%_at_50%_52%,#000_74%,transparent_100%)]">
      <LoopVideo name="hero" className="block size-full object-contain" />
    </div>
  </section>;
}
