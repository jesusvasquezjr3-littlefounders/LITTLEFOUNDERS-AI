// `input` family renderers (LESSON_ENGINE.md §5.3). All controlled; the shell
// owns the Check button. Tap-first, ≥44px hit areas, semantic tokens only.

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { ExerciseProps } from '../../core/types'
import { fuzzyEquals } from '../../core/scoring'
import { seededSort } from '../../core/shuffle'
import {
  KidSlider,
  NumberPad,
  SunkenWell,
  TokenChip,
  VisualMark,
  optionStateClasses,
  type OptionVisualState,
} from '../../core/primitives'

type Dict = Record<string, unknown>
const draftOf = (v: unknown): Dict => (typeof v === 'object' && v !== null ? (v as Dict) : {})

function revealOf(verdict: ExerciseProps['verdict']): Dict {
  return draftOf(verdict?.reveal)
}

function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return h
}

/** Whole-input verdict tint (single-value inputs have no per-option painting). */
function verdictState(verdict: ExerciseProps['verdict'], hasValue: boolean): OptionVisualState {
  if (verdict) return verdict.correct ? 'correct' : 'wrong'
  return hasValue ? 'selected' : 'idle'
}

function useNumberFormat(): (v: number) => string {
  const { i18n } = useTranslation()
  return useMemo(() => {
    const fmt = new Intl.NumberFormat(i18n.language)
    return (v: number) => fmt.format(v)
  }, [i18n.language])
}

/** Correct-answer line shown once the boundary releases the reveal. */
function CorrectAnswerNote({ verdict, value }: { verdict: ExerciseProps['verdict']; value: string | undefined }) {
  const { t } = useTranslation()
  if (!verdict || verdict.correct || value === undefined) return null
  return (
    <p className="lf-label text-success-strong">
      {t('lesson.families.input.correctAnswer', { value })}
    </p>
  )
}

// ---- Inline MarkdownLite (bold/italic/code) for text woven around gaps -----------

function renderInlineMd(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const re = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(<span key={`${keyPrefix}-t${i++}`}>{text.slice(last, m.index)}</span>)
    if (m[2] !== undefined) nodes.push(<strong key={`${keyPrefix}-b${i++}`} className="font-bold">{m[2]}</strong>)
    else if (m[4] !== undefined) nodes.push(<em key={`${keyPrefix}-i${i++}`}>{m[4]}</em>)
    else if (m[6] !== undefined)
      nodes.push(
        <code key={`${keyPrefix}-c${i++}`} className="rounded-sm bg-surface-sunken px-1.5 py-0.5 font-code text-[0.9em]">
          {m[6]}
        </code>,
      )
    last = re.lastIndex
  }
  if (last < text.length) nodes.push(<span key={`${keyPrefix}-t${i++}`}>{text.slice(last)}</span>)
  return nodes
}

// ---- type_answer -----------------------------------------------------------------

export function TypeAnswer({ segment, value, onChange, disabled, verdict }: ExerciseProps) {
  const { t } = useTranslation()
  const draft = draftOf(value)
  const text = typeof draft.text === 'string' ? draft.text : ''
  const maxChars = typeof segment.payload.max_chars === 'number' ? segment.payload.max_chars : 80
  const placeholder = typeof segment.payload.placeholder === 'string' ? segment.payload.placeholder : undefined
  const accept = revealOf(verdict).accept as string[] | undefined
  return (
    <div className="space-y-2">
      <input
        type="text"
        value={text}
        maxLength={maxChars}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={t('lesson.families.input.yourAnswer')}
        onChange={(e) => onChange({ text: e.target.value })}
        className={cn(
          'min-h-11 w-full rounded-md border-2 px-4 py-3 lf-body font-semibold',
          'placeholder:text-content-muted focus-visible:outline focus-visible:outline-2',
          'focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed',
          optionStateClasses(verdictState(verdict, text.trim().length > 0)),
        )}
      />
      <p className="lf-caption text-content-muted text-right">
        {t('lesson.families.input.charCounter', { used: text.length, max: maxChars })}
      </p>
      <CorrectAnswerNote verdict={verdict} value={accept?.[0]} />
    </div>
  )
}

