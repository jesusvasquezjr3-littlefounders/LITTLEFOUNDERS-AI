// `arrange` family renderers (LESSON_ENGINE.md §5.4). Tap-first everywhere:
// tap a token → it fills the next slot; tap a placed token → it returns to the
// bank. All input types are controlled; the shell owns the Check button.
// memory_flip is the family's one flow and drives itself. The classification
// types (sort_buckets/group_sets) also support real pointer-drag via the shared
// SortingBoard — additive over tap, which stays the accessible fallback.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui'
import type { ExerciseProps, SegmentBase } from '../../core/types'
import MarkdownLite from '../../core/MarkdownLite'
import { KidSlider, SunkenWell, TokenChip, VisualMark, optionStateClasses, type OptionVisualState } from '../../core/primitives'
import { seededSort } from '../../core/shuffle'
import { playSfx } from '../../player/sfx'

type Dict = Record<string, unknown>
const draftOf = (v: unknown): Dict => (typeof v === 'object' && v !== null ? (v as Dict) : {})

interface IdTextItem {
  id: string
  text_md: string
}

// A concrete item that MAY carry a visual (idVisual schema): an AI illustration
// (`image_url`, preferred) or a Material `icon` fallback. Optional, so plain
// text-only items (idText) stay assignable here.
interface IdVisualItem extends IdTextItem {
  icon?: string
  image_url?: string
}

function revealOf(verdict: ExerciseProps['verdict']): Dict {
  return draftOf(verdict?.reveal)
}

function textOf(items: IdTextItem[], id: string): string {
  return items.find((i) => i.id === id)?.text_md ?? id
}

/** Chip/slot content for a concrete item: its picture (image preferred over the
 *  icon) stacked above the text label. Falls back to text-only when the item
 *  carries neither an image nor an icon (§ keep current text-only rendering). */
function VisualLabel({
  item,
  imgClassName,
  iconClassName,
}: {
  item: IdVisualItem
  imgClassName?: string
  iconClassName?: string
}) {
  if (!item.image_url && !item.icon) return <MarkdownLite text={item.text_md} />
  return (
    <span className="flex flex-col items-center gap-1">
      <VisualMark
        icon={item.icon}
        imageUrl={item.image_url}
        iconClassName={iconClassName}
        imgClassName={imgClassName}
      />
      <MarkdownLite text={item.text_md} />
    </span>
  )
}

// ---- Shared tap-to-order helpers (order_steps / rank_choices / build_sentence /
// ---- timeline_order all share the same draft shape: { order: string[] }) ---------

interface TapOrder {
  order: string[]
  remaining: IdTextItem[]
  place: (id: string) => void
  remove: (id: string) => void
}

function useTapOrder(items: IdTextItem[], value: unknown, onChange: (d: unknown) => void): TapOrder {
  const order = (draftOf(value).order as string[] | undefined) ?? []
  const placed = new Set(order)
  return {
    order,
    remaining: items.filter((i) => !placed.has(i.id)),
    place: (id) => onChange({ order: [...order, id] }),
    remove: (id) => onChange({ order: order.filter((x) => x !== id) }),
  }
}

/** Verdict paint for one ordered slot: exact-position check against reveal.order. */
function slotState(
  index: number,
  order: string[],
  verdict: ExerciseProps['verdict'],
  correctOrder: string[] | undefined,
): OptionVisualState {
  if (verdict && correctOrder) {
    return order[index] === correctOrder[index] ? 'correct' : 'wrong'
  }
  return 'selected'
}

/** The bank of not-yet-placed tokens. Tap one → it goes to the next slot. */
function TokenBank({
  items,
  onPlace,
  disabled,
  verdict,
}: {
  items: IdVisualItem[]
  onPlace: (id: string) => void
  disabled: boolean
  verdict: ExerciseProps['verdict']
}) {
  const { t } = useTranslation()
  if (items.length === 0) return null
  return (
    <div className="space-y-1">
      <p className="lf-label text-content-muted">{t('lesson.families.arrange.bank')}</p>
      <SunkenWell>
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <TokenChip
              key={item.id}
              state={verdict ? 'dimmed' : 'idle'}
              disabled={disabled}
              onSelect={() => onPlace(item.id)}
            >
              <VisualLabel item={item} imgClassName="h-10 w-10" iconClassName="text-[24px]" />
            </TokenChip>
          ))}
        </div>
      </SunkenWell>
    </div>
  )
}

