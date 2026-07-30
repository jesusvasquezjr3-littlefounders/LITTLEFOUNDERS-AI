// `stacker` — the renderer (GAME_ENGINE.md §7, §10; /DESIGN.md "Game visuals").
//
// A RENDERER, not a simulator: it reads `state`/`snapshot` and calls `emit`. It never
// scores, never advances a tick and never reads the wall clock — that split is what lets
// Core replay the same mechanic without React. Every number it draws with (field size,
// piece geometry, costs, the margin threshold, the announced timeline) comes out of the
// validated `config`; there is no tuning constant in this file.
//
// TWO INPUT PATHS, ALWAYS (/CLAUDE.md §1.11, non-negotiable):
//  - TAP/KEYBOARD is the guaranteed path: pick a piece from the tray, nudge the ghost
//    with the arrow controls, commit with "Colocar". Every one of those is a real
//    `<button>` at >= 44x44px at BOTH breakpoints, so a child on a phone and a child on
//    a keyboard get the same game.
//  - DRAG is progressive enhancement over it, through core/input.ts: drag a tray piece
//    onto a column of the canvas. Drag is never the only way to do anything.
//
// Scaling goes through core/stage.ts rather than a bespoke transform: the simulation runs
// in fixed design units and the stage maps them onto whatever viewport the child has, so
// 375px and 1280px are the same game, letterboxed, never re-laid-out.

import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, Icon, ProgressBar } from '@/components/ui'
import { HIT_TARGET_CLASS, useGameDrag, useTapPlacement } from '@/game-engine/core/input'
import { useStageScale } from '@/game-engine/core/stage'
import type { GameItem, GamePaletteId, MechanicViewProps } from '@/game-engine/core/types'
import { cn } from '@/lib/utils'

import type { StackerForceEvent, StackerPiece } from './schema'
import { costOfPiece } from './schema'
import {
  assistActive,
  budgetLeft,
  heightOf,
  rotatedSize,
  seatY,
  snapX,
  suggestPiece,
  type StackerBody,
  type StackerState,
} from './simulate'

/**
 * How many drag/tap columns the canvas is divided into.
 *
 * This is an INPUT-AFFORDANCE density, not a tuning value: the committed position is
 * always `snapX(config, ...)`, quantised by the manifest's own `placement.snap_grid`, and
 * the arrow controls step by exactly that grid. Seven is the largest odd count that still
 * leaves every column wider than 44px inside a letterboxed stage on a 375px viewport
 * (a 900-unit field scales to ~0.38, so 900/7 * 0.38 ~ 49px), and odd guarantees a column
 * centred on the field — where a well-placed foundation goes.
 */
const PLACEMENT_COLUMNS = 7

/** Zone id prefix for the drag path. Namespaced with a colon so it can never collide
 *  with a generated content id, which the playbook keeps kebab-case. */
const COLUMN_ZONE_PREFIX = 'stacker:col:'

/** Material Symbol drawn when a piece binds neither a sprite nor an icon. Emoji are
 *  never used: they render differently on every platform and carry a tone the art
 *  direction does not control. */
const FALLBACK_ICON = 'square'

const FORCE_ICONS: Record<StackerForceEvent['kind'], string> = {
  wind: 'air',
  vibration: 'vibration',
  earthquake: 'earthquake',
  rain: 'rainy',
  load: 'weight',
}

/**
 * The six closed palettes, resolved to DESIGN tokens. Palette tokens are THEME-STABLE by
 * rule: no `-soft` token appears here, because those invert between light and dark while
 * the stage does not, and the readability of a simulation must not change when a child
 * flips the theme. Never a raw hex, and never an arcade font — arcade character comes
 * from weight, size and motion, in Figtree, at the `lf-*` scale (§10).
 */
interface StackerPaletteClasses {
  sky: string
  ground: string
  base: string
  piece: string
  pieceBorder: string
  ghost: string
  marker: string
  ink: string
  inkMuted: string
}

