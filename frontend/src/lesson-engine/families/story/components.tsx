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
import CharacterActor3D from '@/components/characters/control/CharacterActor3D'
import { narrationUnitId, useNarration } from '../../player/narration'
import type { ExerciseProps } from '../../core/types'
import MarkdownLite from '../../core/MarkdownLite'
import { FOCUS_RING, SceneAnchor, SunkenWell, VisualMark, optionStateClasses } from '../../core/primitives'
import type {
  CheckpointSegment,
  ConceptRevealSegment,
  EavesdropSegment,
  KeyIdeasSegment,
  StoryDialogueSegment,
  StorySceneSegment,
} from './schema'
import { EAVESDROP_HIGHLIGHT } from './schema'

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

export function StoryDialogue({ segment, disabled, onContentDone, onCharacterCue }: ExerciseProps) {
  const { t } = useTranslation()
  const { lines } = segment.payload as StoryDialogueSegment['payload']
  const [index, setIndex] = useState(0)
  const [finished, setFinished] = useState(false)
  const markDone = useContentDoneOnce(onContentDone)
  const narration = useNarration()
  // Non-null once, always: `lines` is schema-min(1), so this index is always
  // in range. Computed before every hook below so the rules-of-hooks order
  // never depends on it (see the guard further down).
  const line = lines[Math.min(index, lines.length - 1)]

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

  /*
   * THE CUE, for a host with no `CharacterLayerProvider` of its own (see
   * `CharacterCue`). Present only on the Tutor's live activity plate — the
   * course player never passes this, so its own `CharacterActor3D` below is
   * untouched there. Cleared on every dependency change, not only on unmount:
   * advancing a line hands the PREVIOUS line's character back before handing
   * the new one over, and finishing the dialogue hands the stage back for good.
   */
  // Depends on the line's own PRIMITIVE fields, not the `line` object itself:
  // `segment` is a fresh cast on every render of the caller
  // (`LiveSegmentPanel`'s `segment = live.segment as unknown as SegmentBase`),
  // and an effect keyed on an object built that way re-fires on every
  // unrelated re-render rather than on an actual change — the same class of
  // defect `ConversationView.tsx`'s own `demo` prop hit (2026-08-30, HIGH).
  useEffect(() => {
    if (!onCharacterCue || !line) return
    if (finished) return
    onCharacterCue({
      character: line.character,
      emotion: line.emotion ?? 'neutral',
      action: line.action ?? 'idle',
      actionKey: index,
      speaking: true,
    })
    return () => onCharacterCue(null)
  }, [onCharacterCue, line?.character, line?.emotion, line?.action, index, finished])

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
      <div className="flex flex-col items-center gap-3 md:flex-row md:items-center md:gap-4">
        {/*
          Suppressed in cue mode (see the effect above): this box has no
          `CharacterLayerProvider` to draw into there, and the character is
          portrayed on the host's own stage instead — never as a flat 2D rig.
        */}
        {!onCharacterCue && (
          <CharacterActor3D
            character={line.character}
            emotion={line.emotion ?? 'neutral'}
            action={line.action ?? 'idle'}
            actionKey={index}
            speaking={!finished}
            presence="scene"
            className="shrink-0"
          />
        )}
        {/* Speech card — tapping it also advances (≥44px target). */}
        <button
          type="button"
          onClick={advance}
          disabled={disabled || finished}
          aria-label={t('lesson.families.story.tapToContinue')}
          className={cn(
            'min-h-12 w-full flex-1 rounded-lg rounded-bl-sm p-4 text-left',
            FOCUS_RING,
            optionStateClasses('idle'),
            finished && 'cursor-default',
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

export function StoryScene({ segment, onContentDone, onCharacterCue }: ExerciseProps) {
  const payload = segment.payload as StorySceneSegment['payload']
  useDoneOnMount(onContentDone)
  // Voice the scene: prompt (the setup) then the body — the body is the whole
  // lesson's content and used to play in 0/62 story scenes (B2).
  const narration = useNarration()
  useEffect(() => {
    narration.playSequence([narrationUnitId(segment.id, 'prompt'), narrationUnitId(segment.id, 'body')])
  }, [narration, segment.id])
  // The cue for a host with no `CharacterLayerProvider` of its own — see
  // `CharacterCue` and `StoryDialogue`'s own copy of this note. One beat, not
  // per-line, so `actionKey` never needs to bump.
  useEffect(() => {
    if (!onCharacterCue || !payload.character) return
    onCharacterCue({
      character: payload.character,
      emotion: payload.emotion ?? 'neutral',
      action: payload.action ?? 'idle',
      actionKey: 0,
      speaking: true,
    })
    return () => onCharacterCue(null)
  }, [onCharacterCue, payload.character, payload.emotion, payload.action])
  return (
    <div className={cn('rounded-md p-6 md:p-8', BACKDROP_CLASSES[payload.backdrop])}>
      <div className="flex flex-col items-center gap-4 text-center">
        {payload.character && !onCharacterCue ? (
          <CharacterActor3D
            character={payload.character}
            emotion={payload.emotion ?? 'neutral'}
            action={payload.action ?? 'idle'}
            presence="scene"
          />
        ) : null}
        {/* The AI illustration is commissioned as a WIDE establishing scene
            (coursegen asks Prism for a ~16:9 `scene_anchor`), so it gets the
            same full-width treatment as a segment scene anchor. It used to be
            squeezed into a 128px square, which letterboxed a panorama down to
            roughly 128×72 and made the setting unreadable. The `icon` fallback
            is a single glyph and stays at glyph size. */}
        {payload.art?.image_url ? (
          <SceneAnchor imageUrl={payload.art.image_url} />
        ) : payload.art ? (
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
            'lf-slab flex items-start gap-3 rounded-md p-4',
            'transition-[opacity,transform] duration-300',
            !revealed && 'motion-safe:translate-y-2 motion-safe:opacity-0',
          )}
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary">
            <VisualMark
              icon={idea.icon}
              imageUrl={idea.image_url}
              iconClassName="text-[24px]"
              imgClassName="h-9 w-9 rounded object-contain"
            />
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
                'min-h-12 rounded-lg p-4 text-left',
                FOCUS_RING,
                // OPENED, not CORRECT — and the difference is the whole point
                // of the second channel. This used to take the `correct` skin,
                // justified in a comment by "the check the eye reads as seen";
                // there is no check here (a bare button, not an `OptionCard`),
                // so what a child actually saw was a card turning GREEN on a
                // segment where nothing is graded and nothing can be right.
                // `correct` is reserved (/DESIGN.md §Answer surfaces: state is
                // never colour alone, and the two verdict colours mean one
                // thing each). `selected` is what happened — the card was
                // pressed — and it already agrees with the `aria-pressed` a
                // screen reader announces.
                optionStateClasses(isFlipped ? 'selected' : 'idle'),
              )}
            >
              {isFlipped ? (
                <MarkdownLite text={card.back_md} className="lf-body text-content" />
              ) : (
                <span className="flex items-center gap-3">
                  {card.image_url || card.icon ? (
                    <VisualMark
                      icon={card.icon ?? ''}
                      imageUrl={card.image_url}
                      iconClassName="shrink-0 text-[28px] text-primary"
                      imgClassName="h-10 w-10 shrink-0 rounded object-contain"
                    />
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
    // "I want to review" used to be a dead-end promise (E9). Replay the recap
    // narration so the choice does something, and a hint below invites the kid
    // to re-read the recap above before continuing when ready.
    if (signal === 'review') narration.play(narrationUnitId(segment.id, 'recap'))
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
      {choice === 'review' ? (
        <div className="lf-pop flex items-start gap-2 rounded-md bg-primary-soft px-4 py-3">
          <Icon name="menu_book" className="mt-0.5 text-[20px] text-primary" />
          <p className="lf-body text-content">{t('lesson.families.story.reviewHint')}</p>
        </div>
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

// ---- eavesdrop --------------------------------------------------------------------

/**
 * Split a line's text_md into plain fragments and tappable ==highlight== terms.
 * Notes attach by order: the nth highlight opens notes[n].
 */
function splitHighlights(text: string): Array<{ kind: 'text' | 'term'; value: string; termIndex?: number }> {
  const parts: Array<{ kind: 'text' | 'term'; value: string; termIndex?: number }> = []
  let last = 0
  let termIndex = 0
  for (const match of text.matchAll(EAVESDROP_HIGHLIGHT)) {
    const start = match.index ?? 0
    if (start > last) parts.push({ kind: 'text', value: text.slice(last, start) })
    parts.push({ kind: 'term', value: match[1] ?? '', termIndex })
    termIndex += 1
    last = start + match[0].length
  }
  if (last < text.length) parts.push({ kind: 'text', value: text.slice(last) })
  return parts
}

/**
 * An overheard conversation revealed turn by turn; highlighted money terms are
 * TAP targets (never hover-only, §1.11) that open the line's pre-generated
 * note. The whole artifact passed gates+judge before the kid saw turn one.
 */
export function Eavesdrop({ segment, disabled, onContentDone, onCharacterCue }: ExerciseProps) {
  const { t } = useTranslation()
  const { context_md, lines } = segment.payload as EavesdropSegment['payload']
  const [revealed, setRevealed] = useState(1)
  const [finished, setFinished] = useState(false)
  const [openNote, setOpenNote] = useState<{ line: number; term: number } | null>(null)
  const markDone = useContentDoneOnce(onContentDone)
  const narration = useNarration()
  const activeLine = lines[revealed - 1]

  // Context narrates with the prompt before line 0; each new line voices on reveal.
  useEffect(() => {
    if (finished) return
    if (revealed === 1) {
      narration.playSequence([
        narrationUnitId(segment.id, 'prompt'),
        narrationUnitId(segment.id, 'context'),
        narrationUnitId(segment.id, 'line.0'),
      ])
    } else {
      narration.play(narrationUnitId(segment.id, `line.${revealed - 1}`))
    }
  }, [narration, segment.id, revealed, finished])

  /*
   * THE CUE, for a host with no `CharacterLayerProvider` of its own (see
   * `CharacterCue`). An eavesdrop transcript can carry several DISTINCT
   * speakers at once in the course player's own scissored layer (§9.1/§6.2 of
   * TUTOR_3D.md) — the Tutor's persistent island has exactly one stand-in for
   * "who is on stage right now", so only the CURRENTLY REVEALED line's speaker
   * is portrayed there; earlier lines stay on screen as plain text (they were
   * already portrayed when they were the active line). This is a narrower
   * presentation than the course player's, not a 2D fallback: the character
   * that matters — the one actually speaking — is always the real 3D model.
   */
  useEffect(() => {
    if (!onCharacterCue || !activeLine) return
    if (finished) return
    onCharacterCue({
      character: activeLine.character,
      emotion: activeLine.emotion ?? 'neutral',
      action: 'idle',
      actionKey: revealed,
      speaking: true,
    })
    return () => onCharacterCue(null)
    // Primitive fields, not the `activeLine` object — see `StoryDialogue`'s
    // matching note.
  }, [onCharacterCue, activeLine?.character, activeLine?.emotion, revealed, finished])

  const advance = () => {
    if (disabled || finished) return
    setOpenNote(null)
    if (revealed >= lines.length) {
      setFinished(true)
      markDone()
    } else {
      setRevealed((n) => n + 1)
    }
  }

  const note = openNote ? lines[openNote.line]?.notes?.[openNote.term] : undefined

  return (
    <div className="space-y-4">
      <SunkenWell className="text-center">
        <MarkdownLite text={context_md} className="lf-body text-content-muted" />
      </SunkenWell>

      <ul className="space-y-3" aria-live="polite">
        {lines.slice(0, revealed).map((line, lineIndex) => (
          <li key={lineIndex} className="flex items-end gap-3">
            {/*
              Suppressed in cue mode (see the effect above): no
              `CharacterLayerProvider` to draw into here, and the CURRENTLY
              active line's speaker is portrayed on the host's own stage
              instead of as a flat 2D rig per line.
            */}
            {!onCharacterCue && (
              <CharacterActor3D
                character={line.character}
                emotion={line.emotion ?? 'neutral'}
                action="idle"
                speaking={!finished && lineIndex === revealed - 1}
                presence="inline"
                className="shrink-0"
              />
            )}
            <div className="lf-slab min-h-12 flex-1 rounded-lg rounded-bl-sm p-3">
              <p className="lf-body text-content">
                {splitHighlights(line.text_md).map((part, i) =>
                  part.kind === 'text' ? (
                    <MarkdownLite key={i} text={part.value} as="span" />
                  ) : (
                    <button
                      key={i}
                      type="button"
                      onClick={() =>
                        setOpenNote(
                          openNote?.line === lineIndex && openNote.term === part.termIndex
                            ? null
                            : { line: lineIndex, term: part.termIndex ?? 0 },
                        )
                      }
                      aria-expanded={openNote?.line === lineIndex && openNote.term === part.termIndex}
                      aria-label={t('lesson.families.story.whatDoesItMean', { term: part.value })}
                      className={cn(
                        'mx-0.5 inline-flex min-h-6 items-center gap-0.5 rounded-md border-b-2 border-dashed border-primary/70 bg-primary-soft/60 px-1 font-semibold text-primary',
                        // THE TARGET IS BIGGER THAN THE INK. Measured at 375,
                        // this chip is 27px tall — it is set inline in running
                        // prose, so it CANNOT be padded to 44 without pushing
                        // the sentence's lines apart and undoing the one thing
                        // that makes a glossary term feel like part of the
                        // sentence. An invisible pseudo-element extends the hit
                        // area instead: 27 + 2×10 = 47px for the thumb, zero
                        // change to layout.
                        'relative before:absolute before:inset-x-0 before:-inset-y-2.5 before:content-[""]',
                        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                      )}
                    >
                      {part.value}
                      <Icon name="help" className="text-[14px]" aria-hidden />
                    </button>
                  ),
                )}
              </p>
              {openNote?.line === lineIndex && note ? (
                <div className="mt-2 rounded-md bg-primary-soft/50 p-3">
                  <p className="lf-caption font-bold text-primary">
                    {t('lesson.families.story.noteTitle')}
                  </p>
                  <MarkdownLite text={note} className="lf-caption text-content" />
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <div
        role="img"
        aria-label={t('lesson.families.story.lineProgress', { current: revealed, total: lines.length })}
        className="flex items-center justify-center gap-1.5"
      >
        {lines.map((_, i) => (
          <span
            key={i}
            className={cn(
              'h-2 w-2 rounded-full transition-colors duration-150',
              i < revealed ? 'bg-primary' : 'bg-outline/40',
            )}
          />
        ))}
      </div>

      {!finished ? (
        <div className="text-center">
          <Button variant="primary" onClick={advance} disabled={disabled}>
            {t(revealed >= lines.length ? 'lesson.families.story.continue' : 'lesson.families.story.keepListening')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