// ---- fill_blank ----------------------------------------------------------------

type BlankPiece = { kind: 'text'; text: string } | { kind: 'gap'; n: number }

export function parseBlanks(text: string): BlankPiece[] {
  const pieces: BlankPiece[] = []
  const re = /\{\{(\d+)\}\}/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) pieces.push({ kind: 'text', text: text.slice(last, m.index) })
    pieces.push({ kind: 'gap', n: Number(m[1]) })
    last = re.lastIndex
  }
  if (last < text.length) pieces.push({ kind: 'text', text: text.slice(last) })
  return pieces
}

export function gapNumbersOf(text: string): number[] {
  const seen = new Set<number>()
  const out: number[] = []
  parseBlanks(text).forEach((p) => {
    if (p.kind === 'gap' && !seen.has(p.n)) {
      seen.add(p.n)
      out.push(p.n)
    }
  })
  return out
}

interface KeyGap {
  gap: number
  accept?: string[]
  bank_id?: string
}

function gapVerdictState(
  verdict: ExerciseProps['verdict'],
  keyGaps: KeyGap[] | undefined,
  n: number,
  userValue: string,
  mode: 'typed' | 'bank',
): OptionVisualState {
  if (!verdict || !keyGaps) return userValue ? 'selected' : 'idle'
  const key = keyGaps.find((g) => g.gap === n)
  if (!key) return 'dimmed'
  const right =
    mode === 'bank'
      ? userValue === key.bank_id
      : Boolean(key.accept?.some((expected) => fuzzyEquals(userValue, expected)))
  return right ? 'correct' : 'wrong'
}

export function FillBlank({ segment, value, onChange, disabled, verdict }: ExerciseProps) {
  const { t } = useTranslation()
  const draft = draftOf(value)
  const gaps = (draftOf(draft.gaps) as Record<string, string>) ?? {}
  const mode = segment.payload.mode === 'bank' ? 'bank' : 'typed'
  const textMd = typeof segment.payload.text_md === 'string' ? segment.payload.text_md : ''
  const bank = (segment.payload.bank as Array<{ id: string; text_md: string }> | undefined) ?? []
  const pieces = useMemo(() => parseBlanks(textMd), [textMd])
  const gapNumbers = useMemo(() => gapNumbersOf(textMd), [textMd])
  const keyGaps = revealOf(verdict).gaps as KeyGap[] | undefined
  const [focusedGap, setFocusedGap] = useState<number | null>(null)

  const setGap = (n: number, v: string) => {
    const next = { ...gaps }
    if (v === '') delete next[String(n)]
    else next[String(n)] = v
    onChange({ gaps: next })
  }

  const usedBankIds = new Set(Object.values(gaps))
  const bankTextOf = (id: string) => bank.find((b) => b.id === id)?.text_md ?? ''

  const fillFromBank = (bankId: string) => {
    const target = focusedGap ?? gapNumbers.find((n) => !gaps[String(n)]) ?? null
    if (target === null) return
    setGap(target, bankId)
    setFocusedGap(null)
  }

  return (
    <div className="space-y-4">
      <div className="lf-body-lg leading-relaxed text-content">
        {pieces.map((piece, idx) => {
          if (piece.kind === 'text') {
            return <span key={`t-${idx}`}>{renderInlineMd(piece.text, `fb-${idx}`)}</span>
          }
          const userValue = gaps[String(piece.n)] ?? ''
          const state = gapVerdictState(verdict, keyGaps, piece.n, userValue, mode)
          if (mode === 'typed') {
            return (
              <input
                key={`g-${idx}`}
                type="text"
                value={userValue}
                disabled={disabled}
                aria-label={t('lesson.families.input.fillBlank.gapLabel', { n: piece.n })}
                onChange={(e) => setGap(piece.n, e.target.value)}
                className={cn(
                  'mx-1 inline-block min-h-11 w-28 rounded-md border-2 px-2 py-1 text-center lf-body font-semibold align-middle',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                  'disabled:cursor-not-allowed',
                  optionStateClasses(state),
                )}
              />
            )
          }
          // bank mode: tap slot to focus/clear, tap a bank chip to fill.
          return (
            <button
              key={`g-${idx}`}
              type="button"
              disabled={disabled}
              aria-label={t('lesson.families.input.fillBlank.gapLabel', { n: piece.n })}
              onClick={() => {
                if (userValue) setGap(piece.n, '')
                else setFocusedGap(piece.n)
              }}
              className={cn(
                'mx-1 inline-flex min-h-11 min-w-24 items-center justify-center rounded-md border-2 border-dashed px-3 py-1 lf-body font-semibold align-middle',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                'active:translate-y-px disabled:cursor-not-allowed',
                focusedGap === piece.n && !verdict ? 'border-primary bg-primary-soft' : optionStateClasses(state),
              )}
            >
              {userValue ? renderInlineMd(bankTextOf(userValue), `fbv-${idx}`) : null}
            </button>
          )
        })}
      </div>
      {mode === 'bank' ? (
        <SunkenWell>
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label={t('lesson.families.input.fillBlank.bankLabel')}
          >
            {bank.map((b) => {
              const used = usedBankIds.has(b.id)
              return (
                <TokenChip
                  key={b.id}
                  state={used ? 'dimmed' : 'idle'}
                  disabled={disabled || used}
                  onSelect={() => fillFromBank(b.id)}
                >
                  {renderInlineMd(b.text_md, `bank-${b.id}`)}
                </TokenChip>
              )
            })}
          </div>
        </SunkenWell>
      ) : null}
    </div>
  )
}

