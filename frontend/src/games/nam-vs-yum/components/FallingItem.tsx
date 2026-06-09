import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { FallingItem as FallingItemType, GameItemDefinition } from '../types';
import { GAME_CONFIG } from '../constants';
import { AssetImg } from '@/components/ui/AssetImg';
import { cn } from '@/lib/utils';

interface FallingItemProps {
  item: FallingItemType;
  definition: GameItemDefinition;
  onDragStart: (id: string, offsetX: number, offsetY: number) => void;
  onDragMove: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string) => void;
}

export function FallingItemComponent({ item, definition, onDragStart, onDragMove, onDragEnd }: FallingItemProps) {
  const { t } = useTranslation('games');
  const elementRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const size = window.innerWidth < 640 ? GAME_CONFIG.itemSizeMobilePx : GAME_CONFIG.itemSizePx;
  const itemName = t(`namVsYum.items.${definition.key}`, { defaultValue: definition.emoji });

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (item.isConsumed) return;
      e.preventDefault();
      e.stopPropagation();

      const el = elementRef.current;
      if (el) {
        try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      }

      const rect = el?.getBoundingClientRect();
      const offsetX = rect ? e.clientX - rect.left - rect.width / 2 : 0;
      const offsetY = rect ? e.clientY - rect.top - rect.height / 2 : 0;

      isDraggingRef.current = true;
      onDragStart(item.id, offsetX, offsetY);
    },
    [item.id, item.isConsumed, onDragStart],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      onDragMove(item.id, e.clientX, e.clientY);
    },
    [item.id, onDragMove],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      isDraggingRef.current = false;

      const el = elementRef.current;
      if (el) {
        try { el.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      }

      onDragEnd(item.id);
    },
    [item.id, onDragEnd],
  );

  const handlePointerCancel = useCallback(
    () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      onDragEnd(item.id);
    },
    [item.id, onDragEnd],
  );

  if (!item.isDragging && isDraggingRef.current) {
    isDraggingRef.current = false;
  }

  // Variant styles
  const variantClasses = {
    normal: 'bg-slate-800/80 border-slate-600',
    golden: 'bg-indigo-900/80 border-indigo-400 animate-golden-pulse',
    bomb: 'bg-red-900/80 border-red-500 animate-bomb-pulse',
    mystery: 'bg-indigo-900/80 border-indigo-400 animate-mystery-sparkle',
    rainbow: 'bg-gradient-to-br from-red-500 via-green-500 to-blue-500 border-white animate-rainbow-shift',
    unicorn: 'bg-pink-900/80 border-pink-400 animate-unicorn-magic',
  };

  const glowColors = {
    normal: definition.category === 'need' ? 'shadow-green-500/20' : 'shadow-purple-500/20',
    golden: 'shadow-indigo-400/60',
    bomb: 'shadow-red-500/60',
    mystery: 'shadow-indigo-400/60',
    rainbow: 'shadow-white/60',
    unicorn: 'shadow-pink-400/60',
  };

  const showEmoji = item.variant !== 'normal' || !definition.imageUrl;
  const displayEmoji = item.variant === 'unicorn' ? '🦄' : item.variant === 'bomb' ? '💣' : item.variant === 'mystery' ? '❓' : item.variant === 'rainbow' ? '🌈' : definition.emoji;

  return (
    <div
      ref={elementRef}
      className={cn(
        'absolute select-none touch-none',
        item.isDragging ? 'item-dragging' : 'item-falling',
        item.isConsumed && 'item-correct pointer-events-none',
      )}
      style={{
        left: item.x - size / 2,
        top: item.y - size / 2,
        width: size,
        height: size,
        transform: item.isDragging ? 'scale(1.15)' : `rotate(${item.rotation}deg)`,
        zIndex: item.isDragging ? 100 : 10,
        willChange: 'transform, left, top',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      role="img"
      aria-label={itemName}
    >
      <div
        className={cn(
          'w-full h-full rounded-lg flex items-center justify-center border-2',
          'shadow-md',
          variantClasses[item.variant],
          glowColors[item.variant],
          item.isDragging && 'shadow-xl',
        )}
      >
        {showEmoji ? (
          <span className="text-2xl sm:text-3xl">{displayEmoji}</span>
        ) : (
          <AssetImg
            assetPath={definition.imageUrl}
            alt={itemName}
            className="w-[80%] h-[80%] object-contain pixel-art"
            draggable={false}
            fallback={<span className="text-2xl sm:text-3xl">{displayEmoji}</span>}
          />
        )}

        {/* Bomb timer */}
        {item.variant === 'bomb' && item.bombTimer !== undefined && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className={cn(
              'pixel-font text-[8px] font-bold',
              item.bombTimer <= 2 ? 'text-red-500 animate-pulse' : 'text-violet-400'
            )}>
              {Math.ceil(item.bombTimer)}
            </span>
          </div>
        )}
      </div>

      {/* Item name label (visible when dragging) */}
      {item.isDragging && (
        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span className="pixel-font text-[6px] text-white bg-black/70 px-1.5 py-0.5 rounded">
            {itemName}
          </span>
        </div>
      )}
    </div>
  );
}
