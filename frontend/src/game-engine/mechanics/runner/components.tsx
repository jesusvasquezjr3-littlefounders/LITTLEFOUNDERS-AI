// Runner — the renderer (GAME_ENGINE.md §7, §10; /DESIGN.md "Game visuals").
//
// A RENDERER, not a simulator: it reads `state`/`snapshot` and calls `emit`. It never
// scores, never advances a tick and never reads the wall clock — that split is what
// lets Core replay the same mechanic without React.
//
// Canvas-vs-chrome (/DESIGN.md, NON-NEGOTIABLE): inside the stage rectangle we draw
// Prism sprites and palette-tinted shapes; outside it everything is closed DESIGN
// tokens. There is no raw hex in this file and no arcade font import — v1 shipped six
// games with six Google Fonts, so arcade character here comes from weight, size and
// motion, in Figtree, at the `lf-*` scale.
//
// Scaling goes through `core/stage.ts` rather than a bespoke transform: the simulation
// runs in fixed design units and the stage maps them onto whatever viewport the child
// has, so 375px and 1280px are the same game, letterboxed, never re-laid-out.

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Icon } from '@/components/ui'
import { HIT_TARGET_CLASS } from '@/game-engine/core/input'
import { useStageScale } from '@/game-engine/core/stage'
import type { GameItem, GamePaletteId, MechanicViewProps } from '@/game-engine/core/types'
import { cn } from '@/lib/utils'

import type { RunnerActionModel } from './schema'
import {
  avatarLeftX,
  avatarTopY,
  entityTopY,
  isEntityArmed,
  type RunnerEntity,
  type RunnerState,
} from './simulate'

/**
 * The six closed palettes, resolved to DESIGN tokens. Palette tokens are
 * THEME-STABLE by rule: no `-soft` token appears here, because those invert between
 * light and dark while the stage does not, and the readability of a simulation must
 * not change when a child flips the theme.
 */
interface RunnerPaletteClasses {
  stage: string
  well: string
  accent: string
  accentBorder: string
  highlight: string
  ink: string
  inkMuted: string
}

const PALETTES: Record<GamePaletteId, RunnerPaletteClasses> = {
  'navy-papaya': {
    stage: 'bg-inverse',
    well: 'bg-inverse-surface',
    accent: 'bg-accent',
    accentBorder: 'border-accent',
    highlight: 'bg-delight',
    ink: 'text-on-inverse',
    inkMuted: 'text-on-inverse-muted',
  },
  'forest-pear': {
    stage: 'bg-success-strong',
    well: 'bg-success',
    accent: 'bg-delight',
    accentBorder: 'border-delight',
    highlight: 'bg-warning',
    ink: 'text-on-success',
    inkMuted: 'text-on-success',
  },
  'ocean-blue': {
    stage: 'bg-inverse-surface',
    well: 'bg-inverse',
    accent: 'bg-accent',
    accentBorder: 'border-accent',
    highlight: 'bg-delight',
    ink: 'text-on-inverse',
    inkMuted: 'text-on-inverse-muted',
  },
  'sunset-papaya': {
    stage: 'bg-accent-strong',
    well: 'bg-accent',
    accent: 'bg-inverse',
    accentBorder: 'border-inverse',
    highlight: 'bg-delight',
    ink: 'text-on-accent',
    inkMuted: 'text-on-accent',
  },
  'violet-night': {
    stage: 'bg-inverse',
    well: 'bg-inverse-surface',
    accent: 'bg-primary-strong',
    accentBorder: 'border-primary-strong',
    highlight: 'bg-delight',
    ink: 'text-on-inverse',
    inkMuted: 'text-on-inverse-muted',
  },
  'sand-clay': {
    stage: 'bg-warning-strong',
    well: 'bg-warning',
    accent: 'bg-inverse',
    accentBorder: 'border-inverse',
    highlight: 'bg-delight',
    ink: 'text-on-warning',
    inkMuted: 'text-on-warning',
  },
}

/** Keys the manifest may bind for this mechanic, mapped from what is on screen. */
function spriteSlotFor(entity: RunnerEntity, item: GameItem | undefined): string {
  if (entity.role === 'obstacle') {
    if (entity.variant === 'sudden') return 'obstacle_sudden'
    if (entity.variant === 'moving') return 'obstacle_moving'
    return 'obstacle'
  }
  return item?.image_slot ?? (entity.role === 'good' ? 'collect_good' : 'collect_bad')
}

