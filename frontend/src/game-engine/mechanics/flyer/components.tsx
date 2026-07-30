// Flyer — the renderer (GAME_ENGINE.md §7, §10, §13; /DESIGN.md "Game visuals").
//
// A RENDERER, not a simulator: it reads `state`/`snapshot` and calls `emit`. It never
// scores, never advances a tick and never reads the wall clock — that split is what lets
// Core replay the same mechanic without React.
//
// The mechanic is DELIBERATELY 2.5D (owner-approved, /GAME_ENGINE.md §13): the mount
// holds a fixed x while the sky scrolls, the player steers pitch (climb/dive) and an
// optional lane-like yaw, and lanes are drawn as a parallax depth offset rather than as
// a third simulated axis. A touch screen has no throttle or rudder, a 6DoF model would
// bury the money concept for a 6–12 year old, and 2.5D keeps the deterministic replay
// budget small. None of that costs the flight fantasy: energy, thermals, storms, the
// beam, projectiles and aerial enemies are all on screen.
//
// Canvas-vs-chrome (/DESIGN.md, NON-NEGOTIABLE): inside the stage rectangle we draw
// Prism sprites and palette-tinted shapes; outside it everything is closed DESIGN
// tokens, the `lf-*` type scale and Material Symbols. There is no raw hex in this file
// and no arcade font import — arcade character comes from weight, size and motion, in
// Figtree.
//
// INPUT (/CLAUDE.md §1.11). TAP is the guaranteed path: the top half of the sky is a
// real "climb" button and the bottom half a real "dive" button, and every control in the
// bar below is >= 44x44px. DRAG is the enhancement, wired through `core/input.ts`:
// the steering handle can be dragged into either half, and `useTapPlacement` gives the
// same handle a select-then-tap path. Drag is never the only way to act.
//
// Scaling goes through `core/stage.ts` rather than a bespoke transform: the simulation
// runs in fixed design units and the stage maps them onto whatever viewport the child
// has, so 375px and 1280px are the same game, letterboxed, never re-laid-out.

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Icon } from '@/components/ui'
import { HIT_TARGET_CLASS, useGameDrag, useTapPlacement } from '@/game-engine/core/input'
import { useStageScale } from '@/game-engine/core/stage'
import type { GameItem, GamePaletteId, MechanicViewProps } from '@/game-engine/core/types'
import { cn } from '@/lib/utils'

import {
  beamBox,
  isInStorm,
  isInThermal,
  mountLeftX,
  type FlyerEntity,
  type FlyerState,
} from './simulate'

/** The id the steering handle carries through both input hooks. */
const STEER_HANDLE = 'mount'

/** Drop-zone / tap-zone ids. They double as the action names, which is what keeps the
 *  drag path and the tap path from drifting apart. */
const ZONE_CLIMB = 'climb'
const ZONE_DIVE = 'dive'

/**
 * The six closed palettes, resolved to DESIGN tokens. Palette tokens are THEME-STABLE by
 * rule: no `-soft` token appears here, because those invert between light and dark while
 * the stage does not, and the readability of a simulation must not change when a child
 * flips the theme.
 */
interface FlyerPaletteClasses {
  sky: string
  ground: string
  accent: string
  accentBorder: string
  highlight: string
  hazard: string
  ink: string
  inkMuted: string
}

const PALETTES: Record<GamePaletteId, FlyerPaletteClasses> = {
  'navy-papaya': {
    sky: 'bg-inverse',
    ground: 'bg-inverse-surface',
    accent: 'bg-accent',
    accentBorder: 'border-accent',
    highlight: 'bg-delight',
    hazard: 'bg-warning-strong',
    ink: 'text-on-inverse',
    inkMuted: 'text-on-inverse-muted',
  },
  'forest-pear': {
    sky: 'bg-success-strong',
    ground: 'bg-success',
    accent: 'bg-delight',
    accentBorder: 'border-delight',
    highlight: 'bg-warning',
    hazard: 'bg-warning-strong',
    ink: 'text-on-success',
    inkMuted: 'text-on-success',
  },
  'ocean-blue': {
    sky: 'bg-inverse-surface',
    ground: 'bg-inverse',
    accent: 'bg-accent',
    accentBorder: 'border-accent',
    highlight: 'bg-delight',
    hazard: 'bg-warning-strong',
    ink: 'text-on-inverse',
    inkMuted: 'text-on-inverse-muted',
  },
  'sunset-papaya': {
    sky: 'bg-accent-strong',
    ground: 'bg-accent',
    accent: 'bg-inverse',
    accentBorder: 'border-inverse',
    highlight: 'bg-delight',
    hazard: 'bg-inverse-surface',
    ink: 'text-on-accent',
    inkMuted: 'text-on-accent',
  },
  'violet-night': {
    sky: 'bg-inverse',
    ground: 'bg-inverse-surface',
    accent: 'bg-primary-strong',
    accentBorder: 'border-primary-strong',
    highlight: 'bg-delight',
    hazard: 'bg-warning-strong',
    ink: 'text-on-inverse',
    inkMuted: 'text-on-inverse-muted',
  },
  'sand-clay': {
    sky: 'bg-warning-strong',
    ground: 'bg-warning',
    accent: 'bg-inverse',
    accentBorder: 'border-inverse',
    highlight: 'bg-delight',
    hazard: 'bg-inverse-surface',
    ink: 'text-on-warning',
    inkMuted: 'text-on-warning',
  },
}

