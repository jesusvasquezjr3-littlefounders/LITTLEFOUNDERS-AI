// `explorer` — the renderer (GAME_ENGINE.md §7, §10; /DESIGN.md "Game visuals").
//
// A RENDERER, not a simulator: it reads `state`/`snapshot` and calls `emit`. It never
// scores, never advances a tick and never reads the wall clock — that split is what lets
// Core replay the same mechanic without React.
//
// Four rules it exists to obey:
//  - TAP IS THE GUARANTEED PATH. Selecting an ability and tapping a lock is the primary
//    interaction; dragging the ability chip onto the lock is PROGRESSIVE ENHANCEMENT over
//    it (core/input.ts). Mobile has no hover and a touch drag is not available to every
//    child, so a drag-only affordance would be a bug (/CLAUDE.md §1.11).
//  - THE MAP SCALES THROUGH core/stage.ts, in stable DESIGN coordinates, so 375px and
//    1280px are the same map at two sizes rather than two layouts. Mobile stacks the map
//    over the control panel; desktop puts the panel in the freed width beside it.
//  - SIGNPOSTING IS COLOUR + SHAPE + SOUND (the report's triad, config-driven). Colour
//    alone fails a colour-blind player, so every lock kind also carries its own SHAPE,
//    and the schema refuses a manifest that reuses either. The third leg — the sound — is
//    the `sfx` name in `config.signposts`, which the player shell's audio layer resolves;
//    no game audio binary ships yet, so it resolves to silence and nothing breaks.
//  - DESIGN TOKENS ONLY. No raw hex, no arcade font: arcade feel comes from weight, size
//    and motion, in Figtree, at the `lf-*` scale.

import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Icon } from '@/components/ui'
import { HIT_TARGET_CLASS, useGameDrag, useTapPlacement } from '@/game-engine/core/input'
import { useStageScale } from '@/game-engine/core/stage'
import type { GameItem, GamePaletteId, MechanicViewProps } from '@/game-engine/core/types'
import { cn } from '@/lib/utils'

import type {
  ExplorerLockKind,
  ExplorerNode,
  ExplorerNodeKind,
  ExplorerSignpostShape,
  ExplorerSignpostTone,
} from './schema'
import {
  canOperateLockFrom,
  canTraverse,
  holdingsOfState,
  isCheckpointNode,
  lockSatisfied,
  nodeIsClaimable,
  nodeIsRevealed,
  type ExplorerState,
} from './simulate'

/** The six closed palettes resolved to DESIGN tokens. THEME-STABLE by rule: no `-soft`
 *  token appears here, because those invert between light and dark while the map does
 *  not, and a map's readability must not change when a child flips the theme. */
interface ExplorerPaletteClasses {
  stage: string
  well: string
  ink: string
  inkMuted: string
  edge: string
  avatar: string
}

const PALETTES: Record<GamePaletteId, ExplorerPaletteClasses> = {
  'navy-papaya': {
    stage: 'bg-inverse',
    well: 'bg-inverse-surface',
    ink: 'text-on-inverse',
    inkMuted: 'text-on-inverse-muted',
    edge: 'text-on-inverse-muted',
    avatar: 'bg-accent text-on-accent',
  },
  'forest-pear': {
    stage: 'bg-success-strong',
    well: 'bg-success',
    ink: 'text-on-success',
    inkMuted: 'text-on-success',
    edge: 'text-on-success',
    avatar: 'bg-delight text-on-delight',
  },
  'ocean-blue': {
    stage: 'bg-inverse-surface',
    well: 'bg-inverse',
    ink: 'text-on-inverse',
    inkMuted: 'text-on-inverse-muted',
    edge: 'text-on-inverse-muted',
    avatar: 'bg-accent text-on-accent',
  },
  'sunset-papaya': {
    stage: 'bg-accent-strong',
    well: 'bg-accent',
    ink: 'text-on-accent',
    inkMuted: 'text-on-accent',
    edge: 'text-on-accent',
    avatar: 'bg-inverse text-on-inverse',
  },
  'violet-night': {
    stage: 'bg-inverse',
    well: 'bg-inverse-surface',
    ink: 'text-on-inverse',
    inkMuted: 'text-on-inverse-muted',
    edge: 'text-on-inverse-muted',
    avatar: 'bg-primary-strong text-on-primary',
  },
  'sand-clay': {
    stage: 'bg-warning-strong',
    well: 'bg-warning',
    ink: 'text-on-warning',
    inkMuted: 'text-on-warning',
    edge: 'text-on-warning',
    avatar: 'bg-inverse text-on-inverse',
  },
}

