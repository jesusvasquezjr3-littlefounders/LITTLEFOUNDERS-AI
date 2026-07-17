// `analyze` family renderers (LESSON_ENGINE.md §5.6). All controlled input kind;
// the shell owns the Check button. The read_chart SVG chart is rendered here —
// no chart libs, DESIGN.md tokens only (CSS vars, never raw hex).

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui'
import type { ExerciseProps } from '../../core/types'
import MarkdownLite from '../../core/MarkdownLite'
import { OptionCard, SunkenWell, TokenChip, type OptionVisualState } from '../../core/primitives'

type Dict = Record<string, unknown>
const draftOf = (v: unknown): Dict => (typeof v === 'object' && v !== null ? (v as Dict) : {})

function revealOf(verdict: ExerciseProps['verdict']): Dict {
  return draftOf(verdict?.reveal)
}

function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
}

/** Multi-toggle painting: after the reveal, the true positives glow green. */
function multiSelectState(
  id: string,
  selected: string[],
  verdict: ExerciseProps['verdict'],
  positiveIds: string[] | undefined,
): OptionVisualState {
  if (verdict && positiveIds) {
    if (positiveIds.includes(id)) return 'correct'
    if (selected.includes(id)) return 'wrong'
    return 'dimmed'
  }
  return selected.includes(id) ? 'selected' : 'idle'
}

function StepNumber({ n }: { n: number }) {
  return (
    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-sunken lf-label text-content-muted">
      {n}
    </span>
  )
}

// ---- spot_error -----------------------------------------------------------------

export function SpotError({ segment, value, onChange, disabled, verdict }: ExerciseProps) {
  const draft = draftOf(value)
  const selected = (draft.selected as string[] | undefined) ?? []
  const context = segment.payload.context_md as string | undefined
  const steps = segment.payload.steps as Array<{ id: string; text_md: string }>
  const reveal = revealOf(verdict)
  const errorIds = reveal.error_ids as string[] | undefined
  const correction = reveal.correction_md as string | undefined
  return (
    <div className="space-y-4">
      {context ? (
        <SunkenWell>
          <MarkdownLite text={context} className="lf-body text-content" />
        </SunkenWell>
      ) : null}
      <div className="space-y-3">
        {steps.map((step, i) => (
          <OptionCard
            key={step.id}
            role="checkbox"
            ariaChecked={selected.includes(step.id)}
            state={multiSelectState(step.id, selected, verdict, errorIds)}
            disabled={disabled}
            onSelect={() => onChange({ selected: toggleId(selected, step.id) })}
          >
            <span className="flex items-start gap-3">
              <StepNumber n={i + 1} />
              <MarkdownLite text={step.text_md} className="flex-1" />
            </span>
          </OptionCard>
        ))}
      </div>
      {verdict && correction ? (
        <SunkenWell>
          <MarkdownLite text={correction} className="lf-body text-content" />
        </SunkenWell>
      ) : null}
    </div>
  )
}

// ---- cause_effect -----------------------------------------------------------------

export function CauseEffect({ segment, value, onChange, disabled, verdict }: ExerciseProps) {
  const { t } = useTranslation()
  const draft = draftOf(value)
  const chain = (draft.chain as string[] | undefined) ?? []
  const events = segment.payload.events as Array<{ id: string; text_md: string }>
  const slots = segment.payload.slots as number
  const revealChain = revealOf(verdict).chain as string[] | undefined
  const bank = events.filter((e) => !chain.includes(e.id))
  const textOf = (id: string) => events.find((e) => e.id === id)?.text_md ?? ''

  const place = (id: string) => {
    if (chain.length < slots) onChange({ chain: [...chain, id] })
  }
  const removeAt = (index: number) => {
    onChange({ chain: chain.filter((_, i) => i !== index) })
  }

  return (
    <div className="space-y-4">
      <div>
        {Array.from({ length: slots }, (_, i) => {
          const filled = chain[i]
          let state: OptionVisualState = 'idle'
          if (verdict && revealChain && filled) {
            state = filled === revealChain[i] ? 'correct' : 'wrong'
          }
          return (
            <div key={i}>
              {i > 0 ? (
                <div className="flex justify-center py-0.5" aria-hidden="true">
                  <Icon name="arrow_forward" className="rotate-90 text-content-faint" />
                </div>
              ) : null}
              {filled ? (
                <OptionCard state={state} disabled={disabled} onSelect={() => removeAt(i)}>
                  <span className="flex items-start gap-3">
                    <StepNumber n={i + 1} />
                    <MarkdownLite text={textOf(filled)} className="flex-1" />
                    {!verdict ? <Icon name="close" className="text-content-faint" /> : null}
                  </span>
                </OptionCard>
              ) : (
                <div className="flex min-h-11 items-center gap-3 rounded-md border-2 border-dashed border-outline/60 bg-surface-sunken px-4 py-3">
                  <StepNumber n={i + 1} />
                </div>
              )}
            </div>
          )
        })}
      </div>
      <SunkenWell>
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label={t('lesson.families.analyze.eventBank')}
        >
          {bank.map((event) => (
            <TokenChip
              key={event.id}
              state={verdict ? 'dimmed' : 'idle'}
              disabled={disabled || chain.length >= slots}
              onSelect={() => place(event.id)}
            >
              <MarkdownLite text={event.text_md} />
            </TokenChip>
          ))}
        </div>
      </SunkenWell>
    </div>
  )
}

