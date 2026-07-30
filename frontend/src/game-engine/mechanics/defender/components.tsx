// `defender` — the renderer (GAME_ENGINE.md §7, §10; /DESIGN.md "Game visuals").
//
// A RENDERER, not a simulator: it reads `state`/`snapshot` and calls `emit`. It never
// scores, never advances a tick and never reads the wall clock — that split is what lets
// Core replay the same mechanic without React.
//
// Canvas-vs-chrome (NON-NEGOTIABLE): inside the board we draw Prism sprites and
// palette-tinted shapes; outside it everything is closed DESIGN tokens, the `lf-*` type
// scale and Material Symbols. There is no raw hex in this file and no arcade font import
// — arcade character comes from weight, size and motion, in Figtree.
//
// INPUT (/CLAUDE.md §1.11). Every cell is BOTH a `data-dropzone` (so a build can be
// dragged from the palette, via core/input.ts) and a real `<button>` (so it can be
// tapped, and so keyboard and screen readers get it for free). Tap is the guaranteed
// path and drag is the enhancement: mobile has no hover, and a touch drag is not
// available to every child. Tapping a cell with nothing selected INSPECTS what is on it,
// which is how selling, upgrading and re-prioritising are reached without a hover menu.
//
// SCALE FLOOR — the one place this view adds to `core/stage.ts` rather than just using
// it. The stage hook still measures and letterboxes the board, but a 14-column grid
// letterboxed into a 375px viewport would give ~26px cells, and §1.11 puts a hard 44px
// floor under every control INCLUDING in-canvas ones. So the measured scale is floored at
// `44 / cell_size` and the board sits in its own `overflow-auto` container: on a phone the
// child pans a board whose squares are always thumb-sized, and on a desktop the floor is
// never reached and the whole board is visible at once.

import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Icon } from '@/components/ui'
import { HIT_TARGET_CLASS, useGameDrag, useTapPlacement } from '@/game-engine/core/input'
import { useStageScale } from '@/game-engine/core/stage'
import type { GameItem, GamePaletteId, MechanicViewProps } from '@/game-engine/core/types'
import { cn } from '@/lib/utils'

import { DEFENDER_PRIORITIES, type DefenderPriority } from './schema'
import {
  cellCol,
  cellIndex,
  cellRow,
  enemyPosition,
  TERRAIN_ENTRY,
  TERRAIN_EXIT,
  TERRAIN_OPEN,
  TERRAIN_ROAD,
  TERRAIN_ROCK,
  type DefenderEnemy,
  type DefenderState,
  type DefenderTower,
} from './simulate'

/** §1.11's hard floor, in CSS px, applied to a single grid square. */
const MIN_CELL_PX = 44

/** Palette ids. Namespaced with a prefix so a generated tower id can never collide with
 *  the wall entry or with a cell zone id. */
const WALL_PALETTE_ID = 'wall'
const TOWER_PREFIX = 'tower:'
const ABILITY_PREFIX = 'ability:'
const CELL_PREFIX = 'cell:'

/** Milli-cell resolution shared with the simulator: 1000 units = one cell. */
const CELL_MILLI = 1000

interface DefenderPaletteClasses {
  /** The board's backdrop, behind every cell. */
  stage: string
  /** Buildable ground. */
  open: string
  /** Terrain: neither walkable nor buildable. */
  rock: string
  /** The fixed route. */
  road: string
  entry: string
  base: string
  tower: string
  wall: string
  enemy: string
  enemyAir: string
  ink: string
  inkMuted: string
  ring: string
}

/**
 * The six CLOSED palettes, resolved to DESIGN.md semantic tokens — never a raw hex.
 * Board tokens are theme-stable on purpose: the readability of a simulation must not
 * change when a child flips between light and dark.
 */
