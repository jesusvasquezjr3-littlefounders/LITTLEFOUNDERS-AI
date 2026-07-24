// Shared interaction primitives — every exercise renderer builds from these so
// look, feel and accessibility stay uniform (LESSON_ENGINE.md §4). Tap-first
// everywhere; ≥44px hit areas; keyboard/focus-visible on everything. The
// classification types (sort_buckets/group_sets) layer an ADDITIVE pointer-drag
// on top of tap (see arrange/components.tsx SortingBoard) — tap stays the
// accessible fallback, so these primitives remain tap-only by themselves.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui'
import MarkdownLite from './MarkdownLite'

export type OptionVisualState = 'idle' | 'selected' | 'correct' | 'wrong' | 'dimmed'

/** Renders a concrete item's visual: the AI illustration (`imageUrl`) when
 *  present, else the Material `icon` glyph as a fallback. The single place the
 *  "image preferred over icon" rule lives, so every exercise renderer (options,
 *  cards, tiles, scenes) treats generated art the same way. `iconClassName`
 *  sizes/tints the fallback glyph; `imgClassName` sizes the image box. */
export function VisualMark({
  icon,
  imageUrl,
  iconClassName,
  imgClassName = 'h-12 w-12',
  alt = '',
}: {
  icon?: string
  imageUrl?: string
  iconClassName?: string
  imgClassName?: string
  alt?: string
}) {
  if (imageUrl) {
    return <img src={imageUrl} alt={alt} loading="lazy" className={cn('rounded-md object-contain', imgClassName)} />
  }
  return <Icon name={icon ?? 'help'} className={iconClassName} />
}

/** Full-width "scene anchor" illustration shown above a segment's prompt (the
 *  concrete situation the exercise is about). Rendered by the player shell from
 *  `segment.image_url`; capped in height so it frames rather than dominates. */
export function SceneAnchor({ imageUrl, className }: { imageUrl: string; className?: string }) {
  return (
    <img
      src={imageUrl}
      alt=""
      loading="lazy"
      className={cn('mx-auto max-h-52 w-full rounded-lg object-contain sm:max-h-64', className)}
    />
  )
}

export function optionStateClasses(state: OptionVisualState): string {
  switch (state) {
    case 'selected':
      return 'border-primary bg-primary-soft text-content shadow-glass-sm'
    case 'correct':
      return 'border-success bg-success-soft text-content'
    case 'wrong':
      return 'border-error bg-error-soft text-content'
    case 'dimmed':
      return 'border-outline/50 bg-surface text-content-muted opacity-60'
    default:
      return 'border-outline/70 bg-surface text-content hover:border-primary/60'
  }
}

export interface OptionCardProps {
  state?: OptionVisualState
  onSelect?: () => void
  disabled?: boolean
  children: ReactNode
  className?: string
  /** multi-select semantics → aria-pressed; single-select handled by parent radiogroup. */
  role?: 'button' | 'radio' | 'checkbox'
  ariaChecked?: boolean
}

/** The universal tappable card. */
export function OptionCard({
  state = 'idle',
  onSelect,
  disabled,
  children,
  className,
  role = 'button',
  ariaChecked,
}: OptionCardProps) {
  return (
    <button
      type="button"
      role={role === 'button' ? undefined : role}
      aria-checked={role === 'button' ? undefined : ariaChecked}
      aria-pressed={role === 'button' ? state === 'selected' : undefined}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'min-h-11 w-full rounded-md border-2 px-4 py-3 text-left lf-body font-semibold',
        'transition-[border-color,background-color,transform] duration-150',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        'active:translate-y-px disabled:cursor-not-allowed',
        optionStateClasses(state),
        className,
      )}
    >
      {children}
    </button>
  )
}

/** Compact tappable token (word tiles, bank items, coins…). */
export function TokenChip({
  state = 'idle',
  onSelect,
  disabled,
  children,
  className,
}: OptionCardProps) {
  return (
    <button
      type="button"
      aria-pressed={state === 'selected'}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'inline-flex min-h-11 items-center justify-center rounded-full border-2 px-4 py-2 lf-label',
        'transition-[border-color,background-color,transform] duration-150',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        'active:translate-y-px disabled:cursor-not-allowed',
        optionStateClasses(state),
        className,
      )}
    >
      {children}
    </button>
  )
}

