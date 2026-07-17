import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui'
import CharacterActor from '@/components/characters/control/CharacterActor'
import type { CharacterId } from '@/components/characters/control/types'
import { localizedText, type LessonNode } from './types'

/*
 * One 3D "candy" node on the winding lesson path — the v1 caminito look
 * (main: LessonPath.tsx TopicNode): a pressed-button circle with a fat
 * bottom border that squashes on :active, gold once passed, a pulsing ring
 * + bouncing "Start here" beacon on the current node, and an ambient canon
 * character floating beside wave-peak nodes. Appearance rules per DESIGN.md
 * tokens; the wave offset comes from SagaSection's fixed pattern.
 */

const STATE_CLASSES: Record<LessonNode['state'], string> = {
  // Gold for done (v1's amber), accent for current, primary outline for available.
  passed: 'bg-warning text-on-warning border-b-warning-strong',
  current: 'bg-accent text-on-accent border-b-accent-strong ring-4 ring-accent/30',
  available: 'bg-surface text-primary border-2 border-primary border-b-[6px] border-b-primary',
  locked: 'bg-surface-sunken text-content-faint border-b-outline',
}

interface LessonPathNodeProps {
  lesson: LessonNode
  locale: string
  courseSlug: string
  waveOffset: number
  peakCharacter: CharacterId | null
  peakSide: 'left' | 'right'
  isNextLesson: boolean
  registerRef?: (el: HTMLElement | null) => void
}

export function LessonPathNode({
  lesson,
  locale,
  courseSlug,
  waveOffset,
  peakCharacter,
  peakSide,
  isNextLesson,
  registerRef,
}: LessonPathNodeProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  // One-shot pop on mount only for the current lesson's ring (DESIGN.md §Motion
  // recipe 3, .lf-pop) — never a re-triggering/looping pulse.
  const [popped] = useState(isNextLesson)

  const clickable = lesson.state !== 'locked'
  const title = localizedText(lesson.title, locale, lesson.slug)

  function go() {
    if (!clickable) return
    navigate(`/learn/lesson/${lesson.id}`, { state: { courseSlug } })
  }

  return (
    <div className="relative z-10 flex flex-col items-center" style={{ transform: `translateX(${waveOffset}px)` }}>
      {isNextLesson && (
        <span className="lf-float mb-1 rounded-full bg-accent px-3 py-1 lf-caption font-bold text-on-accent shadow-pop">
          {t('learn.startHere')}
        </span>
      )}
      <div className="flex items-center gap-3">
        <button
          ref={registerRef as React.Ref<HTMLButtonElement>}
          type="button"
          onClick={go}
          disabled={!clickable}
          aria-label={`${title} — ${t(`learn.state.${lesson.state}`)}`}
          className={cn(
            'relative flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full border-b-[6px] shadow-glass-sm',
            'transition-[transform,border-width] duration-100 disabled:cursor-not-allowed',
            clickable && 'active:translate-y-[4px] active:border-b-[2px]',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
            STATE_CLASSES[lesson.state],
            popped && 'lf-pop',
          )}
        >
          {/* Glass highlight (v1's inset shine) */}
          <span aria-hidden="true" className="pointer-events-none absolute left-3 top-2 h-3 w-6 rounded-full bg-white/35" />
          {lesson.state === 'passed' && <Icon name="check" className="text-[30px]" />}
          {lesson.state === 'locked' && <Icon name="lock" className="text-[20px]" />}
          {(lesson.state === 'current' || lesson.state === 'available') && (
            <Icon name="star" fill className="text-[28px]" />
          )}
        </button>

        {/* Ambient mascot on wave peaks (v1 decorated patternIndex 2/6). */}
        {peakCharacter && (
          <div
            aria-hidden="true"
            className={cn('pointer-events-none absolute hidden sm:block', peakSide === 'right' ? 'left-full ml-8' : 'right-full mr-8')}
          >
            <CharacterActor character={peakCharacter} emotion="happy" action="idle" size="sm" />
          </div>
        )}
      </div>
      <div className="mt-1.5 max-w-[190px] text-center">
        <p className="lf-label truncate text-content">{title}</p>
        <span className="lf-caption lf-number text-content-muted">
          {t('learn.xp', { xp: lesson.xp_total })} · {t('learn.minutes', { count: lesson.estimated_minutes })}
        </span>
      </div>
    </div>
  )
}