/** Which declared sprite slot an entity asks for. An item may override it. */
function spriteSlotFor(entity: FlyerEntity, item: GameItem | undefined, boss: boolean): string {
  if (item?.image_slot !== undefined) return item.image_slot
  switch (entity.role) {
    case 'good':
      return 'collect_good'
    case 'bad':
      return 'collect_bad'
    case 'obstacle':
      return 'obstacle'
    case 'enemy':
      return boss ? 'enemy_boss' : 'enemy'
    case 'thermal':
      return 'thermal'
    default:
      return 'storm'
  }
}

/** Material Symbols fallback per role, so a pre-illustration document still reads. */
function iconFor(entity: FlyerEntity): string {
  switch (entity.role) {
    case 'good':
      return 'savings'
    case 'bad':
      return 'remove_circle'
    case 'obstacle':
      return 'dangerous'
    case 'enemy':
      return 'flutter_dash'
    case 'thermal':
      return 'arrow_upward'
    default:
      return 'thunderstorm'
  }
}

interface CanvasArtProps {
  url: string | undefined
  icon: string | undefined
  /** Design-px box the art fills; drives the icon's optical size. */
  size: number
}

/**
 * Sprite when the manifest bound one, a Material Symbols glyph when it did not, and the
 * bare palette shape when it bound neither. A missing sprite is never a broken image and
 * never an empty rectangle — a document is fully playable before the `illustrate` stage
 * has ever run.
 */
function CanvasArt({ url, icon, size }: CanvasArtProps) {
  if (url !== undefined) {
    return <img src={url} alt="" aria-hidden="true" className="h-full w-full object-contain" />
  }
  if (icon !== undefined) {
    return (
      <span
        className="flex h-full w-full items-center justify-center"
        style={{ fontSize: `${Math.max(12, Math.round(size * 0.6))}px` }}
      >
        <Icon name={icon} />
      </span>
    )
  }
  return null
}

/** Keyboard is an ADDITION to tap, never a replacement (§10). */
const CLIMB_KEYS = new Set(['ArrowUp', 'w', 'W'])
const DIVE_KEYS = new Set(['ArrowDown', 's', 'S'])
const FIRE_KEYS = new Set([' ', 'Spacebar', 'Enter'])

