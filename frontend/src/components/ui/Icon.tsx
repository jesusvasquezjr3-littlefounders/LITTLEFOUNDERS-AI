import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/* /DESIGN.md — Material Symbols Outlined is the only icon set. Ligature-based. */

interface IconProps {
  name: string; // Material Symbols ligature name, e.g. "smart_toy"
  fill?: boolean;
  className?: string;
}

/**
 * Neutral placeholder rendered when `name` is not a real Material Symbols
 * ligature. Content generation (coursegen) can emit invented icon names
 * ('lemonade', 'piggy_bank', 'guitar'); the font then paints the raw string
 * as giant text (the "LEMON□E" defect seen across the QA course). We detect
 * that at render — a resolved glyph occupies ~1em (the square icon grid),
 * while unresolved fallback text is several times wider — and swap in this
 * glyph instead of ever showing the literal name. 'help' is a core Material
 * Symbol guaranteed to resolve.
 */
const FALLBACK_GLYPH = 'help';

export function Icon({ name, fill = false, className }: IconProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setBroken(false); // new name → treat as valid until measured
    const measure = () => {
      const el = ref.current;
      if (!el || cancelled) return;
      const fontSize = parseFloat(getComputedStyle(el).fontSize) || 24;
      // A resolved icon ligature is ~1em wide; a raw fallback word is far wider.
      if (el.scrollWidth > fontSize * 1.5) setBroken(true);
    };
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
    if (fonts?.ready) {
      void fonts.ready.then(() => {
        if (!cancelled) requestAnimationFrame(measure);
      });
    } else if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(measure);
    }
    return () => {
      cancelled = true;
    };
  }, [name]);

  return (
    <span
      ref={ref}
      aria-hidden="true"
      className={cn('lf-icon text-inherit', fill && 'lf-icon-fill', className)}
    >
      {broken ? FALLBACK_GLYPH : name}
    </span>
  );
}
