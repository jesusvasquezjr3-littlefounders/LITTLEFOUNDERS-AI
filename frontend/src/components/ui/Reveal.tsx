import type { HTMLAttributes } from 'react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/*
 * /DESIGN.md §Motion — scroll reveal: content rises in once, as it enters the
 * viewport. Reduced-motion users (and environments without IntersectionObserver,
 * e.g. jsdom) see content immediately.
 */

interface RevealProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'section';
  /** Stagger delay in ms — use sparingly, ≤3 steps of 80ms (/DESIGN.md §Motion). */
  delay?: number;
}

export function Reveal({ as = 'div', delay = 0, className, style, ...props }: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setRevealed(true);
      return;
    }
    // Synchronous first check: anything already in (or above) the viewport at
    // mount reveals immediately — no dependence on observer timing, and content
    // can never be stranded invisible after a reload mid-page.
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight - 40 && rect.bottom > 0) {
      setRevealed(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const Tag = as;
  return (
    <Tag
      // Reveal targets block sections; the ref type is safe for div/section.
      ref={ref as never}
      className={cn('lf-reveal', revealed && 'is-revealed', className)}
      style={delay ? { ...style, transitionDelay: `${delay}ms` } : style}
      {...props}
    />
  );
}