// ---- Shared numeric readout + pad (number_input, count_objects) -------------------

function NumberEntry({
  segment,
  value,
  onChange,
  disabled,
  verdict,
  unit,
  allowDecimal,
}: ExerciseProps & { unit?: string; allowDecimal?: boolean }) {
  const { t } = useTranslation()
  const format = useNumberFormat()
  const draft = draftOf(value)
  const text = typeof draft.value === 'string' ? draft.value : ''
  const revealed = revealOf(verdict).value as number | undefined
  void segment
  return (
    <div className="space-y-4">
      <div
        aria-label={t('lesson.families.input.yourAnswer')}
        className={cn(
          'mx-auto flex min-h-14 w-full max-w-xs items-baseline justify-center gap-2 rounded-md border-2 px-4 py-3',
          optionStateClasses(verdictState(verdict, text.length > 0)),
        )}
      >
        <span className={cn('lf-title tabular-nums', text ? 'text-content' : 'text-content-muted')}>
          {text || '0'}
        </span>
        {unit ? <span className="lf-label text-content-muted">{unit}</span> : null}
      </div>
      <NumberPad
        value={text}
        onChange={(next) => onChange({ value: next })}
        allowDecimal={allowDecimal}
        disabled={disabled}
      />
      <CorrectAnswerNote
        verdict={verdict}
        value={revealed !== undefined ? (unit ? `${format(revealed)} ${unit}` : format(revealed)) : undefined}
      />
    </div>
  )
}

export function NumberInput(props: ExerciseProps) {
  const unit = typeof props.segment.payload.unit === 'string' ? props.segment.payload.unit : undefined
  const decimals = typeof props.segment.payload.decimals_hint === 'number' ? props.segment.payload.decimals_hint : 0
  return <NumberEntry {...props} unit={unit} allowDecimal={decimals > 0} />
}

// ---- estimate_slider ---------------------------------------------------------------

