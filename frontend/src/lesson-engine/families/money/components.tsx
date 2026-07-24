// `money` family renderers (LESSON_ENGINE.md §5.5). All controlled; the shell
// owns the Check button (input kind). interest_peek is a flow and drives itself.
// MONEY RULE (/AGENTS.md §1.8): currency is ALWAYS rendered via Intl.NumberFormat
// with the payload's currency — never string-built.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Button, Icon } from '@/components/ui'
import type { ExerciseProps } from '../../core/types'
import MarkdownLite from '../../core/MarkdownLite'
import {
  KidSlider,
  NumberPad,
  OptionCard,
  SunkenWell,
  TokenChip,
  VisualMark,
  type OptionVisualState,
} from '../../core/primitives'

type Dict = Record<string, unknown>
const draftOf = (v: unknown): Dict => (typeof v === 'object' && v !== null ? (v as Dict) : {})

function revealOf(verdict: ExerciseProps['verdict']): Dict {
  return draftOf(verdict?.reveal)
}

/** Locale-aware currency formatter — the ONLY way money renders in this family. */
function useMoneyFormat(currency: string): (n: number) => string {
  const { i18n } = useTranslation()
  return useMemo(() => {
    const fmt = new Intl.NumberFormat(i18n.language, { style: 'currency', currency })
    return (n: number) => fmt.format(n)
  }, [i18n.language, currency])
}

/** Locale-aware plain-number formatter (quantities, periods…). */
function useNumberFormat(): (n: number) => string {
  const { i18n } = useTranslation()
  return useMemo(() => {
    const fmt = new Intl.NumberFormat(i18n.language)
    return (n: number) => fmt.format(n)
  }, [i18n.language])
}

// ---- coin_count / make_change (shared money tray) ------------------------------

/** Coin (< 20, round) vs bill (≥ 20, rounded rectangle) — visual only, via tokens. */
function denominationClasses(value: number): string {
  return value < 20
    ? 'aspect-square min-w-14 rounded-full border-warning-strong bg-warning-soft'
    : 'min-w-20 rounded-sm border-success-strong bg-success-soft px-4'
}

function DenominationButton({
  value,
  label,
  onSelect,
  disabled,
  ariaLabel,
}: {
  value: number
  label: string
  onSelect: () => void
  disabled?: boolean
  ariaLabel?: string
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      aria-label={ariaLabel}
      className={cn(
        'inline-flex min-h-11 min-w-11 items-center justify-center border-2 lf-label lf-number text-content',
        'transition-[transform,border-color,background-color] duration-150',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        'active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60',
        denominationClasses(value),
      )}
    >
      {label}
    </button>
  )
}

function MoneyTray({
  denominations,
  picked,
  format,
  onPick,
  onRemove,
  disabled,
}: {
  denominations: number[]
  picked: number[]
  format: (n: number) => string
  onPick: (value: number) => void
  onRemove: (index: number) => void
  disabled: boolean
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap justify-center gap-2">
        {denominations.map((value) => (
          <DenominationButton
            key={value}
            value={value}
            label={format(value)}
            disabled={disabled}
            onSelect={() => onPick(value)}
          />
        ))}
      </div>
      <div role="group" aria-label={t('lesson.families.money.tray')}>
        <SunkenWell active={picked.length > 0} className="min-h-20">
          {picked.length === 0 ? (
            <p className="lf-caption text-center text-content-faint">{t('lesson.families.money.trayEmpty')}</p>
          ) : (
            <div className="flex flex-wrap justify-center gap-2">
              {picked.map((value, index) => (
                <DenominationButton
                  key={`${value}-${index}`}
                  value={value}
                  label={format(value)}
                  disabled={disabled}
                  ariaLabel={`${t('lesson.families.money.remove')} ${format(value)}`}
                  onSelect={() => onRemove(index)}
                />
              ))}
            </div>
          )}
        </SunkenWell>
      </div>
    </div>
  )
}

function TrayTotal({
  label,
  total,
  format,
  verdict,
}: {
  label: string
  total: number
  format: (n: number) => string
  verdict: ExerciseProps['verdict']
}) {
  return (
    <div className="text-center" aria-live="polite">
      <p className="lf-caption text-content-muted">{label}</p>
      <p
        className={cn(
          'lf-display-lg lf-number',
          verdict ? (verdict.correct ? 'text-success-strong' : 'text-error-strong') : 'text-content',
        )}
      >
        {format(total)}
      </p>
    </div>
  )
}

