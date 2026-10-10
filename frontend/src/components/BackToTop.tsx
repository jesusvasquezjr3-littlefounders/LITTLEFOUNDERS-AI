import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { MorphIcon } from 'morphicons/react';
import { ArrowUp } from 'lucide';
import { Button } from '@/components/ui/button';
import { useCoreCopy } from '@/i18n/useCopy';

/*
 * The "back to top" button: a round Button that appears once the visitor has scrolled past one and a
 * half screens and takes them to the top, smoothly unless they asked for reduced motion. Focus goes
 * to <main> afterwards, because the button leaves the page and would otherwise drop it. On phones it
 * sits above the fixed sign-in bar; it hides while the cookie banner is open (the banner marks the
 * root with `data-consent-banner`, see lf-theme.css).
 */
export function BackToTop() {
  const label = useCoreCopy().siteShell.backToTop;
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => setVisible(window.scrollY > window.innerHeight * 1.5);

    update();
    window.addEventListener('scroll', update, { passive: true });

    return () => window.removeEventListener('scroll', update);
  }, []);

  const goTop = () => {
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    document.querySelector<HTMLElement>('main')?.focus({ preventScroll: true });
  };

  return <AnimatePresence>
    {visible ? <motion.div key="back-to-top" data-fab
      className="fixed end-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 md:end-6 md:bottom-6"
      initial={{ opacity: 0, y: 12, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}>
      <Button type="button" variant="outline" data-icon-only className="size-12 min-w-0 bg-[var(--v-paper)] p-0 shadow-[var(--shadow-float)]" aria-label={label} title={label} onClick={goTop}>
        <MorphIcon icon={ArrowUp} size={22} strokeWidth={2} reducedMotion="user" />
      </Button>
    </motion.div> : null}
  </AnimatePresence>;
}
