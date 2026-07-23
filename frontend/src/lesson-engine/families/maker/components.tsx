// `maker` family renderers (LESSON_ENGINE.md §5.8). All controlled; the shell
// owns the Check button (input kind). robot_path is a flow and drives itself —
// it animates the SAME simulation the grader re-runs authoritatively.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Button, Icon } from '@/components/ui'
import type { ExerciseProps, SegmentBase } from '../../core/types'
import MarkdownLite from '../../core/MarkdownLite'
import { seededSort } from '../../core/shuffle'
import {
  NumberPad,
  OptionCard,
  SunkenWell,
  TokenChip,
  optionStateClasses,
  type OptionVisualState,
} from '../../core/primitives'
import {
  DIR_DELTA,
  TURN_RIGHT,
  parseRobotPayload,
  simulateRobot,
  type RobotCommand,
  type RobotDir,
  type RobotState,
} from './grade'

type Dict = Record<string, unknown>
const draftOf = (v: unknown): Dict => (typeof v === 'object' && v !== null ? (v as Dict) : {})

function revealOf(verdict: ExerciseProps['verdict']): Dict {
  return draftOf(verdict?.reveal)
}

function isNumericDraft(v: unknown): boolean {
  return typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))
}

/** Monospace code line — the shared block visual for code_order / debug_hunt. */
function CodeLine({ text }: { text: string }) {
  return <span className="block whitespace-pre-wrap font-code text-sm leading-relaxed">{text}</span>
}

// ---- code_order -------------------------------------------------------------------

