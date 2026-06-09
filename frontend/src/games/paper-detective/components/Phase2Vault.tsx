import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PICTURES, COIN_EMOJI } from '../constants';
import type { DrawerCoin } from '../types';
import { AssetImg } from '@/components/ui/AssetImg';

interface Props {
  target: number;
  drawerCoins: DrawerCoin[];
  vaultCoins: DrawerCoin[];
  ejectedId: string | null;
  feedback: 'correct' | 'incorrect' | null;
  onAddCoin: (instanceId: string) => void;
  onRemoveCoin: (instanceId: string) => void;
  onClearVault: () => void;
}

function CoinImg({ imageKey, size, className = '' }: { imageKey: string; size: number; className?: string }) {
  const src = (PICTURES as Record<string, string>)[imageKey];
  return (
    <AssetImg
      assetPath={src}
      alt=""
      style={{ width: size, height: size, objectFit: 'contain' }}
      className={`pointer-events-none ${className}`}
      draggable={false}
      fallback={
        <span style={{ fontSize: size * 0.65 }} className="select-none pointer-events-none">
          {COIN_EMOJI[imageKey] ?? '🪙'}
        </span>
      }
    />
  );
}

// ── DraggableCoin: handles both tap and drag ──
interface DraggableCoinProps {
  coin: DrawerCoin;
  size: number;
  isEjected: boolean;
  vaultRef: React.RefObject<HTMLDivElement | null>;
  onAdd: (instanceId: string) => void;
  disabled: boolean;
}

