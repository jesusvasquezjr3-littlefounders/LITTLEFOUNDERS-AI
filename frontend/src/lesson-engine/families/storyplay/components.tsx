// `storyplay` family renderers (LESSON_ENGINE.md §5.7). Four self-driving flows
// (story_branch, dialogue_choice, flash_match, lightning_round) + one input
// (would_you_rather). Flows report onFinish EXACTLY once (ref-guarded).
// Correctness never leaks into a running flow: answer keys are server-side.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Button, Icon } from '@/components/ui'
import { CharacterActor } from '@/components/characters/control/CharacterActor'
import type { CharacterEmotion, CharacterId } from '@/components/characters/control/types'
import type { ExerciseProps } from '../../core/types'
import MarkdownLite from '../../core/MarkdownLite'
import {
  GentleTimerBar,
  OptionCard,
  SunkenWell,
  TokenChip,
  type OptionVisualState,
} from '../../core/primitives'

type Dict = Record<string, unknown>
const draftOf = (v: unknown): Dict => (typeof v === 'object' && v !== null ? (v as Dict) : {})

function revealOf(verdict: ExerciseProps['verdict']): Dict {
  return draftOf(verdict?.reveal)
}

// ---- story_branch (flow) ---------------------------------------------------------

interface BranchChoice {
  id: string
  text_md: string
  next: string | null
}

interface BranchNode {
  id: string
  text_md: string
  character?: CharacterId
  emotion?: CharacterEmotion
  choices: BranchChoice[]
}

interface PathStep {
  node_id: string
  choice_id: string
}

