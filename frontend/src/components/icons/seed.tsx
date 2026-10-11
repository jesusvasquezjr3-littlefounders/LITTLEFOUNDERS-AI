import type { SVGProps } from 'react';

/*
 * The Seed: the currency of LittleFounders (D-024), drawn as a sunflower seed (D-043). It is the
 * product's own mark, not a library icon: a pointed teardrop, a deep indigo shell, three cream
 * stripes that run from the base toward the tip, and a golden edge that keeps it readable on the
 * light and on the dark page alike. The 3D Seed in the compositions is the same drawing
 * (tools/render/seed-model.js).
 *
 * It is drawn on a 48 px grid and stays legible at 16 px (the stripes merge into one light shape
 * there, on purpose). The colors are the Seed's own and do not follow the text color: a Seed is
 * always this Seed. Decorative by default; give it a `title` where it stands alone as information.
 *
 * `animated` lets it breathe and a glint cross it every few seconds, for the places a Seed is being
 * given. It holds still for anybody who asked for less motion.
 */
const SHELL = '#2d2a4a';

const STRIPE = '#fff1cf';

const GOLD = '#ebb806';

// The seed's outline, point up and leaning a little to the right, as a seed that was dropped lies.
const OUTLINE = 'M27.6 4.3c6.9 6.6 11.7 15.2 11.2 24.1-.4 8.5-6.4 15.1-14.6 15.3-8.3.2-15-6.2-15.1-14.9C9 19.600 16.800 10.900 27.600 4.300z';

export function Seed({ animated = false, title, ...props }: SVGProps<SVGSVGElement> & { animated?: boolean; title?: string }) {
  return <svg viewBox="0 0 48 48" role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} focusable={false} data-seed={animated ? 'animated' : 'still'} {...props}>
    {title ? <title>{title}</title> : null}
    <g className="lf-seed">
      {/* drawn a little taller and narrower than a drop, so it reads as a seed */}
      <g transform="translate(24 24) scale(0.86 1.05) translate(-24 -23)">
      <path d={OUTLINE} fill={SHELL} stroke={GOLD} strokeWidth="2.6" strokeLinejoin="round" />
      <g fill="none" stroke={STRIPE} strokeLinecap="round">
        <path d="M24.6 12.8c-4.9 5.6-7.9 11.6-8.2 17.9" strokeWidth="2.6" />
        <path d="M27.4 11.2c-1.6 7.6-2.6 15.6-2.7 24.6" strokeWidth="3.6" />
        <path d="M30.6 14.6c2.300 5.300 3.300 10.900 2.900 16.700" strokeWidth="2.6" />
      </g>
      <path className="lf-seed-glint" d="M14.5 26.5c.4-5.2 2.600-9.900 6-14" fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.6" strokeLinecap="round" />
      </g>
    </g>
  </svg>;
}
