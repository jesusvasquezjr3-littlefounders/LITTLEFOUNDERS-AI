// `story` family renderers (LESSON_ENGINE.md §5.1). All registry kind
// 'content': nothing is graded; each renderer reports completion through
// onContentDone(). The shell owns the Continue button that advances segments —
// mount-complete types (story_scene, key_ideas) fire onContentDone immediately,
// interactive ones (story_dialogue, concept_reveal, checkpoint) fire it when
// the kid finishes the beat.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Button, Icon } from '@/components/ui'
import { CharacterActor } from '@/components/characters/control/CharacterActor'
import { narrationUnitId, useNarration } from '../../player/narration'
import type { ExerciseProps } from '../../core/types'
import MarkdownLite from '../../core/MarkdownLite'
import { SunkenWell } from '../../core/primitives'
import type {
  CheckpointSegment,
  ConceptRevealSegment,
  KeyIdeasSegment,
  StoryDialogueSegment,
  StorySceneSegment,
} from './schema'

type ContentDone = ExerciseProps['onContentDone']

/** Fire onContentDone at most once, no matter how often the kid re-triggers it. */
function useContentDoneOnce(onContentDone: ContentDone) {
  const fired = useRef(false)
  return useCallback(
    (signal?: 'got_it' | 'review') => {
      if (fired.current) return
      fired.current = true
      onContentDone?.(signal)
    },
    [onContentDone],
  )
}

/** Mount-complete content types: the shell's Continue gates advancing (§5.1). */
function useDoneOnMount(onContentDone: ContentDone) {
  const markDone = useContentDoneOnce(onContentDone)
  useEffect(() => {
    markDone()
  }, [markDone])
}

// ---- story_dialogue --------------------------------------------------------------