export function EstimateSlider({ segment, value, onChange, disabled, verdict }: ExerciseProps) {
  const { t } = useTranslation()
  const format = useNumberFormat()
  const draft = draftOf(value)
  const min = typeof segment.payload.min === 'number' ? segment.payload.min : 0
  const max = typeof segment.payload.max === 'number' ? segment.payload.max : 100
  const step = typeof segment.payload.step === 'number' ? segment.payload.step : 1
  const unit = typeof segment.payload.unit === 'string' ? segment.payload.unit : undefined
  const midpoint = min + Math.round((max - min) / 2 / step) * step
  const touched = draft.touched === true
  const current = typeof draft.value === 'number' ? draft.value : midpoint
  const revealed = revealOf(verdict).value as number | undefined
  const withUnit = (v: number) => (unit ? `${format(v)} ${unit}` : format(v))
  return (
    <div className="space-y-3">
      <KidSlider
        min={min}
        max={max}
        step={step}
        value={current}
        disabled={disabled}
        onChange={(v) => onChange({ value: v, touched: true })}
        format={withUnit}
      />
      {!touched && !verdict ? (
        <p className="lf-caption text-content-muted text-center">
          {t('lesson.families.input.estimate.moveToAnswer')}
        </p>
      ) : null}
      <CorrectAnswerNote verdict={verdict} value={revealed !== undefined ? withUnit(revealed) : undefined} />
    </div>
  )
}

// ---- count_objects ------------------------------------------------------------------

const TINT_CLASS: Record<string, string> = {
  primary: 'text-primary',
  accent: 'text-accent',
  success: 'text-success-strong',
  warning: 'text-warning-strong',
  delight: 'text-secondary',
}

export function CountObjects(props: ExerciseProps) {
  const { segment } = props
  const { t } = useTranslation()
  const askIcon = typeof segment.payload.ask_icon === 'string' ? segment.payload.ask_icon : ''
  const askImageUrl =
    typeof segment.payload.ask_image_url === 'string' ? segment.payload.ask_image_url : undefined
  // Shuffled-but-deterministic: hash by segment id + item key so the scene never
  // reorders between renders or retries (same trick as choice's stable shuffle).
  const items = useMemo(() => {
    const scene =
      (segment.payload.scene as
        | Array<{ icon: string; image_url?: string; tint?: string; count: number }>
        | undefined) ?? []
    const flat: Array<{ key: string; icon: string; image_url?: string; tint?: string }> = []
    scene.forEach((s, si) => {
      for (let i = 0; i < s.count; i++)
        flat.push({ key: `${si}-${i}`, icon: s.icon, image_url: s.image_url, tint: s.tint })
    })
    flat.sort((a, b) => hashCode(segment.id + a.key) - hashCode(segment.id + b.key))
    return flat
  }, [segment])
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-2">
        <span className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary-soft px-4 py-1.5">
          <VisualMark
            icon={askIcon}
            imageUrl={askImageUrl}
            iconClassName="text-[24px] text-primary"
            imgClassName="h-8 w-8"
          />
          <span className="lf-label text-content">{t('lesson.families.input.countObjects.howMany')}</span>
        </span>
      </div>
      <SunkenWell>
        <div className="flex flex-wrap items-center justify-center gap-3 p-1">
          {items.map((item) => (
            <VisualMark
              key={item.key}
              icon={item.icon}
              imageUrl={item.image_url}
              iconClassName={cn('text-[36px]', TINT_CLASS[item.tint ?? 'primary'] ?? 'text-primary')}
              imgClassName="h-12 w-12"
            />
          ))}
        </div>
      </SunkenWell>
      <NumberEntry {...props} />
    </div>
  )
}

// ---- equation_builder ---------------------------------------------------------------

