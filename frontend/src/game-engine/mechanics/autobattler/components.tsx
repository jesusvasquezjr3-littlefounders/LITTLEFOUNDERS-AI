// `autobattler` — the renderer (GAME_ENGINE.md §7, §10; /DESIGN.md "Game visuals").
//
// A RENDERER, not a simulator: it reads `state`/`snapshot` and calls `emit`. It never
// scores, never advances a tick and never reads the wall clock — that split is what lets
// Core replay the same mechanic without React.
//
// THE LESSON IS ON SCREEN. The report binds this mechanic to the shop economy, so the
// economy strip is not decoration: gold, next income, the interest the player would
// collect RIGHT NOW and the cap it stops at are all visible before every decision, and
// `content.tips.interest_md` states the rule in the document's own words. A child who
// cannot see the rule cannot be learning it.
//
// INPUT (/CLAUDE.md §1.11). Every board square is BOTH a `data-dropzone` (so a bench
// unit can be dragged onto it, via core/input.ts) and a real `<button>` (so it can be
// tapped, and so keyboard and screen readers get it for free). Tap is the guaranteed
// path and drag is the enhancement: mobile has no hover, and a touch drag is not
// available to every child. Tapping a fielded unit with nothing selected INSPECTS it,
// which is how selling, benching and equipping are reached without a hover menu.
//
// SCALE FLOOR — the one place this view adds to `core/stage.ts` rather than just using
// it. The stage hook still measures and letterboxes the battlefield, but §1.11 puts a
// hard 44px floor under every control INCLUDING in-canvas ones, so the measured scale is
// floored at `44 / cell_size` and the board sits in its own `overflow-auto` container:
// on a phone the child pans a board whose squares are always thumb-sized, and on a
// desktop the floor is never reached and the whole battlefield is visible at once.
//
// LAYOUT. One column on mobile; from `lg` the battlefield and the shop/bench console sit
// side by side, so the freed desktop width is used on purpose instead of stretching a
// phone layout across it (§1.11).

import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Icon } from '@/components/ui'
import { HIT_TARGET_CLASS, useGameDrag, useTapPlacement } from '@/game-engine/core/input'
import { useStageScale } from '@/game-engine/core/stage'
import type { GameItem, GamePaletteId, MechanicViewProps } from '@/game-engine/core/types'
import MarkdownLite from '@/lesson-engine/core/MarkdownLite'
import { cn } from '@/lib/utils'

import type { AutobattlerContent } from './schema'
import {
  CELL_MILLI,
  cellColOf,
  cellIndexOf,
  cellRowOf,
  fieldRows,
  incomePreview,
  interestPreview,
  placedUnits,
  benchUnits,
  playerTraitCounts,
  unitCapOf,
  type AutobattlerFighter,
  type AutobattlerState,
  type AutobattlerUnitInstance,
} from './simulate'

/** §1.11's hard floor, in CSS px, applied to a single grid square. */
const MIN_CELL_PX = 44

/** Zone id prefixes. Namespaced so a generated unit id can never collide with a square. */
const CELL_PREFIX = 'cell:'
const BENCH_ZONE = 'zone:bench'

/** Fallback Material Symbol for a unit that declares neither a sprite nor an icon.
 *  Emoji are never used: they render differently on every platform and carry a tone the
 *  art direction does not control. */
const FALLBACK_ICON = 'person'

interface AutobattlerPaletteClasses {
  /** The battlefield backdrop. */
  stage: string
  /** The player's half. */
  home: string
  /** The opponent's half. */
  away: string
  friendly: string
  hostile: string
  ink: string
  inkMuted: string
  ring: string
  bar: string
}

/** The six CLOSED palettes, resolved to DESIGN.md semantic tokens — never a raw hex, and
 *  never an arcade font: arcade character comes from weight, size and motion, in Figtree. */
