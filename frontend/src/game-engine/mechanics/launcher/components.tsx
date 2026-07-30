// `launcher` — the renderer (GAME_ENGINE.md §7, §10; /DESIGN.md "Game visuals").
//
// A RENDERER, not a simulator: it reads `state`/`snapshot` and calls `emit`. It never
// scores, never advances a tick and never reads the wall clock — that split is what lets
// Core replay the same mechanic without React.
//
// TWO INPUT PATHS, BOTH COMPLETE (§1.11, non-negotiable):
//  - the slingshot: pull back anywhere on the field and release (core/input.ts's
//    `useGameDrag`, native Pointer Events, no drag library);
//  - the power bar + angle wheel: four 44px steppers and a Launch button, plus the tap
//    path from core/input.ts's `useTapPlacement` for loading ammo into the cradle.
// Drag is PROGRESSIVE ENHANCEMENT. Every shot a child can fire by dragging, they can
// fire by tapping, and every control is keyboard-reachable because every control is a
// real `<button>`.
//
// Scaling goes through `core/stage.ts` rather than a bespoke transform: the simulation
// runs in fixed design units and the stage maps them onto whatever viewport the child
// has, so 375px and 1280px are the same game, letterboxed, never re-laid-out.
//
// Canvas-vs-chrome (/DESIGN.md, NON-NEGOTIABLE): inside the stage rectangle we draw
// Prism sprites and palette-tinted shapes; outside it everything is closed DESIGN tokens
// and kit components. There is no raw hex in this file and no arcade font import — v1
// shipped six games with six Google Fonts; arcade character here comes from weight, size
// and motion, in Figtree, at the `lf-*` scale.

import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, Icon } from '@/components/ui'
import { datan2, dhypot } from '@/game-engine/core/mathd'
import { HIT_TARGET_CLASS, useGameDrag, useTapPlacement } from '@/game-engine/core/input'
import { useStageScale } from '@/game-engine/core/stage'
import type { GameItem, GamePaletteId, MechanicViewProps } from '@/game-engine/core/types'
import { cn } from '@/lib/utils'

import {
  activeProjectile,
  muzzlePoint,
  previewPath,
  quantizeAngle,
  quantizePower,
  targetRect,
  type LauncherState,
} from './simulate'

/** The field's drop-zone id: releasing a pull-back anywhere over the canvas fires. */
export const LAUNCHER_FIELD_ZONE = 'launcher:field'
/** The cradle's drop-zone id: where ammo is loaded, by drag OR by a second tap. */
export const LAUNCHER_CRADLE_ZONE = 'launcher:cradle'

/**
 * The six closed palettes, resolved to DESIGN tokens. Palette tokens are THEME-STABLE by
 * rule: no `-soft` token appears here, because those invert between light and dark while
 * the stage does not, and the readability of a simulation must not change when a child
 * flips the theme.
 */
interface LauncherPaletteClasses {
  sky: string
  ground: string
  rig: string
  correct: string
  incorrect: string
  obstacle: string
  shot: string
  ink: string
  inkMuted: string
}

const PALETTES: Record<GamePaletteId, LauncherPaletteClasses> = {
  'navy-papaya': {
    sky: 'bg-inverse',
    ground: 'bg-inverse-surface',
    rig: 'bg-accent',
    correct: 'bg-delight',
    incorrect: 'bg-inverse-surface',
    obstacle: 'bg-on-inverse-muted',
    shot: 'bg-accent',
    ink: 'text-on-inverse',
    inkMuted: 'text-on-inverse-muted',
  },
  'forest-pear': {
    sky: 'bg-success-strong',
    ground: 'bg-success',
    rig: 'bg-delight',
    correct: 'bg-warning',
    incorrect: 'bg-success',
    obstacle: 'bg-on-success',
    shot: 'bg-delight',
    ink: 'text-on-success',
    inkMuted: 'text-on-success',
  },
  'ocean-blue': {
    sky: 'bg-inverse-surface',
    ground: 'bg-inverse',
    rig: 'bg-accent',
    correct: 'bg-delight',
    incorrect: 'bg-inverse',
    obstacle: 'bg-on-inverse-muted',
    shot: 'bg-accent',
    ink: 'text-on-inverse',
    inkMuted: 'text-on-inverse-muted',
  },
  'sunset-papaya': {
    sky: 'bg-accent-strong',
    ground: 'bg-accent',
    rig: 'bg-inverse',
    correct: 'bg-delight',
    incorrect: 'bg-accent',
    obstacle: 'bg-inverse',
    shot: 'bg-inverse',
    ink: 'text-on-accent',
    inkMuted: 'text-on-accent',
  },
  'violet-night': {
    sky: 'bg-inverse',
    ground: 'bg-inverse-surface',
    rig: 'bg-primary-strong',
    correct: 'bg-delight',
    incorrect: 'bg-inverse-surface',
    obstacle: 'bg-on-inverse-muted',
    shot: 'bg-primary-strong',
    ink: 'text-on-inverse',
    inkMuted: 'text-on-inverse-muted',
  },
  'sand-clay': {
    sky: 'bg-warning-strong',
    ground: 'bg-warning',
    rig: 'bg-inverse',
    correct: 'bg-delight',
    incorrect: 'bg-warning',
    obstacle: 'bg-inverse',
    shot: 'bg-inverse',
    ink: 'text-on-warning',
    inkMuted: 'text-on-warning',
  },
}

