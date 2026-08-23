// `choice` family renderers (LESSON_ENGINE.md §5.2). All controlled; the shell
// owns the Check button (input kind). speed_tap is a flow and drives itself.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui'
import type { ExerciseProps } from '../../core/types'
import MarkdownLite from '../../core/MarkdownLite'
import { seededSort } from '../../core/shuffle'
import {
  BigIconTile,
  GentleTimerBar,
  KidSlider,
  OptionCard,
  SunkenWell,
  TokenChip,
  VisualMark,
  type OptionVisualState,
} from '../../core/primitives'

type Dict = Record<string, unknown>
const draftOf = (v: unknown): Dict => (typeof v === 'object' && v !== null ? (v as Dict) : {})

function idListState(
  id: string,
  selectedId: string | undefined,
  verdict: ExerciseProps['verdict'],
  correctId: string | undefined,
): OptionVisualState {
  if (verdict && correctId) {
    if (id === correctId) return 'correct'
    if (id === selectedId) return 'wrong'
    return 'dimmed'
  }
  return id === selectedId ? 'selected' : 'idle'
}

function revealOf(verdict: ExerciseProps['verdict']): Dict {
  return draftOf(verdict?.reveal)
}

// ---- quiz_mcq / best_decision (single-select list) ---------------------------

export function QuizMcq({ segment, value, onChange, disabled, verdict }: ExerciseProps) {
  const draft = draftOf(value)
  const selected = draft.option_id as string | undefined
  const options = useMemo(() => {
    const list = segment.payload.options as Array<{ id: string; text_md: string; image_url?: string }>
    // Shuffle by default (A7): the correct option is often authored first, so a
    // fixed order leaks the answer. Content can opt out with shuffle:false.
    return segment.payload.shuffle === false ? [...list] : seededSort(list, segment.id, (o) => o.id)
  }, [segment])
  const correctId = revealOf(verdict).correct_option_id as string | undefined
  return (
    <div className="space-y-3" role="radiogroup">
      {options.map((option) => (
        <OptionCard
          key={option.id}
          role="radio"
          ariaChecked={selected === option.id}
          state={idListState(option.id, selected, verdict, correctId)}
          disabled={disabled}
          onSelect={() => onChange({ option_id: option.id })}
        >
          {option.image_url ? (
            <span className="flex items-center gap-3">
              <VisualMark imageUrl={option.image_url} imgClassName="h-12 w-12" />
              <MarkdownLite text={option.text_md} />
            </span>
          ) : (
            <MarkdownLite text={option.text_md} />
          )}
        </OptionCard>
      ))}
    </div>
  )
}

export function BestDecision(props: ExerciseProps) {
  const scenario = props.segment.payload.scenario_md as string
  const correctId = revealOf(props.verdict).best_option_id as string | undefined
  const draft = draftOf(props.value)
  const selected = draft.option_id as string | undefined
  const options = useMemo(
    () => seededSort(props.segment.payload.options as Array<{ id: string; text_md: string }>, props.segment.id, (o) => o.id),
    [props.segment],
  )
  return (
    <div className="space-y-4">
      <SunkenWell>
        <MarkdownLite text={scenario} className="lf-body text-content" />
      </SunkenWell>
      <div className="space-y-3" role="radiogroup">
        {options.map((option) => (
          <OptionCard
            key={option.id}
            role="radio"
            ariaChecked={selected === option.id}
            state={idListState(option.id, selected, props.verdict, correctId)}
            disabled={props.disabled}
            onSelect={() => props.onChange({ option_id: option.id })}
          >
            <MarkdownLite text={option.text_md} />
          </OptionCard>
        ))}
      </div>
    </div>
  )
}

// ---- true_false ----------------------------------------------------------------