/** Sunken well — drop targets, trays, banks. */
export function SunkenWell({
  children,
  className,
  active,
}: {
  children: ReactNode
  className?: string
  active?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-lg border-2 border-dashed bg-surface-sunken p-3',
        active ? 'border-primary' : 'border-outline/60',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** Big visual tile for picture_choice / scenes. Prefers a generated illustration
 *  (`imageUrl`, Forge image pipeline) over the Material icon when provided. */
export function BigIconTile({
  icon,
  imageUrl,
  label,
  tint,
  state = 'idle',
  onSelect,
  disabled,
  className,
}: {
  icon: string
  imageUrl?: string
  label?: string
  tint?: 'primary' | 'accent' | 'success' | 'warning' | 'delight'
  state?: OptionVisualState
  onSelect?: () => void
  disabled?: boolean
  className?: string
}) {
  const tintClass = {
    primary: 'text-primary',
    accent: 'text-accent',
    success: 'text-success-strong',
    warning: 'text-warning-strong',
    delight: 'text-secondary',
  }[tint ?? 'primary']
  return (
    <button
      type="button"
      aria-pressed={state === 'selected'}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'flex min-h-11 flex-col items-center justify-center gap-2 rounded-lg border-2 p-4',
        'transition-[border-color,background-color,transform] duration-150',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        'active:translate-y-px disabled:cursor-not-allowed',
        optionStateClasses(state),
        className,
      )}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          className="h-20 w-20 rounded-md object-contain md:h-24 md:w-24"
        />
      ) : (
        <Icon name={icon} className={cn('text-[40px]', tintClass)} />
      )}
      {label ? <span className="lf-label text-center">{label}</span> : null}
    </button>
  )
}

/** Kid number pad — the standard numeric input surface. */
export function NumberPad({
  value,
  onChange,
  allowDecimal,
  maxLength = 8,
  disabled,
}: {
  value: string
  onChange: (next: string) => void
  allowDecimal?: boolean
  maxLength?: number
  disabled?: boolean
}) {
  const { t } = useTranslation()
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', allowDecimal ? '.' : '', '0', '⌫']
  return (
    <div className="mx-auto grid w-full max-w-xs grid-cols-3 gap-2" role="group" aria-label={t('lesson.numberPad.label')}>
      {keys.map((k, i) =>
        k === '' ? (
          <span key={i} />
        ) : (
          <button
            key={i}
            type="button"
            disabled={disabled}
            aria-label={k === '⌫' ? t('lesson.numberPad.delete') : k}
            onClick={() => {
              if (k === '⌫') onChange(value.slice(0, -1))
              else if (k === '.' && value.includes('.')) return
              else if (value.length < maxLength) onChange(value + k)
            }}
            className={cn(
              'min-h-12 rounded-md border-2 border-outline/70 bg-surface lf-title text-content',
              'transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              'hover:border-primary/60 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60',
            )}
          >
            {k}
          </button>
        ),
      )}
    </div>
  )
}

/** Big slider with a live value bubble. */
export function KidSlider({
  min,
  max,
  step = 1,
  value,
  onChange,
  disabled,
  format,
}: {
  min: number
  max: number
  step?: number
  value: number
  onChange: (v: number) => void
  disabled?: boolean
  format?: (v: number) => string
}) {
  return (
    <div className="space-y-3">
      <div className="text-center">
        <span className="inline-block rounded-full bg-primary-soft px-4 py-1.5 lf-title text-primary">
          {format ? format(value) : value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-11 w-full cursor-pointer accent-[rgb(var(--lf-primary))]"
      />
    </div>
  )
}

/** Friendly countdown bar for timed flows. Pausable by design (kid-gentle). */
export function GentleTimerBar({
  seconds,
  running,
  onExpire,
}: {
  seconds: number
  running: boolean
  onExpire: () => void
}) {
  const { t } = useTranslation()
  const [left, setLeft] = useState(seconds)
  const expired = useRef(false)
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      setLeft((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(id)
  }, [running])
  // Fire onExpire once, from an EFFECT after commit — never inside the setLeft
  // updater, which runs during render and triggered React's "cannot update a
  // component while rendering a different component" warning (E8).
  useEffect(() => {
    if (running && left === 0 && !expired.current) {
      expired.current = true
      onExpire()
    }
  }, [running, left, onExpire])
  const pct = Math.round((left / seconds) * 100)
  return (
    <div aria-label={t('lesson.timer.secondsLeft', { count: left })} className="space-y-1">
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-sunken">
        <div
          className={cn('h-full rounded-full transition-[width] duration-1000 ease-linear', pct > 33 ? 'bg-primary' : 'bg-warning-strong')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="lf-caption text-content-muted text-right">{t('lesson.timer.secondsLeft', { count: left })}</p>
    </div>
  )
}

/** Prompt block shown above every exercise body. */
export function PromptBlock({ text, className }: { text: string; className?: string }) {
  return <MarkdownLite text={text} className={cn('lf-title text-content', className)} />
}
