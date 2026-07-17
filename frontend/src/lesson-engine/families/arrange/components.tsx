// `arrange` family renderers (LESSON_ENGINE.md §5.4). Tap-first everywhere:
// tap a token → it fills the next slot; tap a placed token → it returns to the
// bank. All input types are controlled; the shell owns the Check button.
// memory_flip is the family's one flow and drives itself.

import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui'
import type { ExerciseProps, SegmentBase } from '../../core/types'
import MarkdownLite from '../../core/MarkdownLite'
import { KidSlider, SunkenWell, TokenChip, type OptionVisualState } from '../../core/primitives'

type Dict = Record<string, unknown>
const draftOf = (v: unknown): Dict => (typeof v === 'object' && v !== null ? (v as Dict) : {})

interface IdTextItem {
  id: string
  text_md: string
}

function revealOf(verdict: ExerciseProps['verdict']): Dict {
  return draftOf(verdict?.reveal)
}

function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return h
}

function textOf(items: IdTextItem[], id: string): string {
  return items.find((i) => i.id === id)?.text_md ?? id
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
  items: IdTextItem[]
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
              <MarkdownLite text={item.text_md} />
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
  items: IdTextItem[]
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
        return (
          <li key={i} className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft lf-label text-primary"
            >
              {i + 1}
            </span>
            {id ? (
              <TokenChip
                state={slotState(i, tapOrder.order, verdict, correctOrder)}
                disabled={disabled}
                onSelect={() => tapOrder.remove(id)}
                className="flex-1 justify-start rounded-md text-left"
              >
                <MarkdownLite text={textOf(items, id)} />
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
  const left = segment.payload.left as IdTextItem[]
  const right = segment.payload.right as IdTextItem[]
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
                <MarkdownLite text={item.text_md} />
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
}

export function MemoryFlip({ segment, disabled, onFinish, verdict }: ExerciseProps) {
  const { t } = useTranslation()
  const pairs = segment.payload.pairs as Array<{ a_md: string; b_md: string }>
  const cards = useMemo<FlipCard[]>(() => {
    const all = pairs.flatMap((p, i) => [
      { key: `a${i}`, pairIndex: i, text_md: p.a_md },
      { key: `b${i}`, pairIndex: i, text_md: p.b_md },
    ])
    // Deterministic shuffle by segment.id hash so retries keep the same board.
    return [...all].sort((a, b) => hashCode(segment.id + a.key) - hashCode(segment.id + b.key))
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
    setFlips((f) => f + 1)
    const nextUp = [...up, card.key]
    setUp(nextUp)
    if (nextUp.length === 2) {
      const [k1, k2] = nextUp
      const c1 = cards.find((c) => c.key === k1)
      const c2 = cards.find((c) => c.key === k2)
      if (c1 && c2 && c1.pairIndex === c2.pairIndex) {
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
                'flex min-h-16 items-center justify-center rounded-md border-2 p-2 text-center lf-label',
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
                <MarkdownLite text={card.text_md} />
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

// ---- sort_buckets -----------------------------------------------------------------

export function SortBuckets({ segment, value, onChange, disabled, verdict }: ExerciseProps) {
  const { t } = useTranslation()
  const draft = draftOf(value)
  const assignments = (draft.assignments as Record<string, string> | undefined) ?? {}
  const selected = draft.selected as string | undefined
  const buckets = segment.payload.buckets as Array<{ id: string; label: string }>
  const items = segment.payload.items as IdTextItem[]
  const correct = revealOf(verdict).assignments as Record<string, string> | undefined
  const unassigned = items.filter((i) => !assignments[i.id])

  const assign = (bucketId: string) => {
    if (!selected) return
    onChange({ ...draft, selected: undefined, assignments: { ...assignments, [selected]: bucketId } })
  }
  const unassign = (itemId: string) => {
    const next = { ...assignments }
    delete next[itemId]
    onChange({ ...draft, selected: undefined, assignments: next })
  }

  return (
    <div className="space-y-4">
      {unassigned.length > 0 ? (
        <SunkenWell>
          <div className="flex flex-wrap gap-2">
            {unassigned.map((item) => (
              <TokenChip
                key={item.id}
                state={selected === item.id ? 'selected' : 'idle'}
                disabled={disabled}
                onSelect={() =>
                  onChange({ ...draft, selected: selected === item.id ? undefined : item.id })
                }
              >
                <MarkdownLite text={item.text_md} />
              </TokenChip>
            ))}
          </div>
        </SunkenWell>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {buckets.map((bucket) => (
          <SunkenWell key={bucket.id} active={Boolean(selected)}>
            <button
              type="button"
              disabled={disabled || !selected}
              onClick={() => assign(bucket.id)}
              className={cn(
                'min-h-11 w-full rounded-sm px-2 text-center transition-colors',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                'disabled:cursor-not-allowed',
                selected ? 'bg-primary-soft text-primary' : 'text-content',
              )}
            >
              <span className="lf-title">{bucket.label}</span>
              {selected ? (
                <span className="block lf-caption">{t('lesson.families.arrange.sortBuckets.placeHere')}</span>
              ) : null}
            </button>
            <div className="mt-2 flex flex-wrap gap-2">
              {items
                .filter((i) => assignments[i.id] === bucket.id)
                .map((item) => {
                  let state: OptionVisualState = 'selected'
                  if (verdict && correct) state = correct[item.id] === bucket.id ? 'correct' : 'wrong'
                  return (
                    <TokenChip
                      key={item.id}
                      state={state}
                      disabled={disabled}
                      onSelect={() => unassign(item.id)}
                    >
                      <MarkdownLite text={item.text_md} />
                    </TokenChip>
                  )
                })}
            </div>
          </SunkenWell>
        ))}
      </div>
    </div>
  )
}

// ---- order_steps / rank_choices --------------------------------------------------------

export function OrderSteps({ segment, value, onChange, disabled, verdict }: ExerciseProps) {
  const { t } = useTranslation()
  const items = segment.payload.items as IdTextItem[]
  const tapOrder = useTapOrder(items, value, onChange)
  return (
    <div className="space-y-4">
      <OrderedSlots items={items} tapOrder={tapOrder} total={items.length} disabled={disabled} verdict={verdict} />
      <TokenBank items={tapOrder.remaining} onPlace={tapOrder.place} disabled={disabled} verdict={verdict} />
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
      <TokenBank items={tapOrder.remaining} onPlace={tapOrder.place} disabled={disabled || tapOrder.order.length >= slots} verdict={verdict} />
    </div>
  )
}

// ---- timeline_order ------------------------------------------------------------------

export function TimelineOrder({ segment, value, onChange, disabled, verdict }: ExerciseProps) {
  const { t } = useTranslation()
  const events = segment.payload.events as Array<IdTextItem & { icon?: string }>
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
                    {events.find((e) => e.id === id)?.icon ? (
                      <Icon name={events.find((e) => e.id === id)?.icon as string} className="text-[20px]" />
                    ) : null}
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
      <TokenBank items={tapOrder.remaining} onPlace={tapOrder.place} disabled={disabled} verdict={verdict} />
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
  const sequence = segment.payload.sequence as Array<{ icon: string; tint: string }>
  const options = segment.payload.options as Array<{ id: string; icon: string; tint: string }>
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
            <Icon name={s.icon} className={cn('text-[32px]', TILE_TINTS[s.tint] ?? 'text-primary')} />
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
                <Icon name={option.icon} className={cn('text-[32px]', TILE_TINTS[option.tint] ?? 'text-primary')} />
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
              <Icon name={option.icon} className={cn('text-[32px]', TILE_TINTS[option.tint] ?? 'text-primary')} />
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
  const zones = (draft.zones as Record<string, GroupZone> | undefined) ?? {}
  const selected = draft.selected as string | undefined
  const items = segment.payload.items as IdTextItem[]
  const correct = revealOf(verdict).zones as Record<string, string> | undefined
  const unassigned = items.filter((i) => !zones[i.id])

  const zoneLabels: Record<GroupZone, string> = {
    a: segment.payload.set_a as string,
    b: segment.payload.set_b as string,
    both: t('lesson.families.arrange.groupSets.both'),
    none: t('lesson.families.arrange.groupSets.none'),
  }

  const assign = (zone: GroupZone) => {
    if (!selected) return
    onChange({ ...draft, selected: undefined, zones: { ...zones, [selected]: zone } })
  }
  const unassign = (itemId: string) => {
    const next = { ...zones }
    delete next[itemId]
    onChange({ ...draft, selected: undefined, zones: next })
  }

  return (
    <div className="space-y-4">
      {unassigned.length > 0 ? (
        <SunkenWell>
          <div className="flex flex-wrap gap-2">
            {unassigned.map((item) => (
              <TokenChip
                key={item.id}
                state={selected === item.id ? 'selected' : 'idle'}
                disabled={disabled}
                onSelect={() =>
                  onChange({ ...draft, selected: selected === item.id ? undefined : item.id })
                }
              >
                <MarkdownLite text={item.text_md} />
              </TokenChip>
            ))}
          </div>
        </SunkenWell>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {GROUP_ZONE_IDS.map((zone) => (
          <SunkenWell key={zone} active={Boolean(selected)}>
            <button
              type="button"
              disabled={disabled || !selected}
              onClick={() => assign(zone)}
              className={cn(
                'min-h-11 w-full rounded-sm px-2 text-center transition-colors',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                'disabled:cursor-not-allowed',
                selected ? 'bg-primary-soft text-primary' : 'text-content',
              )}
            >
              <span className="lf-title">{zoneLabels[zone]}</span>
              {selected ? (
                <span className="block lf-caption">{t('lesson.families.arrange.sortBuckets.placeHere')}</span>
              ) : null}
            </button>
            <div className="mt-2 flex flex-wrap gap-2">
              {items
                .filter((i) => zones[i.id] === zone)
                .map((item) => {
                  let state: OptionVisualState = 'selected'
                  if (verdict && correct) state = correct[item.id] === zone ? 'correct' : 'wrong'
                  return (
                    <TokenChip
                      key={item.id}
                      state={state}
                      disabled={disabled}
                      onSelect={() => unassign(item.id)}
                    >
                      <MarkdownLite text={item.text_md} />
                    </TokenChip>
                  )
                })}
            </div>
          </SunkenWell>
        ))}
      </div>
    </div>
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
    return order.length === (segment.payload.items as IdTextItem[]).length
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