export function FlyerView({
  document: gameDocument,
  state,
  snapshot,
  emit,
  paused,
  reducedMotion,
}: MechanicViewProps) {
  const { t } = useTranslation()
  // The slice owns its own state shape; core hands it back erased (§7).
  const flyer = state as FlyerState
  const config = flyer.config
  const world = config.world
  const palette = PALETTES[gameDocument.skin.palette]
  const locked = paused || snapshot.finished

  const stage = useStageScale({
    designWidth: world.width,
    designHeight: world.height,
    mode: 'contain',
    maxScale: 2,
  })

  const itemsById = useMemo(() => {
    const map = new Map<string, GameItem>()
    for (const item of gameDocument.content.items) map.set(item.id, item)
    return map
  }, [gameDocument.content.items])

  const bossIds = useMemo(() => {
    const ids = new Set<string>()
    for (const enemy of config.enemies) {
      if (enemy.boss) ids.add(enemy.id)
    }
    return ids
  }, [config.enemies])

  const emitRef = useRef(emit)
  useEffect(() => {
    emitRef.current = emit
  })

  const act = useCallback(
    (action: string, n?: number) => {
      if (locked) return
      emitRef.current(action, n === undefined ? undefined : { n })
    },
    [locked],
  )

  // Drag is the ENHANCEMENT and tap is the guarantee — both go through core/input.ts so
  // this mechanic feels like every other one (§10).
  const drag = useGameDrag({
    onDrop: (_itemId, zoneId) => act(zoneId),
    disabled: locked,
  })
  const tap = useTapPlacement({
    onPlace: (_itemId, zoneId) => act(zoneId),
    disabled: locked,
  })

  const onZone = useCallback(
    (zone: string) => {
      // A selected handle means the child is mid tap-placement; honour that gesture
      // rather than firing twice.
      if (tap.selected !== null) {
        tap.place(zone)
        return
      }
      act(zone)
    },
    [act, tap],
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      if (CLIMB_KEYS.has(event.key)) {
        event.preventDefault()
        act(ZONE_CLIMB)
      } else if (DIVE_KEYS.has(event.key)) {
        event.preventDefault()
        act(ZONE_DIVE)
      } else if (FIRE_KEYS.has(event.key) && config.armament.projectile.enabled) {
        event.preventDefault()
        act('fire')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [act, config.armament.projectile.enabled])

  const inThermal = isInThermal(flyer)
  const inStorm = isInStorm(flyer)
  const beam = beamBox(flyer)
  const mountX = mountLeftX(flyer) - flyer.distance
  const laneOffset = config.lanes.enabled ? flyer.lanePos * config.lanes.spacing_units : 0
  const energyPct = flyer.energyCapacity > 0 ? (flyer.energy / flyer.energyCapacity) * 100 : 0
  const hullPct = flyer.hullMax > 0 ? (flyer.hull / flyer.hullMax) * 100 : 0
  const lowEnergy = flyer.energy <= config.energy.low_threshold
  // Text drawn inside the canvas is Figtree at the lf-* scale; the inverse scale keeps it
  // legible at 375px instead of shrinking with the letterbox.
  const labelScale = stage.scale > 0 ? 1 / stage.scale : 1

  const visible: FlyerEntity[] = []
  for (const entity of flyer.entities) {
    const screenX = entity.x - flyer.distance
    if (screenX + entity.w < 0 || screenX > world.width) continue
    visible.push(entity)
  }

  const mountSprite =
    gameDocument.skin.sprites[
      flyer.pitch > config.energy.glide_band_deg
        ? 'mount_climb'
        : flyer.pitch < -config.energy.glide_band_deg
          ? 'mount_dive'
          : 'mount'
    ] ?? gameDocument.skin.sprites.mount
  const backgroundUrl = gameDocument.skin.background_url ?? gameDocument.skin.sprites.sky

  const readout = (label: string, value: string, tone?: string) => (
    <span className={cn('lf-caption inline-flex items-center gap-1', tone ?? 'text-content-muted')}>
      <span className="sr-only">{label}</span>
      <span aria-hidden="true">{value}</span>
    </span>
  )

  const controlClass = cn(
    'lf-label inline-flex items-center justify-center gap-1 rounded-full border border-outline px-4 py-2',
    'bg-surface/60 text-content transition-colors duration-200',
    'hover:border-primary hover:text-primary',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
    'disabled:pointer-events-none disabled:opacity-50',
    HIT_TARGET_CLASS,
  )

  return (
    <div className="flex h-full w-full flex-col gap-2">
      {/* Chrome: closed DESIGN tokens, never canvas art. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="lf-caption shrink-0 text-content-muted">{t('games.flyer.hud.energy')}</span>
          <span
            className="h-2 min-w-24 flex-1 overflow-hidden rounded-full bg-surface-strong"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(energyPct)}
            aria-label={t('games.flyer.hud.energy')}
          >
            <span
              className={cn(
                'block h-full rounded-full',
                lowEnergy ? 'bg-warning' : 'bg-primary',
                !reducedMotion && 'transition-[width] duration-200',
              )}
              style={{ width: `${Math.max(0, Math.min(100, energyPct))}%` }}
            />
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {readout(t('games.flyer.hud.hull'), `${Math.round(hullPct)}%`)}
          {readout(t('games.flyer.hud.speed'), `${Math.round(flyer.speed * 10) / 10}`)}
          {flyer.stalled && (
            <span className="lf-caption text-warning">{t('games.flyer.status.stall')}</span>
          )}
          {inThermal && (
            <span className="lf-caption text-success">{t('games.flyer.status.thermal')}</span>
          )}
          {inStorm && (
            <span className="lf-caption text-content-muted">{t('games.flyer.status.storm')}</span>
          )}
        </div>
      </div>

      {/* The canvas. */}
      <div
        ref={stage.ref}
        style={stage.containerStyle}
        className="relative flex min-h-0 flex-1 items-center justify-center"
      >
        <div style={stage.stageStyle} className={cn('relative overflow-hidden rounded-lg', palette.sky)}>
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
              width: `${world.width}px`,
              height: `${world.height}px`,
              transform: `scale(${stage.scale})`,
            }}
          >
            {/* Ground band and ceiling line: the two altitudes that hurt. */}
            <div
              className={cn('absolute left-0 w-full', palette.ground)}
              style={{
                top: `${world.floor_y}px`,
                height: `${Math.max(0, world.height - world.floor_y)}px`,
              }}
            />
            <div
              className={cn('absolute left-0 w-full opacity-40', palette.ground)}
              style={{ top: 0, height: `${world.ceiling_y}px` }}
            />

            {visible.map((entity) => {
              const item = entity.itemId === null ? undefined : itemsById.get(entity.itemId)
              const boss = entity.enemyTypeId !== null && bossIds.has(entity.enemyTypeId)
              const url = gameDocument.skin.sprites[spriteSlotFor(entity, item, boss)]
              const zone = entity.role === 'thermal' || entity.role === 'storm'
              // The lane-like yaw is drawn as a DEPTH offset (§13): entities in another
              // lane sit slightly aside and dimmed, so "not in your lane" is visible
              // rather than something the child has to infer from a collision.
              const depth = config.lanes.enabled
                ? entity.lane * config.lanes.spacing_units - laneOffset
                : 0
              const offLane =
                config.lanes.enabled && Math.abs(entity.lane - flyer.lanePos) > config.lanes.hit_band
              return (
                <div
                  key={entity.key}
                  className="absolute"
                  style={{
                    left: `${entity.x - flyer.distance}px`,
                    top: `${entity.y + depth * 0.12}px`,
                    width: `${entity.w}px`,
                    height: `${entity.h}px`,
                    opacity: offLane ? 0.45 : 1,
                  }}
                >
                  <div
                    className={cn(
                      'h-full w-full',
                      zone ? 'rounded-xl border-2 border-dashed opacity-70' : '',
                      entity.role === 'good' && cn('rounded-full border-2', palette.highlight, palette.accentBorder),
                      entity.role === 'bad' && cn('rounded-full border-2', palette.ground, palette.accentBorder),
                      entity.role === 'obstacle' && cn('rounded-sm', palette.hazard),
                      entity.role === 'enemy' && cn('rounded-lg border-2', palette.accent, palette.accentBorder),
                      entity.role === 'thermal' && palette.accentBorder,
                      entity.role === 'storm' && cn(palette.ground, palette.accentBorder),
                      entity.role === 'good' && !reducedMotion && 'shadow-glass-sm',
                    )}
                  >
                    <CanvasArt url={url} icon={item?.icon ?? iconFor(entity)} size={Math.min(entity.w, entity.h)} />
                  </div>
                  {item !== undefined && !zone && (
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

            {/* Shots. Both directions read their own declared slot, so a bound sprite
                actually renders — a declared slot the view never looks up would be a
                silent no-op, which is exactly what the schema's slot rule prevents. */}
            {flyer.shots.map((shot) => (
              <div
                key={shot.key}
                className={cn(
                  'absolute rounded-full',
                  shot.fromMount ? palette.highlight : palette.hazard,
                )}
                style={{
                  left: `${shot.x - flyer.distance}px`,
                  top: `${shot.y}px`,
                  width: `${shot.w}px`,
                  height: `${shot.h}px`,
                }}
              >
                <CanvasArt
                  url={gameDocument.skin.sprites[shot.fromMount ? 'projectile' : 'enemy_projectile']}
                  icon={undefined}
                  size={Math.min(shot.w, shot.h)}
                />
              </div>
            ))}

            {/* The beam: a continuous attack, drawn as the box it actually damages. */}
            {flyer.beamOn && config.armament.beam.enabled && (
              <div
                className={cn(
                  'absolute overflow-hidden rounded-full opacity-70',
                  palette.highlight,
                  !reducedMotion && 'animate-pulse',
                )}
                style={{
                  left: `${beam.x - flyer.distance}px`,
                  top: `${beam.y}px`,
                  width: `${beam.w}px`,
                  height: `${beam.h}px`,
                }}
              >
                <CanvasArt url={gameDocument.skin.sprites.beam} icon={undefined} size={beam.h} />
              </div>
            )}

            {/* The mount. */}
            <div
              className={cn('absolute', !reducedMotion && 'transition-transform duration-75 ease-out')}
              style={{
                left: `${mountX}px`,
                top: `${flyer.altitude}px`,
                width: `${world.mount_w}px`,
                height: `${world.mount_h}px`,
                transform: `rotate(${-Math.round(flyer.pitch)}deg)`,
              }}
            >
              <div
                className={cn(
                  'h-full w-full rounded-md border-2',
                  palette.highlight,
                  palette.accentBorder,
                  flyer.tick < flyer.graceUntil && 'opacity-60',
                )}
              >
                <CanvasArt
                  url={mountSprite}
                  icon={flyer.stalled ? 'warning' : 'paragliding'}
                  size={Math.min(world.mount_w, world.mount_h)}
                />
              </div>
            </div>
          </div>

          {/* Storm visibility: a scrim, never a change to the simulation (§10). */}
          {inStorm && (
            <div
              className="pointer-events-none absolute inset-0 z-10 bg-inverse"
              style={{ opacity: Math.max(0, Math.min(0.85, 1 - config.environment.storm.visibility_pct / 100)) }}
            />
          )}

          {/* The two tap zones. Real <button>s, so keyboard and screen readers get them
              for free, and they double as the drag path's drop zones. */}
          <button
            type="button"
            disabled={locked}
            aria-label={t('games.flyer.action.climb')}
            className={cn(
              'absolute inset-x-0 top-0 z-20 h-1/2 w-full cursor-pointer',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px]',
              tap.selected !== null && 'bg-primary/10',
              HIT_TARGET_CLASS,
            )}
            {...tap.zoneProps(ZONE_CLIMB)}
            onClick={() => onZone(ZONE_CLIMB)}
          />
          <button
            type="button"
            disabled={locked}
            aria-label={t('games.flyer.action.dive')}
            className={cn(
              'absolute inset-x-0 bottom-0 z-20 h-1/2 w-full cursor-pointer',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px]',
              tap.selected !== null && 'bg-primary/10',
              HIT_TARGET_CLASS,
            )}
            {...tap.zoneProps(ZONE_DIVE)}
            onClick={() => onZone(ZONE_DIVE)}
          />

          {flyer.commands === 0 && !snapshot.finished && (
            <p
              className={cn(
                'lf-caption pointer-events-none absolute left-4 top-4 z-30 max-w-[70%]',
                palette.inkMuted,
              )}
            >
              {t('games.flyer.hint.intro')}
            </p>
          )}
          {lowEnergy && !snapshot.finished && (
            <p
              className={cn(
                'lf-caption pointer-events-none absolute bottom-4 right-4 z-30 max-w-[70%] text-right',
                palette.inkMuted,
              )}
            >
              {t('games.flyer.hint.energy')}
            </p>
          )}
          {paused && (
            <p className={cn('lf-label pointer-events-none absolute bottom-4 left-4 z-30', palette.inkMuted)}>
              {t('games.flyer.pausedLabel')}
            </p>
          )}
          <span className="sr-only">{t('games.flyer.stageLabel')}</span>
        </div>
      </div>

      {/* Controls. Every one of them is tappable on its own; the handle adds the drag
          path on top, and never replaces a button. */}
      <div className="flex flex-wrap items-center justify-center gap-2 px-1">
        <button
          type="button"
          className={controlClass}
          disabled={locked}
          onClick={() => act(ZONE_CLIMB)}
        >
          <Icon name="arrow_upward" />
          {t('games.flyer.action.climb')}
        </button>
        <button type="button" className={controlClass} disabled={locked} onClick={() => act(ZONE_DIVE)}>
          <Icon name="arrow_downward" />
          {t('games.flyer.action.dive')}
        </button>
        {config.armament.projectile.enabled && (
          <button
            type="button"
            className={controlClass}
            disabled={locked || flyer.shotCooldown > 0}
            onClick={() => act('fire')}
          >
            <Icon name="bolt" />
            {t('games.flyer.action.fire')}
          </button>
        )}
        {config.armament.beam.enabled && (
          <button
            type="button"
            className={controlClass}
            disabled={locked}
            aria-pressed={flyer.beamOn}
            onClick={() => act(flyer.beamOn ? 'beam_end' : 'beam_start')}
          >
            <Icon name="waves" />
            {t('games.flyer.action.beam')}
          </button>
        )}
        {config.lanes.enabled && config.lanes.count > 1 && (
          <button type="button" className={controlClass} disabled={locked} onClick={() => act('lane')}>
            <Icon name="swap_horiz" />
            {t('games.flyer.action.lane')}
          </button>
        )}
        <button
          type="button"
          className={cn(controlClass, tap.isSelected(STEER_HANDLE) && 'border-primary text-primary')}
          aria-label={t('games.flyer.action.steer')}
          {...drag.dragHandleProps(STEER_HANDLE)}
          {...tap.itemProps(STEER_HANDLE)}
        >
          <Icon name="drag_pan" />
          {t('games.flyer.action.steer')}
        </button>
      </div>
    </div>
  )
}