export function CoinCount({ segment, value, onChange, disabled, verdict }: ExerciseProps) {
  const { t } = useTranslation()
  const currency = segment.payload.currency as string
  const denominations = segment.payload.denominations as number[]
  const target = segment.payload.target as number
  const format = useMoneyFormat(currency)
  const draft = draftOf(value)
  const picked = (draft.picked as number[] | undefined) ?? []
  const total = picked.reduce((acc, v) => acc + v, 0)
  return (
    <div className="space-y-4">
      <div className="text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-4 py-1.5">
          <span className="lf-label text-content">{t('lesson.families.money.target')}</span>
          <span className="lf-title lf-number text-primary">{format(target)}</span>
        </span>
      </div>
      <MoneyTray
        denominations={denominations}
        picked={picked}
        format={format}
        disabled={disabled}
        onPick={(v) => onChange({ picked: [...picked, v] })}
        onRemove={(index) => onChange({ picked: picked.filter((_, i) => i !== index) })}
      />
      <TrayTotal label={t('lesson.families.money.total')} total={total} format={format} verdict={verdict} />
    </div>
  )
}

export function MakeChange({ segment, value, onChange, disabled, verdict }: ExerciseProps) {
  const { t } = useTranslation()
  const currency = segment.payload.currency as string
  const denominations = segment.payload.denominations as number[]
  const price = segment.payload.price as number
  const paidWith = segment.payload.paid_with as number
  const format = useMoneyFormat(currency)
  const draft = draftOf(value)
  const picked = (draft.picked as number[] | undefined) ?? []
  const total = picked.reduce((acc, v) => acc + v, 0)
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <SunkenWell className="text-center">
          <p className="lf-caption text-content-muted">{t('lesson.families.money.price')}</p>
          <p className="lf-title lf-number text-content">{format(price)}</p>
        </SunkenWell>
        <SunkenWell className="text-center">
          <p className="lf-caption text-content-muted">{t('lesson.families.money.paidWith')}</p>
          <p className="lf-title lf-number text-content">{format(paidWith)}</p>
        </SunkenWell>
      </div>
      <MoneyTray
        denominations={denominations}
        picked={picked}
        format={format}
        disabled={disabled}
        onPick={(v) => onChange({ picked: [...picked, v] })}
        onRemove={(index) => onChange({ picked: picked.filter((_, i) => i !== index) })}
      />
      <TrayTotal label={t('lesson.families.money.change')} total={total} format={format} verdict={verdict} />
    </div>
  )
}

// ---- piggy_split -----------------------------------------------------------------

const round2 = (n: number) => Math.round(n * 100) / 100

function StepperButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: string
  label: string
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPress}
      aria-label={label}
      className={cn(
        'inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border-2 border-outline/70 bg-surface text-content',
        'transition-[transform,border-color] duration-150 hover:border-primary/60',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        'active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40',
      )}
    >
      <Icon name={icon} />
    </button>
  )
}