// ---- compare_table -----------------------------------------------------------------

export function CompareTable({ segment, value, onChange, disabled, verdict }: ExerciseProps) {
  const { t } = useTranslation()
  const draft = draftOf(value)
  const cells = (draft.cells as Record<string, string> | undefined) ?? {}
  const [focused, setFocused] = useState<string | null>(null)
  const rows = segment.payload.rows as Array<{ id: string; label: string }>
  const cols = segment.payload.cols as Array<{ id: string; label: string }>
  const tokens = segment.payload.tokens as Array<{ id: string; text_md: string }>
  const correctCells = revealOf(verdict).cells as Record<string, string> | undefined
  const usedTokenIds = new Set(Object.values(cells))
  const tokenText = (id: string) => tokens.find((tk) => tk.id === id)?.text_md ?? ''

  const tapCell = (key: string) => {
    if (cells[key]) {
      const next = { ...cells }
      delete next[key]
      onChange({ cells: next })
      setFocused(null)
    } else {
      setFocused((prev) => (prev === key ? null : key))
    }
  }
  const tapToken = (tokenId: string) => {
    if (!focused) return
    onChange({ cells: { ...cells, [focused]: tokenId } })
    setFocused(null)
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] border-separate border-spacing-1.5">
          <thead>
            <tr>
              <th />
              {cols.map((col) => (
                <th key={col.id} className="px-2 pb-1 text-center lf-label text-content-muted">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <th className="pr-2 text-left lf-label text-content">{row.label}</th>
                {cols.map((col) => {
                  const key = `${row.id}:${col.id}`
                  const filled = cells[key]
                  let state: OptionVisualState = filled ? 'selected' : 'idle'
                  if (verdict && correctCells) {
                    state = filled === correctCells[key] ? 'correct' : 'wrong'
                  }
                  return (
                    <td key={col.id} className="align-middle">
                      <button
                        type="button"
                        disabled={disabled}
                        aria-pressed={focused === key}
                        onClick={() => tapCell(key)}
                        className={cn(
                          'flex min-h-11 w-full min-w-[104px] items-center justify-center rounded-md border-2 px-2 py-2 lf-caption font-semibold',
                          'transition-[border-color,background-color] duration-150',
                          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                          'disabled:cursor-not-allowed',
                          state === 'idle'
                            ? 'border-outline/70 bg-surface text-content hover:border-primary/60'
                            : state === 'selected'
                              ? 'border-primary/60 bg-surface text-content'
                              : state === 'correct'
                                ? 'border-success bg-success-soft text-content'
                                : 'border-error bg-error-soft text-content',
                          focused === key && !verdict && 'border-primary ring-2 ring-primary',
                        )}
                      >
                        {filled ? (
                          <MarkdownLite text={tokenText(filled)} />
                        ) : (
                          <Icon name="add" className="text-content-faint" />
                        )}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SunkenWell active={focused !== null}>
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label={t('lesson.families.analyze.tokenBank')}
        >
          {tokens.map((token) => (
            <TokenChip
              key={token.id}
              state={verdict || usedTokenIds.has(token.id) ? 'dimmed' : 'idle'}
              disabled={disabled || !focused}
              onSelect={() => tapToken(token.id)}
            >
              <MarkdownLite text={token.text_md} />
            </TokenChip>
          ))}
        </div>
      </SunkenWell>
    </div>
  )
}

// ---- read_chart — engine-rendered SVG charts ---------------------------------------

interface ChartPoint {
  x: string | number
  y: number
}
interface ChartSeries {
  label: string
  points: ChartPoint[]
}
interface ChartData {
  kind: 'bar' | 'line' | 'pie'
  series: ChartSeries[]
  unit?: string
}

const CHART_COLORS = [
  'rgb(var(--lf-primary))',
  'rgb(var(--lf-accent))',
  'rgb(var(--lf-delight))',
  'rgb(var(--lf-secondary))',
  'rgb(var(--lf-success))',
]
const AXIS_TEXT = 'rgb(var(--lf-content-muted))'
const VALUE_TEXT = 'rgb(var(--lf-content))'
const GRID_STROKE = 'rgb(var(--lf-outline))'
const SLICE_SEPARATOR = 'rgb(var(--lf-surface))'

function seriesColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length] as string
}

function formatValue(y: number, unit?: string): string {
  return unit ? `${unit}${y}` : String(y)
}

function ChartLegend({ items }: { items: Array<{ label: string; color: string; value?: string }> }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
      {items.map((item, i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-3.5 w-3.5 shrink-0 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span className="lf-caption text-content-muted">{item.label}</span>
          {item.value ? <span className="lf-caption font-bold text-content">{item.value}</span> : null}
        </span>
      ))}
    </div>
  )
}

const PLOT_TOP = 26
const PLOT_HEIGHT = 148
const BASELINE_Y = PLOT_TOP + PLOT_HEIGHT
const CHART_HEIGHT = 208

function BarChart({ chart }: { chart: ChartData }) {
  const categories = chart.series[0]?.points.map((p) => String(p.x)) ?? []
  const seriesCount = chart.series.length
  const barW = 34
  const barGap = 6
  const groupGap = 24
  const pad = 14
  const groupW = seriesCount * barW + (seriesCount - 1) * barGap
  const width = pad * 2 + categories.length * groupW + Math.max(0, categories.length - 1) * groupGap
  const maxY = Math.max(1, ...chart.series.flatMap((s) => s.points.map((p) => p.y)))
  return (
    <svg
      viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
      role="img"
      aria-label={chart.series.map((s) => s.label).join(', ')}
      className="mx-auto block h-auto"
      style={{ minWidth: `${Math.min(width, 460)}px`, maxWidth: `${width * 1.4}px` }}
    >
      <line x1={pad} y1={BASELINE_Y} x2={width - pad} y2={BASELINE_Y} stroke={GRID_STROKE} strokeWidth={2} strokeLinecap="round" />
      {categories.map((label, ci) => {
        const groupX = pad + ci * (groupW + groupGap)
        return (
          <g key={ci}>
            {chart.series.map((s, si) => {
              const point = s.points[ci]
              if (!point) return null
              const h = Math.max(4, (point.y / maxY) * PLOT_HEIGHT)
              const x = groupX + si * (barW + barGap)
              const y = BASELINE_Y - h
              return (
                <g key={si}>
                  <rect x={x} y={y} width={barW} height={h} rx={8} fill={seriesColor(si)} />
                  <text x={x + barW / 2} y={y - 7} textAnchor="middle" fontSize={13} fontWeight={700} fill={VALUE_TEXT}>
                    {formatValue(point.y, chart.unit)}
                  </text>
                </g>
              )
            })}
            <text x={groupX + groupW / 2} y={BASELINE_Y + 18} textAnchor="middle" fontSize={12} fontWeight={600} fill={AXIS_TEXT}>
              {label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function LineChart({ chart }: { chart: ChartData }) {
  const categories = chart.series[0]?.points.map((p) => String(p.x)) ?? []
  const spacing = 76
  const pad = 34
  const width = pad * 2 + Math.max(0, categories.length - 1) * spacing
  const maxY = Math.max(1, ...chart.series.flatMap((s) => s.points.map((p) => p.y)))
  const xAt = (i: number) => pad + i * spacing
  const yAt = (v: number) => BASELINE_Y - (v / maxY) * PLOT_HEIGHT
  return (
    <svg
      viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
      role="img"
      aria-label={chart.series.map((s) => s.label).join(', ')}
      className="mx-auto block h-auto"
      style={{ minWidth: `${Math.min(width, 460)}px`, maxWidth: `${width * 1.4}px` }}
    >
      <line x1={pad - 12} y1={BASELINE_Y} x2={width - pad + 12} y2={BASELINE_Y} stroke={GRID_STROKE} strokeWidth={2} strokeLinecap="round" />
      {chart.series.map((s, si) => (
        <g key={si}>
          <polyline
            points={s.points.map((p, i) => `${xAt(i)},${yAt(p.y)}`).join(' ')}
            fill="none"
            stroke={seriesColor(si)}
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {s.points.map((p, i) => (
            <g key={i}>
              <circle cx={xAt(i)} cy={yAt(p.y)} r={6} fill={seriesColor(si)} stroke={SLICE_SEPARATOR} strokeWidth={2} />
              <text x={xAt(i)} y={yAt(p.y) - 12} textAnchor="middle" fontSize={13} fontWeight={700} fill={VALUE_TEXT}>
                {formatValue(p.y, chart.unit)}
              </text>
            </g>
          ))}
        </g>
      ))}
      {categories.map((label, i) => (
        <text key={i} x={xAt(i)} y={BASELINE_Y + 18} textAnchor="middle" fontSize={12} fontWeight={600} fill={AXIS_TEXT}>
          {label}
        </text>
      ))}
    </svg>
  )
}

function donutSlicePath(cx: number, cy: number, rOuter: number, rInner: number, a0: number, a1: number): string {
  const sweep = Math.min(a1 - a0, Math.PI * 2 - 0.001)
  const end = a0 + sweep
  const largeArc = sweep > Math.PI ? 1 : 0
  const p = (r: number, a: number) => `${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`
  return [
    `M ${p(rOuter, a0)}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p(rOuter, end)}`,
    `L ${p(rInner, end)}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${p(rInner, a0)}`,
    'Z',
  ].join(' ')
}

function PieChart({ chart }: { chart: ChartData }) {
  const points = chart.series[0]?.points ?? []
  const total = Math.max(1e-9, points.reduce((acc, p) => acc + Math.max(0, p.y), 0))
  let angle = -Math.PI / 2
  const slices = points.map((p, i) => {
    const start = angle
    angle += (Math.max(0, p.y) / total) * Math.PI * 2
    return { point: p, start, end: angle, color: seriesColor(i) }
  })
  return (
    <div className="space-y-3">
      <svg
        viewBox="0 0 200 200"
        role="img"
        aria-label={chart.series[0]?.label ?? ''}
        className="mx-auto block h-auto w-full max-w-[220px]"
      >
        {slices.map((s, i) => (
          <path
            key={i}
            d={donutSlicePath(100, 100, 82, 46, s.start, s.end)}
            fill={s.color}
            stroke={SLICE_SEPARATOR}
            strokeWidth={3}
            strokeLinejoin="round"
          />
        ))}
      </svg>
      <ChartLegend
        items={slices.map((s) => ({
          label: String(s.point.x),
          color: s.color,
          value: formatValue(s.point.y, chart.unit),
        }))}
      />
    </div>
  )
}

function KidChart({ chart }: { chart: ChartData }) {
  if (chart.kind === 'pie') return <PieChart chart={chart} />
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border-2 border-outline/60 bg-surface p-3">
        {chart.kind === 'bar' ? <BarChart chart={chart} /> : <LineChart chart={chart} />}
      </div>
      {chart.series.length > 1 ? (
        <ChartLegend items={chart.series.map((s, i) => ({ label: s.label, color: seriesColor(i) }))} />
      ) : null}
    </div>
  )
}

export function ReadChart({ segment, value, onChange, disabled, verdict }: ExerciseProps) {
  const draft = draftOf(value)
  const answers = (draft.answers as Record<string, string> | undefined) ?? {}
  const chart = segment.payload.chart as ChartData
  const questions = segment.payload.questions as Array<{
    id: string
    prompt_md: string
    options: Array<{ id: string; text_md: string }>
  }>
  const correct = revealOf(verdict).correct as Record<string, string> | undefined
  return (
    <div className="space-y-5">
      <KidChart chart={chart} />
      {questions.map((q) => (
        <div key={q.id} className="space-y-2">
          <MarkdownLite text={q.prompt_md} className="lf-body font-semibold text-content" />
          <div className="space-y-2" role="radiogroup">
            {q.options.map((option) => {
              let state: OptionVisualState = answers[q.id] === option.id ? 'selected' : 'idle'
              if (verdict && correct) {
                if (option.id === correct[q.id]) state = 'correct'
                else if (answers[q.id] === option.id) state = 'wrong'
                else state = 'dimmed'
              }
              return (
                <OptionCard
                  key={option.id}
                  role="radio"
                  ariaChecked={answers[q.id] === option.id}
                  state={state}
                  disabled={disabled}
                  onSelect={() => onChange({ answers: { ...answers, [q.id]: option.id } })}
                >
                  <MarkdownLite text={option.text_md} />
                </OptionCard>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ---- evidence_hunt -----------------------------------------------------------------

export function EvidenceHunt({ segment, value, onChange, disabled, verdict }: ExerciseProps) {
  const draft = draftOf(value)
  const selected = (draft.selected as string[] | undefined) ?? []
  const claim = segment.payload.claim_md as string
  const sentences = segment.payload.sentences as Array<{ id: string; text_md: string }>
  const evidenceIds = revealOf(verdict).evidence_ids as string[] | undefined
  return (
    <div className="space-y-4">
      <div className="rounded-lg border-2 border-primary bg-surface p-4 shadow-glass-sm">
        <MarkdownLite text={claim} className="lf-body-lg text-content" />
      </div>
      <div className="space-y-2">
        {sentences.map((sentence) => {
          const isSelected = selected.includes(sentence.id)
          let stateClasses = isSelected
            ? 'border-warning-strong bg-warning-soft text-content'
            : 'border-outline/70 bg-surface text-content hover:border-warning-strong/60'
          if (verdict && evidenceIds) {
            if (evidenceIds.includes(sentence.id)) stateClasses = 'border-success bg-success-soft text-content'
            else if (isSelected) stateClasses = 'border-error bg-error-soft text-content'
            else stateClasses = 'border-outline/50 bg-surface text-content-muted opacity-60'
          }
          return (
            <button
              key={sentence.id}
              type="button"
              aria-pressed={isSelected}
              disabled={disabled}
              onClick={() => onChange({ selected: toggleId(selected, sentence.id) })}
              className={cn(
                'min-h-11 w-full rounded-md border-2 px-4 py-3 text-left lf-body',
                'transition-[border-color,background-color,transform] duration-150',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                'active:translate-y-px disabled:cursor-not-allowed',
                stateClasses,
              )}
            >
              <MarkdownLite text={sentence.text_md} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---- red_flags -----------------------------------------------------------------

const ARTIFACT_ICON: Record<string, string> = {
  ad: 'campaign',
  message: 'chat',
  deal: 'sell',
  website: 'language',
}

export function RedFlags({ segment, value, onChange, disabled, verdict }: ExerciseProps) {
  const draft = draftOf(value)
  const selected = (draft.selected as string[] | undefined) ?? []
  const artifact = segment.payload.artifact_md as string
  const kind = segment.payload.artifact_kind as string
  const flags = segment.payload.flags as Array<{ id: string; text_md: string }>
  const redflagIds = revealOf(verdict).redflag_ids as string[] | undefined
  return (
    <div className="space-y-4">
      <div className="rounded-lg border-2 border-outline bg-surface-sunken p-4">
        <div className="mb-3 flex items-center gap-2 border-b-2 border-outline/60 pb-2">
          <Icon name={ARTIFACT_ICON[kind] ?? 'campaign'} className="text-content-muted" />
          <span className="ml-auto flex gap-1.5" aria-hidden="true">
            <span className="h-2 w-2 rounded-full bg-outline" />
            <span className="h-2 w-2 rounded-full bg-outline" />
            <span className="h-2 w-2 rounded-full bg-outline" />
          </span>
        </div>
        <MarkdownLite text={artifact} className="lf-body text-content" />
      </div>
      <div className="space-y-3">
        {flags.map((flag) => (
          <OptionCard
            key={flag.id}
            role="checkbox"
            ariaChecked={selected.includes(flag.id)}
            state={multiSelectState(flag.id, selected, verdict, redflagIds)}
            disabled={disabled}
            onSelect={() => onChange({ selected: toggleId(selected, flag.id) })}
          >
            <MarkdownLite text={flag.text_md} />
          </OptionCard>
        ))}
      </div>
    </div>
  )
}

// ---- fact_opinion -----------------------------------------------------------------

export function FactOpinion({ segment, value, onChange, disabled, verdict }: ExerciseProps) {
  const { t } = useTranslation()
  const draft = draftOf(value)
  const decisions = (draft.decisions as Record<string, 'fact' | 'opinion'> | undefined) ?? {}
  const statements = segment.payload.statements as Array<{ id: string; text_md: string }>
  const factIds = revealOf(verdict).fact_ids as string[] | undefined
  return (
    <ul className="space-y-3">
      {statements.map((statement) => {
        const decided = decisions[statement.id]
        const correctKind: 'fact' | 'opinion' | undefined = factIds
          ? factIds.includes(statement.id)
            ? 'fact'
            : 'opinion'
          : undefined
        return (
          <li key={statement.id} className="rounded-md border-2 border-outline/70 bg-surface p-3">
            <MarkdownLite text={statement.text_md} className="lf-body text-content" />
            <div className="mt-2 flex gap-2" role="radiogroup">
              {(['fact', 'opinion'] as const).map((kind) => {
                let state: OptionVisualState = decided === kind ? 'selected' : 'idle'
                if (verdict && correctKind) {
                  if (kind === correctKind) state = 'correct'
                  else if (decided === kind) state = 'wrong'
                  else state = 'dimmed'
                }
                return (
                  <TokenChip
                    key={kind}
                    state={state}
                    disabled={disabled}
                    onSelect={() =>
                      onChange({ decisions: { ...decisions, [statement.id]: kind } })
                    }
                    className="flex-1"
                  >
                    {kind === 'fact'
                      ? t('lesson.families.analyze.fact')
                      : t('lesson.families.analyze.opinion')}
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

// ---- canSubmit / buildAnswer -----------------------------------------------------

export const analyzeCanSubmit = {
  spot_error: (draft: unknown) => ((draftOf(draft).selected as string[] | undefined) ?? []).length >= 1,
  cause_effect: (draft: unknown, segment: { payload: Record<string, unknown> }) => {
    const chain = (draftOf(draft).chain as string[] | undefined) ?? []
    return chain.length === (segment.payload.slots as number)
  },
  compare_table: (draft: unknown, segment: { payload: Record<string, unknown> }) => {
    const cells = (draftOf(draft).cells as Record<string, string> | undefined) ?? {}
    const rows = segment.payload.rows as Array<{ id: string }>
    const cols = segment.payload.cols as Array<{ id: string }>
    return rows.every((r) => cols.every((c) => Boolean(cells[`${r.id}:${c.id}`])))
  },
  read_chart: (draft: unknown, segment: { payload: Record<string, unknown> }) => {
    const answers = (draftOf(draft).answers as Record<string, string> | undefined) ?? {}
    const questions = segment.payload.questions as Array<{ id: string }>
    return questions.every((q) => Boolean(answers[q.id]))
  },
  evidence_hunt: (draft: unknown) => ((draftOf(draft).selected as string[] | undefined) ?? []).length >= 1,
  red_flags: (draft: unknown) => ((draftOf(draft).selected as string[] | undefined) ?? []).length >= 1,
  fact_opinion: (draft: unknown, segment: { payload: Record<string, unknown> }) => {
    const decisions = (draftOf(draft).decisions as Record<string, string> | undefined) ?? {}
    const statements = segment.payload.statements as Array<{ id: string }>
    return statements.every((s) => decisions[s.id] === 'fact' || decisions[s.id] === 'opinion')
  },
}

export function buildFactOpinionAnswer(draft: unknown): unknown {
  const decisions = (draftOf(draft).decisions as Record<string, string> | undefined) ?? {}
  return { fact_ids: Object.keys(decisions).filter((id) => decisions[id] === 'fact') }
}