interface CanvasArtProps {
  url: string | undefined
  icon: string | undefined
  /** Design-px box the art fills; drives the icon's optical size. */
  size: number
}

/**
 * Sprite when the manifest bound one, the item's Material Symbols glyph when it did
 * not, and the bare palette shape when it bound neither. A missing sprite is never a
 * broken image and never an empty rectangle — a document is fully playable before the
 * `illustrate` stage has ever run.
 */
function CanvasArt({ url, icon, size }: CanvasArtProps) {
  if (url !== undefined) {
    return <img src={url} alt="" aria-hidden="true" className="h-full w-full object-contain" />
  }
  if (icon !== undefined) {
    return (
      <span
        className="flex h-full w-full items-center justify-center"
        style={{ fontSize: `${Math.max(12, Math.round(size * 0.62))}px` }}
      >
        <Icon name={icon} />
      </span>
    )
  }
  return null
}

const ACTION_KEYS = new Set([' ', 'Spacebar', 'ArrowUp', 'Enter'])

export function RunnerView({
  document: gameDocument,
  state,
  snapshot,
  emit,
  paused,
  reducedMotion,
}: MechanicViewProps) {
  const { t } = useTranslation()
  // The slice owns its own state shape; core hands it back erased (§7).
  const runner = state as RunnerState
  const config = runner.config
  const palette = PALETTES[gameDocument.skin.palette]
  const stageButton = useRef<HTMLButtonElement>(null)
  const holding = useRef(false)

  const stage = useStageScale({
    designWidth: config.world.width,
    designHeight: config.world.height,
    mode: 'contain',
    maxScale: 2,
  })

  const itemsById = useMemo(() => {
    const map = new Map<string, GameItem>()
    for (const item of gameDocument.content.items) map.set(item.id, item)
    return map
  }, [gameDocument.content.items])

  const model: RunnerActionModel = config.action.model
  const holdEnabled =
    config.action.model === 'jump' || config.action.model === 'contextual'
      ? config.action.hold.enabled
      : false

  const locked = paused || snapshot.finished
  const emitRef = useRef(emit)
  useEffect(() => {
    emitRef.current = emit
  })

  const act = useCallback(() => {
    if (locked) return
    emitRef.current('act')
    if (holdEnabled && !holding.current) {
      holding.current = true
      emitRef.current('hold_start')
    }
  }, [holdEnabled, locked])

  const release = useCallback(() => {
    if (!holding.current) return
    holding.current = false
    if (holdEnabled) emitRef.current('hold_end')
  }, [holdEnabled])

  // Keyboard is an ADDITION to tap, never a replacement (§10). The listener stands
  // down while the stage button itself has focus, where its own handler already ran.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || !ACTION_KEYS.has(event.key)) return
      if (event.target === stageButton.current) return
      event.preventDefault()
      act()
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (!ACTION_KEYS.has(event.key)) return
      release()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [act, release])

  // A pause or a finish must not leave a hold latched on.
  useEffect(() => {
    if (locked) release()
  }, [locked, release])

  const avatarX = avatarLeftX(runner) - runner.distance
  const avatarY = avatarTopY(runner)
  const avatarActive =
    runner.family === 'vertical' ? !runner.grounded : runner.transitionLeft > 0
  const avatarSprite =
    gameDocument.skin.sprites[avatarActive ? 'avatar_action' : 'avatar'] ??
    gameDocument.skin.sprites.avatar
  const backgroundUrl = gameDocument.skin.background_url
  // Text drawn inside the canvas is Figtree at the lf-* scale; the inverse scale keeps
  // it legible at 375px instead of shrinking with the letterbox (/DESIGN.md: art must
  // read at 1x on a 375px viewport).
  const labelScale = stage.scale > 0 ? 1 / stage.scale : 1

  const visible: RunnerEntity[] = []
  for (const entity of runner.entities) {
    if (!isEntityArmed(entity, runner)) continue
    const screenX = entity.x - runner.distance
    if (screenX + entity.w < 0 || screenX > config.world.width) continue
    visible.push(entity)
  }

  return (
    <div
      ref={stage.ref}
      style={stage.containerStyle}
      className="relative flex h-full w-full items-center justify-center"
    >
      <div
        style={stage.stageStyle}
        className={cn('relative overflow-hidden rounded-lg', palette.stage)}
      >
        {backgroundUrl !== undefined && (
          <img
            src={backgroundUrl}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}

        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{
            width: `${config.world.width}px`,
            height: `${config.world.height}px`,
            transform: `scale(${stage.scale})`,
          }}
        >
          {runner.family === 'vertical' ? (
            <div
              className={cn('absolute left-0 w-full', palette.well)}
              style={{
                top: `${config.world.ground_y}px`,
                height: `${Math.max(0, config.world.height - config.world.ground_y)}px`,
              }}
            />
          ) : (
            runner.lanes.map((laneY, index) => (
              <div
                key={`lane-${index}`}
                className={cn('absolute left-0 w-full opacity-40', palette.well)}
                style={{ top: `${laneY}px`, height: `${config.world.avatar_h}px` }}
              />
            ))
          )}

          {visible.map((entity) => {
            const item = entity.itemId === null ? undefined : itemsById.get(entity.itemId)
            const slot = spriteSlotFor(entity, item)
            const url = gameDocument.skin.sprites[slot]
            const isCollectible = entity.role !== 'obstacle'
            return (
              <div
                key={entity.key}
                className="absolute"
                style={{
                  left: `${entity.x - runner.distance}px`,
                  top: `${entityTopY(entity, runner.tick)}px`,
                  width: `${entity.w}px`,
                  height: `${entity.h}px`,
                }}
              >
                <div
                  className={cn(
                    'h-full w-full',
                    isCollectible ? 'rounded-full border-2' : 'rounded-sm',
                    entity.role === 'obstacle' && palette.accent,
                    entity.role === 'good' && cn(palette.highlight, palette.accentBorder),
                    entity.role === 'bad' && cn(palette.well, palette.accentBorder),
                    entity.role === 'good' && !reducedMotion && 'shadow-glass-sm',
                  )}
                >
                  <CanvasArt
                    url={url}
                    icon={item?.icon}
                    size={Math.min(entity.w, entity.h)}
                  />
                </div>
                {item !== undefined && (
                  <span
                    className={cn(
                      'lf-caption pointer-events-none absolute left-1/2 top-full block whitespace-nowrap',
                      palette.ink,
                    )}
                    style={{
                      transform: `translateX(-50%) scale(${labelScale})`,
                      transformOrigin: 'top center',
                    }}
                  >
                    {item.label_md}
                  </span>
                )}
              </div>
            )
          })}

          <div
            className={cn(
              'absolute',
              !reducedMotion && 'transition-transform duration-75 ease-out',
            )}
            style={{
              left: `${avatarX}px`,
              top: `${avatarY}px`,
              width: `${config.world.avatar_w}px`,
              height: `${config.world.avatar_h}px`,
            }}
          >
            <div
              className={cn(
                'h-full w-full rounded-md border-2',
                palette.highlight,
                palette.accentBorder,
                runner.tick < runner.invulnerableUntil && 'opacity-60',
              )}
            >
              <CanvasArt
                url={avatarSprite}
                icon={avatarActive ? 'directions_run' : 'sprint'}
                size={Math.min(config.world.avatar_w, config.world.avatar_h)}
              />
            </div>
          </div>
        </div>

        {/* The whole stage is the control surface: one binary action, tap anywhere,
            with a real <button> so keyboard and screen readers get it for free. */}
        <button
          ref={stageButton}
          type="button"
          disabled={locked}
          aria-label={t(`games.runner.action.${model}`)}
          className={cn(
            'absolute inset-0 z-10 h-full w-full cursor-pointer',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px]',
            HIT_TARGET_CLASS,
          )}
          onPointerDown={(event) => {
            event.preventDefault()
            act()
          }}
          onPointerUp={release}
          onPointerCancel={release}
          onPointerLeave={release}
          onKeyDown={(event) => {
            if (event.repeat || !ACTION_KEYS.has(event.key)) return
            event.preventDefault()
            act()
          }}
          onKeyUp={(event) => {
            if (!ACTION_KEYS.has(event.key)) return
            release()
          }}
        />

        {runner.acts === 0 && !snapshot.finished && (
          <p
            className={cn(
              'lf-caption pointer-events-none absolute left-4 top-4 z-20 max-w-[70%]',
              palette.inkMuted,
            )}
          >
            {t(`games.runner.hint.${model}`)}
            {holdEnabled ? ` ${t('games.runner.hint.hold')}` : ''}
          </p>
        )}

        {paused && (
          <p
            className={cn(
              'lf-label pointer-events-none absolute bottom-4 left-4 z-20',
              palette.inkMuted,
            )}
          >
            {t('games.runner.pausedLabel')}
          </p>
        )}

        <span className="sr-only">{t('games.runner.stageLabel')}</span>
      </div>
    </div>
  )
}
