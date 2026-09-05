// Shared interaction primitives — every exercise renderer builds from these so
// look, feel and accessibility stay uniform (LESSON_ENGINE.md §4). Tap-first
// everywhere; ≥48px hit areas; keyboard/focus-visible on everything. The
// classification types (sort_buckets/group_sets) layer an ADDITIVE pointer-drag
// on top of tap (see arrange/components.tsx SortingBoard) — tap stays the
// accessible fallback, so these primitives remain tap-only by themselves.
//
// ── THE MATERIAL ─────────────────────────────────────────────────────────────
// Everything here is made of the three answer-surface objects defined in
// index.css and specified in /DESIGN.md §Answer surfaces: `.lf-well` (a place
// something goes), `.lf-slab` (an object that carries content) and `.lf-answer`
// (an object you press). Nothing in this file writes `border-2
// border-outline/70 bg-surface` any more, and neither may any renderer.
//
// WHY IT IS ITS OWN MATERIAL AND NOT ONE OF THE OTHER TWO. These components are
// the only ones in the product that render on BOTH layers: inside the Tutor
// they sit on a Lumen reading plate over a live 3D island, and in the Lesson
// Player they sit on an ordinary page. Liquid Glass over the island is the
// sticker the Lumen pass deleted; Lumen on a page is a window onto nothing, and
// Lumen inside a Lumen plate is glass on glass (/DESIGN.md §Elevation rule 6).
// So they are made of the one thing both layers publish — the scene's light,
// whose four registered properties are global and carry sane defaults — and the
// same recipe reads as the island's own hour on the stage and as neutral room
// light on a page.
//
// ── STATE IS NEVER COLOUR ALONE ──────────────────────────────────────────────
// `correct` and `wrong` carry meaning for a child, so every stated option
// prints an `AnswerMark`: an empty circle that becomes a filled CHECK when
// chosen or right and a filled CROSS when the learner's own pick was not, plus
// a screen-reader word. The colour agrees with the mark; it never carries the
// message by itself (/AGENTS.md §1.11, /DESIGN.md §Colour).

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui'
import MarkdownLite from './MarkdownLite'

export type OptionVisualState = 'idle' | 'selected' | 'correct' | 'wrong' | 'dimmed'

/**
 * Focus. Written once here rather than nine times across the families, and it
 * is `outline` rather than `ring-*` deliberately: a Tailwind `ring` compiles to
 * `box-shadow`, utilities outrank components, and a focused option would lose
 * its lip, its edge and its seat at the exact moment it is being pointed at —
 * the same trap `.lf-lumen-selected` records for the Tutor's plates.
 */
export const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'

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

/**
 * The classes for a tappable answer object in a given state — the base material
 * AND its state modifier, so a call site never has to remember both.
 *
 * It returns the MATERIAL only. Geometry (radius, padding, alignment) stays at
 * the call site, because a full-width row, a round chip and a square tile are
 * genuinely different shapes of the same object.
 */
export function optionStateClasses(state: OptionVisualState): string {
  switch (state) {
    case 'selected':
      return 'lf-answer lf-answer-selected text-content'
    case 'correct':
      return 'lf-answer lf-answer-correct text-content'
    case 'wrong':
      return 'lf-answer lf-answer-wrong text-content'
    case 'dimmed':
      return 'lf-answer lf-answer-dimmed text-content'
    default:
      return 'lf-answer text-content'
  }
}

/**
 * THE SECOND CHANNEL, and the reason it lives in a component rather than in a
 * rule nobody can enforce.
 *
 * A six-year-old, a colour-blind teenager and a phone in direct sunlight all
 * get the same three shapes: an empty ring means "not this", a check means
 * "this one", a cross means "you picked this and it is not it". The colour
 * underneath agrees with the shape and never carries the message alone.
 *
 * `shape` follows the control's own semantics — a circle for a single choice, a
 * squircle for a multi-select — so the mark also says how many answers the
 * learner is allowed to give before they have given one.
 */
