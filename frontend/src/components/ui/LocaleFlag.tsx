import { useId, type ReactNode, type ReactElement } from 'react';
import type { Locale } from '@/i18n';
import { cn } from '@/lib/utils';

/*
 * Real vector flags, not emoji. Windows ships NO glyphs at all for the
 * regional-indicator emoji pairs that make up a flag emoji (Segoe UI Emoji
 * deliberately omits them) — every browser on Windows, Linux, Android and
 * ChromeOS therefore renders a blank box, two letters in a box, or nothing,
 * for exactly the flags the language switcher depends on to be readable at a
 * glance. An SVG has no font dependency: the browser's own vector rasterizer
 * draws it identically on every OS. This replaces the one emoji-icon
 * exception DESIGN.md used to carve out for the language switcher.
 */

const VIEWBOX = '0 0 30 20';

function FlagFrame({ clipId, children }: { clipId: string; children: ReactNode }) {
  return (
    <>
      <clipPath id={clipId}>
        <rect x="0.5" y="0.5" width="29" height="19" rx="2.5" />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>{children}</g>
      <rect
        x="0.5"
        y="0.5"
        width="29"
        height="19"
        rx="2.5"
        fill="none"
        stroke="rgb(var(--lf-outline))"
      />
    </>
  );
}

function UsFlag({ clipId }: { clipId: string }) {
  const stripeHeight = 20 / 13;
  const redStripes = Array.from({ length: 7 }, (_, i) => i * 2 * stripeHeight);
  const stars = Array.from({ length: 12 }, (_, i) => ({
    cx: 1.5 + (i % 4) * 2.6,
    cy: 1.4 + Math.floor(i / 4) * 2.6,
  }));
  return (
    <svg viewBox={VIEWBOX} className="h-full w-full" aria-hidden="true">
      <FlagFrame clipId={clipId}>
        <rect width="30" height="20" fill="#FFFFFF" />
        {redStripes.map((y, i) => (
          <rect key={i} x="0" y={y} width="30" height={stripeHeight} fill="#B22234" />
        ))}
        <rect x="0" y="0" width="12" height={7 * stripeHeight} fill="#3C3B6E" />
        {stars.map((s, i) => (
          <circle key={i} cx={s.cx} cy={s.cy} r="0.45" fill="#FFFFFF" />
        ))}
      </FlagFrame>
    </svg>
  );
}

function MxFlag({ clipId }: { clipId: string }) {
  return (
    <svg viewBox={VIEWBOX} className="h-full w-full" aria-hidden="true">
      <FlagFrame clipId={clipId}>
        <rect x="0" y="0" width="10" height="20" fill="#006847" />
        <rect x="10" y="0" width="10" height="20" fill="#FFFFFF" />
        <rect x="20" y="0" width="10" height="20" fill="#CE1126" />
        <circle cx="15" cy="10" r="2.1" fill="#8B5A2B" />
        <circle cx="15" cy="10" r="1.1" fill="#6B7280" />
      </FlagFrame>
    </svg>
  );
}

function BrFlag({ clipId }: { clipId: string }) {
  return (
    <svg viewBox={VIEWBOX} className="h-full w-full" aria-hidden="true">
      <FlagFrame clipId={clipId}>
        <rect width="30" height="20" fill="#009739" />
        <polygon points="15,2.5 27,10 15,17.5 3,10" fill="#FEDD00" />
        <circle cx="15" cy="10" r="5" fill="#012169" />
        <path d="M 9 8.5 A 8 8 0 0 0 21 8.5" fill="none" stroke="#FFFFFF" strokeWidth="0.6" />
      </FlagFrame>
    </svg>
  );
}

const FLAGS: Record<Locale, (props: { clipId: string }) => ReactElement> = {
  'en-US': UsFlag,
  'es-MX': MxFlag,
  'pt-BR': BrFlag,
};

export function LocaleFlag({ locale, className }: { locale: Locale; className?: string }) {
  const Flag = FLAGS[locale];
  const clipId = useId();
  return (
    <span className={cn('inline-block h-[0.9em] w-[1.35em] shrink-0 align-middle', className)}>
      <Flag clipId={clipId} />
    </span>
  );
}