const PALETTES: Record<GamePaletteId, StackerPaletteClasses> = {
  'navy-papaya': {
    sky: 'bg-inverse',
    ground: 'bg-inverse-surface',
    base: 'bg-accent',
    piece: 'bg-inverse-surface',
    pieceBorder: 'border-accent',
    ghost: 'border-accent',
    marker: 'bg-accent',
    ink: 'text-on-inverse',
    inkMuted: 'text-on-inverse-muted',
  },
  'forest-pear': {
    sky: 'bg-success-strong',
    ground: 'bg-success',
    base: 'bg-delight',
    piece: 'bg-surface',
    pieceBorder: 'border-success-strong',
    ghost: 'border-delight',
    marker: 'bg-delight',
    ink: 'text-on-success',
    inkMuted: 'text-on-success',
  },
  'ocean-blue': {
    sky: 'bg-inverse-surface',
    ground: 'bg-inverse',
    base: 'bg-primary-strong',
    piece: 'bg-surface',
    pieceBorder: 'border-primary-strong',
    ghost: 'border-primary',
    marker: 'bg-primary',
    ink: 'text-on-inverse',
    inkMuted: 'text-on-inverse-muted',
  },
  'sunset-papaya': {
    sky: 'bg-accent-strong',
    ground: 'bg-accent',
    base: 'bg-inverse',
    piece: 'bg-surface',
    pieceBorder: 'border-inverse',
    ghost: 'border-inverse',
    marker: 'bg-inverse',
    ink: 'text-on-accent',
    inkMuted: 'text-on-accent',
  },
  'violet-night': {
    sky: 'bg-inverse',
    ground: 'bg-inverse-surface',
    base: 'bg-primary-strong',
    piece: 'bg-inverse-surface',
    pieceBorder: 'border-primary-strong',
    ghost: 'border-delight',
    marker: 'bg-delight',
    ink: 'text-on-inverse',
    inkMuted: 'text-on-inverse-muted',
  },
  'sand-clay': {
    sky: 'bg-warning-strong',
    ground: 'bg-warning',
    base: 'bg-inverse',
    piece: 'bg-surface',
    pieceBorder: 'border-inverse',
    ghost: 'border-inverse',
    marker: 'bg-inverse',
    ink: 'text-on-warning',
    inkMuted: 'text-on-warning',
  },
}

interface CanvasArtProps {
  url: string | undefined
  icon: string | undefined
  /** Design-px box the art fills; drives the glyph's optical size. */
  size: number
}

/**
 * Sprite when the manifest bound one, the item's Material Symbols glyph when it did not,
 * and the bare palette shape when it bound neither. A missing sprite is never a broken
 * image and never an empty rectangle — a document is fully playable and fully legible
 * before the `illustrate` stage has ever run.
 */
function CanvasArt({ url, icon, size }: CanvasArtProps) {
  if (url !== undefined) {
    return <img src={url} alt="" aria-hidden="true" className="h-full w-full object-contain" />
  }
  if (icon === undefined) return null
  return (
    <span
      className="flex h-full w-full items-center justify-center"
      style={{ fontSize: `${Math.max(12, Math.round(size * 0.6))}px` }}
      aria-hidden="true"
    >
      <Icon name={icon} />
    </span>
  )
}