export function TrueFalse({ segment, value, onChange, disabled, verdict }: ExerciseProps) {
  const { t } = useTranslation()
  const draft = draftOf(value)
  const chosen = draft.is_true as boolean | undefined
  // The justification bank was rendered in authored order, which runs parallel to
  // the answer key (authors write the right "why" first), so the second half of the
  // exercise was answerable by tapping the top row. Grading is by
  // `justification_id`, so display order is free. Distinct ':j' sub-seed keeps this
  // bank uncorrelated with any other list in the segment.
  const justifications = useMemo(() => {
    const list = segment.payload.justifications as Array<{ id: string; text_md: string }> | undefined
    return list ? seededSort(list, segment.id + ':j', (j) => j.id) : undefined
  }, [segment])
  const reveal = revealOf(verdict)
  const correctBool = reveal.is_true as boolean | undefined

  const boolState = (isTrue: boolean): OptionVisualState => {
    if (verdict && correctBool !== undefined) {
      if (isTrue === correctBool) return 'correct'
      if (isTrue === chosen) return 'wrong'
      return 'dimmed'
    }
    return chosen === isTrue ? 'selected' : 'idle'
  }

  return (
    <div className="space-y-4">
      <SunkenWell>
        <MarkdownLite text={segment.payload.statement_md as string} className="lf-body-lg text-content" />
      </SunkenWell>
      <div className="grid grid-cols-2 gap-3" role="radiogroup">
        {[true, false].map((isTrue) => (
          <OptionCard
            key={String(isTrue)}
            role="radio"
            ariaChecked={chosen === isTrue}
            state={boolState(isTrue)}
            disabled={disabled}
            onSelect={() => onChange({ ...draft, is_true: isTrue })}
            mark={false}
            className="justify-center text-center"
          >
            <span className="lf-title">{isTrue ? t('lesson.trueFalse.true') : t('lesson.trueFalse.false')}</span>
          </OptionCard>
        ))}
      </div>
      {justifications && chosen !== undefined ? (
        <div className="space-y-2">
          <p className="lf-label text-content-muted">{t('lesson.trueFalse.why')}</p>
          <div className="space-y-2" role="radiogroup">
            {justifications.map((j) => (
              <OptionCard
                key={j.id}
                role="radio"
                ariaChecked={draft.justification_id === j.id}
                state={idListState(
                  j.id,
                  draft.justification_id as string | undefined,
                  verdict,
                  reveal.correct_justification_id as string | undefined,
                )}
                disabled={disabled}
                onSelect={() => onChange({ ...draft, justification_id: j.id })}
              >
                <MarkdownLite text={j.text_md} />
              </OptionCard>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

// ---- picture_choice --------------------------------------------------------------

export function PictureChoice({ segment, value, onChange, disabled, verdict }: ExerciseProps) {
  const draft = draftOf(value)
  const selected = draft.option_id as string | undefined
  const correctId = revealOf(verdict).correct_option_id as string | undefined
  const options = useMemo(
    () =>
      seededSort(
        segment.payload.options as Array<{ id: string; icon: string; image_url?: string; label: string }>,
        segment.id,
        (o) => o.id,
      ),
    [segment],
  )
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {options.map((option) => (
        <BigIconTile
          key={option.id}
          icon={option.icon}
          imageUrl={option.image_url}
          label={option.label}
          state={idListState(option.id, selected, verdict, correctId)}
          disabled={disabled}
          onSelect={() => onChange({ option_id: option.id })}
        />
      ))}
    </div>
  )
}

// ---- odd_one_out ---------------------------------------------------------------

export function OddOneOut({ segment, value, onChange, disabled, verdict }: ExerciseProps) {
  const { t } = useTranslation()
  const draft = draftOf(value)
  const items = useMemo(
    () =>
      seededSort(
        segment.payload.items as Array<{ id: string; text_md: string; icon?: string; image_url?: string }>,
        segment.id,
        (i) => i.id,
      ),
    [segment],
  )
  const reasons = useMemo(
    () =>
      segment.payload.reasons
        ? seededSort(segment.payload.reasons as Array<{ id: string; text_md: string }>, segment.id + ':r', (r) => r.id)
        : undefined,
    [segment],
  )
  const reveal = revealOf(verdict)
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2" role="radiogroup">
        {items.map((item) => (
          <OptionCard
            key={item.id}
            role="radio"
            ariaChecked={draft.item_id === item.id}
            state={idListState(
              item.id,
              draft.item_id as string | undefined,
              verdict,
              reveal.odd_item_id as string | undefined,
            )}
            disabled={disabled}
            onSelect={() => onChange({ ...draft, item_id: item.id })}
          >
            {item.image_url || item.icon ? (
              <span className="flex flex-col items-center gap-2 text-center">
                <VisualMark imageUrl={item.image_url} icon={item.icon} imgClassName="h-14 w-14" iconClassName="text-[40px]" />
                <MarkdownLite text={item.text_md} />
              </span>
            ) : (
              <MarkdownLite text={item.text_md} />
            )}
          </OptionCard>
        ))}
      </div>
      {reasons && draft.item_id ? (
        <div className="space-y-2">
          <p className="lf-label text-content-muted">{t('lesson.oddOneOut.why')}</p>
          <div className="space-y-2" role="radiogroup">
            {reasons.map((reason) => (
              <OptionCard
                key={reason.id}
                role="radio"
                ariaChecked={draft.reason_id === reason.id}
                state={idListState(
                  reason.id,
                  draft.reason_id as string | undefined,
                  verdict,
                  reveal.correct_reason_id as string | undefined,
                )}
                disabled={disabled}
                onSelect={() => onChange({ ...draft, reason_id: reason.id })}
              >
                <MarkdownLite text={reason.text_md} />
              </OptionCard>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

// ---- yes_no_cases -----------------------------------------------------------------

export function YesNoCases({ segment, value, onChange, disabled, verdict }: ExerciseProps) {
  const { t } = useTranslation()
  const draft = draftOf(value)
  const decisions = (draft.decisions as Record<string, boolean> | undefined) ?? {}
  const cases = segment.payload.cases as Array<{ id: string; text_md: string; icon?: string; image_url?: string }>
  const correctIds = revealOf(verdict).applies_ids as string[] | undefined
  return (
    <div className="space-y-4">
      <SunkenWell>
        <MarkdownLite text={segment.payload.rule_md as string} className="lf-body-lg text-content" />
      </SunkenWell>
      <ul className="space-y-3">
        {cases.map((c) => {
          const decided = decisions[c.id]
          const shouldApply = correctIds?.includes(c.id)
          return (
            <li key={c.id} className="lf-slab rounded-md p-3">
              {c.image_url || c.icon ? (
                <div className="flex items-center gap-3">
                  <VisualMark imageUrl={c.image_url} icon={c.icon} imgClassName="h-12 w-12" iconClassName="text-[32px]" />
                  <MarkdownLite text={c.text_md} className="lf-body text-content" />
                </div>
              ) : (
                <MarkdownLite text={c.text_md} className="lf-body text-content" />
              )}
              <div className="mt-2 flex gap-2">
                {[true, false].map((yes) => {
                  let state: OptionVisualState = decided === yes ? 'selected' : 'idle'
                  if (verdict && correctIds) {
                    if (yes === shouldApply) state = 'correct'
                    else if (decided === yes) state = 'wrong'
                    else state = 'dimmed'
                  }
                  return (
                    <TokenChip
                      key={String(yes)}
                      state={state}
                      disabled={disabled}
                      onSelect={() =>
                        onChange({ ...draft, decisions: { ...decisions, [c.id]: yes } })
                      }
                      className="flex-1"
                    >
                      {yes ? t('lesson.yesNoCases.yes') : t('lesson.yesNoCases.no')}
                    </TokenChip>
                  )
                })}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ---- confidence_quiz -----------------------------------------------------------

export function ConfidenceQuiz({ segment, value, onChange, disabled, verdict }: ExerciseProps) {
  const { t } = useTranslation()
  const draft = draftOf(value)
  const selected = draft.option_id as string | undefined
  const confidence = (draft.confidence as number | undefined) ?? 75
  const correctId = revealOf(verdict).correct_option_id as string | undefined
  const options = useMemo(
    () =>
      seededSort(
        segment.payload.options as Array<{ id: string; text_md: string; image_url?: string }>,
        segment.id,
        (o) => o.id,
      ),
    [segment],
  )
  return (
    <div className="space-y-4">
      <div className="space-y-3" role="radiogroup">
        {options.map((option) => (
          <OptionCard
            key={option.id}
            role="radio"
            ariaChecked={selected === option.id}
            state={idListState(option.id, selected, verdict, correctId)}
            disabled={disabled}
            onSelect={() => onChange({ ...draft, option_id: option.id, confidence })}
          >
            {option.image_url ? (
              <span className="flex items-center gap-3">
                <VisualMark imageUrl={option.image_url} imgClassName="h-12 w-12" />
                <MarkdownLite text={option.text_md} />
              </span>
            ) : (
              <MarkdownLite text={option.text_md} />
            )}
          </OptionCard>
        ))}
      </div>
      {selected ? (
        <div className="space-y-1">
          <p className="lf-label text-content-muted">{t('lesson.confidence.howSure')}</p>
          <KidSlider
            min={50}
            max={100}
            step={5}
            value={confidence}
            disabled={disabled}
            onChange={(v) => onChange({ ...draft, confidence: v })}
            format={(v) => `${v}%`}
          />
        </div>
      ) : null}
    </div>
  )
}

// ---- speed_tap (flow) ------------------------------------------------------------

export function SpeedTap({ segment, disabled, onFinish, verdict }: ExerciseProps) {
  const { t } = useTranslation()
  const [phase, setPhase] = useState<'ready' | 'running' | 'done'>('ready')
  const [selected, setSelected] = useState<string[]>([])
  const [overtime, setOvertime] = useState(false)
  // The tappable bank was rendered in authored order, and authors list the targets
  // first — so sweeping the leading chips scored full marks with no reasoning.
  // Grading compares ids (`selected_ids` vs `target_ids`), so display order is free.
  const items = useMemo(
    () =>
      seededSort(
        segment.payload.items as Array<{ id: string; text_md: string; icon?: string; image_url?: string }>,
        segment.id,
        (i) => i.id,
      ),
    [segment],
  )
  const seconds = segment.payload.seconds as number
  const targetIds = revealOf(verdict).target_ids as string[] | undefined

  const finishedRef = useRef(false)
  useEffect(() => {
    if (phase === 'done' && onFinish && !finishedRef.current) {
      finishedRef.current = true
      onFinish({ selected_ids: selected, overtime })
    }
  }, [phase, onFinish, selected, overtime])

  if (phase === 'ready' && !verdict) {
    return (
      <div className="space-y-4 text-center">
        <SunkenWell>
          <MarkdownLite text={segment.payload.instruction_md as string} className="lf-body-lg text-content" />
        </SunkenWell>
        <Button variant="primary" onClick={() => setPhase('running')} disabled={disabled}>
          {t('lesson.flow.start')}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {phase === 'running' ? (
        <GentleTimerBar
          seconds={seconds}
          running
          onExpire={() => {
            setOvertime(true)
            setPhase('done')
          }}
        />
      ) : null}
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          let state: OptionVisualState = selected.includes(item.id) ? 'selected' : 'idle'
          if (verdict && targetIds) {
            if (targetIds.includes(item.id)) state = 'correct'
            else if (selected.includes(item.id)) state = 'wrong'
            else state = 'dimmed'
          }
          return (
            <TokenChip
              key={item.id}
              state={state}
              disabled={disabled || phase !== 'running'}
              onSelect={() =>
                setSelected((prev) =>
                  prev.includes(item.id) ? prev.filter((x) => x !== item.id) : [...prev, item.id],
                )
              }
            >
              {item.image_url || item.icon ? (
                <span className="flex items-center gap-2">
                  <VisualMark imageUrl={item.image_url} icon={item.icon} imgClassName="h-10 w-10" iconClassName="text-[28px]" />
                  <MarkdownLite text={item.text_md} />
                </span>
              ) : (
                <MarkdownLite text={item.text_md} />
              )}
            </TokenChip>
          )
        })}
      </div>
      {phase === 'running' ? (
        <div className="text-center">
          <Button variant="secondary" onClick={() => setPhase('done')}>
            {t('lesson.flow.done')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

export const choiceCanSubmit = {
  quiz_mcq: (draft: unknown) => Boolean(draftOf(draft).option_id),
  true_false: (draft: unknown, segment: { payload: Record<string, unknown> }) => {
    const d = draftOf(draft)
    if (typeof d.is_true !== 'boolean') return false
    return !segment.payload.justifications || Boolean(d.justification_id)
  },
  picture_choice: (draft: unknown) => Boolean(draftOf(draft).option_id),
  odd_one_out: (draft: unknown, segment: { payload: Record<string, unknown> }) => {
    const d = draftOf(draft)
    if (!d.item_id) return false
    return !segment.payload.reasons || Boolean(d.reason_id)
  },
  best_decision: (draft: unknown) => Boolean(draftOf(draft).option_id),
  yes_no_cases: (draft: unknown, segment: { payload: Record<string, unknown> }) => {
    const d = draftOf(draft)
    const decisions = (d.decisions as Record<string, boolean> | undefined) ?? {}
    const cases = segment.payload.cases as Array<{ id: string }>
    return cases.every((c) => typeof decisions[c.id] === 'boolean')
  },
  confidence_quiz: (draft: unknown) => {
    const d = draftOf(draft)
    return Boolean(d.option_id) && typeof d.confidence === 'number'
  },
}

export function buildYesNoAnswer(draft: unknown): unknown {
  const decisions = (draftOf(draft).decisions as Record<string, boolean> | undefined) ?? {}
  return { applies_ids: Object.keys(decisions).filter((id) => decisions[id]) }
}