/** Numbered slot list (order_steps / rank_choices). Tap a placed token → back to bank. */
function OrderedSlots({
  items,
  tapOrder,
  total,
  disabled,
  verdict,
}: {
  items: IdVisualItem[]
  tapOrder: TapOrder
  total: number
  disabled: boolean
  verdict: ExerciseProps['verdict']
}) {
  const { t } = useTranslation()
  const correctOrder = revealOf(verdict).order as string[] | undefined
  return (
    <ol className="space-y-2">
      {Array.from({ length: total }, (_, i) => {
        const id = tapOrder.order[i]
        const item = id ? items.find((it) => it.id === id) : undefined
        return (
          <li key={i} className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft lf-label text-primary"
            >
              {i + 1}
            </span>
            {id && item ? (
              <TokenChip
                state={slotState(i, tapOrder.order, verdict, correctOrder)}
                disabled={disabled}
                onSelect={() => tapOrder.remove(id)}
                className="flex-1 justify-start rounded-md text-left"
              >
                <VisualLabel item={item} imgClassName="h-10 w-10" iconClassName="text-[24px]" />
              </TokenChip>
            ) : (
              <div
                aria-label={t('lesson.families.arrange.slot', { index: i + 1 })}
                className="min-h-11 flex-1 rounded-md border-2 border-dashed border-outline/60 bg-surface-sunken"
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}

// ---- match_pairs -----------------------------------------------------------------

const PAIR_TINTS = [
  'border-primary bg-primary-soft',
  'border-accent bg-accent-soft',
  'border-secondary bg-secondary-soft',
  'border-delight bg-delight-soft',
  'border-warning bg-warning-soft',
] as const

const CHIP_BASE =
  'min-h-11 w-full rounded-md border-2 px-3 py-2 text-left lf-body font-semibold text-content ' +
  'transition-[border-color,background-color,transform] duration-150 ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ' +
  'active:translate-y-px disabled:cursor-not-allowed'

function pairChipClass(
  paired: number,
  selected: boolean,
  verdictState: OptionVisualState | null,
): string {
  if (verdictState === 'correct') return 'border-success bg-success-soft'
  if (verdictState === 'wrong') return 'border-error bg-error-soft'
  if (verdictState === 'dimmed') return 'border-outline/50 bg-surface opacity-60'
  if (paired >= 0) return PAIR_TINTS[paired % PAIR_TINTS.length] as string
  if (selected) return 'border-primary bg-primary-soft shadow-glass-sm'
  return 'border-outline/70 bg-surface hover:border-primary/60'
}

export function MatchPairs({ segment, value, onChange, disabled, verdict }: ExerciseProps) {
  const { t } = useTranslation()
  const draft = draftOf(value)
  const pairs = (draft.pairs as [string, string][] | undefined) ?? []
  const selectedLeft = draft.selected_left as string | undefined
  const left = segment.payload.left as IdVisualItem[]
  // Shuffle the right column (A7): rendered in payload order it sat parallel to
  // the answer key, so "match straight across" scored 100 without reasoning.
  const right = useMemo(
    () => seededSort(segment.payload.right as IdTextItem[], segment.id + ':right', (r) => r.id),
    [segment],
  )
  const correctPairs = revealOf(verdict).pairs as [string, string][] | undefined
  const correctByLeft = correctPairs ? new Map(correctPairs) : null

  const pairIndexOfLeft = (id: string) => pairs.findIndex((p) => p[0] === id)
  const pairIndexOfRight = (id: string) => pairs.findIndex((p) => p[1] === id)

  const breakPair = (index: number) =>
    onChange({ ...draft, selected_left: undefined, pairs: pairs.filter((_, i) => i !== index) })

  const verdictStateForPair = (index: number): OptionVisualState | null => {
    if (!verdict || !correctByLeft) return null
    const pair = pairs[index]
    if (!pair) return null
    return correctByLeft.get(pair[0]) === pair[1] ? 'correct' : 'wrong'
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          {left.map((item) => {
            const paired = pairIndexOfLeft(item.id)
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={selectedLeft === item.id || paired >= 0}
                disabled={disabled}
                onClick={() => {
                  if (paired >= 0) breakPair(paired)
                  else
                    onChange({
                      ...draft,
                      selected_left: selectedLeft === item.id ? undefined : item.id,
                    })
                }}
                className={cn(
                  CHIP_BASE,
                  pairChipClass(paired, selectedLeft === item.id, verdictStateForPair(paired)),
                )}
              >
                {item.image_url || item.icon ? (
                  <span className="flex items-center gap-2">
                    <VisualMark
                      icon={item.icon}
                      imageUrl={item.image_url}
                      iconClassName="text-[24px]"
                      imgClassName="h-10 w-10"
                    />
                    <MarkdownLite text={item.text_md} />
                  </span>
                ) : (
                  <MarkdownLite text={item.text_md} />
                )}
              </button>
            )
          })}
        </div>
        <div className="space-y-2">
          {right.map((item) => {
            const paired = pairIndexOfRight(item.id)
            let vState: OptionVisualState | null = null
            if (verdict && correctByLeft) {
              vState = paired >= 0 ? verdictStateForPair(paired) : 'dimmed'
            }
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={paired >= 0}
                disabled={disabled || (!selectedLeft && paired < 0)}
                onClick={() => {
                  if (paired >= 0) breakPair(paired)
                  else if (selectedLeft)
                    onChange({
                      ...draft,
                      selected_left: undefined,
                      pairs: [...pairs, [selectedLeft, item.id]],
                    })
                }}
                className={cn(CHIP_BASE, pairChipClass(paired, false, vState))}
              >
                <MarkdownLite text={item.text_md} />
              </button>
            )
          })}
        </div>
      </div>
      {!verdict ? (
        <p className="lf-caption text-content-muted">{t('lesson.families.arrange.matchPairs.help')}</p>
      ) : null}
    </div>
  )
}

// ---- memory_flip (flow) --------------------------------------------------------------

interface FlipCard {
  key: string
  pairIndex: number
  text_md: string
  icon: string
  image_url?: string
}

interface MemoryFlipPair {
  a_md: string
  a_icon: string
  a_image_url?: string
  b_md: string
  b_icon: string
  b_image_url?: string
}

export function MemoryFlip({ segment, disabled, onFinish, verdict }: ExerciseProps) {
  const { t } = useTranslation()
  const pairs = segment.payload.pairs as MemoryFlipPair[]
  const cards = useMemo<FlipCard[]>(() => {
    const all = pairs.flatMap((p, i) => [
      { key: `a${i}`, pairIndex: i, text_md: p.a_md, icon: p.a_icon || 'help', image_url: p.a_image_url },
      { key: `b${i}`, pairIndex: i, text_md: p.b_md, icon: p.b_icon || 'help', image_url: p.b_image_url },
    ])
    // Deterministic shuffle by segment.id hash so retries keep the same board.
    return seededSort(all, segment.id, (a) => a.key)
  }, [pairs, segment.id])

  const [up, setUp] = useState<string[]>([])
  const [matched, setMatched] = useState<number[]>([])
  const [flips, setFlips] = useState(0)
  const finished = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  useEffect(() => {
    if (matched.length === pairs.length && !finished.current && onFinish) {
      finished.current = true
      onFinish({ flips, pairs: pairs.length })
    }
  }, [matched, pairs.length, flips, onFinish])

  const tap = (card: FlipCard) => {
    if (disabled || verdict || finished.current) return
    if (up.length >= 2 || up.includes(card.key) || matched.includes(card.pairIndex)) return
    playSfx('flip')
    setFlips((f) => f + 1)
    const nextUp = [...up, card.key]
    setUp(nextUp)
    if (nextUp.length === 2) {
      const [k1, k2] = nextUp
      const c1 = cards.find((c) => c.key === k1)
      const c2 = cards.find((c) => c.key === k2)
      if (c1 && c2 && c1.pairIndex === c2.pairIndex) {
        playSfx('match')
        setMatched((m) => [...m, c1.pairIndex])
        setUp([])
      } else {
        timer.current = setTimeout(() => setUp([]), 900)
      }
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {cards.map((card) => {
          const isMatched = matched.includes(card.pairIndex) || Boolean(verdict)
          const isUp = isMatched || up.includes(card.key)
          return (
            <button
              key={card.key}
              type="button"
              aria-label={isUp ? undefined : t('lesson.families.arrange.memoryFlip.hiddenCard')}
              disabled={disabled || isMatched || Boolean(verdict)}
              onClick={() => tap(card)}
              className={cn(
                'flex min-h-24 flex-col items-center justify-center gap-1 rounded-lg border-2 p-2 text-center lf-label',
                'transition-[border-color,background-color,transform] duration-150',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                'active:translate-y-px disabled:cursor-not-allowed',
                isMatched
                  ? 'border-success bg-success-soft text-content'
                  : isUp
                    ? 'border-primary bg-surface text-content'
                    : 'border-outline/70 bg-primary-soft text-primary',
              )}
            >
              {isUp ? (
                <>
                  {card.image_url ? (
                    <img
                      src={card.image_url}
                      alt=""
                      loading="lazy"
                      className="h-12 w-12 rounded-md object-contain"
                    />
                  ) : (
                    <Icon name={card.icon} className="text-[28px]" />
                  )}
                  <MarkdownLite text={card.text_md} />
                </>
              ) : (
                <Icon name="question_mark" className="text-[28px]" />
              )}
            </button>
          )
        })}
      </div>
      <p className="lf-caption text-content-muted text-center">
        {t('lesson.families.arrange.memoryFlip.flips', { count: flips })}
      </p>
    </div>
  )
}

// ---- sorting board (sort_buckets / group_sets) — TAP or DRAG to place --------------

interface SortZone {
  id: string
  label: string
}

interface SortDragState {
  itemId: string
  x: number
  y: number
}

/**
 * Pointer-events drag for the classification types, ADDITIVE over tap-to-place:
 * a quick tap still selects a chip, but a press-and-drag moves it straight into
 * the drop zone under the pointer (the "arrástralo" feel the QA asked for).
 * Dependency-free (no DnD library — keeps the frontend deps lean); keyboard and
 * tap remain the accessible fallback since drag is a mouse/touch-only nicety
 * (§1.11 — no affordance is drag-ONLY).
 */
function useSortingDrag(onDrop: (itemId: string, zoneId: string) => void, disabled: boolean) {
  const [drag, setDrag] = useState<SortDragState | null>(null)
  const [hoverZone, setHoverZone] = useState<string | null>(null)
  const active = useRef<{ itemId: string; x0: number; y0: number; moved: boolean; pointerId: number } | null>(null)
  const suppressClick = useRef(false)

  const zoneAt = (x: number, y: number): string | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null
    return el?.closest<HTMLElement>('[data-dropzone]')?.dataset.dropzone ?? null
  }

  const onMove = useCallback((e: globalThis.PointerEvent) => {
    const a = active.current
    if (!a || e.pointerId !== a.pointerId) return
    if (!a.moved && Math.hypot(e.clientX - a.x0, e.clientY - a.y0) < 6) return
    a.moved = true
    e.preventDefault() // stop touch-scroll once a real drag starts
    setDrag({ itemId: a.itemId, x: e.clientX, y: e.clientY })
    setHoverZone(zoneAt(e.clientX, e.clientY))
  }, [])

  const onEnd = useCallback(
    (e: globalThis.PointerEvent) => {
      const a = active.current
      if (!a || e.pointerId !== a.pointerId) return
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onEnd)
      window.removeEventListener('pointercancel', onEnd)
      if (a.moved) {
        const zone = zoneAt(e.clientX, e.clientY)
        if (zone) {
          playSfx('drop')
          onDrop(a.itemId, zone)
        }
        // Swallow ONLY the click the browser fires in this same gesture (when the
        // drag ended on the origin chip). Auto-clear on the next tick so that a
        // drag ending over a bucket (which fires NO click) doesn't leave the
        // guard stuck and eat the user's next genuine tap.
        suppressClick.current = true
        window.setTimeout(() => {
          suppressClick.current = false
        }, 0)
      }
      active.current = null
      setDrag(null)
      setHoverZone(null)
    },
    [onDrop, onMove],
  )

  useEffect(
    () => () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onEnd)
      window.removeEventListener('pointercancel', onEnd)
    },
    [onMove, onEnd],
  )

  const onPointerDown = (itemId: string) => (e: PointerEvent) => {
    if (disabled || e.button !== 0) return
    active.current = { itemId, x0: e.clientX, y0: e.clientY, moved: false, pointerId: e.pointerId }
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onEnd)
    window.addEventListener('pointercancel', onEnd)
  }

  const onClickCapture = (e: ReactMouseEvent) => {
    if (suppressClick.current) {
      // Don't reset here — the timer in onEnd owns the lifetime, so a drag that
      // ends off-chip (no click) still clears the guard.
      e.preventDefault()
      e.stopPropagation()
    }
  }

  return { drag, hoverZone, onPointerDown, onClickCapture }
}

/** A classification chip: same look as TokenChip, plus drag handlers. */
function SortChip({
  state,
  disabled,
  dragging,
  onSelect,
  onPointerDown,
  onClickCapture,
  children,
}: {
  state: OptionVisualState
  disabled: boolean
  dragging: boolean
  onSelect: () => void
  onPointerDown: (e: PointerEvent) => void
  onClickCapture: (e: ReactMouseEvent) => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={state === 'selected'}
      disabled={disabled}
      onClick={onSelect}
      onClickCapture={onClickCapture}
      onPointerDown={onPointerDown}
      style={{ touchAction: 'none' }}
      className={cn(
        'inline-flex min-h-11 items-center justify-center rounded-full border-2 px-4 py-2 lf-label',
        'transition-[border-color,background-color,transform,opacity] duration-150',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        'active:translate-y-px disabled:cursor-not-allowed',
        !disabled && 'cursor-grab',
        optionStateClasses(state),
        dragging && 'opacity-30',
      )}
    >
      {children}
    </button>
  )
}

/** The shared board behind sort_buckets and group_sets — identical UX, one impl. */
function SortingBoard({
  items,
  zones,
  assignments,
  selected,
  disabled,
  correct,
  hasVerdict,
  onSelect,
  onAssign,
  onUnassign,
}: {
  items: IdVisualItem[]
  zones: SortZone[]
  assignments: Record<string, string>
  selected: string | undefined
  disabled: boolean
  correct: Record<string, string> | undefined
  hasVerdict: boolean
  onSelect: (itemId: string | undefined) => void
  onAssign: (itemId: string, zoneId: string) => void
  onUnassign: (itemId: string) => void
}) {
  const { t } = useTranslation()
  const { drag, hoverZone, onPointerDown, onClickCapture } = useSortingDrag(onAssign, disabled)
  const unassigned = items.filter((i) => !assignments[i.id])
  const textById = (id: string) => items.find((i) => i.id === id)?.text_md ?? id

  return (
    <div className="space-y-4">
      {unassigned.length > 0 ? (
        <div className="space-y-2">
          {!disabled ? <p className="lf-caption text-content-muted">{t('lesson.families.arrange.dragHint')}</p> : null}
          <SunkenWell>
            <div className="flex flex-wrap gap-2">
              {unassigned.map((item) => (
                <SortChip
                  key={item.id}
                  state={selected === item.id ? 'selected' : 'idle'}
                  disabled={disabled}
                  dragging={drag?.itemId === item.id}
                  onSelect={() => onSelect(selected === item.id ? undefined : item.id)}
                  onPointerDown={onPointerDown(item.id)}
                  onClickCapture={onClickCapture}
                >
                  <VisualLabel item={item} imgClassName="h-10 w-10" iconClassName="text-[24px]" />
                </SortChip>
              ))}
            </div>
          </SunkenWell>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {zones.map((zone) => {
          const isHover = hoverZone === zone.id
          const placed = items.filter((i) => assignments[i.id] === zone.id)
          return (
            <div
              key={zone.id}
              data-dropzone={zone.id}
              className={cn(
                'rounded-lg border-2 border-dashed bg-surface-sunken p-3 transition-colors',
                isHover
                  ? 'border-primary bg-primary-soft/40'
                  : selected || drag
                    ? 'border-primary/60'
                    : 'border-outline/60',
              )}
            >
              <button
                type="button"
                disabled={disabled || !selected}
                onClick={() => selected && onAssign(selected, zone.id)}
                className={cn(
                  'min-h-11 w-full rounded-sm px-2 text-center transition-colors',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                  'disabled:cursor-default',
                  selected ? 'bg-primary-soft text-primary' : 'text-content',
                )}
              >
                <span className="lf-title">{zone.label}</span>
                {selected || drag ? (
                  <span className="block lf-caption">{t('lesson.families.arrange.sortBuckets.placeHere')}</span>
                ) : null}
              </button>
              <div className="mt-2 flex flex-wrap gap-2">
                {placed.map((item) => {
                  let state: OptionVisualState = 'selected'
                  if (hasVerdict && correct) state = correct[item.id] === zone.id ? 'correct' : 'wrong'
                  return (
                    <SortChip
                      key={item.id}
                      state={state}
                      disabled={disabled}
                      dragging={drag?.itemId === item.id}
                      onSelect={() => onUnassign(item.id)}
                      onPointerDown={onPointerDown(item.id)}
                      onClickCapture={onClickCapture}
                    >
                      <VisualLabel item={item} imgClassName="h-10 w-10" iconClassName="text-[24px]" />
                    </SortChip>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {drag ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-50 inline-flex items-center rounded-full border-2 border-primary bg-primary-soft px-4 py-2 lf-label text-content shadow-glass-md"
          style={{ left: drag.x, top: drag.y, transform: 'translate(-50%, -150%)' }}
        >
          <MarkdownLite text={textById(drag.itemId)} />
        </div>
      ) : null}
    </div>
  )
}

// ---- sort_buckets -----------------------------------------------------------------

export function SortBuckets({ segment, value, onChange, disabled, verdict }: ExerciseProps) {
  const draft = draftOf(value)
  const assignments = (draft.assignments as Record<string, string> | undefined) ?? {}
  const buckets = segment.payload.buckets as Array<{ id: string; label: string }>
  const items = segment.payload.items as IdVisualItem[]
  const correct = revealOf(verdict).assignments as Record<string, string> | undefined

  return (
    <SortingBoard
      items={items}
      zones={buckets.map((b) => ({ id: b.id, label: b.label }))}
      assignments={assignments}
      selected={draft.selected as string | undefined}
      disabled={disabled}
      correct={correct}
      hasVerdict={Boolean(verdict)}
      onSelect={(itemId) => onChange({ ...draft, selected: itemId })}
      onAssign={(itemId, zoneId) =>
        onChange({ ...draft, selected: undefined, assignments: { ...assignments, [itemId]: zoneId } })
      }
      onUnassign={(itemId) => {
        const next = { ...assignments }
        delete next[itemId]
        onChange({ ...draft, selected: undefined, assignments: next })
      }}
    />
  )
}

// ---- order_steps / rank_choices --------------------------------------------------------

export function OrderSteps({ segment, value, onChange, disabled, verdict }: ExerciseProps) {
  const { t } = useTranslation()
  const items = segment.payload.items as IdVisualItem[]
  // `slots` may be fewer than items.length — the rest are distractors that
  // stay in the bank unplaced (mirrors build_sentence's tokens/slots split).
  const slots = (segment.payload.slots as number | undefined) ?? items.length
  const tapOrder = useTapOrder(items, value, onChange)
  return (
    <div className="space-y-4">
      <OrderedSlots items={items} tapOrder={tapOrder} total={slots} disabled={disabled} verdict={verdict} />
      <TokenBank
        items={seededSort(tapOrder.remaining, segment.id, (x) => x.id)}
        onPlace={tapOrder.place}
        disabled={disabled || tapOrder.order.length >= slots}
        verdict={verdict}
      />
      {!verdict && tapOrder.order.length > 0 ? (
        <p className="lf-caption text-content-muted">{t('lesson.families.arrange.tapToRemove')}</p>
      ) : null}
    </div>
  )
}

export function RankChoices(props: ExerciseProps) {
  const criterion = props.segment.payload.criterion_md as string
  return (
    <div className="space-y-4">
      <SunkenWell>
        <MarkdownLite text={criterion} className="lf-body-lg text-content" />
      </SunkenWell>
      <OrderSteps {...props} />
    </div>
  )
}

// ---- build_sentence ------------------------------------------------------------------

export function BuildSentence({ segment, value, onChange, disabled, verdict }: ExerciseProps) {
  const { t } = useTranslation()
  const tokens = segment.payload.tokens as IdTextItem[]
  const slots = segment.payload.slots as number
  const tapOrder = useTapOrder(tokens, value, onChange)
  const correctOrder = revealOf(verdict).order as string[] | undefined
  return (
    <div className="space-y-4">
      <SunkenWell active={tapOrder.order.length < slots}>
        <div className="flex min-h-11 flex-wrap items-center gap-2">
          {Array.from({ length: slots }, (_, i) => {
            const id = tapOrder.order[i]
            return id ? (
              <TokenChip
                key={i}
                state={slotState(i, tapOrder.order, verdict, correctOrder)}
                disabled={disabled}
                onSelect={() => tapOrder.remove(id)}
              >
                <MarkdownLite text={textOf(tokens, id)} />
              </TokenChip>
            ) : (
              <span
                key={i}
                aria-label={t('lesson.families.arrange.slot', { index: i + 1 })}
                className="inline-block h-11 w-16 rounded-full border-2 border-dashed border-outline/60"
              />
            )
          })}
        </div>
      </SunkenWell>
      <TokenBank items={seededSort(tapOrder.remaining, segment.id, (x) => x.id)} onPlace={tapOrder.place} disabled={disabled || tapOrder.order.length >= slots} verdict={verdict} />
    </div>
  )
}

// ---- timeline_order ------------------------------------------------------------------

export function TimelineOrder({ segment, value, onChange, disabled, verdict }: ExerciseProps) {
  const { t } = useTranslation()
  const events = segment.payload.events as Array<IdVisualItem>
  const tapOrder = useTapOrder(events, value, onChange)
  const correctOrder = revealOf(verdict).order as string[] | undefined
  return (
    <div className="space-y-4">
      <ol className="relative flex flex-col gap-3 md:flex-row md:items-stretch md:gap-2">
        {/* the timeline itself: vertical on mobile, horizontal on desktop */}
        <span aria-hidden="true" className="absolute bottom-2 left-[7px] top-2 w-0.5 rounded-full bg-outline/60 md:hidden" />
        <span aria-hidden="true" className="absolute left-2 right-2 top-[7px] hidden h-0.5 rounded-full bg-outline/60 md:block" />
        {events.map((_, i) => {
          const id = tapOrder.order[i]
          return (
            <li key={i} className="relative flex items-center gap-3 md:flex-1 md:flex-col md:items-stretch md:gap-2">
              <span
                aria-hidden="true"
                className="relative z-10 h-4 w-4 shrink-0 rounded-full border-2 border-surface bg-primary md:self-center"
              />
              {id ? (
                <TokenChip
                  state={slotState(i, tapOrder.order, verdict, correctOrder)}
                  disabled={disabled}
                  onSelect={() => tapOrder.remove(id)}
                  className="flex-1 rounded-md md:w-full"
                >
                  <span className="flex items-center gap-1.5">
                    {(() => {
                      const ev = events.find((e) => e.id === id)
                      return ev?.image_url || ev?.icon ? (
                        <VisualMark
                          icon={ev.icon}
                          imageUrl={ev.image_url}
                          iconClassName="text-[20px]"
                          imgClassName="h-6 w-6"
                        />
                      ) : null
                    })()}
                    <MarkdownLite text={textOf(events, id)} />
                  </span>
                </TokenChip>
              ) : (
                <div
                  aria-label={t('lesson.families.arrange.slot', { index: i + 1 })}
                  className="min-h-11 flex-1 rounded-md border-2 border-dashed border-outline/60 bg-surface-sunken md:w-full"
                />
              )}
            </li>
          )
        })}
      </ol>
      <TokenBank items={seededSort(tapOrder.remaining, segment.id, (x) => x.id)} onPlace={tapOrder.place} disabled={disabled} verdict={verdict} />
    </div>
  )
}

// ---- pattern_complete -----------------------------------------------------------------

const TILE_TINTS: Record<string, string> = {
  primary: 'text-primary',
  accent: 'text-accent',
  success: 'text-success-strong',
  warning: 'text-warning-strong',
  delight: 'text-secondary',
}

export function PatternComplete({ segment, value, onChange, disabled, verdict }: ExerciseProps) {
  const { t } = useTranslation()
  const draft = draftOf(value)
  const placed = (draft.placed as Record<string, string> | undefined) ?? {}
  const sequence = segment.payload.sequence as Array<{ icon: string; image_url?: string; tint: string }>
  const options = segment.payload.options as Array<{ id: string; icon: string; image_url?: string; tint: string }>
  const missing = segment.payload.missing_slots as number
  const correct = revealOf(verdict).correct as Record<string, string> | undefined
  const usedOptionIds = new Set(Object.values(placed))
  const slotIndexes = Array.from({ length: missing }, (_, i) => i)
  const nextEmpty = slotIndexes.find((i) => !placed[String(i)])

  const fill = (optionId: string) => {
    if (nextEmpty === undefined || usedOptionIds.has(optionId)) return
    onChange({ placed: { ...placed, [String(nextEmpty)]: optionId } })
  }
  const clear = (slot: number) => {
    const next = { ...placed }
    delete next[String(slot)]
    onChange({ placed: next })
  }

  const tile = 'flex h-16 w-16 items-center justify-center rounded-md border-2'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {sequence.map((s, i) => (
          <span key={`s${i}`} className={cn(tile, 'border-outline/50 bg-surface')}>
            <VisualMark
              icon={s.icon}
              imageUrl={s.image_url}
              iconClassName={cn('text-[32px]', TILE_TINTS[s.tint] ?? 'text-primary')}
              imgClassName="h-12 w-12"
            />
          </span>
        ))}
        {slotIndexes.map((slot) => {
          const optionId = placed[String(slot)]
          const option = options.find((o) => o.id === optionId)
          let stateClass = 'border-dashed border-primary bg-primary-soft/40'
          if (option) stateClass = 'border-primary bg-surface'
          if (verdict && correct) {
            stateClass =
              optionId === correct[String(slot)]
                ? 'border-success bg-success-soft'
                : 'border-error bg-error-soft'
          }
          return (
            <button
              key={`slot${slot}`}
              type="button"
              aria-label={
                option
                  ? undefined
                  : t('lesson.families.arrange.patternComplete.emptySlot', { index: slot + 1 })
              }
              disabled={disabled || !option}
              onClick={() => clear(slot)}
              className={cn(
                tile,
                'transition-[border-color,background-color] duration-150',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                'disabled:cursor-not-allowed',
                stateClass,
              )}
            >
              {option ? (
                <VisualMark
                  icon={option.icon}
                  imageUrl={option.image_url}
                  iconClassName={cn('text-[32px]', TILE_TINTS[option.tint] ?? 'text-primary')}
                  imgClassName="h-12 w-12"
                />
              ) : (
                <Icon name="add" className="text-[24px] text-primary" />
              )}
            </button>
          )
        })}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {options.map((option) => {
          const used = usedOptionIds.has(option.id)
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={used}
              disabled={disabled || used || nextEmpty === undefined}
              onClick={() => fill(option.id)}
              className={cn(
                tile,
                'transition-[border-color,background-color,transform] duration-150',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                'active:translate-y-px disabled:cursor-not-allowed',
                used || verdict ? 'border-outline/50 bg-surface opacity-60' : 'border-outline/70 bg-surface hover:border-primary/60',
              )}
            >
              <VisualMark
                icon={option.icon}
                imageUrl={option.image_url}
                iconClassName={cn('text-[32px]', TILE_TINTS[option.tint] ?? 'text-primary')}
                imgClassName="h-12 w-12"
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---- group_sets -----------------------------------------------------------------------

type GroupZone = 'a' | 'b' | 'both' | 'none'
const GROUP_ZONE_IDS: GroupZone[] = ['a', 'b', 'both', 'none']

export function GroupSets({ segment, value, onChange, disabled, verdict }: ExerciseProps) {
  const { t } = useTranslation()
  const draft = draftOf(value)
  const zoneMap = (draft.zones as Record<string, GroupZone> | undefined) ?? {}
  const items = segment.payload.items as IdVisualItem[]
  const correct = revealOf(verdict).zones as Record<string, string> | undefined

  const zoneLabels: Record<GroupZone, string> = {
    a: segment.payload.set_a as string,
    b: segment.payload.set_b as string,
    both: t('lesson.families.arrange.groupSets.both'),
    none: t('lesson.families.arrange.groupSets.none'),
  }

  return (
    <SortingBoard
      items={items}
      zones={GROUP_ZONE_IDS.map((z) => ({ id: z, label: zoneLabels[z] }))}
      assignments={zoneMap}
      selected={draft.selected as string | undefined}
      disabled={disabled}
      correct={correct}
      hasVerdict={Boolean(verdict)}
      onSelect={(itemId) => onChange({ ...draft, selected: itemId })}
      onAssign={(itemId, zoneId) =>
        onChange({ ...draft, selected: undefined, zones: { ...zoneMap, [itemId]: zoneId as GroupZone } })
      }
      onUnassign={(itemId) => {
        const next = { ...zoneMap }
        delete next[itemId]
        onChange({ ...draft, selected: undefined, zones: next })
      }}
    />
  )
}

// ---- number_line ------------------------------------------------------------------------

const NL_X0 = 12
const NL_X1 = 388
const NL_W = NL_X1 - NL_X0

export function NumberLine({ segment, value, onChange, disabled, verdict }: ExerciseProps) {
  const { t } = useTranslation()
  const draft = draftOf(value)
  const min = segment.payload.min as number
  const max = segment.payload.max as number
  const ticks = segment.payload.ticks as number | undefined
  const showLabels = segment.payload.labels === true
  const step = ticks ? (max - min) / ticks : 1
  const chosen = (draft.value as number | undefined) ?? min
  const touched = draft.touched === true
  const target = revealOf(verdict).value as number | undefined

  const divisions = ticks ?? Math.max(1, Math.round(max - min))
  const xOf = (v: number) => NL_X0 + ((v - min) / (max - min)) * NL_W

  const snap = (raw: number) => {
    const stepped = min + Math.round((raw - min) / step) * step
    const clamped = Math.max(min, Math.min(max, stepped))
    return Number(clamped.toFixed(6))
  }

  const onTap = (e: PointerEvent<SVGSVGElement>) => {
    if (disabled || verdict) return
    const rect = e.currentTarget.getBoundingClientRect()
    const frac = (((e.clientX - rect.left) / rect.width) * 400 - NL_X0) / NL_W
    onChange({ value: snap(min + frac * (max - min)), touched: true })
  }

  return (
    <div className="space-y-3">
      <svg
        viewBox="0 0 400 64"
        role="presentation"
        onPointerDown={onTap}
        className={cn('block w-full touch-none select-none', !disabled && !verdict && 'cursor-pointer')}
      >
        <line x1={NL_X0} y1={28} x2={NL_X1} y2={28} strokeWidth={4} strokeLinecap="round" className="stroke-outline" />
        {Array.from({ length: divisions + 1 }, (_, i) => {
          const v = min + (i * (max - min)) / divisions
          return (
            <g key={i}>
              <line x1={xOf(v)} y1={21} x2={xOf(v)} y2={35} strokeWidth={2} className="stroke-outline" />
              {showLabels ? (
                <text x={xOf(v)} y={54} textAnchor="middle" fontSize={12} className="fill-content-muted font-body">
                  {v % 1 === 0 ? v : v.toFixed(1)}
                </text>
              ) : null}
            </g>
          )
        })}
        {verdict && target !== undefined ? (
          <circle cx={xOf(target)} cy={28} r={9} className="fill-success-strong stroke-surface" strokeWidth={3} />
        ) : null}
        {touched || verdict ? (
          <circle
            cx={xOf(chosen)}
            cy={28}
            r={9}
            strokeWidth={3}
            className={cn(
              'stroke-surface',
              verdict && target !== undefined
                ? chosen === target
                  ? 'fill-success-strong'
                  : 'fill-error-strong'
                : 'fill-primary',
            )}
          />
        ) : null}
      </svg>
      {!showLabels ? (
        <div className="flex justify-between lf-caption text-content-muted lf-number">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      ) : null}
      <KidSlider
        min={min}
        max={max}
        step={step}
        value={chosen}
        disabled={disabled || Boolean(verdict)}
        onChange={(v) => onChange({ value: v, touched: true })}
      />
      {!verdict ? (
        <p className="lf-caption text-content-muted text-center">{t('lesson.families.arrange.numberLine.help')}</p>
      ) : null}
    </div>
  )
}

// ---- canSubmit / buildAnswer -----------------------------------------------------------

export const arrangeCanSubmit = {
  match_pairs: (draft: unknown, segment: SegmentBase) => {
    const pairs = (draftOf(draft).pairs as [string, string][] | undefined) ?? []
    const left = segment.payload.left as IdTextItem[]
    return pairs.length === left.length
  },
  sort_buckets: (draft: unknown, segment: SegmentBase) => {
    const assignments = (draftOf(draft).assignments as Record<string, string> | undefined) ?? {}
    const items = segment.payload.items as IdTextItem[]
    return items.every((i) => typeof assignments[i.id] === 'string')
  },
  order_steps: (draft: unknown, segment: SegmentBase) => {
    const order = (draftOf(draft).order as string[] | undefined) ?? []
    const slots = (segment.payload.slots as number | undefined) ?? (segment.payload.items as IdTextItem[]).length
    return order.length === slots
  },
  rank_choices: (draft: unknown, segment: SegmentBase) => {
    const order = (draftOf(draft).order as string[] | undefined) ?? []
    return order.length === (segment.payload.items as IdTextItem[]).length
  },
  build_sentence: (draft: unknown, segment: SegmentBase) => {
    const order = (draftOf(draft).order as string[] | undefined) ?? []
    return order.length === (segment.payload.slots as number)
  },
  timeline_order: (draft: unknown, segment: SegmentBase) => {
    const order = (draftOf(draft).order as string[] | undefined) ?? []
    return order.length === (segment.payload.events as IdTextItem[]).length
  },
  pattern_complete: (draft: unknown, segment: SegmentBase) => {
    const placed = (draftOf(draft).placed as Record<string, string> | undefined) ?? {}
    const missing = segment.payload.missing_slots as number
    return Array.from({ length: missing }, (_, i) => String(i)).every(
      (slot) => typeof placed[slot] === 'string',
    )
  },
  group_sets: (draft: unknown, segment: SegmentBase) => {
    const zones = (draftOf(draft).zones as Record<string, string> | undefined) ?? {}
    const items = segment.payload.items as IdTextItem[]
    return items.every((i) => typeof zones[i.id] === 'string')
  },
  number_line: (draft: unknown) => draftOf(draft).touched === true,
}

export function buildMatchPairsAnswer(draft: unknown): unknown {
  return { pairs: (draftOf(draft).pairs as [string, string][] | undefined) ?? [] }
}

export function buildSortBucketsAnswer(draft: unknown): unknown {
  return { assignments: (draftOf(draft).assignments as Record<string, string> | undefined) ?? {} }
}

export function buildPatternCompleteAnswer(draft: unknown): unknown {
  return { placed: (draftOf(draft).placed as Record<string, string> | undefined) ?? {} }
}

export function buildGroupSetsAnswer(draft: unknown): unknown {
  return { zones: (draftOf(draft).zones as Record<string, string> | undefined) ?? {} }
}

export function buildNumberLineAnswer(draft: unknown): unknown {
  return { value: (draftOf(draft).value as number | undefined) ?? 0 }
}
