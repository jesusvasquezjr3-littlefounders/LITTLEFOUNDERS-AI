import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { COSMETICS, PICTURES } from '../constants';
import type { GameState, GameAction, CosmeticType } from '../types';

interface Props {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  onBack: () => void;
  onPlayAgain: () => void;
}

const CATEGORY_ICONS: Record<CosmeticType, string> = {
  hat: '🎩',
  glasses: '🕶️',
  mustache: '👨',
};

export function WardrobeScreen({ state, dispatch, onBack, onPlayAgain }: Props) {
  const { t } = useTranslation('games');
  const [detectiveError, setDetectiveError] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CosmeticType | 'all'>('all');
  const [spendConfirm, setSpendConfirm] = useState<string | null>(null);

  const visibleCosmetics = selectedCategory === 'all'
    ? COSMETICS
    : COSMETICS.filter(c => c.type === selectedCategory);

  const handleUnlock = (cosmeticId: string, cost: number) => {
    if (state.totalPoints < cost) return;
    if (spendConfirm !== cosmeticId) {
      setSpendConfirm(cosmeticId);
      return;
    }
    // Reducer handles point deduction, localStorage persistence, and state update
    dispatch({ type: 'UNLOCK_COSMETIC', cosmeticId, cost });
    dispatch({ type: 'EQUIP_COSMETIC', cosmeticId });
    setSpendConfirm(null);
  };

  const handleEquip = (cosmeticId: string) => {
    if (state.equippedCosmetic === cosmeticId) {
      dispatch({ type: 'UNEQUIP_COSMETIC' });
    } else {
      dispatch({ type: 'EQUIP_COSMETIC', cosmeticId });
    }
  };

  const equippedDef = state.equippedCosmetic ? COSMETICS.find(c => c.id === state.equippedCosmetic) : null;

  return (
    <div className="absolute inset-0 pd-bg flex flex-col pd-font overflow-hidden">

      {/* Header */}
      <div className="pd-card mx-3 mt-3 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <button onClick={onBack} className="pd-btn px-3 py-1 text-xs font-bold text-amber-700">
          ← {t('paperDetective.wardrobe.back')}
        </button>
        <h2 className="text-sm font-black text-amber-900">
          👔 {t('paperDetective.wardrobe.title')}
        </h2>
        <div className="pd-card px-2 py-1 text-center" style={{ background: '#f1c40f', borderColor: '#d68910' }}>
          <span className="text-xs font-black text-amber-900">⭐ {state.totalPoints}</span>
        </div>
      </div>

      {/* Detective preview */}
      <div className="flex-shrink-0 flex flex-col items-center py-2">
        <div className="relative" style={{ height: 100, width: 100 }}>
          {!detectiveError ? (
            <img
              src={PICTURES.detective}
              alt="Detective"
              className="absolute bottom-0 left-1/2 -translate-x-1/2 h-full object-contain"
              onError={() => setDetectiveError(true)}
              draggable={false}
            />
          ) : (
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-6xl">🕵️</span>
          )}
          {equippedDef && (
            <img
              src={(PICTURES as Record<string, string>)[equippedDef.imageKey]}
              alt=""
              className="absolute bottom-0 left-1/2 -translate-x-1/2 h-full object-contain pointer-events-none"
              draggable={false}
            />
          )}
        </div>
        {equippedDef && (
          <span className="text-xs font-bold text-amber-700 mt-1">
            ✓ {t(equippedDef.nameKey)}
          </span>
        )}
      </div>

      {/* Category filter */}
      <div className="flex gap-2 px-3 mb-2 flex-shrink-0">
        {(['all', 'hat', 'glasses', 'mustache'] as const).map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`pd-btn px-3 py-1 text-xs font-bold flex-1 ${selectedCategory === cat ? 'pd-btn-primary' : 'text-amber-800'}`}
          >
            {cat === 'all' ? '👁️' : CATEGORY_ICONS[cat as CosmeticType]}{' '}
            {cat === 'all'
              ? t('paperDetective.wardrobe.all')
              : t(`paperDetective.wardrobe.categories.${cat}`)}
          </button>
        ))}
      </div>

      {/* Cosmetics grid */}
      <div className="flex-1 overflow-y-auto px-3 pb-2">
        <div className="grid grid-cols-2 gap-3">
          {visibleCosmetics.map(cosmetic => {
            const isUnlocked = state.unlockedCosmetics.includes(cosmetic.id);
            const isEquipped = state.equippedCosmetic === cosmetic.id;
            const canAfford = state.totalPoints >= cosmetic.cost;
            const isConfirming = spendConfirm === cosmetic.id;

            return (
              <div
                key={cosmetic.id}
                className={`pd-card p-3 text-center ${isEquipped ? 'border-green-500' : ''}`}
                style={{ borderColor: isEquipped ? '#27ae60' : undefined }}
              >
                {/* Image */}
                <div className="flex items-center justify-center mb-2" style={{ height: 60 }}>
                  <img
                    src={(PICTURES as Record<string, string>)[cosmetic.imageKey]}
                    alt={t(cosmetic.nameKey)}
                    style={{ maxHeight: 56, objectFit: 'contain' }}
                    draggable={false}
                  />
                </div>
                <p className="text-xs font-bold text-amber-800 mb-2">{t(cosmetic.nameKey)}</p>

                {isUnlocked ? (
                  <button
                    onClick={() => handleEquip(cosmetic.id)}
                    className={`pd-btn w-full py-1.5 text-xs font-bold ${isEquipped ? 'pd-btn-danger' : 'pd-btn-green'}`}
                  >
                    {isEquipped ? t('paperDetective.wardrobe.unequip') : t('paperDetective.wardrobe.equip')}
                  </button>
                ) : (
                  <button
                    onClick={() => handleUnlock(cosmetic.id, cosmetic.cost)}
                    disabled={!canAfford}
                    className={`pd-btn w-full py-1.5 text-xs font-bold ${canAfford ? 'pd-btn-primary' : 'text-amber-400 cursor-not-allowed'}`}
                  >
                    {isConfirming
                      ? `✓ ${t('paperDetective.wardrobe.confirm')}`
                      : `⭐ ${cosmetic.cost} — ${t('paperDetective.wardrobe.unlock')}`
                    }
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom actions */}
      <div className="flex gap-3 px-3 pb-3 flex-shrink-0">
        <button onClick={onPlayAgain} className="pd-btn pd-btn-primary flex-1 py-3 text-sm font-black">
          🔄 {t('paperDetective.wardrobe.playAgain')}
        </button>
      </div>
    </div>
  );
}