export function AnswerMark({
  state,
  shape = 'radio',
  className,
}: {
  state: OptionVisualState
  shape?: 'radio' | 'checkbox'
  className?: string
}) {
  const { t } = useTranslation()
  const filled = state === 'selected' || state === 'correct' || state === 'wrong'
  const glyph = state === 'wrong' ? 'close' : 'check'
  // SELECTED gets no word: `aria-checked` / `aria-pressed` already announce it,
  // and a screen reader saying "Chosen, selected" is the audible form of the
  // duplicate label this material spent a whole pass deleting. `correct` and
  // `wrong` get one because nothing else in the tree says them at all.
  const word =
    state === 'correct' ? t('lesson.answer.correct') : state === 'wrong' ? t('lesson.answer.notThis') : null
  return (
    <>
      <span
        aria-hidden="true"
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center transition-colors',
          shape === 'radio' ? 'rounded-full' : 'rounded-sm',
          filled ? 'text-white' : 'text-transparent',
          state === 'selected' && 'bg-primary',
          state === 'correct' && 'bg-success',
          state === 'wrong' && 'bg-warning',
          !filled && 'lf-answer-mark-empty',
          state === 'dimmed' && 'opacity-60',
          className,
        )}
      >
        <Icon name={glyph} className="!text-[18px]" />
      </span>
      {word ? <span className="sr-only">{word}</span> : null}
    </>
  )
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
  /**
   * The leading state mark. Defaults ON for a real choice control and OFF for a
   * plain button, which is the honest default: a mark says "one of these", and
   * printing it beside a control that is not part of a set is a lie. Renderers
   * whose content is centred or stacked (tiles, true/false pads) pass `false`
   * — they get the same state from the ring, and from the mark's trailing twin
   * once a verdict is in.
   */
  mark?: boolean
}

/**
 * The two shapes a `TokenChip` comes in — a PROP and not a `className`, and
 * that distinction is the bug fix.
 *
 * `cn()` is a plain concatenator, not `tailwind-merge` (see `@/lib/utils`), so
 * a caller passing `rounded-md` to a component whose base says `rounded-full`
 * does not win: CSS SOURCE ORDER decides, and Tailwind emits `rounded-full`
 * after `rounded-md` and `justify-center` after `justify-start`. Two `arrange`
 * renderers had been passing exactly that pair since they were written, so a
 * placed order-step rendered as a centred capsule beside the square dashed slot
 * it was supposed to have filled. It looked deliberate and was not.
 *
 * The fix that scales is `tailwind-merge`, which is a new dependency and
 * therefore not available. The fix that is honest is to stop expressing the
 * choice as an overridable class at all: a chip either floats free in a bank
 * (`pill`) or sits IN a slot (`slot`), and only one of the two shapes is ever
 * emitted.
 */
export type TokenShape =
  /** Free-floating: a word tile, a bank item, a coin. Capsule, centred. */
  | 'pill'
  /**
   * Seated in a numbered slot or a timeline node. Squared to `rounded-md` so it
   * agrees with the `.lf-well-target` it replaces, and left-aligned so a long
   * step reads as a line of text rather than as a centred label.
   */
  | 'slot'

/** The universal tappable card. */
export function OptionCard({
  state = 'idle',
  onSelect,
  disabled,
  children,
  className,
  role = 'button',
  ariaChecked,
  mark,
}: OptionCardProps) {
  const showMark = mark ?? role !== 'button'
  return (
    <button
      type="button"
      role={role === 'button' ? undefined : role}
      aria-checked={role === 'button' ? undefined : ariaChecked}
      aria-pressed={role === 'button' ? state === 'selected' : undefined}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        // 48px, not 44. /DESIGN.md §Lumen sets the interactive floor at 48 for
        // the same reason it applies here: an answer option is the control a
        // child mis-taps most, and 44 is the floor rather than the target.
        //
        // `rounded-sm` (10px), NOT `rounded-md`. A 16 px radius on a 48 px bar
        // is most of the way to a capsule, and §Lumen's "panes, not pills" is
        // the same objection: a pill reads as a toy laid on the picture. 10 is
        // also what the concentric rule asks for — the plate is `lg` (24) with
        // 16 px of padding, so the object inside it wants 24 − 16 = 8-ish.
        'flex min-h-12 w-full items-center gap-3 rounded-sm px-4 py-3 text-left lf-body font-semibold',
        FOCUS_RING,
        optionStateClasses(state),
        className,
      )}
    >
      {showMark ? <AnswerMark state={state} shape={role === 'checkbox' ? 'checkbox' : 'radio'} /> : null}
      <span className="min-w-0 flex-1">{children}</span>
    </button>
  )
}

/**
 * Compact tappable token (word tiles, bank items, coins…).
 *
 * `caption` turns it into the design study's TWO-LINE card: a large value over
 * a small unit, in a 2px-bordered tile that thickens into the accent when
 * picked. It is opt-in rather than the default because the difference is
 * semantic, not decorative — a token with a unit ("+3 · monedas", "12 · min")
 * is a QUANTITY the learner is choosing, and a token without one is a word.
 * Seven families share this control; making the card unconditional would turn
 * every word tile into an empty two-line box.
 */