interface CanvasArtProps {
  url: string | undefined
  icon: string | undefined
  /** Design-px box the art fills; drives the icon's optical size. */
  size: number
}

/**
 * Sprite when the manifest bound one, the element's Material Symbols glyph when it did
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
        style={{ fontSize: `${Math.max(12, Math.round(size * 0.55))}px` }}
      >
        <Icon name={icon} />
      </span>
    )
  }
  return null
}

/** Keyboard shortcuts are an ADDITION to tap, never a replacement (§10). */
const FIRE_KEYS = new Set([' ', 'Spacebar', 'Enter'])

export function LauncherView({
  document: gameDocument,
  state,
  snapshot,
  emit,
  paused,
  reducedMotion,
}: MechanicViewProps) {
  const { t } = useTranslation()
  // The slice owns its own state shape; core hands it back erased (§7).
  const launcher = state as LauncherState
  const config = launcher.config
  const palette = PALETTES[gameDocument.skin.palette]
  const sprites = gameDocument.skin.sprites
  const locked = paused || snapshot.finished

  const stage = useStageScale({
    designWidth: config.world.width,
    designHeight: config.world.height,
    mode: 'contain',
    maxScale: 2,
    safeArea: false,
  })

  const itemsById = useMemo(() => {
    const map = new Map<string, GameItem>()
    for (const item of gameDocument.content.items) map.set(item.id, item)
    return map
  }, [gameDocument.content.items])

  // The manifest offers the aid; the child may always decline it
  // (`adaptive.assist_toggleable` is a literal `true` by schema).
  const preview = config.aim.trajectory_preview
  const [assistOn, setAssistOn] = useState(preview.enabled)

  /** The live pull-back, in design space. Null unless a drag is in flight. */
  const [pull, setPull] = useState<{ angle: number; power: number } | null>(null)
  const pullRef = useRef<{ angle: number; power: number } | null>(null)

  const angle = pull?.angle ?? launcher.angle
  const power = pull?.power ?? launcher.power
  const ammo = activeProjectile(launcher)
  const muzzle = muzzlePoint(launcher)

  const readPull = useCallback(
    (clientX: number, clientY: number): { angle: number; power: number } => {
      const point = stage.toDesign(clientX, clientY)
      // Slingshot: the shot leaves along the vector from the pointer BACK to the muzzle,
      // so pulling down-left launches up-right. Screen y grows down, hence the flip.
      const dx = muzzle.x - point.x
      const dyUp = point.y - muzzle.y
      const distance = dhypot(dx, dyUp)
      const rawPower = (distance / config.launcher.pull_max_units) * 100
      return {
        angle: quantizeAngle(config, datan2(dyUp, dx)),
        power: quantizePower(config, rawPower),
      }
    },
    [config, muzzle.x, muzzle.y, stage],
  )

  const drag = useGameDrag({
    disabled: locked,
    onMove: (gesture) => {
      const next = readPull(gesture.x, gesture.y)
      pullRef.current = next
      setPull(next)
    },
    onDrop: () => {
      const released = pullRef.current
      pullRef.current = null
      setPull(null)
      if (released === null) return
      // ONE event per shot: the release carries its own aim, so a slingshot never
      // floods the input log with a stream of intermediate aim updates.
      emit('launch', { x: released.angle, y: released.power })
    },
  })

  const loadAmmo = useCallback(
    (itemId: string, zoneId: string) => {
      if (zoneId !== LAUNCHER_CRADLE_ZONE) return
      emit('select', { slot: itemId })
    },
    [emit],
  )
  const ammoDrag = useGameDrag({ onDrop: loadAmmo, disabled: locked })
  const ammoTap = useTapPlacement({ onPlace: loadAmmo, disabled: locked })

  const nudgeAngle = useCallback(
    (delta: number) => {
      emit('aim', { x: quantizeAngle(config, launcher.angle + delta), y: launcher.power })
    },
    [config, emit, launcher.angle, launcher.power],
  )
  const nudgePower = useCallback(
    (delta: number) => {
      emit('aim', { x: launcher.angle, y: quantizePower(config, launcher.power + delta) })
    },
    [config, emit, launcher.angle, launcher.power],
  )
  const fire = useCallback(() => {
    if (locked) return
    emit('launch')
  }, [emit, locked])

  const inFlight = launcher.projectiles.length > 0
  const canFire = !locked && !inFlight && launcher.cooldownLeft <= 0 && launcher.shotsLeft > 0
  const guidedLive = launcher.projectiles.some((projectile) => projectile.guidedLeft > 0)

  const previewDots = useMemo(
    () =>
      assistOn && preview.enabled && !inFlight
        ? previewPath(launcher, angle, power, preview.dots, preview.tick_step)
        : [],
    [angle, assistOn, inFlight, launcher, power, preview],
  )

  // Text drawn inside the canvas is Figtree at the lf-* scale; the inverse scale keeps
  // it legible at 375px instead of shrinking with the letterbox.
  const labelScale = stage.scale > 0 ? 1 / stage.scale : 1
  const armLength = Math.round(Math.max(config.launcher.w, config.launcher.h) * 0.9)

  const ammoSlotFor = (index: number): string => {
    const projectile = config.projectiles[index]
    if (projectile === undefined) return 'projectile'
    if (projectile.image_slot !== undefined) return projectile.image_slot
    return projectile.kind === 'standard' ? 'projectile' : `projectile_${projectile.kind}`
  }

  return (
    <div className="flex h-full w-full min-h-0 flex-col gap-3">
      <div
        ref={stage.ref}
        style={stage.containerStyle}
        className="relative flex min-h-0 flex-1 items-center justify-center"
      >
        <div
          data-dropzone={LAUNCHER_FIELD_ZONE}
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

          <div
            className="absolute left-0 top-0 origin-top-left"
            style={{
              width: `${config.world.width}px`,
              height: `${config.world.height}px`,
              transform: `scale(${stage.scale})`,
            }}
          >
            {/* Ground band */}
            <div
              className={cn('absolute left-0 w-full', palette.ground)}
              style={{
                top: `${config.world.ground_y}px`,
                height: `${Math.max(0, config.world.height - config.world.ground_y)}px`,
              }}
            >
              <CanvasArt url={sprites.ground} icon={undefined} size={0} />
            </div>

            {/* Obstacles */}
            {launcher.obstacles.map((obstacle) => (
              <div
                key={obstacle.key}
                className={cn(
                  'absolute rounded-sm',
                  palette.obstacle,
                  obstacle.material === 'deflect' && 'border-2 border-dashed',
                )}
                style={{
                  left: `${obstacle.x}px`,
                  top: `${obstacle.y}px`,
                  width: `${obstacle.w}px`,
                  height: `${obstacle.h}px`,
                }}
              >
                <CanvasArt
                  url={
                    sprites[
                      obstacle.imageSlot ??
                        (obstacle.material === 'breakable' ? 'obstacle_breakable' : 'obstacle')
                    ]
                  }
                  icon={obstacle.icon ?? undefined}
                  size={Math.min(obstacle.w, obstacle.h)}
                />
              </div>
            ))}

            {/* Targets */}
            {launcher.targets.map((target) => {
              const rect = targetRect(target, launcher.tick, launcher.draws)
              const item = target.itemId === null ? undefined : itemsById.get(target.itemId)
              const label = item?.label_md ?? target.id
              return (
                <div
                  key={target.key}
                  className="absolute"
                  style={{
                    left: `${rect.x}px`,
                    top: `${rect.y}px`,
                    width: `${rect.w}px`,
                    height: `${rect.h}px`,
                  }}
                >
                  <div
                    className={cn(
                      'h-full w-full border-2',
                      target.shape === 'circle' ? 'rounded-full' : 'rounded-md',
                      target.role === 'correct' ? palette.correct : palette.incorrect,
                      target.hp < target.maxHp && 'opacity-70',
                      target.role === 'correct' && !reducedMotion && 'shadow-glass-sm',
                    )}
                    title={t('games.launcher.targetLabel', { label })}
                  >
                    <CanvasArt
                      url={
                        sprites[
                          target.imageSlot ??
                            (target.role === 'correct' ? 'target_correct' : 'target_incorrect')
                        ]
                      }
                      icon={target.icon ?? item?.icon}
                      size={Math.min(rect.w, rect.h)}
                    />
                  </div>
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
                    {label}
                  </span>
                </div>
              )
            })}

            {/* Predictive trajectory — the tier-gated aid, re-run from the same physics */}
            {previewDots.map((dot, index) => (
              <span
                key={`dot-${index}`}
                aria-hidden="true"
                className={cn('absolute rounded-full opacity-60', palette.shot)}
                style={{
                  left: `${dot.x - 3}px`,
                  top: `${dot.y - 3}px`,
                  width: '6px',
                  height: '6px',
                }}
              />
            ))}

            {/* The rig: a fixed base plus an arm that points where the shot will go */}
            <div
              className="absolute"
              style={{
                left: `${launcher.launcherX}px`,
                top: `${launcher.launcherY}px`,
                width: `${config.launcher.w}px`,
                height: `${config.launcher.h}px`,
              }}
            >
              <div className={cn('h-full w-full rounded-md', palette.rig)}>
                <CanvasArt
                  url={sprites.launcher}
                  icon="rocket_launch"
                  size={Math.min(config.launcher.w, config.launcher.h)}
                />
              </div>
            </div>
            <div
              aria-hidden="true"
              className={cn('absolute origin-left rounded-full', palette.shot)}
              style={{
                left: `${muzzle.x}px`,
                top: `${muzzle.y - 3}px`,
                width: `${armLength}px`,
                height: '6px',
                transform: `rotate(${-angle}deg)`,
              }}
            >
              <CanvasArt url={sprites.launcher_arm} icon={undefined} size={0} />
            </div>

            {/* Shots in flight */}
            {launcher.projectiles.map((projectile) => (
              <div
                key={projectile.key}
                className={cn('absolute rounded-full', palette.shot)}
                style={{
                  left: `${projectile.x - projectile.radius}px`,
                  top: `${projectile.y - projectile.radius}px`,
                  width: `${projectile.radius * 2}px`,
                  height: `${projectile.radius * 2}px`,
                }}
              >
                <CanvasArt
                  url={sprites[ammoSlotFor(launcher.ammoIndex)]}
                  icon={ammo?.icon}
                  size={projectile.radius * 2}
                />
              </div>
            ))}
          </div>

          {/* The whole field is the slingshot surface AND a tap-to-fire control. */}
          <button
            type="button"
            disabled={locked}
            aria-label={t('games.launcher.fieldLabel')}
            className={cn(
              'absolute inset-0 z-10 h-full w-full cursor-pointer',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px]',
              HIT_TARGET_CLASS,
            )}
            {...drag.dragHandleProps('aim')}
            onClick={fire}
            onKeyDown={(event) => {
              if (event.repeat || !FIRE_KEYS.has(event.key)) return
              event.preventDefault()
              fire()
            }}
          />

          <p
            className={cn(
              'lf-caption pointer-events-none absolute left-3 top-3 z-20 max-w-[70%]',
              palette.inkMuted,
            )}
          >
            {t('games.launcher.shots', { count: launcher.shotsLeft })}
            {launcher.shotsFired === 0 ? ` · ${t('games.launcher.hint')}` : ''}
          </p>

          {paused && (
            <p
              className={cn(
                'lf-label pointer-events-none absolute bottom-3 left-3 z-20',
                palette.inkMuted,
              )}
            >
              {t('games.launcher.pausedLabel')}
            </p>
          )}

          <span className="sr-only">{t('games.launcher.stageLabel')}</span>
        </div>
      </div>

      {/* Chrome: the angle wheel + power bar + the ONE papaya CTA (Action Color
          Contract). Wraps to one thumb-reachable row on mobile and spreads across the
          freed width on desktop. */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          variant="secondary"
          className="px-4 py-2"
          aria-label={t('games.launcher.control.angleDown')}
          disabled={locked}
          onClick={() => nudgeAngle(-config.launcher.angle_step)}
        >
          <Icon name="rotate_right" />
        </Button>
        <span className="lf-label lf-number min-w-16 text-center text-content">
          {t('games.launcher.readout.angle', { angle: Math.round(angle) })}
        </span>
        <Button
          variant="secondary"
          className="px-4 py-2"
          aria-label={t('games.launcher.control.angleUp')}
          disabled={locked}
          onClick={() => nudgeAngle(config.launcher.angle_step)}
        >
          <Icon name="rotate_left" />
        </Button>

        <Button
          variant="secondary"
          className="px-4 py-2"
          aria-label={t('games.launcher.control.powerDown')}
          disabled={locked}
          onClick={() => nudgePower(-config.launcher.power_step)}
        >
          <Icon name="remove" />
        </Button>
        <span
          className="h-3 w-24 overflow-hidden rounded-full bg-surface-sunken"
          role="img"
          aria-label={t('games.launcher.readout.power', { power: Math.round(power) })}
        >
          <span
            className={cn('block h-full rounded-full bg-accent', !reducedMotion && 'transition-[width] duration-150')}
            style={{ width: `${Math.max(0, Math.min(100, power))}%` }}
          />
        </span>
        <Button
          variant="secondary"
          className="px-4 py-2"
          aria-label={t('games.launcher.control.powerUp')}
          disabled={locked}
          onClick={() => nudgePower(config.launcher.power_step)}
        >
          <Icon name="add" />
        </Button>

        <Button
          variant="primary"
          className="px-6 py-2"
          aria-label={t('games.launcher.control.fire')}
          disabled={!canFire}
          onClick={fire}
        >
          <Icon name="rocket_launch" />
          <span>{t('games.launcher.control.fire')}</span>
        </Button>
      </div>

      {(config.launcher.move.axis !== 'none' ||
        config.projectiles.length > 1 ||
        guidedLive ||
        preview.enabled) && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {config.launcher.move.axis !== 'none' && (
            <>
              <Button
                variant="secondary"
                className="px-4 py-2"
                aria-label={t('games.launcher.control.moveBack')}
                disabled={locked}
                onClick={() => emit('move', { n: -1 })}
              >
                <Icon name="arrow_back" />
              </Button>
              <Button
                variant="secondary"
                className="px-4 py-2"
                aria-label={t('games.launcher.control.moveForward')}
                disabled={locked}
                onClick={() => emit('move', { n: 1 })}
              >
                <Icon name="arrow_forward" />
              </Button>
            </>
          )}

          {guidedLive && (
            <>
              <Button
                variant="secondary"
                className="px-4 py-2"
                aria-label={t('games.launcher.control.nudgeLeft')}
                disabled={locked}
                onClick={() => emit('nudge', { n: -1 })}
              >
                <Icon name="west" />
              </Button>
              <Button
                variant="secondary"
                className="px-4 py-2"
                aria-label={t('games.launcher.control.nudgeRight')}
                disabled={locked}
                onClick={() => emit('nudge', { n: 1 })}
              >
                <Icon name="east" />
              </Button>
            </>
          )}

          {config.projectiles.length > 1 && (
            <>
              {/* The cradle is BOTH a pointer drop zone and a tap target, so loading
                  ammo never requires a drag (§10). */}
              <button
                type="button"
                aria-label={t('games.launcher.cradleLabel')}
                className={cn(
                  'flex items-center gap-2 rounded-lg border-2 border-dashed border-outline px-3 py-2 text-content',
                  HIT_TARGET_CLASS,
                  ammoTap.selected !== null && 'border-accent',
                )}
                {...ammoTap.zoneProps(LAUNCHER_CRADLE_ZONE)}
              >
                <Icon name="input" />
                <span className="lf-caption">{t('games.launcher.cradleLabel')}</span>
              </button>
              {config.projectiles.map((projectile, index) => {
                const item =
                  projectile.item_ref === undefined ? undefined : itemsById.get(projectile.item_ref)
                const label = item?.label_md ?? projectile.id
                const handleProps = ammoDrag.dragHandleProps(projectile.id)
                return (
                  <button
                    key={projectile.id}
                    type="button"
                    aria-label={t('games.launcher.ammoLabel', { label })}
                    {...ammoTap.itemProps(projectile.id)}
                    {...handleProps}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border border-outline bg-surface px-3 py-2 text-content',
                      HIT_TARGET_CLASS,
                      index === launcher.ammoIndex && 'border-accent ring-2 ring-accent',
                      ammoTap.isSelected(projectile.id) && 'ring-2 ring-primary',
                    )}
                    style={handleProps.style}
                  >
                    <Icon name={projectile.icon ?? 'sports_baseball'} />
                    <span className="lf-caption">{label}</span>
                  </button>
                )
              })}
            </>
          )}

          {preview.enabled && (
            <Button
              variant="secondary"
              className="px-4 py-2"
              aria-label={t(assistOn ? 'games.launcher.assist.off' : 'games.launcher.assist.on')}
              onClick={() => setAssistOn((current) => !current)}
            >
              <Icon name={assistOn ? 'visibility_off' : 'visibility'} />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