const PALETTES: Record<GamePaletteId, AutobattlerPaletteClasses> = {
  'navy-papaya': {
    stage: 'bg-inverse',
    home: 'bg-inverse-surface',
    away: 'bg-inverse',
    friendly: 'bg-accent text-on-accent',
    hostile: 'bg-delight text-content',
    ink: 'text-on-inverse',
    inkMuted: 'text-on-inverse-muted',
    ring: 'ring-accent',
    bar: 'bg-accent',
  },
  'forest-pear': {
    stage: 'bg-success-strong',
    home: 'bg-success',
    away: 'bg-success-strong',
    friendly: 'bg-delight text-content',
    hostile: 'bg-accent text-on-accent',
    ink: 'text-on-success',
    inkMuted: 'text-on-success',
    ring: 'ring-delight',
    bar: 'bg-delight',
  },
  'ocean-blue': {
    stage: 'bg-inverse-surface',
    home: 'bg-inverse',
    away: 'bg-inverse-surface',
    friendly: 'bg-primary-strong text-on-inverse',
    hostile: 'bg-warning text-content',
    ink: 'text-on-inverse',
    inkMuted: 'text-on-inverse-muted',
    ring: 'ring-primary',
    bar: 'bg-primary',
  },
  'sunset-papaya': {
    stage: 'bg-accent-strong',
    home: 'bg-accent',
    away: 'bg-accent-strong',
    friendly: 'bg-inverse text-on-inverse',
    hostile: 'bg-delight text-content',
    ink: 'text-on-accent',
    inkMuted: 'text-on-accent',
    ring: 'ring-inverse',
    bar: 'bg-inverse',
  },
  'violet-night': {
    stage: 'bg-inverse',
    home: 'bg-inverse-surface',
    away: 'bg-inverse',
    friendly: 'bg-primary-strong text-on-inverse',
    hostile: 'bg-delight text-content',
    ink: 'text-on-inverse',
    inkMuted: 'text-on-inverse-muted',
    ring: 'ring-delight',
    bar: 'bg-delight',
  },
  'sand-clay': {
    stage: 'bg-warning-strong',
    home: 'bg-warning',
    away: 'bg-warning-strong',
    friendly: 'bg-inverse text-on-inverse',
    hostile: 'bg-accent-strong text-on-accent',
    ink: 'text-on-warning',
    inkMuted: 'text-on-warning',
    ring: 'ring-inverse',
    bar: 'bg-inverse',
  },
}

interface CanvasArtProps {
  url: string | undefined
  icon: string | undefined
  /** CSS-px box the art fills; drives the glyph's optical size. */
  size: number
}

/** Sprite when the manifest bound one, the item's Material Symbols glyph when it did not,
 *  and the bare palette shape when it bound neither. A missing sprite is never a broken
 *  image — a document is fully playable before `illustrate` has ever run. */
function CanvasArt({ url, icon, size }: CanvasArtProps) {
  if (url !== undefined) {
    return <img src={url} alt="" aria-hidden="true" className="h-full w-full object-contain" />
  }
  return (
    <span
      className="flex h-full w-full items-center justify-center"
      style={{ fontSize: `${Math.max(11, Math.round(size * 0.5))}px` }}
    >
      <Icon name={icon ?? FALLBACK_ICON} />
    </span>
  )
}

/** Stars as a compact numeric badge rather than a row of glyphs: it stays legible at a
 *  44px square and it reads the same in every locale. */
function StarBadge({ star }: { star: number }) {
  if (star <= 1) return null
  return (
    <span className="lf-caption lf-number absolute right-0 top-0 rounded-bl-sm bg-inverse px-1 text-on-inverse">
      {star}
    </span>
  )
}

