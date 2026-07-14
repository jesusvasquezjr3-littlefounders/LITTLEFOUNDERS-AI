// Cinematic day-streak celebration — shown ONCE per day, before the results
// summary, when a pass extends the streak (v1's StreakCelebration.tsx feel,
// rebuilt self-contained: CSS flame ignition + count-up + pulse rings + CSS
// sparks — no Lottie/canvas-confetti dependencies). Keyframes live in
// index.css under "lf-streak-*"; everything honors prefers-reduced-motion.

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Button, Icon } from '@/components/ui'
import { useCountUp } from './completion'

const SPARKS = [
  { left: '18%', delay: '1.1s', duration: '1.6s' },
  { left: '32%', delay: '1.35s', duration: '1.9s' },
  { left: '45%', delay: '1.2s', duration: '1.5s' },
  { left: '55%', delay: '1.5s', duration: '2.0s' },
  { left: '68%', delay: '1.25s', duration: '1.7s' },
  { left: '82%', delay: '1.45s', duration: '1.8s' },
]

export function StreakCelebration({ streakDays, onContinue }: { streakDays: number; onContinue: () => void }) {
  const { t } = useTranslation()
  const [ignited, setIgnited] = useState(false)
  const shown = useCountUp(streakDays, 1100)

  // Grayscale ember → full-color ignition at 700ms (v1 ignited at 1s).
  useEffect(() => {
    const id = setTimeout(() => setIgnited(true), 700)
    return () => clearTimeout(id)
  }, [])

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden bg-inverse px-5 text-center">
      {/* Ambient glow behind the flame once ignited */}
      <div
        aria-hidden="true"
        className={cn(
          'absolute h-[420px] w-[420px] rounded-full bg-warning/30 blur-3xl transition-opacity duration-700',
          ignited ? 'opacity-100' : 'opacity-0',
        )}
      />
      {/* Pulsing rings */}
      {ignited && (
        <>
          <span aria-hidden="true" className="lf-streak-ring absolute h-64 w-64 rounded-full border-2 border-warning/50" />
          <span aria-hidden="true" className="lf-streak-ring absolute h-64 w-64 rounded-full border-2 border-warning/30" style={{ animationDelay: '0.6s' }} />
        </>
      )}
      {/* Rising sparks */}
      {ignited &&
        SPARKS.map((s, i) => (
          <span
            key={i}
            aria-hidden="true"
            className="lf-streak-spark absolute bottom-24 h-2 w-2 rounded-full bg-warning"
            style={{ left: s.left, animationDelay: s.delay, animationDuration: s.duration }}
          />
        ))}

      <div className="relative flex flex-col items-center gap-2">
        <Icon
          name="local_fire_department"
          fill
          className={cn(
            'lf-streak-flame text-[140px] transition-[color,filter,transform] duration-700',
            ignited ? 'text-warning drop-shadow-[0_0_28px_rgba(255,140,0,0.55)]' : 'scale-90 text-content-faint grayscale',
          )}
        />
        <p
          className={cn(
            'lf-number font-black leading-none transition-colors duration-700',
            ignited ? 'lf-streak-number text-warning' : 'text-content-faint',
          )}
          style={{ fontSize: 'clamp(88px, 22vw, 132px)' }}
        >
          {shown}
        </p>
        <h2 className="lf-display-lg text-on-inverse">{t('lesson.streak.title', { count: streakDays })}</h2>
        <p className="lf-body max-w-sm text-on-inverse/70">{t('lesson.streak.body')}</p>
      </div>

      <Button variant="primary" onClick={onContinue} className="relative z-10 mt-10 px-10">
        {t('lesson.streak.continue')}
      </Button>
    </div>
  )
}

export default StreakCelebration
