import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import DinaCharacter from '../DinaCharacter'
import DinoCharacter, { type DinoMood } from '../DinoCharacter'
import DrRhoCharacter, { type RhoMood } from '../DrRhoCharacter'
import ZaraVexCharacter, { type ZaraMood } from '../ZaraVexCharacter'
import {
  ACTION_DURATION_MS,
  EMOTION_TO_NATIVE,
  LOOPABLE_ACTIONS,
  type CharacterAction,
  type CharacterEmotion,
  type CharacterId,
} from './types'
import './rig.css'

export interface CharacterActorProps {
  character: CharacterId
  emotion?: CharacterEmotion
  /** One-shot action; auto-returns to idle. `loop` keeps celebrate/dance going. */
  action?: CharacterAction
  loop?: boolean
  speaking?: boolean
  bubble?: string
  size?: 'sm' | 'md' | 'lg' | 'fill'
  className?: string
  /** Bump this to replay the same action (e.g. two "correct" in a row). */
  actionKey?: number
}

const SIZE_CLASSES: Record<NonNullable<CharacterActorProps['size']>, string> = {
  sm: 'h-24 w-24',
  md: 'h-40 w-40',
  lg: 'h-56 w-56',
  fill: 'h-full w-full',
}

/**
 * Unified control surface over the four canonical characters (LESSON_ENGINE.md §9).
 * Appearance is untouched: emotions map to each character's native prop; actions are
 * CSS keyframes on this wrapper + the lf-rig-* hooks inside each SVG. Head/pupil
 * groups stay owned by the characters' own tracking loops.
 */
export function CharacterActor({
  character,
  emotion = 'neutral',
  action = 'idle',
  loop = false,
  speaking = false,
  bubble,
  size = 'md',
  className,
  actionKey = 0,
}: CharacterActorProps) {
  const [activeAction, setActiveAction] = useState<CharacterAction>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (action === 'idle') {
      setActiveAction('idle')
      return
    }
    // Restart the CSS animation even when the same action repeats.
    setActiveAction('idle')
    const raf = requestAnimationFrame(() => setActiveAction(action))
    const shouldLoop = loop && LOOPABLE_ACTIONS.has(action)
    if (!shouldLoop) {
      timerRef.current = setTimeout(
        () => setActiveAction('idle'),
        ACTION_DURATION_MS[action] + 40,
      )
    }
    return () => {
      cancelAnimationFrame(raf)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [action, actionKey, loop])

  const common = {
    showBubble: Boolean(bubble),
    currentText: bubble ?? '',
    isTalking: speaking,
    className: 'h-full w-full',
  }

  let figure: React.ReactNode
  switch (character) {
    case 'dina':
      figure = <DinaCharacter {...common} expression={EMOTION_TO_NATIVE.dina[emotion]} />
      break
    case 'dino':
      figure = <DinoCharacter {...common} mood={EMOTION_TO_NATIVE.dino[emotion] as DinoMood} />
      break
    case 'rho':
      figure = <DrRhoCharacter {...common} mood={EMOTION_TO_NATIVE.rho[emotion] as RhoMood} />
      break
    case 'zara':
      figure = <ZaraVexCharacter {...common} mood={EMOTION_TO_NATIVE.zara[emotion] as ZaraMood} />
      break
  }

  return (
    <div
      className={cn(
        'lf-actor pointer-events-none select-none',
        `lf-actor-${character}`,
        activeAction !== 'idle' && `lf-act-${activeAction}`,
        loop && LOOPABLE_ACTIONS.has(activeAction) && 'lf-act-loop',
        SIZE_CLASSES[size],
        className,
      )}
      data-character={character}
      aria-hidden="true"
    >
      {figure}
    </div>
  )
}

export default CharacterActor