/** Signpost COLOUR, as DESIGN token pairs. Never a raw hex. */
const TONES: Record<ExplorerSignpostTone, { chip: string; stroke: string }> = {
  primary: { chip: 'bg-primary text-on-primary', stroke: 'text-primary' },
  secondary: { chip: 'bg-secondary text-on-secondary', stroke: 'text-secondary' },
  accent: { chip: 'bg-accent text-on-accent', stroke: 'text-accent' },
  success: { chip: 'bg-success text-on-success', stroke: 'text-success' },
  warning: { chip: 'bg-warning text-on-warning', stroke: 'text-warning' },
  delight: { chip: 'bg-delight text-on-delight', stroke: 'text-delight' },
}

/** Signpost SHAPE, drawn in `currentColor` inside a 24x24 box. The second leg of the
 *  triad: a child who cannot separate the colours still separates the shapes. */
const SHAPE_PATHS: Record<ExplorerSignpostShape, string> = {
  circle: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z',
  square: 'M4 4h16v16H4z',
  triangle: 'M12 3l9 17H3z',
  diamond: 'M12 2l10 10l-10 10L2 12z',
  hexagon: 'M7 3h10l5 9l-5 9H7l-5-9z',
  cross: 'M9 2h6v7h7v6h-7v7H9v-7H2V9h7z',
}

/** Fallback sprite slot per node kind, so an un-illustrated document still reads. */
const KIND_SLOT: Record<ExplorerNodeKind, string> = {
  start: 'node',
  tutorial: 'node_tutorial',
  plain: 'node',
  boss: 'node_boss',
  shrine: 'node_shrine',
  shop: 'node_shop',
  fragment: 'node_fragment',
  goal: 'node_goal',
}

/** Material Symbols fallback per node kind, for a document with no sprites at all. */
const KIND_ICON: Record<ExplorerNodeKind, string> = {
  start: 'home',
  tutorial: 'school',
  plain: 'place',
  boss: 'castle',
  shrine: 'auto_awesome',
  shop: 'storefront',
  fragment: 'extension',
  goal: 'flag',
}

interface CanvasArtProps {
  url: string | undefined
  icon: string
  size: number
}

/** Sprite when the manifest bound one, the Material Symbols glyph when it did not. A
 *  missing sprite is never a broken image: a document is fully playable before the
 *  `illustrate` stage has ever run. */
function CanvasArt({ url, icon, size }: CanvasArtProps) {
  if (url !== undefined) {
    return <img src={url} alt="" aria-hidden="true" className="h-full w-full object-contain" />
  }
  return (
    <span
      className="flex h-full w-full items-center justify-center"
      style={{ fontSize: `${Math.max(14, Math.round(size * 0.5))}px` }}
      aria-hidden="true"
    >
      <Icon name={icon} />
    </span>
  )
}

function Signpost({ shape, className }: { shape: ExplorerSignpostShape; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('h-4 w-4', className)} aria-hidden="true">
      <path d={SHAPE_PATHS[shape]} fill="currentColor" />
    </svg>
  )
}