const PALETTES: Record<GamePaletteId, DefenderPaletteClasses> = {
  'navy-papaya': {
    stage: 'bg-inverse',
    open: 'bg-inverse-surface',
    rock: 'bg-inverse',
    road: 'bg-primary-strong',
    entry: 'bg-warning-strong',
    base: 'bg-accent',
    tower: 'bg-accent text-on-accent',
    wall: 'bg-on-inverse-muted',
    enemy: 'bg-delight',
    enemyAir: 'bg-warning',
    ink: 'text-on-inverse',
    inkMuted: 'text-on-inverse-muted',
    ring: 'ring-accent',
  },
  'forest-pear': {
    stage: 'bg-success-strong',
    open: 'bg-success',
    rock: 'bg-success-strong',
    road: 'bg-warning',
    entry: 'bg-warning-strong',
    base: 'bg-delight',
    tower: 'bg-delight text-content',
    wall: 'bg-inverse-surface',
    enemy: 'bg-accent',
    enemyAir: 'bg-warning-strong',
    ink: 'text-on-success',
    inkMuted: 'text-on-success',
    ring: 'ring-delight',
  },
  'ocean-blue': {
    stage: 'bg-inverse-surface',
    open: 'bg-inverse',
    rock: 'bg-inverse-surface',
    road: 'bg-primary-strong',
    entry: 'bg-warning',
    base: 'bg-accent',
    tower: 'bg-accent text-on-accent',
    wall: 'bg-on-inverse-muted',
    enemy: 'bg-delight',
    enemyAir: 'bg-warning-strong',
    ink: 'text-on-inverse',
    inkMuted: 'text-on-inverse-muted',
    ring: 'ring-primary',
  },
  'sunset-papaya': {
    stage: 'bg-accent-strong',
    open: 'bg-accent',
    rock: 'bg-accent-strong',
    road: 'bg-inverse-surface',
    entry: 'bg-warning-strong',
    base: 'bg-delight',
    tower: 'bg-inverse text-on-inverse',
    wall: 'bg-inverse-surface',
    enemy: 'bg-delight',
    enemyAir: 'bg-warning',
    ink: 'text-on-accent',
    inkMuted: 'text-on-accent',
    ring: 'ring-inverse',
  },
  'violet-night': {
    stage: 'bg-inverse',
    open: 'bg-inverse-surface',
    rock: 'bg-inverse',
    road: 'bg-primary-strong',
    entry: 'bg-delight',
    base: 'bg-accent',
    tower: 'bg-primary-strong text-on-inverse',
    wall: 'bg-on-inverse-muted',
    enemy: 'bg-delight',
    enemyAir: 'bg-warning',
    ink: 'text-on-inverse',
    inkMuted: 'text-on-inverse-muted',
    ring: 'ring-delight',
  },
  'sand-clay': {
    stage: 'bg-warning-strong',
    open: 'bg-warning',
    rock: 'bg-warning-strong',
    road: 'bg-inverse-surface',
    entry: 'bg-accent-strong',
    base: 'bg-delight',
    tower: 'bg-inverse text-on-inverse',
    wall: 'bg-inverse-surface',
    enemy: 'bg-accent',
    enemyAir: 'bg-accent-strong',
    ink: 'text-on-warning',
    inkMuted: 'text-on-warning',
    ring: 'ring-inverse',
  },
}

interface CanvasArtProps {
  url: string | undefined
  icon: string | undefined
  /** CSS-px box the art fills; drives the glyph's optical size. */
  size: number
}