export function CodeOrder({ segment, value, onChange, disabled, verdict }: ExerciseProps) {
  const { t } = useTranslation()
  const draft = draftOf(value)
  const order = (draft.order as string[] | undefined) ?? []
  const blocks = segment.payload.blocks as Array<{ id: string; text_md: string }>
  const blockById = useMemo(() => new Map(blocks.map((b) => [b.id, b])), [blocks])
  // Shuffle the bank (A7): the blocks were authored in solution order, so the
  // puzzle arrived pre-solved. Grading checks the assembled order by id.
  const bank = seededSort(blocks.filter((b) => !order.includes(b.id)), segment.id, (b) => b.id)
  const correctOrder = revealOf(verdict).order as string[] | undefined

  const placedState = (id: string, index: number): OptionVisualState => {
    if (verdict && correctOrder) return correctOrder[index] === id ? 'correct' : 'wrong'
    return 'idle'
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="lf-label text-content-muted">{t('lesson.families.maker.program')}</p>
        <SunkenWell>
          {order.length === 0 ? (
            <p className="lf-caption py-2 text-center text-content-muted">
              {t('lesson.families.maker.programEmpty')}
            </p>
          ) : (
            <ol className="space-y-2">
              {order.map((id, index) => (
                <li key={id} className="flex items-center gap-2">
                  <span className="lf-label w-6 shrink-0 text-center text-content-muted">
                    {index + 1}
                  </span>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange({ order: order.filter((x) => x !== id) })}
                    className={cn(
                      'min-h-11 flex-1 rounded-md border-2 px-3 py-2 text-left',
                      'transition-[border-color,background-color,transform] duration-150',
                      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                      'active:translate-y-px disabled:cursor-not-allowed',
                      placedState(id, index) === 'idle'
                        ? 'border-outline/70 bg-surface text-content hover:border-primary/60'
                        : optionStateClasses(placedState(id, index)),
                    )}
                  >
                    <CodeLine text={blockById.get(id)?.text_md ?? id} />
                  </button>
                </li>
              ))}
            </ol>
          )}
        </SunkenWell>
      </div>
      {bank.length > 0 ? (
        <div className="space-y-2">
          <p className="lf-label text-content-muted">{t('lesson.families.maker.bank')}</p>
          <div className="flex flex-col gap-2">
            {bank.map((block) => (
              <button
                key={block.id}
                type="button"
                disabled={disabled}
                onClick={() => onChange({ order: [...order, block.id] })}
                className={cn(
                  'min-h-11 w-full rounded-md border-2 border-outline/70 bg-surface-sunken px-3 py-2 text-left text-content',
                  'transition-[border-color,transform] duration-150 hover:border-primary/60',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                  'active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60',
                )}
              >
                <CodeLine text={block.text_md} />
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

// ---- robot_path (flow) --------------------------------------------------------------

const DIR_DEG: Record<RobotDir, number> = { up: 0, right: 90, down: 180, left: 270 }

const COMMAND_ICON: Record<RobotCommand, string> = {
  forward: 'arrow_upward',
  left: 'rotate_left',
  right: 'rotate_right',
}

interface RobotDisplayState extends RobotState {
  /** Cumulative heading in degrees so turn animations rotate the short way. */
  deg: number
}

function toDisplayStates(states: RobotState[], startDir: RobotDir): RobotDisplayState[] {
  let deg = DIR_DEG[startDir]
  let prev: RobotDir = startDir
  return states.map((s, i) => {
    if (i > 0 && s.dir !== prev) {
      deg += TURN_RIGHT[prev] === s.dir ? 90 : -90
      prev = s.dir
    }
    return { ...s, deg }
  })
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

const TICK_MS = 400

export function RobotPath({ segment, disabled, onFinish, verdict }: ExerciseProps) {
  const { t } = useTranslation()
  const parsed = useMemo(() => parseRobotPayload(segment.payload), [segment])
  const palette = (segment.payload.commands as RobotCommand[] | undefined) ?? []
  const [queue, setQueue] = useState<RobotCommand[]>([])
  const [phase, setPhase] = useState<'edit' | 'running' | 'done'>('edit')
  const [marker, setMarker] = useState<RobotDisplayState | null>(null)
  const [bump, setBump] = useState(false)
  const finished = useRef(false)
  const timers = useRef<number[]>([])

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach((id) => window.clearTimeout(id))
  }, [])

  if (!parsed) return null
  const { world, start, goal, maxCommands } = parsed
  const shown = marker ?? { ...start, blocked: false, deg: DIR_DEG[start.dir] }

  const commandLabel: Record<RobotCommand, string> = {
    forward: t('lesson.families.maker.forward'),
    left: t('lesson.families.maker.turnLeft'),
    right: t('lesson.families.maker.turnRight'),
  }

  const finish = (commands: RobotCommand[]) => {
    if (finished.current || !onFinish) return
    finished.current = true
    onFinish({ commands })
  }

  const run = () => {
    if (queue.length === 0 || phase !== 'edit') return
    const display = toDisplayStates(simulateRobot(world, start, queue), start.dir)
    if (prefersReducedMotion()) {
      setMarker(display[display.length - 1] ?? shown)
      setPhase('done')
      finish(queue)
      return
    }
    setPhase('running')
    display.forEach((state, i) => {
      if (i === 0) return
      timers.current.push(
        window.setTimeout(() => {
          setMarker(state)
          if (state.blocked) {
            setBump(true)
            timers.current.push(window.setTimeout(() => setBump(false), 180))
          }
        }, i * TICK_MS),
      )
    })
    timers.current.push(
      window.setTimeout(() => {
        setPhase('done')
        finish(queue)
      }, display.length * TICK_MS),
    )
  }

  const bumpDelta = DIR_DELTA[shown.dir]
  const cells: Array<{ x: number; y: number }> = []
  for (let y = 0; y < world.h; y++) for (let x = 0; x < world.w; x++) cells.push({ x, y })

  return (
    <div className="space-y-4">
      <div
        role="img"
        aria-label={t('lesson.families.maker.grid')}
        className="relative mx-auto w-full max-w-xs"
      >
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${world.w}, minmax(0, 1fr))` }}
        >
          {cells.map(({ x, y }) => {
            const isWall = world.walls.some((wall) => wall.x === x && wall.y === y)
            const isGoal = goal.x === x && goal.y === y
            return (
              <div
                key={`${x}-${y}`}
                className={cn(
                  'flex aspect-square items-center justify-center rounded-sm',
                  isWall ? 'bg-secondary-soft' : 'bg-surface-sunken',
                  isGoal && verdict && (verdict.correct ? 'bg-success-soft' : 'bg-error-soft'),
                )}
              >
                {isGoal ? <Icon name="flag" fill className="text-[24px] text-accent" /> : null}
              </div>
            )
          })}
        </div>
        <div
          className="pointer-events-none absolute flex items-center justify-center transition-[left,top,transform] duration-300 ease-out motion-reduce:transition-none"
          style={{
            width: `${100 / world.w}%`,
            height: `${100 / world.h}%`,
            left: `${(shown.x * 100) / world.w}%`,
            top: `${(shown.y * 100) / world.h}%`,
            transform: bump
              ? `translate(${bumpDelta.dx * 20}%, ${bumpDelta.dy * 20}%)`
              : 'translate(0, 0)',
          }}
        >
          <span
            className="flex items-center justify-center transition-transform duration-300 ease-out motion-reduce:transition-none"
            style={{ transform: `rotate(${shown.deg}deg)` }}
          >
            <Icon name="arrow_upward" className="text-[28px] text-primary" />
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <p className="lf-label text-content-muted">{t('lesson.families.maker.program')}</p>
          <p className="lf-caption text-content-muted">
            {queue.length}/{maxCommands}
          </p>
        </div>
        <SunkenWell>
          {queue.length === 0 ? (
            <p className="lf-caption py-2 text-center text-content-muted">
              {t('lesson.families.maker.programEmpty')}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {queue.map((cmd, i) => (
                <TokenChip
                  key={`${cmd}-${i}`}
                  disabled={disabled || phase !== 'edit'}
                  onSelect={() => setQueue((prev) => prev.filter((_, j) => j !== i))}
                >
                  <Icon name={COMMAND_ICON[cmd]} className="text-[20px]" />
                  <span className="sr-only">{commandLabel[cmd]}</span>
                </TokenChip>
              ))}
            </div>
          )}
        </SunkenWell>
      </div>

      <div className="flex flex-wrap justify-center gap-2" role="group" aria-label={t('lesson.families.maker.commands')}>
        {palette.map((cmd) => (
          <TokenChip
            key={cmd}
            disabled={disabled || phase !== 'edit' || queue.length >= maxCommands}
            onSelect={() => setQueue((prev) => [...prev, cmd])}
          >
            <Icon name={COMMAND_ICON[cmd]} className="text-[20px]" />
            <span className="ml-1.5">{commandLabel[cmd]}</span>
          </TokenChip>
        ))}
      </div>

      {phase === 'edit' && !verdict ? (
        <div className="flex justify-center gap-3">
          <Button
            variant="secondary"
            disabled={disabled || queue.length === 0}
            onClick={() => setQueue([])}
          >
            {t('lesson.families.maker.reset')}
          </Button>
          <Button variant="primary" disabled={disabled || queue.length === 0} onClick={run}>
            <Icon name="play_arrow" fill className="text-[20px]" />
            {t('lesson.families.maker.run')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

// ---- debug_hunt -------------------------------------------------------------------

export function DebugHunt({ segment, value, onChange, disabled, verdict }: ExerciseProps) {
  const draft = draftOf(value)
  const selected = (draft.selected as string[] | undefined) ?? []
  const blocks = segment.payload.blocks as Array<{ id: string; text_md: string }>
  const reveal = revealOf(verdict)
  const bugIds = reveal.bug_ids as string[] | undefined
  const fixMd = reveal.fix_md as string | undefined

  const blockState = (id: string): OptionVisualState => {
    if (verdict && bugIds) {
      if (bugIds.includes(id)) return 'correct'
      if (selected.includes(id)) return 'wrong'
      return 'dimmed'
    }
    return selected.includes(id) ? 'selected' : 'idle'
  }

  return (
    <div className="space-y-4">
      <SunkenWell>
        <MarkdownLite text={segment.payload.intro_md as string} className="lf-body text-content" />
      </SunkenWell>
      <div className="space-y-2" role="group">
        {blocks.map((block) => (
          <OptionCard
            key={block.id}
            role="checkbox"
            ariaChecked={selected.includes(block.id)}
            state={blockState(block.id)}
            disabled={disabled}
            onSelect={() =>
              onChange({
                selected: selected.includes(block.id)
                  ? selected.filter((x) => x !== block.id)
                  : [...selected, block.id],
              })
            }
          >
            <CodeLine text={block.text_md} />
          </OptionCard>
        ))}
      </div>
      {fixMd ? (
        <div className="rounded-md border-2 border-success bg-success-soft p-3">
          <MarkdownLite text={fixMd} className="lf-body text-content" />
        </div>
      ) : null}
    </div>
  )
}

// ---- balance_scale ------------------------------------------------------------------

export function BalanceScale({ segment, value, onChange, disabled, verdict }: ExerciseProps) {
  const { t } = useTranslation()
  const draft = draftOf(value)
  const placed = (draft.placed as string[] | undefined) ?? []
  const leftFixed = segment.payload.left_fixed as Array<{ label: string; value: number }>
  const weights = segment.payload.weights as Array<{ id: string; label: string; value: number }>
  const unknownLabel = segment.payload.unknown_label as string | undefined
  const reveal = revealOf(verdict)
  const target = reveal.target as number | undefined

  const leftSum = leftFixed.reduce((acc, i) => acc + i.value, 0)
  const rightSum = placed.reduce(
    (acc, id) => acc + (weights.find((w) => w.id === id)?.value ?? 0),
    0,
  )
  const angle = Math.max(-12, Math.min(12, (rightSum - leftSum) * 2))
  const bank = weights.filter((w) => !placed.includes(w.id))
  const leftTotal = target ?? (unknownLabel ? '?' : leftSum)

  return (
    <div className="space-y-4">
      <div className="mx-auto w-full max-w-sm">
        <div
          className="relative pt-2 transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{ transform: `rotate(${angle}deg)` }}
        >
          <div className="absolute inset-x-8 top-0 h-2 rounded-full bg-content-muted/60" />
          <div className="flex justify-between gap-4 pt-3">
            <div
              role="group"
              aria-label={t('lesson.families.maker.leftPan')}
              className="min-h-24 w-[46%] rounded-md border-2 border-outline/70 bg-surface p-2"
            >
              <div className="flex flex-wrap justify-center gap-1.5">
                {leftFixed.map((item, i) => (
                  <span
                    key={i}
                    className="inline-flex min-h-9 items-center rounded-full bg-primary-soft px-3 py-1 lf-label text-primary"
                  >
                    {item.label} · {item.value}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-center lf-title text-content">{leftTotal}</p>
            </div>
            <div
              role="group"
              aria-label={t('lesson.families.maker.rightPan')}
              className={cn(
                'min-h-24 w-[46%] rounded-md border-2 p-2',
                verdict
                  ? verdict.correct
                    ? 'border-success bg-success-soft'
                    : 'border-error bg-error-soft'
                  : 'border-dashed border-outline/70 bg-surface',
              )}
            >
              <div className="flex flex-wrap justify-center gap-1.5">
                {placed.map((id) => {
                  const weight = weights.find((w) => w.id === id)
                  if (!weight) return null
                  return (
                    <TokenChip
                      key={id}
                      state="selected"
                      disabled={disabled}
                      onSelect={() => onChange({ placed: placed.filter((x) => x !== id) })}
                      className="min-h-9 px-3 py-1"
                    >
                      {weight.label}
                    </TokenChip>
                  )
                })}
              </div>
              <p className="mt-2 text-center lf-title text-content">{rightSum}</p>
            </div>
          </div>
        </div>
        <div className="mx-auto -mt-1 h-8 w-2 rounded-b-full bg-content-muted/60" />
      </div>

      <div className="space-y-2">
        <p className="lf-label text-content-muted">{t('lesson.families.maker.weights')}</p>
        <SunkenWell>
          <div className="flex flex-wrap gap-2">
            {bank.map((weight) => (
              <TokenChip
                key={weight.id}
                disabled={disabled}
                onSelect={() => onChange({ placed: [...placed, weight.id] })}
              >
                {weight.label}
              </TokenChip>
            ))}
            {bank.length === 0 ? (
              <p className="lf-caption py-1 text-content-muted">—</p>
            ) : null}
          </div>
        </SunkenWell>
      </div>
    </div>
  )
}

// ---- measure_read ------------------------------------------------------------------

interface InstrumentProps {
  min: number
  max: number
  ticks: number
  pointerValue: number
}

function fracOf({ min, max, pointerValue }: InstrumentProps): number {
  if (max === min) return 0
  return Math.max(0, Math.min(1, (pointerValue - min) / (max - min)))
}

function tickFractions(ticks: number): number[] {
  const n = Math.max(2, ticks)
  return Array.from({ length: n }, (_, i) => i / (n - 1))
}

const SVG_MUTED = 'rgb(var(--lf-content-muted))'
const SVG_OUTLINE = 'rgb(var(--lf-outline))'
const SVG_PRIMARY = 'rgb(var(--lf-primary))'
const SVG_ACCENT = 'rgb(var(--lf-accent))'

function RulerSvg(props: InstrumentProps) {
  const frac = fracOf(props)
  const x0 = 20
  const x1 = 260
  const px = x0 + frac * (x1 - x0)
  return (
    <svg viewBox="0 0 280 84" className="mx-auto h-auto w-full max-w-xs">
      <polygon points={`${px},34 ${px - 7},18 ${px + 7},18`} fill={SVG_ACCENT} />
      <rect x={x0 - 8} y={40} width={x1 - x0 + 16} height={26} rx={6} fill="none" stroke={SVG_OUTLINE} strokeWidth={2} />
      <line x1={x0} y1={40} x2={x1} y2={40} stroke={SVG_MUTED} strokeWidth={2} />
      {tickFractions(props.ticks).map((f, i) => {
        const x = x0 + f * (x1 - x0)
        return <line key={i} x1={x} y1={40} x2={x} y2={54} stroke={SVG_MUTED} strokeWidth={2} />
      })}
      <text x={x0} y={80} fontSize={12} textAnchor="middle" fill={SVG_MUTED}>
        {props.min}
      </text>
      <text x={x1} y={80} fontSize={12} textAnchor="middle" fill={SVG_MUTED}>
        {props.max}
      </text>
    </svg>
  )
}

function ThermometerSvg(props: InstrumentProps) {
  const frac = fracOf(props)
  const yTop = 20
  const yBottom = 160
  const fillTop = yBottom - frac * (yBottom - yTop)
  return (
    <svg viewBox="0 0 120 220" className="mx-auto h-auto w-40 max-w-full">
      <rect x={44} y={yTop - 8} width={32} height={yBottom - yTop + 16} rx={16} fill="none" stroke={SVG_OUTLINE} strokeWidth={3} />
      <rect x={52} y={fillTop} width={16} height={yBottom - fillTop + 8} rx={8} fill={SVG_PRIMARY} />
      <circle cx={60} cy={182} r={22} fill={SVG_PRIMARY} stroke={SVG_OUTLINE} strokeWidth={3} />
      {tickFractions(props.ticks).map((f, i) => {
        const y = yBottom - f * (yBottom - yTop)
        return <line key={i} x1={80} y1={y} x2={92} y2={y} stroke={SVG_MUTED} strokeWidth={2} />
      })}
      <text x={98} y={yBottom + 4} fontSize={12} fill={SVG_MUTED}>
        {props.min}
      </text>
      <text x={98} y={yTop + 4} fontSize={12} fill={SVG_MUTED}>
        {props.max}
      </text>
    </svg>
  )
}

function GaugeSvg(props: InstrumentProps) {
  const frac = fracOf(props)
  const cx = 120
  const cy = 118
  const r = 90
  const angle = Math.PI * (1 - frac)
  const nx = cx + Math.cos(angle) * (r - 22)
  const ny = cy - Math.sin(angle) * (r - 22)
  return (
    <svg viewBox="0 0 240 140" className="mx-auto h-auto w-full max-w-xs">
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke={SVG_OUTLINE}
        strokeWidth={10}
        strokeLinecap="round"
      />
      {tickFractions(props.ticks).map((f, i) => {
        const a = Math.PI * (1 - f)
        const x1 = cx + Math.cos(a) * (r - 10)
        const y1 = cy - Math.sin(a) * (r - 10)
        const x2 = cx + Math.cos(a) * (r + 2)
        const y2 = cy - Math.sin(a) * (r + 2)
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={SVG_MUTED} strokeWidth={2} />
      })}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={SVG_ACCENT} strokeWidth={5} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={9} fill={SVG_ACCENT} />
      <text x={cx - r} y={cy + 20} fontSize={12} textAnchor="middle" fill={SVG_MUTED}>
        {props.min}
      </text>
      <text x={cx + r} y={cy + 20} fontSize={12} textAnchor="middle" fill={SVG_MUTED}>
        {props.max}
      </text>
    </svg>
  )
}

function BeakerSvg(props: InstrumentProps) {
  const frac = fracOf(props)
  const yTop = 24
  const yBottom = 160
  const fillTop = yBottom - frac * (yBottom - yTop)
  return (
    <svg viewBox="0 0 200 180" className="mx-auto h-auto w-48 max-w-full">
      <rect x={48} y={fillTop} width={94} height={yBottom - fillTop} fill={SVG_PRIMARY} opacity={0.45} />
      <line x1={48} y1={fillTop} x2={142} y2={fillTop} stroke={SVG_PRIMARY} strokeWidth={3} />
      <path
        d={`M 42 ${yTop - 6} L 48 ${yTop} L 48 ${yBottom} Q 48 ${yBottom + 8} 56 ${yBottom + 8} L 134 ${yBottom + 8} Q 142 ${yBottom + 8} 142 ${yBottom} L 142 ${yTop} L 148 ${yTop - 6}`}
        fill="none"
        stroke={SVG_OUTLINE}
        strokeWidth={4}
        strokeLinecap="round"
      />
      {tickFractions(props.ticks).map((f, i) => {
        const y = yBottom - f * (yBottom - yTop)
        return <line key={i} x1={142} y1={y} x2={152} y2={y} stroke={SVG_MUTED} strokeWidth={2} />
      })}
      <text x={158} y={yBottom + 4} fontSize={12} fill={SVG_MUTED}>
        {props.min}
      </text>
      <text x={158} y={yTop + 4} fontSize={12} fill={SVG_MUTED}>
        {props.max}
      </text>
    </svg>
  )
}

const INSTRUMENTS: Record<string, (props: InstrumentProps) => ReturnType<typeof RulerSvg>> = {
  ruler: RulerSvg,
  thermometer: ThermometerSvg,
  gauge: GaugeSvg,
  beaker: BeakerSvg,
}

export function MeasureRead({ segment, value, onChange, disabled, verdict }: ExerciseProps) {
  const { t } = useTranslation()
  const draft = draftOf(value)
  const entered = (draft.value as string | undefined) ?? ''
  const instrument = segment.payload.instrument as string
  const unit = segment.payload.unit as string
  const reveal = revealOf(verdict)
  const targetValue = reveal.value as number | undefined
  const InstrumentSvg = INSTRUMENTS[instrument] ?? RulerSvg
  return (
    <div className="space-y-4">
      <div role="img" aria-label={t('lesson.families.maker.instrument')}>
        <InstrumentSvg
          min={segment.payload.min as number}
          max={segment.payload.max as number}
          ticks={segment.payload.ticks as number}
          pointerValue={segment.payload.pointer_value as number}
        />
      </div>
      <div className="text-center">
        <span
          className={cn(
            'inline-flex min-h-11 items-center gap-2 rounded-full px-5 py-1.5 lf-title',
            verdict
              ? verdict.correct
                ? 'bg-success-soft text-success-strong'
                : 'bg-error-soft text-error-strong'
              : 'bg-primary-soft text-primary',
          )}
        >
          {entered === '' ? '—' : entered}
          <span className="lf-label">{unit}</span>
        </span>
        {verdict && !verdict.correct && targetValue !== undefined ? (
          <p className="mt-1 lf-caption text-success-strong">
            {targetValue} {unit}
          </p>
        ) : null}
      </div>
      <NumberPad
        value={entered}
        onChange={(next) => onChange({ value: next })}
        allowDecimal
        disabled={disabled}
      />
    </div>
  )
}

// ---- machine_io -------------------------------------------------------------------

function MachineRow({ input, output, highlight }: { input: string; output: string; highlight?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center justify-center gap-2 rounded-md border-2 p-2',
        highlight ? 'border-primary bg-primary-soft/40' : 'border-outline/50 bg-surface',
      )}
    >
      <span className="inline-flex min-h-9 min-w-11 items-center justify-center rounded-md bg-surface-sunken px-3 font-code text-sm text-content">
        {input}
      </span>
      <Icon name="arrow_forward" className="text-[18px] text-content-muted" />
      <span className="inline-flex min-h-9 items-center justify-center rounded-md bg-secondary-soft px-2.5">
        <Icon name="settings" className="text-[22px] text-primary" />
      </span>
      <Icon name="arrow_forward" className="text-[18px] text-content-muted" />
      <span
        className={cn(
          'inline-flex min-h-9 min-w-11 items-center justify-center rounded-md px-3 font-code text-sm',
          highlight ? 'bg-primary-soft text-primary' : 'bg-surface-sunken text-content',
        )}
      >
        {output}
      </span>
    </div>
  )
}

export function MachineIo({ segment, value, onChange, disabled, verdict }: ExerciseProps) {
  const draft = draftOf(value)
  const examples = segment.payload.examples as Array<{ in: number | string; out: number | string }>
  const probeIn = segment.payload.probe_in as number | string
  const options = segment.payload.options as Array<{ id: string; text_md: string }> | undefined
  const reveal = revealOf(verdict)
  const selected = draft.option_id as string | undefined
  const entered = (draft.value as string | undefined) ?? ''
  const correctOptionId = reveal.correct_option_id as string | undefined
  const targetValue = reveal.value as number | undefined

  const optionState = (id: string): OptionVisualState => {
    if (verdict && correctOptionId) {
      if (id === correctOptionId) return 'correct'
      if (id === selected) return 'wrong'
      return 'dimmed'
    }
    return id === selected ? 'selected' : 'idle'
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {examples.map((example, i) => (
          <MachineRow key={i} input={String(example.in)} output={String(example.out)} />
        ))}
        <MachineRow input={String(probeIn)} output={entered !== '' ? entered : '?'} highlight />
      </div>
      {options ? (
        <div className="space-y-3" role="radiogroup">
          {options.map((option) => (
            <OptionCard
              key={option.id}
              role="radio"
              ariaChecked={selected === option.id}
              state={optionState(option.id)}
              disabled={disabled}
              onSelect={() => onChange({ option_id: option.id })}
            >
              <MarkdownLite text={option.text_md} />
            </OptionCard>
          ))}
        </div>
      ) : (
        <>
          {verdict && !verdict.correct && targetValue !== undefined ? (
            <p className="text-center lf-caption text-success-strong">{targetValue}</p>
          ) : null}
          <NumberPad
            value={entered}
            onChange={(next) => onChange({ value: next })}
            allowDecimal
            disabled={disabled}
          />
        </>
      )}
    </div>
  )
}

// ---- canSubmit / buildAnswer --------------------------------------------------------

export const makerCanSubmit = {
  code_order: (draft: unknown, segment: SegmentBase) => {
    const order = (draftOf(draft).order as string[] | undefined) ?? []
    const blocks = segment.payload.blocks as Array<{ id: string }>
    return order.length === blocks.length && blocks.length > 0
  },
  debug_hunt: (draft: unknown) => {
    const selected = (draftOf(draft).selected as string[] | undefined) ?? []
    return selected.length >= 1
  },
  balance_scale: (draft: unknown) => {
    const placed = (draftOf(draft).placed as string[] | undefined) ?? []
    return placed.length >= 1
  },
  measure_read: (draft: unknown) => isNumericDraft(draftOf(draft).value),
  machine_io: (draft: unknown, segment: SegmentBase) => {
    const d = draftOf(draft)
    if (segment.payload.options) return Boolean(d.option_id)
    return isNumericDraft(d.value)
  },
}

export function buildMeasureAnswer(draft: unknown): unknown {
  return { value: Number(draftOf(draft).value) }
}

export function buildMachineAnswer(draft: unknown, segment: SegmentBase): unknown {
  const d = draftOf(draft)
  if (segment.payload.options) return { option_id: d.option_id }
  return { value: Number(d.value) }
}
