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

/**
 * MEASURE THE TEXT, NOT THE BOX — and that distinction is a bug fix.
 *
 * The first version of this check read `el.scrollWidth`, which is the width of
 * the ELEMENT. That equals the glyph's width only while the element is
 * inline-shrink-to-fit, which `.lf-icon` is by default and which a caller can
 * silently take away: `fair_trade` passed `block` to centre its two offer
 * icons, the span became as wide as the card (322 px against a 40 px font),
 * `322 > 40 × 1.5` was true, and BOTH perfectly valid glyphs (`sell`, `toys`)
 * were replaced by a question mark — on the one exercise whose entire question
 * is "which of these two things is worth more". A checker that reports a
 * healthy thing as broken is worse than no checker, because the placeholder it
 * substitutes is confidently wrong (/AGENTS.md §1.14).
 *
 * A `Range` over the node's contents measures the laid-out TEXT RUN and reads
 * nothing about the box around it, so the answer is the same whether the caller
 * made the span inline, block, a flex item or a grid cell. Height is checked
 * too: inside a narrow block a long fallback word WRAPS instead of growing
 * wide, and a stack of lines is the same defect seen end-on.
 */
function textRunSize(el: HTMLElement): { width: number; lines: number } | null {
  const range = document.createRange();
  range.selectNodeContents(el);
  // jsdom implements the Range API without any LAYOUT behind it, so these two
  // are simply absent there. `null` means "this environment cannot answer",
  // which is different from "the glyph measured zero" — and the caller must
  // treat the two differently or every icon in every unit test would be
  // declared broken (/AGENTS.md §1.14: failure is not emptiness).
  if (typeof range.getBoundingClientRect !== 'function' || typeof range.getClientRects !== 'function') {
    range.detach?.();
    return null;
  }
  const width = range.getBoundingClientRect().width;
  // Line COUNT, not height: a line box's height follows `line-height`, which a
  // caller may set, and reintroducing a caller-controlled input is how the
  // first version of this check went wrong. The number of client rects is the
  // number of lines the run occupies and no caller can move it.
  const lines = range.getClientRects().length;
  range.detach?.();
  return { width, lines };
}

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
      // A resolved icon ligature is ~1em wide and always ONE line; a raw
      // fallback word is several times wider, or — in a narrow container —
      // wraps onto more than one.
      const run = textRunSize(el);
      if (!run) return; // no layout to measure — leave the authored name alone
      if (run.width > fontSize * 1.5 || run.lines > 1) setBroken(true);
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
