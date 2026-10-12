import { useEffect, useId } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { AppIcon } from '@/components/AppIcon';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { usePageTitle } from '@/components/pageTitle';
import { Button } from '@/components/ui/button';
import { LoopVideo } from '@/features/landing/LoopVideo';
import { body, grid, heading } from '@/features/landing/type';
import { useCoreCopy } from '@/i18n/useCopy';
import { ENTER } from '@/lib/motionPresets';

/*
 * The page for any address that is not a page: "Error 404" in red with a warning mark above the
 * scene, Rho and Liruf kneeling back to back with their heads low, sad that they cannot find it
 * (docs/design/CHARACTER-COMPOSITIONS.md, scene "notfound"), a plain sentence and one button back to
 * `/`. Symmetric by design like the problem section, so it is centered at every width. The red is the
 * `--lf-error` token, measured for both color modes; the mark never stands alone, the words beside it
 * carry the meaning. It tells crawlers not to index it. The server still answers 200 for unknown paths
 * (vercel.json rewrites everything to the app shell), so this is the client's answer, not an HTTP status.
 */
const rise = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: ENTER } } };

export function NotFound() {
  const copy = useCoreCopy().notFound;
  const titleId = useId();

  usePageTitle(copy.pageTitle);

  useEffect(() => {
    const meta = document.createElement('meta');

    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.append(meta);

    return () => meta.remove();
  }, []);

  return <div className="py-4 md:py-6">
    <Breadcrumbs trail={[{ label: copy.pageTitle }]} />
    <section aria-labelledby={titleId} className={`${grid} items-center gap-y-4 pt-2 pb-12 text-center md:pb-16`}>
      <motion.p className="col-span-4 flex min-w-0 flex-wrap items-center justify-center gap-x-2 gap-y-2 text-[length:var(--fs-title)] leading-none font-bold tracking-wide text-[var(--lf-error)] md:col-span-8 lg:col-span-12"
        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 22 }}>
        <AppIcon name="warning" size={28} alive />
        {copy.code}
      </motion.p>
      <div role="img" aria-label={copy.sceneAlt} className="pointer-events-none col-span-4 mx-auto aspect-[40/17] w-full max-w-3xl min-w-0 [mask-image:radial-gradient(ellipse_74%_72%_at_50%_52%,#000_72%,transparent_100%)] md:col-span-8 lg:col-span-12">
        <LoopVideo name="notfound" priority className="block size-full object-contain" />
      </div>
      <motion.div className="col-span-4 grid min-w-0 justify-items-center gap-4 md:col-span-8 lg:col-span-12" initial="hidden" animate="show" transition={{ staggerChildren: 0.09, delayChildren: 0.15 }}>
        <motion.h1 id={titleId} variants={rise} className={heading}>{copy.title}</motion.h1>
        <motion.p variants={rise} className={`${body} text-center`}>{copy.text}</motion.p>
        <motion.div variants={rise} className="grid w-full max-w-sm sm:block sm:w-auto sm:max-w-none">
          <Button asChild variant="accent" size="lg" className="w-full sm:w-auto"><Link to="/">{copy.button}</Link></Button>
        </motion.div>
      </motion.div>
    </section>
  </div>;
}