export function EquationBuilder({ segment, value, onChange, disabled, verdict }: ExerciseProps) {
  const { t } = useTranslation()
  const format = useNumberFormat()
  const draft = draftOf(value)
  const order = Array.isArray(draft.order) ? (draft.order as string[]) : []
  const tokens = (segment.payload.tokens as Array<{ id: string; text: string }> | undefined) ?? []
  const slots = typeof segment.payload.slots === 'number' ? segment.payload.slots : tokens.length
  const target = typeof segment.payload.target_result === 'number' ? segment.payload.target_result : 0
  const accepted = revealOf(verdict).accepted as string[] | undefined
  const textOf = (id: string) => tokens.find((tok) => tok.id === id)?.text ?? ''
  const placed = new Set(order)
  const placedState: OptionVisualState = verdict ? (verdict.correct ? 'correct' : 'wrong') : 'selected'
  return (
    <div className="space-y-4">
      <div className="text-center">
        <span className="inline-block rounded-full bg-primary-soft px-4 py-1.5 lf-title text-primary tabular-nums">
          {t('lesson.families.input.equation.target', { value: format(target) })}
        </span>
      </div>
      <SunkenWell active={!verdict && order.length > 0}>
        <div
          className="flex min-h-14 flex-wrap items-center justify-center gap-2"
          role="group"
          aria-label={t('lesson.families.input.equation.slotsLabel')}
        >
          {Array.from({ length: slots }, (_, i) => {
            const id = order[i]
            if (id === undefined) {
              return (
                <span
                  key={`empty-${i}`}
                  aria-hidden="true"
                  className="inline-block h-11 w-11 rounded-md border-2 border-dashed border-outline/60 bg-surface"
                />
              )
            }
            return (
              <TokenChip
                key={id}
                state={placedState}
                disabled={disabled}
                onSelect={() => onChange({ order: order.filter((x) => x !== id) })}
              >
                {textOf(id)}
              </TokenChip>
            )
          })}
        </div>
      </SunkenWell>
      <div
        className="flex flex-wrap justify-center gap-2"
        role="group"
        aria-label={t('lesson.families.input.equation.bankLabel')}
      >
        {/* Shuffled: authors write `tokens` in solution order, so rendering the
            bank verbatim let a child tap left-to-right and build the equation with
            no reasoning (found 2026-07-24). Grading is by token id. */}
        {seededSort(tokens, segment.id, (tok) => tok.id).map((tok) => {
          const used = placed.has(tok.id)
          return (
            <TokenChip
              key={tok.id}
              state={used ? 'dimmed' : 'idle'}
              disabled={disabled || used || order.length >= slots}
              onSelect={() => onChange({ order: [...order, tok.id] })}
            >
              {tok.text}
            </TokenChip>
          )
        })}
      </div>
      {/* `accepted` entries are space-separated TOKEN IDS ("t1 t2 t3"), not display
          text — rendering one raw showed the child "la respuesta correcta: t1 t2 t3
          t4 t5" (found 2026-07-24). Map each id back through the token bank so the
          reveal reads as the equation ("5 + 5 + 5"). */}
      <CorrectAnswerNote
        verdict={verdict}
        value={accepted?.[0]
          ?.trim()
          .split(/\s+/)
          .map((id) => textOf(id) || id)
          .join(' ')}
      />
    </div>
  )
}

// ---- canSubmit / buildAnswer -------------------------------------------------------

function parseableNumber(draft: unknown): boolean {
  const v = draftOf(draft).value
  if (typeof v !== 'string' || v.trim() === '') return false
  return Number.isFinite(Number(v))
}

export const inputCanSubmit = {
  type_answer: (draft: unknown) => {
    const text = draftOf(draft).text
    return typeof text === 'string' && text.trim().length > 0
  },
  fill_blank: (draft: unknown, segment: { payload: Record<string, unknown> }) => {
    const textMd = typeof segment.payload.text_md === 'string' ? segment.payload.text_md : ''
    const numbers = gapNumbersOf(textMd)
    if (numbers.length === 0) return false
    const gaps = draftOf(draftOf(draft).gaps) as Record<string, string>
    return numbers.every((n) => {
      const v = gaps[String(n)]
      return typeof v === 'string' && v.trim().length > 0
    })
  },
  number_input: parseableNumber,
  estimate_slider: (draft: unknown) => {
    const d = draftOf(draft)
    return d.touched === true && typeof d.value === 'number'
  },
  count_objects: parseableNumber,
  equation_builder: (draft: unknown) => {
    const order = draftOf(draft).order
    return Array.isArray(order) && order.length >= 3
  },
}

export function buildNumericAnswer(draft: unknown): unknown {
  const v = draftOf(draft).value
  return { value: typeof v === 'string' ? Number(v) : Number.NaN }
}

export function buildSliderAnswer(draft: unknown): unknown {
  const v = draftOf(draft).value
  return { value: typeof v === 'number' ? v : Number.NaN }
}
