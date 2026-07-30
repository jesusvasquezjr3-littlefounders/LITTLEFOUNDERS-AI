// `sorter` — the renderer (GAME_ENGINE.md §10).
//
// It is a RENDERER, not a simulator: it reads `state`/`snapshot` and calls `emit`.
// It never scores, never advances a tick and never reads the wall clock — that split
// is what lets Core replay the same mechanic without React.
//
// Three rules it exists to obey:
//  - EVERY container is BOTH a pointer drop zone (`data-dropzone`, via core/input.ts)
//    and a tap target. Mobile has no hover and a touch drag is not available to every
//    child, so drag is enhancement and tap is the guaranteed path (§1.11).
//  - The canvas scales through core/stage.ts, in stable DESIGN coordinates, so 375px
//    and 1280px are the same layout at two sizes rather than two layouts.
//  - Chrome belongs to the player shell. This view draws the playfield, the labelled
//    containers and the streak — never the score/lives HUD, which the shell owns.

import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Icon } from '@/components/ui'
import { useGameDrag, useTapPlacement, HIT_TARGET_CLASS } from '@/game-engine/core/input'
import { comboMultiplier } from '@/game-engine/core/scoring'
import { useStageScale } from '@/game-engine/core/stage'
import type { GameCategory, GameItem, GamePaletteId, MechanicViewProps } from '@/game-engine/core/types'
import { cn } from '@/lib/utils'

import type { SorterEntity, SorterState } from './simulate'

/** The discard target's zone id. Namespaced with a colon so it cannot be mistaken
 *  for a generated category id, which the content playbook keeps kebab-case. */
export const SORTER_TRASH_ZONE = 'sorter:trash'

/** Fallback Material Symbol when an item declares neither a sprite nor an icon.
 *  Emoji are never used: they render differently on every platform and carry a tone
 *  the art direction does not control. */
const FALLBACK_ICON = 'category'

interface SorterPaletteTokens {
  /** The playfield well. */
  field: string
  /** Text drawn directly on the field. */
  fieldText: string
  /** A container's resting look. */
  bin: string
  /** The ring colour a container takes while it is the live target. */
  binRing: string
}

/**
 * `GAME_PALETTES` → DESIGN.md semantic tokens. Never a raw hex, and never an
 * arcade font: the arcade feel comes from weight, size and motion (§10).
 */
const PALETTES: Record<GamePaletteId, SorterPaletteTokens> = {
  'navy-papaya': {
    field: 'bg-inverse-surface',
    fieldText: 'text-on-inverse',
    bin: 'bg-inverse text-on-inverse border-on-inverse-muted/40',
    binRing: 'ring-accent',
  },
  'forest-pear': {
    field: 'bg-success-soft',
    fieldText: 'text-content',
    bin: 'bg-surface text-content border-success/40',
    binRing: 'ring-success-strong',
  },
  'ocean-blue': {
    field: 'bg-primary-soft',
    fieldText: 'text-content',
    bin: 'bg-surface text-content border-primary/40',
    binRing: 'ring-primary',
  },
  'sunset-papaya': {
    field: 'bg-accent-soft',
    fieldText: 'text-content',
    bin: 'bg-surface text-content border-accent/40',
    binRing: 'ring-accent-strong',
  },
  'violet-night': {
    field: 'bg-inverse',
    fieldText: 'text-on-inverse',
    bin: 'bg-inverse-surface text-on-inverse border-on-inverse-muted/40',
    binRing: 'ring-delight',
  },
  'sand-clay': {
    field: 'bg-surface-sunken',
    fieldText: 'text-content',
    bin: 'bg-surface text-content border-warning/40',
    binRing: 'ring-warning-strong',
  },
}

interface SpriteOrIconProps {
  url: string | undefined
  icon: string | undefined
  label: string
  className?: string
}

/** A Prism sprite when the slot is bound, the item's Material Symbol otherwise.
 *  Sprites are exempt from the icon rule by definition — they ARE the illustration. */
function SpriteOrIcon({ url, icon, label, className }: SpriteOrIconProps) {
  if (url !== undefined) {
    return <img src={url} alt="" aria-hidden="true" className={cn('h-full w-full object-contain', className)} />
  }
  return (
    <span className={cn('flex h-full w-full items-center justify-center', className)} title={label}>
      <Icon name={icon ?? FALLBACK_ICON} className="text-[2em] leading-none" />
    </span>
  )
}