export function AutobattlerView({
  document: gameDocument,
  state,
  snapshot,
  emit,
  paused,
  reducedMotion,
}: MechanicViewProps) {
  const { t } = useTranslation()
  // The slice owns its own state shape; core hands it back erased (§7).
  const battler = state as AutobattlerState
  const config = battler.config
  const content = gameDocument.content as unknown as AutobattlerContent
  const palette = PALETTES[gameDocument.skin.palette]
  const sprites = gameDocument.skin.sprites
  const prep = battler.phase === 'prep'
  const locked = paused || snapshot.finished || !prep

  /** The unit the player is inspecting — a local VIEW concern, never simulation state. */
  const [inspect, setInspect] = useState<number | null>(null)

  const cols = config.board.cols
  const rows = config.board.rows
  const totalRows = fieldRows(config)

  const stage = useStageScale({
    designWidth: cols * config.board.cell_size,
    designHeight: totalRows * config.board.cell_size,
    mode: 'contain',
    maxScale: 2,
    safeArea: false,
  })
  // See the SCALE FLOOR note at the top of this file.
  const scale = Math.max(stage.scale, MIN_CELL_PX / config.board.cell_size)
  const cellPx = config.board.cell_size * scale

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

  const unitLabelOf = useCallback(
    (typeIndex: number): string => labelOf(config.units[typeIndex]?.item_id),
    [config.units, labelOf],
  )

  const unitIconOf = useCallback(
    (typeIndex: number): string | undefined =>
      itemsById.get(config.units[typeIndex]?.item_id ?? '')?.icon,
    [config.units, itemsById],
  )

  const unitSpriteOf = useCallback(
    (typeIndex: number): string | undefined => {
      const slot = config.units[typeIndex]?.sprite_slot
      return slot === undefined ? undefined : sprites[slot]
    },
    [config.units, sprites],
  )

  // ONE handler for BOTH input paths: the drag resolves the zone under the pointer and
  // the tap resolves the zone that was tapped, and they must produce the same event.
  const handlePlace = useCallback(
    (unitId: string, zoneId: string) => {
      if (locked) return
      const uid = Number.parseInt(unitId, 10)
      if (!Number.isInteger(uid)) return
      if (zoneId === BENCH_ZONE) {
        emit('place', { n: uid, x: -1, y: -1 })
        return
      }
      if (!zoneId.startsWith(CELL_PREFIX)) return
      const cell = Number.parseInt(zoneId.slice(CELL_PREFIX.length), 10)
      if (!Number.isInteger(cell)) return
      emit('place', { n: uid, x: cellColOf(cols, cell), y: cellRowOf(cols, cell) })
      setInspect(null)
    },
    [cols, emit, locked],
  )

  const drag = useGameDrag({ onDrop: handlePlace, disabled: locked })
  const tap = useTapPlacement({ onPlace: handlePlace, disabled: locked })

  const placed = placedUnits(battler)
  const bench = benchUnits(battler)
  const cap = unitCapOf(battler)
  const traitTallies = playerTraitCounts(battler)

  const unitAtCell = useCallback(
    (cell: number): AutobattlerUnitInstance | undefined =>
      battler.units.find((unit) => unit.cell === cell),
    [battler.units],
  )

  const inspected =
    inspect === null ? undefined : battler.units.find((unit) => unit.uid === inspect)

  /** The inspected unit's type id when enough same-star copies exist to combine them. */
  const mergeableTypeId = useMemo(() => {
    if (inspected === undefined) return undefined
    if (inspected.star >= config.merge.max_star) return undefined
    let copies = 0
    for (const unit of battler.units) {
      if (unit.typeIndex === inspected.typeIndex && unit.star === inspected.star) copies += 1
    }
    if (copies < config.merge.copies_needed) return undefined
    return config.units[inspected.typeIndex]?.id
  }, [battler.units, config.merge.copies_needed, config.merge.max_star, config.units, inspected])

  const onCellClick = useCallback(
    (cell: number) => {
      if (tap.selected !== null) {
        tap.place(`${CELL_PREFIX}${cell}`)
        return
      }
      const occupant = unitAtCell(cell)
      if (occupant === undefined) return
      setInspect((current) => (current === occupant.uid ? null : occupant.uid))
    },
    [tap, unitAtCell],
  )

  // ---- battlefield ---------------------------------------------------------------

  const renderFighter = (fighter: AutobattlerFighter) => {
    const size = cellPx * 0.66
    const hpPct = fighter.maxHp <= 0 ? 0 : Math.max(0, Math.min(100, (fighter.hp * 100) / fighter.maxHp))
    const manaPct =
      fighter.manaMax <= 0 ? 0 : Math.max(0, Math.min(100, (fighter.mana * 100) / fighter.manaMax))
    return (
      <div
        key={fighter.uid}
        className="pointer-events-none absolute"
        style={{
          left: `${(fighter.x / CELL_MILLI) * cellPx - size / 2}px`,
          top: `${(fighter.y / CELL_MILLI) * cellPx - size / 2}px`,
          width: `${size}px`,
          height: `${size}px`,
        }}
      >
        <div
          className={cn(
            'relative h-full w-full rounded-md border-2 border-outline',
            fighter.side === 0 ? palette.friendly : palette.hostile,
            // Decorative only: the position still updates every tick with motion reduced.
            !reducedMotion && fighter.shield > 0 && 'ring-2 ring-inset ring-outline',
          )}
        >
          <CanvasArt
            url={unitSpriteOf(fighter.typeIndex)}
            icon={unitIconOf(fighter.typeIndex)}
            size={size}
          />
          <StarBadge star={fighter.star} />
        </div>
        <div className="absolute -bottom-1 left-0 h-1 w-full overflow-hidden rounded-full bg-inverse-surface">
          <div className={cn('h-full', palette.bar)} style={{ width: `${hpPct}%` }} />
        </div>
        {fighter.manaMax > 0 && (
          <div className="absolute -bottom-2.5 left-0 h-0.5 w-full overflow-hidden rounded-full bg-inverse-surface">
            <div className="h-full bg-primary" style={{ width: `${manaPct}%` }} />
          </div>
        )}
      </div>
    )
  }

  const renderCell = (cell: number) => {
    const col = cellColOf(cols, cell)
    const row = cellRowOf(cols, cell)
    const occupant = unitAtCell(cell)
    const zoneId = `${CELL_PREFIX}${cell}`
    const armed = tap.selected !== null || drag.drag !== null
    const targeted = drag.hoverZone === zoneId
    const label =
      occupant === undefined
        ? t('games.autobattler.emptyCell', { col: col + 1, row: row + 1 })
        : t('games.autobattler.boardUnit', {
            label: unitLabelOf(occupant.typeIndex),
            star: occupant.star,
            col: col + 1,
            row: row + 1,
          })

    return (
      <button
        key={cell}
        type="button"
        aria-label={label}
        aria-pressed={inspect === occupant?.uid}
        disabled={locked}
        className={cn(
          'absolute border border-outline/30 p-0',
          palette.home,
          palette.ink,
          armed && occupant === undefined && cn('ring-2 ring-inset', palette.ring),
          targeted && cn('ring-4 ring-inset', palette.ring),
          inspect !== null && inspect === occupant?.uid && cn('ring-2 ring-inset', palette.ring),
          !reducedMotion && 'transition-[box-shadow] duration-150',
        )}
        style={{
          left: `${col * cellPx}px`,
          // The player's half is the BOTTOM half of the battlefield, exactly as the
          // simulator places its fighters.
          top: `${(rows + row) * cellPx}px`,
          width: `${cellPx}px`,
          height: `${cellPx}px`,
        }}
        {...tap.zoneProps(zoneId)}
        onClick={() => onCellClick(cell)}
      >
        {occupant !== undefined && (
          <span className={cn('relative block h-full w-full rounded-sm', palette.friendly)}>
            <CanvasArt
              url={unitSpriteOf(occupant.typeIndex)}
              icon={unitIconOf(occupant.typeIndex)}
              size={cellPx}
            />
            <StarBadge star={occupant.star} />
          </span>
        )}
      </button>
    )
  }

  const cells: number[] = []
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) cells.push(cellIndexOf(cols, col, row))
  }

  // ---- console -------------------------------------------------------------------

  const chip = (icon: string, text: string, key: string) => (
    <span
      key={key}
      className="lf-label lf-number inline-flex items-center gap-1 rounded-full bg-surface-sunken px-3 py-1 text-content"
    >
      <Icon name={icon} className="text-[1em] leading-none" />
      {text}
    </span>
  )

  const interest = interestPreview(battler)
  const interestCap = config.economy.interest.max_steps * config.economy.interest.amount_per_step
  const income = incomePreview(battler)

  const renderShopOffer = (slot: number, typeIndex: number) => {
    const type = config.units[typeIndex]
    if (type === undefined) return null
    const affordable = battler.gold >= type.cost
    return (
      <button
        key={`shop-${slot}`}
        type="button"
        disabled={locked || !affordable}
        onClick={() => emit('buy', { n: slot })}
        aria-label={t('games.autobattler.buy', {
          label: labelOf(type.item_id),
          cost: type.cost,
        })}
        className={cn(
          'flex flex-1 basis-24 flex-col items-center justify-center gap-0.5 rounded-lg border border-outline bg-surface px-2 py-2 text-content',
          HIT_TARGET_CLASS,
          !affordable && 'opacity-50',
          !reducedMotion && 'transition-[box-shadow] duration-150',
        )}
      >
        <span className="block h-7 w-7">
          <CanvasArt
            url={unitSpriteOf(typeIndex)}
            icon={unitIconOf(typeIndex)}
            size={28}
          />
        </span>
        <span className="lf-caption text-center leading-tight">{labelOf(type.item_id)}</span>
        <span className="lf-caption lf-number text-content-muted">
          {t('games.autobattler.cost', { cost: type.cost })}
        </span>
      </button>
    )
  }

  const renderBenchUnit = (unit: AutobattlerUnitInstance) => {
    const uid = String(unit.uid)
    const selected = tap.isSelected(uid)
    // `dragHandleProps` carries its own `style` (touch-action). The spread comes FIRST
    // and the merged `style` attribute after it, so neither wins by accident.
    const handleProps = drag.dragHandleProps(uid)
    return (
      <button
        key={unit.uid}
        type="button"
        aria-label={t('games.autobattler.benchUnit', {
          label: unitLabelOf(unit.typeIndex),
          star: unit.star,
        })}
        {...tap.itemProps(uid)}
        {...handleProps}
        onDoubleClick={() => setInspect(unit.uid)}
        className={cn(
          'relative flex flex-col items-center gap-0.5 rounded-md border border-outline bg-surface p-1 text-content',
          HIT_TARGET_CLASS,
          selected && cn('ring-2', palette.ring),
          drag.isDragging(uid) && 'opacity-60',
          !reducedMotion && 'transition-[box-shadow] duration-150',
        )}
        style={handleProps.style}
      >
        <span className="block h-7 w-7">
          <CanvasArt url={unitSpriteOf(unit.typeIndex)} icon={unitIconOf(unit.typeIndex)} size={28} />
        </span>
        <span className="lf-caption leading-tight">{unitLabelOf(unit.typeIndex)}</span>
        <StarBadge star={unit.star} />
      </button>
    )
  }

  const activeTraits = config.traits
    .map((trait, index) => ({ trait, count: traitTallies[index] ?? 0 }))
    .filter((entry) => entry.count > 0)

  return (
    <div className="flex h-full w-full min-h-0 flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      {/* The battlefield. Its own scroll container so the 44px cell floor never forces
          the page itself to scroll sideways. */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 lg:h-full">
        <div
          ref={stage.ref}
          style={stage.containerStyle}
          className="flex min-h-0 flex-1 items-center justify-center"
        >
          <div className="max-h-full max-w-full overflow-auto rounded-lg">
            <div
              className={cn('relative', palette.stage)}
              style={{ width: `${cols * cellPx}px`, height: `${totalRows * cellPx}px` }}
              aria-label={t('games.autobattler.stageLabel')}
            >
              {gameDocument.skin.background_url !== undefined && (
                <img
                  src={gameDocument.skin.background_url}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}
              {/* The opponent's half — never interactive, always visible, so the layout
                  does not jump when the battle starts. */}
              <div
                aria-hidden="true"
                className={cn('absolute left-0 top-0 w-full border-b border-outline/40', palette.away)}
                style={{ height: `${rows * cellPx}px` }}
              />
              <p
                className={cn('lf-caption pointer-events-none absolute left-2 top-1', palette.inkMuted)}
              >
                {t('games.autobattler.rivalSide')}
              </p>
              {cells.map((cell) => renderCell(cell))}
              {battler.fighters.map((fighter) => renderFighter(fighter))}
              {paused && (
                <p
                  className={cn(
                    'lf-label pointer-events-none absolute bottom-2 left-2',
                    palette.inkMuted,
                  )}
                >
                  {t('games.autobattler.pausedLabel')}
                </p>
              )}
            </div>
          </div>
        </div>

        {activeTraits.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="lf-caption text-content-muted">
              {t('games.autobattler.traitsTitle')}
            </span>
            {activeTraits.map(({ trait, count }) => (
              <span
                key={trait.id}
                className="lf-caption lf-number rounded-full bg-surface-sunken px-2 py-0.5 text-content"
              >
                {t('games.autobattler.traitChip', {
                  label: labelOf(trait.item_id) || trait.id,
                  count,
                })}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* The console: economy, the interest rule, the shop, the bench. */}
      <div className="flex min-h-0 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
          {chip('paid', t('games.autobattler.gold', { gold: battler.gold }), 'gold')}
          {chip('trending_up', t('games.autobattler.income', { income }), 'income')}
          {chip(
            'percent',
            t('games.autobattler.interest', { interest, cap: interestCap }),
            'interest',
          )}
          {chip(
            'military_tech',
            t('games.autobattler.levelChip', { level: battler.level, cap }),
            'level',
          )}
          {battler.winStreak > 0 &&
            chip('bolt', t('games.autobattler.streakWin', { count: battler.winStreak }), 'streak')}
          {chip('favorite', t('games.autobattler.health', { health: battler.health }), 'health')}
        </div>

        {/* The rule the game exists to teach, in the document's own words. */}
        <div className="rounded-lg bg-surface-sunken p-2">
          <MarkdownLite
            text={content.tips.interest_md}
            className="lf-caption text-content"
          />
          <MarkdownLite
            text={content.tips.saving_md}
            className="lf-caption text-content-muted"
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="lf-label text-content">{t('games.autobattler.shopTitle')}</span>
          <div className="flex flex-wrap items-stretch gap-2">
            {battler.shop.map((typeIndex, slot) =>
              typeIndex < 0 ? null : renderShopOffer(slot, typeIndex),
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={locked || battler.gold < config.shop.refresh_cost}
              onClick={() => emit('refresh')}
              className={cn(
                'lf-label inline-flex items-center gap-1 rounded-full border border-outline bg-surface px-3 py-1 text-content',
                HIT_TARGET_CLASS,
                battler.gold < config.shop.refresh_cost && 'opacity-50',
              )}
            >
              <Icon name="refresh" className="text-[1em] leading-none" />
              {t('games.autobattler.refresh', { cost: config.shop.refresh_cost })}
            </button>
            <button
              type="button"
              disabled={
                locked ||
                battler.level >= config.shop.level.max ||
                battler.gold < config.shop.level.xp_cost
              }
              onClick={() => emit('level')}
              className={cn(
                'lf-label inline-flex items-center gap-1 rounded-full border border-outline bg-surface px-3 py-1 text-content',
                HIT_TARGET_CLASS,
                (battler.level >= config.shop.level.max ||
                  battler.gold < config.shop.level.xp_cost) &&
                  'opacity-50',
              )}
            >
              <Icon name="upgrade" className="text-[1em] leading-none" />
              {t('games.autobattler.levelUp', { cost: config.shop.level.xp_cost })}
            </button>
            {/* The single papaya CTA of this view (Action Color Contract). */}
            <button
              type="button"
              disabled={locked}
              onClick={() => emit('ready')}
              className={cn(
                'lf-label inline-flex items-center gap-1 rounded-full bg-accent px-4 py-1 text-on-accent',
                HIT_TARGET_CLASS,
                locked && 'opacity-50',
              )}
            >
              <Icon name="swords" className="text-[1em] leading-none" />
              {t('games.autobattler.ready')}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="lf-label text-content">
            {t('games.autobattler.benchTitle', { placed: placed.length, cap })}
          </span>
          <div
            className={cn(
              'flex min-h-16 flex-wrap items-stretch gap-2 rounded-lg border border-dashed border-outline p-2',
              (tap.selected !== null || drag.drag !== null) && cn('ring-2', palette.ring),
            )}
            {...tap.zoneProps(BENCH_ZONE)}
          >
            {bench.length === 0 ? (
              <p className="lf-caption text-content-muted">{t('games.autobattler.benchEmpty')}</p>
            ) : (
              bench.map((unit) => renderBenchUnit(unit))
            )}
          </div>
        </div>

        {/* The inspect panel: bench, sell, equip. Reached by TAPPING a unit — never by
            hovering it, because mobile has no hover. */}
        {inspected !== undefined && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-sunken p-2">
            <span className="lf-label text-content">{unitLabelOf(inspected.typeIndex)}</span>
            {/* Merging is an ACTION, not only an automatic effect: a manifest with
                `auto_merge: false` must still be playable, so the control appears the
                moment enough same-star copies exist. */}
            {mergeableTypeId !== undefined && (
              <button
                type="button"
                disabled={locked}
                onClick={() => {
                  emit('merge', { slot: mergeableTypeId })
                  setInspect(null)
                }}
                className={cn(
                  'lf-caption rounded-full border border-outline bg-surface px-3 py-1 text-content',
                  HIT_TARGET_CLASS,
                )}
              >
                {t('games.autobattler.merge', {
                  label: unitLabelOf(inspected.typeIndex),
                  star: inspected.star + 1,
                })}
              </button>
            )}
            {inspected.cell >= 0 && (
              <button
                type="button"
                disabled={locked}
                onClick={() => {
                  emit('place', { n: inspected.uid, x: -1, y: -1 })
                  setInspect(null)
                }}
                className={cn(
                  'lf-caption rounded-full border border-outline bg-surface px-3 py-1 text-content',
                  HIT_TARGET_CLASS,
                )}
              >
                {t('games.autobattler.toBench')}
              </button>
            )}
            {battler.bag.map((itemId, index) => (
              <button
                key={`${itemId}-${index}`}
                type="button"
                disabled={locked || inspected.items.length >= 3}
                onClick={() => emit('equip', { n: inspected.uid, slot: itemId })}
                className={cn(
                  'lf-caption rounded-full border border-outline bg-surface px-3 py-1 text-content',
                  HIT_TARGET_CLASS,
                )}
              >
                {t('games.autobattler.equip', { label: labelOf(itemId) })}
              </button>
            ))}
            <button
              type="button"
              disabled={locked}
              onClick={() => {
                emit('sell', { n: inspected.uid })
                setInspect(null)
              }}
              className={cn(
                'lf-caption rounded-full border border-outline bg-surface px-3 py-1 text-content',
                HIT_TARGET_CLASS,
              )}
            >
              {t('games.autobattler.sell')}
            </button>
          </div>
        )}

        <p className="lf-caption text-center text-content-muted lg:text-left">
          {prep
            ? tap.selected !== null
              ? t('games.autobattler.hintPlace')
              : t('games.autobattler.hintPrep')
            : t('games.autobattler.hintBattle')}
        </p>
      </div>
    </div>
  )
}