export function ExplorerView({
  document: gameDocument,
  state,
  snapshot,
  emit,
  paused,
  reducedMotion,
}: MechanicViewProps) {
  const { t } = useTranslation()
  // The slice owns its own state shape; core hands it back erased (§7).
  const explorer = state as ExplorerState
  const config = explorer.config
  const palette = PALETTES[gameDocument.skin.palette]
  const sprites = gameDocument.skin.sprites
  const locked = paused || snapshot.finished

  const stage = useStageScale({
    designWidth: config.map.width,
    designHeight: config.map.height,
    mode: 'contain',
    safeArea: false,
    maxScale: 1.6,
  })

  const itemsById = useMemo(() => {
    const map = new Map<string, GameItem>()
    for (const item of gameDocument.content.items) map.set(item.id, item)
    return map
  }, [gameDocument.content.items])

  const here = explorer.nodes[explorer.at]
  const holdings = holdingsOfState(explorer)
  const travelling = explorer.travelLeft > 0

  // ONE handler for BOTH input paths: the drag drops an ability chip on a lock badge and
  // the tap selects then places on the same badge — they must produce the same event.
  const handleUse = useCallback(
    (abilityKey: string, edgeId: string) => {
      const index = Number.parseInt(abilityKey, 10)
      if (!Number.isInteger(index)) return
      emit('use', { slot: edgeId, n: index })
    },
    [emit],
  )

  const drag = useGameDrag({ onDrop: handleUse, disabled: locked })
  const tap = useTapPlacement({ onPlace: handleUse, disabled: locked })

  const nodeSize = Math.max(36, Math.round(config.map.node_radius * 2 * stage.scale))
  // Text inside the map is Figtree at the lf-* scale and does NOT shrink with the
  // letterbox: art may scale, labels must stay readable at 375px.
  const labelScale = stage.scale > 0 ? Math.min(1, 1 / stage.scale) : 1

  const revealed = explorer.nodes.map((_, index) => nodeIsRevealed(explorer, index))

  /** Can the player step onto this node from where they stand, right now? */
  const canStepTo = (index: number): boolean => {
    const target = explorer.nodes[index]
    if (here === undefined || target === undefined || index === explorer.at) return false
    for (let e = 0; e < explorer.edges.length; e += 1) {
      const edge = explorer.edges[e]
      if (edge === undefined) continue
      if (!canTraverse(edge, here.id, target.id)) continue
      if (edge.lock !== null && explorer.open[e] !== true) continue
      return true
    }
    return false
  }

  const kindLabel = (kind: ExplorerNodeKind) => t(`games.explorer.kind.${kind}`)
  const lockLabel = (kind: ExplorerLockKind) => t(`games.explorer.lock.${kind}`)

  const renderNode = (node: ExplorerNode, index: number) => {
    if (!revealed[index]) return null
    const position = stage.toStage(node.x, node.y)
    const isHere = index === explorer.at
    const reachable = canStepTo(index)
    const slot = node.image_slot ?? KIND_SLOT[node.kind]

    return (
      <button
        key={node.id}
        type="button"
        disabled={locked || travelling || (!reachable && !isHere)}
        aria-current={isHere ? 'true' : undefined}
        aria-label={
          isHere
            ? t('games.explorer.node.current', { label: node.label_md, kind: kindLabel(node.kind) })
            : reachable
              ? t('games.explorer.node.move', { label: node.label_md, kind: kindLabel(node.kind) })
              : t('games.explorer.node.blocked', { label: node.label_md, kind: kindLabel(node.kind) })
        }
        onClick={() => {
          if (isHere) return
          emit('move', { slot: node.id })
        }}
        className={cn(
          'absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-2',
          HIT_TARGET_CLASS,
          palette.well,
          palette.ink,
          isHere ? 'border-current' : 'border-transparent',
          explorer.visited[index] === true ? 'opacity-100' : 'opacity-70',
          node.hidden && 'border-dashed border-current',
          reachable && 'ring-2 ring-current',
          !reducedMotion && 'transition-[opacity,box-shadow] duration-150',
          'disabled:cursor-default',
        )}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: `${nodeSize}px`,
          height: `${nodeSize}px`,
        }}
      >
        <span className="block h-1/2 w-1/2">
          <CanvasArt url={sprites[slot]} icon={KIND_ICON[node.kind]} size={nodeSize} />
        </span>
        <span
          className="lf-caption pointer-events-none absolute left-1/2 top-full whitespace-nowrap pt-1"
          style={{ transform: `translateX(-50%) scale(${labelScale})`, transformOrigin: 'top center' }}
        >
          {node.label_md}
        </span>
        {(explorer.cache[index] ?? 0) > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-warning text-on-warning">
            <Icon name="paid" className="text-[14px] leading-none" />
          </span>
        )}
      </button>
    )
  }

  const renderLockBadge = (edgeIndex: number) => {
    const edge = explorer.edges[edgeIndex]
    if (edge === undefined) return null
    const lock = edge.lock
    if (lock === null || explorer.open[edgeIndex] === true) return null

    const fromIndex = explorer.nodes.findIndex((node) => node.id === edge.from)
    const toIndex = explorer.nodes.findIndex((node) => node.id === edge.to)
    const from = explorer.nodes[fromIndex]
    const to = explorer.nodes[toIndex]
    if (from === undefined || to === undefined) return null
    if (!revealed[fromIndex] || !revealed[toIndex]) return null

    const signpost = config.signposts[lock.kind]
    const tone = TONES[signpost.tone]
    const position = stage.toStage((from.x + to.x) / 2, (from.y + to.y) / 2)
    const operable = here !== undefined && canOperateLockFrom(edge, here.id)
    const satisfiable = lockSatisfied(lock, explorer.abilities, config, holdings)
    const zone = tap.zoneProps(edge.id)

    return (
      <button
        key={edge.id}
        type="button"
        {...zone}
        disabled={locked || travelling || !operable}
        aria-label={t('games.explorer.lockLabel', {
          kind: lockLabel(lock.kind),
          hint: lock.hint_md ?? '',
        })}
        title={lock.hint_md}
        onClick={() => {
          if (tap.selected !== null) {
            tap.place(edge.id)
            return
          }
          emit('use', { slot: edge.id })
        }}
        className={cn(
          'absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-1 rounded-full px-2',
          HIT_TARGET_CLASS,
          tone.chip,
          satisfiable && operable && 'ring-2 ring-current',
          drag.hoverZone === edge.id && 'ring-4 ring-current',
          !reducedMotion && 'transition-[box-shadow] duration-150',
        )}
        style={{ left: `${position.x}px`, top: `${position.y}px` }}
      >
        <CanvasArt
          url={sprites[`lock_${lock.kind}`]}
          icon={lock.sequence ? 'linked_services' : 'lock'}
          size={20}
        />
        <Signpost shape={signpost.shape} />
        {lock.sequence && (
          <span className="lf-caption lf-number">
            {(explorer.seqAt[edgeIndex] ?? 0) + 1}/{lock.requires.length}
          </span>
        )}
      </button>
    )
  }

  const renderAbilityChip = (index: number) => {
    const ability = explorer.abilities[index]
    if (ability === undefined) return null
    const item = itemsById.get(ability.id)
    const tier = explorer.tier[index] ?? 0
    const held = tier > 0
    const key = String(index)
    // `dragHandleProps` carries its own `style` (touch-action). The spread comes FIRST
    // and the merged `style` attribute after it, so neither wins by accident.
    const handleProps = drag.dragHandleProps(key)
    const itemProps = tap.itemProps(key)

    return (
      <button
        key={ability.id}
        type="button"
        {...itemProps}
        {...handleProps}
        disabled={locked || !held}
        aria-label={
          held
            ? t('games.explorer.abilityTier', {
                label: item?.label_md ?? ability.id,
                tier,
                family: t(`games.explorer.family.${ability.family}`),
              })
            : t('games.explorer.abilityLocked', { label: item?.label_md ?? ability.id })
        }
        className={cn(
          'flex flex-1 basis-24 flex-col items-center gap-1 rounded-md border border-outline bg-surface p-2 text-content',
          HIT_TARGET_CLASS,
          !held && 'opacity-40',
          tap.isSelected(key) && 'ring-2 ring-accent',
          drag.isDragging(key) && 'opacity-60',
          !reducedMotion && 'transition-[box-shadow] duration-150',
        )}
        style={handleProps.style}
      >
        <span className="block h-6 w-6">
          <CanvasArt url={item?.image_slot === undefined ? undefined : sprites[item.image_slot]} icon={item?.icon ?? 'bolt'} size={24} />
        </span>
        <span className="lf-caption text-center leading-tight">{item?.label_md ?? ability.id}</span>
        <span className="lf-caption lf-number text-content-muted">
          {held ? `T${tier}` : t('games.explorer.abilityNotYet')}
        </span>
      </button>
    )
  }

  const cacheHere = explorer.cache[explorer.at] ?? 0
  const challenge = here?.challenge
  const challengeOpen = here !== undefined && challenge !== undefined && explorer.solved[explorer.at] !== true
  const claimable = nodeIsClaimable(explorer, explorer.at)
  const canRestHere =
    here !== undefined &&
    isCheckpointNode(explorer, explorer.at) &&
    explorer.activated[explorer.at] !== true

  return (
    <div className="flex h-full w-full min-h-0 flex-col gap-3 lg:flex-row lg:gap-4">
      {/* ---- the map ---- */}
      <div
        ref={stage.ref}
        style={stage.containerStyle}
        className={cn(
          'relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg',
          palette.stage,
          palette.ink,
        )}
        aria-label={t('games.explorer.mapLabel')}
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

          <svg
            viewBox={`0 0 ${config.map.width} ${config.map.height}`}
            preserveAspectRatio="none"
            className={cn('absolute inset-0 h-full w-full', palette.edge)}
            aria-hidden="true"
          >
            {explorer.edges.map((edge, index) => {
              const fromIndex = explorer.nodes.findIndex((node) => node.id === edge.from)
              const toIndex = explorer.nodes.findIndex((node) => node.id === edge.to)
              const from = explorer.nodes[fromIndex]
              const to = explorer.nodes[toIndex]
              if (from === undefined || to === undefined) return null
              if (!revealed[fromIndex] || !revealed[toIndex]) return null
              const isOpen = edge.lock === null || explorer.open[index] === true
              return (
                <line
                  key={edge.id}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="currentColor"
                  strokeWidth={isOpen ? 4 : 3}
                  strokeOpacity={isOpen ? 0.9 : 0.45}
                  strokeDasharray={isOpen ? undefined : '10 8'}
                  strokeLinecap="round"
                />
              )
            })}
          </svg>

          {explorer.edges.map((_, index) => renderLockBadge(index))}
          {explorer.nodes.map((node, index) => renderNode(node, index))}

          {here !== undefined && (
            <span
              className={cn(
                'pointer-events-none absolute flex -translate-x-1/2 items-center justify-center rounded-full px-2 py-1',
                palette.avatar,
                !reducedMotion && 'transition-[left,top] duration-150',
              )}
              style={{
                left: `${stage.toStage(here.x, here.y).x}px`,
                top: `${stage.toStage(here.x, here.y).y - nodeSize}px`,
              }}
            >
              <CanvasArt url={sprites.avatar} icon="hiking" size={20} />
            </span>
          )}

          {travelling && (
            <p className={cn('lf-label absolute left-3 top-3 rounded-full px-3 py-1', palette.well)}>
              {t('games.explorer.travelling')}
            </p>
          )}
          {paused && (
            <p className={cn('lf-label absolute bottom-3 left-3', palette.inkMuted)}>
              {t('games.explorer.pausedLabel')}
            </p>
          )}
        </div>
      </div>

      {/* ---- the control panel: below the map on mobile, beside it on desktop ---- */}
      <div className="flex w-full shrink-0 flex-col gap-3 lg:w-80">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
          <p className="lf-caption rounded-md border border-outline bg-surface px-2 py-1 text-content">
            {t('games.explorer.energy', { value: explorer.energy, max: config.energy.max })}
          </p>
          <p className="lf-caption rounded-md border border-outline bg-surface px-2 py-1 text-content">
            {t('games.explorer.currency', { amount: explorer.currency })}
          </p>
          <p className="lf-caption rounded-md border border-outline bg-surface px-2 py-1 text-content">
            {t('games.explorer.mastery', { value: explorer.mastery })}
          </p>
          <p className="lf-caption rounded-md border border-outline bg-surface px-2 py-1 text-content">
            {t('games.explorer.explored', {
              pct: Math.round(
                (explorer.visited.filter(Boolean).length * 100) / Math.max(1, explorer.nodes.length),
              ),
            })}
          </p>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-outline bg-surface p-3">
          <p className="lf-label text-content">
            {t('games.explorer.youAreHere', { label: here?.label_md ?? '' })}
          </p>
          {here?.description_md !== undefined && (
            <p className="lf-caption text-content-muted">{here.description_md}</p>
          )}

          {cacheHere > 0 && (
            <button
              type="button"
              disabled={locked || travelling}
              onClick={() => emit('take', { slot: here?.id })}
              className={cn(
                'rounded-md bg-warning px-3 py-2 text-on-warning',
                HIT_TARGET_CLASS,
              )}
            >
              {t('games.explorer.recover', { amount: cacheHere })}
            </button>
          )}

          {cacheHere === 0 && challengeOpen && challenge !== undefined && (
            <div className="flex flex-col gap-2">
              <p className="lf-caption text-content">{challenge.prompt_md}</p>
              {challenge.options.map((option, index) => (
                <button
                  key={option.id}
                  type="button"
                  disabled={locked || travelling}
                  onClick={() => emit('take', { slot: here?.id, n: index })}
                  className={cn(
                    'rounded-md border border-outline bg-base px-3 py-2 text-left text-content',
                    HIT_TARGET_CLASS,
                    !reducedMotion && 'transition-colors duration-150',
                  )}
                >
                  <span className="lf-caption">{option.label_md}</span>
                </button>
              ))}
              <p className="lf-caption text-content-muted">
                {t('games.explorer.attemptsLeft', {
                  count: explorer.attemptsLeft[explorer.at] ?? 0,
                })}
              </p>
            </div>
          )}

          {cacheHere === 0 && !challengeOpen && claimable && (
            <button
              type="button"
              disabled={locked || travelling}
              onClick={() => emit('take', { slot: here?.id })}
              className={cn('rounded-md bg-accent px-3 py-2 text-on-accent', HIT_TARGET_CLASS)}
            >
              {here?.price === undefined
                ? t('games.explorer.take')
                : t('games.explorer.buy', { price: here.price })}
            </button>
          )}

          {canRestHere && (
            <button
              type="button"
              disabled={locked || travelling}
              onClick={() => emit('rest')}
              className={cn(
                'rounded-md border border-outline bg-base px-3 py-2 text-content',
                HIT_TARGET_CLASS,
              )}
            >
              {t('games.explorer.rest')}
            </button>
          )}

          {cacheHere === 0 && !challengeOpen && !claimable && !canRestHere && (
            <p className="lf-caption text-content-muted">{t('games.explorer.nothingHere')}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <p className="lf-caption text-content-muted">{t('games.explorer.abilityTray')}</p>
          <div className="flex flex-wrap items-stretch gap-2">
            {explorer.abilities.map((_, index) => renderAbilityChip(index))}
          </div>
        </div>

        <p className="lf-caption text-content-muted">
          {tap.selected === null ? t('games.explorer.hint') : t('games.explorer.hintSelected')}
        </p>
      </div>
    </div>
  )
}