export function PiggySplit({ segment, value, onChange, disabled, verdict }: ExerciseProps) {
  const { t } = useTranslation()
  const income = segment.payload.income as number
  const unit = segment.payload.unit as string
  const jars = segment.payload.jars as Array<{ id: string; label: string; icon: string; image_url?: string; hint_md?: string }>
  const step = (segment.payload.step as number | undefined) ?? income / 10
  const format = useMoneyFormat(unit)
  const draft = draftOf(value)
  const alloc = (draft.alloc as Record<string, number> | undefined) ?? {}
  const allocated = jars.reduce((acc, jar) => acc + (alloc[jar.id] ?? 0), 0)
  const remaining = round2(income - allocated)
  const targets = revealOf(verdict).targets as Record<string, { min: number; max: number }> | undefined

  const setJar = (jarId: string, next: number) => {
    onChange({ alloc: { ...alloc, [jarId]: round2(next) } })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <SunkenWell className="text-center">
          <p className="lf-caption text-content-muted">{t('lesson.families.money.income')}</p>
          <p className="lf-title lf-number text-content">{format(income)}</p>
        </SunkenWell>
        <SunkenWell className="text-center" aria-live="polite">
          <p className="lf-caption text-content-muted">{t('lesson.families.money.remaining')}</p>
          <p className={cn('lf-title lf-number', remaining === 0 ? 'text-success-strong' : 'text-content')}>
            {format(remaining)}
          </p>
        </SunkenWell>
      </div>
      <div className="space-y-3">
        {jars.map((jar) => {
          const amount = alloc[jar.id] ?? 0
          const range = targets?.[jar.id]
          const inRange = range ? amount >= range.min && amount <= range.max : undefined
          return (
            <div key={jar.id} className="flex items-center gap-3 rounded-md border-2 border-outline/70 bg-surface p-3">
              <VisualMark
                imageUrl={jar.image_url}
                icon={jar.icon}
                iconClassName="text-[28px] text-primary"
                imgClassName="h-10 w-10"
              />
              <div className="min-w-0 flex-1">
                <p className="lf-label text-content">{jar.label}</p>
                {jar.hint_md ? (
                  <MarkdownLite text={jar.hint_md} className="lf-caption text-content-muted" />
                ) : null}
                {range ? (
                  <p className="lf-caption lf-number text-content-muted">
                    {format(range.min)} – {format(range.max)}
                  </p>
                ) : null}
              </div>
              <StepperButton
                icon="remove"
                label={`${t('lesson.families.money.less')} ${jar.label}`}
                disabled={disabled || amount - step < 0}
                onPress={() => setJar(jar.id, amount - step)}
              />
              <span
                className={cn(
                  'lf-title lf-number w-20 text-right',
                  inRange === undefined ? 'text-content' : inRange ? 'text-success-strong' : 'text-error-strong',
                )}
              >
                {format(amount)}
              </span>
              <StepperButton
                icon="add"
                label={`${t('lesson.families.money.more')} ${jar.label}`}
                disabled={disabled || remaining - step < 0}
                onPress={() => setJar(jar.id, amount + step)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---- needs_wants ------------------------------------------------------------------

export function NeedsWants({ segment, value, onChange, disabled, verdict }: ExerciseProps) {
  const { t } = useTranslation()
  const items = segment.payload.items as Array<{ id: string; text_md: string; icon?: string; image_url?: string }>
  const draft = draftOf(value)
  const decisions = (draft.decisions as Record<string, boolean> | undefined) ?? {}
  const correctNeeds = revealOf(verdict).needs_ids as string[] | undefined
  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const decided = decisions[item.id]
        const isNeedCorrect = correctNeeds?.includes(item.id)
        return (
          <li key={item.id} className="rounded-md border-2 border-outline/70 bg-surface p-3">
            <div className="flex items-center gap-2">
              {item.image_url || item.icon ? (
                <VisualMark
                  imageUrl={item.image_url}
                  icon={item.icon}
                  iconClassName="text-[24px] text-primary"
                  imgClassName="h-9 w-9"
                />
              ) : null}
              <MarkdownLite text={item.text_md} className="lf-body text-content" />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {[true, false].map((isNeed) => {
                let state: OptionVisualState = decided === isNeed ? 'selected' : 'idle'
                if (verdict && correctNeeds) {
                  if (isNeed === isNeedCorrect) state = 'correct'
                  else if (decided === isNeed) state = 'wrong'
                  else state = 'dimmed'
                }
                return (
                  <TokenChip
                    key={String(isNeed)}
                    state={state}
                    disabled={disabled}
                    onSelect={() => onChange({ ...draft, decisions: { ...decisions, [item.id]: isNeed } })}
                  >
                    {isNeed ? t('lesson.families.money.need') : t('lesson.families.money.want')}
                  </TokenChip>
                )
              })}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

// ---- price_compare ---------------------------------------------------------------

export function PriceCompare({ segment, value, onChange, disabled, verdict }: ExerciseProps) {
  const { t } = useTranslation()
  const offers = segment.payload.offers as Array<{ id: string; label: string; qty: number; unit: string; price: number; image_url?: string }>
  const currency = segment.payload.currency as string
  const format = useMoneyFormat(currency)
  const formatNumber = useNumberFormat()
  const draft = draftOf(value)
  const selected = draft.offer_id as string | undefined
  const reveal = revealOf(verdict)
  const bestId = reveal.best_offer_id as string | undefined
  const unitPrices = reveal.unit_prices as Record<string, number> | undefined
  const chosenUnit = selected !== undefined ? unitPrices?.[selected] : undefined
  const bestUnit = bestId !== undefined ? unitPrices?.[bestId] : undefined
  return (
    <div className="space-y-4">
      <div className="space-y-3" role="radiogroup">
        {offers.map((offer) => {
          let state: OptionVisualState = selected === offer.id ? 'selected' : 'idle'
          if (verdict && bestId) {
            if (offer.id === bestId) state = 'correct'
            else if (offer.id === selected) state = 'wrong'
            else state = 'dimmed'
          }
          return (
            <OptionCard
              key={offer.id}
              role="radio"
              ariaChecked={selected === offer.id}
              state={state}
              disabled={disabled}
              onSelect={() => onChange({ offer_id: offer.id })}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  {offer.image_url ? <VisualMark imageUrl={offer.image_url} imgClassName="h-12 w-12" /> : null}
                  <div className="min-w-0">
                    <p className="lf-label text-content">{offer.label}</p>
                    <p className="lf-body text-content-muted">
                      {formatNumber(offer.qty)} {offer.unit}
                    </p>
                  </div>
                </div>
                <span className="lf-title lf-number">{format(offer.price)}</span>
              </div>
            </OptionCard>
          )
        })}
      </div>
      {verdict && unitPrices ? (
        <SunkenWell className="space-y-1">
          {selected !== bestId && chosenUnit !== undefined ? (
            <p className="lf-body text-content">
              {t('lesson.families.money.yourOffer', { price: format(chosenUnit) })}
            </p>
          ) : null}
          {bestUnit !== undefined ? (
            <p className="lf-body text-content">
              {t('lesson.families.money.bestOffer', { price: format(bestUnit) })}
            </p>
          ) : null}
        </SunkenWell>
      ) : null}
    </div>
  )
}

// ---- budget_fit ------------------------------------------------------------------

export function BudgetFit({ segment, value, onChange, disabled, verdict }: ExerciseProps) {
  const { t } = useTranslation()
  const budget = segment.payload.budget as number
  const currency = segment.payload.currency as string
  const items = segment.payload.items as Array<{ id: string; label: string; icon: string; image_url?: string; price: number; need?: boolean }>
  const format = useMoneyFormat(currency)
  const draft = draftOf(value)
  const selectedIds = (draft.selected_ids as string[] | undefined) ?? []
  const total = items.reduce((acc, i) => acc + (selectedIds.includes(i.id) ? i.price : 0), 0)
  const remaining = round2(budget - total)
  const needsIds = revealOf(verdict).needs_ids as string[] | undefined

  const toggle = (id: string) => {
    onChange({
      selected_ids: selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id],
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <SunkenWell className="text-center">
          <p className="lf-caption text-content-muted">{t('lesson.families.money.budget')}</p>
          <p className="lf-title lf-number text-content">{format(budget)}</p>
        </SunkenWell>
        <SunkenWell className="text-center" aria-live="polite">
          <p className="lf-caption text-content-muted">{t('lesson.families.money.total')}</p>
          <p className="lf-title lf-number text-content">{format(total)}</p>
        </SunkenWell>
        <SunkenWell className="text-center" aria-live="polite">
          <p className="lf-caption text-content-muted">{t('lesson.families.money.remaining')}</p>
          <p className={cn('lf-title lf-number', remaining < 0 ? 'text-error-strong' : 'text-content')}>
            {format(remaining)}
          </p>
        </SunkenWell>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {items.map((item) => {
          const isSelected = selectedIds.includes(item.id)
          let state: OptionVisualState = isSelected ? 'selected' : 'idle'
          if (verdict && needsIds) {
            if (needsIds.includes(item.id)) state = isSelected ? 'correct' : 'wrong'
            else state = isSelected ? 'selected' : 'dimmed'
          }
          return (
            <OptionCard
              key={item.id}
              role="checkbox"
              ariaChecked={isSelected}
              state={state}
              disabled={disabled}
              onSelect={() => toggle(item.id)}
            >
              <div className="flex items-center gap-3">
                <VisualMark
                  imageUrl={item.image_url}
                  icon={item.icon}
                  iconClassName="text-[28px] text-primary"
                  imgClassName="h-10 w-10"
                />
                <div className="min-w-0 flex-1">
                  <p className="lf-label text-content">
                    {item.label}
                    {item.need ? (
                      <span className="ml-2 inline-block rounded-full bg-accent-soft px-2 py-0.5 lf-caption text-accent-strong">
                        {t('lesson.families.money.need')}
                      </span>
                    ) : null}
                  </p>
                  <p className="lf-body lf-number text-content-muted">{format(item.price)}</p>
                </div>
              </div>
            </OptionCard>
          )
        })}
      </div>
    </div>
  )
}

// ---- savings_goal ----------------------------------------------------------------

export function SavingsGoal({ segment, value, onChange, disabled, verdict }: ExerciseProps) {
  const { t } = useTranslation()
  const goal = segment.payload.goal as number
  const currency = segment.payload.currency as string
  const options = segment.payload.weekly_options as number[]
  const format = useMoneyFormat(currency)
  const formatNumber = useNumberFormat()
  const draft = draftOf(value)
  const weeks = (draft.weeks as Record<string, string> | undefined) ?? {}
  const [active, setActive] = useState<string>(String(options[0] ?? ''))
  const correct = revealOf(verdict).correct as Record<string, number> | undefined

  return (
    <div className="space-y-4">
      <div className="text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-4 py-1.5">
          <span className="lf-label text-content">{t('lesson.families.money.goal')}</span>
          <span className="lf-title lf-number text-primary">{format(goal)}</span>
        </span>
      </div>
      <div className="space-y-3">
        {options.map((weekly) => {
          const key = String(weekly)
          const typed = weeks[key] ?? ''
          const expected = correct?.[key]
          const isRight = expected !== undefined && typed !== '' && Number(typed) === expected
          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              aria-pressed={active === key}
              onClick={() => setActive(key)}
              className={cn(
                'flex min-h-11 w-full items-center justify-between gap-3 rounded-md border-2 bg-surface px-4 py-3 text-left',
                'transition-[border-color] duration-150',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                'disabled:cursor-not-allowed',
                active === key && !verdict ? 'border-primary' : 'border-outline/70',
                verdict && expected !== undefined ? (isRight ? 'border-success bg-success-soft' : 'border-error bg-error-soft') : '',
              )}
            >
              <span className="lf-body text-content">
                {t('lesson.families.money.savingPerWeek', { amount: format(weekly) })}
              </span>
              <span className="lf-title lf-number text-content">
                {typed === '' ? '—' : formatNumber(Number(typed))}{' '}
                <span className="lf-caption text-content-muted">{t('lesson.families.money.weeks')}</span>
                {verdict && expected !== undefined && !isRight ? (
                  <span className="ml-2 lf-label text-success-strong">{formatNumber(expected)}</span>
                ) : null}
              </span>
            </button>
          )
        })}
      </div>
      {!verdict ? (
        <NumberPad
          value={weeks[active] ?? ''}
          maxLength={3}
          disabled={disabled}
          onChange={(next) => onChange({ weeks: { ...weeks, [active]: next } })}
        />
      ) : null}
    </div>
  )
}

// ---- fair_trade ------------------------------------------------------------------

const FAIR_TRADE_VERDICTS = ['fair', 'a_wins', 'b_wins'] as const
type FairTradeVerdict = (typeof FAIR_TRADE_VERDICTS)[number]

export function FairTrade({ segment, value, onChange, disabled, verdict }: ExerciseProps) {
  const { t } = useTranslation()
  const offerA = segment.payload.offer_a as { label: string; icon: string; image_url?: string; qty: number }
  const offerB = segment.payload.offer_b as { label: string; icon: string; image_url?: string; qty: number }
  const rateMd = segment.payload.rate_md as string
  const formatNumber = useNumberFormat()
  const draft = draftOf(value)
  const chosen = draft.verdict as string | undefined
  const correctVerdict = revealOf(verdict).verdict as string | undefined

  const labelFor: Record<FairTradeVerdict, string> = {
    fair: t('lesson.families.money.fair'),
    a_wins: t('lesson.families.money.aWins'),
    b_wins: t('lesson.families.money.bWins'),
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {[
          { tag: 'A', offer: offerA },
          { tag: 'B', offer: offerB },
        ].map(({ tag, offer }) => (
          <div key={tag} className="rounded-md border-2 border-outline/70 bg-surface p-4 text-center">
            <span className="inline-block rounded-full bg-primary-soft px-2.5 py-0.5 lf-caption text-primary">{tag}</span>
            <VisualMark
              imageUrl={offer.image_url}
              icon={offer.icon}
              iconClassName="mt-1 block text-[40px] text-primary"
              imgClassName="mt-1 mx-auto block h-14 w-14"
            />
            <p className="lf-title lf-number text-content">{formatNumber(offer.qty)}</p>
            <p className="lf-label text-content-muted">{offer.label}</p>
          </div>
        ))}
      </div>
      <SunkenWell>
        <MarkdownLite text={rateMd} className="lf-body-lg text-content" />
      </SunkenWell>
      <div className="grid grid-cols-3 gap-2" role="radiogroup">
        {FAIR_TRADE_VERDICTS.map((v) => {
          let state: OptionVisualState = chosen === v ? 'selected' : 'idle'
          if (verdict && correctVerdict) {
            if (v === correctVerdict) state = 'correct'
            else if (v === chosen) state = 'wrong'
            else state = 'dimmed'
          }
          return (
            <TokenChip key={v} state={state} disabled={disabled} onSelect={() => onChange({ verdict: v })}>
              {labelFor[v]}
            </TokenChip>
          )
        })}
      </div>
    </div>
  )
}

// ---- interest_peek (flow) ----------------------------------------------------------

export function InterestPeek({ segment, disabled, onFinish, verdict }: ExerciseProps) {
  const { t, i18n } = useTranslation()
  const principal = segment.payload.principal as number
  const ratePct = segment.payload.rate_pct as number
  const periods = segment.payload.periods as number
  const currency = segment.payload.currency as string
  const prediction = segment.payload.prediction as
    | { kind: 'choice'; options: Array<{ id: string; text_md: string }> }
    | { kind: 'slider'; min: number; max: number }
  const format = useMoneyFormat(currency)
  const formatNumber = useNumberFormat()
  const formatPercent = useMemo(() => {
    const fmt = new Intl.NumberFormat(i18n.language, { style: 'percent', maximumFractionDigits: 2 })
    return (n: number) => fmt.format(n)
  }, [i18n.language])

  const [phase, setPhase] = useState<'predict' | 'grow'>(verdict ? 'grow' : 'predict')
  const [choiceId, setChoiceId] = useState<string | undefined>(undefined)
  const [sliderValue, setSliderValue] = useState(prediction.kind === 'slider' ? prediction.min : 0)
  const values = useMemo(
    () => Array.from({ length: periods + 1 }, (_, period) => principal * Math.pow(1 + ratePct / 100, period)),
    [principal, ratePct, periods],
  )
  const maxValue = values[values.length - 1] ?? principal
  const reducedMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )
  const [bars, setBars] = useState(verdict || reducedMotion ? periods + 1 : 1)
  const finished = useRef(Boolean(verdict))
  const grown = bars >= periods + 1

  useEffect(() => {
    if (phase !== 'grow' || grown || reducedMotion) return
    const id = setInterval(() => {
      setBars((prev) => Math.min(prev + 1, periods + 1))
    }, 600)
    return () => clearInterval(id)
  }, [phase, grown, reducedMotion, periods])

  const chosenOptionText =
    prediction.kind === 'choice' ? prediction.options.find((o) => o.id === choiceId)?.text_md : undefined

  if (phase === 'predict') {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <SunkenWell className="text-center">
            <p className="lf-caption text-content-muted">{t('lesson.families.money.principal')}</p>
            <p className="lf-title lf-number text-content">{format(principal)}</p>
          </SunkenWell>
          <SunkenWell className="text-center">
            <p className="lf-caption text-content-muted">{t('lesson.families.money.rate')}</p>
            <p className="lf-title lf-number text-content">{formatPercent(ratePct / 100)}</p>
          </SunkenWell>
          <SunkenWell className="text-center">
            <p className="lf-caption text-content-muted">{t('lesson.families.money.periods')}</p>
            <p className="lf-title lf-number text-content">{formatNumber(periods)}</p>
          </SunkenWell>
        </div>
        {prediction.kind === 'choice' ? (
          <div className="space-y-3" role="radiogroup">
            {prediction.options.map((option) => (
              <OptionCard
                key={option.id}
                role="radio"
                ariaChecked={choiceId === option.id}
                state={choiceId === option.id ? 'selected' : 'idle'}
                disabled={disabled}
                onSelect={() => setChoiceId(option.id)}
              >
                <MarkdownLite text={option.text_md} />
              </OptionCard>
            ))}
          </div>
        ) : (
          <KidSlider
            min={prediction.min}
            max={prediction.max}
            value={sliderValue}
            disabled={disabled}
            onChange={setSliderValue}
            format={format}
          />
        )}
        <div className="text-center">
          <Button
            variant="primary"
            disabled={disabled || (prediction.kind === 'choice' && !choiceId)}
            onClick={() => setPhase('grow')}
          >
            {t('lesson.families.money.predict')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div
        className="flex h-44 items-end justify-center gap-2"
        role="img"
        aria-label={t('lesson.families.money.final', { amount: format(maxValue) })}
      >
        {values.map((v, index) => (
          <div key={index} className="flex h-full w-8 flex-col justify-end sm:w-10">
            <div
              className={cn(
                'w-full rounded-t-sm transition-[height] duration-500 ease-out',
                index === values.length - 1 ? 'bg-accent' : 'bg-primary',
              )}
              style={{ height: index < bars ? `${Math.max(4, (v / maxValue) * 100)}%` : '0%' }}
            />
          </div>
        ))}
      </div>
      {grown ? (
        <div className="space-y-3 text-center" aria-live="polite">
          <p className="lf-title lf-number text-content">
            {t('lesson.families.money.final', { amount: format(maxValue) })}
          </p>
          {prediction.kind === 'slider' ? (
            <p className="lf-body text-content-muted">
              {t('lesson.families.money.yourPrediction', { value: format(sliderValue) })}
            </p>
          ) : chosenOptionText ? (
            <p className="lf-body text-content-muted">
              {t('lesson.families.money.yourPrediction', { value: chosenOptionText })}
            </p>
          ) : null}
          {!verdict ? (
            <Button
              variant="primary"
              disabled={disabled}
              onClick={() => {
                if (finished.current || !onFinish) return
                finished.current = true
                onFinish(prediction.kind === 'choice' ? { option_id: choiceId } : { value: sliderValue })
              }}
            >
              {t('lesson.flow.done')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

// ---- canSubmit / buildAnswer -------------------------------------------------------

type SegmentLike = { payload: Record<string, unknown> }

function pickedOf(draft: unknown): number[] {
  const picked = draftOf(draft).picked
  return Array.isArray(picked) && picked.every((v) => typeof v === 'number') ? (picked as number[]) : []
}

export const moneyCanSubmit = {
  coin_count: (draft: unknown) => pickedOf(draft).length > 0,
  make_change: (draft: unknown) => pickedOf(draft).length > 0,
  piggy_split: (draft: unknown, segment: SegmentLike) => {
    const alloc = (draftOf(draft).alloc as Record<string, number> | undefined) ?? {}
    const income = segment.payload.income as number
    const jars = segment.payload.jars as Array<{ id: string }>
    const allocated = jars.reduce((acc, jar) => acc + (alloc[jar.id] ?? 0), 0)
    return Math.abs(income - allocated) < 1e-6
  },
  needs_wants: (draft: unknown, segment: SegmentLike) => {
    const decisions = (draftOf(draft).decisions as Record<string, boolean> | undefined) ?? {}
    const items = segment.payload.items as Array<{ id: string }>
    return items.every((item) => typeof decisions[item.id] === 'boolean')
  },
  price_compare: (draft: unknown) => Boolean(draftOf(draft).offer_id),
  budget_fit: (draft: unknown) => {
    const selected = draftOf(draft).selected_ids
    return Array.isArray(selected) && selected.length > 0
  },
  savings_goal: (draft: unknown, segment: SegmentLike) => {
    const weeks = (draftOf(draft).weeks as Record<string, string> | undefined) ?? {}
    const options = segment.payload.weekly_options as number[]
    return options.every((weekly) => /^\d+$/.test(weeks[String(weekly)] ?? ''))
  },
  fair_trade: (draft: unknown) => Boolean(draftOf(draft).verdict),
}

export function buildNeedsWantsAnswer(draft: unknown): unknown {
  const decisions = (draftOf(draft).decisions as Record<string, boolean> | undefined) ?? {}
  return { needs_ids: Object.keys(decisions).filter((id) => decisions[id]) }
}

export function buildSavingsGoalAnswer(draft: unknown): unknown {
  const typed = (draftOf(draft).weeks as Record<string, string> | undefined) ?? {}
  const weeks: Record<string, number> = {}
  Object.entries(typed).forEach(([weekly, text]) => {
    if (/^\d+$/.test(text)) weeks[weekly] = Number(text)
  })
  return { weeks }
}
