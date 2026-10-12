import { useId } from 'react';
import { motion } from 'motion/react';
import { useSiteCopy } from '@/i18n/useCopy';
import { CtaButtons } from '@/features/landing/CtaButtons';
import { LoopVideo } from '@/features/landing/LoopVideo';
import { align, alignItems, display, grid, lead, section } from '@/features/landing/type';

/*
 * Landing section 1: the message on six columns and the looping video of the Mentors on the other
 * six; stacked, message first, below 1024 px, and centered on phones. The message answers three
 * things in the first ten seconds: who it is for (your kids), what they get (practice before it is
 * real) and what it is not (real money). The height follows the content, so the next section shows
 * at the fold and invites the scroll.
 */
const rise = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0 } };

export function Hero() {
  const copy = useSiteCopy().landingV2;
  const titleId = useId();

  return <section aria-labelledby={titleId} className={`${grid} items-center gap-y-10 ${section}`}>
    <motion.div className={`col-span-4 grid min-w-0 content-center gap-6 md:col-span-8 lg:col-span-6 ${alignItems} ${align}`}
      initial="hidden" animate="show" transition={{ staggerChildren: 0.09, delayChildren: 0.1 }}>
      <motion.h1 id={titleId} variants={rise} className={display}>
        {copy.title}{' '}<span className="block text-[var(--primary-ink)]">{copy.titleAccent}</span>
      </motion.h1>
      <motion.p variants={rise} className={lead}>{copy.lead}</motion.p>
      <motion.div variants={rise} className="flex w-full justify-center md:justify-start">
        <CtaButtons origin="landing-hero" />
      </motion.div>
    </motion.div>
    <div role="img" aria-label={copy.heroSceneAlt} className="pointer-events-none col-span-4 -my-4 aspect-[5/4] w-full max-w-xl min-w-0 [mask-image:radial-gradient(ellipse_72%_70%_at_50%_52%,#000_74%,transparent_100%)] md:col-span-8 md:-my-8 md:max-w-none lg:col-span-6 lg:my-0">
      <LoopVideo name="hero" priority className="block size-full object-contain" />
    </div>
  </section>;
}