export function StoryBranch({ segment, disabled, onFinish, verdict }: ExerciseProps) {
  const { t } = useTranslation()
  const nodes = segment.payload.nodes as BranchNode[]
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])
  const [path, setPath] = useState<PathStep[]>([])
  const [currentId, setCurrentId] = useState<string | null>(segment.payload.start_node as string)
  const finished = useRef(false)

  const current = currentId !== null ? nodeById.get(currentId) : undefined
  // A dangling `next` id ends the story defensively instead of stranding the kid.
  const ended = current === undefined

  // Exactly-once is guaranteed by the ref guard, so full deps are safe here.
  useEffect(() => {
    if (ended && !finished.current && onFinish) {
      finished.current = true
      onFinish({ path })
    }
  }, [ended, onFinish, path])

  if (!ended && current) {
    return (
      <div className="space-y-4">
        {current.character ? (
          <div className="flex justify-center">
            <CharacterActor character={current.character} emotion={current.emotion ?? 'neutral'} size="sm" />
          </div>
        ) : null}
        <SunkenWell>
          <MarkdownLite text={current.text_md} className="lf-body-lg text-content" />
        </SunkenWell>
        <div className="space-y-3" role="group">
          {current.choices.map((choice) => (
            <OptionCard
              key={choice.id}
              disabled={disabled}
              onSelect={() => {
                setPath((prev) => [...prev, { node_id: current.id, choice_id: choice.id }])
                setCurrentId(choice.next)
              }}
            >
              <MarkdownLite text={choice.text_md} />
            </OptionCard>
          ))}
        </div>
      </div>
    )
  }

  // Ended: "camino recorrido" recap while waiting for (and after) the verdict.
  const best = revealOf(verdict).best as Record<string, string> | undefined
  return (
    <div className="space-y-3">
      <p className="lf-label text-content-muted">{t('lesson.families.storyplay.pathRecap')}</p>
      <ol className="space-y-2">
        {path.map((step, i) => {
          const node = nodeById.get(step.node_id)
          const choice = node?.choices.find((c) => c.id === step.choice_id)
          const bestChoiceId = best?.[step.node_id]
          const isBest = bestChoiceId !== undefined && bestChoiceId === step.choice_id
          const bestChoice =
            bestChoiceId !== undefined && !isBest
              ? node?.choices.find((c) => c.id === bestChoiceId)
              : undefined
          return (
            <li
              key={`${step.node_id}-${i}`}
              className={cn(
                'rounded-md border-2 p-3',
                best && isBest ? 'border-success bg-success-soft' : 'border-outline/60 bg-surface',
              )}
            >
              {choice ? <MarkdownLite text={choice.text_md} className="lf-body text-content" /> : null}
              {bestChoice ? (
                <div className="mt-2 rounded-sm bg-surface-sunken px-2 py-1.5">
                  <p className="lf-caption text-content-muted">
                    {t('lesson.families.storyplay.bestChoice')}
                  </p>
                  <MarkdownLite text={bestChoice.text_md} className="lf-caption text-content" />
                </div>
              ) : null}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

// ---- dialogue_choice (flow) --------------------------------------------------------

interface DialogueReply {
  id: string
  text_md: string
}

interface DialogueTurn {
  id: string
  npc_md: string
  replies: DialogueReply[]
}

interface DialoguePersona {
  character: CharacterId
  name?: string
  role_md: string
}

function NpcBubble({ text }: { text: string }) {
  return (
    <div className="mr-8 rounded-md rounded-bl-none border-2 border-outline/60 bg-surface p-3">
      <MarkdownLite text={text} className="lf-body text-content" />
    </div>
  )
}

function KidBubble({ text }: { text: string }) {
  return (
    <div className="ml-8 rounded-md rounded-br-none border-2 border-primary/40 bg-primary-soft p-3">
      <MarkdownLite text={text} className="lf-body text-content" />
    </div>
  )
}

export function DialogueChoice({ segment, disabled, onFinish, verdict }: ExerciseProps) {
  const { t } = useTranslation()
  const persona = segment.payload.persona as DialoguePersona
  const turns = segment.payload.turns as DialogueTurn[]
  const [replies, setReplies] = useState<Array<{ turn_id: string; reply_id: string }>>([])
  const finished = useRef(false)

  const done = replies.length >= turns.length

  useEffect(() => {
    if (done && !finished.current && onFinish) {
      finished.current = true
      onFinish({ replies })
    }
  }, [done, onFinish, replies])

  const best = revealOf(verdict).best as Record<string, string> | undefined
  const currentTurn = done ? undefined : turns[replies.length]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <CharacterActor character={persona.character} emotion="happy" size="sm" />
        <div className="min-w-0">
          {persona.name ? <p className="lf-title text-content">{persona.name}</p> : null}
          <MarkdownLite text={persona.role_md} className="lf-caption text-content-muted" />
        </div>
      </div>

      <div className="space-y-3">
        <NpcBubble text={segment.payload.opening_md as string} />
        {turns.slice(0, Math.min(replies.length + 1, turns.length)).map((turn, i) => {
          const chosen = replies[i]
          const chosenReply = chosen
            ? turn.replies.find((r) => r.id === chosen.reply_id)
            : undefined
          const bestId = best?.[turn.id]
          const bestReply =
            bestId !== undefined && bestId !== chosen?.reply_id
              ? turn.replies.find((r) => r.id === bestId)
              : undefined
          return (
            <div key={turn.id} className="space-y-3">
              <NpcBubble text={turn.npc_md} />
              {chosenReply ? <KidBubble text={chosenReply.text_md} /> : null}
              {bestReply ? (
                <div className="ml-8 rounded-sm bg-surface-sunken px-2 py-1.5">
                  <p className="lf-caption text-content-muted">
                    {t('lesson.families.storyplay.bestReply')}
                  </p>
                  <MarkdownLite text={bestReply.text_md} className="lf-caption text-content" />
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      {currentTurn ? (
        <div className="space-y-3" role="group">
          {currentTurn.replies.map((reply) => (
            <OptionCard
              key={reply.id}
              disabled={disabled}
              onSelect={() =>
                setReplies((prev) =>
                  prev.some((r) => r.turn_id === currentTurn.id)
                    ? prev
                    : [...prev, { turn_id: currentTurn.id, reply_id: reply.id }],
                )
              }
            >
              <MarkdownLite text={reply.text_md} />
            </OptionCard>
          ))}
        </div>
      ) : null}
    </div>
  )
}

// ---- flash_match (flow) -----------------------------------------------------------

interface MatchItem {
  id: string
  text_md: string
}

export function FlashMatch({ segment, disabled, onFinish, verdict }: ExerciseProps) {
  const { t } = useTranslation()
  const left = segment.payload.left as MatchItem[]
  const right = segment.payload.right as MatchItem[]
  const seconds = segment.payload.seconds as number
  const [phase, setPhase] = useState<'ready' | 'running' | 'done'>('ready')
  const [pairs, setPairs] = useState<Array<[string, string]>>([])
  const [leftSel, setLeftSel] = useState<string | null>(null)
  const [overtime, setOvertime] = useState(false)
  const finished = useRef(false)

  const maxPairs = Math.min(left.length, right.length)

  useEffect(() => {
    if (phase === 'done' && !finished.current && onFinish) {
      finished.current = true
      onFinish({ pairs, overtime })
    }
  }, [phase, onFinish, pairs, overtime])

  const keyPairs = revealOf(verdict).pairs as Array<[string, string]> | undefined
  const isCorrectPair = (l: string, r: string) =>
    keyPairs?.some((p) => p[0] === l && p[1] === r) ?? false
  const achieved = (l: string, r: string) => pairs.some((p) => p[0] === l && p[1] === r)

  if (phase === 'ready' && !verdict) {
    return (
      <div className="space-y-4 text-center">
        <SunkenWell>
          <p className="lf-body-lg text-content">{t('lesson.families.storyplay.matchHint')}</p>
        </SunkenWell>
        <Button variant="primary" onClick={() => setPhase('running')} disabled={disabled}>
          {t('lesson.flow.start')}
        </Button>
      </div>
    )
  }

  const usedLeft = new Set(pairs.map((p) => p[0]))
  const usedRight = new Set(pairs.map((p) => p[1]))
  const running = phase === 'running'

  const lockPair = (rightId: string) => {
    if (!leftSel) return
    const l = leftSel
    setLeftSel(null)
    setPairs((prev) => {
      if (prev.some((p) => p[0] === l || p[1] === rightId)) return prev
      const next: Array<[string, string]> = [...prev, [l, rightId]]
      if (next.length >= maxPairs) setPhase('done')
      return next
    })
  }

  const textOf = (items: MatchItem[], id: string) => items.find((i) => i.id === id)?.text_md ?? id

  return (
    <div className="space-y-4">
      {running ? (
        <GentleTimerBar
          seconds={seconds}
          running
          onExpire={() => {
            setOvertime(true)
            setPhase('done')
          }}
        />
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          {left.map((item) => (
            <TokenChip
              key={item.id}
              state={leftSel === item.id ? 'selected' : usedLeft.has(item.id) ? 'dimmed' : 'idle'}
              disabled={disabled || !running || usedLeft.has(item.id)}
              onSelect={() => setLeftSel((prev) => (prev === item.id ? null : item.id))}
              className="w-full"
            >
              <MarkdownLite text={item.text_md} />
            </TokenChip>
          ))}
        </div>
        <div className="space-y-2">
          {right.map((item) => (
            <TokenChip
              key={item.id}
              state={usedRight.has(item.id) ? 'dimmed' : 'idle'}
              disabled={disabled || !running || leftSel === null || usedRight.has(item.id)}
              onSelect={() => lockPair(item.id)}
              className="w-full"
            >
              <MarkdownLite text={item.text_md} />
            </TokenChip>
          ))}
        </div>
      </div>

      {pairs.length > 0 ? (
        <SunkenWell>
          <p className="lf-caption text-content-muted">{t('lesson.families.storyplay.pairs')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {pairs.map(([l, r]) => {
              let state: OptionVisualState = 'selected'
              if (verdict && keyPairs) state = isCorrectPair(l, r) ? 'correct' : 'wrong'
              return (
                <TokenChip
                  key={`${l}-${r}`}
                  state={state}
                  disabled={disabled || !running}
                  onSelect={() => setPairs((prev) => prev.filter((p) => !(p[0] === l && p[1] === r)))}
                >
                  <span className="inline-flex items-center gap-1">
                    <MarkdownLite text={textOf(left, l)} />
                    <Icon name="arrow_forward" className="text-[16px]" />
                    <MarkdownLite text={textOf(right, r)} />
                  </span>
                </TokenChip>
              )
            })}
          </div>
          {running ? (
            <p className="mt-2 lf-caption text-content-muted">
              {t('lesson.families.storyplay.undoPair')}
            </p>
          ) : null}
        </SunkenWell>
      ) : null}

      {verdict && keyPairs ? (
        <div className="space-y-2">
          <p className="lf-caption text-content-muted">
            {t('lesson.families.storyplay.correctPairs')}
          </p>
          <div className="flex flex-wrap gap-2">
            {keyPairs.map(([l, r]) => (
              <TokenChip key={`k-${l}-${r}`} state={achieved(l, r) ? 'correct' : 'dimmed'} disabled>
                <span className="inline-flex items-center gap-1">
                  <MarkdownLite text={textOf(left, l)} />
                  <Icon name="arrow_forward" className="text-[16px]" />
                  <MarkdownLite text={textOf(right, r)} />
                </span>
              </TokenChip>
            ))}
          </div>
        </div>
      ) : null}

      {running ? (
        <div className="text-center">
          <Button variant="secondary" onClick={() => setPhase('done')}>
            {t('lesson.flow.done')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

// ---- lightning_round (flow) ---------------------------------------------------------

interface LightningQuestion {
  id: string
  prompt_md: string
  options: MatchItem[]
}

export function LightningRound({ segment, disabled, onFinish, verdict }: ExerciseProps) {
  const { t } = useTranslation()
  const questions = segment.payload.questions as LightningQuestion[]
  const secondsPerQ = segment.payload.seconds_per_q as number
  const [phase, setPhase] = useState<'ready' | 'running' | 'done'>('ready')
  const [qIndex, setQIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string | null>>({})
  const [locked, setLocked] = useState<string | null>(null)
  // Momentum only: counts consecutive ANSWERED questions. Correctness is
  // server-side — the round shows zero right/wrong feedback while running.
  const [streak, setStreak] = useState(0)
  const finished = useRef(false)
  const advancingRef = useRef(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (phase === 'done' && !finished.current && onFinish) {
      finished.current = true
      onFinish({ answers })
    }
  }, [phase, onFinish, answers])

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    },
    [],
  )

  const question = questions[qIndex]

  const advance = (optionId: string | null) => {
    if (advancingRef.current || !question) return
    advancingRef.current = true
    setAnswers((prev) => ({ ...prev, [question.id]: optionId }))
    setStreak((prev) => (optionId !== null ? prev + 1 : 0))
    const goNext = () => {
      advancingRef.current = false
      setLocked(null)
      if (qIndex + 1 >= questions.length) setPhase('done')
      else setQIndex(qIndex + 1)
    }
    if (optionId !== null) {
      setLocked(optionId)
      timeoutRef.current = setTimeout(goNext, 400) // brief selected flash, then advance
    } else {
      goNext() // timer expiry: no answer for this question
    }
  }

  if (phase === 'ready' && !verdict) {
    return (
      <div className="space-y-4 text-center">
        <SunkenWell>
          <p className="lf-body-lg text-content">
            {t('lesson.families.storyplay.questionOf', { current: 1, total: questions.length })}
          </p>
        </SunkenWell>
        <Button variant="primary" onClick={() => setPhase('running')} disabled={disabled}>
          {t('lesson.flow.start')}
        </Button>
      </div>
    )
  }

  if (phase === 'running' && question) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <p className="lf-caption text-content-muted">
            {t('lesson.families.storyplay.questionOf', {
              current: qIndex + 1,
              total: questions.length,
            })}
          </p>
          {streak >= 2 ? (
            <span className="rounded-full bg-delight-soft px-3 py-1 lf-label text-content">
              {t('lesson.families.storyplay.answeredStreak', { count: streak })}
            </span>
          ) : null}
        </div>
        <GentleTimerBar
          key={qIndex}
          seconds={secondsPerQ}
          running={locked === null}
          onExpire={() => advance(null)}
        />
        <SunkenWell>
          <MarkdownLite text={question.prompt_md} className="lf-body-lg text-content" />
        </SunkenWell>
        <div className="space-y-3" role="group">
          {question.options.map((option) => (
            <OptionCard
              key={option.id}
              state={locked === option.id ? 'selected' : 'idle'}
              disabled={disabled || locked !== null}
              onSelect={() => advance(option.id)}
            >
              <MarkdownLite text={option.text_md} />
            </OptionCard>
          ))}
        </div>
      </div>
    )
  }

  // Done: answers recap while waiting for (and after) the verdict.
  const correct = revealOf(verdict).correct as Record<string, string> | undefined
  return (
    <div className="space-y-3">
      <p className="lf-label text-content-muted">{t('lesson.families.storyplay.yourAnswers')}</p>
      <ol className="space-y-2">
        {questions.map((q) => {
          const chosenId = answers[q.id] ?? null
          const chosen = chosenId !== null ? q.options.find((o) => o.id === chosenId) : undefined
          const correctId = correct?.[q.id]
          const right = correctId !== undefined && chosenId === correctId
          const correctOption =
            correctId !== undefined && !right ? q.options.find((o) => o.id === correctId) : undefined
          return (
            <li
              key={q.id}
              className={cn(
                'rounded-md border-2 p-3',
                correct
                  ? right
                    ? 'border-success bg-success-soft'
                    : 'border-error bg-error-soft'
                  : 'border-outline/60 bg-surface',
              )}
            >
              <MarkdownLite text={q.prompt_md} className="lf-caption text-content-muted" />
              <div className="mt-1 lf-body text-content">
                {chosen ? (
                  <MarkdownLite text={chosen.text_md} />
                ) : (
                  <span>{t('lesson.families.storyplay.noAnswer')}</span>
                )}
              </div>
              {correctOption ? (
                <div className="mt-2 rounded-sm bg-surface-sunken px-2 py-1.5">
                  <p className="lf-caption text-content-muted">
                    {t('lesson.families.storyplay.correctAnswer')}
                  </p>
                  <MarkdownLite text={correctOption.text_md} className="lf-caption text-content" />
                </div>
              ) : null}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

// ---- would_you_rather (input) --------------------------------------------------------

interface RatherSide {
  text_md: string
  icon?: string
}

export function WouldYouRather({ segment, value, onChange, disabled, verdict }: ExerciseProps) {
  const { t } = useTranslation()
  const draft = draftOf(value)
  const chosen = draft.choice as 'a' | 'b' | undefined
  const followup = segment.payload.followup_md as string | undefined
  const qualities = revealOf(verdict).qualities as { a?: number; b?: number } | undefined

  const renderSide = (side: 'a' | 'b') => {
    const data = segment.payload[side] as RatherSide
    const q = qualities?.[side]
    return (
      <OptionCard
        role="radio"
        ariaChecked={chosen === side}
        // Both sides can be valid (opportunity cost): no wrong-state after verdict.
        state={chosen === side ? 'selected' : 'idle'}
        disabled={disabled}
        onSelect={() => onChange({ choice: side })}
        className="flex min-h-40 flex-col items-center justify-center gap-3 text-center"
      >
        {data.icon ? <Icon name={data.icon} className="text-[48px] text-primary" /> : null}
        <MarkdownLite text={data.text_md} className="lf-body-lg" />
        {typeof q === 'number' ? (
          <span className="rounded-full bg-surface-sunken px-3 py-1 lf-caption text-content-muted">
            {t('lesson.families.storyplay.valueLabel', { score: q })}
          </span>
        ) : null}
      </OptionCard>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2" role="radiogroup">
        {renderSide('a')}
        {renderSide('b')}
      </div>
      {chosen && followup ? (
        <SunkenWell>
          <MarkdownLite text={followup} className="lf-body text-content" />
        </SunkenWell>
      ) : null}
    </div>
  )
}

export const storyplayCanSubmit = {
  would_you_rather: (draft: unknown) => {
    const c = draftOf(draft).choice
    return c === 'a' || c === 'b'
  },
}