export function StoryDialogue({ segment, disabled, onContentDone }: ExerciseProps) {
  const { t } = useTranslation()
  const { lines } = segment.payload as StoryDialogueSegment['payload']
  const [index, setIndex] = useState(0)
  const [finished, setFinished] = useState(false)
  const markDone = useContentDoneOnce(onContentDone)
  const narration = useNarration()

  // Voice each line as it appears (Echo narrates dialogue per line, in the
  // line's own character voice — unit `<segment_id>.line.<n>`). The scene-setup
  // prompt plays first, before line 0 (B3), then each line on advance.
  useEffect(() => {
    if (finished) return
    if (index === 0) {
      narration.playSequence([narrationUnitId(segment.id, 'prompt'), narrationUnitId(segment.id, 'line.0')])
    } else {
      narration.play(narrationUnitId(segment.id, `line.${index}`))
    }
  }, [narration, segment.id, index, finished])

  const line = lines[Math.min(index, lines.length - 1)]
  if (!line) return null
  const isLast = index >= lines.length - 1

  const advance = () => {
    if (disabled || finished) return
    if (isLast) {
      setFinished(true)
      markDone()
    } else {
      setIndex((i) => i + 1)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-3 md:flex-row md:items-end md:gap-4">
        <CharacterActor
          character={line.character}
          emotion={line.emotion ?? 'neutral'}
          action={line.action ?? 'idle'}
          actionKey={index}
          speaking={!finished}
          size="md"
          className="shrink-0"
        />
        {/* Speech card — tapping it also advances (≥44px target). */}
        <button
          type="button"
          onClick={advance}
          disabled={disabled || finished}
          aria-label={t('lesson.families.story.tapToContinue')}
          className={cn(
            'min-h-11 w-full flex-1 rounded-lg rounded-bl-sm border-2 border-outline/70 bg-surface p-4 text-left shadow-glass-sm',
            'transition-[border-color,transform] duration-150',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
            finished
              ? 'cursor-default'
              : 'hover:border-primary/60 active:translate-y-px',
          )}
        >
          <MarkdownLite text={line.text_md} className="lf-body text-content" />
        </button>
      </div>

      {/* Subtle line-progress dots. */}
      <div
        role="img"
        aria-label={t('lesson.families.story.lineProgress', {
          current: index + 1,
          total: lines.length,
        })}
        className="flex items-center justify-center gap-1.5"
      >
        {lines.map((_, i) => (
          <span
            key={i}
            className={cn(
              'h-2 w-2 rounded-full transition-colors duration-150',
              i === index ? 'bg-primary' : i < index ? 'bg-primary/40' : 'bg-outline/40',
            )}
          />
        ))}
      </div>

      {!finished ? (
        <div className="text-center">
          <Button variant="primary" onClick={advance} disabled={disabled}>
            {t('lesson.families.story.continue')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

// ---- story_scene -----------------------------------------------------------------

const BACKDROP_CLASSES: Record<StorySceneSegment['payload']['backdrop'], string> = {
  band: 'bg-band',
  inverse: 'bg-inverse text-on-inverse',
  base: 'bg-base',
}

/** Same tint vocabulary as BigIconTile (core/primitives). */
const ART_TINT_CLASSES: Record<string, string> = {
  primary: 'text-primary',
  accent: 'text-accent',
  success: 'text-success-strong',
  warning: 'text-warning-strong',
  delight: 'text-secondary',
}

export function StoryScene({ segment, onContentDone }: ExerciseProps) {
  const payload = segment.payload as StorySceneSegment['payload']
  useDoneOnMount(onContentDone)
  // Voice the scene: prompt (the setup) then the body — the body is the whole
  // lesson's content and used to play in 0/62 story scenes (B2).
  const narration = useNarration()
  useEffect(() => {
    narration.playSequence([narrationUnitId(segment.id, 'prompt'), narrationUnitId(segment.id, 'body')])
  }, [narration, segment.id])
  return (
    <div className={cn('rounded-xl p-6 md:p-8', BACKDROP_CLASSES[payload.backdrop])}>
      <div className="flex flex-col items-center gap-4 text-center">
        {payload.character ? (
          <CharacterActor
            character={payload.character}
            emotion={payload.emotion ?? 'neutral'}
            action={payload.action ?? 'idle'}
            size="lg"
          />
        ) : null}
        {payload.art ? (
          <Icon
            name={payload.art.icon}
            className={cn('text-[64px]', ART_TINT_CLASSES[payload.art.tint] ?? 'text-primary')}
          />
        ) : null}
        <MarkdownLite
          text={payload.body_md}
          className={cn(
            'lf-body-lg',
            payload.backdrop === 'inverse' ? 'text-on-inverse' : 'text-content',
          )}
        />
      </div>
    </div>
  )
}

// ---- key_ideas -------------------------------------------------------------------

export function KeyIdeas({ segment, onContentDone }: ExerciseProps) {
  const { ideas } = segment.payload as KeyIdeasSegment['payload']
  useDoneOnMount(onContentDone)
  // Voice the prompt then each idea card in reading order (B2 — the idea-card
  // narration used to never play).
  const narration = useNarration()
  useEffect(() => {
    narration.playSequence([
      narrationUnitId(segment.id, 'prompt'),
      ...ideas.map((_, i) => narrationUnitId(segment.id, `idea.${i}`)),
    ])
  }, [narration, segment.id, ideas])
  // Small CSS stagger (≤3×80ms). With prefers-reduced-motion the motion-safe:
  // hidden state never applies, so cards are simply visible from the start.
  const [revealed, setRevealed] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setRevealed(true))
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <ul className="space-y-3">
      {ideas.map((idea, i) => (
        <li
          key={i}
          style={{ transitionDelay: revealed ? `${Math.min(i, 3) * 80}ms` : '0ms' }}
          className={cn(
            'flex items-start gap-3 rounded-md border-2 border-outline/70 bg-surface p-4 shadow-glass-sm',
            'transition-[opacity,transform] duration-300',
            !revealed && 'motion-safe:translate-y-2 motion-safe:opacity-0',
          )}
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary">
            <Icon name={idea.icon} className="text-[24px]" />
          </span>
          <div className="space-y-1">
            <p className="lf-title text-content">{idea.title}</p>
            <MarkdownLite text={idea.body_md} className="lf-body text-content-muted" />
          </div>
        </li>
      ))}
    </ul>
  )
}

// ---- concept_reveal ----------------------------------------------------------------

export function ConceptReveal({ segment, disabled, onContentDone }: ExerciseProps) {
  const { t } = useTranslation()
  const { cards } = segment.payload as ConceptRevealSegment['payload']
  const [flipped, setFlipped] = useState<ReadonlySet<number>>(() => new Set())
  const markDone = useContentDoneOnce(onContentDone)
  const narration = useNarration()
  const remaining = cards.length - flipped.size

  // Voice the prompt on mount; each card's back narration plays when revealed (B2).
  useEffect(() => {
    narration.play(narrationUnitId(segment.id, 'prompt'))
  }, [narration, segment.id])

  const flip = (i: number) => {
    if (disabled || flipped.has(i)) return
    const next = new Set(flipped)
    next.add(i)
    setFlipped(next)
    narration.play(narrationUnitId(segment.id, `card.${i}.back`))
    if (next.size === cards.length) markDone()
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {cards.map((card, i) => {
          const isFlipped = flipped.has(i)
          return (
            <button
              key={i}
              type="button"
              aria-pressed={isFlipped}
              disabled={disabled}
              onClick={() => flip(i)}
              className={cn(
                'min-h-11 rounded-lg border-2 p-4 text-left',
                // Simple swap with a color transition — reduced-motion safe by
                // construction (no positional animation to suppress).
                'transition-[border-color,background-color,transform] duration-300',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                'disabled:cursor-not-allowed',
                isFlipped
                  ? 'border-success bg-success-soft'
                  : 'border-outline/70 bg-surface hover:border-primary/60 active:translate-y-px',
              )}
            >
              {isFlipped ? (
                <MarkdownLite text={card.back_md} className="lf-body text-content" />
              ) : (
                <span className="flex items-center gap-3">
                  {card.icon ? (
                    <Icon name={card.icon} className="shrink-0 text-[28px] text-primary" />
                  ) : null}
                  <MarkdownLite text={card.front_md} className="lf-title text-content" />
                  <Icon name="touch_app" className="ml-auto shrink-0 text-[20px] text-content-faint" />
                </span>
              )}
            </button>
          )
        })}
      </div>
      <p role="status" className="lf-caption text-center text-content-muted">
        {remaining > 0
          ? t('lesson.families.story.flipHint', { count: remaining })
          : t('lesson.families.story.allFlipped')}
      </p>
    </div>
  )
}

// ---- checkpoint --------------------------------------------------------------------

export function Checkpoint({ segment, disabled, onContentDone }: ExerciseProps) {
  const { t } = useTranslation()
  const payload = segment.payload as CheckpointSegment['payload']
  const [choice, setChoice] = useState<'got_it' | 'review' | null>(null)
  const markDone = useContentDoneOnce(onContentDone)
  // Voice the prompt then the recap (B2 — the recap narration never played).
  const narration = useNarration()
  useEffect(() => {
    narration.playSequence([narrationUnitId(segment.id, 'prompt'), narrationUnitId(segment.id, 'recap')])
  }, [narration, segment.id])

  const choose = (signal: 'got_it' | 'review') => {
    if (disabled || choice !== null) return
    setChoice(signal)
    markDone(signal)
  }

  return (
    <div className="space-y-4">
      <SunkenWell>
        <MarkdownLite text={payload.recap_md} className="lf-body text-content" />
      </SunkenWell>
      {payload.mood_prompt_md ? (
        <MarkdownLite text={payload.mood_prompt_md} className="lf-body text-content-muted" />
      ) : null}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Button
          variant="success"
          onClick={() => choose('got_it')}
          disabled={disabled || (choice !== null && choice !== 'got_it')}
          className={cn(
            'min-h-12 w-full',
            choice === 'got_it' && 'ring-2 ring-success ring-offset-2 ring-offset-base',
          )}
        >
          {t('lesson.families.story.gotIt')}
        </Button>
        <Button
          variant="secondary"
          onClick={() => choose('review')}
          disabled={disabled || (choice !== null && choice !== 'review')}
          className={cn(
            'min-h-12 w-full',
            choice === 'review' && 'ring-2 ring-primary ring-offset-2 ring-offset-base',
          )}
        >
          {t('lesson.families.story.review')}
        </Button>
      </div>
    </div>
  )
}