export function StackerView(props: MechanicViewProps) {
  const { document: gameDocument, state, snapshot, emit, paused, reducedMotion } = props
  const { t } = useTranslation()

  const stacker = state as StackerState
  const config = stacker.config
  const palette = PALETTES[gameDocument.skin.palette]
  const sprites = gameDocument.skin.sprites
  const locked = paused || snapshot.finished

  const stage = useStageScale({
    designWidth: config.field.width,
    designHeight: config.field.height,
    mode: 'contain',
    safeArea: false,
  })

  const itemsById = useMemo(() => {
    const map = new Map<string, GameItem>()
    for (const item of gameDocument.content.items) map.set(item.id, item)
    return map
  }, [gameDocument.content.items])

  // The ghost's committed column, in design units, and its rotation step. Both are pure
  // VIEW state: nothing is decided until "Colocar" emits, and the simulator re-quantises
  // whatever arrives, so a desynced ghost can never desync the simulation.
  const [ghostX, setGhostX] = useState(config.field.base_x)
  const [rotation, setRotation] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [moveMode, setMoveMode] = useState(false)

  const lastBody = stacker.bodies[stacker.bodies.length - 1]
  const suggestion = useMemo(
    () => (assistActive(stacker) && config.assist.suggest_piece ? suggestPiece(stacker) : null),
    [stacker, config.assist.suggest_piece],
  )

  const pieceOf = useCallback(
    (itemId: string | null): StackerPiece | undefined =>
      itemId === null ? undefined : config.catalog.find((entry) => entry.item_id === itemId),
    [config.catalog],
  )

  const commitAt = useCallback(
    (itemId: string, x: number) => {
      if (moveMode) {
        if (lastBody === undefined) return
        emit('move', { n: lastBody.uid, x })
        setMoveMode(false)
        return
      }
      emit('place', { slot: itemId, x, n: rotation })
    },
    [emit, lastBody, moveMode, rotation],
  )

  /** One handler for BOTH input paths: the drag resolves the column under the pointer
   *  and the tap resolves the column that was tapped, and they must produce the same
   *  event or the two paths would be two different games. */
  const handleColumnDrop = useCallback(
    (itemId: string, zoneId: string) => {
      if (!zoneId.startsWith(COLUMN_ZONE_PREFIX)) return
      const index = Number.parseInt(zoneId.slice(COLUMN_ZONE_PREFIX.length), 10)
      if (!Number.isInteger(index)) return
      const x = ((index + 0.5) * config.field.width) / PLACEMENT_COLUMNS
      setGhostX(x)
      setSelected(itemId)
      commitAt(itemId, x)
    },
    [commitAt, config.field.width],
  )

  const drag = useGameDrag({ onDrop: handleColumnDrop, disabled: locked })
  const tap = useTapPlacement({ onPlace: handleColumnDrop, disabled: locked })

  const activePieceId = tap.selected ?? selected
  const activePiece = pieceOf(activePieceId)
  const ghostSize = activePiece
    ? rotatedSize(activePiece, rotation, config.placement.rotation_steps)
    : null
  const ghostSnappedX = ghostSize ? snapX(config, ghostX, ghostSize.w) : ghostX
  const ghostY =
    ghostSize && config.placement.mode === 'snap'
      ? seatY(stacker, ghostSnappedX, ghostSize.w, ghostSize.h)
      : config.placement.drop_y

  const nudge = useCallback(
    (direction: number) => {
      setGhostX((current) => {
        const next = current + direction * config.placement.snap_grid
        return Math.max(0, Math.min(config.field.width, next))
      })
    },
    [config.field.width, config.placement.snap_grid],
  )

  const money = budgetLeft(stacker)
  const height = heightOf(stacker)
  const marginPct = Math.min(
    100,
    Math.round((stacker.margin / config.stability.margin_threshold) * 100),
  )
  const holdPct = Math.min(
    100,
    Math.round((stacker.holdTicks / config.stability.hold_ticks) * 100),
  )

  // The ANNOUNCED disturbance: the timeline is a promise, not an ambush (§4). During the
  // build phase the first event is already named, so a child can plan for it.
  const elapsed = stacker.phase === 'test' ? stacker.tick - stacker.testStartTick : -1
  const announced = useMemo(() => {
    for (const event of config.timeline.events) {
      if (elapsed < 0) return event
      if (elapsed < event.at_tick + event.duration_ticks) {
        return elapsed >= event.at_tick - config.timeline.announce_ticks ? event : null
      }
    }
    return null
  }, [config.timeline.announce_ticks, config.timeline.events, elapsed])

  const adaptiveOffered = gameDocument.adaptive?.enabled === true && config.assist.enabled

  const renderBody = (body: StackerBody) => {
    const item = itemsById.get(body.itemId)
    const position = stage.toStage(body.x - body.w / 2, body.y - body.h / 2)
    const size = stage.toStage(body.w, body.h)
    return (
      <div
        key={body.uid}
        className={cn(
          'absolute border-2',
          body.shape === 'circle' ? 'rounded-full' : 'rounded-sm',
          palette.piece,
          palette.pieceBorder,
          // Decorative only: the body's position still updates every tick with reduced
          // motion on — the simulation is never disabled (§10).
          !reducedMotion && 'shadow-glass-sm',
        )}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: `${size.x}px`,
          height: `${size.y}px`,
        }}
      >
        <CanvasArt
          url={item?.image_slot === undefined ? undefined : sprites[item.image_slot]}
          icon={item?.icon ?? FALLBACK_ICON}
          size={Math.min(size.x, size.y)}
        />
      </div>
    )
  }

  const baseLeft = stage.toStage(
    config.field.base_x - config.field.base_width / 2,
    config.field.ground_y,
  )
  const baseSize = stage.toStage(config.field.base_width, config.field.height)
  const targetMarker = stage.toStage(0, config.field.ground_y - config.stability.target_height)

  return (
    <div className="flex h-full w-full min-h-0 flex-col gap-3">
      {/* ---- Canvas ---- */}
      <div
        ref={stage.ref}
        style={stage.containerStyle}
        className="relative flex min-h-0 flex-1 items-center justify-center"
      >
        <div
          style={stage.stageStyle}
          className={cn('relative overflow-hidden rounded-lg', palette.sky)}
        >
          {gameDocument.skin.background_url !== undefined && (
            <img
              src={gameDocument.skin.background_url}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}

          {/* Ground well + the base platform the structure must stand on. Each is a
              declared sprite slot with a palette-shape fallback, so the field reads
              correctly before Prism has illustrated anything. */}
          <div
            className={cn('absolute left-0 w-full', palette.ground)}
            style={{
              top: `${stage.toStage(0, config.field.ground_y).y}px`,
              height: `${stage.toStage(0, config.field.height - config.field.ground_y).y}px`,
            }}
          >
            {sprites.ground !== undefined && (
              <img
                src={sprites.ground}
                alt=""
                aria-hidden="true"
                className="h-full w-full object-cover"
              />
            )}
          </div>
          <div
            className={cn('absolute overflow-hidden rounded-sm', palette.base)}
            style={{
              left: `${baseLeft.x}px`,
              top: `${baseLeft.y}px`,
              width: `${baseSize.x}px`,
              height: `${Math.max(2, stage.toStage(0, 8).y)}px`,
            }}
          >
            {sprites.base !== undefined && (
              <img
                src={sprites.base}
                alt=""
                aria-hidden="true"
                className="h-full w-full object-cover"
              />
            )}
          </div>

          {/* The height a full height score needs — the goal made visible. */}
          <div
            className={cn('absolute left-0 flex w-full items-center', palette.marker, 'h-px opacity-70')}
            style={{ top: `${targetMarker.y}px` }}
            aria-hidden="true"
          >
            {sprites.marker_target !== undefined && (
              <img src={sprites.marker_target} alt="" className="h-6 w-6 object-contain" />
            )}
          </div>

          {stacker.bodies.map(renderBody)}

          {config.placement.ghost_preview && ghostSize !== null && !locked && (
            <div
              className={cn(
                'absolute border-2 border-dashed opacity-70',
                activePiece?.shape === 'circle' ? 'rounded-full' : 'rounded-sm',
                palette.ghost,
              )}
              style={{
                left: `${stage.toStage(ghostSnappedX - ghostSize.w / 2, 0).x}px`,
                top: `${stage.toStage(0, ghostY - ghostSize.h / 2).y}px`,
                width: `${stage.toStage(ghostSize.w, 0).x}px`,
                height: `${stage.toStage(0, ghostSize.h).y}px`,
              }}
              aria-hidden="true"
            >
              {sprites.ghost !== undefined && (
                <img src={sprites.ghost} alt="" className="h-full w-full object-contain" />
              )}
            </div>
          )}

          {/* Drag/tap columns. Progressive enhancement over the arrow controls below —
              transparent, full height, and each one wider than 44px at 375px. */}
          <div className="absolute inset-0 flex">
            {Array.from({ length: PLACEMENT_COLUMNS }, (_, index) => {
              const zoneId = `${COLUMN_ZONE_PREFIX}${index}`
              const x = ((index + 0.5) * config.field.width) / PLACEMENT_COLUMNS
              return (
                <button
                  key={zoneId}
                  type="button"
                  disabled={locked}
                  aria-label={t('games.stacker.columnLabel', { index: index + 1 })}
                  className={cn(
                    'h-full flex-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px]',
                    drag.hoverZone === zoneId && cn('border-x-2 border-dashed', palette.ghost),
                  )}
                  {...tap.zoneProps(zoneId)}
                  onClick={() => {
                    setGhostX(x)
                    if (activePieceId !== null) handleColumnDrop(activePieceId, zoneId)
                  }}
                />
              )
            })}
          </div>

          {/* In-canvas readouts. Chrome (score, lives) belongs to the player shell; what
              the mechanic owns is the money, the stability and the weather. */}
          <div className={cn('pointer-events-none absolute left-2 top-2 flex flex-col gap-1', palette.ink)}>
            <span className="lf-label lf-number rounded-full bg-surface/80 px-3 py-1 text-content">
              {t('games.stacker.budget', { amount: money })}
            </span>
            <span className="lf-caption rounded-full bg-surface/80 px-3 py-1 text-content">
              {t('games.stacker.height', {
                height: Math.round(height),
                target: config.stability.target_height,
              })}
            </span>
          </div>

          {announced !== null && (
            <span
              className={cn(
                'lf-caption pointer-events-none absolute right-2 top-2 flex items-center gap-1 rounded-full bg-surface/80 px-3 py-1 text-content',
              )}
            >
              <span className="block h-5 w-5 shrink-0">
                <CanvasArt
                  url={sprites[`force_${announced.kind}`]}
                  icon={FORCE_ICONS[announced.kind]}
                  size={20}
                />
              </span>
              {t(`games.stacker.force.${announced.kind}`)}
            </span>
          )}

          {paused && (
            <p className={cn('lf-label pointer-events-none absolute bottom-2 left-2', palette.inkMuted)}>
              {t('games.stacker.pausedLabel')}
            </p>
          )}

          <span className="sr-only">{t('games.stacker.stageLabel')}</span>
        </div>
      </div>

      {/* ---- Stability readouts ---- */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="lf-caption text-content-muted">
            {t('games.stacker.margin', { value: stacker.margin.toFixed(1) })}
          </span>
          <span className="lf-caption text-content-muted">
            {t('games.stacker.hold', {
              seconds: Math.round((stacker.holdTicks * 50) / 1000),
              target: Math.round((config.stability.hold_ticks * 50) / 1000),
            })}
          </span>
        </div>
        <ProgressBar
          value={marginPct}
          tone={marginPct >= 100 ? 'primary' : 'accent'}
          label={t('games.stacker.marginLabel')}
        />
        {stacker.phase === 'test' && (
          <ProgressBar value={holdPct} label={t('games.stacker.holdLabel')} />
        )}
      </div>

      {/* ---- Piece tray ---- */}
      <div
        className="flex gap-2 overflow-x-auto pb-1"
        role="group"
        aria-label={t('games.stacker.trayLabel')}
      >
        {config.catalog.map((piece, index) => {
          const item = itemsById.get(piece.item_id)
          const cost = costOfPiece(config, piece)
          const unlocked = stacker.attemptPlacements >= piece.unlock_after_pieces
          const usesLeft = piece.max_uses - (stacker.usesByPiece[index] ?? 0)
          const affordable = cost <= money
          const disabled = locked || !unlocked || usesLeft <= 0 || !affordable
          const handleProps = drag.dragHandleProps(piece.item_id)
          const isSelected = activePieceId === piece.item_id
          return (
            <button
              key={piece.item_id}
              type="button"
              aria-label={t('games.stacker.pieceLabel', {
                label: item?.label_md ?? piece.item_id,
                cost,
                uses: Math.max(0, usesLeft),
              })}
              {...tap.itemProps(piece.item_id)}
              {...handleProps}
              disabled={disabled}
              className={cn(
                'flex w-28 shrink-0 flex-col items-center gap-1 rounded-lg border border-outline bg-surface p-2 text-content',
                HIT_TARGET_CLASS,
                isSelected && 'ring-2 ring-accent',
                suggestion === piece.item_id && 'ring-2 ring-primary',
                disabled && 'opacity-50',
                !reducedMotion && 'transition-[box-shadow,opacity] duration-150',
              )}
              style={handleProps.style}
              onClick={() => {
                if (disabled) return
                setSelected(piece.item_id)
                tap.select(piece.item_id)
              }}
            >
              <span className="block h-8 w-full">
                <CanvasArt
                  url={item?.image_slot === undefined ? undefined : sprites[item.image_slot]}
                  icon={item?.icon ?? FALLBACK_ICON}
                  size={32}
                />
              </span>
              <span className="lf-caption w-full text-center leading-tight">
                {item?.label_md ?? piece.item_id}
              </span>
              <span className="lf-caption lf-number text-content-muted">
                {t('games.stacker.uses', { uses: Math.max(0, usesLeft) })}
              </span>
            </button>
          )
        })}
      </div>

      {/* ---- The guaranteed tap path: nudge, rotate, commit ---- */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          variant="secondary"
          disabled={locked}
          aria-label={t('games.stacker.nudgeLeft')}
          onClick={() => nudge(-1)}
        >
          <Icon name="chevron_left" />
        </Button>
        {config.placement.rotation_steps > 1 && (
          <Button
            variant="secondary"
            disabled={locked}
            aria-label={t('games.stacker.rotate')}
            onClick={() =>
              setRotation((current) => {
                const next = current + 1
                return next - Math.floor(next / config.placement.rotation_steps) *
                  config.placement.rotation_steps
              })
            }
          >
            <Icon name="rotate_right" />
          </Button>
        )}
        <Button
          variant="secondary"
          disabled={locked}
          aria-label={t('games.stacker.nudgeRight')}
          onClick={() => nudge(1)}
        >
          <Icon name="chevron_right" />
        </Button>
        {/* The Action Color Contract: exactly ONE papaya CTA in this view, and it is the
            action the child is here to take. */}
        <Button
          disabled={locked || activePieceId === null}
          onClick={() => {
            if (activePieceId === null) return
            commitAt(activePieceId, ghostX)
          }}
        >
          {moveMode ? t('games.stacker.commitMove') : t('games.stacker.commit')}
        </Button>
      </div>

      {/* ---- Economy + phase controls ---- */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          variant="secondary"
          disabled={locked || lastBody === undefined}
          onClick={() => {
            if (lastBody === undefined) return
            emit('remove', { n: lastBody.uid })
          }}
        >
          {t('games.stacker.removeLast', {
            refund: Math.round(((lastBody?.cost ?? 0) * config.economy.refund_pct) / 100),
          })}
        </Button>
        <Button
          variant="secondary"
          aria-pressed={moveMode}
          disabled={locked || lastBody === undefined}
          onClick={() => setMoveMode((current) => !current)}
          className={cn(moveMode && 'ring-2 ring-accent')}
        >
          {t('games.stacker.moveLast', { cost: config.economy.reposition_cost })}
        </Button>
        <Button
          variant="success"
          disabled={locked || stacker.phase === 'test'}
          onClick={() => emit('ready')}
        >
          {t('games.stacker.ready')}
        </Button>
        {/* Adaptive assistance is OFFERED, never imposed: the toggle only exists when the
            document's `adaptive` block enables it, and it is a two-way switch because
            `assist_toggleable` is literally `true` (GAME_ENGINE.md §3). */}
        {adaptiveOffered && (
          <Button
            variant="secondary"
            aria-pressed={stacker.assistOn}
            disabled={locked}
            onClick={() => emit(stacker.assistOn ? 'assist_off' : 'assist_on')}
            className={cn(stacker.assistOn && 'ring-2 ring-primary')}
          >
            {t(stacker.assistOn ? 'games.stacker.assistOn' : 'games.stacker.assistOff')}
          </Button>
        )}
      </div>

      <p className="lf-caption text-center text-content-muted">
        {t(stacker.phase === 'build' ? 'games.stacker.hintBuild' : 'games.stacker.hintTest')}
      </p>
    </div>
  )
}