export function TokenChip({
  state = 'idle',
  onSelect,
  disabled,
  children,
  className,
  shape = 'pill',
  caption,
}: OptionCardProps & { shape?: TokenShape; caption?: string }) {
  if (caption) {
    return (
      <button
        type="button"
        aria-pressed={state === 'selected'}
        disabled={disabled}
        onClick={onSelect}
        className={cn(
          'lf-token lf-tactile min-w-12',
          state === 'selected' && 'lf-token-selected',
          FOCUS_RING,
          className,
        )}
      >
        <span className="lf-token-value lf-title lf-number">{children}</span>
        <span className="lf-token-caption lf-caption">{caption}</span>
        {state === 'correct' || state === 'wrong' ? <VerdictGlyph state={state} /> : null}
      </button>
    )
  }
  return (
    <button
      type="button"
      aria-pressed={state === 'selected'}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        // `min-w-12` as well as `min-h-12`, and the width is the half that was
        // missing. The tap floor is a floor on the TARGET, not on one of its
        // sides: a one-character chip ("5", "+", "×") is 32 px of padding
        // around a 9 px glyph, so `equation_builder`'s operator tiles and
        // `balance_scale`'s weights measured 41 px across at 48 tall — under
        // even the 44 px minimum, on the two exercises whose whole interaction
        // is tapping single characters. Set here rather than at nine call
        // sites, for the same reason the material is (/DESIGN.md §Answer
        // surfaces: 48 is the target, 44 the floor).
        'inline-flex min-h-12 min-w-12 items-center gap-1.5 px-4 py-2 lf-label',
        // Exactly one of the two is ever emitted, so there is nothing for a
        // caller's class to lose a source-order fight against.
        shape === 'slot' ? 'justify-start rounded-md text-left' : 'justify-center rounded-full',
        FOCUS_RING,
        optionStateClasses(state),
        className,
      )}
    >
      {children}
      {/* A chip is too small for a leading mark, so its verdict rides at the
          trailing edge — same two glyphs, same promise that colour is never
          the only channel. */}
      {state === 'correct' || state === 'wrong' ? (
        <VerdictGlyph state={state} />
      ) : null}
    </button>
  )
}

/**
 * The compact form of the second channel, for objects with no room for a
 * leading mark: chips, tiles, table cells.
 */
export function VerdictGlyph({ state, className }: { state: OptionVisualState; className?: string }) {
  const { t } = useTranslation()
  if (state !== 'correct' && state !== 'wrong') return null
  return (
    <>
      <span aria-hidden="true" className="inline-flex shrink-0">
        <Icon
          name={state === 'correct' ? 'check_circle' : 'cancel'}
          fill
          className={cn('!text-[18px]', state === 'correct' ? 'text-success-strong' : 'text-warning-strong', className)}
        />
      </span>
      <span className="sr-only">
        {state === 'correct' ? t('lesson.answer.correct') : t('lesson.answer.notThis')}
      </span>
    </>
  )
}

/**
 * Sunken well — drop targets, trays, banks, and the scenario a question is
 * about. `active` is for a drop target with something over it.
 *
 * `waiting` is the dashed variant, and it is a real distinction rather than a
 * style: a dash means "empty ON PURPOSE, put something here", which is the one
 * thing a solid empty box cannot say — it just looks like a component that
 * failed to load.
 */
export function SunkenWell({
  children,
  className,
  active,
  waiting,
}: {
  children: ReactNode
  className?: string
  active?: boolean
  waiting?: boolean
}) {
  return (
    <div
      data-active={active ? 'true' : undefined}
      className={cn('rounded-lg p-3', waiting ? 'lf-well-target' : 'lf-well', active && !waiting && 'lf-well-active', className)}
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
        'relative flex min-h-12 flex-col items-center justify-center gap-2 rounded-lg p-4',
        FOCUS_RING,
        optionStateClasses(state),
        className,
      )}
    >
      {/* The tile's own second channel, pinned to the corner so it never
          reflows the picture it is about. */}
      {state === 'selected' || state === 'correct' || state === 'wrong' ? (
        <span className="absolute right-2 top-2">
          <AnswerMark state={state} />
        </span>
      ) : null}
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
              // A number pad key is the one object here that is genuinely a
              // KEY: taller than a row, centred, and pressed in sequence, so it
              // gets the extra height rather than the extra width.
              'flex min-h-14 items-center justify-center rounded-md lf-title',
              FOCUS_RING,
              'disabled:opacity-60',
              optionStateClasses('idle'),
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
        <span className="lf-slab inline-block rounded-full px-4 py-1.5 lf-title text-content">
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
        className="h-12 w-full cursor-pointer accent-[rgb(var(--lf-primary))]"
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
      <div className="lf-well h-2.5 w-full overflow-hidden rounded-full">
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