/**
 * Sprite when the manifest bound one, the item's Material Symbols glyph when it did not,
 * and the bare palette shape when it bound neither. A missing sprite is never a broken
 * image and never an empty rectangle — a document is fully playable before the
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
        style={{ fontSize: `${Math.max(11, Math.round(size * 0.58))}px` }}
      >
        <Icon name={icon} />
      </span>
    )
  }
  return null
}

export function DefenderView({
  document: gameDocument,
  state,
  snapshot,
  emit,
  paused,
  reducedMotion,
}: MechanicViewProps) {
  const { t } = useTranslation()
  // The slice owns its own state shape; core hands it back erased (§7).
  const defender = state as DefenderState
  const config = defender.config
  const palette = PALETTES[gameDocument.skin.palette]
  const sprites = gameDocument.skin.sprites
  const locked = paused || snapshot.finished

  /** The cell the player is inspecting — a local VIEW concern, never simulation state. */
  const [inspect, setInspect] = useState<number | null>(null)

  const designWidth = defender.cols * config.grid.cell_size
  const designHeight = defender.rows * config.grid.cell_size
  const stage = useStageScale({
    designWidth,
    designHeight,
    mode: 'contain',
    maxScale: 2,
    safeArea: false,
  })
  // See the SCALE FLOOR note at the top of this file.
  const scale = Math.max(stage.scale, MIN_CELL_PX / config.grid.cell_size)
  const cellPx = config.grid.cell_size * scale

  const itemsById = useMemo(() => {
    const map = new Map<string, GameItem>()
    for (const item of gameDocument.content.items) map.set(item.id, item)
    return map
  }, [gameDocument.content.items])

  const labelOf = useCallback(
    (itemId: string | undefined): string => {
      if (itemId === undefined) return ''
      return itemsById.get(itemId)?.label_md ?? itemId
    },
    [itemsById],
  )

  // ONE handler for BOTH input paths: the drag resolves the zone under the pointer and
  // the tap resolves the zone that was tapped, and they must produce the same event.
  const handlePlace = useCallback(
    (paletteId: string, zoneId: string) => {
      if (locked) return
      if (!zoneId.startsWith(CELL_PREFIX)) return
      const cell = Number.parseInt(zoneId.slice(CELL_PREFIX.length), 10)
      if (!Number.isInteger(cell)) return
      const x = cellCol(defender.cols, cell)
      const y = cellRow(defender.cols, cell)
      if (paletteId === WALL_PALETTE_ID) {
        emit('build_wall', { x, y })
        return
      }
      if (paletteId.startsWith(TOWER_PREFIX)) {
        emit('build_tower', { slot: paletteId.slice(TOWER_PREFIX.length), x, y })
        return
      }
      if (paletteId.startsWith(ABILITY_PREFIX)) {
        emit('ability', { slot: paletteId.slice(ABILITY_PREFIX.length), x, y })
      }
    },
    [defender.cols, emit, locked],
  )

  const drag = useGameDrag({ onDrop: handlePlace, disabled: locked })
  const tap = useTapPlacement({ onPlace: handlePlace, disabled: locked })

  const towerAtCell = useCallback(
    (cell: number): DefenderTower | undefined => {
      const uid = defender.towerAt[cell] ?? 0
      if (uid === 0) return undefined
      return defender.towers.find((tower) => tower.uid === uid)
    },
    [defender.towerAt, defender.towers],
  )

  const inspected = inspect === null ? undefined : towerAtCell(inspect)
  const inspectedType =
    inspected === undefined ? undefined : config.towers[inspected.typeIndex]

  const onCellClick = useCallback(
    (cell: number) => {
      if (tap.selected !== null) {
        tap.place(`${CELL_PREFIX}${cell}`)
        return
      }
      setInspect((current) => (current === cell ? null : cell))
    },
    [tap],
  )

  const terrainClass = (code: number): string => {
    if (code === TERRAIN_ROCK) return palette.rock
    if (code === TERRAIN_ROAD) return palette.road
    if (code === TERRAIN_ENTRY) return palette.entry
    if (code === TERRAIN_EXIT) return palette.base
    return palette.open
  }

  const terrainIcon = (code: number): string | undefined => {
    if (code === TERRAIN_ENTRY) return 'login'
    if (code === TERRAIN_EXIT) return 'savings'
    if (code === TERRAIN_ROCK) return undefined
    return undefined
  }

  const terrainSlot = (code: number): string | undefined => {
    if (code === TERRAIN_ENTRY) return 'entry'
    if (code === TERRAIN_EXIT) return 'exit'
    if (code === TERRAIN_ROCK) return 'terrain_rock'
    if (code === TERRAIN_ROAD) return 'terrain_road'
    return 'terrain_open'
  }

  const renderEnemy = (enemy: DefenderEnemy) => {
    const type = config.enemies[enemy.typeIndex]
    const item = type === undefined ? undefined : itemsById.get(type.item_id)
    const position = enemyPosition(defender, enemy)
    const size = cellPx * 0.66
    const hpPct = enemy.maxHp <= 0 ? 0 : Math.max(0, Math.min(100, (enemy.hp * 100) / enemy.maxHp))
    const slot = type?.sprite_slot
    return (
      <div
        key={enemy.uid}
        className="pointer-events-none absolute"
        style={{
          left: `${(position.x / CELL_MILLI) * cellPx - size / 2}px`,
          top: `${(position.y / CELL_MILLI) * cellPx - size / 2}px`,
          width: `${size}px`,
          height: `${size}px`,
        }}
      >
        <div
          className={cn(
            'h-full w-full border-2 border-outline',
            enemy.flying ? cn('rounded-full', palette.enemyAir) : cn('rounded-md', palette.enemy),
            // Decorative only — position still updates every tick with motion reduced.
            !reducedMotion && enemy.frozenLeft > 0 && 'opacity-70',
          )}
        >
          <CanvasArt
            url={slot === undefined ? undefined : sprites[slot]}
            icon={item?.icon}
            size={size}
          />
        </div>
        <div className="absolute -bottom-1 left-0 h-1 w-full overflow-hidden rounded-full bg-inverse-surface">
          <div className={cn('h-full', palette.base)} style={{ width: `${hpPct}%` }} />
        </div>
      </div>
    )
  }

  const renderCell = (cell: number) => {
    const col = cellCol(defender.cols, cell)
    const row = cellRow(defender.cols, cell)
    const code = defender.terrain[cell] ?? TERRAIN_ROCK
    const tower = towerAtCell(cell)
    const wallHp = defender.wallAt[cell] ?? 0
    const towerType = tower === undefined ? undefined : config.towers[tower.typeIndex]
    const towerItem = towerType === undefined ? undefined : itemsById.get(towerType.item_id)
    const zoneId = `${CELL_PREFIX}${cell}`
    const armed = tap.selected !== null || drag.drag !== null
    const targeted = drag.hoverZone === zoneId
    const buildable = code === TERRAIN_OPEN && tower === undefined && wallHp === 0
    const label =
      tower !== undefined
        ? t('games.defender.cell.tower', { label: labelOf(towerType?.item_id), col: col + 1, row: row + 1 })
        : t('games.defender.cell.empty', { col: col + 1, row: row + 1 })

    return (
      <button
        key={cell}
        type="button"
        aria-label={label}
        aria-pressed={inspect === cell}
        className={cn(
          'absolute border border-outline/30 p-0',
          terrainClass(code),
          palette.ink,
          armed && buildable && cn('ring-2 ring-inset', palette.ring),
          targeted && cn('ring-4 ring-inset', palette.ring),
          inspect === cell && cn('ring-2 ring-inset', palette.ring),
          !reducedMotion && 'transition-[box-shadow] duration-150',
        )}
        style={{
          left: `${col * cellPx}px`,
          top: `${row * cellPx}px`,
          width: `${cellPx}px`,
          height: `${cellPx}px`,
        }}
        {...tap.zoneProps(zoneId)}
        onClick={() => onCellClick(cell)}
      >
        {tower === undefined && wallHp === 0 && (
          <CanvasArt
            url={sprites[terrainSlot(code) ?? '']}
            icon={terrainIcon(code)}
            size={cellPx}
          />
        )}
        {wallHp > 0 && (
          <span className={cn('block h-full w-full rounded-sm', palette.wall)}>
            <CanvasArt url={sprites.wall} icon="fence" size={cellPx} />
          </span>
        )}
        {tower !== undefined && (
          <span className={cn('block h-full w-full rounded-sm', palette.tower)}>
            <CanvasArt
              url={towerType?.sprite_slot === undefined ? undefined : sprites[towerType.sprite_slot]}
              icon={towerItem?.icon}
              size={cellPx}
            />
          </span>
        )}
      </button>
    )
  }

  const cells: number[] = []
  for (let row = 0; row < defender.rows; row += 1) {
    for (let col = 0; col < defender.cols; col += 1) cells.push(cellIndex(defender.cols, col, row))
  }

  const secondary = config.economy.secondary
  const heats = config.heat ?? []
  const wallSelected = tap.isSelected(WALL_PALETTE_ID)

  const paletteButton = (
    id: string,
    label: string,
    icon: string,
    cost: number,
    currency: 'gold' | 'gems',
    affordable: boolean,
  ) => {
    const handleProps = drag.dragHandleProps(id)
    const itemProps = tap.itemProps(id)
    return (
      <button
        key={id}
        type="button"
        {...itemProps}
        {...handleProps}
        disabled={locked}
        className={cn(
          'flex flex-col items-center justify-center gap-0.5 rounded-lg border border-outline bg-surface px-3 py-2 text-content',
          HIT_TARGET_CLASS,
          tap.isSelected(id) && 'ring-2 ring-accent',
          !affordable && 'opacity-50',
          !reducedMotion && 'transition-[box-shadow] duration-150',
        )}
        style={handleProps.style}
      >
        <Icon name={icon} className="text-[1.25em] leading-none" />
        <span className="lf-caption leading-tight">{label}</span>
        <span className="lf-caption lf-number text-content-muted">
          {currency === 'gold'
            ? t('games.defender.costGold', { cost })
            : t('games.defender.costGems', { cost })}
        </span>
      </button>
    )
  }

  const nextPriority = (current: DefenderPriority): DefenderPriority => {
    const index = DEFENDER_PRIORITIES.indexOf(current)
    return DEFENDER_PRIORITIES[index + 1 >= DEFENDER_PRIORITIES.length ? 0 : index + 1] ?? 'first'
  }

  const upgradeBranch =
    inspected === undefined || inspectedType?.upgrades === undefined
      ? []
      : inspectedType.upgrades.filter(
          (branch) => inspected.branchId === null || inspected.branchId === branch.id,
        )

  return (
    <div className="flex h-full w-full min-h-0 flex-col gap-3">
      {/* Mechanic status. Score and lives belong to the player shell's HUD; what lives
          here is the economy the lesson is about. */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="lf-label lf-number rounded-full bg-surface-sunken px-3 py-1 text-content">
          <Icon name="paid" className="mr-1 text-[1em] leading-none" />
          {t('games.defender.gold', { gold: defender.gold })}
        </span>
        {secondary !== undefined && (
          <span className="lf-label lf-number rounded-full bg-surface-sunken px-3 py-1 text-content">
            <Icon name="diamond" className="mr-1 text-[1em] leading-none" />
            {t('games.defender.gems', { gems: defender.gems })}
          </span>
        )}
        <span className="lf-label lf-number rounded-full bg-surface-sunken px-3 py-1 text-content">
          {t('games.defender.wave', {
            current: Math.min(config.waves.length, defender.waveIndex + 1),
            total: config.waves.length,
          })}
        </span>
        {defender.phase === 'prep' && !snapshot.finished && (
          <button
            type="button"
            disabled={locked}
            onClick={() => emit('start_wave')}
            className={cn(
              'rounded-full border border-outline bg-surface px-4 py-1 text-content',
              'lf-label',
              HIT_TARGET_CLASS,
            )}
          >
            {t('games.defender.startWave')}
          </button>
        )}
      </div>

      {/* The board. Its own scroll container so the 44px cell floor never forces the
          page itself to scroll sideways. */}
      <div
        ref={stage.ref}
        style={stage.containerStyle}
        className="flex min-h-0 flex-1 items-center justify-center"
      >
        <div className="max-h-full max-w-full overflow-auto rounded-lg">
          <div
            className={cn('relative', palette.stage)}
            style={{ width: `${defender.cols * cellPx}px`, height: `${defender.rows * cellPx}px` }}
            aria-label={t('games.defender.gridLabel')}
          >
            {gameDocument.skin.background_url !== undefined && (
              <img
                src={gameDocument.skin.background_url}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
            {cells.map((cell) => renderCell(cell))}
            {inspected !== undefined && inspected.range > 0 && (
              <span
                aria-hidden="true"
                className={cn('pointer-events-none absolute rounded-full ring-2 ring-inset', palette.ring)}
                style={{
                  left: `${(cellCol(defender.cols, inspected.cell) + 0.5) * cellPx - (inspected.range / CELL_MILLI) * cellPx}px`,
                  top: `${(cellRow(defender.cols, inspected.cell) + 0.5) * cellPx - (inspected.range / CELL_MILLI) * cellPx}px`,
                  width: `${(inspected.range / CELL_MILLI) * cellPx * 2}px`,
                  height: `${(inspected.range / CELL_MILLI) * cellPx * 2}px`,
                }}
              />
            )}
            {defender.enemies.map((enemy) => renderEnemy(enemy))}
            {paused && (
              <p className={cn('lf-label pointer-events-none absolute bottom-2 left-2', palette.inkMuted)}>
                {t('games.defender.pausedLabel')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* The build palette. Tap one, then tap a square — or drag it onto a square. */}
      <div className="flex flex-wrap items-stretch justify-center gap-2">
        {config.towers.map((tower) =>
          paletteButton(
            `${TOWER_PREFIX}${tower.id}`,
            labelOf(tower.item_id),
            itemsById.get(tower.item_id)?.icon ?? 'shield',
            tower.cost,
            'gold',
            defender.gold >= tower.cost,
          ),
        )}
        {config.build.max_walls > 0 &&
          paletteButton(
            WALL_PALETTE_ID,
            t('games.defender.palette.wall'),
            'fence',
            config.build.wall_cost,
            'gold',
            defender.gold >= config.build.wall_cost && defender.wallsBuilt < config.build.max_walls,
          )}
        {(secondary?.abilities ?? []).map((ability) =>
          paletteButton(
            `${ABILITY_PREFIX}${ability.id}`,
            labelOf(ability.item_id) || t('games.defender.palette.ability'),
            itemsById.get(ability.item_id ?? '')?.icon ?? 'bolt',
            ability.cost,
            'gems',
            defender.gems >= ability.cost,
          ),
        )}
      </div>

      {/* Voluntary heat — offered only while it is still honest to offer it (before the
          first wave), and never imposed. */}
      {heats.length > 0 && defender.wavesStarted === 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="lf-caption text-content-muted">{t('games.defender.heatTitle')}</span>
          {heats.map((heat, index) => (
            <button
              key={heat.id}
              type="button"
              disabled={locked}
              aria-pressed={defender.heatIndex === index}
              onClick={() => emit('heat', { slot: heat.id })}
              className={cn(
                'lf-caption rounded-full border border-outline bg-surface px-3 py-1 text-content',
                HIT_TARGET_CLASS,
                defender.heatIndex === index && 'ring-2 ring-accent',
              )}
            >
              {t('games.defender.heatOption', {
                label: labelOf(heat.item_id),
                multiplier: heat.score_multiplier_pct,
              })}
            </button>
          ))}
        </div>
      )}

      {/* The inspect panel: sell, upgrade, re-prioritise. Reached by TAPPING a tower —
          never by hovering it, because mobile has no hover. */}
      {inspected !== undefined && (
        <div className="flex flex-wrap items-center justify-center gap-2 rounded-lg bg-surface-sunken p-2">
          <span className="lf-label text-content">{labelOf(inspectedType?.item_id)}</span>
          <span className="lf-caption text-content-muted">
            {t(`games.defender.archetype.${inspected.archetype}`)}
          </span>
          <button
            type="button"
            disabled={locked}
            onClick={() =>
              emit('priority', {
                slot: nextPriority(inspected.priority),
                x: cellCol(defender.cols, inspected.cell),
                y: cellRow(defender.cols, inspected.cell),
              })
            }
            className={cn(
              'lf-caption rounded-full border border-outline bg-surface px-3 py-1 text-content',
              HIT_TARGET_CLASS,
            )}
          >
            {t('games.defender.priorityAction', {
              priority: t(`games.defender.priority.${inspected.priority}`),
            })}
          </button>
          {upgradeBranch.map((branch) => {
            const tier = branch.tiers[inspected.branchTier]
            if (tier === undefined) return null
            return (
              <button
                key={branch.id}
                type="button"
                disabled={locked || defender.gold < tier.cost}
                onClick={() =>
                  emit('upgrade', {
                    slot: branch.id,
                    x: cellCol(defender.cols, inspected.cell),
                    y: cellRow(defender.cols, inspected.cell),
                  })
                }
                className={cn(
                  'lf-caption rounded-full border border-outline bg-surface px-3 py-1 text-content',
                  HIT_TARGET_CLASS,
                  defender.gold < tier.cost && 'opacity-50',
                )}
              >
                {t('games.defender.upgradeAction', {
                  label: labelOf(branch.item_id) || branch.id,
                  tier: inspected.branchTier + 1,
                  cost: tier.cost,
                })}
              </button>
            )
          })}
          <button
            type="button"
            disabled={locked}
            onClick={() => {
              emit('sell', {
                x: cellCol(defender.cols, inspected.cell),
                y: cellRow(defender.cols, inspected.cell),
              })
              setInspect(null)
            }}
            className={cn(
              'lf-caption rounded-full border border-outline bg-surface px-3 py-1 text-content',
              HIT_TARGET_CLASS,
            )}
          >
            {t('games.defender.sellAction', {
              gold: Math.floor((inspected.invested * config.build.sell_refund_pct) / 100),
            })}
          </button>
        </div>
      )}

      <p className="lf-caption text-center text-content-muted">
        {wallSelected || tap.selected !== null
          ? t('games.defender.hintPlace')
          : t('games.defender.hint')}
        {defender.blockedBuilds > 0 ? ` ${t('games.defender.sealWarning')}` : ''}
      </p>
    </div>
  )
}