export function SorterView(props: MechanicViewProps) {
  const { document: gameDocument, state, snapshot, emit, paused, reducedMotion } = props
  const { t } = useTranslation()

  const sorter = state as SorterState
  const config = sorter.config
  const palette = PALETTES[gameDocument.skin.palette]

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

  const categories: GameCategory[] = useMemo(
    () => gameDocument.content.categories ?? [],
    [gameDocument.content.categories],
  )

  const sprites = gameDocument.skin.sprites

  // One handler for BOTH input paths: the drag resolves a zone under the pointer and
  // the tap resolves the zone that was tapped, and they must produce the same event.
  const handlePlace = useCallback(
    (itemId: string, zoneId: string) => {
      const uid = Number.parseInt(itemId, 10)
      if (!Number.isInteger(uid)) return
      if (zoneId === SORTER_TRASH_ZONE) {
        emit('discard', { n: uid })
        return
      }
      emit('place', { slot: zoneId, n: uid })
    },
    [emit],
  )

  const drag = useGameDrag({ onDrop: handlePlace, disabled: paused || snapshot.finished })
  const tap = useTapPlacement({ onPlace: handlePlace, disabled: paused || snapshot.finished })

  const chipSize = config.field.item_size * stage.scale
  const multiplier = comboMultiplier(sorter.combo, config.combo)

  const renderChip = (entity: SorterEntity, positioned: boolean) => {
    const uid = String(entity.uid)
    const item = itemsById.get(entity.itemId)
    const label = item?.label_md ?? entity.itemId
    const slot = item?.image_slot
    const position = stage.toStage(entity.x, entity.y)
    const selected = tap.isSelected(uid)
    // `dragHandleProps` carries its own `style` (touch-action). The spread comes
    // FIRST and the merged `style` attribute after it, so neither wins by accident.
    const handleProps = drag.dragHandleProps(uid)

    return (
      <button
        key={entity.uid}
        type="button"
        aria-label={t('games.sorter.itemLabel', { label })}
        {...tap.itemProps(uid)}
        {...handleProps}
        className={cn(
          'flex flex-col items-center gap-1 rounded-md border border-outline bg-surface p-1 text-content shadow-glass-sm',
          HIT_TARGET_CLASS,
          positioned && 'absolute -translate-x-1/2 -translate-y-1/2',
          // Decorative only: position still updates every tick with reduced motion on.
          !reducedMotion && 'transition-[box-shadow] duration-150',
          selected && 'ring-2 ring-accent',
          drag.isDragging(uid) && 'opacity-60',
        )}
        style={{
          ...handleProps.style,
          width: `${chipSize}px`,
          ...(positioned ? { left: `${position.x}px`, top: `${position.y}px` } : {}),
        }}
      >
        <span className="block h-8 w-full sm:h-10">
          <SpriteOrIcon
            url={slot === undefined ? undefined : sprites[slot]}
            icon={item?.icon}
            label={label}
          />
        </span>
        <span className="lf-caption w-full text-center leading-tight">{label}</span>
      </button>
    )
  }

  // A container is "armed" whenever the player is mid-gesture on either input path,
  // so the tap route gets the same affordance the drag route does.
  const armed = tap.selected !== null || drag.drag !== null

  const renderZone = (zoneId: string, label: string, icon: string, slot: string | undefined) => {
    const targeted = drag.hoverZone === zoneId
    return (
      <button
        key={zoneId}
        type="button"
        aria-label={t('games.sorter.binLabel', { label })}
        className={cn(
          'flex flex-1 basis-28 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-3 py-3',
          HIT_TARGET_CLASS,
          palette.bin,
          armed && cn('ring-2', palette.binRing),
          targeted && cn('ring-4', palette.binRing),
          !reducedMotion && 'transition-[box-shadow] duration-150',
        )}
        {...tap.zoneProps(zoneId)}
      >
        <span className="block h-6 w-6">
          <SpriteOrIcon url={slot === undefined ? undefined : sprites[slot]} icon={icon} label={label} />
        </span>
        <span className="lf-label text-center leading-tight">{label}</span>
      </button>
    )
  }

  return (
    <div className="flex h-full w-full min-h-0 flex-col gap-3">
      <div
        ref={stage.ref}
        style={stage.containerStyle}
        className={cn(
          'relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg',
          palette.field,
          palette.fieldText,
        )}
        aria-label={t('games.sorter.fieldLabel')}
      >
        <div style={stage.stageStyle} className="relative">
          {gameDocument.skin.background_url !== undefined && (
            <img
              src={gameDocument.skin.background_url}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}

          {config.mode === 'static' ? (
            <div className="absolute inset-0 flex flex-wrap content-center items-center justify-center gap-2 p-2">
              {sorter.active.map((entity) => renderChip(entity, false))}
            </div>
          ) : (
            sorter.active.map((entity) => renderChip(entity, true))
          )}

          {sorter.active.length === 0 && (
            <p className="lf-caption absolute inset-0 flex items-center justify-center text-center opacity-70">
              {t('games.sorter.empty')}
            </p>
          )}

          {multiplier > 1 && (
            <span className="lf-label lf-number absolute left-2 top-2 rounded-full bg-accent px-3 py-1 text-on-accent">
              {t('games.sorter.combo', { multiplier })}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-stretch justify-center gap-4">
        {categories.map((category) =>
          renderZone(category.id, category.label_md, FALLBACK_ICON, category.image_slot),
        )}
        {config.trash_zone &&
          renderZone(SORTER_TRASH_ZONE, t('games.sorter.trash'), 'delete', 'trash')}
      </div>

      <p className="lf-caption text-center text-content-muted">{t('games.sorter.hint')}</p>
    </div>
  )
}