function DraggableCoin({ coin, size, isEjected, vaultRef, onAdd, disabled }: DraggableCoinProps) {
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    startPosRef.current = { x: e.clientX, y: e.clientY };
    isDraggingRef.current = false;
  }, [disabled]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!startPosRef.current) return;
    const dx = e.clientX - startPosRef.current.x;
    const dy = e.clientY - startPosRef.current.y;
    if (!isDraggingRef.current && Math.sqrt(dx * dx + dy * dy) > 8) {
      isDraggingRef.current = true;
    }
    if (isDraggingRef.current) {
      setGhostPos({ x: e.clientX, y: e.clientY });
    }
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!startPosRef.current) return;

    if (isDraggingRef.current && vaultRef.current) {
      const rect = vaultRef.current.getBoundingClientRect();
      if (
        e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top && e.clientY <= rect.bottom
      ) {
        onAdd(coin.instanceId);
      }
    } else if (!isDraggingRef.current) {
      // Tap to add
      onAdd(coin.instanceId);
    }

    startPosRef.current = null;
    isDraggingRef.current = false;
    setGhostPos(null);
  }, [coin.instanceId, onAdd, vaultRef]);

  return (
    <>
      <button
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        disabled={disabled}
        className={`pd-vault-drawer-coin flex items-center justify-center bg-transparent border-0 p-0
          ${isEjected ? 'pd-coin-ejected' : ''}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        style={{
          width: size + 8,
          height: size + 8,
          padding: 4,
          touchAction: 'none',
        }}
        aria-label={`$${coin.value}`}
      >
        <CoinImg imageKey={coin.imageKey} size={size} />
        {/* Value badge */}
        <span
          className="absolute text-xs font-black text-white bg-blue-700 rounded-full pointer-events-none"
          style={{ bottom: 0, right: 0, minWidth: 18, padding: '1px 4px', fontSize: 11 }}
        >
          ${coin.value}
        </span>
      </button>

      {/* Ghost coin while dragging */}
      {ghostPos && (
        <div
          className="pd-drag-ghost flex items-center justify-center"
          style={{
            left: ghostPos.x - (size / 2 + 4),
            top: ghostPos.y - (size / 2 + 4),
            width: size + 8,
            height: size + 8,
          }}
        >
          <CoinImg imageKey={coin.imageKey} size={size} />
        </div>
      )}
    </>
  );
}

// ── Main Phase2Vault component ────────────────
export function Phase2Vault({
  target, drawerCoins, vaultCoins, ejectedId, feedback,
  onAddCoin, onRemoveCoin, onClearVault,
}: Props) {
  const { t } = useTranslation('games');
  const vaultRef = useRef<HTMLDivElement>(null);
  const coinSize = typeof window !== 'undefined' && window.innerWidth < 640 ? 48 : 56;
  const currentSum = vaultCoins.reduce((s, c) => s + c.value, 0);
  const disabled = feedback !== null;

  return (
    <div className="flex flex-col items-center justify-between h-full pt-14 pb-3 px-3 pd-font">

      {/* Instruction */}
      <div className="pd-card-dark px-4 py-2 text-center mb-2">
        <p className="text-sm font-bold text-blue-900">
          {t('paperDetective.phase2.instruction')}
        </p>
      </div>

      {/* Vault + Piggy */}
      <div className="flex-1 flex flex-col items-center justify-center gap-3 w-full max-w-sm">

        {/* Piggy bank image + drop zone */}
        <div className="relative flex flex-col items-center">
          {/* Piggy image */}
          <div
            ref={vaultRef}
            className={`relative flex items-center justify-center rounded-full transition-all
              ${disabled && feedback === 'correct' ? 'pd-piggy-success' : ''}
            `}
            style={{ width: 120, height: 120 }}
          >
            <AssetImg
              assetPath={feedback === 'correct' ? PICTURES.piggyBankFull : PICTURES.piggyBank}
              alt="Piggy Bank"
              className="w-full h-full object-contain drop-shadow-lg"
              draggable={false}
              fallback={<span className="text-7xl">🐷</span>}
            />
            {/* Vault flash overlays */}
            {feedback === 'correct' && <div className="pd-vault-success-overlay rounded-full" />}
            {feedback === 'incorrect' && <div className="pd-vault-error-overlay rounded-full" />}
          </div>

          {/* Digital display */}
          <div className="pd-piggy-display px-4 py-2 rounded-lg mt-2 text-center">
            <span className="text-2xl font-black tabular-nums">
              ${currentSum}
            </span>
            <span className="text-lg text-green-600"> / ${target}</span>
          </div>
        </div>

        {/* Coins in vault (click to remove) */}
        {vaultCoins.length > 0 && (
          <div className="pd-card w-full px-3 py-2">
            <p className="text-xs font-bold text-blue-700 mb-2 text-center">
              {t('paperDetective.phase2.vaultLabel')}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {vaultCoins.map(coin => (
                <button
                  key={coin.instanceId}
                  onClick={() => !disabled && onRemoveCoin(coin.instanceId)}
                  disabled={disabled}
                  className={`pd-vault-coin relative flex items-center justify-center p-1 bg-transparent border-0
                    ${disabled ? 'cursor-default' : ''}
                  `}
                  style={{ width: coinSize + 8, height: coinSize + 8 }}
                  aria-label={`${t('paperDetective.phase2.removeLabel')} $${coin.value}`}
                >
                  <CoinImg imageKey={coin.imageKey} size={coinSize} />
                  <span className="absolute text-xs font-black text-white bg-green-700 rounded-full pointer-events-none"
                    style={{ bottom: 0, right: 0, minWidth: 18, padding: '1px 4px', fontSize: 11 }}>
                    ${coin.value}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Feedback */}
        {feedback === 'incorrect' && (
          <p className="text-red-600 font-black text-base pd-feedback-incorrect">
            {t('paperDetective.phase2.overshoot')}
          </p>
        )}
        {feedback === 'correct' && (
          <p className="text-green-700 font-black text-xl pd-feedback-correct">
            {t('paperDetective.phase2.success')}
          </p>
        )}

        {/* Clear button */}
        {vaultCoins.length > 0 && !disabled && (
          <button
            onClick={onClearVault}
            className="pd-btn pd-btn-danger px-4 py-2 text-xs font-bold"
          >
            🗑 {t('paperDetective.phase2.clearButton')}
          </button>
        )}
      </div>

      {/* Drawer (coins available to drag) */}
      <div className="w-full max-w-sm">
        <div className="pd-card px-2 py-2">
          <p className="text-xs font-bold text-blue-700 text-center mb-2">
            {t('paperDetective.phase2.drawerLabel')}
          </p>
          <div className="flex justify-center flex-wrap gap-2 overflow-x-auto"
            style={{ touchAction: 'pan-x' }}>
            {drawerCoins.map(coin => (
              <DraggableCoin
                key={coin.instanceId}
                coin={coin}
                size={coinSize}
                isEjected={coin.instanceId === ejectedId}
                vaultRef={vaultRef}
                onAdd={onAddCoin}
                disabled={disabled}
              />
            ))}
            {drawerCoins.length === 0 && (
              <p className="text-xs text-blue-500 italic py-2">
                {t('paperDetective.phase2.noCoins')}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
