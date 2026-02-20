import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { FallingItem as FallingItemType, GameItemDefinition } from '../types';
import { GAME_CONFIG } from '../constants';
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
  const [imgError, setImgError] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  // Track dragging state locally with a ref so pointer events work
  // immediately without waiting for React re-render (stale closure fix).
  const isDraggingRef = useRef(false);

  const size = window.innerWidth < 640 ? GAME_CONFIG.itemSizeMobilePx : GAME_CONFIG.itemSizePx;
  const itemName = t(`namVsYum.items.${definition.key}`);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (item.isConsumed) return;
      e.preventDefault();
      e.stopPropagation();

      const el = elementRef.current;
      if (el) {
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          // Fallback: some browsers may not support this
        }
      }

      const rect = el?.getBoundingClientRect();
      const offsetX = rect ? e.clientX - rect.left - rect.width / 2 : 0;
      const offsetY = rect ? e.clientY - rect.top - rect.height / 2 : 0;

      // Set local ref synchronously so subsequent pointer events work instantly
      isDraggingRef.current = true;
      onDragStart(item.id, offsetX, offsetY);
    },
    [item.id, item.isConsumed, onDragStart],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      // Use the synchronous ref — not the async prop from state
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
        try {
          el.releasePointerCapture(e.pointerId);
        } catch {
          // ignore
        }
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

  // Sync ref when item gets consumed or drag ends externally (e.g. from reducer)
  if (!item.isDragging && isDraggingRef.current) {
    isDraggingRef.current = false;
  }

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
          'w-full h-full rounded-lg flex items-center justify-center',
          'bg-slate-800/80 border-2 border-slate-600',
          'shadow-md',
        )}
      >
        {!imgError ? (
          <img
            src={definition.imageUrl}
            alt={itemName}
            className="w-[80%] h-[80%] object-contain pixel-art"
            onError={() => setImgError(true)}
            draggable={false}
          />
        ) : (
          <span className="text-2xl sm:text-3xl">{definition.emoji}</span>
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
