// Shared decorative primitives for the adventure scenes — illustration
// assets, exempt from the semantic-token rule (see scenes.css header).
// Internal to scenes/, not part of the public SCENES registry.
import { cn } from '@/lib/utils'

export function Atmosphere() {
  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      <div className="absolute inset-x-0 top-0 h-2/5 bg-gradient-to-b from-white/15 to-transparent" />
      <div className="absolute inset-x-0 bottom-[24%] h-1/3 bg-gradient-to-t from-white/10 to-transparent blur-lg" />
      <div className="absolute inset-0 bg-[radial-gradient(125%_105%_at_50%_28%,transparent_50%,rgba(0,0,0,0.34)_100%)]" />
    </div>
  )
}

export function Celestial({ className = '' }: { className?: string }) {
  return (
    <div className={cn('absolute z-[2] h-14 w-14', className)}>
      {/* Sun — light mode */}
      <div className="absolute inset-0 dark:hidden">
        <div className="absolute -inset-6 animate-[lf-scene-pulse-soft_4s_ease-in-out_infinite] rounded-full bg-amber-300/40 blur-2xl" />
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_30%,#fff7cc,#ffd24d_55%,#fb9d2e)] shadow-[0_0_28px_rgba(253,200,80,.75),0_0_64px_rgba(253,170,50,.35)]" />
      </div>
      {/* Moon — dark mode */}
      <div className="absolute inset-0 hidden dark:block">
        <div className="absolute -inset-5 animate-[lf-scene-pulse-soft_4s_ease-in-out_infinite] rounded-full bg-sky-100/20 blur-2xl" />
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_30%,#fdfdff,#d7def0_58%,#b9c2da)] shadow-[0_0_22px_rgba(214,226,255,.5),0_0_54px_rgba(150,170,220,.28)]">
          <div className="absolute left-3 top-2.5 h-2 w-2 rounded-full bg-slate-900/10" />
          <div className="absolute left-7 top-6 h-3 w-3 rounded-full bg-slate-900/10" />
        </div>
      </div>
    </div>
  )
}

const STAR_DOTS = [
  { top: '14%', left: '22%', delay: '0s' },
  { top: '26%', left: '68%', delay: '0.6s' },
  { top: '42%', left: '44%', delay: '1.2s' },
  { top: '11%', left: '84%', delay: '1.8s' },
  { top: '56%', left: '13%', delay: '0.3s' },
]

/** Organic starfield. `alwaysOn` keeps stars visible in light mode too (deep space). */
export function StarField({ alwaysOn = false }: { alwaysOn?: boolean }) {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden">
      <div
        className={cn(
          'absolute inset-0 bg-[radial-gradient(1.6px_1.6px_at_18%_24%,rgba(255,255,255,.95),transparent_60%),radial-gradient(1px_1px_at_62%_18%,rgba(255,255,255,.7),transparent_60%),radial-gradient(1.6px_1.6px_at_82%_56%,rgba(255,255,255,.85),transparent_60%),radial-gradient(1px_1px_at_34%_66%,rgba(255,255,255,.6),transparent_60%),radial-gradient(1.2px_1.2px_at_48%_42%,rgba(255,255,255,.55),transparent_60%),radial-gradient(1.6px_1.6px_at_90%_22%,rgba(255,255,255,.9),transparent_60%),radial-gradient(1px_1px_at_10%_80%,rgba(255,255,255,.6),transparent_60%)]',
          alwaysOn ? 'opacity-90' : 'opacity-0 dark:opacity-90',
        )}
      />
      <div className={alwaysOn ? 'opacity-100' : 'opacity-0 dark:opacity-100'}>
        {STAR_DOTS.map((s, i) => (
          <span
            key={i}
            className="absolute h-[3px] w-[3px] animate-[lf-scene-twinkle_2.6s_ease-in-out_infinite] rounded-full bg-white shadow-[0_0_7px_rgba(255,255,255,.95)]"
            style={{ top: s.top, left: s.left, animationDelay: s.delay }}
          />
        ))}
      </div>
    </div>
  )
}

export function Birds({ className = '' }: { className?: string }) {
  return (
    <svg
      className={cn('absolute z-[2] animate-[lf-scene-bird_9s_ease-in-out_infinite_alternate] text-slate-700/45 dark:text-white/40', className)}
      width="46"
      height="16"
      viewBox="0 0 46 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M2 9 Q7 3 12 9 Q17 3 22 9" />
      <path d="M25 12 Q29 7 33 12 Q37 7 41 12" />
    </svg>
  )
}

interface TowerProps {
  className: string
  from: string
  to: string
  lit?: number[]
}

/** A city tower with a gradient body and a grid of windows — some lit warm at night. */
export function Tower({ className, from, to, lit = [] }: TowerProps) {
  return (
    <div
      className={cn('absolute overflow-hidden rounded-t-[10px] shadow-[5px_0_10px_rgba(0,0,0,0.15)]', className)}
      style={{ backgroundImage: `linear-gradient(to bottom, ${from}, ${to})` }}
    >
      <div className="absolute inset-x-2 top-3 grid grid-cols-3 gap-1.5">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-2 rounded-[2px]',
              lit.includes(i) ? 'bg-[rgba(255,214,110,0.9)] shadow-[0_0_6px_rgba(255,196,60,.7)]' : 'bg-white/15 dark:bg-white/[0.07]',
            )}
          />
        ))}
      </div>
    </div>
  )
}

/** A simple pine silhouette (border-triangle stack + trunk) — forest/valley/kingdom. */
export function Pine({ className = '', scale = 1, color = '#2e7d32' }: { className?: string; scale?: number; color?: string }) {
  return (
    <div className={cn('absolute', className)} style={{ transform: `scale(${scale})` }}>
      <div className="mx-auto h-0 w-0 border-x-[18px] border-b-[26px] border-x-transparent" style={{ borderBottomColor: color }} />
      <div className="-mt-3 h-0 w-0 border-x-[22px] border-b-[28px] border-x-transparent" style={{ borderBottomColor: color }} />
      <div className="mx-auto h-4 w-2.5 rounded-b bg-[#5d4037]" />
    </div>
  )
}
